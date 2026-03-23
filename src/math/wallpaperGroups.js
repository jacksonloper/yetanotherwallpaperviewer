/**
 * Wallpaper group definitions for each Bravais lattice type.
 *
 * For each lattice type, lists compatible wallpaper groups with their
 * generator templates.  All continuous placement parameters (rotation
 * centers, axis offsets) are gauge choices that do not change the
 * similarity class of the group, so the templates use fixed default
 * values and no sliders are exposed.
 *
 * Some types have multiple discrete direction variants on certain lattices
 * (especially the square lattice, which has two inequivalent families of
 * reflection/glide directions: axial and diagonal).  These are listed in
 * a `variants` array; the UI shows radio buttons to let the user pick.
 * When `variants` is absent, the `generators` field is the sole option.
 *
 * Direction indices (dirIndex) reference the arrays returned by
 * getAllowedIsometries() in latticeUtils.js for each lattice type.
 */

/**
 * Get the list of wallpaper types compatible with a given Bravais lattice type.
 * Each entry has: name, description, and either
 *   generators (single option) or
 *   variants (array of { label, generators }).
 */
export function getWallpaperTypesForLattice(latticeType) {
  return wallpaperTypesByLattice[latticeType] || wallpaperTypesByLattice['oblique']
}

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

const wallpaperTypesByLattice = {
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
    { name: 'cm', description: 'Reflection', generators: [
      { type: 'reflection', dirIndex: 0 },
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
      { type: 'reflection', dirIndex: 2 },
    ]},
    { name: 'p31m', description: '120° rotation + reflection (alt)', generators: [
      { type: 'rotation', order: 3 },
      { type: 'reflection', dirIndex: 4 },
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
