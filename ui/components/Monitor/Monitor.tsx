import type { FC, ReactNode } from 'react'
import { useSimulation } from '../../context/SimulationContext'
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

function bpHistory(sys: number, dia: number): Array<[string, string]> {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const minutesBack = (5 - i) * 5
    const time = new Date(now.getTime() - minutesBack * 60_000)
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
  const { state, scenario } = useSimulation()
  const now = new Date()
  const hr = round(state.hr)
  const spo2 = round(state.spo2)
  const nibpSys = round(state.nibp.sys)
  const nibpDia = round(state.nibp.dia)
  const nibpMap = round((state.nibp.sys + 2 * state.nibp.dia) / 3)
  const rr = round(state.rr)
  const temp = Math.max(0, state.temp).toFixed(1)
  const etco2 = Math.max(0, state.etco2).toFixed(1)

  return (
    <div className="intellivue-frame" aria-label="IntelliVue style simulation monitor">
      <div className="intellivue-screen">
        <div className="intellivue-status">
          <span className="intellivue-status__patient">Not Admitted</span>
          <span>{formatDateTime(now)}</span>
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
                buffer={state.ecgBuffer}
                bufferWritePos={state.bufferWritePos}
                color="#65f36f"
                label=""
                scale={1}
              />
              <span className="intellivue-rhythm">Sinus Rhythm</span>
            </section>

            <section className="intellivue-wave intellivue-wave--pleth">
              <div className="intellivue-wave__label intellivue-wave__label--cyan">Pleth</div>
              <SimpleWaveformCanvas
                buffer={state.spo2Buffer}
                bufferWritePos={state.bufferWritePos}
                color="#19c8ff"
                label=""
              />
            </section>

            <section className="intellivue-wave intellivue-wave--co2">
              <div className="intellivue-wave__label intellivue-wave__label--yellow">CO2</div>
              <SimpleWaveformCanvas
                buffer={state.etco2Buffer}
                bufferWritePos={state.bufferWritePos}
                color="#ffd94a"
                label=""
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
                buffer={state.respBuffer}
                bufferWritePos={state.bufferWritePos}
                color="#eaf4ff"
                label=""
              />
            </section>
          </div>

          <aside className="intellivue-numerics">
            <div className="numeric numeric--hr">
              <div className="numeric__meta">
                <span>HR</span>
                <small>120</small>
                <small>50</small>
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
                <small>100</small>
                <small>92</small>
              </div>
              <strong>{spo2}</strong>
            </div>

            <div className="numeric numeric--rr">
              <div className="numeric__meta">
                <span>RR</span>
                <small>35</small>
                <small>8</small>
              </div>
              <strong>{rr}</strong>
            </div>

            <div className="numeric numeric--temp">
              <span>Temp</span>
              <small>{Math.max(0, state.temp + 4.3).toFixed(1)}</small>
              <small>{temp}</small>
              <strong>{temp}</strong>
            </div>
          </aside>
        </div>

        <div className="intellivue-lower">
          <section className="nbp-panel">
            <div className="nbp-panel__labels">
              <span>NBP</span>
              <small>Pulse {hr}</small>
              <small>Sys 160</small>
              <small>90</small>
            </div>
            <strong>{nibpSys}/{nibpDia}</strong>
            <em>({nibpMap})</em>
            <span className="nbp-panel__mode">Auto&nbsp;&nbsp;5 min</span>
          </section>

          <section className="nbp-history">
            <div>
              <span>{formatClock(now)}</span>
              <strong>NBP</strong>
              <small>mmHg</small>
            </div>
            {bpHistory(state.nibp.sys, state.nibp.dia).map(([time, value]) => (
              <p key={`${time}-${value}`}>
                <span>{time}</span>
                <span>{value}</span>
              </p>
            ))}
          </section>

          <section className="monitor-clock">
            <span>{scenario?.label ?? 'Main Screen'}</span>
            <strong>{formatClock(now)}</strong>
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
