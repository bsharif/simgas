import type { PatientModifier } from './interventions'

export interface Scenario {
  id: string
  label: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  hints: string[]
  initialModifiers: PatientModifier
  check: (elapsed: number, interventions: string[]) => ScenarioUpdate
}

export interface ScenarioUpdate {
  modifiers: PatientModifier
  events: string[]
  resolved: boolean
  failed: boolean
}
