import type { PatientState } from './patient'
import type { MonitorNumeric, NumericId } from './monitor/layout'

/**
 * Alarm priority levels, escalating left → right. The detector returns the
 * highest priority across all active numerics; the audio engine picks the
 * tone pattern from the priority.
 *
 * - red: immediate threat (HR=0, SpO2<85)
 * - yellow: significant deviation that needs attention (HR<50/>120, SpO2<92)
 * - cyan: low-priority advisory (FiO2 low, mild tachy)
 * - none: all numerics within range or muted
 */
export type AlarmPriority = 'none' | 'cyan' | 'yellow' | 'red'

const PRIORITY_RANK: Record<AlarmPriority, number> = {
  none: 0, cyan: 1, yellow: 2, red: 3,
}

export interface AlarmDetectionResult {
  /** Highest-priority alarm currently active. */
  priority: AlarmPriority
  /** Per-numeric breaches (id → priority). Useful for visual highlighting. */
  byNumeric: Map<NumericId, AlarmPriority>
}

function rawValue(id: NumericId, state: PatientState): number | null {
  switch (id) {
    case 'hr':    return state.hr
    case 'pulse': return state.hr
    case 'spo2':  return state.spo2
    case 'rr':    return state.rr
    case 'temp':  return state.temp
    case 'etco2': return state.etco2
    case 'fio2':  return state.fio2 * 100
    case 'mac':   return state.sevoflurane
    case 'art':   return state.art ? state.art.map : null
    case 'cvp':   return state.cvp
    case 'bis':   return state.bis
  }
}

/**
 * Promote a basic in-range/out-of-range check to a priority level. Red zones
 * are "critical" thresholds well past the alarm boundary; yellow is the
 * configured boundary itself; cyan is for thresholds that exist but aren't
 * specifically critical.
 */
function classify(id: NumericId, value: number, numeric: MonitorNumeric): AlarmPriority {
  const { alarmLo, alarmHi } = numeric

  // Critical red zones for life-threatening values.
  if (id === 'hr' && value === 0) return 'red'
  if (id === 'spo2' && value < 85) return 'red'
  if (id === 'etco2' && value < 1) return 'red'
  if (id === 'temp' && value >= 40) return 'red'

  const tooLow = alarmLo !== null && value < alarmLo
  const tooHigh = alarmHi !== null && value > alarmHi

  if (!tooLow && !tooHigh) return 'none'

  // Wider deviation → yellow. Closer to threshold → cyan.
  if (alarmLo !== null && tooLow) {
    const gap = alarmLo - value
    if (gap > Math.abs(alarmLo) * 0.15) return 'yellow'
    return 'cyan'
  }
  if (alarmHi !== null && tooHigh) {
    const gap = value - alarmHi
    if (gap > Math.abs(alarmHi) * 0.15) return 'yellow'
    return 'cyan'
  }
  return 'none'
}

export function detectAlarms(state: PatientState, numerics: readonly MonitorNumeric[]): AlarmDetectionResult {
  const byNumeric = new Map<NumericId, AlarmPriority>()
  let highest: AlarmPriority = 'none'

  // VF is a shockable arrest rhythm — always RED regardless of numeric values.
  if (state.ecgRhythm === 'vf') {
    byNumeric.set('hr', 'red')
    highest = 'red'
  }

  for (const numeric of numerics) {
    if (!numeric.enabled || numeric.muted) continue
    const v = rawValue(numeric.id, state)
    if (v === null) continue
    const p = classify(numeric.id, v, numeric)
    if (p === 'none') continue
    byNumeric.set(numeric.id, p)
    if (PRIORITY_RANK[p] > PRIORITY_RANK[highest]) highest = p
  }

  return { priority: highest, byNumeric }
}
