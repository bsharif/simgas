# SimGas PoC Design Document

> **Goal:** Build a polished investor-facing web proof-of-concept for the SimGas anaesthetic simulation monitor app.

**Tech Stack:** Vite + React + TypeScript + Canvas 2D
**Engine:** Pure TypeScript game loop (requestAnimationFrame) — portable to iOS/Swift later
**Scenarios:** 3 demo scenarios — Anaphylaxis, Oesophageal Intubation, Malignant Hyperthermia

---

## Architecture

```
simgas/
├── engine/            # Pure TypeScript simulation engine (no React)
│   ├── patient.ts     # PatientState type, modifiers, normal ranges
│   ├── physiology.ts  # Tick-based simulation loop (~60fps)
│   ├── waveforms.ts   # Synthetic ECG/SpO₂/ETCO₂ sample generation
│   ├── interventions.ts # Drug/procedure effect definitions
│   └── scenarios/     # Scenario definitions
│       ├── anaphylaxis.ts
│       ├── oesophageal-intubation.ts
│       └── malignant-hyperthermia.ts
├── ui/                # React application
│   ├── components/
│   │   ├── Monitor/
│   │   │   ├── Monitor.tsx         # Full monitor container
│   │   │   ├── ECGCanvas.tsx       # ECG waveform canvas
│   │   │   ├── SpO2Canvas.tsx      # Plethysmograph canvas
│   │   │   ├── ETCO2Canvas.tsx     # Capnography canvas
│   │   │   ├── VitalDisplay.tsx    # Numeric readouts
│   │   │   └── AlarmIndicator.tsx  # Red flash on threshold breach
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx         # Bottom toolbar container
│   │   │   ├── DrugPanel.tsx       # Drug drawer
│   │   │   ├── AirwayPanel.tsx     # Airway interventions
│   │   │   ├── VentilationPanel.tsx # Ventilation controls
│   │   │   └── ProcedurePanel.tsx  # Procedures
│   │   ├── Sidebar/
│   │   │   ├── EventLog.tsx        # Timeline of actions + events
│   │   │   └── HintsPanel.tsx      # Guided mode hints
│   │   ├── Scenario/
│   │   │   ├── ScenarioSelector.tsx # Pick/restart scenario
│   │   │   └── ModeToggle.tsx      # Guided / Exam / Free Play
│   │   └── common/
│   │       └── DropdownPanel.tsx   # Reusable slide-up panel
│   ├── hooks/
│   │   ├── useSimulation.ts       # Subscribe to engine state
│   │   └── useCanvasRenderer.ts   # Canvas animation loop
│   ├── context/
│   │   └── SimulationContext.tsx   # React context for engine bridge
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Data Flow:**
1. Engine owns `PatientState` — a plain object with all vitals and modifiers
2. Engine runs `requestAnimationFrame` loop, ~60 ticks/sec
3. Each tick: apply scenario modifiers → apply intervention deltas → generate waveform samples
4. Publish new state via a simple pub/sub
5. React context subscribes, React components re-render
6. Canvas refs draw waveforms from ring buffers (last ~10s of samples at 120Hz)

---

## Engine Design

### PatientState
```typescript
interface PatientState {
  hr: number;
  spo2: number;
  nibp: { sys: number; dia: number; map: number };
  etco2: number;
  rr: number;
  temp: number;
  fio2: number;
  consciousness: 'awake' | 'sedated' | 'unconscious';
  ecgRhythm: 'sinus' | 'vf' | 'vt' | 'asystole' | 'svt';
  ecgBuffer: Float32Array;   // ring buffer, 2048 samples
  spo2Buffer: Float32Array;
  etco2Buffer: Float32Array;
}
```

### Tick Loop
Each frame (~16ms):
1. Apply scenario progression modifiers (time-based deterioration/improvement)
2. Apply active intervention deltas (onset curves, durations)
3. Generate 2-3 new waveform samples per buffer
4. Check alarm thresholds → fire events
5. Publish state snapshot to subscribers

### Waveform Synthesis
- **ECG:** Sum of Gaussian kernels for P, Q, R, S, T waves. R-R interval derived from HR. Morphology changes per rhythm. Add 60Hz noise + baseline wander for realism.
- **SpO₂:** Sine wave with dicrotic notch. Frequency = HR. Amplitude modulated by SpO₂ value (poor saturation → lower amplitude).
- **ETCO₂:** Ramp (expiration) → plateau → rapid drop (inspiration). Height = ETCO₂ value. Bronchospasm adds sawtooth oscillation on plateau.

### Intervention Effects
Interventions return modifier objects applied over time:
```typescript
interface InterventionEffect {
  immediate?: Partial<PatientState>;
  ramp?: { target: Partial<PatientState>; duration: number };
  delay?: number; // seconds before onset
}
```

### Scenarios
Each scenario is an object:
```typescript
interface Scenario {
  id: string;
  label: string;
  description: string;
  initialVitals: Partial<PatientState>;
  severity: 'mild' | 'moderate' | 'severe';
  progression: (elapsed: number, interventions: Intervention[]) => Modifier;
  correctInterventions: string[];
  criticalInterventions: string[];
  hints: string[];
}
```

---

## UI Design

### Monitor Layout
Full-screen dark theme. ECG waveform spans top ~40%. Numeric vitals are overlaid on or beside waveforms. SpO₂ and ETCO₂ waveforms sit side-by-side below. Additional numerics in a strip across the bottom.

### Colour Palette
- Background: `#0a0a0a`
- ECG trace: `#00ff41` (classic green)
- SpO₂ trace: `#00bfff` (cyan)
- ETCO₂ trace: `#ffd700` (yellow)
- Numerics: white, orange for alarm values
- Toolbar: `#1a1a2e` with `#16213e` panels
- Alarm: `#ff0033` flash

