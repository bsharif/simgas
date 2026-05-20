import { describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { createApp, createHttpServer, createHeartbeatTracker } from './index'
import type { ServerMessage } from '../shared/protocol'

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 1_000)
    ws.once('message', data => {
      clearTimeout(timer)
      resolve(JSON.parse(data.toString()) as ServerMessage)
    })
  })
}

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function waitForMessageCount(messages: ServerMessage[], count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (messages.length >= count) {
        resolve()
        return
      }
      if (Date.now() - start > 1_000) {
        reject(new Error('timed out waiting for messages'))
        return
      }
      setTimeout(check, 1)
    }
    check()
  })
}

describe('createApp', () => {
  it('returns ok from health endpoint', async () => {
    const app = createApp()
    const server = app.listen(0)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing port')

    const response = await fetch(`http://127.0.0.1:${address.port}/health`)
    server.close()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('websocket routes create and join session messages', async () => {
    const server = createHttpServer()
    server.listen(0)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing port')

    const trainer = await openWs(`ws://127.0.0.1:${address.port}/ws`)
    trainer.send(JSON.stringify({ type: 'create_session', name: 'Trainer', scenarioId: 'anaphylaxis' }))
    const created = await nextMessage(trainer)
    if (created.type !== 'session_created') throw new Error(`unexpected message: ${created.type}`)

    const trainee = await openWs(`ws://127.0.0.1:${address.port}/ws`)
    const traineeMessages: ServerMessage[] = []
    trainee.on('message', data => traineeMessages.push(JSON.parse(data.toString()) as ServerMessage))
    trainee.send(JSON.stringify({ type: 'join_session', sessionCode: created.sessionCode, name: 'John' }))
    await waitForMessageCount(traineeMessages, 2)
    const [joined, info] = traineeMessages

    trainee.close()
    trainer.close()
    server.close()

    expect(joined).toMatchObject({ type: 'session_joined', role: 'trainee' })
    expect(info).toMatchObject({
      type: 'session_info',
      sessionCode: created.sessionCode,
      role: 'trainee',
      scenarioId: 'anaphylaxis',
    })
  })

  it('heartbeat terminates clients stale for more than 45 seconds', () => {
    let now = 0
    const socket = { ping: vi.fn(), terminate: vi.fn() }
    const heartbeat = createHeartbeatTracker({
      now: () => now,
      staleAfterMs: 45_000,
      pingEveryMs: 20_000,
    })

    heartbeat.track(socket)
    now = 20_000
    heartbeat.check()
    expect(socket.ping).toHaveBeenCalledTimes(1)

    now = 44_999
    heartbeat.check()
    expect(socket.terminate).not.toHaveBeenCalled()

    now = 45_000
    heartbeat.check()
    expect(socket.terminate).toHaveBeenCalledTimes(1)
  })
})
