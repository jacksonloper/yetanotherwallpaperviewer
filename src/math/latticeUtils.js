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
