import { useEffect, useRef, useState, type FC } from 'react'
import QRCode from 'qrcode'
import Monitor from '../components/Monitor/Monitor'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'
import { useSimulationBridge } from '../context/SimulationBridge'
import PhaseTimeline from '../components/Trainer/PhaseTimeline'
import OverridePanel from '../components/Trainer/OverridePanel'
import EventInjector from '../components/Trainer/EventInjector'
import TraineeRoster from '../components/Trainer/TraineeRoster'

const TrainerView: FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const { sessionCode, roster, send, connectionStatus, commandsAvailable, paused } = useRemoteSimulation()
  const { phase } = useSimulationBridge()
  const traineeCount = roster.filter(entry => entry.role === 'trainee').length
  const inviteUrl = sessionCode ? `${window.location.origin}?join=${sessionCode}` : ''
  const isRunning = phase === 'running'

  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const [qrReady, setQrReady] = useState(false)

  useEffect(() => {
    if (!sessionCode || !qrCanvasRef.current) return
    QRCode.toCanvas(qrCanvasRef.current, inviteUrl, {
      width: 180,
      margin: 2,
      color: { dark: '#1d83a6', light: '#ffffff' },
    }, (error) => {
      if (error) console.error('QR generation failed:', error)
      else setQrReady(true)
    })
  }, [sessionCode, inviteUrl])

  return (
    <div className="remote-session remote-session--trainer">
      {connectionStatus === 'disconnected' && (
        <div className="connection-banner connection-banner--error">
          Connection lost. Trying to reconnect...
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div className="connection-banner connection-banner--info">
          Connecting to server...
        </div>
      )}
      <header className="remote-topbar">
        <strong>SimGas trainer</strong>
        <span className="session-code-display">
          Code <strong>{sessionCode ?? '...'}</strong>
        </span>
        <span>{traineeCount} trainees</span>
        <button onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy invite</button>
        <button onClick={() => send({ type: 'pause' })} disabled={!commandsAvailable || !isRunning || paused}>Pause</button>
        <button onClick={() => send({ type: 'resume' })} disabled={!commandsAvailable || !isRunning || !paused}>Resume</button>
        <button onClick={() => { if (send({ type: 'end_session' })) onEnd() }} disabled={!commandsAvailable}>End</button>
      </header>
      <div className="trainer-layout">
        <div className="trainer-monitor"><Monitor /></div>
        <aside className="trainer-controls">
          <div className="qr-placeholder">
            <canvas ref={qrCanvasRef} style={{ display: qrReady ? 'block' : 'none' }} />
            {!qrReady && <span>Generating QR...</span>}
          </div>
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
