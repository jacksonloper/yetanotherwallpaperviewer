import { useState, useCallback, useMemo } from 'react'
import {
  translation,
  rotation,
  reflection,
  glideReflection,
} from './math/isometry.js'
import { generateGroup } from './math/groupGenerator.js'
import {
  ALL_WALLPAPER_TYPES,
  getWallpaperTypeByName,
  getGeneratorsForVariant,
} from './math/wallpaperGroups.js'
import GroupVisualization from './components/GroupVisualization.jsx'
import LatticeControls from './components/LatticeControls.jsx'
import {
  latticeToVector,
  getLatticeType,
  axisOffsetToPoint,
  resolveDirection,
  resolveCmDirection,
  cmSliderToVector,
  rectSliderToVector,
  fixedLatticeVector,
} from './math/latticeUtils.js'
import './App.css'

const PI = Math.PI

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
 * Convert a new-format generator template to a concrete isometry.
 */
function parseGenerator(gen, latticeVec) {
  switch (gen.type) {
    case 'rotation': {
      const angle = (2 * PI) / (gen.order || 2)
      return rotation(angle, 0, 0)
    }
    case 'reflection': {
      let angle
      if ('dir' in gen) {
        angle = resolveDirection(gen.dir, latticeVec).angle
      } else if ('cmDir' in gen) {
        angle = resolveCmDirection(gen.cmDir, latticeVec).angle
      } else {
        return null
      }
      const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, angle, latticeVec)
      return reflection(angle, px, py)
    }
    case 'glide': {
      if (!('dir' in gen)) return null
      const d = resolveDirection(gen.dir, latticeVec)
      const dist = d.length / 2
      const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, d.angle, latticeVec)
      return glideReflection(d.angle, dist, px, py)
    }
    default:
      return null
  }
}

/**
 * Build JSON spec for copy-to-clipboard.
 */
