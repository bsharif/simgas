import { randomBytes } from 'node:crypto'
import { SimulationEngine } from '../engine/physiology'
import { INTERVENTION_MAP, type PatientModifier } from '../engine/interventions'
import type {
  ActionLogEntry,
  ClientMessage,
  DoseLedgerEntryMessage,
  ErrorCode,
  RemotePatientSnapshot,
  ServerMessage,
  SessionRole,
  SessionSummaryMessage,
} from '../shared/protocol'
import type { SimulationPhase } from '../engine/physiology'
import { loadScenarios } from './loadScenarios'
import { serializeState } from './serializeState'

export interface SessionClient {
  id: string
  role: SessionRole
  name: string
  send: (message: ServerMessage) => void
}

interface ClientRecord extends SessionClient {
  token: string
  connected: boolean
}

interface SimulationSessionOptions {
  code: string
  trainerName: string
  scenarioId: string | null
  now?: () => number
}

type JoinResult =
  | { ok: true; clientId: string; token: string }
  | { ok: false; code: ErrorCode }

interface IntervalRuntime {
  now: () => number
  scheduleFrame: (callback: (timestamp: number) => void) => unknown
  cancelFrame: (handle: unknown) => void
}

const TRAINER_ONLY_MESSAGES = new Set<ClientMessage['type']>([
  'start_scenario',
  'override',
  'clear_trainer_overrides',
  'advance_phase',
  'clear_forced_phase',
  'inject_event',
  'add_note',
  'open_debrief',
  'pause',
  'resume',
  'end_session',
])

export class SimulationSession {
  readonly code: string
  /** Scenario selected at room creation. The room does NOT auto-start it —
   * the trainer starts the case explicitly from the waiting room. */
  readonly scenarioId: string | null
  readonly createdAt: number
  lastEmptyAt: number | null = null
  terminalAt: number | null = null
  private now: () => number
  private phase: SimulationPhase = 'idle'
  private nextClientId = 1
  private clients = new Map<string, ClientRecord>()
  private tokenToClientId = new Map<string, string>()
  private eventLog: string[] = []
  private actionLog: ActionLogEntry[] = []
  private lastSnapshot: RemotePatientSnapshot | null = null
  private lastStateBroadcastAt: number | null = null
  private lastDoseLedger: DoseLedgerEntryMessage[] = []
  private lastSummary: SessionSummaryMessage | null = null
  private currentMetadata: ServerMessage | null = null
  private currentScenarioId: string | null
  private engine: SimulationEngine | null = null
  private runtime: IntervalRuntime
  private trainerOverride: PatientModifier | null = null

  constructor(options: SimulationSessionOptions) {
    this.code = options.code
    this.scenarioId = options.scenarioId
    this.currentScenarioId = options.scenarioId
    this.now = options.now ?? Date.now
    this.runtime = {
      now: this.now,
      scheduleFrame: callback => setTimeout(() => callback(this.now()), 16),
      cancelFrame: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    }
    this.createdAt = this.now()
    const trainer = this.createRecord('trainer', options.trainerName, () => undefined)
    trainer.connected = false
  }

  connectTrainer(send: (message: ServerMessage) => void): { clientId: string; token: string } {
    const trainer = [...this.clients.values()].find(client => client.role === 'trainer')
    if (!trainer) throw new Error('missing trainer')
    trainer.send = send
    trainer.connected = true
    this.lastEmptyAt = null
    send({ type: 'session_created', sessionCode: this.code, role: 'trainer', token: trainer.token })
    this.sendSessionInfo(trainer)
    // The room opens as a waiting room (phase 'idle'). The trainer starts the
    // case explicitly with a start_scenario command once learners have joined.
    return { clientId: trainer.id, token: trainer.token }
  }

  joinTrainee(name: string, send: (message: ServerMessage) => void): JoinResult {
    if ([...this.clients.values()].filter(client => client.role === 'trainee').length >= 30) {
      return { ok: false, code: 'session_full' }
    }

    const trainee = this.createRecord('trainee', name, send)
    send({ type: 'session_joined', sessionCode: this.code, role: 'trainee', token: trainee.token })
    this.sendSessionInfo(trainee)
    this.sendCatchUp(trainee)
    this.broadcastSessionInfo()
    return { ok: true, clientId: trainee.id, token: trainee.token }
  }

  reconnect(token: string, send: (message: ServerMessage) => void): JoinResult {
    const clientId = this.tokenToClientId.get(token)
    const client = clientId ? this.clients.get(clientId) : undefined
    if (!client) return { ok: false, code: 'unauthorized' }

    client.send = send
    client.connected = true
    this.lastEmptyAt = null
    this.sendCatchUp(client)
    send({ type: 'phase_change', phase: this.phase })
    if (client.role === 'trainer' && this.actionLog.length > 0) {
      send({ type: 'action_log_snapshot', entries: [...this.actionLog] })
    }
    // Refresh everyone's roster (including this client) with the new
    // connected flag.
    this.broadcastSessionInfo()

    return { ok: true, clientId: client.id, token: client.token }
  }

