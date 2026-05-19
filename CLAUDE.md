# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimGas is a web-based proof-of-concept for an anaesthetic monitor simulation app (targeting iOS as the eventual native platform). This repo is a Vite + React 19 + TypeScript implementation with a portable, pure-TypeScript physiology engine designed to be re-implementable in Swift later.

See `Product Requirements Document (PRD).md` for product scope and `docs/superpowers/specs/2026-05-19-simgas-poc-design.md` for the PoC design.

## Commands

- `npm run dev` — Vite dev server (HMR)
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — ESLint over the repo
- `npm run lint:scenarios` — validate `.md` scenarios (schema + intervention refs + reachability)
- `npm run typecheck` — `tsc -b` (used by the pre-commit hook)
- `npm run test` — vitest, runs once (non-watch). Tests live in `engine/**/*.test.ts`.
- Single test: `npx vitest run engine/patient.test.ts` (or pass a `-t "name"` filter)

Vitest is configured with `environment: 'node'` and only picks up tests under `engine/` — UI is not currently tested.

A pre-commit hook installed via `simple-git-hooks` runs `lint` + `typecheck` before each commit. Bypass in an emergency with `SKIP_SIMPLE_GIT_HOOKS=1 git commit ...`.

## Architecture

The codebase is split with a strict one-way dependency: **`ui/` imports from `engine/`, never the reverse**. Scenarios are authored as `.md` files at the repo root in `/scenarios/` and parsed by the DSL in `engine/scenarios/dsl/`. The engine has no React, no DOM, no globals beyond `requestAnimationFrame`/`performance.now` — keep it that way so it can be ported to Swift.

### Engine (`engine/`)

- `patient.ts` — `PatientState` shape, `BUFFER_SIZE` (2048), `NORMAL_RANGES`, `createBaselineState()`. `DriftBaseline` lives here too (Phase 1.4 — see "Drift baselines" below). Waveforms are stored in four `Float32Array` ring buffers on the state object, with a shared `bufferWritePos` cursor.
- `physiology.ts` — `SimulationEngine` class. Owns the rAF tick loop, mutates `state` in place each frame, and broadcasts via three pub/sub channels:
  - `subscribe(cb)` — state snapshots. Engine mutates in place; the React side does `{...s}` to force re-renders.
  - `onEvent(cb)` — string event log entries.
  - `onPhaseChange(cb)` — `SimulationPhase` transitions (`idle` / `running` / `resolved` / `failed`). UI reads phase from here, not by regex-matching event strings.
  - Each tick (when not paused and not terminated): apply `scenario.initialModifiers` once → call `scenario.check(elapsedSec, interventions, ctx)` → apply returned modifiers → `applyDrift` (skipped on the terminal tick so the resolve/fail snap sticks) → tick `activeEffects` (drug onset/duration) → generate `SAMPLES_PER_TICK` waveform samples per buffer → broadcast.
  - On scenario end: broadcast final state once, set phase to resolved/failed, cancel rAF (`freeze()`). State stays queryable for the debrief view.
