import { describe, it, expect } from 'vitest'
import { createBaselineState } from './patient'
import { applyDrift, applyModifier } from './interventions'

describe('applyModifier baseline', () => {
  it('writes baseline fields into state.driftBaseline', () => {
    const state = createBaselineState()
    applyModifier(state, { baseline: { hr: 140, spo2: 80, nibp: { sys: 70, dia: 50 } } })
    expect(state.driftBaseline.hr).toBe(140)
    expect(state.driftBaseline.spo2).toBe(80)
    expect(state.driftBaseline.nibp).toEqual({ sys: 70, dia: 50 })
  })

  it('leaves state vitals unchanged when only baseline is set', () => {
    const state = createBaselineState()
    const hrBefore = state.hr
    applyModifier(state, { baseline: { hr: 140 } })
    expect(state.hr).toBe(hrBefore)
  })

  it('applies immediate hrDelta on top of any baseline', () => {
    const state = createBaselineState()
    applyModifier(state, { baseline: { hr: 140 } })
    applyModifier(state, { hrDelta: 15 })
    expect(state.hr).toBe(78 + 15)
    expect(state.driftBaseline.hr).toBe(140) // baseline untouched
  })
})

describe('applyDrift', () => {
  it('drifts state.hr toward baseline.hr at the configured rate', () => {
    const state = createBaselineState()
    state.hr = 78
    state.driftBaseline.hr = 138
    applyDrift(state, 10) // 10 sec at 1 BPM/sec = +10
    expect(state.hr).toBeCloseTo(88, 5)
  })

  it('snaps to target when remaining gap is less than one step', () => {
    const state = createBaselineState()
    state.hr = 79.4
    state.driftBaseline.hr = 80
    applyDrift(state, 1) // 1 sec at 1 BPM/sec = +1, but gap is only 0.6
    expect(state.hr).toBe(80)
  })

  it('does nothing for fields with no baseline target', () => {
    const state = createBaselineState()
    state.hr = 78
    applyDrift(state, 5)
    expect(state.hr).toBe(78)
  })

  it('persists drug deltas across drift ticks (regression for Phase 1.4)', () => {
    // The whole point of drift baseline: scenarios set targets, drugs write
    // immediate deltas, and the two compose rather than overwrite.
    const state = createBaselineState()
    state.hr = 100
    state.driftBaseline.hr = 130 // scenario target

    // Drug bump: +15 BPM (e.g. adrenaline)
    applyModifier(state, { hrDelta: 15 })
    expect(state.hr).toBe(115)

    // One sec of drift: gap is 130-115=15, drift step 1 → 116.
    applyDrift(state, 1)
    expect(state.hr).toBeCloseTo(116, 5)

    // The drug bump persists relative to the trajectory: without the bump,
    // HR would only be at 101 after this second.
  })
})
