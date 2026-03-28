/**
 * 2D Isometry representation using affine matrices.
 *
 * An isometry of the Euclidean plane is represented as a 3×3 matrix:
 *   [a  b  tx]
 *   [c  d  ty]
 *   [0  0   1]
 *
 * where the top-left 2×2 block is an orthogonal matrix (rotation or
 * reflection) and (tx, ty) is a translation vector.
 */

const EPS = 1e-9;

/** Create an isometry from its matrix entries. */
export function makeIsometry(a, b, c, d, tx, ty) {
  return { a, b, c, d, tx, ty };
}

/** The identity isometry. */
export function identity() {
  return makeIsometry(1, 0, 0, 1, 0, 0);
}

/** Pure translation by (tx, ty). */
export function translation(tx, ty) {
  return makeIsometry(1, 0, 0, 1, tx, ty);
}

/**
 * Rotation by `angle` radians about the point (cx, cy).
 * Default centre is the origin.
 */
export function rotation(angle, cx = 0, cy = 0) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = cx - cos * cx + sin * cy;
  const ty = cy - sin * cx - cos * cy;
  return makeIsometry(cos, -sin, sin, cos, tx, ty);
}

/**
 * Reflection across the line through (px, py) with direction angle `angle`.
 */
export function reflection(angle, px = 0, py = 0) {
  const cos2 = Math.cos(2 * angle);
  const sin2 = Math.sin(2 * angle);
  const a = cos2;
  const b = sin2;
  const c = sin2;
  const d = -cos2;
  const tx = px - cos2 * px - sin2 * py;
  const ty = py - sin2 * px + cos2 * py;
  return makeIsometry(a, b, c, d, tx, ty);
}

/**
 * Glide reflection: reflection across the line through (px, py) with
 * direction angle `angle`, followed by translation along the line by `dist`.
 */
export function glideReflection(angle, dist, px = 0, py = 0) {
  const refl = reflection(angle, px, py);
  const glide = translation(dist * Math.cos(angle), dist * Math.sin(angle));
  return compose(glide, refl);
}

/** Compose two isometries: result = A ∘ B  (apply B first, then A). */
export function compose(A, B) {
  return makeIsometry(
    A.a * B.a + A.b * B.c,
    A.a * B.b + A.b * B.d,
    A.c * B.a + A.d * B.c,
    A.c * B.b + A.d * B.d,
    A.a * B.tx + A.b * B.ty + A.tx,
    A.c * B.tx + A.d * B.ty + A.ty
  );
}

/** Inverse of an isometry. */
export function inverse(M) {
  // The linear part is orthogonal, so its inverse is its transpose.
  const det = M.a * M.d - M.b * M.c; // should be ±1
  const ai = M.d / det;
  const bi = -M.b / det;
  const ci = -M.c / det;
  const di = M.a / det;
  return makeIsometry(
    ai, bi, ci, di,
    -(ai * M.tx + bi * M.ty),
    -(ci * M.tx + di * M.ty)
  );
}

/** Check whether two isometries are equal up to tolerance. */
export function isometryEqual(A, B, eps = EPS) {
  return (
    Math.abs(A.a - B.a) < eps &&
    Math.abs(A.b - B.b) < eps &&
    Math.abs(A.c - B.c) < eps &&
    Math.abs(A.d - B.d) < eps &&
    Math.abs(A.tx - B.tx) < eps &&
    Math.abs(A.ty - B.ty) < eps
  );
}

/** Check if an isometry is (approximately) a pure translation. */
export function isTranslation(M, eps = EPS) {
  return (
    Math.abs(M.a - 1) < eps &&
    Math.abs(M.b) < eps &&
    Math.abs(M.c) < eps &&
    Math.abs(M.d - 1) < eps
  );
}

/** Check if an isometry is (approximately) the identity. */
export function isIdentity(M, eps = EPS) {
  return isTranslation(M, eps) && Math.abs(M.tx) < eps && Math.abs(M.ty) < eps;
}

/** Check if an isometry is orientation-preserving (det of linear part ≈ +1). */
export function isOrientationPreserving(M) {
  return M.a * M.d - M.b * M.c > 0;
}

/**
 * Classify an isometry.
 * Returns one of: 'identity', 'translation', 'rotation', 'reflection', 'glide-reflection'
 */
export function classify(M, eps = EPS) {
  if (isIdentity(M, eps)) return 'identity';
  if (isTranslation(M, eps)) return 'translation';
  const det = M.a * M.d - M.b * M.c;
  if (det > 0) {
    // orientation-preserving and not a translation → rotation
    return 'rotation';
  }
  // orientation-reversing
  // A pure reflection has a fixed point, a glide reflection doesn't
  // (or more precisely, has no fixed point in the plane).
  // For a reflection, trace of the linear part = a + d = 2cos(θ) where θ is 0 for reflection
  // Reflection: the translation component is zero when expressed in the eigenframe.
  // The component of the translation along the reflection axis determines glide vs reflection.
  const angle = Math.atan2(M.c, M.a) / 2; // axis angle
  const along = M.tx * Math.cos(angle) + M.ty * Math.sin(angle);
  if (Math.abs(along) < eps) return 'reflection';
  return 'glide-reflection';
}

/**
 * For a rotation isometry, find the centre and angle.
 */
export function rotationInfo(M) {
  const angle = Math.atan2(M.c, M.a);
  // Fixed point: (I - R) p = t → p = (I - R)^{-1} t
  const det = (1 - M.a) * (1 - M.d) - M.b * M.c;
  const cx = ((1 - M.d) * M.tx + M.b * M.ty) / det;
  const cy = (M.c * M.tx + (1 - M.a) * M.ty) / det;
  return { angle, cx, cy };
}

/**
 * For a rotation, determine its order (2, 3, 4, 6 for wallpaper groups).
 * Returns the integer order, or 0 if it doesn't match a standard order.
 */
export function rotationOrder(M, eps = 1e-4) {
  const angle = Math.abs(Math.atan2(M.c, M.a));
  for (const n of [2, 3, 4, 6]) {
    if (Math.abs(angle - (2 * Math.PI) / n) < eps) return n;
  }
  // Could also be a rotation by -2π/n
  for (const n of [2, 3, 4, 6]) {
    if (Math.abs(angle - (2 * Math.PI * (n - 1)) / n) < eps) return n;
  }
  return 0;
}

/**
 * For a reflection or glide reflection, find the axis angle and a point
 * on the axis line, plus the glide distance.
 */
export function reflectionInfo(M) {
  const angle = Math.atan2(M.c, M.a) / 2;
  // The reflection axis passes through the midpoint of p and M(p) for any p.
  // For p = origin: M(0,0) = (tx, ty). The midpoint is (tx/2, ty/2).
  // Project this onto the axis to get the glide component.
  const glideDist = M.tx * Math.cos(angle) + M.ty * Math.sin(angle);
  // A point on the axis closest to origin:
  const perpDist = -M.tx * Math.sin(angle) + M.ty * Math.cos(angle);
  const px = (perpDist / 2) * (-Math.sin(angle));
  const py = (perpDist / 2) * Math.cos(angle);
  return { angle, px, py, glideDist };
}

/** Apply an isometry to a point. */
export function applyToPoint(M, x, y) {
  return {
    x: M.a * x + M.b * y + M.tx,
    y: M.c * x + M.d * y + M.ty,
  };
}
