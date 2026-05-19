# SimGas PoC — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished investor-facing web PoC for the SimGas anaesthetic simulation monitor.

**Architecture:** Pure TypeScript game-loop engine (rAF, pub/sub) with React + Canvas 2D UI. Engine is portable to Swift/iOS later.

**Tech Stack:** Vite + React 18 + TypeScript (strict) + Canvas 2D + Vitest

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `ui/main.tsx`, `ui/App.tsx`, `ui/App.css`
- Create: `ui/vite-env.d.ts`

- [ ] **Scaffold with Vite + React + TS**

Run: `npm create vite@latest . -- --template react-ts`
Answer: "simgas" for project name, then clean out template boilerplate.

- [ ] **Create directory structure**

```bash
mkdir -p engine/scenarios ui/components/Monitor ui/components/Toolbar ui/components/Sidebar ui/components/Scenario ui/context ui/hooks
```

- [ ] **Add vitest config** in `vite.config.ts`

- [ ] **Verify scaffold builds**

Run: `npm install && npm run build`
Expected: clean build output in `dist/`

---

### Task 2: Engine — Types and Baseline

**Files:**
- Create: `engine/patient.ts`

- [ ] **Define PatientState interface**

```typescript
export interface PatientState {
  hr: number;
  spo2: number;
  nibp: { sys: number; dia: number; map: number };
  etco2: number;
  rr: number;
  temp: number;
  fio2: number;
  consciousness: 'awake' | 'sedated' | 'unconscious';
  ecgRhythm: 'sinus' | 'vf' | 'vt' | 'asystole' | 'svt';
  ecgBuffer: Float32Array;
  spo2Buffer: Float32Array;
  etco2Buffer: Float32Array;
  bufferIndex: number;
}
```

- [ ] **Define baseline vital ranges and a factory**

```typescript
export function createBaselineState(): PatientState { ... }
export const NORMAL_RANGES = { ... }
```

- [ ] **Write and pass test**

```typescript
// engine/patient.test.ts
test('createBaselineState returns valid vitals', () => {
  const state = createBaselineState();
  expect(state.hr).toBeGreaterThan(60);
  expect(state.hr).toBeLessThan(100);
});
```

---

### Task 3: Engine — Waveform Synthesis

**Files:**
- Create: `engine/waveforms.ts`

- [ ] **Implement ECG sample generation**

Sum of Gaussian kernels for P (0.1s), Q (-0.04s), R (0s), S (0.04s), T (0.2s) relative to R-peak. R-R interval from HR. Return a single sample value.

```typescript
export function generateECGSample(time: number, hr: number, rhythm: string): number
```

- [ ] **Implement SpO₂ pleth sample**

Sine wave at HR frequency with dicrotic notch (second bump after peak). Amplitude scales with SpO₂.

```typescript
export function generateSpO2Sample(time: number, hr: number, spo2: number): number
```

- [ ] **Implement ETCO₂ capnography sample**

Ramp up (expiration) → plateau → sharp drop (inspiration). Height scales with ETCO₂ value. Bronchospasm adds sawtooth to plateau.

```typescript
export function generateETCO2Sample(time: number, rr: number, etco2: number, bronchospasm: boolean): number
```

- [ ] **Write and pass tests** for waveform shapes at known time values

---

### Task 4: Engine — Intervention Model

**Files:**
- Create: `engine/interventions.ts`

- [ ] **Define Intervention and ActiveEffect types**

```typescript
export interface Intervention {
  id: string;
  label: string;
  category: 'drug' | 'airway' | 'ventilation' | 'procedure';
  effect: (state: PatientState) => PatientModifier;
}

export interface ActiveEffect {
  interventionId: string;
  remainingMs: number;
  totalMs: number;
  modifier: PatientModifier;
}
```

- [ ] **Define all interventions** for the PoC:

