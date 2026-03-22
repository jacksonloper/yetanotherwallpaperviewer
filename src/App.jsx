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
import { latticeToVector, getAllowedIsometries, findClosestDirection } from './math/latticeUtils.js'
import ValidatedInput from './components/ValidatedInput.jsx'
import './App.css'

const PI = Math.PI

function defaultGenerator(type, allowedIso) {
  switch (type) {
    case 'rotation':
      return { type, order: (allowedIso.rotationOrders[0] || 2), cx: '0', cy: '0' }
    case 'reflection':
      return { type, dirIndex: 0, px: '0', py: '0' }
    case 'glide-reflection':
      return { type, dirIndex: 0, px: '0', py: '0' }
    default:
      return { type: 'rotation', order: (allowedIso.rotationOrders[0] || 2), cx: '0', cy: '0' }
  }
}

function parseGenerator(gen, allowedIso) {
  switch (gen.type) {
    case 'rotation': {
      const order = gen.order || 2
      const angle = (2 * PI) / order
      return rotation(angle, parseFloat(gen.cx), parseFloat(gen.cy))
    }
    case 'reflection': {
      const dir = allowedIso.reflections[gen.dirIndex] || allowedIso.reflections[0]
      if (!dir) return null
      return reflection(dir.angle, parseFloat(gen.px), parseFloat(gen.py))
    }
    case 'glide-reflection': {
      const dir = allowedIso.glides[gen.dirIndex] || allowedIso.glides[0]
      if (!dir) return null
      return glideReflection(dir.angle, dir.dist, parseFloat(gen.px), parseFloat(gen.py))
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

function GeneratorEditor({ gen, index, onChange, onRemove, allowedIso }) {
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
          <label>cx:
            <ValidatedInput
              value={gen.cx}
              onChange={(v) => update('cx', String(v))}
              validate={(v) => !isNaN(v)}
            />
          </label>
          <label>cy:
            <ValidatedInput
              value={gen.cy}
              onChange={(v) => update('cy', String(v))}
              validate={(v) => !isNaN(v)}
            />
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
          <label>px:
            <ValidatedInput
              value={gen.px}
              onChange={(v) => update('px', String(v))}
              validate={(v) => !isNaN(v)}
            />
          </label>
          <label>py:
            <ValidatedInput
              value={gen.py}
              onChange={(v) => update('py', String(v))}
              validate={(v) => !isNaN(v)}
            />
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
          <label>px:
            <ValidatedInput
              value={gen.px}
              onChange={(v) => update('px', String(v))}
              validate={(v) => !isNaN(v)}
            />
          </label>
          <label>py:
            <ValidatedInput
              value={gen.py}
              onChange={(v) => update('py', String(v))}
              validate={(v) => !isNaN(v)}
            />
          </label>
        </>
      )}

      <button className="btn-remove" onClick={() => onRemove(index)}>✕</button>
    </div>
  )
}

function isometriesToEditorState(isometries, allowedIso) {
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
        return {
          type: 'rotation',
          order: allowedIso.rotationOrders.includes(order) ? order : (allowedIso.rotationOrders[0] || 2),
          cx: String(Math.round(cx * 1000) / 1000),
          cy: String(Math.round(cy * 1000) / 1000),
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
        return {
          type: 'reflection',
          dirIndex,
          px: String(Math.round(px * 1000) / 1000),
          py: String(Math.round(py * 1000) / 1000),
        }
      }
      const dirIndex = findClosestDirection(axisAngle, allowedIso.glides)
      return {
        type: 'glide-reflection',
        dirIndex,
        px: String(Math.round(px * 1000) / 1000),
        py: String(Math.round(py * 1000) / 1000),
      }
    })
}

function buildJsonSpec(lattice, generators, allowedIso) {
  const vec = latticeToVector(lattice)
  const spec = {
    translations: [[0, 1], [parseFloat(vec.x.toFixed(6)), parseFloat(vec.y.toFixed(6))]],
    generators: generators.map((gen) => {
      switch (gen.type) {
        case 'rotation':
          return {
            type: 'rotation',
            order: gen.order || 2,
            angle_degrees: 360 / (gen.order || 2),
            center: [parseFloat(gen.cx), parseFloat(gen.cy)],
          }
        case 'reflection': {
          const dir = allowedIso.reflections[gen.dirIndex] || allowedIso.reflections[0]
          return {
            type: 'reflection',
            axis_angle_degrees: dir ? parseFloat(((dir.angle * 180) / PI).toFixed(6)) : 0,
            point_on_axis: [parseFloat(gen.px), parseFloat(gen.py)],
          }
        }
        case 'glide-reflection': {
          const dir = allowedIso.glides[gen.dirIndex] || allowedIso.glides[0]
          return {
            type: 'glide-reflection',
            axis_angle_degrees: dir ? parseFloat(((dir.angle * 180) / PI).toFixed(6)) : 0,
            glide_distance: dir ? parseFloat(dir.dist.toFixed(6)) : 0,
            point_on_axis: [parseFloat(gen.px), parseFloat(gen.py)],
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
    { type: 'rotation', order: 4, cx: '0', cy: '0' },
  ])
  const [maxWords, setMaxWords] = useState(6)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
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
    const isos = preset.generators()
    setGenerators(isometriesToEditorState(isos, newAllowed))
    prevLatticeType.current = newAllowed.latticeType
    setResult(null)
    setError(null)
  }

  const generate = useCallback(() => {
    try {
      // Build the two translation isometries from the lattice state
      const vec = latticeToVector(lattice)
      const t1 = translation(0, 1)
      const t2 = translation(vec.x, vec.y)

      // Build non-translation isometries from generator editors
      const nonTransIsos = generators.map((g) => parseGenerator(g, allowedIso)).filter(Boolean)

      const allIsos = [t1, t2, ...nonTransIsos]
      const res = generateGroup(allIsos, maxWords)
      if (res.error) {
        setError(res.error)
        setResult(null)
      } else {
        setError(null)
        const latticeVectors = {
          v1: { x: 0, y: 1 },
          v2: vec,
        }
        setResult({ elements: res.elements, latticeVectors })
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
      setResult(null)
    }
  }, [generators, lattice, maxWords, allowedIso])

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
        Configure the lattice and symmetry generators, then generate the wallpaper group.
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
          />
        ))}
        <button className="btn-add" onClick={addGenerator}>+ Add Generator</button>
      </div>

      {/* Controls */}
      <div className="controls">
        <label>
          Max word length:{' '}
          <ValidatedInput
            value={maxWords}
            onChange={(v) => setMaxWords(v)}
            validate={(v) => Number.isInteger(v) && v >= 1 && v <= 20}
            parse={(s) => parseInt(s, 10)}
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={showF} onChange={(e) => setShowF(e.target.checked)} />
          Show F
        </label>
        <button className="btn-generate" onClick={generate}>Generate Group</button>
        <button className="btn-copy" onClick={copyToClipboard}>
          📋 Copy JSON
        </button>
        {copySuccess && <span className="copy-success">✓ Copied!</span>}
      </div>

      {/* Error display */}
      {error && (
        <div className="error-box">{error}</div>
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
