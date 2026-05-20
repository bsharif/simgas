import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Scenario } from '../engine/scenario'
import { specToScenario } from '../engine/scenarios/dsl/interpret'
import { parseScenarioFile } from '../engine/scenarios/dsl/parse'
import { parseDurationSec, type ScenarioSpec } from '../engine/scenarios/dsl/schema'
import type { ScenarioMetadataMessage } from '../shared/protocol'

export interface ServerScenario {
  scenario: Scenario
  spec: ScenarioSpec
  debriefBody: string
  metadata: ScenarioMetadataMessage
}

function toMetadata(spec: ScenarioSpec): ScenarioMetadataMessage {
  return {
    type: 'scenario_metadata',
    scenarioId: spec.id,
    label: spec.label,
    phases: spec.phases.map(phase => ({
      id: phase.id,
      enterWhen: phase.enter_when,
      resolveWhen: phase.resolve_when,
      failWhen: phase.fail_when,
      events: phase.events.map(event => ({
        atSec: parseDurationSec(event.at),
        text: event.text,
      })),
      baseline: phase.baseline,
      snap: phase.snap ?? phase.fail_snap ?? phase.resolve_snap,
    })),
  }
}

export function loadScenarios(rootDir = process.cwd()): ServerScenario[] {
  const scenariosDir = join(rootDir, 'scenarios')
  const entries = readdirSync(scenariosDir)
    .filter(entry => entry.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))

  return entries.map(entry => {
    const filePath = join(scenariosDir, entry)
    const source = readFileSync(filePath, 'utf8')
    const { spec, body } = parseScenarioFile(source, filePath)
    const scenario = specToScenario(spec)
    scenario.debriefBody = body

    return {
      scenario,
      spec,
      debriefBody: body,
      metadata: toMetadata(spec),
    }
  })
}
