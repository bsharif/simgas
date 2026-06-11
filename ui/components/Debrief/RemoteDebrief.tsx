import type { FC, ReactNode } from 'react'
import type { ActionLogEntry, ScenarioMetadataMessage, SessionSummaryMessage } from '../../../shared/protocol'
import { renderDebriefMarkdown } from './markdown'
import RubricReport from './RubricReport'
import { exportRubricSummary } from './summaryExport'
import VitalsTimeline from './VitalsTimeline'

/**
 * Shared debrief for trainer-trainee sessions (review: "Remote mode lacks a
 * proper debrief"). Both roles see the outcome, rubric assessment, timeline
 * replay, and the scenario's teaching content. The trainer additionally sees
 * the attributed action timeline, their notes/teaching moments, and group
 * controls (open for everyone, restart) provided via `trainerExtras`.
 */

interface RemoteDebriefProps {
  metadata: ScenarioMetadataMessage
  summary: SessionSummaryMessage
  /** Attributed action log — pass only on the trainer side. */
  actionLog?: ActionLogEntry[]
  trainerExtras?: ReactNode
  onClose: () => void
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const RemoteDebrief: FC<RemoteDebriefProps> = ({ metadata, summary, actionLog, trainerExtras, onClose }) => {
  const failed = summary.outcome === 'failed'
  const html = metadata.debriefBody ? renderDebriefMarkdown(metadata.debriefBody) : ''
  const notes = (actionLog ?? []).filter(entry => entry.kind === 'note' || entry.kind === 'teaching-moment')
  const actions = (actionLog ?? []).filter(entry => entry.kind !== 'note' && entry.kind !== 'teaching-moment')

  return (
    <div
      role="dialog"
      aria-label="Session debrief"
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
            <h1 style={{ margin: 0, fontSize: 24 }}>{metadata.label}</h1>
            {metadata.description && (
              <p style={{ margin: '6px 0 0', color: '#666', fontSize: 14 }}>{metadata.description}</p>
            )}
            {metadata.qrh && (
              <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12 }}>QRH reference: {metadata.qrh}</p>
            )}
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

        {metadata.rubric?.learning_objectives && metadata.rubric.learning_objectives.length > 0 && (
          <section style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Learning objectives
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#333', lineHeight: 1.6 }}>
              {metadata.rubric.learning_objectives.map((objective, index) => (
                <li key={index}>{objective}</li>
              ))}
            </ul>
          </section>
        )}

        {metadata.rubric && (
          <RubricReport rubric={metadata.rubric} interventionEvents={summary.interventionEvents} />
        )}

        {summary.vitalsHistory.length > 1 && (
          <section style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Timeline replay
            </h2>
            <VitalsTimeline history={summary.vitalsHistory} interventions={summary.interventionEvents} />
          </section>
        )}

        {actions.length > 0 && (
          <section style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Who did what
            </h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 220, overflowY: 'auto' }}>
              {actions.map((entry, index) => (
                <li key={index} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0ea' }}>
                  <span style={{ color: '#999', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatClock(entry.atSec)}</span>
                  <strong style={{ color: '#1a5276', whiteSpace: 'nowrap' }}>{entry.actorName}</strong>
                  <span style={{ color: '#444' }}>{entry.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.length > 0 && (
          <section style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Trainer notes & teaching moments
            </h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {notes.map((entry, index) => (
                <li key={index} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0ea' }}>
                  <span style={{ color: '#999', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatClock(entry.atSec)}</span>
                  <span style={{ color: entry.kind === 'teaching-moment' ? '#9c6500' : '#444' }}>
                    {entry.kind === 'teaching-moment' ? '★ ' : ''}{entry.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {html && (
          <section className="debrief-body" style={{ marginBottom: 22, fontSize: 14, lineHeight: 1.55, color: '#333' }}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </section>
        )}

        <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {actionLog && (
            <button
              onClick={() => {
                const lines = exportRubricSummary(metadata.label, summary.outcome, metadata.rubric, summary.interventionEvents)
                const attributed = [
                  '',
                  '## Attributed actions',
                  '',
                  ...actions.map(entry => `- ${formatClock(entry.atSec)} — ${entry.actorName}: ${entry.text}`),
                  ...(notes.length > 0
                    ? ['', '## Trainer notes', '', ...notes.map(entry => `- ${formatClock(entry.atSec)} — ${entry.kind === 'teaching-moment' ? '★ ' : ''}${entry.text}`)]
                    : []),
                ]
                void navigator.clipboard?.writeText(lines + attributed.join('\n'))
              }}
              style={{
                padding: '9px 18px', border: '1px solid #d8d4ca', borderRadius: 6,
                background: '#fff', cursor: 'pointer', fontSize: 14, color: '#666',
              }}
            >
              Copy session summary
            </button>
          )}
          {trainerExtras}
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', border: '1px solid #d8d4ca', borderRadius: 6,
              background: '#fff', cursor: 'pointer', fontSize: 14, color: '#666',
            }}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}

export default RemoteDebrief
