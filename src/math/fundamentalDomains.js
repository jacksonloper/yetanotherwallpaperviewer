/**
 * Fundamental domains computation.
 *
 * Given a wallpaper group (its elements / coset reps), a GP draw, and
 * a random center point, this module:
 *   1. Generates source positions by applying group elements to the center.
 *   2. Snaps those positions to a fine square grid (same resolution as the
 *      GP fragment shader).
 *   3. Evaluates a symmetrized GP on the grid to compute a speed field
 *      via softplus(f).
 *   4. Runs the eikonal solver to assign every grid cell to the nearest
 *      source (by arrival time weighted by the speed field).
 *   5. Returns a label grid and a color palette for rendering.
 */

import { solveEikonal } from './eikonal.js';
import {
  drawGPCoefficients,
  evaluateGP,
} from './gaussianProcess.js';

/* ---------- Seedable PRNG (mulberry32) – duplicated for independence ----- */

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Helpers ------------------------------------------------------ */

function softplus(x) {
  // Numerically stable softplus
  if (x > 20) return x;
  if (x < -20) return 0;
  return Math.log(1 + Math.exp(x));
}

/**
 * Generate a random HSL color with good saturation and lightness.
 */
function randomColor(rng) {
  const h = Math.floor(rng() * 360);
  const s = 55 + Math.floor(rng() * 30); // 55-85%
  const l = 45 + Math.floor(rng() * 25); // 45-70%
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/* ---------- Main computation --------------------------------------------- */

/**
 * Compute fundamental domain cells.
 *
 * @param {object}  params
 * @param {Array}   params.elements       All visible group elements (isometries).
 * @param {Array}   params.cosetReps      G/T coset representatives (isometries).
 * @param {{v1:{x,y}, v2:{x,y}}} params.latticeVectors  Lattice basis.
 * @param {{minX,maxX,minY,maxY}} params.bounds          Viewport bounds.
 * @param {number}  params.width          Canvas width in pixels.
 * @param {number}  params.height         Canvas height in pixels.
 * @param {number}  params.centerSeed     Seed for random centre point.
 * @param {number}  params.gpSeed         Seed for GP draw.
 * @param {number}  params.gpScale        Overall scale multiplier for GP (length scale).
 * @param {number}  [params.gpMagnitude=1] Magnitude multiplier applied to f before softplus.
 * @param {number}  [params.gpN=5]        Fourier truncation.
 * @param {number}  [params.gridScale=0.5] Fraction of pixel resolution for the eikonal grid.
 * @returns {{ label: Int32Array, colors: string[], gridW: number, gridH: number }}
 */
export function computeFundamentalDomains({
  elements,
  cosetReps,
  latticeVectors,
  bounds,
  width,
  height,
  centerSeed,
  gpSeed,
  gpScale,
  gpMagnitude = 1,
  gpN = 5,
  gridScale = 0.5,
}) {
  // Grid dimensions (fraction of pixel resolution for performance)
  const gridW = Math.max(2, Math.round(width * gridScale));
  const gridH = Math.max(2, Math.round(height * gridScale));
  const dx = (bounds.maxX - bounds.minX) / gridW;
  const dy = (bounds.maxY - bounds.minY) / gridH;

  // 1. Draw GP coefficients
  const gpCoeffs = drawGPCoefficients(latticeVectors, gpSeed, gpN, gpScale);

  // 2. Random centre point (inside one fundamental domain ≈ unit cell)
  const centerRng = mulberry32(centerSeed);
  const cx = centerRng() - 0.5; // in [-0.5, 0.5)
  const cy = centerRng() - 0.5;

  // 3. Apply all visible group elements to generate source positions
  //    Each element maps (cx, cy) to a new position in the plane.
  const rawSources = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const sx = el.a * cx + el.b * cy + el.tx;
    const sy = el.c * cx + el.d * cy + el.ty;
    rawSources.push({ x: sx, y: sy, elementIndex: i });
  }

  // 4. Snap to grid and deduplicate
  const sourceMap = new Map(); // "row,col" → label
  const sources = [];
  let labelCount = 0;

  for (const s of rawSources) {
    const col = Math.round((s.x - bounds.minX) / dx - 0.5);
    const row = Math.round((bounds.maxY - s.y) / dy - 0.5);
    if (row < 0 || row >= gridH || col < 0 || col >= gridW) continue;
    const key = `${row},${col}`;
    if (!sourceMap.has(key)) {
      const lbl = labelCount++;
      sourceMap.set(key, lbl);
      sources.push({ row, col, label: lbl });
    }
  }

  // 5. Evaluate symmetrized GP on grid → speed field
  const N = gridW * gridH;
  const speed = new Float64Array(N);

  for (let r = 0; r < gridH; r++) {
    const y = bounds.maxY - (r + 0.5) * dy;
    for (let c = 0; c < gridW; c++) {
      const x = bounds.minX + (c + 0.5) * dx;

      // Symmetrized GP evaluation (average over coset reps)
      let sum = 0;
      for (const g of cosetReps) {
        const gx = g.a * x + g.b * y + g.tx;
        const gy = g.c * x + g.d * y + g.ty;
        sum += evaluateGP(gpCoeffs, gx, gy);
      }
      const fVal = sum / cosetReps.length;

      // softplus(magnitude * f) as speediness: always positive
      speed[r * gridW + c] = softplus(gpMagnitude * fVal);
    }
  }

  // 6. Run eikonal solver
  const { label } = solveEikonal(gridH, gridW, speed, sources);

  // 7. Generate colors for each label
  const colorRng = mulberry32(centerSeed * 31 + gpSeed * 97 + 42);
  const colors = [];
  for (let i = 0; i < labelCount; i++) {
    colors.push(randomColor(colorRng));
  }

  return { label, colors, gridW, gridH };
}
