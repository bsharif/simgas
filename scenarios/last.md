---
id: last
label: LAST (LA Toxicity)
description: Local anaesthetic systemic toxicity following peripheral nerve block. Seizure, then cardiovascular collapse with refractory arrhythmia.
difficulty: hard
pack: "Core anaesthetic crises"
qrh: "3-10 Local Anaesthetic Toxicity"

learning_objectives:
  - "Recognise the prodrome: metallic taste, tinnitus, perioral tingling, agitation"
  - "Stop the injection, call for the lipid rescue pack, control the seizure"
  - "Give lipid emulsion early and keep giving it — one bolus is not enough"
  - "Avoid arrest-dose adrenaline — it worsens LA-induced arrhythmias"

critical_actions:
  - id: stop-trigger
    label: "Stop the LA injection/infusion"
    within_sec: 20
    rationale: "Every additional milligram deepens the toxicity"
  - id: call-help
    label: "Call for help + lipid rescue pack"
    within_sec: 30
    rationale: "Intralipid lives outside theatre — someone must fetch it now"
  - id: midazolam
    label: "Control the seizure (midazolam)"
    within_sec: 45
    rationale: "Seizing increases oxygen demand and acidosis, worsening toxicity"
  - id: intralipid
    label: "Intralipid 20% bolus"
    within_sec: 75
    rationale: "Lipid rescue is the specific antidote"

supporting_actions:
  - id: cpr
    label: "CPR if pulseless"
  - id: increase-fio2
    label: "100% oxygen"

dangerous_actions:
  - id: adrenaline-cardiac
    label: "Arrest-dose adrenaline (1 mg)"
    rationale: "Doses >1 mcg/kg worsen LA-induced arrhythmias — use small boluses only"

references:
  - "Association of Anaesthetists QRH 3-10 Local Anaesthetic Toxicity (June 2023)"
  - "AAGBI Safety Guideline: Management of Severe Local Anaesthetic Toxicity"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "STOP the local anaesthetic infusion immediately"
  - "Control the seizure with midazolam; call for the lipid rescue pack"
  - "Intralipid 20% bolus, then keep it running — avoid adrenaline >1 mcg/kg"

initial_state:
  hr: 76
  nibp: { sys: 120, dia: 76, map: 91 }
  spo2: 99
  etco2: 4.8

