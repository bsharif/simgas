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
          id: 'stable',
          events: [{ atSec: 5, text: '→ IV antibiotic administered' }],
          baseline: { hr: 78, spo2: 99, nibp: { sys: 120, dia: 80, map: 93 }, etco2: 5 },
        },
        {
          id: 'onset',
          enterWhen: 'time > 5',
          events: [
            { atSec: 10, text: '⚠ HR rising, BP falling — possible anaphylaxis' },
            { atSec: 20, text: '⚠ Bronchospasm — airway pressure rising, SpO₂ dropping' },
          ],
          baseline: { hr: 130, spo2: 88, nibp: { sys: 70, dia: 50, map: 58 }, etco2: 4 },
          snap: { capnographyShape: 'bronchospasm' },
        },
        {
          id: 'untreated',
          enterWhen: "time > 30 && !any('adrenaline-*')",
          failWhen: 'phase_elapsed > 60',
          events: [{ atSec: 30, text: '⚠ Severe hypotension — risk of cardiac arrest' }],
          baseline: { hr: 155, spo2: 70, nibp: { sys: 40, dia: 30, map: 33 }, etco2: 3 },
          snap: { ecgRhythm: 'asystole', hr: 0, spo2: 0, nibp: { sys: 0, dia: 0, map: 0 } },
        },
        {
          id: 'iatrogenic-collapse',
          enterWhen: "any('propofol') && !any('adrenaline-*')",
          failWhen: 'phase_elapsed > 45',
        },
        {
          id: 'recovery',
          enterWhen: "any('adrenaline-*')",
          resolveWhen: "phase_elapsed > 90 && fio2 >= 0.8 && any('fluid-bolus') && any('stop-trigger')",
          baseline: { hr: 85, spo2: 99, nibp: { sys: 125, dia: 78, map: 94 }, etco2: 5 },
          snap: { capnographyShape: 'normal' },
        },
      ],
    })
  })

  it('includes debrief body and rubric in the metadata sent to clients', () => {
    const scenarios = loadScenarios()
    const anaphylaxis = scenarios.find(entry => entry.scenario.id === 'anaphylaxis')

    expect(anaphylaxis?.metadata.debriefBody).toContain('# Anaphylaxis')
    expect(anaphylaxis?.metadata.qrh).toContain('Anaphylaxis')
    expect(anaphylaxis?.metadata.rubric?.critical_actions?.map(action => action.id)).toContain('adrenaline-1|adrenaline-10')
  })
})
