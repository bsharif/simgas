# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimGas is a web-based proof-of-concept for an anaesthetic monitor simulation app (targeting iOS as the eventual native platform). This repo is a Vite + React 19 + TypeScript implementation with a portable, pure-TypeScript physiology engine designed to be re-implementable in Swift later.

See `Product Requirements Document (PRD).md` for product scope and `docs/superpowers/specs/2026-05-19-simgas-poc-design.md` for the PoC design.

## Commands

- `npm run dev` — Vite dev server (HMR)
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — ESLint over the repo
- `npm run test` — vitest, runs once (non-watch). Tests live in `engine/**/*.test.ts`.
- Single test: `npx vitest run engine/patient.test.ts` (or pass a `-t "name"` filter)

Vitest is configured with `environment: 'node'` and only picks up tests under `engine/` — UI is not currently tested.

## Architecture

The codebase is split into two top-level directories with a strict one-way dependency: **`ui/` imports from `engine/`, never the reverse**. The engine has no React, no DOM, no globals beyond `requestAnimationFrame`/`performance.now` — keep it that way so it can be ported to Swift.

### Engine (`engine/`)

- `patient.ts` — `PatientState` shape, `BUFFER_SIZE` (2048), `NORMAL_RANGES`, `createBaselineState()`. Waveforms are stored in four `Float32Array` ring buffers on the state object, with a shared `bufferWritePos` cursor.
- `physiology.ts` — `SimulationEngine` class. Owns the rAF tick loop, mutates `state` in place each frame, and broadcasts via two pub/sub channels:
  - `subscribe(cb)` — state snapshots (engine spreads `{...s}` only on the React side; engine mutates in place).
  - `onEvent(cb)` — string event log entries.
  - Each tick: apply scenario `initialModifiers` once → call `scenario.check(elapsedSec, interventions)` → apply returned modifiers → tick `activeEffects` (drug onset/duration) → generate `SAMPLES_PER_TICK` waveform samples per buffer.
- `interventions.ts` — `INTERVENTIONS` array + `INTERVENTION_MAP` by id. `PatientModifier` supports both absolute (`hr`) and delta (`hrDelta`) fields; `applyModifier` is the single place that knows how to merge a modifier into state. Drugs with `durationMs > 0` become `ActiveEffect`s that fire `effect` once `onsetMs` elapses.
- `scenario.ts` — `Scenario` interface. A scenario is a pure object with `initialModifiers` plus a `check(elapsed, interventions)` function returning `{ modifiers, events, resolved, failed }`. Scenarios are stateless from the engine's perspective; any "phase" state must be derived from `elapsed` + the `interventions` id list.
- `scenarios/` — one file per scenario, all exported via `scenarios/index.ts` (`ALL_SCENARIOS`, `SCENARIO_MAP`). Adding a scenario means: create the file, add to both exports in `index.ts`.
- `waveforms.ts` — pure sample generators (`generateECGSample`, `generateSpO2Sample`, `generateETCO2Sample`, `generateRespSample`). ECG morphology is a sum of Gaussian kernels per P/Q/R/S/T, switched by `EcgRhythm`. Called `SAMPLES_PER_TICK` (=2) times per frame from `physiology.ts`.

### UI (`ui/`)

- `context/SimulationContext.tsx` — single React bridge to the engine. Constructs one `SimulationEngine` per provider, subscribes once, and exposes `state`, `eventLog`, `applyIntervention`, `updateMachineSettings`, `setManualVentilation`, `togglePause`, `startScenario`, plus mode and scenario metadata. **All engine access from React must go through `useSimulation()`** — do not instantiate the engine elsewhere.
- `pages/` — `StartPage` and `SimulationView`. `App.tsx` does its own minimal screen routing via local state (no router).
- `components/Monitor/` — canvas-based waveform renderers. `useCanvasRenderer` drives the per-frame draw; canvases read directly from the engine's ring buffers via the `state` snapshot.
- `components/RightPanel/`, `Sidebar/`, `Scenario/` — intervention controls, event log/hints, scenario picker + mode toggle.

### State update model

The engine mutates `PatientState` in place every tick. The React subscriber in `SimulationContext` does `setState({ ...s })` to force a shallow-new reference each frame so React re-renders. The waveform `Float32Array`s are reused (not reallocated) — components reading them must respect `bufferWritePos` as the head of the ring.

### Adding things

- **New intervention**: append to `INTERVENTIONS` in `engine/interventions.ts`. Set `durationMs: 0, onsetMs: 0` for instant effects; otherwise the engine queues an `ActiveEffect` that applies `effect` once at `onsetMs`. Wire the id into the relevant panel in `ui/components/RightPanel/`.
- **New machine setting**: extend the `Pick<PatientState, ...>` in both `SimulationEngine.updateMachineSettings` and `SimulationContext.updateMachineSettings`.
- **New patient field**: add to `PatientState` and `createBaselineState`, then to `PatientModifier` + `applyModifier` if it should be scenario/intervention-controllable.
- **New ECG rhythm**: extend `EcgRhythm` union in `patient.ts` and add a branch in `generateECGSample`.

## TypeScript / lint conventions

- `tsconfig.app.json` is strict, with `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Use `import type { ... }` for type-only imports — bare `import` of types will fail the build.
- `npm run build` runs `tsc -b` before Vite, so type errors block the production build.
