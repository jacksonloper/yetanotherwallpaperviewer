/**
 * GPU-accelerated Gaussian Process rendering via Three.js fragment shader.
 *
 * Evaluates the symmetrized GP field per-pixel on the GPU, replacing the
 * CPU-based heatmap generation.  Uniforms carry:
 *   - Fourier modes (kx, ky, a, b) packed into a DataTexture
 *   - G/T coset representatives (a, b, c, d, tx, ty) packed into a DataTexture
 *   - Viewport bounds, DC offset, mode/coset counts, normalization scale
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

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2  u_boundsMin;   // (minX, minY) in math coords
uniform vec2  u_boundsMax;   // (maxX, maxY) in math coords
uniform float u_dc;          // DC offset (GP1 / single GP)
uniform int   u_numModes;    // number of Fourier modes per GP
uniform int   u_numCosets;   // number of G/T coset representatives
uniform float u_normScale;   // normalization for tanh colormap / softmax temperature
uniform int   u_eqMode;      // 0 = invariant, 1 = sign-flip (|G/T|=2), 2 = P3 cyclic permutation

uniform sampler2D u_modesTexture;   // GP1 modes: width=numModes, height=1, RGBA float
                                    // texel i = (kx, ky, a, b)
uniform sampler2D u_modesTexture2;  // GP2 modes (eqMode=2 only)
uniform sampler2D u_modesTexture3;  // GP3 modes (eqMode=2 only)
uniform float u_dc2;                // DC offset for GP2 (eqMode=2 only)
uniform float u_dc3;                // DC offset for GP3 (eqMode=2 only)

uniform sampler2D u_cosetsTexture;  // width=numCosets, height=2, RGBA float
                                    // row 0 texel i = (a, b, c, d)
                                    // row 1 texel i = (tx, ty, 0, 0)
uniform float u_modesTexWidth;      // float(numModes) for UV calc
uniform float u_cosetsTexWidth;     // float(numCosets) for UV calc

varying vec2 vUv;

void main() {
  // Map fragment UV → math coordinates
  // vUv.y=0 is bottom of screen = minY, vUv.y=1 is top = maxY
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);

  if (u_eqMode == 2) {
    // ── P3 cyclic permutation equivariant mode ──────────────────
    // Three independent GPs → Reynolds average with cyclic permutation
    // F_j(r) = (1/|P|) Σ_i f_{(j+i) mod 3}(g_i(r))
    vec3 F = vec3(0.0);

    for (int g = 0; g < 24; g++) {
      if (g >= u_numCosets) break;

      float cu = (float(g) + 0.5) / u_cosetsTexWidth;
      vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
      vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

      vec2 gPos = vec2(
        abcd.x * pos.x + abcd.y * pos.y + txty.x,
        abcd.z * pos.x + abcd.w * pos.y + txty.y
      );

      // Evaluate all 3 GPs at gPos
      float val1 = u_dc;
      float val2 = u_dc2;
      float val3 = u_dc3;
      for (int m = 0; m < 512; m++) {
        if (m >= u_numModes) break;
        float mu = (float(m) + 0.5) / u_modesTexWidth;
        vec4 mode1 = texture2D(u_modesTexture,  vec2(mu, 0.5));
        vec4 mode2 = texture2D(u_modesTexture2, vec2(mu, 0.5));
        vec4 mode3 = texture2D(u_modesTexture3, vec2(mu, 0.5));
        float phase = mode1.x * gPos.x + mode1.y * gPos.y;
        float cp = cos(phase);
        float sp = sin(phase);
        val1 += mode1.z * cp + mode1.w * sp;
        val2 += mode2.z * cp + mode2.w * sp;
        val3 += mode3.z * cp + mode3.w * sp;
      }

      // Inverse cyclic permutation by g: F_j += vals[(j+g) mod 3]
      int shift = g - (g / 3) * 3; // g mod 3 in GLSL ES 1.0
      if (shift == 0) {
        F += vec3(val1, val2, val3);
      } else if (shift == 1) {
        F += vec3(val2, val3, val1);
      } else {
        F += vec3(val3, val1, val2);
      }
    }

    F /= float(u_numCosets);

    // Softmax → RGB
    vec3 scaledF = F * u_normScale;
    float maxF = max(scaledF.x, max(scaledF.y, scaledF.z));
    vec3 expF = exp(scaledF - maxF);
    vec3 bary = expF / (expF.x + expF.y + expF.z);
    float r = bary.x, g = bary.y, b = bary.z;

    // Barycentric → RGB: dominant channel stays 1, others = 1−s
    float sr = (r >= g && r >= b) ? ((r - g) * (r - b)) / max(r * r, 1e-10) : 0.0;
    float sg = (g >= r && g >= b) ? ((g - r) * (g - b)) / max(g * g, 1e-10) : 0.0;
    float sb = (b >= r && b >= g) ? ((b - r) * (b - g)) / max(b * b, 1e-10) : 0.0;

    vec3 color = vec3(
      1.0 - sg - sb,
      1.0 - sr - sb,
      1.0 - sr - sg
    );

    gl_FragColor = vec4(color, 1.0);
    return;
  }

  // ── Scalar modes (invariant / sign-flip equivariant) ────────
  float sum = 0.0;

  for (int g = 0; g < 24; g++) {           // MAX_COSETS = 24 (supergroups)
    if (g >= u_numCosets) break;

    // Read coset data
    float cu = (float(g) + 0.5) / u_cosetsTexWidth;
    vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
    vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

    // Apply coset isometry: g(pos) = R*pos + t
    vec2 gPos = vec2(
      abcd.x * pos.x + abcd.y * pos.y + txty.x,
      abcd.z * pos.x + abcd.w * pos.y + txty.y
    );

    // Evaluate GP at transformed point
    float val = u_dc;
    for (int m = 0; m < 512; m++) {         // MAX_MODES = 512 (maxFreq≤15)
      if (m >= u_numModes) break;

      float mu = (float(m) + 0.5) / u_modesTexWidth;
      vec4 mode = texture2D(u_modesTexture, vec2(mu, 0.5));
      // mode = (kx, ky, a, b)
      float phase = mode.x * gPos.x + mode.y * gPos.y;
      val += mode.z * cos(phase) + mode.w * sin(phase);
    }

    // Apply sign: +1 for invariant, −1 for non-identity coset in equivariant mode
    float sign = 1.0;
    if (u_eqMode == 1 && g > 0) sign = -1.0;
    sum += sign * val;
  }

  sum /= float(u_numCosets);

  // Normalize to [0,1] via tanh
  float t = 0.5 + 0.5 * tanh(sum * u_normScale);

  // Diverging colormap: blue (t=0) → white (t=0.5) → red (t=1)
  vec3 color;
  if (t < 0.5) {
    float s = t * 2.0;
    color = vec3(s, s, 1.0);
  } else {
    float s = (t - 0.5) * 2.0;
    color = vec3(1.0, 1.0 - s, 1.0 - s);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ───────────────────── Helpers ───────────────────── */

