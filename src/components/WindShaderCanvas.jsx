/**
 * GPU-accelerated wind-map visualization via Three.js.
 *
 * Builds an equivariant vector field from two independent GPs and renders
 * it by advecting dye in a ping-pong framebuffer.  The equivariance
 * construction is:
 *
 *   V_sym(r) = (1/|P|) Σ_{g ∈ P}  R_g^{-1} · V_raw(g(r))
 *
 * where V_raw = (f₁, f₂) from the two GPs and R_g is the linear part of
 * the coset representative g.  Since the R_g are orthogonal, R_g^{-1} = R_g^T.
 *
 * Check:  V_sym(h(r)) = (1/|P|) Σ_g R_g^T V_raw(g h(r))
 *       = R_h (1/|P|) Σ_{g'} R_{g'}^T V_raw(g'(r))   [g' = gh]
 *       = R_h V_sym(r)          ✓  (equivariance)
 */

import { useRef, useEffect } from 'react';
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
 * Advection pass – reads previous density, computes equivariant velocity,
 * traces backward (semi-Lagrangian), applies decay, injects random dye.
 */
const advectionFragShader = /* glsl */ `
precision highp float;

uniform vec2  u_boundsMin;
uniform vec2  u_boundsMax;
uniform float u_dc1;
uniform float u_dc2;
uniform int   u_numModes;
uniform int   u_numCosets;
uniform float u_speedScale;

uniform sampler2D u_modesTexture1;   // GP1: (kx, ky, a, b)
uniform sampler2D u_modesTexture2;   // GP2: (kx, ky, a, b)
uniform sampler2D u_cosetsTexture;   // coset reps (same layout as GPShaderCanvas)
uniform float u_modesTexWidth;
uniform float u_cosetsTexWidth;

uniform sampler2D u_prevDensity;     // previous density (ping-pong)
uniform float u_dt;                  // advection timestep
uniform float u_seed;                // varies each frame for random injection
uniform float u_decay;               // density decay per step
uniform float u_dyeRate;             // probability of dye injection per pixel

varying vec2 vUv;

// Hash from https://www.shadertoy.com/view/4djSRW
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);

  // ── Compute equivariant vector field ──────────────────────
  vec2 V = vec2(0.0);

  for (int g = 0; g < 12; g++) {
    if (g >= u_numCosets) break;

    float cu = (float(g) + 0.5) / u_cosetsTexWidth;
    vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
    vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

    // g(pos) = R_g * pos + t_g
    vec2 gPos = vec2(
      abcd.x * pos.x + abcd.y * pos.y + txty.x,
      abcd.z * pos.x + abcd.w * pos.y + txty.y
    );

    // Evaluate both GPs at gPos
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

    // R_g = [[a,b],[c,d]] (row-major in abcd).  R_g^{-1} = R_g^T.
    // Transpose applied to (val1,val2):  (a*v1+c*v2, b*v1+d*v2)
    V += vec2(
      abcd.x * val1 + abcd.z * val2,
      abcd.y * val1 + abcd.w * val2
    );
  }
  V /= float(u_numCosets);
  V *= u_speedScale;

  // ── Semi-Lagrangian backward trace ────────────────────────
  vec2 srcPos = pos - V * u_dt;
  vec2 srcUv  = (srcPos - u_boundsMin) / (u_boundsMax - u_boundsMin);

  float density = 0.0;
  if (srcUv.x >= 0.0 && srcUv.x <= 1.0 && srcUv.y >= 0.0 && srcUv.y <= 1.0) {
    density = texture2D(u_prevDensity, srcUv).r;
  }

  // Decay
  density *= u_decay;

  // Random dye injection
  float rnd = hash21(gl_FragCoord.xy + vec2(u_seed, u_seed * 1.7));
  if (rnd < u_dyeRate) {
    density = 1.0;
  }

  gl_FragColor = vec4(density, density, density, 1.0);
}
`;

/**
 * Display pass – maps scalar density to a dark-background colour.
 */
