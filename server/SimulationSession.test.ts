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
      'phase_change',
      'session_info',
    ])
    expect(reconnect.messages[0]).toEqual({ type: 'event_log_snapshot', events: ['Started'] })
    expect(reconnect.messages[1]).toEqual({ type: 'state', snapshot: snapshot('failed') })
  })

  it('opens as a waiting room: no scenario engine runs until the trainer starts the case', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      session.connectTrainer(trainer.send)
      vi.advanceTimersByTime(500)

      expect(trainer.messages.some(message => message.type === 'state')).toBe(false)
      const info = trainer.messages.find(message => message.type === 'session_info')
      expect(info).toMatchObject({ phase: 'idle', scenarioId: 'anaphylaxis' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks roster entries with their connection state', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const trainer = collect()
    session.connectTrainer(trainer.send)
    const trainee = collect()
    const joined = session.joinTrainee('John', trainee.send)
    if (!joined.ok) throw new Error('join failed')

    session.disconnect(joined.clientId)

    const lastInfo = trainer.messages.filter(message => message.type === 'session_info').at(-1)
    if (!lastInfo || lastInfo.type !== 'session_info') throw new Error('missing session_info')
    expect(lastInfo.roster).toContainEqual(expect.objectContaining({ name: 'John', role: 'trainee', connected: false }))
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

    expect(trainee.messages.at(-1)).toEqual({ type: 'error', code: 'unauthorized', message: 'Only the trainer can do that.' })
  })

  it('allows duplicate trainee names as distinct participants', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
    const trainer = collect()
    session.connectTrainer(trainer.send)

    const first = session.joinTrainee('John', () => undefined)
    const second = session.joinTrainee('John', () => undefined)

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('join failed')
    expect(first.clientId).not.toBe(second.clientId)
    expect(first.token).not.toBe(second.token)

    const lastInfo = trainer.messages.filter(message => message.type === 'session_info').at(-1)
    if (!lastInfo || lastInfo.type !== 'session_info') throw new Error('missing session_info')
    const johns = lastInfo.roster.filter(entry => entry.name === 'John' && entry.role === 'trainee')
    expect(johns).toHaveLength(2)
  })

  it('rejects reconnect with an unknown token', () => {
    const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })

    expect(session.reconnect('tok_does_not_exist', () => undefined)).toEqual({ ok: false, code: 'unauthorized' })
  })

  it('attributes simultaneous interventions from two trainees on the action log', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      const a = session.joinTrainee('Ada', () => undefined)
      const b = session.joinTrainee('Bo', () => undefined)
      if (!a.ok || !b.ok) throw new Error('join failed')
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

      session.handleClientMessage(a.clientId, { type: 'intervene', interventionId: 'adrenaline-10' })
      session.handleClientMessage(b.clientId, { type: 'intervene', interventionId: 'fluid-bolus' })

      const actions = trainer.messages.filter(message => message.type === 'action')
      const actors = actions.map(message => (message.type === 'action' ? message.entry.actorName : ''))
      expect(actors).toContain('Ada')
      expect(actors).toContain('Bo')
    } finally {
      vi.useRealTimers()
    }
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
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

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

  it('broadcasts scenario metadata (with debrief body) to trainees as well as the trainer', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      const trainee = collect()
      session.joinTrainee('John', trainee.send)

      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

      const metadata = trainee.messages.find(message => message.type === 'scenario_metadata')
      if (!metadata || metadata.type !== 'scenario_metadata') throw new Error('missing metadata')
      expect(metadata.scenarioId).toBe('anaphylaxis')
      expect(metadata.debriefBody).toContain('Anaphylaxis')
    } finally {
      vi.useRealTimers()
    }
  })

  it('delivers terminal state immediately even when a routine broadcast just landed', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })
      // Apply the full management bundle so the recovery phase can resolve.
      session.handleClientMessage(connection.clientId, { type: 'intervene', interventionId: 'stop-trigger' })
      session.handleClientMessage(connection.clientId, { type: 'intervene', interventionId: 'adrenaline-10' })
      session.handleClientMessage(connection.clientId, { type: 'intervene', interventionId: 'increase-fio2' })
      session.handleClientMessage(connection.clientId, { type: 'intervene', interventionId: 'fluid-bolus' })

      // Run until the scenario resolves (resolve_when: phase_elapsed > 90).
      vi.advanceTimersByTime(95_000)

      const phaseChangeIndex = trainer.messages.findIndex(
        message => message.type === 'phase_change' && message.phase === 'resolved',
      )
      expect(phaseChangeIndex).toBeGreaterThan(-1)
      // A state snapshot carrying the terminal phase must arrive despite the
      // 10 Hz throttle, no later than the phase_change event.
      const terminalState = trainer.messages.findIndex(
        message => message.type === 'state' && message.snapshot.phase === 'resolved',
      )
      expect(terminalState).toBeGreaterThan(-1)
      expect(terminalState).toBeLessThan(phaseChangeIndex)
      // And the debrief summary follows.
      const summary = trainer.messages.find(message => message.type === 'session_summary')
      if (!summary || summary.type !== 'session_summary') throw new Error('missing session_summary')
      expect(summary.outcome).toBe('resolved')
      expect(summary.vitalsHistory.length).toBeGreaterThan(0)
      expect(summary.interventionEvents.map(event => event.id)).toContain('adrenaline-10')
    } finally {
      vi.useRealTimers()
    }
  })

  it('synchronizes the dose ledger to all clients', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      const trainee = collect()
      const joined = session.joinTrainee('John', trainee.send)
      if (!joined.ok) throw new Error('join failed')
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

      session.handleClientMessage(joined.clientId, { type: 'intervene', interventionId: 'adrenaline-10' })

      const ledger = trainee.messages.filter(message => message.type === 'dose_ledger').at(-1)
      if (!ledger || ledger.type !== 'dose_ledger') throw new Error('missing dose_ledger')
      expect(ledger.entries).toContainEqual(expect.objectContaining({ id: 'adrenaline-10', count: 1 }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('attributes accepted interventions to the actor on the trainer action log', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      const trainee = collect()
      const joined = session.joinTrainee('John', trainee.send)
      if (!joined.ok) throw new Error('join failed')
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

      session.handleClientMessage(joined.clientId, { type: 'intervene', interventionId: 'adrenaline-10' })

      const action = trainer.messages.find(message => message.type === 'action')
      if (!action || action.type !== 'action') throw new Error('missing action')
      expect(action.entry).toMatchObject({ actorName: 'John', actorRole: 'trainee', kind: 'intervention' })
      // Trainees don't receive the attributed action stream.
      expect(trainee.messages.some(message => message.type === 'action')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarting a scenario clears the previous run event log and summary', () => {
    vi.useFakeTimers()
    try {
      const session = new SimulationSession({ code: '7K3M9P', trainerName: 'Trainer', scenarioId: 'anaphylaxis' })
      const trainer = collect()
      const connection = session.connectTrainer(trainer.send)
      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })
      vi.advanceTimersByTime(1000)

      session.handleClientMessage(connection.clientId, { type: 'start_scenario', scenarioId: 'anaphylaxis' })

      const snapshots = trainer.messages.filter(message => message.type === 'event_log_snapshot')
      expect(snapshots.at(-1)).toEqual({ type: 'event_log_snapshot', events: [] })
    } finally {
      vi.useRealTimers()
    }
  })
})
