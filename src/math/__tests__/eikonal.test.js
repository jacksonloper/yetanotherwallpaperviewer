import { describe, it, expect } from 'vitest';
import { solveEikonal } from '../eikonal.js';

describe('solveEikonal', () => {
  it('assigns all cells to the single source on a uniform grid', () => {
    const rows = 5;
    const cols = 5;
    const speed = new Float64Array(rows * cols).fill(1);
    const sources = [{ row: 2, col: 2, label: 0 }];

    const { dist, label } = solveEikonal(rows, cols, speed, sources);

    // All cells should be labeled 0
    for (let i = 0; i < rows * cols; i++) {
      expect(label[i]).toBe(0);
    }
    // Source has distance 0
    expect(dist[2 * cols + 2]).toBe(0);
    // Adjacent cells have distance 1
    expect(dist[1 * cols + 2]).toBe(1);
    expect(dist[3 * cols + 2]).toBe(1);
    expect(dist[2 * cols + 1]).toBe(1);
    expect(dist[2 * cols + 3]).toBe(1);
  });

  it('assigns cells to the nearest source in a two-source scenario', () => {
    const rows = 1;
    const cols = 11;
    const speed = new Float64Array(rows * cols).fill(1);
    const sources = [
      { row: 0, col: 0, label: 0 },
      { row: 0, col: 10, label: 1 },
    ];

    const { label } = solveEikonal(rows, cols, speed, sources);

    // Left half should be label 0, right half label 1
    for (let c = 0; c <= 4; c++) {
      expect(label[c]).toBe(0);
    }
    for (let c = 6; c <= 10; c++) {
      expect(label[c]).toBe(1);
    }
    // Middle cell (c=5) can be either, but should be one of them
    expect([0, 1]).toContain(label[5]);
  });

  it('handles sources out of bounds gracefully', () => {
    const rows = 3;
    const cols = 3;
    const speed = new Float64Array(rows * cols).fill(1);
    const sources = [
      { row: -1, col: 0, label: 0 },
      { row: 1, col: 1, label: 1 },
    ];

    const { label } = solveEikonal(rows, cols, speed, sources);

    // All cells should be labeled 1 (only valid source)
    for (let i = 0; i < rows * cols; i++) {
      expect(label[i]).toBe(1);
    }
  });

  it('speed affects arrival times (higher speed = earlier arrival)', () => {
    const rows = 1;
    const cols = 11;
    const speed = new Float64Array(rows * cols);
    // Left half is slow (speed=1), right half is fast (speed=10)
    for (let c = 0; c < cols; c++) {
      speed[c] = c < 6 ? 1 : 10;
    }
    const sources = [
      { row: 0, col: 0, label: 0 },
      { row: 0, col: 10, label: 1 },
    ];

    const { label } = solveEikonal(rows, cols, speed, sources);

    // Source 1 (right, fast region) should claim more territory
    // because it propagates faster
    let count0 = 0, count1 = 0;
    for (let c = 0; c < cols; c++) {
      if (label[c] === 0) count0++;
      else count1++;
    }
    expect(count1).toBeGreaterThan(count0);
  });

  it('produces finite distances for all reachable cells', () => {
    const rows = 10;
    const cols = 10;
    const speed = new Float64Array(rows * cols).fill(2);
    const sources = [{ row: 0, col: 0, label: 0 }];

    const { dist } = solveEikonal(rows, cols, speed, sources);

    for (let i = 0; i < rows * cols; i++) {
      expect(dist[i]).toBeLessThan(Infinity);
    }
  });

  it('handles multiple sources at the same position', () => {
    const rows = 3;
    const cols = 3;
    const speed = new Float64Array(rows * cols).fill(1);
    const sources = [
      { row: 1, col: 1, label: 0 },
      { row: 1, col: 1, label: 1 },
    ];

    const { label } = solveEikonal(rows, cols, speed, sources);

    // First source should claim the cell (it was seeded first)
    expect(label[1 * cols + 1]).toBe(0);
  });
});
