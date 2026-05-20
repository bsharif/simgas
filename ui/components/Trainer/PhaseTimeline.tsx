import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

const PhaseTimeline: FC = () => {
  const { scenarioMetadata, send } = useRemoteSimulation()
  if (!scenarioMetadata) return <div className="trainer-card">Waiting for scenario metadata...</div>

  return (
    <section className="trainer-card">
      <h2>Phase timeline</h2>
      {scenarioMetadata.phases.map(phase => (
        <div className="phase-card" key={phase.id}>
          <strong>{phase.id}</strong>
          {phase.enterWhen && <span>Enter: {phase.enterWhen}</span>}
          {phase.resolveWhen && <span>Resolve: {phase.resolveWhen}</span>}
          {phase.failWhen && <span>Fail: {phase.failWhen}</span>}
          <button onClick={() => send({ type: 'advance_phase', phaseId: phase.id })}>Advance now</button>
        </div>
      ))}
      <button onClick={() => send({ type: 'clear_forced_phase' })}>Return to automatic</button>
    </section>
  )
}

export default PhaseTimeline
