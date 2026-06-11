---
id: anaphylaxis
label: Anaphylaxis
description: A 35-year-old develops sudden anaphylaxis after IV antibiotic administration.
difficulty: medium
pack: "Core anaesthetic crises"
qrh: "3-1 Anaphylaxis"

learning_objectives:
  - "Recognise anaphylaxis from sudden hypotension, tachycardia, and bronchospasm"
  - "Stop the trigger and call for help immediately"
  - "Give adrenaline early and titrate to response"
  - "Complete the bundle: 100% oxygen and rapid IV fluids, not adrenaline alone"

critical_actions:
  - id: stop-trigger
    label: "Stop the trigger (antibiotic infusion)"
    within_sec: 30
    rationale: "Ongoing exposure deepens the reaction"
  - id: call-help
    label: "Call for help"
    within_sec: 45
    rationale: "Anaphylaxis management is a team task"
  - id: "adrenaline-1|adrenaline-10"
    label: "IV adrenaline"
    within_sec: 45
    rationale: "First-line treatment — delay drives progression to arrest"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 90
    rationale: "Counters hypoxia from bronchospasm and V/Q mismatch"
  - id: fluid-bolus
    label: "Rapid IV fluid bolus"
    within_sec: 120
    rationale: "Massive vasodilation and capillary leak need volume"

supporting_actions:
  - id: manual-vent
    label: "Support ventilation"

dangerous_actions:
  - id: propofol
    label: "Propofol bolus"
    rationale: "Deepens vasodilation and worsens the hypotension"

references:
  - "Association of Anaesthetists QRH 3-1 Anaphylaxis (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Check the airway — bronchospasm may be present"
  - "Give adrenaline early — it is the first-line treatment"
  - "Fluids and high-flow oxygen are also key"

phases:
  - id: stable
    label: "Stable period"
    baseline:
      hr: 78
      spo2: 99
      nibp: { sys: 120, dia: 80, map: 93 }
      etco2: 5.0
    events:
      - at: 5s
        text: "→ IV antibiotic administered"

  - id: onset
    label: "Anaphylaxis onset"
    enter_when: "time > 5"
    enter_description: "5 seconds after antibiotic administration"
    snap:
      capnographyShape: bronchospasm
    baseline:
      hr: 130
      spo2: 88
      nibp: { sys: 70, dia: 50, map: 58 }
      etco2: 4.0
    events:
      - at: 10s
        text: "⚠ HR rising, BP falling — possible anaphylaxis"
      - at: 20s
        text: "⚠ Bronchospasm — airway pressure rising, SpO₂ dropping"
    hints_if_missing:
      stop-trigger: "💡 Suspect the antibiotic — stop the infusion"
      call-help: "💡 Declare the emergency and call for help"

  - id: untreated
    label: "Untreated deterioration"
    enter_when: "time > 30 && !any('adrenaline-*')"
    enter_description: "No adrenaline given within 30 seconds"
    baseline:
      hr: 155
      spo2: 70
      nibp: { sys: 40, dia: 30, map: 33 }
      etco2: 3.0
    events:
      - at: 30s
        text: "⚠ Severe hypotension — risk of cardiac arrest"
    fail_when: "phase_elapsed > 60"
    fail_description: "Heart stops after 60 seconds without treatment"
    fail_events:
      - "❌ Cardiac arrest — failure to treat anaphylaxis"
    fail_snap:
      ecgRhythm: asystole
      hr: 0
      spo2: 0
      nibp: { sys: 0, dia: 0, map: 0 }

  - id: iatrogenic-collapse
    label: "Collapse worsened by induction agent"
    enter_when: "any('propofol') && !any('adrenaline-*')"
    enter_description: "Propofol given to a vasoplegic patient before adrenaline"
    baseline:
      hr: 165
      spo2: 62
      nibp: { sys: 38, dia: 22, map: 28 }
    events:
      - at: 3s
        text: "⚠ Profound hypotension after induction agent — circulation collapsing"
    fail_when: "phase_elapsed > 45"
    fail_description: "Vasodilators on top of anaphylactic shock — arrest within 45 seconds unless adrenaline is given"
    fail_snap:
      ecgRhythm: asystole
      hr: 0
      spo2: 0
      nibp: { sys: 0, dia: 0, map: 0 }
    fail_events:
      - "❌ Cardiac arrest — anaphylactic shock deepened by propofol"

  - id: recovery
    label: "Recovery"
    enter_when: "any('adrenaline-*')"
    enter_description: "Adrenaline administered"
    snap:
      capnographyShape: normal
    baseline:
      hr: 85
      spo2: 99
      nibp: { sys: 125, dia: 78, map: 94 }
      etco2: 5.0
    events:
      - at: 120s
        text: "⚠ BP holding only on adrenaline — circulating volume and oxygenation still inadequate"
    hints_if_missing:
      increase-fio2: "Consider high-flow oxygen"
      fluid-bolus: "Consider IV fluid bolus"
    resolve_when: "phase_elapsed > 90 && fio2 >= 0.8 && any('fluid-bolus') && any('stop-trigger')"
    resolve_description: "Stabilises 90 seconds after the full bundle: trigger stopped + adrenaline + high-flow oxygen + fluids"
    resolve_events:
      - "✓ Patient stabilised after anaphylaxis treatment"
    resolve_snap:
      hr: 78
      spo2: 99
      nibp: { sys: 120, dia: 80, map: 93 }
      etco2: 5.0
---

# Anaphylaxis — debrief

Anaphylaxis is a rapid CV collapse and bronchospasm following exposure to a
triggering agent — in this case an IV antibiotic given at induction.

## Recognition

- Sudden hypotension (here BP fell to 70/50)
- Tachycardia (HR rising from 78 toward 130+)
- Falling SpO₂ from bronchospasm / V/Q mismatch
- Falling ETCO₂ from poor perfusion + bronchospasm
- Often accompanied by a rash and oedema (not modelled here)

## First-line management

1. **Stop the trigger** — pause the antibiotic, remove latex if suspected.
2. **100% O₂** and secure the airway.
3. **IV adrenaline** — 50–100 mcg titrated for moderate, 0.5–1 mg IM if no IV
   access. Repeat every 5 minutes as needed.
4. **IV fluid bolus** — crystalloid 1–2 L rapidly.
5. **Adjuncts** — chlorphenamine 10 mg IV, hydrocortisone 200 mg IV (these are
   second-line and won't reverse the immediate threat).

## Outcome modelled here

- Recognising and giving adrenaline within ~30s pulls the patient back to a
  recovery trajectory (HR 85, BP 125/78).
- Resolution requires the full bundle — **stop the trigger** plus adrenaline
  plus high-flow oxygen (FiO₂ ≥ 0.8) plus an IV fluid bolus — then ~90 seconds
  of stability. Adrenaline alone improves the numbers but does not complete
  the case.
- Giving **propofol** before adrenaline deepens the vasoplegia — the model
  collapses faster and arrests within 45 seconds unless adrenaline follows.
- Failure to give any adrenaline within 90 seconds → cardiac arrest.

*Timeline compressed for drilling — real anaphylaxis evolves over 5–30
minutes after exposure.*
