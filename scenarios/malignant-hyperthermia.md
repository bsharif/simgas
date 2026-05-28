---
id: malignant-hyperthermia
label: Malignant Hyperthermia
description: A 22-year-old undergoing general anaesthesia with sevoflurane develops MH crisis.
difficulty: hard

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
    hints_if_missing:
      increase-rr: "Consider hyperventilation to reduce ETCO₂"
    resolve_when: "phase_elapsed > 170"
    resolve_description: "Vitals normalise after 170 seconds"
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
- The hint about hyperventilation fires once if the user hasn't increased RR.
- Failure to give dantrolene within 2 minutes → cardiac arrest in VF at 41 °C.
