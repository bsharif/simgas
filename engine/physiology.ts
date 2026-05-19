import { type PatientState, createBaselineState, BUFFER_SIZE } from './patient'
import type { Scenario } from './scenario'
import { type Intervention, type ActiveEffect, applyModifier, applyDrift, createActiveEffect } from './interventions'
import { generateECGSample, generateSpO2Sample, generateETCO2Sample, generateRespSample, SAMPLES_PER_TICK } from './waveforms'

export type SimulationPhase = 'idle' | 'running' | 'resolved' | 'failed'

type StateSubscriber = (state: PatientState) => void
type EventSubscriber = (event: string) => void
type PhaseSubscriber = (phase: SimulationPhase) => void

export class SimulationEngine {
  state: PatientState
  private subscribers = new Set<StateSubscriber>()
  private eventSubscribers = new Set<EventSubscriber>()
  private phaseSubscribers = new Set<PhaseSubscriber>()
  private activeEffects: ActiveEffect[] = []
  private activeScenario: Scenario | null = null
  private appliedScenarioModifiers = false
  private elapsedMs = 0
  private rafId: number | null = null
  private lastTimestamp = 0
  private interventions: string[] = []
  private _paused = false
  private _phase: SimulationPhase = 'idle'
  private lastManualBreathMs = 0
  private static readonly MANUAL_BREATH_DEBOUNCE_MS = 600

  constructor() {
    this.state = createBaselineState()
  }

