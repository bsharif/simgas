---
id: oesophageal-intubation
label: Oesophageal Intubation
description: After routine intubation, ETCO₂ is falling. Is the tube in the oesophagus?
difficulty: easy
pack: "Airway emergencies"
qrh: "Key basic plan / sustained ETCO₂ absence"

learning_objectives:
  - "Treat absent or falling ETCO₂ after intubation as oesophageal until proven otherwise"
  - "If in doubt, take it out: extubate, oxygenate, re-intubate"
  - "Confirm placement with a sustained capnograph trace"

critical_actions:
  - id: "re-intubate|extubate"
    label: "Remove the misplaced tube (extubate or re-intubate)"
    within_sec: 45
    rationale: "Nothing else works while the tube is in the oesophagus"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 60
    rationale: "Re-oxygenate while sorting the airway"

supporting_actions:
  - id: manual-vent
    label: "Bag-mask ventilation between attempts"
  - id: call-help
    label: "Call for help"

references:
  - "Association of Anaesthetists QRH (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Watch the capnography trace — is there a plateau?"
  - "Check for chest rise and breath sounds"
  - "If ETCO₂ is zero, extubate, ventilate with 100% O₂, and re-intubate"

initial_state:
  tubePosition: oesophagus
  spo2: 99
  hr: 78
  etco2: 4.5

initial_baseline:
  etco2: 0.2
  spo2: 80
  hr: 110

phases:
  - id: onset
    label: "Oesophageal intubation"
    snap: { capnographyShape: absent }
    baseline:
      etco2: 0.2
      spo2: 80
      hr: 110
    events:
      - at: 5s
        text: "⚠ ETCO₂ dropping rapidly — check tube position"

  - id: untreated
    label: "Untreated"
    enter_when: "tube_position != 'trachea' && time > 5"
    enter_description: "Tube not correctly positioned in trachea after 5 seconds"
    snap: { capnographyShape: absent }
    baseline:
      etco2: 0.2
      spo2: 65
      hr: 40
    events:
      - at: 35s
        text: "⚠ Bradycardia developing — severe hypoxia"
    fail_when: "phase_elapsed > 85"
    fail_description: "Cardiac arrest after 85 seconds with tube misplaced"
    fail_events:
      - "❌ Cardiac arrest due to unrecognised oesophageal intubation"
    fail_snap:
      ecgRhythm: asystole
      hr: 0
      spo2: 0
      etco2: 0

  - id: recovery
    label: "Recovery"
    enter_when: "tube_position == 'trachea'"
    enter_description: "Tube correctly placed in trachea"
    snap: { capnographyShape: normal }
    baseline:
      etco2: 5.0
      spo2: 99
      hr: 90
    hints_if_missing:
      manual-vent: "💡 Bag with 100% O₂ — re-oxygenate while confirming placement"
      increase-fio2: "💡 100% oxygen until SpO₂ has fully recovered"
    resolve_when: "phase_elapsed > 25 && spo2 > 88 && fio2 >= 0.8"
    resolve_description: "Stable capnography once re-oxygenated (SpO₂ > 88% on 100% O₂)"
    resolve_events:
      - "✓ ETCO₂ returned — tube correctly placed in trachea"
    resolve_snap:
      hr: 90
      spo2: 99
      etco2: 5.0
---

# Oesophageal intubation — debrief

The single most reliable indicator of correct endotracheal tube placement is a
sustained capnograph trace. ETCO₂ falling to zero after intubation must be
treated as **oesophageal until proven otherwise** — auscultation and chest
rise can both deceive.

## Recognition

- Sustained ETCO₂ < 0.5 kPa after several breaths
- No capnograph plateau / flat trace
- Falling SpO₂ (delayed by FRC oxygenation)
- Bradycardia is a late and ominous sign

## Management

1. **If in doubt, take it out.** Extubate immediately.
2. **Bag-mask ventilate** with 100% O₂ until SpO₂ recovers.
3. **Re-intubate** under direct laryngoscopy / videolaryngoscopy.
4. **Confirm placement** — capnograph trace + auscultation + chest movement.
5. Consider a second pair of hands and call for help early.

## Outcome modelled here

- Pressing Intubate while the tube is already in (oesophagus) fires a warning
  rather than progressing the scenario.
- Extubate → Re-intubate sequence (or the Re-intubate shortcut) returns
  tubePosition to trachea, ETCO₂ recovers, SpO₂ recovers.
- Resolution requires re-oxygenation (SpO₂ > 88%) — if placement was fixed
  late, bag with 100% O₂ rather than waiting.
- Failure to fix the tube within 90 seconds → cardiac arrest.

*Timeline compressed for drilling — FRC pre-oxygenation buys several minutes
in reality before desaturation this severe.*
