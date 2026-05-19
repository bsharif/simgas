import { useState, type FC } from 'react'
import { useSimulation } from '../context/SimulationContext'

interface StartPageProps {
  onStart: () => void
}

const scenarioMeta: Record<string, { icon: string; color: string }> = {
  anaphylaxis: { icon: '⚡', color: '#cc3333' },
  'oesophageal-intubation': { icon: '🫁', color: '#cc7700' },
  'malignant-hyperthermia': { icon: '🌡️', color: '#cc5500' },
}

const StartPage: FC<StartPageProps> = ({ onStart }) => {
  const { scenarios, mode, setMode, startScenario } = useSimulation()
  const [selectedId, setSelectedId] = useState<string>('anaphylaxis')

  const handleStart = () => {
    if (selectedId) {
      startScenario(selectedId)
    }
    onStart()
  }

  const selected = scenarios.find(s => s.id === selectedId)

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f0',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 48,
      }}>
        <div style={{
          fontSize: 48,
          fontWeight: 700,
          color: '#1a5276',
          letterSpacing: 6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          SimGas
        </div>
        <div style={{
          fontSize: 14,
          color: '#999',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          Anaesthetic Simulation Monitor
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 32,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {scenarios.map(s => {
          const isSelected = selectedId === s.id
          const meta = scenarioMeta[s.id] || { icon: '📋', color: '#888' }
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                width: 230,
                padding: 20,
                borderRadius: 10,
                border: isSelected ? `2px solid ${meta.color}` : '1px solid #e0ddd5',
                background: isSelected ? '#ffffff' : '#fafafa',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, background 0.2s',
                boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.borderColor = meta.color
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isSelected ? '#ffffff' : '#fafafa'
                e.currentTarget.style.borderColor = isSelected ? meta.color : '#e0ddd5'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {meta.icon}
              </div>
              <div style={{
                color: isSelected ? '#2c2c2c' : '#555',
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
              }}>
                {s.label}
              </div>
              <div style={{
                color: '#999',
                fontSize: 13,
                lineHeight: 1.4,
              }}>
                {s.description.length > 70 ? s.description.slice(0, 70) + '...' : s.description}
              </div>
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: isSelected ? meta.color : '#bbb',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                {s.difficulty}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 32,
      }}>
        {(['guided', 'exam', 'free'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: mode === m ? '1px solid #1a5276' : '1px solid #e0ddd5',
              background: mode === m ? '#ffffff' : 'transparent',
              color: mode === m ? '#1a5276' : '#999',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 1,
              transition: 'all 0.2s',
            }}
          >
            {m === 'guided' ? '🎯 Guided' : m === 'exam' ? '⏱ Exam' : '🎮 Free Play'}
          </button>
        ))}
      </div>

      <button
        onClick={handleStart}
        style={{
          padding: '16px 52px',
          borderRadius: 8,
          border: '2px solid #1a5276',
          background: 'rgba(26,82,118,0.05)',
          color: '#1a5276',
          fontSize: 18,
          fontWeight: 700,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: 3,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,82,118,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,82,118,0.05)' }}
      >
        {selected ? scenarioMeta[selected.id]?.icon || '▶' : '▶'} Start Simulation
      </button>

      <div style={{
        marginTop: 48,
        fontSize: 11,
        color: '#ccc',
        maxWidth: 400,
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        SimGas is an educational simulation tool. Not for clinical use.
      </div>
    </div>
  )
}

export default StartPage
