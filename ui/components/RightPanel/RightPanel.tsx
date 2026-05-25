import { useState, useRef, useEffect, useId, type FC, type KeyboardEvent } from 'react'
import { INTERVENTIONS } from '../../../engine/interventions'
import { useSimulationBridge } from '../../context/SimulationBridge'
import type { Intervention, InterventionCategory } from '../../../engine/interventions'
import type { PatientState } from '../../../engine/patient'
import type { DoseEntry } from '../../../engine/doseLedger'
import {
  initialManualVentilationReleaseState,
  manualVentilationCommandsAvailable,
  manualVentilationCommandsUnavailable,
  manualVentilationPointerDown,
  manualVentilationPointerRelease,
} from './manualVentilationRelease'

type TabId = 'drug' | 'airway' | 'ventilation' | 'procedure' | 'machine'

interface RightPanelProps {
  compact?: boolean
  trayMode?: boolean
}

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
  adenosine: {
    drugName: 'Adenosine',
    dose: '6 mg IV',
    className: 'syringe-label--misc',
  },
  salbutamol: {
    drugName: 'Salbutamol',
    dose: '5 mg neb',
    className: 'syringe-label--misc',
  },
  intralipid: {
    drugName: 'Intralipid 20%',
    dose: '100 ml IV',
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
  const { state, updateMachineSettings, setManualVentilation, commandsAvailable } = useSimulationBridge()
  const isManual = state.ventilationMode === 'manual'
  const manualVentilationReleaseRef = useRef(initialManualVentilationReleaseState)

  useEffect(() => {
    const next = commandsAvailable
      ? manualVentilationCommandsAvailable(manualVentilationReleaseRef.current)
      : manualVentilationCommandsUnavailable(manualVentilationReleaseRef.current)
    manualVentilationReleaseRef.current = next.state
    if (next.command !== null) setManualVentilation(next.command)
  }, [commandsAvailable, setManualVentilation])

  const releaseManualVentilation = (commandsAvailableNow: boolean): boolean => {
    const next = manualVentilationPointerRelease(manualVentilationReleaseRef.current, commandsAvailableNow)
    manualVentilationReleaseRef.current = next.state
    if (next.command !== null) setManualVentilation(next.command)
    return next.command !== null
  }

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
          disabled={!commandsAvailable}
          onClick={() => updateMachineSettings({ ventilationMode: 'ventilator' })}
        >
          Ventilator
        </button>
        <button
          className={isManual ? 'machine-mode__button machine-mode__button--active' : 'machine-mode__button'}
          disabled={!commandsAvailable}
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
                disabled={!commandsAvailable}
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
            disabled={!commandsAvailable}
            onPointerDown={event => {
              const next = manualVentilationPointerDown(manualVentilationReleaseRef.current, commandsAvailable)
              manualVentilationReleaseRef.current = next.state
              if (next.command !== null) {
                event.currentTarget.setPointerCapture(event.pointerId)
                setManualVentilation(next.command)
              }
            }}
            onPointerUp={event => {
              const released = releaseManualVentilation(commandsAvailable)
              if (released) event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => releaseManualVentilation(commandsAvailable)}
            onPointerLeave={() => releaseManualVentilation(commandsAvailable)}
          >
            <span className="bag-control__mask" />
            <span className="bag-control__neck" />
            <span className="bag-control__bag" />
            <span className="bag-control__label">Hold to ventilate</span>
          </button>
        </div>
      )}
      {!commandsAvailable && <p className="command-unavailable">Commands unavailable while reconnecting.</p>}
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

function eventLogEntryClassName(event: string): string {
  if (event.startsWith('⚠')) return 'event-log__entry event-log__entry--warning'
  if (event.startsWith('✓') || event.startsWith('→')) return 'event-log__entry event-log__entry--success'
  if (event.startsWith('✗') || event.startsWith('❌')) return 'event-log__entry event-log__entry--error'
  if (event.startsWith('▶')) return 'event-log__entry event-log__entry--neutral'
  return 'event-log__entry'
}

