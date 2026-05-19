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
  check: (
    elapsed: number,
    interventions: string[],
    ctx?: ScenarioContext,
  ) => ScenarioUpdate
}

export interface ScenarioUpdate {
  modifiers: PatientModifier
  events: string[]
  resolved: boolean
  failed: boolean
}
