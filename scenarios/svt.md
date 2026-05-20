---
id: svt
label: SVT
description: Sudden onset supraventricular tachycardia during stable anaesthesia. Narrow-complex tachycardia at 200 bpm.
difficulty: medium
hints:
  - "Confirm narrow complex tachycardia on ECG"
  - "Adenosine 6 mg IV rapid bolus — first-line for SVT"
  - "Synchronised cardioversion if haemodynamically unstable"

initial_state:
  hr: 78
  spo2: 99
  etco2: 4.8
  nibp: { sys: 122, dia: 76, map: 91 }

phases:
  - id: onset
    snap: { ecgRhythm: svt, hr: 198 }
    baseline: { hr: 198, nibp: { sys: 95, dia: 60, map: 72 }, spo2: 97 }
    events:
      - at: 3s
        text: "⚠ Sudden tachycardia — narrow complex SVT at 200 bpm on ECG"

  - id: untreated
    enter_when: "time > 25 && !any('adenosine') && !any('defibrillate')"
    baseline: { hr: 198, nibp: { sys: 65, dia: 40, map: 48 }, spo2: 90 }
    fail_when: "phase_elapsed > 90"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Haemodynamic collapse — SVT degenerated to VF"

  - id: recovery
    enter_when: "any('adenosine') || any('defibrillate')"
    snap: { ecgRhythm: sinus, hr: 70 }
    baseline: { hr: 82, nibp: { sys: 118, dia: 74, map: 89 }, spo2: 99 }
    resolve_when: "phase_elapsed > 45"
    resolve_snap: { hr: 78, spo2: 99, etco2: 4.8 }
    resolve_events:
      - "✓ SVT terminated — sinus rhythm restored"
---
# SVT

## What happened
Supraventricular tachycardia (SVT) developed during stable anaesthesia, causing haemodynamic compromise. Adenosine successfully terminated the arrhythmia.

## Key learning points
- Adenosine 6 mg IV rapid bolus (via large antecubital vein with flush) is first-line
- If adenosine fails: repeat 12 mg × 2; consider amiodarone or esmolol
- Synchronised cardioversion (50–100 J biphasic) if haemodynamically unstable
- Exclude underlying causes: light anaesthesia, hypovolaemia, electrolyte disturbance

## QRH Reference: 2-7 Tachycardia
