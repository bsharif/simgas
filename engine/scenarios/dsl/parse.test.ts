import { describe, it, expect } from 'vitest'
import { parseScenarioFile } from './parse'

const VALID = `---
id: test
label: Test
description: A test scenario
difficulty: medium
initial_state:
  hr: 100
  spo2: 95
hints:
  - One
  - Two
phases:
  - id: onset
    baseline:
      hr: 130
  - id: recovery
    enter_when: "any('adrenaline-*')"
    baseline:
      hr: 85
    resolve_when: "phase_elapsed > 60"
    resolve_events:
      - "✓ Recovered"
---

# Body

Lorem ipsum.
`

describe('parseScenarioFile', () => {
  it('parses valid frontmatter and body', () => {
    const { spec, body } = parseScenarioFile(VALID, 'test.md')
    expect(spec.id).toBe('test')
    expect(spec.label).toBe('Test')
    expect(spec.difficulty).toBe('medium')
    expect(spec.hints).toEqual(['One', 'Two'])
    expect(spec.phases).toHaveLength(2)
    expect(spec.phases[0].baseline?.hr).toBe(130)
    expect(spec.phases[1].enter_when).toBe("any('adrenaline-*')")
    expect(body).toContain('Lorem ipsum')
  })

  it('rejects missing required fields with helpful errors', () => {
    const missing = `---
label: No id
description: x
difficulty: easy
phases: []
---
`
    expect(() => parseScenarioFile(missing, 'bad.md')).toThrow(/schema validation failed/)
  })

  it('rejects invalid difficulty enum', () => {
    const bad = `---
id: x
label: x
description: x
difficulty: extreme
phases:
  - id: only
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow(/difficulty/)
  })

  it('rejects invalid duration format', () => {
    const bad = `---
id: x
label: x
description: x
difficulty: easy
phases:
  - id: only
    events:
      - at: "30 seconds"
        text: "..."
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow(/duration must look like/)
  })

  it('rejects unknown top-level keys (strict schema)', () => {
    const bad = `---
id: x
label: x
description: x
difficulty: easy
phases:
  - id: only
ham: cheese
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow(/schema validation failed/)
  })

  it('requires at least one phase', () => {
    const bad = `---
id: x
label: x
description: x
difficulty: easy
phases: []
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow()
  })

  it('rejects body-only files with a frontmatter error', () => {
    expect(() => parseScenarioFile('# just a body', 'nope.md'))
      .toThrow(/missing or invalid YAML frontmatter/)
  })

  it('rejects YAML syntax errors with parse error', () => {
    const bad = `---
id: x
label: x: this is invalid: yaml
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow(/YAML parse error/)
  })

  it('rejects frontmatter that is not a mapping', () => {
    const bad = `---
- just
- a
- list
---
`
    expect(() => parseScenarioFile(bad, 'x.md')).toThrow(/frontmatter must be a YAML mapping/)
  })
})
