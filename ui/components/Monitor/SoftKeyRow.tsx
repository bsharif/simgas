// ui/components/Monitor/SoftKeyRow.tsx
import type { FC, ReactNode } from 'react'

interface SoftKeyRowProps {
  onAcknowledge: () => void
  onPauseAlarms: () => void
  onStartStopNbp: () => void
  onRepeatTime: () => void
  onZeroArt: () => void
  artLineActive: boolean
  alarmsMuted: boolean
  nibpMeasuring: boolean
}

function Key({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      className={`intellivue-soft-key${active ? ' intellivue-soft-key--active' : ''}${disabled ? ' intellivue-soft-key--disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      style={disabled ? { opacity: 0.35, cursor: 'default' } : undefined}
    >
      {children}
    </button>
  )
}

const SoftKeyRow: FC<SoftKeyRowProps> = ({
  onAcknowledge,
  onPauseAlarms,
  onStartStopNbp,
  onRepeatTime,
  onZeroArt,
  artLineActive,
  alarmsMuted,
  nibpMeasuring,
}) => (
  <div className="intellivue-soft-row">
    <Key onClick={onAcknowledge}>Acknowl-<br />edge</Key>
    <Key onClick={onPauseAlarms} active={alarmsMuted}>Pause<br />Alarms</Key>
    <Key onClick={onStartStopNbp} active={nibpMeasuring}>Start/<br />Stop NBP</Key>
    <Key onClick={onRepeatTime}>Repeat<br />Time</Key>
    <Key onClick={artLineActive ? onZeroArt : undefined} disabled={!artLineActive}>Zero</Key>
    <Key disabled>QRS<br />Volume</Key>
    <Key disabled>Vitals<br />Trend</Key>
    <Key disabled>Monitor<br />Standby</Key>
    <Key disabled>Main<br />Setup</Key>
    <Key active>Main<br />Screen</Key>
  </div>
)

export default SoftKeyRow
