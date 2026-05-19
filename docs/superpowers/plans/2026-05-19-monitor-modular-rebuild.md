# Monitor Modular Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic Monitor.tsx with modular MonitorBand / NumericTile / NibpPanel / SoftKeyRow components, fix ART waveform and invasive-numeric display bugs, and wire up five soft key actions.

**Architecture:** Each waveform parameter becomes a full-width `MonitorBand` (canvas left, numeric right). Numeric-only parameters become compact `NumericTile`s in a right column. NIBP keeps a dedicated bottom panel driven by a `useNibpCycle` hook in Monitor.tsx. Band heights are flex-weight-driven (no hardcoded grid percentages).

**Tech Stack:** React 19, TypeScript (strict), Vite, CSS (no CSS-in-JS), Vitest (engine tests only — UI is manually tested via `npm run dev`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `engine/monitor/layout.ts` | Add `BAND_PAIRINGS`, `flexWeight` on trace, `nibpEnabled` on layout |
| Modify | `ui/hooks/useAlarms.ts` | Add `acknowledgeAlarm()`, filter acknowledged breaches |
| Modify | `ui/context/AlarmsContext.tsx` | Export `acknowledgeAlarm` in context value type |
| Create | `ui/components/Monitor/monitorUtils.ts` | `numericValue()`, `lineIsActive()` shared helpers |
| Create | `ui/components/Monitor/NumericTile.tsx` | Compact tile: label + large value + alarm flash |
| Create | `ui/components/Monitor/MonitorBand.tsx` | Full-width band: waveform canvas + numeric panel |
| Create | `ui/hooks/useNibpCycle.ts` | NIBP cycle state: history, measuring, interval, trigger/cancel |
| Create | `ui/components/Monitor/NibpPanel.tsx` | NIBP bottom panel: large reading + history + mode label |
| Create | `ui/components/Monitor/SoftKeyRow.tsx` | 10 soft keys, 5 wired to callbacks |
| Rewrite | `ui/components/Monitor/Monitor.tsx` | Orchestrator: derives bands/tiles, owns cycle hook, renders layout |
| Modify | `ui/components/Monitor/MonitorSettings.tsx` | Add NIBP enable/disable toggle |
| Modify | `ui/index.css` | New band/tile CSS, remove old hardcoded grid rules |
| Delete | `ui/components/Monitor/VitalDisplay.tsx` | Unused component |

---

## Task 1: Update `engine/monitor/layout.ts`

**Files:**
- Modify: `engine/monitor/layout.ts`

- [ ] **Step 1: Add `BAND_PAIRINGS`, `flexWeight`, `nibpEnabled`**

Replace the entire file content:

```typescript
import type { WaveformBufferKey } from '../patient'

export type TraceId = 'ecg-ii' | 'pleth' | 'co2' | 'resp' | 'art'

export type NumericId =
  | 'hr' | 'pulse' | 'spo2' | 'rr' | 'temp'
  | 'etco2' | 'fio2' | 'mac'
  | 'art' | 'cvp' | 'bis'

export type RendererStyle = 'ecg' | 'simple'

export interface MonitorTrace {
  id: TraceId
  bufferKey: WaveformBufferKey
  rendererStyle: RendererStyle
  color: string
  label: string
  enabled: boolean
  /** Relative height in the band stack flex column. */
  flexWeight: number
}

export interface MonitorNumeric {
  id: NumericId
  label: string
  color: string
  enabled: boolean
  alarmLo: number | null
  alarmHi: number | null
  muted: boolean
}

export interface MonitorLayout {
  traces: MonitorTrace[]
  numerics: MonitorNumeric[]
  /** Whether the NIBP bottom panel is visible. */
  nibpEnabled: boolean
}

/**
 * Maps each trace to the numeric whose value appears on the right side of
 * that band. Not persisted — derived at render time.
 */
export const BAND_PAIRINGS: Readonly<Record<TraceId, NumericId>> = {
  'ecg-ii': 'hr',
  'pleth':  'spo2',
  'co2':    'etco2',
  'resp':   'rr',
  'art':    'art',
}

export const DEFAULT_LAYOUT: MonitorLayout = {
  nibpEnabled: true,
  traces: [
    { id: 'ecg-ii', bufferKey: 'ecgBuffer',   rendererStyle: 'ecg',    color: '#65f36f', label: 'II',    enabled: true,  flexWeight: 3   },
    { id: 'pleth',  bufferKey: 'spo2Buffer',  rendererStyle: 'simple', color: '#19c8ff', label: 'Pleth', enabled: true,  flexWeight: 2.5 },
    { id: 'co2',    bufferKey: 'etco2Buffer', rendererStyle: 'simple', color: '#ffd94a', label: 'CO2',   enabled: true,  flexWeight: 2   },
    { id: 'resp',   bufferKey: 'respBuffer',  rendererStyle: 'simple', color: '#eaf4ff', label: 'Resp',  enabled: true,  flexWeight: 1.5 },
    { id: 'art',    bufferKey: 'artBuffer',   rendererStyle: 'ecg',    color: '#ff5566', label: 'ART',   enabled: false, flexWeight: 2.5 },
  ],
  numerics: [
    { id: 'hr',    label: 'HR',    color: '#65f36f', enabled: true,  alarmLo: 50,   alarmHi: 120,  muted: false },
    { id: 'pulse', label: 'Pulse', color: '#19c8ff', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
    { id: 'spo2',  label: 'SpO2',  color: '#19c8ff', enabled: true,  alarmLo: 92,   alarmHi: 100,  muted: false },
    { id: 'rr',    label: 'RR',    color: '#eaf4ff', enabled: true,  alarmLo: 8,    alarmHi: 35,   muted: false },
    { id: 'temp',  label: 'Temp',  color: '#65f36f', enabled: true,  alarmLo: 35.5, alarmHi: 38.5, muted: false },
    { id: 'art',   label: 'ART',   color: '#ff5566', enabled: false, alarmLo: 65,   alarmHi: 180,  muted: false },
    { id: 'cvp',   label: 'CVP',   color: '#9ed5ff', enabled: false, alarmLo: 2,    alarmHi: 16,   muted: false },
    { id: 'bis',   label: 'BIS',   color: '#c4a8ff', enabled: false, alarmLo: 40,   alarmHi: 60,   muted: false },
    { id: 'fio2',  label: 'FiO2',  color: '#65f36f', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
    { id: 'mac',   label: 'MAC',   color: '#65f36f', enabled: true,  alarmLo: null, alarmHi: null, muted: false },
  ],
}

export const PRESET_CARDIAC: MonitorLayout = {
  nibpEnabled: true,
  traces: DEFAULT_LAYOUT.traces.map(t => ({
    ...t,
    enabled: t.id === 'ecg-ii' || t.id === 'pleth' || t.id === 'art',
  })),
  numerics: DEFAULT_LAYOUT.numerics.map(n => ({
    ...n,
    enabled: n.id === 'hr' || n.id === 'pulse' || n.id === 'spo2' || n.id === 'art' || n.id === 'temp',
  })),
}

export const PRESET_NEURO: MonitorLayout = {
  nibpEnabled: true,
  traces: DEFAULT_LAYOUT.traces.map(t => ({
    ...t,
    enabled: t.id === 'ecg-ii' || t.id === 'pleth' || t.id === 'co2',
  })),
  numerics: DEFAULT_LAYOUT.numerics.map(n => ({
    ...n,
    enabled: n.id === 'hr' || n.id === 'spo2' || n.id === 'etco2' || n.id === 'bis' || n.id === 'temp',
  })),
}

export const PRESETS: Record<string, MonitorLayout> = {
  default: DEFAULT_LAYOUT,
  cardiac: PRESET_CARDIAC,
  neuro: PRESET_NEURO,
}
```

- [ ] **Step 2: Run typecheck to confirm no breakage**

```bash
npm run typecheck
```

Expected: no errors. (The `MonitorLayoutContext` shape-check already falls back to `DEFAULT_LAYOUT` on mismatch, so old localStorage is handled.)

- [ ] **Step 3: Commit**

```bash
git add engine/monitor/layout.ts
git commit -m "feat(layout): add BAND_PAIRINGS, flexWeight, nibpEnabled"
```

---

## Task 2: Add `acknowledgeAlarm` to useAlarms + AlarmsContext

**Files:**
- Modify: `ui/hooks/useAlarms.ts`
- Modify: `ui/context/AlarmsContext.tsx`

- [ ] **Step 1: Add acknowledged-breach state and `acknowledgeAlarm` to `useAlarms.ts`**

Replace the `UseAlarmsResult` interface and the return value in `ui/hooks/useAlarms.ts`:

```typescript
// Add to the top of the file (after existing imports):
const ALARM_RANK: Record<AlarmPriority, number> = { none: 0, cyan: 1, yellow: 2, red: 3 }

interface UseAlarmsResult {
  priority: AlarmPriority
  byNumeric: ReadonlyMap<NumericId, AlarmPriority>
  isMuted: boolean
  toggleMute: () => void
  muteRemainingSec: number | null
  acknowledgeAlarm: () => void
}
```

Inside `useAlarms`, after the `detection` memo, add:

```typescript
  // Acknowledged breaches are suppressed until the value returns to normal.
  const [acknowledgedIds, setAcknowledgedIds] = useState<ReadonlySet<NumericId>>(
    () => new Set<NumericId>()
  )

  // Clear acknowledged ids that are no longer breaching (so they can re-alarm).
  useEffect(() => {
    if (acknowledgedIds.size === 0) return
    const stillBreaching = detection.byNumeric
    const next = new Set([...acknowledgedIds].filter(id => stillBreaching.has(id)))
    if (next.size !== acknowledgedIds.size) setAcknowledgedIds(next)
  }, [detection.byNumeric, acknowledgedIds])

  const effectiveByNumeric = useMemo((): ReadonlyMap<NumericId, AlarmPriority> => {
    if (acknowledgedIds.size === 0) return detection.byNumeric
    const m = new Map(detection.byNumeric)
    for (const id of acknowledgedIds) m.delete(id)
    return m
  }, [detection.byNumeric, acknowledgedIds])

  const effectivePriority = useMemo((): AlarmPriority => {
    let highest: AlarmPriority = 'none'
    for (const p of effectiveByNumeric.values()) {
      if (ALARM_RANK[p] > ALARM_RANK[highest]) highest = p
    }
    return highest
  }, [effectiveByNumeric])

  const acknowledgeAlarm = useCallback(() => {
    setAcknowledgedIds(new Set(detection.byNumeric.keys()))
  }, [detection.byNumeric])
```

Update the `useEffect` for scheduling beeps to use `effectivePriority` instead of `detection.priority`:

```typescript
  useEffect(() => {
    const priority = effectivePriority   // was: detection.priority
    // ... rest of effect unchanged ...
  }, [effectivePriority, isMuted])       // update deps accordingly
```

Update the return statement:

```typescript
  return {
    priority: effectivePriority,
    byNumeric: effectiveByNumeric,
    isMuted,
    toggleMute,
    muteRemainingSec,
    acknowledgeAlarm,
  }
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/hooks/useAlarms.ts ui/context/AlarmsContext.tsx
git commit -m "feat(alarms): add acknowledgeAlarm() to suppress active breaches"
```

---

## Task 3: Create `monitorUtils.ts`

**Files:**
- Create: `ui/components/Monitor/monitorUtils.ts`

- [ ] **Step 1: Write the file**

```typescript
// ui/components/Monitor/monitorUtils.ts
import type { NumericId } from '../../../engine/monitor/layout'
import type { PatientState } from '../../../engine/patient'

function round(val: number): number {
  return Math.max(0, Math.round(val))
}

export function numericValue(id: NumericId, state: PatientState): string {
  switch (id) {
    case 'hr':    return String(round(state.hr))
    case 'pulse': return String(round(state.hr))
    case 'spo2':  return String(round(state.spo2))
    case 'rr':    return String(round(state.rr))
    case 'temp':  return Math.max(0, state.temp).toFixed(1)
    case 'etco2': return Math.max(0, state.etco2).toFixed(1)
    case 'fio2':  return `${Math.round(state.fio2 * 100)}`
    case 'mac':   return state.sevoflurane.toFixed(1)
    case 'art':   return state.art ? `${round(state.art.sys)}/${round(state.art.dia)}` : '—'
    case 'cvp':   return state.cvp !== null ? String(round(state.cvp)) : '—'
    case 'bis':   return state.bis !== null ? String(round(state.bis)) : '—'
  }
}

/** Returns false for invasive parameters (ART, CVP, BIS) when the line is not yet inserted. */
export function lineIsActive(id: NumericId, state: PatientState): boolean {
  if (id === 'art') return state.art !== null
  if (id === 'cvp') return state.cvp !== null
  if (id === 'bis') return state.bis !== null
  return true
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/components/Monitor/monitorUtils.ts
git commit -m "feat(monitor): add shared numericValue and lineIsActive helpers"
```

---

## Task 4: Create `NumericTile.tsx`

**Files:**
- Create: `ui/components/Monitor/NumericTile.tsx`

- [ ] **Step 1: Write the component**

```typescript
// ui/components/Monitor/NumericTile.tsx
import type { FC } from 'react'
import type { MonitorNumeric } from '../../../engine/monitor/layout'
import type { AlarmPriority } from '../../../engine/alarms'

interface NumericTileProps {
  numeric: MonitorNumeric
  value: string
  alarmLevel?: AlarmPriority
  /** False when the invasive line for this parameter is not yet inserted. */
  lineActive?: boolean
}

const NumericTile: FC<NumericTileProps> = ({ numeric, value, alarmLevel, lineActive = true }) => {
  const alarmClass = alarmLevel && alarmLevel !== 'none'
    ? ` numeric--alarm numeric--alarm-${alarmLevel}`
    : ''

  return (
    <div
      className={`numeric-tile${alarmClass}`}
      style={{ color: numeric.color, borderLeftColor: numeric.color }}
    >
      <span className="numeric-tile__label">{numeric.label}</span>
      <span
        className={`numeric-tile__value${!lineActive ? ' numeric-tile__value--inactive' : ''}`}
        style={{ color: numeric.color }}
      >
        {lineActive ? value : '—'}
      </span>
      {!lineActive && (
        <span className="numeric-tile__inactive-hint">insert line</span>
      )}
      {lineActive && (numeric.alarmLo !== null || numeric.alarmHi !== null) && (
        <span className="numeric-tile__limits">
          {numeric.alarmLo ?? '—'} – {numeric.alarmHi ?? '—'}
        </span>
      )}
    </div>
  )
}

export default NumericTile
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/components/Monitor/NumericTile.tsx
git commit -m "feat(monitor): add NumericTile component"
```

---

## Task 5: Create `MonitorBand.tsx`

**Files:**
- Create: `ui/components/Monitor/MonitorBand.tsx`

- [ ] **Step 1: Write the component**

```typescript
// ui/components/Monitor/MonitorBand.tsx
import type { FC } from 'react'
import type { MonitorTrace, MonitorNumeric } from '../../../engine/monitor/layout'
import type { PatientState, EcgRhythm } from '../../../engine/patient'
import type { SimulationEngine } from '../../../engine/physiology'
import type { AlarmPriority } from '../../../engine/alarms'
import ECGCanvas from './ECGCanvas'
import SimpleWaveformCanvas from './SimpleWaveformCanvas'
import { numericValue, lineIsActive } from './monitorUtils'

const RHYTHM_LABELS: Record<EcgRhythm, string> = {
  sinus: 'Sinus Rhythm',
  vf: 'Ventricular Fibrillation',
  vt: 'Ventricular Tachycardia',
  svt: 'Supraventricular Tachycardia',
  asystole: 'Asystole',
}

interface MonitorBandProps {
  trace: MonitorTrace
  numeric: MonitorNumeric
  engine: SimulationEngine
  state: PatientState
  alarmLevel?: AlarmPriority
  /** True when the Zero ART transducer action is in progress. */
  artZeroing?: boolean
}

const MonitorBand: FC<MonitorBandProps> = ({
  trace, numeric, engine, state, alarmLevel, artZeroing = false,
}) => {
  const active = lineIsActive(trace.id === 'art' ? 'art' : numeric.id, state)
  const alarmClass = alarmLevel && alarmLevel !== 'none'
    ? ` numeric--alarm numeric--alarm-${alarmLevel}`
    : ''

  return (
    <div
      className={`monitor-band${!active ? ' monitor-band--placeholder' : ''}`}
      style={{ flex: trace.flexWeight }}
    >
      {/* Waveform side */}
      <div className="monitor-band__waveform">
        <span className="monitor-band__trace-label" style={{ color: trace.color }}>
          {trace.label}
        </span>

        {active ? (
          trace.rendererStyle === 'ecg' ? (
            <ECGCanvas engine={engine} bufferKey={trace.bufferKey} color={trace.color} />
          ) : (
            <SimpleWaveformCanvas engine={engine} bufferKey={trace.bufferKey} color={trace.color} />
          )
        ) : (
          <div className="monitor-band__inactive-hint">Insert line to activate</div>
        )}

        {trace.id === 'ecg-ii' && (
          <span className="intellivue-rhythm">{RHYTHM_LABELS[state.ecgRhythm]}</span>
        )}

        {trace.id === 'co2' && active && (
          <div className="intellivue-co2-readout">
            <span>etCO2</span>
            <strong>{Math.max(0, state.etco2).toFixed(1)}</strong>
            <span>kPa</span>
          </div>
        )}

        {trace.id === 'art' && artZeroing && (
          <span className="monitor-band__zeroing-label">Zeroing…</span>
        )}
      </div>

      {/* Numeric side */}
      <div className={`monitor-band__numeric${alarmClass}`} style={{ color: numeric.color }}>
        <span className="monitor-band__numeric-label">{numeric.label}</span>
        <strong className="monitor-band__numeric-value" style={{ color: numeric.color }}>
          {active ? numericValue(numeric.id, state) : '—'}
        </strong>
        {numeric.alarmHi !== null && (
          <small className="monitor-band__numeric-limits">
            {numeric.alarmLo} – {numeric.alarmHi}
          </small>
        )}
      </div>
    </div>
  )
}

export default MonitorBand
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/components/Monitor/MonitorBand.tsx
git commit -m "feat(monitor): add MonitorBand component"
```

---

## Task 6: Create `useNibpCycle.ts`

**Files:**
- Create: `ui/hooks/useNibpCycle.ts`

- [ ] **Step 1: Write the hook**

```typescript
// ui/hooks/useNibpCycle.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { NibpReading } from '../../engine/patient'

export type NibpInterval = '1min' | '2.5min' | '5min' | '10min' | 'manual'

export interface NibpHistoryEntry {
  time: string
  sys: number
  dia: number
  map: number
}

const INTERVAL_MS: Record<NibpInterval, number> = {
  '1min':   60_000,
  '2.5min': 150_000,
  '5min':   300_000,
  '10min':  600_000,
  'manual': Infinity,
}

const INTERVAL_ORDER: NibpInterval[] = ['1min', '2.5min', '5min', '10min', 'manual']

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// eslint-disable-next-line react-hooks/purity
function seedHistory(nibp: NibpReading, count = 6): NibpHistoryEntry[] {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const minutesBack = (count - i) * 5
    // eslint-disable-next-line react-hooks/purity
    const jitter = (Math.random() - 0.5) * 10
    const sys = Math.max(60, Math.round(nibp.sys + jitter))
    const dia = Math.max(40, Math.round(nibp.dia + jitter * 0.6))
    const map = Math.round((sys + 2 * dia) / 3)
    return { time: formatTime(new Date(now - minutesBack * 60_000)), sys, dia, map }
  })
}

export interface NibpCycleResult {
  measuring: boolean
  interval: NibpInterval
  history: NibpHistoryEntry[]
  triggerCycle: () => void
  cancelCycle: () => void
  cycleInterval: () => void
}

export function useNibpCycle(nibp: NibpReading): NibpCycleResult {
  const [measuring, setMeasuring] = useState(false)
  const [interval, setInterval_] = useState<NibpInterval>('5min')
  const [history, setHistory] = useState<NibpHistoryEntry[]>(() => seedHistory(nibp))
  const nibpRef = useRef(nibp)
  nibpRef.current = nibp

  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelCycle = useCallback(() => {
    if (measureTimerRef.current !== null) {
      clearTimeout(measureTimerRef.current)
      measureTimerRef.current = null
    }
    setMeasuring(false)
  }, [])

  const triggerCycle = useCallback(() => {
    if (measureTimerRef.current !== null) clearTimeout(measureTimerRef.current)
    setMeasuring(true)
    measureTimerRef.current = setTimeout(() => {
      const current = nibpRef.current
      // eslint-disable-next-line react-hooks/purity
      const jitter = (Math.random() - 0.5) * 10
      const sys = Math.max(60, Math.round(current.sys + jitter))
      const dia = Math.max(40, Math.round(current.dia + jitter * 0.6))
      const map = Math.round((sys + 2 * dia) / 3)
      // eslint-disable-next-line react-hooks/purity
      const entry: NibpHistoryEntry = { time: formatTime(new Date()), sys, dia, map }
      setHistory(prev => [entry, ...prev].slice(0, 6))
      setMeasuring(false)
      measureTimerRef.current = null
    }, 4_000)
  }, [])

  const cycleInterval = useCallback(() => {
    setInterval_(prev => {
      const idx = INTERVAL_ORDER.indexOf(prev)
      return INTERVAL_ORDER[(idx + 1) % INTERVAL_ORDER.length]
    })
  }, [])

  // Auto-trigger on interval.
  const triggerRef = useRef(triggerCycle)
  triggerRef.current = triggerCycle
  useEffect(() => {
    if (interval === 'manual') return
    const ms = INTERVAL_MS[interval]
    const id = window.setInterval(() => triggerRef.current(), ms)
    return () => window.clearInterval(id)
  }, [interval])

  // Cleanup on unmount.
  useEffect(() => () => { cancelCycle() }, [cancelCycle])

  return { measuring, interval, history, triggerCycle, cancelCycle, cycleInterval }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/hooks/useNibpCycle.ts
git commit -m "feat(monitor): add useNibpCycle hook for NIBP measurement simulation"
```

---

## Task 7: Create `NibpPanel.tsx`

**Files:**
- Create: `ui/components/Monitor/NibpPanel.tsx`

- [ ] **Step 1: Write the component**

```typescript
// ui/components/Monitor/NibpPanel.tsx
import type { FC } from 'react'
import type { PatientState } from '../../../engine/patient'
import type { NibpInterval, NibpHistoryEntry } from '../../hooks/useNibpCycle'

interface NibpPanelProps {
  state: PatientState
  measuring: boolean
  interval: NibpInterval
  history: NibpHistoryEntry[]
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const NibpPanel: FC<NibpPanelProps> = ({ state, measuring, interval, history }) => {
  const sys = Math.max(0, Math.round(state.nibp.sys))
  const dia = Math.max(0, Math.round(state.nibp.dia))
  const map = Math.max(0, Math.round(state.nibp.map))
  // eslint-disable-next-line react-hooks/purity
  const clockNow = formatClock(new Date())
  const modeLabel = interval === 'manual' ? 'Manual' : `Auto  ${interval}`

  return (
    <div className="intellivue-lower">
      <section className="nbp-panel">
        <div className="nbp-panel__labels">
          <span>NBP</span>
          <small>Pulse {Math.round(state.hr)}</small>
          <small>{state.nibp.sys > 0 ? `Sys ${Math.round(state.nibp.sys)}` : ''}</small>
        </div>
        {measuring ? (
          <strong className="nbp-panel__measuring">Measuring…</strong>
        ) : (
          <>
            <strong>{sys}/{dia}</strong>
            <em>({map})</em>
          </>
        )}
        <span className="nbp-panel__mode">{modeLabel}</span>
      </section>

      <section className="nbp-history">
        <div>
          <span>{clockNow}</span>
          <strong>NBP</strong>
          <small>mmHg</small>
        </div>
        {history.map((entry, i) => (
          <p key={i}>
            <span>{entry.time}</span>
            <span>{entry.sys}/{entry.dia}({entry.map})</span>
          </p>
        ))}
      </section>

      <section className="monitor-clock">
        <strong>{clockNow}</strong>
      </section>
    </div>
  )
}

export default NibpPanel
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/components/Monitor/NibpPanel.tsx
git commit -m "feat(monitor): add NibpPanel component"
```

---

## Task 8: Create `SoftKeyRow.tsx`

**Files:**
- Create: `ui/components/Monitor/SoftKeyRow.tsx`

- [ ] **Step 1: Write the component**

```typescript
// ui/components/Monitor/SoftKeyRow.tsx
import type { FC, ReactNode } from 'react'

interface SoftKeyRowProps {
  onAcknowledge: () => void
  onPauseAlarms: () => void
  onStartStopNbp: () => void
  onRepeatTime: () => void
  onZeroArt: () => void
  artLineActive: boolean
  alarmsMuted: boolean
  nibpMeasuring: boolean
}

function Key({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      className={`intellivue-soft-key${active ? ' intellivue-soft-key--active' : ''}${disabled ? ' intellivue-soft-key--disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={disabled ? { opacity: 0.35, cursor: 'default' } : undefined}
    >
      {children}
    </button>
  )
}

