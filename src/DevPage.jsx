/**
 * Dev diagnostic page — p1 only.
 *
 * Shows three side-by-side views:
 *   1. GP field (symmetrized Gaussian Process)
 *   2. FD seeding (Jacobi relaxation — label/color assignment)
 *   3. Distance field (Jacobi relaxation — distance to nearest seed)
 *
 * All three views use the same GP function. Controls are shared.
 * The seeding views run very slowly so propagation is clearly visible.
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
  /* ── GP parameters (shared by all three views) ── */
  const [gpSeed, setGpSeed] = useState(1)
  const [gpEll, setGpEll] = useState(0.1)
  const [gpN, setGpN] = useState(5)
  const [gpSpeed, setGpSpeed] = useState(0)
  const [gpDamping, setGpDamping] = useState(0.5)
  const [gpMagnitude, setGpMagnitude] = useState(1)

  /* ── FD-specific state ── */
  const [fdCenterSeed, setFdCenterSeed] = useState(1)
  const [fdIterSpeed, setFdIterSpeed] = useState(0.05)
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

  /* ── GP coefficients (shared across GP view and FD views) ── */
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
        GP field, seeding assignment, and distance field for debugging fundamental domains.{' '}
        <Link to="/" style={{ color: 'inherit' }}>← Back</Link>
      </p>

      {/* ── Controls panel ── */}
      <div className="panel">
        <h3 className="panel-heading">GP Controls</h3>
        <div className="display-sub">
          <label className="slider-inline">
            ℓ (length scale): {gpEll.toFixed(2)}
            <input type="range" min="0.02" max="0.2" step="0.01" value={gpEll}
              onChange={e => setGpEll(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            n (truncation): {gpN}
            <input type="range" min="1" max="15" step="1" value={gpN}
              onChange={e => setGpN(parseInt(e.target.value, 10))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Magnitude: {gpMagnitude.toFixed(1)}
            <input type="range" min="0" max="20" step="0.1" value={gpMagnitude}
              onChange={e => setGpMagnitude(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Animation speed: {gpSpeed.toFixed(1)}
            <input type="range" min="0" max="10" step="0.1" value={gpSpeed}
              onChange={e => setGpSpeed(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Damping: {gpDamping.toFixed(2)}
            <input type="range" min="0.05" max="2" step="0.05" value={gpDamping}
              onChange={e => setGpDamping(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          {/* Shared seed — updates GP view AND both FD views simultaneously */}
          <button className="btn-secondary" onClick={() => setGpSeed(s => s + 1)}>
            🎲 New Draw
          </button>
        </div>

        <h3 className="panel-heading" style={{ marginTop: '12px' }}>Seeding Controls</h3>
        <div className="display-sub">
          <label className="slider-inline">
            Iter speed: {fdIterSpeed.toFixed(2)} iter/frame
            <input type="range" min="0" max="5" step="0.01" value={fdIterSpeed}
              onChange={e => setFdIterSpeed(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <label className="slider-inline">
            Resolution: {fdGridScale.toFixed(2)}× ({Math.round(VIEW_WIDTH * fdGridScale)}×{Math.round(VIEW_HEIGHT * fdGridScale)})
            <input type="range" min="0.1" max="2" step="0.05" value={fdGridScale}
              onChange={e => setFdGridScale(parseFloat(e.target.value))} className="gen-slider" />
          </label>
          <button className="btn-secondary" onClick={() => setFdResetTrigger(s => s + 1)}>
            🔄 Restart from Seeds
          </button>
          <button className="btn-secondary" onClick={() => setFdCenterSeed(s => s + 1)}>
            🎯 New Center
          </button>
        </div>
      </div>

      {/* ── Three side-by-side views ── */}
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

        {/* FD seeding view (label colors) */}
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-text-secondary, #666)' }}>Seeding (Label Assignment)</h4>
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
                gpSeed={gpSeed}
                gpScale={gpEll}
                gpMagnitude={gpMagnitude}
                gpN={gpN}
                iterSpeed={fdIterSpeed}
                gridScale={fdGridScale}
                resetTrigger={fdResetTrigger}
                displayMode="labels"
              />
            )}
          </div>
        </div>

        {/* Distance field view */}
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--color-text-secondary, #666)' }}>Distance to Nearest Seed</h4>
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
                gpSeed={gpSeed}
                gpScale={gpEll}
                gpMagnitude={gpMagnitude}
                gpN={gpN}
                iterSpeed={fdIterSpeed}
                gridScale={fdGridScale}
                resetTrigger={fdResetTrigger}
                displayMode="distance"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
