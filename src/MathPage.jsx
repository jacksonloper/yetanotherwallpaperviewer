import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  rat, rmat, rToString,
} from './math/rational.js'
import {
  standardGenerators,
  processGroup,
  rmatToJsonObj,
  quotientToPhysical,
} from './math/rationalGroup.js'
import { classify, rotationOrder } from './math/isometry.js'
import { fixedLatticeVector } from './math/latticeUtils.js'
import './App.css'

// ───────────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────────

/**
 * Parse a rational string like "1/2", "-3", "0" into a [n, d] pair.
 * Returns null on invalid input.
 */
function parseRational(s) {
  s = s.trim()
  if (s === '') return null
  const parts = s.split('/')
  if (parts.length === 1) {
    const n = parseInt(parts[0], 10)
    if (!Number.isFinite(n)) return null
    return rat(n, 1)
  }
  if (parts.length === 2) {
    const n = parseInt(parts[0], 10)
    const d = parseInt(parts[1], 10)
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null
    return rat(n, d)
  }
  return null
}

/**
 * Convert an rmat to an array of 6 rational strings for editing.
 */
function rmatToStrings(m) {
  return {
    a: rToString(m.a),
    b: rToString(m.b),
    c: rToString(m.c),
    d: rToString(m.d),
    tx: rToString(m.tx),
    ty: rToString(m.ty),
  }
}

/**
 * Parse 6 rational strings back to an rmat.
 * Returns { mat, error }.
 */
function parseRmatStrings(strs) {
  const fields = ['a', 'b', 'c', 'd', 'tx', 'ty']
  const parsed = {}
  for (const f of fields) {
    const r = parseRational(strs[f])
    if (!r) return { mat: null, error: `Invalid rational in field "${f}": "${strs[f]}"` }
    parsed[f] = r
  }
  return { mat: rmat(parsed.a, parsed.b, parsed.c, parsed.d, parsed.tx, parsed.ty), error: null }
}

/** Default lattice vector for a given lattice type. */
function defaultLatticeVec(latticeType) {
  if (latticeType === 'square') return fixedLatticeVector('square')
  if (latticeType === 'hexagonal') return fixedLatticeVector('hexagonal')
  return { x: 1.5, y: 0 }
}

/** All 17 wallpaper type names. */
const ALL_TYPES = [
  'p1', 'p2',
  'pm', 'pg', 'pmm', 'pmg', 'pgg',
  'cm', 'cmm',
  'p4', 'p4m', 'p4g',
  'p3', 'p3m1', 'p31m', 'p6', 'p6m',
]

// ───────────────────────────────────────────────────
//  Editable generator row
// ───────────────────────────────────────────────────

