/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { SimulationEngine, type SimulationPhase } from '../../engine/physiology'
import { SCENARIO_MAP, ALL_SCENARIOS } from '../../engine/scenarios/index'
import { parseScenarioFile } from '../../engine/scenarios/dsl/parse'
import { specToScenario } from '../../engine/scenarios/dsl/interpret'
import { INTERVENTION_MAP } from '../../engine/interventions'
import type { DoseEntry } from '../../engine/doseLedger'
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
  loadScenario: (rawMd: string) => { ok: true } | { ok: false; error: string }
  phase: SimulationPhase
  elapsedSeconds: number
  doseLedger: ReadonlyMap<string, DoseEntry>
  /** @deprecated read `phase === 'resolved'` instead */
  resolved: boolean
  /** @deprecated read `phase === 'failed'` instead */
  failed: boolean
}

const SimulationContext = createContext<SimulationContextValue | null>(null)

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new SimulationEngine())
  const [dynamicScenarios, setDynamicScenarios] = useState<Scenario[]>([])

  const allScenarios = useMemo(() => {
    const dynamicIds = new Set(dynamicScenarios.map(s => s.id))
    return [...ALL_SCENARIOS.filter(s => !dynamicIds.has(s.id)), ...dynamicScenarios]
  }, [dynamicScenarios])

  const combinedMap = useMemo(
    () => new Map([...SCENARIO_MAP, ...dynamicScenarios.map(s => [s.id, s] as [string, Scenario])]),
    [dynamicScenarios]
  )

  const loadScenario = useCallback((rawMd: string): { ok: true } | { ok: false; error: string } => {
    try {
      const { spec, body } = parseScenarioFile(rawMd, '<upload>')
      const scenario = specToScenario(spec)
      scenario.debriefBody = body
      setDynamicScenarios(prev => [...prev.filter(s => s.id !== scenario.id), scenario])
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }, [])
  const [state, setState] = useState<PatientState>(engine.state)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('guided')
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [paused, setPaused] = useState(false)
  const [phase, setPhase] = useState<SimulationPhase>(engine.phase)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [doseLedger, setDoseLedger] = useState<ReadonlyMap<string, DoseEntry>>(() => new Map())

  useEffect(() => {
    // Engine broadcasts state at ~60 Hz, but numerics on a real monitor refresh
    // 2–5×/sec. Throttle React updates to ~5 Hz; canvas components read the
    // live engine.state directly so waveforms stay at 60 fps independently.
    const FLUSH_INTERVAL_MS = 200
    let lastFlushTs = 0

    const unsubState = engine.subscribe((s) => {
      const now = performance.now()
      if (now - lastFlushTs >= FLUSH_INTERVAL_MS) {
        lastFlushTs = now
        setState({ ...s })
        setElapsedSeconds(engine.elapsedSeconds)
      }
    })

    const unsubEvent = engine.onEvent((event) => {
      setEventLog(prev => [...prev, event])
    })

    const unsubPhase = engine.onPhaseChange((next) => {
      setPhase(next)
      // Force a final state flush on phase transition so consumers see
      // terminal values (e.g. the resolved or failed state) without waiting
      // up to FLUSH_INTERVAL_MS.
      setState({ ...engine.state })
      lastFlushTs = performance.now()
    })

    const unsubDose = engine.onDoseLedgerChange((next) => {
      // Snapshot to a new Map so React detects the change.
      setDoseLedger(new Map(next))
    })

    return () => {
      unsubState()
      unsubEvent()
      unsubPhase()
      unsubDose()
      engine.stop()
    }
  }, [engine])

  const startScenario = useCallback((id: string) => {
    const s = combinedMap.get(id)
    if (!s) return
    setScenario(s)
    setEventLog([])
    setPaused(false)
    setElapsedSeconds(0)
    setDoseLedger(new Map())
    engine.start(s)
  }, [engine, combinedMap])

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
        scenarios: allScenarios,
        loadScenario,
        phase,
        elapsedSeconds,
        doseLedger,
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
