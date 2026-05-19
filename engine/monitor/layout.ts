import type { WaveformBufferKey } from '../patient'

/**
 * Monitor display configuration (Phase 3). Lifts hardcoded JSX in Monitor.tsx
 * into data so users can toggle traces, reorder them, change colors, set
 * alarm thresholds, and add lines like Art / CVP / BIS at runtime — and so
 * scenarios can later request a specific layout.
 */

export type TraceId = 'ecg-ii' | 'pleth' | 'co2' | 'resp' | 'art'

export type NumericId =
  | 'hr' | 'pulse' | 'spo2' | 'rr' | 'temp'
  | 'etco2' | 'fio2' | 'mac'
  | 'art' | 'cvp' | 'bis'

/** Which canvas renderer to use for this trace. */
export type RendererStyle = 'ecg' | 'simple'

export interface MonitorTrace {
  id: TraceId
  /** Which ring buffer on PatientState to read. */
  bufferKey: WaveformBufferKey
  /** Visual style (ECG has a denser grid + sharper baseline drift). */
  rendererStyle: RendererStyle
  color: string
  label: string
  enabled: boolean
}

export interface MonitorNumeric {
  id: NumericId
  label: string
  /** Hex color for the value text. */
  color: string
  enabled: boolean
  alarmLo: number | null
  alarmHi: number | null
  muted: boolean
}

export interface MonitorLayout {
  traces: MonitorTrace[]
  numerics: MonitorNumeric[]
}

export const DEFAULT_LAYOUT: MonitorLayout = {
  traces: [
    { id: 'ecg-ii', bufferKey: 'ecgBuffer',  rendererStyle: 'ecg',    color: '#65f36f', label: 'II',    enabled: true  },
    { id: 'pleth',  bufferKey: 'spo2Buffer', rendererStyle: 'simple', color: '#19c8ff', label: 'Pleth', enabled: true  },
    { id: 'co2',    bufferKey: 'etco2Buffer',rendererStyle: 'simple', color: '#ffd94a', label: 'CO2',   enabled: true  },
    { id: 'resp',   bufferKey: 'respBuffer', rendererStyle: 'simple', color: '#eaf4ff', label: 'Resp',  enabled: true  },
    { id: 'art',    bufferKey: 'artBuffer',  rendererStyle: 'ecg',    color: '#ff5566', label: 'ART',   enabled: false },
  ],
  numerics: [
    { id: 'hr',    label: 'HR',    color: '#65f36f', enabled: true,  alarmLo: 50,   alarmHi: 120,  muted: false },
    { id: 'pulse', label: 'Pulse', color: '#19c8ff', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
    { id: 'spo2',  label: 'SpO2',  color: '#19c8ff', enabled: true,  alarmLo: 92,   alarmHi: 100,  muted: false },
    { id: 'rr',    label: 'RR',    color: '#eaf4ff', enabled: true,  alarmLo: 8,    alarmHi: 35,   muted: false },
    { id: 'temp',  label: 'Temp',  color: '#ff6e6e', enabled: true,  alarmLo: 35.5, alarmHi: 38.5, muted: false },
    { id: 'art',   label: 'ART',   color: '#ff5566', enabled: false, alarmLo: 65,   alarmHi: 180,  muted: false },
    { id: 'cvp',   label: 'CVP',   color: '#9ed5ff', enabled: false, alarmLo: 2,    alarmHi: 16,   muted: false },
    { id: 'bis',   label: 'BIS',   color: '#c4a8ff', enabled: false, alarmLo: 40,   alarmHi: 60,   muted: false },
  ],
}

/** Cardiac-focused preset: ECG, pleth, art line, no respiratory waveform. */
export const PRESET_CARDIAC: MonitorLayout = {
  traces: DEFAULT_LAYOUT.traces.map(t => ({
    ...t,
    enabled: t.id === 'ecg-ii' || t.id === 'pleth' || t.id === 'art',
  })),
  numerics: DEFAULT_LAYOUT.numerics.map(n => ({
    ...n,
    enabled: n.id === 'hr' || n.id === 'pulse' || n.id === 'spo2' || n.id === 'art' || n.id === 'temp',
  })),
}

/** Neuro preset: adds BIS, drops respiratory clutter. */
export const PRESET_NEURO: MonitorLayout = {
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
