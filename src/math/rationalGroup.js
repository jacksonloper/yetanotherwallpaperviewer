/**
 * Rational group processing for wallpaper groups.
 *
 * A wallpaper group is defined by:
 *   - A lattice L ⊂ R², given by its second lattice vector (x, y)
 *     (the first is always (0, 1)).  This is the only floating-point
 *     quantity; it defines a 2×2 matrix C = [[0, x], [1, y]] mapping
 *     lattice (Z²) coordinates to physical coordinates.
 *   - A list of generators as rational 3×3 affine matrices in lattice
 *     coordinates.  The lattice translations by e₁ and e₂ are always
 *     present implicitly and need not be listed.
 *
 * Processing:
 *   1. Enumerate the quotient G/T (where T = Z²) by BFS with exact
 *      rational arithmetic.  Two elements are in the same coset iff
 *      they have the same linear part and their translations differ by
 *      integers, so we reduce translations mod Z² and compare exactly.
 *   2. If |G/T| exceeds a bound (default 24), the group is declared
 *      degenerate (e.g. dense translations from an irrational rotation).
 *   3. Convert coset representatives to floating-point isometries via
 *      the physical-coordinate change  M = C · A · C⁻¹.
 *
 * This avoids the Cayley-graph depth ambiguity of the existing BFS
 * approach: we simply enumerate G/T exactly and stop, rather than
 * generating elements up to an arbitrary word length.
 */

import {
  rimat,
  ridentity,
  rcompose,
  rinverse,
  rmatEqual,
  rmodT,
  rToFloat,
} from './rational.js'

import {
  makeIsometry,
  compose,
  translation,
} from './isometry.js'

// ───────────────────────────────────────────────────
//  Standard generators for all 17 wallpaper types
// ───────────────────────────────────────────────────
//
// All linear parts are integer matrices in GL(2,Z) (they preserve
// the lattice).  Translation parts are rational — at most half-
// integer for the standard wallpaper groups.
//
// Notation: rimat(a, b, c, d, txn, txd, tyn, tyd)
//   creates the affine matrix [[a,b,txn/txd],[c,d,tyn/tyd],[0,0,1]]
//   with each entry normalised as a rational number.
//
// Key linear parts (in lattice coords):
//   R₂  = [[-1,0],[0,-1]]     180° rotation
//   R₄  = [[0,1],[-1,0]]      90° rotation   (square)
//   R₃  = [[0,1],[-1,-1]]     120° rotation   (hex)
//   R₆  = [[1,1],[-1,0]]      60° rotation    (hex)
//   σ_a = [[1,0],[0,-1]]      reflection fixing e₁
//   σ_b = [[-1,0],[0,1]]      reflection fixing e₂
//   σ+  = [[0,1],[1,0]]       swap e₁↔e₂  (along a+b)
//   σ−  = [[0,-1],[-1,0]]     swap & negate (along b−a)
//   σ_h = [[-1,-1],[0,1]]     p3m1/p6m reflection (horizontal on hex)
//   σ_v = [[1,1],[0,-1]]      p31m reflection     (vertical on hex)

