---
id: tension-pneumothorax
label: Tension Pneumothorax
description: Tension pneumothorax following central line insertion. Progressive hypoxia and haemodynamic collapse.
difficulty: hard
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
    baseline: { spo2: 86, hr: 115, nibp: { sys: 82, dia: 48, map: 59 }, etco2: 3.2 }
    events:
      - at: 8s
        text: "⚠ Airway pressures rising — decreased breath sounds on right"
      - at: 20s
        text: "⚠ Hypotension and tachycardia worsening — tracheal deviation left"

  - id: critical
    enter_when: "spo2 < 88 && !any('chest-decompression')"
    baseline: { spo2: 65, hr: 140, nibp: { sys: 55, dia: 30, map: 38 } }
    fail_when: "spo2 < 72 && phase_elapsed > 40"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Tension pneumothorax untreated — cardiac arrest"

  - id: decompressed
    enter_when: "any('chest-decompression')"
    snap: { nibp: { sys: 100, dia: 62, map: 75 } }
    baseline: { spo2: 98, hr: 90, nibp: { sys: 118, dia: 74, map: 89 }, etco2: 4.6 }
    resolve_when: "spo2 > 94 && phase_elapsed > 60"
    resolve_snap: { hr: 82, spo2: 99 }
    resolve_events:
      - "✓ Tension pneumothorax decompressed — haemodynamics restoring"
---
# Tension Pneumothorax

## What happened
Tension pneumothorax following central line insertion caused progressive respiratory and haemodynamic compromise. Needle decompression was life-saving.

## Key learning points
- Diagnose clinically — do not delay for chest X-ray
- Classic signs: hypotension + hypoxia + tracheal deviation + absent unilateral breath sounds + raised JVP
- Immediate needle decompression: 2nd ICS midclavicular line OR 4th/5th ICS anterior axillary line
- Followed by chest drain insertion for definitive treatment

## QRH Reference: 2-2 Hypoxia / 2-4 Hypotension
