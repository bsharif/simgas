import { useState, type FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'

const ScenarioSelector: FC = () => {
  const { scenarios, scenario, startScenario, resolved, failed } = useSimulation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: '#f5f5f0',
            border: '1px solid #e0ddd5',
            borderRadius: 4,
            color: '#555',
            padding: '7px 12px',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {scenario?.label || 'Select Scenario'}
          <span style={{ color: '#bbb', fontSize: 10 }}>▼</span>
        </button>

        {isOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setIsOpen(false)}
            />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#ffffff',
              border: '1px solid #e0ddd5',
              borderRadius: 4,
              zIndex: 100,
              minWidth: 220,
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    startScenario(s.id)
                    setIsOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '11px 14px',
                    border: 'none',
                    background: scenario?.id === s.id ? '#f0f0e8' : 'transparent',
                    color: scenario?.id === s.id ? '#2c2c2c' : '#888',
                    fontSize: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0ea',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f0' }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = scenario?.id === s.id ? '#f0f0e8' : 'transparent'
                  }}
                >
                  <div>{s.label}</div>
                  <div style={{ fontSize: 12, color: '#ccc', marginTop: 3 }}>{s.description.slice(0, 60)}...</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {(resolved || failed) && (
        <button
          onClick={() => scenario && startScenario(scenario.id)}
          style={{
            background: '#fef0f0',
            border: '1px solid #f0d0d0',
            borderRadius: 4,
            color: '#cc3333',
            padding: '7px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {failed ? '❌ Failed — Restart' : '✓ Complete — Restart'}
        </button>
      )}
    </div>
  )
}

export default ScenarioSelector