  disconnect(clientId: string): void {
    const client = this.clients.get(clientId)
    if (!client) return
    client.connected = false
    if (![...this.clients.values()].some(entry => entry.connected)) {
      this.lastEmptyAt = this.now()
    }
    // Keep every screen's roster truthful about who is actually connected.
    this.broadcastSessionInfo()
  }

  markEmpty(): void {
    this.lastEmptyAt = this.now()
  }

  markTerminal(phase: Extract<SimulationPhase, 'resolved' | 'failed'>): void {
    this.phase = phase
    this.terminalAt = this.now()
    this.broadcast({ type: 'phase_change', phase })
  }

  recordEvent(text: string): void {
    this.eventLog.push(text)
    this.broadcast({ type: 'event', text })
  }

  broadcastState(snapshot: RemotePatientSnapshot): void {
    this.lastSnapshot = snapshot
    this.phase = snapshot.phase
    this.lastStateBroadcastAt = this.now()
    this.broadcast({ type: 'state', snapshot })
  }

  publishAuthoritativeState(snapshot: RemotePatientSnapshot): void {
    this.lastSnapshot = snapshot
    this.phase = snapshot.phase
    const current = this.now()
    if (this.lastStateBroadcastAt !== null && current - this.lastStateBroadcastAt < 100) {
      return
    }
    this.lastStateBroadcastAt = current
    this.broadcast({ type: 'state', snapshot })
  }

  getLastSnapshot(): RemotePatientSnapshot | null {
    return this.lastSnapshot
  }

  /**
   * Bypass the 10 Hz throttle. Used for command-driven state changes and
   * terminal states — discrete transitions every client must see immediately
   * (review: "Remote terminal state can desynchronize").
   */
  private forceBroadcastState(): void {
    if (!this.engine) return
    this.broadcastState(serializeState(this.engine))
  }

  private recordAction(entry: ActionLogEntry): void {
    this.actionLog.push(entry)
    this.sendToRole('trainer', { type: 'action', entry })
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId)
    if (!client) return
    if (client.role !== 'trainer' && TRAINER_ONLY_MESSAGES.has(message.type)) {
      client.send({ type: 'error', code: 'unauthorized', message: 'Only the trainer can do that.' })
      return
    }

    if (message.type === 'start_scenario') {
      this.startScenario(message.scenarioId)
      return
    }

    if (message.type === 'intervene') {
      const intervention = INTERVENTION_MAP.get(message.interventionId)
      if (intervention && this.engine) {
        const before = this.engine.interventionList.length
        this.engine.applyIntervention(intervention)
        const accepted = this.engine.interventionList.length > before
        if (accepted) {
          this.recordAction({
            actorName: client.name,
            actorRole: client.role,
            kind: 'intervention',
            text: intervention.label,
            atSec: this.engine.elapsedSeconds,
          })
        }
        this.forceBroadcastState()
      }
      return
    }

    if (message.type === 'update_machine_settings') {
      if (this.engine) {
        this.engine.updateMachineSettings(message.settings)
        this.recordAction({
          actorName: client.name,
          actorRole: client.role,
          kind: 'machine',
          text: Object.entries(message.settings)
            .map(([key, value]) => `${key} → ${typeof value === 'number' ? Number(value.toFixed(2)) : value}`)
            .join(', '),
          atSec: this.engine.elapsedSeconds,
        })
        this.forceBroadcastState()
      }
      return
    }

    if (message.type === 'set_manual_ventilation') {
      if (this.engine) {
        this.engine.setManualVentilation(message.active)
        if (message.active) {
          this.recordAction({
            actorName: client.name,
            actorRole: client.role,
            kind: 'manual-vent',
            text: 'Manual ventilation (bag squeezed)',
            atSec: this.engine.elapsedSeconds,
          })
        }
        this.forceBroadcastState()
      }
      return
    }

    if (message.type === 'override') {
      const next: PatientModifier = message.mode === 'set_target'
        ? { baseline: message.values }
        : message.values
      this.trainerOverride = next
      return
    }

    if (message.type === 'clear_trainer_overrides') {
      this.trainerOverride = null
      return
    }

    if (message.type === 'advance_phase') {
      this.engine?.scenario?.forcePhase?.(message.phaseId)
      return
    }

    if (message.type === 'clear_forced_phase') {
      this.engine?.scenario?.clearForcedPhase?.()
      return
    }

    if (message.type === 'inject_event') {
      this.recordEvent(message.text)
      return
    }

    if (message.type === 'add_note') {
      this.recordAction({
        actorName: client.name,
        actorRole: client.role,
        kind: message.teaching ? 'teaching-moment' : 'note',
        text: message.text,
        atSec: this.engine?.elapsedSeconds ?? 0,
      })
      return
    }

    if (message.type === 'open_debrief') {
      this.broadcast({ type: 'debrief_open' })
      return
    }

