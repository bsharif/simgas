#!/usr/bin/env tsx
/**
 * Scenario lint CLI. Validates every `.md` under /scenarios/ beyond the Zod
 * schema:
 *   - all intervention ids referenced in hints_if_missing exist in INTERVENTIONS
 *   - every predicate parses cleanly (caught by compilePredicate)
 *   - no duplicate scenario ids
 *   - no duplicate phase ids within a scenario
 *   - every phase has either a baseline or a terminal predicate (otherwise
 *     it's a dead phase that does nothing)
 *   - at least one phase can resolve or fail (otherwise the scenario can't end)
 *
 * Exits non-zero on any error. Wire into CI via `npm run lint:scenarios`.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseScenarioFile } from '../engine/scenarios/dsl/parse'
import { parsePredicate } from '../engine/scenarios/dsl/predicate'
import { INTERVENTIONS } from '../engine/interventions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCENARIO_DIR = join(ROOT, 'scenarios')

const interventionIds = new Set(INTERVENTIONS.map(i => i.id))

interface Issue {
  file: string
  message: string
}

function lintFile(filePath: string): Issue[] {
  const issues: Issue[] = []
  const source = readFileSync(filePath, 'utf8')

  let parsed
  try {
    parsed = parseScenarioFile(source, filePath)
  } catch (err) {
    issues.push({ file: filePath, message: (err as Error).message })
    return issues
  }

  const { spec } = parsed

  // Phase ids unique within scenario.
  const seenPhaseIds = new Set<string>()
  for (const phase of spec.phases) {
    if (seenPhaseIds.has(phase.id)) {
      issues.push({ file: filePath, message: `duplicate phase id: ${phase.id}` })
    }
    seenPhaseIds.add(phase.id)
  }

  let anyTerminal = false

  for (const phase of spec.phases) {
    const here = `${spec.id}/${phase.id}`

    // Predicates must parse (they were already parsed by specToScenario in
    // load, but the lint CLI runs on raw .md so we double-check here).
    for (const [name, expr] of [
      ['enter_when', phase.enter_when],
      ['resolve_when', phase.resolve_when],
      ['fail_when', phase.fail_when],
    ] as const) {
      if (!expr) continue
      try { parsePredicate(expr) } catch (err) {
        issues.push({ file: filePath, message: `${here}.${name}: ${(err as Error).message}` })
      }
    }

    // hints_if_missing keys must be real intervention ids.
    for (const id of Object.keys(phase.hints_if_missing ?? {})) {
      if (!interventionIds.has(id)) {
        issues.push({ file: filePath, message: `${here}.hints_if_missing: unknown intervention id '${id}'` })
      }
    }

    // Phase must do something — either drive vitals or be terminal.
    const hasBaseline = !!phase.baseline
    const hasResolve = !!phase.resolve_when
    const hasFail = !!phase.fail_when
    const hasEvents = (phase.events ?? []).length > 0
    if (!hasBaseline && !hasResolve && !hasFail && !hasEvents) {
      issues.push({ file: filePath, message: `${here}: phase has no baseline, events, or terminal conditions — does nothing` })
    }

    if (hasResolve || hasFail) anyTerminal = true
  }

  if (!anyTerminal) {
    issues.push({ file: filePath, message: `${spec.id}: no phase has resolve_when or fail_when — scenario can never end` })
  }

  return issues
}

function main(): void {
  let scenarioFiles: string[]
  try {
    scenarioFiles = readdirSync(SCENARIO_DIR).filter(f => f.endsWith('.md'))
  } catch (err) {
    console.error(`could not read ${SCENARIO_DIR}: ${(err as Error).message}`)
    process.exit(2)
  }

  if (scenarioFiles.length === 0) {
    console.error(`no scenarios found in ${SCENARIO_DIR}`)
    process.exit(2)
  }

  const allIssues: Issue[] = []
  const seenScenarioIds = new Set<string>()
  const fileToId = new Map<string, string>()

  for (const f of scenarioFiles) {
    const filePath = join(SCENARIO_DIR, f)
    const issues = lintFile(filePath)

    // Try to read the id even if there were issues, for the dup check.
    try {
      const { spec } = parseScenarioFile(readFileSync(filePath, 'utf8'), filePath)
      if (seenScenarioIds.has(spec.id)) {
        allIssues.push({ file: filePath, message: `duplicate scenario id '${spec.id}' also seen in ${fileToId.get(spec.id) ?? '?'}` })
      } else {
        seenScenarioIds.add(spec.id)
        fileToId.set(spec.id, filePath)
      }
    } catch {
      // already reported by lintFile
    }

    allIssues.push(...issues)
  }

  if (allIssues.length === 0) {
    console.log(`✓ ${scenarioFiles.length} scenario file(s) OK`)
    return
  }

  console.error(`✗ ${allIssues.length} scenario lint issue(s):\n`)
  for (const i of allIssues) {
    console.error(`  ${i.file}`)
    console.error(`    ${i.message}\n`)
  }
  process.exit(1)
}

main()
