/**
 * Supergroup inclusion data for wallpaper groups.
 *
 * Principle: when a supergroup is previewed, extra generator(s) are ADDED
 * to the current group's generators.  No existing generator is ever
 * removed.  This ensures the supergroup buttons always produce a proper
 * supergroup of the current group.
 *
 * Two kinds of transitions:
 *   1. Cross-type: add a rotation/reflection generator to reach a group
 *      with a larger point group (e.g. p1→p2 adds R₂).
 *   2. Same-type: add a fractional translation to reach a denser copy
 *      of the same wallpaper type (e.g. p1→p1 adds t_(1/2,0), giving
 *      a p1 supergroup with twice the translation density).
 *
 * Cross-type transitions were verified by checking that every
 * coset representative of the source group (with its standard generators
 * for the current variant) appears in the target group's G/T.  Transitions
 * where this fails (e.g. p2→pmg, pg→pgg) are excluded.
 *
 * Same-type transitions add a centering translation that is invariant
 * (mod Z²) under the point group, producing a valid supergroup of the
 * same abstract type on a finer translation lattice.  The resulting
 * |G/T| = (standard order) × (sublattice index).
 *
 * Viability depends on lattice type (some targets need square/hexagonal)
 * and on variant index (e.g. cm variant 0 → p3m1 but not p31m).
 */

import { rimat } from './rational.js'

// ───────────────────────────────────────────────────
//  Lattice shape helpers
// ───────────────────────────────────────────────────

/**
 * Check whether a lattice vector represents a not-well-rounded
 * centered-rectangular lattice (y ≈ 0.5, |b| > 1).
 *
 * On such lattices the cm mirror directions are along a and 2b−a
 * (physical vertical and horizontal), NOT along a+b and b−a.
 * The lattice-coordinate reflection matrices are different:
 *   σ_v = [[1,1],[0,−1]]   (along a, vertical)
 *   σ_h = [[−1,−1],[0,1]]  (along 2b−a, horizontal)
 * instead of the well-rounded
 *   σ+  = [[0,1],[1,0]]    (along a+b)
 *   σ−  = [[0,−1],[−1,0]]  (along b−a)
 */
function isNotWellRoundedCenteredRect(latticeVec) {
  if (!latticeVec) return false
  const { x, y } = latticeVec
  const r2 = x * x + y * y
  return Math.abs(y - 0.5) < 1e-4 && r2 > 1 + 1e-4
}

// ───────────────────────────────────────────────────
//  One-step supergroup inclusion map (type-level)
// ───────────────────────────────────────────────────
//
// Cross-type transitions: adding generators without removing any.
// Same-type transitions: adding a centering translation for a finer lattice.
//
// Excluded cross-type transitions (source gens don't embed in target G/T):
//   p2→pmg:      R₂(0,0) ∉ pmg (pmg has R₂ at (1/2,0))
//   pg→pgg:      pg's glide ∉ pgg (different translation offset)
//   pg→p4g:      pg's glide ∉ p4g (same issue)
//   pmg→p4g:     pmg's R₂ ∉ p4g
//   pm→cmm:      σ_a/σ_b ∉ cmm (different reflection axes)
//   pmg→cmm:     incompatible rotation centers
//   pgg→cmm:     incompatible reflection axes
//
// Peer transitions (same order, different mirror type) via centering:
//   pm↔cm:       add t_(1/2,1/2) on square lattice → |G/T| doubles
//   pmm↔cmm:     add t_(1/2,1/2) on square lattice → |G/T| doubles
//   p3m1↔p31m:   add t_(1/3,1/3) on hexagonal lattice → |G/T| triples
//   In each case the centering translation is invariant (as a set) under the
//   source point group, so the result is a valid supergroup.  Viewed in the
//   natural basis for the finer lattice, the mirror becomes the peer type
//   (e.g. σ+ becomes σ_a in centered coords, making cm look like pm).
//
// Excluded same-type transitions (|G/T| exceeds maxOrder=24):
//   p4g→p4g:     index 9 → |G/T| = 72
//   p6m→p6m:     index 3 → |G/T| = 36

