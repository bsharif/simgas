import matter from 'gray-matter'
import { parse as parseYaml } from 'yaml'
import { ScenarioSpecSchema, type ScenarioSpec } from './schema'

export interface ParsedScenario {
  /** The validated spec from the YAML frontmatter. */
  spec: ScenarioSpec
  /** The markdown body (used by the debrief view in Phase 3). */
  body: string
}

/**
 * Parse a `.md` scenario file into a validated ScenarioSpec + body.
 * Errors are descriptive (file path + field path + reason).
 *
 * @param source Raw file contents.
 * @param sourcePath For error messages.
 */
export function parseScenarioFile(source: string, sourcePath = '<inline>'): ParsedScenario {
  // gray-matter's `engines.yaml.parse` defaults to js-yaml; we override with
  // the smaller `yaml` package for consistency with our other parsing.
  const parsed = matter(source, {
    engines: {
      yaml: {
        parse: (s: string) => parseYaml(s) as object,
        stringify: () => { throw new Error('not implemented') },
      },
    },
  })

  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new Error(`${sourcePath}: missing or invalid YAML frontmatter`)
  }

  const result = ScenarioSpecSchema.safeParse(parsed.data)
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`${sourcePath}: scenario schema validation failed:\n${issues}`)
  }

  return {
    spec: result.data,
    body: parsed.content.trim(),
  }
}
