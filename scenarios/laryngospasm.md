---
id: laryngospasm
label: Laryngospasm
description: Post-extubation laryngospasm in recovery. Sudden onset airway obstruction with rapidly falling SpO₂.
difficulty: medium
hints:
  - "Perform jaw thrust immediately"
  - "Apply CPAP with 100% O₂"
  - "If persists: deepen with propofol, consider intubation"

phases:
  - id: onset
    snap: { tubePosition: none, spo2: 95, hr: 95, etco2: 0.5 }
    baseline: { hr: 100, spo2: 88, etco2: 0.3 }
    events:
      - at: 3s
        text: "⚠ Post-extubation laryngospasm — no chest movement, stridor"

  - id: complete
    enter_when: "spo2 < 90 && !any('jaw-thrust') && !any('manual-vent')"
    baseline: { hr: 140, spo2: 68 }
    fail_when: "spo2 < 72 && phase_elapsed > 40"
    fail_snap: { ecgRhythm: asystole, hr: 30 }
    fail_events:
      - "❌ Hypoxic cardiac arrest — laryngospasm untreated"

  - id: recovery
    enter_when: "any('jaw-thrust') || any('manual-vent') || any('propofol')"
    baseline: { hr: 90, spo2: 98, etco2: 3.5 }
    resolve_when: "spo2 > 95 && phase_elapsed > 45"
    resolve_snap: { hr: 82, spo2: 99 }
    resolve_events:
      - "✓ Laryngospasm broken — airway patent, SpO₂ recovering"
---
# Laryngospasm

## What happened
Laryngospasm occurred following extubation at light plane of anaesthesia, causing complete upper airway obstruction and rapidly progressing hypoxia.

## Key learning points
- Immediate jaw thrust ± CPAP 100% O₂ is first-line
- Propofol 0.25–0.5 mg/kg IV deepens anaesthesia and breaks laryngospasm
- Suxamethonium if jaw thrust and propofol fail (complete laryngospasm)
- Consider intubation if likely to recur or if aspiration occurred

## QRH Reference: 3-6 Laryngospasm and Stridor
