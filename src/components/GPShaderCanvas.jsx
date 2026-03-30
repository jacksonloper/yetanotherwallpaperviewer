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
uniform float u_dc2;         // DC offset (GP2, equivariant 3-GP mode)
uniform float u_dc3;         // DC offset (GP3, equivariant 3-GP mode)
uniform int   u_numModes;    // number of Fourier modes
uniform int   u_numCosets;   // number of G/T coset representatives
uniform float u_normScale;   // normalization for tanh colormap
uniform int   u_equivariant; // 1 = equivariant (f − f∘g for |P|=2), 0 = invariant
uniform int   u_eqMode;      // 1 = 3-GP equivariant (|P|>2), 0 = standard

uniform sampler2D u_modesTexture;    // GP1: width=numModes, height=1, RGBA float
                                     // texel i = (kx, ky, a, b)
uniform sampler2D u_modesTexture2;   // GP2 (3-GP equivariant mode)
uniform sampler2D u_modesTexture3;   // GP3 (3-GP equivariant mode)
uniform sampler2D u_cosetsTexture;   // width=numCosets, height=2, RGBA float
                                     // row 0 texel i = (a, b, c, d)
                                     // row 1 texel i = (tx, ty, 0, 0)
uniform float u_modesTexWidth;       // float(numModes) for UV calc
uniform float u_cosetsTexWidth;      // float(numCosets) for UV calc

varying vec2 vUv;

