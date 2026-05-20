import type { PatientModifier } from './interventions'
import type { PatientState } from './patient'

/**
 * Read-only context passed into `Scenario.check`. Scenarios use this to make
 * decisions based on live engine state (e.g. tube position) rather than only
 * the historical interventions list.
 */
export interface ScenarioContext {
  state: PatientState
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
