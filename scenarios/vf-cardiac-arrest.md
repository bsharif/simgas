---
id: vf-cardiac-arrest
label: VF Cardiac Arrest
description: Sudden intraoperative ventricular fibrillation. ECG shows chaotic waveform, no pulse.
difficulty: hard
pack: "Cardiac arrest & arrhythmias"
qrh: "2-1 Cardiac Arrest"

learning_objectives:
  - "Declare the arrest, call for help, and start compressions within seconds"
  - "Shock VF early and re-shock in cycles — one shock rarely terminates it"
  - "Give arrest-dose adrenaline (1 mg) and amiodarone per ALS timing"

critical_actions:
  - id: call-help
    label: "Declare the arrest / call for help"
    within_sec: 20
    rationale: "Crash trolley, defibrillator, and team roles all start with the call"
  - id: cpr
    label: "Start CPR"
    within_sec: 30
    rationale: "Compressions within 10 seconds of recognising arrest"
  - id: defibrillate
    label: "Defibrillate"
    within_sec: 90
    rationale: "VF survival falls ~10% per minute without a shock"

supporting_actions:
  - id: adrenaline-cardiac
    label: "Adrenaline 1 mg (arrest dose)"
    rationale: "After the 3rd shock, then every 3–5 minutes — NOT the anaesthetic microdoses"
  - id: amiodarone
    label: "Amiodarone 300 mg"
    rationale: "For refractory VF after the 3rd shock"
  - id: increase-fio2
    label: "100% oxygen"

references:
  - "Association of Anaesthetists QRH 2-1 Cardiac Arrest (June 2023)"
  - "Resuscitation Council UK ALS algorithm"
guideline_version: "QRH June 2023"
author: "SimGas contributors"
last_reviewed: "2026-06-11"

hints:
  - "Declare cardiac arrest — start CPR immediately"
  - "Call for defibrillator and cardiac arrest trolley"
  - "Shock, resume CPR, re-shock — adrenaline 1 mg after the 3rd shock"

initial_state:
  hr: 75
  spo2: 99
  etco2: 4.8

phases:
  - id: arrest
    label: "Cardiac arrest"
    snap: { ecgRhythm: vf, hr: 0, nibp: { sys: 0, dia: 0, map: 0 } }
    baseline: { spo2: 50, etco2: 1.5 }
    events:
      - at: 2s
        text: "⚠ CARDIAC ARREST — VF on monitor. No pulse."
    fail_when: "phase_elapsed > 30 && !any('cpr')"
    fail_description: "Fatal outcome if no CPR started within 30 seconds"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ No CPR started — patient outcome fatal"

  - id: cpr-active
    label: "CPR in progress"
    enter_when: "any('cpr')"
    enter_description: "CPR started"
    baseline: { spo2: 70, etco2: 2.5 }
    events:
      - at: 5s
        text: "⚠ ETCO₂ 2.5 kPa on compressions — perfusion is from CPR only. Rhythm remains VF."
    hints_if_missing:
      defibrillate: "💡 VF is shockable — charge and deliver a shock, then resume compressions"
    fail_when: "phase_elapsed > 120 && !any('defibrillate')"
    fail_description: "VF deteriorates to asystole if not defibrillated"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ VF not shocked — deteriorated to asystole"

  - id: shocked-once
    label: "After first shock"
    enter_when: "count('defibrillate') == 1 && any('cpr')"
    enter_description: "First shock delivered with CPR ongoing"
    snap: { ecgRhythm: vf }
    baseline: { spo2: 72, etco2: 2.6 }
    events:
      - at: 3s
        text: "⚠ Rhythm check: VF persists after the first shock — resume compressions, charge again"
    hints_if_missing:
      adrenaline-cardiac: "💡 Prepare adrenaline 1 mg — due after the 3rd shock"
      amiodarone: "💡 Prepare amiodarone 300 mg for refractory VF"
    fail_when: "phase_elapsed > 150 && count('defibrillate') < 2"
    fail_description: "Refractory VF degenerates without further shocks"
    fail_snap: { ecgRhythm: asystole }
    fail_events:
      - "❌ Single-shock fixation — VF degenerated to asystole"

  - id: rosc
    label: "Return of spontaneous circulation"
    enter_when: "count('defibrillate') >= 2 && any('cpr')"
    enter_description: "At least two shocks delivered with CPR between cycles"
    snap: { ecgRhythm: sinus, hr: 55 }
    baseline: { hr: 78, spo2: 96, etco2: 4.5, nibp: { sys: 95, dia: 60, map: 72 } }
    resolve_when: "spo2 > 90 && phase_elapsed > 60"
    resolve_description: "Sinus rhythm sustained after 60 seconds"
    resolve_snap: { hr: 80, spo2: 97, etco2: 4.8 }
    resolve_events:
      - "✓ Return of spontaneous circulation — maintain anaesthesia, start post-resuscitation care"
---
# VF Cardiac Arrest

## What happened
Ventricular fibrillation caused sudden intraoperative cardiac arrest. CPR with repeated defibrillation achieved return of spontaneous circulation (ROSC).

## Key learning points
- Declare cardiac arrest immediately — chest compressions within 10 seconds
- Continue compressions while charging the defibrillator
- Biphasic shock 150–200 J; resume CPR immediately after each shock — do not pause for a pulse check
- One shock rarely terminates VF: re-assess and re-shock in 2-minute cycles
- **Adrenaline 1 mg IV** after the 3rd shock (the arrest dose — not anaesthetic 10–100 mcg boluses); repeat every 3–5 minutes
- Amiodarone 300 mg after the 3rd shock for refractory VF
- ETCO₂ >2 kPa during CPR confirms effective compressions

## Outcome modelled here
- ROSC requires CPR **plus at least two shocks** — the first shock leaves the
  patient in VF, as it usually does in reality.
- No CPR in 30 s, or single-shock fixation, ends in asystole.

*Timeline compressed for drilling — real ALS runs in 2-minute cycles, so the
same decision sequence takes 6–10 minutes.*

## QRH Reference: 2-1 Cardiac Arrest
