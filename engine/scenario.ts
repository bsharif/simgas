import type { PatientModifier } from './interventions'
import type { PatientState } from './patient'

/**
 * Read-only context passed into `Scenario.check`. Scenarios use this to make
 * decisions based on live engine state (e.g. tube position) rather than only
 * the historical interventions list.
 */
export interface ScenarioContext {
  state: PatientState
  /** Free-play mode: scenario phase machine runs but terminal checks are skipped. */
  freePlay?: boolean
  /** Exam mode: scenario must not emit coaching hints (hints_if_missing). */
  suppressHints?: boolean
}

/** A rubric action the scenario expects (or forbids). */
export interface RubricAction {
  /** Intervention id, or glob (e.g. 'adrenaline-*'). */
  id: string
  /** Human label shown in the debrief. Falls back to the intervention label. */
  label?: string
  /** Expected window (seconds from scenario start) for timely performance. */
  within_sec?: number
  /** Why this action matters — shown in the debrief. */
  rationale?: string
}

/** Clinical-education metadata layered above the phase machine. */
export interface ScenarioRubric {
  learning_objectives?: string[]
  critical_actions?: RubricAction[]
  supporting_actions?: RubricAction[]
  dangerous_actions?: RubricAction[]
  references?: string[]
  guideline_version?: string
  author?: string
  reviewers?: string[]
  last_reviewed?: string
  license?: string
}

export interface Scenario {
  id: string
  label: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  hints: string[]
  initialModifiers: PatientModifier
  /** Markdown body from the scenario file, used by the post-run debrief view. */
  debriefBody?: string
  /** Optional scenario pack this case belongs to (used for grouping in pickers). */
  pack?: string
  /** QRH section reference, e.g. "3-4 Bronchospasm". */
  qrh?: string
  /** Clinical-education rubric used by the debrief and assessment views. */
  rubric?: ScenarioRubric
  check: (
    elapsed: number,
    interventions: string[],
    ctx?: ScenarioContext,
  ) => ScenarioUpdate
  /**
   * Optional hook called by the engine when the scenario starts (or restarts).
   * Lets stateful scenarios (e.g. DSL-interpreted ones with phase state) clear
   * per-run state. The TS-defined scenarios are stateless and don't need this.
   */
  reset?: () => void
  getRuntimeInfo?: () => ScenarioRuntimeInfo
  forcePhase?: (phaseId: string) => boolean
  clearForcedPhase?: () => void
}

export interface ScenarioRuntimeInfo {
  currentPhaseId: string | null
  completedPhaseIds: string[]
  forcedPhaseId: string | null
}

export interface ScenarioUpdate {
  modifiers: PatientModifier
  events: string[]
  resolved: boolean
  failed: boolean
}
