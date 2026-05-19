import { describe, it, expect } from 'vitest'
import { assembleMarkdown } from './assemble'
import { parseScenarioFile } from './parse'

const MINIMAL_SPEC = {
  id: 'test-scenario',
  label: 'Test Scenario',
  description: 'A test scenario',
  difficulty: 'easy' as const,
  hints: [],
  phases: [{
    id: 'onset',
    events: [],
    resolve_events: [],
    fail_events: [],
    hints_if_missing: {},
    resolve_when: 'time > 10',
  }],
}

describe('assembleMarkdown', () => {
  it('round-trips through parseScenarioFile', () => {
    const md = assembleMarkdown(MINIMAL_SPEC, '# Debrief\n\nSome text.')
    const { spec, body } = parseScenarioFile(md, '<test>')
    expect(spec.id).toBe('test-scenario')
    expect(spec.difficulty).toBe('easy')
    expect(spec.phases).toHaveLength(1)
    expect(spec.phases[0].resolve_when).toBe('time > 10')
    expect(body).toBe('# Debrief\n\nSome text.')
  })

  it('handles empty debrief body', () => {
    const md = assembleMarkdown(MINIMAL_SPEC, '')
    expect(() => parseScenarioFile(md, '<test>')).not.toThrow()
  })

  it('preserves phase baselines and snaps', () => {
    const spec = {
      ...MINIMAL_SPEC,
      initial_baseline: { hr: 130, spo2: 88 },
      phases: [{
        ...MINIMAL_SPEC.phases[0],
        baseline: { hr: 155, spo2: 70 },
        fail_when: 'phase_elapsed > 60',
        fail_snap: { ecgRhythm: 'asystole' as const },
      }],
    }
    const { spec: parsed } = parseScenarioFile(assembleMarkdown(spec, ''), '<test>')
    expect(parsed.initial_baseline?.hr).toBe(130)
    expect(parsed.phases[0].baseline?.hr).toBe(155)
    expect(parsed.phases[0].fail_snap?.ecgRhythm).toBe('asystole')
  })
})
