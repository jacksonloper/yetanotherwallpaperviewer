/**
 * Preset examples for the 17 wallpaper groups.
 *
 * Each preset provides a name, a description, and a list of generators.
 * The generators always include exactly two translations forming the lattice.
 */

import {
  translation,
  rotation,
  reflection,
  glideReflection,
} from './isometry.js';

const PI = Math.PI;

export const presets = [
  {
    name: 'p1',
    description: 'Two translations only',
    generators: () => [translation(1, 0), translation(0.3, 1)],
  },
  {
    name: 'p2',
    description: 'Two translations + 180° rotation',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      rotation(PI, 0, 0),
    ],
  },
  {
    name: 'pm',
    description: 'Rectangular lattice + reflection',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      reflection(PI / 2, 0, 0),
    ],
  },
  {
    name: 'pg',
    description: 'Rectangular lattice + glide reflection',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      glideReflection(PI / 2, 0.5, 0, 0),
    ],
  },
  {
    name: 'cm',
    description: 'Rhombic lattice + reflection',
    generators: () => [
      translation(1, 0),
      translation(0.5, 1),
      reflection(PI / 2, 0, 0),
    ],
  },
  {
    name: 'pmm',
    description: 'Rectangular lattice + two reflections',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      reflection(0, 0, 0),
      reflection(PI / 2, 0, 0),
    ],
  },
  {
    name: 'pmg',
    description: 'Rectangular lattice + reflection + glide reflection',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      reflection(0, 0, 0),
      glideReflection(PI / 2, 0.5, 0, 0),
    ],
  },
  {
    name: 'pgg',
    description: 'Rectangular lattice + two glide reflections',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      glideReflection(0, 0.5, 0, 0.25),
      glideReflection(PI / 2, 0.5, 0.25, 0),
    ],
  },
  {
    name: 'cmm',
    description: 'Rhombic lattice + two reflections',
    generators: () => [
      translation(1, 0),
      translation(0.5, 1),
      reflection(0, 0, 0),
      reflection(PI / 2, 0, 0),
    ],
  },
  {
    name: 'p4',
    description: 'Square lattice + 90° rotation',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      rotation(PI / 2, 0, 0),
    ],
  },
  {
    name: 'p4m',
    description: 'Square lattice + 90° rotation + reflection',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      rotation(PI / 2, 0, 0),
      reflection(0, 0, 0),
    ],
  },
  {
    name: 'p4g',
    description: 'Square lattice + 90° rotation + reflection (alt)',
    generators: () => [
      translation(1, 0),
      translation(0, 1),
      rotation(PI / 2, 0.5, 0.5),
      reflection(0, 0, 0),
    ],
  },
  {
    name: 'p3',
    description: 'Hexagonal lattice + 120° rotation',
    generators: () => [
      translation(1, 0),
      translation(0.5, Math.sqrt(3) / 2),
      rotation((2 * PI) / 3, 0, 0),
    ],
  },
  {
    name: 'p3m1',
    description: 'Hexagonal lattice + 120° rotation + reflection',
    generators: () => [
      translation(1, 0),
      translation(0.5, Math.sqrt(3) / 2),
      rotation((2 * PI) / 3, 0, 0),
      reflection(PI / 2, 0, 0),
    ],
  },
  {
    name: 'p31m',
    description: 'Hexagonal lattice + 120° rotation + reflection (alt)',
    generators: () => [
      translation(1, 0),
      translation(0.5, Math.sqrt(3) / 2),
      rotation((2 * PI) / 3, 0, 0),
      reflection(0, 0, 0),
    ],
  },
  {
    name: 'p6',
    description: 'Hexagonal lattice + 60° rotation',
    generators: () => [
      translation(1, 0),
      translation(0.5, Math.sqrt(3) / 2),
      rotation(PI / 3, 0, 0),
    ],
  },
  {
    name: 'p6m',
    description: 'Hexagonal lattice + 60° rotation + reflection',
    generators: () => [
      translation(1, 0),
      translation(0.5, Math.sqrt(3) / 2),
      rotation(PI / 3, 0, 0),
      reflection(0, 0, 0),
    ],
  },
];
