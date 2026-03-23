import { describe, it, expect } from 'vitest';
import { getAllowedIsometries } from '../latticeUtils.js';

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
