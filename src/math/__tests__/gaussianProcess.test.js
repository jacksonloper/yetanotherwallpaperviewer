import { describe, it, expect } from 'vitest';
import {
  computeDualLattice,
  drawGPCoefficients,
  evaluateGP,
  extractPointGroup,
  generateGPHeatmap,
  ouStepGPCoefficients,
  shoStepGPCoefficients,
  drawEquivariantCoefficients,
  shoStepEquivariantCoefficients,
} from '../gaussianProcess.js';
import { identity, rotation, reflection, translation } from '../isometry.js';

const PI = Math.PI;

/* ------------------------------------------------------------------ */
/*  Dual lattice                                                       */
/* ------------------------------------------------------------------ */

describe('computeDualLattice', () => {
  it('satisfies vi · kj = 2π δij for the standard square lattice', () => {
    const v1 = { x: 1, y: 0 };
    const v2 = { x: 0, y: 1 };
    const { k1, k2 } = computeDualLattice(v1, v2);

    expect(v1.x * k1.x + v1.y * k1.y).toBeCloseTo(2 * PI, 10);
    expect(v1.x * k2.x + v1.y * k2.y).toBeCloseTo(0, 10);
    expect(v2.x * k1.x + v2.y * k1.y).toBeCloseTo(0, 10);
    expect(v2.x * k2.x + v2.y * k2.y).toBeCloseTo(2 * PI, 10);
  });

  it('satisfies vi · kj = 2π δij for the default lattice (v1=(0,1), v2=(x,y))', () => {
    const v1 = { x: 0, y: 1 };
    const v2 = { x: 1.5, y: 0.3 };
    const { k1, k2 } = computeDualLattice(v1, v2);

    expect(v1.x * k1.x + v1.y * k1.y).toBeCloseTo(2 * PI, 10);
    expect(v1.x * k2.x + v1.y * k2.y).toBeCloseTo(0, 10);
    expect(v2.x * k1.x + v2.y * k1.y).toBeCloseTo(0, 10);
    expect(v2.x * k2.x + v2.y * k2.y).toBeCloseTo(2 * PI, 10);
  });

  it('satisfies vi · kj = 2π δij for a hexagonal lattice', () => {
    const v1 = { x: 0, y: 1 };
    const v2 = { x: Math.sqrt(3) / 2, y: 0.5 };
    const { k1, k2 } = computeDualLattice(v1, v2);

    expect(v1.x * k1.x + v1.y * k1.y).toBeCloseTo(2 * PI, 10);
    expect(v1.x * k2.x + v1.y * k2.y).toBeCloseTo(0, 10);
    expect(v2.x * k1.x + v2.y * k1.y).toBeCloseTo(0, 10);
    expect(v2.x * k2.x + v2.y * k2.y).toBeCloseTo(2 * PI, 10);
  });
});

/* ------------------------------------------------------------------ */
/*  GP coefficient drawing                                             */
/* ------------------------------------------------------------------ */

