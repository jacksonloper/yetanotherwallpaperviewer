import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  drawGPCoefficients,
  evaluateGPGradient,
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
 * Evaluate the P3-equivariant 2D vector field at a point (x, y),
 * decomposed into curl (divergence-free) and gradient (curl-free) parts.
 *
 * Uses two invariant scalar GPs:
 *   - gp1 as stream function ψ → curl(ψ) = (∂ψ/∂y, −∂ψ/∂x)  (divergence-free)
 *   - gp2 as potential φ → grad(φ) = (∂φ/∂x, ∂φ/∂y)         (curl-free)
 *
 * Each is symmetrized under the P3 point group via:
 *   grad(ψ_sym)(r) = (1/|P|) Σ_g R_g^T · ∇ψ(g(r))
 *
 * Then the field is:
 *   V = curlAmount · curl(ψ_sym) + divAmount · grad(φ_sym)
 */
function evaluateEquivariantField(windCoeffs, x, y, physicalCosets, curlAmount, divAmount) {
  let curlVx = 0, curlVy = 0
  let divVx = 0, divVy = 0
  const n = physicalCosets.length

  for (const g of physicalCosets) {
    // Apply g to (x, y)
    const gx = g.a * x + g.b * y + g.tx
    const gy = g.c * x + g.d * y + g.ty

    // Gradient of stream function ψ at g(r)
    const gradPsi = evaluateGPGradient(windCoeffs.gp1, gx, gy)
    // Gradient of potential φ at g(r)
    const gradPhi = evaluateGPGradient(windCoeffs.gp2, gx, gy)

    // Apply R_g^T to rotate gradients back
    // R_g = [[g.a, g.b], [g.c, g.d]], R_g^T = [[g.a, g.c], [g.b, g.d]]
    const psiX = g.a * gradPsi.dx + g.c * gradPsi.dy
    const psiY = g.b * gradPsi.dx + g.d * gradPsi.dy

    const phiX = g.a * gradPhi.dx + g.c * gradPhi.dy
    const phiY = g.b * gradPhi.dx + g.d * gradPhi.dy

    // curl(ψ) = (∂ψ/∂y, −∂ψ/∂x)
    curlVx += psiY
    curlVy += -psiX

    // grad(φ) = (∂φ/∂x, ∂φ/∂y)
    divVx += phiX
    divVy += phiY
  }

  return {
    vx: curlAmount * curlVx / n + divAmount * divVx / n,
    vy: curlAmount * curlVy / n + divAmount * divVy / n,
  }
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
function evolveBeads(beads, windCoeffs, physicalCosets, dt, curlAmount, divAmount) {
  return beads.map(b => {
    const { vx, vy } = evaluateEquivariantField(windCoeffs, b.x, b.y, physicalCosets, curlAmount, divAmount)
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
          tx: rep.tx + tx,
          ty: rep.ty + ty,
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
const DEFAULT_SPEED = 0.05
const DEFAULT_CURL = 0.2
const DEFAULT_DIVERGENCE = 0
const MIN_SPEED = 0.01
const MAX_SPEED = 0.5
const SPEED_STEP = 0.01
const MIN_COMPONENT_AMOUNT = 0
const MAX_COMPONENT_AMOUNT = 1
const COMPONENT_STEP = 0.05
const REDISCRETIZE_INTERVAL = 20 // re-discretize every N frames

export default function P3OrbifoldPage() {
  const [numBeads, setNumBeads] = useState(DEFAULT_BEADS)
  const [speed, setSpeed] = useState(DEFAULT_SPEED)
  const [seed, setSeed] = useState(42)
  const [running, setRunning] = useState(true)
  const [curlAmount, setCurlAmount] = useState(DEFAULT_CURL)
  const [divAmount, setDivAmount] = useState(DEFAULT_DIVERGENCE)
  const [direction, setDirection] = useState(1)

  // P3 setup (memoized, never changes)
  const p3 = useMemo(() => getP3Setup(), [])

  // Wind coefficients (GP-based vector field)
  const windRef = useRef(null)
  const beadsRef = useRef(null)
  const frameCountRef = useRef(0)
  const animRef = useRef(null)
  const curlRef = useRef(DEFAULT_CURL)
  const divRef = useRef(DEFAULT_DIVERGENCE)
  const directionRef = useRef(1)

  // Keep curl/div refs in sync with state (for animation loop)
  useEffect(() => { curlRef.current = curlAmount }, [curlAmount])
  useEffect(() => { divRef.current = divAmount }, [divAmount])
  useEffect(() => { directionRef.current = direction }, [direction])

  // SVG drawing state
  const [pathData, setPathData] = useState([])

  // Initialize/reset
  const reset = useCallback((newSeed) => {
    const s = newSeed ?? seed
    const latticeVectors = { v1: V1, v2: V2 }
    // Draw two independent GPs: one for stream function (curl), one for potential (divergence)
    windRef.current = {
      gp1: drawGPCoefficients(latticeVectors, s, 5, 0.15),
      gp2: drawGPCoefficients(latticeVectors, s + 1000, 5, 0.15),
    }
    // Initialize path between two cone points
    beadsRef.current = initStraightPath(CONE_A, CONE_B, numBeads)
    frameCountRef.current = 0
    setPathData([...beadsRef.current])
  }, [seed, numBeads])

  // Initialize on mount and reinitialize when seed or numBeads changes
  useEffect(() => {
    reset(seed)
  }, [reset, seed])

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
      const dt = Math.min(elapsed, 0.05) * speed * directionRef.current

      if (Math.abs(dt) > 1e-9) {
        // Evolve beads
        beadsRef.current = evolveBeads(
          beadsRef.current, windRef.current, p3.physicalCosets, dt,
          curlRef.current, divRef.current
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

  const handleStop = () => {
    setRunning(false)
    setDirection(1)
    reset()
  }

  const handleReverse = () => {
    setDirection(current => -current)
    setRunning(true)
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
              type="range" min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="slider-value">{speed.toFixed(2)}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            Curl:
            <input
              type="range"
              min={MIN_COMPONENT_AMOUNT}
              max={MAX_COMPONENT_AMOUNT}
              step={COMPONENT_STEP}
              value={curlAmount}
              onChange={e => setCurlAmount(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="slider-value">{curlAmount.toFixed(2)}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            Divergence:
            <input
              type="range"
              min={MIN_COMPONENT_AMOUNT}
              max={MAX_COMPONENT_AMOUNT}
              step={COMPONENT_STEP}
              value={divAmount}
              onChange={e => setDivAmount(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span className="slider-value">{divAmount.toFixed(2)}</span>
          </label>
          <button className="btn-secondary" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="btn-secondary" onClick={handleStop}>
            ⏹ Stop
          </button>
          <button className="btn-secondary" onClick={handleReverse}>
            {direction > 0 ? '↩ Reverse' : '↪ Forward'}
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