  start(scenario: Scenario): void {
    this.stop()
    this.state = createBaselineState()
    this.elapsedMs = 0
    this.appliedScenarioModifiers = false
    this.activeEffects = []
    this.interventions = []
    this.activeScenario = scenario
    this._paused = false
    this.setPhase('running')

    this.broadcastEvent(`▶ Starting scenario: ${scenario.label}`)
    this.lastTimestamp = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Full teardown — clears scenario and rAF, returns to idle. */
  stop(): void {
    this.cancelTick()
    this.activeScenario = null
    this.setPhase('idle')
  }

  /**
   * Halts the rAF loop but keeps `activeScenario`, `state`, `interventions`,
   * and `elapsedMs` queryable. Used after a scenario resolves or fails so the
   * debrief view (Phase 3) can render the final state.
   */
  private freeze(): void {
    this.cancelTick()
  }

  private cancelTick(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  get paused(): boolean {
    return this._paused
  }

  get phase(): SimulationPhase {
    return this._phase
  }

  togglePause(): void {
    if (this._phase !== 'running') return
    this._paused = !this._paused
    if (!this._paused) {
      this.lastTimestamp = performance.now()
    }
    this.broadcastEvent(this._paused ? '⏸ Paused' : '▶ Resumed')
  }

  get elapsedSeconds(): number {
    return this.elapsedMs / 1000
  }

  get scenario(): Scenario | null {
    return this.activeScenario
  }

  get interventionList(): readonly string[] {
    return this.interventions
  }

  applyIntervention(intervention: Intervention): void {
    if (this._phase !== 'running') return

    if (intervention.precondition && !intervention.precondition(this.state)) {
      if (intervention.preconditionFailureEvent) {
        this.broadcastEvent(intervention.preconditionFailureEvent)
      }
      return
    }

    this.interventions.push(intervention.id)

    if (intervention.durationMs > 0) {
      this.activeEffects.push(createActiveEffect(intervention))
    } else {
      applyModifier(this.state, intervention.effect)
    }

    this.broadcastEvent(`→ ${intervention.label}`)
  }

  updateMachineSettings(settings: Partial<Pick<PatientState, 'fio2' | 'vt' | 'peep' | 'gasFlow' | 'rr' | 'sevoflurane' | 'ventilationMode'>>): void {
    if (settings.fio2 !== undefined) this.state.fio2 = settings.fio2
    if (settings.vt !== undefined) this.state.vt = settings.vt
    if (settings.peep !== undefined) this.state.peep = settings.peep
    if (settings.gasFlow !== undefined) this.state.gasFlow = settings.gasFlow
    if (settings.rr !== undefined) this.state.rr = settings.rr
    if (settings.sevoflurane !== undefined) this.state.sevoflurane = settings.sevoflurane
    if (settings.ventilationMode !== undefined) this.state.ventilationMode = settings.ventilationMode

    const event = Object.entries(settings)
      .map(([key, value]) => `${key} ${typeof value === 'number' ? Number(value.toFixed(2)) : value}`)
      .join(', ')
    this.broadcastEvent(`→ Machine setting: ${event}`)
    this.broadcastState()
  }

  /**
   * Engage or release the manual bag. Press-down counts as one breath; held
   * presses don't repeatedly stack. Releasing the bag does not switch the
   * ventilation mode back to ventilator — the user must do that explicitly
   * via the Machine panel.
   */
  setManualVentilation(active: boolean): void {
    if (active && this.state.ventilationMode !== 'manual') {
      this.state.ventilationMode = 'manual'
    }
    this.state.manualVentilationActive = active

    if (active) {
      const now = performance.now()
      if (now - this.lastManualBreathMs >= SimulationEngine.MANUAL_BREATH_DEBOUNCE_MS) {
        this.lastManualBreathMs = now
        this.applyManualBreath()
      }
    }

    this.broadcastState()
  }

  /**
   * One bag squeeze: SpO2 trends toward an FiO2-derived ceiling, ETCO2 trends
   * toward 5.0 kPa. Small per-breath nudges so several breaths are needed to
   * fully recover hypoxia/hypercapnia — matches realistic bag ventilation.
   */
  private applyManualBreath(): void {
    const spo2Ceiling = 92 + this.state.fio2 * 8 // fio2 0.21 → 93.7; fio2 1.0 → 100
    const spo2Gap = spo2Ceiling - this.state.spo2
    this.state.spo2 = Math.max(0, Math.min(100, this.state.spo2 + spo2Gap * 0.15))

    const etco2Target = 5.0
    const etco2Gap = etco2Target - this.state.etco2
    this.state.etco2 = Math.max(0, Math.min(10, this.state.etco2 + etco2Gap * 0.1))
  }

  subscribe(cb: StateSubscriber): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  onEvent(cb: EventSubscriber): () => void {
    this.eventSubscribers.add(cb)
    return () => this.eventSubscribers.delete(cb)
  }

  onPhaseChange(cb: PhaseSubscriber): () => void {
    this.phaseSubscribers.add(cb)
    return () => this.phaseSubscribers.delete(cb)
  }

  private tick = (timestamp: number): void => {
    if (this._paused) {
      this.lastTimestamp = performance.now()
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    const deltaMs = Math.min(timestamp - this.lastTimestamp, 100)
    this.lastTimestamp = timestamp
    this.elapsedMs += deltaMs

    let scenarioEnded: 'resolved' | 'failed' | null = null

    if (this.activeScenario) {
      if (!this.appliedScenarioModifiers) {
        applyModifier(this.state, this.activeScenario.initialModifiers)
        this.appliedScenarioModifiers = true
      }

      const update = this.activeScenario.check(
        this.elapsedMs / 1000,
        this.interventions,
        { state: this.state },
      )
      applyModifier(this.state, update.modifiers)

      for (const event of update.events) {
        this.broadcastEvent(event)
      }

      if (update.resolved) {
        scenarioEnded = 'resolved'
      } else if (update.failed) {
        scenarioEnded = 'failed'
      }
    }

    // Lerp vitals toward scenario-set targets (Phase 1.4). Drug deltas applied
    // below sit on top of this drift instead of being overwritten by it.
    applyDrift(this.state, deltaMs / 1000)

    const maxEffects = 20
    for (let i = 0; i < this.activeEffects.length && i < maxEffects; i++) {
      const effect = this.activeEffects[i]
      effect.elapsedMs += deltaMs
      effect.remainingMs -= deltaMs

      const onsetProgress = effect.elapsedMs / effect.intervention.onsetMs
      if (onsetProgress >= 1 && effect.elapsedMs - deltaMs < effect.intervention.onsetMs) {
        applyModifier(this.state, effect.intervention.effect)
        this.broadcastEvent(`  ${effect.intervention.label} taking effect`)
      }

      if (effect.remainingMs <= 0) {
        this.activeEffects.splice(i, 1)
        i--
      }
    }

    const elapsedSec = this.elapsedMs / 1000
    for (let i = 0; i < SAMPLES_PER_TICK; i++) {
      const t = elapsedSec + (i / SAMPLES_PER_TICK) * (deltaMs / 1000)
      const ecgVal = generateECGSample(t, this.state.hr, this.state.ecgRhythm)
      const spo2Val = generateSpO2Sample(t, this.state.hr, this.state.spo2)
      const etco2Val = generateETCO2Sample(t, this.state.rr, this.state.etco2, false)
      const respVal = generateRespSample(t, this.state.rr, this.state.manualVentilationActive)

      this.state.ecgBuffer[this.state.bufferWritePos] = ecgVal
      this.state.spo2Buffer[this.state.bufferWritePos] = spo2Val
      this.state.etco2Buffer[this.state.bufferWritePos] = etco2Val
      this.state.respBuffer[this.state.bufferWritePos] = respVal
      this.state.bufferWritePos = (this.state.bufferWritePos + 1) % BUFFER_SIZE
    }

    this.broadcastState()

    if (scenarioEnded) {
      this.broadcastEvent(scenarioEnded === 'resolved' ? '✓ Scenario complete' : '✗ Scenario failed')
      this.setPhase(scenarioEnded)
      this.freeze()
      return
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private broadcastState(): void {
    this.subscribers.forEach(cb => cb(this.state))
  }

  private broadcastEvent(event: string): void {
    this.eventSubscribers.forEach(cb => cb(event))
  }

  private setPhase(next: SimulationPhase): void {
    if (this._phase === next) return
    this._phase = next
    this.phaseSubscribers.forEach(cb => cb(next))
  }
}
