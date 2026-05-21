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

  return (
    <main className="lobby-page">
      <section className="lobby-hero">
        <p className="lobby-eyebrow">SimGas collaboration</p>
        <h1>Run a monitor simulation solo or with a trainer.</h1>
        <p>Start a local practice case, host a Railway-backed trainer room, or join as a trainee with a six-character code.</p>
      </section>

      <section className="lobby-grid">
        <article className="lobby-card lobby-card--solo">
          <span className="lobby-card__label">Practice</span>
          <h2>Practice solo</h2>
          <p>Use the existing local simulator with no network session.</p>
          <button className="lobby-button" onClick={onPracticeSolo}>Choose scenario</button>
        </article>

        <article className="lobby-card">
          <span className="lobby-card__label">Trainer</span>
          <h2>Start trainer session</h2>
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
          <button className="lobby-button" disabled={!trainerCanSubmit} onClick={() => onCreateTrainerSession(trainerName.trim(), scenarioId)}>
            Create trainer room
          </button>
        </article>

        <article className="lobby-card">
          <span className="lobby-card__label">Trainee</span>
          <h2>Join session</h2>
          <label>
            Display name
            <input value={traineeName} onChange={event => setTraineeName(event.currentTarget.value)} placeholder="John" />
          </label>
          <label>
            Session code
            <input value={sessionCode} onChange={event => setSessionCode(event.currentTarget.value.toUpperCase())} placeholder="7K3M9P" maxLength={6} />
          </label>
          <button className="lobby-button" disabled={!traineeCanSubmit || sessionCode.length !== 6} onClick={() => onJoinSession(traineeName.trim(), sessionCode)}>
            Join as trainee
          </button>
        </article>
      </section>
    </main>
  )
}

export default LobbyPage
