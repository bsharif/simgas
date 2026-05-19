import type { WaveformBufferKey } from '../patient'

export type TraceId = 'ecg-ii' | 'pleth' | 'co2' | 'resp' | 'art'

export type NumericId =
  | 'hr' | 'pulse' | 'spo2' | 'rr' | 'temp'
  | 'etco2' | 'fio2' | 'mac'
  | 'art' | 'cvp' | 'bis'

export type RendererStyle = 'ecg' | 'simple'

export interface MonitorTrace {
  id: TraceId
  bufferKey: WaveformBufferKey
  rendererStyle: RendererStyle
  color: string
  label: string
  enabled: boolean
  /** Relative height in the band stack flex column. */
  flexWeight: number
}

export interface MonitorNumeric {
  id: NumericId
  label: string
  color: string
  enabled: boolean
  alarmLo: number | null
  alarmHi: number | null
  muted: boolean
}

export interface MonitorLayout {
  traces: MonitorTrace[]
  numerics: MonitorNumeric[]
  /** Whether the NIBP bottom panel is visible. */
  nibpEnabled: boolean
}

/**
 * Maps each trace to the numeric whose value appears on the right side of
 * that band. Not persisted — derived at render time.
 */
export const BAND_PAIRINGS: Readonly<Record<TraceId, NumericId>> = {
  'ecg-ii': 'hr',
  'pleth':  'spo2',
  'co2':    'etco2',
  'resp':   'rr',
  'art':    'art',
}

export const DEFAULT_LAYOUT: MonitorLayout = {
  nibpEnabled: true,
  traces: [
    { id: 'ecg-ii', bufferKey: 'ecgBuffer',   rendererStyle: 'ecg',    color: '#65f36f', label: 'II',    enabled: true,  flexWeight: 3   },
    { id: 'pleth',  bufferKey: 'spo2Buffer',  rendererStyle: 'simple', color: '#19c8ff', label: 'Pleth', enabled: true,  flexWeight: 2.5 },
    { id: 'co2',    bufferKey: 'etco2Buffer', rendererStyle: 'simple', color: '#ffd94a', label: 'CO2',   enabled: true,  flexWeight: 2   },
    { id: 'resp',   bufferKey: 'respBuffer',  rendererStyle: 'simple', color: '#eaf4ff', label: 'Resp',  enabled: true,  flexWeight: 1.5 },
    { id: 'art',    bufferKey: 'artBuffer',   rendererStyle: 'ecg',    color: '#ff5566', label: 'ART',   enabled: false, flexWeight: 2.5 },
  ],
  numerics: [
    { id: 'hr',    label: 'HR',    color: '#65f36f', enabled: true,  alarmLo: 50,   alarmHi: 120,  muted: false },
    { id: 'pulse', label: 'Pulse', color: '#19c8ff', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
    { id: 'spo2',  label: 'SpO2',  color: '#19c8ff', enabled: true,  alarmLo: 92,   alarmHi: 100,  muted: false },
    { id: 'rr',    label: 'RR',    color: '#eaf4ff', enabled: true,  alarmLo: 8,    alarmHi: 35,   muted: false },
    { id: 'etco2', label: 'etCO2', color: '#ffd94a', enabled: true,  alarmLo: 4.0,  alarmHi: 6.5,  muted: false },
    { id: 'temp',  label: 'Temp',  color: '#65f36f', enabled: true,  alarmLo: 35.5, alarmHi: 38.5, muted: false },
    { id: 'art',   label: 'ART',   color: '#ff5566', enabled: false, alarmLo: 65,   alarmHi: 180,  muted: false },
    { id: 'cvp',   label: 'CVP',   color: '#9ed5ff', enabled: false, alarmLo: 2,    alarmHi: 16,   muted: false },
    { id: 'bis',   label: 'BIS',   color: '#c4a8ff', enabled: false, alarmLo: 40,   alarmHi: 60,   muted: false },
    { id: 'fio2',  label: 'FiO2',  color: '#65f36f', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
    { id: 'mac',   label: 'MAC',   color: '#65f36f', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
  ],
}

export const PRESET_CARDIAC: MonitorLayout = {
  nibpEnabled: true,
  traces: DEFAULT_LAYOUT.traces.map(t => ({
    ...t,
    enabled: t.id === 'ecg-ii' || t.id === 'pleth' || t.id === 'art',
  })),
  numerics: DEFAULT_LAYOUT.numerics.map(n => ({
    ...n,
    enabled: n.id === 'hr' || n.id === 'pulse' || n.id === 'spo2' || n.id === 'art' || n.id === 'temp',
  })),
}

export const PRESET_NEURO: MonitorLayout = {
  nibpEnabled: true,
  traces: DEFAULT_LAYOUT.traces.map(t => ({
    ...t,
    enabled: t.id === 'ecg-ii' || t.id === 'pleth' || t.id === 'co2',
  })),
  numerics: DEFAULT_LAYOUT.numerics.map(n => ({
    ...n,
    enabled: n.id === 'hr' || n.id === 'spo2' || n.id === 'etco2' || n.id === 'bis' || n.id === 'temp',
  })),
}

export const PRESETS: Record<string, MonitorLayout> = {
  default: DEFAULT_LAYOUT,
  cardiac: PRESET_CARDIAC,
  neuro: PRESET_NEURO,
}
