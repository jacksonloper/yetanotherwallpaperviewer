const PI = Math.PI
const TYPE_EPS = 1e-4

/**
 * Compute the second lattice vector (x, y) from the lattice state.
 */
export function latticeToVector(lattice) {
  if (lattice.mode === 'well-rounded') {
    const s = lattice.sliderValue ?? 0
    const y = s * 0.5
    const x = Math.sqrt(Math.max(0, 1 - y * y))
    return { x, y }
  }

  const shape = lattice.shape || 'rectangular'
  switch (shape) {
    case 'centered-rectangular':
      return { x: lattice.x ?? 1.0, y: 0.5 }
    case 'rectangular':
      return { x: lattice.x ?? 1.5, y: 0 }
    case 'oblique':
      return { x: lattice.x ?? 1.1, y: lattice.y ?? 0.3 }
    default:
      return { x: 1, y: 0 }
  }
}

/**
 * Convert a second-vector (x, y) back to lattice state (for preset loading).
 */
export function vectorToLattice(x, y) {
  const r2 = x * x + y * y
  const onCircle = Math.abs(r2 - 1) < 1e-6

  if (onCircle) {
    // Well-rounded. sliderValue = y / 0.5 = 2y
    return { mode: 'well-rounded', sliderValue: Math.min(1, Math.max(0, y * 2)) }
  }

  // Not well-rounded
  if (Math.abs(y - 0.5) < 1e-9) {
    return { mode: 'not-well-rounded', shape: 'centered-rectangular', x }
  }
  if (Math.abs(y) < 1e-9) {
    return { mode: 'not-well-rounded', shape: 'rectangular', x }
  }
  return { mode: 'not-well-rounded', shape: 'oblique', x, y }
}

/**
 * Determine the Bravais lattice type from the current lattice state.
 *
 * Returns one of: 'square', 'hexagonal', 'rectangular',
 *                 'centered-rectangular', 'oblique'
 */
export function getLatticeType(lattice) {
  const vec = latticeToVector(lattice)
  const { x, y } = vec
  const r2 = x * x + y * y

  if (Math.abs(y) < TYPE_EPS && Math.abs(x - 1) < TYPE_EPS) return 'square'
  if (Math.abs(y - 0.5) < TYPE_EPS && Math.abs(x - Math.sqrt(3) / 2) < TYPE_EPS) return 'hexagonal'
  if (Math.abs(y) < TYPE_EPS) return 'rectangular'
  if (Math.abs(r2 - 1) < TYPE_EPS) return 'centered-rectangular'
  if (Math.abs(y - 0.5) < TYPE_EPS) return 'centered-rectangular'
  return 'oblique'
}

/**
 * Get the allowed isometry types for the current lattice.
 *
 * Based on the wallpaper group crystallographic restriction:
 *
 * | Lattice type           | Reflections             | Glides                           | Rotation orders |
 * |------------------------|-------------------------|----------------------------------|-----------------|
 * | Oblique                | none                    | none                             | 2               |
 * | Rectangular            | a; b                    | along a: ½; along b: x/2         | 2               |
 * | Centered rectangular   | a+b; b−a                | along a+b: ½|a+b|; b−a: ½|b−a|  | 2               |
 * | Square                 | a; b; a+b; b−a          | along a,b: ½; diags: √2/2        | 2, 4            |
 * | Hexagonal              | a; b; b−a; a+b; 2b−a;   | short: ½; long: √3/2             | 2, 3, 6         |
 * |                        | b−2a                    |                                  |                 |
 *
 * Where a = (0,1), b = (x,y).
 *
 * Returns { latticeType, rotationOrders, reflections[], glides[] }
 */
