import { useState } from 'react'
import { SimulationProvider } from './context/SimulationContext'
import { MonitorLayoutProvider } from './context/MonitorLayoutContext'
import { AlarmsProvider } from './context/AlarmsContext'
import StartPage from './pages/StartPage'
import SimulationView from './pages/SimulationView'
import ScenarioCreator from './pages/ScenarioCreator'

type Screen = 'start' | 'simulation' | 'creator'

function AppRouter() {
  const [screen, setScreen] = useState<Screen>('start')

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
