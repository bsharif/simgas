import type { FC } from 'react'
import type { InterventionEvent, VitalsSample } from '../../../engine/physiology'
import { INTERVENTION_MAP } from '../../../engine/interventions'

/**
 * Debrief timeline replay (killer feature: "Shared debrief with timeline
 * replay"). Renders the recorded 1 Hz vitals history as SVG traces with
 * intervention markers, so a fast chaotic crisis becomes a readable sequence.
 * Pure presentational component — data comes from the engine in solo mode and
 * from the server session summary in remote mode.
 */

interface VitalsTimelineProps {
  history: readonly VitalsSample[]
  interventions: readonly InterventionEvent[]
}

interface TraceSpec {
  key: keyof Pick<VitalsSample, 'hr' | 'spo2' | 'etco2' | 'nibpSys'>
  label: string
  color: string
  min: number
  max: number
}

const TRACES: TraceSpec[] = [
  { key: 'hr', label: 'HR', color: '#2e9e4f', min: 0, max: 180 },
  { key: 'spo2', label: 'SpO₂', color: '#1d83a6', min: 40, max: 100 },
  { key: 'nibpSys', label: 'Sys BP', color: '#c0392b', min: 0, max: 200 },
  { key: 'etco2', label: 'ETCO₂', color: '#b7950b', min: 0, max: 12 },
]

const WIDTH = 800
const HEIGHT = 180
const PAD_LEFT = 8
const PAD_RIGHT = 8
const PAD_TOP = 10
const PAD_BOTTOM = 26

function buildPath(
  history: readonly VitalsSample[],
  trace: TraceSpec,
  durationSec: number,
): string {
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  return history
    .map((sample, index) => {
      const x = PAD_LEFT + (durationSec > 0 ? (sample.atSec / durationSec) * innerWidth : 0)
      const normalized = Math.max(0, Math.min(1, (sample[trace.key] - trace.min) / (trace.max - trace.min)))
      const y = PAD_TOP + (1 - normalized) * innerHeight
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const VitalsTimeline: FC<VitalsTimelineProps> = ({ history, interventions }) => {
  if (history.length < 2) return null
  const durationSec = Math.max(history[history.length - 1].atSec, 1)
  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT

  // Collapse manual-vent breath bursts into a single marker per 5 s window so
  // sustained bagging doesn't wallpaper the timeline.
  const markers: InterventionEvent[] = []
  let lastManualVentAt = -Infinity
  for (const event of interventions) {
    if (event.id === 'manual-vent') {
      if (event.atSec - lastManualVentAt < 5) continue
      lastManualVentAt = event.atSec
    }
    markers.push(event)
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Vitals over time with intervention markers"
        style={{ width: '100%', height: 'auto', background: '#fafaf7', border: '1px solid #eeece5', borderRadius: 6 }}
      >
        {TRACES.map(trace => (
          <path
            key={trace.key}
            d={buildPath(history, trace, durationSec)}
            fill="none"
            stroke={trace.color}
            strokeWidth={1.6}
            opacity={0.85}
          />
        ))}
        {markers.map((event, index) => {
          const x = PAD_LEFT + (event.atSec / durationSec) * innerWidth
          const label = INTERVENTION_MAP.get(event.id)?.label ?? event.id
          return (
            <g key={`${event.id}-${index}`}>
              <line x1={x} y1={PAD_TOP} x2={x} y2={HEIGHT - PAD_BOTTOM} stroke="#999" strokeDasharray="3 3" strokeWidth={0.8} />
              <circle cx={x} cy={HEIGHT - PAD_BOTTOM} r={3.5} fill="#555">
                <title>{`${label} @ ${formatClock(event.atSec)}`}</title>
              </circle>
            </g>
          )
        })}
        <text x={PAD_LEFT} y={HEIGHT - 8} fontSize={11} fill="#999">0:00</text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 8} fontSize={11} fill="#999" textAnchor="end">{formatClock(durationSec)}</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
        {TRACES.map(trace => (
          <span key={trace.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#666' }}>
            <span style={{ width: 14, height: 3, background: trace.color, display: 'inline-block', borderRadius: 2 }} />
            {trace.label}
          </span>
        ))}
        <span style={{ color: '#888' }}>● interventions (hover for detail)</span>
      </div>
    </div>
  )
}

export default VitalsTimeline
