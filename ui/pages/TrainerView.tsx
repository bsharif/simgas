import type { FC } from 'react'
import Monitor from '../components/Monitor/Monitor'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'
import PhaseTimeline from '../components/Trainer/PhaseTimeline'
import OverridePanel from '../components/Trainer/OverridePanel'
import EventInjector from '../components/Trainer/EventInjector'
import TraineeRoster from '../components/Trainer/TraineeRoster'

const TrainerView: FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const { sessionCode, roster, send } = useRemoteSimulation()
  const traineeCount = roster.filter(entry => entry.role === 'trainee').length
  const inviteUrl = sessionCode ? `${window.location.origin}?join=${sessionCode}` : ''

  return (
    <div className="remote-session remote-session--trainer">
      <header className="remote-topbar">
        <strong>SimGas trainer</strong>
        <span>Code {sessionCode ?? '...'}</span>
        <span>{traineeCount} trainees</span>
        <button onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy invite</button>
        <button onClick={() => send({ type: 'pause' })}>Pause</button>
        <button onClick={() => send({ type: 'resume' })}>Resume</button>
        <button onClick={() => { send({ type: 'end_session' }); onEnd() }}>End</button>
      </header>
      <div className="trainer-layout">
        <div className="trainer-monitor"><Monitor /></div>
        <aside className="trainer-controls">
          <div className="qr-placeholder">QR</div>
          <PhaseTimeline />
          <OverridePanel />
          <EventInjector />
          <TraineeRoster />
        </aside>
      </div>
    </div>
  )
}

export default TrainerView
