import { describe, it, expect } from 'vitest'
import { createBaselineState } from './patient'
import { applyDrift, applyModifier } from './interventions'

describe('applyModifier baseline', () => {
  it('writes baseline fields into state.scenarioBaseline', () => {
    const state = createBaselineState()
    applyModifier(state, { baseline: { hr: 140, spo2: 80, nibp: { sys: 70, dia: 50 } } })
    expect(state.scenarioBaseline.hr).toBe(140)
    expect(state.scenarioBaseline.spo2).toBe(80)
    expect(state.scenarioBaseline.nibp).toEqual({ sys: 70, dia: 50 })
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
    expect(state.scenarioBaseline.hr).toBe(140)
  })
})

describe('applyDrift', () => {
  it('drifts state.hr toward driftBaseline.hr at the configured rate', () => {
    const state = createBaselineState()
    state.hr = 78
    state.driftBaseline.hr = 138
    applyDrift(state, 10) // 10 sec at 0.75 BPM/sec = +7.5
    expect(state.hr).toBeCloseTo(85.5, 5)
  })

  it('snaps to target when remaining gap is less than one step', () => {
    const state = createBaselineState()
    state.hr = 79.5
    state.driftBaseline.hr = 80
    applyDrift(state, 1) // 1 sec at 0.75 BPM/sec = +0.75, gap is 0.5
    expect(state.hr).toBe(80)
  })

  it('does nothing for fields with no drift baseline target', () => {
    const state = createBaselineState()
    state.hr = 78
    applyDrift(state, 5)
    expect(state.hr).toBe(78)
  })

  it('persists drug deltas across drift ticks (regression for Phase 1.4)', () => {
    const state = createBaselineState()
    state.hr = 100
    state.driftBaseline.hr = 130

    applyModifier(state, { hrDelta: 15 })
    expect(state.hr).toBe(115)

    // One sec of drift: gap is 130-115=15, drift step 0.75 → 115.75.
    applyDrift(state, 1)
    expect(state.hr).toBeCloseTo(115.75, 5)
  })

  it('smooths driftBaseline toward scenarioBaseline before drifting state', () => {
    const state = createBaselineState()
    state.hr = 78
    state.scenarioBaseline.hr = 130
    applyDrift(state, 10) // 10 sec of smoothing at 2.0 BPM/sec: +20 toward 130
    // driftBaseline initializes from current state (78), then smooths toward 130
    expect(state.driftBaseline.hr).toBeCloseTo(98, 5)
    expect(state.driftBaseline.hr).toBeLessThan(130)
    // State drifts at 0.75 BPM/sec toward the moving driftBaseline
    expect(state.hr).toBeGreaterThan(78)
    expect(state.hr).toBeLessThan(100)
  })
})
