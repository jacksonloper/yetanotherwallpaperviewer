import { useState, useCallback } from 'react'
import {
  translation,
  rotation,
  reflection,
  glideReflection,
  isTranslation,
} from './math/isometry.js'
import { generateGroup } from './math/groupGenerator.js'
import { presets } from './math/presets.js'
import GroupVisualization from './components/GroupVisualization.jsx'
import LatticeSelector from './components/LatticeSelector.jsx'
import { latticeToVector } from './math/latticeUtils.js'
import ValidatedInput from './components/ValidatedInput.jsx'
import './App.css'

const PI = Math.PI

const ISOMETRY_TYPES = ['rotation', 'reflection', 'glide-reflection']

function defaultGenerator(type) {
  switch (type) {
    case 'rotation':
      return { type, angle: '90', cx: '0', cy: '0' }
    case 'reflection':
      return { type, angle: '0', px: '0', py: '0' }
    case 'glide-reflection':
      return { type, angle: '0', dist: '0.5', px: '0', py: '0' }
    default:
      return { type: 'rotation', angle: '90', cx: '0', cy: '0' }
  }
}

function parseGenerator(gen) {
  switch (gen.type) {
    case 'rotation':
      return rotation(
        (parseFloat(gen.angle) * PI) / 180,
        parseFloat(gen.cx),
        parseFloat(gen.cy)
      )
    case 'reflection':
      return reflection(
        (parseFloat(gen.angle) * PI) / 180,
        parseFloat(gen.px),
        parseFloat(gen.py)
      )
    case 'glide-reflection':
      return glideReflection(
        (parseFloat(gen.angle) * PI) / 180,
        parseFloat(gen.dist),
        parseFloat(gen.px),
        parseFloat(gen.py)
      )
    default:
      return null
  }
}

function GeneratorEditor({ gen, index, onChange, onRemove }) {
  const update = (field, value) => {
    onChange(index, { ...gen, [field]: value })
  }

  return (
    <div className="generator-row">
      <select
        value={gen.type}
        onChange={(e) => onChange(index, defaultGenerator(e.target.value))}
      >
        {ISOMETRY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {gen.type === 'rotation' && (
        <>
          <label>angle°:
            <ValidatedInput
              value={gen.angle}
              onChange={(v) => update('angle', String(v))}
              validate={(v) => !isNaN(v)}
            />
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
          <label>angle°:
            <ValidatedInput
              value={gen.angle}
              onChange={(v) => update('angle', String(v))}
              validate={(v) => !isNaN(v)}
            />
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
          <label>angle°:
            <ValidatedInput
              value={gen.angle}
              onChange={(v) => update('angle', String(v))}
              validate={(v) => !isNaN(v)}
            />
          </label>
          <label>dist:
            <ValidatedInput
              value={gen.dist}
              onChange={(v) => update('dist', String(v))}
              validate={(v) => !isNaN(v)}
            />
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

function isometriesToEditorState(isometries) {
  return isometries
    .filter((iso) => !isTranslation(iso))
    .map((iso) => {
      const det = iso.a * iso.d - iso.b * iso.c
      if (det > 0) {
        const angle = Math.atan2(iso.c, iso.a)
        const detM = (1 - iso.a) * (1 - iso.d) - iso.b * iso.c
        let cx = 0, cy = 0
        if (Math.abs(detM) > 1e-10) {
          cx = ((1 - iso.d) * iso.tx + iso.b * iso.ty) / detM
          cy = (iso.c * iso.tx + (1 - iso.a) * iso.ty) / detM
        }
        return {
          type: 'rotation',
          angle: String(Math.round((angle * 180) / PI * 1000) / 1000),
          cx: String(Math.round(cx * 1000) / 1000),
          cy: String(Math.round(cy * 1000) / 1000),
        }
      }
      const axisAngle = Math.atan2(iso.c, iso.a) / 2
      const glideDist = iso.tx * Math.cos(axisAngle) + iso.ty * Math.sin(axisAngle)
      const perpDist = -iso.tx * Math.sin(axisAngle) + iso.ty * Math.cos(axisAngle)
      const px = (perpDist / 2) * (-Math.sin(axisAngle))
      const py = (perpDist / 2) * Math.cos(axisAngle)

      if (Math.abs(glideDist) < 1e-9) {
        return {
          type: 'reflection',
          angle: String(Math.round((axisAngle * 180) / PI * 1000) / 1000),
          px: String(Math.round(px * 1000) / 1000),
          py: String(Math.round(py * 1000) / 1000),
        }
      }
      return {
        type: 'glide-reflection',
        angle: String(Math.round((axisAngle * 180) / PI * 1000) / 1000),
        dist: String(Math.round(glideDist * 1000) / 1000),
        px: String(Math.round(px * 1000) / 1000),
        py: String(Math.round(py * 1000) / 1000),
      }
    })
}

export default function App() {
  const [lattice, setLattice] = useState({ mode: 'well-rounded', sliderValue: 0 })
  const [generators, setGenerators] = useState([
    { type: 'rotation', angle: '90', cx: '0', cy: '0' },
  ])
  const [maxWords, setMaxWords] = useState(6)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const addGenerator = () => {
    setGenerators([...generators, defaultGenerator('rotation')])
  }

  const removeGenerator = (index) => {
    setGenerators(generators.filter((_, i) => i !== index))
  }

  const updateGenerator = (index, gen) => {
    const newGens = [...generators]
    newGens[index] = gen
    setGenerators(newGens)
  }

  const loadPreset = (presetName) => {
    const preset = presets.find((p) => p.name === presetName)
    if (!preset) return
    setLattice(preset.lattice)
    const isos = preset.generators()
    setGenerators(isometriesToEditorState(isos))
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
      const nonTransIsos = generators.map(parseGenerator).filter(Boolean)

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
  }, [generators, lattice, maxWords])

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
          onChange={(e) => {
            if (e.target.value) loadPreset(e.target.value)
          }}
          defaultValue=""
        >
          <option value="" disabled>Select a wallpaper group...</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} – {p.description}
            </option>
          ))}
        </select>
      </div>

      {/* Lattice selector */}
      <LatticeSelector lattice={lattice} onChange={setLattice} />

      {/* Non-translation generators */}
      <div className="generators-section">
        <h3>Symmetry Generators</h3>
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
        <button className="btn-generate" onClick={generate}>Generate Group</button>
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
        />
      )}
    </div>
  )
}
