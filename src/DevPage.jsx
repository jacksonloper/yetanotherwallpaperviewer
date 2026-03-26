/**
 * Dev diagnostic page — p1 only.
 *
 * Shows two side-by-side views:
 *   1. GP field (symmetrized Gaussian Process)
 *   2. FD seeding (Jacobi relaxation from seed points)
 *
 * Controls are shared: same GP parameters drive both views.
 * The seeding view runs at 10× slower than the main app's default
 * (0.5 iter/frame vs 5) so the wavefront propagation is clearly visible.
 */

import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  standardGenerators,
  processGroup,
  generateElements,
  quotientToPhysical,
} from './math/rationalGroup.js'
import { drawGPCoefficients, shoStepGPCoefficients } from './math/gaussianProcess.js'
import GPShaderCanvas from './components/GPShaderCanvas.jsx'
import FDShaderCanvas from './components/FDShaderCanvas.jsx'
import './App.css'

const SCALE = 80
const VIEW_WIDTH = 500
const VIEW_HEIGHT = 400

export default function DevPage() {
  /* ── Shared GP / FD state ── */
  const [gpSeed, setGpSeed] = useState(1)
  const [gpEll, setGpEll] = useState(0.1)
  const [gpN, setGpN] = useState(5)
  const [gpSpeed, setGpSpeed] = useState(0)
  const [gpDamping, setGpDamping] = useState(0.5)

  /* ── FD-specific state ── */
  const [fdCenterSeed, setFdCenterSeed] = useState(1)
  const [fdGpSeed, setFdGpSeed] = useState(1)
  const [fdGpScale, setFdGpScale] = useState(0.1)
  const [fdGpMagnitude, setFdGpMagnitude] = useState(1)
  const [fdIterSpeed, setFdIterSpeed] = useState(0.5) // 10× slower than main default of 5
  const [fdGridScale, setFdGridScale] = useState(0.5)
  const [fdResetTrigger, setFdResetTrigger] = useState(0)

  /* ── p1 group computation (identity-only cosets) ── */
  const latticeVec = useMemo(() => ({ x: 1, y: 0 }), [])
  const latticeVectors = useMemo(() => ({
    v1: { x: 0, y: 1 },
    v2: latticeVec,
  }), [latticeVec])

  const viewWidth = VIEW_WIDTH / SCALE
  const viewHeight = VIEW_HEIGHT / SCALE

  const bounds = useMemo(() => ({
    minX: -viewWidth / 2 - 1,
    maxX: viewWidth / 2 + 1,
    minY: -viewHeight / 2 - 1,
    maxY: viewHeight / 2 + 1,
  }), [viewWidth, viewHeight])

  const gpBounds = useMemo(() => ({
    minX: -viewWidth / 2,
    maxX: viewWidth / 2,
    minY: -viewHeight / 2,
    maxY: viewHeight / 2,
  }), [viewWidth, viewHeight])

  const rationalCosets = useMemo(() => {
    const stdGen = standardGenerators('p1', 0)
    if (!stdGen) return { cosets: null, error: 'Unknown type' }
    const { cosets, error } = processGroup(stdGen.generators)
    if (error) return { cosets: null, error }
    return { cosets, error: null }
  }, [])

  const groupResult = useMemo(() => {
    if (!rationalCosets.cosets) return null
    const cosetReps = quotientToPhysical(rationalCosets.cosets, latticeVec)
    const elements = generateElements(rationalCosets.cosets, latticeVec, bounds)
    return { elements, cosetReps }
  }, [rationalCosets, latticeVec, bounds])

  /* ── GP coefficients (for GP view + shared with animation) ── */
  const initialCoeffs = useMemo(() => {
    if (!latticeVectors) return null
    return drawGPCoefficients(latticeVectors, gpSeed, gpN, gpEll)
  }, [latticeVectors, gpSeed, gpEll, gpN])

  const [gpCoeffs, setGpCoeffs] = useState(null)
  const [prevInitialCoeffs, setPrevInitialCoeffs] = useState(null)

  if (initialCoeffs !== prevInitialCoeffs) {
    setPrevInitialCoeffs(initialCoeffs)
    setGpCoeffs(initialCoeffs)
  }

  useEffect(() => {
    if (!gpSpeed || gpSpeed <= 0) return
    let animId
    let lastTime = null
    const animate = (timestamp) => {
      if (lastTime !== null) {
        const dt = (timestamp - lastTime) / 1000
        setGpCoeffs(prev => prev ? shoStepGPCoefficients(prev, dt, gpSpeed, gpDamping) : prev)
      }
      lastTime = timestamp
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [gpSpeed, gpDamping])

  if (!groupResult) {
    return <div className="app-container"><p>Error computing p1 group.</p></div>
  }

  const { elements, cosetReps } = groupResult

  return (
    <div className="app-container">
      <h1>FD Dev Diagnostics <span style={{ fontSize: '14px', fontWeight: 'normal', opacity: 0.5 }}>(p1)</span></h1>
      <p className="subtitle">
        Side-by-side GP field and seeding process for debugging fundamental domains.{' '}
        <Link to="/" style={{ color: 'inherit' }}>← Back</Link>
      </p>

      {/* ── Controls panel ── */}
      <div className="panel">
        <h3 className="panel-heading">Controls</h3>
        <div className="display-sub">
          <label className="slider-inline">
            ℓ (GP length scale): {gpEll.toFixed(2)}
            <input type="range" min="0.02" max="0.2" step="0.01" value={gpEll}
              onChange={e => setGpEll(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            n (truncation): {gpN}
            <input type="range" min="1" max="15" step="1" value={gpN}
              onChange={e => setGpN(parseInt(e.target.value, 10))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            GP anim speed: {gpSpeed.toFixed(1)}
            <input type="range" min="0" max="10" step="0.1" value={gpSpeed}
              onChange={e => setGpSpeed(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Damping: {gpDamping.toFixed(2)}
            <input type="range" min="0.05" max="2" step="0.05" value={gpDamping}
              onChange={e => setGpDamping(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <button className="btn-secondary" onClick={() => setGpSeed(s => s + 1)}>
            🎲 New GP Draw
          </button>
        </div>

        <h3 className="panel-heading" style={{ marginTop: '12px' }}>Seeding Controls</h3>
        <div className="display-sub">
          <label className="slider-inline">
            Iter speed: {fdIterSpeed.toFixed(1)} iter/frame
            <input type="range" min="0" max="50" step="0.5" value={fdIterSpeed}
              onChange={e => setFdIterSpeed(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Resolution: {fdGridScale.toFixed(2)}× ({Math.round(VIEW_WIDTH * fdGridScale)}×{Math.round(VIEW_HEIGHT * fdGridScale)})
            <input type="range" min="0.1" max="2" step="0.05" value={fdGridScale}
              onChange={e => setFdGridScale(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            FD GP scale (ℓ): {fdGpScale.toFixed(3)}
            <input type="range" min="0.001" max="0.3" step="0.001" value={fdGpScale}
              onChange={e => setFdGpScale(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Magnitude: {fdGpMagnitude.toFixed(1)}
            <input type="range" min="0" max="20" step="0.1" value={fdGpMagnitude}
              onChange={e => setFdGpMagnitude(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <button className="btn-secondary" onClick={() => setFdResetTrigger(s => s + 1)}>
            🔄 Restart from Seeds
          </button>
          <button className="btn-secondary" onClick={() => setFdCenterSeed(s => s + 1)}>
            🎯 New Center
          </button>
          <button className="btn-secondary" onClick={() => setFdGpSeed(s => s + 1)}>
            🎲 New f
          </button>
        </div>
      </div>

      {/* ── Side-by-side views ── */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
        {/* GP view */}
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-text-secondary, #666)' }}>GP Field</h4>
          <div style={{ position: 'relative', width: VIEW_WIDTH, height: VIEW_HEIGHT, border: '1px solid var(--color-svg-container-border, #ccc)', borderRadius: '4px', overflow: 'hidden' }}>
            {gpCoeffs && cosetReps && (
              <GPShaderCanvas
                gpCoeffs={gpCoeffs}
                cosetReps={cosetReps}
                bounds={gpBounds}
                width={VIEW_WIDTH}
                height={VIEW_HEIGHT}
              />
            )}
          </div>
        </div>

        {/* FD seeding view */}
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-text-secondary, #666)' }}>Seeding (Jacobi Relaxation)</h4>
          <div style={{ position: 'relative', width: VIEW_WIDTH, height: VIEW_HEIGHT, border: '1px solid var(--color-svg-container-border, #ccc)', borderRadius: '4px', overflow: 'hidden' }}>
            {elements && cosetReps && latticeVectors && (
              <FDShaderCanvas
                elements={elements}
                cosetReps={cosetReps}
                latticeVectors={latticeVectors}
                bounds={gpBounds}
                width={VIEW_WIDTH}
                height={VIEW_HEIGHT}
                centerSeed={fdCenterSeed}
                gpSeed={fdGpSeed}
                gpScale={fdGpScale}
                gpMagnitude={fdGpMagnitude}
                gpN={gpN}
                iterSpeed={fdIterSpeed}
                gridScale={fdGridScale}
                resetTrigger={fdResetTrigger}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
