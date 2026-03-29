import { useMemo } from 'react'
import { getViableSupergroups } from '../math/supergroups.js'

/**
 * SupergroupControls – shows buttons for viable one-step supergroups
 * of the currently selected wallpaper group.
 *
 * Props:
 *   groupName        – current wallpaper type name (e.g. 'p1', 'pm')
 *   latticeType      – current Bravais lattice type
 *   activeSupergroup – currently toggled supergroup name, or null
 *   onToggle         – callback: (supergroupName) => void
 */
export default function SupergroupControls({ groupName, latticeType, activeSupergroup, onToggle }) {
  const viable = useMemo(
    () => getViableSupergroups(groupName, latticeType),
    [groupName, latticeType]
  )

  if (viable.length === 0) return null

  return (
    <div className="panel supergroup-panel">
      <h3 className="panel-heading">Supergroups</h3>
      <p className="supergroup-hint">
        Preview what the pattern looks like with additional symmetry.
      </p>
      <div className="group-category-buttons">
        {viable.map(sg => (
          <button
            key={sg}
            className={
              'group-btn' +
              (activeSupergroup === sg ? ' group-btn--selected' : '')
            }
            onClick={() => onToggle(sg)}
            title={`Preview ${sg} supergroup`}
          >
            {sg}
          </button>
        ))}
      </div>
      {activeSupergroup && (
        <div className="supergroup-active-note">
          Previewing <strong>{activeSupergroup}</strong> — click again to dismiss.
        </div>
      )}
    </div>
  )
}
