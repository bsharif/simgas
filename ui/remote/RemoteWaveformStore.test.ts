import { describe, expect, it } from 'vitest'
import { BUFFER_SIZE, createBaselineState } from '../../engine/patient'
import type { RemotePatientSnapshot } from '../../shared/protocol'
import { RemoteWaveformStore } from './RemoteWaveformStore'

function snapshot(overrides: Partial<RemotePatientSnapshot> = {}): RemotePatientSnapshot {
  const state = createBaselineState()
  return {
    hr: state.hr,
    spo2: state.spo2,
    nibp: state.nibp,
    art: state.art,
    cvp: state.cvp,
    bis: state.bis,
    etco2: state.etco2,
    rr: state.rr,
    temp: state.temp,
    fio2: state.fio2,
    vt: state.vt,
    peep: state.peep,
    gasFlow: state.gasFlow,
    sevoflurane: state.sevoflurane,
    ventilationMode: state.ventilationMode,
    manualVentilationActive: state.manualVentilationActive,
    consciousness: state.consciousness,
    ecgRhythm: state.ecgRhythm,
    capnographyShape: state.capnographyShape,
    tubePosition: state.tubePosition,
    phase: 'running',
    elapsedSeconds: 1,
    ...overrides,
  }
}

describe('RemoteWaveformStore', () => {
  it('creates waveform buffers with the standard size', () => {
    const store = new RemoteWaveformStore()

    expect(store.source.state.ecgBuffer).toHaveLength(BUFFER_SIZE)
    expect(store.source.state.spo2Buffer).toHaveLength(BUFFER_SIZE)
    expect(store.source.state.etco2Buffer).toHaveLength(BUFFER_SIZE)
    expect(store.source.state.respBuffer).toHaveLength(BUFFER_SIZE)
    expect(store.source.state.artBuffer).toHaveLength(BUFFER_SIZE)
  })

  it('advances bufferWritePos and writes samples from snapshot values', () => {
    const store = new RemoteWaveformStore()

    store.writeSnapshot(snapshot({ art: { sys: 120, dia: 60, map: 80 }, elapsedSeconds: 2 }), 4)

    expect(store.source.state.bufferWritePos).toBe(4)
    expect(store.source.state.ecgBuffer.some(value => value !== 0)).toBe(true)
    expect(store.source.state.spo2Buffer.some(value => value !== 0)).toBe(true)
    expect(store.source.state.etco2Buffer.some(value => value !== 0)).toBe(true)
    expect(store.source.state.respBuffer.some(value => value !== 0)).toBe(true)
    expect(store.source.state.artBuffer.some(value => value !== 0)).toBe(true)
  })
})
