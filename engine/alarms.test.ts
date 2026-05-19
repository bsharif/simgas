import { describe, it, expect } from 'vitest'
import { detectAlarms } from './alarms'
import { createBaselineState } from './patient'
import { DEFAULT_LAYOUT } from './monitor/layout'

describe('detectAlarms', () => {
  it('returns none when all vitals are in range', () => {
    const state = createBaselineState()
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.priority).toBe('none')
    expect(r.byNumeric.size).toBe(0)
  })

  it('classifies modest excursion as cyan', () => {
    const state = createBaselineState()
    state.hr = 122 // alarmHi=120, 1.7% over
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.byNumeric.get('hr')).toBe('cyan')
  })

  it('classifies wide excursion as yellow', () => {
    const state = createBaselineState()
    state.hr = 145
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.byNumeric.get('hr')).toBe('yellow')
    expect(r.priority).toBe('yellow')
  })

  it('classifies SpO2 < 85 as red', () => {
    const state = createBaselineState()
    state.spo2 = 80
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.byNumeric.get('spo2')).toBe('red')
    expect(r.priority).toBe('red')
  })

  it('classifies HR=0 (cardiac arrest) as red', () => {
    const state = createBaselineState()
    state.hr = 0
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.byNumeric.get('hr')).toBe('red')
    expect(r.priority).toBe('red')
  })

  it('ignores disabled numerics', () => {
    const state = createBaselineState()
    state.hr = 0
    const layout = DEFAULT_LAYOUT.numerics.map(n => n.id === 'hr' ? { ...n, enabled: false } : n)
    const r = detectAlarms(state, layout)
    expect(r.byNumeric.has('hr')).toBe(false)
  })

  it('ignores muted numerics', () => {
    const state = createBaselineState()
    state.hr = 0
    const layout = DEFAULT_LAYOUT.numerics.map(n => n.id === 'hr' ? { ...n, muted: true } : n)
    const r = detectAlarms(state, layout)
    expect(r.byNumeric.has('hr')).toBe(false)
  })

  it('picks the highest priority across multiple breaches', () => {
    const state = createBaselineState()
    state.hr = 125  // cyan
    state.spo2 = 70 // red
    const r = detectAlarms(state, DEFAULT_LAYOUT.numerics)
    expect(r.priority).toBe('red')
  })

  it('skips invasive numerics with null state', () => {
    const state = createBaselineState()
    // BIS is enabled in layout if user toggled, but state.bis is null.
    const layout = DEFAULT_LAYOUT.numerics.map(n => n.id === 'bis' ? { ...n, enabled: true } : n)
    const r = detectAlarms(state, layout)
    expect(r.byNumeric.has('bis')).toBe(false)
  })
})
