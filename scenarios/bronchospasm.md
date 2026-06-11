---
id: bronchospasm
label: Bronchospasm
description: Severe intraoperative bronchospasm during general anaesthesia. Increasing airway pressures and falling SpO₂.
difficulty: medium
pack: "Airway emergencies"
qrh: "3-4 Bronchospasm"

learning_objectives:
  - "Recognise bronchospasm from the upsloping ('shark fin') capnograph and rising airway pressures"
  - "Treat with 100% oxygen and salbutamol; deepen anaesthesia"
  - "Support ventilation by hand to feel compliance and buy time"

critical_actions:
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 30
    rationale: "Immediate defence against desaturation"
  - id: salbutamol
    label: "Salbutamol"
    within_sec: 90
    rationale: "First-line bronchodilator — oxygen alone does not treat the spasm"

supporting_actions:
  - id: manual-vent
    label: "Hand ventilation"
    rationale: "Feel the compliance, confirm the diagnosis, buy time"
  - id: call-help
    label: "Call for help"
    rationale: "Severe bronchospasm escalates fast — get help early"

references:
  - "Association of Anaesthetists QRH 3-4 Bronchospasm (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Check for wheeze and rising airway pressures"
  - "First-line: 100% O₂ and salbutamol nebuliser"
  - "Deepen anaesthesia — volatiles are bronchodilators"

phases:
  - id: onset
    label: "Bronchospasm onset"
    snap: { capnographyShape: bronchospasm }
    baseline: { hr: 110, spo2: 91, etco2: 6.8, rr: 18 }
    events:
      - at: 5s
        text: "⚠ Airway pressure rising — expiratory wheeze audible"
      - at: 15s
        text: "⚠ SpO₂ falling — upsloping capnograph waveform"

  - id: untreated
    label: "Untreated bronchospasm"
    enter_when: "time > 30 && !any('salbutamol') && !any('manual-vent') && fio2 < 0.8 && sevoflurane < 3"
    enter_description: "No treatment within 30 seconds (oxygen, salbutamol, hand ventilation, or deepening)"
    snap: { capnographyShape: bronchospasm }
    baseline: { hr: 130, spo2: 76, etco2: 8.0 }
    fail_when: "spo2 < 78 && phase_elapsed > 45"
    fail_description: "Cardiac arrest from severe refractory bronchospasm"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Severe refractory bronchospasm — cardiac arrest"

  - id: recovery
    label: "Recovery"
    enter_when: "any('salbutamol') || any('manual-vent') || fio2 >= 0.8 || sevoflurane >= 3"
    enter_description: "Salbutamol, hand ventilation, FiO₂ ≥ 80%, or anaesthesia deepened (sevo ≥ 3%)"
    snap: { capnographyShape: normal }
    baseline: { hr: 88, spo2: 97, etco2: 5.2 }
    hints_if_missing:
      salbutamol: "Oxygen is buying time — the spasm still needs a bronchodilator"
    resolve_when: "spo2 > 94 && phase_elapsed > 60 && any('salbutamol')"
    resolve_description: "SpO₂ recovers above 94% after salbutamol"
    resolve_snap: { hr: 82, spo2: 98, etco2: 5.0 }
    resolve_events:
      - "✓ Bronchospasm resolving — SpO₂ recovering"
---
# Bronchospasm

## What happened
Intraoperative bronchospasm during general anaesthesia caused progressive airway obstruction, rising ETCO₂, and falling SpO₂.

## Key learning points
- Upsloping capnograph waveform ("shark fin") is the hallmark of bronchospasm
- First-line: 100% O₂ + salbutamol nebuliser + deepen anaesthesia (volatiles are bronchodilators)
- Exclude oesophageal intubation and anaphylaxis as mimics
- IV salbutamol if nebuliser ineffective; consider adrenaline in severe/refractory cases

## Outcome modelled here
- Raising FiO₂, hand ventilation, or deepening the volatile (sevo ≥ 3% on the
  machine) all stabilise the patient — the engine credits the machine sliders,
  not just the buttons.
- Resolution still requires salbutamol — oxygen and deepening buy time, the
  bronchodilator treats the cause.

*Timeline compressed for drilling — real bronchospasm evolves over 5–15
minutes.*

## QRH Reference: 3-4 Bronchospasm
