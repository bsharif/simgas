# Monitor Modular Rebuild — Design Spec

**Date:** 2026-05-19  
**Status:** Approved  
**Scope:** Full modular rebuild of the monitor display (`ui/components/Monitor/`)

---

## Background & motivation

The current `Monitor.tsx` has several bugs and structural limitations:

- The ART waveform never visually appears when activated (trace is enabled but `state.art === null` until an arterial line is inserted — no user feedback explains this).
- ART, CVP, and BIS numerics are correctly gated on line insertion but disappear silently with no placeholder, making it unclear whether the feature is broken or just needs a line.
- ART pressure should be a distinct display from NIBP — they are clinically separate parameters (invasive vs. non-invasive).
- NIBP is hardcoded outside the layout system with no way to deactivate it.
- Waveform and numeric are spatially disconnected (waveforms stack left, numerics stack right), which reduces rapid visual parsing.
- The wave stack uses hardcoded `grid-template-rows` percentages that break when ART is enabled as a 5th trace.
- Soft key buttons are decorative — none are wired to actions.

The rebuild replaces the monolithic component with a modular tile system inspired by Philips IntelliVue MX/MP layout principles: high-contrast dark background, colour-persistent parameters, co-located waveform and numeric per channel, and clinical workflow ordering.

---

## Layout philosophy

Parameters fall into three visual categories:

| Category | Examples | Rendered as |
|----------|----------|-------------|
| Waveform parameters | ECG/HR, SpO₂/Pleth, CO₂, Resp, ART | `MonitorBand` — full-width row, waveform left, numeric right |
| Numeric-only parameters | BIS, CVP, Temp, Pulse | `NumericTile` — compact tile in right column |
| Dedicated panel | NIBP | `NibpPanel` — bottom panel, always large, with history |

Clinical workflow ordering (top to bottom): rhythm → oxygenation → ventilation → perfusion. ECG always first, ART directly below SpO₂ when active.

---

## Component architecture

### Files changed / created

```
ui/components/Monitor/
  Monitor.tsx              REWRITE  orchestrator: reads layout, renders bands + tiles + panels
  MonitorBand.tsx          NEW      one horizontal channel: waveform canvas (left) + numeric value (right)
  NumericTile.tsx          NEW      compact tile for parameters without a waveform
  NibpPanel.tsx            NEW      NIBP lower panel: reading, MAP, history, cycle mode label
  SoftKeyRow.tsx           NEW      soft key bar with action handlers
  ECGCanvas.tsx            UNCHANGED
  SimpleWaveformCanvas.tsx UNCHANGED
  MonitorSettings.tsx      SMALL UPDATE  add NIBP enable/disable toggle
  AlarmMuteButton.tsx      UNCHANGED
```

`VitalDisplay.tsx` is unused in `SimulationView` and can be deleted.

### Monitor.tsx (orchestrator)

Reads `layout` from `useMonitorLayout()`. Derives:

1. **Visible bands** — traces where `shouldShowTrace(trace, state)` is true, each paired with its numeric via `BAND_PAIRINGS`.
2. **Visible tiles** — numerics where `shouldShowNumeric(numeric, state)` is true AND the numeric id is not claimed by any band pairing.
3. **NIBP panel** — rendered when `layout.nibpEnabled` is true.

Renders:
```
<intellivue-frame>
  <intellivue-screen>
    <StatusBar />
    <main area>
      <band-stack>           ← flex column of MonitorBand
      <tile-column>          ← flex column of NumericTile
    <NibpPanel />            ← conditional on layout.nibpEnabled
    <SoftKeyRow />
  </intellivue-screen>
</intellivue-frame>
```

### MonitorBand.tsx

Props: `trace: MonitorTrace`, `numeric: MonitorNumeric`, `engine: SimulationEngine`, `state: PatientState`, `alarmLevel?: AlarmLevel`, `nibpZeroingActive?: boolean`

Layout: flex row.
- Left (~72%): waveform canvas (`ECGCanvas` or `SimpleWaveformCanvas` based on `trace.rendererStyle`), label overlaid top-left, rhythm label overlaid top-right for ECG band, etCO₂ readout overlaid bottom-right for CO₂ band.
- Right (~28%): numeric value in band colour, label above, alarm limits below, alarm flash animation when `alarmLevel` is set.

When the band's parameter requires a line not yet inserted (ART), and `enabled` is true but `shouldShowTrace` returns false: render the band slot with a dim "Insert line to activate" placeholder instead of hiding entirely. This preserves layout stability and gives the user feedback.

Height is determined by `trace.flexWeight` (see data model). The band stack is `display: flex; flex-direction: column` — each band gets `flex: <flexWeight>`.

### NumericTile.tsx

Props: `numeric: MonitorNumeric`, `value: string`, `alarmLevel?: AlarmLevel`

Compact dark tile: label (small, top), value (large, colour-matched), alarm limits (small, bottom). Alarm flash on `alarmLevel`. When `numeric.enabled` is true but the line is not yet inserted: renders a dim placeholder tile with "—" rather than disappearing.

### NibpPanel.tsx

Receives NIBP cycle state and callbacks as props — the hook lives in `Monitor.tsx` so it can be shared with `SoftKeyRow` without a ref.

```ts
interface NibpPanelProps {
  state: PatientState
  measuring: boolean
  interval: NibpInterval
  history: NibpHistoryEntry[]
}

type NibpInterval = '1min' | '2.5min' | '5min' | '10min' | 'manual'
interface NibpHistoryEntry { time: string; sys: number; dia: number; map: number }
```

