import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  drawGPCoefficients,
  evaluateGP,
} from './math/gaussianProcess.js'
import {
  standardGenerators,
  processGroup,
  quotientToPhysical,
} from './math/rationalGroup.js'
import { applyToPoint } from './math/isometry.js'
import { fixedLatticeVector } from './math/latticeUtils.js'
import './App.css'

// ───────────────────────────────────────────────────
//  Constants
// ───────────────────────────────────────────────────

const SCALE = 120 // pixels per unit
const SVG_WIDTH = 700
const SVG_HEIGHT = 600

// P3 hexagonal lattice
const HEX_VEC = fixedLatticeVector('hexagonal') // { x: sqrt(3)/2, y: 1/2 }
const V1 = { x: 0, y: 1 }
const V2 = HEX_VEC

// P3 cone points in lattice coordinates: (0,0), (1/3,1/3), (2/3,2/3)
// Convert to physical coordinates via C = [[0, x], [1, y]]
function latticeToPhysical(lx, ly) {
  return { x: V2.x * ly, y: lx + V2.y * ly }
}

const CONE_A = latticeToPhysical(0, 0)             // origin
const CONE_B = latticeToPhysical(1 / 3, 1 / 3)     // (√3/6, 1/2)
const CONE_C = latticeToPhysical(2 / 3, 2 / 3)     // (√3/3, 1)

// ───────────────────────────────────────────────────
//  P3 group setup
// ───────────────────────────────────────────────────

function getP3Setup() {
  const std = standardGenerators('p3')
  const { cosets } = processGroup(std.generators)
  const physicalCosets = quotientToPhysical(cosets, HEX_VEC)
  return { cosets, physicalCosets, latticeVec: HEX_VEC }
}

// ───────────────────────────────────────────────────
//  Equivariant vector field evaluation
// ───────────────────────────────────────────────────

/**
 * Evaluate the P3-equivariant 2D vector field at a point (x, y).
 *
 * Uses the Reynolds averaging approach: given two independent GPs
 * (gp1, gp2 from wind coefficients), the equivariant field is:
 *   V_sym(r) = (1/|P|) Σ_{g ∈ P} R_g^{-1} · V_raw(g(r))
 * where V_raw = (gp1, gp2) and R_g is the linear part of coset rep g.
 *
 * For P3 specifically (rotation-only group), R_g^{-1} = R_g^T.
 */
function evaluateEquivariantField(windCoeffs, x, y, physicalCosets) {
  let vx = 0, vy = 0
  const n = physicalCosets.length

  for (const g of physicalCosets) {
    // Apply g to (x, y)
    const gx = g.a * x + g.b * y + g.tx
    const gy = g.c * x + g.d * y + g.ty

    // Evaluate raw field at g(r)
    const f1 = evaluateGP(windCoeffs.gp1, gx, gy)
    const f2 = evaluateGP(windCoeffs.gp2, gx, gy)

    // Apply R_g^{-1} = R_g^T (since R_g is orthogonal rotation)
    // R_g = [[g.a, g.b], [g.c, g.d]], so R_g^T = [[g.a, g.c], [g.b, g.d]]
    vx += g.a * f1 + g.c * f2
    vy += g.b * f1 + g.d * f2
  }

  return { vx: vx / n, vy: vy / n }
}

// ───────────────────────────────────────────────────
//  Path utilities
// ───────────────────────────────────────────────────

/** Create a straight path from point A to point B with n beads. */
function initStraightPath(a, b, n) {
  const beads = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    beads.push({
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    })
  }
  return beads
}

