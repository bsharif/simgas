import type { Scenario } from '../scenario'
import type { PatientModifier } from '../interventions'

/**
 * Anaphylaxis scenario. Sets drift baselines instead of writing absolute vitals
 * every tick — so when the user gives adrenaline (hrDelta + nibpDelta), the
 * drug bump persists on top of the underlying physiology trajectory.
 */
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
  // Snap initial vitals; drift kicks in from there.
  initialModifiers: {
    hr: 120,
    spo2: 92,
    nibpDelta: { sys: -50, map: -35 },
    etco2Delta: -0.5,
    baseline: {
      hr: 130,
      spo2: 88,
      nibp: { sys: 70, dia: 50, map: 58 },
      etco2: 4.0,
    },
  },

  check(elapsed, interventions) {
    const events: string[] = []
    const mods: PatientModifier = {}

    const hasAdrenaline = interventions.includes('adrenaline-1') || interventions.includes('adrenaline-10')
    const hasFluids = interventions.includes('fluid-bolus')
    const hasO2 = interventions.includes('increase-fio2')

    if (elapsed < 30) {
      if (elapsed > 10 && elapsed < 11) {
        events.push('⚠ HR rising, BP falling — possible anaphylaxis')
      }
      // Onset baseline already set in initialModifiers; nothing to update.
    } else if (elapsed < 90) {
      if (!hasAdrenaline) {
        // Worsen — push baseline to severe values; drift handles the trajectory.
        mods.baseline = {
          hr: 155,
          spo2: 70,
          nibp: { sys: 40, dia: 30, map: 33 },
          etco2: 3.0,
        }
        if (elapsed > 60 && elapsed < 61) {
          events.push('⚠ Severe hypotension — risk of cardiac arrest')
        }
      } else {
        // Treated — pull baseline toward normal.
        mods.baseline = {
          hr: 85,
          spo2: 99,
          nibp: { sys: 125, dia: 78, map: 94 },
          etco2: 5.0,
        }
        if (!hasO2 && elapsed > 60 && elapsed < 61) {
          events.push('Consider high-flow oxygen')
        }
        if (!hasFluids && elapsed > 75 && elapsed < 76) {
          events.push('Consider IV fluid bolus')
        }
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
      // Final stabilisation — keep recovery baseline; check resolution.
      mods.baseline = {
        hr: 78,
        spo2: 100,
        nibp: { sys: 120, dia: 80, map: 93 },
        etco2: 5.0,
      }

      if (elapsed > 150) {
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
