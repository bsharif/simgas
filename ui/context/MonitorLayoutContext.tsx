/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  DEFAULT_LAYOUT,
  PRESETS,
  type MonitorLayout,
  type MonitorTrace,
  type MonitorNumeric,
  type TraceId,
  type NumericId,
} from '../../engine/monitor/layout'

const STORAGE_KEY = 'simgas.layout.v1'

interface MonitorLayoutContextValue {
  layout: MonitorLayout
  updateTrace: (id: TraceId, partial: Partial<MonitorTrace>) => void
  updateNumeric: (id: NumericId, partial: Partial<MonitorNumeric>) => void
  applyPreset: (name: keyof typeof PRESETS) => void
  resetToDefault: () => void
}

const MonitorLayoutContext = createContext<MonitorLayoutContextValue | null>(null)

function loadLayout(): MonitorLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MonitorLayout
      // Minimal shape check — if storage is from a different schema version,
      // fall back to defaults rather than rendering with malformed data.
      if (parsed && Array.isArray(parsed.traces) && Array.isArray(parsed.numerics)) {
        return parsed
      }
    }
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  return DEFAULT_LAYOUT
}

export function MonitorLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<MonitorLayout>(loadLayout)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // ignore
    }
  }, [layout])

  const updateTrace = useCallback((id: TraceId, partial: Partial<MonitorTrace>) => {
    setLayoutState(prev => ({
      ...prev,
      traces: prev.traces.map(t => t.id === id ? { ...t, ...partial } : t),
    }))
  }, [])

  const updateNumeric = useCallback((id: NumericId, partial: Partial<MonitorNumeric>) => {
    setLayoutState(prev => ({
      ...prev,
      numerics: prev.numerics.map(n => n.id === id ? { ...n, ...partial } : n),
    }))
  }, [])

  const applyPreset = useCallback((name: keyof typeof PRESETS) => {
    setLayoutState(PRESETS[name])
  }, [])

  const resetToDefault = useCallback(() => {
    setLayoutState(DEFAULT_LAYOUT)
  }, [])

  return (
    <MonitorLayoutContext.Provider value={{ layout, updateTrace, updateNumeric, applyPreset, resetToDefault }}>
      {children}
    </MonitorLayoutContext.Provider>
  )
}

export function useMonitorLayout(): MonitorLayoutContextValue {
  const ctx = useContext(MonitorLayoutContext)
  if (!ctx) throw new Error('useMonitorLayout must be used within MonitorLayoutProvider')
  return ctx
}
