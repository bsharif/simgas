import { describe, expect, it } from 'vitest'
import { createBaselineState } from '../engine/patient'
import type { SimulationEngine } from '../engine/physiology'
import { serializeState } from './serializeState'

describe('serializeState', () => {
  it('returns compact vitals and metadata without waveform buffers', () => {
    const state = createBaselineState()
    state.hr = 101
    state.spo2 = 94
    state.etco2 = 4.2
    state.rr = 18
    state.temp = 38.1
    state.fio2 = 0.8
    state.vt = 450
    state.peep = 8
    state.gasFlow = 4
    state.sevoflurane = 1.2
    state.manualVentilationActive = true
    state.capnographyShape = 'bronchospasm'
    state.art = { sys: 105, dia: 55, map: 72 }
    state.cvp = 9
    state.bis = 42
    const engine = {
      state,
      phase: 'running',
      elapsedSeconds: 12.5,
    } as SimulationEngine

    const snapshot = serializeState(engine)

    expect(snapshot).toMatchObject({
      hr: 101,
      spo2: 94,
      nibp: { sys: 120, dia: 80, map: 93 },
      art: { sys: 105, dia: 55, map: 72 },
      cvp: 9,
      bis: 42,
      etco2: 4.2,
      rr: 18,
      temp: 38.1,
      fio2: 0.8,
      vt: 450,
      peep: 8,
      gasFlow: 4,
      sevoflurane: 1.2,
      ventilationMode: 'ventilator',
      manualVentilationActive: true,
      ecgRhythm: 'sinus',
      capnographyShape: 'bronchospasm',
      phase: 'running',
      elapsedSeconds: 12.5,
    })
    expect(snapshot).not.toHaveProperty('ecgBuffer')
    expect(snapshot).not.toHaveProperty('spo2Buffer')
    expect(snapshot).not.toHaveProperty('etco2Buffer')
    expect(snapshot).not.toHaveProperty('respBuffer')
    expect(snapshot).not.toHaveProperty('artBuffer')
  })
})