void main() {
  // Map fragment UV → math coordinates
  // vUv.y=0 is bottom of screen = minY, vUv.y=1 is top = maxY
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);

  if (u_eqMode == 1) {
    // ── 3-GP equivariant mode (|P| > 2) ──────────────────────
    // F(x) = (1/|P|) Σ_g ρ(g⁻¹) f(g·x)
    // where ρ(g⁻¹) = [[R_g^T, 0], [0, det(R_g)]]
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

      // Evaluate three GPs at gPos
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

      // det(R_g) = a*d - b*c
      float det = abcd.x * abcd.w - abcd.y * abcd.z;

      // ρ(g⁻¹) · (val1, val2, val3):
      //   in-plane:  R_g^T · (val1, val2) = (a*v1 + c*v2, b*v1 + d*v2)
      //   out-of-plane: det * val3
      F += vec3(
        abcd.x * val1 + abcd.z * val2,
        abcd.y * val1 + abcd.w * val2,
        det * val3
      );
    }
    F /= float(u_numCosets);

    // Map to RGB: Red = out-of-plane, Green = in-plane 1, Blue = in-plane 2
    gl_FragColor = vec4(
      0.5 + 0.5 * tanh(F.z * u_normScale),
      0.5 + 0.5 * tanh(F.x * u_normScale),
      0.5 + 0.5 * tanh(F.y * u_normScale),
      1.0
    );

  } else {
    // ── Standard mode (invariant, or |P|=2 equivariant sign-flip) ──
    float sum = 0.0;

    for (int g = 0; g < 24; g++) {           // MAX_COSETS = 24 (supergroups)
      if (g >= u_numCosets) break;

      float cu = (float(g) + 0.5) / u_cosetsTexWidth;
      vec4 abcd = texture2D(u_cosetsTexture, vec2(cu, 0.25));
      vec4 txty = texture2D(u_cosetsTexture, vec2(cu, 0.75));

      vec2 gPos = vec2(
        abcd.x * pos.x + abcd.y * pos.y + txty.x,
        abcd.z * pos.x + abcd.w * pos.y + txty.y
      );

      float val = u_dc;
      for (int m = 0; m < 512; m++) {         // MAX_MODES = 512 (maxFreq≤15)
        if (m >= u_numModes) break;

        float mu = (float(m) + 0.5) / u_modesTexWidth;
        vec4 mode = texture2D(u_modesTexture, vec2(mu, 0.5));
        float phase = mode.x * gPos.x + mode.y * gPos.y;
        val += mode.z * cos(phase) + mode.w * sin(phase);
      }

      float sign = 1.0;
      if (u_equivariant == 1 && g > 0) sign = -1.0;
      sum += sign * val;
    }

    sum /= float(u_numCosets);

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
 * When a single array is passed, computes from that.
 * When called with 3 arrays (3-GP equivariant), averages the energy.
 */
function computeNormScale(modes, modes2, modes3) {
  let energy = 0;
  for (const { a, b } of modes) {
    energy += a * a + b * b;
  }
  if (modes2 && modes3) {
    for (const { a, b } of modes2) energy += a * a + b * b;
    for (const { a, b } of modes3) energy += a * a + b * b;
    energy /= 3; // per-component energy
  }
  const sigma = Math.sqrt(energy) || 1;
  return 1.5 / sigma;
}

/* ───────────────────── React component ───────────────────── */

/**
 * Renders the symmetrized GP field on the GPU using Three.js.
 *
 * @param {object}  props.gpCoeffs    Output of drawGPCoefficients: { modes, dc }
 * @param {object}  [props.equivariantCoeffs]  Output of drawEquivariantCoefficients:
 *                                      { gp1, gp2, gp3 } for 3-GP equivariant mode.
 * @param {Array}   props.cosetReps   Physical isometry coset reps: [{a,b,c,d,tx,ty}]
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds in math coords
 * @param {number}  props.width       Canvas width in pixels
 * @param {number}  props.height      Canvas height in pixels
 * @param {boolean} [props.equivariant=false]  If true, enable equivariant mode.
 */
export default function GPShaderCanvas({ gpCoeffs, equivariantCoeffs, cosetReps, bounds, width, height, equivariant }) {
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
        u_equivariant: { value: 0 },
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
    if (!bounds) return;

    // Determine which mode we're in
    const use3GP = equivariant && equivariantCoeffs && cosetReps && cosetReps.length > 2;
    const coeffs = use3GP ? equivariantCoeffs : null;

    if (use3GP) {
      // ── 3-GP equivariant mode ───────────────────────────────
      if (!coeffs) return;
      const { gp1, gp2, gp3 } = coeffs;
      const n = Math.max(gp1.modes.length, 1);

      // Update modes texture 1
      const ex1 = texturesRef.current.modes;
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
        texturesRef.current.modes = t;
        material.uniforms.u_modesTexture.value = t;
        material.uniforms.u_modesTexWidth.value = n;
      }

      // Update modes texture 2
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
        material.uniforms.u_modesTexture2.value = t;
      }

      // Update modes texture 3
      const ex3 = texturesRef.current.modes3;
      if (ex3 && ex3.image.width === n) {
        const d = ex3.image.data;
        for (let i = 0; i < gp3.modes.length; i++) {
          d[i * 4 + 0] = gp3.modes[i].kx;
          d[i * 4 + 1] = gp3.modes[i].ky;
          d[i * 4 + 2] = gp3.modes[i].a;
          d[i * 4 + 3] = gp3.modes[i].b;
        }
        ex3.needsUpdate = true;
      } else {
        if (ex3) ex3.dispose();
        const t = buildModesTexture(gp3.modes);
        texturesRef.current.modes3 = t;
        material.uniforms.u_modesTexture3.value = t;
      }

      // DC offsets
      material.uniforms.u_dc.value = gp1.dc;
      material.uniforms.u_dc2.value = gp2.dc;
      material.uniforms.u_dc3.value = gp3.dc;
      material.uniforms.u_numModes.value = gp1.modes.length;
      material.uniforms.u_eqMode.value = 1;
      material.uniforms.u_equivariant.value = 0;
      material.uniforms.u_normScale.value = computeNormScale(gp1.modes, gp2.modes, gp3.modes);

    } else {
      // ── Standard mode (invariant / |P|=2 equivariant) ──────
      if (!gpCoeffs) return;
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

      material.uniforms.u_dc.value = dc;
      material.uniforms.u_numModes.value = modes.length;
      material.uniforms.u_eqMode.value = 0;
      material.uniforms.u_equivariant.value = equivariant ? 1 : 0;
      material.uniforms.u_normScale.value = computeNormScale(modes);
    }

    // Update cosets texture (shared between both modes)
    if (!cosetReps) return;
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

    // Remaining shared uniforms
    material.uniforms.u_boundsMin.value.set(bounds.minX, bounds.minY);
    material.uniforms.u_boundsMax.value.set(bounds.maxX, bounds.maxY);
    material.uniforms.u_numCosets.value = cosetReps.length;

    // Render
    renderer.render(scene, camera);
  }, [gpCoeffs, equivariantCoeffs, cosetReps, bounds, equivariant]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
