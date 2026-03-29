import { describe, it, expect } from 'vitest'
import {
  getViableSupergroups,
  getAllSupergroups,
  latticeSupportsGroupType,
  getPeerGenerators,
} from '../supergroups.js'

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

  it('returns correct supergroups for p2', () => {
    expect(getAllSupergroups('p2')).toEqual(['pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p6'])
  })

  it('returns correct supergroups for cm (includes pm peer)', () => {
    expect(getAllSupergroups('cm')).toEqual(['pm', 'cmm', 'p3m1', 'p31m'])
  })

  it('returns correct supergroups for pm (includes cm peer)', () => {
    expect(getAllSupergroups('pm')).toEqual(['pmm', 'pmg', 'cm', 'cmm', 'p4m'])
  })

  it('returns correct supergroups for p3m1 (includes p31m peer)', () => {
    expect(getAllSupergroups('p3m1')).toEqual(['p31m', 'p6m'])
  })

  it('returns correct supergroups for p31m (includes p3m1 peer)', () => {
    expect(getAllSupergroups('p31m')).toEqual(['p3m1', 'p6m'])
  })

  it('returns correct supergroups for pmm (includes cmm peer)', () => {
    expect(getAllSupergroups('pmm')).toEqual(['cmm', 'p4m'])
  })

  it('returns correct supergroups for cmm (includes pmm peer)', () => {
    expect(getAllSupergroups('cmm')).toEqual(['pmm', 'p4m'])
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
//  getViableSupergroups — lattice-filtered
// ───────────────────────────────────────────────────

describe('getViableSupergroups', () => {
  // p1 on oblique → only p2 (which has requirement 'any')
  it('p1 on oblique → only p2', () => {
    expect(getViableSupergroups('p1', 'oblique')).toEqual(['p2'])
  })

  // p1 on rectangular → p2, pm, pg, cm (cm via peer generators)
  it('p1 on rectangular → p2, pm, pg, cm', () => {
    expect(getViableSupergroups('p1', 'rectangular')).toEqual(['p2', 'pm', 'pg', 'cm'])
  })

  // p1 on centered-rectangular → p2, cm (not pm/pg/p4/p3/p6)
  it('p1 on centered-rectangular → p2, cm', () => {
    expect(getViableSupergroups('p1', 'centered-rectangular')).toEqual(['p2', 'cm'])
  })

  // p1 on square → p2, pm, pg, cm, p4 (not p3/p6)
  it('p1 on square → p2, pm, pg, cm, p4', () => {
    expect(getViableSupergroups('p1', 'square')).toEqual(['p2', 'pm', 'pg', 'cm', 'p4'])
  })

  // p1 on hexagonal → p2, cm, p3, p6 (not pm/pg/p4)
  it('p1 on hexagonal → p2, cm, p3, p6', () => {
    expect(getViableSupergroups('p1', 'hexagonal')).toEqual(['p2', 'cm', 'p3', 'p6'])
  })

  // cm on centered-rectangular → pm NOT viable (needs rectangular), cmm only
  it('cm on centered-rectangular → cmm', () => {
    expect(getViableSupergroups('cm', 'centered-rectangular')).toEqual(['cmm'])
  })

  // cm on hexagonal → cmm, p3m1, p31m (pm not viable, needs rectangular)
  it('cm on hexagonal → cmm, p3m1, p31m', () => {
    expect(getViableSupergroups('cm', 'hexagonal')).toEqual(['cmm', 'p3m1', 'p31m'])
  })

  // cm on square → pm, cmm (pm viable because square supports rectangular)
  it('cm on square → pm, cmm', () => {
    expect(getViableSupergroups('cm', 'square')).toEqual(['pm', 'cmm'])
  })

  // pm on rectangular → pmm, pmg, cm, cmm (cm and cmm via peer generators)
  it('pm on rectangular → pmm, pmg, cm, cmm', () => {
    expect(getViableSupergroups('pm', 'rectangular')).toEqual(['pmm', 'pmg', 'cm', 'cmm'])
  })

  // pm on square → pmm, pmg, cm, cmm, p4m (cm viable via both standard and peer)
  it('pm on square → pmm, pmg, cm, cmm, p4m', () => {
    expect(getViableSupergroups('pm', 'square')).toEqual(['pmm', 'pmg', 'cm', 'cmm', 'p4m'])
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

  // p2 on square → pmm, pmg, pgg, cmm, p4 (all rect/centered-rect/square compatible)
  it('p2 on square → pmm, pmg, pgg, cmm, p4', () => {
    expect(getViableSupergroups('p2', 'square')).toEqual(['pmm', 'pmg', 'pgg', 'cmm', 'p4'])
  })

  // p2 on hexagonal → cmm, p6 (pmm/pmg/pgg need rect, p4 needs square)
  it('p2 on hexagonal → cmm, p6', () => {
    expect(getViableSupergroups('p2', 'hexagonal')).toEqual(['cmm', 'p6'])
  })

  // pgg on rectangular → cmm is now viable via peer generators
  it('pgg on rectangular → cmm (via peer generators)', () => {
    expect(getViableSupergroups('pgg', 'rectangular')).toEqual(['cmm'])
  })

  // pgg on square → cmm and p4g (both viable)
  it('pgg on square → cmm, p4g', () => {
    expect(getViableSupergroups('pgg', 'square')).toEqual(['cmm', 'p4g'])
  })

  // pmm on rectangular → cmm (via peer generators), p4m needs square
  it('pmm on rectangular → cmm', () => {
    expect(getViableSupergroups('pmm', 'rectangular')).toEqual(['cmm'])
  })

  // pmm on square → cmm, p4m (both viable)
  it('pmm on square → cmm, p4m', () => {
    expect(getViableSupergroups('pmm', 'square')).toEqual(['cmm', 'p4m'])
  })

  // cmm on centered-rectangular → pmm NOT viable (no peer generators), p4m needs square
  it('cmm on centered-rectangular → empty', () => {
    expect(getViableSupergroups('cmm', 'centered-rectangular')).toEqual([])
  })

  // cmm on square → pmm (square supports rectangular), p4m
  it('cmm on square → pmm, p4m', () => {
    expect(getViableSupergroups('cmm', 'square')).toEqual(['pmm', 'p4m'])
  })

  // p3m1 on hexagonal → p31m and p6m (both hexagonal, both viable)
  it('p3m1 on hexagonal → p31m, p6m', () => {
    expect(getViableSupergroups('p3m1', 'hexagonal')).toEqual(['p31m', 'p6m'])
  })

  // p31m on hexagonal → p3m1 and p6m (both hexagonal, both viable)
  it('p31m on hexagonal → p3m1, p6m', () => {
    expect(getViableSupergroups('p31m', 'hexagonal')).toEqual(['p3m1', 'p6m'])
  })

  // p2 on rectangular → pmm, pmg, pgg (rect), cmm (peer generators)
  it('p2 on rectangular → pmm, pmg, pgg, cmm', () => {
    expect(getViableSupergroups('p2', 'rectangular')).toEqual(['pmm', 'pmg', 'pgg', 'cmm'])
  })

  // pmg on rectangular → cmm (via peer generators), p4g needs square
  it('pmg on rectangular → cmm', () => {
    expect(getViableSupergroups('pmg', 'rectangular')).toEqual(['cmm'])
  })
})

// ───────────────────────────────────────────────────
//  getPeerGenerators — alternative generators for peer transitions
// ───────────────────────────────────────────────────

describe('getPeerGenerators', () => {
  it('returns generators for cm on rectangular', () => {
    const gen = getPeerGenerators('cm', 'rectangular')
    expect(gen).not.toBeNull()
    expect(gen).toHaveLength(2) // σ_a + centering
  })

  it('returns generators for cmm on rectangular', () => {
    const gen = getPeerGenerators('cmm', 'rectangular')
    expect(gen).not.toBeNull()
    expect(gen).toHaveLength(3) // σ_a + σ_b + centering
  })

  it('returns null for cm on centered-rectangular (standard generators work)', () => {
    expect(getPeerGenerators('cm', 'centered-rectangular')).toBeNull()
  })

  it('returns null for pm on rectangular (standard generators work)', () => {
    expect(getPeerGenerators('pm', 'rectangular')).toBeNull()
  })

  it('returns null for pm on centered-rectangular (impossible)', () => {
    expect(getPeerGenerators('pm', 'centered-rectangular')).toBeNull()
  })

  it('returns null for p3m1 on hexagonal (standard generators work)', () => {
    expect(getPeerGenerators('p3m1', 'hexagonal')).toBeNull()
  })
})

// ───────────────────────────────────────────────────
//  Peer generators produce valid groups with processGroup
// ───────────────────────────────────────────────────

import { processGroup } from '../rationalGroup.js'

describe('peer generators produce valid groups', () => {
  it('cm-on-rectangular produces |G/T| = 4 (doubled cell)', () => {
    const gen = getPeerGenerators('cm', 'rectangular')
    const { cosets, isDegenerate, error } = processGroup(gen)
    expect(error).toBeFalsy()
    expect(isDegenerate).toBeFalsy()
    expect(cosets).toHaveLength(4)
  })

  it('cmm-on-rectangular produces |G/T| = 8 (doubled cell)', () => {
    const gen = getPeerGenerators('cmm', 'rectangular')
    const { cosets, isDegenerate, error } = processGroup(gen)
    expect(error).toBeFalsy()
    expect(isDegenerate).toBeFalsy()
    expect(cosets).toHaveLength(8)
  })
})