function buildJsonSpec(wpType, generators, latticeVec) {
  const spec = {
    translations: [[0, 1], [parseFloat(latticeVec.x.toFixed(6)), parseFloat(latticeVec.y.toFixed(6))]],
    generators: generators.map((gen) => {
      switch (gen.type) {
        case 'rotation':
          return {
            type: 'rotation',
            order: gen.order || 2,
            angle_degrees: 360 / (gen.order || 2),
            center: [0, 0],
          }
        case 'reflection': {
          let angle
          if ('dir' in gen) angle = resolveDirection(gen.dir, latticeVec).angle
          else if ('cmDir' in gen) angle = resolveCmDirection(gen.cmDir, latticeVec).angle
          else angle = 0
          const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, angle, latticeVec)
          return {
            type: 'reflection',
            axis_angle_degrees: parseFloat(((angle * 180) / PI).toFixed(6)),
            point_on_axis: [parseFloat(px.toFixed(6)), parseFloat(py.toFixed(6))],
          }
        }
        case 'glide': {
          const d = resolveDirection(gen.dir, latticeVec)
          const dist = d.length / 2
          const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, d.angle, latticeVec)
          return {
            type: 'glide-reflection',
            axis_angle_degrees: parseFloat(((d.angle * 180) / PI).toFixed(6)),
            glide_distance: parseFloat(dist.toFixed(6)),
            point_on_axis: [parseFloat(px.toFixed(6)), parseFloat(py.toFixed(6))],
          }
        }
        default:
          return gen
      }
    }),
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
  const [maxWords, setMaxWords] = useState(6)
  const [maxElements, setMaxElements] = useState(1000)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showF, setShowF] = useState(true)
  const [fOffsetX, setFOffsetX] = useState(0)
  const [fOffsetY, setFOffsetY] = useState(0)
  const [showGP, setShowGP] = useState(false)
  const [gpSeed, setGpSeed] = useState(1)
  const [gpEll, setGpEll] = useState(0.1)
  const [gpN, setGpN] = useState(5)

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
      const { x } = latticeVec
      return Math.abs(x - 1) < 1e-4 ? 'square' : 'rectangular'
    }
    if (wpType.latticeControl === 'cm-slider') {
      const { x, y } = latticeVec
      const r2 = x * x + y * y
      if (Math.abs(y) < 1e-4 && Math.abs(x - 1) < 1e-4) return 'square'
      if (Math.abs(y - 0.5) < 1e-4 && Math.abs(x - Math.sqrt(3) / 2) < 1e-4) return 'hexagonal'
      if (Math.abs(r2 - 1) < 1e-4) return 'centered-rectangular'
      if (Math.abs(y - 0.5) < 1e-4) return 'centered-rectangular'
      return 'oblique'
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

  // Auto-generate the group whenever inputs change
  const groupResult = useMemo(() => {
    try {
      const vec = latticeVec
      const t1 = translation(0, 1)
      const t2 = translation(vec.x, vec.y)

      const nonTransIsos = generators.map((g) => parseGenerator(g, vec)).filter(Boolean)

      const allIsos = [t1, t2, ...nonTransIsos]
      const res = generateGroup(allIsos, maxWords, maxElements)
      if (res.error) {
        return { result: null, error: res.error, warning: null, timeMs: res.timeMs }
      }
      const latticeVectors = {
        v1: { x: 0, y: 1 },
        v2: vec,
      }
      return { result: { elements: res.elements, latticeVectors }, error: null, warning: res.warning, timeMs: res.timeMs }
    } catch (err) {
      return { result: null, error: `Error: ${err.message}`, warning: null, timeMs: 0 }
    }
  }, [generators, latticeVec, maxWords, maxElements])

  const { result, error, warning, timeMs } = groupResult

  const copyToClipboard = useCallback(() => {
    const json = buildJsonSpec(wpType, generators, latticeVec)
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 1500)
    })
  }, [wpType, generators, latticeVec])

  return (
    <div className="app-container">
      <h1>Wallpaper Group Viewer</h1>
      <p className="subtitle">
        Pick a wallpaper group, then adjust the lattice. Updates live.
      </p>

      {/* Wallpaper type selector — FIRST */}
      <div className="generators-section">
        <h3>Wallpaper Group <span className="lattice-type-badge">{latticeType} lattice</span></h3>

        <div className="wallpaper-type-selector">
          <label><strong>Type:</strong>
            <select
              value={wallpaperType}
              onChange={(e) => handleWallpaperTypeChange(e.target.value)}
            >
              {ALL_WALLPAPER_TYPES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} – {t.description}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Direction variant radios */}
        {wpType.variants && wpType.variants.length > 1 && (
          <div className="variant-radios">
            <strong>Direction:</strong>
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

      {/* Lattice controls — SECOND, determined by wallpaper type */}
      <LatticeControls
        wpType={wpType}
        latticeState={latticeState}
        latticeVec={latticeVec}
        onChange={handleLatticeStateChange}
      />

      {/* Controls */}
      <div className="controls">
        <label>
          Max word length: {maxWords}
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={maxWords}
            onChange={(e) => setMaxWords(parseInt(e.target.value, 10))}
            className="gen-slider"
          />
        </label>
        <label>
          Max elements: {maxElements}
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={maxElements}
            onChange={(e) => setMaxElements(parseInt(e.target.value, 10))}
            className="gen-slider"
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={showF} onChange={(e) => setShowF(e.target.checked)} />
          Show F
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={showGP} onChange={(e) => setShowGP(e.target.checked)} />
          Show GP
        </label>
        {showGP && (
          <button className="btn-copy" onClick={() => setGpSeed(s => s + 1)}>
            🎲 New Draw
          </button>
        )}
        <button className="btn-copy" onClick={copyToClipboard}>
          📋 Copy JSON
        </button>
        {copySuccess && <span className="copy-success">✓ Copied!</span>}
      </div>

      {/* GP parameter controls */}
      {showGP && (
        <div className="controls">
          <label>
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
          <label>
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
        </div>
      )}

      {/* F-shape translation offset */}
      {showF && (
        <div className="controls">
          <label>
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
          <label>
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

      {/* Timing info */}
      {timeMs !== null && (
        <div className="timing-info">
          Generation time: {timeMs.toFixed(1)} ms
        </div>
      )}

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
          showF={showF}
          fOffset={{ x: fOffsetX, y: fOffsetY }}
          showGP={showGP}
          gpSeed={gpSeed}
          gpEll={gpEll}
          gpN={gpN}
        />
      )}
    </div>
  )
}
