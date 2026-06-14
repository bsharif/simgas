import { type PatientState, createBaselineState, BUFFER_SIZE } from './patient'
import type { Scenario } from './scenario'
import { type Intervention, type ActiveEffect, type PatientModifier, applyModifier, applyDrift, createActiveEffect } from './interventions'
import { type DoseEntry, makeDoseLedger, recordDose, canApply } from './doseLedger'
import { generateECGSample, generateSpO2Sample, generateETCO2Sample, generateRespSample, generateArterialSample, SAMPLES_PER_TICK } from './waveforms'

export type SimulationPhase = 'idle' | 'running' | 'resolved' | 'failed'

/**
 * Learning mode semantics (review Phase 4):
 * - guided: hints shown, scripted terminal conditions active.
 * - exam: no hints during the case; feedback comes from the debrief.
 * - free: sandbox — scripted resolve/fail conditions are skipped entirely.
 */
export type SimulationMode = 'guided' | 'exam' | 'free'

/** Timestamped intervention record, used by the rubric debrief. */
export interface InterventionEvent {
  id: string
  atSec: number
}

/** 1 Hz vitals sample for the debrief timeline replay. */
export interface VitalsSample {
  atSec: number
  hr: number
  spo2: number
  etco2: number
  rr: number
  temp: number
  nibpSys: number
  nibpDia: number
}

/** Cap the history at one hour of samples — far beyond any scenario length. */
const MAX_HISTORY_SAMPLES = 3600

type StateSubscriber = (state: PatientState) => void
type EventSubscriber = (event: string) => void
type PhaseSubscriber = (phase: SimulationPhase) => void
type DoseLedgerSubscriber = (ledger: ReadonlyMap<string, DoseEntry>) => void

interface EngineRuntime {
  now: () => number
  scheduleFrame: (callback: (timestamp: number) => void) => unknown
  cancelFrame: (handle: unknown) => void
}

interface SimulationEngineOptions {
  runtime?: EngineRuntime
  modifierHook?: ModifierHook
  /**
   * Multiplier applied to each tick's elapsed time. Defaults to 1 (real time).
   * Used to fast-forward a scenario (e.g. demos, and E2E tests that need to
   * reach a terminal/debrief state without waiting ~90s of wall-clock).
   */
  timeScale?: number
}

type ModifierHook = (state: PatientState, elapsedSec: number) => PatientModifier | null

const browserRuntime: EngineRuntime = {
  now: () => performance.now(),
  scheduleFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(Number(handle)),
}

export class SimulationEngine {
  state: PatientState
  private subscribers = new Set<StateSubscriber>()
  private eventSubscribers = new Set<EventSubscriber>()
  private phaseSubscribers = new Set<PhaseSubscriber>()
  private doseLedgerSubscribers = new Set<DoseLedgerSubscriber>()
  private activeEffects: ActiveEffect[] = []
  private activeScenario: Scenario | null = null
  private appliedScenarioModifiers = false
  private elapsedMs = 0
  private rafId: unknown | null = null
  private lastTimestamp = 0
  private interventions: string[] = []
  private interventionEvents: InterventionEvent[] = []
  private vitalsHistory: VitalsSample[] = []
  private lastHistorySampleSec = -1
  private doseLedger = makeDoseLedger()
  private _paused = false
  private _phase: SimulationPhase = 'idle'
  private _mode: SimulationMode = 'guided'
  // -Infinity so the very first squeeze always lands, even when the runtime
  // clock starts near zero (tests, fresh page loads).
  private lastManualBreathMs = -Infinity
  private runtime: EngineRuntime
  private modifierHook: ModifierHook | null
  private timeScale: number
  private static readonly MANUAL_BREATH_DEBOUNCE_MS = 600

  constructor(options: SimulationEngineOptions = {}) {
    this.runtime = options.runtime ?? browserRuntime
    this.modifierHook = options.modifierHook ?? null
    this.timeScale = options.timeScale && options.timeScale > 0 ? options.timeScale : 1
    this.state = createBaselineState()
  }

