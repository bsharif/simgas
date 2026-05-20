import type { PatientState } from '../../../engine/patient'

export interface WaveformSource {
  state: Pick<PatientState,
    | 'ecgBuffer'
    | 'spo2Buffer'
    | 'etco2Buffer'
    | 'respBuffer'
    | 'artBuffer'
    | 'bufferWritePos'
  >
}