describe('drawGPCoefficients', () => {
  const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };

  it('returns consistent results for the same seed', () => {
    const a = drawGPCoefficients(lv, 42);
    const b = drawGPCoefficients(lv, 42);
    expect(a.dc).toBe(b.dc);
    expect(a.modes.length).toBe(b.modes.length);
    for (let i = 0; i < a.modes.length; i++) {
      expect(a.modes[i].a).toBe(b.modes[i].a);
      expect(a.modes[i].b).toBe(b.modes[i].b);
    }
  });

  it('returns different results for different seeds', () => {
    const a = drawGPCoefficients(lv, 42);
    const b = drawGPCoefficients(lv, 99);
    const same = a.modes.every(
      (m, i) => m.a === b.modes[i].a && m.b === b.modes[i].b
    );
    expect(same).toBe(false);
  });

  it('produces the expected number of half-plane modes', () => {
    const c = drawGPCoefficients(lv, 1, 3);
    // maxFreq=3: n1 in [-3,3], n2 in [-3,3]
    // half-plane: n1>0 → 3*7=21 modes, plus n1=0 & n2>0 → 3 modes = 24
    expect(c.modes.length).toBe(24);
  });

  it('includes envelope and dcEnvelope in output', () => {
    const c = drawGPCoefficients(lv, 1, 3, 0.1);
    expect(c.dcEnvelope).toBe(0.1);
    for (const m of c.modes) {
      expect(m.envelope).toBeDefined();
      expect(m.envelope).toBeGreaterThan(0);
      expect(m.envelope).toBeLessThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Ornstein–Uhlenbeck step                                            */
/* ------------------------------------------------------------------ */

describe('ouStepGPCoefficients', () => {
  const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };

  it('preserves mode count, kx, ky, and envelope values', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = ouStepGPCoefficients(initial, 0.9);
    expect(stepped.modes.length).toBe(initial.modes.length);
    for (let i = 0; i < initial.modes.length; i++) {
      expect(stepped.modes[i].kx).toBe(initial.modes[i].kx);
      expect(stepped.modes[i].ky).toBe(initial.modes[i].ky);
      expect(stepped.modes[i].envelope).toBe(initial.modes[i].envelope);
    }
  });

  it('returns identical coefficients when decayFactor=1 (no evolution)', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = ouStepGPCoefficients(initial, 1.0);
    expect(stepped.dc).toBe(initial.dc);
    for (let i = 0; i < initial.modes.length; i++) {
      expect(stepped.modes[i].a).toBe(initial.modes[i].a);
      expect(stepped.modes[i].b).toBe(initial.modes[i].b);
    }
  });

  it('produces fresh iid draws when decayFactor=0', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    // With decay=0, output is independent of input (pure noise)
    const stepped = ouStepGPCoefficients(initial, 0);
    // Values should generally differ (probabilistically)
    const allSame = initial.modes.every(
      (m, i) => m.a === stepped.modes[i].a && m.b === stepped.modes[i].b
    );
    expect(allSame).toBe(false);
  });

  it('preserves the stationary variance (Monte Carlo check)', () => {
    // Run many OU steps and check that empirical variance ≈ envelope²
    const initial = drawGPCoefficients(lv, 7, 2, 0.1);
    const decay = 0.9; // moderate mixing

    let coeffs = initial;
    const burnIn = 200;
    const nSamples = 2000;
    // Track variance of the first mode's 'a' coefficient
    const env0 = initial.modes[0].envelope;
    let sumSq = 0;

    for (let i = 0; i < burnIn + nSamples; i++) {
      coeffs = ouStepGPCoefficients(coeffs, decay);
      if (i >= burnIn) {
        sumSq += coeffs.modes[0].a * coeffs.modes[0].a;
      }
    }

    const empiricalVar = sumSq / nSamples;
    const expectedVar = env0 * env0;
    // Allow 40% relative tolerance (Monte Carlo noise)
    expect(empiricalVar).toBeGreaterThan(expectedVar * 0.6);
    expect(empiricalVar).toBeLessThan(expectedVar * 1.4);
  });

  it('preserves dcEnvelope through steps', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = ouStepGPCoefficients(initial, 0.9);
    expect(stepped.dcEnvelope).toBe(initial.dcEnvelope);
  });
});

/* ------------------------------------------------------------------ */
/*  Stochastic harmonic oscillator step                                */
/* ------------------------------------------------------------------ */

