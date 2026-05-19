import type { Scenario } from '../scenario'
import { parseScenarioFile } from './dsl/parse'
import { specToScenario } from './dsl/interpret'

/**
 * Scenarios live as `.md` files under `/scenarios` at the repo root. Vite's
 * `import.meta.glob` bundles their raw text at build time; vitest resolves the
 * same paths at test time. Adding a new scenario is just dropping a new `.md`
 * file there — no code changes required.
 */
const rawModules = import.meta.glob('../../scenarios/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function loadAll(): Scenario[] {
  const scenarios: Scenario[] = []
  for (const [path, source] of Object.entries(rawModules)) {
    try {
      const { spec, body } = parseScenarioFile(source, path)
      const scenario = specToScenario(spec)
      scenario.debriefBody = body
      scenarios.push(scenario)
    } catch (err) {
      // Fail loudly during module init so authors see the problem immediately.
      throw new Error(`Failed to load scenario ${path}:\n${(err as Error).message}`, { cause: err })
    }
  }
  // Stable order by id for predictable UI listing.
  scenarios.sort((a, b) => a.id.localeCompare(b.id))
  return scenarios
}

export const ALL_SCENARIOS: Scenario[] = loadAll()
export const SCENARIO_MAP = new Map<string, Scenario>(ALL_SCENARIOS.map(s => [s.id, s]))
