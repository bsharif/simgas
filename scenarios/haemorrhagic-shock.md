---
id: haemorrhagic-shock
label: Haemorrhagic Shock
description: Major intraoperative haemorrhage causing progressive hypovolaemic shock. HR rising, BP falling.
difficulty: medium
pack: "Shock & circulation"
qrh: "3-2 Massive Blood Loss"

learning_objectives:
  - "Recognise progressive hypovolaemia from the HR/BP trajectory"
  - "Activate the major haemorrhage protocol and transfuse blood, not just crystalloid"
  - "Give tranexamic acid early; vasopressors are a bridge, not a substitute"

critical_actions:
  - id: call-help
    label: "Call for help / activate major haemorrhage protocol"
    within_sec: 45
    rationale: "Blood products, porters, and a second pair of hands all start with the call"
  - id: fluid-bolus
    label: "Rapid volume (fluid bolus)"
    within_sec: 60
    rationale: "Immediate volume while blood is fetched"
  - id: blood-transfusion
    label: "Transfuse blood"
    within_sec: 150
    rationale: "Crystalloid dilutes — red cells carry the oxygen"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 90
    rationale: "Maximise oxygen content of the remaining blood"

supporting_actions:
  - id: txa
    label: "Tranexamic acid"
    rationale: "Give within 3 hours — earlier is better"
  - id: "metaraminol|ephedrine|adrenaline-1"
    label: "Vasopressor bridge"
    rationale: "Holds perfusion pressure while volume goes in"
  - id: arterial-line
    label: "Arterial line"

references:
  - "Association of Anaesthetists QRH 3-2 Massive Blood Loss (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Activate major haemorrhage protocol"
  - "Rapid IV fluid bolus and vasopressors"
  - "Increase FiO₂ to 100%"

initial_state:
  hr: 82
  nibp: { sys: 118, dia: 74, map: 89 }
  spo2: 99
  etco2: 4.8

phases:
  - id: haemorrhage
    label: "Haemorrhage"
    baseline: { hr: 132, nibp: { sys: 72, dia: 42, map: 52 }, spo2: 94 }
    events:
      - at: 10s
        text: "⚠ Unexpected surgical bleeding — estimated 800 ml so far"
      - at: 30s
        text: "⚠ HR rising, BP falling — activate major haemorrhage protocol"

  - id: decompensated
    label: "Decompensated shock"
    enter_when: "hr > 120 && !any('fluid-bolus')"
    enter_description: "Heart rate over 120 without fluid bolus given"
    baseline: { hr: 155, nibp: { sys: 52, dia: 28, map: 36 }, spo2: 86 }
    fail_when: "phase_elapsed > 90 && !any('fluid-bolus') && !any('metaraminol') && !any('adrenaline-1')"
    fail_description: "Cardiac arrest from exsanguination without treatment"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Haemorrhagic cardiac arrest — exsanguination"

  - id: resuscitation
    label: "Resuscitation"
    enter_when: "any('fluid-bolus') || any('metaraminol') || any('adrenaline-1')"
    enter_description: "Fluid bolus or vasopressor given"
    baseline: { hr: 105, nibp: { sys: 92, dia: 58, map: 69 }, spo2: 96 }
    events:
      - at: 110s
        text: "⚠ Losses continue — haemodynamics depend on definitive products and haemostasis"
    hints_if_missing:
      fluid-bolus: "Vasopressors are holding the pressure — the tank is still empty. Give volume."
      blood-transfusion: "💡 Crystalloid is a bridge — transfuse red cells"
      txa: "💡 Tranexamic acid 1 g — give it early"
    resolve_when: "spo2 > 93 && phase_elapsed > 90 && any('fluid-bolus') && any('blood-transfusion') && fio2 >= 0.8"
    resolve_description: "Stabilises 90 seconds after volume AND blood are running, on high-flow oxygen"
    resolve_snap: { hr: 98, spo2: 98 }
    resolve_events:
      - "✓ Haemorrhage controlled — haemodynamics stabilising"
---
# Haemorrhagic Shock

## What happened
Major intraoperative haemorrhage caused progressive hypovolaemic shock. Rapid fluid resuscitation and vasopressors stabilised the patient pending surgical haemostasis.

## Key learning points
- Early activation of major haemorrhage protocol is critical
- Transfuse packed red cells alongside crystalloid (1:1:1 ratio with FFP and platelets in massive haemorrhage)
- Give tranexamic acid within 3 hours of injury/onset
- Vasopressors (metaraminol, noradrenaline) as a bridge — not a substitute for volume
- Maintain normothermia, correct acidosis and hypocalcaemia (lethal triad)

## Outcome modelled here
- Crystalloid or vasopressors alone hold the line but do **not** complete the
  case — resolution requires blood to be running as well.

*Timeline compressed for drilling — real major haemorrhage management runs
over 30–60+ minutes alongside surgical haemostasis.*

## QRH Reference: 3-2 Massive Blood Loss
