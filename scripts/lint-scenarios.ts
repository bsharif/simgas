#!/usr/bin/env tsx
/**
 * Scenario lint CLI. Validates every `.md` under /scenarios/ beyond the Zod
 * schema:
 *   - all intervention ids referenced in hints_if_missing exist in INTERVENTIONS
 *   - every predicate parses cleanly (caught by parsePredicate)
 *   - predicates only use known variables and functions
 *   - any()/count() globs match at least one known intervention id
 *   - phase_done() references a phase id defined in the scenario
 *   - rubric action ids (critical/supporting/dangerous) match known interventions
 *   - no duplicate timed event timestamps within a phase
 *   - no shadowed phases (a later phase with no enter_when permanently wins)
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
import {
  inspectPredicate,
  matchesGlob,
  KNOWN_PREDICATE_FUNCTIONS,
  KNOWN_PREDICATE_VARIABLES,
} from '../engine/scenarios/dsl/predicate'
import { INTERVENTIONS } from '../engine/interventions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCENARIO_DIR = join(ROOT, 'scenarios')

const interventionIds = new Set(INTERVENTIONS.map(i => i.id))

interface Issue {
  file: string
  message: string
}

/**
 * Critical actions that operate through machine state rather than an
 * intervention id in any()/count(). A scenario "uses" these when the mapped
 * predicate variable appears anywhere in its phase predicates.
 */
const MACHINE_STATE_VARS: Record<string, string> = {
  'increase-fio2': 'fio2',
  'increase-rr': 'rr',
  'increase-tv': 'vt',
  'peep-up': 'peep',
  'manual-vent': 'manual_vent',
  'intubate': 'tube_position',
  're-intubate': 'tube_position',
  'extubate': 'tube_position',
}

/**
 * Pure communication/recording actions: legitimately rubric-only, never
 * gating physiology or completion.
 */
const TEACHING_ONLY_ACTIONS = new Set(['call-help'])

