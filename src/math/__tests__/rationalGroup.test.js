import { describe, it, expect } from 'vitest'
import {
  rat, radd, rsub, rmul, rdiv, rneg, req, rToFloat, rmod1, gcd,
  rimat, ridentity, rcompose, rinverse, rmatEqual, rmodT,
} from '../rational.js'
import {
  standardGenerators,
  processGroup,
  toPhysical,
  quotientToPhysical,
  generateElements,
} from '../rationalGroup.js'
import {
  rotation,
  reflection,
  glideReflection,
  isometryEqual,
  classify,
} from '../isometry.js'

const PI = Math.PI
const s3h = Math.sqrt(3) / 2

// ───────────────────────────────────────────────────
//  Rational arithmetic
// ───────────────────────────────────────────────────

describe('rational arithmetic', () => {
  it('gcd computes correctly', () => {
    expect(gcd(12, 8)).toBe(4)
    expect(gcd(7, 3)).toBe(1)
    expect(gcd(0, 5)).toBe(5)
    expect(gcd(6, 0)).toBe(6)
  })

  it('rat normalises', () => {
    expect(rat(2, 4)).toEqual([1, 2])
    expect(rat(-3, 6)).toEqual([-1, 2])
    expect(rat(0, 5)).toEqual([0, 1])
    expect(rat(4, -2)).toEqual([-2, 1])
  })

  it('radd adds rationals', () => {
    expect(radd([1, 2], [1, 3])).toEqual([5, 6])
    expect(radd([1, 2], [-1, 2])).toEqual([0, 1])
  })

  it('rsub subtracts rationals', () => {
    expect(rsub([1, 2], [1, 3])).toEqual([1, 6])
    expect(rsub([1, 2], [1, 2])).toEqual([0, 1])
  })

  it('rmul multiplies rationals', () => {
    expect(rmul([2, 3], [3, 4])).toEqual([1, 2])
    expect(rmul([1, 2], [0, 1])).toEqual([0, 1])
  })

  it('rdiv divides rationals', () => {
    expect(rdiv([1, 2], [3, 4])).toEqual([2, 3])
    expect(() => rdiv([1, 2], [0, 1])).toThrow()
  })

  it('rneg negates', () => {
    expect(rneg([3, 4])).toEqual([-3, 4])
    expect(rneg([0, 1])).toEqual([0, 1])
  })

  it('req checks equality', () => {
    expect(req([1, 2], [1, 2])).toBe(true)
    expect(req([1, 2], [2, 4])).toBe(false) // not normalised – test input is pre-normalised
    expect(req(rat(2, 4), [1, 2])).toBe(true)
  })

  it('rToFloat converts', () => {
    expect(rToFloat([1, 2])).toBe(0.5)
    expect(rToFloat([0, 1])).toBe(0)
    expect(rToFloat([-3, 4])).toBe(-0.75)
  })

  it('rmod1 reduces to [0, 1)', () => {
    expect(rmod1([3, 2])).toEqual([1, 2])    // 3/2 → 1/2
    expect(rmod1([-1, 2])).toEqual([1, 2])   // -1/2 → 1/2
    expect(rmod1([0, 1])).toEqual([0, 1])    // 0 → 0
    expect(rmod1([1, 1])).toEqual([0, 1])    // 1 → 0
    expect(rmod1([5, 3])).toEqual([2, 3])    // 5/3 → 2/3
    expect(rmod1([-3, 2])).toEqual([1, 2])   // -3/2 → 1/2
  })
})

// ───────────────────────────────────────────────────
//  Rational matrices
// ───────────────────────────────────────────────────

