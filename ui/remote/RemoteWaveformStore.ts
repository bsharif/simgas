import { BUFFER_SIZE } from '../../engine/patient'
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
