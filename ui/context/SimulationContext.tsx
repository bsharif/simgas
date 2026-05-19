/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { SimulationEngine, type SimulationPhase } from '../../engine/physiology'
import { SCENARIO_MAP, ALL_SCENARIOS } from '../../engine/scenarios/index'
import { INTERVENTION_MAP } from '../../engine/interventions'
import type { PatientState } from '../../engine/patient'
import type { Scenario } from '../../engine/scenario'

type Mode = 'guided' | 'exam' | 'free'

interface SimulationContextValue {
  state: PatientState
  engine: SimulationEngine
  eventLog: string[]
  mode: Mode
  setMode: (m: Mode) => void
  startScenario: (id: string) => void
  applyIntervention: (id: string) => void
  updateMachineSettings: (settings: Partial<Pick<PatientState, 'fio2' | 'vt' | 'peep' | 'gasFlow' | 'rr' | 'sevoflurane' | 'ventilationMode'>>) => void
  setManualVentilation: (active: boolean) => void
  togglePause: () => void
  paused: boolean
  scenario: Scenario | null
  scenarios: Scenario[]
  phase: SimulationPhase
  /** @deprecated read `phase === 'resolved'` instead */
  resolved: boolean
  /** @deprecated read `phase === 'failed'` instead */
  failed: boolean
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new SimulationEngine())
  const [state, setState] = useState<PatientState>(engine.state)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('guided')
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [paused, setPaused] = useState(false)
  const [phase, setPhase] = useState<SimulationPhase>(engine.phase)

  useEffect(() => {
    const unsubState = engine.subscribe((s) => {
      setState({ ...s })
    })

    const unsubEvent = engine.onEvent((event) => {
      setEventLog(prev => [...prev, event])
    })

    const unsubPhase = engine.onPhaseChange((next) => {
      setPhase(next)
    })

    return () => {
      unsubState()
      unsubEvent()
      unsubPhase()
      engine.stop()
    }
  }, [engine])

  const startScenario = useCallback((id: string) => {
    const s = SCENARIO_MAP.get(id)
    if (!s) return
    setScenario(s)
    setEventLog([])
    setPaused(false)
    engine.start(s)
  }, [engine])

  const applyIntervention = useCallback((id: string) => {
    const intervention = INTERVENTION_MAP.get(id)
    if (!intervention) return
    engine.applyIntervention(intervention)
  }, [engine])

  const updateMachineSettings = useCallback((settings: Partial<Pick<PatientState, 'fio2' | 'vt' | 'peep' | 'gasFlow' | 'rr' | 'sevoflurane' | 'ventilationMode'>>) => {
    engine.updateMachineSettings(settings)
  }, [engine])

  const setManualVentilation = useCallback((active: boolean) => {
    engine.setManualVentilation(active)
  }, [engine])

  const togglePause = useCallback(() => {
    engine.togglePause()
    setPaused(engine.paused)
  }, [engine])

  return (
    <SimulationContext.Provider
      value={{
        state,
        engine,
        eventLog,
        mode,
        setMode,
        startScenario,
        applyIntervention,
        updateMachineSettings,
        setManualVentilation,
        togglePause,
        paused,
        scenario,
        scenarios: ALL_SCENARIOS,
        phase,
        resolved: phase === 'resolved',
        failed: phase === 'failed',
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext)
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider')
  return ctx
}
