/**
 * Wallpaper group definitions for each Bravais lattice type.
 *
 * For each lattice type, lists compatible wallpaper groups with their
 * generator templates (including default continuous parameter values).
 * Generator objects match the format used in App.jsx state.
 *
 * Direction indices (dirIndex) reference the arrays returned by
 * getAllowedIsometries() in latticeUtils.js for each lattice type.
 */

/**
 * Get the list of wallpaper types compatible with a given Bravais lattice type.
 * Each entry has: name, description, generators (array of generator templates).
 */
export function getWallpaperTypesForLattice(latticeType) {
  return wallpaperTypesByLattice[latticeType] || wallpaperTypesByLattice['oblique']
}

const wallpaperTypesByLattice = {
  oblique: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2, centerS: 0, centerT: 0 },
    ]},
  ],

  rectangular: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2, centerS: 0, centerT: 0 },
    ]},
    { name: 'pm', description: 'Reflection', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'pg', description: 'Glide reflection', generators: [
      { type: 'glide-reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'pmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0 },
    ]},
    { name: 'pmg', description: 'Reflection + glide', generators: [
      { type: 'reflection', dirIndex: 1, axisOffset: 0 },
      { type: 'glide-reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'pgg', description: 'Two glide reflections', generators: [
      { type: 'glide-reflection', dirIndex: 1, axisOffset: 0.25 },
      { type: 'glide-reflection', dirIndex: 0, axisOffset: 0.25 },
    ]},
  ],

  'centered-rectangular': [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2, centerS: 0, centerT: 0 },
    ]},
    { name: 'cm', description: 'Reflection', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'cmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0 },
    ]},
  ],

  square: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2, centerS: 0, centerT: 0 },
    ]},
    { name: 'pm', description: 'Reflection along axis', generators: [
      { type: 'reflection', dirIndex: 2, axisOffset: 0 },
    ]},
    { name: 'pg', description: 'Glide reflection along axis', generators: [
      { type: 'glide-reflection', dirIndex: 2, axisOffset: 0 },
    ]},
    { name: 'cm', description: 'Diagonal reflection', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'pmm', description: 'Two axis reflections', generators: [
      { type: 'reflection', dirIndex: 2, axisOffset: 0 },
      { type: 'reflection', dirIndex: 3, axisOffset: 0 },
    ]},
    { name: 'pmg', description: 'Reflection + glide', generators: [
      { type: 'reflection', dirIndex: 3, axisOffset: 0 },
      { type: 'glide-reflection', dirIndex: 2, axisOffset: 0 },
    ]},
    { name: 'pgg', description: 'Two glide reflections', generators: [
      { type: 'glide-reflection', dirIndex: 3, axisOffset: 0.25 },
      { type: 'glide-reflection', dirIndex: 2, axisOffset: 0.25 },
    ]},
    { name: 'cmm', description: 'Two diagonal reflections', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0 },
    ]},
    // p4, p4m, p4g: no continuous degrees of freedom.
    // The square lattice is unique up to similarity, and the rotation center
    // is locked to discrete positions (e.g. (0,0), (0.5,0.5)).  For p4m the
    // rotation center must lie on both mirror axes; for p4g the diagonal
    // mirror offset is fixed at ½.  All valid parameter choices produce the
    // same group up to translation, so no sliders are needed.
    { name: 'p4', description: '90° rotation', noFreeParams: true, generators: [
      { type: 'rotation', order: 4, centerS: 0, centerT: 0 },
    ]},
    { name: 'p4m', description: '90° rotation + reflection', noFreeParams: true, generators: [
      { type: 'rotation', order: 4, centerS: 0, centerT: 0 },
      { type: 'reflection', dirIndex: 3, axisOffset: 0 },
    ]},
    { name: 'p4g', description: '90° rotation + diagonal reflection', noFreeParams: true, generators: [
      { type: 'rotation', order: 4, centerS: 0, centerT: 0 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0.5 },
    ]},
  ],

  hexagonal: [
    { name: 'p1', description: 'Translations only', generators: [] },
    { name: 'p2', description: '180° rotation', generators: [
      { type: 'rotation', order: 2, centerS: 0, centerT: 0 },
    ]},
    { name: 'cm', description: 'Reflection', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
    ]},
    { name: 'cmm', description: 'Two reflections', generators: [
      { type: 'reflection', dirIndex: 0, axisOffset: 0 },
      { type: 'reflection', dirIndex: 1, axisOffset: 0 },
    ]},
    // p3, p3m1, p31m, p6, p6m: no continuous degrees of freedom.
    // The hexagonal lattice is unique up to similarity, and the rotation
    // center is locked to discrete positions (e.g. (0,0), (1/3,1/3), (2/3,2/3)
    // for order 3; only (0,0) for order 6).  Reflection axes must pass
    // through the rotation center (p3m1, p6m) or be offset by a fixed amount
    // (p31m).  All valid choices produce the same group up to translation.
    { name: 'p3', description: '120° rotation', noFreeParams: true, generators: [
      { type: 'rotation', order: 3, centerS: 0, centerT: 0 },
    ]},
    { name: 'p3m1', description: '120° rotation + reflection', noFreeParams: true, generators: [
      { type: 'rotation', order: 3, centerS: 0, centerT: 0 },
      { type: 'reflection', dirIndex: 2, axisOffset: 0 },
    ]},
    { name: 'p31m', description: '120° rotation + reflection (alt)', noFreeParams: true, generators: [
      { type: 'rotation', order: 3, centerS: 0, centerT: 0 },
      { type: 'reflection', dirIndex: 4, axisOffset: 0 },
    ]},
    { name: 'p6', description: '60° rotation', noFreeParams: true, generators: [
      { type: 'rotation', order: 6, centerS: 0, centerT: 0 },
    ]},
    { name: 'p6m', description: '60° rotation + reflection', noFreeParams: true, generators: [
      { type: 'rotation', order: 6, centerS: 0, centerT: 0 },
      { type: 'reflection', dirIndex: 4, axisOffset: 0 },
    ]},
  ],
}
