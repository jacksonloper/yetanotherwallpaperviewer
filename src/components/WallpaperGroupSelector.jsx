import { useMemo } from 'react'
import { ALL_WALLPAPER_TYPES } from '../math/wallpaperGroups.js'

/**
 * Wallpaper groups organized by lattice compatibility.
 * Order: most general → most restrictive.
 */
const GROUP_CATEGORIES = [
  {
    id: 'oblique',
    label: 'Any lattice',
    groups: ['p1', 'p2'],
  },
  {
    id: 'rectangular',
    label: 'Rectangular ↔ Square',
    groups: ['pm', 'pg', 'pmm', 'pmg', 'pgg'],
  },
  {
    id: 'centered',
    label: 'Centered Rect ↔ Hex ↔ Square',
    groups: ['cm', 'cmm'],
  },
  {
    id: 'square',
    label: 'Square only',
    groups: ['p4', 'p4m', 'p4g'],
  },
  {
    id: 'hexagonal',
    label: 'Hexagonal only',
    groups: ['p3', 'p3m1', 'p31m', 'p6', 'p6m'],
  },
]

/** Look up type metadata by name. */
const typesByName = Object.fromEntries(
  ALL_WALLPAPER_TYPES.map(t => [t.name, t])
)

export default function WallpaperGroupSelector({ value, onChange }) {
  /* Find the category containing the selected group */
  const activeCategory = useMemo(
    () => GROUP_CATEGORIES.find(c => c.groups.includes(value))?.id ?? 'oblique',
    [value]
  )

  const selectedType = typesByName[value]

  return (
    <div className="group-selector">
      {GROUP_CATEGORIES.map(cat => (
        <div
          key={cat.id}
          className={
            'group-category' +
            (cat.id === activeCategory ? ' group-category--active' : '')
          }
        >
          <div className="group-category-label">{cat.label}</div>
          <div className="group-category-buttons">
            {cat.groups.map(name => {
              const t = typesByName[name]
              const isSelected = name === value
              return (
                <button
                  key={name}
                  className={
                    'group-btn' + (isSelected ? ' group-btn--selected' : '')
                  }
                  onClick={() => onChange(name)}
                  title={t?.description ?? name}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {selectedType && (
        <div className="group-description">
          <strong>{value}</strong> — {selectedType.description}
        </div>
      )}
    </div>
  )
}
