import type { Scenario } from '../scenario'

export const anaphylaxis: Scenario = {
  id: 'anaphylaxis',
  label: 'Anaphylaxis',
  description: 'A 35-year-old develops sudden anaphylaxis after IV antibiotic administration.',
  difficulty: 'medium',
  hints: [
    'Check the airway — bronchospasm may be present',
    'Give adrenaline early — it is the first-line treatment',
    'Fluids and high-flow oxygen are also key',
  ],
  initialModifiers: {
    hr: 120,
    spo2: 92,
    nibpDelta: { sys: -50, map: -35 },
    etco2Delta: -0.5,
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: Record<string, unknown> = {}

    const hasAdrenaline = interventions.includes('adrenaline-1') || interventions.includes('adrenaline-10')
    const hasFluids = interventions.includes('fluid-bolus')
    const hasO2 = interventions.includes('increase-fio2')

    if (elapsed < 30) {
      const progress = elapsed / 30
      const sys = 70 - progress * 50
      const map = 58 - progress * 35
      mods.nibp = { sys, dia: 50, map }
      mods.hr = Math.min(78 + progress * 45, 130)
      mods.spo2 = Math.max(99 - progress * 8, 88)
      if (elapsed > 10) events.push('⚠ HR rising, BP falling — possible anaphylaxis')
    } else if (elapsed < 90) {
      if (!hasAdrenaline) {
        const p = (elapsed - 30) / 60
        mods.nibp = { sys: 70 - p * 30, dia: 45 - p * 10, map: 58 - p * 20 }
        mods.hr = Math.min(130 + p * 20, 155)
        mods.spo2 = Math.max(88 - p * 15, 70)
        if (p > 0.3) events.push('⚠ Severe hypotension — risk of cardiac arrest')
      } else {
        const p = Math.min((elapsed - 30) / 60, 1)
        mods.nibp = { sys: 70 + p * 60, dia: 45 + p * 30, map: 58 + p * 40 }
        mods.hr = Math.max(130 - p * 40, 80)
        mods.spo2 = Math.min(88 + p * 12, 100)
        if (!hasO2 && p > 0.5) events.push('Consider high-flow oxygen')
        if (!hasFluids && p > 0.7) events.push('Consider IV fluid bolus')
      }
    } else {
      if (!hasAdrenaline) {
        return {
          modifiers: { ecgRhythm: 'asystole', hr: 0, spo2: 0, nibp: { sys: 0, dia: 0, map: 0 } },
          events: ['❌ Cardiac arrest — failure to treat anaphylaxis'],
          resolved: false,
          failed: true,
        }
      }
      const p = Math.min((elapsed - 90) / 60, 1)
      mods.nibp = { sys: 110 + p * 20, dia: 70 + p * 10, map: 82 + p * 15 }
      mods.hr = Math.max(85 - p * 10, 75)
      mods.spo2 = Math.min(96 + p * 4, 100)

      if (p >= 1) {
        return {
          modifiers: { hr: 78, spo2: 99, nibp: { sys: 120, dia: 80, map: 93 } },
          events: ['✓ Patient stabilised after anaphylaxis treatment'],
          resolved: true,
          failed: false,
        }
      }
    }

    return { modifiers: mods, events, resolved: false, failed: false }
  },
}
