/**
 * Wallpaper group definitions — type-first architecture.
 *
 * All 17 wallpaper types are listed in a single flat array.  Each entry
 * specifies:
 *   name          – IUCr short name (p1, pm, cm, p4m, …)
 *   description   – human-readable label
 *   latticeControl – what kind of lattice slider the UI shows:
 *       'none'           fixed lattice (no slider)
 *       'full'           full 2D lattice freedom (p1, p2 only)
 *       'rect-to-square' 1D slider: rectangular (x>1, y=0) → square (x=1, y=0)
 *       'cm-slider'      1D slider: angle between lattice vectors (10°→60°→90°)
 *   fixedLattice   – for 'none': 'square' or 'hexagonal'
 *   generators / variants – generator templates using direction keys (dir)
 *       or cm-specific keys (cmDir) instead of dirIndex.
 *
 * Direction keys reference lattice vectors:
 *   'a'    → (0, 1)                angle = π/2         length = 1
 *   'b'    → (x, y)                angle = atan2(y,x)  length = |b|
 *   'apb'  → a+b = (x, 1+y)       angle = atan2(1+y,x)
 *   'bma'  → b−a = (x, y−1)       angle = atan2(y−1,x)
 *   '2bma' → 2b−a = (2x, 2y−1)    angle = atan2(2y−1,2x)
 *
 * cmDir is used for cm/cmm on the cm-slider. The lattice is always
 * well-rounded (|a|=|b|=1), so:
 *   cmDir 0 = along a+b,     cmDir 1 = along b−a
 */

/**
 * Get the generators for a wallpaper type entry, given a variant index.
 * If the entry has variants, returns variants[idx].generators.
 * Otherwise returns entry.generators.
 */
export function getGeneratorsForVariant(wpType, variantIndex) {
  if (wpType.variants) {
    const idx = Math.min(variantIndex, wpType.variants.length - 1)
    return wpType.variants[idx].generators
  }
  return wpType.generators
}

export const ALL_WALLPAPER_TYPES = [
  // --- Full 2D freedom (any lattice) ---
  { name: 'p1', description: 'Translations only', latticeControl: 'full',
    generators: [] },
  { name: 'p2', description: '180° rotation', latticeControl: 'full',
    generators: [{ type: 'rotation', order: 2 }] },

  // --- Rectangular → Square slider ---
  { name: 'pm', description: 'Reflection', latticeControl: 'rect-to-square',
    variants: [
      { label: 'Mirrors ∥ a (vertical)', generators: [
        { type: 'reflection', dir: 'a' },
      ]},
      { label: 'Mirrors ∥ b (horizontal)', generators: [
        { type: 'reflection', dir: 'b' },
      ]},
    ]},
  { name: 'pg', description: 'Glide reflection', latticeControl: 'rect-to-square',
    variants: [
      { label: 'Glide ∥ a (vertical)', generators: [
        { type: 'glide', dir: 'a' },
      ]},
      { label: 'Glide ∥ b (horizontal)', generators: [
        { type: 'glide', dir: 'b' },
      ]},
    ]},
  { name: 'pmm', description: 'Two reflections', latticeControl: 'rect-to-square',
    generators: [
      { type: 'reflection', dir: 'a' },
      { type: 'reflection', dir: 'b' },
    ]},
  { name: 'pmg', description: 'Reflection + glide', latticeControl: 'rect-to-square',
    variants: [
      { label: 'Mirror ∥ b, glide ∥ a', generators: [
        { type: 'reflection', dir: 'b' },
        { type: 'glide', dir: 'a' },
      ]},
      { label: 'Mirror ∥ a, glide ∥ b', generators: [
        { type: 'reflection', dir: 'a' },
        { type: 'glide', dir: 'b' },
      ]},
    ]},
  { name: 'pgg', description: 'Two glide reflections', latticeControl: 'rect-to-square',
    generators: [
      { type: 'glide', dir: 'b', axisOffset: 0.25 },
      { type: 'glide', dir: 'a', axisOffset: 0.25 },
    ]},

  // --- CM slider (centered-rect → hex → well-rounded → square) ---
  { name: 'cm', description: 'Reflection (centered)', latticeControl: 'cm-slider',
    variants: [
      { label: 'Mirror ∥ a+b', generators: [
        { type: 'reflection', cmDir: 0 },
      ]},
      { label: 'Mirror ∥ b−a', generators: [
        { type: 'reflection', cmDir: 1 },
      ]},
    ]},
  { name: 'cmm', description: 'Two reflections (centered)', latticeControl: 'cm-slider',
    generators: [
      { type: 'reflection', cmDir: 0 },
      { type: 'reflection', cmDir: 1 },
    ]},

  // --- Fixed square lattice (no choices) ---
  { name: 'p4', description: '90° rotation', latticeControl: 'none',
    fixedLattice: 'square',
    generators: [{ type: 'rotation', order: 4 }] },
  { name: 'p4m', description: '90° rotation + reflection', latticeControl: 'none',
    fixedLattice: 'square',
    generators: [
      { type: 'rotation', order: 4 },
      { type: 'reflection', dir: 'b' },
    ]},
  { name: 'p4g', description: '90° rotation + diagonal reflection', latticeControl: 'none',
    fixedLattice: 'square',
    generators: [
      { type: 'rotation', order: 4 },
      { type: 'reflection', dir: 'bma', axisOffset: 0.5 },
    ]},

  // --- Fixed hexagonal lattice (no choices) ---
  { name: 'p3', description: '120° rotation', latticeControl: 'none',
    fixedLattice: 'hexagonal',
    generators: [{ type: 'rotation', order: 3 }] },
  { name: 'p3m1', description: '120° rotation + reflection', latticeControl: 'none',
    fixedLattice: 'hexagonal',
    generators: [
      { type: 'rotation', order: 3 },
      { type: 'reflection', dir: '2bma' },
    ]},
  { name: 'p31m', description: '120° rotation + reflection (alt)', latticeControl: 'none',
    fixedLattice: 'hexagonal',
    generators: [
      { type: 'rotation', order: 3 },
      { type: 'reflection', dir: 'a' },
    ]},
  { name: 'p6', description: '60° rotation', latticeControl: 'none',
    fixedLattice: 'hexagonal',
    generators: [{ type: 'rotation', order: 6 }] },
  { name: 'p6m', description: '60° rotation + reflection', latticeControl: 'none',
    fixedLattice: 'hexagonal',
    generators: [
      { type: 'rotation', order: 6 },
      { type: 'reflection', dir: '2bma' },
    ]},
]

