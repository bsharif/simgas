import { useState, type FC } from 'react'
import type { EcgRhythm } from '../../../engine/patient'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

const rhythms: EcgRhythm[] = ['sinus', 'svt', 'vt', 'vf', 'asystole']

const OverridePanel: FC = () => {
  const { send, commandsAvailable } = useRemoteSimulation()
  const [hr, setHr] = useState(80)
  const [spo2, setSpo2] = useState(98)
  const [etco2, setEtco2] = useState(5)
  const [rr, setRr] = useState(14)
  const [temp, setTemp] = useState(37)
  const [sys, setSys] = useState(120)
  const [dia, setDia] = useState(80)
  const [ecgRhythm, setEcgRhythm] = useState<EcgRhythm>('sinus')

  const values = { hr, spo2, etco2, rr, temp, ecgRhythm, nibp: { sys, dia } }

  return (
    <section className="trainer-card trainer-grid-form">
      <h2>Vitals override</h2>
      <label>HR <input type="number" value={hr} onChange={event => setHr(Number(event.currentTarget.value))} /></label>
      <label>SpO2 <input type="number" value={spo2} onChange={event => setSpo2(Number(event.currentTarget.value))} /></label>
      <label>ETCO2 <input type="number" value={etco2} onChange={event => setEtco2(Number(event.currentTarget.value))} /></label>
      <label>RR <input type="number" value={rr} onChange={event => setRr(Number(event.currentTarget.value))} /></label>
      <label>Temp <input type="number" value={temp} onChange={event => setTemp(Number(event.currentTarget.value))} /></label>
      <label>Sys <input type="number" value={sys} onChange={event => setSys(Number(event.currentTarget.value))} /></label>
      <label>Dia <input type="number" value={dia} onChange={event => setDia(Number(event.currentTarget.value))} /></label>
      <label>Rhythm <select value={ecgRhythm} onChange={event => setEcgRhythm(event.currentTarget.value as EcgRhythm)}>{rhythms.map(rhythm => <option key={rhythm}>{rhythm}</option>)}</select></label>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'override', mode: 'set_now', values })}>Set now</button>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'override', mode: 'set_target', values })}>Set target</button>
      <button disabled={!commandsAvailable} onClick={() => send({ type: 'clear_trainer_overrides' })}>Reset to scenario</button>
      {!commandsAvailable && <p className="command-unavailable">Trainer commands unavailable while reconnecting.</p>}
    </section>
  )
}

export default OverridePanel
