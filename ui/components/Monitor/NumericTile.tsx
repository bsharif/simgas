// ui/components/Monitor/NumericTile.tsx
import type { FC } from 'react'
import type { MonitorNumeric } from '../../../engine/monitor/layout'
import type { AlarmPriority } from '../../../engine/alarms'

interface NumericTileProps {
  numeric: MonitorNumeric
  value: string
  alarmLevel?: AlarmPriority
  /** False when the invasive line for this parameter is not yet inserted. */
  lineActive?: boolean
}

const NumericTile: FC<NumericTileProps> = ({ numeric, value, alarmLevel, lineActive = true }) => {
  const alarmClass = alarmLevel && alarmLevel !== 'none'
    ? ` numeric--alarm numeric--alarm-${alarmLevel}`
    : ''

  return (
    <div
      className={`numeric-tile${alarmClass}`}
      style={{ color: numeric.color, borderLeftColor: numeric.color }}
    >
      <span className="numeric-tile__label">{numeric.label}</span>
      <span
        className={`numeric-tile__value${!lineActive ? ' numeric-tile__value--inactive' : ''}`}
        style={{ color: numeric.color }}
      >
        {lineActive ? value : '—'}
      </span>
      {!lineActive && (
        <span className="numeric-tile__inactive-hint">insert line</span>
      )}
      {lineActive && (numeric.alarmLo !== null || numeric.alarmHi !== null) && (
        <span className="numeric-tile__limits">
          {numeric.alarmLo ?? '—'} – {numeric.alarmHi ?? '—'}
        </span>
      )}
    </div>
  )
}

export default NumericTile
