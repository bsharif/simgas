export { anaphylaxis } from './anaphylaxis'
export { oesophagealIntubation } from './oesophageal-intubation'
export { malignantHyperthermia } from './malignant-hyperthermia'

import type { Scenario } from '../scenario'
import { anaphylaxis } from './anaphylaxis'
import { oesophagealIntubation } from './oesophageal-intubation'
import { malignantHyperthermia } from './malignant-hyperthermia'

export const ALL_SCENARIOS: Scenario[] = [
  anaphylaxis,
  oesophagealIntubation,
  malignantHyperthermia,
]

export const SCENARIO_MAP = new Map<string, Scenario>(
  ALL_SCENARIOS.map(s => [s.id, s])
)
