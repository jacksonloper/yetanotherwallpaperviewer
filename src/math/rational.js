/**
 * Rational number arithmetic and rational affine 2D matrices.
 *
 * A rational number is represented as a pair [n, d] where:
 *   n = integer numerator
 *   d = integer denominator, always > 0
 *   gcd(|n|, d) = 1  (always in lowest terms)
 *   Zero is [0, 1]
 *
 * A rational affine 2D matrix has the form:
 *   [a  b  tx]
 *   [c  d  ty]
 *   [0  0   1]
 * where each of a, b, c, d, tx, ty is a rational number.
 */

// ───────────────────────────────────────────────────
//  Rational number arithmetic
// ───────────────────────────────────────────────────

/**
 * Greatest common divisor (Euclidean algorithm).
 */
export function gcd(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

/**
 * Create a normalized rational number [n, d].
 */
export function rat(n, d = 1) {
  if (d === 0) throw new Error('Rational: denominator is zero')
  if (n === 0) return [0, 1]
  if (d < 0) { n = -n; d = -d }
  const g = gcd(Math.abs(n), d)
  return [n / g, d / g]
}

/** Add two rationals. */
export function radd(a, b) {
  return rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
}

/** Subtract two rationals: a − b. */
export function rsub(a, b) {
  return rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1])
}

/** Multiply two rationals. */
export function rmul(a, b) {
  return rat(a[0] * b[0], a[1] * b[1])
}

/** Divide two rationals: a / b. */
export function rdiv(a, b) {
  if (b[0] === 0) throw new Error('Rational: division by zero')
  return rat(a[0] * b[1], a[1] * b[0])
}

/** Negate a rational. */
export function rneg(a) {
  return a[0] === 0 ? [0, 1] : [-a[0], a[1]]
}

/** Check equality of two rationals (exact). */
export function req(a, b) {
  return a[0] === b[0] && a[1] === b[1]
}

/** Convert rational to float. */
export function rToFloat(a) {
  return a[0] / a[1]
}

/**
 * Reduce a rational modulo 1 to [0, 1).
 *
 * For a = n/d, returns r such that 0 ≤ r < 1 and r ≡ a (mod 1).
 */
export function rmod1(a) {
  const [n, d] = a
  // JS % is truncation-based, so ((n % d) + d) % d gives non-negative remainder
  const rem = ((n % d) + d) % d
  return rat(rem, d)
}

// ───────────────────────────────────────────────────
//  Rational affine 2D matrices
// ───────────────────────────────────────────────────

/**
 * Create a rational affine matrix from rational entries.
 *
 * Each argument is a [n, d] pair.
 */
export function rmat(a, b, c, d, tx, ty) {
  return { a, b, c, d, tx, ty }
}

/**
 * Create a rational affine matrix from integers.
 *
 * The linear part (a, b, c, d) is given as plain integers.
 * The translation part is given as numerator/denominator pairs.
 */
export function rimat(a, b, c, d, txn = 0, txd = 1, tyn = 0, tyd = 1) {
  return rmat(rat(a), rat(b), rat(c), rat(d), rat(txn, txd), rat(tyn, tyd))
}

/** The identity rational affine matrix. */
export function ridentity() {
  return rimat(1, 0, 0, 1)
}

/** Compose two rational affine matrices: result = A ∘ B (apply B first). */
export function rcompose(A, B) {
  return rmat(
    radd(rmul(A.a, B.a), rmul(A.b, B.c)),
    radd(rmul(A.a, B.b), rmul(A.b, B.d)),
    radd(rmul(A.c, B.a), rmul(A.d, B.c)),
    radd(rmul(A.c, B.b), rmul(A.d, B.d)),
    radd(radd(rmul(A.a, B.tx), rmul(A.b, B.ty)), A.tx),
    radd(radd(rmul(A.c, B.tx), rmul(A.d, B.ty)), A.ty),
  )
}

/** Inverse of a rational affine matrix. */
export function rinverse(A) {
  const det = rsub(rmul(A.a, A.d), rmul(A.b, A.c))
  const ai = rdiv(A.d, det)
  const bi = rneg(rdiv(A.b, det))
  const ci = rneg(rdiv(A.c, det))
  const di = rdiv(A.a, det)
  return rmat(
    ai, bi, ci, di,
    rneg(radd(rmul(ai, A.tx), rmul(bi, A.ty))),
    rneg(radd(rmul(ci, A.tx), rmul(di, A.ty))),
  )
}

/** Check exact equality of two rational affine matrices. */
export function rmatEqual(A, B) {
  return (
    req(A.a, B.a) && req(A.b, B.b) &&
    req(A.c, B.c) && req(A.d, B.d) &&
    req(A.tx, B.tx) && req(A.ty, B.ty)
  )
}

/**
 * Reduce a rational affine matrix modulo the translation lattice T = Z².
 *
 * Returns a new matrix with the same linear part but with
 * tx and ty reduced to [0, 1).
 */
export function rmodT(A) {
  return rmat(A.a, A.b, A.c, A.d, rmod1(A.tx), rmod1(A.ty))
}
