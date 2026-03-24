/**
 * LatticeControls – renders the appropriate lattice UI for the selected wallpaper type.
 *
 * Props:
 *   wpType      – wallpaper type entry from ALL_WALLPAPER_TYPES
 *   latticeState – { rectSlider, cmSlider, fullLattice }
 *   latticeVec  – pre-computed { x, y } second lattice vector
 *   onChange     – callback receiving partial latticeState updates
 */
export default function LatticeControls({ wpType, latticeState, latticeVec, latticeType, onChange }) {
  const control = wpType.latticeControl

  return (
    <div className="panel">
      <h3 className="panel-heading">
        Lattice
        {latticeType && <span className="lattice-type-badge">{latticeType}</span>}
      </h3>
      <p className="lattice-info">
        First translation: <strong>(0, 1)</strong>.
        Second translation: <strong>({latticeVec.x.toFixed(4)}, {latticeVec.y.toFixed(4)})</strong>
      </p>

      {control === 'none' && (
        <div className="slider-info">
          Fixed {wpType.fixedLattice} lattice — no adjustable parameters.
        </div>
      )}

      {control === 'rect-to-square' && (
        <RectToSquareSlider
          value={latticeState.rectSlider ?? 0.5}
          onChange={(v) => onChange({ rectSlider: v })}
          latticeVec={latticeVec}
        />
      )}

      {control === 'cm-slider' && (
        <CmSlider
          value={latticeState.cmSlider ?? 0.8125}
          onChange={(v) => onChange({ cmSlider: v })}
          latticeVec={latticeVec}
        />
      )}

      {control === 'full' && (
        <FullLatticeControls
          lattice={latticeState.fullLattice ?? { mode: 'well-rounded', sliderValue: 0 }}
          onChange={(lat) => onChange({ fullLattice: lat })}
        />
      )}
    </div>
  )
}

// ─── Rectangular → Square slider ───

function RectToSquareSlider({ value, onChange, latticeVec }) {
  const labelForValue = (v) => {
    if (v > 0.99) return 'Square'
    return 'Rectangular'
  }

  return (
    <div className="well-rounded-controls">
      <div className="slider-row">
        <span className="slider-label">Rect</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="lattice-slider"
        />
        <span className="slider-label">Square</span>
      </div>
      <div className="slider-info">
        {labelForValue(value)} — x = {latticeVec.x.toFixed(4)}, y = {latticeVec.y.toFixed(4)}
      </div>
    </div>
  )
}

// ─── CM slider (angle between lattice vectors: 10° → 60° → 90°) ───

const HEX_T = 0.625  // t value where angle = 60° (hexagonal)
const HEX_SNAP = 0.02

function CmSlider({ value, onChange }) {
  const handleChange = (e) => {
    let v = parseFloat(e.target.value)
    // Sticky at hex (t = 0.625)
    if (Math.abs(v - HEX_T) < HEX_SNAP) v = HEX_T
    onChange(v)
  }

  const angle = 10 + value * 80

  const labelForValue = (v) => {
    if (Math.abs(v - HEX_T) < 0.001) return 'Hexagonal'
    if (v > 0.99) return 'Square'
    return 'Centered Rectangular'
  }

  return (
    <div className="well-rounded-controls">
      <div className="slider-row">
        <span className="slider-label">Acute</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={value}
          onChange={handleChange}
          className="lattice-slider"
        />
        <span className="slider-label">Square</span>
      </div>
      <div className="slider-info">
        {labelForValue(value)} — angle = {angle.toFixed(1)}°
        {Math.abs(value - HEX_T) < 0.001 && ' ⬡'}
      </div>
    </div>
  )
}

// ─── Full lattice controls (p1, p2) ───

function FullLatticeControls({ lattice, onChange }) {
  const { mode } = lattice

  const setMode = (newMode) => {
    if (newMode === 'well-rounded') {
      onChange({ mode: 'well-rounded', sliderValue: 0 })
    } else {
      onChange({ mode: 'not-well-rounded', shape: 'rectangular', x: 1.5 })
    }
  }

  return (
    <div>
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
              min={Math.sqrt(0.75).toFixed(4)} /* √(3/4) = √3/2 ≈ 0.866, hex boundary */
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
