import { describe, it, expect } from 'vitest'
import { makeDoseLedger, recordDose, canApply } from './doseLedger'
import type { Intervention } from './interventions'

const baseIntervention: Intervention = {
  id: 'test-drug',
  label: 'Test drug',
  category: 'drug',
  description: 'test',
  effect: {},
  durationMs: 0,
  onsetMs: 0,
}

describe('doseLedger', () => {
  it('records doses with count + timestamp', () => {
    const l = makeDoseLedger()
    recordDose(l, 'x', 10)
    recordDose(l, 'x', 15)
    expect(l.get('x')).toEqual({ count: 2, lastAppliedSec: 15 })
  })

  it('allows first application of any intervention', () => {
    const l = makeDoseLedger()
    expect(canApply(l, { ...baseIntervention, cooldownMs: 5000 }, 0)).toEqual({ ok: true })
  })

  it('blocks during cooldown', () => {
    const l = makeDoseLedger()
    const drug = { ...baseIntervention, cooldownMs: 5000 }
    recordDose(l, drug.id, 10)
    const r = canApply(l, drug, 12)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('cooldown')
      if (r.reason === 'cooldown') expect(r.remainingSec).toBeCloseTo(3, 5)
    }
  })

  it('unblocks once cooldown elapses', () => {
    const l = makeDoseLedger()
    const drug = { ...baseIntervention, cooldownMs: 5000 }
    recordDose(l, drug.id, 10)
    expect(canApply(l, drug, 15).ok).toBe(true)
  })

  it('blocks after maxDoses', () => {
    const l = makeDoseLedger()
    const drug = { ...baseIntervention, maxDoses: 2 }
    recordDose(l, drug.id, 0)
    recordDose(l, drug.id, 100)
    const r = canApply(l, drug, 200)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('max-doses')
  })

  it('max-doses takes precedence over cooldown', () => {
    const l = makeDoseLedger()
    const drug = { ...baseIntervention, cooldownMs: 5000, maxDoses: 1 }
    recordDose(l, drug.id, 10)
    // Beyond cooldown but at maxDoses.
    const r = canApply(l, drug, 100)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('max-doses')
  })

  it('allows interventions with no cooldown/maxDoses unconditionally', () => {
    const l = makeDoseLedger()
    recordDose(l, baseIntervention.id, 0)
    recordDose(l, baseIntervention.id, 0.1)
    expect(canApply(l, baseIntervention, 0.2).ok).toBe(true)
  })
})