export function getAllowedIsometries(lattice) {
  const vec = latticeToVector(lattice)
  const { x, y } = vec
  const r2 = x * x + y * y
  const latticeType = getLatticeType(lattice)

  const result = {
    latticeType,
    rotationOrders: [],
    reflections: [],
    glides: [],
  }

  switch (latticeType) {
    case 'oblique':
      result.rotationOrders = [2]
      break

    case 'rectangular':
      result.rotationOrders = [2]
      result.reflections = [
        { label: 'along a (vertical)', angle: PI / 2 },
        { label: 'along b (horizontal)', angle: 0 },
      ]
      result.glides = [
        { label: 'along a, dist ½', angle: PI / 2, dist: 0.5 },
        { label: `along b, dist ${(x / 2).toFixed(3)}`, angle: 0, dist: x / 2 },
      ]
      break

    case 'centered-rectangular': {
      result.rotationOrders = [2]

      // Always use a+b and b−a directions, whether well-rounded or not.
      // This ensures continuity through the hex boundary (x→√3/2, y→0.5).
      const apb = { x, y: 1 + y }
      const bma = { x, y: y - 1 }
      const apbAngle = Math.atan2(apb.y, apb.x)
      const bmaAngle = Math.atan2(bma.y, bma.x)
      const apbLen = Math.sqrt(apb.x * apb.x + apb.y * apb.y)
      const bmaLen = Math.sqrt(bma.x * bma.x + bma.y * bma.y)

      result.reflections = [
        { label: 'along a+b', angle: apbAngle },
        { label: 'along b−a', angle: bmaAngle },
      ]
      result.glides = [
        { label: `along a+b, dist ${(apbLen / 2).toFixed(3)}`, angle: apbAngle, dist: apbLen / 2 },
        { label: `along b−a, dist ${(bmaLen / 2).toFixed(3)}`, angle: bmaAngle, dist: bmaLen / 2 },
      ]
      break
    }

    case 'square':
      result.rotationOrders = [2, 4]
      // a+b and b−a first so indices 0,1 match centered-rectangular ordering
      result.reflections = [
        { label: 'along a+b (diagonal ↗)', angle: PI / 4 },
        { label: 'along b−a (diagonal ↘)', angle: -PI / 4 },
        { label: 'along a (vertical)', angle: PI / 2 },
        { label: 'along b (horizontal)', angle: 0 },
      ]
      result.glides = [
        { label: 'along a+b, dist √2/2', angle: PI / 4, dist: Math.SQRT2 / 2 },
        { label: 'along b−a, dist √2/2', angle: -PI / 4, dist: Math.SQRT2 / 2 },
        { label: 'along a, dist ½', angle: PI / 2, dist: 0.5 },
        { label: 'along b, dist ½', angle: 0, dist: 0.5 },
      ]
      break

    case 'hexagonal': {
      result.rotationOrders = [2, 3, 6]
      // a+b and b−a first so indices 0,1 match centered-rectangular ordering
      result.reflections = [
        { label: 'along a+b', angle: PI / 3 },
        { label: 'along b−a', angle: -PI / 6 },
        { label: 'along a (vertical)', angle: PI / 2 },
        { label: 'along b', angle: PI / 6 },
        { label: 'along 2b−a (horizontal)', angle: 0 },
        { label: 'along b−2a', angle: -PI / 3 },
      ]
      const s3h = Math.sqrt(3) / 2
      result.glides = [
        { label: 'along a+b, dist √3/2', angle: PI / 3, dist: s3h },
        { label: 'along b−a, dist ½', angle: -PI / 6, dist: 0.5 },
        { label: 'along a, dist ½', angle: PI / 2, dist: 0.5 },
        { label: 'along b, dist ½', angle: PI / 6, dist: 0.5 },
        { label: 'along 2b−a, dist √3/2', angle: 0, dist: s3h },
        { label: 'along b−2a, dist √3/2', angle: -PI / 3, dist: s3h },
      ]
      break
    }
  }

  return result
}

/**
 * GCD for real numbers using the Euclidean algorithm with tolerance.
 */
function realGCD(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  if (a < 1e-10) return b
  if (b < 1e-10) return a
  if (b > a) { const tmp = a; a = b; b = tmp }
  for (let i = 0; i < 50; i++) {
    if (b < 1e-10) break
    const r = a % b
    a = b
    b = r
  }
  return a
}

/**
 * Compute the fundamental perpendicular period for an axis direction.
 * Given the axis angle and the second lattice vector (the first is always (0,1)),
 * returns the smallest positive perpendicular displacement that corresponds to
 * a lattice translation.
 */
export function computeAxisPeriod(angle, latticeVec) {
  const nx = -Math.sin(angle)
  const ny = Math.cos(angle)
  const p1 = Math.abs(ny)
  const p2 = Math.abs(latticeVec.x * nx + latticeVec.y * ny)
  const result = realGCD(p1, p2)
  return result > 1e-10 ? result : 1
}

/**
 * Convert (cx, cy) center coordinates to lattice-basis slider values (s, t) ∈ [0, 1).
 * Point = s*(0,1) + t*(x_lat, y_lat)
 */
export function centerToLatticeCoords(cx, cy, latticeVec) {
  const { x: xLat, y: yLat } = latticeVec
  const t = ((cx / xLat) % 1 + 1) % 1
  const s = (((cy - t * yLat) % 1) + 1) % 1
  return { s, t }
}

/**
 * Convert lattice-basis slider values (s, t) to (cx, cy) center coordinates.
 */
export function latticeCoordsToCenter(s, t, latticeVec) {
  const { x: xLat, y: yLat } = latticeVec
  return { cx: t * xLat, cy: s + t * yLat }
}

/**
 * Convert (px, py) axis point to a slider offset ∈ [0, 1).
 * The offset represents perpendicular displacement as a fraction of the period.
 */
export function pointToAxisOffset(px, py, angle, latticeVec) {
  const nx = -Math.sin(angle)
  const ny = Math.cos(angle)
  const d = px * nx + py * ny
  const period = computeAxisPeriod(angle, latticeVec)
  if (period < 1e-10) return 0
  return ((d / period) % 1 + 1) % 1
}

/**
 * Convert axis offset slider value ∈ [0, 1) to (px, py) point on the axis.
 */
export function axisOffsetToPoint(offset, angle, latticeVec) {
  const period = computeAxisPeriod(angle, latticeVec)
  const d = offset * period
  return { px: d * (-Math.sin(angle)), py: d * Math.cos(angle) }
}

