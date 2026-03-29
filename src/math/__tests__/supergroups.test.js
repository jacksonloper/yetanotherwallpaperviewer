import { describe, it, expect } from 'vitest'
import {
  getViableSupergroups,
  getAllSupergroups,
  latticeSupportsGroupType,
  getExtraGenerators,
} from '../supergroups.js'
import { processGroup, standardGenerators } from '../rationalGroup.js'
import { rmatEqual, rmodT } from '../rational.js'

// ───────────────────────────────────────────────────
//  getAllSupergroups — type-level inclusion map
// ───────────────────────────────────────────────────

describe('getAllSupergroups', () => {
  it('returns correct supergroups for p1', () => {
    expect(getAllSupergroups('p1')).toEqual(['p2', 'pm', 'pg', 'cm', 'p4', 'p3', 'p6'])
  })

  it('returns empty for maximal groups', () => {
    expect(getAllSupergroups('p4m')).toEqual([])
    expect(getAllSupergroups('p4g')).toEqual([])
    expect(getAllSupergroups('p6m')).toEqual([])
  })

  it('returns correct supergroups for p2 (no pmg — R₂ not in pmg)', () => {
    expect(getAllSupergroups('p2')).toEqual(['pmm', 'pgg', 'cmm', 'p4', 'p6'])
  })

  it('returns correct supergroups for cm (no pm peer)', () => {
    expect(getAllSupergroups('cm')).toEqual(['cmm', 'p3m1', 'p31m'])
  })

  it('returns correct supergroups for pm (no cm/cmm peers)', () => {
    expect(getAllSupergroups('pm')).toEqual(['pmm', 'pmg', 'p4m'])
  })

  it('returns correct supergroups for p3m1 (no p31m peer)', () => {
    expect(getAllSupergroups('p3m1')).toEqual(['p6m'])
  })

  it('returns correct supergroups for p31m (no p3m1 peer)', () => {
    expect(getAllSupergroups('p31m')).toEqual(['p6m'])
  })

  it('returns correct supergroups for pmm (no cmm peer)', () => {
    expect(getAllSupergroups('pmm')).toEqual(['p4m'])
  })

  it('returns correct supergroups for cmm (no pmm peer)', () => {
    expect(getAllSupergroups('cmm')).toEqual(['p4m'])
  })

  it('returns correct supergroups for pg (only pmg)', () => {
    expect(getAllSupergroups('pg')).toEqual(['pmg'])
  })

  it('returns correct supergroups for pmg (no valid add-only transitions)', () => {
    expect(getAllSupergroups('pmg')).toEqual([])
  })

  it('returns correct supergroups for pgg', () => {
    expect(getAllSupergroups('pgg')).toEqual(['p4g'])
  })

  it('returns correct supergroups for p3', () => {
    expect(getAllSupergroups('p3')).toEqual(['p3m1', 'p31m', 'p6'])
  })

  it('returns empty for unknown group', () => {
    expect(getAllSupergroups('xyz')).toEqual([])
  })
})

// ───────────────────────────────────────────────────
//  latticeSupportsGroupType
// ───────────────────────────────────────────────────

describe('latticeSupportsGroupType', () => {
  it('any requirement is satisfied by all lattice types', () => {
    for (const lt of ['oblique', 'rectangular', 'centered-rectangular', 'square', 'hexagonal']) {
      expect(latticeSupportsGroupType(lt, 'any')).toBe(true)
    }
  })

  it('square lattice supports rectangular, centered-rectangular, and square', () => {
    expect(latticeSupportsGroupType('square', 'rectangular')).toBe(true)
    expect(latticeSupportsGroupType('square', 'centered-rectangular')).toBe(true)
    expect(latticeSupportsGroupType('square', 'square')).toBe(true)
    expect(latticeSupportsGroupType('square', 'hexagonal')).toBe(false)
  })

  it('hexagonal lattice supports centered-rectangular and hexagonal', () => {
    expect(latticeSupportsGroupType('hexagonal', 'centered-rectangular')).toBe(true)
    expect(latticeSupportsGroupType('hexagonal', 'hexagonal')).toBe(true)
    expect(latticeSupportsGroupType('hexagonal', 'rectangular')).toBe(false)
    expect(latticeSupportsGroupType('hexagonal', 'square')).toBe(false)
  })

  it('rectangular lattice only supports rectangular', () => {
    expect(latticeSupportsGroupType('rectangular', 'rectangular')).toBe(true)
    expect(latticeSupportsGroupType('rectangular', 'square')).toBe(false)
    expect(latticeSupportsGroupType('rectangular', 'centered-rectangular')).toBe(false)
  })

  it('centered-rectangular lattice only supports centered-rectangular', () => {
    expect(latticeSupportsGroupType('centered-rectangular', 'centered-rectangular')).toBe(true)
    expect(latticeSupportsGroupType('centered-rectangular', 'rectangular')).toBe(false)
    expect(latticeSupportsGroupType('centered-rectangular', 'hexagonal')).toBe(false)
  })

  it('oblique lattice supports nothing (except any)', () => {
    expect(latticeSupportsGroupType('oblique', 'rectangular')).toBe(false)
    expect(latticeSupportsGroupType('oblique', 'centered-rectangular')).toBe(false)
    expect(latticeSupportsGroupType('oblique', 'square')).toBe(false)
    expect(latticeSupportsGroupType('oblique', 'hexagonal')).toBe(false)
  })
})