const RightPanel: FC<RightPanelProps> = ({ compact = false, trayMode = false }) => {
  const { applyIntervention, eventLog, doseLedger, elapsedSeconds, phase, commandsAvailable } = useSimulationBridge()
  const [activeTab, setActiveTab] = useState<TabId>('drug')
  const [cooldownTick, setCooldownTick] = useState(0)
  const [eventLogCollapsed, setEventLogCollapsed] = useState(compact || trayMode)
  const logRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const eventLogToggleVisible = compact || trayMode
  const idPrefix = useId()

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

  const panelClassName = [
    'right-panel',
    compact ? 'right-panel--compact' : null,
    trayMode ? 'right-panel--tray-mode' : null,
  ].filter(Boolean).join(' ')

  const focusTab = (tabId: TabId) => {
    setActiveTab(tabId)
    tabRefs.current[tabId]?.focus()
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    const currentIndex = tabs.findIndex(tab => tab.id === tabId)
    let nextIndex: number | null = null

    if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabs.length - 1) % tabs.length
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1

    if (nextIndex === null) return

    event.preventDefault()
    focusTab(tabs[nextIndex].id)
  }

  return (
    <div className={panelClassName}>
      <div className="right-panel__tabs" role="tablist">
        {tabs.map(tab => {
          const tabActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              id={`${idPrefix}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={tabActive}
              aria-controls={`${idPrefix}-${tab.id}-panel`}
              tabIndex={tabActive ? 0 : -1}
              ref={element => {
                tabRefs.current[tab.id] = element
              }}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={event => handleTabKeyDown(event, tab.id)}
              className={tabActive ? 'right-panel__tab right-panel__tab--active' : 'right-panel__tab'}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map(tab => {
        const tabActive = activeTab === tab.id
        const paneClassName = tabActive ? 'right-panel__pane right-panel__pane--active' : 'right-panel__pane'

        if (tab.id === 'machine') {
          return (
            <div
              key={tab.id}
              id={`${idPrefix}-${tab.id}-panel`}
              role="tabpanel"
              aria-labelledby={`${idPrefix}-${tab.id}-tab`}
              className={paneClassName}
              aria-hidden={!tabActive}
            >
              <MachinePanel />
            </div>
          )
        }

        const items = INTERVENTIONS.filter(i => i.category === tab.id as InterventionCategory)
        const gridClassName = tab.id === 'drug' ? 'action-grid action-grid--drugs' : 'action-grid'

        return (
          <div
            key={tab.id}
            id={`${idPrefix}-${tab.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-${tab.id}-tab`}
            className={paneClassName}
            aria-hidden={!tabActive}
          >
            <div className={gridClassName}>
              {items.map(item => {
                const entry = doseLedger.get(item.id)
                const { onCooldown, remainingSec, maxedOut } = describeCooldown(item, entry, elapsedSeconds)
                // Reference cooldownTick so React re-renders this row on each tick.
                void cooldownTick
                const disabled = onCooldown || maxedOut || !commandsAvailable
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
                    className={tab.id === 'drug' ? 'action-button drug-action-button' : 'action-button'}
                  >
                    {badge && (
                      <span className="action-button__badge">
                        {badge}
                      </span>
                    )}
                    {tab.id === 'drug' && syringeLabels[item.id] ? (
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
                        <div className="action-button__label">{item.label}</div>
                        <div className="action-button__description">
                          {subtitle}
                        </div>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {activeTab !== 'machine' && !commandsAvailable && (
        <p className="command-unavailable">Commands unavailable while reconnecting.</p>
      )}

      <div className={eventLogCollapsed ? 'event-log event-log--collapsed' : 'event-log'}>
        <div className="event-log__header">
          <span>Event Log</span>
          {eventLogToggleVisible && (
            <button
              type="button"
              className="event-log__toggle"
              aria-expanded={!eventLogCollapsed}
              onClick={() => setEventLogCollapsed(collapsed => !collapsed)}
            >
              Events {eventLog.length > 0 ? `(${eventLog.length})` : ''}
            </button>
          )}
        </div>
        <div
          ref={logRef}
          className="event-log__body"
        >
          {eventLog.length === 0 && (
            <div className="event-log__empty">
              No events yet.
            </div>
          )}
          {eventLog.map((event, i) => (
            <div
              key={i}
              className={eventLogEntryClassName(event)}
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
