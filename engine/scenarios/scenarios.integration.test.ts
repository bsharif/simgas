import { describe, it, expect } from 'vitest'
import { ALL_SCENARIOS, SCENARIO_MAP } from './index'
import { createBaselineState, type PatientState } from '../patient'
import { applyModifier, applyDrift } from '../interventions'

/**
 * End-to-end test that the three migrated `.md` scenarios load via the Vite
 * import.meta.glob loader and produce correct phase machines.
 *
 * We don't simulate the engine's full tick loop here — we drive each scenario
 * through key moments and assert the right modifiers + terminal states come
 * out. This is the regression bait for "did the DSL migration preserve
 * behaviour" questions.
 */

function applyScenarioStep(
  scenario: ReturnType<typeof SCENARIO_MAP.get>,
  state: PatientState,
  elapsed: number,
  interventions: string[],
  dtSec: number,
) {
  const r = scenario!.check(elapsed, interventions, { state })
  applyModifier(state, r.modifiers)
  // Match engine semantics: skip drift on the terminal tick so resolve_snap /
  // fail_snap values stick.
  if (!r.resolved && !r.failed) {
    applyDrift(state, dtSec)
  }
  return r
}

describe('scenario loader', () => {
  it('loads all scenarios', () => {
    expect(ALL_SCENARIOS.map(s => s.id).sort()).toEqual([
      'anaphylaxis',
      'bronchospasm',
      'haemorrhagic-shock',
      'high-spinal',
      'laryngospasm',
      'last',
      'malignant-hyperthermia',
      'oesophageal-intubation',
      'svt',
      'tension-pneumothorax',
      'vf-cardiac-arrest',
    ])
  })

  it('SCENARIO_MAP and ALL_SCENARIOS agree', () => {
    for (const s of ALL_SCENARIOS) {
      expect(SCENARIO_MAP.get(s.id)).toBe(s)
    }
  })
})

describe('anaphylaxis scenario', () => {
  it('fails with cardiac arrest when no adrenaline is given before 90s', () => {
    const scenario = SCENARIO_MAP.get('anaphylaxis')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)

    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    expect(lastResult.failed).toBe(false)

    // Drive forward in 1s ticks without any drug.
    for (let t = 1; t <= 100; t++) {
      lastResult = applyScenarioStep(scenario, state, t, [], 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
    expect(state.ecgRhythm).toBe('asystole')
  })

  it('resolves to stable vitals when adrenaline is given early', () => {
    const scenario = SCENARIO_MAP.get('anaphylaxis')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)

    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    expect(lastResult.failed).toBe(false)

    const adrAtT = 15
    let interventions: string[] = []
    for (let t = 1; t <= 250; t++) {
      if (t === adrAtT) interventions = ['adrenaline-10']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(lastResult.failed).toBe(false)
    expect(state.hr).toBe(78)
    expect(state.spo2).toBe(99)
  })
})

describe('oesophageal-intubation scenario', () => {
  it('starts with the tube in the oesophagus', () => {
    const scenario = SCENARIO_MAP.get('oesophageal-intubation')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    expect(state.tubePosition).toBe('oesophagus')
  })

  it('cannot be passed by clicking Intubate while tube is already in', () => {
    // The Intubate intervention's precondition is checked by the engine, not
    // the scenario. Here we just confirm the scenario stays in the "untreated"
    // trajectory unless tubePosition becomes 'trachea'.
    const scenario = SCENARIO_MAP.get('oesophageal-intubation')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    for (let t = 1; t <= 100; t++) {
      // Pretend intubate had no effect on state (engine would block it).
      lastResult = applyScenarioStep(scenario, state, t, ['intubate'], 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
  })

  it('resolves when tube is moved to trachea (e.g. via Re-intubate)', () => {
    const scenario = SCENARIO_MAP.get('oesophageal-intubation')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    for (let t = 1; t <= 80; t++) {
      if (t === 20) {
        // Simulate the engine applying re-intubate's effect.
        state.tubePosition = 'trachea'
        lastResult = applyScenarioStep(scenario, state, t, ['re-intubate'], 1)
      } else {
        lastResult = applyScenarioStep(scenario, state, t, t >= 20 ? ['re-intubate'] : [], 1)
      }
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.etco2).toBeCloseTo(5.0, 5)
  })
})

describe('malignant-hyperthermia scenario', () => {
  it('fails in VF when dantrolene is not given before ~2min', () => {
    const scenario = SCENARIO_MAP.get('malignant-hyperthermia')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    for (let t = 1; t <= 200; t++) {
      lastResult = applyScenarioStep(scenario, state, t, [], 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
    expect(state.ecgRhythm).toBe('vf')
    expect(state.temp).toBe(41.0)
  })

  it('resolves with normal vitals when dantrolene is given', () => {
    const scenario = SCENARIO_MAP.get('malignant-hyperthermia')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 350; t++) {
      if (t === 20) interventions = ['dantrolene']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.temp).toBe(37.0)
  })
})