  start(scenario: Scenario): void {
    this.stop()
    this.state = createBaselineState()
    this.elapsedMs = 0
    this.appliedScenarioModifiers = false
    this.activeEffects = []
    this.interventions = []
    this.interventionEvents = []
    this.vitalsHistory = []
    this.lastHistorySampleSec = -1
    this.doseLedger = makeDoseLedger()
    this.activeScenario = scenario
    this._paused = false
    this.lastManualBreathMs = -Infinity
    if (scenario.reset) scenario.reset()
    // Apply initial modifiers eagerly so the prefill uses the correct starting state.
    // The tick loop checks appliedScenarioModifiers and will skip re-applying them.
    applyModifier(this.state, scenario.initialModifiers)
    this.appliedScenarioModifiers = true
    this.prefillBuffers()
    this.setPhase('running')
    this.broadcastDoseLedger()

    this.broadcastEvent(`▶ Starting scenario: ${scenario.label}`)
    this.lastTimestamp = this.runtime.now()
    this.rafId = this.runtime.scheduleFrame(this.tick)
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
      this.runtime.cancelFrame(this.rafId)
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
      this.lastTimestamp = this.runtime.now()
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

  /** Timestamped intervention history for the rubric debrief. */
  getInterventionEvents(): readonly InterventionEvent[] {
    return this.interventionEvents
  }

  /** 1 Hz vitals samples recorded during the run, for timeline replay. */
  getVitalsHistory(): readonly VitalsSample[] {
    return this.vitalsHistory
  }

  get mode(): SimulationMode {
    return this._mode
  }

  /**
   * Set the learning mode. Takes effect on the next tick — exam suppresses
   * scenario hints, free play disables scripted resolve/fail conditions.
   */
  setMode(mode: SimulationMode): void {
    this._mode = mode
  }

  applyIntervention(intervention: Intervention): void {
    if (this._phase !== 'running') return

    if (intervention.precondition && !intervention.precondition(this.state)) {
      if (intervention.preconditionFailureEvent) {
        this.broadcastEvent(intervention.preconditionFailureEvent)
      }
      return
    }

    const elapsedSec = this.elapsedMs / 1000
    const gate = canApply(this.doseLedger, intervention, elapsedSec)
    if (!gate.ok) {
      if (gate.reason === 'cooldown') {
        this.broadcastEvent(`⏱ ${intervention.label} on cooldown (${gate.remainingSec.toFixed(0)}s remaining)`)
      } else {
        this.broadcastEvent(`⛔ ${intervention.label}: max doses reached`)
      }
      return
    }

    this.interventions.push(intervention.id)
    this.interventionEvents.push({ id: intervention.id, atSec: elapsedSec })
    recordDose(this.doseLedger, intervention.id, elapsedSec)

    if (intervention.durationMs > 0) {
      this.activeEffects.push(createActiveEffect(intervention))
    } else {
      applyModifier(this.state, intervention.effect)
    }

    this.broadcastEvent(`→ ${intervention.label}`)
    this.broadcastDoseLedger()
  }

  /** Snapshot of the current dose ledger for UI consumers. */
  getDoseLedger(): ReadonlyMap<string, DoseEntry> {
    return this.doseLedger
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
      const now = this.runtime.now()
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
   *
   * Each delivered breath is also recorded as a 'manual-vent' intervention so
   * scenario predicates (`any('manual-vent')`, `count('manual-vent')`) treat
   * realistic bagging as first-class management, not just the abstract button.
   */
  private applyManualBreath(): void {
    if (this._phase === 'running') {
      const elapsedSec = this.elapsedMs / 1000
      this.interventions.push('manual-vent')
      this.interventionEvents.push({ id: 'manual-vent', atSec: elapsedSec })
      recordDose(this.doseLedger, 'manual-vent', elapsedSec)
      this.broadcastDoseLedger()
    }

    // You cannot bag past a closed glottis: with an obstructed airway
    // (complete laryngospasm, CICO) the squeeze is recorded but no gas moves.
    if (this.state.airwayObstructed) {
      return
    }
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

  onDoseLedgerChange(cb: DoseLedgerSubscriber): () => void {
    this.doseLedgerSubscribers.add(cb)
    return () => this.doseLedgerSubscribers.delete(cb)
  }

  private broadcastDoseLedger(): void {
    this.doseLedgerSubscribers.forEach(cb => cb(this.doseLedger))
  }

  private tick = (timestamp: number): void => {
    if (this._paused) {
      this.lastTimestamp = this.runtime.now()
      this.rafId = this.runtime.scheduleFrame(this.tick)
      return
    }

    // Cap the real frame delta (guards against huge jumps when the tab is
    // backgrounded) before applying the fast-forward multiplier.
    const deltaMs = Math.min(timestamp - this.lastTimestamp, 100) * this.timeScale
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
        {
          state: this.state,
          freePlay: this._mode === 'free',
          suppressHints: this._mode !== 'guided',
        },
      )
      applyModifier(this.state, update.modifiers)

      for (const event of update.events) {
        this.broadcastEvent(event)
      }

      // Free play is a sandbox: scripted terminal conditions never end the run.
      if (this._mode !== 'free') {
        if (update.resolved) {
          scenarioEnded = 'resolved'
        } else if (update.failed) {
          scenarioEnded = 'failed'
        }
      }
    }

    const hookModifier = this.modifierHook?.(this.state, this.elapsedMs / 1000)
    if (hookModifier) {
      applyModifier(this.state, hookModifier)
    }

    // Lerp vitals toward scenario-set targets (Phase 1.4). Drug deltas applied
    // below sit on top of this drift instead of being overwritten by it. Skip
    // on the terminal tick — the scenario's resolve_snap / fail_snap is the
    // intended final state and we don't want drift undoing it.
    if (!scenarioEnded) {
      applyDrift(this.state, deltaMs / 1000)
    }

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

    // Record a 1 Hz vitals sample for the debrief timeline. Also force a
    // sample on the terminal tick so the replay ends on the final state.
    const sampleSec = Math.floor(elapsedSec)
    if ((sampleSec > this.lastHistorySampleSec || scenarioEnded) && this.vitalsHistory.length < MAX_HISTORY_SAMPLES) {
      this.lastHistorySampleSec = sampleSec
      this.vitalsHistory.push({
        atSec: scenarioEnded ? elapsedSec : sampleSec,
        hr: this.state.hr,
        spo2: this.state.spo2,
        etco2: this.state.etco2,
        rr: this.state.rr,
        temp: this.state.temp,
        nibpSys: this.state.nibp.sys,
        nibpDia: this.state.nibp.dia,
      })
    }

    for (let i = 0; i < SAMPLES_PER_TICK; i++) {
      const t = elapsedSec + (i / SAMPLES_PER_TICK) * (deltaMs / 1000)
      const ecgVal = generateECGSample(t, this.state.hr, this.state.ecgRhythm)
      const spo2Val = generateSpO2Sample(t, this.state.hr, this.state.spo2)
      const etco2Val = generateETCO2Sample(t, this.state.rr, this.state.etco2, this.state.capnographyShape)
      const respVal = generateRespSample(t, this.state.rr, this.state.manualVentilationActive)
      const artVal = this.state.art
        ? generateArterialSample(t, this.state.hr, this.state.art.sys, this.state.art.dia)
        : 0

      this.state.ecgBuffer[this.state.bufferWritePos] = ecgVal
      this.state.spo2Buffer[this.state.bufferWritePos] = spo2Val
      this.state.etco2Buffer[this.state.bufferWritePos] = etco2Val
      this.state.respBuffer[this.state.bufferWritePos] = respVal
      this.state.artBuffer[this.state.bufferWritePos] = artVal
      this.state.bufferWritePos = (this.state.bufferWritePos + 1) % BUFFER_SIZE
    }

    this.broadcastState()

    if (scenarioEnded) {
      this.broadcastEvent(scenarioEnded === 'resolved' ? '✓ Scenario complete' : '✗ Scenario failed')
      this.setPhase(scenarioEnded)
      this.freeze()
      return
    }

    this.rafId = this.runtime.scheduleFrame(this.tick)
  }

  private prefillBuffers(): void {
    const dt = 1 / (60 * SAMPLES_PER_TICK)
    for (let i = 0; i < BUFFER_SIZE; i++) {
      const t = i * dt
      this.state.ecgBuffer[this.state.bufferWritePos] =
        generateECGSample(t, this.state.hr, this.state.ecgRhythm)
      this.state.spo2Buffer[this.state.bufferWritePos] =
        generateSpO2Sample(t, this.state.hr, this.state.spo2)
      this.state.etco2Buffer[this.state.bufferWritePos] =
        generateETCO2Sample(t, this.state.rr, this.state.etco2, this.state.capnographyShape)
      this.state.respBuffer[this.state.bufferWritePos] =
        generateRespSample(t, this.state.rr, this.state.manualVentilationActive)
      this.state.artBuffer[this.state.bufferWritePos] = this.state.art
        ? generateArterialSample(t, this.state.hr, this.state.art.sys, this.state.art.dia)
        : 0
      this.state.bufferWritePos = (this.state.bufferWritePos + 1) % BUFFER_SIZE
    }
    // bufferWritePos wraps exactly back to 0 after BUFFER_SIZE increments
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
