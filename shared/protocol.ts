import type { CapnographyShape, EcgRhythm, PatientState } from '../engine/patient'
import type { SimulationPhase } from '../engine/physiology'

export type SessionRole = 'trainer' | 'trainee'

export type MachineSettingsUpdate = Partial<Pick<
  PatientState,
  'fio2' | 'vt' | 'peep' | 'gasFlow' | 'rr' | 'sevoflurane' | 'ventilationMode'
>>

export interface RemotePatientSnapshot {
  hr: number
  spo2: number
  nibp: PatientState['nibp']
  art: PatientState['art']
  cvp: PatientState['cvp']
  bis: PatientState['bis']
  etco2: number
  rr: number
  temp: number
  fio2: number
  vt: number
  peep: number
  gasFlow: number
  sevoflurane: number
  ventilationMode: PatientState['ventilationMode']
  manualVentilationActive: boolean
  consciousness: PatientState['consciousness']
  ecgRhythm: EcgRhythm
  capnographyShape: CapnographyShape
  tubePosition: PatientState['tubePosition']
  phase: SimulationPhase
  elapsedSeconds: number
}

export interface ScenarioMetadataMessage {
  type: 'scenario_metadata'
  scenarioId: string
  label: string
  phases: Array<{
    id: string
    label?: string
    enterWhen?: string
    resolveWhen?: string
    failWhen?: string
    events?: Array<{ atSec: number; text: string }>
    baseline?: unknown
    snap?: unknown
  }>
}

export type ClientMessage =
  | { type: 'create_session'; name: string; scenarioId: string }
  | { type: 'join_session'; sessionCode: string; name: string }
  | { type: 'reconnect'; sessionCode: string; token: string }
  | { type: 'start_scenario'; scenarioId: string }
  | { type: 'intervene'; interventionId: string }
  | { type: 'update_machine_settings'; settings: MachineSettingsUpdate }
  | { type: 'set_manual_ventilation'; active: boolean }
  | {
      type: 'override'
      mode: 'set_now' | 'set_target'
      values: Partial<Pick<PatientState, 'hr' | 'spo2' | 'etco2' | 'rr' | 'temp' | 'ecgRhythm'>> & {
        nibp?: Partial<PatientState['nibp']>
      }
    }
  | { type: 'clear_trainer_overrides' }
  | { type: 'advance_phase'; phaseId: string }
  | { type: 'clear_forced_phase' }
  | { type: 'inject_event'; text: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end_session' }

export interface RosterEntry {
  id: string
  name: string
  role: SessionRole
}

export type ServerMessage =
  | { type: 'session_created'; sessionCode: string; token: string; role: 'trainer' }
  | { type: 'session_joined'; sessionCode: string; token: string; role: 'trainee' }
  | { type: 'session_info'; sessionCode: string; role: SessionRole; roster: RosterEntry[]; phase: SimulationPhase; scenarioId: string | null }
  | { type: 'event_log_snapshot'; events: string[] }
  | { type: 'state'; snapshot: RemotePatientSnapshot }
  | { type: 'event'; text: string }
  | { type: 'phase_change'; phase: SimulationPhase }
  | { type: 'intervention_log'; text: string }
  | ScenarioMetadataMessage
  | { type: 'error'; code: ErrorCode; message?: string }

export type ErrorCode =
  | 'bad_json'
  | 'unknown_message_type'
  | 'invalid_payload'
  | 'message_too_large'
  | 'not_found'
  | 'unauthorized'
  | 'session_full'
  | 'internal_error'
