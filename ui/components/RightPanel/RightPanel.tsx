import { useState, useRef, useEffect, type FC } from 'react'
import { INTERVENTIONS } from '../../../engine/interventions'
import { useSimulation } from '../../context/SimulationContext'
import type { Intervention, InterventionCategory } from '../../../engine/interventions'
import type { PatientState } from '../../../engine/patient'
import type { DoseEntry } from '../../../engine/doseLedger'

type TabId = 'drug' | 'airway' | 'ventilation' | 'procedure' | 'machine'

const tabs: { id: TabId; label: string }[] = [
  { id: 'drug', label: 'Drugs' },
  { id: 'airway', label: 'Airway' },
  { id: 'ventilation', label: 'Ventilation' },
  { id: 'procedure', label: 'Procedures' },
  { id: 'machine', label: 'Machine' },
]

interface SyringeLabelSpec {
  drugName: string
  dose: string
  className: string
}

const syringeLabels: Record<string, SyringeLabelSpec> = {
  'adrenaline-1': {
    drugName: 'Adrenaline',
    dose: '1 mcg IV',
    className: 'syringe-label--adrenaline',
  },
  'adrenaline-10': {
    drugName: 'Adrenaline',
    dose: '10 mcg IV',
    className: 'syringe-label--adrenaline',
  },
  metaraminol: {
    drugName: 'Metaraminol',
    dose: '1 mg IV',
    className: 'syringe-label--vasopressor',
  },
  ephedrine: {
    drugName: 'Ephedrine',
    dose: '3 mg IV',
    className: 'syringe-label--vasopressor',
  },
  propofol: {
    drugName: 'Propofol',
    dose: '50 mg IV',
    className: 'syringe-label--induction',
  },
  dantrolene: {
    drugName: 'Dantrolene',
    dose: '2.5 mg/kg IV',
    className: 'syringe-label--misc',
  },
}

type MachineSettingKey = Extract<keyof PatientState, 'fio2' | 'vt' | 'peep' | 'gasFlow' | 'rr' | 'sevoflurane'>

interface MachineControlSpec {
  key: MachineSettingKey
  label: string
  unit: string
  min: number
  max: number
  step: number
  display: (value: number) => string
  toState?: (value: number) => number
  fromState?: (value: number) => number
}

const machineControls: MachineControlSpec[] = [
  {
    key: 'fio2',
    label: 'FiO2',
    unit: '%',
    min: 21,
    max: 100,
    step: 1,
    display: value => `${Math.round(value * 100)}`,
    toState: value => value / 100,
    fromState: value => value * 100,
  },
  {
    key: 'vt',
    label: 'VT',
    unit: 'mL',
    min: 200,
    max: 900,
    step: 25,
    display: value => `${Math.round(value)}`,
  },
  {
    key: 'peep',
    label: 'PEEP',
    unit: 'cmH2O',
    min: 0,
    max: 20,
    step: 1,
    display: value => `${Math.round(value)}`,
  },
  {
    key: 'gasFlow',
    label: 'Gas Flow',
    unit: 'L/min',
    min: 0.5,
    max: 15,
    step: 0.5,
    display: value => value.toFixed(1),
  },
  {
    key: 'rr',
    label: 'RR',
    unit: '/min',
    min: 4,
    max: 35,
    step: 1,
    display: value => `${Math.round(value)}`,
  },
  {
    key: 'sevoflurane',
    label: 'Sevoflurane',
    unit: '%',
    min: 0,
    max: 8,
    step: 0.1,
    display: value => value.toFixed(1),
  },
]

