import { BUFFER_SIZE, createBaselineState } from '../../engine/patient'
import {
  generateArterialSample,
  generateECGSample,
  generateETCO2Sample,
  generateRespSample,
  generateSpO2Sample,
  SAMPLES_PER_TICK,
} from '../../engine/waveforms'
import type { RemotePatientSnapshot } from '../../shared/protocol'
import type { WaveformSource } from '../components/Monitor/waveformSource'

const SAMPLE_DT = 1 / (60 * SAMPLES_PER_TICK)

export class RemoteWaveformStore {
  readonly source: WaveformSource
  // serverElapsedSeconds: last elapsed received from the server (authoritative)
  private serverElapsedSeconds = 0
  // localElapsedSeconds: how far the buffer has actually been written (server + interpolation)
  private localElapsedSeconds = 0
  private lastSnapshotVitals: RemotePatientSnapshot | null = null
  private paused = false
  private lastTickMs = 0
  private rafHandle: ReturnType<typeof requestAnimationFrame> | null = null

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
    const baseline = createBaselineState()
    this.reset({
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
    })
  }

  reset(snapshot?: RemotePatientSnapshot): void {
    this.source.state.ecgBuffer.fill(0)
    this.source.state.spo2Buffer.fill(0)
    this.source.state.etco2Buffer.fill(0)
    this.source.state.respBuffer.fill(0)
    this.source.state.artBuffer.fill(0)
    this.source.state.bufferWritePos = 0
    const elapsed = snapshot?.elapsedSeconds ?? 0
    this.serverElapsedSeconds = elapsed
    this.localElapsedSeconds = elapsed
    if (snapshot) {
      this.lastSnapshotVitals = snapshot
      this.paused = snapshot.paused
      this.writeSamples(snapshot, BUFFER_SIZE, elapsed - BUFFER_SIZE * SAMPLE_DT)
    }
  }

  writeSnapshot(snapshot: RemotePatientSnapshot, sampleCount?: number): void {
    // Reject against the authoritative server elapsed, not the local interpolated position.
    if (snapshot.elapsedSeconds <= this.serverElapsedSeconds) return

    this.lastSnapshotVitals = snapshot
    this.paused = snapshot.paused
    this.serverElapsedSeconds = snapshot.elapsedSeconds

    // Only write samples for the portion the local interpolation hasn't already covered.
    if (snapshot.elapsedSeconds > this.localElapsedSeconds) {
      const delta = snapshot.elapsedSeconds - this.localElapsedSeconds
      const expectedCount = Math.round(delta * 60 * SAMPLES_PER_TICK)
      const cappedCount = Math.min(sampleCount ?? expectedCount, 60 * SAMPLES_PER_TICK)
      if (cappedCount > 0) {
        this.writeSamples(snapshot, cappedCount, this.localElapsedSeconds)
        this.localElapsedSeconds = snapshot.elapsedSeconds
      }
    }
    // else: the local rAF tick has already written past this point — vitals updated, no extra samples.
  }

  startTick(): void {
    if (this.rafHandle !== null) return
    this.lastTickMs = performance.now()
    this.rafHandle = requestAnimationFrame(this.tick)
  }

  stopTick(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }
  }

  // Arrow function so `this` is bound correctly when passed to rAF.
  private tick = (wallMs: number): void => {
    const vitals = this.lastSnapshotVitals
    if (vitals && vitals.phase === 'running' && !this.paused) {
      const dtSec = Math.min((wallMs - this.lastTickMs) / 1000, 0.1)
      const sampleCount = Math.round(dtSec * 60 * SAMPLES_PER_TICK)
      if (sampleCount > 0) {
        this.writeSamples(vitals, sampleCount, this.localElapsedSeconds)
        this.localElapsedSeconds += sampleCount * SAMPLE_DT
      }
    }
    this.lastTickMs = wallMs
    this.rafHandle = requestAnimationFrame(this.tick)
  }

  private writeSamples(snapshot: RemotePatientSnapshot, sampleCount: number, startSeconds: number): void {
    for (let i = 0; i < sampleCount; i++) {
      const t = startSeconds + (i + 1) * SAMPLE_DT
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
