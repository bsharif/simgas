// ui/components/Monitor/NibpPanel.tsx
import type { FC } from 'react'
import type { PatientState } from '../../../engine/patient'
import type { NibpInterval, NibpHistoryEntry } from '../../hooks/useNibpCycle'

interface NibpPanelProps {
  state: PatientState
  measuring: boolean
  interval: NibpInterval
  history: NibpHistoryEntry[]
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const NibpPanel: FC<NibpPanelProps> = ({ state, measuring, interval, history }) => {
  const sys = Math.max(0, Math.round(state.nibp.sys))
  const dia = Math.max(0, Math.round(state.nibp.dia))
  const map = Math.max(0, Math.round(state.nibp.map))
  const clockNow = formatClock(new Date())
  const modeLabel = interval === 'manual' ? 'Manual' : `Auto  ${interval}`

  return (
    <div className="intellivue-lower">
      <section className="nbp-panel">
        <div className="nbp-panel__labels">
          <span>NBP</span>
          <small>Pulse {Math.round(state.hr)}</small>
        </div>
        {measuring ? (
          <strong className="nbp-panel__measuring">Measuring…</strong>
        ) : (
          <>
            <strong>{sys}/{dia}</strong>
            <em>({map})</em>
          </>
        )}
        <span className="nbp-panel__mode">{modeLabel}</span>
      </section>

      <section className="nbp-history">
        <div>
          <span>{clockNow}</span>
          <strong>NBP</strong>
          <small>mmHg</small>
        </div>
        {history.map((entry, i) => (
          <p key={i}>
            <span>{entry.time}</span>
            <span>{entry.sys}/{entry.dia}({entry.map})</span>
          </p>
        ))}
      </section>

      <section className="monitor-clock">
        <strong>{clockNow}</strong>
      </section>
    </div>
  )
}

export default NibpPanel
