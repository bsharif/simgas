---
id: high-spinal
label: High Spinal Block
description: Total spinal following inadvertent high spread of intrathecal local anaesthetic. Progressive hypotension, bradycardia, and apnoea.
difficulty: hard
pack: "Core anaesthetic crises"
qrh: "3-11 High Central Neuraxial Block"

learning_objectives:
  - "Recognise the ascending sequence: hypotension → bradycardia → apnoea"
  - "Support the circulation with vasopressors and fluids"
  - "Secure the airway early — apnoea is imminent"

critical_actions:
  - id: call-help
    label: "Call for help"
    within_sec: 45
    rationale: "A total spinal needs an extra pair of hands for airway + circulation"
  - id: "metaraminol|ephedrine"
    label: "Vasopressor (metaraminol or ephedrine)"
    within_sec: 60
    rationale: "Sympathectomy needs direct circulatory support"
  - id: fluid-bolus
    label: "IV fluid bolus"
    within_sec: 90
    rationale: "Fill the dilated circulation"
  - id: "intubate|manual-vent"
    label: "Support ventilation (intubate or bag)"
    within_sec: 120
    rationale: "Apnoea from a total spinal requires controlled ventilation"

references:
  - "Association of Anaesthetists QRH 3-11 High Central Neuraxial Block (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Reassure the patient — they may be awake but paralysed"
  - "Give vasopressors (metaraminol/ephedrine) and IV fluids"
  - "Intubate early — apnoea is imminent"

initial_state:
  hr: 75
  nibp: { sys: 118, dia: 74, map: 89 }
  spo2: 99
  rr: 14
  etco2: 4.8

phases:
  - id: onset
    label: "High spinal onset"
    baseline: { hr: 48, nibp: { sys: 72, dia: 40, map: 51 }, rr: 6, spo2: 97 }
    events:
      - at: 8s
        text: "⚠ Patient anxious — difficulty breathing. BP falling. Possible high spinal."
      - at: 20s
        text: "⚠ HR slowing, RR declining — total spinal. Apnoea imminent."

  - id: apnoea
    label: "Apnoea"
    enter_when: "rr < 6"
    enter_description: "Respiratory rate drops below 6"
    snap: { rr: 0 }
    baseline: { hr: 35, nibp: { sys: 48, dia: 25, map: 33 }, spo2: 78 }
    events:
      - at: 3s
        text: "⚠ APNOEA — intubate immediately and support circulation"
    fail_when: "phase_elapsed > 60 && !any('metaraminol') && !any('ephedrine') && !any('fluid-bolus')"
    fail_description: "Cardiac arrest without vasopressor or fluid support"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Untreated high spinal — cardiac arrest"

  - id: recovery
    label: "Recovery"
    enter_when: "any('metaraminol') || any('ephedrine') || any('fluid-bolus')"
    enter_description: "Vasopressor or fluid bolus given"
    baseline: { hr: 72, nibp: { sys: 95, dia: 60, map: 72 }, spo2: 96 }
    events:
      - at: 110s
        text: "⚠ Block unchanged — the patient cannot breathe for themselves yet"
    hints_if_missing:
      intubate: "💡 The apnoea will not recover with the block — intubate and ventilate"
    resolve_when: "spo2 > 93 && phase_elapsed > 90 && (any('intubate') || count('manual-vent') >= 3)"
    resolve_description: "Stabilises 90 seconds after circulation support AND the airway is secured (intubation or sustained bag ventilation)"
    resolve_snap: { hr: 70, spo2: 99, rr: 12 }
    resolve_events:
      - "✓ High spinal managed — ventilated and stable. Block will wear off over 1–2 hours."
---
# High Central Neuraxial Block

## What happened
Inadvertent high spread of intrathecal local anaesthetic caused a total spinal — progressive hypotension, bradycardia, and apnoea requiring urgent resuscitation.

## Key learning points
- Sequence: hypotension → bradycardia → dyspnoea → arm weakness → unconsciousness → apnoea
- Reassure the patient — they may be fully conscious and terrified
- Secure the airway early — apnoea can develop rapidly
- Vasopressors: metaraminol 1–2 mg boluses, ephedrine 6–12 mg boluses
- Do NOT use head-down tilt (worsens block spread); elevate legs instead
- Block duration: 1–2 hours — maintain anaesthesia and ventilation

## Outcome modelled here
- Vasopressors/fluids alone improve the numbers but do **not** complete the
  case: the apnoeic patient must be ventilated (intubate, or sustained bag
  ventilation) before the scenario resolves.

*Timeline compressed for drilling — a real high spinal evolves over 5–15
minutes and the block persists for 1–2 hours.*

## QRH Reference: 3-11 High Central Neuraxial Block