**Drugs:** Adrenaline 1mcg, Adrenaline 10mcg, Metaraminol 1mg, Ephedrine 3mg, Propofol 50mg, Dantrolene 2.5mg/kg

**Airway:** Intubate, Re-intubate, Jaw thrust, Guedel airway, SGA insertion, Suction

**Ventilation:** Increase FiO₂, Increase TV, Increase RR, PEEP up, Manual ventilation

**Procedures:** Fluid bolus 500mL, Defibrillate, CPR, Chest decompression

- [ ] **Write and pass test** — apply intervention effect and verify state change

---

### Task 5: Engine — Scenario Definitions

**Files:**
- Create: `engine/scenarios/anaphylaxis.ts`
- Create: `engine/scenarios/oesophageal-intubation.ts`
- Create: `engine/scenarios/malignant-hyperthermia.ts`
- Create: `engine/scenarios/index.ts`

- [ ] **Define Scenario type**

```typescript
export interface Scenario {
  id: string;
  label: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  initialVitals: Partial<PatientState>;
  hints: string[];
  check: (state: PatientState, elapsed: number, interventions: string[]) => ScenarioUpdate;
}
```

- [ ] **Implement Anaphylaxis scenario**

Progression: hypotension worsens over 30s, SpO₂ drops, bronchospasm appears. Corrected by adrenaline + fluids + O₂. Wrong path → cardiac arrest at 120s.

Return `ScenarioUpdate { modifiers, events: string[] }` on each check call.

- [ ] **Implement Oesophageal Intubation**

Progression: ETCO₂ drops to near-zero over 10s, SpO₂ declines over 45s, HR rises then bradycardia. Corrected by re-intubation. Wrong path → asystole at 90s.

- [ ] **Implement Malignant Hyperthermia**

Progression: ETCO₂ rises, temp climbs, HR rises. Corrected by dantrolene + cooling + hyperventilation + stop volatiles. Slow recovery (120s).

- [ ] **Export all scenarios** from `engine/scenarios/index.ts`

- [ ] **Write and pass tests** — verify scenario progression at known elapsed times

---

### Task 6: Engine — Simulation Loop

**Files:**
- Create: `engine/physiology.ts`

- [ ] **Implement SimulationEngine class**

```typescript
export class SimulationEngine {
  state: PatientState;
  private subscribers: Set<(state: PatientState) => void>;
  private activeEffects: ActiveEffect[];
  private activeScenario: Scenario | null;
  private elapsed: number;
  private rafId: number | null;
  private time: number;

  constructor() { ... }
  start(scenario: Scenario): void;
  stop(): void;
  applyIntervention(intervention: Intervention): void;
  subscribe(cb: (state: PatientState) => void): () => void;
  private tick(timestamp: number): void;
}
```

- [ ] **Implement tick()**:
  1. Compute delta time (cap at 100ms to prevent spiral)
  2. Advance elapsed time
  3. If scenario active: call `scenario.check()` → apply returned modifiers, queue events
  4. Process active intervention effects (advance/decay)
  5. Apply baseline drift (patient returns toward normal if untreated acute issues resolved)
  6. Generate 2 new waveform samples per buffer (wrap ring buffer)
  7. Call all subscribers with current state

- [ ] **Write and pass integration test** — start engine with a scenario, simulate 5s, verify vitals changed

---

### Task 7: React Context Bridge

**Files:**
- Create: `ui/context/SimulationContext.tsx`
- Create: `ui/hooks/useSimulation.ts`

- [ ] **Build SimulationProvider**

```typescript
// SimulationContext.tsx
const SimulationContext = createContext<{
  state: PatientState;
  engine: SimulationEngine;
  eventLog: string[];
  mode: 'guided' | 'exam' | 'free';
  setMode: (m: 'guided' | 'exam' | 'free') => void;
  startScenario: (id: string) => void;
  applyIntervention: (id: string) => void;
  scenario: Scenario | null;
} | null>(null);
```

