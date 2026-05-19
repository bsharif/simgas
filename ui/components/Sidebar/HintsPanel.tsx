import { useState, type FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'

const HintsPanel: FC = () => {
  const { mode, scenario, eventLog } = useSimulation()
  const [dismissed, setDismissed] = useState(false)

  if (mode !== 'guided' || !scenario || dismissed) return null

  const elapsedSeconds = eventLog.length

  let hintIndex = -1
  if (elapsedSeconds > 5) hintIndex = 0
  if (elapsedSeconds > 15) hintIndex = Math.min(1, scenario.hints.length - 1)
  if (elapsedSeconds > 30) hintIndex = Math.min(2, scenario.hints.length - 1)

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
        onClick={() => setDismissed(true)}
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
