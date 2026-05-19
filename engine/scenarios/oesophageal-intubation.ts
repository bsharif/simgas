import type { Scenario } from '../scenario'
import type { PatientModifier } from '../interventions'

export const oesophagealIntubation: Scenario = {
  id: 'oesophageal-intubation',
  label: 'Oesophageal Intubation',
  description: 'After routine intubation, ETCO₂ is falling. Is the tube in the oesophagus?',
  difficulty: 'easy',
  hints: [
    'Watch the capnography trace — is there a plateau?',
    'Check for chest rise and breath sounds',
    'If ETCO₂ is zero, remove the tube and ventilate with 100% O₂',
  ],
  initialModifiers: {
    etco2Delta: -0.5,
    // No CO2 reaching lungs → ETCO2 drifts to ~0.2 kPa.
    baseline: {
      etco2: 0.2,
      spo2: 80,
      hr: 110,
    },
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: PatientModifier = {}

    // Phase 1.5 will replace this with a tube-position state machine; for now
    // we still allow re-intubate (or intubate as a stand-in) to "fix" the tube.
    const hasReintubated = interventions.includes('re-intubate') || interventions.includes('intubate')

    if (elapsed > 5 && elapsed < 6) {
      events.push('⚠ ETCO₂ dropping rapidly — check tube position')
    }

    if (!hasReintubated) {
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
