import type { FC } from 'react'
import { useAlarmsContext } from '../../context/AlarmsContext'

/**
 * Header button that shows the current alarm priority and lets the user
 * mute audio system-wide. Auto-resilences after 120 s like a real monitor.
 */
const AlarmMuteButton: FC = () => {
  const { priority, isMuted, toggleMute, muteRemainingSec } = useAlarmsContext()

  const color =
    priority === 'red'    ? '#cc0033' :
    priority === 'yellow' ? '#cc8800' :
    priority === 'cyan'   ? '#0099cc' :
                            '#bbb'

  const label = isMuted
    ? `🔕 ${muteRemainingSec ?? ''}s`
    : '🔔'

  return (
    <button
      onClick={toggleMute}
      title={isMuted
        ? `Audio alarms muted (auto-resilencing in ${muteRemainingSec}s)`
        : 'Mute audio alarms (2 min)'}
      style={{
        minWidth: 32,
        height: 32,
        borderRadius: 16,
        border: `2px solid ${color}`,
        background: priority === 'none' ? 'transparent' : `${color}15`,
        color,
        cursor: 'pointer',
        fontSize: 13,
        padding: '0 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  )
}

export default AlarmMuteButton
