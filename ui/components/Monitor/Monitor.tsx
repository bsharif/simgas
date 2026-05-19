import { useMemo, type FC, type ReactNode } from 'react'
import { useSimulation } from '../../context/SimulationContext'
import type { EcgRhythm } from '../../../engine/patient'
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

// Default alarm thresholds (Phase 3 will lift these into MonitorLayout config).
const ALARM_THRESHOLDS = {
  hr: { lo: 50, hi: 120 },
  spo2: { lo: 92, hi: 100 },
  rr: { lo: 8, hi: 35 },
  temp: { lo: 35.5, hi: 38.5 },
  nibp: { sysLo: 90, sysHi: 160 },
} as const

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

const Monitor: FC = () => {
  const { state, scenario, engine } = useSimulation()

  const hr = round(state.hr)
  const spo2 = round(state.spo2)
  const nibpSys = round(state.nibp.sys)
  const nibpDia = round(state.nibp.dia)
  const nibpMap = round(state.nibp.map)
  const rr = round(state.rr)
  const temp = Math.max(0, state.temp).toFixed(1)
  const etco2 = Math.max(0, state.etco2).toFixed(1)
  const rhythmLabel = RHYTHM_LABELS[state.ecgRhythm]

  // Anchor the fake BP history + clock display to the current minute so the
  // trace only refreshes when the minute rolls over, not on every ~5 Hz
  // re-render. TODO(Phase 3): replace with real NBP cycle history from the
  // engine so we don't need this anchor at all.
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
            <section className="intellivue-wave intellivue-wave--ecg">
              <div className="intellivue-wave__label">
                <span>II</span>
                <span>(0.2)</span>
                <span>F</span>
              </div>
              <ECGCanvas
                engine={engine}
                bufferKey="ecgBuffer"
                color="#65f36f"
                scale={1}
              />
              <span className="intellivue-rhythm">{rhythmLabel}</span>
            </section>

            <section className="intellivue-wave intellivue-wave--pleth">
              <div className="intellivue-wave__label intellivue-wave__label--cyan">Pleth</div>
              <SimpleWaveformCanvas
                engine={engine}
                bufferKey="spo2Buffer"
                color="#19c8ff"
              />
            </section>

            <section className="intellivue-wave intellivue-wave--co2">
              <div className="intellivue-wave__label intellivue-wave__label--yellow">CO2</div>
              <SimpleWaveformCanvas
                engine={engine}
                bufferKey="etco2Buffer"
                color="#ffd94a"
              />
              <div className="intellivue-co2-readout">
                <span>etCO2</span>
                <strong>{etco2}</strong>
                <span>kPa</span>
              </div>
            </section>

            <section className="intellivue-wave intellivue-wave--resp">
              <div className="intellivue-wave__label intellivue-wave__label--white">Resp</div>
              <SimpleWaveformCanvas
                engine={engine}
                bufferKey="respBuffer"
                color="#eaf4ff"
              />
            </section>
          </div>

          <aside className="intellivue-numerics">
            <div className="numeric numeric--hr">
              <div className="numeric__meta">
                <span>HR</span>
                <small>{ALARM_THRESHOLDS.hr.hi}</small>
                <small>{ALARM_THRESHOLDS.hr.lo}</small>
              </div>
              <strong>{hr}</strong>
            </div>

            <div className="numeric numeric--pulse">
              <span>Pulse</span>
              <strong>{hr}</strong>
              <small>PVC 0</small>
              <small>ST-II 0.2</small>
            </div>

            <div className="numeric numeric--spo2">
              <div className="numeric__meta">
                <span>SpO2</span>
                <small>{ALARM_THRESHOLDS.spo2.hi}</small>
                <small>{ALARM_THRESHOLDS.spo2.lo}</small>
              </div>
              <strong>{spo2}</strong>
            </div>

            <div className="numeric numeric--rr">
              <div className="numeric__meta">
                <span>RR</span>
                <small>{ALARM_THRESHOLDS.rr.hi}</small>
                <small>{ALARM_THRESHOLDS.rr.lo}</small>
              </div>
              <strong>{rr}</strong>
            </div>

            <div className="numeric numeric--temp">
              <span>Temp</span>
              <small>{ALARM_THRESHOLDS.temp.hi.toFixed(1)}</small>
              <small>{ALARM_THRESHOLDS.temp.lo.toFixed(1)}</small>
              <strong>{temp}</strong>
            </div>
          </aside>
        </div>

        <div className="intellivue-lower">
          <section className="nbp-panel">
            <div className="nbp-panel__labels">
              <span>NBP</span>
              <small>Pulse {hr}</small>
              <small>Sys {ALARM_THRESHOLDS.nibp.sysHi}</small>
              <small>{ALARM_THRESHOLDS.nibp.sysLo}</small>
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
