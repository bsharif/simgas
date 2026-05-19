import type { FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'

type Mode = 'guided' | 'exam' | 'free'

const ModeToggle: FC = () => {
  const { mode, setMode } = useSimulation()

  const modes: { id: Mode; label: string }[] = [
    { id: 'guided', label: 'Guided' },
    { id: 'exam', label: 'Exam' },
    { id: 'free', label: 'Free Play' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: '#f5f5f0',
      borderRadius: 4,
      border: '1px solid #e0ddd5',
      overflow: 'hidden',
    }}>
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          style={{
            padding: '7px 14px',
            border: 'none',
            background: mode === m.id ? '#ffffff' : 'transparent',
            color: mode === m.id ? '#1a5276' : '#bbb',
            fontSize: 14,
            cursor: 'pointer',
            borderRight: '1px solid #e0ddd5',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => {
            if (mode !== m.id) e.currentTarget.style.color = '#888'
          }}
          onMouseLeave={e => {
            if (mode !== m.id) e.currentTarget.style.color = '#bbb'
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export default ModeToggle
