import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectAlarms, type AlarmPriority } from '../../engine/alarms'
import type { PatientState } from '../../engine/patient'
import type { MonitorNumeric, NumericId } from '../../engine/monitor/layout'
import type { SimulationEngine } from '../../engine/physiology'
import { getAudioContext } from '../audio/audioContext'

/**
 * Audio + visual alarm hook (Phase 3.7).
 *
 * - Runs the pure `detectAlarms` against the live patient state at ~2 Hz.
 * - When the highest priority is non-none, plays a tone pattern via Web Audio
 *   API every ~3.5 s (red), 6 s (yellow), 10 s (cyan).
 * - First user click on the page initialises the AudioContext (browsers
 *   require a user gesture).
 * - System-wide mute button suspends audio without affecting the visual
 *   alarm state.
 * - Auto-resilencing: if the user mutes, the mute clears itself after 120 s
 *   like a real monitor.
 */

interface UseAlarmsResult {
  priority: AlarmPriority
  byNumeric: ReadonlyMap<NumericId, AlarmPriority>
  isMuted: boolean
  toggleMute: () => void
  /** Seconds remaining on the auto-resilence timer, or null. */
  muteRemainingSec: number | null
  acknowledgeAlarm: () => void
}

const ALARM_RANK: Record<AlarmPriority, number> = { none: 0, cyan: 1, yellow: 2, red: 3 }

const MUTE_DURATION_MS = 120_000

interface TonePattern {
  /** Hz */
  freq: number
  /** Beeps in one burst. */
  count: number
  /** Beep length seconds. */
  beepSec: number
  /** Silence between beeps in a burst. */
  gapSec: number
  /** Seconds between consecutive bursts. */
  intervalMs: number
}

const PATTERNS: Record<Exclude<AlarmPriority, 'none'>, TonePattern> = {
  red:    { freq: 880, count: 3, beepSec: 0.15, gapSec: 0.08, intervalMs: 3500 },
  yellow: { freq: 620, count: 2, beepSec: 0.18, gapSec: 0.10, intervalMs: 6000 },
  cyan:   { freq: 480, count: 1, beepSec: 0.20, gapSec: 0,    intervalMs: 10000 },
}

function pitchFromSpo2(spo2: number): number {
  // 440 * 2^((spo2 - 85) / 15): 100% → 880 Hz, 85% → 440 Hz, 70% → 220 Hz
  const freq = 440 * Math.pow(2, (spo2 - 85) / 15)
  return Math.max(100, Math.min(1500, freq))
}