const SUPERGROUP_MAP = {
  p1:   ['p1', 'p2', 'pm', 'pg', 'cm', 'p4', 'p3', 'p6'],
  p2:   ['p2', 'pmm', 'pgg', 'cmm', 'p4', 'p6'],
  pm:   ['pm', 'cm', 'pmm', 'pmg', 'p4m'],
  pg:   ['pg', 'pmg'],
  cm:   ['cm', 'pm', 'cmm', 'p3m1', 'p31m'],
  pmm:  ['pmm', 'cmm', 'p4m'],
  pmg:  ['pmg'],
  pgg:  ['pgg', 'p4g'],
  cmm:  ['cmm', 'pmm', 'p4m'],
  p4:   ['p4', 'p4m', 'p4g'],
  p4m:  ['p4m'],
  p4g:  [],
  p3:   ['p3', 'p3m1', 'p31m', 'p6'],
  p3m1: ['p3m1', 'p31m', 'p6m'],
  p31m: ['p31m', 'p3m1', 'p6m'],
  p6:   ['p6', 'p6m'],
  p6m:  [],
}

// ───────────────────────────────────────────────────
//  Lattice requirement per group type
// ───────────────────────────────────────────────────

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
//  Extra generators for each supergroup transition
// ───────────────────────────────────────────────────
//
// For each source→target pair, defines what generator(s) to ADD to the
// source group's existing generators to obtain the target supergroup.
//
// Format:
//   { generators: [...] }         – variant-independent (same extra for all variants)
//   { variants: [[...], [...]] }  – variant-dependent (per-variant extras; null = invalid)
//
// Key linear parts (in lattice coords):
//   R₂  = [[-1,0],[0,-1]]     180° rotation
//   R₃  = [[0,1],[-1,-1]]     120° rotation   (hex)
//   R₄  = [[0,1],[-1,0]]      90° rotation    (square)
//   R₆  = [[1,1],[-1,0]]      60° rotation    (hex)
//   σ_a = [[1,0],[0,-1]]      reflection fixing e₁
//   σ_b = [[-1,0],[0,1]]      reflection fixing e₂
//   σ+  = [[0,1],[1,0]]       swap e₁↔e₂  (along a+b)
//   σ−  = [[0,-1],[-1,0]]     swap & negate (along b−a)
//   σ_h = [[-1,-1],[0,1]]     p3m1/p6m reflection
//   σ_v = [[1,1],[0,-1]]      p31m reflection

