---
id: laryngospasm
label: Laryngospasm
description: Post-extubation laryngospasm in recovery. Sudden onset airway obstruction with rapidly falling SpO₂.
difficulty: medium
pack: "Airway emergencies"
qrh: "3-6 Laryngospasm and Stridor"

learning_objectives:
  - "Recognise laryngospasm: stridor or silence with no chest movement after extubation"
  - "Apply immediate jaw thrust and CPAP with 100% oxygen"
  - "Escalate to propofol (and suxamethonium if refractory) without delay"

critical_actions:
  - id: jaw-thrust
    label: "Jaw thrust"
    within_sec: 20
    rationale: "Larson's manoeuvre is the immediate first-line response"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 40
    rationale: "Maximise oxygen reserve while breaking the spasm"

supporting_actions:
  - id: manual-vent
    label: "CPAP / gentle bag ventilation"
  - id: propofol
    label: "Propofol to deepen"
    rationale: "0.25–0.5 mg/kg breaks most laryngospasm"
  - id: suxamethonium
    label: "Suxamethonium if refractory"
    rationale: "Complete laryngospasm unresponsive to deepening needs paralysis"
  - id: call-help
    label: "Call for help"

references:
  - "Association of Anaesthetists QRH 3-6 Laryngospasm and Stridor (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Perform jaw thrust immediately"
  - "Apply CPAP with 100% O₂"
  - "If persists: deepen with propofol, consider intubation"

phases:
  - id: onset
    label: "Laryngospasm onset"
    snap: { tubePosition: none, spo2: 95, hr: 95, etco2: 0.5 }
    baseline: { hr: 100, spo2: 88, etco2: 0.3 }
    events:
      - at: 3s
        text: "⚠ Post-extubation laryngospasm — no chest movement, stridor"

  - id: complete
    label: "Complete obstruction"
    enter_when: "spo2 < 90 && !any('propofol') && !any('suxamethonium')"
    enter_description: "SpO₂ below 90% — at this point the spasm is complete and only deepening or paralysis breaks it"
    snap: { airwayObstructed: true }
    baseline: { hr: 140, spo2: 68 }
    events:
      - at: 4s
        text: "⚠ No air entry despite airway manoeuvres — complete laryngospasm"
    hints_if_missing:
      propofol: "💡 Deepen with propofol 0.25–0.5 mg/kg to break the spasm"
      suxamethonium: "💡 Still obstructed: suxamethonium, then reintubate"
    fail_when: "spo2 < 72 && phase_elapsed > 40"
    fail_description: "Hypoxic cardiac arrest if untreated"
    fail_snap: { ecgRhythm: asystole, hr: 30 }
    fail_events:
      - "❌ Hypoxic cardiac arrest — laryngospasm untreated"

  - id: recovery
    label: "Recovery"
    enter_when: "(spo2 >= 90 && (any('jaw-thrust') || any('manual-vent'))) || any('propofol') || any('suxamethonium')"
    enter_description: "Early jaw thrust/CPAP breaks a partial spasm; a complete spasm (SpO₂ < 90) needs propofol or suxamethonium"
    snap: { airwayObstructed: false }
    baseline: { hr: 90, spo2: 98, etco2: 3.5 }
    hints_if_missing:
      increase-fio2: "Apply 100% oxygen while the spasm settles"
    resolve_when: "spo2 > 95 && phase_elapsed > 45 && fio2 >= 0.8"
    resolve_description: "SpO₂ recovers above 95% on high-flow oxygen"
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

## Outcome modelled here
- **Early** jaw thrust or CPAP (while SpO₂ ≥ 90%) breaks a partial spasm.
- Once SpO₂ falls below 90% the obstruction is complete: jaw thrust alone no
  longer works — propofol (or suxamethonium if refractory) is required.
- Resolution also requires 100% oxygen (FiO₂ ≥ 0.8) — re-oxygenation is part
  of the management, not an optional extra.

*Timeline compressed for drilling — real desaturation in an adult with good
reserve takes longer; in children it is genuinely this fast.*

## QRH Reference: 3-6 Laryngospasm and Stridor
