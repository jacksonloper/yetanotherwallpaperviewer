import ValidatedInput from './ValidatedInput.jsx'
import { latticeToVector } from '../math/latticeUtils.js'

/**
 * LatticeSelector – UI for choosing the second lattice translation vector.
 *
 * The first translation is always (0, 1).
 * The second translation is (x, y) where x >= 0, 0 <= y <= 0.5, x² + y² >= 1.
 *
 * Two modes:
 *   - Well-rounded: both basis vectors have equal length (x² + y² = 1).
 *     A slider interpolates from hex (y=0.5) to square (y=0).
 *   - Not well-rounded: x² + y² > 1.
 *     Sub-choices: centered rectangular (y=0.5), rectangular (y=0), oblique (free).
 */
export default function LatticeSelector({ lattice, onChange }) {
  const { mode } = lattice

  const setMode = (newMode) => {
    if (newMode === 'well-rounded') {
      onChange({ mode: 'well-rounded', sliderValue: 0 })
    } else {
      onChange({ mode: 'not-well-rounded', shape: 'rectangular', x: 1.5 })
    }
  }

  // Compute the second lattice vector from the current lattice state
  const vec = latticeToVector(lattice)

  return (
    <div className="lattice-selector">
      <h3>Lattice</h3>
      <p className="lattice-info">
        First translation: <strong>(0, 1)</strong>.
        Second translation: <strong>({vec.x.toFixed(4)}, {vec.y.toFixed(4)})</strong>
      </p>

      <div className="lattice-mode-row">
        <label>
          <input
            type="radio"
            name="lattice-mode"
            checked={mode === 'well-rounded'}
            onChange={() => setMode('well-rounded')}
          />
          Well-rounded (equal-length basis vectors)
        </label>
        <label>
          <input
            type="radio"
            name="lattice-mode"
            checked={mode === 'not-well-rounded'}
            onChange={() => setMode('not-well-rounded')}
          />
          Not well-rounded
        </label>
      </div>

      {mode === 'well-rounded' && (
        <WellRoundedControls lattice={lattice} onChange={onChange} />
      )}

      {mode === 'not-well-rounded' && (
        <NotWellRoundedControls lattice={lattice} onChange={onChange} />
      )}
    </div>
  )
}

function WellRoundedControls({ lattice, onChange }) {
  const sliderValue = lattice.sliderValue ?? 0
  // sliderValue: 0 = square (y=0), 1 = hex (y=0.5)
  const y = sliderValue * 0.5
  const x = Math.sqrt(1 - y * y)

  const handleSlider = (e) => {
    onChange({ mode: 'well-rounded', sliderValue: parseFloat(e.target.value) })
  }

  const labelForValue = (v) => {
    if (v < 0.01) return 'Square'
    if (v > 0.99) return 'Hexagonal'
    return 'Centered Rectangular'
  }

  return (
    <div className="well-rounded-controls">
      <div className="slider-row">
        <span className="slider-label">Square</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={sliderValue}
          onChange={handleSlider}
          className="lattice-slider"
        />
        <span className="slider-label">Hex</span>
      </div>
      <div className="slider-info">
        {labelForValue(sliderValue)} — x = {x.toFixed(4)}, y = {y.toFixed(4)}
      </div>
    </div>
  )
}

function NotWellRoundedControls({ lattice, onChange }) {
  const shape = lattice.shape || 'rectangular'

  const setShape = (newShape) => {
    switch (newShape) {
      case 'centered-rectangular':
        onChange({ mode: 'not-well-rounded', shape: newShape, x: 1.0 })
        break
      case 'rectangular':
        onChange({ mode: 'not-well-rounded', shape: newShape, x: 1.5 })
        break
      case 'oblique':
        onChange({ mode: 'not-well-rounded', shape: newShape, x: 1.1, y: 0.3 })
        break
      default:
        break
    }
  }

  return (
    <div className="not-well-rounded-controls">
      <div className="shape-radios">
        <label>
          <input
            type="radio"
            name="lattice-shape"
            checked={shape === 'centered-rectangular'}
            onChange={() => setShape('centered-rectangular')}
          />
          Centered rectangular (y = 0.5)
        </label>
        <label>
          <input
            type="radio"
            name="lattice-shape"
            checked={shape === 'rectangular'}
            onChange={() => setShape('rectangular')}
          />
          Rectangular (y = 0)
        </label>
        <label>
          <input
            type="radio"
            name="lattice-shape"
            checked={shape === 'oblique'}
            onChange={() => setShape('oblique')}
          />
          Oblique
        </label>
      </div>

      {shape === 'centered-rectangular' && (
        <div className="lattice-params">
          <label>
            x:
            <ValidatedInput
              value={lattice.x ?? 1.0}
              onChange={(v) =>
                onChange({ ...lattice, x: v })
              }
              validate={(v) => v >= 0 && v * v + 0.25 >= 1}
            />
          </label>
          <span className="constraint-hint">x² + 0.25 ≥ 1 (x ≥ {Math.sqrt(0.75).toFixed(3)})</span>
        </div>
      )}

      {shape === 'rectangular' && (
        <div className="lattice-params">
          <label>
            x:
            <ValidatedInput
              value={lattice.x ?? 1.5}
              onChange={(v) =>
                onChange({ ...lattice, x: v })
              }
              validate={(v) => v >= 1}
            />
          </label>
          <span className="constraint-hint">x ≥ 1</span>
        </div>
      )}

      {shape === 'oblique' && (
        <div className="lattice-params">
          <label>
            x:
            <ValidatedInput
              value={lattice.x ?? 1.1}
              onChange={(v) =>
                onChange({ ...lattice, x: v })
              }
              validate={(v) => {
                const yVal = lattice.y ?? 0.3
                return v >= 0 && v * v + yVal * yVal >= 1
              }}
            />
          </label>
          <label>
            y:
            <ValidatedInput
              value={lattice.y ?? 0.3}
              onChange={(v) =>
                onChange({ ...lattice, y: v })
              }
              validate={(v) => {
                const xVal = lattice.x ?? 1.1
                return v > 0 && v < 0.5 && xVal * xVal + v * v >= 1
              }}
            />
          </label>
          <span className="constraint-hint">
            x ≥ 0, 0 &lt; y &lt; 0.5, x² + y² ≥ 1
          </span>
        </div>
      )}
    </div>
  )
}
