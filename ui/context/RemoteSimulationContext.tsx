/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { makeDoseLedger, type DoseEntry } from '../../engine/doseLedger'
import { createBaselineState, type PatientState } from '../../engine/patient'
import type { Scenario } from '../../engine/scenario'
import type { SimulationPhase } from '../../engine/physiology'
import type { ClientMessage, MachineSettingsUpdate, RemotePatientSnapshot, ScenarioMetadataMessage, ServerMessage } from '../../shared/protocol'
import { RemoteWaveformStore } from '../remote/RemoteWaveformStore'
import type { WebSocketClient, WebSocketConnectionStatus } from '../network/WebSocketClient'
import { SimulationBridgeProvider, type SimulationBridgeValue } from './SimulationBridge'

interface RemoteSimulationContextValue {
  role: 'trainer' | 'trainee' | null
  sessionCode: string | null
  roster: Array<{ id: string; name: string; role: 'trainer' | 'trainee' }>
  scenarioMetadata: ScenarioMetadataMessage | null
  connectionStatus: WebSocketConnectionStatus
  paused: boolean
  currentPhaseId: string | null
  completedPhaseIds: string[]
  forcedPhaseId: string | null
  commandsAvailable: boolean
  send: (message: ClientMessage) => boolean
}

const RemoteSimulationContext = createContext<RemoteSimulationContextValue | null>(null)

function snapshotToState(snapshot: ServerMessage & { type: 'state' }, previous: PatientState): PatientState {
  return {
    ...previous,
    ...snapshot.snapshot,
    nibp: { ...snapshot.snapshot.nibp },
    art: snapshot.snapshot.art ? { ...snapshot.snapshot.art } : null,
  }
}

function scenarioFromMetadata(metadata: ScenarioMetadataMessage): Scenario {
  return {
    id: metadata.scenarioId,
    label: metadata.label,
    description: '',
    difficulty: 'medium',
    hints: [],
    initialModifiers: {},
    check: () => ({ modifiers: {}, events: [], resolved: false, failed: false }),
  }
}

export function shouldResetRemoteWaveforms(
  previousPhase: SimulationPhase,
  snapshot: Pick<RemotePatientSnapshot, 'phase' | 'elapsedSeconds'>,
  pendingRunStart = false,
): boolean {
  return (pendingRunStart || previousPhase !== 'running')
    && snapshot.phase === 'running'
    && snapshot.elapsedSeconds <= 1
}

type RemoteStateApplication = 'reject' | 'reset' | 'write' | 'skip-waveforms'

export function getRemoteStateApplication({
  latestElapsedSeconds,
  hasReceivedState,
  previousPhase,
  pendingRunStart,
  snapshot,
}: {
  latestElapsedSeconds: number
  hasReceivedState: boolean
  previousPhase: SimulationPhase
  pendingRunStart: boolean
  snapshot: Pick<RemotePatientSnapshot, 'phase' | 'elapsedSeconds'>
}): RemoteStateApplication {
  if (snapshot.elapsedSeconds < latestElapsedSeconds) return 'reject'
  if (!hasReceivedState) return 'reset'
  if (shouldResetRemoteWaveforms(previousPhase, snapshot, pendingRunStart)) return 'reset'
  if (snapshot.elapsedSeconds === latestElapsedSeconds) return 'skip-waveforms'
  return 'write'
}

