import { useState, type FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'

const HINT_THRESHOLDS_SECONDS = [5, 20, 45] as const

const HintsPanel: FC = () => {
  const { mode, scenario, elapsedSeconds } = useSimulation()
  // Track dismissal per scenario id so that picking a new scenario resets it
  // without needing an effect to clear the flag.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const isDismissed = dismissedFor !== null && dismissedFor === scenario?.id

  if (mode !== 'guided' || !scenario || isDismissed) return null

  let hintIndex = -1
  for (let i = HINT_THRESHOLDS_SECONDS.length - 1; i >= 0; i--) {
    if (elapsedSeconds >= HINT_THRESHOLDS_SECONDS[i]) {
      hintIndex = Math.min(i, scenario.hints.length - 1)
      break
    }
  }

  const hint = hintIndex >= 0 ? scenario.hints[hintIndex] : null
  if (!hint) return null

  return (
    <div style={{
      padding: '10px 12px',
      background: '#fefefe',
      borderBottom: '1px solid #e0ddd5',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <span style={{ color: '#cc8800', fontSize: 16 }}>💡</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#cc8800', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
          Hint
        </div>
        <div style={{ color: '#555', fontSize: 12, lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
      <button
        onClick={() => setDismissedFor(scenario.id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#ccc',
          cursor: 'pointer',
          fontSize: 14,
          padding: '2px 6px',
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default HintsPanel