describe('shoStepGPCoefficients', () => {
  const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };

  it('preserves mode count, kx, ky, and envelope values', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = shoStepGPCoefficients(initial, 0.016, 2, 0.5);
    expect(stepped.modes.length).toBe(initial.modes.length);
    for (let i = 0; i < initial.modes.length; i++) {
      expect(stepped.modes[i].kx).toBe(initial.modes[i].kx);
      expect(stepped.modes[i].ky).toBe(initial.modes[i].ky);
      expect(stepped.modes[i].envelope).toBe(initial.modes[i].envelope);
    }
  });

  it('adds velocity fields (va, vb, vdc) to output', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = shoStepGPCoefficients(initial, 0.016, 2, 0.5);
    for (const m of stepped.modes) {
      expect(m.va).toBeDefined();
      expect(m.vb).toBeDefined();
      expect(typeof m.va).toBe('number');
      expect(typeof m.vb).toBe('number');
    }
    expect(stepped.vdc).toBeDefined();
    expect(typeof stepped.vdc).toBe('number');
  });

  it('preserves coefficients when dt=0', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = shoStepGPCoefficients(initial, 0, 2, 0.5);
    expect(stepped.dc).toBe(initial.dc);
    for (let i = 0; i < initial.modes.length; i++) {
      expect(stepped.modes[i].a).toBe(initial.modes[i].a);
      expect(stepped.modes[i].b).toBe(initial.modes[i].b);
    }
  });

  it('preserves dcEnvelope through steps', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    const stepped = shoStepGPCoefficients(initial, 0.016, 2, 0.5);
    expect(stepped.dcEnvelope).toBe(initial.dcEnvelope);
  });

  it('preserves the stationary variance of X (underdamped, Monte Carlo)', () => {
    const initial = drawGPCoefficients(lv, 7, 2, 0.1);
    const omega = 3;
    const damping = 0.3;
    const dt = 0.016;

    let coeffs = initial;
    const burnIn = 500;
    const nSamples = 3000;
    const env0 = initial.modes[0].envelope;
    let sumSq = 0;

    for (let i = 0; i < burnIn + nSamples; i++) {
      coeffs = shoStepGPCoefficients(coeffs, dt, omega, damping);
      if (i >= burnIn) {
        sumSq += coeffs.modes[0].a * coeffs.modes[0].a;
      }
    }

    const empiricalVar = sumSq / nSamples;
    const expectedVar = env0 * env0;
    // Allow 40% relative tolerance (Monte Carlo noise)
    expect(empiricalVar).toBeGreaterThan(expectedVar * 0.6);
    expect(empiricalVar).toBeLessThan(expectedVar * 1.4);
  });

  it('preserves the stationary variance of X (overdamped, Monte Carlo)', () => {
    const initial = drawGPCoefficients(lv, 7, 2, 0.1);
    const omega = 3;
    const damping = 1.5;
    const dt = 0.016;

    let coeffs = initial;
    const burnIn = 500;
    const nSamples = 3000;
    const env0 = initial.modes[0].envelope;
    let sumSq = 0;

    for (let i = 0; i < burnIn + nSamples; i++) {
      coeffs = shoStepGPCoefficients(coeffs, dt, omega, damping);
      if (i >= burnIn) {
        sumSq += coeffs.modes[0].a * coeffs.modes[0].a;
      }
    }

    const empiricalVar = sumSq / nSamples;
    const expectedVar = env0 * env0;
    expect(empiricalVar).toBeGreaterThan(expectedVar * 0.6);
    expect(empiricalVar).toBeLessThan(expectedVar * 1.4);
  });

  it('works near critical damping (ζ ≈ 1)', () => {
    const initial = drawGPCoefficients(lv, 42, 3);
    // Should not throw for ζ exactly 1
    const stepped = shoStepGPCoefficients(initial, 0.016, 2, 1.0);
    expect(stepped.modes.length).toBe(initial.modes.length);
    expect(Number.isFinite(stepped.modes[0].a)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  GP evaluation                                                      */
/* ------------------------------------------------------------------ */

describe('evaluateGP', () => {
  it('is periodic under lattice translations', () => {
    const lv = { v1: { x: 0, y: 1 }, v2: { x: 1.2, y: 0.3 } };
    const coeffs = drawGPCoefficients(lv, 7);

    const f00 = evaluateGP(coeffs, 0.4, 0.6);
    // Shift by v1
    const fv1 = evaluateGP(coeffs, 0.4 + lv.v1.x, 0.6 + lv.v1.y);
    expect(fv1).toBeCloseTo(f00, 8);
    // Shift by v2
    const fv2 = evaluateGP(coeffs, 0.4 + lv.v2.x, 0.6 + lv.v2.y);
    expect(fv2).toBeCloseTo(f00, 8);
    // Shift by v1 + v2
    const fv12 = evaluateGP(
      coeffs,
      0.4 + lv.v1.x + lv.v2.x,
      0.6 + lv.v1.y + lv.v2.y
    );
    expect(fv12).toBeCloseTo(f00, 8);
  });
});

/* ------------------------------------------------------------------ */
/*  Point-group extraction                                             */
/* ------------------------------------------------------------------ */

describe('extractPointGroup', () => {
  it('returns 1 element for pure translations (p1)', () => {
    const elems = [identity(), translation(1, 0), translation(0, 1), translation(1, 1)];
    const pg = extractPointGroup(elems);
    expect(pg.length).toBe(1);
  });

  it('returns 2 elements for p2 (identity + 180° rotation)', () => {
    const rot180 = rotation(PI, 0, 0);
    const elems = [identity(), rot180, translation(1, 0), translation(0, 1)];
    const pg = extractPointGroup(elems);
    expect(pg.length).toBe(2);
  });

  it('returns 4 elements for pmm (identity, 180° rot, 2 reflections)', () => {
    const elems = [
      identity(),
      rotation(PI, 0, 0),
      reflection(0),        // horizontal
      reflection(PI / 2),   // vertical
      translation(1, 0),
      translation(0, 1),
    ];
    const pg = extractPointGroup(elems);
    expect(pg.length).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/*  Heatmap generation                                                 */
/* ------------------------------------------------------------------ */

describe('generateGPHeatmap', () => {
  it('produces a grid of the requested resolution', () => {
    const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };
    const coeffs = drawGPCoefficients(lv, 1, 3);
    const pg = [identity()];
    const bounds = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
    const hm = generateGPHeatmap(coeffs, pg, bounds, 20);
    expect(hm.data.length).toBe(20);
    expect(hm.data[0].length).toBe(20);
    expect(hm.minVal).toBeLessThanOrEqual(hm.maxVal);
  });

  it('heatmap values are invariant under point-group (p4 example)', () => {
    const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };
    const coeffs = drawGPCoefficients(lv, 42, 4);
    const rot90 = rotation(PI / 2, 0, 0);
    const rot180 = rotation(PI, 0, 0);
    const rot270 = rotation((3 * PI) / 2, 0, 0);
    const pg = [identity(), rot90, rot180, rot270];

    // Evaluate the symmetrized GP at two points related by 90° rotation
    const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const hm = generateGPHeatmap(coeffs, pg, bounds, 40);

    // Pixel (10, 15) in the grid corresponds to some (x, y).
    // After 90° rotation, (x, y) → (-y, x).
    // We check that the heatmap is approximately symmetric.
    const x = bounds.minX + (10 + 0.5) * (bounds.maxX - bounds.minX) / 40;
    const y = bounds.maxY - (15 + 0.5) * (bounds.maxY - bounds.minY) / 40;
    // Rotated point
    const rx = -y;
    const ry = x;
    // Find grid indices for the rotated point
    const ri = Math.floor((rx - bounds.minX) / ((bounds.maxX - bounds.minX) / 40));
    const rj = Math.floor((bounds.maxY - ry) / ((bounds.maxY - bounds.minY) / 40));

    if (ri >= 0 && ri < 40 && rj >= 0 && rj < 40) {
      // Allow a small tolerance because grid centres don't map exactly
      expect(hm.data[15][10]).toBeCloseTo(hm.data[rj][ri], 1);
    }
  });

  it('equivariant heatmap flips sign under the non-identity coset (p2 example)', () => {
    const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };
    const coeffs = drawGPCoefficients(lv, 42, 4);
    const rot180 = rotation(PI, 0, 0);
    const pg = [identity(), rot180];

    const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const hm = generateGPHeatmap(coeffs, pg, bounds, 40, true);

    // For equivariant: f_eq(r) = (1/2)[f(r) − f(−r)]
    // So f_eq(−r) = (1/2)[f(−r) − f(r)] = −f_eq(r)
    // Pixel (10, 15) maps to some (x, y); rotation by 180° maps to (−x, −y).
    const x = bounds.minX + (10 + 0.5) * (bounds.maxX - bounds.minX) / 40;
    const y = bounds.maxY - (15 + 0.5) * (bounds.maxY - bounds.minY) / 40;
    const rx = -x;
    const ry = -y;
    const ri = Math.floor((rx - bounds.minX) / ((bounds.maxX - bounds.minX) / 40));
    const rj = Math.floor((bounds.maxY - ry) / ((bounds.maxY - bounds.minY) / 40));

    if (ri >= 0 && ri < 40 && rj >= 0 && rj < 40) {
      // Equivariant GP should be anti-symmetric: f(r) ≈ −f(g(r))
      expect(hm.data[15][10]).toBeCloseTo(-hm.data[rj][ri], 1);
    }
  });

  it('equivariant=false (default) gives same result as omitting the parameter', () => {
    const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };
    const coeffs = drawGPCoefficients(lv, 42, 4);
    const rot180 = rotation(PI, 0, 0);
    const pg = [identity(), rot180];

    const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const hmDefault = generateGPHeatmap(coeffs, pg, bounds, 20);
    const hmExplicit = generateGPHeatmap(coeffs, pg, bounds, 20, false);

    for (let j = 0; j < 20; j++) {
      for (let i = 0; i < 20; i++) {
        expect(hmExplicit.data[j][i]).toBe(hmDefault.data[j][i]);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Equivariant 3-GP coefficients                                      */
/* ------------------------------------------------------------------ */

describe('drawEquivariantCoefficients', () => {
  const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };

  it('returns three independent GPs', () => {
    const eq = drawEquivariantCoefficients(lv, 42);
    expect(eq.gp1).toBeDefined();
    expect(eq.gp2).toBeDefined();
    expect(eq.gp3).toBeDefined();
    expect(eq.gp1.modes.length).toBeGreaterThan(0);
    expect(eq.gp2.modes.length).toBe(eq.gp1.modes.length);
    expect(eq.gp3.modes.length).toBe(eq.gp1.modes.length);
  });

  it('GPs are independent (different coefficients)', () => {
    const eq = drawEquivariantCoefficients(lv, 42);
    const same12 = eq.gp1.modes.every(
      (m, i) => m.a === eq.gp2.modes[i].a && m.b === eq.gp2.modes[i].b
    );
    const same13 = eq.gp1.modes.every(
      (m, i) => m.a === eq.gp3.modes[i].a && m.b === eq.gp3.modes[i].b
    );
    expect(same12).toBe(false);
    expect(same13).toBe(false);
  });

  it('is reproducible with the same seed', () => {
    const a = drawEquivariantCoefficients(lv, 42);
    const b = drawEquivariantCoefficients(lv, 42);
    expect(a.gp1.dc).toBe(b.gp1.dc);
    expect(a.gp2.dc).toBe(b.gp2.dc);
    expect(a.gp3.dc).toBe(b.gp3.dc);
    for (let i = 0; i < a.gp1.modes.length; i++) {
      expect(a.gp1.modes[i].a).toBe(b.gp1.modes[i].a);
      expect(a.gp3.modes[i].b).toBe(b.gp3.modes[i].b);
    }
  });

  it('all GPs share the same kx, ky values', () => {
    const eq = drawEquivariantCoefficients(lv, 42);
    for (let i = 0; i < eq.gp1.modes.length; i++) {
      expect(eq.gp1.modes[i].kx).toBe(eq.gp2.modes[i].kx);
      expect(eq.gp1.modes[i].ky).toBe(eq.gp2.modes[i].ky);
      expect(eq.gp1.modes[i].kx).toBe(eq.gp3.modes[i].kx);
      expect(eq.gp1.modes[i].ky).toBe(eq.gp3.modes[i].ky);
    }
  });
});

describe('shoStepEquivariantCoefficients', () => {
  const lv = { v1: { x: 0, y: 1 }, v2: { x: 1, y: 0 } };

  it('preserves mode structure across all three GPs', () => {
    const initial = drawEquivariantCoefficients(lv, 42, 3);
    const stepped = shoStepEquivariantCoefficients(initial, 0.016, 2, 0.5);
    for (const key of ['gp1', 'gp2', 'gp3']) {
      expect(stepped[key].modes.length).toBe(initial[key].modes.length);
      for (let i = 0; i < initial[key].modes.length; i++) {
        expect(stepped[key].modes[i].kx).toBe(initial[key].modes[i].kx);
        expect(stepped[key].modes[i].ky).toBe(initial[key].modes[i].ky);
        expect(stepped[key].modes[i].envelope).toBe(initial[key].modes[i].envelope);
      }
    }
  });

  it('adds velocity fields to all three GPs', () => {
    const initial = drawEquivariantCoefficients(lv, 42, 3);
    const stepped = shoStepEquivariantCoefficients(initial, 0.016, 2, 0.5);
    for (const key of ['gp1', 'gp2', 'gp3']) {
      for (const m of stepped[key].modes) {
        expect(typeof m.va).toBe('number');
        expect(typeof m.vb).toBe('number');
      }
      expect(typeof stepped[key].vdc).toBe('number');
    }
  });

  it('preserves coefficients when dt=0', () => {
    const initial = drawEquivariantCoefficients(lv, 42, 3);
    const stepped = shoStepEquivariantCoefficients(initial, 0, 2, 0.5);
    for (const key of ['gp1', 'gp2', 'gp3']) {
      expect(stepped[key].dc).toBe(initial[key].dc);
      for (let i = 0; i < initial[key].modes.length; i++) {
        expect(stepped[key].modes[i].a).toBe(initial[key].modes[i].a);
        expect(stepped[key].modes[i].b).toBe(initial[key].modes[i].b);
      }
    }
  });
});
