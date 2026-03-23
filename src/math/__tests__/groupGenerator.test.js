import { describe, it, expect } from 'vitest';
import {
  translation,
  rotation,
  reflection,
  glideReflection,
  classify,
  reflectionInfo,
  compose,
  isometryEqual,
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
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.warning).toContain('outside the specified lattice');
    expect(result.elements.length).toBeGreaterThan(0);
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

  it('element count is capped at maxElements (default 1000)', () => {
    // With high maxWords on a group with many generators, should not exceed default cap
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0)],
      20
    );
    expect(result.error).toBeNull();
    expect(result.elements.length).toBeLessThanOrEqual(1000);
  });

  it('element count respects custom maxElements', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0)],
      20,
      5000
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

  it('p4g: square lattice, 90° rotation at origin + diagonal reflection', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0), reflection(-PI / 4, 1 / 4, 1 / 4)],
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

describe('generateGroup – invalid configurations should warn', () => {
  // Wrong rotation order for lattice type
  it('warns on 3-fold rotation on square lattice', () => {
    const result = generateGroup(
      [...squareLattice(), rotation((2 * PI) / 3, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on 4-fold rotation on hexagonal lattice', () => {
    const result = generateGroup(
      [...hexLattice(), rotation(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on 6-fold rotation on square lattice', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 3, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on 3-fold rotation on rectangular lattice', () => {
    const result = generateGroup(
      [...rectLattice(1.5), rotation((2 * PI) / 3, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on 4-fold rotation on oblique lattice', () => {
    const result = generateGroup(
      [...obliqueLattice(), rotation(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  // Wrong reflection axis for lattice type
  it('warns on diagonal reflection on rectangular lattice', () => {
    const result = generateGroup(
      [...rectLattice(1.5), reflection(PI / 4, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on vertical reflection on oblique lattice', () => {
    const result = generateGroup(
      [...obliqueLattice(), reflection(PI / 2, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  // Wrong glide distance
  it('warns on glide reflection with wrong distance on square lattice', () => {
    // Correct distance for vertical glide on square lattice is 0.5; using 0.3
    const result = generateGroup(
      [...squareLattice(), glideReflection(PI / 2, 0.3, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('warns on glide reflection with wrong distance on hexagonal lattice', () => {
    // Vertical glide on hex lattice should be 0.5; using 0.7
    const result = generateGroup(
      [...hexLattice(), glideReflection(PI / 2, 0.7, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  // Two rotations at incompatible centers
  it('warns on two 3-fold rotations at incompatible centers on hex lattice', () => {
    const result = generateGroup(
      [
        ...hexLattice(),
        rotation((2 * PI) / 3, 0, 0),
        rotation((2 * PI) / 3, 0.23, 0),
      ],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
  });

  // Irrational rotation angle
  it('warns on rotation by 1 radian (irrational angle)', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(1, 0, 0)],
      6
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeTruthy();
    expect(result.elements.length).toBeGreaterThan(0);
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

/**
 * Find all distinct reflection/glide axis DIRECTIONS present in the group elements.
 * Returns { mirrorAngles: Set, glideAngles: Set }, where angles are rounded
 * to multiples of 15° and normalized to (-90°, 90°].
 */
function classifyAxes(elements) {
  const EPS = 1e-5;
  const mirrorAngles = new Set();
  const glideAngles = new Set();

  for (const el of elements) {
    const type = classify(el, EPS);
    if (type === 'reflection' || type === 'glide-reflection') {
      const info = reflectionInfo(el);
      // Normalize angle to (-π/2, π/2]
      let a = info.angle;
      while (a <= -PI / 2 + EPS) a += PI;
      while (a > PI / 2 + EPS) a -= PI;
      // Round to nearest 15°
      const deg = Math.round((a * 180) / PI / 15) * 15;
      if (type === 'reflection') mirrorAngles.add(deg);
      else glideAngles.add(deg);
    }
  }
  return { mirrorAngles, glideAngles };
}

describe('p4m vs p4g — wallpaper type verification', () => {
  it('p4g generators differ from p4m generators (not equivalent by lattice translation)', () => {
    // The old (incorrect) p4g used rotation(π/2, 0.5, 0.5) + reflection(0, 0, 0).
    // T₂⁻¹ ∘ rotation(π/2, 0.5, 0.5) = rotation(π/2, 0, 0), proving old p4g = p4m.
    const R_p4m = rotation(PI / 2, 0, 0);
    const R_old_p4g = rotation(PI / 2, 0.5, 0.5);
    const T2inv = translation(-1, 0);
    const product = compose(T2inv, R_old_p4g);
    expect(isometryEqual(product, R_p4m, 1e-9)).toBe(true);
  });

  it('p4m has mirrors in 4 directions (0°, 45°, 90°, −45°)', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0), reflection(0, 0, 0)],
      6,
      5000
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
    const { mirrorAngles } = classifyAxes(result.elements);
    expect(mirrorAngles.has(0)).toBe(true);
    expect(mirrorAngles.has(45)).toBe(true);
    expect(mirrorAngles.has(90)).toBe(true);
    expect(mirrorAngles.has(-45)).toBe(true);
    expect(mirrorAngles.size).toBe(4);
  });

  it('p4g has mirrors in only 2 directions (diagonals), glides in the other 2 (axes)', () => {
    const result = generateGroup(
      [...squareLattice(), rotation(PI / 2, 0, 0), reflection(-PI / 4, 1 / 4, 1 / 4)],
      6,
      5000
    );
    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
    const { mirrorAngles, glideAngles } = classifyAxes(result.elements);

    // Mirrors should exist ONLY in diagonal directions
    expect(mirrorAngles.has(45)).toBe(true);
    expect(mirrorAngles.has(-45)).toBe(true);
    expect(mirrorAngles.has(0)).toBe(false);   // no horizontal mirror
    expect(mirrorAngles.has(90)).toBe(false);  // no vertical mirror

    // Glides should exist in axial directions (and possibly also diagonals)
    expect(glideAngles.has(0)).toBe(true);     // horizontal glide
    expect(glideAngles.has(90)).toBe(true);    // vertical glide
  });

  it('p4g diagonal mirror does NOT pass through the 4-fold center', () => {
    // The reflection(-π/4, 1/4, 1/4) has axis through (1/4, 1/4) at angle -45°.
    // The 4-fold center is at (0, 0). Check that (0,0) is NOT on the mirror axis.
    const sigma = reflection(-PI / 4, 1 / 4, 1 / 4);
    // If (0,0) were on the mirror axis, σ(0,0) would equal (0,0).
    // σ(0,0) = (tx, ty) = (0.5, 0.5), which is far from origin.
    const mapped = { x: sigma.tx, y: sigma.ty };
    const dist = Math.sqrt(mapped.x * mapped.x + mapped.y * mapped.y);
    expect(dist).toBeGreaterThan(0.1); // origin maps to (0.5, 0.5), far from origin
  });
});

// --- noFreeParams tests for square/hexagonal lattice types ---

import { getWallpaperTypesForLattice } from '../wallpaperGroups.js';

describe('noFreeParams flag on square lattice types', () => {
  const squareTypes = getWallpaperTypesForLattice('square');

  it('p4 has noFreeParams', () => {
    expect(squareTypes.find(t => t.name === 'p4').noFreeParams).toBe(true);
  });

  it('p4m has noFreeParams', () => {
    expect(squareTypes.find(t => t.name === 'p4m').noFreeParams).toBe(true);
  });

  it('p4g has noFreeParams', () => {
    expect(squareTypes.find(t => t.name === 'p4g').noFreeParams).toBe(true);
  });

  it('other square lattice types do NOT have noFreeParams', () => {
    const freeTypes = ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm'];
    for (const name of freeTypes) {
      const t = squareTypes.find(t => t.name === name);
      if (t) expect(t.noFreeParams).toBeFalsy();
    }
  });
});

describe('noFreeParams flag on hexagonal lattice types', () => {
  const hexTypes = getWallpaperTypesForLattice('hexagonal');

  it('p3 has noFreeParams', () => {
    expect(hexTypes.find(t => t.name === 'p3').noFreeParams).toBe(true);
  });

  it('p3m1 has noFreeParams', () => {
    expect(hexTypes.find(t => t.name === 'p3m1').noFreeParams).toBe(true);
  });

  it('p31m has noFreeParams', () => {
    expect(hexTypes.find(t => t.name === 'p31m').noFreeParams).toBe(true);
  });

  it('p6 has noFreeParams', () => {
    expect(hexTypes.find(t => t.name === 'p6').noFreeParams).toBe(true);
  });

  it('p6m has noFreeParams', () => {
    expect(hexTypes.find(t => t.name === 'p6m').noFreeParams).toBe(true);
  });

  it('other hexagonal lattice types do NOT have noFreeParams', () => {
    const freeTypes = ['p1', 'p2', 'cm', 'cmm'];
    for (const name of freeTypes) {
      const t = hexTypes.find(t => t.name === name);
      if (t) expect(t.noFreeParams).toBeFalsy();
    }
  });
});
