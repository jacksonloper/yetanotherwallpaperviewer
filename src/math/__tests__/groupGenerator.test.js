import { describe, it, expect } from 'vitest';
import {
  translation,
  rotation,
  reflection,
  glideReflection,
  classify,
} from '../isometry.js';
import { generateGroup, generateLatticePoints } from '../groupGenerator.js';

const PI = Math.PI;
const s3h = Math.sqrt(3) / 2; // √3/2

// --- Lattice helpers ---
const squareLattice = () => [translation(0, 1), translation(1, 0)];
const hexLattice = () => [translation(0, 1), translation(s3h, 0.5)];
const rectLattice = (x) => [translation(0, 1), translation(x, 0)];
const centRectLattice = (x) => [translation(0, 1), translation(x, 0.5)];
const obliqueLattice = () => [translation(0, 1), translation(1.1, 0.3)];

/**
 * Helper: count how many elements have a given classification.
 */
function countByType(elements) {
  const c = { identity: 0, translation: 0, rotation: 0, reflection: 0, 'glide-reflection': 0 };
  for (const el of elements) {
    const t = classify(el, 1e-7);
    c[t] = (c[t] || 0) + 1;
  }
  return c;
}

describe('generateGroup – basic validation', () => {
  it('rejects when fewer than 2 translations', () => {
    const result = generateGroup([translation(1, 0), rotation(PI / 2, 0, 0)]);
    expect(result.error).toContain('Expected exactly 2 translation generators');
  });

  it('rejects linearly dependent translations', () => {
    const result = generateGroup([translation(1, 0), translation(2, 0)]);
    expect(result.error).toContain('linearly dependent');
  });

  it('detects dense translations (incommensurate rotation)', () => {
    // 1 radian is irrational w.r.t. 2π
    const result = generateGroup(
      [translation(0, 1), translation(1, 0), rotation(1, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('outside the specified lattice');
  });
});

describe('generateGroup – all elements (no mod lattice)', () => {
  it('p1: two translations only produces many translation elements', () => {
    const result = generateGroup([...obliqueLattice()], 4);
    expect(result.error).toBeNull();
    // Without mod-lattice, we get all lattice translations reachable in 4 steps
    expect(result.elements.length).toBeGreaterThan(1);
    // All should be identity or translation
    const counts = countByType(result.elements);
    expect(counts.identity).toBe(1);
    expect(counts.rotation).toBe(0);
    expect(counts.reflection).toBe(0);
  });

  it('p2: 180° rotation produces translations + rotations', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBeGreaterThan(2);
    const counts = countByType(result.elements);
    expect(counts.rotation).toBeGreaterThan(0);
  });

  it('p4: 90° rotation produces translations + rotations', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBeGreaterThan(4);
    const counts = countByType(result.elements);
    expect(counts.rotation).toBeGreaterThan(0);
  });

  it('pm: reflection with square lattice produces translations + reflections', () => {
    const result = generateGroup(
      [...squareLattice(), reflection(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBeGreaterThan(2);
    const counts = countByType(result.elements);
    expect(counts.reflection).toBeGreaterThan(0);
  });

  it('element count is capped at MAX_ELEMENTS', () => {
    // With high maxWords on a group with many generators, should not exceed cap
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0)],
      20
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBeLessThanOrEqual(5000);
  });
});

describe('generateGroup – all 17 preset generators are valid', () => {
  it('p1: oblique lattice, no extra generators', () => {
    const result = generateGroup([...obliqueLattice()], 4);
    expect(result.error).toBeNull();
  });

  it('p2: square lattice, 180° rotation at origin', () => {
    const result = generateGroup([...squareLattice(), rotation(PI, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('pm: square lattice, reflection along y-axis', () => {
    const result = generateGroup([...squareLattice(), reflection(PI / 2, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('pg: square lattice, glide reflection along y-axis dist 0.5', () => {
    const result = generateGroup([...squareLattice(), glideReflection(PI / 2, 0.5, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('cm: centered-rect lattice, vertical reflection', () => {
    const result = generateGroup([...centRectLattice(1.0), reflection(PI / 2, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('pmm: square lattice, horizontal + vertical reflections', () => {
    const result = generateGroup(
      [...squareLattice(), reflection(0, 0, 0), reflection(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('pmg: square lattice, reflection + glide', () => {
    const result = generateGroup(
      [...squareLattice(), reflection(0, 0, 0), glideReflection(PI / 2, 0.5, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('pgg: square lattice, two glide reflections', () => {
    const result = generateGroup(
      [
        ...squareLattice(),
        glideReflection(0, 0.5, 0, 0.25),
        glideReflection(PI / 2, 0.5, 0.25, 0),
      ],
      4
    );
    expect(result.error).toBeNull();
  });

  it('cmm: centered-rect lattice, two reflections', () => {
    const result = generateGroup(
      [...centRectLattice(1.0), reflection(0, 0, 0), reflection(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('p4: square lattice, 90° rotation at origin', () => {
    const result = generateGroup([...squareLattice(), rotation(PI / 2, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('p4m: square lattice, 90° rotation + reflection', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0), reflection(0, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('p4g: square lattice, 90° rotation at (0.5,0.5) + reflection', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0.5, 0.5), reflection(0, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('p3: hexagonal lattice, 120° rotation at origin', () => {
    const result = generateGroup([...hexLattice(), rotation((2 * PI) / 3, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('p3m1: hexagonal lattice, 120° rotation + vertical reflection', () => {
    const result = generateGroup(
      [...hexLattice(), rotation((2 * PI) / 3, 0, 0), reflection(PI / 2, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('p31m: hexagonal lattice, 120° rotation + horizontal reflection', () => {
    const result = generateGroup(
      [...hexLattice(), rotation((2 * PI) / 3, 0, 0), reflection(0, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });

  it('p6: hexagonal lattice, 60° rotation at origin', () => {
    const result = generateGroup([...hexLattice(), rotation(PI / 3, 0, 0)], 4);
    expect(result.error).toBeNull();
  });

  it('p6m: hexagonal lattice, 60° rotation + horizontal reflection', () => {
    const result = generateGroup(
      [...hexLattice(), rotation(PI / 3, 0, 0), reflection(0, 0, 0)],
      4
    );
    expect(result.error).toBeNull();
  });
});

describe('generateGroup – invalid configurations should fail', () => {
  // Wrong rotation order for lattice type
  it('rejects 3-fold rotation on square lattice', () => {
    const result = generateGroup(
      [...squareLattice(), rotation((2 * PI) / 3, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects 4-fold rotation on hexagonal lattice', () => {
    const result = generateGroup(
      [...hexLattice(), rotation(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects 6-fold rotation on square lattice', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 3, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects 3-fold rotation on rectangular lattice', () => {
    const result = generateGroup(
      [...rectLattice(1.5), rotation((2 * PI) / 3, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects 4-fold rotation on oblique lattice', () => {
    const result = generateGroup(
      [...obliqueLattice(), rotation(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  // Wrong reflection axis for lattice type
  it('rejects diagonal reflection on rectangular lattice', () => {
    const result = generateGroup(
      [...rectLattice(1.5), reflection(PI / 4, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects vertical reflection on oblique lattice', () => {
    const result = generateGroup(
      [...obliqueLattice(), reflection(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  // Wrong glide distance
  it('rejects glide reflection with wrong distance on square lattice', () => {
    // Correct distance for vertical glide on square lattice is 0.5; using 0.3
    const result = generateGroup(
      [...squareLattice(), glideReflection(PI / 2, 0.3, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  it('rejects glide reflection with wrong distance on hexagonal lattice', () => {
    // Vertical glide on hex lattice should be 0.5; using 0.7
    const result = generateGroup(
      [...hexLattice(), glideReflection(PI / 2, 0.7, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });

  // Two rotations at incompatible centers
  it('rejects two 3-fold rotations at incompatible centers on hex lattice', () => {
    const result = generateGroup(
      [
        ...hexLattice(),
        rotation((2 * PI) / 3, 0, 0),
        rotation((2 * PI) / 3, 0.23, 0),
      ],
      6
    );
    expect(result.error).toBeTruthy();
  });

  // Irrational rotation angle
  it('rejects rotation by 1 radian (irrational angle)', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(1, 0, 0)],
      6
    );
    expect(result.error).toBeTruthy();
  });
});

describe('generateLatticePoints', () => {
  it('generates points within bounds', () => {
    const v1 = { x: 1, y: 0 };
    const v2 = { x: 0, y: 1 };
    const bounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    const points = generateLatticePoints(v1, v2, bounds);
    expect(points.length).toBe(25); // -2..2 × -2..2 = 5×5
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-2);
      expect(p.x).toBeLessThanOrEqual(2);
      expect(p.y).toBeGreaterThanOrEqual(-2);
      expect(p.y).toBeLessThanOrEqual(2);
    }
  });
});
