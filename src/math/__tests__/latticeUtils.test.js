import { describe, it, expect } from 'vitest';
import { getAllowedIsometries, cmSliderToVector, resolveCmDirection } from '../latticeUtils.js';

/**
 * Continuity tests for the well-rounded slider transitions.
 *
 * The well-rounded slider goes from 0 (square) through centered-rectangular
 * to 1 (hexagonal). The centered-rectangular lattice has 5 isometry types:
 *   1. rotation order 2
 *   2. reflection along a+b
 *   3. reflection along b−a
 *   4. glide along a+b
 *   5. glide along b−a
 *
 * At the square and hex endpoints, the allowed isometries list expands
 * (square has 4 reflections, hex has 6). The first two reflections and
 * glides at the endpoints must match the centered-rectangular ones so
 * that dirIndex=0 and dirIndex=1 refer to continuously-varying directions.
 */

const TOLERANCE = 0.02; // angles should be within ~1° at sliderValue 0.01 from boundary

function wellRounded(sliderValue) {
  return { mode: 'well-rounded', sliderValue };
}

describe('well-rounded slider continuity: near-square → square', () => {
  const nearSquare = getAllowedIsometries(wellRounded(0.01));
  const atSquare = getAllowedIsometries(wellRounded(0));

  it('rotation orders include 2 on both sides', () => {
    expect(nearSquare.rotationOrders).toContain(2);
    expect(atSquare.rotationOrders).toContain(2);
  });

  it('reflections[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearSquare.reflections[0].angle - atSquare.reflections[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('reflections[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearSquare.reflections[1].angle - atSquare.reflections[1].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearSquare.glides[0].angle - atSquare.glides[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[0] dist is continuous', () => {
    expect(Math.abs(nearSquare.glides[0].dist - atSquare.glides[0].dist))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearSquare.glides[1].angle - atSquare.glides[1].angle))
      .toBeLessThan(TOLERANCE);
  });
});

describe('well-rounded slider continuity: near-hex → hex', () => {
  const nearHex = getAllowedIsometries(wellRounded(0.99));
  const atHex = getAllowedIsometries(wellRounded(1));

  it('rotation orders include 2 on both sides', () => {
    expect(nearHex.rotationOrders).toContain(2);
    expect(atHex.rotationOrders).toContain(2);
  });

  it('reflections[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearHex.reflections[0].angle - atHex.reflections[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('reflections[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearHex.reflections[1].angle - atHex.reflections[1].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearHex.glides[0].angle - atHex.glides[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearHex.glides[1].angle - atHex.glides[1].angle))
      .toBeLessThan(TOLERANCE);
  });
});

/**
 * Not-well-rounded centered-rectangular → hex continuity.
 *
 * In not-well-rounded mode with shape='centered-rectangular', y=0.5 is fixed
 * and x varies. At x=√3/2 ≈ 0.866 the lattice becomes hexagonal.
 * The reflection/glide directions must be continuous across this boundary.
 */
describe('not-well-rounded centered-rectangular → hex continuity', () => {
  const sqrt3h = Math.sqrt(3) / 2;
  const nearHex = getAllowedIsometries({
    mode: 'not-well-rounded', shape: 'centered-rectangular', x: sqrt3h + 0.01,
  });
  const atHex = getAllowedIsometries({
    mode: 'not-well-rounded', shape: 'centered-rectangular', x: sqrt3h,
  });

  it('lattice types are centered-rectangular and hexagonal respectively', () => {
    expect(nearHex.latticeType).toBe('centered-rectangular');
    expect(atHex.latticeType).toBe('hexagonal');
  });

  it('reflections[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearHex.reflections[0].angle - atHex.reflections[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('reflections[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearHex.reflections[1].angle - atHex.reflections[1].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[0] angle is continuous (along a+b)', () => {
    expect(Math.abs(nearHex.glides[0].angle - atHex.glides[0].angle))
      .toBeLessThan(TOLERANCE);
  });

  it('glides[1] angle is continuous (along b−a)', () => {
    expect(Math.abs(nearHex.glides[1].angle - atHex.glides[1].angle))
      .toBeLessThan(TOLERANCE);
  });
});