export function useAlarms(
  state: PatientState,
  numerics: readonly MonitorNumeric[],
  engine: SimulationEngine,
): UseAlarmsResult {
  // Re-evaluate at ~2 Hz independently of the throttled React state cadence,
  // and provide a clock for the mute-countdown display. We snapshot the
  // monotonic clock into React state via the interval so the render path
  // stays pure (no Date.now / performance.now during render).
  const [nowPerfMs, setNowPerfMs] = useState(() => performance.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowPerfMs(performance.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  const detection = useMemo(
    () => { void nowPerfMs; return detectAlarms(state, numerics) },
    [state, numerics, nowPerfMs],
  )

  // Acknowledged breaches are suppressed until the value returns to normal.
  const [acknowledgedIds, setAcknowledgedIds] = useState<ReadonlySet<NumericId>>(
    () => new Set<NumericId>()
  )

  // Clear acknowledged ids that are no longer breaching (so they can re-alarm).
  useEffect(() => {
    if (acknowledgedIds.size === 0) return
    const next = new Set([...acknowledgedIds].filter(id => detection.byNumeric.has(id)))
    if (next.size !== acknowledgedIds.size)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAcknowledgedIds(next)
  }, [detection.byNumeric, acknowledgedIds])

  const effectiveByNumeric = useMemo((): ReadonlyMap<NumericId, AlarmPriority> => {
    if (acknowledgedIds.size === 0) return detection.byNumeric
    const m = new Map(detection.byNumeric)
    for (const id of acknowledgedIds) m.delete(id)
    return m
  }, [detection.byNumeric, acknowledgedIds])

  const effectivePriority = useMemo((): AlarmPriority => {
    let highest: AlarmPriority = 'none'
    for (const p of effectiveByNumeric.values()) {
      if (ALARM_RANK[p] > ALARM_RANK[highest]) highest = p
    }
    return highest
  }, [effectiveByNumeric])

  const acknowledgeAlarm = useCallback(() => {
    setAcknowledgedIds(new Set(detection.byNumeric.keys()))
  }, [detection.byNumeric])

  // Mute lifetime is anchored to performance.now() (monotonic, lint-allowed
  // in render) rather than Date.now() so we can compute muteRemainingSec
  // during render without breaking react-hooks/purity.
  const [isMuted, setIsMuted] = useState(false)
  const [muteUntilPerfMs, setMuteUntilPerfMs] = useState<number | null>(null)

  // Auto-resilence after MUTE_DURATION_MS. setTimeout handles the actual
  // state reset; we don't synchronously setState inside the effect body.
  useEffect(() => {
    if (!isMuted || muteUntilPerfMs === null) return
    const wait = Math.max(0, muteUntilPerfMs - performance.now())
    const id = window.setTimeout(() => {
      setIsMuted(false)
      setMuteUntilPerfMs(null)
    }, wait)
    return () => window.clearTimeout(id)
  }, [isMuted, muteUntilPerfMs])

  const lastBurstAtRef = useRef(0)
  const lastPriorityRef = useRef<AlarmPriority>('none')

  // QRS pip — fires once per beat, aligned with the waveform generator's beat phase.
  // generateECGSample uses `time % (60/hr)` so the R-peak occurs exactly when that
  // phase wraps to zero. We detect the wrap in engine.elapsedSeconds rather than
  // scanning the buffer (buffer sampling at 120 Hz is too coarse to catch the
  // narrow R-peak reliably across tick boundaries).
  //
  // Also handles ventilator breath sounds using the same phase-wrap technique
  // on the respiratory cycle (60/rr).
  const prevBeatPhaseRef = useRef(0)
  const prevRespPhaseRef = useRef(0)
  const prevVentActiveRef = useRef(false)
  useEffect(() => {
    const unsub = engine.subscribe((s) => {
      const ctx = getAudioContext()
      if (!ctx || isMuted) return

      // --- QRS pip ---
      if (s.ecgRhythm !== 'asystole') {
        const beatIntervalSec = 60 / Math.max(s.hr, 1)
        const beatPhase = engine.elapsedSeconds % beatIntervalSec
        const prevPhase = prevBeatPhaseRef.current
        prevBeatPhaseRef.current = beatPhase
        if (beatPhase < prevPhase) {
          const t = ctx.currentTime + 0.002
          const freq = pitchFromSpo2(s.spo2)
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.12, t + 0.01)
          gain.gain.linearRampToValueAtTime(0.12, t + 0.05)
          gain.gain.linearRampToValueAtTime(0, t + 0.06)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.07)
        }
      }

      // --- Ventilator breath sounds ---
      if (s.ventilationMode === 'ventilator') {
        const respIntervalSec = 60 / Math.max(s.rr, 1)
        const respPhase = engine.elapsedSeconds % respIntervalSec
        const prevResp = prevRespPhaseRef.current
        prevRespPhaseRef.current = respPhase
        if (respPhase < prevResp) {
          const t = ctx.currentTime + 0.002
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          // Swept sine — 200→400 Hz, 100ms — "whoosh" of ventilator breath
          osc.type = 'sine'
          osc.frequency.setValueAtTime(200, t)
          osc.frequency.linearRampToValueAtTime(400, t + 0.10)
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.06, t + 0.01)
          gain.gain.linearRampToValueAtTime(0.06, t + 0.08)
          gain.gain.linearRampToValueAtTime(0, t + 0.10)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.11)
        }
      } else {
        prevRespPhaseRef.current = 0
      }

      // --- Manual bag squeeze sound ---
      if (s.manualVentilationActive && !prevVentActiveRef.current) {
        const t = ctx.currentTime + 0.002
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 150
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.08, t + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + 0.08)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.09)
      }
      prevVentActiveRef.current = s.manualVentilationActive
    })
    return unsub
  }, [engine, isMuted])

  // Schedule alarm beeps.
  useEffect(() => {
    const priority = effectivePriority
    if (priority === 'none') {
      lastBurstAtRef.current = 0
      lastPriorityRef.current = 'none'
      return
    }
    if (isMuted) return
    const ctx = getAudioContext()
    if (!ctx) return

    const pattern = PATTERNS[priority]
    const now = performance.now()

    // Fire immediately on priority change (escalation), otherwise honour interval.
    const escalated = priority !== lastPriorityRef.current
    const overdue = now - lastBurstAtRef.current >= pattern.intervalMs

    if (!escalated && !overdue) return

    lastBurstAtRef.current = now
    lastPriorityRef.current = priority

    let t = ctx.currentTime
    for (let i = 0; i < pattern.count; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = pattern.freq
      osc.type = 'square'
      // Short fades to avoid clicks.
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01)
      gain.gain.linearRampToValueAtTime(0.12, t + pattern.beepSec - 0.01)
      gain.gain.linearRampToValueAtTime(0, t + pattern.beepSec)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + pattern.beepSec + 0.02)
      t += pattern.beepSec + pattern.gapSec
    }
  }, [effectivePriority, isMuted])

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      setMuteUntilPerfMs(null)
    } else {
      setIsMuted(true)
      setMuteUntilPerfMs(performance.now() + MUTE_DURATION_MS)
    }
  }

  // Recomputed on every nowPerfMs tick (500 ms) so the countdown updates
  // smoothly without putting performance.now() in the render path.
  const muteRemainingSec = isMuted && muteUntilPerfMs !== null
    ? Math.max(0, Math.ceil((muteUntilPerfMs - nowPerfMs) / 1000))
    : null

  return {
    priority: effectivePriority,
    byNumeric: effectiveByNumeric,
    isMuted,
    toggleMute,
    muteRemainingSec,
    acknowledgeAlarm,
  }
}
