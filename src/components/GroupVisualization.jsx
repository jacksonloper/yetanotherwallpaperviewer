import { useMemo, useState, useEffect, useRef } from 'react';
import {
  classify,
  rotationInfo,
  rotationOrder,
  reflectionInfo,
  applyToPoint,
} from '../math/isometry.js';
import { generateLatticePoints } from '../math/groupGenerator.js';
import { drawGPCoefficients, shoStepGPCoefficients, drawWindCoefficients, shoStepWindCoefficients, drawCurlCoefficients, shoStepCurlCoefficients, drawP3Coefficients, shoStepP3Coefficients } from '../math/gaussianProcess.js';
import GPShaderCanvas from './GPShaderCanvas.jsx';
import ParticleCanvas from './ParticleCanvas.jsx';

export const SCALE = 80; // pixels per unit
export const SVG_WIDTH = 700;
export const SVG_HEIGHT = 500;

/**
 * Convert math coordinates to SVG coordinates.
 * SVG y-axis is flipped relative to math convention.
 */
function toSvg(x, y, cx, cy, scale = SCALE) {
  return { x: cx + x * scale, y: cy - y * scale };
}

/**
 * Draw a rotation marker (diamond=2, triangle=3, square=4, hexagon=6).
 */
function RotationMarker({ cx, cy, order, svgCx, svgCy, scale }) {
  const pos = toSvg(cx, cy, svgCx, svgCy, scale);
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
function ReflectionLine({ angle, px, py, svgCx, svgCy, viewWidth, scale }) {
  const len = viewWidth;
  const p1 = toSvg(
    px - len * Math.cos(angle),
    py - len * Math.sin(angle),
    svgCx,
    svgCy,
    scale
  );
  const p2 = toSvg(
    px + len * Math.cos(angle),
    py + len * Math.sin(angle),
    svgCx,
    svgCy,
    scale
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
function FShape({ isometry, svgCx, svgCy, fOffset, scale }) {
  const ox = fOffset?.x || 0;
  const oy = fOffset?.y || 0;
  const pts = F_OUTLINE.map(([x, y]) => {
    const p = applyToPoint(isometry, x + ox, y + oy);
    return toSvg(p.x, p.y, svgCx, svgCy, scale);
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  return <path d={d} fill="var(--color-fundamental-domain, #2c3e50)" fillOpacity="0.35" stroke="var(--color-fundamental-domain, #2c3e50)" strokeWidth="0.5" />;
}

/**
 * Draw a glide reflection line (dotted).
 */
function GlideReflectionLine({ angle, px, py, svgCx, svgCy, viewWidth, scale }) {
  const len = viewWidth;
  const p1 = toSvg(
    px - len * Math.cos(angle),
    py - len * Math.sin(angle),
    svgCx,
    svgCy,
    scale
  );
  const p2 = toSvg(
    px + len * Math.cos(angle),
    py + len * Math.sin(angle),
    svgCx,
    svgCy,
    scale
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
export default function GroupVisualization({ elements, latticeVectors, cosetReps, showF, fOffset, showGP, showParticles, particleSpawnRate, particleFadeSpeed, particleTailLength, particleMaxCount, particleDotSize, gpSeed, gpEll, gpN, gpSpeed, gpDamping, gpEquivariant, showGroupElements, viewZoom, canvasResolution, curlMode }) {
  const zoom = viewZoom || 1.0;
  const resolution = canvasResolution || 1.0;
  const effectiveScale = SCALE * zoom;

  const width = SVG_WIDTH;
  const height = SVG_HEIGHT;
  const svgCx = width / 2;
  const svgCy = height / 2;
  const viewWidth = width / effectiveScale;

  // Render resolution for canvas (may differ from display size)
  const renderWidth = Math.round(width * resolution);
  const renderHeight = Math.round(height * resolution);

  const bounds = useMemo(
    () => ({
      minX: -viewWidth / 2 - 1,
      maxX: viewWidth / 2 + 1,
      minY: -height / (2 * effectiveScale) - 1,
      maxY: height / (2 * effectiveScale) + 1,
    }),
    [viewWidth, height, effectiveScale]
  );

  // Visible bounds for GP / particle rendering (exact viewport, no margin)
  const gpBounds = useMemo(
    () => ({
      minX: -viewWidth / 2,
      maxX: viewWidth / 2,
      minY: -height / (2 * effectiveScale),
      maxY: height / (2 * effectiveScale),
    }),
    [viewWidth, height, effectiveScale]
  );

  // GP coefficients: initialize from seed, then evolve via SHO
  const initialCoeffs = useMemo(() => {
    if (!showGP || !latticeVectors) return null;
    return drawGPCoefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
  }, [showGP, latticeVectors, gpSeed, gpEll, gpN]);

  const [gpCoeffs, setGpCoeffs] = useState(null);
  const [prevInitialCoeffs, setPrevInitialCoeffs] = useState(null);

  if (initialCoeffs !== prevInitialCoeffs) {
    setPrevInitialCoeffs(initialCoeffs);
    setGpCoeffs(initialCoeffs);
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
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [gpSpeed, gpDamping]);

  // ── Wind coefficients (for particle advection) ────────────
  const windInitialCoeffs = useMemo(() => {
    if (!showParticles || !latticeVectors) return null;
    if (curlMode > 0) {
      return drawCurlCoefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
    }
    return drawWindCoefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
  }, [showParticles, latticeVectors, gpSeed, gpEll, gpN, curlMode]);

  const [windCoeffs, setWindCoeffs] = useState(null);
  const [prevWindInitialCoeffs, setPrevWindInitialCoeffs] = useState(null);
  const [windResetCount, setWindResetCount] = useState(0);

  // Track lattice identity to only reset particles when the lattice itself changes
  const prevLatticeRef = useRef(latticeVectors);
  const prevShowParticlesRef = useRef(showParticles);

  if (windInitialCoeffs !== prevWindInitialCoeffs) {
    setPrevWindInitialCoeffs(windInitialCoeffs);
    setWindCoeffs(windInitialCoeffs);
    // Only reset particles+trails when the lattice changes or particles toggled
    const latticeChanged = latticeVectors !== prevLatticeRef.current;
    const showChanged = showParticles !== prevShowParticlesRef.current;
    if (latticeChanged || showChanged) {
      setWindResetCount((c) => c + 1);
    }
    prevLatticeRef.current = latticeVectors;
    prevShowParticlesRef.current = showParticles;
  }

  // Wind animation loop (SHO for the GPs)
  useEffect(() => {
    if (!showParticles || !gpSpeed || gpSpeed <= 0) return;

    let animId;
    let lastTime = null;
    const damping = gpDamping;
    const stepFn = curlMode > 0 ? shoStepCurlCoefficients : shoStepWindCoefficients;

    const animate = (timestamp) => {
      if (lastTime !== null) {
        const dt = (timestamp - lastTime) / 1000;
        setWindCoeffs((prev) =>
          prev ? stepFn(prev, dt, gpSpeed, damping) : prev
        );
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [showParticles, gpSpeed, gpDamping, curlMode]);

  // ── P3 equivariant coefficients (3 independent GPs) ───────
  const p3Active = showGP && gpEquivariant && cosetReps && cosetReps.length === 3;

  const p3InitialCoeffs = useMemo(() => {
    if (!p3Active || !latticeVectors) return null;
    return drawP3Coefficients(latticeVectors, gpSeed ?? 0, gpN ?? 5, gpEll ?? 0.1);
  }, [p3Active, latticeVectors, gpSeed, gpEll, gpN]);

  const [p3Coeffs, setP3Coeffs] = useState(null);
  const [prevP3InitialCoeffs, setPrevP3InitialCoeffs] = useState(null);

  if (p3InitialCoeffs !== prevP3InitialCoeffs) {
    setPrevP3InitialCoeffs(p3InitialCoeffs);
    setP3Coeffs(p3InitialCoeffs);
  }

  // P3 animation loop (SHO for all three GPs)
  useEffect(() => {
    if (!p3Active || !gpSpeed || gpSpeed <= 0) return;

    let animId;
    let lastTime = null;
    const damping = gpDamping;

    const animate = (timestamp) => {
      if (lastTime !== null) {
        const dt = (timestamp - lastTime) / 1000;
        setP3Coeffs((prev) =>
          prev ? shoStepP3Coefficients(prev, dt, gpSpeed, damping) : prev
        );
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [p3Active, gpSpeed, gpDamping]);

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
      <div style={{ position: 'relative', width, height, border: '1px solid var(--color-svg-container-border, #ccc)', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Three.js GP canvas (behind SVG) */}
        {showGP && gpCoeffs && cosetReps && (
          <GPShaderCanvas
            gpCoeffs={gpCoeffs}
            p3Coeffs={p3Active ? p3Coeffs : null}
            cosetReps={cosetReps}
            bounds={gpBounds}
            width={renderWidth}
            height={renderHeight}
            displayWidth={width}
            displayHeight={height}
            equivariant={gpEquivariant}
          />
        )}

        {/* Particle advection canvas (behind SVG) */}
        {showParticles && windCoeffs && cosetReps && latticeVectors && (
          <ParticleCanvas
            windCoeffs={windCoeffs}
            cosetReps={cosetReps}
            bounds={gpBounds}
            latticeVectors={latticeVectors}
            width={renderWidth}
            height={renderHeight}
            displayWidth={width}
            displayHeight={height}
            spawnRate={particleSpawnRate ?? 8.5}
            fadeSpeed={particleFadeSpeed ?? 0.015}
            tailLength={particleTailLength ?? 40}
            maxParticles={particleMaxCount ?? 1350}
            dotSize={particleDotSize ?? 2}
            resetTrigger={windResetCount}
            curlMode={curlMode || 0}
          />
        )}

        {/* SVG overlay for group elements */}
        <svg
          width={width}
          height={height}
          style={{
            position: (showGP || showParticles) ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            background: (showGP || showParticles) ? 'transparent' : 'var(--color-svg-container-bg, #fafafa)',
          }}
        >
          {/* Lattice dots */}
          {showGroupElements !== false && latticePoints.map((p, i) => {
            const sp = toSvg(p.x, p.y, svgCx, svgCy, effectiveScale);
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
            <FShape key={`f-${i}`} isometry={el} svgCx={svgCx} svgCy={svgCy} fOffset={fOffset} scale={effectiveScale} />
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
              scale={effectiveScale}
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
              scale={effectiveScale}
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
              scale={effectiveScale}
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
