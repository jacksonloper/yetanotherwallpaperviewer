import { useMemo, useState, useEffect } from 'react';
import {
  classify,
  rotationInfo,
  rotationOrder,
  reflectionInfo,
  applyToPoint,
} from '../math/isometry.js';
import { generateLatticePoints } from '../math/groupGenerator.js';
import { drawGPCoefficients, shoStepGPCoefficients, drawWindCoefficients, shoStepWindCoefficients } from '../math/gaussianProcess.js';
import GPShaderCanvas from './GPShaderCanvas.jsx';
import WindShaderCanvas from './WindShaderCanvas.jsx';

export const SCALE = 80; // pixels per unit
export const SVG_WIDTH = 700;
export const SVG_HEIGHT = 500;

/**
 * Convert math coordinates to SVG coordinates.
 * SVG y-axis is flipped relative to math convention.
 */
function toSvg(x, y, cx, cy) {
  return { x: cx + x * SCALE, y: cy - y * SCALE };
}

/**
 * Draw a rotation marker (diamond=2, triangle=3, square=4, hexagon=6).
 */
function RotationMarker({ cx, cy, order, svgCx, svgCy }) {
  const pos = toSvg(cx, cy, svgCx, svgCy);
  const r = 6;
  const n = order || 4;

  const colors = { 2: '#e74c3c', 3: '#2ecc71', 4: '#3498db', 6: '#9b59b6' };
  const color = colors[n] || '#e67e22';

  // Order-2: draw an oblique diamond (4-point polygon rotated 45°)
  if (n === 2) {
    const rx = r * 0.85;  // horizontal half-extent
    const ry = r * 0.55;  // vertical half-extent (oblique, not square)
    const pts = [
      `${pos.x},${pos.y - ry}`,       // top
      `${pos.x + rx},${pos.y}`,        // right
      `${pos.x},${pos.y + ry}`,        // bottom
      `${pos.x - rx},${pos.y}`,        // left
    ];
    return (
      <polygon
        points={pts.join(' ')}
        fill={color}
        stroke="var(--color-svg-stroke, #222)"
        strokeWidth="1"
        opacity="0.85"
      />
    );
  }

  const points = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    points.push(`${pos.x + r * Math.cos(angle)},${pos.y + r * Math.sin(angle)}`);
  }

  return (
    <polygon
      points={points.join(' ')}
      fill={color}
      stroke="var(--color-svg-stroke, #222)"
      strokeWidth="1"
      opacity="0.85"
    />
  );
}

/**
 * Draw a reflection line (solid).
 */
function ReflectionLine({ angle, px, py, svgCx, svgCy, viewWidth }) {
  const len = viewWidth;
  const p1 = toSvg(
    px - len * Math.cos(angle),
    py - len * Math.sin(angle),
    svgCx,
    svgCy
  );
  const p2 = toSvg(
    px + len * Math.cos(angle),
    py + len * Math.sin(angle),
    svgCx,
    svgCy
  );
  return (
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="#e74c3c"
      strokeWidth="1.5"
      opacity="0.6"
    />
  );
}

/**
 * The "F" shape vertices in math coordinates (origin-based).
 * Drawn as a filled polygon with a shorter second horizontal bar.
 * Size is ~0.3 units so it's visible but doesn't overwhelm the diagram.
 */
const F_OUTLINE = (() => {
  const s = 0.12; // half-thickness of strokes
  const h = 0.4;  // total height
  const w = 0.28; // top bar width
  const w2 = 0.18; // middle bar width (shorter)
  const mh = 0.22; // middle bar height from bottom
  // Trace an F shape as a closed polygon (counterclockwise)
  return [
    // left edge, bottom to top
    [0, 0],
    [0, h],
    // top bar, going right
    [w, h],
    [w, h - s],
    // back to stem
    [s, h - s],
    // down to middle bar
    [s, mh + s],
    // middle bar, going right
    [w2, mh + s],
    [w2, mh],
    // back to stem
    [s, mh],
    // down to bottom
    [s, 0],
  ];
})();

