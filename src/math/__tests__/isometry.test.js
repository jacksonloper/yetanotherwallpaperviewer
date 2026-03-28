import { describe, it, expect } from 'vitest';
import {
  identity,
  translation,
  rotation,
  reflection,
  glideReflection,
  compose,
  inverse,
  isIdentity,
  classify,
  rotationInfo,
  rotationOrder,
  reflectionInfo,
  applyToPoint,
} from '../isometry.js';

const PI = Math.PI;
const EPS = 1e-8;

describe('isometry basics', () => {
  it('identity leaves points unchanged', () => {
    const id = identity();
    const p = applyToPoint(id, 3, 7);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(7);
  });

  it('translation moves points', () => {
    const t = translation(2, -1);
    const p = applyToPoint(t, 1, 1);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(0);
  });

  it('rotation by 90° about origin', () => {
    const r = rotation(PI / 2, 0, 0);
    const p = applyToPoint(r, 1, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('rotation by 180° about (0.5, 0.5)', () => {
    const r = rotation(PI, 0.5, 0.5);
    const p = applyToPoint(r, 1, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('reflection across x-axis', () => {
    const r = reflection(0, 0, 0);
    const p = applyToPoint(r, 3, 5);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(-5);
  });

  it('reflection across y-axis', () => {
    const r = reflection(PI / 2, 0, 0);
    const p = applyToPoint(r, 3, 5);
    expect(p.x).toBeCloseTo(-3);
    expect(p.y).toBeCloseTo(5);
  });
});

describe('compose and inverse', () => {
  it('compose two translations', () => {
    const t1 = translation(1, 0);
    const t2 = translation(0, 1);
    const t = compose(t1, t2);
    const p = applyToPoint(t, 0, 0);
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(1);
  });

  it('inverse of translation', () => {
    const t = translation(3, -2);
    const inv = inverse(t);
    const comp = compose(t, inv);
    expect(isIdentity(comp)).toBe(true);
  });

  it('inverse of rotation', () => {
    const r = rotation(PI / 3, 1, 2);
    const inv = inverse(r);
    const comp = compose(r, inv);
    expect(isIdentity(comp)).toBe(true);
  });

  it('inverse of reflection', () => {
    const r = reflection(PI / 4, 1, 0);
    const inv = inverse(r);
    const comp = compose(r, inv);
    expect(isIdentity(comp)).toBe(true);
  });
});

describe('classify', () => {
  it('classifies identity', () => {
    expect(classify(identity())).toBe('identity');
  });

  it('classifies translation', () => {
    expect(classify(translation(1, 2))).toBe('translation');
  });

  it('classifies rotation', () => {
    expect(classify(rotation(PI / 4, 0, 0))).toBe('rotation');
  });

  it('classifies reflection', () => {
    expect(classify(reflection(0, 0, 0))).toBe('reflection');
  });

  it('classifies glide reflection', () => {
    expect(classify(glideReflection(0, 1, 0, 0))).toBe('glide-reflection');
  });
});

describe('rotationInfo and rotationOrder', () => {
  it('finds centre of 90° rotation at origin', () => {
    const r = rotation(PI / 2, 0, 0);
    const info = rotationInfo(r);
    expect(info.cx).toBeCloseTo(0);
    expect(info.cy).toBeCloseTo(0);
    expect(info.angle).toBeCloseTo(PI / 2);
  });

  it('finds centre of 120° rotation at (1, 1)', () => {
    const r = rotation((2 * PI) / 3, 1, 1);
    const info = rotationInfo(r);
    expect(info.cx).toBeCloseTo(1);
    expect(info.cy).toBeCloseTo(1);
  });

  it('order of 180° rotation is 2', () => {
    expect(rotationOrder(rotation(PI, 0, 0))).toBe(2);
  });

  it('order of 120° rotation is 3', () => {
    expect(rotationOrder(rotation((2 * PI) / 3, 0, 0))).toBe(3);
  });

  it('order of 90° rotation is 4', () => {
    expect(rotationOrder(rotation(PI / 2, 0, 0))).toBe(4);
  });

  it('order of 60° rotation is 6', () => {
    expect(rotationOrder(rotation(PI / 3, 0, 0))).toBe(6);
  });

  it('detects order 3 from slightly imprecise physical isometry', () => {
    // Simulate what toPhysical produces for R₃ with a 6-digit hex lattice.
    // The matrix entries are slightly off from the exact cos/sin(2π/3) values.
    const M = { a: -0.5000003, b: -0.8660250, c: 0.8660250, d: -0.5000003, tx: 0, ty: 0 };
    expect(rotationOrder(M)).toBe(3);
  });

  it('detects order 6 from slightly imprecise physical isometry', () => {
    const M = { a: 0.5000003, b: -0.8660250, c: 0.8660250, d: 0.5000003, tx: 0, ty: 0 };
    expect(rotationOrder(M)).toBe(6);
  });
});

describe('reflectionInfo', () => {
  it('x-axis reflection has angle 0 and zero glide', () => {
    const info = reflectionInfo(reflection(0, 0, 0));
    expect(info.angle).toBeCloseTo(0);
    expect(info.glideDist).toBeCloseTo(0);
  });

  it('glide reflection along x-axis has nonzero glide', () => {
    const g = glideReflection(0, 2, 0, 0);
    const info = reflectionInfo(g);
    expect(info.angle).toBeCloseTo(0);
    expect(info.glideDist).toBeCloseTo(2);
  });
});
