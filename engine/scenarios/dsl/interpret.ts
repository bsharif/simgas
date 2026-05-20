import type { Scenario, ScenarioContext, ScenarioUpdate } from '../../scenario'
import type { PatientModifier } from '../../interventions'
import {
  type ScenarioSpec,
  type PhaseSpec,
  type Snap,
  type Baseline,
  parseDurationSec,
} from './schema'
import { compilePredicate, type PredicateContext } from './predicate'

/**
 * Convert a parsed ScenarioSpec into the runtime Scenario object that the
 * engine knows how to drive. The interpreter keeps its own internal state
 * (current phase, fired events, completed phases) inside the `check` closure
 * so the engine can stay scenario-agnostic.
 */
export function specToScenario(spec: ScenarioSpec): Scenario {
  // Pre-compile predicates so each tick doesn't re-parse expression strings.
  const compiledPhases = spec.phases.map((phase, idx) => ({
    spec: phase,
    idx,
    enterWhen: phase.enter_when ? compilePredicate(phase.enter_when) : null,
    resolveWhen: phase.resolve_when ? compilePredicate(phase.resolve_when) : null,
    failWhen: phase.fail_when ? compilePredicate(phase.fail_when) : null,
    eventTimes: phase.events.map(e => ({ at: parseDurationSec(e.at), text: e.text })),
  }))

  // Per-run interpreter state (mutated across ticks). Reset on Scenario.reset().
  let currentPhaseIdx: number | null = null
  let phaseEnteredAtSec = 0
  let firedEventTimesForPhase = new Set<number>()
  let hintsFiredForPhase = new Set<string>()
  let completedPhases = new Set<string>()
  let forcedPhaseId: string | null = null
  let terminated = false

  function reset(): void {
    currentPhaseIdx = null
    phaseEnteredAtSec = 0
    firedEventTimesForPhase = new Set()
    hintsFiredForPhase = new Set()
    completedPhases = new Set()
    forcedPhaseId = null
    terminated = false
  }

  function buildPredicateCtx(
    time: number,
    interventions: readonly string[],
    state: ScenarioContext['state'],
  ): PredicateContext {
    return {
      time,
      phaseElapsed: currentPhaseIdx === null ? 0 : time - phaseEnteredAtSec,
      interventions,
      state,
      completedPhases,
    }
  }

  /**
   * Phase selection: "last matching phase wins". Authors list phases from
   * least- to most-specific — `enter_when` predicates carry the conditions for
   * advancement and preemption. The first phase typically omits `enter_when`
   * (defaults to true) so it's always the fallback. Later phases override when
   * their conditions become true (e.g. drug given, tube fixed, timer elapsed).
   */
  function selectActivePhase(ctx: PredicateContext): number | null {
    if (forcedPhaseId) {
      const forcedIdx = compiledPhases.findIndex(phase => phase.spec.id === forcedPhaseId)
      return forcedIdx === -1 ? null : forcedIdx
    }

    let chosen: number | null = null
    for (let i = 0; i < compiledPhases.length; i++) {
      const p = compiledPhases[i]
      const matches = p.enterWhen ? p.enterWhen(ctx) : true
      if (matches) chosen = i
    }
    return chosen
  }

  function applyBaseline(target: PatientModifier, baseline: Baseline | undefined): void {
    if (!baseline) return
    target.baseline = { ...baseline }
  }

  function applySnap(target: PatientModifier, snap: Snap | undefined): void {
    if (!snap) return
    if (snap.hr !== undefined) target.hr = snap.hr
    if (snap.spo2 !== undefined) target.spo2 = snap.spo2
    if (snap.etco2 !== undefined) target.etco2 = snap.etco2
    if (snap.rr !== undefined) target.rr = snap.rr
    if (snap.temp !== undefined) target.temp = snap.temp
    if (snap.nibp) target.nibp = { ...snap.nibp }
    if (snap.ecgRhythm !== undefined) target.ecgRhythm = snap.ecgRhythm
    if (snap.capnographyShape !== undefined) target.capnographyShape = snap.capnographyShape
    if (snap.tubePosition !== undefined) target.tubePosition = snap.tubePosition
    if (snap.fio2 !== undefined) target.fio2 = snap.fio2
    if (snap.sevoflurane !== undefined) target.sevoflurane = snap.sevoflurane
  }

  const initialModifiers: PatientModifier = {}
  applySnap(initialModifiers, spec.initial_state)
  applyBaseline(initialModifiers, spec.initial_baseline)

  function check(
    elapsed: number,
    interventions: string[],
    ctx?: ScenarioContext,
  ): ScenarioUpdate {
    const events: string[] = []
    const mods: PatientModifier = {}

    // Engine always supplies ctx at runtime; we only allow undefined to keep the
    // Scenario interface backwards-compatible with the TS-defined scenarios.
    if (!ctx) {
      return { modifiers: mods, events, resolved: false, failed: false }
    }
    if (terminated) {
      return { modifiers: mods, events, resolved: false, failed: false }
    }

    const predicateCtx = buildPredicateCtx(elapsed, interventions, ctx.state)
    const nextIdx = selectActivePhase(predicateCtx)

    let justEntered = false
    if (nextIdx !== currentPhaseIdx) {
      if (currentPhaseIdx !== null) {
        completedPhases.add(compiledPhases[currentPhaseIdx].spec.id)
      }
      currentPhaseIdx = nextIdx
      phaseEnteredAtSec = elapsed
      firedEventTimesForPhase = new Set()
      hintsFiredForPhase = new Set()
      justEntered = true
    }

    if (currentPhaseIdx === null) {
      return { modifiers: mods, events, resolved: false, failed: false }
    }

    const phase: PhaseSpec = compiledPhases[currentPhaseIdx].spec
    const compiled = compiledPhases[currentPhaseIdx]

    applyBaseline(mods, phase.baseline)
    if (justEntered) applySnap(mods, phase.snap)

    // Re-evaluate predicate ctx with the now-correct phaseElapsed.
    const phaseCtx = buildPredicateCtx(elapsed, interventions, ctx.state)

    // Timed events: fire each event once when phaseElapsed crosses its `at`.
    for (const ev of compiled.eventTimes) {
      if (phaseCtx.phaseElapsed >= ev.at && !firedEventTimesForPhase.has(ev.at)) {
        firedEventTimesForPhase.add(ev.at)
        events.push(ev.text)
      }
    }

    // Hints for missing interventions: fire once per phase if the intervention
    // hasn't been applied (we keep it simple — fire as soon as we're in the
    // phase, the user's restart loop is short).
    for (const [interventionId, hintText] of Object.entries(phase.hints_if_missing ?? {})) {
      if (hintsFiredForPhase.has(interventionId)) continue
      if (!interventions.includes(interventionId)) {
        // Only fire once we've been in the phase a moment, so the UI doesn't
        // get flooded the instant a phase becomes active.
        if (phaseCtx.phaseElapsed >= 1) {
          hintsFiredForPhase.add(interventionId)
          events.push(hintText)
        }
      } else {
        // Mark as "handled" so we don't fire it later if user un-does anything.
        hintsFiredForPhase.add(interventionId)
      }
    }

    // Terminal checks.
    if (compiled.failWhen && compiled.failWhen(phaseCtx)) {
      terminated = true
      forcedPhaseId = null
      for (const text of phase.fail_events ?? []) events.push(text)
      applySnap(mods, phase.fail_snap)
      return { modifiers: mods, events, resolved: false, failed: true }
    }
    if (compiled.resolveWhen && compiled.resolveWhen(phaseCtx)) {
      terminated = true
      forcedPhaseId = null
      for (const text of phase.resolve_events ?? []) events.push(text)
      applySnap(mods, phase.resolve_snap)
      return { modifiers: mods, events, resolved: true, failed: false }
    }

    return { modifiers: mods, events, resolved: false, failed: false }
  }

  function getRuntimeInfo() {
    return {
      currentPhaseId: currentPhaseIdx === null ? null : compiledPhases[currentPhaseIdx].spec.id,
      completedPhaseIds: [...completedPhases],
      forcedPhaseId,
    }
  }

  function forcePhase(phaseId: string): boolean {
    const exists = compiledPhases.some(phase => phase.spec.id === phaseId)
    if (!exists) return false
    forcedPhaseId = phaseId
    return true
  }

  function clearForcedPhase(): void {
    forcedPhaseId = null
  }

  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    difficulty: spec.difficulty,
    hints: spec.hints,
    initialModifiers,
    check,
    reset,
    getRuntimeInfo,
    forcePhase,
    clearForcedPhase,
  }
}
