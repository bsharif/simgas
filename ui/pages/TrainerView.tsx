import { useEffect, useRef, useState, type FC } from 'react'
import QRCode from 'qrcode'
import Monitor from '../components/Monitor/Monitor'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'
import { useSimulationBridge } from '../context/SimulationBridge'
import PhaseTimeline from '../components/Trainer/PhaseTimeline'
import OverridePanel from '../components/Trainer/OverridePanel'
import EventInjector from '../components/Trainer/EventInjector'
import TraineeRoster from '../components/Trainer/TraineeRoster'
import { getQrCodeSize } from '../components/Trainer/qrSizing'

const TrainerView: FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const { sessionCode, roster, send, connectionStatus, commandsAvailable, paused } = useRemoteSimulation()
  const { phase } = useSimulationBridge()
  const traineeCount = roster.filter(entry => entry.role === 'trainee').length
  const inviteUrl = sessionCode ? `${window.location.origin}?join=${sessionCode}` : ''
  const isRunning = phase === 'running'

  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const [qrReady, setQrReady] = useState(false)
  const [qrCollapsed, setQrCollapsed] = useState(false)

  useEffect(() => {
    if (!sessionCode) return
    const canvas = qrCanvasRef.current
    const container = qrContainerRef.current
    if (!canvas || !container) return

    let cancelled = false

    const generate = () => {
      if (cancelled) return
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw === 0 || ch === 0) return
      QRCode.toCanvas(canvas, inviteUrl, {
        width: getQrCodeSize(cw, ch),
        margin: 2,
        color: { dark: '#1d83a6', light: '#ffffff' },
      }, (error: unknown) => {
        if (cancelled) return
        if (error) console.error('QR generation failed:', error)
        else setQrReady(true)
      })
    }

    const ro = new ResizeObserver(() => generate())
    ro.observe(container)
    requestAnimationFrame(() => generate())

    return () => {
      cancelled = true
      ro.disconnect()
    }
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
          <div className={`qr-placeholder${qrCollapsed ? ' qr-placeholder--collapsed' : ''}`} ref={qrContainerRef}>
            <div className="qr-placeholder__header">
              <span className="qr-placeholder__label">Invite QR</span>
              <button
                type="button"
                className="qr-placeholder__toggle"
                onClick={() => setQrCollapsed(c => !c)}
                aria-expanded={!qrCollapsed}
              >
                {qrCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>
            {!qrCollapsed && (
              <>
                <canvas ref={qrCanvasRef} className="qr-canvas" style={{ display: qrReady ? 'block' : 'none' }} />
                {!qrReady && <span>Generating QR...</span>}
              </>
            )}
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
