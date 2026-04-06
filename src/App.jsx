import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getWallpaperTypeByName,
  getGeneratorsForVariant,
} from './math/wallpaperGroups.js'
import {
  standardGenerators,
  processGroup,
  generateElements,
  quotientToPhysical,
  rmatToJsonObj,
} from './math/rationalGroup.js'
import { getViableSupergroups, getExtraGenerators } from './math/supergroups.js'
import GroupVisualization, { SCALE, SVG_WIDTH, SVG_HEIGHT } from './components/GroupVisualization.jsx'
import LatticeControls from './components/LatticeControls.jsx'
import WallpaperGroupSelector from './components/WallpaperGroupSelector.jsx'
import SupergroupControls from './components/SupergroupControls.jsx'
import {
  latticeToVector,
  getLatticeType,
  classifyLatticeVector,
  cmSliderToVector,
  rectSliderToVector,
  fixedLatticeVector,
} from './math/latticeUtils.js'
import './App.css'

/**
 * Compute the second lattice vector from the app state.
 */
function getLatticeVector(wpType, latticeState) {
  switch (wpType.latticeControl) {
    case 'none':
      return fixedLatticeVector(wpType.fixedLattice)
    case 'rect-to-square':
      return rectSliderToVector(latticeState.rectSlider ?? 0.5)
    case 'cm-slider':
      return cmSliderToVector(latticeState.cmSlider ?? 0.8125)
    case 'full':
    default:
      return latticeToVector(latticeState.fullLattice ?? { mode: 'well-rounded', sliderValue: 0 })
  }
}

/**
 * Build JSON spec for copy-to-clipboard.
 *
 * The wallpaper group is a floating-point lattice together with
 * rational affine transforms in lattice coordinates.  The JSON
 * records the lattice vectors as numbers and the generator matrices
 * with exact rational entries stored as strings (e.g. "1/2").
 */
function buildJsonSpec(wallpaperType, variantIndex, latticeVec) {
  const stdGen = standardGenerators(wallpaperType, variantIndex)
  const spec = {
    wallpaper_type: wallpaperType,
    lattice_vectors: [
      [0, 1],
      [parseFloat(latticeVec.x.toFixed(6)), parseFloat(latticeVec.y.toFixed(6))],
    ],
    generators: stdGen ? stdGen.generators.map(rmatToJsonObj) : [],
  }
  return JSON.stringify(spec, null, 2)
}

