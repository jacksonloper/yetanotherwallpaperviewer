/**
 * Supergroup inclusion data for wallpaper groups.
 *
 * One-step supergroup inclusions: for each wallpaper type, which other
 * wallpaper types can be reached by adding a single new generator?
 *
 * Viability depends on the current lattice type because some supergroups
 * require a lattice specialization (e.g. square, hexagonal).
 *
 * Peer transitions (pm↔cm, pmm↔cmm, p3m1↔p31m) are same-order groups
 * related by switching generators.  Some peer transitions require
 * alternative generators that use a doubled conventional cell (e.g.
 * cm-on-rectangular uses axial mirror + centering translation).
 */

import { rimat } from './rational.js'

// ───────────────────────────────────────────────────
//  One-step supergroup inclusion map (type-level)
// ───────────────────────────────────────────────────

const SUPERGROUP_MAP = {
  p1:   ['p2', 'pm', 'pg', 'cm', 'p4', 'p3', 'p6'],
  p2:   ['pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p6'],
  pm:   ['pmm', 'pmg', 'cm', 'cmm', 'p4m'],
  pg:   ['pgg', 'pmg', 'p4g'],
  cm:   ['pm', 'cmm', 'p3m1', 'p31m'],
  pmm:  ['cmm', 'p4m'],
  pmg:  ['p4g', 'cmm'],
  pgg:  ['cmm', 'p4g'],
  cmm:  ['pmm', 'p4m'],
  p4:   ['p4m', 'p4g'],
  p4m:  [],
  p4g:  [],
  p3:   ['p3m1', 'p31m', 'p6'],
  p3m1: ['p31m', 'p6m'],
  p31m: ['p3m1', 'p6m'],
  p6:   ['p6m'],
  p6m:  [],
}

// ───────────────────────────────────────────────────
//  Lattice requirement per group type
// ───────────────────────────────────────────────────
//
// Each group type's standard generators assume a particular lattice
// coordinate system.  The requirement string indicates which Bravais
// lattice types the generators are valid on.

const GROUP_LATTICE_REQ = {
  p1: 'any', p2: 'any',
  pm: 'rectangular', pg: 'rectangular',
  pmm: 'rectangular', pmg: 'rectangular', pgg: 'rectangular',
  cm: 'centered-rectangular', cmm: 'centered-rectangular',
  p4: 'square', p4m: 'square', p4g: 'square',
  p3: 'hexagonal', p3m1: 'hexagonal', p31m: 'hexagonal',
  p6: 'hexagonal', p6m: 'hexagonal',
}

// ───────────────────────────────────────────────────
//  Lattice compatibility check
// ───────────────────────────────────────────────────

/**
 * Check whether a current lattice type supports a group whose standard
 * generators require `requiredLatticeType`.
 *
 * Lattice specialization hierarchy:
 *   square         ⊃ rectangular, centered-rectangular
 *   hexagonal      ⊃ centered-rectangular
 *   rectangular    (no further specialization)
 *   centered-rect  (no further specialization)
 *   oblique        (most general, only supports 'any')
 *
 * @param {string} currentLatticeType – one of: oblique, rectangular, centered-rectangular, square, hexagonal
 * @param {string} requiredLatticeType – one of: any, rectangular, centered-rectangular, square, hexagonal
 * @returns {boolean}
 */
export function latticeSupportsGroupType(currentLatticeType, requiredLatticeType) {
  if (requiredLatticeType === 'any') return true

  switch (currentLatticeType) {
    case 'square':
      // Square is both rectangular and centered-rectangular
      return requiredLatticeType === 'square' ||
             requiredLatticeType === 'rectangular' ||
             requiredLatticeType === 'centered-rectangular'
    case 'hexagonal':
      // Hexagonal is a special case of centered-rectangular
      return requiredLatticeType === 'hexagonal' ||
             requiredLatticeType === 'centered-rectangular'
    case 'rectangular':
      return requiredLatticeType === 'rectangular'
    case 'centered-rectangular':
      return requiredLatticeType === 'centered-rectangular'
    case 'oblique':
      return false  // oblique only supports 'any', already handled above
    default:
      return false
  }
}

// ───────────────────────────────────────────────────
//  Peer transition generators (doubled conventional cell)
// ───────────────────────────────────────────────────
//
// For certain peer transitions (pm↔cm, pmm↔cmm), the target group's
// standard generators don't preserve the source lattice's metric.
// These alternative generators produce the correct symmetry using a
// doubled conventional cell (|G/T| is doubled).
//
// Key idea: cm on a rectangular lattice uses an axial mirror (which
// preserves the rectangular metric) plus a centering translation
// (1/2, 1/2) that introduces the half-lattice shift characteristic of
// the centered groups.

const PEER_GENERATORS = {
  // cm on rectangular: σ_a + centering → |G/T| = 4
  'cm:rectangular': [
    rimat(1, 0, 0, -1),              // σ_a = [[1,0],[0,-1]]
    rimat(1, 0, 0, 1, 1, 2, 1, 2),   // identity + (1/2, 1/2)
  ],
  // cmm on rectangular: σ_a + σ_b + centering → |G/T| = 8
  'cmm:rectangular': [
    rimat(1, 0, 0, -1),              // σ_a = [[1,0],[0,-1]]
    rimat(-1, 0, 0, 1),              // σ_b = [[-1,0],[0,1]]
    rimat(1, 0, 0, 1, 1, 2, 1, 2),   // identity + (1/2, 1/2)
  ],
}

/**
 * Get alternative generators for a peer transition.
 *
 * Returns an array of rational affine matrices if alternative generators
 * exist for displaying `targetGroup` on `currentLatticeType`, or null
 * if the standard generators should be used.
 *
 * @param {string} targetGroup – IUCr short name of the target group
 * @param {string} currentLatticeType – current Bravais lattice type
 * @returns {rmat[]|null}
 */
export function getPeerGenerators(targetGroup, currentLatticeType) {
  const key = `${targetGroup}:${currentLatticeType}`
  return PEER_GENERATORS[key] || null
}

// ───────────────────────────────────────────────────
//  Public API
// ───────────────────────────────────────────────────

/**
 * Get the list of all one-step supergroups for a given wallpaper type.
 * These are type-level inclusions (may not all be viable with the current lattice).
 *
 * @param {string} groupName – IUCr short name (p1, pm, p4m, etc.)
 * @returns {string[]}
 */
export function getAllSupergroups(groupName) {
  return SUPERGROUP_MAP[groupName] || []
}

/**
 * Get the viable one-step supergroups for a wallpaper type on a given lattice.
 *
 * A supergroup is viable if either:
 *   1. The current lattice type is compatible with the supergroup's
 *      standard generators (lattice hierarchy check), OR
 *   2. Alternative peer generators exist for the supergroup on the
 *      current lattice type (doubled conventional cell).
 *
 * @param {string} groupName – IUCr short name (p1, pm, p4m, etc.)
 * @param {string} currentLatticeType – one of: oblique, rectangular, centered-rectangular, square, hexagonal
 * @returns {string[]}
 */
export function getViableSupergroups(groupName, currentLatticeType) {
  const allSupergroups = SUPERGROUP_MAP[groupName] || []
  return allSupergroups.filter(sg => {
    const req = GROUP_LATTICE_REQ[sg]
    if (latticeSupportsGroupType(currentLatticeType, req)) return true
    // Check if peer generators exist for this transition
    return getPeerGenerators(sg, currentLatticeType) !== null
  })
}
