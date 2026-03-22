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
            <input
              type="range"
              min={Math.sqrt(0.75).toFixed(4)}
              max="3"
              step="0.01"
              value={lattice.x ?? 1.0}
              onChange={(e) =>
                onChange({ ...lattice, x: parseFloat(e.target.value) })
              }
              className="param-slider"
            />
            <span className="slider-value">{(lattice.x ?? 1.0).toFixed(3)}</span>
          </label>
        </div>
      )}

      {shape === 'rectangular' && (
        <div className="lattice-params">
          <label>
            x:
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={lattice.x ?? 1.5}
              onChange={(e) =>
                onChange({ ...lattice, x: parseFloat(e.target.value) })
              }
              className="param-slider"
            />
            <span className="slider-value">{(lattice.x ?? 1.5).toFixed(3)}</span>
          </label>
        </div>
      )}

      {shape === 'oblique' && (() => {
        const yVal = lattice.y ?? 0.3
        const xVal = lattice.x ?? 1.1
        const xMin = Math.sqrt(Math.max(0, 1 - yVal * yVal))
        return (
          <div className="lattice-params lattice-params-column">
            <label>
              x:
              <input
                type="range"
                min={xMin.toFixed(4)}
                max="3"
                step="0.01"
                value={xVal}
                onChange={(e) =>
                  onChange({ ...lattice, x: parseFloat(e.target.value) })
                }
                className="param-slider"
              />
              <span className="slider-value">{xVal.toFixed(3)}</span>
            </label>
            <label>
              y:
              <input
                type="range"
                min="0.01"
                max="0.49"
                step="0.01"
                value={yVal}
                onChange={(e) => {
                  const newY = parseFloat(e.target.value)
                  const newXMin = Math.sqrt(Math.max(0, 1 - newY * newY))
                  const newX = Math.max(xVal, newXMin)
                  onChange({ ...lattice, y: newY, x: newX })
                }}
                className="param-slider"
              />
              <span className="slider-value">{yVal.toFixed(3)}</span>
            </label>
          </div>
        )
      })()}
    </div>
  )
}
