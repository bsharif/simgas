import { useEffect, useState, type FC } from 'react'
import Monitor from '../components/Monitor/Monitor'
import RightPanel from '../components/RightPanel/RightPanel'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'

const TraineeView: FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { sessionCode, connectionStatus } = useRemoteSimulation()
  const [trayOpen, setTrayOpen] = useState(false)
  const [isMobileTray, setIsMobileTray] = useState(false)
  const trayContentHidden = isMobileTray && !trayOpen

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 699px), (max-width: 899px) and (max-height: 480px)')
    const updateIsMobileTray = () => setIsMobileTray(mediaQuery.matches)

    updateIsMobileTray()
    mediaQuery.addEventListener('change', updateIsMobileTray)
    return () => mediaQuery.removeEventListener('change', updateIsMobileTray)
  }, [])

  return (
    <div className={trayOpen ? 'remote-session remote-session--trainee remote-session--tray-open' : 'remote-session remote-session--trainee'}>
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
        <div className="remote-session__monitor" onPointerDown={() => setTrayOpen(false)}><Monitor /></div>
        <div className="trainee-action-tray">
          <button
            type="button"
            className="trainee-action-tray__handle"
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen(open => !open)}
          >
            <span className="trainee-action-tray__handle-grip" />
            Actions
          </button>
          <div
            className="trainee-action-tray__content"
            inert={trayContentHidden}
            aria-hidden={trayContentHidden ? 'true' : undefined}
          >
            <RightPanel compact trayMode />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TraineeView