// ───────────────────────────────────────────────────
//  getExtraGenerators — extra generators for transitions
// ───────────────────────────────────────────────────

describe('getExtraGenerators', () => {
  it('returns generators for all p1 transitions', () => {
    for (const target of ['p2', 'pm', 'pg', 'cm', 'p4', 'p3', 'p6']) {
      const extra = getExtraGenerators('p1', 0, target)
      expect(extra).not.toBeNull()
      expect(extra.length).toBeGreaterThan(0)
    }
  })

  it('returns generators for p2 → pmm', () => {
    expect(getExtraGenerators('p2', 0, 'pmm')).not.toBeNull()
  })

  it('returns null for invalid transitions', () => {
    expect(getExtraGenerators('p2', 0, 'pmg')).toBeNull()
    expect(getExtraGenerators('pg', 0, 'pgg')).toBeNull()
    expect(getExtraGenerators('pm', 0, 'cm')).toBeNull()
  })

  it('returns variant-specific generators for pm → pmm', () => {
    const extra0 = getExtraGenerators('pm', 0, 'pmm')
    const extra1 = getExtraGenerators('pm', 1, 'pmm')
    expect(extra0).not.toBeNull()
    expect(extra1).not.toBeNull()
    // Different extra generators for different variants
    expect(rmatEqual(rmodT(extra0[0]), rmodT(extra1[0]))).toBe(false)
  })

  it('cm variant 0 → p3m1 valid, variant 1 → p3m1 invalid', () => {
    expect(getExtraGenerators('cm', 0, 'p3m1')).not.toBeNull()
    expect(getExtraGenerators('cm', 1, 'p3m1')).toBeNull()
  })

  it('cm variant 0 → p31m invalid, variant 1 → p31m valid', () => {
    expect(getExtraGenerators('cm', 0, 'p31m')).toBeNull()
    expect(getExtraGenerators('cm', 1, 'p31m')).not.toBeNull()
  })

  it('cm both variants → cmm valid', () => {
    expect(getExtraGenerators('cm', 0, 'cmm')).not.toBeNull()
    expect(getExtraGenerators('cm', 1, 'cmm')).not.toBeNull()
  })
})

// ───────────────────────────────────────────────────
//  getViableSupergroups — lattice & variant filtered
// ───────────────────────────────────────────────────

