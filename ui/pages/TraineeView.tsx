import { useEffect, useState, type FC } from 'react'
import type { SessionSummaryMessage } from '../../shared/protocol'
import Monitor from '../components/Monitor/Monitor'
import RightPanel from '../components/RightPanel/RightPanel'
import RemoteDebrief from '../components/Debrief/RemoteDebrief'
import SessionErrorScreen from '../components/SessionErrorScreen'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'
import { useSimulationBridge } from '../context/SimulationBridge'

const TraineeView: FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const {
    sessionCode, connectionStatus, roster, sessionError, clearSessionError,
    scenarioMetadata, sessionSummary, debriefOpen,
  } = useRemoteSimulation()
  const { phase } = useSimulationBridge()
  const [trayOpen, setTrayOpen] = useState(false)
  const [isMobileTray, setIsMobileTray] = useState(false)
  // Dismissal is keyed by the summary object, so a fresh debrief broadcast
  // for a new run re-opens even if a previous one was dismissed.
  const [dismissedSummary, setDismissedSummary] = useState<SessionSummaryMessage | null>(null)
  const trayContentHidden = isMobileTray && !trayOpen

  const isWaiting = phase === 'idle'
  const isEnded = phase === 'resolved' || phase === 'failed'
  const showDebrief = debriefOpen && scenarioMetadata && sessionSummary && dismissedSummary !== sessionSummary

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 699px), (max-width: 899px) and (max-height: 480px)')
    const updateIsMobileTray = () => setIsMobileTray(mediaQuery.matches)

    updateIsMobileTray()
    mediaQuery.addEventListener('change', updateIsMobileTray)
    return () => mediaQuery.removeEventListener('change', updateIsMobileTray)
  }, [])

  if (sessionError?.fatal) {
    return <SessionErrorScreen error={sessionError} onBack={onLeave} />
  }

  if (isWaiting) {
    const trainerName = roster.find(entry => entry.role === 'trainer')?.name
    const connectedTrainees = roster.filter(entry => entry.role === 'trainee' && entry.connected).length
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1f2428', padding: 16,
      }}>
        <div style={{
          maxWidth: 420, background: '#fff', borderRadius: 12, padding: '28px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center',
        }}>
          {connectionStatus !== 'connected' ? (
            <>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>
              <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#2c2c2c' }}>Joining session...</h1>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                Connecting to {sessionCode ? `session ${sessionCode}` : 'the server'}.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🩺</div>
              <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#2c2c2c' }}>You're in — waiting for the trainer</h1>
              <p style={{ margin: '0 0 6px', color: '#666', fontSize: 14, lineHeight: 1.5 }}>
                {trainerName ? `${trainerName} will start the case shortly.` : 'The trainer will start the case shortly.'}
              </p>
              <p style={{ margin: 0, color: '#999', fontSize: 13 }}>
                Session {sessionCode} · {connectedTrainees} trainee{connectedTrainees === 1 ? '' : 's'} connected
              </p>
            </>
          )}
          <button
            onClick={onLeave}
            style={{
              marginTop: 20, padding: '8px 18px', border: '1px solid #d8d4ca', borderRadius: 6,
              background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className={trayOpen ? 'remote-session remote-session--trainee remote-session--tray-open' : 'remote-session remote-session--trainee'}>
      {connectionStatus === 'disconnected' && (
        <div className="connection-banner connection-banner--error">
          Connection lost. Trying to reconnect...
        </div>
      )}
      {sessionError && !sessionError.fatal && (
        <div className="connection-banner connection-banner--error">
          {sessionError.message}
          <button onClick={clearSessionError} style={{ marginLeft: 10 }}>Dismiss</button>
        </div>
      )}
      {isEnded && !showDebrief && (
        <div className="connection-banner connection-banner--info">
          {phase === 'resolved' ? '✓ Case complete.' : '✗ Case ended.'} Waiting for the trainer to open the debrief...
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

      {showDebrief && (
        <RemoteDebrief
          metadata={scenarioMetadata}
          summary={sessionSummary}
          onClose={() => setDismissedSummary(sessionSummary)}
        />
      )}
    </div>
  )
}

export default TraineeView