    if (message.type === 'end_session') {
      if (this.engine && this.phase === 'running') {
        this.publishSummary('failed')
        this.engine.stop()
        this.recordEvent('■ Session ended by trainer')
        this.markTerminal('failed')
      } else {
        this.engine?.stop()
        this.markTerminal('failed')
      }
      return
    }

    if (message.type === 'pause' || message.type === 'resume') {
      if (this.engine && ((message.type === 'pause' && !this.engine.paused) || (message.type === 'resume' && this.engine.paused))) {
        this.engine.togglePause()
        this.broadcastState(serializeState(this.engine))
      }
      return
    }
  }

  isExpired(ttlMs: number): boolean {
    const now = this.now()
    return (this.lastEmptyAt !== null && now - this.lastEmptyAt >= ttlMs)
      || (this.terminalAt !== null && now - this.terminalAt >= ttlMs)
  }

  private createRecord(role: SessionRole, name: string, send: (message: ServerMessage) => void): ClientRecord {
    const id = `${role}-${this.nextClientId++}`
    const token = `tok_${randomBytes(16).toString('hex')}`
    const record: ClientRecord = { id, role, name, send, token, connected: true }
    this.clients.set(id, record)
    this.tokenToClientId.set(token, id)
    return record
  }

  /** Bring a (re)joining client up to date with the session's current state. */
  private sendCatchUp(client: ClientRecord): void {
    client.send({ type: 'event_log_snapshot', events: [...this.eventLog] })
    if (this.currentMetadata) client.send(this.currentMetadata)
    if (this.lastSnapshot) client.send({ type: 'state', snapshot: this.lastSnapshot })
    if (this.lastDoseLedger.length > 0) client.send({ type: 'dose_ledger', entries: [...this.lastDoseLedger] })
    if (this.lastSummary) client.send(this.lastSummary)
  }

  private publishSummary(outcome: 'resolved' | 'failed'): void {
    if (!this.engine) return
    const summary: SessionSummaryMessage = {
      type: 'session_summary',
      outcome,
      vitalsHistory: [...this.engine.getVitalsHistory()],
      interventionEvents: [...this.engine.getInterventionEvents()],
    }
    this.lastSummary = summary
    this.broadcast(summary)
  }

  private startScenario(scenarioId: string): void {
    const serverScenario = loadScenarios().find(entry => entry.scenario.id === scenarioId)
    if (!serverScenario) {
      this.sendToRole('trainer', { type: 'error', code: 'not_found', message: `Unknown scenario '${scenarioId}'.` })
      return
    }

    // Restarting (same or different case) clears the previous run's record.
    this.engine?.stop()
    this.eventLog = []
    this.actionLog = []
    this.lastSummary = null
    this.terminalAt = null
    this.currentScenarioId = scenarioId
    this.broadcast({ type: 'event_log_snapshot', events: [] })
    this.sendToRole('trainer', { type: 'action_log_snapshot', entries: [] })

    const engine = new SimulationEngine({
      runtime: this.runtime,
      modifierHook: () => this.trainerOverride,
    })
    this.engine = engine
    this.lastStateBroadcastAt = null
    this.lastDoseLedger = []
    engine.subscribe(() => this.publishAuthoritativeState(serializeState(engine)))
    engine.onEvent(event => this.recordEvent(event))
    engine.onDoseLedgerChange(ledger => {
      this.lastDoseLedger = [...ledger.entries()].map(([id, entry]) => ({
        id,
        count: entry.count,
        lastAppliedSec: entry.lastAppliedSec,
      }))
      this.broadcast({ type: 'dose_ledger', entries: [...this.lastDoseLedger] })
    })
    engine.onPhaseChange(phase => {
      this.phase = phase
      if (phase === 'resolved' || phase === 'failed') {
        // Terminal state must reach every client even if the last routine
        // broadcast landed inside the throttle window: force the final
        // snapshot (now carrying the terminal phase) before the phase event.
        this.forceBroadcastState()
        this.broadcast({ type: 'phase_change', phase })
        this.publishSummary(phase)
        this.terminalAt = this.now()
      } else {
        this.broadcast({ type: 'phase_change', phase })
      }
    })
    this.currentMetadata = serverScenario.metadata
    this.broadcast(serverScenario.metadata)
    engine.start(serverScenario.scenario)
    this.forceBroadcastState()
  }

  private sendToRole(role: SessionRole, message: ServerMessage): void {
    for (const client of this.clients.values()) {
      if (client.connected && client.role === role) client.send(message)
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const client of this.clients.values()) {
      if (client.connected) client.send(message)
    }
  }

  private broadcastSessionInfo(): void {
    for (const client of this.clients.values()) {
      if (client.connected) this.sendSessionInfo(client)
    }
  }

  private sendSessionInfo(client: ClientRecord): void {
    client.send({
      type: 'session_info',
      sessionCode: this.code,
      role: client.role,
      roster: [...this.clients.values()].map(entry => ({
        id: entry.id,
        name: entry.name,
        role: entry.role,
        connected: entry.connected,
      })),
      phase: this.phase,
      scenarioId: this.currentScenarioId,
    })
  }
}