function MachinePanel() {
  const { state, updateMachineSettings, setManualVentilation } = useSimulation()
  const isManual = state.ventilationMode === 'manual'

  return (
    <div className="machine-panel">
      <div className="machine-panel__header">
        <span>Anaesthetic Machine</span>
        <strong>Ventilator</strong>
      </div>
      <div className="machine-panel__display">
        <div>
          <span>Mode</span>
          <strong>{isManual ? 'Manual' : 'VCV'}</strong>
        </div>
        <div>
          <span>Agent</span>
          <strong>Sevo</strong>
        </div>
        <div>
          <span>Fresh Gas</span>
          <strong>{state.gasFlow.toFixed(1)} L/min</strong>
        </div>
      </div>
      <div className="machine-mode">
        <button
          className={!isManual ? 'machine-mode__button machine-mode__button--active' : 'machine-mode__button'}
          onClick={() => updateMachineSettings({ ventilationMode: 'ventilator' })}
        >
          Ventilator
        </button>
        <button
          className={isManual ? 'machine-mode__button machine-mode__button--active' : 'machine-mode__button'}
          onClick={() => updateMachineSettings({ ventilationMode: 'manual' })}
        >
          Manual
        </button>
      </div>
      <div className="machine-control-grid">
        {machineControls.map(control => {
          const stateValue = state[control.key] as number
          const sliderValue = control.fromState ? control.fromState(stateValue) : stateValue

          return (
            <label className="machine-control" key={control.key}>
              <span className="machine-control__label">{control.label}</span>
              <span className="machine-control__value">
                {control.display(stateValue)} <small>{control.unit}</small>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={sliderValue}
                onChange={event => {
                  const rawValue = Number(event.currentTarget.value)
                  const nextValue = control.toState ? control.toState(rawValue) : rawValue
                  updateMachineSettings({ [control.key]: nextValue })
                }}
              />
            </label>
          )
        })}
      </div>
      {isManual && (
        <div className="manual-ventilator">
          <button
            className={state.manualVentilationActive ? 'bag-control bag-control--active' : 'bag-control'}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId)
              setManualVentilation(true)
            }}
            onPointerUp={event => {
              event.currentTarget.releasePointerCapture(event.pointerId)
              setManualVentilation(false)
            }}
            onPointerCancel={() => setManualVentilation(false)}
            onPointerLeave={() => setManualVentilation(false)}
          >
            <span className="bag-control__mask" />
            <span className="bag-control__neck" />
            <span className="bag-control__bag" />
            <span className="bag-control__label">Hold to ventilate</span>
          </button>
        </div>
      )}
    </div>
  )
}

function describeCooldown(
  intervention: Intervention,
  entry: DoseEntry | undefined,
  elapsedSeconds: number,
): { onCooldown: boolean; remainingSec: number; maxedOut: boolean } {
  if (!entry) return { onCooldown: false, remainingSec: 0, maxedOut: false }
  const maxedOut = intervention.maxDoses !== undefined && entry.count >= intervention.maxDoses
  if (maxedOut) return { onCooldown: false, remainingSec: 0, maxedOut: true }
  if (!intervention.cooldownMs) return { onCooldown: false, remainingSec: 0, maxedOut: false }
  const elapsedSinceLast = (elapsedSeconds - entry.lastAppliedSec) * 1000
  const remaining = intervention.cooldownMs - elapsedSinceLast
  return { onCooldown: remaining > 0, remainingSec: remaining / 1000, maxedOut: false }
}

