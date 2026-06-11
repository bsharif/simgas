import type { FC } from 'react'
import type { InterventionEvent } from '../../../engine/physiology'
import type { ScenarioRubric } from '../../../engine/scenario'
import { evaluateRubric, findRepeatedActions } from '../../../engine/rubric'
import { actionLabel, formatClock, OUTCOME_PRESENTATION } from './summaryExport'

/**
 * Structured assessment section of the debrief (review Phase 2/3). Shows the
 * scenario's critical / supporting / dangerous actions against what the
 * learner actually did, with time-to-action metrics and an overall outcome.
 */

interface RubricReportProps {
  rubric: ScenarioRubric
  interventionEvents: readonly InterventionEvent[]
}

const STATUS_PRESENTATION = {
  done: { symbol: '✓', color: '#1a6e4c' },
  late: { symbol: '⚠', color: '#9c6500' },
  missed: { symbol: '✗', color: '#cc0000' },
  performed: { symbol: '⚠', color: '#cc0000' },
  avoided: { symbol: '✓', color: '#1a6e4c' },
} as const

const RubricReport: FC<RubricReportProps> = ({ rubric, interventionEvents }) => {
  const assessment = evaluateRubric(rubric, interventionEvents)
  const repeated = findRepeatedActions(interventionEvents)
  const outcome = OUTCOME_PRESENTATION[assessment.outcome]

  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Assessment
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{
          padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700,
          color: outcome.color, background: outcome.background,
        }}>
          {outcome.text}
        </span>
        <span style={{ fontSize: 13, color: '#666' }}>
          Critical actions: {assessment.criticalDone + assessment.criticalLate}/{assessment.criticalTotal}
          {assessment.criticalLate > 0 && ` (${assessment.criticalLate} late)`}
        </span>
        {assessment.timeToFirstCriticalSec !== null && (
          <span style={{ fontSize: 13, color: '#666' }}>
            First critical action at {formatClock(assessment.timeToFirstCriticalSec)}
          </span>
        )}
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {assessment.expected.map((result, index) => {
          const status = STATUS_PRESENTATION[result.status]
          return (
            <li key={`${result.action.id}-${index}`} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0f0ea', fontSize: 13 }}>
              <span style={{ color: status.color, fontWeight: 700, width: 16 }}>{status.symbol}</span>
              <span style={{ flex: 1 }}>
                <strong style={{ color: '#333' }}>{actionLabel(result.action.id, result.action.label)}</strong>
                {result.kind === 'supporting' && <span style={{ color: '#999', marginLeft: 6, fontSize: 11 }}>supporting</span>}
                {result.action.rationale && (
                  <span style={{ display: 'block', color: '#888', fontSize: 12 }}>{result.action.rationale}</span>
                )}
              </span>
              <span style={{ color: status.color, whiteSpace: 'nowrap' }}>
                {result.status === 'missed' && 'Missed'}
                {result.status === 'done' && result.firstAtSec !== null && `Done ${formatClock(result.firstAtSec)}`}
                {result.status === 'late' && result.firstAtSec !== null &&
                  `Late ${formatClock(result.firstAtSec)}${result.action.within_sec !== undefined ? ` (target ${formatClock(result.action.within_sec)})` : ''}`}
              </span>
            </li>
          )
        })}
        {assessment.dangerous.filter(result => result.status === 'performed').map((result, index) => (
          <li key={`dangerous-${result.action.id}-${index}`} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #f0f0ea', fontSize: 13 }}>
            <span style={{ color: '#cc0000', fontWeight: 700, width: 16 }}>⚠</span>
            <span style={{ flex: 1 }}>
              <strong style={{ color: '#cc0000' }}>{actionLabel(result.action.id, result.action.label)}</strong>
              <span style={{ color: '#999', marginLeft: 6, fontSize: 11 }}>potentially harmful here</span>
              {result.action.rationale && (
                <span style={{ display: 'block', color: '#888', fontSize: 12 }}>{result.action.rationale}</span>
              )}
            </span>
            <span style={{ color: '#cc0000', whiteSpace: 'nowrap' }}>
              {result.firstAtSec !== null && `At ${formatClock(result.firstAtSec)}`}
            </span>
          </li>
        ))}
      </ul>

      {repeated.length > 0 && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          Repeated actions worth discussing:{' '}
          {repeated.map(note => `${actionLabel(note.id)} × ${note.count}`).join(', ')}
        </p>
      )}

      {(rubric.references?.length || rubric.guideline_version || rubric.last_reviewed) && (
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>
          {rubric.references?.length ? `References: ${rubric.references.join('; ')}. ` : ''}
          {rubric.guideline_version ? `Guideline: ${rubric.guideline_version}. ` : ''}
          {rubric.last_reviewed ? `Last clinical review: ${rubric.last_reviewed}.` : ''}
        </p>
      )}
    </section>
  )
}

export default RubricReport
