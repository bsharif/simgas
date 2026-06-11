import { useEffect, useRef, useState, type FC } from 'react'
import QRCode from 'qrcode'
import type { SessionSummaryMessage } from '../../shared/protocol'
import Monitor from '../components/Monitor/Monitor'
import { useRemoteSimulation } from '../context/RemoteSimulationContext'
import { useSimulationBridge } from '../context/SimulationBridge'
import PhaseTimeline from '../components/Trainer/PhaseTimeline'
import OverridePanel from '../components/Trainer/OverridePanel'
import EventInjector from '../components/Trainer/EventInjector'
import TraineeRoster from '../components/Trainer/TraineeRoster'
import ActionTimeline from '../components/Trainer/ActionTimeline'
import NotesPanel from '../components/Trainer/NotesPanel'
import RemoteDebrief from '../components/Debrief/RemoteDebrief'
import SessionErrorScreen from '../components/SessionErrorScreen'
import { getQrCodeSize } from '../components/Trainer/qrSizing'
import { ALL_SCENARIOS } from '../../engine/scenarios/index'

const TrainerView: FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const {
    sessionCode, roster, send, connectionStatus, commandsAvailable, paused,
    sessionError, clearSessionError, scenarioMetadata, sessionSummary, actionLog, debriefOpen,
  } = useRemoteSimulation()
  const { phase } = useSimulationBridge()
  const trainees = roster.filter(entry => entry.role === 'trainee')
  const connectedTrainees = trainees.filter(entry => entry.connected).length
  const inviteUrl = sessionCode ? `${window.location.origin}?join=${sessionCode}` : ''
  const isRunning = phase === 'running'
  const isWaitingRoom = phase === 'idle'
  const isEnded = phase === 'resolved' || phase === 'failed'

  const [selectedScenarioId, setSelectedScenarioId] = useState(ALL_SCENARIOS[0]?.id ?? '')
  // Trainer's explicit open/close choice for the current run's debrief. Keyed
  // by the summary object so a new run (new summary) falls back to following
  // the group debrief_open broadcast.
  const [debriefChoice, setDebriefChoice] = useState<{ summary: SessionSummaryMessage; open: boolean } | null>(null)
  const debriefVisible = sessionSummary !== null
    && (debriefChoice?.summary === sessionSummary ? debriefChoice.open : debriefOpen)

  // Adopt the active scenario as the restart default when metadata arrives
  // (render-time adjustment, guarded so user selection isn't clobbered).
  const [adoptedScenarioId, setAdoptedScenarioId] = useState<string | null>(null)
  if (scenarioMetadata && scenarioMetadata.scenarioId !== adoptedScenarioId) {
    setAdoptedScenarioId(scenarioMetadata.scenarioId)
    setSelectedScenarioId(scenarioMetadata.scenarioId)
  }

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
    // isWaitingRoom swaps the QR between two different containers — re-attach
    // the observer and re-render the canvas when the layout changes.
  }, [sessionCode, inviteUrl, isWaitingRoom])

  if (sessionError?.fatal) {
    return <SessionErrorScreen error={sessionError} onBack={onEnd} />
  }

  const startCase = (scenarioId: string) => {
    setDebriefChoice(null)
    send({ type: 'start_scenario', scenarioId })
  }
  const openDebrief = () => {
    if (sessionSummary) setDebriefChoice({ summary: sessionSummary, open: true })
  }
  const closeDebrief = () => {
    if (sessionSummary) setDebriefChoice({ summary: sessionSummary, open: false })
  }

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
      {sessionError && !sessionError.fatal && (
        <div className="connection-banner connection-banner--error">
          {sessionError.message}
          <button onClick={clearSessionError} style={{ marginLeft: 10 }}>Dismiss</button>
        </div>
      )}
      <header className="remote-topbar">
        <strong>SimGas trainer</strong>
        <span className="session-code-display">
          Code <strong>{sessionCode ?? '...'}</strong>
        </span>
        <span>{connectedTrainees}/{trainees.length} trainees connected</span>
        <button onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy invite</button>
        {!isWaitingRoom && (
          <>
            <button onClick={() => send({ type: 'pause' })} disabled={!commandsAvailable || !isRunning || paused}>Pause</button>
            <button onClick={() => send({ type: 'resume' })} disabled={!commandsAvailable || !isRunning || !paused}>Resume</button>
          </>
        )}
        {isEnded && (
          <button onClick={openDebrief} disabled={!sessionSummary}>Debrief</button>
        )}
        <button onClick={() => { if (send({ type: 'end_session' })) onEnd() }} disabled={!commandsAvailable}>End</button>
      </header>

      {isWaitingRoom ? (
        <div className="trainer-layout trainer-layout--waiting" style={{ display: 'flex', gap: 16, padding: 16, flex: 1, minHeight: 0 }}>
          <section className="trainer-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <h2>Waiting room</h2>
            <p>Invite trainees with the code <strong>{sessionCode ?? '...'}</strong> or the QR below, brief the case, then start when everyone is in.</p>
            <div ref={qrContainerRef} style={{ flex: 1, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas ref={qrCanvasRef} className="qr-canvas" style={{ display: qrReady ? 'block' : 'none' }} />
              {!qrReady && <span>Generating QR...</span>}
            </div>
            <label style={{ display: 'block', margin: '12px 0 8px' }}>
              Scenario{' '}
              <select value={selectedScenarioId} onChange={event => setSelectedScenarioId(event.currentTarget.value)}>
                {ALL_SCENARIOS.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                ))}
              </select>
            </label>
            <button
              className="lobby-button"
              disabled={!commandsAvailable || !selectedScenarioId}
              onClick={() => startCase(selectedScenarioId)}
              style={{ fontSize: 16, padding: '12px 18px' }}
            >
              ▶ Start case
            </button>
            {connectedTrainees === 0 && (
              <p style={{ opacity: 0.7, marginTop: 8 }}>No trainees connected yet — you can still run the case solo on the projector.</p>
            )}
          </section>
          <aside style={{ width: 280, flexShrink: 0 }}>
            <TraineeRoster />
          </aside>
        </div>
      ) : (
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
              <canvas
                ref={qrCanvasRef}
                className="qr-canvas"
                style={{ display: !qrCollapsed && qrReady ? 'block' : 'none' }}
              />
              {!qrCollapsed && !qrReady && <span>Generating QR...</span>}
            </div>
            {isEnded && (
              <section className="trainer-card">
                <h2>Case ended</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button disabled={!sessionSummary} onClick={openDebrief}>Review debrief</button>
                  <button disabled={!commandsAvailable || !sessionSummary} onClick={() => send({ type: 'open_debrief' })}>
                    Open debrief for everyone
                  </button>
                  <button disabled={!commandsAvailable} onClick={() => startCase(selectedScenarioId)}>
                    ↻ Restart case
                  </button>
                  <label>
                    Next case{' '}
                    <select value={selectedScenarioId} onChange={event => setSelectedScenarioId(event.currentTarget.value)}>
                      {ALL_SCENARIOS.map(scenario => (
                        <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            )}
            <PhaseTimeline />
            <ActionTimeline />
            <NotesPanel />
            <OverridePanel />
            <EventInjector />
            <TraineeRoster />
          </aside>
        </div>
      )}

      {debriefVisible && scenarioMetadata && sessionSummary && (
        <RemoteDebrief
          metadata={scenarioMetadata}
          summary={sessionSummary}
          actionLog={actionLog}
          trainerExtras={
            <>
              <button
                disabled={!commandsAvailable}
                onClick={() => send({ type: 'open_debrief' })}
                style={{
                  padding: '9px 18px', border: '1px solid #1a5276', borderRadius: 6,
                  background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1a5276',
                }}
              >
                Open for everyone
              </button>
              <button
                disabled={!commandsAvailable}
                onClick={() => startCase(selectedScenarioId)}
                style={{
                  padding: '9px 18px', border: '1px solid #1a5276', borderRadius: 6,
                  background: '#1a5276', cursor: 'pointer', fontSize: 14, color: '#fff', fontWeight: 600,
                }}
              >
                Restart case
              </button>
            </>
          }
          onClose={closeDebrief}
        />
      )}
    </div>
  )
}

export default TrainerView
