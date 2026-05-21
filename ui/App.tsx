import { useState } from 'react'
import { SimulationProvider } from './context/SimulationContext'
import { MonitorLayoutProvider } from './context/MonitorLayoutContext'
import { AlarmsProvider } from './context/AlarmsContext'
import { RemoteSimulationProvider } from './context/RemoteSimulationContext'
import { WebSocketClient } from './network/WebSocketClient'
import StartPage from './pages/StartPage'
import SimulationView from './pages/SimulationView'
import ScenarioCreator from './pages/ScenarioCreator'
import LobbyPage from './pages/LobbyPage'
import TraineeView from './pages/TraineeView'
import TrainerView from './pages/TrainerView'
import type { ClientMessage } from '../shared/protocol'

type Screen = 'lobby' | 'start' | 'simulation' | 'creator' | 'trainer' | 'trainee'

interface RemoteSessionState {
  client: WebSocketClient
  initialMessage: ClientMessage
}

function AppRouter() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [remoteSession, setRemoteSession] = useState<RemoteSessionState | null>(null)
  const [initialJoinCode] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join')
    if (code && /^[A-HJ-NP-Z2-9]{6}$/i.test(code)) {
      const url = new URL(window.location.href)
      url.searchParams.delete('join')
      window.history.replaceState({}, '', url.toString())
      return code.toUpperCase()
    }
    return undefined
  })

  if (screen === 'lobby') {
    return (
      <LobbyPage
        onPracticeSolo={() => setScreen('start')}
        onCreateTrainerSession={(name, scenarioId) => {
          setRemoteSession({ client: new WebSocketClient(), initialMessage: { type: 'create_session', name, scenarioId } })
          setScreen('trainer')
        }}
        onJoinSession={(name, sessionCode) => {
          setRemoteSession({ client: new WebSocketClient(), initialMessage: { type: 'join_session', name, sessionCode } })
          setScreen('trainee')
        }}
        initialSessionCode={initialJoinCode}
      />
    )
  }

  if (screen === 'start') {
    return (
      <StartPage
        onStart={() => setScreen('simulation')}
        onOpenCreator={() => setScreen('creator')}
      />
    )
  }
  if (screen === 'creator') {
    return <ScenarioCreator onBack={() => setScreen('start')} />
  }
  if ((screen === 'trainer' || screen === 'trainee') && remoteSession) {
    return (
      <RemoteSimulationProvider client={remoteSession.client} initialMessage={remoteSession.initialMessage}>
        <MonitorLayoutProvider>
          <AlarmsProvider>
            {screen === 'trainer' ? <TrainerView onEnd={() => setScreen('lobby')} /> : <TraineeView onLeave={() => setScreen('lobby')} />}
          </AlarmsProvider>
        </MonitorLayoutProvider>
      </RemoteSimulationProvider>
    )
  }
  return <SimulationView />
}

function App() {
  return (
    <SimulationProvider>
      <MonitorLayoutProvider>
        <AlarmsProvider>
          <AppRouter />
        </AlarmsProvider>
      </MonitorLayoutProvider>
    </SimulationProvider>
  )
}

export default App
