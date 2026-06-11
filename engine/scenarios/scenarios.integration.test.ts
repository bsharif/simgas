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
      'air-embolism',
      'anaphylaxis',
      'aspiration',
      'bradycardia',
      'bronchospasm',
      'cico',
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

  it('resolves to stable vitals when the full bundle is given (adrenaline + O2 + fluids)', () => {
    const scenario = SCENARIO_MAP.get('anaphylaxis')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)

    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    expect(lastResult.failed).toBe(false)

    let interventions: string[] = []
    for (let t = 1; t <= 250; t++) {
      if (t === 15) interventions = ['adrenaline-10']
      if (t === 25) {
        // Simulate the engine applying the full bundle.
        interventions = ['adrenaline-10', 'increase-fio2', 'fluid-bolus', 'stop-trigger']
        state.fio2 = 1.0
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(lastResult.failed).toBe(false)
    expect(state.hr).toBe(78)
    expect(state.spo2).toBe(99)
  })

  it('does NOT resolve on adrenaline alone — the bundle is required', () => {
    const scenario = SCENARIO_MAP.get('anaphylaxis')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)

    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 300; t++) {
      if (t === 15) interventions = ['adrenaline-10']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(false)
    expect(lastResult.failed).toBe(false)
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
        // Simulate the engine applying re-intubate's effect + 100% O2.
        state.tubePosition = 'trachea'
        state.fio2 = 1.0
        lastResult = applyScenarioStep(scenario, state, t, ['re-intubate', 'increase-fio2'], 1)
      } else {
        lastResult = applyScenarioStep(scenario, state, t, t >= 20 ? ['re-intubate', 'increase-fio2'] : [], 1)
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

  it('resolves with normal vitals when the bundle is given (dantrolene + O2 + hyperventilation)', () => {
    const scenario = SCENARIO_MAP.get('malignant-hyperthermia')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 350; t++) {
      if (t === 20) {
        interventions = ['dantrolene', 'increase-fio2', 'increase-rr', 'stop-trigger']
        // Simulate the engine applying the machine changes.
        state.fio2 = 1.0
        state.rr = 18
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.temp).toBe(37.0)
  })

  it('does NOT resolve on dantrolene alone — hyperventilation and O2 are part of the bundle', () => {
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
    expect(lastResult.resolved).toBe(false)
    expect(lastResult.failed).toBe(false)
  })

  it('exposes rubric metadata from the scenario frontmatter', () => {
    const scenario = SCENARIO_MAP.get('anaphylaxis')!
    expect(scenario.pack).toBe('Core anaesthetic crises')
    expect(scenario.qrh).toContain('Anaphylaxis')
    expect(scenario.rubric?.critical_actions?.map(action => action.id)).toContain('adrenaline-1|adrenaline-10')
    expect(scenario.rubric?.dangerous_actions?.map(action => action.id)).toContain('propofol')
  })
})

