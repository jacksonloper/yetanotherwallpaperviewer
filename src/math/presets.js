/**
 * Preset examples for the 17 wallpaper groups.
 *
 * Each preset specifies:
 *   - name, description
 *   - lattice: configuration for the LatticeSelector
 *     (first translation is always (0,1); lattice describes the second)
 *   - generators: a function returning the non-translation generators
 *
 * Lattice conventions:
 *   Well-rounded (x² + y² = 1):
 *     { mode: 'well-rounded', sliderValue: 0–1 }  (0=square, 1=hex)
 *   Not well-rounded (x² + y² > 1):
 *     { mode: 'not-well-rounded', shape: 'rectangular'|'centered-rectangular'|'oblique', x, [y] }
 */

import {
  rotation,
  reflection,
  glideReflection,
} from './isometry.js';

const PI = Math.PI;

export const presets = [
  {
    name: 'p1',
    description: 'Translations only (oblique)',
    lattice: { mode: 'not-well-rounded', shape: 'oblique', x: 1.1, y: 0.3 },
    generators: () => [],
  },
  {
    name: 'p2',
    description: '180° rotation (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [rotation(PI, 0, 0)],
  },
  {
    name: 'pm',
    description: 'Reflection (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [reflection(PI / 2, 0, 0)],
  },
  {
    name: 'pg',
    description: 'Glide reflection (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [glideReflection(PI / 2, 0.5, 0, 0)],
  },
  {
    name: 'cm',
    description: 'Reflection (centered rectangular)',
    lattice: { mode: 'not-well-rounded', shape: 'centered-rectangular', x: 1.0 },
    generators: () => [reflection(PI / 2, 0, 0)],
  },
  {
    name: 'pmm',
    description: 'Two reflections (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [reflection(0, 0, 0), reflection(PI / 2, 0, 0)],
  },
  {
    name: 'pmg',
    description: 'Reflection + glide reflection (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [reflection(0, 0, 0), glideReflection(PI / 2, 0.5, 0, 0)],
  },
  {
    name: 'pgg',
    description: 'Two glide reflections (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [
      glideReflection(0, 0.5, 0, 0.25),
      glideReflection(PI / 2, 0.5, 0.25, 0),
    ],
  },
  {
    name: 'cmm',
    description: 'Two reflections (centered rectangular)',
    lattice: { mode: 'not-well-rounded', shape: 'centered-rectangular', x: 1.0 },
    generators: () => [reflection(0, 0, 0), reflection(PI / 2, 0, 0)],
  },
  {
    name: 'p4',
    description: '90° rotation (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [rotation(PI / 2, 0, 0)],
  },
  {
    name: 'p4m',
    description: '90° rotation + reflection (square)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [rotation(PI / 2, 0, 0), reflection(0, 0, 0)],
  },
  {
    name: 'p4g',
    description: '90° rotation + reflection (square, alt)',
    lattice: { mode: 'well-rounded', sliderValue: 0 },
    generators: () => [rotation(PI / 2, 0.5, 0.5), reflection(0, 0, 0)],
  },
  {
    name: 'p3',
    description: '120° rotation (hexagonal)',
    lattice: { mode: 'well-rounded', sliderValue: 1 },
    generators: () => [rotation((2 * PI) / 3, 0, 0)],
  },
  {
    name: 'p3m1',
    description: '120° rotation + reflection (hexagonal)',
    lattice: { mode: 'well-rounded', sliderValue: 1 },
    generators: () => [rotation((2 * PI) / 3, 0, 0), reflection(PI / 2, 0, 0)],
  },
  {
    name: 'p31m',
    description: '120° rotation + reflection (hexagonal, alt)',
    lattice: { mode: 'well-rounded', sliderValue: 1 },
    generators: () => [rotation((2 * PI) / 3, 0, 0), reflection(0, 0, 0)],
  },
  {
    name: 'p6',
    description: '60° rotation (hexagonal)',
    lattice: { mode: 'well-rounded', sliderValue: 1 },
    generators: () => [rotation(PI / 3, 0, 0)],
  },
  {
    name: 'p6m',
    description: '60° rotation + reflection (hexagonal)',
    lattice: { mode: 'well-rounded', sliderValue: 1 },
    generators: () => [rotation(PI / 3, 0, 0), reflection(0, 0, 0)],
  },
];
