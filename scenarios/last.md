---
id: last
label: LAST (LA Toxicity)
description: Local anaesthetic systemic toxicity following peripheral nerve block. Cardiovascular collapse with refractory arrhythmia.
difficulty: hard
hints:
  - "STOP the local anaesthetic infusion immediately"
  - "Call for lipid rescue pack — give Intralipid 20% bolus"
  - "Avoid adrenaline >1 mcg/kg in LAST arrest — use intralipid"

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
      - at: 12s
        text: "⚠ Agitation, perioral tingling — escalating LAST"

  - id: cardiovascular-collapse
    label: "Cardiovascular collapse"
    enter_when: "time > 20"
    enter_description: "20 seconds after prodrome onset"
    snap: { ecgRhythm: vt, hr: 160 }
    baseline: { hr: 160, nibp: { sys: 55, dia: 30, map: 38 }, spo2: 82 }
    events:
      - at: 5s
        text: "⚠ VT on monitor — LAST cardiovascular collapse. CALL FOR LIPID RESCUE."
    fail_when: "phase_elapsed > 30 && !any('intralipid') && !any('cpr')"
    fail_description: "Cardiac arrest without lipid rescue or CPR"
    fail_snap: { ecgRhythm: vf }
    fail_events:
      - "❌ Refractory VT — no lipid rescue initiated"

  - id: lipid-rescue
    label: "Lipid rescue"
    enter_when: "any('intralipid')"
    enter_description: "Intralipid administered"
    snap: { ecgRhythm: sinus, hr: 72 }
    baseline: { hr: 80, nibp: { sys: 108, dia: 68, map: 81 }, spo2: 96 }
    resolve_when: "spo2 > 93 && phase_elapsed > 90"
    resolve_description: "Rhythm restored after 90 seconds"
    resolve_snap: { hr: 78, spo2: 99 }
    resolve_events:
      - "✓ Intralipid effective — cardiac rhythm restored"

  - id: cpr-arrest
    label: "CPR in progress"
    enter_when: "any('cpr') && !any('intralipid')"
    enter_description: "CPR started without intralipid"
    snap: { ecgRhythm: vf }
    baseline: { hr: 0, nibp: { sys: 0, dia: 0, map: 0 }, spo2: 55 }
    resolve_when: "any('intralipid') && phase_elapsed > 30"
    resolve_description: "Intralipid given during CPR restores rhythm"
    resolve_snap: { ecgRhythm: sinus, hr: 65, spo2: 92 }
    resolve_events:
      - "✓ Lipid rescue during CPR — ROSC achieved"
---
# Local Anaesthetic Systemic Toxicity (LAST)

## What happened
Local anaesthetic systemic toxicity caused cardiovascular collapse with VT. Lipid emulsion therapy reversed the toxicity and restored normal rhythm.

## Key learning points
- Prodromal CNS features: metallic taste, tinnitus, perioral tingling, agitation, seizures
- Stop the LA infusion immediately
- Intralipid 20%: 1.5 ml/kg bolus then 15 ml/kg/hr infusion — call for lipid rescue pack
- Use smaller adrenaline dose (≤1 mcg/kg) if cardiac arrest — avoid high-dose adrenaline
- Recovery may take >1 hour — continue lipid infusion and monitoring

## QRH Reference: 3-10 Local Anaesthetic Toxicity
