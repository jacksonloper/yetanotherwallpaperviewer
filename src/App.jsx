import { useState, useCallback, useMemo, useRef } from 'react'
import {
  translation,
  rotation,
  reflection,
  glideReflection,
} from './math/isometry.js'
import { generateGroup } from './math/groupGenerator.js'
import { getWallpaperTypesForLattice } from './math/wallpaperGroups.js'
import GroupVisualization from './components/GroupVisualization.jsx'
import LatticeSelector from './components/LatticeSelector.jsx'
import { latticeToVector, getAllowedIsometries, latticeCoordsToCenter, axisOffsetToPoint } from './math/latticeUtils.js'
import './App.css'

const PI = Math.PI

function parseGenerator(gen, allowedIso, latticeVec) {
  switch (gen.type) {
    case 'rotation': {
      const order = gen.order || 2
      const angle = (2 * PI) / order
      const { cx, cy } = latticeCoordsToCenter(gen.centerS || 0, gen.centerT || 0, latticeVec)
      return rotation(angle, cx, cy)
    }
    case 'reflection': {
      const dir = allowedIso.reflections[gen.dirIndex] || allowedIso.reflections[0]
      if (!dir) return null
      const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, dir.angle, latticeVec)
      return reflection(dir.angle, px, py)
    }
    case 'glide-reflection': {
      const dir = allowedIso.glides[gen.dirIndex] || allowedIso.glides[0]
      if (!dir) return null
      const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, dir.angle, latticeVec)
      return glideReflection(dir.angle, dir.dist, px, py)
    }
    default:
      return null
  }
}