const SoftKeyRow: FC<SoftKeyRowProps> = ({
  onAcknowledge,
  onPauseAlarms,
  onStartStopNbp,
  onRepeatTime,
  onZeroArt,
  artLineActive,
  alarmsMuted,
  nibpMeasuring,
}) => (
  <div className="intellivue-soft-row">
    <Key onClick={onAcknowledge}>Acknowl-<br />edge</Key>
    <Key onClick={onPauseAlarms} active={alarmsMuted}>Pause<br />Alarms</Key>
    <Key onClick={onStartStopNbp} active={nibpMeasuring}>Start/<br />Stop NBP</Key>
    <Key onClick={onRepeatTime}>Repeat<br />Time</Key>
    <Key onClick={artLineActive ? onZeroArt : undefined} disabled={!artLineActive}>Zero</Key>
    <Key disabled>QRS<br />Volume</Key>
    <Key disabled>Vitals<br />Trend</Key>
    <Key disabled>Monitor<br />Standby</Key>
    <Key disabled>Main<br />Setup</Key>
    <Key active>Main<br />Screen</Key>
  </div>
)

export default SoftKeyRow
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/components/Monitor/SoftKeyRow.tsx
git commit -m "feat(monitor): add SoftKeyRow with 5 wired actions"
```

---

## Task 9: Rewrite `Monitor.tsx` + update CSS

**Files:**
- Rewrite: `ui/components/Monitor/Monitor.tsx`
- Modify: `ui/index.css`

- [ ] **Step 1: Rewrite `Monitor.tsx`**

```typescript
// ui/components/Monitor/Monitor.tsx
import { useState, useCallback, type FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'
import { useMonitorLayout } from '../../context/MonitorLayoutContext'
import { useAlarmsContext } from '../../context/AlarmsContext'
import { useNibpCycle } from '../../hooks/useNibpCycle'
import { BAND_PAIRINGS } from '../../../engine/monitor/layout'
import type { NumericId } from '../../../engine/monitor/layout'
import MonitorBand from './MonitorBand'
import NumericTile from './NumericTile'
import NibpPanel from './NibpPanel'
import SoftKeyRow from './SoftKeyRow'
import { numericValue, lineIsActive } from './monitorUtils'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '')
}

