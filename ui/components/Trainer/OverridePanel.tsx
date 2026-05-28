import { useState, type FC } from 'react'
import type { EcgRhythm } from '../../../engine/patient'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'
import { vitalControls, clampVitalValue, type VitalControlKey } from './vitalControls'

const rhythms: EcgRhythm[] = ['sinus', 'svt', 'vt', 'vf', 'asystole']

const defaults: Record<VitalControlKey, number> = {
  hr: 80, spo2: 98, etco2: 5, rr: 14, temp: 37, sys: 120, dia: 80,
}

const OverridePanel: FC = () => {
  const { send, commandsAvailable } = useRemoteSimulation()
  const [vitals, setVitals] = useState<Record<VitalControlKey, number>>(defaults)
  const [ecgRhythm, setEcgRhythm] = useState<EcgRhythm>('sinus')

  const values = {
    hr: vitals.hr,
    spo2: vitals.spo2,
    etco2: vitals.etco2,
    rr: vitals.rr,
    temp: vitals.temp,
    ecgRhythm,
    nibp: { sys: vitals.sys, dia: vitals.dia },
  }

  return (
    <section className="trainer-card trainer-grid-form">
      <h2>Vitals override</h2>
      {vitalControls.map(control => (
        <label key={control.key}>
          {control.label}
          <input
            type="number"
            value={vitals[control.key]}
            min={control.min}
            max={control.max}
            step={control.step}
            onChange={event => setVitals(prev => ({
              ...prev,
              [control.key]: clampVitalValue(control, Number(event.currentTarget.value)),
            }))}
          />
        </label>
      ))}
      <label>Rhythm <select value={ecgRhythm} onChange={event => setEcgRhythm(event.currentTarget.value as EcgRhythm)}>{rhythms.map(rhythm => <option key={rhythm}>{rhythm}</option>)}</select></label>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'override', mode: 'set_now', values })}>Set now</button>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'override', mode: 'set_target', values })}>Set target</button>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'clear_trainer_overrides' })}>Reset to scenario</button>
      {!commandsAvailable && <p className="command-unavailable">Trainer commands unavailable while reconnecting.</p>}
    </section>
  )
}

export default OverridePanel
