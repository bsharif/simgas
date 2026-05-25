import { describe, expect, it, vi } from 'vitest'
import type { ClientMessage, ServerMessage } from '../../shared/protocol'
import { WebSocketClient } from './WebSocketClient'

class FakeSocket {
  static latest: FakeSocket | null = null
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.latest = this
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.onclose?.()
  }

  emit(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

describe('WebSocketClient', () => {
  it('connects, sends messages, dispatches server messages, and reconnects with token', () => {
    vi.useFakeTimers()
    try {
      const received: ServerMessage[] = []
      const client = new WebSocketClient({
        url: 'ws://test/ws',
        socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
        setTimeout: (cb, delay) => setTimeout(cb, delay),
        clearTimeout: id => clearTimeout(Number(id)),
      })
      client.onMessage(message => received.push(message))
      const statuses: string[] = []
      client.onStatusChange(status => statuses.push(status))

      client.connect()
      const first = FakeSocket.latest
      if (!first) throw new Error('missing socket')
      first.onopen?.()
      expect(client.send({ type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' })).toBe(true)

      expect(first.sent).toEqual([JSON.stringify({ type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' } satisfies ClientMessage)])

      first.emit({ type: 'session_created', sessionCode: '7K3M9P', role: 'trainer', token: 'tok_abc' })
      expect(received.at(-1)).toEqual({ type: 'session_created', sessionCode: '7K3M9P', role: 'trainer', token: 'tok_abc' })

      first.onclose?.()
      vi.advanceTimersByTime(500)
      const second = FakeSocket.latest
      if (!second || second === first) throw new Error('missing reconnect socket')
      second.onopen?.()

      expect(second.sent).toContain(JSON.stringify({ type: 'reconnect', sessionCode: '7K3M9P', token: 'tok_abc' }))
      expect(statuses).toEqual(['connecting', 'connected', 'disconnected', 'connecting', 'connected'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('queues session establishment messages while disconnected and reports them as accepted', () => {
    const client = new WebSocketClient({
      url: 'ws://test/ws',
      socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
    })

    expect(client.send({ type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' })).toBe(true)
    expect(client.send({ type: 'join_session', name: 'Trainee', sessionCode: '7K3M9P' })).toBe(true)
    expect(client.send({ type: 'reconnect', sessionCode: '7K3M9P', token: 'tok_abc' })).toBe(true)

    client.connect()
    const socket = FakeSocket.latest
    if (!socket) throw new Error('missing socket')
    socket.onopen?.()

    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' } satisfies ClientMessage),
      JSON.stringify({ type: 'join_session', name: 'Trainee', sessionCode: '7K3M9P' } satisfies ClientMessage),
      JSON.stringify({ type: 'reconnect', sessionCode: '7K3M9P', token: 'tok_abc' } satisfies ClientMessage),
    ])
  })

  it('does not queue active session commands while disconnected and reports them as rejected', () => {
    const client = new WebSocketClient({
      url: 'ws://test/ws',
      socketFactory: url => new FakeSocket(url) as unknown as WebSocket,
    })

    expect(client.send({ type: 'intervene', interventionId: 'adrenaline-1' })).toBe(false)
    expect(client.send({ type: 'update_machine_settings', settings: { fio2: 1 } })).toBe(false)
    expect(client.send({ type: 'set_manual_ventilation', active: true })).toBe(false)
    expect(client.send({ type: 'pause' })).toBe(false)
    expect(client.send({ type: 'resume' })).toBe(false)
    expect(client.send({ type: 'end_session' })).toBe(false)

    client.connect()
    const socket = FakeSocket.latest
    if (!socket) throw new Error('missing socket')
    socket.onopen?.()

    expect(socket.sent).toEqual([])
  })
})
