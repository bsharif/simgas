import { describe, it, expect, beforeEach } from 'vitest'
import { createBaselineState, type PatientState } from '../../patient'
import { specToScenario } from './interpret'
import type { ScenarioSpec } from './schema'
import type { Scenario } from '../../scenario'

// Zod's `.default([])` makes the inferred output type require these arrays/maps
// even when the user omits them in YAML; for the test fixture we spell them in.
const SPEC: ScenarioSpec = {
  id: 'demo',
  label: 'Demo',
  description: 'Test scenario',
  difficulty: 'medium',
  hints: [],
  initial_state: { hr: 100, spo2: 95 },
  initial_baseline: { hr: 130 },
  phases: [
    {
      id: 'onset',
      baseline: { hr: 130 },
      events: [{ at: '5s', text: '⚠ Onset event' }],
      resolve_events: [],
      fail_events: [],
      hints_if_missing: {},
    },
    {
      id: 'untreated',
      enter_when: "time > 30 && !any('drug-*')",
      baseline: { hr: 150 },
      fail_when: 'phase_elapsed > 30',
      fail_events: ['❌ Failed'],
      fail_snap: { ecgRhythm: 'asystole' },
      events: [],
      resolve_events: [],
      hints_if_missing: {},
    },
    {
      id: 'recovery',
      enter_when: "any('drug-*')",
      baseline: { hr: 80 },
      resolve_when: 'phase_elapsed > 20',
      resolve_events: ['✓ Recovered'],
      resolve_snap: { hr: 78 },
      events: [],
      fail_events: [],
      hints_if_missing: { 'extra-care': '💡 Consider extra care' },
    },
  ],
}

describe('specToScenario interpreter', () => {
  let scenario: Scenario
  let state: PatientState

  beforeEach(() => {
    scenario = specToScenario(SPEC)
    state = createBaselineState()
    scenario.reset?.()
  })

  it('enters onset at t=0 and applies its baseline', () => {
    const r = scenario.check(0, [], { state })
    expect(r.resolved).toBe(false)
    expect(r.failed).toBe(false)
    expect(r.modifiers.baseline?.hr).toBe(130)
  })

  it('fires timed events once when phaseElapsed crosses the at-time', () => {
    scenario.check(0, [], { state })
    expect(scenario.check(4, [], { state }).events).not.toContain('⚠ Onset event')
    expect(scenario.check(5.5, [], { state }).events).toContain('⚠ Onset event')
    // Doesn't re-fire on subsequent ticks.
    expect(scenario.check(6, [], { state }).events).not.toContain('⚠ Onset event')
  })

  it('preempts to recovery when drug is given (last-match wins)', () => {
    scenario.check(5, [], { state })
    const r = scenario.check(10, ['drug-a'], { state })
    expect(r.modifiers.baseline?.hr).toBe(80) // recovery baseline
  })

  it('transitions to untreated at t>30 when no drug given', () => {
    scenario.check(5, [], { state })
    const r = scenario.check(31, [], { state })
    expect(r.modifiers.baseline?.hr).toBe(150)
  })

  it('fires fail_when terminal with fail_events and fail_snap', () => {
    scenario.check(5, [], { state })       // onset
    scenario.check(31, [], { state })      // → untreated, phaseEntered=31
    const r = scenario.check(62, [], { state })   // phaseElapsed=31, fail
    expect(r.failed).toBe(true)
    expect(r.resolved).toBe(false)
    expect(r.events).toContain('❌ Failed')
    expect(r.modifiers.ecgRhythm).toBe('asystole')
  })

  it('fires resolve_when terminal with resolve_events and resolve_snap', () => {
    scenario.check(5, [], { state })
    scenario.check(10, ['drug-a'], { state })       // → recovery, phaseEntered=10
    const r = scenario.check(31, ['drug-a'], { state })  // phaseElapsed=21, resolve
    expect(r.resolved).toBe(true)
    expect(r.modifiers.hr).toBe(78)
  })

  it('does nothing further after termination', () => {
    scenario.check(5, [], { state })
    scenario.check(31, [], { state })
    scenario.check(62, [], { state })  // fail
    const r = scenario.check(70, [], { state })
    expect(r.resolved).toBe(false)
    expect(r.failed).toBe(false)
    expect(r.events).toHaveLength(0)
  })

  it('reset() clears interpreter state so the scenario can re-run', () => {
    scenario.check(5, [], { state })
    scenario.check(31, [], { state })
    scenario.check(62, [], { state })  // terminate
    scenario.reset?.()
    const r = scenario.check(0, [], { state })
    expect(r.modifiers.baseline?.hr).toBe(130)
    expect(r.failed).toBe(false)
  })

  it('emits hints_if_missing once per phase after a 1s grace period', () => {
    scenario.check(5, [], { state })
    const r1 = scenario.check(10, ['drug-a'], { state })  // → recovery (phaseElapsed=0)
    // Grace period not yet elapsed at t=10, hint not fired.
    expect(r1.events).not.toContain('💡 Consider extra care')
    // After 1s in phase, hint fires.
    const r2 = scenario.check(11.5, ['drug-a'], { state })
    expect(r2.events).toContain('💡 Consider extra care')
    // And only once.
    const r3 = scenario.check(15, ['drug-a'], { state })
    expect(r3.events).not.toContain('💡 Consider extra care')
  })

  it('initial modifiers merge initial_state and initial_baseline', () => {
    expect(scenario.initialModifiers.hr).toBe(100)
    expect(scenario.initialModifiers.spo2).toBe(95)
    expect(scenario.initialModifiers.baseline?.hr).toBe(130)
  })
})
