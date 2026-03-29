import { describe, it, expect } from 'vitest'
import {
  getViableSupergroups,
  getAllSupergroups,
  latticeSupportsGroupType,
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

  it('returns correct supergroups for cm', () => {
    expect(getAllSupergroups('cm')).toEqual(['cmm', 'p3m1', 'p31m'])
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

  // p1 on rectangular → p2, pm, pg (not cm/p4/p3/p6)
  it('p1 on rectangular → p2, pm, pg', () => {
    expect(getViableSupergroups('p1', 'rectangular')).toEqual(['p2', 'pm', 'pg'])
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

  // cm on centered-rectangular → cmm only (not p3m1/p31m which need hex)
  it('cm on centered-rectangular → cmm', () => {
    expect(getViableSupergroups('cm', 'centered-rectangular')).toEqual(['cmm'])
  })

  // cm on hexagonal → cmm, p3m1, p31m (all viable)
  it('cm on hexagonal → cmm, p3m1, p31m', () => {
    expect(getViableSupergroups('cm', 'hexagonal')).toEqual(['cmm', 'p3m1', 'p31m'])
  })

  // pm on rectangular → pmm, pmg (not cmm/p4m which need different lattice)
  it('pm on rectangular → pmm, pmg', () => {
    expect(getViableSupergroups('pm', 'rectangular')).toEqual(['pmm', 'pmg'])
  })

  // pm on square → pmm, pmg, cmm, p4m (all viable)
  it('pm on square → pmm, pmg, cmm, p4m', () => {
    expect(getViableSupergroups('pm', 'square')).toEqual(['pmm', 'pmg', 'cmm', 'p4m'])
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

  // pgg on rectangular → cmm is NOT viable (needs centered-rectangular)
  it('pgg on rectangular → empty (cmm needs centered-rect, p4g needs square)', () => {
    expect(getViableSupergroups('pgg', 'rectangular')).toEqual([])
  })

  // pgg on square → cmm and p4g (both viable)
  it('pgg on square → cmm, p4g', () => {
    expect(getViableSupergroups('pgg', 'square')).toEqual(['cmm', 'p4g'])
  })
})
