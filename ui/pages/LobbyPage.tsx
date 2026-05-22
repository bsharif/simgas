import { useState, type FC } from 'react'
import { ALL_SCENARIOS } from '../../engine/scenarios/index'

interface LobbyPageProps {
  onPracticeSolo: () => void
  onCreateTrainerSession: (name: string, scenarioId: string) => void
  onJoinSession: (name: string, sessionCode: string) => void
  initialSessionCode?: string
}

const LobbyPage: FC<LobbyPageProps> = ({ onPracticeSolo, onCreateTrainerSession, onJoinSession, initialSessionCode }) => {
  const [trainerName, setTrainerName] = useState('')
  const [traineeName, setTraineeName] = useState('')
  const [sessionCode, setSessionCode] = useState(initialSessionCode?.toUpperCase() ?? '')
  const [scenarioId, setScenarioId] = useState(ALL_SCENARIOS[0]?.id ?? 'anaphylaxis')
  const trainerCanSubmit = trainerName.trim().length > 0
  const traineeCanSubmit = traineeName.trim().length > 0
  const codeReady = sessionCode.length === 6

  return (
    <main className="lobby-page">
      <section className="lobby-hero">
        <h1>SimGas</h1>
        <p>Anaesthetic simulation monitor</p>
      </section>

      <section className="lobby-grid">
        <article className="lobby-card lobby-card--solo">
          <span className="lobby-card__label">Practice</span>
          <h2>Practice solo</h2>
          <p className="lobby-card__description">Run a local case on this device. No network session.</p>
          <button className="lobby-button lobby-button--secondary" onClick={onPracticeSolo}>Choose scenario</button>
        </article>

        <article className="lobby-card">
          <span className="lobby-card__label">Trainer</span>
          <h2>Host trainer room</h2>
          <p className="lobby-card__description">Create a shared room and invite trainees with a code.</p>
          <label>
            Display name
            <input value={trainerName} onChange={event => setTrainerName(event.currentTarget.value)} placeholder="Dr Smith" />
          </label>
          <label>
            Scenario
            <select value={scenarioId} onChange={event => setScenarioId(event.currentTarget.value)}>
              {ALL_SCENARIOS.map(scenario => (
                <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
              ))}
            </select>
          </label>
          <p className="lobby-helper">Creates a six-character join code.</p>
          <button className="lobby-button" disabled={!trainerCanSubmit} onClick={() => onCreateTrainerSession(trainerName.trim(), scenarioId)}>
            Create room
          </button>
          {!trainerCanSubmit && <p className="lobby-helper lobby-helper--required">Enter your display name.</p>}
        </article>

        <article className="lobby-card">
          <span className="lobby-card__label">Trainee</span>
          <h2>Join as trainee</h2>
          <p className="lobby-card__description">Join a trainer-led case using a session code.</p>
          <label>
            Display name
            <input value={traineeName} onChange={event => setTraineeName(event.currentTarget.value)} placeholder="John" />
          </label>
          <label>
            Session code
            <input value={sessionCode} onChange={event => setSessionCode(event.currentTarget.value.replace(/\s/g, '').toUpperCase())} placeholder="7K3M9P" maxLength={6} />
          </label>
          <p className="lobby-helper">{initialSessionCode ? 'Code from invite link loaded.' : 'Enter the trainer code or scan the QR.'}</p>
          <button className="lobby-button" disabled={!traineeCanSubmit || !codeReady} onClick={() => onJoinSession(traineeName.trim(), sessionCode)}>
            Join session
          </button>
          {(!traineeCanSubmit || !codeReady) && (
            <p className="lobby-helper lobby-helper--required">
              {!traineeCanSubmit ? 'Enter your display name.' : 'Enter the 6-character code.'}
            </p>
          )}
        </article>
      </section>

      <p className="lobby-footer">Educational simulation tool. Not for clinical use.</p>
    </main>
  )
}

export default LobbyPage
