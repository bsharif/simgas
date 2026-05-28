import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

function formatPhaseId(id: string): string {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

const PhaseTimeline: FC = () => {
  const { scenarioMetadata, send, currentPhaseId, completedPhaseIds, forcedPhaseId, commandsAvailable } = useRemoteSimulation()
  if (!scenarioMetadata) return <div className="trainer-card">Waiting for scenario metadata...</div>

  return (
    <section className="trainer-card">
      <h2>Phase timeline</h2>
      {scenarioMetadata.phases.map(entry => {
        const phaseName = entry.label ?? formatPhaseId(entry.id)
        const isActive = entry.id === currentPhaseId
        const isCompleted = entry.id !== currentPhaseId && completedPhaseIds.includes(entry.id)

        return (
          <div className="phase-card" key={entry.id}>
            <strong style={{ color: isActive ? '#1d83a6' : undefined }}>
              {phaseName}
            </strong>
            {isActive && (
              <span>Active{forcedPhaseId === entry.id ? ' (forced)' : ''}</span>
            )}
            {isCompleted && <span>Completed</span>}
            {entry.enterDescription && <span>{entry.enterDescription}</span>}
            {entry.resolveDescription && <span>Resolves: {entry.resolveDescription}</span>}
            {entry.failDescription && <span>Can fail: {entry.failDescription}</span>}
            <button
              disabled={!commandsAvailable}
              onClick={() => send({ type: 'advance_phase', phaseId: entry.id })}
            >
              Advance now
            </button>
          </div>
        )
      })}
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'clear_forced_phase' })}>
        Return to automatic
      </button>
      {!commandsAvailable && <p className="command-unavailable">Trainer commands unavailable while reconnecting.</p>}
    </section>
  )
}

export default PhaseTimeline