`useNibpCycle(state)` hook (lives in `Monitor.tsx`):
- On mount, seeds `history` with 6 synthesised readings from current `state.nibp`.
- `triggerCycle()`: sets `measuring = true`, waits 4 s, generates a new reading (±5 mmHg from current `state.nibp`), prepends to history (keeps last 6), sets `measuring = false`.
- `cycleInterval()`: advances through the `NibpInterval` enum in order, resets the auto-timer.
- `cancelCycle()`: clears the active timer, sets `measuring = false`.
- Returns `{ measuring, interval, history, triggerCycle, cancelCycle, cycleInterval }`.

`NibpPanel` renders the large sys/dia reading, MAP, "Auto X min" mode label (or "Measuring…" during a cycle), and the last 6 readings in a compact history list. Colour: `#8f6cff` (existing purple, matching the current hardcoded NBP colour).

### SoftKeyRow.tsx

Replaces the existing `SoftKey` component. Receives action callbacks as props:

```ts
interface SoftKeyRowProps {
  onAcknowledge: () => void
  onPauseAlarms: () => void
  onStartStopNbp: () => void
  onRepeatTime: () => void
  onZeroArt: () => void
  artLineActive: boolean      // Zero key only active when ART line inserted
  alarmsMuted: boolean        // Pause Alarms key shows active state when muted
  nibpMeasuring: boolean      // Start/Stop NBP key shows active state when measuring
}
```

`Monitor.tsx` calls `useNibpCycle`, `useAlarmsContext`, and passes the resulting callbacks down to `SoftKeyRow`.

Five wired keys + five decorative keys (QRS Volume, Vitals Trend, Monitor Standby, Main Setup, Main Screen). Decorative keys render with reduced opacity and `cursor: default`.

Zero key: visually disabled (`opacity: 0.35`, no click) when `!artLineActive`.

---

## Data model changes (`engine/monitor/layout.ts`)

### 1. Band pairings (static, not persisted)

```ts
export const BAND_PAIRINGS: Readonly<Record<TraceId, NumericId>> = {
  'ecg-ii': 'hr',
  'pleth':  'spo2',
  'co2':    'etco2',
  'resp':   'rr',
  'art':    'art',
}
```

### 2. `flexWeight` on `MonitorTrace`

```ts
export interface MonitorTrace {
  // ... existing fields ...
  flexWeight: number   // relative height in band stack; default 1
}
```

Default weights in `DEFAULT_LAYOUT`:

| Trace | Weight |
|-------|--------|
| ECG II | 3 |
| Pleth | 2.5 |
| CO₂ | 2 |
| Resp | 1.5 |
| ART | 2.5 |

### 3. `nibpEnabled` on `MonitorLayout`

```ts
export interface MonitorLayout {
  traces: MonitorTrace[]
  numerics: MonitorNumeric[]
  nibpEnabled: boolean   // default: true
}
```

`MonitorSettings` gets a NIBP toggle in the numerics section. `MonitorLayoutContext.loadLayout()` already falls back to `DEFAULT_LAYOUT` on shape mismatch, so no migration needed.

### 4. `etco2` and `fio2` added to numerics

`etco2` and `fio2` are currently not in the `numerics` array (CO₂ value is overlaid directly on the CO₂ band). They stay as band overlays — no change needed here. FiO₂ and MAC remain numeric tiles.

---

## AlarmsContext addition

`acknowledgeAlarm()` — clears the highest-priority active alarm from the current alarm set. The alarm can re-trigger on the next threshold evaluation. This mirrors the IntelliVue "Acknowledge" behaviour (silence this specific alarm event, not all alarms).

Implementation: add to `AlarmsContext` value type and wire through `useAlarms`.

---

## Colour palette (unchanged from existing)

| Parameter | Colour |
|-----------|--------|
| ECG / HR | `#65f36f` green |
| SpO₂ / Pleth | `#19c8ff` cyan |
| CO₂ | `#ffd94a` yellow |
| Resp | `#eaf4ff` white-blue |
| ART | `#ff5566` red |
| CVP | `#9ed5ff` light blue |
| BIS | `#c4a8ff` purple |
| NIBP | `#8f6cff` violet |
| Temp | `#65f36f` green (shared with HR) |

---

## Bugs resolved by rebuild

| Bug | Resolution |
|-----|-----------|
| ART waveform never shows when activated | `MonitorBand` placeholder renders with "Insert line to activate" when `state.art === null`; waveform appears automatically once arterial line intervention is applied |
| ART/CVP/BIS numerics don't appear | `NumericTile` renders placeholder "—" tile when line not inserted, rather than hiding entirely — makes the feature discoverable |
| ART not separate from NIBP | ART is a `MonitorBand` in the main area; NIBP is `NibpPanel` at the bottom — structurally independent |
| No NIBP deactivation | `nibpEnabled: boolean` in layout; `NibpPanel` only renders when true |
| Hardcoded wave stack grid breaks with 5 traces | Replaced with `flexWeight`-driven flex layout |

---

## Out of scope

- Engine changes for NIBP (measurement simulation is UI-side only)
- Alarm sound / tone implementation
- Vitals trend view (Vitals Trend soft key remains decorative)
- Monitor Standby functionality
- QRS Volume control
- Waveform sweep speed control
- Drag-to-reorder bands
