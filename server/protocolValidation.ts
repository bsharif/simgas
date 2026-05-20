import { z } from 'zod'
import type { ClientMessage, ErrorCode } from '../shared/protocol'

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; code: ErrorCode }

const MAX_MESSAGE_BYTES = 20_000
const sessionCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/)
const nonBlankString = z.string().trim().min(1)
const idSchema = z.string().trim().min(1)

const machineSettingsSchema = z.object({
  fio2: z.number().optional(),
  vt: z.number().optional(),
  peep: z.number().optional(),
  gasFlow: z.number().optional(),
  rr: z.number().optional(),
  sevoflurane: z.number().optional(),
  ventilationMode: z.enum(['ventilator', 'manual']).optional(),
}).strict()

const nibpSchema = z.object({
  sys: z.number().optional(),
  dia: z.number().optional(),
  map: z.number().optional(),
}).strict()

const overrideValuesSchema = z.object({
  hr: z.number().optional(),
  spo2: z.number().optional(),
  etco2: z.number().optional(),
  rr: z.number().optional(),
  temp: z.number().optional(),
  ecgRhythm: z.enum(['sinus', 'vf', 'vt', 'asystole', 'svt']).optional(),
  nibp: nibpSchema.optional(),
}).strict()

const clientMessageSchemas = [
  z.object({ type: z.literal('create_session'), name: nonBlankString, scenarioId: idSchema }).strict(),
  z.object({ type: z.literal('join_session'), sessionCode: sessionCodeSchema, name: nonBlankString }).strict(),
  z.object({ type: z.literal('reconnect'), sessionCode: sessionCodeSchema, token: nonBlankString }).strict(),
  z.object({ type: z.literal('start_scenario'), scenarioId: idSchema }).strict(),
  z.object({ type: z.literal('intervene'), interventionId: idSchema }).strict(),
  z.object({ type: z.literal('update_machine_settings'), settings: machineSettingsSchema }).strict(),
  z.object({ type: z.literal('set_manual_ventilation'), active: z.boolean() }).strict(),
  z.object({
    type: z.literal('override'),
    mode: z.enum(['set_now', 'set_target']),
    values: overrideValuesSchema,
  }).strict(),
  z.object({ type: z.literal('clear_trainer_overrides') }).strict(),
  z.object({ type: z.literal('advance_phase'), phaseId: idSchema }).strict(),
  z.object({ type: z.literal('clear_forced_phase') }).strict(),
  z.object({ type: z.literal('inject_event'), text: z.string().max(300) }).strict(),
  z.object({ type: z.literal('pause') }).strict(),
  z.object({ type: z.literal('resume') }).strict(),
  z.object({ type: z.literal('end_session') }).strict(),
] as const

const ClientMessageSchema = z.union(clientMessageSchemas)
const knownTypes: ReadonlySet<string> = new Set(clientMessageSchemas.map(schema => schema.shape.type.value))

export function parseClientMessage(raw: string): ParseResult {
  if (raw.length > MAX_MESSAGE_BYTES) {
    return { ok: false, code: 'message_too_large' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'bad_json' }
  }

  const result = ClientMessageSchema.safeParse(parsed)
  if (!result.success) {
    const type = typeof parsed === 'object' && parsed !== null && 'type' in parsed
      ? String((parsed as { type: unknown }).type)
      : ''
    return {
      ok: false,
      code: knownTypes.has(type) ? 'invalid_payload' : 'unknown_message_type',
    }
  }

  return { ok: true, message: result.data }
}
