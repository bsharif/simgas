import { describe, expect, it } from 'vitest'
import { BUFFER_SIZE, createBaselineState } from '../../engine/patient'
import { SAMPLES_PER_TICK } from '../../engine/waveforms'
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
    paused: false,
    currentPhaseId: null,
    completedPhaseIds: [],
    forcedPhaseId: null,
    ...overrides,
  }
}

describe('RemoteWaveformStore', () => {
  const samplesForElapsed = (elapsedSeconds: number) => Math.round(elapsedSeconds * 60 * SAMPLES_PER_TICK)

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

  it('drops snapshots older than the last elapsed time', () => {
    const store = new RemoteWaveformStore()

    store.writeSnapshot(snapshot({ elapsedSeconds: 0.1 }))
    const writePosAfterFreshSnapshot = store.source.state.bufferWritePos

    store.writeSnapshot(snapshot({ elapsedSeconds: 0.05 }))

    expect(writePosAfterFreshSnapshot).toBe(samplesForElapsed(0.1))
    expect(store.source.state.bufferWritePos).toBe(writePosAfterFreshSnapshot)
  })

  it('does not advance buffers for equal-time snapshots', () => {
    const store = new RemoteWaveformStore()

    store.writeSnapshot(snapshot({ elapsedSeconds: 0.1 }))
    const writePosAfterFirstSnapshot = store.source.state.bufferWritePos

    store.writeSnapshot(snapshot({ elapsedSeconds: 0.1, hr: 140 }))

    expect(writePosAfterFirstSnapshot).toBe(samplesForElapsed(0.1))
    expect(store.source.state.bufferWritePos).toBe(writePosAfterFirstSnapshot)
  })

  it('caps large elapsed gaps to one second of samples', () => {
    const store = new RemoteWaveformStore()

    store.writeSnapshot(snapshot({ elapsedSeconds: 0.1 }))
    store.writeSnapshot(snapshot({ elapsedSeconds: 100 }))

    expect(store.source.state.bufferWritePos).toBe(samplesForElapsed(0.1) + 60 * SAMPLES_PER_TICK)
  })

  it('recovers from a new run with lower elapsed time after explicit reset', () => {
    const store = new RemoteWaveformStore()

    store.writeSnapshot(snapshot({ elapsedSeconds: 10 }))
    store.reset(snapshot({ elapsedSeconds: 0 }))
    store.writeSnapshot(snapshot({ elapsedSeconds: 0.1 }))

    expect(store.source.state.bufferWritePos).toBe(samplesForElapsed(0.1))
  })

  it('prefills reset buffers over real waveform time ending at the snapshot', () => {
    const store = new RemoteWaveformStore()

    store.reset(snapshot({ elapsedSeconds: 20, etco2: 40, rr: 12 }))

    expect(Math.max(...store.source.state.etco2Buffer)).toBeGreaterThan(4)
    expect(Math.min(...store.source.state.etco2Buffer)).toBeLessThan(0.5)
  })
})
