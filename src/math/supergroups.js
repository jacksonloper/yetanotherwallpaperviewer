/**
 * Supergroup inclusion data for wallpaper groups.
 *
 * One-step supergroup inclusions: for each wallpaper type, which other
 * wallpaper types can be reached by adding a single new generator?
 *
 * Viability depends on the current lattice type because some supergroups
 * require a lattice specialization (e.g. square, hexagonal).
 */

// ───────────────────────────────────────────────────
//  One-step supergroup inclusion map (type-level)
// ───────────────────────────────────────────────────

const SUPERGROUP_MAP = {
  p1:   ['p2', 'pm', 'pg', 'cm', 'p4', 'p3', 'p6'],
  p2:   ['pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p6'],
  pm:   ['pmm', 'pmg', 'cmm', 'p4m'],
  pg:   ['pgg', 'pmg', 'p4g'],
  cm:   ['cmm', 'p3m1', 'p31m'],
  pmm:  ['p4m'],
  pmg:  ['p4g', 'cmm'],
  pgg:  ['cmm', 'p4g'],
  cmm:  ['p4m'],
  p4:   ['p4m', 'p4g'],
  p4m:  [],
  p4g:  [],
  p3:   ['p3m1', 'p31m', 'p6'],
  p3m1: ['p6m'],
  p31m: ['p6m'],
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
 * A supergroup is viable if the current lattice type is compatible with the
 * supergroup's lattice requirement (i.e. the standard generators for the
 * supergroup preserve the lattice metric).
 *
 * @param {string} groupName – IUCr short name (p1, pm, p4m, etc.)
 * @param {string} currentLatticeType – one of: oblique, rectangular, centered-rectangular, square, hexagonal
 * @returns {string[]}
 */
export function getViableSupergroups(groupName, currentLatticeType) {
  const allSupergroups = SUPERGROUP_MAP[groupName] || []
  return allSupergroups.filter(sg => {
    const req = GROUP_LATTICE_REQ[sg]
    return latticeSupportsGroupType(currentLatticeType, req)
  })
}
