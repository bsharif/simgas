---
id: bronchospasm
label: Bronchospasm
description: Severe intraoperative bronchospasm during general anaesthesia. Increasing airway pressures and falling SpO₂.
difficulty: medium
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
    enter_when: "time > 30 && !any('salbutamol') && !any('manual-vent') && !any('increase-fio2')"
    enter_description: "No treatment given within 30 seconds"
    snap: { capnographyShape: bronchospasm }
    baseline: { hr: 130, spo2: 76, etco2: 8.0 }
    fail_when: "spo2 < 78 && phase_elapsed > 45"
    fail_description: "Cardiac arrest from severe refractory bronchospasm"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Severe refractory bronchospasm — cardiac arrest"

  - id: recovery
    label: "Recovery"
    enter_when: "any('salbutamol') || any('manual-vent') || any('increase-fio2')"
    enter_description: "Salbutamol, manual ventilation, or high-flow oxygen given"
    snap: { capnographyShape: normal }
    baseline: { hr: 88, spo2: 97, etco2: 5.2 }
    resolve_when: "spo2 > 94 && phase_elapsed > 60"
    resolve_description: "SpO₂ recovers above 94%"
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

## QRH Reference: 3-4 Bronchospasm
