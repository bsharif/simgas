import type { EcgRhythm } from './patient'

const TWO_PI = Math.PI * 2

function gaussian(x: number, center: number, width: number, amp: number): number {
  const dx = x - center
  return amp * Math.exp(-(dx * dx) / (2 * width * width))
}

export function generateECGSample(
  time: number,
  hr: number,
  rhythm: EcgRhythm
): number {
  if (rhythm === 'asystole') return 0

  if (rhythm === 'vf') {
    const freq = 5 + Math.sin(time * 3) * 2
    return Math.sin(time * TWO_PI * freq) * (0.15 + Math.random() * 0.15)
  }

  if (rhythm === 'vt') {
    const rr = 60 / 200
    const t = time % rr
    return (
      gaussian(t, rr * 0, 0.01, 1.5) +
      gaussian(t, rr * 0.1, 0.02, -0.3) +
      gaussian(t, rr * 0.2, 0.04, 0.4)
    )
  }

  if (rhythm === 'svt') {
    const rr = 60 / 180
    const t = time % rr
    return (
      gaussian(t, rr * 0.1, 0.008, -0.1) +
      gaussian(t, rr * 0, 0.006, 1.2) +
      gaussian(t, rr * 0.05, 0.01, -0.2) +
      gaussian(t, rr * 0.2, 0.03, 0.25)
    )
  }

  const rr = 60 / hr
  const t = time % rr

  if (t > rr * 0.9) {
    const baselineDrift = Math.sin(time * 2) * 0.02
    const noise = (Math.random() - 0.5) * 0.01
    return baselineDrift + noise
  }

  const wave =
    gaussian(t, rr * 0.1, 0.01, -0.1) +
    gaussian(t, rr * 0.01, 0.004, -0.05) +
    gaussian(t, rr * 0, 0.006, 1.0) +
    gaussian(t, rr * 0.05, 0.01, -0.3) +
    gaussian(t, rr * 0.18, 0.025, 0.2) +
    gaussian(t, rr * 0.4, 0.03, 0.08)

  const baselineDrift = Math.sin(time * 2) * 0.02
  const noise = (Math.random() - 0.5) * 0.01
  return wave + baselineDrift + noise
}

export function generateSpO2Sample(
  time: number,
  hr: number,
  spo2: number
): number {
  const rr = 60 / hr
  const t = time % rr

  const amplitude = 0.2 + (spo2 / 100) * 0.8
  const primary = Math.sin((t / rr) * TWO_PI) * amplitude

  const notch = Math.max(0, Math.sin(((t / rr) * TWO_PI + 0.15) * 1.5)) * 0.15 * amplitude
  const baseline = 0.1 * (1 - amplitude)

  return Math.max(-0.05, primary - notch + baseline)
}

export function generateETCO2Sample(
  time: number,
  rr: number,
  etco2: number,
  bronchospasm: boolean
): number {
  const cycle = 60 / rr
  const t = time % cycle
  const inspiratoryFraction = 0.35

  const plateauValue = etco2 / 8
  const rampStart = cycle * inspiratoryFraction

  if (t < rampStart) {
    const rampProgress = t / rampStart
    const smoothRamp = rampProgress < 0.5
      ? 2 * rampProgress * rampProgress
      : 1 - Math.pow(-2 * rampProgress + 2, 2) / 2
    return smoothRamp * plateauValue
  }

  const exhalationProgress = (t - rampStart) / (cycle - rampStart)

  if (bronchospasm && exhalationProgress > 0.1 && exhalationProgress < 0.9) {
    const sawtooth = Math.sin(exhalationProgress * 40) * 0.04 * plateauValue
    return plateauValue + sawtooth
  }

  if (exhalationProgress < 0.85) {
    return plateauValue
  }

  const dropProgress = (exhalationProgress - 0.85) / 0.15
  const smoothDrop = dropProgress * dropProgress * (3 - 2 * dropProgress)
  return plateauValue * (1 - smoothDrop)
}

/**
 * Synthetic arterial line waveform: sharp upstroke, dicrotic notch on the
 * downstroke, exponential decay to diastolic. Distinct envelope from pleth
 * (no respiratory swing) and from ECG (no negative deflections).
 *
 * Returns a value in approximately [0, 1] — the canvas scales it. The
 * relative amplitude is modulated by (sys - dia) so a narrow pulse pressure
 * (e.g. tamponade, hypovolaemia) looks visually different from a wide one.
 */
export function generateArterialSample(
  time: number,
  hr: number,
  sys: number,
  dia: number,
): number {
  const rr = 60 / Math.max(hr, 1)
  const t = (time % rr) / rr // 0..1 within a beat

  // Sharp systolic upstroke from t=0 to t=0.10
  let v: number
  if (t < 0.10) {
    v = Math.pow(t / 0.10, 2)
  } else if (t < 0.30) {
    // Decay from peak through the dicrotic notch
    const p = (t - 0.10) / 0.20
    // small notch at p ~= 0.6
    const notch = Math.exp(-((p - 0.55) ** 2) / 0.005) * -0.12
    v = (1 - p) * 0.8 + 0.2 + notch
  } else {
    // Slow exponential decay back toward diastolic
    const p = (t - 0.30) / 0.70
    v = 0.2 * Math.exp(-p * 2.5)
  }

  // Scale by pulse pressure normalised against a "wide" baseline of ~40 mmHg.
  const pulsePressure = Math.max(0, sys - dia)
  const amplitude = Math.min(1, pulsePressure / 50)

  return v * amplitude
}

export function generateRespSample(
  time: number,
  rr: number,
  manualVentilationActive: boolean
): number {
  if (manualVentilationActive) {
    const squeezePhase = (time * 2.4) % 1
    return squeezePhase < 0.42
      ? Math.sin((squeezePhase / 0.42) * Math.PI)
      : Math.max(0, 1 - ((squeezePhase - 0.42) / 0.58))
  }

  const cycle = 60 / Math.max(rr, 1)
  const phase = (time % cycle) / cycle
  if (phase < 0.38) {
    return Math.sin((phase / 0.38) * Math.PI) * 0.9
  }
  return Math.max(0, 0.9 * (1 - ((phase - 0.38) / 0.62)))
}

export const SAMPLES_PER_TICK = 2