- `interventions.ts` — `INTERVENTIONS` array + `INTERVENTION_MAP` by id. `PatientModifier` supports absolute (`hr`), delta (`hrDelta`), and **baseline** (`baseline: { hr, ... }`) fields. `applyModifier` is the single place that merges a modifier into state. `applyDrift(state, dtSec)` lerps vitals toward `state.driftBaseline` at fixed rates per second.
- `scenario.ts` — `Scenario` interface. A scenario has `initialModifiers`, a `check(elapsed, interventions, ctx?)` function returning `{ modifiers, events, resolved, failed }`, and an optional `reset()` hook (called by the engine on `start()` so stateful interpreters can clear per-run state).
- `scenarios/index.ts` — loads `.md` scenarios via Vite's `import.meta.glob('../../scenarios/*.md', { query: '?raw', eager: true })`, parses each through the DSL, exports `ALL_SCENARIOS` + `SCENARIO_MAP`. Adding a scenario = drop a new `.md` file, no code changes.
- `scenarios/dsl/` — the scenario DSL:
  - `schema.ts` — Zod schema for `ScenarioSpec`. Strict mode rejects unknown keys.
  - `predicate.ts` — tokenizer + Pratt-style recursive-descent parser for `enter_when` / `resolve_when` / `fail_when` expressions. Variables: `time`, `phase_elapsed`, `hr`, `spo2`, `etco2`, `rr`, `temp`, `tube_position`. Functions: `any('id-glob')`, `count('id')`, `phase_done('id')`. Operators: `&& || ! == != < <= > >=`.
  - `parse.ts` — splits YAML frontmatter from markdown body (10-line splitter, no gray-matter), validates via Zod, returns `{ spec, body }`.
  - `interpret.ts` — `specToScenario(spec)` returns a runtime Scenario whose `check` closure runs the phase machine. Phase selection rule: **last matching `enter_when` wins** (authors list phases from least- to most-specific).
- `waveforms.ts` — pure sample generators. ECG morphology is a sum of Gaussian kernels per P/Q/R/S/T, switched by `EcgRhythm`. Called `SAMPLES_PER_TICK` (=2) times per frame from `physiology.ts`.

### Scenarios (`scenarios/`)

Each scenario is a `.md` file with YAML frontmatter (declarative phase machine) and a markdown body (debrief content shown after the scenario ends). Example:

```yaml
---
id: anaphylaxis
label: Anaphylaxis
difficulty: medium
phases:
  - id: onset
    baseline: { hr: 130, spo2: 88, nibp: { sys: 70, dia: 50 } }
    events:
      - at: 10s
        text: "⚠ HR rising, BP falling — possible anaphylaxis"
  - id: untreated
    enter_when: "time > 30 && !any('adrenaline-*')"
    baseline: { hr: 155, spo2: 70 }
    fail_when: "phase_elapsed > 60"
    fail_snap: { ecgRhythm: asystole }
  - id: recovery
    enter_when: "any('adrenaline-*')"
    baseline: { hr: 85, spo2: 99 }
    resolve_when: "phase_elapsed > 90"
    resolve_snap: { hr: 78, spo2: 99 }
---
# Debrief markdown here
```

### UI (`ui/`)

- `context/SimulationContext.tsx` — single React bridge to the engine. Constructs one `SimulationEngine` per provider, throttles `setState` to ~5 Hz (numerics don't need 60 Hz), and exposes `state`, `phase`, `elapsedSeconds`, `eventLog`, scenario actions. **All engine access from React must go through `useSimulation()`** — do not instantiate the engine elsewhere.
- `pages/` — `StartPage` and `SimulationView`. `App.tsx` does its own minimal screen routing via local state (no router).
- `components/Monitor/` — canvas-based waveform renderers. `ECGCanvas` and `SimpleWaveformCanvas` take `engine` + `bufferKey` props and read `engine.state[bufferKey]` and `engine.state.bufferWritePos` **directly each frame** so they stay at 60 fps regardless of the throttled React state.
- `hooks/useCanvasRenderer.ts` — runs a single persistent rAF loop with the latest `draw` stored in a ref. Do NOT list `draw` in effect deps — the original implementation did and tore down rAF on every parent render.
- `components/RightPanel/`, `Sidebar/`, `Scenario/` — intervention controls, event log/hints, scenario picker + mode toggle.

### Drift baselines (Phase 1.4)

The engine maintains `state.driftBaseline` (a `Partial<DriftBaseline>`) alongside actual vitals. Each tick, `applyDrift` lerps `state.hr` toward `state.driftBaseline.hr` at 1.0 BPM/sec (and similar rates for other vitals). Scenarios set drift targets via `modifiers.baseline`; drug effects (e.g. `adrenaline.effect = { hrDelta: 15 }`) write to `state.hr` directly and **persist on top of the drift trajectory**. This is what makes drugs feel meaningful — without it, scenarios would clobber every drug delta on the next tick.

### Adding things

- **New scenario**: drop a `.md` file in `/scenarios/`. `npm run lint:scenarios` validates it. No code changes.
- **New intervention**: append to `INTERVENTIONS` in `engine/interventions.ts`. Set `durationMs: 0, onsetMs: 0` for instant effects; otherwise the engine queues an `ActiveEffect` that applies `effect` once at `onsetMs`. Optional: `precondition: (state) => boolean` + `preconditionFailureEvent` for state-dependent gating (see `intubate` / `extubate`). Wire the id into the relevant panel in `ui/components/RightPanel/`.
- **New machine setting**: extend the `Pick<PatientState, ...>` in both `SimulationEngine.updateMachineSettings` and `SimulationContext.updateMachineSettings`.
- **New patient field**: add to `PatientState` and `createBaselineState`, then to `PatientModifier` + `applyModifier` if it should be scenario/intervention-controllable. If it should drift, extend `DriftBaseline` + `applyDrift`. If it should be readable in predicates, add a case in `predicate.ts`'s `var` evaluator.
- **New ECG rhythm**: extend `EcgRhythm` union in `patient.ts` and add a branch in `generateECGSample`.

## TypeScript / lint conventions

- `tsconfig.app.json` is strict, with `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Use `import type { ... }` for type-only imports — bare `import` of types will fail the build. `erasableSyntaxOnly` also forbids TypeScript-only constructor parameter properties (`constructor(private foo: T)`); declare and assign explicitly.
- `npm run build` runs `tsc -b` before Vite, so type errors block the production build.
- React 19's `react-hooks/purity` rule fires on `Date.now()` / `Math.random()` in render. Suppress with `// eslint-disable-next-line` only when the impurity is intentional and bounded.