/** Compute arc-length parameterization and resample uniformly. */
function rediscretizePath(beads, n) {
  if (beads.length < 2) return beads

  // Compute cumulative arc lengths
  const cumLen = [0]
  for (let i = 1; i < beads.length; i++) {
    const dx = beads[i].x - beads[i - 1].x
    const dy = beads[i].y - beads[i - 1].y
    cumLen.push(cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  const totalLen = cumLen[cumLen.length - 1]
  if (totalLen < 1e-12) return beads

  // Resample uniformly
  const newBeads = []
  for (let i = 0; i < n; i++) {
    const targetLen = n === 1 ? totalLen / 2 : (i / (n - 1)) * totalLen
    // Find segment
    let seg = 0
    while (seg < cumLen.length - 2 && cumLen[seg + 1] < targetLen) seg++
    const segLen = cumLen[seg + 1] - cumLen[seg]
    const t = segLen > 1e-12 ? (targetLen - cumLen[seg]) / segLen : 0
    newBeads.push({
      x: beads[seg].x + t * (beads[seg + 1].x - beads[seg].x),
      y: beads[seg].y + t * (beads[seg + 1].y - beads[seg].y),
    })
  }
  return newBeads
}

/** Evolve beads by one Euler step. */
function evolveBeads(beads, windCoeffs, physicalCosets, dt) {
  return beads.map(b => {
    const { vx, vy } = evaluateEquivariantField(windCoeffs, b.x, b.y, physicalCosets)
    return { x: b.x + vx * dt, y: b.y + vy * dt }
  })
}

// ───────────────────────────────────────────────────
//  Generate visible group elements for rendering
// ───────────────────────────────────────────────────

function generateVisibleElements(physicalCosets, bounds) {
  const elements = []
  const range = 8
  for (const rep of physicalCosets) {
    for (let a = -range; a <= range; a++) {
      for (let b = -range; b <= range; b++) {
        const tx = a * V1.x + b * V2.x
        const ty = a * V1.y + b * V2.y
        // Compose translation with rep
        const elem = {
          a: rep.a, b: rep.b, c: rep.c, d: rep.d,
          tx: rep.a * 0 + rep.b * 0 + rep.tx + tx,
          ty: rep.c * 0 + rep.d * 0 + rep.ty + ty,
        }
        // Actually: compose(translation(tx,ty), rep) = same linear, translation = rep_trans + (tx,ty)
        // Check if origin image is in bounds
        if (elem.tx >= bounds.minX && elem.tx <= bounds.maxX &&
            elem.ty >= bounds.minY && elem.ty <= bounds.maxY) {
          elements.push(elem)
        }
      }
    }
  }
  return elements
}

// ───────────────────────────────────────────────────
//  SVG helpers
// ───────────────────────────────────────────────────

function toSvg(x, y, cx, cy) {
  return { x: cx + x * SCALE, y: cy - y * SCALE }
}

function pathToSvgD(beads, cx, cy) {
  if (beads.length === 0) return ''
  const first = toSvg(beads[0].x, beads[0].y, cx, cy)
  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < beads.length; i++) {
    const p = toSvg(beads[i].x, beads[i].y, cx, cy)
    d += ` L ${p.x} ${p.y}`
  }
  return d
}

// ───────────────────────────────────────────────────
//  Main component
// ───────────────────────────────────────────────────

const DEFAULT_BEADS = 60
const DEFAULT_SPEED = 0.3
const DT = 0.016 // ~60fps timestep
const REDISCRETIZE_INTERVAL = 20 // re-discretize every N frames

export default function P3OrbifoldPage() {
  const [numBeads, setNumBeads] = useState(DEFAULT_BEADS)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [seed, setSeed] = useState(42)
  const [running, setRunning] = useState(true)

  // P3 setup (memoized, never changes)
  const p3 = useMemo(() => getP3Setup(), [])

  // Wind coefficients (GP-based vector field)
  const windRef = useRef(null)
  const beadsRef = useRef(null)
  const frameCountRef = useRef(0)
  const animRef = useRef(null)

  // SVG drawing state
  const [pathData, setPathData] = useState([])

  // Initialize/reset
  const reset = useCallback((newSeed) => {
    const s = newSeed ?? seed
    const latticeVectors = { v1: V1, v2: V2 }
    // Draw two independent GPs for the 2D vector field
    windRef.current = {
      gp1: drawGPCoefficients(latticeVectors, s, 5, 0.15),
      gp2: drawGPCoefficients(latticeVectors, s + 1000, 5, 0.15),
    }
    // Initialize path between two cone points
    beadsRef.current = initStraightPath(CONE_A, CONE_B, numBeads)
    frameCountRef.current = 0
    setPathData([...beadsRef.current])
  }, [seed, numBeads])

  // Initialize on mount
  useEffect(() => {
    reset(seed)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-initialize when seed or numBeads changes
  useEffect(() => {
    reset(seed)
  }, [seed, numBeads]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop
  useEffect(() => {
    if (!running) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    let lastTime = null

    function animate(timestamp) {
      if (!windRef.current || !beadsRef.current) {
        animRef.current = requestAnimationFrame(animate)
        return
      }

      if (lastTime === null) lastTime = timestamp
      const elapsed = (timestamp - lastTime) / 1000
      lastTime = timestamp

      // Cap dt to avoid huge jumps
      const dt = Math.min(elapsed, 0.05) * speed

      if (dt > 0) {
        // Evolve beads
        beadsRef.current = evolveBeads(
          beadsRef.current, windRef.current, p3.physicalCosets, dt
        )
        frameCountRef.current++

        // Periodically re-discretize to maintain even spacing
        if (frameCountRef.current % REDISCRETIZE_INTERVAL === 0) {
          beadsRef.current = rediscretizePath(beadsRef.current, numBeads)
        }

        setPathData([...beadsRef.current])
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [running, speed, numBeads, p3.physicalCosets])

  // Generate visible group elements for the viewport
  const svgCx = SVG_WIDTH / 2
  const svgCy = SVG_HEIGHT / 2
  const bounds = useMemo(() => ({
    minX: -SVG_WIDTH / (2 * SCALE) - 1,
    maxX: SVG_WIDTH / (2 * SCALE) + 1,
    minY: -SVG_HEIGHT / (2 * SCALE) - 1,
    maxY: SVG_HEIGHT / (2 * SCALE) + 1,
  }), [])

  const visibleElements = useMemo(
    () => generateVisibleElements(p3.physicalCosets, bounds),
    [p3.physicalCosets, bounds]
  )

  // Transform path beads for each visible group element
  const transformedPaths = useMemo(() => {
    if (pathData.length === 0) return []
    return visibleElements.map(elem => {
      const transformed = pathData.map(b => applyToPoint(elem, b.x, b.y))
      return pathToSvgD(transformed, svgCx, svgCy)
    })
  }, [pathData, visibleElements, svgCx, svgCy])

  // Cone points for all visible elements
  const visibleConePoints = useMemo(() => {
    const points = []
    const cones = [CONE_A, CONE_B, CONE_C]
    for (const elem of visibleElements) {
      for (const cone of cones) {
        const p = applyToPoint(elem, cone.x, cone.y)
        const svgP = toSvg(p.x, p.y, svgCx, svgCy)
        // Deduplicate (within tolerance)
        const dup = points.some(
          q => Math.abs(q.x - svgP.x) < 1 && Math.abs(q.y - svgP.y) < 1
        )
        if (!dup) points.push(svgP)
      }
    }
    return points
  }, [visibleElements, svgCx, svgCy])

  // Path colors - cycle through a palette for different group copies
  const pathColors = useMemo(() => {
    const baseColors = [
      '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
      '#1abc9c', '#e67e22', '#34495e', '#e91e63',
    ]
    return visibleElements.map((_, i) => baseColors[i % baseColors.length])
  }, [visibleElements])

  const handleNewField = () => {
    const newSeed = Math.floor(Math.random() * 100000)
    setSeed(newSeed)
  }

  return (
    <div className="app-container">
      <h1>P3 Orbifold Path Explorer</h1>
      <p className="subtitle">
        A random vector field equivariant under the P3 wallpaper group evolves
        a path between cone points of the orbifold. The path is shown with all
        copies under the P3 symmetry group.
      </p>

      {/* Controls */}
      <div className="panel">
        <h3 className="panel-heading">Controls</h3>
        <div className="lattice-params" style={{ gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            Beads:
            <input
              type="range" min="10" max="200" value={numBeads}
              onChange={e => setNumBeads(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="slider-value">{numBeads}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            Speed:
            <input
              type="range" min="0.05" max="2" step="0.05" value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="slider-value">{speed.toFixed(2)}</span>
          </label>
          <button className="btn-secondary" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn-secondary" onClick={handleNewField}>
            🎲 New Field
          </button>
          <button className="btn-secondary" onClick={() => reset()}>
            ↺ Reset Path
          </button>
        </div>
      </div>

      {/* SVG Visualization */}
      <div style={{
        background: 'var(--color-svg-container-bg)',
        border: '1px solid var(--color-svg-container-border)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        >
          {/* Background */}
          <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="var(--color-svg-container-bg)" />

          {/* Paths for all visible group copies */}
          {transformedPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={pathColors[i]}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          ))}

          {/* Cone points */}
          {visibleConePoints.map((p, i) => (
            <circle
              key={`cone-${i}`}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="#2ecc71"
              stroke="#fff"
              strokeWidth={1}
              opacity={0.8}
            />
          ))}
        </svg>
      </div>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
        <Link to="/">← Back to Viewer</Link>
      </p>
    </div>
  )
}