describe('getViableSupergroups', () => {
  // p1 on oblique → only p2 (which has requirement 'any')
  it('p1 on oblique → only p2', () => {
    expect(getViableSupergroups('p1', 'oblique')).toEqual(['p2'])
  })

  // p1 on rectangular → p2, pm, pg (cm needs centered-rectangular)
  it('p1 on rectangular → p2, pm, pg', () => {
    expect(getViableSupergroups('p1', 'rectangular')).toEqual(['p2', 'pm', 'pg'])
  })

  // p1 on centered-rectangular → p2, cm
  it('p1 on centered-rectangular → p2, cm', () => {
    expect(getViableSupergroups('p1', 'centered-rectangular')).toEqual(['p2', 'cm'])
  })

  // p1 on square → p2, pm, pg, cm, p4
  it('p1 on square → p2, pm, pg, cm, p4', () => {
    expect(getViableSupergroups('p1', 'square')).toEqual(['p2', 'pm', 'pg', 'cm', 'p4'])
  })

  // p1 on hexagonal → p2, cm, p3, p6
  it('p1 on hexagonal → p2, cm, p3, p6', () => {
    expect(getViableSupergroups('p1', 'hexagonal')).toEqual(['p2', 'cm', 'p3', 'p6'])
  })

  // cm on centered-rectangular → cmm only (p3m1/p31m need hex)
  it('cm var 0 on centered-rectangular → cmm', () => {
    expect(getViableSupergroups('cm', 'centered-rectangular', 0)).toEqual(['cmm'])
  })

  // cm variant 0 on hexagonal → cmm, p3m1 (not p31m — invalid for var 0)
  it('cm var 0 on hexagonal → cmm, p3m1', () => {
    expect(getViableSupergroups('cm', 'hexagonal', 0)).toEqual(['cmm', 'p3m1'])
  })

  // cm variant 1 on hexagonal → cmm, p31m (not p3m1 — invalid for var 1)
  it('cm var 1 on hexagonal → cmm, p31m', () => {
    expect(getViableSupergroups('cm', 'hexagonal', 1)).toEqual(['cmm', 'p31m'])
  })

  // pm on rectangular → pmm, pmg
  it('pm on rectangular → pmm, pmg', () => {
    expect(getViableSupergroups('pm', 'rectangular')).toEqual(['pmm', 'pmg'])
  })

  // pm on square → pmm, pmg, p4m
  it('pm on square → pmm, pmg, p4m', () => {
    expect(getViableSupergroups('pm', 'square')).toEqual(['pmm', 'pmg', 'p4m'])
  })

  // pg on rectangular → pmg
  it('pg on rectangular → pmg', () => {
    expect(getViableSupergroups('pg', 'rectangular')).toEqual(['pmg'])
  })

  // p4 on square → p4m, p4g
  it('p4 on square → p4m, p4g', () => {
    expect(getViableSupergroups('p4', 'square')).toEqual(['p4m', 'p4g'])
  })

  // Maximal groups have no supergroups
  it('p4m on square → empty', () => {
    expect(getViableSupergroups('p4m', 'square')).toEqual([])
  })

  it('p6m on hexagonal → empty', () => {
    expect(getViableSupergroups('p6m', 'hexagonal')).toEqual([])
  })

  // p2 on square → pmm, pgg, cmm, p4
  it('p2 on square → pmm, pgg, cmm, p4', () => {
    expect(getViableSupergroups('p2', 'square')).toEqual(['pmm', 'pgg', 'cmm', 'p4'])
  })

  // p2 on hexagonal → cmm, p6
  it('p2 on hexagonal → cmm, p6', () => {
    expect(getViableSupergroups('p2', 'hexagonal')).toEqual(['cmm', 'p6'])
  })

  // p2 on rectangular → pmm, pgg
  it('p2 on rectangular → pmm, pgg', () => {
    expect(getViableSupergroups('p2', 'rectangular')).toEqual(['pmm', 'pgg'])
  })

  // pgg on rectangular → empty (p4g needs square)
  it('pgg on rectangular → empty', () => {
    expect(getViableSupergroups('pgg', 'rectangular')).toEqual([])
  })

  // pgg on square → p4g
  it('pgg on square → p4g', () => {
    expect(getViableSupergroups('pgg', 'square')).toEqual(['p4g'])
  })

  // pmm on rectangular → empty (p4m needs square)
  it('pmm on rectangular → empty', () => {
    expect(getViableSupergroups('pmm', 'rectangular')).toEqual([])
  })

  // pmm on square → p4m
  it('pmm on square → p4m', () => {
    expect(getViableSupergroups('pmm', 'square')).toEqual(['p4m'])
  })

  // cmm on centered-rectangular → empty (p4m needs square)
  it('cmm on centered-rectangular → empty', () => {
    expect(getViableSupergroups('cmm', 'centered-rectangular')).toEqual([])
  })

  // cmm on square → p4m
  it('cmm on square → p4m', () => {
    expect(getViableSupergroups('cmm', 'square')).toEqual(['p4m'])
  })

  // p3m1 on hexagonal → p6m
  it('p3m1 on hexagonal → p6m', () => {
    expect(getViableSupergroups('p3m1', 'hexagonal')).toEqual(['p6m'])
  })

  // p31m on hexagonal → p6m
  it('p31m on hexagonal → p6m', () => {
    expect(getViableSupergroups('p31m', 'hexagonal')).toEqual(['p6m'])
  })

  // pmg on rectangular → empty (no valid transitions)
  it('pmg on rectangular → empty', () => {
    expect(getViableSupergroups('pmg', 'rectangular')).toEqual([])
  })
})

// ───────────────────────────────────────────────────
//  Extra generators produce correct supergroups
// ───────────────────────────────────────────────────
//
// For every valid transition, verify that combining the source group's
// current generators with the extra generators produces a finite,
// non-degenerate group of the expected order.

