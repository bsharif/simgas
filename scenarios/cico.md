---
id: cico
label: "CICO (Can't Intubate, Can't Oxygenate)"
description: Failed rapid sequence induction. Two intubation attempts failed, rescue SGA and face-mask ventilation are failing. SpO₂ falling.
difficulty: hard
pack: "Airway emergencies"
qrh: "DAS guideline — CICO / eFONA"

learning_objectives:
  - "Recognise failure of each airway plan and move ON, not back"
  - "Declare CICO out loud — naming it triggers the rescue algorithm"
  - "Perform scalpel cricothyroidotomy before hypoxic arrest, not after"
  - "Task fixation on laryngoscopy kills — limit attempts and escalate"

critical_actions:
  - id: call-help
    label: "Call for help"
    within_sec: 20
    rationale: "Declare the failed airway early — FONA needs a team"
  - id: increase-fio2
    label: "100% oxygen throughout"
    within_sec: 20
    rationale: "Every attempt must happen on maximal oxygen"
  - id: cricothyroidotomy
    label: "Front-of-neck access (scalpel cricothyroidotomy)"
    within_sec: 110
    rationale: "The only remaining route for oxygen — delay is hypoxic arrest"

supporting_actions:
  - id: sga
    label: "Rescue SGA attempt (Plan B)"
    rationale: "Attempt it before front-of-neck — its failure is what confirms CICO"
  - id: jaw-thrust
    label: "Optimise face-mask attempt (jaw thrust)"
  - id: guedel
    label: "Oropharyngeal airway"
  - id: suxamethonium
    label: "Ensure full paralysis"
    rationale: "Exclude inadequate relaxation before cutting"

dangerous_actions:
  - id: "intubate|re-intubate"
    label: "Repeated laryngoscopy attempts"
    rationale: "Task fixation — further attempts traumatise the airway and burn the remaining oxygen"

references:
  - "Difficult Airway Society 2015 guidelines — unanticipated difficult intubation / CICO"
  - "Association of Anaesthetists QRH (June 2023)"
guideline_version: "DAS 2015 / QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Plan B: rescue SGA on 100% oxygen — call for help now"
  - "SGA failing too? Declare CICO out loud"
  - "Scalpel cricothyroidotomy: scalpel–bougie–tube. Do it before the arrest."

initial_state:
  tubePosition: none
  spo2: 93
  hr: 96
  etco2: 0.5

phases:
  - id: failed-intubation
    label: "Failed intubation"
    snap: { capnographyShape: absent, airwayObstructed: true }
    baseline: { spo2: 82, hr: 112 }
    events:
      - at: 3s
        text: "⚠ Second intubation attempt failed — no view, no capnograph trace"
      - at: 12s
        text: "⚠ SpO₂ falling through 90% — face-mask ventilation difficult"
    hints_if_missing:
      call-help: "💡 Declare the failed airway and call for help"
      sga: "💡 Plan B: place a rescue SGA"

  - id: rescue-failing
    label: "Rescue attempts failing"
    enter_when: "time > 25"
    enter_description: "SGA and optimised face-mask attempts are not achieving ventilation"
    baseline: { spo2: 68, hr: 128 }
    events:
      - at: 3s
        text: "⚠ No capnograph trace with SGA or face mask — this is CICO"

  - id: cico-declared
    label: "CICO — peri-arrest"
    enter_when: "time > 45"
    enter_description: "Oxygenation has failed by every upper-airway route"
    baseline: { spo2: 48, hr: 52 }
    events:
      - at: 3s
        text: "⚠ SpO₂ below 60% with bradycardia — hypoxic arrest imminent"
    hints_if_missing:
      cricothyroidotomy: "💡 Front-of-neck access NOW — scalpel cricothyroidotomy"
    fail_when: "phase_elapsed > 45 && !any('cricothyroidotomy')"
    fail_description: "Hypoxic cardiac arrest without front-of-neck access"
    fail_snap: { ecgRhythm: asystole, hr: 0, spo2: 0 }
    fail_events:
      - "❌ Hypoxic cardiac arrest — CICO without front-of-neck access"

  - id: rescued
    label: "Front-of-neck airway established"
    enter_when: "any('cricothyroidotomy')"
    enter_description: "Scalpel cricothyroidotomy performed"
    snap: { capnographyShape: normal, airwayObstructed: false }
    baseline: { spo2: 96, hr: 95, etco2: 5.2 }
    resolve_when: "spo2 > 90 && phase_elapsed > 40 && fio2 >= 0.8"
    resolve_description: "Re-oxygenated via the surgical airway on 100% oxygen"
    resolve_snap: { hr: 88, spo2: 97, etco2: 5.0 }
    resolve_events:
      - "✓ Oxygenation restored via front-of-neck access — plan definitive airway and debrief the team"
---
# Can't Intubate, Can't Oxygenate (CICO)

## What happened
A rapid sequence induction failed: two laryngoscopy attempts, then a rescue
SGA and optimised face-mask ventilation all failed to oxygenate. The patient
desaturated towards hypoxic arrest until a scalpel cricothyroidotomy
re-established oxygenation.

## Key learning points
- Follow the plan ladder and **move forward**: Plan A laryngoscopy (max 3
  attempts, ideally 2) → Plan B SGA → Plan C face mask → Plan D front-of-neck.
- **Declare CICO out loud.** The team cannot follow an algorithm nobody has
  named.
- Scalpel cricothyroidotomy: scalpel — bougie — tube. Kit and technique should
  be rehearsed before you ever need them.
- Ensure full paralysis before front-of-neck access — laryngospasm and light
  anaesthesia mimic CICO.
- Task fixation (returning to laryngoscopy again and again) is the classic
  fatal error and is flagged as a harmful action here.

## Outcome modelled here
- Bag squeezes are recorded but move no gas — the airway is genuinely
  obstructed, so spam-bagging cannot rescue this one.
- Only front-of-neck access resolves the case; it must be done on 100% oxygen
  and before the 45-second peri-arrest window closes.

*Timeline compressed for drilling — with good pre-oxygenation a real CICO
gives you several minutes, not 90 seconds. The decision sequence is the same.*

## Reference: DAS 2015 unanticipated difficult airway guidelines
