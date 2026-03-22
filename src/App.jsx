import { useState, useCallback, useMemo, useRef } from 'react'
import {
  translation,
  rotation,
  reflection,
  glideReflection,
  isTranslation,
  rotationOrder,
} from './math/isometry.js'
import { generateGroup } from './math/groupGenerator.js'
import { presets } from './math/presets.js'
import GroupVisualization from './components/GroupVisualization.jsx'
import LatticeSelector from './components/LatticeSelector.jsx'
import { latticeToVector, getAllowedIsometries, findClosestDirection, latticeCoordsToCenter, centerToLatticeCoords, axisOffsetToPoint, pointToAxisOffset } from './math/latticeUtils.js'
import './App.css'

const PI = Math.PI

function defaultGenerator(type, allowedIso) {
  switch (type) {
    case 'rotation':
      return { type, order: (allowedIso.rotationOrders[0] || 2), centerS: 0, centerT: 0 }
    case 'reflection':
      return { type, dirIndex: 0, axisOffset: 0 }
    case 'glide-reflection':
      return { type, dirIndex: 0, axisOffset: 0 }
    default:
      return { type: 'rotation', order: (allowedIso.rotationOrders[0] || 2), centerS: 0, centerT: 0 }
  }
}

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

function getAvailableTypes(allowedIso) {
  const types = ['rotation']
  if (allowedIso.reflections.length > 0) types.push('reflection')
  if (allowedIso.glides.length > 0) types.push('glide-reflection')
  return types
}

/**
 * Adjust generators so they remain valid for the given allowed isometries.
 * Returns null if no adjustment needed, otherwise returns the adjusted array.
 */
function adjustGenerators(generators, allowedIso) {
  let changed = false
  const adjusted = generators
    .map((gen) => {
      if (gen.type === 'reflection' && allowedIso.reflections.length === 0) {
        changed = true
        return null
      }
      if (gen.type === 'glide-reflection' && allowedIso.glides.length === 0) {
        changed = true
        return null
      }
      if (gen.type === 'rotation' && !allowedIso.rotationOrders.includes(gen.order)) {
        changed = true
        return { ...gen, order: allowedIso.rotationOrders[0] || 2 }
      }
      if (gen.type === 'reflection' && (gen.dirIndex || 0) >= allowedIso.reflections.length) {
        changed = true
        return { ...gen, dirIndex: 0 }
      }
      if (gen.type === 'glide-reflection' && (gen.dirIndex || 0) >= allowedIso.glides.length) {
        changed = true
        return { ...gen, dirIndex: 0 }
      }
      return gen
    })
    .filter(Boolean)
  return changed ? adjusted : null
}

function GeneratorEditor({ gen, index, onChange, onRemove, allowedIso, latticeVec }) {
  const update = (field, value) => {
    onChange(index, { ...gen, [field]: value })
  }

  const availableTypes = getAvailableTypes(allowedIso)

  return (
    <div className="generator-row">
      <select
        value={gen.type}
        onChange={(e) => onChange(index, defaultGenerator(e.target.value, allowedIso))}
      >
        {availableTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {gen.type === 'rotation' && (
        <>
          <label>order:
            <select
              value={gen.order}
              onChange={(e) => update('order', parseInt(e.target.value, 10))}
            >
              {allowedIso.rotationOrders.map((o) => (
                <option key={o} value={o}>{360 / o}° (order {o})</option>
              ))}
            </select>
          </label>
          <label>center along a:
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gen.centerS ?? 0}
              onChange={(e) => update('centerS', parseFloat(e.target.value))}
              className="gen-slider"
            />
            <span className="slider-value">{(gen.centerS ?? 0).toFixed(2)}</span>
          </label>
          <label>center along b:
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gen.centerT ?? 0}
              onChange={(e) => update('centerT', parseFloat(e.target.value))}
              className="gen-slider"
            />
            <span className="slider-value">{(gen.centerT ?? 0).toFixed(2)}</span>
          </label>
        </>
      )}

      {gen.type === 'reflection' && (
        <>
          <label>direction:
            <select
              value={gen.dirIndex}
              onChange={(e) => update('dirIndex', parseInt(e.target.value, 10))}
            >
              {allowedIso.reflections.map((r, i) => (
                <option key={i} value={i}>{r.label}</option>
              ))}
            </select>
          </label>
          <label>axis offset:
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gen.axisOffset ?? 0}
              onChange={(e) => update('axisOffset', parseFloat(e.target.value))}
              className="gen-slider"
            />
            <span className="slider-value">{(gen.axisOffset ?? 0).toFixed(2)}</span>
          </label>
        </>
      )}

      {gen.type === 'glide-reflection' && (
        <>
          <label>direction:
            <select
              value={gen.dirIndex}
              onChange={(e) => update('dirIndex', parseInt(e.target.value, 10))}
            >
              {allowedIso.glides.map((g, i) => (
                <option key={i} value={i}>{g.label}</option>
              ))}
            </select>
          </label>
          <label>axis offset:
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={gen.axisOffset ?? 0}
              onChange={(e) => update('axisOffset', parseFloat(e.target.value))}
              className="gen-slider"
            />
            <span className="slider-value">{(gen.axisOffset ?? 0).toFixed(2)}</span>
          </label>
        </>
      )}

      <button className="btn-remove" onClick={() => onRemove(index)}>✕</button>
    </div>
  )
}

