import type { InterventionEvent } from '../../../engine/physiology'
import type { ScenarioRubric } from '../../../engine/scenario'
import { evaluateRubric, type RubricAssessment } from '../../../engine/rubric'
import { INTERVENTION_MAP } from '../../../engine/interventions'

/** Shared debrief helpers (kept out of the .tsx files for fast-refresh). */

export function actionLabel(id: string, label?: string): string {
  if (label) return label
  return INTERVENTION_MAP.get(id)?.label ?? id
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const OUTCOME_PRESENTATION: Record<RubricAssessment['outcome'], { text: string; color: string; background: string }> = {
  'achieved': { text: 'Objectives achieved', color: '#1a6e4c', background: '#ecf6f0' },
  'partially-achieved': { text: 'Partially achieved', color: '#9c6500', background: '#fdf6e3' },
  'not-achieved': { text: 'Not achieved', color: '#cc0000', background: '#fbecec' },
}

/**
 * Plain-markdown session summary for teaching records (review Phase 3:
 * "Trainers can export or copy a session summary").
 */
export function exportRubricSummary(
  scenarioLabel: string,
  outcome: 'resolved' | 'failed',
  rubric: ScenarioRubric | undefined,
  interventionEvents: readonly InterventionEvent[],
): string {
  const lines: string[] = [
    `# SimGas session summary — ${scenarioLabel}`,
    '',
    `Outcome: ${outcome === 'resolved' ? 'Scenario complete' : 'Scenario failed'}`,
    '',
  ]
  if (rubric) {
    const assessment = evaluateRubric(rubric, interventionEvents)
    lines.push(`Assessment: ${OUTCOME_PRESENTATION[assessment.outcome].text}`)
    if (assessment.timeToFirstCriticalSec !== null) {
      lines.push(`Time to first critical action: ${formatClock(assessment.timeToFirstCriticalSec)}`)
    }
    lines.push('', '## Critical and supporting actions', '')
    for (const result of assessment.expected) {
      const name = actionLabel(result.action.id, result.action.label)
      const when = result.firstAtSec !== null ? ` at ${formatClock(result.firstAtSec)}` : ''
      const target = result.action.within_sec !== undefined ? ` (target ${formatClock(result.action.within_sec)})` : ''
      lines.push(`- [${result.status === 'missed' ? ' ' : 'x'}] ${name} — ${result.status}${when}${target}`)
    }
    if (assessment.dangerous.length > 0) {
      lines.push('', '## Dangerous actions', '')
      for (const result of assessment.dangerous) {
        const name = actionLabel(result.action.id, result.action.label)
        lines.push(`- ${name}: ${result.status}${result.firstAtSec !== null ? ` at ${formatClock(result.firstAtSec)}` : ''}`)
      }
    }
  }
  lines.push('', '## Action timeline', '')
  for (const event of interventionEvents) {
    if (event.id === 'manual-vent') continue
    lines.push(`- ${formatClock(event.atSec)} — ${actionLabel(event.id)}`)
  }
  return lines.join('\n')
}
