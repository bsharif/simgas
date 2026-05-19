---
id: oesophageal-intubation
label: Oesophageal Intubation
description: After routine intubation, ETCO₂ is falling. Is the tube in the oesophagus?
difficulty: easy

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
    baseline:
      etco2: 0.2
      spo2: 80
      hr: 110
    events:
      - at: 5s
        text: "⚠ ETCO₂ dropping rapidly — check tube position"

  - id: untreated
    enter_when: "tube_position != 'trachea' && time > 5"
    baseline:
      etco2: 0.2
      spo2: 65
      hr: 40
    events:
      - at: 35s
        text: "⚠ Bradycardia developing — severe hypoxia"
    fail_when: "phase_elapsed > 85"
    fail_events:
      - "❌ Cardiac arrest due to unrecognised oesophageal intubation"
    fail_snap:
      ecgRhythm: asystole
      hr: 0
      spo2: 0
      etco2: 0

  - id: recovery
    enter_when: "tube_position == 'trachea'"
    baseline:
      etco2: 5.0
      spo2: 99
      hr: 90
    resolve_when: "phase_elapsed > 25"
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
- Failure to fix the tube within 90 seconds → cardiac arrest.
