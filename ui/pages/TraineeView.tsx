import type { FC } from 'react'
import Monitor from '../components/Monitor/Monitor'
import RightPanel from '../components/RightPanel/RightPanel'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'

const TraineeView: FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { sessionCode, connectionStatus } = useRemoteSimulation()

  return (
    <div className="remote-session remote-session--trainee">
      {connectionStatus === 'disconnected' && (
        <div className="connection-banner connection-banner--error">
          Connection lost. Trying to reconnect...
        </div>
      )}
      <header className="remote-topbar">
        <strong>SimGas trainee</strong>
        <span>Session {sessionCode ?? 'connecting...'}</span>
        <span>{connectionStatus}</span>
        <button onClick={onLeave}>Leave</button>
      </header>
      <div className="remote-session__body">
        <div className="remote-session__monitor"><Monitor /></div>
        <RightPanel />
      </div>
    </div>
  )
}

export default TraineeView
