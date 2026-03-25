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
uniform float u_dc;          // DC offset
uniform int   u_numModes;    // number of Fourier modes
uniform int   u_numCosets;   // number of G/T coset representatives
uniform float u_normScale;   // normalization for tanh colormap

uniform sampler2D u_modesTexture;   // width=numModes, height=1, RGBA float
                                    // texel i = (kx, ky, a, b)
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

  float sum = 0.0;

  for (int g = 0; g < 12; g++) {           // MAX_COSETS = 12 (p6m)
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

    sum += val;
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
 * @param {Array}   props.cosetReps   Physical isometry coset reps: [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {number}  props.width       Canvas width in pixels
 * @param {number}  props.height      Canvas height in pixels
 */
export default function GPShaderCanvas({ gpCoeffs, cosetReps, bounds, width, height }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const materialRef = useRef(null);
  const meshRef = useRef(null);
  const texturesRef = useRef({ modes: null, cosets: null });

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
        u_modesTexture: { value: placeholderModes },
        u_cosetsTexture: { value: placeholderCosets },
        u_modesTexWidth: { value: 1.0 },
        u_cosetsTexWidth: { value: 1.0 },
      },
    });
    materialRef.current = material;
    texturesRef.current = { modes: placeholderModes, cosets: placeholderCosets };

    const mesh = new THREE.Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

    return () => {
      geometry.dispose();
      material.dispose();
      placeholderModes.dispose();
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
    material.uniforms.u_normScale.value = computeNormScale(modes);

    // Render
    renderer.render(scene, camera);
  }, [gpCoeffs, cosetReps, bounds]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
