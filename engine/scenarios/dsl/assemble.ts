import { stringify } from 'yaml'
import type { ScenarioSpec } from './schema'

export function assembleMarkdown(spec: ScenarioSpec, debriefBody: string): string {
  const frontmatter = stringify(spec, { lineWidth: 0 })
  const body = debriefBody.trim()
  return `---\n${frontmatter}---\n${body ? `\n${body}\n` : ''}`
}
