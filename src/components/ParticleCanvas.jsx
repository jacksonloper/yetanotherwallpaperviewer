/**
 * Particle advection with GPU-rendered trails via framebuffer accumulation.
 *
 * RENDER PIPELINE (each frame):
 *   1. GPU: Compute equivariant velocity field on a coarse grid
 *   2. CPU: Read velocity back, spawn/advect/wrap/cull particles
 *   3. GPU: Fade previous accumulation texture (ping-pong)
 *   4. GPU: Stamp particles as soft point sprites (additive blend)
 *   5. GPU: Display accumulated texture with color mapping
 *
 * Trails arise from temporal persistence in the accumulation buffer —
 * NOT from explicit trail polylines. This eliminates wrap-crossing seam
 * artifacts and O(particles × trailLength) CPU/memory overhead.
 *
 * Lattice tiling uses GPU instancing: each particle is rendered once per
 * visible lattice copy with the offset applied in the vertex shader.
 * Offsets are cached and only recomputed when bounds/lattice change.
 *
 * CPU particle state uses flat typed arrays with swap-remove culling —
 * no per-particle objects, no trail history arrays.
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

/* ───────────────────── Constants ───────────────────── */

const GRID_RES      = 64;    // coarse velocity field resolution
const MAX_PARTICLES = 2000;  // buffer capacity (matches max slider value)
const MAX_COPIES    = 200;   // max visible lattice translation copies

/* ───────────────────── GLSL Shaders ───────────────────── */

/** Shared fullscreen-quad vertex shader (used by velocity, fade, display). */
const fullscreenVS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * Velocity field computation – evaluates equivariant vector field on a grid.
 * Output: RG channels encode (Vx, Vy) mapped to [0,1] for UnsignedByte storage.
 */
const velocityFS = /* glsl */ `
precision highp float;

uniform vec2  u_boundsMin;
uniform vec2  u_boundsMax;
uniform float u_dc1;
uniform float u_dc2;
uniform int   u_numModes;
uniform int   u_numCosets;
uniform float u_speedScale;

uniform sampler2D u_modesTexture1;
uniform sampler2D u_modesTexture2;
uniform sampler2D u_cosetsTexture;
uniform float u_modesTexWidth;
uniform float u_cosetsTexWidth;

varying vec2 vUv;

void main() {
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);
  vec2 V = vec2(0.0);

  for (int g = 0; g < 24; g++) {
    if (g >= u_numCosets) break;
    float cu = (float(g) + 0.5) / u_cosetsTexWidth;
    vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
    vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));
    vec2 gPos = vec2(
      abcd.x * pos.x + abcd.y * pos.y + txty.x,
      abcd.z * pos.x + abcd.w * pos.y + txty.y
    );
    float val1 = u_dc1;
    float val2 = u_dc2;
    for (int m = 0; m < 512; m++) {
      if (m >= u_numModes) break;
      float mu = (float(m) + 0.5) / u_modesTexWidth;
      vec4 mode1 = texture2D(u_modesTexture1, vec2(mu, 0.5));
      vec4 mode2 = texture2D(u_modesTexture2, vec2(mu, 0.5));
      float phase = mode1.x * gPos.x + mode1.y * gPos.y;
      float cp = cos(phase);
      float sp = sin(phase);
      val1 += mode1.z * cp + mode1.w * sp;
      val2 += mode2.z * cp + mode2.w * sp;
    }
    V += vec2(
      abcd.x * val1 + abcd.z * val2,
      abcd.y * val1 + abcd.w * val2
    );
  }
  V /= float(u_numCosets);
  V *= u_speedScale;

  // Encode to [0,1] for UnsignedByte storage (range ±4)
  gl_FragColor = vec4(V / 8.0 + 0.5, 0.0, 1.0);
}
`;

/**
 * Fade pass – decays the previous accumulation buffer.
 * This is what creates trails: old particle stamps persist but gradually fade.
 */
const fadeFS = /* glsl */ `
precision highp float;
uniform sampler2D u_prev;
uniform float u_decay;
varying vec2 vUv;

void main() {
  float prev = texture2D(u_prev, vUv).r;
  gl_FragColor = vec4(vec3(prev * u_decay), 1.0);
}
`;