const STANDARD_GENERATORS = {
  // --- Any lattice ---
  p1:  { latticeType: 'any', generators: [] },
  p2:  { latticeType: 'any', generators: [rimat(-1, 0, 0, -1)] },

  // --- Rectangular / Square ---
  pm:  { latticeType: 'rectangular', variants: [
    { label: 'Mirrors ∥ a', generators: [rimat(1, 0, 0, -1)] },
    { label: 'Mirrors ∥ b', generators: [rimat(-1, 0, 0, 1)] },
  ]},
  pg:  { latticeType: 'rectangular', variants: [
    { label: 'Glide ∥ a', generators: [rimat(1, 0, 0, -1, 1, 2)] },
    { label: 'Glide ∥ b', generators: [rimat(-1, 0, 0, 1, 0, 1, 1, 2)] },
  ]},
  pmm: { latticeType: 'rectangular', generators: [
    rimat(1, 0, 0, -1),
    rimat(-1, 0, 0, 1),
  ]},
  pmg: { latticeType: 'rectangular', variants: [
    { label: 'Mirror ∥ b, glide ∥ a', generators: [
      rimat(-1, 0, 0, 1),
      rimat(1, 0, 0, -1, 1, 2),
    ]},
    { label: 'Mirror ∥ a, glide ∥ b', generators: [
      rimat(1, 0, 0, -1),
      rimat(-1, 0, 0, 1, 0, 1, 1, 2),
    ]},
  ]},
  pgg: { latticeType: 'rectangular', generators: [
    rimat(-1, 0, 0, 1, 1, 2, 1, 2),
    rimat(1, 0, 0, -1, 1, 2, 1, 2),
  ]},

  // --- Centered rectangular ---
  cm:  { latticeType: 'centered-rectangular', variants: [
    { label: 'Mirror ∥ a+b', generators: [rimat(0, 1, 1, 0)] },
    { label: 'Mirror ∥ b−a', generators: [rimat(0, -1, -1, 0)] },
  ]},
  cmm: { latticeType: 'centered-rectangular', generators: [
    rimat(0, 1, 1, 0),
    rimat(0, -1, -1, 0),
  ]},

  // --- Square ---
  p4:  { latticeType: 'square', generators: [rimat(0, 1, -1, 0)] },
  p4m: { latticeType: 'square', generators: [
    rimat(0, 1, -1, 0),
    rimat(-1, 0, 0, 1),
  ]},
  p4g: { latticeType: 'square', generators: [
    rimat(0, 1, -1, 0),
    rimat(0, -1, -1, 0, 1, 2, 1, 2),
  ]},

  // --- Hexagonal ---
  p3:   { latticeType: 'hexagonal', generators: [rimat(0, 1, -1, -1)] },
  p3m1: { latticeType: 'hexagonal', generators: [
    rimat(0, 1, -1, -1),
    rimat(-1, -1, 0, 1),
  ]},
  p31m: { latticeType: 'hexagonal', generators: [
    rimat(0, 1, -1, -1),
    rimat(1, 1, 0, -1),
  ]},
  p6:   { latticeType: 'hexagonal', generators: [rimat(1, 1, -1, 0)] },
  p6m:  { latticeType: 'hexagonal', generators: [
    rimat(1, 1, -1, 0),
    rimat(-1, -1, 0, 1),
  ]},
}

/**
 * Get the standard rational generators for a wallpaper type.
 *
 * @param {string} typeName – one of the 17 IUCr short names
 * @param {number} variantIndex – which direction variant (default 0)
 * @returns {{ latticeType: string, generators: rmat[], variantLabels: string[]|null }}
 */
export function standardGenerators(typeName, variantIndex = 0) {
  const entry = STANDARD_GENERATORS[typeName]
  if (!entry) return null

  if (entry.variants) {
    const idx = Math.min(variantIndex, entry.variants.length - 1)
    return {
      latticeType: entry.latticeType,
      generators: entry.variants[idx].generators,
      variantLabels: entry.variants.map(v => v.label),
    }
  }

  return {
    latticeType: entry.latticeType,
    generators: entry.generators,
    variantLabels: null,
  }
}

// ───────────────────────────────────────────────────
//  Group processing: enumerate G/T
// ───────────────────────────────────────────────────

/**
 * Enumerate the quotient G/T by BFS using exact rational arithmetic.
 *
 * The translation subgroup T = Z² is always present implicitly.
 * Generators should NOT include lattice translations; they are
 * the non-translation generators only (rotations, reflections,
 * glide reflections expressed in lattice coordinates).
 *
 * Two elements are in the same coset of T iff they have the same
 * linear part and their translations differ by integers.  We detect
 * this by reducing translations mod Z² and comparing exactly.
 *
 * For a valid wallpaper group, |G/T| ≤ 12 (attained by p6m).
 * If |G/T| exceeds maxOrder, the group is declared degenerate.
 *
 * @param {rmat[]} generators – rational affine matrices (lattice coords)
 * @param {number} maxOrder – upper bound on |G/T| before declaring degenerate
 * @returns {{ cosets: rmat[], isDegenerate: boolean, order: number, error: string|null }}
 */
