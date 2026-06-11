---
id: air-embolism
label: Venous Gas Embolism
description: Sudden ETCO₂ collapse with hypotension during laparoscopic insufflation — venous CO₂ embolism.
difficulty: hard
pack: "Shock & circulation"
qrh: "3-5 Circulatory Embolus"

learning_objectives:
  - "Recognise the hallmark: a sudden fall in ETCO₂ with hypotension"
  - "Stop the gas source immediately and flood/occlude the entry point"
  - "Support the circulation: 100% oxygen, fluids, vasopressors; CPR if output is lost"

critical_actions:
  - id: stop-trigger
    label: "Stop insufflation / occlude the entry site"
    within_sec: 30
    rationale: "Gas keeps entraining until the source is stopped"
  - id: call-help
    label: "Call for help"
    within_sec: 45
    rationale: "Repositioning, aspiration, and resuscitation need hands"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 45
    rationale: "Maximise oxygenation; if N₂O were running it must be off — it expands the bubble"
  - id: fluid-bolus
    label: "IV fluid bolus"
    within_sec: 90
    rationale: "Raise venous pressure to reduce further entrainment"

supporting_actions:
  - id: "metaraminol|ephedrine|adrenaline-1"
    label: "Vasopressor support"
  - id: cpr
    label: "CPR if output lost"
    rationale: "Compressions also help break up a large gas lock"
  - id: cvp-line
    label: "Central line"
    rationale: "Attempt aspiration of gas from the right atrium"

references:
  - "Association of Anaesthetists QRH 3-5 Circulatory Embolus (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Sudden ETCO₂ fall + hypotension = embolus until proven otherwise"
  - "Stop the insufflation, flood the field, head down / left lateral"
  - "100% O₂, fluids, vasopressors — CPR if output is lost"

initial_state:
  hr: 80
  nibp: { sys: 118, dia: 74, map: 89 }
  spo2: 98
  etco2: 4.8

phases:
  - id: onset
    label: "Gas embolus"
    snap: { etco2: 3.2 }
    baseline: { etco2: 1.6, nibp: { sys: 78, dia: 46, map: 57 }, spo2: 89, hr: 118 }
    events:
      - at: 3s
        text: "⚠ ETCO₂ has fallen off a cliff — 4.8 → 2.9 kPa in seconds"
      - at: 10s
        text: "⚠ BP falling, HR rising — 'mill-wheel' murmur on the oesophageal stethoscope"
    hints_if_missing:
      stop-trigger: "💡 Stop the insufflation and flood the field"

  - id: untreated
    label: "Ongoing entrainment"
    enter_when: "time > 30 && !any('stop-trigger')"
    enter_description: "Gas source not stopped within 30 seconds"
    baseline: { etco2: 0.8, nibp: { sys: 48, dia: 28, map: 35 }, spo2: 74, hr: 138 }
    events:
      - at: 5s
        text: "⚠ Gas lock forming in the right heart — circulation failing"
    fail_when: "phase_elapsed > 60"
    fail_description: "Continued entrainment leads to cardiac arrest"
    fail_snap: { ecgRhythm: asystole, hr: 0, spo2: 0, etco2: 0, nibp: { sys: 0, dia: 0, map: 0 } }
    fail_events:
      - "❌ Cardiac arrest — gas embolus with the source still running"

  - id: managed
    label: "Source controlled"
    enter_when: "any('stop-trigger')"
    enter_description: "Insufflation stopped and entry site addressed"
    baseline: { etco2: 4.2, nibp: { sys: 98, dia: 62, map: 74 }, spo2: 95, hr: 98 }
    events:
      - at: 100s
        text: "⚠ Circulation still depends on support — complete the resuscitation bundle"
    hints_if_missing:
      increase-fio2: "💡 100% oxygen (and never nitrous) for any suspected embolus"
      fluid-bolus: "💡 Fluids raise venous pressure and limit further entrainment"
    resolve_when: "phase_elapsed > 90 && fio2 >= 0.8 && any('fluid-bolus')"
    resolve_description: "Stabilises 90 seconds after source control with oxygen and volume"
    resolve_snap: { hr: 84, spo2: 98, etco2: 4.8 }
    resolve_events:
      - "✓ Embolus dispersing — haemodynamics recovering. Plan post-event monitoring."
---
# Venous Gas Embolism

## What happened
CO₂ entrained into an open vein during laparoscopic insufflation. The hallmark
was a sudden collapse in ETCO₂ (dead-space ventilation) with hypotension and
tachycardia. Stopping the source and supporting the circulation allowed the
gas to disperse.

## Key learning points
- A **sudden ETCO₂ fall** with hypotension is an embolus until proven
  otherwise (gas, thrombus, fat, amniotic fluid).
- **Stop the gas source**: stop insufflation, flood the surgical field, occlude
  open veins, lower the operative site below heart level.
- 100% oxygen — and if nitrous oxide is running, off immediately: it diffuses
  into and expands the bubble.
- Fluids raise right-sided pressures and reduce entrainment; vasopressors
  support coronary perfusion.
- Left lateral head-down positioning and right-atrial aspiration via a central
  line are classical adjuncts; CPR can break up a large gas lock.

## Outcome modelled here
- The case cannot stabilise until the source is stopped; after that,
  resolution needs 100% oxygen and a fluid bolus.

*Timeline compressed for drilling — a real embolus evolves over 2–10 minutes
depending on the entrainment rate.*

## QRH Reference: 3-5 Circulatory Embolus
