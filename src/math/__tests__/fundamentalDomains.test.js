import { describe, it, expect } from 'vitest';
import { computeFundamentalDomains } from '../fundamentalDomains.js';
import { makeIsometry } from '../isometry.js';

describe('computeFundamentalDomains', () => {
  // Create a simple p1 scenario: just the identity and some translations
  const identity = makeIsometry(1, 0, 0, 1, 0, 0);
  const elements = [];
  for (let a = -3; a <= 3; a++) {
    for (let b = -3; b <= 3; b++) {
      elements.push(makeIsometry(1, 0, 0, 1, b, a));
    }
  }
  const cosetReps = [identity];
  const latticeVectors = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };
  const bounds = { minX: -3, maxX: 3, minY: -2, maxY: 2 };

  it('returns label grid and colors with correct dimensions', () => {
    const result = computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 100,
      height: 80,
      centerSeed: 1,
      gpSeed: 1,
      gpScale: 0.1,
      gpN: 3,
      gridScale: 0.5,
    });

    expect(result).toBeDefined();
    expect(result.gridW).toBe(50);
    expect(result.gridH).toBe(40);
    expect(result.label.length).toBe(50 * 40);
    expect(result.colors.length).toBeGreaterThan(0);
  });

  it('assigns all cells to some source (no -1 labels)', () => {
    const result = computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 60,
      height: 40,
      centerSeed: 2,
      gpSeed: 3,
      gpScale: 0.05,
      gpN: 2,
      gridScale: 0.5,
    });

    for (let i = 0; i < result.label.length; i++) {
      expect(result.label[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces different results for different seeds', () => {
    const r1 = computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 40,
      height: 30,
      centerSeed: 1,
      gpSeed: 1,
      gpScale: 0.1,
      gpN: 3,
      gridScale: 0.5,
    });

    const r2 = computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 40,
      height: 30,
      centerSeed: 2,
      gpSeed: 1,
      gpScale: 0.1,
      gpN: 3,
      gridScale: 0.5,
    });

    // Different center seeds should produce different label patterns
    let diffCount = 0;
    for (let i = 0; i < r1.label.length; i++) {
      if (r1.label[i] !== r2.label[i]) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it('is deterministic (same seeds give same result)', () => {
    const params = {
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 40,
      height: 30,
      centerSeed: 42,
      gpSeed: 7,
      gpScale: 0.1,
      gpN: 3,
      gridScale: 0.5,
    };

    const r1 = computeFundamentalDomains(params);
    const r2 = computeFundamentalDomains(params);

    for (let i = 0; i < r1.label.length; i++) {
      expect(r1.label[i]).toBe(r2.label[i]);
    }
  });

  it('with zero GP scale approaches Euclidean Voronoi', () => {
    // When gpScale → 0, all GP envelopes → 0, so f≈dc≈0 everywhere,
    // softplus(0) = ln(2) ≈ 0.693, uniform speed → Euclidean Voronoi
    const result = computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width: 40,
      height: 30,
      centerSeed: 1,
      gpSeed: 1,
      gpScale: 0.001,
      gpN: 3,
      gridScale: 0.5,
    });

    // Should still produce valid labels
    for (let i = 0; i < result.label.length; i++) {
      expect(result.label[i]).toBeGreaterThanOrEqual(0);
    }
  });
});
