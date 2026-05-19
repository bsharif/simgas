import type { Scenario, ScenarioContext } from '../scenario'
import type { PatientModifier } from '../interventions'

export const oesophagealIntubation: Scenario = {
  id: 'oesophageal-intubation',
  label: 'Oesophageal Intubation',
  description: 'After routine intubation, ETCO₂ is falling. Is the tube in the oesophagus?',
  difficulty: 'easy',
  hints: [
    'Watch the capnography trace — is there a plateau?',
    'Check for chest rise and breath sounds',
    'If ETCO₂ is zero, extubate, ventilate with 100% O₂, and re-intubate',
  ],
  initialModifiers: {
    etco2Delta: -0.5,
    // Tube is in the oesophagus — no CO2 exchange.
    tubePosition: 'oesophagus',
    baseline: {
      etco2: 0.2,
      spo2: 80,
      hr: 110,
    },
  },

  check(elapsed: number, _interventions: string[], ctx?: ScenarioContext) {
    const events: string[] = []
    const mods: PatientModifier = {}

    // Success is now reading the live state, not the intervention list — the
    // user must actually have a tube in the trachea (extubate + re-intubate,
    // or use the dedicated re-intubate intervention which forces trachea).
    const tubeFixed = ctx?.state.tubePosition === 'trachea'

    if (elapsed > 5 && elapsed < 6) {
      events.push('⚠ ETCO₂ dropping rapidly — check tube position')
    }

    if (!tubeFixed) {
      // Bradycardia after sustained hypoxia.
      if (elapsed > 40) {
        mods.baseline = { hr: 40, spo2: 70, etco2: 0.2 }
        if (elapsed > 45 && elapsed < 46) {
          events.push('⚠ Bradycardia developing — severe hypoxia')
        }
      }

      if (elapsed > 90) {
        return {
          modifiers: { ecgRhythm: 'asystole', hr: 0, spo2: 0, etco2: 0 },
          events: ['❌ Cardiac arrest due to unrecognised oesophageal intubation'],
          resolved: false,
          failed: true,
        }
      }
    } else {
      // Re-intubated correctly — pull toward normal.
      mods.baseline = {
        hr: 90,
        spo2: 99,
        etco2: 5.0,
      }

      if (elapsed > 30) {
        return {
          modifiers: { hr: 90, spo2: 99, etco2: 5.0 },
          events: ['✓ ETCO₂ returned — tube correctly placed in trachea'],
          resolved: true,
          failed: false,
        }
      }
    }

    return { modifiers: mods, events, resolved: false, failed: false }
  },
}