describe('svt escalation and unsynchronised shock', () => {
  it('first adenosine fails (re-entry); second dose resolves', () => {
    const scenario = SCENARIO_MAP.get('svt')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    for (let t = 1; t <= 200; t++) {
      if (t === 5) interventions = ['adenosine']
      if (t === 20) {
        // SVT should have re-initiated by now.
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('svt-recurs')
        expect(state.ecgRhythm).toBe('svt')
        interventions = ['adenosine', 'adenosine']
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.ecgRhythm).toBe('sinus')
  })

  it('an unsynchronised defibrillation induces VF, rescuable with CPR + second shock', () => {
    const scenario = SCENARIO_MAP.get('svt')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    for (let t = 1; t <= 200; t++) {
      if (t === 5) interventions = ['defibrillate']
      if (t === 8) {
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('unsync-shock')
        expect(state.ecgRhythm).toBe('vf')
      }
      if (t === 12) interventions = ['defibrillate', 'cpr', 'defibrillate']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.ecgRhythm).toBe('sinus')
  })
})

describe('tension pneumothorax positive-pressure consequence', () => {
  it('repeated bag breaths before decompression accelerate to arrest', () => {
    const scenario = SCENARIO_MAP.get('tension-pneumothorax')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    for (let t = 1; t <= 120; t++) {
      if (t === 5) interventions = ['manual-vent', 'manual-vent', 'manual-vent']
      if (t === 8) {
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('ppv-deterioration')
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
    expect(state.ecgRhythm).toBe('asystole')
  })
})

describe('laryngospasm escalation', () => {
  it('jaw thrust alone cannot break a complete (SpO2 < 90) spasm; propofol can', () => {
    const scenario = SCENARIO_MAP.get('laryngospasm')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    let sawComplete = false
    for (let t = 1; t <= 300; t++) {
      // Wait for complete obstruction, then try jaw thrust only.
      if (state.spo2 < 88 && !sawComplete) {
        sawComplete = true
        interventions = ['jaw-thrust']
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (sawComplete && interventions.length === 1) {
        // Still stuck in the complete phase despite jaw thrust.
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('complete')
        expect(state.airwayObstructed).toBe(true)
        interventions = ['jaw-thrust', 'propofol']
      }
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(scenario.getRuntimeInfo?.().currentPhaseId === 'recovery' || lastResult.resolved).toBe(true)
  })
})

describe('cico scenario', () => {
  it('fails in hypoxic arrest without front-of-neck access', () => {
    const scenario = SCENARIO_MAP.get('cico')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    for (let t = 1; t <= 200; t++) {
      lastResult = applyScenarioStep(scenario, state, t, ['sga', 'jaw-thrust', 'manual-vent'], 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
    expect(state.ecgRhythm).toBe('asystole')
  })

  it('resolves after cricothyroidotomy on 100% oxygen', () => {
    const scenario = SCENARIO_MAP.get('cico')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = ['call-help', 'increase-fio2', 'sga']
    for (let t = 1; t <= 400; t++) {
      if (t === 50) {
        interventions = [...interventions, 'cricothyroidotomy']
        // Simulate the engine applying the FONA + oxygen effects.
        state.fio2 = 1.0
        state.tubePosition = 'trachea'
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.airwayObstructed).toBe(false)
  })
})

describe('bradycardia scenario', () => {
  it('atropine alone does not resolve — the surgical stimulus must stop', () => {
    const scenario = SCENARIO_MAP.get('bradycardia')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 250; t++) {
      if (t === 10) interventions = ['atropine']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(false)
    expect(lastResult.failed).toBe(false)

    // Stopping the stimulus completes the case.
    scenario.reset?.()
    const state2 = createBaselineState()
    applyModifier(state2, scenario.initialModifiers)
    lastResult = applyScenarioStep(scenario, state2, 0, [], 0)
    interventions = []
    for (let t = 1; t <= 250; t++) {
      if (t === 10) interventions = ['atropine', 'stop-trigger']
      lastResult = applyScenarioStep(scenario, state2, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
  })
})

describe('last lipid escalation', () => {
  it('one intralipid dose stabilises but does not resolve; the second (with source stopped) does', () => {
    const scenario = SCENARIO_MAP.get('last')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    for (let t = 1; t <= 160; t++) {
      if (t === 5) interventions = ['stop-trigger', 'call-help']
      if (t === 16) interventions = [...interventions, 'midazolam']
      if (t === 40) interventions = [...interventions, 'intralipid']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    // 120 seconds in lipid-rescue with a single dose: still running.
    expect(lastResult.resolved).toBe(false)
    expect(lastResult.failed).toBe(false)

    let resolved = false
    const withSecondDose = [...interventions, 'intralipid']
    for (let t = 161; t <= 350; t++) {
      lastResult = applyScenarioStep(scenario, state, t, withSecondDose, 1)
      if (lastResult.resolved) { resolved = true; break }
      if (lastResult.failed) break
    }
    expect(resolved).toBe(true)
  })
})

describe('aspiration scenario', () => {
  it('bagging before suction enters the contaminated trajectory and fails', () => {
    const scenario = SCENARIO_MAP.get('aspiration')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 150; t++) {
      if (t === 10) interventions = ['manual-vent', 'manual-vent']
      if (t === 13) {
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('contaminated')
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.failed) break
    }
    expect(lastResult.failed).toBe(true)
  })

  it('suction → intubate → O2 + PEEP resolves', () => {
    const scenario = SCENARIO_MAP.get('aspiration')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)
    let interventions: string[] = []
    for (let t = 1; t <= 300; t++) {
      if (t === 10) interventions = ['suction']
      if (t === 20) {
        interventions = ['suction', 'intubate', 'increase-fio2', 'peep-up']
        state.tubePosition = 'trachea'
        state.fio2 = 1.0
        state.peep = 10
      }
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
  })
})

describe('vf arrest two-shock requirement', () => {
  it('a single shock leaves the patient in VF; the second achieves ROSC', () => {
    const scenario = SCENARIO_MAP.get('vf-cardiac-arrest')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    let lastResult = applyScenarioStep(scenario, state, 0, [], 0)

    let interventions: string[] = []
    for (let t = 1; t <= 250; t++) {
      if (t === 5) interventions = ['cpr']
      if (t === 10) interventions = ['cpr', 'defibrillate']
      if (t === 15) {
        expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('shocked-once')
        expect(state.ecgRhythm).toBe('vf')
      }
      if (t === 25) interventions = ['cpr', 'defibrillate', 'defibrillate']
      lastResult = applyScenarioStep(scenario, state, t, interventions, 1)
      if (lastResult.resolved || lastResult.failed) break
    }
    expect(lastResult.resolved).toBe(true)
    expect(state.ecgRhythm).toBe('sinus')
  })
})

describe('bronchospasm machine-state predicates', () => {
  it('enters recovery when FiO2 is raised via the machine (no buttons pressed)', () => {
    const scenario = SCENARIO_MAP.get('bronchospasm')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    applyScenarioStep(scenario, state, 0, [], 0)

    // Trainee slides FiO2 to 100% on the machine — a state change, not an
    // intervention button.
    state.fio2 = 1.0
    applyScenarioStep(scenario, state, 5, [], 1)

    expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('recovery')
  })

  it('counts realistic bagging (manual-vent history) as treatment', () => {
    const scenario = SCENARIO_MAP.get('bronchospasm')!
    scenario.reset?.()
    const state = createBaselineState()
    applyModifier(state, scenario.initialModifiers)
    applyScenarioStep(scenario, state, 0, [], 0)

    // The engine records 'manual-vent' for every delivered bag breath.
    applyScenarioStep(scenario, state, 5, ['manual-vent'], 1)

    expect(scenario.getRuntimeInfo?.().currentPhaseId).toBe('recovery')
  })
})