/**
 * Look up a wallpaper type by name from the flat list.
 */
export function getWallpaperTypeByName(name) {
  return ALL_WALLPAPER_TYPES.find(t => t.name === name) || ALL_WALLPAPER_TYPES[0]
}

// --- Legacy compatibility layer for tests ---

/**
 * Get the list of wallpaper types compatible with a given Bravais lattice type.
 * @deprecated Use ALL_WALLPAPER_TYPES directly; this exists for test compatibility.
 */
export function getWallpaperTypesForLattice(latticeType) {
  return _wallpaperTypesByLattice[latticeType] || _wallpaperTypesByLattice['oblique']
}

const _wallpaperTypesByLattice = {
  oblique: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2 },
    ]},
  ],

  rectangular: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2 },
    ]},
    { name: 'pm', description: 'Reflection', variants: [
      { label: 'Mirrors ∥ a (vertical)', generators: [
        { type: 'reflection', dirIndex: 0 },
      ]},
      { label: 'Mirrors ∥ b (horizontal)', generators: [
        { type: 'reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'pg', description: 'Glide reflection', variants: [
      { label: 'Glide ∥ a (vertical)', generators: [
        { type: 'glide-reflection', dirIndex: 0 },
      ]},
      { label: 'Glide ∥ b (horizontal)', generators: [
        { type: 'glide-reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'pmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0 },
      { type: 'reflection', dirIndex: 1 },
    ]},
    { name: 'pmg', description: 'Reflection + glide', variants: [
      { label: 'Mirror ∥ b, glide ∥ a', generators: [
        { type: 'reflection', dirIndex: 1 },
        { type: 'glide-reflection', dirIndex: 0 },
      ]},
      { label: 'Mirror ∥ a, glide ∥ b', generators: [
        { type: 'reflection', dirIndex: 0 },
        { type: 'glide-reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'pgg', description: 'Two glide reflections', generators: [
      { type: 'glide-reflection', dirIndex: 1, axisOffset: 0.25 },
      { type: 'glide-reflection', dirIndex: 0, axisOffset: 0.25 },
    ]},
  ],

  'centered-rectangular': [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2 },
    ]},
    { name: 'cm', description: 'Reflection', variants: [
      { label: 'Mirror ∥ a+b', generators: [
        { type: 'reflection', dirIndex: 0 },
      ]},
      { label: 'Mirror ∥ b−a', generators: [
        { type: 'reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'cmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0 },
      { type: 'reflection', dirIndex: 1 },
    ]},
  ],

  square: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2 },
    ]},
    { name: 'pm', description: 'Axial reflection', variants: [
      { label: 'Mirrors ∥ a (vertical)', generators: [
        { type: 'reflection', dirIndex: 2 },
      ]},
      { label: 'Mirrors ∥ b (horizontal)', generators: [
        { type: 'reflection', dirIndex: 3 },
      ]},
    ]},
    { name: 'pg', description: 'Axial glide reflection', variants: [
      { label: 'Glide ∥ a (vertical)', generators: [
        { type: 'glide-reflection', dirIndex: 2 },
      ]},
      { label: 'Glide ∥ b (horizontal)', generators: [
        { type: 'glide-reflection', dirIndex: 3 },
      ]},
    ]},
    { name: 'cm', description: 'Diagonal reflection', variants: [
      { label: 'Mirror ∥ a+b (↗)', generators: [
        { type: 'reflection', dirIndex: 0 },
      ]},
      { label: 'Mirror ∥ b−a (↘)', generators: [
        { type: 'reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'pmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 2 },
      { type: 'reflection', dirIndex: 3 },
    ]},
    { name: 'pmg', description: 'Reflection + glide', variants: [
      { label: 'Mirror ∥ b, glide ∥ a', generators: [
        { type: 'reflection', dirIndex: 3 },
        { type: 'glide-reflection', dirIndex: 2 },
      ]},
      { label: 'Mirror ∥ a, glide ∥ b', generators: [
        { type: 'reflection', dirIndex: 2 },
        { type: 'glide-reflection', dirIndex: 3 },
      ]},
    ]},
    { name: 'pgg', description: 'Two glide reflections', generators: [
      { type: 'glide-reflection', dirIndex: 3, axisOffset: 0.25 },
      { type: 'glide-reflection', dirIndex: 2, axisOffset: 0.25 },
    ]},
    { name: 'cmm', description: 'Two diagonal reflections', generators: [
      { type: 'reflection', dirIndex: 0 },
      { type: 'reflection', dirIndex: 1 },
    ]},
    { name: 'p4', description: '90° rotation', generators: [
      { type: 'rotation', order: 4 },
    ]},
    { name: 'p4m', description: '90° rotation + reflection', generators: [
      { type: 'rotation', order: 4 },
      { type: 'reflection', dirIndex: 3 },
    ]},
    { name: 'p4g', description: '90° rotation + diagonal reflection', generators: [
      { type: 'rotation', order: 4 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0.5 },
    ]},
  ],

  hexagonal: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2 },
    ]},
    { name: 'cm', description: 'Reflection', variants: [
      { label: 'Mirror ∥ a+b', generators: [
        { type: 'reflection', dirIndex: 0 },
      ]},
      { label: 'Mirror ∥ b−a', generators: [
        { type: 'reflection', dirIndex: 1 },
      ]},
    ]},
    { name: 'cmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0 },
      { type: 'reflection', dirIndex: 1 },
    ]},
    { name: 'p3', description: '120° rotation', generators: [
      { type: 'rotation', order: 3 },
    ]},
    { name: 'p3m1', description: '120° rotation + reflection', generators: [
      { type: 'rotation', order: 3 },
      { type: 'reflection', dirIndex: 4 },
    ]},
    { name: 'p31m', description: '120° rotation + reflection (alt)', generators: [
      { type: 'rotation', order: 3 },
      { type: 'reflection', dirIndex: 2 },
    ]},
    { name: 'p6', description: '60° rotation', generators: [
      { type: 'rotation', order: 6 },
    ]},
    { name: 'p6m', description: '60° rotation + reflection', generators: [
      { type: 'rotation', order: 6 },
      { type: 'reflection', dirIndex: 4 },
    ]},
  ],
}