export function processGroup(generators, maxOrder = 24) {
  if (generators.length === 0) {
    return { cosets: [ridentity()], isDegenerate: false, order: 1, error: null }
  }

  // Build the full generator set (each generator and its inverse)
  const allGens = []
  for (const g of generators) {
    allGens.push(g)
    const inv = rinverse(g)
    const invR = rmodT(inv)
    if (!allGens.some(e => rmatEqual(rmodT(e), invR))) {
      allGens.push(inv)
    }
  }

  // BFS to enumerate G/T
  const id = ridentity()
  const cosets = [id]
  let frontier = [id]

  while (frontier.length > 0) {
    const nextFrontier = []
    for (const rep of frontier) {
      for (const gen of allGens) {
        const product = rcompose(gen, rep)
        const reduced = rmodT(product)

        if (!cosets.some(c => rmatEqual(c, reduced))) {
          cosets.push(reduced)
          nextFrontier.push(reduced)

          if (cosets.length > maxOrder) {
            return {
              cosets: cosets.slice(0, maxOrder),
              isDegenerate: true,
              order: -1,
              error: `G/T exceeds ${maxOrder} elements – group appears degenerate.`,
            }
          }
        }
      }
    }
    frontier = nextFrontier
  }

  return { cosets, isDegenerate: false, order: cosets.length, error: null }
}

// ───────────────────────────────────────────────────
//  Conversion to physical (floating-point) isometries
// ───────────────────────────────────────────────────

/**
 * Convert a rational affine matrix (lattice coords) to a physical isometry.
 *
 * The lattice is defined by a = (0, 1) and b = (x, y).
 * The matrix C = [[0, x], [1, y]] maps lattice → physical coords.
 * The physical isometry is M = C · A · C⁻¹.
 *
 * @param {rmat} A – rational affine matrix in lattice coords
 * @param {Object} latticeVec – { x, y } second lattice vector
 * @returns {Object} floating-point isometry { a, b, c, d, tx, ty }
 */
export function toPhysical(A, latticeVec) {
  const { x, y } = latticeVec
  const a = rToFloat(A.a), b = rToFloat(A.b)
  const c = rToFloat(A.c), d = rToFloat(A.d)
  const atx = rToFloat(A.tx), aty = rToFloat(A.ty)

  // P = C · A_linear = [[xc, xd], [a+yc, b+yd]]
  const p11 = x * c, p12 = x * d
  const p21 = a + y * c, p22 = b + y * d

  // M_linear = P · C⁻¹ where C⁻¹ = [[-y/x, 1], [1/x, 0]]
  const m_a = (-p11 * y + p12) / x   // d − cy
  const m_b = p11                     // xc
  const m_c = (-p21 * y + p22) / x
  const m_d = p21                     // a + yc

  // M_translation = C · A_trans = [x·aty, atx + y·aty]
  const m_tx = x * aty
  const m_ty = atx + y * aty

  return makeIsometry(m_a, m_b, m_c, m_d, m_tx, m_ty)
}

/**
 * Convert all coset representatives to physical isometries.
 *
 * @param {rmat[]} cosets – G/T coset representatives (rational matrices)
 * @param {Object} latticeVec – { x, y } second lattice vector
 * @returns {Object[]} array of floating-point isometries
 */
export function quotientToPhysical(cosets, latticeVec) {
  return cosets.map(c => toPhysical(c, latticeVec))
}

/**
 * Generate all visible group elements from G/T coset representatives.
 *
 * For each coset representative, applies lattice translations to
 * generate all copies whose representative point (the image of the
 * origin) falls within the given bounds (plus a 1-unit margin).
 *
 * This replaces the Cayley-graph BFS: the number of visible elements
 * is determined solely by the viewport size and the number of cosets,
 * with no depth parameter.
 *
 * @param {rmat[]} cosets – G/T coset representatives (rational matrices)
 * @param {Object} latticeVec – { x, y } second lattice vector
 * @param {Object} bounds – { minX, maxX, minY, maxY }
 * @returns {Object[]} array of floating-point isometries
 */
export function generateElements(cosets, latticeVec, bounds) {
  const v1 = { x: 0, y: 1 }
  const v2 = latticeVec
  const physReps = quotientToPhysical(cosets, latticeVec)

  const elements = []
  const range = 20

  for (const rep of physReps) {
    for (let a = -range; a <= range; a++) {
      for (let b = -range; b <= range; b++) {
        const tx = a * v1.x + b * v2.x
        const ty = a * v1.y + b * v2.y
        const elem = compose(translation(tx, ty), rep)

        // Keep elements whose origin-image falls in bounds (with margin)
        if (elem.tx >= bounds.minX - 1 && elem.tx <= bounds.maxX + 1 &&
            elem.ty >= bounds.minY - 1 && elem.ty <= bounds.maxY + 1) {
          elements.push(elem)
        }
      }
    }
  }

  return elements
}
