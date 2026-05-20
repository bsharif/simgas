// ui/hooks/useNibpCycle.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { NibpReading } from '../../engine/patient'
import { getAudioContext } from '../audio/audioContext'

export type NibpInterval = '1min' | '2.5min' | '5min' | '10min' | 'manual'

export interface NibpHistoryEntry {
  time: string
  sys: number
  dia: number
  map: number
}

function scheduleNibpPumpClicks(ctx: AudioContext): void {
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) {
    const clickT = t + i * 0.15
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 100
    gain.gain.setValueAtTime(0, clickT)
    gain.gain.linearRampToValueAtTime(0.08, clickT + 0.005)
    gain.gain.linearRampToValueAtTime(0, clickT + 0.04)
    osc.connect(gain).connect(ctx.destination)
    osc.start(clickT)
    osc.stop(clickT + 0.05)
  }
}

function playNibpCompleteBeep(ctx: AudioContext): void {
  const t = ctx.currentTime + 0.002
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 800
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.10, t + 0.01)
  gain.gain.linearRampToValueAtTime(0, t + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.13)
}

const INTERVAL_MS: Record<NibpInterval, number> = {
  '1min':   60_000,
  '2.5min': 150_000,
  '5min':   300_000,
  '10min':  600_000,
  'manual': Infinity,
}

const INTERVAL_ORDER: NibpInterval[] = ['1min', '2.5min', '5min', '10min', 'manual']

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function seedHistory(nibp: NibpReading, count = 6): NibpHistoryEntry[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const minutesBack = (count - i) * 5
    const jitter = (Math.random() - 0.5) * 10
    const sys = Math.max(60, Math.round(nibp.sys + jitter))
    const dia = Math.max(40, Math.round(nibp.dia + jitter * 0.6))
    const map = Math.round((sys + 2 * dia) / 3)
    return { time: formatTime(new Date(now - minutesBack * 60_000)), sys, dia, map }
  })
}

export interface NibpCycleResult {
  measuring: boolean
  interval: NibpInterval
  history: NibpHistoryEntry[]
  triggerCycle: () => void
  cancelCycle: () => void
  cycleInterval: () => void
}

export function useNibpCycle(nibp: NibpReading): NibpCycleResult {
  const [measuring, setMeasuring] = useState(false)
  const [interval, setInterval_] = useState<NibpInterval>('5min')
  const [history, setHistory] = useState<NibpHistoryEntry[]>(() => seedHistory(nibp))
  const nibpRef = useRef(nibp)
  // Keep nibpRef current without triggering render — update in effect.
  useEffect(() => {
    nibpRef.current = nibp
  }, [nibp])

  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelCycle = useCallback(() => {
    if (measureTimerRef.current !== null) {
      clearTimeout(measureTimerRef.current)
      measureTimerRef.current = null
    }
    setMeasuring(false)
  }, [])

  const triggerCycle = useCallback(() => {
    if (measureTimerRef.current !== null) clearTimeout(measureTimerRef.current)

    // Play NIBP cuff inflation pump clicks.
    const ctx = getAudioContext()
    if (ctx) scheduleNibpPumpClicks(ctx)

    setMeasuring(true)
    measureTimerRef.current = setTimeout(() => {
      // Play measurement complete beep.
      if (ctx) playNibpCompleteBeep(ctx)

      const current = nibpRef.current
      const jitter = (Math.random() - 0.5) * 10
      const sys = Math.max(60, Math.round(current.sys + jitter))
      const dia = Math.max(40, Math.round(current.dia + jitter * 0.6))
      const map = Math.round((sys + 2 * dia) / 3)
      const entry: NibpHistoryEntry = { time: formatTime(new Date()), sys, dia, map }
      setHistory(prev => [entry, ...prev].slice(0, 6))
      setMeasuring(false)
      measureTimerRef.current = null
    }, 4_000)
  }, [])

  const cycleInterval = useCallback(() => {
    setInterval_(prev => {
      const idx = INTERVAL_ORDER.indexOf(prev)
      return INTERVAL_ORDER[(idx + 1) % INTERVAL_ORDER.length]
    })
  }, [])

  // Auto-trigger on interval.
  const triggerRef = useRef(triggerCycle)
  useEffect(() => {
    triggerRef.current = triggerCycle
  }, [triggerCycle])
  useEffect(() => {
    if (interval === 'manual') return
    const ms = INTERVAL_MS[interval]
    const id = window.setInterval(() => triggerRef.current(), ms)
    return () => window.clearInterval(id)
  }, [interval])

  // Cleanup on unmount.
  useEffect(() => () => { cancelCycle() }, [cancelCycle])

  return { measuring, interval, history, triggerCycle, cancelCycle, cycleInterval }
}