const displayFragShader = /* glsl */ `
precision highp float;
uniform sampler2D u_density;
varying vec2 vUv;

void main() {
  float d = texture2D(u_density, vUv).r;
  // Dark navy → bright cyan/white
  vec3 bg  = vec3(0.02, 0.05, 0.12);
  vec3 dye = vec3(0.85, 0.95, 1.0);
  vec3 color = mix(bg, dye, d);
  gl_FragColor = vec4(color, 1.0);
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

/**
 * Compute a speed scale that normalises the vector-field magnitude so
 * features advect at a visually reasonable rate (~1-2 px / frame).
 */
function computeWindSpeedScale(modes1, modes2) {
  let energy = 0;
  for (const { a, b } of modes1) energy += a * a + b * b;
  for (const { a, b } of modes2) energy += a * a + b * b;
  const sigma = Math.sqrt(energy) || 1;
  return 1.0 / sigma;
}

/* ───────────────────── React component ───────────────────── */

/**
 * @param {object}  props.windCoeffs  { gp1: {modes,dc,...}, gp2: {modes,dc,...} }
 * @param {Array}   props.cosetReps   Physical isometry coset reps [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {number}  props.width       Canvas width in pixels
 * @param {number}  props.height      Canvas height in pixels
 * @param {number}  [props.resetTrigger]  Increment to clear density field
 */
export default function WindShaderCanvas({ windCoeffs, cosetReps, bounds, width, height, resetTrigger }) {
  const canvasRef       = useRef(null);
  const rendererRef     = useRef(null);
  const cameraRef       = useRef(null);
  const advSceneRef     = useRef(null);
  const dispSceneRef    = useRef(null);
  const advMatRef       = useRef(null);
  const dispMatRef      = useRef(null);
  const rtRef           = useRef([null, null]);
  const pingPongRef     = useRef(0);
  const texturesRef     = useRef({ modes1: null, modes2: null, cosets: null });
  const resetRef        = useRef(resetTrigger);
  const prevResetRef    = useRef(resetTrigger);
  const animIdRef       = useRef(null);

  /* ── Initialise Three.js (once) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(width, height, false);
    renderer.autoClear = false;
    rendererRef.current = renderer;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(2, 2);

    // Placeholder textures
    const phModes1  = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phModes2  = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const phCosets  = buildCosetsTexture([{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }]);
    texturesRef.current = { modes1: phModes1, modes2: phModes2, cosets: phCosets };

    // Render targets (ping-pong) — use UnsignedByteType for broad WebGL compat
    const mkRT = () => new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    rtRef.current = [mkRT(), mkRT()];

    // Advection material
    const advMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: advectionFragShader,
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
        u_prevDensity:    { value: rtRef.current[0].texture },
        u_dt:             { value: 0.016 },
        u_seed:           { value: 0 },
        u_decay:          { value: 0.995 },
        u_dyeRate:        { value: 0.002 },
      },
    });
    advMatRef.current = advMat;

    // Display material
    const dispMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: displayFragShader,
      uniforms: {
        u_density: { value: rtRef.current[0].texture },
      },
    });
    dispMatRef.current = dispMat;

    // Scenes
    const advScene  = new THREE.Scene();
    advScene.add(new THREE.Mesh(geometry.clone(), advMat));
    advSceneRef.current = advScene;

    const dispScene = new THREE.Scene();
    dispScene.add(new THREE.Mesh(geometry.clone(), dispMat));
    dispSceneRef.current = dispScene;

    // Animation loop
    const animate = () => {
      const r  = rendererRef.current;
      const am = advMatRef.current;
      const dm = dispMatRef.current;
      const rt = rtRef.current;
      if (!r || !am || !dm || !rt[0] || !rt[1]) {
        animIdRef.current = requestAnimationFrame(animate);
        return;
      }

      // Handle reset
      if (resetRef.current !== prevResetRef.current) {
        r.setRenderTarget(rt[0]); r.clear();
        r.setRenderTarget(rt[1]); r.clear();
        prevResetRef.current = resetRef.current;
      }

      const curr = pingPongRef.current;
      const next = 1 - curr;

      // Advection pass → write to rt[next]
      am.uniforms.u_prevDensity.value = rt[curr].texture;
      am.uniforms.u_seed.value = performance.now() * 0.1;
      r.setRenderTarget(rt[next]);
      r.clear();
      r.render(advSceneRef.current, camera);

      // Display pass → canvas
      dm.uniforms.u_density.value = rt[next].texture;
      r.setRenderTarget(null);
      r.clear();
      r.render(dispSceneRef.current, camera);

      pingPongRef.current = next;
      animIdRef.current = requestAnimationFrame(animate);
    };
    animIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      geometry.dispose();
      advMat.dispose();
      dispMat.dispose();
      phModes1.dispose();
      phModes2.dispose();
      phCosets.dispose();
      if (rtRef.current[0]) rtRef.current[0].dispose();
      if (rtRef.current[1]) rtRef.current[1].dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resize ── */
  useEffect(() => {
    const r = rendererRef.current;
    if (r) r.setSize(width, height, false);
    const rt = rtRef.current;
    if (rt[0] && rt[1]) {
      rt[0].setSize(width, height);
      rt[1].setSize(width, height);
    }
  }, [width, height]);

  /* ── Update data textures & uniforms ── */
  useEffect(() => {
    const am = advMatRef.current;
    if (!am || !windCoeffs || !cosetReps || !bounds) return;

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
      am.uniforms.u_modesTexture1.value = t;
      am.uniforms.u_modesTexWidth.value = n;
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
      am.uniforms.u_modesTexture2.value = t;
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
      am.uniforms.u_cosetsTexture.value = t;
      am.uniforms.u_cosetsTexWidth.value = cn;
    }

    // Scalar uniforms
    am.uniforms.u_boundsMin.value.set(bounds.minX, bounds.minY);
    am.uniforms.u_boundsMax.value.set(bounds.maxX, bounds.maxY);
    am.uniforms.u_dc1.value = gp1.dc;
    am.uniforms.u_dc2.value = gp2.dc;
    am.uniforms.u_numModes.value  = gp1.modes.length;
    am.uniforms.u_numCosets.value = cosetReps.length;
    am.uniforms.u_speedScale.value = computeWindSpeedScale(gp1.modes, gp2.modes);
  }, [windCoeffs, cosetReps, bounds]);

  /* ── Propagate resetTrigger ── */
  useEffect(() => {
    resetRef.current = resetTrigger;
  }, [resetTrigger]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
