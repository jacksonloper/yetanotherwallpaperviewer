/**
 * Particle advection visualization via 2D canvas.
 *
 * Uses GPU shader (via Three.js) to compute the equivariant velocity field
 * on a low-res grid, reads it back to CPU, then advects discrete particles
 * in one fundamental domain of the translation subgroup. Particles are
 * copied by lattice translations to tile the viewport. Particles spawn
 * randomly, advect forward, and fade out over their lifetime.
 *
 * The equivariant vector field is:
 *   V_sym(r) = (1/|P|) Σ_{g ∈ P}  R_g^{-1} · V_raw(g(r))
 * Same as WindShaderCanvas but evaluated on a coarse grid and read back.
 */

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

/* ───────────────────── GLSL shaders ───────────────────── */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * Velocity-field shader – writes (Vx, Vy) into RG channels of the render target.
 * This is evaluated on a coarse grid and read back to CPU.
 */
const velocityFragShader = /* glsl */ `
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

  // Encode velocity: map from [-range, range] to [0, 1] for UnsignedByte storage.
  // We use range = 4.0 which should be plenty for normalized velocities.
  vec2 encoded = V / 8.0 + 0.5;
  gl_FragColor = vec4(encoded, 0.0, 1.0);
}
`;

/* ───────────────────── Helpers ───────────────────── */

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

/**
 * Wrap a point into the fundamental parallelogram [0,1)×[0,1) in lattice
 * coordinates, then convert back to physical coordinates.
 */
function wrapToFundamentalDomain(px, py, v1, v2) {
  // Convert physical (px,py) → lattice coords (s,t) via inverse of [v1|v2]
  const det = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(det) < 1e-12) return { x: px, y: py };
  const s = (v2.y * px - v2.x * py) / det;
  const t = (-v1.y * px + v1.x * py) / det;
  // Wrap to [0,1)
  const sw = s - Math.floor(s);
  const tw = t - Math.floor(t);
  // Back to physical
  return {
    x: sw * v1.x + tw * v2.x,
    y: sw * v1.y + tw * v2.y,
  };
}

/* ───────────────────── Velocity grid read-back ───────────────────── */

const GRID_RES = 64; // coarse grid for velocity field

/* ───────────────────── React component ───────────────────── */

/**
 * @param {object}  props.windCoeffs    { gp1: {modes,dc,...}, gp2: {modes,dc,...} }
 * @param {Array}   props.cosetReps     Physical isometry coset reps [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {{v1:{x,y}, v2:{x,y}}} props.latticeVectors  Translation lattice basis
 * @param {number}  props.width         Canvas width in pixels
 * @param {number}  props.height        Canvas height in pixels
 * @param {number}  props.spawnRate     Particles spawned per frame (0-20)
 * @param {number}  props.fadeSpeed     How fast particles fade (0-1, fraction of life lost per frame)
 * @param {number}  props.tailLength    Number of history positions to draw as tail (1-30)
 * @param {number}  props.maxParticles  Maximum number of alive particles (50-2000)
 * @param {number}  [props.resetTrigger]  Increment to clear all particles
 */
