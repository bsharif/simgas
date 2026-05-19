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
  const active = lineIsActive(numeric.id, state)
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
