export type EcgRhythm = 'sinus' | 'vf' | 'vt' | 'asystole' | 'svt'
export type Consciousness = 'awake' | 'sedated' | 'unconscious'

/**
 * Where the endotracheal tube is currently sitting.
 * - 'none': no tube placed; airway managed by face mask / SGA / nothing.
 * - 'trachea': tube correctly in the trachea (gas exchange working).
 * - 'oesophagus': tube misplaced in the oesophagus (no gas exchange).
 */
export type TubePosition = 'none' | 'trachea' | 'oesophagus'

export interface NibpReading {
  sys: number
  dia: number
  map: number
}

/**
 * Drift targets — the "untreated trajectory" the scenario wants vitals to
 * approach. The engine smoothly lerps each `state.<field>` toward
 * `driftBaseline.<field>` every tick. Drug deltas write to state directly so
 * they persist on top of the drift (Phase 1.4).
 */
export interface DriftBaseline {
  hr?: number
  spo2?: number
  nibp?: { sys?: number; dia?: number; map?: number }
  etco2?: number
  rr?: number
  temp?: number
}

export interface ArterialReading {
  sys: number
  dia: number
  map: number
}

export interface PatientState {
  hr: number
  spo2: number
  nibp: NibpReading
  /**
   * Invasive arterial pressure reading. Null until an arterial line is
   * inserted via the `arterial-line` intervention.
   */
  art: ArterialReading | null
  cvp: number | null
  bis: number | null
  etco2: number
  rr: number
  temp: number
  fio2: number
  vt: number
  peep: number
  gasFlow: number
  sevoflurane: number
  ventilationMode: 'ventilator' | 'manual'
  manualVentilationActive: boolean
  consciousness: Consciousness
  ecgRhythm: EcgRhythm
  tubePosition: TubePosition
  ecgBuffer: Float32Array
  spo2Buffer: Float32Array
  etco2Buffer: Float32Array
  respBuffer: Float32Array
  artBuffer: Float32Array
  bufferWritePos: number
  driftBaseline: DriftBaseline
}

/** Keys on PatientState that hold a waveform ring buffer. */
export type WaveformBufferKey =
  | 'ecgBuffer'
  | 'spo2Buffer'
  | 'etco2Buffer'
  | 'respBuffer'
  | 'artBuffer'

/** Sevoflurane concentration (% vol) that equals 1.0 MAC (population average, ~40 yr). */
export const SEVOFLURANE_MAC_CONCENTRATION = 2.2

export const BUFFER_SIZE = 2048

export const NORMAL_RANGES = {
  hr: { min: 60, max: 100 },
  spo2: { min: 94, max: 100 },
  nibp: { sys: { min: 100, max: 140 }, dia: { min: 60, max: 90 } },
  etco2: { min: 4.5, max: 6.0 },
  rr: { min: 12, max: 20 },
  temp: { min: 36.5, max: 37.5 },
} as const

export function createBaselineState(): PatientState {
  return {
    hr: 78,
    spo2: 99,
    nibp: { sys: 120, dia: 80, map: 93 },
    etco2: 5.0,
    rr: 14,
    temp: 37.0,
    fio2: 0.5,
    vt: 500,
    peep: 5,
    gasFlow: 6,
    sevoflurane: 2.0,
    ventilationMode: 'ventilator',
    manualVentilationActive: false,
    consciousness: 'awake',
    ecgRhythm: 'sinus',
    tubePosition: 'trachea',
    ecgBuffer: new Float32Array(BUFFER_SIZE),
    spo2Buffer: new Float32Array(BUFFER_SIZE),
    etco2Buffer: new Float32Array(BUFFER_SIZE),
    respBuffer: new Float32Array(BUFFER_SIZE),
    artBuffer: new Float32Array(BUFFER_SIZE),
    bufferWritePos: 0,
    art: null,
    cvp: null,
    bis: null,
    driftBaseline: {},
  }
}
