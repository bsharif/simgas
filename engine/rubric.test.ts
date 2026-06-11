import { describe, expect, it } from 'vitest'
import { evaluateRubric, findRepeatedActions } from './rubric'
import type { ScenarioRubric } from './scenario'
import type { InterventionEvent } from './physiology'

const rubric: ScenarioRubric = {
  critical_actions: [
    { id: 'adrenaline-*', label: 'Adrenaline', within_sec: 45 },
    { id: 'fluid-bolus', within_sec: 120 },
  ],
  supporting_actions: [
    { id: 'manual-vent' },
  ],
  dangerous_actions: [
    { id: 'propofol', rationale: 'worsens hypotension' },
  ],
}

function events(...entries: Array<[string, number]>): InterventionEvent[] {
  return entries.map(([id, atSec]) => ({ id, atSec }))
}

describe('evaluateRubric', () => {
  it('classifies done, late, and missed critical actions', () => {
    const assessment = evaluateRubric(rubric, events(['adrenaline-10', 30], ['fluid-bolus', 200]))

    const adrenaline = assessment.expected.find(result => result.action.id === 'adrenaline-*')
    const fluids = assessment.expected.find(result => result.action.id === 'fluid-bolus')
    const bagging = assessment.expected.find(result => result.action.id === 'manual-vent')

    expect(adrenaline).toMatchObject({ status: 'done', firstAtSec: 30, kind: 'critical' })
    expect(fluids).toMatchObject({ status: 'late', firstAtSec: 200 })
    expect(bagging).toMatchObject({ status: 'missed', kind: 'supporting' })
  })

  it('flags dangerous actions that were performed', () => {
    const assessment = evaluateRubric(rubric, events(['propofol', 12]))
    expect(assessment.dangerous[0]).toMatchObject({ status: 'performed', firstAtSec: 12 })
    expect(assessment.dangerousPerformed).toBe(1)
  })

  it('computes overall outcome: achieved requires all criticals on time and nothing harmful', () => {
    const allDone = evaluateRubric(rubric, events(['adrenaline-10', 20], ['fluid-bolus', 60]))
    expect(allDone.outcome).toBe('achieved')

    const lateButDone = evaluateRubric(rubric, events(['adrenaline-10', 100], ['fluid-bolus', 60]))
    expect(lateButDone.outcome).toBe('partially-achieved')

    const nothing = evaluateRubric(rubric, [])
    expect(nothing.outcome).toBe('not-achieved')

    const harmful = evaluateRubric(rubric, events(['adrenaline-10', 20], ['fluid-bolus', 60], ['propofol', 30]))
    expect(harmful.outcome).toBe('partially-achieved')
  })

  it('reports time to first critical action', () => {
    const assessment = evaluateRubric(rubric, events(['fluid-bolus', 80], ['adrenaline-1', 35]))
    expect(assessment.timeToFirstCriticalSec).toBe(35)
  })

  it("supports '|' alternation in action ids", () => {
    const altRubric: ScenarioRubric = {
      critical_actions: [{ id: 'metaraminol|ephedrine', within_sec: 60 }],
    }
    expect(evaluateRubric(altRubric, events(['ephedrine', 20])).outcome).toBe('achieved')
    expect(evaluateRubric(altRubric, events(['metaraminol', 20])).outcome).toBe('achieved')
    expect(evaluateRubric(altRubric, events(['adenosine', 20])).outcome).toBe('not-achieved')
  })
})

describe('findRepeatedActions', () => {
  it('surfaces 3+ repeats but ignores manual-vent breaths', () => {
    const repeated = findRepeatedActions(events(
      ['metaraminol', 10], ['metaraminol', 30], ['metaraminol', 50],
      ['manual-vent', 5], ['manual-vent', 6], ['manual-vent', 7], ['manual-vent', 8],
      ['adrenaline-1', 12],
    ))
    expect(repeated).toEqual([{ id: 'metaraminol', count: 3 }])
  })
})