function buildJsonSpec(lattice, generators, allowedIso) {
  const vec = latticeToVector(lattice)
  const spec = {
    translations: [[0, 1], [parseFloat(vec.x.toFixed(6)), parseFloat(vec.y.toFixed(6))]],
    generators: generators.map((gen) => {
      switch (gen.type) {
        case 'rotation': {
          const { cx, cy } = latticeCoordsToCenter(gen.centerS || 0, gen.centerT || 0, vec)
          return {
            type: 'rotation',
            order: gen.order || 2,
            angle_degrees: 360 / (gen.order || 2),
            center: [parseFloat(cx.toFixed(6)), parseFloat(cy.toFixed(6))],
          }
        }
        case 'reflection': {
          const dir = allowedIso.reflections[gen.dirIndex] || allowedIso.reflections[0]
          const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, dir.angle, vec)
          return {
            type: 'reflection',
            axis_angle_degrees: dir ? parseFloat(((dir.angle * 180) / PI).toFixed(6)) : 0,
            point_on_axis: [parseFloat(px.toFixed(6)), parseFloat(py.toFixed(6))],
          }
        }
        case 'glide-reflection': {
          const dir = allowedIso.glides[gen.dirIndex] || allowedIso.glides[0]
          const { px, py } = axisOffsetToPoint(gen.axisOffset || 0, dir.angle, vec)
          return {
            type: 'glide-reflection',
            axis_angle_degrees: dir ? parseFloat(((dir.angle * 180) / PI).toFixed(6)) : 0,
            glide_distance: dir ? parseFloat(dir.dist.toFixed(6)) : 0,
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
  const [lattice, setLattice] = useState({ mode: 'well-rounded', sliderValue: 0 })
  const [wallpaperType, setWallpaperType] = useState('p4')
  const [generators, setGenerators] = useState([
    { type: 'rotation', order: 4, centerS: 0, centerT: 0 },
  ])
  const [maxWords, setMaxWords] = useState(6)
  const [maxElements, setMaxElements] = useState(1000)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showF, setShowF] = useState(true)

  const allowedIso = useMemo(() => getAllowedIsometries(lattice), [lattice])
  const prevLatticeType = useRef(allowedIso.latticeType)

  const availableWallpaperTypes = useMemo(
    () => getWallpaperTypesForLattice(allowedIso.latticeType),
    [allowedIso.latticeType]
  )

  const handleWallpaperTypeChange = (typeName) => {
    setWallpaperType(typeName)
    const wpType = availableWallpaperTypes.find((t) => t.name === typeName)
    if (wpType) {
      setGenerators(wpType.generators.map((g) => ({ ...g })))
    }
  }

  // Wrap setLattice to auto-adjust wallpaper type & generators when lattice type changes
  const handleLatticeChange = useCallback((newLattice) => {
    setLattice(newLattice)
    const newAllowed = getAllowedIsometries(newLattice)
    if (prevLatticeType.current !== newAllowed.latticeType) {
      prevLatticeType.current = newAllowed.latticeType
      const newTypes = getWallpaperTypesForLattice(newAllowed.latticeType)
      setWallpaperType((prevType) => {
        const still = newTypes.find((t) => t.name === prevType)
        if (still) {
          setGenerators(still.generators.map((g) => ({ ...g })))
          return prevType
        }
        const fallback = newTypes[0]
        setGenerators(fallback ? fallback.generators.map((g) => ({ ...g })) : [])
        return fallback ? fallback.name : 'p1'
      })
    }
  }, [])

  const currentWpType = useMemo(
    () => availableWallpaperTypes.find(t => t.name === wallpaperType),
    [availableWallpaperTypes, wallpaperType]
  )

  const updateGenerator = (index, gen) => {
    let newGens = [...generators]
    newGens[index] = gen
    if (currentWpType?.applyConstraints) {
      newGens = currentWpType.applyConstraints(newGens, index)
    }
    setGenerators(newGens)
  }

  // Auto-generate the group whenever inputs change
  const groupResult = useMemo(() => {
    try {
      const vec = latticeToVector(lattice)
      const t1 = translation(0, 1)
      const t2 = translation(vec.x, vec.y)

      const nonTransIsos = generators.map((g) => parseGenerator(g, allowedIso, vec)).filter(Boolean)

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
  }, [generators, lattice, maxWords, maxElements, allowedIso])

  const { result, error, warning, timeMs } = groupResult

  const copyToClipboard = useCallback(() => {
    const json = buildJsonSpec(lattice, generators, allowedIso)
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 1500)
    })
  }, [lattice, generators, allowedIso])

  return (
    <div className="app-container">
      <h1>Wallpaper Group Viewer</h1>
      <p className="subtitle">
        Choose a lattice, pick a wallpaper group, then adjust the continuous parameters. Updates live.
      </p>

      {/* Lattice selector */}
      <LatticeSelector lattice={lattice} onChange={handleLatticeChange} />

      {/* Wallpaper type selector + continuous parameter sliders */}
      <div className="generators-section">
        <h3>Wallpaper Group <span className="lattice-type-badge">{allowedIso.latticeType} lattice</span></h3>

        <div className="wallpaper-type-selector">
          <label><strong>Type:</strong>
            <select
              value={wallpaperType}
              onChange={(e) => handleWallpaperTypeChange(e.target.value)}
            >
              {availableWallpaperTypes.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} – {t.description}
                </option>
              ))}
            </select>
          </label>
        </div>

        {generators.length === 0 && (
          <p className="no-generators">Pure translation group — no parameters to adjust.</p>
        )}

        {generators.map((gen, i) => (
          <div key={i} className="generator-params">
            <div className="generator-title">
              {gen.type === 'rotation' && `${360 / gen.order}° rotation`}
              {gen.type === 'reflection' && `Reflection ${allowedIso.reflections[gen.dirIndex]?.label || ''}`}
              {gen.type === 'glide-reflection' && `Glide ${allowedIso.glides[gen.dirIndex]?.label || ''}`}
            </div>

            {gen.type === 'rotation' && (
              <>
                <label>center along a{currentWpType?.applyConstraints ? ' 🔗' : ''}:
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={gen.centerS ?? 0}
                    onChange={(e) => updateGenerator(i, { ...gen, centerS: parseFloat(e.target.value) })}
                    className="gen-slider"
                  />
                  <span className="slider-value">{(gen.centerS ?? 0).toFixed(2)}</span>
                </label>
                <label>center along b{currentWpType?.applyConstraints && wallpaperType === 'p4g' ? ' 🔗' : ''}:
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={gen.centerT ?? 0}
                    onChange={(e) => updateGenerator(i, { ...gen, centerT: parseFloat(e.target.value) })}
                    className="gen-slider"
                  />
                  <span className="slider-value">{(gen.centerT ?? 0).toFixed(2)}</span>
                </label>
              </>
            )}

            {(gen.type === 'reflection' || gen.type === 'glide-reflection') && (
              <label>axis offset{currentWpType?.applyConstraints ? ' 🔗' : ''}:
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gen.axisOffset ?? 0}
                  onChange={(e) => updateGenerator(i, { ...gen, axisOffset: parseFloat(e.target.value) })}
                  className="gen-slider"
                />
                <span className="slider-value">{(gen.axisOffset ?? 0).toFixed(2)}</span>
              </label>
            )}
          </div>
        ))}

        {currentWpType?.constraintNote && (
          <div className="constraint-note">🔗 {currentWpType.constraintNote}</div>
        )}
      </div>

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
        <button className="btn-copy" onClick={copyToClipboard}>
          📋 Copy JSON
        </button>
        {copySuccess && <span className="copy-success">✓ Copied!</span>}
      </div>

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
        />
      )}
    </div>
  )
}