function isometriesToEditorState(isometries, allowedIso, latticeVec) {
  return isometries
    .filter((iso) => !isTranslation(iso))
    .map((iso) => {
      const det = iso.a * iso.d - iso.b * iso.c
      if (det > 0) {
        // Rotation
        const order = rotationOrder(iso) || 2
        const detM = (1 - iso.a) * (1 - iso.d) - iso.b * iso.c
        let cx = 0, cy = 0
        if (Math.abs(detM) > 1e-10) {
          cx = ((1 - iso.d) * iso.tx + iso.b * iso.ty) / detM
          cy = (iso.c * iso.tx + (1 - iso.a) * iso.ty) / detM
        }
        const { s, t } = centerToLatticeCoords(cx, cy, latticeVec)
        return {
          type: 'rotation',
          order: allowedIso.rotationOrders.includes(order) ? order : (allowedIso.rotationOrders[0] || 2),
          centerS: Math.round(s * 1000) / 1000,
          centerT: Math.round(t * 1000) / 1000,
        }
      }
      // Reflection or glide-reflection
      const axisAngle = Math.atan2(iso.c, iso.a) / 2
      const glideDist = iso.tx * Math.cos(axisAngle) + iso.ty * Math.sin(axisAngle)
      const perpDist = -iso.tx * Math.sin(axisAngle) + iso.ty * Math.cos(axisAngle)
      const px = (perpDist / 2) * (-Math.sin(axisAngle))
      const py = (perpDist / 2) * Math.cos(axisAngle)

      if (Math.abs(glideDist) < 1e-9) {
        const dirIndex = findClosestDirection(axisAngle, allowedIso.reflections)
        const offset = pointToAxisOffset(px, py, axisAngle, latticeVec)
        return {
          type: 'reflection',
          dirIndex,
          axisOffset: Math.round(offset * 1000) / 1000,
        }
      }
      const dirIndex = findClosestDirection(axisAngle, allowedIso.glides)
      const offset = pointToAxisOffset(px, py, axisAngle, latticeVec)
      return {
        type: 'glide-reflection',
        dirIndex,
        axisOffset: Math.round(offset * 1000) / 1000,
      }
    })
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
  const [generators, setGenerators] = useState([
    { type: 'rotation', order: 4, centerS: 0, centerT: 0 },
  ])
  const [maxWords, setMaxWords] = useState(6)
  const [maxElements, setMaxElements] = useState(1000)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showF, setShowF] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState('')

  const allowedIso = useMemo(() => getAllowedIsometries(lattice), [lattice])
  const prevLatticeType = useRef(allowedIso.latticeType)

  // Wrap setLattice to auto-adjust generators when lattice type changes
  const handleLatticeChange = useCallback((newLattice) => {
    setLattice(newLattice)
    setSelectedPreset('')
    const newAllowed = getAllowedIsometries(newLattice)
    if (prevLatticeType.current !== newAllowed.latticeType) {
      prevLatticeType.current = newAllowed.latticeType
      setGenerators((prev) => adjustGenerators(prev, newAllowed) ?? prev)
    }
  }, [])

  const addGenerator = () => {
    setGenerators([...generators, defaultGenerator('rotation', allowedIso)])
    setSelectedPreset('')
  }

  const removeGenerator = (index) => {
    setGenerators(generators.filter((_, i) => i !== index))
    setSelectedPreset('')
  }

  const updateGenerator = (index, gen) => {
    const newGens = [...generators]
    newGens[index] = gen
    setGenerators(newGens)
    setSelectedPreset('')
  }

  const loadPreset = (presetName) => {
    const preset = presets.find((p) => p.name === presetName)
    if (!preset) return
    setSelectedPreset(presetName)
    setLattice(preset.lattice)
    const newAllowed = getAllowedIsometries(preset.lattice)
    const presetVec = latticeToVector(preset.lattice)
    const isos = preset.generators()
    setGenerators(isometriesToEditorState(isos, newAllowed, presetVec))
    prevLatticeType.current = newAllowed.latticeType
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
        Configure the lattice and symmetry generators below. The wallpaper group updates live.
      </p>

      {/* Preset selector */}
      <div className="preset-selector">
        <label><strong>Load preset:</strong></label>
        <select
          value={selectedPreset}
          onChange={(e) => {
            if (e.target.value) loadPreset(e.target.value)
          }}
        >
          <option value="">Select a wallpaper group...</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} – {p.description}
            </option>
          ))}
        </select>
      </div>

      {/* Lattice selector */}
      <LatticeSelector lattice={lattice} onChange={handleLatticeChange} />

      {/* Non-translation generators */}
      <div className="generators-section">
        <h3>Symmetry Generators <span className="lattice-type-badge">{allowedIso.latticeType} lattice</span></h3>
        {generators.length === 0 && (
          <p className="no-generators">No additional symmetry generators (pure translation group).</p>
        )}
        {generators.map((gen, i) => (
          <GeneratorEditor
            key={i}
            gen={gen}
            index={i}
            onChange={updateGenerator}
            onRemove={removeGenerator}
            allowedIso={allowedIso}
            latticeVec={latticeToVector(lattice)}
          />
        ))}
        <button className="btn-add" onClick={addGenerator}>+ Add Generator</button>
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
