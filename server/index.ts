import express from 'express'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WebSocketServer } from 'ws'
import { parseClientMessage } from './protocolValidation'
import { SessionManager } from './SessionManager'
import type { ServerMessage } from '../shared/protocol'

const DEFAULT_PORT = 4174
const PING_EVERY_MS = 20_000
const STALE_AFTER_MS = 45_000

interface HeartbeatSocket {
  ping: () => void
  terminate: () => void
}

interface HeartbeatOptions {
  now?: () => number
  pingEveryMs?: number
  staleAfterMs?: number
}

export function createHeartbeatTracker(options: HeartbeatOptions = {}) {
  const now = options.now ?? Date.now
  const pingEveryMs = options.pingEveryMs ?? PING_EVERY_MS
  const staleAfterMs = options.staleAfterMs ?? STALE_AFTER_MS
  const sockets = new Map<HeartbeatSocket, { lastSeen: number; lastPing: number }>()

  return {
    track(socket: HeartbeatSocket) {
      sockets.set(socket, { lastSeen: now(), lastPing: now() })
    },
    markAlive(socket: HeartbeatSocket) {
      const entry = sockets.get(socket)
      if (entry) entry.lastSeen = now()
    },
    untrack(socket: HeartbeatSocket) {
      sockets.delete(socket)
    },
    check() {
      const current = now()
      for (const [socket, entry] of sockets.entries()) {
        if (current - entry.lastSeen >= staleAfterMs) {
          socket.terminate()
          sockets.delete(socket)
          continue
        }
        if (current - entry.lastPing >= pingEveryMs) {
          socket.ping()
          entry.lastPing = current
        }
      }
    },
  }
}

function sendJson(ws: { send: (data: string) => void }, message: ServerMessage): void {
  ws.send(JSON.stringify(message))
}

export function createApp(): express.Express {
  const app = express()
  const serverDir = dirname(fileURLToPath(import.meta.url))
  const distDir = join(serverDir, '..')

  app.get('/health', (_req, res) => {
    res.status(200).send('ok')
  })

  app.use(express.static(distDir))
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })

  return app
}

export function createHttpServer(): ReturnType<typeof createServer> {
  const app = createApp()
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })
  const sessions = new SessionManager()
  const connections = new Map<object, { sessionCode: string; clientId: string }>()
  const heartbeat = createHeartbeatTracker()
  const heartbeatInterval = setInterval(() => heartbeat.check(), PING_EVERY_MS)
  wss.on('close', () => clearInterval(heartbeatInterval))
  server.on('close', () => {
    clearInterval(heartbeatInterval)
    wss.close()
  })

  wss.on('connection', ws => {
    heartbeat.track(ws)
    ws.on('pong', () => heartbeat.markAlive(ws))

    ws.on('message', data => {
      const parsed = parseClientMessage(data.toString())
      if (!parsed.ok) {
        sendJson(ws, { type: 'error', code: parsed.code })
        return
      }

      const message = parsed.message
      if (message.type === 'create_session') {
        const session = sessions.createSession({ trainerName: message.name, scenarioId: message.scenarioId })
        const connection = session.connectTrainer(serverMessage => sendJson(ws, serverMessage))
        connections.set(ws, { sessionCode: session.code, clientId: connection.clientId })
        return
      }

      if (message.type === 'join_session') {
        const session = sessions.getSession(message.sessionCode)
        if (!session) {
          sendJson(ws, { type: 'error', code: 'not_found' })
          return
        }
        const result = session.joinTrainee(message.name, serverMessage => sendJson(ws, serverMessage))
        if (!result.ok) {
          sendJson(ws, { type: 'error', code: result.code })
          return
        }
        connections.set(ws, { sessionCode: session.code, clientId: result.clientId })
        return
      }

      if (message.type === 'reconnect') {
        const session = sessions.getSession(message.sessionCode)
        if (!session) {
          sendJson(ws, { type: 'error', code: 'not_found' })
          return
        }
        const result = session.reconnect(message.token, serverMessage => sendJson(ws, serverMessage))
        if (!result.ok) {
          sendJson(ws, { type: 'error', code: result.code })
          return
        }
        connections.set(ws, { sessionCode: session.code, clientId: result.clientId })
        return
      }

      const connection = connections.get(ws)
      const session = connection ? sessions.getSession(connection.sessionCode) : undefined
      if (!connection || !session) {
        sendJson(ws, { type: 'error', code: 'unauthorized' })
        return
      }
      session.handleClientMessage(connection.clientId, message)
    })

    ws.on('close', () => {
      heartbeat.untrack(ws)
      const connection = connections.get(ws)
      if (!connection) return
      connections.delete(ws)
      sessions.getSession(connection.sessionCode)?.disconnect(connection.clientId)
    })
  })

  return server
}

function shouldStartServer(): boolean {
  const entry = process.argv[1]
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href
}

if (shouldStartServer()) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT)
  createHttpServer().listen(port, () => {
    console.log(`SimGas server listening on ${port}`)
  })
}
