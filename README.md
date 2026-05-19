# SimGas

[![CI](https://github.com/bsharif/simgas/actions/workflows/ci.yml/badge.svg)](https://github.com/bsharif/simgas/actions/workflows/ci.yml)

A browser-based **anaesthetic simulation monitor** for practising
peri-operative emergencies — a Philips IntelliVue-inspired patient monitor
hooked up to a physiology engine that responds in real time to the drugs and
airway moves you make.

> ⚠️ SimGas is an **educational simulation tool**. It is not for clinical use,
> diagnosis, treatment, or patient monitoring.

![SimGas monitor showing waveforms, syringe-style drug controls, and the machine panel.](docs/assets/simgas-monitor.png)

---

## Table of contents

- [What is SimGas?](#what-is-simgas)
- [Who is it for?](#who-is-it-for)
- [What can you do in it?](#what-can-you-do-in-it)
- [Run SimGas on your laptop (non-developer guide)](#run-simgas-on-your-laptop-non-developer-guide)
- [Authoring your own scenarios](#authoring-your-own-scenarios)
- [Developer guide](#developer-guide)
- [Roadmap](#roadmap)

---

## What is SimGas?

SimGas reproduces the feel of an anaesthetic theatre monitor in a web
browser. A "patient" with a beating heart, breathing pattern, blood
pressure and CO₂ trace appears on screen. The vital signs are driven by a
small simulated physiology engine: when you give a drug, change a
ventilator setting, or perform a procedure, the patient's numbers respond
the way they would in real life (give or take — this is a teaching tool,
not a real medical device).

A **scenario** is a clinical emergency: anaphylaxis after IV antibiotics,
an oesophageal intubation, malignant hyperthermia under anaesthesia.
SimGas plays one of these out in real time, with deteriorating vitals,
audio alarms, and a hint panel for trainees. If you do the right thing
fast enough the patient recovers; if you don't, the scenario ends and you
get a debrief showing what was done, what was missed, and what the
correct management looks like.

The whole thing runs in your browser. No backend, no patient data, no
network needed once the page is loaded.

## Who is it for?

- **Anaesthetic trainees and consultants** drilling crisis recognition and
  algorithms (e.g. quickly recognising anaphylaxis vs. high spinal vs.
  bronchospasm and reaching for the right syringe).
- **Medical students and ICU/ED trainees** learning to read a monitor and
  recognise patterns of physiological deterioration.
- **Simulation faculty and educators** who want a low-friction
  high-fidelity case generator that runs on a laptop or projector.
- **ODPs, anaesthetic nurses, and theatre teams** rehearsing emergency
  drills outside of a sim suite.

## What can you do in it?

- **Watch a patient's vitals** on a monitor that resembles a clinical
  IntelliVue — ECG, plethysmograph, capnography, respiratory trace,
  invasive arterial line if you insert one, plus all the standard numbers.
- **Give drugs and perform procedures** through tabbed panels: drugs
  (adrenaline, metaraminol, dantrolene, propofol, etc.), airway
  manoeuvres (jaw thrust, Guedel, intubate, extubate, SGA, suction),
  ventilation changes (FiO₂, RR, manual bag), and procedures (arterial
  line, fluid bolus, defibrillate, CPR, chest decompression).
- **Adjust the anaesthetic machine** — FiO₂, tidal volume, PEEP, gas
  flow, respiratory rate, sevoflurane concentration; hold-to-ventilate
  bag in manual mode.
- **Hear alarms** when vitals stray outside safe ranges. Priorities
  escalate (cyan → yellow → red) with realistic beep patterns, and you
  can mute them for two minutes at a time.
- **Run three built-in scenarios** out of the box: anaphylaxis,
  oesophageal intubation, malignant hyperthermia. Three modes — guided
  (with hints), exam (no hints), free play (sandbox).
- **Reconfigure the monitor display** — toggle traces on or off, switch
  between Default / Cardiac / Neuro presets, your choices persist.
- **Review your run** — when a scenario ends, a debrief panel lists every
  intervention you applied, the full event log, and the scenario's
  teaching content rendered from markdown.
- **Write your own scenarios** as Markdown files — no programming required
  (see below).

---

## Run SimGas on your laptop (non-developer guide)

You don't need to be a programmer to run SimGas. You need three things:
**Node.js** (the runtime), **Git** (to download the project), and a
**modern web browser** (Chrome, Edge, Safari, Firefox — anything recent).

### Step 1 — Install Node.js

Go to [https://nodejs.org/](https://nodejs.org/) and download the **LTS**
version for your operating system. Run the installer with default
options. To check it worked, open **Terminal** (macOS / Linux) or
**Command Prompt** (Windows) and run:

```bash
node --version
npm --version
```

You should see two version numbers (e.g. `v20.11.1` and `10.2.4`). If
you don't, restart your terminal and try again.

### Step 2 — Install Git

- **macOS**: open Terminal and run `git --version`. If it's not installed,
  macOS will prompt you to install the Xcode command-line tools — say yes.
- **Windows**: download from [https://git-scm.com/download/win](https://git-scm.com/download/win)
  and install with default options.
- **Linux**: `sudo apt install git` (Ubuntu/Debian) or your distribution's
  equivalent.

### Step 3 — Download SimGas

In your terminal, change to a folder where you want to keep the project
(your Documents folder is fine), then clone the repository:

```bash
cd ~/Documents
git clone https://github.com/bsharif/simgas.git
cd simgas
```

### Step 4 — Install the project's dependencies

This downloads the libraries SimGas uses. It takes 30–60 seconds the
first time.

```bash
npm install
```

You'll see a long log; harmless warnings about funding or audits are fine
to ignore. If it ends with `found 0 vulnerabilities` or similar, you're
good.

### Step 5 — Start SimGas

```bash
npm run dev
```

After a couple of seconds you'll see something like:

```
  VITE v8.x.x  ready in 412 ms

  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173/** in your browser. SimGas is running.

Press **Ctrl-C** in the terminal to stop the server when you're done.
Next time, just `cd simgas` and `npm run dev` again — you don't need to
reinstall.

### How to use the app

1. On the **start page**, pick a scenario card (Anaphylaxis, Oesophageal
   Intubation, Malignant Hyperthermia) and a mode (Guided shows hints;
   Exam is silent; Free Play is open-ended). Click **Start Simulation**.
2. The monitor is on the left, intervention controls on the right.
3. Click **drug syringes**, **airway** buttons, etc. to manage the
   patient. Each click is logged in the event panel at the bottom right.
4. The **🔔 button** at the top right shows the current alarm state —
   click to mute audio for two minutes.
5. The **⚙ button** opens the monitor display settings — toggle traces,
   switch presets.
6. The **⏸ button** pauses the scenario. The **scenario dropdown** at
   the top left lets you switch cases mid-flight.
7. When the patient stabilises or crashes, a **debrief** opens with a
   timeline and teaching points. Hit **Replay** to retry or **Close** to
   inspect the final state.

### Sharing it with colleagues

The simplest way is to run `npm run dev` on your machine and have
everyone in the same room point their browsers at your laptop's IP
(e.g. `http://192.168.1.42:5173/`). Vite prints the network address
alongside the localhost one when it starts.

For a permanent deployment so anyone on the internet can use it, see
[Deploying](#deploying) below.

### Troubleshooting

- **`npm: command not found`** — Node.js isn't installed or your terminal
  doesn't see it. Restart the terminal and retry; if that fails,
  reinstall Node.js.
- **Port 5173 already in use** — Vite will use 5174, 5175 etc.
  automatically. Check the printed URL.
- **No sound** — browsers block audio until you've clicked or pressed a
  key on the page. Click anywhere first.
- **Old version of SimGas after a `git pull`** — re-run `npm install` in
  case dependencies changed.

---

## Authoring your own scenarios

Every scenario lives as a single **Markdown file** in the `/scenarios/`
folder at the top of the repository. Adding one is as simple as
duplicating an existing file and editing it — there's no code to touch.

The file has two parts:

1. **YAML frontmatter** (between two `---` fences) describing the
   mechanics: starting vitals, phases of deterioration and recovery, the
   conditions that move between phases, what makes the scenario succeed
   or fail.
2. **Markdown body** (everything below the second `---`) shown in the
   post-scenario debrief — your teaching content, references, links.

### A worked example

```yaml
---
id: svt
label: Supraventricular Tachycardia
description: 60-year-old develops sudden palpitations and hypotension after induction.
difficulty: medium

hints:
  - "Check for adverse features — hypotension, chest pain, syncope"
  - "Try vagal manoeuvres first; if unstable, synchronised DC cardioversion"

initial_state:                    # vitals applied instantly at scenario start
  hr: 180
  ecgRhythm: svt
  spo2: 97
  nibp: { sys: 85, dia: 55, map: 65 }

initial_baseline:                 # drift targets for vitals to lerp toward
  hr: 180
  spo2: 95
  nibp: { sys: 80, dia: 50, map: 60 }

phases:
  - id: onset
    baseline: { hr: 180, spo2: 95, nibp: { sys: 80, dia: 50, map: 60 } }
    events:
      - at: 5s
        text: "⚠ Narrow-complex tachycardia at 180 — likely SVT"

  - id: untreated
    enter_when: "time > 60 && !any('defibrillate')"
    baseline: { hr: 200, spo2: 88, nibp: { sys: 60, dia: 40, map: 47 } }
    fail_when: "phase_elapsed > 90"
    fail_events: ["❌ Decompensated SVT progressed to cardiac arrest"]
    fail_snap: { ecgRhythm: vf, hr: 0, spo2: 0 }

  - id: recovery
    enter_when: "any('defibrillate')"
    baseline: { hr: 80, spo2: 99, nibp: { sys: 120, dia: 80, map: 93 } }
    resolve_when: "phase_elapsed > 30 && hr < 100"
    resolve_events: ["✓ Sinus rhythm restored after cardioversion"]
    resolve_snap: { hr: 75, ecgRhythm: sinus, spo2: 99 }
---

# SVT — debrief

Supraventricular tachycardia in the peri-operative setting is usually
re-entrant (AVNRT). Management depends on whether the patient has
*adverse features*: shock, syncope, heart failure, myocardial ischaemia...
```

Drop that into `scenarios/svt.md`, reload the browser, and it appears in
the scenario picker.

### How phases work

Each tick the engine asks every phase "is your `enter_when` true?". The
**last matching phase wins** — so list your phases from least- to
most-specific. The first phase typically omits `enter_when` (always
matches) and serves as the fallback; later phases override when their
conditions become true (drug given, tube fixed, time elapsed).

While a phase is active, the engine smoothly drifts the patient's vitals
toward the phase's `baseline:` targets. Drug effects layer on top —
adrenaline's `+15 BPM` is added to the current HR rather than
overwriting the drift, so drugs feel meaningful even mid-phase.

### Predicate language reference

Inside any `enter_when`, `resolve_when`, or `fail_when` string:

**Variables**: `time` (seconds since scenario start), `phase_elapsed`
(seconds in current phase), `hr`, `spo2`, `etco2`, `rr`, `temp`,
`tube_position` (`'none'` / `'trachea'` / `'oesophagus'`).

**Functions**: `any('id-glob')` — true if any intervention id matches
(wildcards allowed, e.g. `any('adrenaline-*')`); `count('id')` — how
many times an intervention was applied; `phase_done('id')` — true once a
previously-active phase completed.

**Operators**: `&& || ! == != < <= > >=`. Literals: numbers,
`'strings'`, `true`/`false`.

### Available intervention IDs

For `any()` / `count()` / `hints_if_missing`:

| Category | IDs |
|---|---|
| Drugs | `adrenaline-1`, `adrenaline-10`, `metaraminol`, `ephedrine`, `propofol`, `dantrolene` |
| Airway | `intubate`, `re-intubate`, `extubate`, `jaw-thrust`, `guedel`, `sga`, `suction` |
| Ventilation | `increase-fio2`, `increase-tv`, `increase-rr`, `peep-up`, `manual-vent` |
| Procedures | `fluid-bolus`, `defibrillate`, `cpr`, `chest-decompression`, `arterial-line`, `cvp-line`, `bis-monitor` |

### Validate before sharing

```bash
npm run lint:scenarios
```

This checks the schema, that every intervention id you reference exists,
that every phase does something, and that every scenario can actually
terminate.

### Built-in scenarios at launch

| Scenario | Focus | Expected actions |
| --- | --- | --- |
| Anaphylaxis | Hypotension, tachycardia, falling SpO2. | Adrenaline, fluids, 100% O₂. |
| Oesophageal intubation | Falling ETCO2 and hypoxia after intubation. | Recognise tube misplacement, extubate, re-intubate. |
| Malignant hyperthermia | Rising ETCO2, temperature, heart rate. | Dantrolene, stop volatile agent, hyperventilate. |

---

## Deploying

Once you've got SimGas running locally you can publish a built version so
people can use it without installing anything.

### Static hosting (recommended)

The app is a static bundle — no server-side anything, no database.
Build it once with `npm run build` and you get a `dist/` folder you can
host anywhere that serves files.

Easiest option — **Netlify drag-and-drop**:

```bash
npm run build
```

Drag the `dist/` folder onto [https://app.netlify.com/drop](https://app.netlify.com/drop). Done.

Other static hosts that work out of the box: **Vercel**, **Cloudflare Pages**,
**GitHub Pages**, **AWS S3 + CloudFront**, your own nginx box. All you need
is something that serves `index.html` with the assets next to it.

### Configuring for a non-root path

If you're hosting at e.g. `example.com/simgas/` rather than the root, set
`base` in `vite.config.ts`:

```ts
export default defineConfig({
  base: '/simgas/',
  // ...
})
```

…then rebuild.

### Notes

- The app uses synthetic data only — no patient information, no PII, no
  network calls during a scenario. Hosting it is GDPR-trivial.
- The build is ~430 kB of JS / 130 kB gzipped. Any free static tier will
  comfortably handle hundreds of concurrent users.
- Once Phase 4 (multi-user realtime) lands you'll also need a Supabase
  project for room state; the static bundle alone won't do realtime.

---

## Developer guide

The rest of this README is for contributors and people modifying the
code.

### Project structure

The codebase separates simulation logic from React UI. The engine
imports no UI code, which keeps the physiology model portable to other
platforms (e.g. a future Swift/iOS port).

```text
engine/
  patient.ts              Patient state shape, normal ranges, baseline factory
  physiology.ts           Tick loop, pub/sub, phase machine
  interventions.ts        Intervention definitions + applyModifier + drift
  waveforms.ts            ECG / pleth / capno / arterial sample generators
  scenario.ts             Scenario interface
  scenarios/              Scenario loader + DSL (parse / predicate / interpret)
  monitor/                Display layout config + presets
  alarms.ts               Pure alarm priority detection
  doseLedger.ts           Per-intervention dose history + cooldown gating

ui/
  context/                React bridges to the engine (Simulation, Layout, Alarms)
  hooks/                  useCanvasRenderer, useAlarms
  components/Monitor/     Patient monitor, canvases, settings overlay
  components/RightPanel/  Intervention tabs + machine controls + event log
  components/Sidebar/     Guided-mode hints panel
  components/Scenario/    Scenario picker and mode toggle (top of sim view)
  components/Debrief/     Post-scenario review + markdown renderer
  pages/                  StartPage + SimulationView

scenarios/                Authored .md scenario files (YAML + markdown)
scripts/                  Authoring tools (lint-scenarios.ts)
```

### Available commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) then build a production bundle to `dist/` |
| `npm run lint` | ESLint over the repo |
| `npm run lint:scenarios` | Validate all `.md` scenarios |
| `npm run typecheck` | Type-check only (used by the pre-commit hook) |
| `npm run test` | Run the Vitest test suite |
| `npm run preview` | Serve the production build locally for spot-checking |

### Monitor internals

The monitor is designed to resemble a Philips IntelliVue screen while
remaining fully synthetic and browser-rendered.

- ECG generated from Gaussian P, Q, R, S, T components; morphology
  switches per rhythm (sinus / VF / VT / SVT / asystole).
- Pleth is a sine wave with a dicrotic notch; amplitude tracks SpO₂.
- ETCO₂ uses an inspiratory ramp + plateau + drop, capnography-shaped.
- Arterial line: sharp upstroke, dicrotic notch, exponential decay;
  amplitude scaled by pulse pressure.
- Waveforms are stored in `Float32Array` ring buffers on the patient
  state; canvases read them directly each frame for 60 fps rendering.

### Architecture rules

- `ui/` imports from `engine/`, **never the reverse**. The engine has
  no React, no DOM, no globals beyond `requestAnimationFrame` and
  `performance.now`.
- The engine mutates `PatientState` in place each tick. React state is
  throttled to ~5 Hz; waveform canvases bypass React and read the ring
  buffers live.
- Scenarios are authored as YAML+markdown and compiled into the
  `Scenario` runtime interface at load time. Engine never knows whether
  a scenario was authored declaratively or in TypeScript.

### Extending things

- **New scenario**: drop a `.md` file in `/scenarios/`. Validate with
  `npm run lint:scenarios`.
- **New intervention**: append to `INTERVENTIONS` in
  `engine/interventions.ts`. Wire its id into the relevant tab in
  `ui/components/RightPanel/RightPanel.tsx`.
- **New patient field**: add to `PatientState` and
  `createBaselineState`, then to `PatientModifier` + `applyModifier`. If
  it should drift, extend `DriftBaseline` + `applyDrift`. If scenarios
  should read it in predicates, add a case in
  `engine/scenarios/dsl/predicate.ts`.
- **New ECG rhythm**: extend the `EcgRhythm` union in
  `engine/patient.ts` and add a branch in `generateECGSample` in
  `engine/waveforms.ts`.
- **New monitor trace**: add to `TraceId` and `DEFAULT_LAYOUT` in
  `engine/monitor/layout.ts`; ensure the underlying waveform buffer
  exists on `PatientState`.

### Project workflow

Branch prefixes: `fix/*`, `feat/*`, `chore/*`, `refactor/*`, `docs/*`.
Each branch opens one PR; PRs are squash-merged into `main` once CI passes.
Phase boundaries are tagged `v0.X.0`.

CI (`.github/workflows/ci.yml`) runs `lint`, `lint:scenarios`, `test`, and
`build` on every PR and push to `main`.

A pre-commit hook (via `simple-git-hooks`) runs `lint` and `typecheck`
locally before each commit. The hook installs automatically after
`npm install`. Bypass in an emergency with
`SKIP_SIMPLE_GIT_HOOKS=1 git commit ...`.

### TypeScript notes

The TS config is strict, including `verbatimModuleSyntax` and
`erasableSyntaxOnly`. Use `import type { ... }` for type-only imports —
bare `import` of types fails the build. Constructor-parameter properties
(`constructor(private foo: T)`) are also disallowed; declare and assign
explicitly.

React 19's `react-hooks/purity` rule flags `Date.now()` /
`performance.now()` / `Math.random()` in render. Snapshot them via an
interval into state, or suppress with `// eslint-disable-next-line` only
when the impurity is bounded.

---

## Roadmap

Tracked in detail under [`docs/superpowers/plans/`](docs/superpowers/plans/).

- **v0.1.0 — Foundations.** CI, pre-commit hooks, branching conventions.
- **v0.2.0 — Engine + UI bug fixes.** Pause respect, persistent rAF,
  drift-baseline scenarios, tube-position state, scenario phase first
  class, throttled React updates.
- **v0.3.0 — Scenario DSL.** YAML frontmatter + markdown body, predicate
  mini-language, interpreter, lint CLI. Authors no longer need
  TypeScript.
- **v0.4.0 — Configurable monitor + extras.** Runtime-toggleable traces
  (ECG, pleth, CO₂, resp, arterial, CVP, BIS), dose tracking with
  cooldown, Web Audio alarms with priority escalation, post-scenario
  debrief view.
- **v0.5.0 — Realtime multi-user.** Supabase Realtime rooms with
  instructor / learner / observer roles, leader-server hybrid model,
  deterministic local waveform regeneration.

## License and attribution

The syringe labelling reference PDF is included for local design
reference. The app uses synthetic data and does not contain
patient-identifiable information.
