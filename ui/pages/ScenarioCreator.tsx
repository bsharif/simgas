import type { FC } from 'react'

interface ScenarioCreatorProps {
  onBack: () => void
}

const ScenarioCreator: FC<ScenarioCreatorProps> = ({ onBack }) => {
  return (
    <div style={{ width: '100%', height: '100vh', overflowY: 'auto', background: '#f5f5f0' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid #e0ddd5', background: 'transparent',
              cursor: 'pointer', color: '#555', fontSize: 14,
            }}
          >
            ← Back
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a5276', letterSpacing: 3, textTransform: 'uppercase' }}>
            Scenario Creator
          </div>
        </div>
        <p style={{ color: '#999' }}>Form coming soon.</p>
      </div>
    </div>
  )
}

export default ScenarioCreator
