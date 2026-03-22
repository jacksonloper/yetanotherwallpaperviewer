import { describe, it, expect } from 'vitest';
import {
  translation,
  rotation,
  reflection,
} from '../isometry.js';
import { generateGroup, generateLatticePoints } from '../groupGenerator.js';

const PI = Math.PI;

describe('generateGroup', () => {
  it('rejects when fewer than 2 translations', () => {
    const result = generateGroup([translation(1, 0), rotation(PI / 2, 0, 0)]);
    expect(result.error).toContain('Expected exactly 2 translation generators');
  });

  it('rejects linearly dependent translations', () => {
    const result = generateGroup([translation(1, 0), translation(2, 0)]);
    expect(result.error).toContain('linearly dependent');
  });

  it('p1: two translations only produces identity mod lattice', () => {
    const result = generateGroup([translation(0, 1), translation(1.1, 0.3)], 4);
    expect(result.error).toBeNull();
    // Only identity should remain after reducing mod lattice
    expect(result.elements.length).toBe(1);
  });

  it('p2: 180° rotation produces 2 elements mod lattice', () => {
    const result = generateGroup(
      [translation(0, 1), translation(1, 0), rotation(PI, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBe(2);
  });

  it('p4: 90° rotation produces 4 elements mod lattice', () => {
    const result = generateGroup(
      [translation(0, 1), translation(1, 0), rotation(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBe(4);
  });

  it('pm: reflection with rectangular lattice produces 2 elements', () => {
    const result = generateGroup(
      [translation(0, 1), translation(1, 0), reflection(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBe(2);
  });

  it('detects dense translations (incommensurate rotation)', () => {
    // A rotation by an irrational angle would produce dense translations
    // Use 1 radian which is irrational w.r.t. 2π
    const result = generateGroup(
      [translation(0, 1), translation(1, 0), rotation(1, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('outside the specified lattice');
  });
});

describe('generateLatticePoints', () => {
  it('generates points within bounds', () => {
    const v1 = { x: 1, y: 0 };
    const v2 = { x: 0, y: 1 };
    const bounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    const points = generateLatticePoints(v1, v2, bounds);
    expect(points.length).toBe(25); // -2..2 × -2..2 = 5×5
    // All should be within bounds
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-2);
      expect(p.x).toBeLessThanOrEqual(2);
      expect(p.y).toBeGreaterThanOrEqual(-2);
      expect(p.y).toBeLessThanOrEqual(2);
    }
  });
});