describe('extra generators produce correct supergroups', () => {
  // Expected |G/T| for target groups
  const TARGET_ORDERS = {
    p1: 1, p2: 2, pm: 2, pg: 2, cm: 2,
    pmm: 4, pmg: 4, pgg: 4, cmm: 4, p4: 4,
    p4m: 8, p4g: 8,
    p3: 3, p3m1: 6, p31m: 6, p6: 6, p6m: 12,
  }

  // All valid transitions to test
  const transitions = [
    // p1 → (all variant 0)
    ['p1', 0, 'p2'], ['p1', 0, 'pm'], ['p1', 0, 'pg'],
    ['p1', 0, 'cm'], ['p1', 0, 'p4'], ['p1', 0, 'p3'], ['p1', 0, 'p6'],
    // p2
    ['p2', 0, 'pmm'], ['p2', 0, 'pgg'], ['p2', 0, 'cmm'],
    ['p2', 0, 'p4'], ['p2', 0, 'p6'],
    // pm variants
    ['pm', 0, 'pmm'], ['pm', 1, 'pmm'],
    ['pm', 0, 'pmg'], ['pm', 1, 'pmg'],
    ['pm', 0, 'p4m'], ['pm', 1, 'p4m'],
    // pg variants
    ['pg', 0, 'pmg'], ['pg', 1, 'pmg'],
    // cm variants
    ['cm', 0, 'cmm'], ['cm', 1, 'cmm'],
    ['cm', 0, 'p3m1'], ['cm', 1, 'p31m'],
    // pmm, pgg, cmm
    ['pmm', 0, 'p4m'], ['pgg', 0, 'p4g'], ['cmm', 0, 'p4m'],
    // p4
    ['p4', 0, 'p4m'], ['p4', 0, 'p4g'],
    // p3
    ['p3', 0, 'p3m1'], ['p3', 0, 'p31m'], ['p3', 0, 'p6'],
    // p3m1, p31m, p6
    ['p3m1', 0, 'p6m'], ['p31m', 0, 'p6m'], ['p6', 0, 'p6m'],
  ]

  for (const [src, variant, target] of transitions) {
    it(`${src} var ${variant} + extra → ${target} (|G/T| = ${TARGET_ORDERS[target]})`, () => {
      const extra = getExtraGenerators(src, variant, target)
      expect(extra).not.toBeNull()

      const currentGens = standardGenerators(src, variant)?.generators ?? []
      const allGens = [...currentGens, ...extra]
      const { cosets, isDegenerate, error, order } = processGroup(allGens)

      expect(error).toBeFalsy()
      expect(isDegenerate).toBe(false)
      expect(order).toBe(TARGET_ORDERS[target])
    })
  }
})

// ───────────────────────────────────────────────────
//  Supergroup inclusion: source generators preserved
// ───────────────────────────────────────────────────
//
// For every valid transition, verify that each coset representative
// of the source group appears in the supergroup's coset list.
// This is the core invariant: adding generators never removes old ones.

describe('source generators are preserved in supergroup', () => {
  const transitions = [
    ['pm', 0, 'pmm'], ['pm', 1, 'pmm'],
    ['pm', 0, 'pmg'], ['pm', 1, 'pmg'],
    ['pg', 0, 'pmg'], ['pg', 1, 'pmg'],
    ['cm', 0, 'cmm'], ['cm', 1, 'cmm'],
    ['cm', 0, 'p3m1'], ['cm', 1, 'p31m'],
    ['p2', 0, 'pmm'], ['p2', 0, 'pgg'], ['p2', 0, 'cmm'],
    ['p4', 0, 'p4m'], ['p4', 0, 'p4g'],
    ['p3', 0, 'p3m1'], ['p3', 0, 'p31m'], ['p3', 0, 'p6'],
    ['p3m1', 0, 'p6m'], ['p31m', 0, 'p6m'],
    ['p6', 0, 'p6m'],
  ]

  for (const [src, variant, target] of transitions) {
    it(`${src} var ${variant} ⊂ ${target}: all source cosets in supergroup`, () => {
      // Compute source G/T
      const srcGens = standardGenerators(src, variant)?.generators ?? []
      const srcResult = processGroup(srcGens)
      expect(srcResult.error).toBeFalsy()

      // Compute supergroup G/T
      const extra = getExtraGenerators(src, variant, target)
      const allGens = [...srcGens, ...extra]
      const sgResult = processGroup(allGens)
      expect(sgResult.error).toBeFalsy()

      // Every source coset must appear in the supergroup
      for (const srcCoset of srcResult.cosets) {
        const found = sgResult.cosets.some(sgCoset => rmatEqual(srcCoset, sgCoset))
        expect(found).toBe(true)
      }
    })
  }
})
