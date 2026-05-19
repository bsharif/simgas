import { useState } from 'react'
import { SimulationProvider } from './context/SimulationContext'
import { MonitorLayoutProvider } from './context/MonitorLayoutContext'
import StartPage from './pages/StartPage'
import SimulationView from './pages/SimulationView'

type Screen = 'start' | 'simulation'

function AppRouter() {
  const [screen, setScreen] = useState<Screen>('start')

  if (screen === 'start') {
    return <StartPage onStart={() => setScreen('simulation')} />
  }

  return <SimulationView />
}

function App() {
  return (
    <SimulationProvider>
      <MonitorLayoutProvider>
        <AppRouter />
      </MonitorLayoutProvider>
    </SimulationProvider>
  )
}

export default App