/**
 * Draw one F shape transformed by an isometry.
 */
function FShape({ isometry, svgCx, svgCy, fOffset }) {
  const ox = fOffset?.x || 0;
  const oy = fOffset?.y || 0;
  const pts = F_OUTLINE.map(([x, y]) => {
    const p = applyToPoint(isometry, x + ox, y + oy);
    return toSvg(p.x, p.y, svgCx, svgCy);
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  return <path d={d} fill="var(--color-fundamental-domain, #2c3e50)" fillOpacity="0.35" stroke="var(--color-fundamental-domain, #2c3e50)" strokeWidth="0.5" />;
}

/**
 * Draw a glide reflection line (dotted).
 */
function GlideReflectionLine({ angle, px, py, svgCx, svgCy, viewWidth }) {
  const len = viewWidth;
  const p1 = toSvg(
    px - len * Math.cos(angle),
    py - len * Math.sin(angle),
    svgCx,
    svgCy
  );
  const p2 = toSvg(
    px + len * Math.cos(angle),
    py + len * Math.sin(angle),
    svgCx,
    svgCy
  );
  return (
    <line
      x1={p1.x}
      y1={p1.y}
      x2={p2.x}
      y2={p2.y}
      stroke="#8e44ad"
      strokeWidth="1.5"
      strokeDasharray="6,4"
      opacity="0.6"
    />
  );
}

/**
 * SVG visualization of a wallpaper group.
 */
export default function GroupVisualization({ elements, latticeVectors, cosetReps, showF, fOffset, showGP, showWind, gpSeed, gpEll, gpN, gpSpeed, gpDamping, gpEquivariant, showGroupElements }) {
  const width = SVG_WIDTH;
  const height = SVG_HEIGHT;
  const svgCx = width / 2;
  const svgCy = height / 2;
  const viewWidth = width / SCALE;

  const bounds = useMemo(
    () => ({
      minX: -viewWidth / 2 - 1,
      maxX: viewWidth / 2 + 1,
      minY: -height / (2 * SCALE) - 1,
      maxY: height / (2 * SCALE) + 1,
    }),
    [viewWidth, height]
  );

  // Visible bounds for GP / wind rendering (exact viewport, no margin)
  const gpBounds = useMemo(
    () => ({
      minX: -viewWidth / 2,
      maxX: viewWidth / 2,
      minY: -height / (2 * SCALE),
      maxY: height / (2 * SCALE),
    }),
    [viewWidth, height]
  );

  // GP coefficients: initialize from seed, then evolve via SHO
  const initialCoeffs = useMemo(() => {
    if (!showGP || !latticeVectors) return null;
    return drawGPCoefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
  }, [showGP, latticeVectors, gpSeed, gpEll, gpN]);

  // Second GP for vector-field equivariance (p3/p4/p6: |G/T| > 2)
  const needsVectorField = showGP && gpEquivariant && cosetReps && cosetReps.length > 2;
  const initialCoeffs2 = useMemo(() => {
    if (!needsVectorField || !latticeVectors) return null;
    return drawGPCoefficients(latticeVectors, (gpSeed ?? 0) + 1000, gpN ?? 5, gpEll ?? 0.1);
  }, [needsVectorField, latticeVectors, gpSeed, gpEll, gpN]);

  const [gpCoeffs, setGpCoeffs] = useState(null);
  const [prevInitialCoeffs, setPrevInitialCoeffs] = useState(null);
  const [gpCoeffs2, setGpCoeffs2] = useState(null);
  const [prevInitialCoeffs2, setPrevInitialCoeffs2] = useState(null);

  if (initialCoeffs !== prevInitialCoeffs) {
    setPrevInitialCoeffs(initialCoeffs);
    setGpCoeffs(initialCoeffs);
  }

  if (initialCoeffs2 !== prevInitialCoeffs2) {
    setPrevInitialCoeffs2(initialCoeffs2);
    setGpCoeffs2(initialCoeffs2);
  }

  // GP animation loop
  useEffect(() => {
    if (!gpSpeed || gpSpeed <= 0) return;

    let animId;
    let lastTime = null;
    const damping = gpDamping;

    const animate = (timestamp) => {
      if (lastTime !== null) {
        const dt = (timestamp - lastTime) / 1000;
        setGpCoeffs((prev) =>
          prev ? shoStepGPCoefficients(prev, dt, gpSpeed, damping) : prev
        );
        setGpCoeffs2((prev) =>
          prev ? shoStepGPCoefficients(prev, dt, gpSpeed, damping) : prev
        );
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [gpSpeed, gpDamping]);

  // ── Wind coefficients ────────────────────────────────────
  const windInitialCoeffs = useMemo(() => {
    if (!showWind || !latticeVectors) return null;
    return drawWindCoefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
  }, [showWind, latticeVectors, gpSeed, gpEll, gpN]);

  const [windCoeffs, setWindCoeffs] = useState(null);
  const [prevWindInitialCoeffs, setPrevWindInitialCoeffs] = useState(null);
  const [windResetCount, setWindResetCount] = useState(0);

  if (windInitialCoeffs !== prevWindInitialCoeffs) {
    setPrevWindInitialCoeffs(windInitialCoeffs);
    setWindCoeffs(windInitialCoeffs);
    setWindResetCount((c) => c + 1);
  }

  // Wind animation loop (SHO for the two GPs)
  useEffect(() => {
    if (!showWind || !gpSpeed || gpSpeed <= 0) return;

    let animId;
    let lastTime = null;
    const damping = gpDamping;

    const animate = (timestamp) => {
      if (lastTime !== null) {
        const dt = (timestamp - lastTime) / 1000;
        setWindCoeffs((prev) =>
          prev ? shoStepWindCoefficients(prev, dt, gpSpeed, damping) : prev
        );
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [showWind, gpSpeed, gpDamping]);

  const latticePoints = useMemo(() => {
    if (!latticeVectors) return [];
    return generateLatticePoints(latticeVectors.v1, latticeVectors.v2, bounds);
  }, [latticeVectors, bounds]);

  // Classify elements for rendering
  const classified = useMemo(() => {
    if (!elements) return [];
    return elements.map((el) => {
      const type = classify(el);
      if (type === 'rotation') {
        const info = rotationInfo(el);
        const order = rotationOrder(el);
        return { type, ...info, order };
      }
      if (type === 'reflection' || type === 'glide-reflection') {
        const info = reflectionInfo(el);
        return { type, ...info };
      }
      return { type };
    });
  }, [elements]);

  // Deduplicate rotation centres
  const rotationMarkers = useMemo(() => {
    const markers = [];
    const seen = new Set();
    for (const c of classified) {
      if (c.type !== 'rotation') continue;
      const key = `${c.cx.toFixed(3)},${c.cy.toFixed(3)},${c.order}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (c.cx >= bounds.minX && c.cx <= bounds.maxX && c.cy >= bounds.minY && c.cy <= bounds.maxY) {
        markers.push(c);
      }
    }
    return markers;
  }, [classified, bounds]);

  const reflLines = useMemo(() => {
    const lines = [];
    const seen = new Set();
    for (const c of classified) {
      if (c.type !== 'reflection') continue;
      const key = `${(c.angle % Math.PI).toFixed(3)},${c.px.toFixed(3)},${c.py.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(c);
    }
    return lines;
  }, [classified]);

  const glideLines = useMemo(() => {
    const lines = [];
    const seen = new Set();
    for (const c of classified) {
      if (c.type !== 'glide-reflection') continue;
      const key = `${(c.angle % Math.PI).toFixed(3)},${c.px.toFixed(3)},${c.py.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(c);
    }
    return lines;
  }, [classified]);

  // Count by type
  const counts = useMemo(() => {
    const c = { identity: 0, translation: 0, rotation: 0, reflection: 0, 'glide-reflection': 0 };
    for (const el of classified) {
      c[el.type] = (c[el.type] || 0) + 1;
    }
    return c;
  }, [classified]);

  return (
    <div>
      <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary, #666)' }}>
        Elements: {elements?.length || 0} |{' '}
        Rot: {counts.rotation} | Refl: {counts.reflection} |{' '}
        Glide: {counts['glide-reflection']} | Trans: {counts.translation}
      </div>
      <div style={{ position: 'relative', width, height }}>
        {/* Three.js GP canvas (behind SVG) */}
        {showGP && gpCoeffs && cosetReps && (
          <GPShaderCanvas
            gpCoeffs={gpCoeffs}
            gpCoeffs2={needsVectorField ? gpCoeffs2 : null}
            cosetReps={cosetReps}
            bounds={gpBounds}
            width={width}
            height={height}
            equivariant={gpEquivariant}
          />
        )}

        {/* Three.js wind-map canvas (behind SVG) */}
        {showWind && windCoeffs && cosetReps && (
          <WindShaderCanvas
            windCoeffs={windCoeffs}
            cosetReps={cosetReps}
            bounds={gpBounds}
            width={width}
            height={height}
            resetTrigger={windResetCount}
          />
        )}

        {/* SVG overlay for group elements */}
        <svg
          width={width}
          height={height}
          style={{
            position: (showGP || showWind) ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            border: '1px solid var(--color-svg-container-border, #ccc)',
            background: (showGP || showWind) ? 'transparent' : 'var(--color-svg-container-bg, #fafafa)',
            borderRadius: '4px',
          }}
        >
          {/* Lattice dots */}
          {showGroupElements !== false && latticePoints.map((p, i) => {
            const sp = toSvg(p.x, p.y, svgCx, svgCy);
            return (
              <circle
                key={`lp-${i}`}
                cx={sp.x}
                cy={sp.y}
                r="3"
                fill="var(--color-svg-muted, #999)"
                opacity="0.5"
              />
            );
          })}

          {/* F shapes (one per group element) */}
          {showF && elements && elements.map((el, i) => (
            <FShape key={`f-${i}`} isometry={el} svgCx={svgCx} svgCy={svgCy} fOffset={fOffset} />
          ))}

          {/* Reflection lines (solid) */}
          {showGroupElements !== false && reflLines.map((r, i) => (
            <ReflectionLine
              key={`refl-${i}`}
              angle={r.angle}
              px={r.px}
              py={r.py}
              svgCx={svgCx}
              svgCy={svgCy}
              viewWidth={viewWidth}
            />
          ))}

          {/* Glide reflection lines (dotted) */}
          {showGroupElements !== false && glideLines.map((g, i) => (
            <GlideReflectionLine
              key={`glide-${i}`}
              angle={g.angle}
              px={g.px}
              py={g.py}
              svgCx={svgCx}
              svgCy={svgCy}
              viewWidth={viewWidth}
            />
          ))}

          {/* Rotation markers */}
          {showGroupElements !== false && rotationMarkers.map((r, i) => (
            <RotationMarker
              key={`rot-${i}`}
              cx={r.cx}
              cy={r.cy}
              order={r.order}
              svgCx={svgCx}
              svgCy={svgCy}
            />
          ))}

          {/* Origin marker */}
          {showGroupElements !== false && (
            <circle cx={svgCx} cy={svgCy} r="4" fill="var(--color-svg-stroke, #222)" />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--color-text-secondary, #555)' }}>
        <span>● Lattice point</span>
        <span style={{ color: '#e74c3c' }}>◆ 2-fold rotation</span>
        <span style={{ color: '#2ecc71' }}>▲ 3-fold rotation</span>
        <span style={{ color: '#3498db' }}>■ 4-fold rotation</span>
        <span style={{ color: '#9b59b6' }}>⬡ 6-fold rotation</span>
        <span style={{ color: '#e74c3c' }}>— Reflection</span>
        <span style={{ color: '#8e44ad' }}>┄ Glide reflection</span>
      </div>
    </div>
  );
}
