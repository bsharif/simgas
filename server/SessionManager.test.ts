import { describe, expect, it } from 'vitest'
import { SessionManager } from './SessionManager'

describe('SessionManager', () => {
  it('creates six-character session codes without ambiguous characters', () => {
    const manager = new SessionManager()

    const session = manager.createSession({ trainerName: 'Trainer', scenarioId: 'anaphylaxis' })

    expect(session.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(manager.getSession(session.code)).toBe(session)
  })

  it('enforces max sessions and returns undefined for lookup misses', () => {
    const manager = new SessionManager({ maxSessions: 1 })
    manager.createSession({ trainerName: 'Trainer', scenarioId: 'anaphylaxis' })

    expect(() => manager.createSession({ trainerName: 'Trainer 2', scenarioId: 'anaphylaxis' })).toThrow('max sessions')
    expect(manager.getSession('ZZZZZZ')).toBeUndefined()
  })

  it('cleans empty and terminal sessions after ten minutes', () => {
    let now = 0
    const manager = new SessionManager({ now: () => now })
    const empty = manager.createSession({ trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const terminal = manager.createSession({ trainerName: 'Trainer', scenarioId: 'anaphylaxis' })

    empty.markEmpty()
    terminal.markTerminal('failed')
    now = 599_999
    manager.cleanup()

    expect(manager.getSession(empty.code)).toBe(empty)
    expect(manager.getSession(terminal.code)).toBe(terminal)

    now = 600_000
    manager.cleanup()

    expect(manager.getSession(empty.code)).toBeUndefined()
    expect(manager.getSession(terminal.code)).toBeUndefined()
  })

  it('keeps a trainer-disconnected session during the grace period', () => {
    let now = 0
    const manager = new SessionManager({ now: () => now })
    const session = manager.createSession({ trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const messages: unknown[] = []
    const trainer = session.connectTrainer(message => messages.push(message))

    session.disconnect(trainer.clientId)
    now = 300_000
    manager.cleanup()

    expect(manager.getSession(session.code)).toBe(session)
  })
})
