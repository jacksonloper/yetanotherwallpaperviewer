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
uniform float u_dc;          // DC offset (GP 1)
uniform float u_dc2;         // DC offset (GP 2, eqMode 2 only)
uniform float u_dc3;         // DC offset (GP 3, eqMode 2 only)
uniform int   u_numModes;    // number of Fourier modes
uniform int   u_numCosets;   // number of G/T coset representatives
uniform float u_normScale;   // normalization for tanh colormap
uniform int   u_eqMode;      // 0 = invariant, 1 = sign-flip, 2 = p3 cyclic RGB

uniform sampler2D u_modesTexture;    // GP 1: width=numModes, height=1, RGBA (kx,ky,a,b)
uniform sampler2D u_modesTexture2;   // GP 2 (eqMode 2 only)
uniform sampler2D u_modesTexture3;   // GP 3 (eqMode 2 only)
uniform sampler2D u_cosetsTexture;   // width=numCosets, height=2, RGBA float
uniform float u_modesTexWidth;       // float(numModes) for UV calc
uniform float u_cosetsTexWidth;      // float(numCosets) for UV calc

varying vec2 vUv;

void main() {
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);

  if (u_eqMode < 2) {
    // ── Mode 0 (invariant) or 1 (sign-flip): single GP ──
    float sum = 0.0;

    for (int g = 0; g < 24; g++) {
      if (g >= u_numCosets) break;

      float cu = (float(g) + 0.5) / u_cosetsTexWidth;
      vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
      vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

      vec2 gPos = vec2(
        abcd.x * pos.x + abcd.y * pos.y + txty.x,
        abcd.z * pos.x + abcd.w * pos.y + txty.y
      );

      float val = u_dc;
      for (int m = 0; m < 512; m++) {
        if (m >= u_numModes) break;
        float mu = (float(m) + 0.5) / u_modesTexWidth;
        vec4 mode = texture2D(u_modesTexture, vec2(mu, 0.5));
        float phase = mode.x * gPos.x + mode.y * gPos.y;
        val += mode.z * cos(phase) + mode.w * sin(phase);
      }

      float sign = 1.0;
      if (u_eqMode == 1 && g > 0) sign = -1.0;
      sum += sign * val;
    }

    sum /= float(u_numCosets);
    float t = 0.5 + 0.5 * tanh(sum * u_normScale);

    vec3 color;
    if (t < 0.5) {
      float s = t * 2.0;
      color = vec3(s, s, 1.0);
    } else {
      float s = (t - 0.5) * 2.0;
      color = vec3(1.0, 1.0 - s, 1.0 - s);
    }
    gl_FragColor = vec4(color, 1.0);

  } else {
    // ── Mode 2: p3 cyclic permutation → RGB ──
    // Three independent GPs → Reynolds average with ρ = cyclic permutation
    // F_c(r) = (1/3) Σ_g f_{(c+g) mod 3}(g(r))
    vec3 rgb = vec3(0.0);

    for (int g = 0; g < 24; g++) {
      if (g >= u_numCosets) break;

      float cu = (float(g) + 0.5) / u_cosetsTexWidth;
      vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
      vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

      vec2 gPos = vec2(
        abcd.x * pos.x + abcd.y * pos.y + txty.x,
        abcd.z * pos.x + abcd.w * pos.y + txty.y
      );

      // Evaluate all 3 GPs at transformed point (shared wave vectors)
      float v1 = u_dc;
      float v2 = u_dc2;
      float v3 = u_dc3;
      for (int m = 0; m < 512; m++) {
        if (m >= u_numModes) break;
        float mu = (float(m) + 0.5) / u_modesTexWidth;
        vec4 m1 = texture2D(u_modesTexture,  vec2(mu, 0.5));
        vec4 m2 = texture2D(u_modesTexture2, vec2(mu, 0.5));
        vec4 m3 = texture2D(u_modesTexture3, vec2(mu, 0.5));
        float phase = m1.x * gPos.x + m1.y * gPos.y;
        float cp = cos(phase);
        float sp = sin(phase);
        v1 += m1.z * cp + m1.w * sp;
        v2 += m2.z * cp + m2.w * sp;
        v3 += m3.z * cp + m3.w * sp;
      }

      // Apply ρ(g)⁻¹ cyclic permutation: component c gets GP (c+g) mod 3
      // g=0: identity  → (v1,v2,v3)
      // g=1: ρ(r)⁻¹    → (v2,v3,v1)
      // g=2: ρ(r²)⁻¹   → (v3,v1,v2)
      if (g == 0) rgb += vec3(v1, v2, v3);
      else if (g == 1) rgb += vec3(v2, v3, v1);
      else if (g == 2) rgb += vec3(v3, v1, v2);
    }

    rgb /= float(u_numCosets);
    rgb = 0.5 + 0.5 * tanh(rgb * u_normScale);
    gl_FragColor = vec4(rgb, 1.0);
  }
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
 * @param {object}  [props.gpCoeffs2] Second GP coefficients (eqMode 2 only)
 * @param {object}  [props.gpCoeffs3] Third GP coefficients (eqMode 2 only)
 * @param {Array}   props.cosetReps   Physical isometry coset reps: [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {number}  props.width       Canvas width in pixels
 * @param {number}  props.height      Canvas height in pixels
 * @param {number}  [props.eqMode=0]  0=invariant, 1=sign-flip (|G/T|=2), 2=p3 cyclic RGB
 */
export default function GPShaderCanvas({ gpCoeffs, gpCoeffs2, gpCoeffs3, cosetReps, bounds, width, height, eqMode }) {
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
        u_dc2: { value: 0 },
        u_dc3: { value: 0 },
        u_numModes: { value: 1 },
        u_numCosets: { value: 1 },
        u_normScale: { value: 1.0 },
        u_eqMode: { value: 0 },
        u_modesTexture: { value: placeholderModes },
        u_modesTexture2: { value: placeholderModes2 },
        u_modesTexture3: { value: placeholderModes3 },
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
    if (!gpCoeffs || !cosetReps || !bounds) return;

    const { modes, dc } = gpCoeffs;
    const n = Math.max(modes.length, 1);
    const mode = eqMode || 0;

    // Update modes texture: reuse in-place if width matches, else recreate
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

    // Update extra mode textures for p3 cyclic mode
    if (mode === 2 && gpCoeffs2 && gpCoeffs3) {
      for (const [key, uName, coeffs] of [
        ['modes2', 'u_modesTexture2', gpCoeffs2],
        ['modes3', 'u_modesTexture3', gpCoeffs3],
      ]) {
        const existing = texturesRef.current[key];
        const m = coeffs.modes;
        const mn = Math.max(m.length, 1);
        if (existing && existing.image.width === mn) {
          const data = existing.image.data;
          for (let i = 0; i < m.length; i++) {
            data[i * 4 + 0] = m[i].kx;
            data[i * 4 + 1] = m[i].ky;
            data[i * 4 + 2] = m[i].a;
            data[i * 4 + 3] = m[i].b;
          }
          existing.needsUpdate = true;
        } else {
          if (existing) existing.dispose();
          const tex = buildModesTexture(m);
          texturesRef.current[key] = tex;
          material.uniforms[uName].value = tex;
        }
      }
      material.uniforms.u_dc2.value = gpCoeffs2.dc;
      material.uniforms.u_dc3.value = gpCoeffs3.dc;
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
    material.uniforms.u_eqMode.value = mode;
    // Compensate for variance reduction in p3 averaging (3 independent terms → σ/√3)
    let normScale = computeNormScale(modes);
    if (mode === 2) normScale *= Math.sqrt(3);
    material.uniforms.u_normScale.value = normScale;

    // Render
    renderer.render(scene, camera);
  }, [gpCoeffs, gpCoeffs2, gpCoeffs3, cosetReps, bounds, eqMode]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