/**
 * Find the index of the closest matching direction in a list of allowed directions.
 * Reflection/glide directions are lines (ambiguous by π), so we check both.
 */
export function findClosestDirection(angle, directions) {
  if (directions.length === 0) return 0
  let bestIdx = 0
  let bestDiff = Infinity
  for (let i = 0; i < directions.length; i++) {
    const diff = Math.abs(angle - directions[i].angle)
    const diff2 = Math.abs(angle + PI - directions[i].angle)
    const diff3 = Math.abs(angle - PI - directions[i].angle)
    const minDiff = Math.min(diff, diff2, diff3)
    if (minDiff < bestDiff) {
      bestDiff = minDiff
      bestIdx = i
    }
  }
  return bestIdx
}

// ───────────────────────────────────────────────────
//  Slider → lattice-vector conversions (type-first UX)
// ───────────────────────────────────────────────────

const SQRT3H = Math.sqrt(3) / 2

/**
 * Convert the cm-slider value (t ∈ [0,1]) to a lattice vector (x, y).
 *
 *   t = 0   → not-well-rounded centered-rect  (x = 3, y = 0.5)
 *   t = 0.5 → hexagonal                       (x = √3/2, y = 0.5)
 *   t = 1   → square                          (x = 1, y = 0)
 *
 * Left half  (t < 0.5): y = 0.5, x linearly interpolated from 3 → √3/2.
 * Right half (t > 0.5): well-rounded arc, y = 0.5(1 − (t−0.5)/0.5), x = √(1−y²).
 */
export function cmSliderToVector(t) {
  if (t <= 0.5) {
    // not-well-rounded segment
    const frac = t / 0.5   // 0 at t=0, 1 at t=0.5
    const x = 3 - (3 - SQRT3H) * frac
    return { x, y: 0.5 }
  }
  // well-rounded segment (including hex endpoint and square endpoint)
  const frac = (t - 0.5) / 0.5  // 0 at hex, 1 at square
  const y = 0.5 * (1 - frac)
  const x = Math.sqrt(Math.max(0, 1 - y * y))
  return { x, y }
}

/**
 * Convert the rect-to-square slider value (t ∈ [0,1]) to a lattice vector.
 *
 *   t = 0 → wide rectangle  (x = 3, y = 0)
 *   t = 1 → square          (x = 1, y = 0)
 */
export function rectSliderToVector(t) {
  return { x: 3 - 2 * t, y: 0 }
}

/**
 * Get the fixed lattice vector for a lattice type with no freedom.
 */
export function fixedLatticeVector(latticeType) {
  if (latticeType === 'square') return { x: 1, y: 0 }
  if (latticeType === 'hexagonal') return { x: SQRT3H, y: 0.5 }
  return { x: 1, y: 0 }
}

// ───────────────────────────────────────────────────
//  Direction resolution for new-format generators
// ───────────────────────────────────────────────────

/**
 * Resolve a direction key to an angle and length from the lattice vectors.
 * Keys: 'a', 'b', 'apb', 'bma', '2bma'
 */
export function resolveDirection(dir, latticeVec) {
  const { x, y } = latticeVec
  switch (dir) {
    case 'a':
      return { angle: PI / 2, length: 1 }
    case 'b':
      return { angle: Math.atan2(y, x), length: Math.sqrt(x * x + y * y) }
    case 'apb': {
      const dy = 1 + y
      return { angle: Math.atan2(dy, x), length: Math.sqrt(x * x + dy * dy) }
    }
    case 'bma': {
      const dy = y - 1
      return { angle: Math.atan2(dy, x), length: Math.sqrt(x * x + dy * dy) }
    }
    case '2bma': {
      const dx = 2 * x
      const dy = 2 * y - 1
      return { angle: Math.atan2(dy, dx), length: Math.sqrt(dx * dx + dy * dy) }
    }
    default:
      throw new Error(`Unknown direction key: ${dir}`)
  }
}

/**
 * Resolve a cm-specific direction index to angle and length.
 *
 * On not-well-rounded centered-rectangular (y ≈ 0.5, |b| > 1):
 *   cmDir 0 → along a (vertical, 90°)
 *   cmDir 1 → along 2b−a (horizontal, 0°)
 *
 * On well-rounded centered-rectangular / hex / square (|a| ≈ |b|):
 *   cmDir 0 → along a+b
 *   cmDir 1 → along b−a
 */
export function resolveCmDirection(cmDir, latticeVec) {
  const { x, y } = latticeVec
  const r2 = x * x + y * y
  const isNotWellRounded = (Math.abs(y - 0.5) < 0.01) && (r2 > 1 + 0.01)

  if (isNotWellRounded) {
    if (cmDir === 0) {
      return { angle: PI / 2, length: 1 }
    } else {
      const dx = 2 * x
      return { angle: 0, length: dx }
    }
  }
  // well-rounded (including hex and square boundary)
  if (cmDir === 0) {
    const dy = 1 + y
    return { angle: Math.atan2(dy, x), length: Math.sqrt(x * x + dy * dy) }
  } else {
    const dy = y - 1
    return { angle: Math.atan2(dy, x), length: Math.sqrt(x * x + dy * dy) }
  }
}
