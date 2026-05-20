---
id: vf-cardiac-arrest
label: VF Cardiac Arrest
description: Sudden intraoperative ventricular fibrillation. ECG shows chaotic waveform, no pulse.
difficulty: hard
hints:
  - "Declare cardiac arrest — start CPR immediately"
  - "Call for defibrillator and cardiac arrest trolley"
  - "Adrenaline 1 mg IV after 3rd shock"

initial_state:
  hr: 75
  spo2: 99
  etco2: 4.8

phases:
  - id: arrest
    snap: { ecgRhythm: vf, hr: 0, nibp: { sys: 0, dia: 0, map: 0 } }
    baseline: { spo2: 50, etco2: 1.5 }
    events:
      - at: 2s
        text: "⚠ CARDIAC ARREST — VF on monitor. No pulse."
    fail_when: "phase_elapsed > 30 && !any('cpr')"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ No CPR started — patient outcome fatal"

  - id: cpr-active
    enter_when: "any('cpr')"
    baseline: { spo2: 70, etco2: 2.5 }
    events:
      - at: 5s
        text: "💡 CPR maintaining some perfusion — give adrenaline and defibrillate"
    fail_when: "phase_elapsed > 120 && !any('defibrillate')"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ VF not shocked — deteriorated to asystole"

  - id: rosc
    enter_when: "any('defibrillate') && any('cpr')"
    snap: { ecgRhythm: sinus, hr: 55 }
    baseline: { hr: 78, spo2: 96, etco2: 4.5, nibp: { sys: 95, dia: 60, map: 72 } }
    resolve_when: "spo2 > 90 && phase_elapsed > 60"
    resolve_snap: { hr: 80, spo2: 97, etco2: 4.8 }
    resolve_events:
      - "✓ Return of spontaneous circulation — maintain anaesthesia and monitoring"
---
# VF Cardiac Arrest

## What happened
Ventricular fibrillation caused sudden intraoperative cardiac arrest. Prompt CPR and defibrillation achieved return of spontaneous circulation (ROSC).

## Key learning points
- Declare cardiac arrest immediately — chest compressions within 10 seconds
- Continue compressions while charging the defibrillator
- Biphasic shock 150–200 J (4 J/kg); do not check pulse after defibrillation
- Adrenaline 1 mg IV after 3rd shock; repeat every 3–5 minutes
- ETCO₂ >2 kPa during CPR confirms effective compressions

## QRH Reference: 2-1 Cardiac Arrest
