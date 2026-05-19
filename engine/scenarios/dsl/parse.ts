import { parse as parseYaml } from 'yaml'
import { ScenarioSpecSchema, type ScenarioSpec } from './schema'

export interface ParsedScenario {
  /** The validated spec from the YAML frontmatter. */
  spec: ScenarioSpec
  /** The markdown body (used by the debrief view in Phase 3). */
  body: string
}

/**
 * Split a `---\n...frontmatter...\n---\n...body...` string. We roll this
 * ourselves rather than pulling in `gray-matter`, which uses `eval()` in a
 * code path the bundler warns about even when unused.
 */
function splitFrontmatter(source: string): { frontmatter: string; body: string } | null {
  // Strip an optional BOM (U+FEFF) before the opening fence.
  const stripped = source.replace(/^\ufeff/, '')
  const fenceRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
  const match = fenceRe.exec(stripped)
  if (!match) return null
  return { frontmatter: match[1], body: match[2] ?? '' }
}

/**
 * Parse a `.md` scenario file into a validated ScenarioSpec + body.
 * Errors are descriptive (file path + field path + reason).
 *
 * @param source Raw file contents.
 * @param sourcePath For error messages.
 */
export function parseScenarioFile(source: string, sourcePath = '<inline>'): ParsedScenario {
  const split = splitFrontmatter(source)
  if (!split) {
    throw new Error(`${sourcePath}: missing or invalid YAML frontmatter (expected ---/---)`)
  }

  let data: unknown
  try {
    data = parseYaml(split.frontmatter)
  } catch (err) {
    throw new Error(`${sourcePath}: YAML parse error: ${(err as Error).message}`, { cause: err })
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${sourcePath}: frontmatter must be a YAML mapping`)
  }

  const result = ScenarioSpecSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`${sourcePath}: scenario schema validation failed:\n${issues}`)
  }

  return {
    spec: result.data,
    body: split.body.trim(),
  }
}