describe('rational matrices', () => {
  it('rimat creates from integers', () => {
    const m = rimat(1, 0, 0, -1, 1, 2, 0, 1)
    expect(req(m.a, [1, 1])).toBe(true)
    expect(req(m.d, [-1, 1])).toBe(true)
    expect(req(m.tx, [1, 2])).toBe(true)
    expect(req(m.ty, [0, 1])).toBe(true)
  })

  it('ridentity is the identity', () => {
    const id = ridentity()
    expect(req(id.a, [1, 1])).toBe(true)
    expect(req(id.d, [1, 1])).toBe(true)
    expect(req(id.b, [0, 1])).toBe(true)
    expect(req(id.c, [0, 1])).toBe(true)
    expect(req(id.tx, [0, 1])).toBe(true)
    expect(req(id.ty, [0, 1])).toBe(true)
  })

  it('rcompose gives A ∘ B', () => {
    // R₄ ∘ R₄ = R₂
    const r4 = rimat(0, 1, -1, 0)
    const r2 = rcompose(r4, r4)
    expect(req(r2.a, [-1, 1])).toBe(true)
    expect(req(r2.b, [0, 1])).toBe(true)
    expect(req(r2.c, [0, 1])).toBe(true)
    expect(req(r2.d, [-1, 1])).toBe(true)
  })

  it('rcompose handles translations', () => {
    const g = rimat(-1, 0, 0, 1, 1, 2, 1, 2)  // pgg generator
    const g2 = rcompose(g, g)
    // g² should be translation by (0, 1) = identity mod T
    expect(req(g2.a, [1, 1])).toBe(true)
    expect(req(g2.d, [1, 1])).toBe(true)
    expect(req(g2.tx, [0, 1])).toBe(true)
    expect(req(g2.ty, [1, 1])).toBe(true)
  })

  it('rinverse gives the inverse', () => {
    const r4 = rimat(0, 1, -1, 0)
    const r4inv = rinverse(r4)
    const product = rcompose(r4, r4inv)
    expect(rmatEqual(product, ridentity())).toBe(true)
  })

  it('rinverse handles translations', () => {
    const g = rimat(1, 0, 0, -1, 1, 2)  // glide ∥ a
    const ginv = rinverse(g)
    const product = rcompose(g, ginv)
    expect(rmatEqual(product, ridentity())).toBe(true)
  })

  it('rmodT reduces translations mod 1', () => {
    const m = rimat(0, 1, -1, 0, 3, 2, -1, 2)
    const reduced = rmodT(m)
    expect(req(reduced.tx, [1, 2])).toBe(true)
    expect(req(reduced.ty, [1, 2])).toBe(true)
    // Linear part unchanged
    expect(req(reduced.a, [0, 1])).toBe(true)
    expect(req(reduced.b, [1, 1])).toBe(true)
  })

  it('R₃³ = I on hex lattice', () => {
    const r3 = rimat(0, 1, -1, -1)
    const r3_2 = rcompose(r3, r3)
    const r3_3 = rcompose(r3, r3_2)
    expect(rmatEqual(r3_3, ridentity())).toBe(true)
  })

  it('R₆⁶ = I on hex lattice', () => {
    const r6 = rimat(1, 1, -1, 0)
    let power = ridentity()
    for (let i = 0; i < 6; i++) power = rcompose(r6, power)
    expect(rmatEqual(power, ridentity())).toBe(true)
  })

  it('R₄⁴ = I on square lattice', () => {
    const r4 = rimat(0, 1, -1, 0)
    let power = ridentity()
    for (let i = 0; i < 4; i++) power = rcompose(r4, power)
    expect(rmatEqual(power, ridentity())).toBe(true)
  })

  it('reflections square to identity', () => {
    const sigmas = [
      rimat(1, 0, 0, -1),   // σ_a
      rimat(-1, 0, 0, 1),   // σ_b
      rimat(0, 1, 1, 0),    // σ_apb
      rimat(0, -1, -1, 0),  // σ_bma
      rimat(-1, -1, 0, 1),  // σ_hex_hor
      rimat(1, 1, 0, -1),   // σ_hex_ver
    ]
    for (const s of sigmas) {
      const s2 = rcompose(s, s)
      expect(rmatEqual(s2, ridentity())).toBe(true)
    }
  })

  it('glide reflections square to a lattice translation', () => {
    const glideA = rimat(1, 0, 0, -1, 1, 2)
    const glideA2 = rcompose(glideA, glideA)
    // Should be translation by (1, 0) = e₁
    expect(req(glideA2.a, [1, 1])).toBe(true)
    expect(req(glideA2.d, [1, 1])).toBe(true)
    expect(req(glideA2.b, [0, 1])).toBe(true)
    expect(req(glideA2.c, [0, 1])).toBe(true)
    expect(req(glideA2.tx, [1, 1])).toBe(true)
    expect(req(glideA2.ty, [0, 1])).toBe(true)
  })
})