export default function ParticleCanvas({
  windCoeffs, cosetReps, bounds, latticeVectors,
  width, height, spawnRate, fadeSpeed, tailLength, maxParticles,
  resetTrigger,
}) {
  const canvasRef = useRef(null);
  const glCanvasRef = useRef(null); // offscreen WebGL canvas for velocity field
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const matRef = useRef(null);
  const rtRef = useRef(null);
  const texturesRef = useRef({ modes1: null, modes2: null, cosets: null });
  const particlesRef = useRef([]);
  const animIdRef = useRef(null);
  const velGridRef = useRef(null); // Float32Array: [vx, vy] interleaved, GRID_RES×GRID_RES
  const propsRef = useRef({ bounds, spawnRate, fadeSpeed, tailLength, maxParticles, latticeVectors });
  const resetRef = useRef(resetTrigger);
  const prevResetRef = useRef(resetTrigger);

  // Keep props in ref for animation loop access
  useEffect(() => {
    propsRef.current = { bounds, spawnRate, fadeSpeed, tailLength, maxParticles, latticeVectors };
  }, [bounds, spawnRate, fadeSpeed, tailLength, maxParticles, latticeVectors]);

  // Reset trigger
  useEffect(() => {
    resetRef.current = resetTrigger;
  }, [resetTrigger]);

  /* ── Initialize Three.js for velocity field computation ── */
  useEffect(() => {
    // Create offscreen canvas for WebGL
    const glCanvas = document.createElement('canvas');
    glCanvas.width = GRID_RES;
    glCanvas.height = GRID_RES;
    glCanvasRef.current = glCanvas;

    const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: false });
    renderer.setSize(GRID_RES, GRID_RES, false);
    renderer.autoClear = false;
    rendererRef.current = renderer;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(2, 2);

    const phModes1 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phModes2 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phCosets = buildCosetsTexture([{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }]);
    texturesRef.current = { modes1: phModes1, modes2: phModes2, cosets: phCosets };

    const rt = new THREE.WebGLRenderTarget(GRID_RES, GRID_RES, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    rtRef.current = rt;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: velocityFragShader,
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
    matRef.current = mat;

    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, mat));
    sceneRef.current = scene;

    velGridRef.current = new Float32Array(GRID_RES * GRID_RES * 2);

    // Animation loop
    const pixelBuf = new Uint8Array(GRID_RES * GRID_RES * 4);

    const animate = () => {
      const r = rendererRef.current;
      const m = matRef.current;
      const rtt = rtRef.current;
      const drawCanvas = canvasRef.current;
      if (!r || !m || !rtt || !drawCanvas) {
        animIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const props = propsRef.current;
      const { bounds: b, spawnRate: sr, fadeSpeed: fs, tailLength: tl, maxParticles: mp, latticeVectors: lv } = props;
      if (!b || !lv) {
        animIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // Handle reset
      if (resetRef.current !== prevResetRef.current) {
        particlesRef.current = [];
        prevResetRef.current = resetRef.current;
      }

      // 1. Render velocity field to RT
      r.setRenderTarget(rtt);
      r.clear();
      r.render(sceneRef.current, cameraRef.current);

      // 2. Read back velocity grid
      r.readRenderTargetPixels(rtt, 0, 0, GRID_RES, GRID_RES, pixelBuf);
      const vg = velGridRef.current;
      for (let i = 0; i < GRID_RES * GRID_RES; i++) {
        // Decode: pixel value [0,255] → [0,1] → velocity
        vg[i * 2 + 0] = ((pixelBuf[i * 4 + 0] / 255.0) - 0.5) * 8.0;
        vg[i * 2 + 1] = ((pixelBuf[i * 4 + 1] / 255.0) - 0.5) * 8.0;
      }

      // 3. Spawn new particles in the fundamental domain
      const particles = particlesRef.current;
      const v1 = lv.v1;
      const v2 = lv.v2;
      const numSpawn = Math.floor(sr) + (Math.random() < (sr % 1) ? 1 : 0);
      for (let s = 0; s < numSpawn && particles.length < mp; s++) {
        // Random point in fundamental parallelogram
        const s1 = Math.random();
        const s2 = Math.random();
        const px = s1 * v1.x + s2 * v2.x;
        const py = s1 * v1.y + s2 * v2.y;
        particles.push({
          x: px, y: py,
          life: 1.0,
          trail: [{ x: px, y: py }],
        });
      }

      // 4. Advect particles using bilinear interpolation of velocity grid
      const dt = 0.016; // ~60fps timestep
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Sample velocity at particle position (bilinear from grid)
        const u = (p.x - b.minX) / (b.maxX - b.minX) * GRID_RES;
        const v = (p.y - b.minY) / (b.maxY - b.minY) * GRID_RES;
        const gi = Math.max(0, Math.min(GRID_RES - 2, Math.floor(u)));
        const gj = Math.max(0, Math.min(GRID_RES - 2, Math.floor(v)));
        const fu = u - gi;
        const fv = v - gj;

        const idx00 = (gj * GRID_RES + gi) * 2;
        const idx10 = (gj * GRID_RES + gi + 1) * 2;
        const idx01 = ((gj + 1) * GRID_RES + gi) * 2;
        const idx11 = ((gj + 1) * GRID_RES + gi + 1) * 2;

        const vx = (1 - fu) * (1 - fv) * vg[idx00] +
                   fu * (1 - fv) * vg[idx10] +
                   (1 - fu) * fv * vg[idx01] +
                   fu * fv * vg[idx11];
        const vy = (1 - fu) * (1 - fv) * vg[idx00 + 1] +
                   fu * (1 - fv) * vg[idx10 + 1] +
                   (1 - fu) * fv * vg[idx01 + 1] +
                   fu * fv * vg[idx11 + 1];

        // Euler step
        p.x += vx * dt;
        p.y += vy * dt;

        // Wrap back to fundamental domain
        const wrapped = wrapToFundamentalDomain(p.x, p.y, v1, v2);
        p.x = wrapped.x;
        p.y = wrapped.y;

        // Update trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > tl) {
          p.trail.shift();
        }

        // Fade
        p.life -= fs;

        // Remove dead particles
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // 5. Render particles on 2D canvas
      const ctx = drawCanvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      // Dark background
      ctx.fillStyle = 'rgb(5, 13, 30)';
      ctx.fillRect(0, 0, width, height);

      // Compute lattice translation copies needed to fill viewport
      const copies = [];
      const maxN = 10;
      for (let n1 = -maxN; n1 <= maxN; n1++) {
        for (let n2 = -maxN; n2 <= maxN; n2++) {
          const tx = n1 * v1.x + n2 * v2.x;
          const ty = n1 * v1.y + n2 * v2.y;
          // Check if this translation could bring a fundamental-domain point into view
          // (rough check with margin)
          const margin = 2;
          if (tx + margin < b.minX - 1 || tx - margin > b.maxX + 1) continue;
          if (ty + margin < b.minY - 1 || ty - margin > b.maxY + 1) continue;
          copies.push({ tx, ty });
        }
      }

      // Map math coords → canvas pixels
      const scaleX = width / (b.maxX - b.minX);
      const scaleY = height / (b.maxY - b.minY);
      const toCanvasX = (mx) => (mx - b.minX) * scaleX;
      const toCanvasY = (my) => height - (my - b.minY) * scaleY; // flip Y

      for (const p of particles) {
        const alpha = Math.max(0, Math.min(1, p.life));
        if (alpha < 0.01) continue;

        for (const { tx, ty } of copies) {
          // Draw tail
          if (p.trail.length > 1) {
            ctx.beginPath();
            for (let t = 0; t < p.trail.length; t++) {
              const cx = toCanvasX(p.trail[t].x + tx);
              const cy = toCanvasY(p.trail[t].y + ty);
              if (t === 0) ctx.moveTo(cx, cy);
              else ctx.lineTo(cx, cy);
            }
            const tailAlpha = alpha * 0.6;
            ctx.strokeStyle = `rgba(180, 220, 255, ${tailAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Draw head
          const hx = toCanvasX(p.x + tx);
          const hy = toCanvasY(p.y + ty);
          // Only draw if on screen
          if (hx >= -5 && hx <= width + 5 && hy >= -5 && hy <= height + 5) {
            ctx.beginPath();
            ctx.arc(hx, hy, 1.5, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
            ctx.fill();
          }
        }
      }

      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      geometry.dispose();
      mat.dispose();
      phModes1.dispose();
      phModes2.dispose();
      phCosets.dispose();
      if (rtRef.current) rtRef.current.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Update data textures & uniforms when coefficients change ── */
  useEffect(() => {
    const m = matRef.current;
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

    // Reset particles when coefficients change significantly
    particlesRef.current = [];
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
