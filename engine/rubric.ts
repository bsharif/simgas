import type { InterventionEvent } from './physiology'
import type { RubricAction, ScenarioRubric } from './scenario'
import { matchesGlob } from './scenarios/dsl/predicate'

/**
 * Rubric assessment (review Phase 2/3). Compares what the learner actually
 * did — the engine's timestamped intervention history — against the
 * scenario's declared management expectations, and classifies each expected
 * action as done / late / missed, and each dangerous action as avoided /
 * performed. Pure and portable: no React, no DOM.
 */

export type ExpectedActionStatus = 'done' | 'late' | 'missed'
export type DangerousActionStatus = 'avoided' | 'performed'

export interface ExpectedActionResult {
  action: RubricAction
  kind: 'critical' | 'supporting'
  status: ExpectedActionStatus
  /** Seconds from scenario start to the first matching application, if any. */
  firstAtSec: number | null
  /** Total matching applications. */
  count: number
}

export interface DangerousActionResult {
  action: RubricAction
  kind: 'dangerous'
  status: DangerousActionStatus
  firstAtSec: number | null
  count: number
}

export type RubricOutcome = 'achieved' | 'partially-achieved' | 'not-achieved'

export interface RubricAssessment {
  expected: ExpectedActionResult[]
  dangerous: DangerousActionResult[]
  criticalDone: number
  criticalLate: number
  criticalMissed: number
  criticalTotal: number
  dangerousPerformed: number
  /** Seconds to the first critical action of any kind, or null if none given. */
  timeToFirstCriticalSec: number | null
  /**
   * Overall outcome: achieved = every critical action done (on time) and
   * nothing dangerous; partially-achieved = at least half of critical actions
   * done or late; not-achieved otherwise.
   */
  outcome: RubricOutcome
}

/**
 * A rubric action id may be a single id, a glob ('adrenaline-*'), or a list of
 * alternatives separated by '|' ('metaraminol|ephedrine') for "any one of
 * these counts" actions.
 */
function matchEvents(action: RubricAction, events: readonly InterventionEvent[]): InterventionEvent[] {
  const alternatives = action.id.split('|').map(part => part.trim())
  return events.filter(event => alternatives.some(glob => matchesGlob(glob, event.id)))
}

function assessExpected(
  action: RubricAction,
  kind: 'critical' | 'supporting',
  events: readonly InterventionEvent[],
): ExpectedActionResult {
  const matches = matchEvents(action, events)
  if (matches.length === 0) {
    return { action, kind, status: 'missed', firstAtSec: null, count: 0 }
  }
  const firstAtSec = matches[0].atSec
  const late = action.within_sec !== undefined && firstAtSec > action.within_sec
  return { action, kind, status: late ? 'late' : 'done', firstAtSec, count: matches.length }
}

export function evaluateRubric(
  rubric: ScenarioRubric,
  events: readonly InterventionEvent[],
): RubricAssessment {
  const expected: ExpectedActionResult[] = [
    ...(rubric.critical_actions ?? []).map(action => assessExpected(action, 'critical', events)),
    ...(rubric.supporting_actions ?? []).map(action => assessExpected(action, 'supporting', events)),
  ]

  const dangerous: DangerousActionResult[] = (rubric.dangerous_actions ?? []).map(action => {
    const matches = matchEvents(action, events)
    return {
      action,
      kind: 'dangerous',
      status: matches.length > 0 ? 'performed' : 'avoided',
      firstAtSec: matches.length > 0 ? matches[0].atSec : null,
      count: matches.length,
    }
  })

  const critical = expected.filter(result => result.kind === 'critical')
  const criticalDone = critical.filter(result => result.status === 'done').length
  const criticalLate = critical.filter(result => result.status === 'late').length
  const criticalMissed = critical.filter(result => result.status === 'missed').length
  const dangerousPerformed = dangerous.filter(result => result.status === 'performed').length

  const criticalTimes = critical
    .map(result => result.firstAtSec)
    .filter((at): at is number => at !== null)
  const timeToFirstCriticalSec = criticalTimes.length > 0 ? Math.min(...criticalTimes) : null

  let outcome: RubricOutcome
  if (critical.length === 0) {
    outcome = dangerousPerformed > 0 ? 'partially-achieved' : 'achieved'
  } else if (criticalDone === critical.length && dangerousPerformed === 0) {
    outcome = 'achieved'
  } else if (criticalDone + criticalLate >= Math.ceil(critical.length / 2)) {
    outcome = 'partially-achieved'
  } else {
    outcome = 'not-achieved'
  }

  return {
    expected,
    dangerous,
    criticalDone,
    criticalLate,
    criticalMissed,
    criticalTotal: critical.length,
    dangerousPerformed,
    timeToFirstCriticalSec,
    outcome,
  }
}

/** Repeated applications beyond a sensible count, surfaced in the debrief. */
export interface RepeatedActionNote {
  id: string
  count: number
}

/**
 * Find interventions applied 3+ times — usually a sign of "button mashing"
 * rather than deliberate titration. The debrief shows these as discussion
 * points, not failures.
 */
export function findRepeatedActions(events: readonly InterventionEvent[]): RepeatedActionNote[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.id, (counts.get(event.id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([id, count]) => count >= 3 && id !== 'manual-vent')
    .map(([id, count]) => ({ id, count }))
}
