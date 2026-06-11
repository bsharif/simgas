---
id: bradycardia
label: Severe Bradycardia
description: Profound vagal bradycardia during peritoneal traction. HR falling through 40 with hypotension.
difficulty: easy
pack: "Cardiac arrest & arrhythmias"
qrh: "2-6 Bradycardia"

learning_objectives:
  - "Treat the cause first: stop the vagal stimulus"
  - "Give atropine for haemodynamically significant bradycardia"
  - "Escalate to adrenaline / pacing if refractory; CPR if HR < 30 with no output"

critical_actions:
  - id: stop-trigger
    label: "Ask the surgeon to stop (remove the vagal stimulus)"
    within_sec: 30
    rationale: "The reflex continues as long as the traction does"
  - id: atropine
    label: "Atropine 600 mcg"
    within_sec: 60
    rationale: "First-line drug for symptomatic bradycardia"

supporting_actions:
  - id: call-help
    label: "Call for help"
  - id: increase-fio2
    label: "100% oxygen"
  - id: adrenaline-1
    label: "Adrenaline (small boluses) if refractory"
  - id: cpr
    label: "CPR if no output"

references:
  - "Association of Anaesthetists QRH 2-6 Bradycardia (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Tell the surgeon to stop — the traction is the trigger"
  - "Atropine 600 mcg IV, repeat as needed"
  - "Refractory? Adrenaline boluses, prepare pacing, CPR if HR < 30 with no output"

initial_state:
  hr: 75
  nibp: { sys: 118, dia: 74, map: 89 }
  spo2: 99
  etco2: 4.8

phases:
  - id: onset
    label: "Vagal bradycardia"
    snap: { hr: 52 }
    baseline: { hr: 38, nibp: { sys: 85, dia: 52, map: 63 } }
    events:
      - at: 3s
        text: "→ Surgeon applying peritoneal traction"
      - at: 8s
        text: "⚠ HR falling rapidly — 45... 40... BP following"
    hints_if_missing:
      stop-trigger: "💡 The traction is the trigger — ask the surgeon to stop"

  - id: profound
    label: "Profound bradycardia"
    enter_when: "time > 25 && !any('atropine') && !any('stop-trigger')"
    enter_description: "No atropine and the stimulus continues after 25 seconds"
    baseline: { hr: 26, nibp: { sys: 58, dia: 34, map: 42 }, spo2: 94 }
    events:
      - at: 5s
        text: "⚠ HR below 30 — peri-arrest. Output barely palpable."
    hints_if_missing:
      atropine: "💡 Atropine 600 mcg IV now"
    fail_when: "phase_elapsed > 60"
    fail_description: "Untreated profound bradycardia arrests in asystole"
    fail_snap: { ecgRhythm: asystole, hr: 0, spo2: 0, nibp: { sys: 0, dia: 0, map: 0 } }
    fail_events:
      - "❌ Asystolic arrest — vagal bradycardia untreated"

  - id: recovery
    label: "Recovery"
    enter_when: "any('atropine') || any('stop-trigger')"
    enter_description: "Stimulus stopped or atropine given"
    baseline: { hr: 72, nibp: { sys: 110, dia: 70, map: 83 }, spo2: 99 }
    events:
      - at: 75s
        text: "⚠ Rate creeping down again — the stimulus has not been addressed"
    hints_if_missing:
      stop-trigger: "💡 Atropine is masking the reflex — the surgeon must still stop"
    resolve_when: "hr > 55 && phase_elapsed > 40 && any('stop-trigger')"
    resolve_description: "Stable once the stimulus is removed and the rate recovers"
    resolve_snap: { hr: 74, spo2: 99 }
    resolve_events:
      - "✓ Stimulus removed, rate recovered — discuss prophylaxis before further traction"
---
# Severe Bradycardia

## What happened
Peritoneal traction triggered a profound vagal reflex — heart rate fell below
30 bpm with hypotension. Stopping the stimulus and giving atropine restored
the circulation.

## Key learning points
- **Treat the cause**: surgical traction (peritoneum, eye muscles, cervix)
  drives vagal reflexes — ask the surgeon to stop *first*; it is faster than
  any drug.
- Atropine 600 mcg IV for haemodynamically significant bradycardia; repeat to
  a maximum of 3 mg.
- Refractory bradycardia: adrenaline in small boluses, isoprenaline, or
  transcutaneous pacing.
- HR < 30 with no palpable output = peri-arrest: treat as arrest and start CPR.
- Anticipate: prophylactic glycopyrrolate before high-vagal-stimulus surgery.

## Outcome modelled here
- Atropine alone buys the rate back, but the case does not resolve until the
  stimulus is stopped — the reflex returns while the traction continues.

*Timeline compressed for drilling — a real vagal bradycardia can arrest in
under a minute, much like the sim.*

## QRH Reference: 2-6 Bradycardia
