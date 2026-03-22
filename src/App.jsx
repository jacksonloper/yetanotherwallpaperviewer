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
import './App.css'

const PI = Math.PI

const ISOMETRY_TYPES = ['translation', 'rotation', 'reflection', 'glide-reflection']

function defaultGenerator(type) {
  switch (type) {
    case 'translation':
      return { type, tx: '1', ty: '0' }
    case 'rotation':
      return { type, angle: '90', cx: '0', cy: '0' }
    case 'reflection':
      return { type, angle: '0', px: '0', py: '0' }
    case 'glide-reflection':
      return { type, angle: '0', dist: '0.5', px: '0', py: '0' }
    default:
      return { type: 'translation', tx: '1', ty: '0' }
  }
}

function parseGenerator(gen) {
  switch (gen.type) {
    case 'translation':
      return translation(parseFloat(gen.tx), parseFloat(gen.ty))
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

      {gen.type === 'translation' && (
        <>
          <label>tx:<input type="number" step="0.1" value={gen.tx} onChange={(e) => update('tx', e.target.value)} /></label>
          <label>ty:<input type="number" step="0.1" value={gen.ty} onChange={(e) => update('ty', e.target.value)} /></label>
        </>
      )}

      {gen.type === 'rotation' && (
        <>
          <label>angle°:<input type="number" step="15" value={gen.angle} onChange={(e) => update('angle', e.target.value)} /></label>
          <label>cx:<input type="number" step="0.1" value={gen.cx} onChange={(e) => update('cx', e.target.value)} /></label>
          <label>cy:<input type="number" step="0.1" value={gen.cy} onChange={(e) => update('cy', e.target.value)} /></label>
        </>
      )}

      {gen.type === 'reflection' && (
        <>
          <label>angle°:<input type="number" step="15" value={gen.angle} onChange={(e) => update('angle', e.target.value)} /></label>
          <label>px:<input type="number" step="0.1" value={gen.px} onChange={(e) => update('px', e.target.value)} /></label>
          <label>py:<input type="number" step="0.1" value={gen.py} onChange={(e) => update('py', e.target.value)} /></label>
        </>
      )}

      {gen.type === 'glide-reflection' && (
        <>
          <label>angle°:<input type="number" step="15" value={gen.angle} onChange={(e) => update('angle', e.target.value)} /></label>
          <label>dist:<input type="number" step="0.1" value={gen.dist} onChange={(e) => update('dist', e.target.value)} /></label>
          <label>px:<input type="number" step="0.1" value={gen.px} onChange={(e) => update('px', e.target.value)} /></label>
          <label>py:<input type="number" step="0.1" value={gen.py} onChange={(e) => update('py', e.target.value)} /></label>
        </>
      )}

      <button className="btn-remove" onClick={() => onRemove(index)}>✕</button>
    </div>
  )
}

function isometriesToEditorState(isometries) {
  return isometries.map((iso) => {
    if (isTranslation(iso)) {
      return { type: 'translation', tx: String(iso.tx), ty: String(iso.ty) }
    }
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
  const [generators, setGenerators] = useState([
    defaultGenerator('translation'),
    { type: 'translation', tx: '0', ty: '1' },
    { type: 'rotation', angle: '90', cx: '0', cy: '0' },
  ])
  const [maxWords, setMaxWords] = useState(6)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const addGenerator = () => {
    setGenerators([...generators, defaultGenerator('translation')])
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
    const isos = preset.generators()
    setGenerators(isometriesToEditorState(isos))
    setResult(null)
    setError(null)
  }

  const generate = useCallback(() => {
    try {
      const isos = generators.map(parseGenerator).filter(Boolean)
      if (isos.length === 0) {
        setError('No valid generators specified.')
        setResult(null)
        return
      }
      const res = generateGroup(isos, maxWords)
      if (res.error) {
        setError(res.error)
        setResult(null)
      } else {
        setError(null)
        const transGens = isos.filter((g) => isTranslation(g))
        const latticeVectors =
          transGens.length >= 2
            ? {
                v1: { x: transGens[0].tx, y: transGens[0].ty },
                v2: { x: transGens[1].tx, y: transGens[1].ty },
              }
            : null
        setResult({ elements: res.elements, latticeVectors })
      }
    } catch (err) {
      setError(`Error: ${err.message}`)
      setResult(null)
    }
  }, [generators, maxWords])

  return (
    <div className="app-container">
      <h1>Wallpaper Group Viewer</h1>
      <p className="subtitle">
        Specify generators (including exactly two translations for the lattice) and visualize the wallpaper group.
      </p>

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

      <div className="generators-section">
        <h3>Generators</h3>
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

      <div className="controls">
        <label>
          Max word length:{' '}
          <input
            type="number"
            min="1"
            max="20"
            value={maxWords}
            onChange={(e) => setMaxWords(parseInt(e.target.value, 10) || 6)}
          />
        </label>
        <button className="btn-generate" onClick={generate}>Generate Group</button>
      </div>

      {error && (
        <div className="error-box">{error}</div>
      )}

      {result && (
        <GroupVisualization
          elements={result.elements}
          latticeVectors={result.latticeVectors}
        />
      )}
    </div>
  )
}
