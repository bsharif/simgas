import { describe, expect, it } from 'vitest'
import { loadScenarios } from './loadScenarios'

describe('loadScenarios', () => {
  it('loads markdown scenarios and exposes trainer metadata', () => {
    const scenarios = loadScenarios()
    const anaphylaxis = scenarios.find(entry => entry.scenario.id === 'anaphylaxis')

    expect(anaphylaxis).toBeDefined()
    expect(anaphylaxis?.scenario.label).toBe('Anaphylaxis')
    expect(anaphylaxis?.debriefBody).toContain('# Anaphylaxis')
    expect(anaphylaxis?.metadata).toMatchObject({
      type: 'scenario_metadata',
      scenarioId: 'anaphylaxis',
      label: 'Anaphylaxis',
      phases: [
        {
          id: 'onset',
          events: [{ atSec: 10, text: '⚠ HR rising, BP falling — possible anaphylaxis' }],
          baseline: { hr: 130, spo2: 88 },
        },
        {
          id: 'untreated',
          enterWhen: "time > 30 && !any('adrenaline-*')",
          failWhen: 'phase_elapsed > 60',
          events: [{ atSec: 30, text: '⚠ Severe hypotension — risk of cardiac arrest' }],
          snap: { ecgRhythm: 'asystole', hr: 0 },
        },
        {
          id: 'recovery',
          enterWhen: "any('adrenaline-*')",
          resolveWhen: 'phase_elapsed > 90',
          baseline: { hr: 85, spo2: 99 },
          snap: { hr: 78, spo2: 99 },
        },
      ],
    })
  })
})
