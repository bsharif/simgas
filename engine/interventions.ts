import type { PatientState } from './patient'

export type InterventionCategory = 'drug' | 'airway' | 'ventilation' | 'procedure'

export interface PatientModifier {
  hr?: number
  hrDelta?: number
  spo2?: number
  spo2Delta?: number
  nibp?: { sys?: number; dia?: number; map?: number }
  nibpDelta?: { sys?: number; dia?: number; map?: number }
  etco2?: number
  etco2Delta?: number
  rr?: number
  rrDelta?: number
  temp?: number
  tempDelta?: number
  fio2?: number
  vt?: number
  peep?: number
  gasFlow?: number
  sevoflurane?: number
  ventilationMode?: PatientState['ventilationMode']
  manualVentilationActive?: boolean
  ecgRhythm?: string
  consciousness?: string
}

export interface Intervention {
  id: string
  label: string
  category: InterventionCategory
  description: string
  effect: PatientModifier
  durationMs: number
  onsetMs: number
}

export interface ActiveEffect {
  intervention: Intervention
  remainingMs: number
  elapsedMs: number
}

export function createActiveEffect(intervention: Intervention): ActiveEffect {
  return {
    intervention,
    remainingMs: intervention.durationMs,
    elapsedMs: 0,
  }
}

export function applyModifier(state: PatientState, mod: PatientModifier): void {
  if (mod.hr !== undefined) state.hr = mod.hr
  if (mod.hrDelta) state.hr += mod.hrDelta
  if (mod.spo2 !== undefined) state.spo2 = mod.spo2
  if (mod.spo2Delta) state.spo2 += mod.spo2Delta
  if (mod.nibp) {
    if (mod.nibp.sys !== undefined) state.nibp.sys = mod.nibp.sys
    if (mod.nibp.dia !== undefined) state.nibp.dia = mod.nibp.dia
    if (mod.nibp.map !== undefined) state.nibp.map = mod.nibp.map
    else state.nibp.map = Math.round(state.nibp.dia + (state.nibp.sys - state.nibp.dia) / 3)
  }
  if (mod.nibpDelta) {
    if (mod.nibpDelta.sys) state.nibp.sys += mod.nibpDelta.sys
    if (mod.nibpDelta.dia) state.nibp.dia += mod.nibpDelta.dia
    if (mod.nibpDelta.map !== undefined) state.nibp.map += mod.nibpDelta.map
    else state.nibp.map = Math.round(state.nibp.dia + (state.nibp.sys - state.nibp.dia) / 3)
  }
  if (mod.etco2 !== undefined) state.etco2 = mod.etco2
  if (mod.etco2Delta) state.etco2 += mod.etco2Delta
  if (mod.rr !== undefined) state.rr = mod.rr
  if (mod.rrDelta) state.rr += mod.rrDelta
  if (mod.temp !== undefined) state.temp = mod.temp
  if (mod.tempDelta) state.temp += mod.tempDelta
  if (mod.fio2 !== undefined) state.fio2 = mod.fio2
  if (mod.vt !== undefined) state.vt = mod.vt
  if (mod.peep !== undefined) state.peep = mod.peep
  if (mod.gasFlow !== undefined) state.gasFlow = mod.gasFlow
  if (mod.sevoflurane !== undefined) state.sevoflurane = mod.sevoflurane
  if (mod.ventilationMode !== undefined) state.ventilationMode = mod.ventilationMode
  if (mod.manualVentilationActive !== undefined) state.manualVentilationActive = mod.manualVentilationActive
  if (mod.ecgRhythm !== undefined) state.ecgRhythm = mod.ecgRhythm as PatientState['ecgRhythm']
  if (mod.consciousness !== undefined) state.consciousness = mod.consciousness as PatientState['consciousness']
}