phases:
  - id: prodrome
    label: "Prodrome"
    baseline: { hr: 95, nibp: { sys: 100, dia: 62, map: 75 } }
    events:
      - at: 5s
        text: "⚠ Patient reports metallic taste and tinnitus — possible LAST"
      - at: 10s
        text: "⚠ Agitation, perioral tingling — escalating LAST"
    hints_if_missing:
      stop-trigger: "💡 Stop the local anaesthetic injection NOW"
      call-help: "💡 Call for help and the lipid rescue pack"

  - id: seizure
    label: "Seizure"
    enter_when: "time > 14 && !any('midazolam')"
    enter_description: "Generalised seizure 14 seconds after prodrome, untreated"
    baseline: { hr: 128, nibp: { sys: 92, dia: 58, map: 70 }, spo2: 91 }
    events:
      - at: 2s
        text: "⚠ Generalised tonic-clonic seizure — protect the patient, give a benzodiazepine"
    hints_if_missing:
      midazolam: "💡 Midazolam 2 mg IV to terminate the seizure"

  - id: seizure-controlled
    label: "Seizure controlled"
    enter_when: "any('midazolam') && time > 14"
    enter_description: "Benzodiazepine given"
    baseline: { hr: 105, nibp: { sys: 98, dia: 62, map: 74 }, spo2: 95 }
    events:
      - at: 2s
        text: "→ Seizure terminated — LA load is still circulating, watch the ECG"

  - id: cardiovascular-collapse
    label: "Cardiovascular collapse"
    enter_when: "time > 35"
    enter_description: "The circulating LA load reaches the myocardium"
    snap: { ecgRhythm: vt, hr: 160 }
    baseline: { hr: 160, nibp: { sys: 55, dia: 30, map: 38 }, spo2: 82 }
    events:
      - at: 3s
        text: "⚠ VT on monitor — LAST cardiovascular collapse. Lipid rescue NOW."
    fail_when: "phase_elapsed > 30 && !any('intralipid') && !any('cpr')"
    fail_description: "Cardiac arrest without lipid rescue or CPR"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Refractory VT — no lipid rescue initiated"

  - id: cpr-arrest
    label: "CPR in progress"
    enter_when: "any('cpr') && !any('intralipid') && time > 35"
    enter_description: "CPR started without intralipid"
    snap: { ecgRhythm: vf }
    baseline: { hr: 0, nibp: { sys: 0, dia: 0, map: 0 }, spo2: 55 }
    hints_if_missing:
      intralipid: "💡 CPR alone won't reverse LAST — get the lipid in"
    fail_when: "phase_elapsed > 120"
    fail_description: "Prolonged arrest without the antidote"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Arrest without lipid rescue — asystole"

  - id: adrenaline-storm
    label: "Adrenaline-aggravated arrhythmia"
    enter_when: "any('adrenaline-cardiac') && !any('intralipid')"
    enter_description: "Arrest-dose adrenaline given before lipid"
    snap: { ecgRhythm: vf }
    baseline: { hr: 0, nibp: { sys: 0, dia: 0, map: 0 }, spo2: 50 }
    events:
      - at: 2s
        text: "❌ High-dose adrenaline on a LA-poisoned myocardium — refractory VF"
    fail_when: "phase_elapsed > 60"
    fail_description: "Adrenaline-aggravated VF is rapidly fatal without lipid"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Refractory VF after high-dose adrenaline — asystole"

  - id: lipid-rescue
    label: "Lipid rescue"
    enter_when: "any('intralipid')"
    enter_description: "Intralipid administered"
    snap: { ecgRhythm: sinus, hr: 72 }
    baseline: { hr: 80, nibp: { sys: 108, dia: 68, map: 81 }, spo2: 96 }
    events:
      - at: 30s
        text: "⚠ LA toxicity persists for over an hour — continue lipid (repeat bolus / infusion)"
    resolve_when: "spo2 > 93 && phase_elapsed > 90 && count('intralipid') >= 2 && any('stop-trigger')"
    resolve_description: "Rhythm holds once the LA source is stopped, after a second lipid dose and 90 seconds of stability"
    resolve_snap: { hr: 78, spo2: 99 }
    resolve_events:
      - "✓ Lipid emulsion effective — rhythm restored, continue infusion and monitoring"
---
# Local Anaesthetic Systemic Toxicity (LAST)

## What happened
Local anaesthetic systemic toxicity progressed through the classic sequence — CNS prodrome, seizure, then cardiovascular collapse with VT. Lipid emulsion therapy reversed the toxicity.

## Key learning points
- Prodromal CNS features: metallic taste, tinnitus, perioral tingling, agitation — **stop injecting** at the first sign
- Seizures: terminate with a benzodiazepine (midazolam); hypoxia and acidosis worsen toxicity
- Intralipid 20%: 1.5 ml/kg bolus then 15 ml/kg/hr infusion — repeat boluses up to 3 times; call for the lipid rescue pack early
- Use small adrenaline doses (≤1 mcg/kg) if arrested — **avoid the standard 1 mg arrest dose**, it aggravates LA-induced arrhythmias
- Recovery may take >1 hour — continue lipid infusion and monitoring

## Outcome modelled here
- Early midazolam skips the seizure phase; the cardiovascular collapse still
  follows (the LA load is already in the circulation).
- Resolution requires the LA source to be **stopped** and a **second**
  intralipid dose — one bolus stabilises but does not finish the case.
- Giving arrest-dose adrenaline (1 mg) before lipid converts the VT into
  refractory VF — still rescuable with intralipid, but recorded as harm.

*Timeline compressed for drilling — real LAST evolves over minutes and the
lipid infusion runs for an hour or more.*

## QRH Reference: 3-10 Local Anaesthetic Toxicity
