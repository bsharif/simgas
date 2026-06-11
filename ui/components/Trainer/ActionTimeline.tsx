import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

/**
 * Live attributed action timeline for the trainer (review Phase 3: "Trainers
 * get an action-attributed timeline"). Shows who did what and when, in
 * simulation time.
 */

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const KIND_SYMBOL: Record<string, string> = {
  'intervention': '→',
  'machine': '⚙',
  'manual-vent': '🫁',
  'note': '✎',
  'teaching-moment': '★',
}

const ActionTimeline: FC = () => {
  const { actionLog } = useRemoteSimulation()

  return (
    <section className="trainer-card">
      <h2>Action timeline</h2>
      {actionLog.length === 0 ? (
        <p>No actions yet.</p>
      ) : (
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {actionLog.map((entry, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0' }}>
              <span style={{ fontFamily: 'monospace', opacity: 0.7, whiteSpace: 'nowrap' }}>{formatClock(entry.atSec)}</span>
              <span>{KIND_SYMBOL[entry.kind] ?? '→'}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{entry.actorName}</strong>
              <span style={{ opacity: 0.9 }}>{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default ActionTimeline