export function combineWithBaseline(mod: PatientModifier): PatientModifier {
  return mod
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'adrenaline-1',
    label: 'Adrenaline 1mcg',
    category: 'drug',
    description: 'IV adrenaline 1 microgram',
    effect: { hrDelta: 15, nibpDelta: { sys: 15, map: 10 } },
    durationMs: 120000,
    onsetMs: 5000,
  },
  {
    id: 'adrenaline-10',
    label: 'Adrenaline 10mcg',
    category: 'drug',
    description: 'IV adrenaline 10 micrograms',
    effect: { hrDelta: 30, nibpDelta: { sys: 30, map: 20 } },
    durationMs: 180000,
    onsetMs: 5000,
  },
  {
    id: 'metaraminol',
    label: 'Metaraminol 1mg',
    category: 'drug',
    description: 'IV metaraminol 1mg',
    effect: { nibpDelta: { sys: 25, map: 15 } },
    durationMs: 120000,
    onsetMs: 3000,
  },
  {
    id: 'ephedrine',
    label: 'Ephedrine 3mg',
    category: 'drug',
    description: 'IV ephedrine 3mg',
    effect: { hrDelta: 20, nibpDelta: { sys: 20, map: 12 } },
    durationMs: 90000,
    onsetMs: 3000,
  },
  {
    id: 'propofol',
    label: 'Propofol 50mg',
    category: 'drug',
    description: 'IV propofol 50mg',
    effect: { hrDelta: -5, nibpDelta: { sys: -15, map: -10 }, consciousness: 'unconscious' },
    durationMs: 300000,
    onsetMs: 2000,
  },
  {
    id: 'dantrolene',
    label: 'Dantrolene 2.5mg/kg',
    category: 'drug',
    description: 'IV dantrolene',
    effect: { tempDelta: -0.5 },
    durationMs: 300000,
    onsetMs: 60000,
  },
  {
    id: 'intubate',
    label: 'Intubate',
    category: 'airway',
    description: 'Endotracheal intubation',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 're-intubate',
    label: 'Re-intubate',
    category: 'airway',
    description: 'Re-attempt endotracheal intubation',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'jaw-thrust',
    label: 'Jaw Thrust',
    category: 'airway',
    description: 'Perform jaw thrust manoeuvre',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'guedel',
    label: 'Guedel Airway',
    category: 'airway',
    description: 'Insert oropharyngeal airway',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'sga',
    label: 'SGA Insertion',
    category: 'airway',
    description: 'Insert supraglottic airway device',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'suction',
    label: 'Suction',
    category: 'airway',
    description: 'Suction airway',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'increase-fio2',
    label: '100% O₂',
    category: 'ventilation',
    description: 'Increase FiO₂ to 1.0',
    effect: { fio2: 1.0 },
    durationMs: 0,
    onsetMs: 1000,
  },
  {
    id: 'increase-tv',
    label: '↑ Tidal Volume',
    category: 'ventilation',
    description: 'Increase tidal volume',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'increase-rr',
    label: '↑ RR',
    category: 'ventilation',
    description: 'Increase respiratory rate',
    effect: { rrDelta: 4 },
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'peep-up',
    label: 'PEEP Up',
    category: 'ventilation',
    description: 'Increase PEEP',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'manual-vent',
    label: 'Manual Ventilation',
    category: 'ventilation',
    description: 'Manual bag-valve-mask ventilation',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'fluid-bolus',
    label: 'Fluid Bolus 500mL',
    category: 'procedure',
    description: 'IV fluid bolus 500mL',
    effect: { nibpDelta: { sys: 20, map: 12 } },
    durationMs: 120000,
    onsetMs: 15000,
  },
  {
    id: 'defibrillate',
    label: 'Defibrillate',
    category: 'procedure',
    description: 'Defibrillation 200J biphasic',
    effect: { ecgRhythm: 'sinus' },
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'cpr',
    label: 'Start CPR',
    category: 'procedure',
    description: 'Start chest compressions',
    effect: { nibpDelta: { sys: 30, map: 15 } },
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'chest-decompression',
    label: 'Chest Decompression',
    category: 'procedure',
    description: 'Needle decompression of chest',
    effect: {},
    durationMs: 0,
    onsetMs: 0,
  },
]

export const INTERVENTION_MAP = new Map(INTERVENTIONS.map(i => [i.id, i]))
