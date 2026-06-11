---
id: tension-pneumothorax
label: Tension Pneumothorax
description: Tension pneumothorax following central line insertion. Progressive hypoxia and haemodynamic collapse.
difficulty: hard
pack: "Shock & circulation"
qrh: "2-2 Hypoxia / 2-4 Hypotension"

learning_objectives:
  - "Diagnose tension pneumothorax clinically — never wait for imaging"
  - "Decompress the chest immediately; positive-pressure breaths make a tension worse"
  - "Needle decompression is a bridge — definitive management is a chest drain"

critical_actions:
  - id: call-help
    label: "Call for help"
    within_sec: 45
    rationale: "Decompression, drain insertion, and resuscitation need more than one operator"
  - id: chest-decompression
    label: "Needle chest decompression"
    within_sec: 60
    rationale: "The only immediate treatment"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 45
    rationale: "Buy time against rapidly progressive hypoxia"
  - id: chest-drain
    label: "Intercostal chest drain"
    within_sec: 240
    rationale: "Needle decompression recurs — the drain is definitive"

supporting_actions:
  - id: fluid-bolus
    label: "IV fluids"
    rationale: "Supports the obstructed circulation until decompression"

dangerous_actions:
  - id: manual-vent
    label: "Sustained positive-pressure bagging before decompression"
    rationale: "Every positive-pressure breath pumps more gas into the pleural space"

references:
  - "Association of Anaesthetists QRH 2-2 Hypoxia, 2-4 Hypotension (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Absent breath sounds on right — raised airway pressures"
  - "Diagnose clinically — do not wait for X-ray"
  - "Immediate needle decompression: 2nd intercostal space, midclavicular line"

initial_state:
  spo2: 97
  hr: 80
  nibp: { sys: 120, dia: 76, map: 91 }
  etco2: 4.8

phases:
  - id: onset
    label: "Tension pneumothorax"
    baseline: { spo2: 86, hr: 115, nibp: { sys: 82, dia: 48, map: 59 }, etco2: 3.2 }
    events:
      - at: 8s
        text: "⚠ Airway pressures rising — decreased breath sounds on right"
      - at: 20s
        text: "⚠ Hypotension and tachycardia worsening — tracheal deviation left"

  - id: critical
    label: "Critical"
    enter_when: "spo2 < 88 && !any('chest-decompression')"
    enter_description: "SpO₂ below 88% without chest decompression"
    baseline: { spo2: 65, hr: 140, nibp: { sys: 55, dia: 30, map: 38 } }
    fail_when: "spo2 < 72 && phase_elapsed > 40"
    fail_description: "Cardiac arrest if not decompressed in time"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Tension pneumothorax untreated — cardiac arrest"

  - id: ppv-deterioration
    label: "Worsened by positive pressure"
    enter_when: "count('manual-vent') >= 3 && !any('chest-decompression')"
    enter_description: "Repeated positive-pressure breaths delivered before decompression"
    baseline: { spo2: 52, hr: 150, nibp: { sys: 42, dia: 24, map: 30 } }
    events:
      - at: 2s
        text: "⚠ Each bag breath worsens the obstruction — airway pressures critical, BP collapsing"
    fail_when: "phase_elapsed > 30"
    fail_description: "Positive pressure inflates the tension — arrest within 30 seconds"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Tension driven to arrest by positive-pressure ventilation"

  - id: decompressed
    label: "Decompressed"
    enter_when: "any('chest-decompression')"
    enter_description: "Chest decompression performed"
    snap: { nibp: { sys: 100, dia: 62, map: 75 } }
    baseline: { spo2: 98, hr: 90, nibp: { sys: 118, dia: 74, map: 89 }, etco2: 4.6 }
    events:
      - at: 40s
        text: "⚠ Needle cannula in place — re-tension is possible until a drain is sited"
    hints_if_missing:
      chest-drain: "💡 Needle decompression is a bridge — insert an intercostal drain"
    resolve_when: "spo2 > 94 && phase_elapsed > 60 && any('chest-drain') && fio2 >= 0.8"
    resolve_description: "Stable on high-flow oxygen after the chest drain secures the decompression"
    resolve_snap: { hr: 82, spo2: 99 }
    resolve_events:
      - "✓ Chest drain sited — tension resolved, haemodynamics restored"
---
# Tension Pneumothorax

## What happened
Tension pneumothorax following central line insertion caused progressive respiratory and haemodynamic compromise. Needle decompression was life-saving; the chest drain made it definitive.

## Key learning points
- Diagnose clinically — do not delay for chest X-ray
- Classic signs: hypotension + hypoxia + tracheal deviation + absent unilateral breath sounds + raised JVP
- **Positive-pressure ventilation worsens a tension** — every breath adds gas to the pleural space. Decompress first.
- Immediate needle decompression: 2nd ICS midclavicular line OR 4th/5th ICS anterior axillary line
- Needle decompression can fail, kink, or re-tension — follow with an intercostal chest drain

## Outcome modelled here
- Sustained bagging before decompression accelerates the collapse (and is
  flagged as a harmful action in the debrief).
- Resolution requires decompression **and** a chest drain — the needle alone
  leaves the scenario unstable.

*Timeline compressed for drilling — a real tension evolves over minutes, and
drain insertion takes longer than the sim allows.*

## QRH Reference: 2-2 Hypoxia / 2-4 Hypotension
