import { describe, expect, it } from 'vitest'
import { clampVitalValue, vitalControls } from './vitalControls'

describe('vitalControls', () => {
  it('defines slider-compatible ranges for trainer vital overrides', () => {
    expect(vitalControls.map(control => control.key)).toEqual(['hr', 'spo2', 'etco2', 'rr', 'temp', 'sys', 'dia'])
    expect(vitalControls.find(control => control.key === 'hr')).toMatchObject({ min: 0, max: 250, step: 1 })
    expect(vitalControls.find(control => control.key === 'spo2')).toMatchObject({ min: 0, max: 100, step: 1 })
  })

  it('clamps numeric input to the configured safe range', () => {
    const hr = vitalControls.find(control => control.key === 'hr')
    if (!hr) throw new Error('missing HR control')

    expect(clampVitalValue(hr, 300)).toBe(250)
    expect(clampVitalValue(hr, -10)).toBe(0)
  })
})
