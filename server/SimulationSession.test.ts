import { describe, expect, it, vi } from 'vitest'
import { createBaselineState } from '../engine/patient'
import type { RemotePatientSnapshot, ServerMessage } from '../shared/protocol'
import { SimulationSession } from './SimulationSession'

function collect() {
  const messages: ServerMessage[] = []
  return { messages, send: (message: ServerMessage) => messages.push(message) }
}

function snapshot(phase: RemotePatientSnapshot['phase'] = 'running'): RemotePatientSnapshot {
  const state = createBaselineState()
  return {
    hr: state.hr,
    spo2: state.spo2,
    nibp: state.nibp,
    art: state.art,
    cvp: state.cvp,
    bis: state.bis,
    etco2: state.etco2,
    rr: state.rr,
    temp: state.temp,
    fio2: state.fio2,
    vt: state.vt,
    peep: state.peep,
    gasFlow: state.gasFlow,
    sevoflurane: state.sevoflurane,
    ventilationMode: state.ventilationMode,
    manualVentilationActive: state.manualVentilationActive,
    consciousness: state.consciousness,
    ecgRhythm: state.ecgRhythm,
    capnographyShape: state.capnographyShape,
    tubePosition: state.tubePosition,
    phase,
    elapsedSeconds: 42,
    paused: false,
    currentPhaseId: null,
    completedPhaseIds: [],
    forcedPhaseId: null,
  }
}

describe('SimulationSession', () => {
  it('creates trainer and trainee tokens and sends join messages', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const trainer = collect()
    const trainee = collect()

    const trainerConnection = session.connectTrainer(trainer.send)
    const traineeConnection = session.joinTrainee('John', trainee.send)

    expect(trainerConnection.token).toMatch(/^tok_/)
    expect(traineeConnection.ok).toBe(true)
    expect(traineeConnection.ok ? traineeConnection.token : '').toMatch(/^tok_/)
    expect(trainer.messages).toContainEqual({
      type: 'session_created',
      sessionCode: '7K3M9P',
      role: 'trainer',
      token: trainerConnection.token,
    })
    expect(trainee.messages).toContainEqual({
      type: 'session_joined',
      sessionCode: '7K3M9P',
      role: 'trainee',
      token: traineeConnection.ok ? traineeConnection.token : '',
    })
  })

  it('reconnects with a token and resyncs event log, latest state, roster, and phase', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const trainer = collect()
    const trainerConnection = session.connectTrainer(trainer.send)
    session.recordEvent('Started')
    session.broadcastState(snapshot('failed'))
    session.markTerminal('failed')
    const reconnect = collect()

    const result = session.reconnect(trainerConnection.token, reconnect.send)

    expect(result.ok).toBe(true)
    expect(reconnect.messages.map(message => message.type)).toEqual([
      'event_log_snapshot',
      'state',
      'session_info',
      'phase_change',
    ])
    expect(reconnect.messages[0]).toEqual({ type: 'event_log_snapshot', events: ['▶ Starting scenario: Anaphylaxis', 'Started'] })
    expect(reconnect.messages[1]).toEqual({ type: 'state', snapshot: snapshot('failed') })
  })

  it('sends the event log and latest state snapshot when a trainee joins an active session', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    session.recordEvent('Trainer note')
    session.broadcastState(snapshot('running'))
    const trainee = collect()

    const joined = session.joinTrainee('John', trainee.send)

    expect(joined.ok).toBe(true)
    expect(trainee.messages).toContainEqual({ type: 'event_log_snapshot', events: ['Trainer note'] })
    expect(trainee.messages).toContainEqual({ type: 'state', snapshot: snapshot('running') })
  })

  it('rejects trainer-only commands from trainees', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const trainee = collect()
    const joined = session.joinTrainee('John', trainee.send)
    if (!joined.ok) throw new Error('join failed')

    session.handleClientMessage(joined.clientId, { type: 'pause' })

    expect(trainee.messages.at(-1)).toEqual({ type: 'error', code: 'unauthorized' })
  })

  it('limits sessions to 30 trainees', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })

    for (let i = 0; i < 30; i++) {
      expect(session.joinTrainee(`Trainee ${i}`, () => undefined).ok).toBe(true)
    }

    expect(session.joinTrainee('Overflow', () => undefined)).toEqual({ ok: false, code: 'session_full' })
  })

  it('throttles authoritative state broadcasts to 10 Hz and tracks the latest snapshot', () => {
    let now = 0
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis', now: () => now })
    const trainer = collect()
    session.connectTrainer(trainer.send)

    session.publishAuthoritativeState(snapshot('running'))
    now = 99
    session.publishAuthoritativeState({ ...snapshot('running'), hr: 90 })
    now = 100
    session.publishAuthoritativeState({ ...snapshot('running'), hr: 91 })

    const stateMessages = trainer.messages.filter(message => message.type === 'state')
    expect(stateMessages).toHaveLength(2)
    expect(stateMessages.at(-1)).toEqual({ type: 'state', snapshot: { ...snapshot('running'), hr: 91 } })
    expect(session.getLastSnapshot()).toEqual({ ...snapshot('running'), hr: 91 })
  })

  it('emits events and terminal phase changes immediately outside state throttle', () => {
    let now = 0
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis', now: () => now })
    const trainer = collect()
    session.connectTrainer(trainer.send)

    session.publishAuthoritativeState(snapshot('running'))
    now = 10
    session.recordEvent('Event now')
    session.markTerminal('resolved')

    expect(trainer.messages).toContainEqual({ type: 'event', text: 'Event now' })
    expect(trainer.messages).toContainEqual({ type: 'phase_change', phase: 'resolved' })
  })

  it('broadcasts paused state immediately when pausing and resuming', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)

      session.handleClientMessage(connection.clientId, { type: 'pause' })
      expect(trainer.messages).toContainEqual({
        type: 'state',
        snapshot: expect.objectContaining({ paused: true }),
      })

      session.handleClientMessage(connection.clientId, { type: 'resume' })
      expect(trainer.messages).toContainEqual({
        type: 'state',
        snapshot: expect.objectContaining({ paused: false }),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('start_scenario starts an authoritative engine and produces state', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)

      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })
      vi.advanceTimersByTime(120)

      expect(trainer.messages.some(message => message.type === 'state')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