function idsMatchingGlob(glob: string): Set<string> {
  return new Set([...interventionIds].filter(id => matchesGlob(glob, id)))
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
  const phaseIds = new Set(spec.phases.map(phase => phase.id))

  // An intervention reference may be a glob; it must match at least one
  // known intervention id to be meaningful.
  const checkInterventionRef = (ref: string, where: string): void => {
    const alternatives = ref.split('|').map(part => part.trim())
    for (const glob of alternatives) {
      if (![...interventionIds].some(id => matchesGlob(glob, id))) {
        issues.push({ file: filePath, message: `${where}: '${glob}' matches no known intervention id` })
      }
    }
  }

  // Rubric actions must reference real interventions.
  for (const [kind, actions] of [
    ['critical_actions', spec.critical_actions],
    ['supporting_actions', spec.supporting_actions],
    ['dangerous_actions', spec.dangerous_actions],
  ] as const) {
    for (const action of actions ?? []) {
      checkInterventionRef(action.id, `${spec.id}.${kind}`)
    }
  }

  let anyTerminal = false

  for (const phase of spec.phases) {
    const here = `${spec.id}/${phase.id}`

    // Predicates must parse, use only known variables/functions, and
    // reference real intervention and phase ids.
    for (const [name, expr] of [
      ['enter_when', phase.enter_when],
      ['resolve_when', phase.resolve_when],
      ['fail_when', phase.fail_when],
    ] as const) {
      if (!expr) continue
      try {
        const info = inspectPredicate(expr)
        for (const variable of info.variables) {
          if (!KNOWN_PREDICATE_VARIABLES.has(variable)) {
            issues.push({ file: filePath, message: `${here}.${name}: unknown variable '${variable}'` })
          }
        }
        for (const fn of info.functions) {
          if (!KNOWN_PREDICATE_FUNCTIONS.has(fn)) {
            issues.push({ file: filePath, message: `${here}.${name}: unknown function '${fn}'` })
          }
        }
        for (const ref of info.interventionRefs) {
          checkInterventionRef(ref, `${here}.${name}`)
        }
        for (const ref of info.phaseRefs) {
          if (!phaseIds.has(ref)) {
            issues.push({ file: filePath, message: `${here}.${name}: phase_done('${ref}') references an unknown phase id` })
          }
        }
      } catch (err) {
        issues.push({ file: filePath, message: `${here}.${name}: ${(err as Error).message}` })
      }
    }

    // hints_if_missing keys must be real intervention ids.
    for (const id of Object.keys(phase.hints_if_missing ?? {})) {
      if (!interventionIds.has(id)) {
        issues.push({ file: filePath, message: `${here}.hints_if_missing: unknown intervention id '${id}'` })
      }
    }

    // Duplicate timed events at the same timestamp are almost always an
    // authoring slip (one will mask the other in the fired-set).
    const seenEventTimes = new Set<string>()
    for (const event of phase.events ?? []) {
      if (seenEventTimes.has(event.at)) {
        issues.push({ file: filePath, message: `${here}: duplicate timed event at ${event.at}` })
      }
      seenEventTimes.add(event.at)
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

  // Shadowed phases: selection is "last matching enter_when wins" and a
  // missing enter_when means "always matches". Any phase after the first
  // without an enter_when permanently shadows everything before it.
  for (let i = 1; i < spec.phases.length; i++) {
    if (!spec.phases[i].enter_when) {
      issues.push({
        file: filePath,
        message: `${spec.id}/${spec.phases[i].id}: phase after the first has no enter_when — it always wins and shadows all earlier phases`,
      })
    }
  }

  if (!anyTerminal) {
    issues.push({ file: filePath, message: `${spec.id}: no phase has resolve_when or fail_when — scenario can never end` })
  }

  return issues
}

/**
 * Rubric/completion consistency (warning, not error): a critical action the
 * debrief grades should normally also gate the phase machine — either via
 * any()/count() on its id, or via the machine-state variable it drives.
 * Catches "the rubric says X is critical but completion never requires it".
 */
function lintRubricConsistency(filePath: string): Issue[] {
  const warnings: Issue[] = []

  let parsed
  try {
    parsed = parseScenarioFile(readFileSync(filePath, 'utf8'), filePath)
  } catch {
    return warnings // parse errors already reported as errors
  }
  const { spec } = parsed

  // Gather every intervention ref and variable used across all predicates.
  const usedRefs: string[] = []
  const usedVariables = new Set<string>()
  for (const phase of spec.phases) {
    for (const expr of [phase.enter_when, phase.resolve_when, phase.fail_when]) {
      if (!expr) continue
      try {
        const info = inspectPredicate(expr)
        usedRefs.push(...info.interventionRefs)
        for (const variable of info.variables) usedVariables.add(variable)
      } catch {
        // already reported
      }
    }
  }
  const usedIdSets = usedRefs.map(idsMatchingGlob)

  for (const action of spec.critical_actions ?? []) {
    const alternatives = action.id.split('|').map(part => part.trim())
    const covered = alternatives.some(alt => {
      if (TEACHING_ONLY_ACTIONS.has(alt)) return true
      const mappedVar = MACHINE_STATE_VARS[alt]
      if (mappedVar && usedVariables.has(mappedVar)) return true
      const actionIds = idsMatchingGlob(alt)
      return usedIdSets.some(usedSet => [...actionIds].some(id => usedSet.has(id)))
    })
    if (!covered) {
      warnings.push({
        file: filePath,
        message: `${spec.id}: critical action '${action.id}' is graded in the rubric but never appears in any phase predicate — completion does not require it`,
      })
    }
  }

  return warnings
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
  const allWarnings: Issue[] = []
  const seenScenarioIds = new Set<string>()
  const fileToId = new Map<string, string>()

  for (const f of scenarioFiles) {
    const filePath = join(SCENARIO_DIR, f)
    const issues = lintFile(filePath)
    allWarnings.push(...lintRubricConsistency(filePath))

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

  if (allWarnings.length > 0) {
    console.warn(`⚠ ${allWarnings.length} rubric consistency warning(s):\n`)
    for (const w of allWarnings) {
      console.warn(`  ${w.file}`)
      console.warn(`    ${w.message}\n`)
    }
  }

  if (allIssues.length === 0) {
    console.log(`✓ ${scenarioFiles.length} scenario file(s) OK${allWarnings.length > 0 ? ` (${allWarnings.length} warning(s))` : ''}`)
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
