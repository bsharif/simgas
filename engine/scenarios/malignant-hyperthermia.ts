import type { Scenario } from '../scenario'
import type { PatientModifier } from '../interventions'

export const malignantHyperthermia: Scenario = {
  id: 'malignant-hyperthermia',
  label: 'Malignant Hyperthermia',
  description: 'A 22-year-old undergoing general anaesthesia with sevoflurane develops MH crisis.',
  difficulty: 'hard',
  hints: [
    'ETCO₂ rising despite unchanged ventilation — think MH',
    'Stop volatile agents immediately',
    'Give dantrolene, hyperventilate, and start cooling',
  ],
  initialModifiers: {
    hr: 110,
    etco2Delta: 1.0,
    tempDelta: 0.5,
    baseline: {
      hr: 145,
      etco2: 7.5,
      temp: 38.5,
      spo2: 95,
    },
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: PatientModifier = {}

    const hasDantrolene = interventions.includes('dantrolene')

    if (elapsed > 15 && elapsed < 16) {
      events.push('⚠ ETCO₂ and temperature rising — consider malignant hyperthermia')
    }

    if (!hasDantrolene) {
      if (elapsed > 30) {
        // Worsening — push baseline harder.
        mods.baseline = {
          hr: 160,
          etco2: 10.5,
          temp: 40.5,
          spo2: 80,
        }
        if (elapsed > 60 && elapsed < 61) {
          events.push('⚠ Critical MH crisis — dantrolene required urgently')
        }
      }

      if (elapsed > 120) {
        return {
          modifiers: { ecgRhythm: 'vf', hr: 0, spo2: 0, etco2: 0, temp: 41.0 },
          events: ['❌ Cardiac arrest — untreated malignant hyperthermia'],
          resolved: false,
          failed: true,
        }
      }
    } else {
      // Dantrolene effective — pull baseline back to normal.
      mods.baseline = {
        hr: 85,
        etco2: 5.0,
        temp: 37.0,
        spo2: 99,
      }

      if (elapsed > 60 && !interventions.includes('increase-rr') && elapsed < 61) {
        events.push('Consider hyperventilation to reduce ETCO₂')
      }

      if (elapsed > 200) {
        return {
          modifiers: { hr: 85, spo2: 99, etco2: 5.0, temp: 37.0 },
          events: ['✓ MH crisis controlled — dantrolene effective'],
          resolved: true,
          failed: false,
        }
      }
    }

    return { modifiers: mods, events, resolved: false, failed: false }
  },
}