export default function App() {
  const [wallpaperType, setWallpaperType] = useState('p4')
  const [variantIndex, setVariantIndex] = useState(0)
  const [latticeState, setLatticeState] = useState({
    rectSlider: 0.5,
    cmSlider: 0.8125,
    fullLattice: { mode: 'well-rounded', sliderValue: 0 },
  })
  const [copySuccess, setCopySuccess] = useState(false)
  const [showF, setShowF] = useState(true)
  const [fOffsetX, setFOffsetX] = useState(0)
  const [fOffsetY, setFOffsetY] = useState(0)
  const [showGP, setShowGP] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [particleMode, setParticleMode] = useState('vector') // 'vector','curl','divergence','eq-vector','eq-pseudovector'
  const [particleSpawnRate, setParticleSpawnRate] = useState(8.5)
  const [particleFadeSpeed, setParticleFadeSpeed] = useState(0.015)
  const [particleTailLength, setParticleTailLength] = useState(40)
  const [particleMaxCount, setParticleMaxCount] = useState(1350)
  const [particleDotSize, setParticleDotSize] = useState(2)
  const [showGroupElements, setShowGroupElements] = useState(true)
  const [gpSeed, setGpSeed] = useState(1)
  const [gpEll, setGpEll] = useState(0.1)
  const [gpN, setGpN] = useState(5)
  const [gpSpeed, setGpSpeed] = useState(0)
  const [gpDamping, setGpDamping] = useState(0.5)
  const [gpEqMode, setGpEqMode] = useState(0) // 0=invariant, 1=pseudoscalar, 2=p3 perm, 3=p2 perm
  const [viewZoom, setViewZoom] = useState(2.25)
  const [canvasResolution, setCanvasResolution] = useState(1.5)
  const [activeSupergroup, setActiveSupergroup] = useState(null)

  const wpType = useMemo(() => getWallpaperTypeByName(wallpaperType), [wallpaperType])

  const generators = useMemo(
    () => getGeneratorsForVariant(wpType, variantIndex),
    [wpType, variantIndex]
  )

  const latticeVec = useMemo(
    () => getLatticeVector(wpType, latticeState),
    [wpType, latticeState]
  )

  const latticeType = useMemo(() => {
    if (wpType.latticeControl === 'none') return wpType.fixedLattice
    if (wpType.latticeControl === 'rect-to-square') {
      return classifyLatticeVector(latticeVec.x, latticeVec.y)
    }
    if (wpType.latticeControl === 'cm-slider') {
      return classifyLatticeVector(latticeVec.x, latticeVec.y)
    }
    if (wpType.latticeControl === 'full') {
      return getLatticeType(latticeState.fullLattice ?? { mode: 'well-rounded', sliderValue: 0 })
    }
    return 'oblique'
  }, [wpType, latticeVec, latticeState])

  const handleWallpaperTypeChange = (typeName) => {
    setWallpaperType(typeName)
    setVariantIndex(0)
    setGpEqMode(0)
    setParticleMode('vector')
    setActiveSupergroup(null)
  }

  const handleVariantChange = (idx) => {
    setVariantIndex(idx)
  }

  const handleLatticeStateChange = useCallback((newState) => {
    setLatticeState(prev => ({ ...prev, ...newState }))
  }, [])

  // Stage 1: Enumerate G/T cosets in rational (lattice) coordinates.
  // This depends only on the wallpaper type and variant, NOT on the
  // lattice vector, so lattice changes skip this computation entirely.
  const rationalCosets = useMemo(() => {
    try {
      const stdGen = standardGenerators(wallpaperType, variantIndex)
      if (!stdGen) {
        return { cosets: null, error: `Unknown wallpaper type: ${wallpaperType}`, warning: null }
      }
      const { cosets, isDegenerate, error: groupError } = processGroup(stdGen.generators)
      if (groupError) {
        return { cosets: null, error: groupError, warning: null }
      }
      const warning = isDegenerate ? 'Group appears degenerate.' : null
      return { cosets, error: null, warning }
    } catch (err) {
      return { cosets: null, error: `Error: ${err.message}`, warning: null }
    }
  }, [wallpaperType, variantIndex])

  // Stage 2: Convert rational cosets to physical isometries and generate
  // all visible elements.  This runs when the lattice changes but does
  // NOT re-enumerate G/T.
  const groupResult = useMemo(() => {
    if (rationalCosets.error || !rationalCosets.cosets) {
      return { result: null, error: rationalCosets.error, warning: rationalCosets.warning }
    }
    try {
      const { cosets } = rationalCosets
      const vec = latticeVec

      // Convert coset representatives to physical isometries (for GP point group)
      const cosetReps = quotientToPhysical(cosets, vec)

      // Generate all visible elements from cosets + lattice translations
      // Bounds expand when zoomed out (zoom < 1), shrink when zoomed in (zoom > 1)
      const latticeVectors = { v1: { x: 0, y: 1 }, v2: vec }
      const effectiveScale = SCALE * viewZoom
      const bounds = {
        minX: -SVG_WIDTH / (2 * effectiveScale) - 1,
        maxX: SVG_WIDTH / (2 * effectiveScale) + 1,
        minY: -SVG_HEIGHT / (2 * effectiveScale) - 1,
        maxY: SVG_HEIGHT / (2 * effectiveScale) + 1,
      }
      const elements = generateElements(cosets, vec, bounds)

      return { result: { elements, latticeVectors, cosetReps }, error: null, warning: rationalCosets.warning }
    } catch (err) {
      return { result: null, error: `Error: ${err.message}`, warning: rationalCosets.warning }
    }
  }, [rationalCosets, latticeVec, viewZoom])

  const { result, error, warning } = groupResult

  // Invalidate supergroup when lattice type or variant changes make it unviable
  useEffect(() => {
    if (activeSupergroup) {
      const viable = getViableSupergroups(wallpaperType, latticeType, variantIndex)
      if (!viable.includes(activeSupergroup)) {
        setActiveSupergroup(null)
      }
    }
  }, [latticeType, wallpaperType, variantIndex, activeSupergroup])

  // Compute supergroup visualization when a supergroup is active
  const supergroupResult = useMemo(() => {
    if (!activeSupergroup) return null
    try {
      const extra = getExtraGenerators(wallpaperType, variantIndex, activeSupergroup)
      if (!extra) return null
      const currentGens = standardGenerators(wallpaperType, variantIndex)?.generators ?? []
      const allGens = [...currentGens, ...extra]
      const { cosets, isDegenerate, error: groupError } = processGroup(allGens)
      if (groupError || isDegenerate) return null

      const cosetReps = quotientToPhysical(cosets, latticeVec)
      const latticeVectors = { v1: { x: 0, y: 1 }, v2: latticeVec }
      const effectiveScale = SCALE * viewZoom
      const bounds = {
        minX: -SVG_WIDTH / (2 * effectiveScale) - 1,
        maxX: SVG_WIDTH / (2 * effectiveScale) + 1,
        minY: -SVG_HEIGHT / (2 * effectiveScale) - 1,
        maxY: SVG_HEIGHT / (2 * effectiveScale) + 1,
      }
      const elements = generateElements(cosets, latticeVec, bounds)
      return { elements, latticeVectors, cosetReps }
    } catch {
      return null
    }
  }, [activeSupergroup, wallpaperType, variantIndex, latticeVec, viewZoom])

  // Use supergroup result for visualization when active, otherwise base group
  const displayResult = (activeSupergroup && supergroupResult) ? supergroupResult : result

  const handleSupergroupToggle = useCallback((sgName) => {
    setActiveSupergroup(prev => prev === sgName ? null : sgName)
    setGpEqMode(0)
  }, [])

  const copyToClipboard = useCallback(() => {
    const json = buildJsonSpec(wallpaperType, variantIndex, latticeVec)
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 1500)
    }).catch(() => {
      // Clipboard API may be unavailable (e.g. insecure context)
    })
  }, [wallpaperType, variantIndex, latticeVec])

  // Groups whose point group contains at least one det=-1 element (reflection/glide).
  // The 5 rotation-only groups (p1, p2, p3, p4, p6) have all det=+1 cosets.
  const hasReflection = ['pm', 'pg', 'pmm', 'pmg', 'pgg', 'cm', 'cmm', 'p4m', 'p4g', 'p3m1', 'p31m', 'p6m'].includes(wallpaperType)

  // GP equivariance options depend on the wallpaper type
  const gpEqOptions = wallpaperType === 'p2'
    ? [{ value: 0, label: 'Invariant' }, { value: 3, label: 'Equivariant (permutation)' }]
    : wallpaperType === 'p3'
    ? [{ value: 0, label: 'Invariant' }, { value: 2, label: 'Equivariant (permutation)' }]
    : hasReflection
    ? [{ value: 0, label: 'Invariant' }, { value: 1, label: 'Equivariant (pseudoscalar)' }]
    : null // p1, p4, p6: invariant only

  return (
    <div className="app-container">
      <h1>Wallpaper Group Viewer</h1>
      <p className="subtitle">
        Pick a wallpaper group, then adjust the lattice. Updates live.
      </p>

      {/* ── Section 1: Symmetry Group ── */}
      <div className="panel">
        <h3 className="panel-heading">Symmetry Group</h3>

        <WallpaperGroupSelector
          value={wallpaperType}
          onChange={handleWallpaperTypeChange}
        />

        {/* Direction variant radios — part of the group choice */}
        {wpType.variants && wpType.variants.length > 1 && (
          <div className="variant-radios">
            <span className="variant-label">Orientation:</span>
            {wpType.variants.map((v, i) => (
              <label key={i} className="variant-radio-label">
                <input
                  type="radio"
                  name="variant"
                  checked={variantIndex === i}
                  onChange={() => handleVariantChange(i)}
                />
                {v.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Lattice ── */}
      <LatticeControls
        wpType={wpType}
        latticeState={latticeState}
        latticeVec={latticeVec}
        latticeType={latticeType}
        onChange={handleLatticeStateChange}
      />

      {/* ── Section 3: Display Settings ── */}
      <div className="panel">
        <h3 className="panel-heading">Display Settings</h3>

        <div className="display-toggles">
          <label className="toggle-label">
            <input type="checkbox" checked={showF} onChange={(e) => setShowF(e.target.checked)} />
            Show F
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showGP} onChange={(e) => { setShowGP(e.target.checked); if (e.target.checked) { setShowParticles(false); } }} />
            Show GP
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showParticles} onChange={(e) => { setShowParticles(e.target.checked); if (e.target.checked) { setShowGP(false); } }} />
            Show Particles
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showGroupElements} onChange={(e) => setShowGroupElements(e.target.checked)} />
            Show Group Elements
          </label>
        </div>

        {/* F-shape offset — revealed when Show F is on */}
        {showF && (
          <div className="display-sub">
            <label className="slider-inline">
              F offset x: {fOffsetX.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fOffsetX}
                onChange={(e) => setFOffsetX(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              F offset y: {fOffsetY.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fOffsetY}
                onChange={(e) => setFOffsetY(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
          </div>
        )}

        {/* GP / Particle controls — revealed when Show GP or Show Particles is on */}
        {(showGP || showParticles) && (
          <div className="display-sub">
            <label className="slider-inline">
              ℓ (length scale): {gpEll.toFixed(2)}
              <input
                type="range"
                min="0.02"
                max="0.2"
                step="0.01"
                value={gpEll}
                onChange={(e) => setGpEll(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              n (truncation): {gpN}
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={gpN}
                onChange={(e) => setGpN(parseInt(e.target.value, 10))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Animation speed: {gpSpeed.toFixed(1)}
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={gpSpeed}
                onChange={(e) => setGpSpeed(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Damping: {gpDamping.toFixed(2)}
              <input
                type="range"
                min="0.05"
                max="2"
                step="0.05"
                value={gpDamping}
                onChange={(e) => setGpDamping(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <button className="btn-secondary" onClick={() => setGpSeed(s => s + 1)}>
              🎲 New Draw
            </button>
            {showGP && gpEqOptions && (
              <label className="toggle-label">
                <select
                  value={gpEqMode}
                  onChange={(e) => { const v = Number(e.target.value); setGpEqMode(v); if (v > 0) setActiveSupergroup(null); }}
                >
                  {gpEqOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
            )}
            <label className="slider-inline">
              Zoom: {viewZoom.toFixed(2)}×
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.25"
                value={viewZoom}
                onChange={(e) => setViewZoom(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Resolution: {canvasResolution.toFixed(1)}×
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.25"
                value={canvasResolution}
                onChange={(e) => setCanvasResolution(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
          </div>
        )}

        {/* Particle-specific controls */}
        {showParticles && (
          <div className="display-sub">
            <label className="toggle-label">
              <select
                value={particleMode}
                onChange={(e) => setParticleMode(e.target.value)}
              >
                {hasReflection ? (
                  <>
                    <option value="vector-v">Vector field (vector)</option>
                    <option value="vector-pv">Vector field (pseudovector)</option>
                    <option value="curl-v">Curl only (vector)</option>
                    <option value="curl-pv">Curl only (pseudovector)</option>
                    <option value="div-v">Divergence only (vector)</option>
                    <option value="div-pv">Divergence only (pseudovector)</option>
                  </>
                ) : (
                  <>
                    <option value="vector">Vector field</option>
                    <option value="curl">Curl only</option>
                    <option value="divergence">Divergence only</option>
                  </>
                )}
              </select>
            </label>
            <label className="slider-inline">
              Spawn rate: {particleSpawnRate.toFixed(1)}
              <input
                type="range"
                min="1"
                max="16"
                step="0.5"
                value={particleSpawnRate}
                onChange={(e) => setParticleSpawnRate(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Fade speed: {particleFadeSpeed.toFixed(4)}
              <input
                type="range"
                min="0.001"
                max="0.030"
                step="0.001"
                value={particleFadeSpeed}
                onChange={(e) => setParticleFadeSpeed(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Trail persistence: {particleTailLength}
              <input
                type="range"
                min="1"
                max="80"
                step="1"
                value={particleTailLength}
                onChange={(e) => setParticleTailLength(parseInt(e.target.value, 10))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Max particles: {particleMaxCount}
              <input
                type="range"
                min="100"
                max="2600"
                step="50"
                value={particleMaxCount}
                onChange={(e) => setParticleMaxCount(parseInt(e.target.value, 10))}
                className="gen-slider"
              />
            </label>
            <label className="slider-inline">
              Dot size: {particleDotSize}
              <input
                type="range"
                min="1"
                max="4"
                step="0.5"
                value={particleDotSize}
                onChange={(e) => setParticleDotSize(parseFloat(e.target.value))}
                className="gen-slider"
              />
            </label>
          </div>
        )}

        <div className="display-actions">
          <button className="btn-copy" onClick={copyToClipboard}>
            📋 Copy JSON
          </button>
          {copySuccess && <span className="copy-success">✓ Copied!</span>}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="error-box">{error}</div>
      )}

      {/* Warning display */}
      {warning && (
        <div className="warning-box">{warning}</div>
      )}

      {/* Visualization */}
      {displayResult && (
        <GroupVisualization
          elements={displayResult.elements}
          latticeVectors={displayResult.latticeVectors}
          cosetReps={displayResult.cosetReps}
          showF={showF}
          fOffset={{ x: fOffsetX, y: fOffsetY }}
          showGP={showGP}
          showParticles={showParticles}
          particleSpawnRate={particleSpawnRate}
          particleFadeSpeed={particleFadeSpeed}
          particleTailLength={particleTailLength}
          particleMaxCount={particleMaxCount}
          particleDotSize={particleDotSize}
          showGroupElements={showGroupElements}
          gpSeed={gpSeed}
          gpEll={gpEll}
          gpN={gpN}
          gpSpeed={gpSpeed}
          gpDamping={gpDamping}
          gpEqMode={gpEqMode}
          viewZoom={viewZoom}
          canvasResolution={canvasResolution}
          curlMode={{
            vector: 0, curl: 1, divergence: 3,
            'vector-v': 0, 'vector-pv': 5,
            'curl-v': 2, 'curl-pv': 1,
            'div-v': 3, 'div-pv': 4,
          }[particleMode] || 0}
        />
      )}

      {/* Supergroup controls — below the main display */}
      <SupergroupControls
        groupName={wallpaperType}
        latticeType={latticeType}
        variantIndex={variantIndex}
        activeSupergroup={activeSupergroup}
        onToggle={handleSupergroupToggle}
      />

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
        <Link to="/math">🔢 Math Explorer</Link>
      </p>
    </div>
  )
}