/**
 * Particle stamp vertex shader.
 * Positions each particle in NDC using math coords + instanced lattice offset.
 * Tiling is handled entirely on GPU via instancing — CPU only tracks
 * particles in the fundamental domain.
 */
const particleVS = /* glsl */ `
attribute float aLife;
attribute vec2 aLatticeOffset;   // per-instance: lattice translation for tiling

uniform vec2  u_boundsMin;
uniform vec2  u_boundsMax;
uniform float u_pointSize;

varying float vLife;

void main() {
  // Apply lattice translation for tiling (instanced attribute)
  vec2 worldPos = position.xy + aLatticeOffset;

  // Math coords → normalised [0,1] → NDC [-1,1]
  vec2 uv = (worldPos - u_boundsMin) / (u_boundsMax - u_boundsMin);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  vLife = aLife;

  // Cull dead or off-screen particles (move to clip-space discard)
  if (aLife <= 0.0 || uv.x < -0.05 || uv.x > 1.05 || uv.y < -0.05 || uv.y > 1.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}
`;

/**
 * Particle stamp fragment shader.
 * Renders a soft circular glow instead of hard-edged points.
 * Intensity modulated by particle life for natural fade-in/out.
 */
const particleFS = /* glsl */ `
precision highp float;
varying float vLife;

void main() {
  // Soft circular falloff centered on point sprite
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(pc, pc);
  if (r2 > 1.0) discard;
  float glow = exp(-3.0 * r2);
  float intensity = glow * vLife * 0.5;
  gl_FragColor = vec4(vec3(intensity), 1.0);
}
`;

/**
 * Display pass – maps accumulated intensity to a dark-background colour.
 * Uses gamma (pow 0.45) to boost dim trail visibility.
 */
const displayFS = /* glsl */ `
precision highp float;
uniform sampler2D u_accum;
varying vec2 vUv;

void main() {
  float d = texture2D(u_accum, vUv).r;
  // Gamma boost makes dim trails more visible
  d = pow(clamp(d, 0.0, 1.0), 0.45);
  // Black → bright cool white
  vec3 bg    = vec3(0.0);
  vec3 bright = vec3(0.85, 0.95, 1.0);
  gl_FragColor = vec4(mix(bg, bright, d), 1.0);
}
`;

/* ───────────────────── Helpers (shared with Wind) ───────────────────── */