const Monitor: FC = () => {
  const { state, scenario, engine } = useSimulation()
  const { layout } = useMonitorLayout()
  const { byNumeric, isMuted, toggleMute, acknowledgeAlarm } = useAlarmsContext()
  const nibpCycle = useNibpCycle(state.nibp)

  // ART Zero: show a 2-second "Zeroing…" label on the ART band.
  const [artZeroing, setArtZeroing] = useState(false)

  const handleZeroArt = useCallback(() => {
    setArtZeroing(true)
    window.setTimeout(() => setArtZeroing(false), 2_000)
  }, [])

  // Derive bands: enabled traces, each paired with its numeric.
  const pairedNumericIds = new Set<NumericId>(
    layout.traces
      .filter(t => t.enabled)
      .map(t => BAND_PAIRINGS[t.id]),
  )

  const bands = layout.traces
    .filter(t => t.enabled)
    .map(t => ({
      trace: t,
      numeric: layout.numerics.find(n => n.id === BAND_PAIRINGS[t.id])!,
    }))
    .filter(b => b.numeric !== undefined)

  // Tiles: enabled numerics whose id is not claimed by any active band.
  const tiles = layout.numerics.filter(n => n.enabled && !pairedNumericIds.has(n.id))

  // eslint-disable-next-line react-hooks/purity
  const clockNow = new Date()

  return (
    <div className="intellivue-frame" aria-label="IntelliVue style simulation monitor">
      <div className="intellivue-screen">

        <div className="intellivue-status">
          <span className="intellivue-status__patient">
            {scenario?.label ?? 'Not Admitted'}
          </span>
          <span>{formatDateTime(clockNow)}</span>
          <span>Adult</span>
          <span>Dynamic Wave</span>
        </div>

        <div className="intellivue-main">
          {/* Left: waveform bands */}
          <div className="monitor-band-stack">
            {bands.map(({ trace, numeric }) => (
              <MonitorBand
                key={trace.id}
                trace={trace}
                numeric={numeric}
                engine={engine}
                state={state}
                alarmLevel={byNumeric.get(numeric.id)}
                artZeroing={trace.id === 'art' && artZeroing}
              />
            ))}
          </div>

          {/* Right: numeric tiles */}
          <div className="monitor-tile-column">
            {tiles.map(numeric => (
              <NumericTile
                key={numeric.id}
                numeric={numeric}
                value={numericValue(numeric.id, state)}
                alarmLevel={byNumeric.get(numeric.id)}
                lineActive={lineIsActive(numeric.id, state)}
              />
            ))}
          </div>
        </div>

        {layout.nibpEnabled && (
          <NibpPanel
            state={state}
            measuring={nibpCycle.measuring}
            interval={nibpCycle.interval}
            history={nibpCycle.history}
          />
        )}

        <SoftKeyRow
          onAcknowledge={acknowledgeAlarm}
          onPauseAlarms={toggleMute}
          onStartStopNbp={nibpCycle.measuring ? nibpCycle.cancelCycle : nibpCycle.triggerCycle}
          onRepeatTime={nibpCycle.cycleInterval}
          onZeroArt={handleZeroArt}
          artLineActive={state.art !== null}
          alarmsMuted={isMuted}
          nibpMeasuring={nibpCycle.measuring}
        />
      </div>
    </div>
  )
}

