import { z } from 'zod'

/**
 * Zod schema for SimGas scenario YAML frontmatter (Phase 2).
 *
 * Format: a `.md` file with YAML frontmatter and a markdown body. The
 * frontmatter defines the deterministic behaviour (phases, baselines,
 * predicates, terminal conditions). The markdown body is used as debrief
 * content in Phase 3's DebriefView.
 */

const DurationStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?\s*s$/, { message: "duration must look like '30s' or '1.5s'" })

const NibpSchema = z
  .object({
    sys: z.number().optional(),
    dia: z.number().optional(),
    map: z.number().optional(),
  })
  .strict()

const BaselineSchema = z
  .object({
    hr: z.number().optional(),
    spo2: z.number().optional(),
    etco2: z.number().optional(),
    rr: z.number().optional(),
    temp: z.number().optional(),
    nibp: NibpSchema.optional(),
  })
  .strict()

/**
 * A "snap" sets state instantly (used for initial state and terminal
 * resolutions). Adds non-drift fields like ecgRhythm and tubePosition.
 */
const SnapSchema = BaselineSchema.extend({
  ecgRhythm: z.enum(['sinus', 'vf', 'vt', 'asystole', 'svt']).optional(),
  tubePosition: z.enum(['none', 'trachea', 'oesophagus']).optional(),
  fio2: z.number().optional(),
  sevoflurane: z.number().optional(),
}).strict()

const PhaseEventSchema = z
  .object({
    at: DurationStringSchema,
    text: z.string(),
  })
  .strict()

const PhaseSchema = z
  .object({
    id: z.string(),
    /** Predicate string. Default is "true" (this phase always wants to be active). */
    enter_when: z.string().optional(),
    /** Drift targets applied while this phase is active. */
    baseline: BaselineSchema.optional(),
    /** Timed events relative to phase entry. */
    events: z.array(PhaseEventSchema).optional().default([]),
    /** Predicate; if true, scenario resolves. Typical: "phase_elapsed > 60". */
    resolve_when: z.string().optional(),
    resolve_events: z.array(z.string()).optional().default([]),
    resolve_snap: SnapSchema.optional(),
    /** Predicate; if true, scenario fails. */
    fail_when: z.string().optional(),
    fail_events: z.array(z.string()).optional().default([]),
    fail_snap: SnapSchema.optional(),
    /** intervention-id → hint shown if the user hasn't applied it yet in this phase. */
    hints_if_missing: z.record(z.string(), z.string()).optional().default({}),
  })
  .strict()

export const ScenarioSpecSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    hints: z.array(z.string()).optional().default([]),
    /** Vitals + non-drift state set instantly when the scenario starts. */
    initial_state: SnapSchema.optional(),
    /** Initial drift targets. */
    initial_baseline: BaselineSchema.optional(),
    phases: z.array(PhaseSchema).min(1),
  })
  .strict()

export type ScenarioSpec = z.infer<typeof ScenarioSpecSchema>
export type PhaseSpec = z.infer<typeof PhaseSchema>
export type PhaseEvent = z.infer<typeof PhaseEventSchema>
export type Snap = z.infer<typeof SnapSchema>
export type Baseline = z.infer<typeof BaselineSchema>

/**
 * Parse a duration string like "30s" or "1.5s" into seconds.
 */
export function parseDurationSec(s: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*s$/.exec(s)
  if (!match) throw new Error(`invalid duration: ${JSON.stringify(s)}`)
  return parseFloat(match[1])
}