function buildModesTexture(modes) {
  const n = Math.max(modes.length, 1);
  const data = new Float32Array(n * 4);
  for (let i = 0; i < modes.length; i++) {
    data[i * 4 + 0] = modes[i].kx;
    data[i * 4 + 1] = modes[i].ky;
    data[i * 4 + 2] = modes[i].a;
    data[i * 4 + 3] = modes[i].b;
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function buildCosetsTexture(cosets) {
  const n = Math.max(cosets.length, 1);
  const data = new Float32Array(n * 2 * 4);
  for (let i = 0; i < cosets.length; i++) {
    data[i * 4 + 0] = cosets[i].a;
    data[i * 4 + 1] = cosets[i].b;
    data[i * 4 + 2] = cosets[i].c;
    data[i * 4 + 3] = cosets[i].d;
    const row1 = n * 4;
    data[row1 + i * 4 + 0] = cosets[i].tx;
    data[row1 + i * 4 + 1] = cosets[i].ty;
    data[row1 + i * 4 + 2] = 0;
    data[row1 + i * 4 + 3] = 0;
  }
  const tex = new THREE.DataTexture(data, n, 2, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function computeWindSpeedScale(modes1, modes2) {
  let energy = 0;
  for (const { a, b } of modes1) energy += a * a + b * b;
  for (const { a, b } of modes2) energy += a * a + b * b;
  const sigma = Math.sqrt(energy) || 1;
  return 1.0 / sigma;
}

/** Wrap (px,py) into [0,1)×[0,1) lattice coords, then back to physical. */
function wrapToFundamentalDomain(px, py, v1, v2) {
  const det = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(det) < 1e-12) return { x: px, y: py };
  const s = (v2.y * px - v2.x * py) / det;
  const t = (-v1.y * px + v1.x * py) / det;
  const sw = s - Math.floor(s);
  const tw = t - Math.floor(t);
  return {
    x: sw * v1.x + tw * v2.x,
    y: sw * v1.y + tw * v2.y,
  };
}

/* ───────────────────── React Component ───────────────────── */

/**
 * @param {object}  props.windCoeffs    { gp1: {modes,dc,...}, gp2: {modes,dc,...} }
 * @param {Array}   props.cosetReps     Physical isometry coset reps [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {{v1:{x,y}, v2:{x,y}}} props.latticeVectors  Translation lattice basis
 * @param {number}  props.width         Canvas width in pixels
 * @param {number}  props.height        Canvas height in pixels
 * @param {number}  props.spawnRate     Particles spawned per frame (0-20)
 * @param {number}  props.fadeSpeed     How fast particles die (life lost per frame)
 * @param {number}  props.tailLength    Controls accumulation decay / trail persistence (higher = longer trail)
 * @param {number}  props.maxParticles  Maximum number of alive particles (50-2000)
 * @param {number}  [props.dotSize]     Point sprite size in pixels (1-20, default 6)
 * @param {number}  [props.resetTrigger]  Increment to clear all particles + accumulation
 */
export default function ParticleCanvas({
  windCoeffs, cosetReps, bounds, latticeVectors,
  width, height, spawnRate, fadeSpeed, tailLength, maxParticles,
  dotSize, resetTrigger,
}) {
  const canvasRef       = useRef(null);
  const rendererRef     = useRef(null);
  const cameraRef       = useRef(null);

  // Velocity computation
  const velSceneRef     = useRef(null);
  const velMatRef       = useRef(null);
  const velRTRef        = useRef(null);
  const texturesRef     = useRef({ modes1: null, modes2: null, cosets: null });
  const velGridRef      = useRef(null);

  // Accumulation ping-pong
  const accumRTRef      = useRef([null, null]);
  const pingPongRef     = useRef(0);

  // Fade pass
  const fadeSceneRef    = useRef(null);
  const fadeMatRef      = useRef(null);

  // Particle rendering
  const particleSceneRef = useRef(null);
  const particleGeoRef  = useRef(null);
  const particleMatRef  = useRef(null);

  // Display pass
  const dispSceneRef    = useRef(null);
  const dispMatRef      = useRef(null);

  // CPU particle state — flat typed arrays, NO trail history
  const cpuStateRef     = useRef({
    posX: new Float32Array(MAX_PARTICLES),
    posY: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES),
    numAlive: 0,
  });

  // Lattice copy offset cache (recomputed only when lattice/bounds change)
  const latticeKeyRef   = useRef('');

  // Animation
  const animIdRef       = useRef(null);
  const propsRef        = useRef({});
  const resetRef        = useRef(resetTrigger);
  const prevResetRef    = useRef(resetTrigger);
  const needsAccumClear = useRef(true);

  // Keep latest props accessible from animation loop closure
  useEffect(() => {
    propsRef.current = { bounds, spawnRate, fadeSpeed, tailLength, maxParticles, latticeVectors, dotSize };
  }, [bounds, spawnRate, fadeSpeed, tailLength, maxParticles, latticeVectors, dotSize]);

  useEffect(() => {
    resetRef.current = resetTrigger;
  }, [resetTrigger]);

  /* ── Initialise entire Three.js pipeline (once) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Renderer (single WebGL context for all passes) ---
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false });
    renderer.setSize(width, height, false);
    renderer.autoClear = false;
    rendererRef.current = renderer;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const fsGeom = new THREE.PlaneGeometry(2, 2);

    // --- Velocity computation scene ---
    const phModes1 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phModes2 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phCosets = buildCosetsTexture([{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }]);
    texturesRef.current = { modes1: phModes1, modes2: phModes2, cosets: phCosets };

    const velRT = new THREE.WebGLRenderTarget(GRID_RES, GRID_RES, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    });
    velRTRef.current = velRT;

    const velMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVS, fragmentShader: velocityFS,
      uniforms: {
        u_boundsMin:      { value: new THREE.Vector2(-4, -3) },
        u_boundsMax:      { value: new THREE.Vector2(4, 3) },
        u_dc1:            { value: 0 },
        u_dc2:            { value: 0 },
        u_numModes:       { value: 1 },
        u_numCosets:      { value: 1 },
        u_speedScale:     { value: 1.0 },
        u_modesTexture1:  { value: phModes1 },
        u_modesTexture2:  { value: phModes2 },
        u_cosetsTexture:  { value: phCosets },
        u_modesTexWidth:  { value: 1.0 },
        u_cosetsTexWidth: { value: 1.0 },
      },
    });
    velMatRef.current = velMat;

    const velScene = new THREE.Scene();
    velScene.add(new THREE.Mesh(fsGeom.clone(), velMat));
    velSceneRef.current = velScene;

    velGridRef.current = new Float32Array(GRID_RES * GRID_RES * 2);

    // --- Accumulation render targets (ping-pong) ---
    const mkAccumRT = () => new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
    });
    accumRTRef.current = [mkAccumRT(), mkAccumRT()];

    // --- Fade scene (decays previous accumulation) ---
    const fadeMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVS, fragmentShader: fadeFS,
      uniforms: {
        u_prev:  { value: accumRTRef.current[0].texture },
        u_decay: { value: 0.95 },
      },
    });
    fadeMatRef.current = fadeMat;

    const fadeScene = new THREE.Scene();
    fadeScene.add(new THREE.Mesh(fsGeom.clone(), fadeMat));
    fadeSceneRef.current = fadeScene;

    // --- Particle geometry (InstancedBufferGeometry for GPU tiling) ---
    // Base geometry: per-particle attributes (position, life)
    // Instance attribute: per-lattice-copy offset
    const particleGeo = new THREE.InstancedBufferGeometry();

    const gpuPos = new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    gpuPos.setUsage(THREE.DynamicDrawUsage);
    particleGeo.setAttribute('position', gpuPos);

    const gpuLife = new THREE.Float32BufferAttribute(new Float32Array(MAX_PARTICLES), 1);
    gpuLife.setUsage(THREE.DynamicDrawUsage);
    particleGeo.setAttribute('aLife', gpuLife);

    const gpuOffset = new THREE.InstancedBufferAttribute(new Float32Array(MAX_COPIES * 2), 2);
    gpuOffset.setUsage(THREE.DynamicDrawUsage);
    particleGeo.setAttribute('aLatticeOffset', gpuOffset);

    particleGeo.instanceCount = 0;
    particleGeo.setDrawRange(0, 0);
    particleGeoRef.current = particleGeo;

    // Particle material — additive blending so overlapping particles brighten
    const particleMat = new THREE.ShaderMaterial({
      vertexShader: particleVS, fragmentShader: particleFS,
      uniforms: {
        u_boundsMin: { value: new THREE.Vector2(-4, -3) },
        u_boundsMax: { value: new THREE.Vector2(4, 3) },
        u_pointSize: { value: 6.0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    particleMatRef.current = particleMat;

    const particleScene = new THREE.Scene();
    particleScene.add(new THREE.Points(particleGeo, particleMat));
    particleSceneRef.current = particleScene;

    // --- Display scene (maps accumulation → final colour) ---
    const dispMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVS, fragmentShader: displayFS,
      uniforms: {
        u_accum: { value: accumRTRef.current[0].texture },
      },
    });
    dispMatRef.current = dispMat;

    const dispScene = new THREE.Scene();
    dispScene.add(new THREE.Mesh(fsGeom.clone(), dispMat));
    dispSceneRef.current = dispScene;

    // --- Reusable readback buffer ---
    const pixelBuf = new Uint8Array(GRID_RES * GRID_RES * 4);

    // =================================================================
    //  ANIMATION LOOP
    // =================================================================
    const animate = () => {
      const r = rendererRef.current;
      if (!r) { animIdRef.current = requestAnimationFrame(animate); return; }

      const props = propsRef.current;
      const { bounds: b, spawnRate: sr, fadeSpeed: fs, tailLength: tl,
              maxParticles: mp, latticeVectors: lv, dotSize: ds } = props;
      if (!b || !lv) { animIdRef.current = requestAnimationFrame(animate); return; }

      const v1 = lv.v1;
      const v2 = lv.v2;
      const state = cpuStateRef.current;
      const art = accumRTRef.current;

      // -- Handle reset (clear particles + accumulation) --
      if (resetRef.current !== prevResetRef.current) {
        state.numAlive = 0;
        needsAccumClear.current = true;
        prevResetRef.current = resetRef.current;
      }
      if (needsAccumClear.current) {
        r.setRenderTarget(art[0]); r.clear();
        r.setRenderTarget(art[1]); r.clear();
        needsAccumClear.current = false;
      }

      // ── 1. Compute velocity field on GPU ─────────────────
      r.setRenderTarget(velRTRef.current);
      r.clear();
      r.render(velSceneRef.current, camera);

      // ── 2. Read back velocity grid to CPU ────────────────
      r.readRenderTargetPixels(velRTRef.current, 0, 0, GRID_RES, GRID_RES, pixelBuf);
      const vg = velGridRef.current;
      for (let i = 0; i < GRID_RES * GRID_RES; i++) {
        vg[i * 2 + 0] = ((pixelBuf[i * 4 + 0] / 255.0) - 0.5) * 8.0;
        vg[i * 2 + 1] = ((pixelBuf[i * 4 + 1] / 255.0) - 0.5) * 8.0;
      }

      // ── 3. Spawn new particles in fundamental domain ─────
      const numSpawn = Math.floor(sr) + (Math.random() < (sr % 1) ? 1 : 0);
      for (let s = 0; s < numSpawn && state.numAlive < mp; s++) {
        const s1 = Math.random();
        const s2 = Math.random();
        const n = state.numAlive;
        state.posX[n] = s1 * v1.x + s2 * v2.x;
        state.posY[n] = s1 * v1.y + s2 * v2.y;
        state.life[n] = 1.0;
        state.numAlive++;
      }

      // ── 4. Advect, wrap, cull (flat arrays, swap-remove) ─
      const dt = 0.016;
      let alive = state.numAlive;
      for (let i = alive - 1; i >= 0; i--) {
        // Bilinear velocity sample from coarse grid
        const u = (state.posX[i] - b.minX) / (b.maxX - b.minX) * GRID_RES;
        const v = (state.posY[i] - b.minY) / (b.maxY - b.minY) * GRID_RES;
        const gi = Math.max(0, Math.min(GRID_RES - 2, Math.floor(u)));
        const gj = Math.max(0, Math.min(GRID_RES - 2, Math.floor(v)));
        const fu = u - gi;
        const fv = v - gj;

        const idx00 = (gj * GRID_RES + gi) * 2;
        const idx10 = idx00 + 2;
        const idx01 = ((gj + 1) * GRID_RES + gi) * 2;
        const idx11 = idx01 + 2;

        const vx = (1 - fu) * (1 - fv) * vg[idx00]     + fu * (1 - fv) * vg[idx10]
                 + (1 - fu) * fv       * vg[idx01]     + fu * fv       * vg[idx11];
        const vy = (1 - fu) * (1 - fv) * vg[idx00 + 1] + fu * (1 - fv) * vg[idx10 + 1]
                 + (1 - fu) * fv       * vg[idx01 + 1] + fu * fv       * vg[idx11 + 1];

        // Euler step
        state.posX[i] += vx * dt;
        state.posY[i] += vy * dt;

        // Wrap to fundamental domain — no trail array means no seam artifacts
        const w = wrapToFundamentalDomain(state.posX[i], state.posY[i], v1, v2);
        state.posX[i] = w.x;
        state.posY[i] = w.y;

        state.life[i] -= fs;

        // Swap-remove dead particles (keeps alive particles contiguous)
        if (state.life[i] <= 0) {
          alive--;
          state.posX[i] = state.posX[alive];
          state.posY[i] = state.posY[alive];
          state.life[i] = state.life[alive];
        }
      }
      state.numAlive = alive;

      // ── 5. Upload particle data to GPU buffers ───────────
      const geo = particleGeoRef.current;
      const posAttr = geo.getAttribute('position');
      const lifeAttr = geo.getAttribute('aLife');
      const pa = posAttr.array;
      const la = lifeAttr.array;
      for (let i = 0; i < alive; i++) {
        pa[i * 3 + 0] = state.posX[i];
        pa[i * 3 + 1] = state.posY[i];
        // pa[i*3+2] stays 0 (z = 0)
        la[i] = state.life[i];
      }
      // Zero life for remaining slots so dead particles are culled in shader
      for (let i = alive; i < MAX_PARTICLES; i++) {
        la[i] = 0;
      }
      posAttr.needsUpdate = true;
      lifeAttr.needsUpdate = true;
      geo.setDrawRange(0, alive);

      // ── 5b. Update lattice copy offsets (cached) ─────────
      const latticeKey = `${v1.x},${v1.y},${v2.x},${v2.y},${b.minX},${b.maxX},${b.minY},${b.maxY}`;
      if (latticeKey !== latticeKeyRef.current) {
        const offsetAttr = geo.getAttribute('aLatticeOffset');
        const oa = offsetAttr.array;
        let nc = 0;
        const maxN = 10;
        for (let n1 = -maxN; n1 <= maxN; n1++) {
          for (let n2 = -maxN; n2 <= maxN; n2++) {
            const tx = n1 * v1.x + n2 * v2.x;
            const ty = n1 * v1.y + n2 * v2.y;
            // Keep copies that could bring a fundamental-domain point into view
            // Padding in math-coord units to ensure particles near the edge
            // of the fundamental domain are visible when translated.
            const margin = 2;
            if (tx + margin < b.minX - 1 || tx - margin > b.maxX + 1) continue;
            if (ty + margin < b.minY - 1 || ty - margin > b.maxY + 1) continue;
            if (nc < MAX_COPIES) {
              oa[nc * 2 + 0] = tx;
              oa[nc * 2 + 1] = ty;
              nc++;
            }
          }
        }
        offsetAttr.needsUpdate = true;
        geo.instanceCount = nc;
        latticeKeyRef.current = latticeKey;
      }

      // ── 6. Accumulation: fade + stamp ────────────────────
      const curr = pingPongRef.current;
      const next = 1 - curr;

      // Trail decay: tailLength controls how many frames of persistence.
      // decay = 1 - 1/(tl+1) gives ~tl frames at 50% intensity.
      const decay = 1.0 - 1.0 / (Math.max(tl, 1) + 1);

      // 6a. Fade pass: read accumRT[curr], write decayed version to accumRT[next]
      // The fullscreen quad writes every pixel, so no clear is needed.
      fadeMatRef.current.uniforms.u_prev.value = art[curr].texture;
      fadeMatRef.current.uniforms.u_decay.value = decay;
      r.setRenderTarget(art[next]);
      r.render(fadeSceneRef.current, camera);

      // 6b. Particle stamp: additive blend into accumRT[next]
      particleMatRef.current.uniforms.u_boundsMin.value.set(b.minX, b.minY);
      particleMatRef.current.uniforms.u_boundsMax.value.set(b.maxX, b.maxY);
      particleMatRef.current.uniforms.u_pointSize.value = ds ?? 6;
      r.render(particleSceneRef.current, camera);

      // ── 7. Display pass: accumRT[next] → screen ─────────
      dispMatRef.current.uniforms.u_accum.value = art[next].texture;
      r.setRenderTarget(null);
      r.clear();
      r.render(dispSceneRef.current, camera);

      // ── 8. Swap ping-pong ────────────────────────────────
      pingPongRef.current = next;

      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      fsGeom.dispose();
      velMat.dispose();
      fadeMat.dispose();
      particleMat.dispose();
      particleGeo.dispose();
      dispMat.dispose();
      phModes1.dispose();
      phModes2.dispose();
      phCosets.dispose();
      velRT.dispose();
      accumRTRef.current[0]?.dispose();
      accumRTRef.current[1]?.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resize renderer + accumulation RTs ── */
  useEffect(() => {
    const r = rendererRef.current;
    if (r) r.setSize(width, height, false);
    const art = accumRTRef.current;
    if (art[0] && art[1]) {
      art[0].setSize(width, height);
      art[1].setSize(width, height);
    }
  }, [width, height]);

  /* ── Update velocity-field uniforms when coefficients change ── */
  useEffect(() => {
    const m = velMatRef.current;
    if (!m || !windCoeffs || !cosetReps || !bounds) return;

    const { gp1, gp2 } = windCoeffs;
    const n = Math.max(gp1.modes.length, 1);

    // Modes texture 1
    const ex1 = texturesRef.current.modes1;
    if (ex1 && ex1.image.width === n) {
      const d = ex1.image.data;
      for (let i = 0; i < gp1.modes.length; i++) {
        d[i * 4 + 0] = gp1.modes[i].kx;
        d[i * 4 + 1] = gp1.modes[i].ky;
        d[i * 4 + 2] = gp1.modes[i].a;
        d[i * 4 + 3] = gp1.modes[i].b;
      }
      ex1.needsUpdate = true;
    } else {
      if (ex1) ex1.dispose();
      const t = buildModesTexture(gp1.modes);
      texturesRef.current.modes1 = t;
      m.uniforms.u_modesTexture1.value = t;
      m.uniforms.u_modesTexWidth.value = n;
    }

    // Modes texture 2
    const ex2 = texturesRef.current.modes2;
    if (ex2 && ex2.image.width === n) {
      const d = ex2.image.data;
      for (let i = 0; i < gp2.modes.length; i++) {
        d[i * 4 + 0] = gp2.modes[i].kx;
        d[i * 4 + 1] = gp2.modes[i].ky;
        d[i * 4 + 2] = gp2.modes[i].a;
        d[i * 4 + 3] = gp2.modes[i].b;
      }
      ex2.needsUpdate = true;
    } else {
      if (ex2) ex2.dispose();
      const t = buildModesTexture(gp2.modes);
      texturesRef.current.modes2 = t;
      m.uniforms.u_modesTexture2.value = t;
    }

    // Cosets texture
    const cn = Math.max(cosetReps.length, 1);
    const exC = texturesRef.current.cosets;
    if (exC && exC.image.width === cn) {
      const d = exC.image.data;
      for (let i = 0; i < cosetReps.length; i++) {
        d[i * 4 + 0] = cosetReps[i].a;
        d[i * 4 + 1] = cosetReps[i].b;
        d[i * 4 + 2] = cosetReps[i].c;
        d[i * 4 + 3] = cosetReps[i].d;
        const row1 = cn * 4;
        d[row1 + i * 4 + 0] = cosetReps[i].tx;
        d[row1 + i * 4 + 1] = cosetReps[i].ty;
        d[row1 + i * 4 + 2] = 0;
        d[row1 + i * 4 + 3] = 0;
      }
      exC.needsUpdate = true;
    } else {
      if (exC) exC.dispose();
      const t = buildCosetsTexture(cosetReps);
      texturesRef.current.cosets = t;
      m.uniforms.u_cosetsTexture.value = t;
      m.uniforms.u_cosetsTexWidth.value = cn;
    }

    // Scalar uniforms
    m.uniforms.u_boundsMin.value.set(bounds.minX, bounds.minY);
    m.uniforms.u_boundsMax.value.set(bounds.maxX, bounds.maxY);
    m.uniforms.u_dc1.value = gp1.dc;
    m.uniforms.u_dc2.value = gp2.dc;
    m.uniforms.u_numModes.value = gp1.modes.length;
    m.uniforms.u_numCosets.value = cosetReps.length;
    m.uniforms.u_speedScale.value = computeWindSpeedScale(gp1.modes, gp2.modes);

    // Clear particles + accumulation on coefficient change
    cpuStateRef.current.numAlive = 0;
    needsAccumClear.current = true;
  }, [windCoeffs, cosetReps, bounds]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
