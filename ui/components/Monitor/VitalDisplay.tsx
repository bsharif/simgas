import type { FC } from 'react'
import type { PatientState, NibpReading } from '../../../engine/patient'

interface VitalDisplayProps {
  state: PatientState
}

function isAbnormal(label: string, value: number): boolean {
  switch (label) {
    case 'HR': return value < 50 || value > 120
    case 'SpO₂': return value < 94
    case 'ETCO₂': return value < 4 || value > 6
    case 'RR': return value < 8 || value > 25
    case 'Temp': return value < 36 || value > 38
    default: return false
  }
}

function isCritical(label: string, value: number): boolean {
  switch (label) {
    case 'HR': return value < 40 || value > 150
    case 'SpO₂': return value < 85
    case 'ETCO₂': return value < 2 || value > 8
    case 'RR': return value < 6 || value > 35
    case 'Temp': return value < 35 || value > 39
    default: return false
  }
}

function VitalParam({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const numericVal = parseFloat(value)
  const abnormal = isAbnormal(label, numericVal)
  const critical = isCritical(label, numericVal)

  let color = '#2c2c2c'
  if (critical) color = '#cc0000'
  else if (abnormal) color = '#cc6600'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '4px 12px',
      borderRight: '1px solid #e0ddd5',
      animation: critical ? 'alarmPulse 0.8s ease-in-out infinite' : 'none',
    }}>
      <span style={{ fontSize: 10, color: '#999', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontSize: 24,
        fontWeight: 'bold',
        color,
        fontFamily: '"Courier New", monospace',
        textShadow: critical ? '0 0 8px rgba(204,0,0,0.3)' : 'none',
      }}>
        {value}
      </span>
      {unit && <span style={{ fontSize: 9, color: '#bbb' }}>{unit}</span>}
    </div>
  )
}

function formatNIBP(nibp: NibpReading): string {
  return `${Math.round(nibp.sys)}/${Math.round(nibp.dia)}`
}

function clampDisplay(val: number): string {
  return String(Math.max(0, Math.round(val)))
}

const VitalDisplay: FC<VitalDisplayProps> = ({ state }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'stretch',
      gap: 0,
      padding: '4px 0',
      background: '#fafafa',
      borderTop: '1px solid #e0ddd5',
      borderBottom: '1px solid #e0ddd5',
    }}>
      <VitalParam label="HR" value={clampDisplay(state.hr)} unit="bpm" />
      <VitalParam label="NIBP" value={formatNIBP(state.nibp)} unit="mmHg" />
      <VitalParam label="SpO₂" value={clampDisplay(state.spo2)} unit="%" />
      <VitalParam label="ETCO₂" value={clampDisplay(state.etco2)} unit="kPa" />
      <VitalParam label="RR" value={clampDisplay(state.rr)} unit="/min" />
      <VitalParam label="Temp" value={clampDisplay(state.temp)} unit="°C" />
      <VitalParam label="FiO₂" value={String(Math.round(state.fio2 * 100))} unit="%" />
    </div>
  )
}

export default VitalDisplay