export function RemoteSimulationProvider({
  client,
  initialMessage,
  children,
}: { client: WebSocketClient; initialMessage?: ClientMessage; children: ReactNode }) {
  const [waveformStore] = useState(() => new RemoteWaveformStore())
  const [state, setState] = useState<PatientState>(() => createBaselineState())
  const [eventLog, setEventLog] = useState<string[]>([])
  const [phase, setPhase] = useState<SimulationPhase>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [role, setRole] = useState<'trainer' | 'trainee' | null>(null)
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [roster, setRoster] = useState<RemoteSimulationContextValue['roster']>([])
  const [scenarioMetadata, setScenarioMetadata] = useState<ScenarioMetadataMessage | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('connecting')
  const [paused, setPaused] = useState(false)
  const [currentPhaseId, setCurrentPhaseId] = useState<string | null>(null)
  const [completedPhaseIds, setCompletedPhaseIds] = useState<string[]>([])
  const [forcedPhaseId, setForcedPhaseId] = useState<string | null>(null)
  const doseLedger = useMemo<ReadonlyMap<string, DoseEntry>>(() => makeDoseLedger(), [])
  const audioSubscribers = useRef(new Set<(state: PatientState) => void>())
  const stateRef = useRef(state)
  const latestElapsedSecondsRef = useRef(0)
  const phaseRef = useRef<SimulationPhase>('idle')
  const resetWaveformsOnNextStateRef = useRef(false)
  const hasReceivedStateRef = useRef(false)

  useEffect(() => {
    waveformStore.startTick()
    return () => waveformStore.stopTick()
  }, [waveformStore])

  useEffect(() => {
    const unsubscribeStatus = client.onStatusChange(setConnectionStatus)
    client.connect()
    if (initialMessage) client.send(initialMessage)
    const unsubscribe = client.onMessage(message => {
      if (message.type === 'session_created' || message.type === 'session_joined') {
        setConnectionStatus('connected')
        setRole(message.role)
        setSessionCode(message.sessionCode)
        return
      }
      if (message.type === 'session_info') {
        setRole(message.role)
        setSessionCode(message.sessionCode)
        setRoster(message.roster)
        phaseRef.current = message.phase
        setPhase(message.phase)
        return
      }
      if (message.type === 'event_log_snapshot') {
        setEventLog(message.events)
        return
      }
      if (message.type === 'state') {
        const stateApplication = getRemoteStateApplication({
          latestElapsedSeconds: latestElapsedSecondsRef.current,
          hasReceivedState: hasReceivedStateRef.current,
          previousPhase: phaseRef.current,
          pendingRunStart: resetWaveformsOnNextStateRef.current,
          snapshot: message.snapshot,
        })
        if (stateApplication === 'reject') return
        if (stateApplication === 'reset') {
          waveformStore.reset(message.snapshot)
        } else if (stateApplication === 'write') {
          waveformStore.writeSnapshot(message.snapshot)
        }
        hasReceivedStateRef.current = true
        resetWaveformsOnNextStateRef.current = false
        setElapsedSeconds(message.snapshot.elapsedSeconds)
        latestElapsedSecondsRef.current = message.snapshot.elapsedSeconds
        phaseRef.current = message.snapshot.phase
        setPhase(message.snapshot.phase)
        setPaused(message.snapshot.paused)
        setCurrentPhaseId(message.snapshot.currentPhaseId)
        setCompletedPhaseIds(message.snapshot.completedPhaseIds)
        setForcedPhaseId(message.snapshot.forcedPhaseId)
        const next = snapshotToState(message, stateRef.current)
        stateRef.current = next
        setState(next)
        audioSubscribers.current.forEach(cb => cb(next))
        return
      }
      if (message.type === 'event') {
        setEventLog(previous => [...previous, message.text])
        return
      }
      if (message.type === 'phase_change') {
        if (phaseRef.current !== 'running' && message.phase === 'running') {
          resetWaveformsOnNextStateRef.current = true
        }
        phaseRef.current = message.phase
        setPhase(message.phase)
        return
      }
      if (message.type === 'scenario_metadata') {
        setScenarioMetadata(message)
      }
    })
    return () => {
      unsubscribe()
      unsubscribeStatus()
      client.close()
      setConnectionStatus('disconnected')
    }
  }, [client, initialMessage, waveformStore])

  const commandsAvailable = connectionStatus === 'connected'
  const send = useCallback((message: ClientMessage) => client.send(message), [client])
  const scenario = scenarioMetadata ? scenarioFromMetadata(scenarioMetadata) : null

  const audioSource = useMemo(() => ({
    subscribe: (cb: (state: PatientState) => void) => {
      audioSubscribers.current.add(cb)
      return () => { audioSubscribers.current.delete(cb) }
    },
    getElapsedSeconds: () => latestElapsedSecondsRef.current,
  }), [])

  const bridgeValue = useMemo<SimulationBridgeValue>(() => ({
    state,
    scenario,
    phase,
    elapsedSeconds,
    eventLog,
    doseLedger,
    waveformSource: waveformStore.source,
    connectionStatus,
    commandsAvailable,
    audioSource,
    applyIntervention: id => { if (commandsAvailable) send({ type: 'intervene', interventionId: id }) },
    updateMachineSettings: (settings: MachineSettingsUpdate) => { if (commandsAvailable) send({ type: 'update_machine_settings', settings }) },
    setManualVentilation: active => { if (commandsAvailable) send({ type: 'set_manual_ventilation', active }) },
    togglePause: () => { if (commandsAvailable) send({ type: 'pause' }) },
  }), [state, scenario, phase, elapsedSeconds, eventLog, doseLedger, waveformStore, connectionStatus, commandsAvailable, audioSource, send])

  return (
    <RemoteSimulationContext.Provider value={{
      role,
      sessionCode,
      roster,
      scenarioMetadata,
      connectionStatus,
      paused,
      currentPhaseId,
      completedPhaseIds,
      forcedPhaseId,
      commandsAvailable,
      send,
    }}>
      <SimulationBridgeProvider value={bridgeValue}>{children}</SimulationBridgeProvider>
    </RemoteSimulationContext.Provider>
  )
}

export function useRemoteSimulation(): RemoteSimulationContextValue {
  const ctx = useContext(RemoteSimulationContext)
  if (!ctx) throw new Error('useRemoteSimulation must be used within RemoteSimulationProvider')
  return ctx
}
