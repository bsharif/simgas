import { useMemo, type FC, type ReactNode } from 'react'
import { useSimulation } from '../../context/SimulationContext'
import { useMonitorLayout } from '../../context/MonitorLayoutContext'
import type { EcgRhythm, PatientState } from '../../../engine/patient'
import type { MonitorNumeric, MonitorTrace } from '../../../engine/monitor/layout'
import ECGCanvas from './ECGCanvas'
import SimpleWaveformCanvas from './SimpleWaveformCanvas'

function round(val: number): number {
  return Math.max(0, Math.round(val))
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '')
}

const RHYTHM_LABELS: Record<EcgRhythm, string> = {
  sinus: 'Sinus Rhythm',
  vf: 'Ventricular Fibrillation',
  vt: 'Ventricular Tachycardia',
  svt: 'Supraventricular Tachycardia',
  asystole: 'Asystole',
}

function buildBpHistory(sys: number, dia: number, anchorMs: number): Array<[string, string]> {
  return Array.from({ length: 6 }, (_, i) => {
    const minutesBack = (5 - i) * 5
    const time = new Date(anchorMs - minutesBack * 60_000)
    const drift = 5 - i
    const nextSys = round(sys + drift * 2 - 3)
    const nextDia = round(dia + drift - 2)
    const map = round((nextSys + 2 * nextDia) / 3)
    return [formatClock(time), `${nextSys}/${nextDia}(${map})`]
  })
}

function SoftKey({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <button className={`intellivue-soft-key${active ? ' intellivue-soft-key--active' : ''}`}>
      {children}
    </button>
  )
}

