import { useEffect, useMemo, useRef, useState } from 'react'
import { detectAlarms, type AlarmPriority } from '../../engine/alarms'
import type { PatientState } from '../../engine/patient'
import type { MonitorNumeric, NumericId } from '../../engine/monitor/layout'

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
}

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

export function useAlarms(
  state: PatientState,
  numerics: readonly MonitorNumeric[],
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

  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastBurstAtRef = useRef(0)
  const lastPriorityRef = useRef<AlarmPriority>('none')

  // Lazy-init AudioContext on first user gesture.
  useEffect(() => {
    if (audioCtxRef.current) return
    const init = () => {
      if (audioCtxRef.current) return
      try {
        const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtor) audioCtxRef.current = new AudioCtor()
      } catch {
        // ignore — browser may have blocked
      }
    }
    window.addEventListener('pointerdown', init, { once: true })
    window.addEventListener('keydown', init, { once: true })
    return () => {
      window.removeEventListener('pointerdown', init)
      window.removeEventListener('keydown', init)
    }
  }, [])

  // Schedule beeps.
  useEffect(() => {
    const { priority } = detection
    if (priority === 'none') {
      lastBurstAtRef.current = 0
      lastPriorityRef.current = 'none'
      return
    }
    if (isMuted) return
    const ctx = audioCtxRef.current
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
  }, [detection, isMuted])

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
    priority: detection.priority,
    byNumeric: detection.byNumeric,
    isMuted,
    toggleMute,
    muteRemainingSec,
  }
}
