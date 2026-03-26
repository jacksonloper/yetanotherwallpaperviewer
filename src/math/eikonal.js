/**
 * CPU-based eikonal solver on a uniform square grid.
 *
 * Uses a priority-queue–based fast-marching method (FMM) to compute
 * arrival times from multiple source pixels.  The "speed" at each cell
 * is given by a speed grid (positive values).
 *
 * The output is two grids of the same size:
 *   - `dist`: arrival time at each cell
 *   - `label`: index of the source that reached each cell first
 */

/* ---------- Min-heap (binary heap keyed on `dist`) ----------------------- */

class MinHeap {
  constructor() {
    this._data = [];
  }
  get size() {
    return this._data.length;
  }
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  _bubbleUp(i) {
    const d = this._data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (d[i].dist >= d[parent].dist) break;
      [d[i], d[parent]] = [d[parent], d[i]];
      i = parent;
    }
  }
  _sinkDown(i) {
    const d = this._data;
    const n = d.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && d[l].dist < d[smallest].dist) smallest = l;
      if (r < n && d[r].dist < d[smallest].dist) smallest = r;
      if (smallest === i) break;
      [d[i], d[smallest]] = [d[smallest], d[i]];
      i = smallest;
    }
  }
}

/* ---------- Eikonal solver ----------------------------------------------- */

/**
 * Solve the eikonal equation on a 2D grid using fast-marching.
 *
 * @param {number} rows         Grid height (number of rows).
 * @param {number} cols         Grid width (number of columns).
 * @param {Float64Array} speed  speed[r * cols + c] > 0: local speed (higher = faster wavefront).
 * @param {Array<{row: number, col: number, label: number}>} sources
 *   Initial seed pixels with their cell labels.
 * @returns {{ dist: Float64Array, label: Int32Array }}
 *   dist[r*cols+c]  = arrival time,
 *   label[r*cols+c] = source label that arrived first.
 */
export function solveEikonal(rows, cols, speed, sources) {
  const N = rows * cols;
  const dist = new Float64Array(N).fill(Infinity);
  const label = new Int32Array(N).fill(-1);
  const frozen = new Uint8Array(N);

  const heap = new MinHeap();

  // Seed sources
  for (const s of sources) {
    const idx = s.row * cols + s.col;
    if (idx < 0 || idx >= N) continue;
    if (s.row < 0 || s.row >= rows || s.col < 0 || s.col >= cols) continue;
    if (dist[idx] === 0) continue; // already seeded
    dist[idx] = 0;
    label[idx] = s.label;
    heap.push({ dist: 0, row: s.row, col: s.col });
  }

  // 4-connected neighbours
  const dr = [-1, 1, 0, 0];
  const dc = [0, 0, -1, 1];

  while (heap.size > 0) {
    const cur = heap.pop();
    const ci = cur.row * cols + cur.col;
    if (frozen[ci]) continue;
    frozen[ci] = 1;

    for (let k = 0; k < 4; k++) {
      const nr = cur.row + dr[k];
      const nc = cur.col + dc[k];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = nr * cols + nc;
      if (frozen[ni]) continue;

      // Solve the eikonal update: cost = 1 / speed
      const cost = 1 / speed[ni];
      const newDist = dist[ci] + cost;

      if (newDist < dist[ni]) {
        dist[ni] = newDist;
        label[ni] = label[ci];
        heap.push({ dist: newDist, row: nr, col: nc });
      }
    }
  }

  return { dist, label };
}
