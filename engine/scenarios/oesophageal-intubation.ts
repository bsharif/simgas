import type { Scenario } from '../scenario'

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
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: Record<string, unknown> = {}

    const hasReintubated = interventions.includes('re-intubate') || interventions.includes('intubate')
    const hasO2 = interventions.includes('increase-fio2')

    if (elapsed < 10) {
      const p = elapsed / 10
      mods.etco2 = 4.5 - p * 4.0
      if (p > 0.5) events.push('⚠ ETCO₂ dropping rapidly — check tube position')
    } else if (!hasReintubated) {
      mods.etco2 = 0.2
      mods.spo2 = Math.max(99 - ((elapsed - 10) / 45) * 15, 80)
      mods.hr = Math.min(78 + ((elapsed - 10) / 30) * 30, 120)

      if (elapsed > 40) {
        mods.hr = Math.max(120 - ((elapsed - 40) / 50) * 70, 40)
        if (elapsed > 45) events.push('⚠ Bradycardia developing — severe hypoxia')
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
      if (elapsed > 20 && hasReintubated) {
        const recoveryP = Math.min((elapsed - 15) / 15, 1)
        mods.etco2 = 0.2 + recoveryP * 4.8
        mods.spo2 = Math.min(85 + recoveryP * 14, 99)

        if (recoveryP >= 1) {
          return {
            modifiers: { hr: 90, spo2: 99, etco2: 5.0 },
            events: ['✓ ETCO₂ returned — tube correctly placed in trachea'],
            resolved: true,
            failed: false,
          }
        }
      } else {
        mods.etco2 = 0.2
        mods.spo2 = Math.max(99 - ((elapsed - 10) / 60) * 15, 80)

        if (!hasO2 && elapsed > 15) {
          mods.fio2 = 0.5
        }
      }
    }

    return { modifiers: mods, events, resolved: false, failed: false }
  },
}
