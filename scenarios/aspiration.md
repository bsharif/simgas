---
id: aspiration
label: Aspiration on Induction
description: Regurgitation of gastric contents during induction with an unprotected airway. Hypoxia and contaminated airway.
difficulty: medium
pack: "Airway emergencies"
qrh: "Aspiration / regurgitation at induction"

learning_objectives:
  - "Clear the airway FIRST — suction before any positive-pressure breath"
  - "Secure the airway with a cuffed tube and ventilate with PEEP"
  - "Recognise that bagging a soiled pharynx pushes aspirate into the lungs"

critical_actions:
  - id: suction
    label: "Suction the pharynx"
    within_sec: 30
    rationale: "Clearing the airway comes before everything else"
  - id: intubate
    label: "Intubate (cuffed tube)"
    within_sec: 90
    rationale: "The cuff protects against ongoing aspiration"
  - id: increase-fio2
    label: "100% oxygen"
    within_sec: 60
    rationale: "Aspiration pneumonitis causes shunt — maximise FiO₂"

supporting_actions:
  - id: call-help
    label: "Call for help"
  - id: peep-up
    label: "Apply PEEP (≥ 8)"
    rationale: "Recruits flooded alveoli — button or ventilator dial both count"

dangerous_actions:
  - id: manual-vent
    label: "Positive-pressure breaths before suctioning"
    rationale: "Bagging a soiled pharynx disseminates aspirate into the bronchial tree"

references:
  - "Association of Anaesthetists QRH (June 2023)"
  - "NAP4 — major complications of airway management"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Head down, suction the pharynx — do NOT bag yet"
  - "Intubate with a cuffed tube once the pharynx is clear"
  - "100% O₂ and PEEP for the pneumonitis"

initial_state:
  tubePosition: none
  hr: 92
  spo2: 95
  etco2: 4.6
  nibp: { sys: 115, dia: 72, map: 86 }

phases:
  - id: onset
    label: "Regurgitation"
    baseline: { spo2: 87, hr: 112, rr: 22 }
    events:
      - at: 3s
        text: "⚠ Gastric contents in the oropharynx — patient supine, airway unprotected"
      - at: 12s
        text: "⚠ SpO₂ falling — coarse crepitations at the right base"
    hints_if_missing:
      suction: "💡 Suction the pharynx before anything else"

  - id: soiling
    label: "Untreated soiling"
    enter_when: "time > 30 && !any('suction')"
    enter_description: "Airway not cleared within 30 seconds"
    snap: { capnographyShape: bronchospasm }
    baseline: { spo2: 76, hr: 126 }
    fail_when: "phase_elapsed > 75"
    fail_description: "Massive aspiration with refractory hypoxia"
    fail_snap: { ecgRhythm: asystole, hr: 0, spo2: 0 }
    fail_events:
      - "❌ Massive aspiration — hypoxic arrest"

  - id: contaminated
    label: "Aspirate driven distally"
    enter_when: "count('manual-vent') >= 2 && !any('suction')"
    enter_description: "Positive-pressure breaths delivered before the pharynx was cleared"
    snap: { capnographyShape: bronchospasm }
    baseline: { spo2: 66, hr: 138 }
    events:
      - at: 2s
        text: "⚠ Each breath pushes aspirate deeper — airway pressures rising, SpO₂ falling fast"
    fail_when: "phase_elapsed > 60"
    fail_description: "Disseminated aspiration — refractory hypoxia and arrest"
    fail_snap: { ecgRhythm: asystole, hr: 0, spo2: 0 }
    fail_events:
      - "❌ Aspirate disseminated by positive pressure — hypoxic arrest"

  - id: secured
    label: "Airway cleared and secured"
    enter_when: "any('suction') && tube_position == 'trachea'"
    enter_description: "Pharynx suctioned and cuffed tube placed"
    snap: { capnographyShape: normal }
    baseline: { spo2: 94, hr: 100, etco2: 4.8 }
    events:
      - at: 70s
        text: "⚠ Persisting shunt from pneumonitis — oxygen and PEEP still needed"
    hints_if_missing:
      increase-fio2: "💡 100% oxygen for the pneumonitis"
      peep-up: "💡 Add PEEP (≥ 8) to recruit flooded alveoli"
    resolve_when: "spo2 > 92 && phase_elapsed > 60 && fio2 >= 0.6 && peep >= 8"
    resolve_description: "Stable once tubed with high FiO₂ and PEEP ≥ 8"
    resolve_snap: { hr: 92, spo2: 96 }
    resolve_events:
      - "✓ Airway protected, oxygenation recovering — plan bronchoscopy/ICU review"
---
# Aspiration on Induction

## What happened
Gastric contents regurgitated during induction with an unprotected airway.
The pharynx was suctioned, the trachea intubated with a cuffed tube, and the
resulting pneumonitis managed with oxygen and PEEP.

## Key learning points
- **Suction first.** A positive-pressure breath through a soiled pharynx
  disseminates aspirate into the bronchial tree — modelled here as a sharply
  worse trajectory.
- Head-down tilt and lateral positioning reduce further soiling.
- Secure the airway with a **cuffed** tube as soon as the pharynx is clear;
  suction down the tube before ventilating if soiling was significant.
- Manage the pneumonitis supportively: 100% O₂, PEEP, bronchoscopy for
  particulate aspiration. Prophylactic antibiotics and steroids are *not*
  routinely indicated.
- Prevention beats treatment: fasting, rapid sequence induction, cricoid
  pressure where indicated.

## Outcome modelled here
- Resolution requires the full sequence: suction → intubate → FiO₂ ≥ 0.6 with
  PEEP ≥ 8 (PEEP button or the ventilator dial both count).
- Bagging before suctioning enters a faster-failing trajectory and is flagged
  as a harmful action in the debrief.

*Timeline compressed for drilling — real aspiration physiology evolves over
10–30 minutes.*

## Reference: QRH June 2023; NAP4
