import type { FC } from 'react'
import type { SessionError } from '../context/RemoteSimulationContext'

/**
 * Full-screen recovery view for fatal session errors (wrong code, expired
 * room, full session). Gives the user an actionable path back instead of a
 * confusingly empty remote screen (review: "Join and create errors are not
 * visible enough").
 */
const SessionErrorScreen: FC<{ error: SessionError; onBack: () => void }> = ({ error, onBack }) => (
  <main style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#1f2428', padding: 16,
  }}>
    <div style={{
      maxWidth: 420, background: '#fff', borderRadius: 12, padding: '28px 32px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
      <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#2c2c2c' }}>Couldn't join the session</h1>
      <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14, lineHeight: 1.5 }}>{error.message}</p>
      <button
        onClick={onBack}
        style={{
          padding: '10px 22px', border: 'none', borderRadius: 6,
          background: '#1a5276', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Back to lobby
      </button>
    </div>
  </main>
)

export default SessionErrorScreen
