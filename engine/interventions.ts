import type { PatientState, DriftBaseline, TubePosition, ArterialReading } from './patient'

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
  tubePosition?: TubePosition
  /** Insert / remove invasive monitoring. null clears the reading. */
  art?: ArterialReading | null
  cvp?: number | null
  bis?: number | null
  /**
   * Drift targets. When set, the engine smoothly lerps `state.<field>` toward
   * the corresponding `baseline.<field>` each tick (Phase 1.4). Use this for
   * scenario-driven physiology trajectories. Immediate fields above (`hr`,
   * `hrDelta`, etc.) write to `state` directly and sit on top of the drift.
   */
  baseline?: DriftBaseline
}

export interface Intervention {
  id: string
  label: string
  category: InterventionCategory
  description: string
  effect: PatientModifier
  durationMs: number
  onsetMs: number
  /**
   * Optional gate evaluated by the engine before the effect applies. If it
   * returns false, the engine fires `preconditionFailureEvent` and does NOT
   * record the intervention in its history.
   */
  precondition?: (state: PatientState) => boolean
  preconditionFailureEvent?: string
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
  if (mod.tubePosition !== undefined) state.tubePosition = mod.tubePosition
  if (mod.art !== undefined) state.art = mod.art === null ? null : { ...mod.art }
  if (mod.cvp !== undefined) state.cvp = mod.cvp
  if (mod.bis !== undefined) state.bis = mod.bis

  if (mod.baseline) {
    const dst = state.driftBaseline
    const src = mod.baseline
    if (src.hr !== undefined) dst.hr = src.hr
    if (src.spo2 !== undefined) dst.spo2 = src.spo2
    if (src.etco2 !== undefined) dst.etco2 = src.etco2
    if (src.rr !== undefined) dst.rr = src.rr
    if (src.temp !== undefined) dst.temp = src.temp
    if (src.nibp) {
      if (!dst.nibp) dst.nibp = {}
      if (src.nibp.sys !== undefined) dst.nibp.sys = src.nibp.sys
      if (src.nibp.dia !== undefined) dst.nibp.dia = src.nibp.dia
      if (src.nibp.map !== undefined) dst.nibp.map = src.nibp.map
    }
  }
}

/**
 * Lerp each vital toward its drift target. Constant rates per second so
 * scenario phases reach their targets in predictable times (e.g. HR target 130
 * from baseline 78 with rate 1.0 BPM/sec reaches target in ~52s).
 */
const DRIFT_RATE_PER_SEC = {
  hr: 1.0,        // BPM/sec
  spo2: 0.5,      // %/sec
  etco2: 0.05,    // kPa/sec
  rr: 0.5,        // breaths/min/sec
  temp: 0.02,     // °C/sec
  nibpSys: 1.0,   // mmHg/sec
  nibpDia: 0.7,   // mmHg/sec
} as const

function driftToward(current: number, target: number, ratePerSec: number, dtSec: number): number {
  const gap = target - current
  const maxStep = ratePerSec * dtSec
  if (Math.abs(gap) <= maxStep) return target
  return current + Math.sign(gap) * maxStep
}

export function applyDrift(state: PatientState, dtSec: number): void {
  const b = state.driftBaseline
  if (b.hr !== undefined) state.hr = driftToward(state.hr, b.hr, DRIFT_RATE_PER_SEC.hr, dtSec)
  if (b.spo2 !== undefined) state.spo2 = driftToward(state.spo2, b.spo2, DRIFT_RATE_PER_SEC.spo2, dtSec)
  if (b.etco2 !== undefined) state.etco2 = driftToward(state.etco2, b.etco2, DRIFT_RATE_PER_SEC.etco2, dtSec)
  if (b.rr !== undefined) state.rr = driftToward(state.rr, b.rr, DRIFT_RATE_PER_SEC.rr, dtSec)
  if (b.temp !== undefined) state.temp = driftToward(state.temp, b.temp, DRIFT_RATE_PER_SEC.temp, dtSec)
  if (b.nibp) {
    if (b.nibp.sys !== undefined) state.nibp.sys = driftToward(state.nibp.sys, b.nibp.sys, DRIFT_RATE_PER_SEC.nibpSys, dtSec)
    if (b.nibp.dia !== undefined) state.nibp.dia = driftToward(state.nibp.dia, b.nibp.dia, DRIFT_RATE_PER_SEC.nibpDia, dtSec)
    state.nibp.map = b.nibp.map !== undefined
      ? driftToward(state.nibp.map, b.nibp.map, DRIFT_RATE_PER_SEC.nibpSys, dtSec)
      : Math.round(state.nibp.dia + (state.nibp.sys - state.nibp.dia) / 3)
  }
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
    effect: { tubePosition: 'trachea' },
    durationMs: 0,
    onsetMs: 0,
    precondition: (s) => s.tubePosition === 'none',
    preconditionFailureEvent: '⚠ Tube already in place — extubate first',
  },
  {
    id: 're-intubate',
    label: 'Re-intubate',
    category: 'airway',
    description: 'Re-attempt endotracheal intubation (extubates first if needed)',
    effect: { tubePosition: 'trachea' },
    durationMs: 0,
    onsetMs: 0,
  },
  {
    id: 'extubate',
    label: 'Extubate',
    category: 'airway',
    description: 'Remove the endotracheal tube',
    effect: { tubePosition: 'none' },
    durationMs: 0,
    onsetMs: 0,
    precondition: (s) => s.tubePosition !== 'none',
    preconditionFailureEvent: '⚠ No tube to extubate',
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
  {
    id: 'arterial-line',
    label: 'Insert Art Line',
    category: 'procedure',
    description: 'Insert radial arterial line for invasive BP monitoring',
    effect: { art: { sys: 125, dia: 78, map: 94 } },
    durationMs: 0,
    onsetMs: 0,
    precondition: (s) => s.art === null,
    preconditionFailureEvent: '⚠ Arterial line already in place',
  },
  {
    id: 'cvp-line',
    label: 'Insert CVP Line',
    category: 'procedure',
    description: 'Insert central venous catheter',
    effect: { cvp: 8 },
    durationMs: 0,
    onsetMs: 0,
    precondition: (s) => s.cvp === null,
    preconditionFailureEvent: '⚠ Central line already in place',
  },
  {
    id: 'bis-monitor',
    label: 'Attach BIS Monitor',
    category: 'procedure',
    description: 'Apply bispectral index forehead electrodes',
    effect: { bis: 45 },
    durationMs: 0,
    onsetMs: 0,
    precondition: (s) => s.bis === null,
    preconditionFailureEvent: '⚠ BIS monitor already attached',
  },
]

export const INTERVENTION_MAP = new Map(INTERVENTIONS.map(i => [i.id, i]))
