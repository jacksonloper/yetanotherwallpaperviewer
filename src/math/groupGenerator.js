/**
 * Group generation for wallpaper groups.
 *
 * Given a list of generators (isometries), we use BFS to enumerate all
 * elements expressible as products of at most `maxWords` generators
 * (and their inverses).  We detect duplicates using a tolerance-based
 * comparison.
 *
 * We also validate that the translation sub-group of the generated group
 * equals the lattice L spanned by the two specified translations.
 */

import {
  compose,
  inverse,
  identity,
  isometryEqual,
  isTranslation,
  isIdentity,
  classify,
} from './isometry.js';

const EPS = 1e-7;

// Looser tolerance for lattice-membership checks.  Lattice vectors may
// carry small errors from slider quantisation (step 0.01, toFixed(4)),
// which propagate through Cramer's rule into coefficients that are off
// by ~3e-5.  Genuine incompatibilities produce deviations ≥ 0.1, so
// 1e-4 is safe and consistent with TYPE_EPS in latticeUtils.js.
const LATTICE_EPS = 1e-4;

/**
 * Check whether the translation (tx, ty) is an integer combination of
 * the lattice basis vectors v1 and v2 (within tolerance).
 */
function isInLattice(tx, ty, v1, v2) {
  // Solve: a*v1x + b*v2x = tx,  a*v1y + b*v2y = ty
  const det = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(det) < 1e-12) return false; // degenerate lattice
  const a = (tx * v2.y - ty * v2.x) / det;
  const b = (v1.x * ty - v1.y * tx) / det;
  return Math.abs(a - Math.round(a)) < LATTICE_EPS && Math.abs(b - Math.round(b)) < LATTICE_EPS;
}

/**
 * Check whether element `M` already appears in the list `elements`.
 */
function isDuplicate(elements, M) {
  for (const e of elements) {
    if (isometryEqual(e, M, EPS)) return true;
  }
  return false;
}

/**
 * Generate group elements up to `maxWords` words in the generators.
 *
 * Every distinct isometry found is kept (we do NOT reduce modulo the
 * translation lattice).  This means the result list grows with depth
 * and includes many translation copies of the same coset representative.
 *
 * While expanding we watch for pure translations that fall outside the
 * lattice spanned by the two translation generators.  Finding any such
 * translation means the generators are incompatible with the lattice
 * (the resulting group would be non-discrete or have a different
 * translation lattice).  We still return the elements found (up to
 * maxElements) and set a warning string.
 *
 * @param {Array} generators – list of isometry objects (must include
 *   exactly two that are pure translations forming a lattice).
 * @param {number} maxWords – maximum word length to expand.
 * @param {number} maxElements – maximum number of elements to generate.
 * @returns {{ elements: Array, error: string|null, warning: string|null, timeMs: number }}
 */
export function generateGroup(generators, maxWords = 6, maxElements = 1000) {
  const t0 = performance.now();
  const result = _generateGroup(generators, maxWords, maxElements);
  result.timeMs = performance.now() - t0;
  return result;
}

function _generateGroup(generators, maxWords, maxElements) {

  // Identify the two translation generators
  const translationGens = generators.filter((g) => isTranslation(g));
  if (translationGens.length !== 2) {
    return {
      elements: [],
      error: `Expected exactly 2 translation generators, got ${translationGens.length}.`,
      warning: null,
    };
  }

  const v1 = { x: translationGens[0].tx, y: translationGens[0].ty };
  const v2 = { x: translationGens[1].tx, y: translationGens[1].ty };

  // Check that v1, v2 are linearly independent
  const det = v1.x * v2.y - v1.y * v2.x;
  if (Math.abs(det) < 1e-10) {
    return {
      elements: [],
      error: 'The two translation generators are linearly dependent.',
      warning: null,
    };
  }

  // Pre-check: every generator must conjugate the lattice back into itself.
  // If g is a generator and T is a lattice translation, then g∘T∘g⁻¹ must
  // also be a lattice translation. If not, the group produces translations
  // outside L, which means either a dense set or a strictly larger lattice.
  // We record a warning but continue generating up to maxElements.
  let warning = null;
  const nonTransGens = generators.filter((g) => !isTranslation(g));
  for (const g of nonTransGens) {
    const gInv = inverse(g);
    for (const T of translationGens) {
      const conjugate = compose(g, compose(T, gInv));
      if (!isTranslation(conjugate, EPS)) {
        warning = 'A generator conjugates a lattice translation into a non-translation. Check inputs.';
      } else if (!isInLattice(conjugate.tx, conjugate.ty, v1, v2)) {
        const type = classify(g, EPS);
        if (type === 'rotation') {
          warning =
            'The group generates translations outside the specified lattice. ' +
            'This means the translations form a dense set.';
        } else {
          warning =
            'The canonical translation group of the symmetry group is not equal to the lattice L. ' +
            'A generator maps the lattice to a different set of translations.';
        }
      }
    }
  }

  // Build the full generator set (each generator and its inverse)
  const allGens = [];
  for (const g of generators) {
    allGens.push(g);
    const inv = inverse(g);
    if (!isDuplicate(allGens, inv)) {
      allGens.push(inv);
    }
  }

  // BFS: explore all products of generators up to length maxWords.
  // We use exact equality – every distinct isometry is kept.
  const id = identity();
  const elements = [id];
  let frontier = [id];

  // Count of non-lattice pure translations found (for warning detection)
  let extraTranslationCount = 0;

  for (let depth = 0; depth < maxWords; depth++) {
    const nextFrontier = [];
    for (const elem of frontier) {
      for (const gen of allGens) {
        const product = compose(gen, elem);
        const type = classify(product, EPS);

        // Count non-lattice translations
        if (type === 'translation' && !isIdentity(product, EPS)) {
          if (!isInLattice(product.tx, product.ty, v1, v2)) {
            extraTranslationCount++;
          }
        }

        // Check for exact duplicate
        if (!isDuplicate(elements, product)) {
          elements.push(product);
          nextFrontier.push(product);

          if (elements.length >= maxElements) {
            // Return what we have so far – hit the element limit
            if (extraTranslationCount > 0 && !warning) {
              warning =
                'The canonical translation group of the symmetry group is not equal to the lattice L. ' +
                `Found ${extraTranslationCount} translation(s) outside the lattice.`;
            }
            return { elements, error: null, warning };
          }
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  // Final: note any extra translations as a warning
  if (extraTranslationCount > 0 && !warning) {
    warning =
      'The canonical translation group of the symmetry group is not equal to the lattice L. ' +
      `Found ${extraTranslationCount} translation(s) outside the lattice.`;
  }

  return { elements, error: null, warning };
}

/**
 * Given the two lattice translation vectors, generate lattice points
 * that fall within a bounding box.
 */
export function generateLatticePoints(v1, v2, bounds) {
  const { minX, minY, maxX, maxY } = bounds;
  const points = [];
  // Try integer combinations
  for (let a = -20; a <= 20; a++) {
    for (let b = -20; b <= 20; b++) {
      const x = a * v1.x + b * v2.x;
      const y = a * v1.y + b * v2.y;
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        points.push({ x, y });
      }
    }
  }
  return points;
}