/**
 * Build a Float32 DataTexture for Fourier modes.
 * Each texel stores (kx, ky, a, b).
 */
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

/**
 * Build a Float32 DataTexture for coset representatives.
 * Height 2: row 0 = (a,b,c,d), row 1 = (tx,ty,0,0).
 */
function buildCosetsTexture(cosets) {
  const n = Math.max(cosets.length, 1);
  const data = new Float32Array(n * 2 * 4);
  for (let i = 0; i < cosets.length; i++) {
    // Row 0: linear part
    data[i * 4 + 0] = cosets[i].a;
    data[i * 4 + 1] = cosets[i].b;
    data[i * 4 + 2] = cosets[i].c;
    data[i * 4 + 3] = cosets[i].d;
    // Row 1: translation part
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
 * Compute a normalization scale from the Fourier modes so the
 * tanh-based colormap uses a reasonable range.
 */
function computeNormScale(modes) {
  let energy = 0;
  for (const { a, b } of modes) {
    energy += a * a + b * b;
  }
  const sigma = Math.sqrt(energy) || 1;
  return 1.5 / sigma;
}

/* ───────────────────── React component ───────────────────── */

/**
 * Renders the symmetrized GP field on the GPU using Three.js.
 *
 * @param {object}  props.gpCoeffs    Output of drawGPCoefficients: { modes, dc }
 * @param {object}  [props.p3Coeffs]  Output of drawP3Coefficients: { gp1, gp2, gp3 }
 *                                    When provided, activates P3 cyclic permutation mode.
 * @param {Array}   props.cosetReps   Physical isometry coset reps: [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {number}  props.width       Canvas width in pixels
 * @param {number}  props.height      Canvas height in pixels
 * @param {boolean} [props.equivariant=false]  If true and |cosetReps|=2, use f−f∘g.
 */
export default function GPShaderCanvas({ gpCoeffs, p3Coeffs, cosetReps, bounds, width, height, displayWidth, displayHeight, equivariant }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const materialRef = useRef(null);
  const meshRef = useRef(null);
  const texturesRef = useRef({ modes: null, modes2: null, modes3: null, cosets: null });

  // Initialize Three.js scene (once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(width, height, false);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(2, 2);

    // Placeholder textures (will be replaced in the data effect)
    const placeholderModes = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const placeholderModes2 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const placeholderModes3 = buildModesTexture([{ kx: 0, ky: 0, a: 0, b: 0 }]);
    const placeholderCosets = buildCosetsTexture([{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }]);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_boundsMin: { value: new THREE.Vector2(-4, -3) },
        u_boundsMax: { value: new THREE.Vector2(4, 3) },
        u_dc: { value: 0 },
        u_numModes: { value: 1 },
        u_numCosets: { value: 1 },
        u_normScale: { value: 1.0 },
        u_eqMode: { value: 0 },
        u_modesTexture: { value: placeholderModes },
        u_modesTexture2: { value: placeholderModes2 },
        u_modesTexture3: { value: placeholderModes3 },
        u_dc2: { value: 0 },
        u_dc3: { value: 0 },
        u_cosetsTexture: { value: placeholderCosets },
        u_modesTexWidth: { value: 1.0 },
        u_cosetsTexWidth: { value: 1.0 },
      },
    });
    materialRef.current = material;
    texturesRef.current = { modes: placeholderModes, modes2: placeholderModes2, modes3: placeholderModes3, cosets: placeholderCosets };

    const mesh = new THREE.Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

    return () => {
      geometry.dispose();
      material.dispose();
      placeholderModes.dispose();
      placeholderModes2.dispose();
      placeholderModes3.dispose();
      placeholderCosets.dispose();
      renderer.dispose();
      rendererRef.current = null;
      materialRef.current = null;
    };
  // Intentionally run once — resize handled in a separate effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize renderer when dimensions change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setSize(width, height, false);
    }
  }, [width, height]);

  // Update uniforms & textures when data changes, then render
  useEffect(() => {
    const material = materialRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!material || !renderer || !scene || !camera) return;
    if (!cosetReps || !bounds) return;

    // Determine equivariant mode: 0=invariant, 1=sign-flip, 2=P3 cyclic
    const eqMode = p3Coeffs ? 2 : (equivariant ? 1 : 0);

    // Select the primary GP modes for texture updates
    const primaryCoeffs = eqMode === 2 ? p3Coeffs.gp1 : gpCoeffs;
    if (!primaryCoeffs) return;

    const { modes, dc } = primaryCoeffs;
    const n = Math.max(modes.length, 1);

    // Update modes texture (GP1 / single GP): reuse in-place if width matches
    const existingModes = texturesRef.current.modes;
    if (existingModes && existingModes.image.width === n) {
      const data = existingModes.image.data;
      for (let i = 0; i < modes.length; i++) {
        data[i * 4 + 0] = modes[i].kx;
        data[i * 4 + 1] = modes[i].ky;
        data[i * 4 + 2] = modes[i].a;
        data[i * 4 + 3] = modes[i].b;
      }
      existingModes.needsUpdate = true;
    } else {
      if (existingModes) existingModes.dispose();
      const modesTex = buildModesTexture(modes);
      texturesRef.current.modes = modesTex;
      material.uniforms.u_modesTexture.value = modesTex;
      material.uniforms.u_modesTexWidth.value = n;
    }

    // Update GP2 and GP3 mode textures (P3 mode only)
    if (eqMode === 2) {
      const modes2 = p3Coeffs.gp2.modes;
      const modes3 = p3Coeffs.gp3.modes;

      // GP2 modes texture
      const ex2 = texturesRef.current.modes2;
      if (ex2 && ex2.image.width === n) {
        const d = ex2.image.data;
        for (let i = 0; i < modes2.length; i++) {
          d[i * 4 + 0] = modes2[i].kx;
          d[i * 4 + 1] = modes2[i].ky;
          d[i * 4 + 2] = modes2[i].a;
          d[i * 4 + 3] = modes2[i].b;
        }
        ex2.needsUpdate = true;
      } else {
        if (ex2) ex2.dispose();
        const t = buildModesTexture(modes2);
        texturesRef.current.modes2 = t;
        material.uniforms.u_modesTexture2.value = t;
      }

      // GP3 modes texture
      const ex3 = texturesRef.current.modes3;
      if (ex3 && ex3.image.width === n) {
        const d = ex3.image.data;
        for (let i = 0; i < modes3.length; i++) {
          d[i * 4 + 0] = modes3[i].kx;
          d[i * 4 + 1] = modes3[i].ky;
          d[i * 4 + 2] = modes3[i].a;
          d[i * 4 + 3] = modes3[i].b;
        }
        ex3.needsUpdate = true;
      } else {
        if (ex3) ex3.dispose();
        const t = buildModesTexture(modes3);
        texturesRef.current.modes3 = t;
        material.uniforms.u_modesTexture3.value = t;
      }

      material.uniforms.u_dc2.value = p3Coeffs.gp2.dc;
      material.uniforms.u_dc3.value = p3Coeffs.gp3.dc;
    }

    // Update cosets texture: reuse in-place if width matches, else recreate
    const existingCosets = texturesRef.current.cosets;
    const cn = Math.max(cosetReps.length, 1);
    if (existingCosets && existingCosets.image.width === cn) {
      const data = existingCosets.image.data;
      for (let i = 0; i < cosetReps.length; i++) {
        data[i * 4 + 0] = cosetReps[i].a;
        data[i * 4 + 1] = cosetReps[i].b;
        data[i * 4 + 2] = cosetReps[i].c;
        data[i * 4 + 3] = cosetReps[i].d;
        const row1 = cn * 4;
        data[row1 + i * 4 + 0] = cosetReps[i].tx;
        data[row1 + i * 4 + 1] = cosetReps[i].ty;
        data[row1 + i * 4 + 2] = 0;
        data[row1 + i * 4 + 3] = 0;
      }
      existingCosets.needsUpdate = true;
    } else {
      if (existingCosets) existingCosets.dispose();
      const cosetsTex = buildCosetsTexture(cosetReps);
      texturesRef.current.cosets = cosetsTex;
      material.uniforms.u_cosetsTexture.value = cosetsTex;
      material.uniforms.u_cosetsTexWidth.value = cn;
    }

    // Update remaining uniforms
    material.uniforms.u_boundsMin.value.set(bounds.minX, bounds.minY);
    material.uniforms.u_boundsMax.value.set(bounds.maxX, bounds.maxY);
    material.uniforms.u_dc.value = dc;
    material.uniforms.u_numModes.value = modes.length;
    material.uniforms.u_numCosets.value = cosetReps.length;
    material.uniforms.u_eqMode.value = eqMode;

    // Normalization scale: for P3 mode use average per-GP energy with higher temperature
    if (eqMode === 2) {
      let energy = 0;
      for (const { a, b } of p3Coeffs.gp1.modes) energy += a * a + b * b;
      for (const { a, b } of p3Coeffs.gp2.modes) energy += a * a + b * b;
      for (const { a, b } of p3Coeffs.gp3.modes) energy += a * a + b * b;
      const sigma = Math.sqrt(energy / 3) || 1;
      material.uniforms.u_normScale.value = 3.0 / sigma;
    } else {
      material.uniforms.u_normScale.value = computeNormScale(modes);
    }

    // Render
    renderer.render(scene, camera);
  }, [gpCoeffs, p3Coeffs, cosetReps, bounds, equivariant]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', width: (displayWidth || width) + 'px', height: (displayHeight || height) + 'px' }}
    />
  );
}
