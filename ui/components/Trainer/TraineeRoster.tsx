import type { FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

const TraineeRoster: FC = () => {
  const { roster } = useRemoteSimulation()
  const trainees = roster.filter(entry => entry.role === 'trainee')

  return (
    <section className="trainer-card">
      <h2>Trainees ({trainees.length})</h2>
      {trainees.length === 0 ? <p>No trainees connected.</p> : trainees.map(entry => <div key={entry.id}>{entry.name}</div>)}
    </section>
  )
}

export default TraineeRoster