function GeneratorEditor({ index, strs, onChange, onRemove }) {
  const handleField = (field, value) => {
    onChange(index, { ...strs, [field]: value })
  }

  // Check validity for visual cue
  const isFieldValid = (field) => parseRational(strs[field]) !== null

  return (
    <div className="gen-editor">
      <div className="gen-editor-header">
        <span className="gen-editor-label">Generator {index + 1}</span>
        <button className="btn-remove" onClick={() => onRemove(index)} title="Remove generator">✕</button>
      </div>
      <div className="gen-matrix">
        <div className="gen-matrix-bracket">[</div>
        <div className="gen-matrix-grid">
          <input
            className={`gen-input ${isFieldValid('a') ? '' : 'input-invalid'}`}
            value={strs.a} onChange={e => handleField('a', e.target.value)}
            title="a (linear)"
          />
          <input
            className={`gen-input ${isFieldValid('b') ? '' : 'input-invalid'}`}
            value={strs.b} onChange={e => handleField('b', e.target.value)}
            title="b (linear)"
          />
          <input
            className={`gen-input ${isFieldValid('tx') ? '' : 'input-invalid'}`}
            value={strs.tx} onChange={e => handleField('tx', e.target.value)}
            title="tx (translation)"
          />
          <input
            className={`gen-input ${isFieldValid('c') ? '' : 'input-invalid'}`}
            value={strs.c} onChange={e => handleField('c', e.target.value)}
            title="c (linear)"
          />
          <input
            className={`gen-input ${isFieldValid('d') ? '' : 'input-invalid'}`}
            value={strs.d} onChange={e => handleField('d', e.target.value)}
            title="d (linear)"
          />
          <input
            className={`gen-input ${isFieldValid('ty') ? '' : 'input-invalid'}`}
            value={strs.ty} onChange={e => handleField('ty', e.target.value)}
            title="ty (translation)"
          />
        </div>
        <div className="gen-matrix-bracket">]</div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────
//  Coset result display
// ───────────────────────────────────────────────────

function CosetDisplay({ cosets, latticeVec }) {
  const physicals = useMemo(
    () => quotientToPhysical(cosets, latticeVec),
    [cosets, latticeVec]
  )

  return (
    <div className="coset-list">
      {cosets.map((c, i) => {
        const obj = rmatToJsonObj(c)
        const phys = physicals[i]
        const cls = classify(phys)
        let label = cls
        if (cls === 'rotation') {
          const ord = rotationOrder(phys)
          if (ord > 0) label = `rotation (order ${ord})`
        }
        return (
          <div key={i} className="coset-card">
            <div className="coset-card-header">
              <span className="coset-index">#{i + 1}</span>
              <span className="coset-type">{label}</span>
            </div>
            <div className="coset-matrix">
              <span className="coset-row">[{obj.linear[0].join(', ')}, {obj.translation[0]}]</span>
              <span className="coset-row">[{obj.linear[1].join(', ')}, {obj.translation[1]}]</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────
//  Main Math Page
// ───────────────────────────────────────────────────

export default function MathPage() {
  // --- Lattice ---
  const [latticeX, setLatticeX] = useState('1')
  const [latticeY, setLatticeY] = useState('0')

  // --- Generators (as editable string objects) ---
  const [genStrs, setGenStrs] = useState([])

  // --- Load preset ---
  const loadPreset = useCallback((typeName) => {
    const stdGen = standardGenerators(typeName)
    if (!stdGen) return
    const gens = stdGen.generators.map(rmatToStrings)
    setGenStrs(gens)
    const vec = defaultLatticeVec(stdGen.latticeType)
    setLatticeX(String(parseFloat(vec.x.toFixed(6))))
    setLatticeY(String(parseFloat(vec.y.toFixed(6))))
  }, [])

  // --- Generator editing ---
  const handleGenChange = useCallback((index, newStrs) => {
    setGenStrs(prev => prev.map((g, i) => i === index ? newStrs : g))
  }, [])

  const handleGenRemove = useCallback((index) => {
    setGenStrs(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleGenAdd = useCallback(() => {
    setGenStrs(prev => [...prev, { a: '1', b: '0', c: '0', d: '1', tx: '0', ty: '0' }])
  }, [])

  // --- Parse inputs and run algorithm ---
  const result = useMemo(() => {
    // Parse lattice
    const lx = parseFloat(latticeX)
    const ly = parseFloat(latticeY)
    if (!Number.isFinite(lx) || !Number.isFinite(ly)) {
      return { error: 'Invalid lattice vector: x and y must be numbers.', data: null }
    }
    if (lx === 0 && ly === 0) {
      return { error: 'Lattice vector (x, y) must be non-zero.', data: null }
    }
    const latticeVec = { x: lx, y: ly }

    // Parse generators
    const generators = []
    for (let i = 0; i < genStrs.length; i++) {
      const { mat, error } = parseRmatStrings(genStrs[i])
      if (error) {
        return { error: `Generator ${i + 1}: ${error}`, data: null }
      }
      generators.push(mat)
    }

    // Run the algorithm
    try {
      const { cosets, isDegenerate, order, error: groupError } = processGroup(generators)
      if (groupError) {
        return { error: groupError, data: null }
      }
      return {
        error: null,
        data: {
          cosets,
          order,
          isDegenerate,
          latticeVec,
          generators,
        },
      }
    } catch (err) {
      return { error: `Algorithm error: ${err.message}`, data: null }
    }
  }, [latticeX, latticeY, genStrs])

  return (
    <div className="app-container">
      <h1>Math Explorer</h1>
      <p className="subtitle">
        Define a lattice and rational affine generators, then see if they form a valid wallpaper group.
        Start from a preset and modify, or build from scratch.
      </p>

      {/* ── Preset selector ── */}
      <div className="panel">
        <h3 className="panel-heading">Load Preset</h3>
        <div className="group-category-buttons" style={{ flexWrap: 'wrap' }}>
          {ALL_TYPES.map(t => (
            <button key={t} className="group-btn" onClick={() => loadPreset(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lattice vector ── */}
      <div className="panel">
        <h3 className="panel-heading">Lattice</h3>
        <p className="lattice-info">
          First lattice vector is always <strong>(0, 1)</strong>.
          Second lattice vector:
        </p>
        <div className="lattice-params">
          <label>
            x:&nbsp;
            <input
              type="text"
              value={latticeX}
              onChange={e => setLatticeX(e.target.value)}
              className={Number.isFinite(parseFloat(latticeX)) ? '' : 'input-invalid'}
              style={{ width: 80 }}
            />
          </label>
          <label>
            y:&nbsp;
            <input
              type="text"
              value={latticeY}
              onChange={e => setLatticeY(e.target.value)}
              className={Number.isFinite(parseFloat(latticeY)) ? '' : 'input-invalid'}
              style={{ width: 80 }}
            />
          </label>
        </div>
      </div>

      {/* ── Generators ── */}
      <div className="panel">
        <h3 className="panel-heading">Generators (rational affine matrices in lattice coordinates)</h3>
        <p className="lattice-info">
          Each generator is a 2×3 affine matrix [a b tx ; c d ty].
          Enter rational numbers as integers or fractions (e.g. <code>1/2</code>, <code>-1</code>, <code>0</code>).
          Lattice translations are always implicit.
        </p>

        {genStrs.length === 0 && (
          <p className="constraint-hint">No generators — this is the trivial group (p1).</p>
        )}

        {genStrs.map((strs, i) => (
          <GeneratorEditor
            key={i}
            index={i}
            strs={strs}
            onChange={handleGenChange}
            onRemove={handleGenRemove}
          />
        ))}

        <button className="btn-secondary" onClick={handleGenAdd} style={{ marginTop: 8 }}>
          + Add Generator
        </button>
      </div>

      {/* ── Results ── */}
      <div className="panel">
        <h3 className="panel-heading">Results</h3>

        {result.error && (
          <div className="error-box">{result.error}</div>
        )}

        {result.data && (
          <>
            <div className="math-result-summary">
              <span className="math-result-badge math-result-ok">
                ✓ Valid wallpaper group
              </span>
              <span className="math-result-order">|G/T| = {result.data.order}</span>
            </div>

            <h4 style={{ margin: '12px 0 8px', fontSize: 14, color: 'var(--color-heading)' }}>
              Coset representatives (G/T)
            </h4>
            <CosetDisplay cosets={result.data.cosets} latticeVec={result.data.latticeVec} />
          </>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
        <Link to="/">← Back to Viewer</Link>
      </p>
    </div>
  )
}
