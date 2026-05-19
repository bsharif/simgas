/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import { useAlarms } from '../hooks/useAlarms'
import { useSimulation } from './SimulationContext'
import { useMonitorLayout } from './MonitorLayoutContext'

type AlarmsValue = ReturnType<typeof useAlarms>

const AlarmsContext = createContext<AlarmsValue | null>(null)

/**
 * Hosts a single useAlarms() instance so multiple consumers (Monitor numeric
 * highlights + header mute button) share one AudioContext, one mute timer,
 * and one beep scheduler.
 */
export function AlarmsProvider({ children }: { children: ReactNode }) {
  const { state } = useSimulation()
  const { layout } = useMonitorLayout()
  const alarms = useAlarms(state, layout.numerics)
  return <AlarmsContext.Provider value={alarms}>{children}</AlarmsContext.Provider>
}

export function useAlarmsContext(): AlarmsValue {
  const ctx = useContext(AlarmsContext)
  if (!ctx) throw new Error('useAlarmsContext must be used within AlarmsProvider')
  return ctx
}
