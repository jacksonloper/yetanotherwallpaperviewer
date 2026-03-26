/**
 * Canvas component for rendering fundamental domain cells.
 *
 * Receives a label grid and color palette, and draws each cell
 * as a colored pixel on a 2D canvas scaled to fill the viewport.
 */

import { useRef, useEffect, useMemo } from 'react';
import { computeFundamentalDomains } from '../math/fundamentalDomains.js';

/**
 * Parse an HSL string like "hsl(120, 70%, 55%)" into {r, g, b} in [0, 255].
 */
function hslToRgb(hslStr) {
  const m = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!m) return { r: 128, g: 128, b: 128 };
  const h = parseInt(m[1]) / 360;
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * @param {object} props
 * @param {Array}  props.elements        Visible group elements.
 * @param {Array}  props.cosetReps       G/T coset representatives.
 * @param {{v1,v2}} props.latticeVectors Lattice basis.
 * @param {{minX,maxX,minY,maxY}} props.bounds  Viewport bounds.
 * @param {number} props.width           Canvas width in pixels.
 * @param {number} props.height          Canvas height in pixels.
 * @param {number} props.centerSeed      Seed for center point.
 * @param {number} props.gpSeed          Seed for GP draw.
 * @param {number} props.gpScale         GP length scale.
 * @param {number} props.gpMagnitude     Magnitude multiplier for f before softplus.
 * @param {number} props.gpN             GP truncation.
 */
export default function FundamentalDomainsCanvas({
  elements,
  cosetReps,
  latticeVectors,
  bounds,
  width,
  height,
  centerSeed,
  gpSeed,
  gpScale,
  gpMagnitude,
  gpN,
}) {
  const canvasRef = useRef(null);

  // Compute fundamental domains (expensive, memoized)
  const fdResult = useMemo(() => {
    if (!elements || !cosetReps || !latticeVectors || !bounds) return null;
    return computeFundamentalDomains({
      elements,
      cosetReps,
      latticeVectors,
      bounds,
      width,
      height,
      centerSeed,
      gpSeed,
      gpScale,
      gpMagnitude,
      gpN,
      gridScale: 0.5,
    });
  }, [elements, cosetReps, latticeVectors, bounds, width, height, centerSeed, gpSeed, gpScale, gpMagnitude, gpN]);

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fdResult) return;

    const { label, colors, gridW, gridH } = fdResult;
    canvas.width = gridW;
    canvas.height = gridH;

    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(gridW, gridH);

    // Pre-convert colors to RGB
    const rgbColors = colors.map(hslToRgb);

    for (let i = 0; i < gridW * gridH; i++) {
      const lbl = label[i];
      const rgb = lbl >= 0 && lbl < rgbColors.length ? rgbColors[lbl] : { r: 0, g: 0, b: 0 };
      const idx = i * 4;
      imgData.data[idx] = rgb.r;
      imgData.data[idx + 1] = rgb.g;
      imgData.data[idx + 2] = rgb.b;
      imgData.data[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [fdResult]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}
