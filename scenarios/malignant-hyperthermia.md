---
id: malignant-hyperthermia
label: Malignant Hyperthermia
description: A 22-year-old undergoing general anaesthesia with sevoflurane develops MH crisis.
difficulty: hard
pack: "Core anaesthetic crises"
qrh: "3-8 Malignant Hyperthermia Crisis"

learning_objectives:
  - "Recognise MH early from rising ETCO₂ + tachycardia before the temperature spike"
  - "Stop the trigger first — turn the volatile off and flush the circuit"
  - "Give dantrolene without delay and repeat as needed"
  - "Complete the bundle: 100% high-flow oxygen, hyperventilate, cool"

critical_actions:
  - id: call-help
    label: "Call for help"
    within_sec: 60
    rationale: "MH management needs many hands — dantrolene mixing alone is a full-time job"
  - id: stop-trigger
    label: "Stop volatile agents"
    within_sec: 60
    rationale: "The crisis continues while the trigger is delivered (sevo slider to 0 also counts)"
  - id: dantrolene
    label: "Dantrolene 2.5 mg/kg"
    within_sec: 120
    rationale: "The only specific treatment — every minute of delay matters"
  - id: increase-fio2
    label: "100% oxygen, high flow"
    within_sec: 90
    rationale: "Flush volatile from the circuit and meet the metabolic demand"
  - id: increase-rr
    label: "Hyperventilate"
    within_sec: 120
    rationale: "Clear the CO₂ produced by the hypermetabolic state"

supporting_actions:
  - id: fluid-bolus
    label: "Cold IV fluids"
    rationale: "Active cooling and renal protection"
  - id: arterial-line
    label: "Arterial line"
    rationale: "Gas monitoring for acidosis and potassium"

references:
  - "Association of Anaesthetists QRH 3-8 Malignant Hyperthermia Crisis (June 2023)"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "ETCO₂ rising despite unchanged ventilation — think MH"
  - "Stop volatile agents immediately"
  - "Give dantrolene, hyperventilate, and start cooling"

initial_state:
  hr: 110
  etco2: 6.0
  temp: 37.5

initial_baseline:
  hr: 145
  etco2: 7.5
  temp: 38.5
  spo2: 95

phases:
  - id: onset
    label: "MH onset"
    baseline:
      hr: 145
      etco2: 7.5
      temp: 38.5
      spo2: 95
    events:
      - at: 15s
        text: "⚠ ETCO₂ and temperature rising — consider malignant hyperthermia"

  - id: untreated
    label: "Untreated crisis"
    enter_when: "time > 30 && !any('dantrolene')"
    enter_description: "No dantrolene given within 30 seconds"
    baseline:
      hr: 160
      etco2: 10.5
      temp: 40.5
      spo2: 80
    events:
      - at: 30s
        text: "⚠ Critical MH crisis — dantrolene required urgently"
    fail_when: "phase_elapsed > 90"
    fail_description: "Cardiac arrest after 90 seconds without dantrolene"
    fail_events:
      - "❌ Cardiac arrest — untreated malignant hyperthermia"
    fail_snap:
      ecgRhythm: vf
      hr: 0
      spo2: 0
      etco2: 0
      temp: 41.0

  - id: recovery
    label: "Recovery"
    enter_when: "any('dantrolene')"
    enter_description: "Dantrolene administered"
    baseline:
      hr: 85
      etco2: 5.0
      temp: 37.0
      spo2: 99
    events:
      - at: 120s
        text: "⚠ Hypermetabolic state persisting — review the bundle: trigger off, O₂, ventilation"
    hints_if_missing:
      stop-trigger: "💡 Is the volatile off? Stop the trigger (sevo to 0) and flush the circuit"
      increase-rr: "Consider hyperventilation to reduce ETCO₂"
      increase-fio2: "High-flow 100% oxygen flushes volatile from the circle"
    resolve_when: "phase_elapsed > 170 && fio2 >= 0.8 && rr >= 18 && (sevoflurane < 0.5 || any('stop-trigger'))"
    resolve_description: "Normalises after ~3 minutes once the volatile is off, dantrolene is in, FiO₂ is high, and ventilation is increased"
    resolve_events:
      - "✓ MH crisis controlled — dantrolene effective"
    resolve_snap:
      hr: 85
      spo2: 99
      etco2: 5.0
      temp: 37.0
---

# Malignant hyperthermia — debrief

Malignant hyperthermia (MH) is a pharmacogenetic emergency triggered by
volatile anaesthetic agents (and occasionally suxamethonium) in susceptible
individuals. The triad: rising ETCO₂, rising temperature, masseter rigidity.

## Recognition (early!)

- **Rising ETCO₂** despite unchanged minute ventilation — often the first sign.
- **Tachycardia** unexplained by depth of anaesthesia or surgical stimulus.
- **Masseter rigidity** with suxamethonium induction.
- **Rapidly rising temperature** — a *late* sign; don't wait for it.
- **Mixed metabolic + respiratory acidosis** on blood gas.

## Management bundle

1. **Stop all volatile agents.** Switch to TIVA (propofol) or stop the anaesthetic.
2. **High-flow O₂** at maximum fresh gas flow to flush volatiles from the circle.
3. **Hyperventilate** to clear CO₂ — increase respiratory rate and tidal volume.
4. **Dantrolene** 2.5 mg/kg IV bolus, repeat every 5–10 minutes up to 10 mg/kg
   total. The new formulation (Ryanodex 250 mg/vial) reconstitutes faster.
5. **Active cooling** — cold IV fluids, ice packs to groin/axillae, gastric/
   bladder lavage. Stop at 38.5 °C to avoid overshoot.
6. **Treat hyperkalaemia, acidosis, arrhythmias.** Call for help, divert away
   from theatre, plan ICU admission.

## Outcome modelled here

- Recognising the picture and giving dantrolene within 2 minutes pulls the
  patient back to a recovery trajectory; full normalisation takes ~3 minutes.
- Resolution requires the management bundle, not dantrolene alone: **stop the
  trigger** (Stop Trigger action, or sevoflurane slider to 0), FiO₂ ≥ 0.8
  (flush the volatile), and respiratory rate ≥ 18 (hyperventilation to clear
  CO₂) — set via the buttons or the machine sliders.
- Failure to give dantrolene within 2 minutes → cardiac arrest in VF at 41 °C.

*Timeline compressed for drilling — a real MH crisis evolves over 15–60
minutes, and dantrolene takes minutes to reconstitute and give.*
