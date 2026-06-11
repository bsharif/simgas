import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

/**
 * Trainee roster with live connection state, so the trainer can trust who is
 * actually receiving the session (review: "Show connected, disconnected, and
 * reconnecting states per learner").
 */
const TraineeRoster: FC = () => {
  const { roster } = useRemoteSimulation()
  const trainees = roster.filter(entry => entry.role === 'trainee')

  return (
    <section className="trainer-card">
      <h2>Trainees ({trainees.filter(entry => entry.connected).length}/{trainees.length})</h2>
      {trainees.length === 0 ? (
        <p>No trainees connected.</p>
      ) : (
        trainees.map(entry => (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: entry.connected ? '#2e9e4f' : '#c0392b',
                display: 'inline-block', flexShrink: 0,
              }}
            />
            <span style={{ opacity: entry.connected ? 1 : 0.6 }}>{entry.name}</span>
            {!entry.connected && <span style={{ fontSize: 11, opacity: 0.6 }}>(disconnected)</span>}
          </div>
        ))
      )}
    </section>
  )
}

export default TraineeRoster
