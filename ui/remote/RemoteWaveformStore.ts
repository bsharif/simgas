import { BUFFER_SIZE, createBaselineState } from '../../engine/patient'
import {
  generateArterialSample,
  generateECGSample,
  generateETCO2Sample,
  generateRespSample,
  generateSpO2Sample,
} from '../../engine/waveforms'
import type { RemotePatientSnapshot } from '../../shared/protocol'
import type { WaveformSource } from '../components/Monitor/waveformSource'

export class RemoteWaveformStore {
  readonly source: WaveformSource

  constructor() {
    this.source = {
      state: {
        ecgBuffer: new Float32Array(BUFFER_SIZE),
        spo2Buffer: new Float32Array(BUFFER_SIZE),
        etco2Buffer: new Float32Array(BUFFER_SIZE),
        respBuffer: new Float32Array(BUFFER_SIZE),
        artBuffer: new Float32Array(BUFFER_SIZE),
        bufferWritePos: 0,
      },
    }
    // Pre-fill with baseline vitals so the first frame shows waveforms.
    const baseline = createBaselineState()
    this.writeSnapshot({
      hr: baseline.hr,
      spo2: baseline.spo2,
      nibp: baseline.nibp,
      art: null,
      cvp: null,
      bis: null,
      etco2: baseline.etco2,
      rr: baseline.rr,
      temp: baseline.temp,
      fio2: baseline.fio2,
      vt: baseline.vt,
      peep: baseline.peep,
      gasFlow: baseline.gasFlow,
      sevoflurane: baseline.sevoflurane,
      ventilationMode: baseline.ventilationMode,
      manualVentilationActive: false,
      consciousness: baseline.consciousness,
      ecgRhythm: baseline.ecgRhythm,
      capnographyShape: baseline.capnographyShape,
      tubePosition: baseline.tubePosition,
      phase: 'idle' as const,
      elapsedSeconds: 0,
      paused: false,
      currentPhaseId: null,
      completedPhaseIds: [],
      forcedPhaseId: null,
    }, BUFFER_SIZE)
  }

  writeSnapshot(snapshot: RemotePatientSnapshot, sampleCount = 2): void {
    for (let i = 0; i < sampleCount; i++) {
      const t = snapshot.elapsedSeconds + i / Math.max(sampleCount, 1) / 60
      const pos = this.source.state.bufferWritePos

      this.source.state.ecgBuffer[pos] = generateECGSample(t, snapshot.hr, snapshot.ecgRhythm)
      this.source.state.spo2Buffer[pos] = generateSpO2Sample(t, snapshot.hr, snapshot.spo2)
      this.source.state.etco2Buffer[pos] = generateETCO2Sample(t, snapshot.rr, snapshot.etco2, snapshot.capnographyShape)
      this.source.state.respBuffer[pos] = generateRespSample(t, snapshot.rr, snapshot.manualVentilationActive)
      this.source.state.artBuffer[pos] = snapshot.art
        ? generateArterialSample(t, snapshot.hr, snapshot.art.sys, snapshot.art.dia)
        : 0
      this.source.state.bufferWritePos = (pos + 1) % BUFFER_SIZE
    }
  }
}