export default Monitor
```

- [ ] **Step 2: Add new CSS classes to `ui/index.css`**

Find the `.intellivue-wave-stack` block (around line 422) and replace it, plus replace `.intellivue-numerics` (around line 539), with the following. Add these blocks after the existing `.intellivue-main` rule and remove the old `.intellivue-wave-stack` and `.intellivue-numerics` rules entirely:

```css
/* ── Band stack (replaces .intellivue-wave-stack) ── */
.monitor-band-stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 8px 0 0 6px;
}

.monitor-band {
  display: flex;
  min-width: 0;
  min-height: 0;
  position: relative;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.monitor-band__waveform {
  flex: 3;
  position: relative;
  min-width: 0;
  min-height: 0;
}

.monitor-band__numeric {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4px 10px 4px 4px;
  font-family: "Courier New", monospace;
  min-width: 0;
}

.monitor-band__numeric-label {
  font-size: clamp(9px, 1vw, 13px);
  font-weight: 700;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.monitor-band__numeric-value {
  font-size: clamp(28px, 4.2vw, 64px);
  font-weight: 700;
  line-height: 0.9;
  text-shadow: 0 0 12px currentColor;
  letter-spacing: 0;
}

.monitor-band__numeric-limits {
  font-size: clamp(8px, 0.85vw, 11px);
  opacity: 0.45;
}

.monitor-band__trace-label {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  font-family: "Courier New", monospace;
  font-size: clamp(10px, 1.1vw, 14px);
  font-weight: 700;
  pointer-events: none;
}

.monitor-band__inactive-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.2);
  font-family: "Courier New", monospace;
  font-size: clamp(9px, 0.95vw, 12px);
  font-style: italic;
  white-space: nowrap;
  pointer-events: none;
}

