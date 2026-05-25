import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

const PhaseTimeline: FC = () => {
  const { scenarioMetadata, send, currentPhaseId, completedPhaseIds, forcedPhaseId, commandsAvailable } = useRemoteSimulation()
  if (!scenarioMetadata) return <div className="trainer-card">Waiting for scenario metadata...</div>

  return (
    <section className="trainer-card">
      <h2>Phase timeline</h2>
      {scenarioMetadata.phases.map(entry => (
        <div className="phase-card" key={entry.id}>
          <strong style={{ color: entry.id === currentPhaseId ? '#1d83a6' : undefined }}>{entry.id}</strong>
          {entry.id === currentPhaseId && <span>Active{forcedPhaseId === entry.id ? ' (forced)' : ''}</span>}
          {entry.id !== currentPhaseId && completedPhaseIds.includes(entry.id) && <span>Completed</span>}
          {entry.enterWhen && <span>Enter: {entry.enterWhen}</span>}
          {entry.resolveWhen && <span>Resolve: {entry.resolveWhen}</span>}
          {entry.failWhen && <span>Fail: {entry.failWhen}</span>}
          <button disabled={!commandsAvailable} onClick={() => send({ type: 'advance_phase', phaseId: entry.id })}>Advance now</button>
        </div>
      ))}
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'clear_forced_phase' })}>Return to automatic</button>
      {!commandsAvailable && <p className="command-unavailable">Trainer commands unavailable while reconnecting.</p>}
    </section>
  )
}

export default PhaseTimeline
