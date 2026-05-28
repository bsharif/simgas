export type VitalControlKey = 'hr' | 'spo2' | 'etco2' | 'rr' | 'temp' | 'sys' | 'dia'

export interface VitalControlSpec {
  key: VitalControlKey
  label: string
  unit: string
  min: number
  max: number
  step: number
}

export const vitalControls: VitalControlSpec[] = [
  { key: 'hr', label: 'HR', unit: 'bpm', min: 0, max: 250, step: 1 },
  { key: 'spo2', label: 'SpO2', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'etco2', label: 'ETCO2', unit: 'kPa', min: 0, max: 15, step: 0.1 },
  { key: 'rr', label: 'RR', unit: '/min', min: 0, max: 80, step: 1 },
  { key: 'temp', label: 'Temp', unit: 'C', min: 25, max: 45, step: 0.1 },
  { key: 'sys', label: 'Sys', unit: 'mmHg', min: 0, max: 300, step: 1 },
  { key: 'dia', label: 'Dia', unit: 'mmHg', min: 0, max: 200, step: 1 },
]

export function clampVitalValue(control: VitalControlSpec, value: number): number {
  if (!Number.isFinite(value)) return control.min
  return Math.min(control.max, Math.max(control.min, value))
}