/**
 * cmSliderToVector: angle-based parameterization tests.
 *
 * The cm-slider maps t ∈ [0,1] to a lattice vector using the angle
 * between basis vectors: θ = 30° + t·60°.
 *   t = 0   → 30° (oblique rhombus)
 *   t = 0.5 → 60° (hexagonal)
 *   t = 1   → 90° (square)
 *
 * The lattice is always well-rounded (|a| = |b| = 1).
 */
const PI = Math.PI;
const SQRT3H = Math.sqrt(3) / 2;

describe('cmSliderToVector: boundary values', () => {
  it('t = 1 gives square (x = 1, y = 0)', () => {
    const v = cmSliderToVector(1);
    expect(v.x).toBeCloseTo(1, 10);
    expect(v.y).toBeCloseTo(0, 10);
  });

  it('t = 0.5 gives hexagonal (x = √3/2, y = 0.5)', () => {
    const v = cmSliderToVector(0.5);
    expect(v.x).toBeCloseTo(SQRT3H, 10);
    expect(v.y).toBeCloseTo(0.5, 10);
  });

  it('t = 0 gives 30° oblique (x = 0.5, y = √3/2)', () => {
    const v = cmSliderToVector(0);
    expect(v.x).toBeCloseTo(0.5, 10);
    expect(v.y).toBeCloseTo(SQRT3H, 10);
  });
});

describe('cmSliderToVector: always well-rounded (|b| = 1)', () => {
  const testValues = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

  for (const t of testValues) {
    it(`|b| = 1 at t = ${t}`, () => {
      const v = cmSliderToVector(t);
      const r = Math.sqrt(v.x * v.x + v.y * v.y);
      expect(r).toBeCloseTo(1, 10);
    });
  }
});

describe('cmSliderToVector: angle between vectors matches t', () => {
  it('angle is 30° + t·60° for several t values', () => {
    for (const t of [0, 0.2, 0.4, 0.5, 0.7, 1]) {
      const v = cmSliderToVector(t);
      // angle between a=(0,1) and b=(x,y) = arccos(a·b) = arccos(y)
      const angleDeg = Math.acos(v.y) * 180 / PI;
      const expectedDeg = 30 + t * 60;
      expect(angleDeg).toBeCloseTo(expectedDeg, 8);
    }
  });
});

describe('cm direction continuity through hex on cm-slider', () => {
  it('cmDir 0 (a+b) angle varies continuously near hex', () => {
    const nearHex = cmSliderToVector(0.49);
    const atHex = cmSliderToVector(0.5);
    const nearHexDir = resolveCmDirection(0, nearHex);
    const atHexDir = resolveCmDirection(0, atHex);
    expect(Math.abs(nearHexDir.angle - atHexDir.angle)).toBeLessThan(0.02);
  });

  it('cmDir 1 (b−a) angle varies continuously near hex', () => {
    const nearHex = cmSliderToVector(0.49);
    const atHex = cmSliderToVector(0.5);
    const nearHexDir = resolveCmDirection(1, nearHex);
    const atHexDir = resolveCmDirection(1, atHex);
    expect(Math.abs(nearHexDir.angle - atHexDir.angle)).toBeLessThan(0.02);
  });

  it('cmDir 0 angle varies continuously across full slider range', () => {
    for (let t = 0; t < 1; t += 0.05) {
      const v1 = cmSliderToVector(t);
      const v2 = cmSliderToVector(t + 0.05);
      const d1 = resolveCmDirection(0, v1);
      const d2 = resolveCmDirection(0, v2);
      expect(Math.abs(d1.angle - d2.angle)).toBeLessThan(0.1);
    }
  });

  it('cmDir 1 angle varies continuously across full slider range', () => {
    for (let t = 0; t < 1; t += 0.05) {
      const v1 = cmSliderToVector(t);
      const v2 = cmSliderToVector(t + 0.05);
      const d1 = resolveCmDirection(1, v1);
      const d2 = resolveCmDirection(1, v2);
      expect(Math.abs(d1.angle - d2.angle)).toBeLessThan(0.1);
    }
  });
});