// ───────────────────────────────────────────────────
//  Standard generators and G/T orders
// ───────────────────────────────────────────────────

describe('standardGenerators', () => {
  it('returns generators for each of the 17 types', () => {
    const types = [
      'p1', 'p2', 'pm', 'pg', 'pmm', 'pmg', 'pgg',
      'cm', 'cmm',
      'p4', 'p4m', 'p4g',
      'p3', 'p3m1', 'p31m', 'p6', 'p6m',
    ]
    for (const t of types) {
      const result = standardGenerators(t)
      expect(result).not.toBeNull()
      expect(result.latticeType).toBeTruthy()
      expect(Array.isArray(result.generators)).toBe(true)
    }
  })

  it('returns null for unknown type', () => {
    expect(standardGenerators('p99')).toBeNull()
  })

  it('handles variant selection for pm', () => {
    const v0 = standardGenerators('pm', 0)
    const v1 = standardGenerators('pm', 1)
    expect(v0.variantLabels).toEqual(['Mirrors ∥ a', 'Mirrors ∥ b'])
    expect(rmatEqual(v0.generators[0], v1.generators[0])).toBe(false)
  })
})

describe('processGroup – G/T orders for all 17 types', () => {
  const expectedOrders = {
    p1: 1, p2: 2,
    pm: 2, pg: 2,
    pmm: 4, pmg: 4, pgg: 4,
    cm: 2, cmm: 4,
    p4: 4, p4m: 8, p4g: 8,
    p3: 3, p3m1: 6, p31m: 6,
    p6: 6, p6m: 12,
  }

  for (const [typeName, expectedOrder] of Object.entries(expectedOrders)) {
    it(`${typeName} has |G/T| = ${expectedOrder}`, () => {
      const { generators } = standardGenerators(typeName)
      const result = processGroup(generators)
      expect(result.error).toBeNull()
      expect(result.isDegenerate).toBe(false)
      expect(result.order).toBe(expectedOrder)
      expect(result.cosets.length).toBe(expectedOrder)
    })
  }

  // Also test all variants
  for (const typeName of ['pm', 'pg', 'pmg', 'cm']) {
    it(`${typeName} variant 1 also has correct order`, () => {
      const { generators } = standardGenerators(typeName, 1)
      const result = processGroup(generators)
      expect(result.error).toBeNull()
      expect(result.isDegenerate).toBe(false)
      expect(result.order).toBe(expectedOrders[typeName])
    })
  }
})

describe('processGroup – degeneracy detection', () => {
  it('detects degenerate group from irrational rotation', () => {
    // A rotation by 1 radian (not a rational multiple of π) in lattice
    // coords would not have integer linear part, but we can simulate
    // a problematic case: two reflections whose composition has
    // irrational order generate infinitely many distinct cosets.
    // Here we use a large set of independent reflections.
    //
    // More directly: a rotation matrix that doesn't have finite order.
    // In lattice coords, [[1, 1], [0, 1]] is a shear (not isometry),
    // but as a formal rational matrix it will produce infinite G/T.
    const shear = rimat(1, 1, 0, 1)
    const result = processGroup([shear], 24)
    expect(result.isDegenerate).toBe(true)
    expect(result.error).toBeTruthy()
  })
})

// ───────────────────────────────────────────────────
//  Conversion to physical isometries
// ───────────────────────────────────────────────────

