---
id: haemorrhagic-shock
label: Haemorrhagic Shock
description: Major intraoperative haemorrhage causing progressive hypovolaemic shock. HR rising, BP falling.
difficulty: medium
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
    baseline: { hr: 132, nibp: { sys: 72, dia: 42, map: 52 }, spo2: 94 }
    events:
      - at: 10s
        text: "⚠ Unexpected surgical bleeding — estimated 800 ml so far"
      - at: 30s
        text: "⚠ HR rising, BP falling — activate major haemorrhage protocol"

  - id: decompensated
    enter_when: "hr > 120 && !any('fluid-bolus')"
    baseline: { hr: 155, nibp: { sys: 52, dia: 28, map: 36 }, spo2: 86 }
    fail_when: "phase_elapsed > 90 && !any('fluid-bolus') && !any('metaraminol') && !any('adrenaline-1')"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Haemorrhagic cardiac arrest — exsanguination"

  - id: resuscitation
    enter_when: "any('fluid-bolus') || any('metaraminol') || any('adrenaline-1')"
    baseline: { hr: 105, nibp: { sys: 92, dia: 58, map: 69 }, spo2: 96 }
    resolve_when: "spo2 > 93 && phase_elapsed > 90"
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

## QRH Reference: 3-2 Massive Blood Loss