function numericValue(id: MonitorNumeric['id'], state: PatientState): string {
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

function isInAlarm(numeric: MonitorNumeric, raw: number | null): boolean {
  if (numeric.muted || raw === null) return false
  if (numeric.alarmLo !== null && raw < numeric.alarmLo) return true
  if (numeric.alarmHi !== null && raw > numeric.alarmHi) return true
  return false
}

function numericRaw(id: MonitorNumeric['id'], state: PatientState): number | null {
  switch (id) {
    case 'hr':    return state.hr
    case 'pulse': return state.hr
    case 'spo2':  return state.spo2
    case 'rr':    return state.rr
    case 'temp':  return state.temp
    case 'etco2': return state.etco2
    case 'fio2':  return state.fio2 * 100
    case 'mac':   return state.sevoflurane
    case 'art':   return state.art ? state.art.map : null
    case 'cvp':   return state.cvp
    case 'bis':   return state.bis
  }
}

function shouldShowNumeric(numeric: MonitorNumeric, state: PatientState): boolean {
  if (!numeric.enabled) return false
  // Lines that haven't been inserted hide themselves even when enabled, so the
  // pre-insertion layout doesn't show "—" tiles for every invasive parameter.
  if (numeric.id === 'art' && state.art === null) return false
  if (numeric.id === 'cvp' && state.cvp === null) return false
  if (numeric.id === 'bis' && state.bis === null) return false
  return true
}

function shouldShowTrace(trace: MonitorTrace, state: PatientState): boolean {
  if (!trace.enabled) return false
  // ART trace hides itself until an arterial line is inserted.
  if (trace.id === 'art' && state.art === null) return false
  return true
}

const Monitor: FC = () => {
  const { state, scenario, engine } = useSimulation()
  const { layout } = useMonitorLayout()

  const visibleTraces = layout.traces.filter(t => shouldShowTrace(t, state))
  const visibleNumerics = layout.numerics.filter(n => shouldShowNumeric(n, state))

  const nibpSys = round(state.nibp.sys)
  const nibpDia = round(state.nibp.dia)
  const nibpMap = round(state.nibp.map)
  const hrForChrome = round(state.hr)
  const rhythmLabel = RHYTHM_LABELS[state.ecgRhythm]
  const etco2 = Math.max(0, state.etco2).toFixed(1)

  // Anchor the fake BP history + clock display to the current minute so the
  // trace only refreshes when the minute rolls over.
  // TODO(Phase 4): replace with real NBP cycle history from the engine.
  // eslint-disable-next-line react-hooks/purity
  const minuteAnchor = Math.floor(Date.now() / 60_000) * 60_000

  const bpHistory = useMemo(
    () => buildBpHistory(nibpSys, nibpDia, minuteAnchor),
    [nibpSys, nibpDia, minuteAnchor],
  )

  const clockNow = new Date(minuteAnchor)

  return (
    <div className="intellivue-frame" aria-label="IntelliVue style simulation monitor">
      <div className="intellivue-screen">
        <div className="intellivue-status">
          <span className="intellivue-status__patient">Not Admitted</span>
          <span>{formatDateTime(clockNow)}</span>
          <span>Adult</span>
          <span>Dynamic Wave</span>
        </div>

        <div className="intellivue-main">
          <div className="intellivue-wave-stack">
            {visibleTraces.map(trace => (
              <section
                key={trace.id}
                className={`intellivue-wave intellivue-wave--${trace.id}`}
              >
                <div
                  className={`intellivue-wave__label`}
                  style={{ color: trace.color }}
                >
                  {trace.label}
                </div>
                {trace.rendererStyle === 'ecg' ? (
                  <ECGCanvas engine={engine} bufferKey={trace.bufferKey} color={trace.color} />
                ) : (
                  <SimpleWaveformCanvas engine={engine} bufferKey={trace.bufferKey} color={trace.color} />
                )}
                {trace.id === 'ecg-ii' && (
                  <span className="intellivue-rhythm">{rhythmLabel}</span>
                )}
                {trace.id === 'co2' && (
                  <div className="intellivue-co2-readout">
                    <span>etCO2</span>
                    <strong>{etco2}</strong>
                    <span>kPa</span>
                  </div>
                )}
              </section>
            ))}
          </div>

          <aside className="intellivue-numerics">
            {visibleNumerics.map(numeric => {
              const raw = numericRaw(numeric.id, state)
              const inAlarm = isInAlarm(numeric, raw)
              return (
                <div
                  key={numeric.id}
                  className={`numeric numeric--${numeric.id}${inAlarm ? ' numeric--alarm' : ''}`}
                >
                  <div className="numeric__meta">
                    <span>{numeric.label}</span>
                    {numeric.alarmHi !== null && <small>{numeric.alarmHi}</small>}
                    {numeric.alarmLo !== null && <small>{numeric.alarmLo}</small>}
                  </div>
                  <strong style={{ color: numeric.color }}>{numericValue(numeric.id, state)}</strong>
                </div>
              )
            })}
          </aside>
        </div>

        <div className="intellivue-lower">
          <section className="nbp-panel">
            <div className="nbp-panel__labels">
              <span>NBP</span>
              <small>Pulse {hrForChrome}</small>
              <small>Sys 160</small>
              <small>90</small>
            </div>
            <strong>{nibpSys}/{nibpDia}</strong>
            <em>({nibpMap})</em>
            <span className="nbp-panel__mode">Auto&nbsp;&nbsp;5 min</span>
          </section>

          <section className="nbp-history">
            <div>
              <span>{formatClock(clockNow)}</span>
              <strong>NBP</strong>
              <small>mmHg</small>
            </div>
            {bpHistory.map(([time, value]) => (
              <p key={`${time}-${value}`}>
                <span>{time}</span>
                <span>{value}</span>
              </p>
            ))}
          </section>

          <section className="monitor-clock">
            <span>{scenario?.label ?? 'Main Screen'}</span>
            <strong>{formatClock(clockNow)}</strong>
          </section>
        </div>

        <div className="intellivue-soft-row">
          <SoftKey>Acknowl-<br />edge</SoftKey>
          <SoftKey active>Pause<br />Alarms</SoftKey>
          <SoftKey>Start/<br />Stop NBP</SoftKey>
          <SoftKey>Repeat<br />Time</SoftKey>
          <SoftKey>Zero</SoftKey>
          <SoftKey>QRS<br />Volume</SoftKey>
          <SoftKey>Vitals<br />Trend</SoftKey>
          <SoftKey>Monitor<br />Standby</SoftKey>
          <SoftKey>Main<br />Setup</SoftKey>
          <SoftKey active>Main<br />Screen</SoftKey>
        </div>
      </div>
    </div>
  )
}

export default Monitor
