import type { Scenario } from '../scenario'

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
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: Record<string, unknown> = {}

    const hasDantrolene = interventions.includes('dantrolene')

    if (elapsed < 30) {
      const p = elapsed / 30
      mods.etco2 = 6.0 + p * 1.5
      mods.temp = 37.5 + p * 1.0
      mods.hr = Math.min(110 + p * 25, 145)
      if (p > 0.5) events.push('⚠ ETCO₂ and temperature rising — consider malignant hyperthermia')
    } else if (elapsed < 120) {
      if (!hasDantrolene) {
        const p = (elapsed - 30) / 90
        mods.etco2 = 7.5 + p * 3.0
        mods.temp = 38.5 + p * 2.0
        mods.hr = Math.min(135 + p * 25, 160)
        mods.spo2 = Math.max(99 - p * 15, 80)

        if (p > 0.5) {
          events.push('⚠ Critical MH crisis — dantrolene required urgently')
        }
        if (p > 0.8) {
          return {
            modifiers: { ecgRhythm: 'vf', hr: 0, spo2: 0, etco2: 0, temp: 41.0 },
            events: ['❌ Cardiac arrest — untreated malignant hyperthermia'],
            resolved: false,
            failed: true,
          }
        }
      } else {
        const p = Math.min((elapsed - 30) / 180, 1)
        mods.etco2 = 7.5 - p * 2.5
        mods.temp = 38.5 - p * 1.5
        mods.hr = Math.max(135 - p * 45, 85)
        mods.spo2 = Math.min(90 + p * 9, 99)

        if (p > 0.5 && !interventions.includes('increase-rr')) {
          events.push('Consider hyperventilation to reduce ETCO₂')
        }

        if (p >= 1) {
          return {
            modifiers: { hr: 85, spo2: 99, etco2: 5.0, temp: 37.0 },
            events: ['✓ MH crisis controlled — dantrolene effective'],
            resolved: true,
            failed: false,
          }
        }
      }
    } else {
      if (!hasDantrolene) {
        return {
          modifiers: { ecgRhythm: 'vf', hr: 0, spo2: 0, etco2: 0, temp: 41.0 },
          events: ['❌ Cardiac arrest — untreated malignant hyperthermia'],
          resolved: false,
          failed: true,
        }
      }
      const p = Math.min((elapsed - 120) / 120, 1)
      mods.etco2 = 7.5 - p * 2.5
      mods.temp = 38.5 - p * 1.5
      mods.hr = Math.max(135 - p * 45, 85)

      if (p >= 1) {
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