describe('toPhysical – square lattice', () => {
  const sqVec = { x: 1, y: 0 }

  it('identity maps to identity', () => {
    const phys = toPhysical(ridentity(), sqVec)
    expect(isometryEqual(phys, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 })).toBe(true)
  })

  it('R₄ maps to 90° rotation', () => {
    const phys = toPhysical(rimat(0, 1, -1, 0), sqVec)
    const expected = rotation(PI / 2, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('σ_b maps to horizontal reflection', () => {
    const phys = toPhysical(rimat(-1, 0, 0, 1), sqVec)
    const expected = reflection(0, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('σ_a maps to vertical reflection', () => {
    const phys = toPhysical(rimat(1, 0, 0, -1), sqVec)
    const expected = reflection(PI / 2, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('p4g reflection maps correctly', () => {
    const phys = toPhysical(rimat(0, -1, -1, 0, 1, 2, 1, 2), sqVec)
    const expected = reflection(-PI / 4, 1 / 4, 1 / 4)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })
})

describe('toPhysical – hexagonal lattice', () => {
  const hexVec = { x: s3h, y: 0.5 }

  it('R₃ maps to 120° rotation', () => {
    const phys = toPhysical(rimat(0, 1, -1, -1), hexVec)
    const expected = rotation((2 * PI) / 3, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('R₆ maps to 60° rotation', () => {
    const phys = toPhysical(rimat(1, 1, -1, 0), hexVec)
    const expected = rotation(PI / 3, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('σ_hex maps to horizontal reflection (p3m1/p6m)', () => {
    const phys = toPhysical(rimat(-1, -1, 0, 1), hexVec)
    const expected = reflection(0, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('σ_ver maps to vertical reflection (p31m)', () => {
    const phys = toPhysical(rimat(1, 1, 0, -1), hexVec)
    const expected = reflection(PI / 2, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })
})

describe('toPhysical – rectangular lattice', () => {
  const rectVec = { x: 1.5, y: 0 }

  it('σ_a maps to vertical reflection', () => {
    const phys = toPhysical(rimat(1, 0, 0, -1), rectVec)
    const expected = reflection(PI / 2, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('σ_b maps to horizontal reflection', () => {
    const phys = toPhysical(rimat(-1, 0, 0, 1), rectVec)
    const expected = reflection(0, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('pg glide ∥ a maps to glide reflection', () => {
    const phys = toPhysical(rimat(1, 0, 0, -1, 1, 2), rectVec)
    const expected = glideReflection(PI / 2, 0.5, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })
})

// ───────────────────────────────────────────────────
//  quotientToPhysical
// ───────────────────────────────────────────────────

describe('quotientToPhysical', () => {
  it('converts p4m cosets to 8 physical isometries', () => {
    const { generators } = standardGenerators('p4m')
    const { cosets } = processGroup(generators)
    const sqVec = { x: 1, y: 0 }
    const physicals = quotientToPhysical(cosets, sqVec)
    expect(physicals.length).toBe(8)

    // Classify each: should get 1 identity, 2 rotations, ...
    // At minimum, check that all are valid isometries (det ≈ ±1)
    for (const p of physicals) {
      const det = p.a * p.d - p.b * p.c
      expect(Math.abs(Math.abs(det) - 1)).toBeLessThan(1e-9)
    }
  })

  it('converts p6m cosets to 12 physical isometries', () => {
    const { generators } = standardGenerators('p6m')
    const { cosets } = processGroup(generators)
    const hexVec = { x: s3h, y: 0.5 }
    const physicals = quotientToPhysical(cosets, hexVec)
    expect(physicals.length).toBe(12)
  })
})

// ───────────────────────────────────────────────────
//  generateElements
// ───────────────────────────────────────────────────

describe('generateElements', () => {
  const bounds = { minX: -3, maxX: 3, minY: -3, maxY: 3 }

  it('generates elements for p1 (translations only)', () => {
    const { generators } = standardGenerators('p1')
    const { cosets } = processGroup(generators)
    const sqVec = { x: 1, y: 0 }
    const elements = generateElements(cosets, sqVec, bounds)
    // Should generate lattice points within bounds
    expect(elements.length).toBeGreaterThan(0)
    // All elements should be translations (or identity)
    for (const el of elements) {
      const type = classify(el, 1e-7)
      expect(type === 'identity' || type === 'translation').toBe(true)
    }
  })

  it('generates elements for p4m', () => {
    const { generators } = standardGenerators('p4m')
    const { cosets } = processGroup(generators)
    const sqVec = { x: 1, y: 0 }
    const elements = generateElements(cosets, sqVec, bounds)
    // Should have rotations, reflections, glide reflections, and translations
    const types = new Set(elements.map(el => classify(el, 1e-7)))
    expect(types.has('rotation')).toBe(true)
    expect(types.has('reflection')).toBe(true)
  })

  it('generates more elements with larger bounds', () => {
    const { generators } = standardGenerators('p2')
    const { cosets } = processGroup(generators)
    const sqVec = { x: 1, y: 0 }
    const small = generateElements(cosets, sqVec, { minX: -1, maxX: 1, minY: -1, maxY: 1 })
    const large = generateElements(cosets, sqVec, { minX: -5, maxX: 5, minY: -5, maxY: 5 })
    expect(large.length).toBeGreaterThan(small.length)
  })
})

// ───────────────────────────────────────────────────
//  Consistency: rational vs existing presets
// ───────────────────────────────────────────────────

describe('rational generators match existing presets', () => {
  it('p4 preset matches rational R₄', () => {
    const phys = toPhysical(rimat(0, 1, -1, 0), { x: 1, y: 0 })
    const expected = rotation(PI / 2, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('p3 preset matches rational R₃', () => {
    const phys = toPhysical(rimat(0, 1, -1, -1), { x: s3h, y: 0.5 })
    const expected = rotation((2 * PI) / 3, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('p6 preset matches rational R₆', () => {
    const phys = toPhysical(rimat(1, 1, -1, 0), { x: s3h, y: 0.5 })
    const expected = rotation(PI / 3, 0, 0)
    expect(isometryEqual(phys, expected, 1e-9)).toBe(true)
  })

  it('p4g preset matches rational generators', () => {
    const sqVec = { x: 1, y: 0 }
    // Rotation
    const physRot = toPhysical(rimat(0, 1, -1, 0), sqVec)
    expect(isometryEqual(physRot, rotation(PI / 2, 0, 0), 1e-9)).toBe(true)
    // Reflection
    const physRefl = toPhysical(rimat(0, -1, -1, 0, 1, 2, 1, 2), sqVec)
    expect(isometryEqual(physRefl, reflection(-PI / 4, 1 / 4, 1 / 4), 1e-9)).toBe(true)
  })

  it('pgg preset matches rational generators', () => {
    const sqVec = { x: 1, y: 0 }
    const phys1 = toPhysical(rimat(-1, 0, 0, 1, 1, 2, 1, 2), sqVec)
    const phys2 = toPhysical(rimat(1, 0, 0, -1, 1, 2, 1, 2), sqVec)
    // Should be glide reflections
    expect(classify(phys1, 1e-7)).toBe('glide-reflection')
    expect(classify(phys2, 1e-7)).toBe('glide-reflection')
  })

  it('p3m1 preset matches rational generators', () => {
    const hexVec = { x: s3h, y: 0.5 }
    const physRot = toPhysical(rimat(0, 1, -1, -1), hexVec)
    const physRefl = toPhysical(rimat(-1, -1, 0, 1), hexVec)
    expect(isometryEqual(physRot, rotation((2 * PI) / 3, 0, 0), 1e-9)).toBe(true)
    expect(isometryEqual(physRefl, reflection(0, 0, 0), 1e-9)).toBe(true)
  })

  it('p31m preset matches rational generators', () => {
    const hexVec = { x: s3h, y: 0.5 }
    const physRot = toPhysical(rimat(0, 1, -1, -1), hexVec)
    const physRefl = toPhysical(rimat(1, 1, 0, -1), hexVec)
    expect(isometryEqual(physRot, rotation((2 * PI) / 3, 0, 0), 1e-9)).toBe(true)
    expect(isometryEqual(physRefl, reflection(PI / 2, 0, 0), 1e-9)).toBe(true)
  })
})

// ───────────────────────────────────────────────────
//  G/T cosets form a valid group
// ───────────────────────────────────────────────────

describe('G/T cosets form a group', () => {
  const types = ['p2', 'pm', 'pmm', 'pgg', 'cmm', 'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m']

  for (const typeName of types) {
    it(`${typeName}: cosets are closed under composition mod T`, () => {
      const { generators } = standardGenerators(typeName)
      const { cosets } = processGroup(generators)

      for (const a of cosets) {
        for (const b of cosets) {
          const product = rmodT(rcompose(a, b))
          const found = cosets.some(c => rmatEqual(c, product))
          expect(found).toBe(true)
        }
      }
    })
  }

  for (const typeName of types) {
    it(`${typeName}: every coset has an inverse in the set`, () => {
      const { generators } = standardGenerators(typeName)
      const { cosets } = processGroup(generators)

      for (const a of cosets) {
        const inv = rmodT(rinverse(a))
        const found = cosets.some(c => rmatEqual(c, inv))
        expect(found).toBe(true)
      }
    })
  }
})