- [ ] **Subscribe to engine** in provider, update state on each tick (throttled to React's ~16ms render cycle with `useRef` + `useState`)

- [ ] **Export useSimulation hook** as typed consumer

---

### Task 8: UI — ECG Canvas

**Files:**
- Create: `ui/components/Monitor/ECGCanvas.tsx`

- [ ] **Build canvas component**

Props: `buffer: Float32Array, bufferIndex: number, hr: number, rhythm: string`

- Canvas draws green trace on dark background
- Grid lines at 0.2s intervals (dashed)
- Buffer is a ring buffer: draw from `bufferIndex` to `bufferIndex + width` wrapping around
- Phosphor glow via `ctx.shadowBlur = 8; ctx.shadowColor = '#00ff41'`
- Scale: 25mm/s sweep speed (configurable pixels per second)
- R-peak detection for highlighting

- [ ] **Add Canvas animation loop** using `useCanvasRenderer` hook

```typescript
// ui/hooks/useCanvasRenderer.ts
export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  draw: (ctx: CanvasRenderingContext2D, timestamp: number) => void
): void;
```

---

### Task 9: UI — SpO₂ + ETCO₂ Canvases

**Files:**
- Create: `ui/components/Monitor/SpO2Canvas.tsx`
- Create: `ui/components/Monitor/ETCO2Canvas.tsx`

- [ ] **SpO₂ canvas** — cyan plethysmograph trace, narrower than ECG, same ring buffer draw pattern. Label "SpO₂" + numeric overlay in corner.

- [ ] **ETCO₂ canvas** — yellow capnography trace. Show ETCO₂ value and RR. Bronchospasm waveform changes visible.

---

### Task 10: UI — Numeric Vital Displays

**Files:**
- Create: `ui/components/Monitor/VitalDisplay.tsx`

- [ ] **Build numeric readout component**

Rows of parameter label + value. Colour coding:
- Normal: white
- Abnormal: orange
- Critical: red + pulse animation

Parameters: HR, NIBP (sys/dia/map), SpO₂, ETCO₂, RR, Temp, FiO₂

- [ ] **Build layout** positioning — ECG gets 40% height, numeric row below, then two waveform canvases side by side

---

### Task 11: UI — Alarm Indicators

**Files:**
- Create: `ui/components/Monitor/AlarmIndicator.tsx`

- [ ] **Check thresholds** each render cycle against `NORMAL_RANGES`
- [ ] **Red flash animation** on parameter box when out of range (CSS animation, 1s blink)
- [ ] **Priority system** — red (critical) > yellow (abnormal)

---

### Task 12: UI — Monitor Container + Layout

**Files:**
- Create: `ui/components/Monitor/Monitor.tsx`

- [ ] **Assemble monitor** — ECG canvas (top), numeric vitals (strip), SpO₂ + ETCO₂ canvases (side by side), additional numerics bar at bottom
- [ ] **Dark theme CSS** — `#0a0a0a` background, white text, monospace numerics
- [ ] **Responsive** — flex layout, canvas sizes computed from container

---

### Task 13: UI — Toolbar + Category Panels

**Files:**
- Create: `ui/components/Toolbar/Toolbar.tsx`
- Create: `ui/components/Toolbar/DrugPanel.tsx`
- Create: `ui/components/Toolbar/AirwayPanel.tsx`
- Create: `ui/components/Toolbar/VentilationPanel.tsx`
- Create: `ui/components/Toolbar/ProcedurePanel.tsx`
- Create: `ui/components/common/DropdownPanel.tsx`

- [ ] **DropdownPanel** — reusable slide-up panel, position absolutely above toolbar. Header with category title + close button.

- [ ] **Toolbar** — row of category buttons: [Airway] [Ventilation] [Drugs] [Procedures]. Click toggles respective panel. Dark bar at bottom of screen.

- [ ] **DrugPanel** — grid of drug buttons. Each button: drug name, dose. On click: dispatch to engine, close panel.

- [ ] **AirwayPanel** — airway action buttons. Intubate, Re-intubate, Jaw thrust, etc.

- [ ] **VentilationPanel** — FiO₂ slider + presets, RR up/down, TV up/down, PEEP up/down, Manual vent toggle.

- [ ] **ProcedurePanel** — Fluid bolus, Defib, CPR, Chest decompression buttons.

---

### Task 14: UI — Event Log

**Files:**
- Create: `ui/components/Sidebar/EventLog.tsx`

- [ ] **Build event log panel** — right side (or collapsible on narrow screens)
- [ ] **Format events** — timestamp + label + vital delta where relevant
- [ ] **Auto-scroll** — new events appear at bottom, scroll down
- [ ] **Event types** — `intervention`, `system` (vital threshold crossed), `hint`

---

### Task 15: UI — Scenario Selector + Mode Toggle

**Files:**
- Create: `ui/components/Scenario/ScenarioSelector.tsx`
- Create: `ui/components/Scenario/ModeToggle.tsx`

- [ ] **ScenarioSelector** — top bar showing current scenario name, restart button, dropdown to pick another scenario.

- [ ] **ModeToggle** — three-pill toggle: [Guided] [Exam] [Free Play]
  - Guided: hints panel visible
  - Exam: no hints, scoring
  - Free Play: all interventions available unrestricted

---

### Task 16: UI — Hints Panel (Guided Mode)

**Files:**
- Create: `ui/components/Sidebar/HintsPanel.tsx`

- [ ] **Show hints** from scenario definition in guided mode
- [ ] **Reveal progressively** — first hint after 15s without correct action, second at 30s, etc.
- [ ] **Dismiss** button

---

### Task 17: Integration — Wire Everything Together

**Files:**
- Modify: `ui/App.tsx`, `ui/App.css`

- [ ] **App.tsx layout**:

```
┌──────────────────────────────────────────────┐
│  Scenario: Anaphylaxis  [Restart]  [▼]        │
│  Mode: [Guided] [Exam] [Free Play]            │
├────────────────────────────────┬─────────────┤
│                                │  Event Log  │
│         MONITOR               │  + hints    │
│   (ECG + vitals + SpO₂+ETCO₂)  │             │
│                                │             │
├────────────────────────────────┴─────────────┤
│  [Airway] [Ventilation] [Drugs] [Procedures]  │
└──────────────────────────────────────────────┘
```

- [ ] **Apply dark theme** globally
- [ ] **Wire SimulationProvider** at root
- [ ] **Default scenario** — start with Anaphylaxis on load
- [ ] **Start engine** on mount, stop on unmount

- [ ] **Run `npm run build`** — fix any type/build errors

---

### Task 18: Polish — Visual Touches

- [ ] **Smooth transitions** on panel open/close (CSS transitions)
- [ ] **Button press feedback** on intervention buttons (brief flash/highlight)
- [ ] **Font choice** — monospace for numerics (Courier New or JetBrains Mono via Google Fonts)
- [ ] **Monitor frame** — subtle border/gradient around the monitor area to simulate monitor bezel
- [ ] **Grid lines** on ECG waveform
- [ ] **Alarm flash** — pulsing red border on out-of-range parameters
- [ ] **Responsive** — ensure 1024px+ desktop works well

---

### Task 19: Verification

- [ ] **Run `npm run build`** — verify no errors
- [ ] **Run `npm run preview`** — verify app loads
- [ ] **Manual test:** Start Anaphylaxis scenario, wait 10s → see vitals deteriorate
- [ ] **Manual test:** Give Adrenaline → see HR + BP improve over 5-10s
- [ ] **Manual test:** Switch to Oesophageal Intubation → verify ETCO₂ trace drops
- [ ] **Manual test:** Switch modes (Guided → Exam → Free Play) → verify behavior
- [ ] **Manual test:** Event log shows interventions + system events
