import { useState, useCallback, useMemo } from 'react'
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
import GroupVisualization, { SCALE, SVG_WIDTH, SVG_HEIGHT } from './components/GroupVisualization.jsx'
import LatticeControls from './components/LatticeControls.jsx'
import WallpaperGroupSelector from './components/WallpaperGroupSelector.jsx'
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
  const [showGroupElements, setShowGroupElements] = useState(true)
  const [gpSeed, setGpSeed] = useState(1)
  const [gpEll, setGpEll] = useState(0.1)
  const [gpN, setGpN] = useState(5)
  const [gpSpeed, setGpSpeed] = useState(0)
  const [gpDamping, setGpDamping] = useState(0.5)

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
      const latticeVectors = { v1: { x: 0, y: 1 }, v2: vec }
      const bounds = {
        minX: -SVG_WIDTH / (2 * SCALE) - 1,
        maxX: SVG_WIDTH / (2 * SCALE) + 1,
        minY: -SVG_HEIGHT / (2 * SCALE) - 1,
        maxY: SVG_HEIGHT / (2 * SCALE) + 1,
      }
      const elements = generateElements(cosets, vec, bounds)

      return { result: { elements, latticeVectors, cosetReps }, error: null, warning: rationalCosets.warning }
    } catch (err) {
      return { result: null, error: `Error: ${err.message}`, warning: rationalCosets.warning }
    }
  }, [rationalCosets, latticeVec])

  const { result, error, warning } = groupResult

  const copyToClipboard = useCallback(() => {
    const json = buildJsonSpec(wallpaperType, variantIndex, latticeVec)
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 1500)
    }).catch(() => {
      // Clipboard API may be unavailable (e.g. insecure context)
    })
  }, [wallpaperType, variantIndex, latticeVec])

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
            <input type="checkbox" checked={showGP} onChange={(e) => setShowGP(e.target.checked)} />
            Show GP
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

        {/* GP controls — revealed when Show GP is on */}
        {showGP && (
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
      {result && (
        <GroupVisualization
          elements={result.elements}
          latticeVectors={result.latticeVectors}
          cosetReps={result.cosetReps}
          showF={showF}
          fOffset={{ x: fOffsetX, y: fOffsetY }}
          showGP={showGP}
          showGroupElements={showGroupElements}
          gpSeed={gpSeed}
          gpEll={gpEll}
          gpN={gpN}
          gpSpeed={gpSpeed}
          gpDamping={gpDamping}
        />
      )}
    </div>
  )
}
