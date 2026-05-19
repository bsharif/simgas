import type { Intervention } from './interventions'

/**
 * Per-intervention dose history. Tracks how many times each intervention id
 * has been applied during the current scenario run, and when it was last
 * applied. Combined with `cooldownMs` and `maxDoses` on the intervention,
 * lets the engine block unsafe rapid-fire dosing.
 *
 * Reset on each Scenario.start().
 */
export interface DoseEntry {
  count: number
  lastAppliedSec: number
}

export function makeDoseLedger(): Map<string, DoseEntry> {
  return new Map()
}

export function recordDose(
  ledger: Map<string, DoseEntry>,
  id: string,
  elapsedSec: number,
): void {
  const existing = ledger.get(id)
  if (existing) {
    existing.count++
    existing.lastAppliedSec = elapsedSec
  } else {
    ledger.set(id, { count: 1, lastAppliedSec: elapsedSec })
  }
}

export type CanApplyResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown'; remainingSec: number }
  | { ok: false; reason: 'max-doses' }

export function canApply(
  ledger: ReadonlyMap<string, DoseEntry>,
  intervention: Intervention,
  elapsedSec: number,
): CanApplyResult {
  const entry = ledger.get(intervention.id)
  if (!entry) return { ok: true }
  if (intervention.maxDoses !== undefined && entry.count >= intervention.maxDoses) {
    return { ok: false, reason: 'max-doses' }
  }
  if (intervention.cooldownMs !== undefined && intervention.cooldownMs > 0) {
    const elapsedSinceLast = (elapsedSec - entry.lastAppliedSec) * 1000
    if (elapsedSinceLast < intervention.cooldownMs) {
      return {
        ok: false,
        reason: 'cooldown',
        remainingSec: (intervention.cooldownMs - elapsedSinceLast) / 1000,
      }
    }
  }
  return { ok: true }
}
