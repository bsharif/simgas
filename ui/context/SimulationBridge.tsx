/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import type { DoseEntry } from '../../engine/doseLedger'
import type { PatientState } from '../../engine/patient'
import type { Scenario } from '../../engine/scenario'
import type { SimulationPhase } from '../../engine/physiology'
import type { MachineSettingsUpdate } from '../../shared/protocol'
import type { WaveformSource } from '../components/Monitor/waveformSource'
import type { WebSocketConnectionStatus } from '../network/WebSocketClient'

export interface SimulationBridgeValue {
  state: PatientState
  scenario: Scenario | null
  phase: SimulationPhase
  elapsedSeconds: number
  eventLog: string[]
  doseLedger: ReadonlyMap<string, DoseEntry>
  waveformSource: WaveformSource
  connectionStatus?: WebSocketConnectionStatus
  commandsAvailable: boolean
  audioSource?: {
    subscribe: (cb: (state: PatientState) => void) => () => void
    getElapsedSeconds: () => number
  }
  applyIntervention: (id: string) => void
  updateMachineSettings: (settings: MachineSettingsUpdate) => void
  setManualVentilation: (active: boolean) => void
  togglePause: () => void
}

const SimulationBridgeContext = createContext<SimulationBridgeValue | null>(null)

export function SimulationBridgeProvider({ value, children }: { value: SimulationBridgeValue; children: ReactNode }) {
  return <SimulationBridgeContext.Provider value={value}>{children}</SimulationBridgeContext.Provider>
}

export function useSimulationBridge(): SimulationBridgeValue {
  const ctx = useContext(SimulationBridgeContext)
  if (!ctx) throw new Error('useSimulationBridge must be used within SimulationBridgeProvider')
  return ctx
}

export function useOptionalSimulationBridge(): SimulationBridgeValue | null {
  return useContext(SimulationBridgeContext)
}
