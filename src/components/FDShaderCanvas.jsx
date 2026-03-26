/**
 * GPU-accelerated fundamental domain rendering via Jacobi relaxation.
 *
 * Replaces the CPU-based eikonal FMM with a GPU-based iterative solver:
 *   1. Evaluates the symmetrized GP speed field on the GPU via softplus,
 *      clamped with a minimum speed to prevent instability.
 *   2. Initializes source positions (computed on CPU) and labels.
 *   3. Runs Jacobi relaxation iterations (ping-pong rendering) to solve
 *      the eikonal equation on the GPU.
 *   4. Renders the final label → color mapping.
 *
 * Distances are gated with a minimum speed threshold so that costs
 * (1/speed) never blow up, keeping the solver stable.
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { drawGPCoefficients } from '../math/gaussianProcess.js';

/* ---------- Seedable PRNG (mulberry32) ----------------------------------- */

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- GLSL shaders ------------------------------------------------- */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * Speed field: evaluates symmetrized GP, applies softplus(magnitude * f),
 * clamps with a minimum speed so that 1/speed never blows up.
 */
const speedFieldShader = /* glsl */ `
precision highp float;

uniform vec2  u_boundsMin;
uniform vec2  u_boundsMax;
uniform float u_dc;
uniform int   u_numModes;
uniform int   u_numCosets;
uniform float u_magnitude;
uniform float u_minSpeed;

uniform sampler2D u_modesTexture;
uniform sampler2D u_cosetsTexture;
uniform float u_modesTexWidth;
uniform float u_cosetsTexWidth;

varying vec2 vUv;

float softplus(float x) {
  if (x > 20.0) return x;
  if (x < -20.0) return 0.0;
  return log(1.0 + exp(x));
}

void main() {
  vec2 pos = mix(u_boundsMin, u_boundsMax, vUv);
  float sum = 0.0;

  for (int g = 0; g < 12; g++) {
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
    sum += val;
  }

  sum /= float(u_numCosets);

  // Clamp speed with a minimum to gate distances and prevent instability
  float speed = max(softplus(u_magnitude * sum), u_minSpeed);
  gl_FragColor = vec4(speed, 0.0, 0.0, 1.0);
}
`;

/**
 * Jacobi iteration: one step of eikonal relaxation.
 * Each cell checks its 4 neighbours; if any neighbour's distance + cost
 * is lower than the current distance, adopt that distance and label.
 * Cost = 1/speed, with speed already min-clamped in the speed texture.
 */
const jacobiShader = /* glsl */ `
precision highp float;

uniform sampler2D u_state;
uniform sampler2D u_speed;
uniform vec2 u_texelSize;

varying vec2 vUv;

void main() {
  vec4 curr = texture2D(u_state, vUv);
  float myDist  = curr.r;
  float myLabel = curr.g;

  float speed = texture2D(u_speed, vUv).r;
  // speed is already clamped to >= MIN_SPEED in the speed-field pass;
  // the max() here is a safety net matching that same floor.
  float cost = 1.0 / max(speed, 0.01);

  vec4 left  = texture2D(u_state, vUv + vec2(-u_texelSize.x, 0.0));
  vec4 right = texture2D(u_state, vUv + vec2( u_texelSize.x, 0.0));
  vec4 up    = texture2D(u_state, vUv + vec2(0.0,  u_texelSize.y));
  vec4 down  = texture2D(u_state, vUv + vec2(0.0, -u_texelSize.y));

  float bestDist  = myDist;
  float bestLabel = myLabel;

  float dLeft  = left.r  + cost;
  float dRight = right.r + cost;
  float dUp    = up.r    + cost;
  float dDown  = down.r  + cost;

  if (dLeft  < bestDist) { bestDist = dLeft;  bestLabel = left.g;  }
  if (dRight < bestDist) { bestDist = dRight; bestLabel = right.g; }
  if (dUp    < bestDist) { bestDist = dUp;    bestLabel = up.g;    }
  if (dDown  < bestDist) { bestDist = dDown;  bestLabel = down.g;  }

  gl_FragColor = vec4(bestDist, bestLabel, 0.0, 1.0);
}
`;