### Waveform Canvas
- Anti-aliased path drawing
- Subtle grid overlay (dashed lines at 0.2s intervals)
- Sweep left every ~80ms (shift buffer, draw from right)
- Green phosphor glow effect via shadowBlur

### Intervention Toolbar
- Bottom dock, dark panel
- Category buttons: Airway | Ventilation | Drugs | Procedures
- Click opens slide-up drawer with action buttons
- Clicking an intervention: button briefly highlights, event logged, engine applies effect

### Event Log
- Right side panel (collapsible on narrow screens)
- Chronological list: `[+12s] Adrenaline 1mcg IV — HR 82→98`
- System events highlighted: `⚠ ETCO₂ dropping — 5.0→2.1 kPa`

---

## Demo Scenarios

### 1. Anaphylaxis
- **Onset:** Sudden hypotension, tachycardia, bronchospasm
- **Vitals:** BP 120/80 → 75/40, HR 78 → 130, SpO₂ 99% → 88%, ETCO₂ shows bronchospasm pattern
- **Correct:** Adrenaline + fluids + 100% O₂
- **Wrong:** Continue anaesthetic → worsening
- **Resolution:** Gradual normalisation over 60s

### 2. Oesophageal Intubation
- **Onset:** ETCO₂ rapid drop from 5.0 to 0.5 kPa
- **Vitals:** SpO₂ 99% → 92% → falling, HR 78 → 110 → 50 (bradycardia before arrest)
- **Correct:** Recognise, re-intubate → ETCO₂ returns
- **Wrong:** Miss it → hypoxia → arrest
- **Resolution:** Instant ETCO₂ return on correct tube placement

### 3. Malignant Hyperthermia
- **Onset:** ETCO₂ rising (5.0 → 8.0), temp climbing (37 → 40+), HR↑, muscle rigidity
- **Vitals:** ETCO₂ 5.0→8.5 kPa, Temp 37→40.2°C, HR 78→145, SpO₂ maintained until late
- **Correct:** Dantrolene + hyperventilation + cooling + stop volatiles
- **Wrong:** Continue volatiles → cardiac arrest
- **Resolution:** Slow improvement over 120s

---

## Build & Tooling

- **Vite:** Fast dev server, TypeScript ESM, HMR
- **Vitest:** Unit tests for engine/scenarios
- **TypeScript:** strict mode
- **No state library:** React context + useReducer
- **No router:** Single page, scenario switching via state

### Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run test` — vitest
- `npm run preview` — preview production build

---

## Out of Scope (PoC)
- Audio/ECG beeps
- Multiplayer
- Persistent scoring/profiles
- Instructor mode
- Responsive phone layout (target: desktop/tablet)
- Accessibility features
