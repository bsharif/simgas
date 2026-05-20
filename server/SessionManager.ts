import { randomInt } from 'node:crypto'
import { SimulationSession } from './SimulationSession'

interface SessionManagerOptions {
  maxSessions?: number
  now?: () => number
  ttlMs?: number
}

interface CreateSessionOptions {
  trainerName: string
  scenarioId: string | null
}

const SESSION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DEFAULT_MAX_SESSIONS = 100
const DEFAULT_TTL_MS = 10 * 60 * 1000

export class SessionManager {
  private sessions = new Map<string, SimulationSession>()
  private maxSessions: number
  private now: () => number
  private ttlMs: number

  constructor(options: SessionManagerOptions = {}) {
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  }

  createSession(options: CreateSessionOptions): SimulationSession {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error('max sessions reached')
    }

    const code = this.generateCode()
    const session = new SimulationSession({
      code,
      trainerName: options.trainerName,
      scenarioId: options.scenarioId,
      now: this.now,
    })
    this.sessions.set(code, session)
    return session
  }

  getSession(code: string): SimulationSession | undefined {
    return this.sessions.get(code)
  }

  cleanup(): void {
    for (const [code, session] of this.sessions.entries()) {
      if (session.isExpired(this.ttlMs)) {
        this.sessions.delete(code)
      }
    }
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = ''
      for (let i = 0; i < 6; i++) {
        code += SESSION_ALPHABET[randomInt(SESSION_ALPHABET.length)]
      }
      if (!this.sessions.has(code)) return code
    }
    throw new Error('unable to allocate session code')
  }
}
