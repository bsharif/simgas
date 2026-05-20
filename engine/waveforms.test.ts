import { describe, it, expect } from 'vitest'
import { generateECGSample, generateSpO2Sample, generateETCO2Sample } from './waveforms'

describe('ECG waveform', () => {
  it('generates sinus rhythm peaks', () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      generateECGSample(i * 0.01, 78, 'sinus')
    )
    const maxVal = Math.max(...samples.map(Math.abs))
    expect(maxVal).toBeGreaterThan(0.5)
  })

  it('returns zeros for asystole', () => {
    const samples = Array.from({ length: 50 }, (_, i) =>
      generateECGSample(i * 0.01, 78, 'asystole')
    )
    expect(samples.every(s => s === 0)).toBe(true)
  })

  it('produces fibrillatory pattern for VF', () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      generateECGSample(i * 0.01, 78, 'vf')
    )
    const maxVal = Math.max(...samples.map(Math.abs))
    expect(maxVal).toBeGreaterThan(0.05)
  })
})

describe('SpO2 waveform', () => {
  it('generates samples within valid range', () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      generateSpO2Sample(i * 0.01, 78, 98)
    )
    const maxVal = Math.max(...samples)
    const minVal = Math.min(...samples)
    expect(maxVal).toBeLessThanOrEqual(1.1)
    expect(maxVal).toBeGreaterThan(0.3)
    expect(minVal).toBeGreaterThanOrEqual(-0.1)
  })
})

describe('ETCO2 waveform', () => {
  it('generates capnography shape', () => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      generateETCO2Sample(i * 0.01, 14, 5.0, 'normal')
    )
    const maxVal = Math.max(...samples)
    expect(maxVal).toBeGreaterThan(0.5)
    expect(maxVal).toBeLessThanOrEqual(1.0)
  })

  it('returns flat line for absent shape', () => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      generateETCO2Sample(i * 0.01, 14, 5.0, 'absent')
    )
    expect(samples.every(s => s === 0)).toBe(true)
  })

  it('generates bronchospasm sawtooth during exhalation', () => {
    const normal = Array.from({ length: 200 }, (_, i) =>
      generateETCO2Sample(i * 0.01, 14, 5.0, 'normal')
    )
    const bronchospasm = Array.from({ length: 200 }, (_, i) =>
      generateETCO2Sample(i * 0.01, 14, 5.0, 'bronchospasm')
    )
    const diff = normal.reduce((acc, v, i) => acc + Math.abs(v - bronchospasm[i]), 0)
    expect(diff).toBeGreaterThan(0)
  })
})
