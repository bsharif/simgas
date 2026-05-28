# Smooth Drift Transitions & Anaphylaxis Redesign

> **Date:** 2026-05-26
> **Status:** Draft

## Problem

1. **Phase transitions feel abrupt** — When a scenario switches phases, driftBaseline targets jump instantly, creating sharp kinks in vital trajectories. The actual values lerp smoothly, but the target direction changes discontinuously.

2. **Anaphylaxis scenario starts in crisis** — t=0 has HR 120, SpO₂ 88, BP 70/50. No stable baseline, no visible trigger event, no deterioration arc for the trainee to witness.

## Solution

### Part A: Two-Stage Drift Smoothing (`engine/`)

Introduce a smoothing layer between the scenario's requested baseline and the drift target. The drift target itself lerps toward the scenario target before vitals lerp toward the drift target.

**New data flow:**
```
scenario.check() → baseline: { hr: 155 }
  → state.scenarioBaseline.hr = 155           (desired target)
    → lerp state.driftBaseline.hr → 155 at 2.0 BPM/sec  (smooth target)
      → lerp state.hr → driftBaseline.hr at 0.75 BPM/sec (smooth value)
```

**PatientState change** (`engine/patient.ts`):
- Add `scenarioBaseline: DriftBaseline` field, initialized to `{}` in `createBaselineState`

**applyModifier change** (`engine/interventions.ts`):
- `mod.baseline` writes to `state.scenarioBaseline` instead of `state.driftBaseline`

**applyDrift change** (`engine/interventions.ts`):
- Stage 1: For each vital field, if `driftBaseline[field]` is undefined, copy from `scenarioBaseline[field]` (init). Then lerp `driftBaseline[field]` toward `scenarioBaseline[field]` at the smoothing rate.
- Stage 2: Existing lerp of `state[field]` toward `driftBaseline[field]` at the (now slowed) drift rate.

**Rate changes:**

| Field | Old Drift | New Drift (0.75x) | Smooth Rate (for target) |
|-------|-----------|-------------------|--------------------------|
| HR    | 1.0 BPM/s | 0.75 BPM/s        | 2.0 BPM/s                |
| SpO₂  | 0.5 %/s   | 0.375 %/s         | 1.0 %/s                  |
| ETCO₂ | 0.05 kPa/s| 0.0375 kPa/s      | 0.1 kPa/s                |
| RR    | 0.5 /s    | 0.375 /s          | 1.0 /s                   |
| Temp  | 0.02 °C/s | 0.015 °C/s        | 0.04 °C/s                |
| NIBP S| 1.0 mmHg/s| 0.75 mmHg/s       | 2.0 mmHg/s               |
| NIBP D| 0.7 mmHg/s| 0.525 mmHg/s      | 1.5 mmHg/s               |

Smooth rate is ~2.5–3x the drift rate so targets settle quickly while vitals follow at a measured pace.

### Part B: Anaphylaxis Scenario Redesign (`scenarios/anaphylaxis.md`)

**Current (3 phases):** `onset` → `untreated` | `recovery`

**New (4 phases):** `stable` → `onset` → `untreated` | `recovery`

```yaml
id: anaphylaxis
label: Anaphylaxis
description: A 35-year-old develops sudden anaphylaxis after IV antibiotic administration.
difficulty: medium
hints:
  - "Check the airway — bronchospasm may be present"
  - "Give adrenaline early — it is the first-line treatment"
  - "Fluids and high-flow oxygen are also key"

# No initial_state or initial_baseline — default patient is stable (HR 78, SpO₂ 99, BP 120/80)

phases:
  - id: stable
    baseline:
      hr: 78
      spo2: 99
      nibp: { sys: 120, dia: 80, map: 93 }
      etco2: 5.0
    events:
      - at: 5s
        text: "→ IV antibiotic administered"

  - id: onset
    enter_when: "time > 5"
    snap:
      capnographyShape: bronchospasm
    baseline:
      hr: 130
      spo2: 88
      nibp: { sys: 70, dia: 50, map: 58 }
      etco2: 4.0
    events:
      - at: 10s
        text: "⚠ HR rising, BP falling — possible anaphylaxis"
      - at: 20s
        text: "⚠ Bronchospasm — airway pressure rising, SpO₂ dropping"

  - id: untreated
    enter_when: "time > 30 && !any('adrenaline-*')"
    baseline:
      hr: 155
      spo2: 70
      nibp: { sys: 40, dia: 30, map: 33 }
      etco2: 3.0
    events:
      - at: 30s
        text: "⚠ Severe hypotension — risk of cardiac arrest"
    fail_when: "phase_elapsed > 60"
    fail_events:
      - "❌ Cardiac arrest — failure to treat anaphylaxis"
    fail_snap:
      ecgRhythm: asystole
      hr: 0
      spo2: 0
      nibp: { sys: 0, dia: 0, map: 0 }

  - id: recovery
    enter_when: "any('adrenaline-*')"
    snap:
      capnographyShape: normal
    baseline:
      hr: 85
      spo2: 99
      nibp: { sys: 125, dia: 78, map: 94 }
      etco2: 5.0
    hints_if_missing:
      increase-fio2: "Consider high-flow oxygen"
      fluid-bolus: "Consider IV fluid bolus"
    resolve_when: "phase_elapsed > 90"
    resolve_events:
      - "✓ Patient stabilised after anaphylaxis treatment"
    resolve_snap:
      hr: 78
      spo2: 99
      nibp: { sys: 120, dia: 80, map: 93 }
      etco2: 5.0
```

**Timeline summary:**

| Time | Phase | Vitals trending toward | Events |
|------|-------|----------------------|--------|
| 0–5s | stable | Normal (HR 78, SpO₂ 99) | — |
| 5s | stable→onset | Transition begins | "IV antibiotic administered" |
| 5–30s | onset | HR 78→130, SpO₂ 99→88, BP 120/80→70/50 | Capnography→bronchospasm (snap). "HR rising" at 10s, "Bronchospasm" at 20s |
| 30s+ | untreated (if no adrenaline) | HR→155, SpO₂→70, BP→40/30 | "Severe hypotension" at 60s phase elapsed |
| ~90s | fail | — | Cardiac arrest → asystole |
| any t | recovery (adrenaline given) | HR→85, SpO₂→99, BP→125/78 | Capnography→normal (snap). Hints for O₂/fluids |
| ~+90s | resolve | Stabilised | "Patient stabilised" |

### Files Changed

| File | Change |
|------|--------|
| `engine/patient.ts` | Add `scenarioBaseline` field, init in `createBaselineState` |
| `engine/interventions.ts` | `applyModifier`: baseline→scenarioBaseline. `applyDrift`: add two-stage smoothing. New rates. |
| `scenarios/anaphylaxis.md` | Full rewrite: 4 phases, stable start, bronchospasm, no initial_state |
