import { describe, it, expect } from 'vitest'
import { createBaselineState, NORMAL_RANGES } from './patient'

describe('Patient baseline', () => {
  it('creates vitals within normal ranges', () => {
    const state = createBaselineState()
    expect(state.hr).toBeGreaterThanOrEqual(NORMAL_RANGES.hr.min)
    expect(state.hr).toBeLessThanOrEqual(NORMAL_RANGES.hr.max)
    expect(state.spo2).toBeGreaterThanOrEqual(NORMAL_RANGES.spo2.min)
    expect(state.nibp.sys).toBeGreaterThanOrEqual(NORMAL_RANGES.nibp.sys.min)
    expect(state.nibp.sys).toBeLessThanOrEqual(NORMAL_RANGES.nibp.sys.max)
    expect(state.etco2).toBeGreaterThanOrEqual(NORMAL_RANGES.etco2.min)
    expect(state.etco2).toBeLessThanOrEqual(NORMAL_RANGES.etco2.max)
  })

  it('creates buffers of correct size', () => {
    const state = createBaselineState()
    expect(state.ecgBuffer.length).toBe(2048)
    expect(state.spo2Buffer.length).toBe(2048)
    expect(state.etco2Buffer.length).toBe(2048)
  })
})