const RightPanel: FC = () => {
  const { applyIntervention, eventLog, doseLedger, elapsedSeconds, phase } = useSimulation()
  const [activeTab, setActiveTab] = useState<TabId>('drug')
  const [cooldownTick, setCooldownTick] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  // Tick at 5 Hz while running so cooldown timers count down smoothly without
  // tying every button to the simulation state.
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => setCooldownTick(c => c + 1), 200)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [eventLog])

  const items = activeTab === 'machine'
    ? []
    : INTERVENTIONS.filter(i => i.category === activeTab as InterventionCategory)

  return (
    <div style={{
      width: '50%',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      borderLeft: '1px solid #e0ddd5',
    }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e0ddd5',
        background: '#fafafa',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 6px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #1a5276' : '2px solid transparent',
              background: activeTab === tab.id ? '#ffffff' : 'transparent',
              color: activeTab === tab.id ? '#1a5276' : '#999',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'machine' ? (
        <MachinePanel />
      ) : (
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 8,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        alignContent: 'start',
      }}>
        {items.map(item => {
          const entry = doseLedger.get(item.id)
          const { onCooldown, remainingSec, maxedOut } = describeCooldown(item, entry, elapsedSeconds)
          // Reference cooldownTick so React re-renders this row on each tick.
          void cooldownTick
          const disabled = onCooldown || maxedOut
          const badge = entry ? `× ${entry.count}` : null
          const subtitle = maxedOut
            ? `Max ${item.maxDoses} doses reached`
            : onCooldown
              ? `Cooldown ${remainingSec.toFixed(0)}s`
              : item.description

          return (
          <button
            key={item.id}
            onClick={() => applyIntervention(item.id)}
            disabled={disabled}
            className={activeTab === 'drug' ? 'drug-action-button' : undefined}
            style={activeTab === 'drug' ? {
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              position: 'relative',
            } : {
              padding: '14px 16px',
              border: '1px solid #e0ddd5',
              borderRadius: 6,
              background: '#fafafa',
              color: '#2c2c2c',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 15,
              textAlign: 'left',
              lineHeight: 1.35,
              transition: 'background 0.1s, border-color 0.1s',
              opacity: disabled ? 0.45 : 1,
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (activeTab === 'drug' || disabled) return
              e.currentTarget.style.background = '#f0f0e8'
              e.currentTarget.style.borderColor = '#ccc'
            }}
            onMouseLeave={e => {
              if (activeTab === 'drug') return
              e.currentTarget.style.background = '#fafafa'
              e.currentTarget.style.borderColor = '#e0ddd5'
            }}
          >
            {badge && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 6,
                fontSize: 10,
                fontWeight: 700,
                color: '#1a6e4c',
                background: '#eaf6f0',
                border: '1px solid #b9dac8',
                borderRadius: 10,
                padding: '1px 6px',
                pointerEvents: 'none',
              }}>
                {badge}
              </span>
            )}
            {activeTab === 'drug' && syringeLabels[item.id] ? (
              <>
                <div className={`syringe-label ${syringeLabels[item.id].className}`}>
                  <div className="syringe-label__name">{syringeLabels[item.id].drugName}</div>
                  <div className="syringe-label__dose">
                    <span />
                    <strong>{syringeLabels[item.id].dose}</strong>
                  </div>
                </div>
                <div className="drug-action-button__description">{subtitle}</div>
              </>
            ) : (
              <>
                <div>{item.label}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                  {subtitle}
                </div>
              </>
            )}
          </button>
          )
        })}
      </div>
      )}

      <div style={{
        borderTop: '1px solid #e0ddd5',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '30%',
      }}>
        <div style={{
          padding: '6px 12px',
          fontSize: 10,
          color: '#999',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderBottom: '1px solid #ecece5',
          background: '#fafafa',
        }}>
          Event Log
        </div>
        <div
          ref={logRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2px 0',
          }}
        >
          {eventLog.length === 0 && (
            <div style={{ padding: 8, color: '#ccc', fontSize: 10, fontStyle: 'italic' }}>
              No events yet.
            </div>
          )}
          {eventLog.map((event, i) => (
            <div
              key={i}
              style={{
                padding: '2px 12px',
                fontSize: 10,
                color: event.startsWith('⚠') ? '#cc6600'
                     : event.startsWith('✓') || event.startsWith('→') ? '#1a6e4c'
                     : event.startsWith('✗') || event.startsWith('❌') ? '#cc0000'
                     : event.startsWith('▶') ? '#999'
                     : '#888',
                fontFamily: '"Courier New", monospace',
                lineHeight: 1.5,
                borderBottom: '1px solid #f0f0ea',
              }}
            >
              {event}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RightPanel
