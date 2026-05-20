import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './protocolValidation'

describe('parseClientMessage', () => {
  it('accepts a valid join message', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'join_session',
      sessionCode: '7K3M9P',
      name: 'John',
    }))).toEqual({
      ok: true,
      message: {
        type: 'join_session',
        sessionCode: '7K3M9P',
        name: 'John',
      },
    })
  })

  it('rejects malformed JSON', () => {
    expect(parseClientMessage('{')).toEqual({ ok: false, code: 'bad_json' })
  })

  it('rejects unknown message types', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'wat' }))).toEqual({
      ok: false,
      code: 'unknown_message_type',
    })
  })

  it('rejects long injected events', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'inject_event',
      text: 'x'.repeat(301),
    }))).toEqual({ ok: false, code: 'invalid_payload' })
  })

  it('accepts clear_forced_phase with an empty payload', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'clear_forced_phase' }))).toEqual({
      ok: true,
      message: { type: 'clear_forced_phase' },
    })
  })

  it('accepts each declared client message shape', () => {
    const messages = [
      { type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' },
      { type: 'reconnect', sessionCode: '7K3M9P', token: 'tok_123' },
      { type: 'start_scenario', scenarioId: 'anaphylaxis' },
      { type: 'intervene', interventionId: 'adrenaline-10mcg' },
      { type: 'update_machine_settings', settings: { fio2: 0.8, rr: 14 } },
      { type: 'set_manual_ventilation', active: true },
      { type: 'override', mode: 'set_now', values: { hr: 90, nibp: { sys: 110, dia: 70 } } },
      { type: 'clear_trainer_overrides' },
      { type: 'advance_phase', phaseId: 'recovery' },
      { type: 'pause' },
      { type: 'resume' },
      { type: 'end_session' },
    ]

    for (const message of messages) {
      expect(parseClientMessage(JSON.stringify(message))).toEqual({ ok: true, message })
    }
  })

  it('rejects invalid session codes and blank names', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'join_session',
      sessionCode: 'BAD!',
      name: 'John',
    }))).toEqual({ ok: false, code: 'invalid_payload' })

    expect(parseClientMessage(JSON.stringify({
      type: 'create_session',
      name: ' ',
      scenarioId: 'anaphylaxis',
    }))).toEqual({ ok: false, code: 'invalid_payload' })
  })

  it('rejects invalid override, machine settings, and manual ventilation payloads', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'override',
      mode: 'set_now',
      values: { hr: 'fast' },
    }))).toEqual({ ok: false, code: 'invalid_payload' })

    expect(parseClientMessage(JSON.stringify({
      type: 'update_machine_settings',
      settings: { fio2: 'high' },
    }))).toEqual({ ok: false, code: 'invalid_payload' })

    expect(parseClientMessage(JSON.stringify({
      type: 'set_manual_ventilation',
      active: 'yes',
    }))).toEqual({ ok: false, code: 'invalid_payload' })
  })

  it('rejects oversized raw messages', () => {
    expect(parseClientMessage(' '.repeat(20_001))).toEqual({ ok: false, code: 'message_too_large' })
  })
})