.monitor-band__zeroing-label {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  color: #ff5566;
  font-family: "Courier New", monospace;
  font-size: clamp(9px, 0.9vw, 12px);
  font-weight: 700;
  animation: alarmPulse 0.6s ease-in-out infinite;
}

.monitor-band--placeholder .monitor-band__waveform canvas {
  opacity: 0.15;
}

/* ── Tile column (replaces .intellivue-numerics) ── */
.monitor-tile-column {
  display: flex;
  flex-direction: column;
  padding: 10px 10px 4px 6px;
  gap: 5px;
  min-width: 0;
  min-height: 0;
  font-family: "Courier New", monospace;
}

.numeric-tile {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3px 6px;
  min-height: 0;
  border-left: 2px solid currentColor;
}

.numeric-tile__label {
  font-size: clamp(8px, 0.9vw, 12px);
  font-weight: 700;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.numeric-tile__value {
  font-size: clamp(18px, 2.8vw, 42px);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 8px currentColor;
}

.numeric-tile__value--inactive {
  opacity: 0.25;
  font-style: italic;
}

.numeric-tile__inactive-hint {
  font-size: clamp(7px, 0.75vw, 10px);
  opacity: 0.35;
  font-style: italic;
}

.numeric-tile__limits {
  font-size: clamp(7px, 0.8vw, 10px);
  opacity: 0.4;
}

.nbp-panel__measuring {
  display: inline-block;
  font-size: clamp(24px, 3.5vw, 48px);
  font-weight: 700;
  line-height: 1;
  animation: alarmPulse 1s ease-in-out infinite;
}
```

Also remove these now-unused CSS rules from `index.css`:
- `.intellivue-wave-stack { ... }` block
- `.intellivue-wave { ... }` block  
- `.intellivue-wave--ecg canvas, .intellivue-wave--art canvas { ... }` block
- `.intellivue-wave--art .intellivue-wave__label { ... }` block
- `.intellivue-wave__label { ... }` and its modifier blocks (`.intellivue-wave__label--cyan`, etc.)
- `.intellivue-numerics { ... }` block
- `.numeric { ... }`, `.numeric span`, `.numeric small`, `.numeric__meta`, `.numeric strong`, `.numeric--pulse`, `.numeric--spo2`, `.numeric--rr`, `.numeric--temp` blocks

Keep: `.numeric--alarm`, `.numeric--alarm-red/yellow/cyan` animation classes — still used by MonitorBand and NumericTile.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Run dev server and visually verify**

```bash
npm run dev
```

Open in browser. Check:
- ECG, Pleth, CO2, Resp bands render with waveform left + numeric right
- HR, SpO2 etc. values visible in band numeric panel
- Tile column shows Pulse, Temp, FiO2, MAC tiles on right
- NIBP panel visible at bottom with reading and history
- Soft keys render; Pause Alarms, Acknowledge, Start/Stop NBP, Repeat Time clickable
- Enable ART trace in Monitor Settings → band shows "Insert line to activate" placeholder
- Apply the "arterial-line" intervention via RightPanel → ART band shows waveform + numeric
- Click "Start/Stop NBP" → "Measuring…" label appears for ~4 s, then new reading in history
- Click "Repeat Time" → mode label cycles (5min → 10min → manual → 1min → …)

- [ ] **Step 5: Commit**

```bash
git add ui/components/Monitor/Monitor.tsx ui/index.css
git commit -m "feat(monitor): rewrite Monitor.tsx with band/tile architecture"
```

---

## Task 10: Update `MonitorSettings.tsx` (NIBP toggle)

**Files:**
- Modify: `ui/components/Monitor/MonitorSettings.tsx`

- [ ] **Step 1: Add NIBP toggle**

In `MonitorSettings`, the `updateNumeric` function exists but there's no equivalent for `nibpEnabled`. The context needs a `setNibpEnabled` action. 

First, add `setNibpEnabled` to `MonitorLayoutContext.tsx`. In the context value interface:

```typescript
// In MonitorLayoutContext.tsx — add to MonitorLayoutContextValue:
setNibpEnabled: (enabled: boolean) => void
```

Add the implementation inside `MonitorLayoutProvider`:

```typescript
const setNibpEnabled = useCallback((enabled: boolean) => {
  setLayoutState(prev => ({ ...prev, nibpEnabled: enabled }))
}, [])
```

Include it in the provider value:

```typescript
<MonitorLayoutContext.Provider value={{ layout, updateTrace, updateNumeric, setNibpEnabled, applyPreset, resetToDefault }}>
```

Then in `MonitorSettings.tsx`, add to the Numerics section (after the existing numeric toggles, before the closing `</div>`):

```tsx
{/* NIBP panel toggle */}
<label
  style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 0', cursor: 'pointer',
    borderTop: '1px solid #f0ede5', marginTop: 6, paddingTop: 8,
  }}