const EXTRA_GENERATORS = {
  // ═══════════════════════════════════════════════════
  //  Same-type transitions (centering translations)
  // ═══════════════════════════════════════════════════
  //
  // Add a fractional translation invariant under the point group
  // to reach a denser copy of the same wallpaper type.
  // Resulting |G/T| = (standard order) × (sublattice index).

  // ── same-type: index 2 (any/rectangular lattice) ──
  'p1:p1':   { generators: [rimat(1, 0, 0, 1, 1, 2)] },          // t_(1/2,0)  |G/T|=2
  'p2:p2':   { generators: [rimat(1, 0, 0, 1, 1, 2)] },          // t_(1/2,0)  |G/T|=4
  'pm:pm':   { variants: [
    [rimat(1, 0, 0, 1, 0, 1, 1, 2)],  // var 0 (σ_a): t_(0,1/2) |G/T|=4
    [rimat(1, 0, 0, 1, 1, 2)],         // var 1 (σ_b): t_(1/2,0) |G/T|=4
  ]},
  'pg:pg':   { variants: [
    [rimat(1, 0, 0, 1, 0, 1, 1, 2)],  // var 0 (glide_a): t_(0,1/2) |G/T|=4
    [rimat(1, 0, 0, 1, 1, 2)],         // var 1 (glide_b): t_(1/2,0) |G/T|=4
  ]},
  'pmm:pmm': { generators: [rimat(1, 0, 0, 1, 1, 2)] },          // t_(1/2,0)  |G/T|=8

  // ── same-type: index 3 (rectangular/centered-rectangular) ──
  'pgg:pgg': { generators: [rimat(1, 0, 0, 1, 1, 3)] },          // t_(1/3,0)  |G/T|=12
  'pmg:pmg': { variants: [
    [rimat(1, 0, 0, 1, 1, 3)],         // var 0: t_(1/3,0) |G/T|=12
    [rimat(1, 0, 0, 1, 0, 1, 1, 3)],   // var 1: t_(0,1/3) |G/T|=12
  ]},
  'cm:cm':   { generators: [rimat(1, 0, 0, 1, 1, 3, 1, 3)] },    // t_(1/3,1/3) |G/T|=6
  'cmm:cmm': { generators: [rimat(1, 0, 0, 1, 1, 3, 1, 3)] },    // t_(1/3,1/3) |G/T|=12

  // ── same-type: square lattice (index 2 with diagonal centering) ──
  'p4:p4':   { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=8
  'p4m:p4m': { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=16

  // ── same-type: hexagonal lattice ──
  'p3:p3':     { generators: [rimat(1, 0, 0, 1, 1, 3, 1, 3)] },  // t_(1/3,1/3) |G/T|=9
  'p3m1:p3m1': { generators: [rimat(1, 0, 0, 1, 1, 2)] },        // t_(1/2,0)   |G/T|=24
  'p31m:p31m': { generators: [rimat(1, 0, 0, 1, 1, 2)] },        // t_(1/2,0)   |G/T|=24
  'p6:p6':     { generators: [rimat(1, 0, 0, 1, 1, 2)] },        // t_(1/2,0)   |G/T|=24

  // ═══════════════════════════════════════════════════
  //  Peer transitions (centering translations)
  // ═══════════════════════════════════════════════════
  //
  // On a square lattice, pm and cm are "peers": same |G/T| but different
  // mirror types (axial vs diagonal).  Adding t_(1/2,1/2) doubles the
  // coset count.  In the natural basis for the centered sublattice the
  // mirror switches type (σ+ ↔ σ_a), so the supergroup is abstractly
  // the peer type on a finer lattice.  Likewise for pmm↔cmm.
  //
  // On a hexagonal lattice, p3m1 and p31m are peers.  Adding t_(1/3,1/3)
  // triples |G/T|; in the index-3 sublattice basis the mirror switches
  // between σ_h and σ_v.

  // ── pm ↔ cm (square lattice, t_(1/2,1/2)) ──
  'pm:cm':   { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=4
  'cm:pm':   { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=4

  // ── pmm ↔ cmm (square lattice, t_(1/2,1/2)) ──
  'pmm:cmm': { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=8
  'cmm:pmm': { generators: [rimat(1, 0, 0, 1, 1, 2, 1, 2)] },    // t_(1/2,1/2) |G/T|=8

  // ── p3m1 ↔ p31m (hexagonal lattice, t_(1/3,1/3)) ──
  'p3m1:p31m': { generators: [rimat(1, 0, 0, 1, 1, 3, 1, 3)] },  // t_(1/3,1/3) |G/T|=18
  'p31m:p3m1': { generators: [rimat(1, 0, 0, 1, 1, 3, 1, 3)] },  // t_(1/3,1/3) |G/T|=18

  // ═══════════════════════════════════════════════════
  //  Cross-type transitions (add rotation/reflection)
  // ═══════════════════════════════════════════════════

  // ── p1 → ... (no variants, no existing generators) ──
  'p1:p2':  { generators: [rimat(-1, 0, 0, -1)] },              // R₂
  'p1:pm':  { generators: [rimat(1, 0, 0, -1)] },               // σ_a
  'p1:pg':  { generators: [rimat(1, 0, 0, -1, 1, 2)] },         // glide_a = σ_a+(1/2,0)
  'p1:cm':  { generators: [rimat(0, 1, 1, 0)],                // σ+  (well-rounded)
              nwrGenerators: [rimat(1, 1, 0, -1)] },           // σ_v (not-well-rounded centered rect)
  'p1:p4':  { generators: [rimat(0, 1, -1, 0)] },               // R₄
  'p1:p3':  { generators: [rimat(0, 1, -1, -1)] },              // R₃
  'p1:p6':  { generators: [rimat(1, 1, -1, 0)] },               // R₆

  // ── p2 → ... (no variants) ──
  'p2:pmm': { generators: [rimat(1, 0, 0, -1)] },               // σ_a  (R₂∘σ_a = σ_b)
  'p2:pgg': { generators: [rimat(1, 0, 0, -1, 1, 2, 1, 2)] },   // σ_a+(1/2,1/2)
  'p2:cmm': { generators: [rimat(0, 1, 1, 0)],                // σ+  (R₂∘σ+ = σ-) (well-rounded)
              nwrGenerators: [rimat(1, 1, 0, -1)] },           // σ_v (R₂∘σ_v = σ_h) (not-well-rounded centered rect)
  'p2:p4':  { generators: [rimat(0, 1, -1, 0)] },               // R₄
  'p2:p6':  { generators: [rimat(1, 1, -1, 0)] },               // R₆

  // ── pm → ... (2 variants: var 0 = σ_a, var 1 = σ_b) ──
  'pm:pmm': { variants: [
    [rimat(-1, 0, 0, 1)],                // var 0 (σ_a): add σ_b
    [rimat(1, 0, 0, -1)],                // var 1 (σ_b): add σ_a
  ]},
  'pm:pmg': { variants: [
    [rimat(-1, 0, 0, 1, 0, 1, 1, 2)],    // var 0 (σ_a): add glide_b = σ_b+(0,1/2)
    [rimat(1, 0, 0, -1, 1, 2)],           // var 1 (σ_b): add glide_a = σ_a+(1/2,0)
  ]},
  'pm:p4m': { generators: [rimat(0, 1, -1, 0)] },               // R₄ (both variants)

  // ── pg → ... (2 variants: var 0 = glide_a, var 1 = glide_b) ──
  'pg:pmg': { variants: [
    [rimat(-1, 0, 0, 1)],                // var 0 (glide_a): add σ_b (pure mirror)
    [rimat(1, 0, 0, -1)],                // var 1 (glide_b): add σ_a (pure mirror)
  ]},

  // ── cm → ... (2 variants: var 0 = σ+, var 1 = σ-) ──
  'cm:cmm': { variants: [
    [rimat(0, -1, -1, 0)],               // var 0 (σ+): add σ-
    [rimat(0, 1, 1, 0)],                 // var 1 (σ-): add σ+
  ]},
  'cm:p3m1': { variants: [
    [rimat(0, 1, -1, -1)],               // var 0 (σ+): add R₃  (σ+ ∈ p3m1 ✓)
    null,                                  // var 1 (σ-): INVALID (σ- ∉ p3m1)
  ]},
  'cm:p31m': { variants: [
    null,                                  // var 0 (σ+): INVALID (σ+ ∉ p31m)
    [rimat(0, 1, -1, -1)],               // var 1 (σ-): add R₃  (σ- ∈ p31m ✓)
  ]},

  // ── pmm → ... (no variants) ──
  'pmm:p4m': { generators: [rimat(0, 1, -1, 0)] },              // R₄

  // ── pgg → ... (no variants) ──
  'pgg:p4g': { generators: [rimat(0, 1, -1, 0)] },              // R₄

  // ── cmm → ... (no variants) ──
  'cmm:p4m': { generators: [rimat(0, 1, -1, 0)] },              // R₄

  // ── p4 → ... (no variants) ──
  'p4:p4m':  { generators: [rimat(-1, 0, 0, 1)] },              // σ_b
  'p4:p4g':  { generators: [rimat(0, -1, -1, 0, 1, 2, 1, 2)] }, // σ-+(1/2,1/2)

  // ── p3 → ... (no variants) ──
  'p3:p3m1': { generators: [rimat(-1, -1, 0, 1)] },             // σ_h
  'p3:p31m': { generators: [rimat(1, 1, 0, -1)] },              // σ_v
  'p3:p6':   { generators: [rimat(1, 1, -1, 0)] },              // R₆

  // ── p3m1 → ... (no variants) ──
  'p3m1:p6m': { generators: [rimat(1, 1, -1, 0)] },             // R₆

  // ── p31m → ... (no variants) ──
  'p31m:p6m': { generators: [rimat(1, 1, -1, 0)] },             // R₆

  // ── p6 → ... (no variants) ──
  'p6:p6m':   { generators: [rimat(-1, -1, 0, 1)] },            // σ_h
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
 * Get the extra generator(s) needed for a supergroup transition.
 *
 * Returns the rational affine matrices to ADD to the current group's
 * generators, or null if the transition is invalid (e.g. variant mismatch).
 *
 * @param {string} sourceType – IUCr short name of the current group
 * @param {number} variantIndex – which direction variant of the source (0 or 1)
 * @param {string} targetType – IUCr short name of the target supergroup
 * @param {{ x: number, y: number }} [latticeVec] – second lattice vector (optional;
 *        needed for transitions where the generator depends on the lattice shape,
 *        e.g. p1→cm on non-well-rounded centered rectangular)
 * @returns {rmat[]|null}
 */
export function getExtraGenerators(sourceType, variantIndex, targetType, latticeVec) {
  const key = `${sourceType}:${targetType}`
  const entry = EXTRA_GENERATORS[key]
  if (!entry) return null

  if (entry.variants) {
    const idx = Math.min(variantIndex, entry.variants.length - 1)
    return entry.variants[idx]  // may be null if invalid for this variant
  }

  // Use not-well-rounded generators when the lattice requires it
  if (entry.nwrGenerators && isNotWellRoundedCenteredRect(latticeVec)) {
    return entry.nwrGenerators
  }

  return entry.generators
}

/**
 * Get the list of all one-step supergroups for a given wallpaper type.
 * These are type-level inclusions (may not all be viable with the current
 * lattice or variant).
 *
 * @param {string} groupName – IUCr short name (p1, pm, p4m, etc.)
 * @returns {string[]}
 */
export function getAllSupergroups(groupName) {
  return SUPERGROUP_MAP[groupName] || []
}

/**
 * Get the viable one-step supergroups for a wallpaper type on a given lattice,
 * taking into account the current variant.
 *
 * A supergroup is viable if:
 *   1. The current lattice type is compatible with the target group's
 *      lattice requirement, AND
 *   2. Extra generators exist for this source/variant → target transition
 *      (some transitions are only valid for certain variants).
 *
 * @param {string} groupName – IUCr short name (p1, pm, p4m, etc.)
 * @param {string} currentLatticeType – one of: oblique, rectangular, centered-rectangular, square, hexagonal
 * @param {number} variantIndex – which direction variant (default 0)
 * @returns {string[]}
 */
export function getViableSupergroups(groupName, currentLatticeType, variantIndex = 0) {
  const allSupergroups = SUPERGROUP_MAP[groupName] || []
  return allSupergroups.filter(sg => {
    // 1. Check lattice compatibility
    const req = GROUP_LATTICE_REQ[sg]
    if (!latticeSupportsGroupType(currentLatticeType, req)) return false
    // 2. Check that extra generators exist for this variant
    return getExtraGenerators(groupName, variantIndex, sg) !== null
  })
}
