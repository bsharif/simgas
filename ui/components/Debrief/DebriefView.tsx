import type { FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'
import { INTERVENTION_MAP } from '../../../engine/interventions'
import { renderDebriefMarkdown } from './markdown'

/**
 * Post-scenario debrief view (Phase 3.8). Shows the scenario outcome, a
 * timeline of interventions the user applied, total doses where relevant,
 * the markdown body from the scenario file, and Replay / Close actions.
 *
 * Rendered as an overlay on top of SimulationView when phase is resolved or
 * failed. Engine is frozen at this point (Phase 1.1) so the monitor behind
 * shows the terminal state.
 */
const DebriefView: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { phase, scenario, engine, doseLedger, eventLog, startScenario } = useSimulation()
  const failed = phase === 'failed'

  if (!scenario) return null

  // engine.interventionList is the canonical full-history list (React state
  // may have been throttled). Snapshot once for stable rendering.
  const interventionList = Array.from(engine.interventionList)
  const html = scenario.debriefBody ? renderDebriefMarkdown(scenario.debriefBody) : ''

  return (
    <div
      role="dialog"
      aria-label="Scenario debrief"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 16px',
        overflowY: 'auto',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 880,
        background: '#fff', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        padding: '28px 36px',
        color: '#2c2c2c',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 4,
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              color: failed ? '#cc0000' : '#1a6e4c',
              background: failed ? '#fbecec' : '#ecf6f0',
              marginBottom: 8,
            }}>
              {failed ? '✗ Scenario failed' : '✓ Scenario complete'}
            </div>
            <h1 style={{ margin: 0, fontSize: 24 }}>{scenario.label}</h1>
            <p style={{ margin: '6px 0 0', color: '#666', fontSize: 14 }}>{scenario.description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close debrief"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#bbb', fontSize: 24, padding: '0 6px',
            }}
          >×</button>
        </header>

        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Interventions applied
          </h2>
          {interventionList.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
              No interventions applied this run.
            </p>
          ) : (
            <ul style={{
              margin: 0, padding: 0, listStyle: 'none',
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 18px',
            }}>
              {interventionList.map((id, idx) => {
                const intervention = INTERVENTION_MAP.get(id)
                const entry = doseLedger.get(id)
                return (
                  <li
                    key={`${id}-${idx}`}
                    style={{ fontSize: 13, color: '#333', padding: '4px 0', borderBottom: '1px solid #f0f0ea' }}
                  >
                    <strong style={{ color: '#1a5276' }}>
                      {intervention?.label ?? id}
                    </strong>
                    {entry && entry.count > 1 && (
                      <span style={{ color: '#888', marginLeft: 6 }}>× {entry.count}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Event log
          </h2>
          <div style={{
            maxHeight: 180, overflowY: 'auto',
            background: '#fafafa', border: '1px solid #eeece5', borderRadius: 6,
            padding: '8px 12px', fontFamily: '"Courier New", monospace', fontSize: 12,
          }}>
            {eventLog.length === 0 && <em style={{ color: '#aaa' }}>(empty)</em>}
            {eventLog.map((event, i) => (
              <div key={i} style={{ padding: '2px 0', color: '#555' }}>{event}</div>
            ))}
          </div>
        </section>

        {html && (
          <section className="debrief-body" style={{ marginBottom: 22, fontSize: 14, lineHeight: 1.55, color: '#333' }}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </section>
        )}

        <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', border: '1px solid #d8d4ca', borderRadius: 6,
              background: '#fff', cursor: 'pointer', fontSize: 14, color: '#666',
            }}
          >
            Close
          </button>
          <button
            onClick={() => { startScenario(scenario.id); onClose() }}
            style={{
              padding: '9px 18px', border: '1px solid #1a5276', borderRadius: 6,
              background: '#1a5276', cursor: 'pointer', fontSize: 14,
              color: '#fff', fontWeight: 600,
            }}
          >
            Replay scenario
          </button>
        </footer>
      </div>
    </div>
  )
}

export default DebriefView