>
  <input
    type="checkbox"
    checked={layout.nibpEnabled}
    onChange={e => setNibpEnabled(e.currentTarget.checked)}
  />
  <span style={{ flex: 1 }}>NIBP panel</span>
</label>
```

Also destructure `setNibpEnabled` from `useMonitorLayout()` at the top of the component.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Visually verify NIBP toggle**

Open Monitor Settings (gear icon). Uncheck "NIBP panel" → NIBP bottom panel disappears. Re-check → it reappears.

- [ ] **Step 4: Commit**

```bash
git add ui/components/Monitor/MonitorSettings.tsx ui/context/MonitorLayoutContext.tsx
git commit -m "feat(monitor): add NIBP panel toggle to MonitorSettings"
```

---

## Task 11: Cleanup + final build check

**Files:**
- Delete: `ui/components/Monitor/VitalDisplay.tsx`

- [ ] **Step 1: Delete VitalDisplay.tsx**

```bash
git rm ui/components/Monitor/VitalDisplay.tsx
```

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: clean build, no type errors, no lint warnings.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

Expected: all engine tests pass.

- [ ] **Step 4: Final smoke test**

Open `npm run dev`. Run through the anaphylaxis scenario end-to-end:
- Scenario starts → all bands rendering
- HR rises, SpO2 drops → alarm flash appears on ECG band numeric / SpO2 band numeric
- Click Acknowledge → alarm flash clears; if value still breaching, re-appears on next cycle
- Apply adrenaline → vitals drift toward recovery
- Enable ART trace in settings → placeholder shows; apply "arterial-line" intervention → live waveform appears
- CVP tile shows "insert line" placeholder (enabled but no line)
- NIBP Start/Stop → measures correctly
- Repeat Time cycles the mode label
- Disable NIBP from settings → bottom panel hides

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore(monitor): remove unused VitalDisplay component"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ ART waveform placeholder → MonitorBand placeholder when `lineIsActive` false
- ✅ ART/CVP/BIS numeric placeholders → NumericTile shows "—" + "insert line"
- ✅ ART separate from NIBP → MonitorBand vs NibpPanel
- ✅ NIBP deactivation → `nibpEnabled` + MonitorSettings toggle
- ✅ Hardcoded grid removed → flexWeight-driven flex layout
- ✅ Acknowledge → `acknowledgeAlarm()` in AlarmsContext
- ✅ Pause Alarms → wired to `toggleMute`
- ✅ Start/Stop NBP → `triggerCycle` / `cancelCycle`
- ✅ Repeat Time → `cycleInterval`
- ✅ Zero ART → `artZeroing` state with 2s label
- ✅ VitalDisplay deleted

**One dependency to watch:** Task 10 (`MonitorSettings`) requires `setNibpEnabled` which is added to `MonitorLayoutContext`. The typecheck in Task 10 will catch any mismatch.
