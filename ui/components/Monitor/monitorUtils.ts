// ui/components/Monitor/monitorUtils.ts
import type { NumericId } from '../../../engine/monitor/layout'
import type { PatientState } from '../../../engine/patient'

function round(val: number): number {
  return Math.max(0, Math.round(val))
}

export function numericValue(id: NumericId, state: PatientState): string {
  switch (id) {
    case 'hr':    return String(round(state.hr))
    case 'pulse': return String(round(state.hr))
    case 'spo2':  return String(round(state.spo2))
    case 'rr':    return String(round(state.rr))
    case 'temp':  return Math.max(0, state.temp).toFixed(1)
    case 'etco2': return Math.max(0, state.etco2).toFixed(1)
    case 'fio2':  return `${Math.round(state.fio2 * 100)}`
    case 'mac':   return state.sevoflurane.toFixed(1)
    case 'art':   return state.art ? `${round(state.art.sys)}/${round(state.art.dia)}` : '—'
    case 'cvp':   return state.cvp !== null ? String(round(state.cvp)) : '—'
    case 'bis':   return state.bis !== null ? String(round(state.bis)) : '—'
  }
}

/** Returns false for invasive parameters (ART, CVP, BIS) when the line is not yet inserted. */
export function lineIsActive(id: NumericId, state: PatientState): boolean {
  if (id === 'art') return state.art !== null
  if (id === 'cvp') return state.cvp !== null
  if (id === 'bis') return state.bis !== null
  return true
}