/**
 * Display shader: maps each cell's label to a colour via a palette texture.
 * Unassigned cells (label < 0) render as black.
 */
const displayShader = /* glsl */ `
precision highp float;

uniform sampler2D u_state;
uniform sampler2D u_palette;
uniform float u_paletteWidth;

varying vec2 vUv;

void main() {
  float label = texture2D(u_state, vUv).g;
  if (label < 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float u = (label + 0.5) / u_paletteWidth;
  vec3 color = texture2D(u_palette, vec2(u, 0.5)).rgb;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Simple passthrough for copying a texture into a render target. */
const copyShader = /* glsl */ `
precision highp float;
uniform sampler2D u_input;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(u_input, vUv);
}
`;

/* ---------- Texture helpers ---------------------------------------------- */

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
 * Build the initial state DataTexture.
 *   R = distance (0 at sources, 1e6 elsewhere)
 *   G = label    (source index at sources, -1 elsewhere)
 */
function buildInitTexture(gridW, gridH, sources) {
  const data = new Float32Array(gridW * gridH * 4);
  for (let i = 0; i < gridW * gridH; i++) {
    data[i * 4 + 0] = 1e6;
    data[i * 4 + 1] = -1.0;
    data[i * 4 + 2] = 0.0;
    data[i * 4 + 3] = 1.0;
  }
  for (const s of sources) {
    const idx = (s.texY * gridW + s.texX) * 4;
    data[idx + 0] = 0.0;
    data[idx + 1] = s.label;
  }
  const tex = new THREE.DataTexture(data, gridW, gridH, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build a 1D colour-palette texture. Texel i = (R, G, B, 1) for label i.
 */
function buildPaletteTexture(rgbColors) {
  const n = Math.max(rgbColors.length, 1);
  const data = new Float32Array(n * 4);
  for (let i = 0; i < rgbColors.length; i++) {
    data[i * 4 + 0] = rgbColors[i].r / 255;
    data[i * 4 + 1] = rgbColors[i].g / 255;
    data[i * 4 + 2] = rgbColors[i].b / 255;
    data[i * 4 + 3] = 1.0;
  }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ---------- Colour helpers ----------------------------------------------- */

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/** Match the CPU randomColor PRNG call pattern (h, s, l each consume one rng()). */
function randomColorRGB(rng) {
  const h = Math.floor(rng() * 360) / 360;
  const s = (55 + Math.floor(rng() * 30)) / 100;
  const l = (45 + Math.floor(rng() * 25)) / 100;
  return hslToRgb(h, s, l);
}

/* ---------- Constants ---------------------------------------------------- */

const GRID_SCALE = 0.5;
const MIN_SPEED = 0.01;

/* ---------- Render-target factory ---------------------------------------- */

function makeRT(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: false,
  });
}

/* ---------- React component ---------------------------------------------- */

/**
 * @param {object} props
 * @param {Array}  props.elements        Visible group elements.
 * @param {Array}  props.cosetReps       G/T coset representatives.
 * @param {{v1,v2}} props.latticeVectors Lattice basis.
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds.
 * @param {number} props.width           Canvas width in CSS pixels.
 * @param {number} props.height          Canvas height in CSS pixels.
 * @param {number} props.centerSeed      Seed for center point.
 * @param {number} props.gpSeed          Seed for GP draw.
 * @param {number} props.gpScale         GP length scale.
 * @param {number} props.gpMagnitude     Magnitude multiplier for f before softplus.
 * @param {number} props.gpN             GP truncation.
 */
export default function FDShaderCanvas({
  elements,
  cosetReps,
  latticeVectors,
  bounds,
  width,
  height,
  centerSeed,
  gpSeed,
  gpScale,
  gpMagnitude,
  gpN,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  const gridW = Math.max(2, Math.round(width * GRID_SCALE));
  const gridH = Math.max(2, Math.round(height * GRID_SCALE));

  /* ── Initialise Three.js once ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(gridW, gridH, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    /* — materials — */
    const speedMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: speedFieldShader,
      uniforms: {
        u_boundsMin: { value: new THREE.Vector2() },
        u_boundsMax: { value: new THREE.Vector2() },
        u_dc: { value: 0 },
        u_numModes: { value: 1 },
        u_numCosets: { value: 1 },
        u_magnitude: { value: 1.0 },
        u_minSpeed: { value: MIN_SPEED },
        u_modesTexture: { value: null },
        u_cosetsTexture: { value: null },
        u_modesTexWidth: { value: 1.0 },
        u_cosetsTexWidth: { value: 1.0 },
      },
    });

    const jacobiMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: jacobiShader,
      uniforms: {
        u_state: { value: null },
        u_speed: { value: null },
        u_texelSize: { value: new THREE.Vector2() },
      },
    });

    const displayMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: displayShader,
      uniforms: {
        u_state: { value: null },
        u_palette: { value: null },
        u_paletteWidth: { value: 1.0 },
      },
    });

    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: copyShader,
      uniforms: { u_input: { value: null } },
    });

    const mesh = new THREE.Mesh(geometry, speedMaterial);
    scene.add(mesh);

    const speedRT = makeRT(gridW, gridH);
    const rt1 = makeRT(gridW, gridH);
    const rt2 = makeRT(gridW, gridH);

    stateRef.current = {
      renderer, scene, camera, geometry, mesh,
      speedMaterial, jacobiMaterial, displayMaterial, copyMaterial,
      speedRT, rt1, rt2,
      disposables: [],
      gridW, gridH,
    };

    return () => {
      geometry.dispose();
      speedMaterial.dispose();
      jacobiMaterial.dispose();
      displayMaterial.dispose();
      copyMaterial.dispose();
      speedRT.dispose();
      rt1.dispose();
      rt2.dispose();
      renderer.dispose();
      if (stateRef.current) {
        for (const tex of stateRef.current.disposables) tex.dispose();
      }
      stateRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resize render targets when grid dims change ── */
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (st.gridW === gridW && st.gridH === gridH) return;

    st.renderer.setSize(gridW, gridH, false);
    st.speedRT.dispose();
    st.rt1.dispose();
    st.rt2.dispose();
    st.speedRT = makeRT(gridW, gridH);
    st.rt1 = makeRT(gridW, gridH);
    st.rt2 = makeRT(gridW, gridH);
    st.gridW = gridW;
    st.gridH = gridH;
  }, [gridW, gridH]);

  /* ── Main computation & rendering ── */
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    if (!elements || !cosetReps || !latticeVectors || !bounds) return;

    const { renderer, scene, camera, mesh,
      speedMaterial, jacobiMaterial, displayMaterial, copyMaterial,
      speedRT, rt1, rt2 } = st;

    /* 1. Dispose previous per-frame textures */
    for (const tex of st.disposables) tex.dispose();
    st.disposables = [];

    /* 2. Draw GP coefficients */
    const gpCoeffs = drawGPCoefficients(latticeVectors, gpSeed, gpN ?? 5, gpScale);
    const { modes, dc } = gpCoeffs;

    /* 3. Compute source positions on CPU (mirrors fundamentalDomains.js) */
    const dx = (bounds.maxX - bounds.minX) / gridW;
    const dy = (bounds.maxY - bounds.minY) / gridH;

    const centerRng = mulberry32(centerSeed);
    const cx = centerRng() - 0.5;
    const cy = centerRng() - 0.5;

    const sourceMap = new Map();
    const sources = [];
    let labelCount = 0;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const sx = el.a * cx + el.b * cy + el.tx;
      const sy = el.c * cx + el.d * cy + el.ty;

      // Grid coords: col from left, rowFromTop from top (CPU convention)
      const col = Math.round((sx - bounds.minX) / dx - 0.5);
      const rowFromTop = Math.round((bounds.maxY - sy) / dy - 0.5);
      if (col < 0 || col >= gridW || rowFromTop < 0 || rowFromTop >= gridH) continue;

      const key = `${col},${rowFromTop}`;
      if (!sourceMap.has(key)) {
        const lbl = labelCount++;
        sourceMap.set(key, lbl);
        // Texture y: 0 = bottom, gridH-1 = top
        sources.push({ texX: col, texY: gridH - 1 - rowFromTop, label: lbl });
      }
    }

    /* 4. Generate colour palette (same seed logic as CPU code) */
    const colorRng = mulberry32(centerSeed * 31 + gpSeed * 97 + 42);
    const rgbColors = [];
    for (let i = 0; i < labelCount; i++) {
      rgbColors.push(randomColorRGB(colorRng));
    }

    /* 5. Build GPU textures */
    const modesTex = buildModesTexture(modes);
    const cosetsTex = buildCosetsTexture(cosetReps);
    const initTex = buildInitTexture(gridW, gridH, sources);
    const paletteTex = buildPaletteTexture(rgbColors);
    st.disposables.push(modesTex, cosetsTex, initTex, paletteTex);

    /* 6. Render speed field to texture */
    mesh.material = speedMaterial;
    speedMaterial.uniforms.u_boundsMin.value.set(bounds.minX, bounds.minY);
    speedMaterial.uniforms.u_boundsMax.value.set(bounds.maxX, bounds.maxY);
    speedMaterial.uniforms.u_dc.value = dc;
    speedMaterial.uniforms.u_numModes.value = modes.length;
    speedMaterial.uniforms.u_numCosets.value = cosetReps.length;
    speedMaterial.uniforms.u_magnitude.value = gpMagnitude ?? 1;
    speedMaterial.uniforms.u_minSpeed.value = MIN_SPEED;
    speedMaterial.uniforms.u_modesTexture.value = modesTex;
    speedMaterial.uniforms.u_cosetsTexture.value = cosetsTex;
    speedMaterial.uniforms.u_modesTexWidth.value = Math.max(modes.length, 1);
    speedMaterial.uniforms.u_cosetsTexWidth.value = Math.max(cosetReps.length, 1);

    renderer.setRenderTarget(speedRT);
    renderer.render(scene, camera);

    /* 7. Copy initial state into rt1 */
    mesh.material = copyMaterial;
    copyMaterial.uniforms.u_input.value = initTex;
    renderer.setRenderTarget(rt1);
    renderer.render(scene, camera);

    /* 8. Jacobi iterations (ping-pong between rt1 ↔ rt2) */
    mesh.material = jacobiMaterial;
    jacobiMaterial.uniforms.u_speed.value = speedRT.texture;
    jacobiMaterial.uniforms.u_texelSize.value.set(1.0 / gridW, 1.0 / gridH);

    const numIterations = Math.max(gridW, gridH);
    let readRT = rt1;
    let writeRT = rt2;

    for (let i = 0; i < numIterations; i++) {
      jacobiMaterial.uniforms.u_state.value = readRT.texture;
      renderer.setRenderTarget(writeRT);
      renderer.render(scene, camera);
      const tmp = readRT;
      readRT = writeRT;
      writeRT = tmp;
    }

    /* 9. Display: label → colour, rendered to the visible canvas */
    mesh.material = displayMaterial;
    displayMaterial.uniforms.u_state.value = readRT.texture;
    displayMaterial.uniforms.u_palette.value = paletteTex;
    displayMaterial.uniforms.u_paletteWidth.value = Math.max(labelCount, 1);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

  }, [elements, cosetReps, latticeVectors, bounds, width, height,
      centerSeed, gpSeed, gpScale, gpMagnitude, gpN, gridW, gridH]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}
