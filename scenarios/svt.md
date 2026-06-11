---
id: svt
label: SVT
description: Sudden onset supraventricular tachycardia during stable anaesthesia. Narrow-complex tachycardia at 200 bpm.
difficulty: medium
pack: "Cardiac arrest & arrhythmias"
qrh: "2-7 Tachycardia"

learning_objectives:
  - "Recognise narrow-complex tachycardia and assess haemodynamic stability"
  - "Escalate stepwise: vagal manoeuvres → adenosine (repeat at higher dose) → synchronised cardioversion"
  - "Never deliver an unsynchronised shock to a perfusing rhythm"

critical_actions:
  - id: "adenosine|sync-cardioversion"
    label: "Terminate the SVT (adenosine, or synchronised cardioversion if unstable)"
    within_sec: 60
    rationale: "Prolonged SVT at 200 bpm degrades coronary perfusion under anaesthesia"

supporting_actions:
  - id: vagal-manoeuvres
    label: "Vagal manoeuvres"
    rationale: "First-line while drawing up adenosine — occasionally terminates SVT"
  - id: call-help
    label: "Call for help"
  - id: increase-fio2
    label: "Increase oxygen"

dangerous_actions:
  - id: defibrillate
    label: "Unsynchronised shock on a perfusing rhythm"
    rationale: "An unsynchronised shock can land on the T wave — R-on-T induces VF"

references:
  - "Association of Anaesthetists QRH 2-7 Tachycardia (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Confirm narrow complex tachycardia on ECG"
  - "Vagal manoeuvres, then adenosine 6 mg rapid IV bolus — repeat 12 mg if it re-initiates"
  - "Synchronised cardioversion if haemodynamically unstable"

initial_state:
  hr: 78
  spo2: 99
  etco2: 4.8
  nibp: { sys: 122, dia: 76, map: 91 }

phases:
  - id: onset
    label: "SVT onset"
    snap: { ecgRhythm: svt, hr: 198 }
    baseline: { hr: 198, nibp: { sys: 95, dia: 60, map: 72 }, spo2: 97 }
    events:
      - at: 3s
        text: "⚠ Sudden tachycardia — narrow complex SVT at 200 bpm on ECG"
    hints_if_missing:
      vagal-manoeuvres: "💡 Try vagal manoeuvres while adenosine is drawn up"

  - id: untreated
    label: "Untreated SVT"
    enter_when: "time > 25 && !any('adenosine') && !any('sync-cardioversion')"
    enter_description: "No adenosine or cardioversion within 25 seconds"
    baseline: { hr: 198, nibp: { sys: 65, dia: 40, map: 48 }, spo2: 90 }
    fail_when: "phase_elapsed > 90"
    fail_description: "SVT degenerates to VF after 90 seconds untreated"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Haemodynamic collapse — SVT degenerated to VF"

  - id: adenosine-first
    label: "After first adenosine"
    enter_when: "count('adenosine') == 1"
    enter_description: "First adenosine dose given"
    baseline: { hr: 175, nibp: { sys: 90, dia: 58, map: 69 }, spo2: 96 }
    events:
      - at: 3s
        text: "→ Transient AV block — rhythm pauses... SVT re-initiates"
    hints_if_missing:
      sync-cardioversion: "💡 If adenosine fails again or the patient deteriorates: synchronised cardioversion"

  - id: svt-recurs
    label: "SVT re-initiated"
    enter_when: "count('adenosine') == 1 && (phase_elapsed > 6 || phase_done('adenosine-first'))"
    enter_description: "SVT re-establishes seconds after the first dose"
    snap: { ecgRhythm: svt, hr: 195 }
    baseline: { hr: 195, nibp: { sys: 82, dia: 52, map: 62 }, spo2: 94 }
    fail_when: "phase_elapsed > 120"
    fail_description: "Sustained re-entry degenerates if not escalated"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Recurrent SVT untreated — degenerated to VF"

  - id: recovery
    label: "Recovery"
    enter_when: "count('adenosine') >= 2 || any('sync-cardioversion')"
    enter_description: "Second adenosine dose (12 mg) or synchronised cardioversion"
    snap: { ecgRhythm: sinus, hr: 70 }
    baseline: { hr: 82, nibp: { sys: 118, dia: 74, map: 89 }, spo2: 99 }
    resolve_when: "phase_elapsed > 45"
    resolve_description: "Sinus rhythm sustained for 45 seconds"
    resolve_snap: { hr: 78, spo2: 99, etco2: 4.8 }
    resolve_events:
      - "✓ SVT terminated — sinus rhythm restored"

  - id: unsync-shock
    label: "R-on-T — shock-induced VF"
    enter_when: "count('defibrillate') == 1"
    enter_description: "Unsynchronised shock delivered to a perfusing rhythm"
    snap: { ecgRhythm: vf, hr: 0, nibp: { sys: 0, dia: 0, map: 0 } }
    baseline: { spo2: 55, etco2: 1.5 }
    events:
      - at: 2s
        text: "❌ Unsynchronised shock landed on the T wave — VF. No pulse. Start CPR."
    fail_when: "phase_elapsed > 60 && !any('cpr')"
    fail_description: "Shock-induced VF is fatal without immediate CPR and defibrillation"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Shock-induced VF unresuscitated — asystole"

  - id: post-shock-recovery
    label: "Rescued from shock-induced VF"
    enter_when: "count('defibrillate') >= 2 && any('cpr')"
    enter_description: "CPR started and the VF defibrillated"
    snap: { ecgRhythm: sinus, hr: 65 }
    baseline: { hr: 85, nibp: { sys: 100, dia: 64, map: 76 }, spo2: 95 }
    resolve_when: "phase_elapsed > 60"
    resolve_description: "Rescued — sinus rhythm after resuscitation"
    resolve_snap: { hr: 82, spo2: 97 }
    resolve_events:
      - "✓ ROSC after iatrogenic VF — debrief will cover synchronised vs unsynchronised shocks"
---
# SVT

## What happened
Supraventricular tachycardia (SVT) developed during stable anaesthesia, causing haemodynamic compromise. The first adenosine dose produced only transient AV block — the tachycardia re-initiated and needed escalation.

## Key learning points
- Vagal manoeuvres first while preparing drugs
- Adenosine 6 mg IV rapid bolus (large antecubital vein with flush); **repeat 12 mg** if the SVT re-initiates — a single dose often fails
- **Synchronised** cardioversion (50–100 J biphasic) if haemodynamically unstable — the sync function times the shock away from the T wave
- An **unsynchronised** (defibrillation) shock on a perfusing rhythm risks R-on-T VF — modelled here as exactly that
- Exclude underlying causes: light anaesthesia, hypovolaemia, electrolyte disturbance

## Outcome modelled here
- First adenosine: transient block, then re-entry — resolution requires a
  second dose or synchronised cardioversion.
- Pressing **Defibrillate** (unsynchronised) on the perfusing SVT induces VF;
  the case is still salvageable with CPR + defibrillation, but the rubric
  records the harm.

*Timeline compressed for drilling — real escalation runs over 10–20 minutes.*

## QRH Reference: 2-7 Tachycardia
