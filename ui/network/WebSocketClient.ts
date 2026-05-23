import type { ClientMessage, ServerMessage } from '../../shared/protocol'

interface WebSocketClientOptions {
  url?: string
  socketFactory?: (url: string) => WebSocket
  setTimeout?: (callback: () => void, delay: number) => unknown
  clearTimeout?: (handle: unknown) => void
}

type MessageHandler = (message: ServerMessage) => void
export type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected'
type StatusHandler = (status: WebSocketConnectionStatus) => void
const QUEUEABLE_MESSAGE_TYPES = new Set<ClientMessage['type']>(['create_session', 'join_session', 'reconnect'])

export class WebSocketClient {
  private url: string
  private socketFactory: (url: string) => WebSocket
  private setTimer: (callback: () => void, delay: number) => unknown
  private clearTimer: (handle: unknown) => void
  private socket: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private reconnectTimer: unknown = null
  private sessionCode: string | null = null
  private token: string | null = null
  private manuallyClosed = false
  private isOpen = false
  private queuedMessages: ClientMessage[] = []

  constructor(options: WebSocketClientOptions = {}) {
    this.url = options.url ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    this.socketFactory = options.socketFactory ?? (url => new WebSocket(url))
    this.setTimer = options.setTimeout ?? ((callback, delay) => window.setTimeout(callback, delay))
    this.clearTimer = options.clearTimeout ?? (handle => window.clearTimeout(Number(handle)))
  }

  connect(): void {
    this.manuallyClosed = false
    this.isOpen = false
    this.notifyStatus('connecting')
    this.socket = this.socketFactory(this.url)
    this.socket.onopen = () => {
      this.isOpen = true
      this.notifyStatus('connected')
      if (this.sessionCode && this.token) {
        this.send({ type: 'reconnect', sessionCode: this.sessionCode, token: this.token })
      }
      const queued = this.queuedMessages
      this.queuedMessages = []
      for (const message of queued) this.send(message)
    }
    this.socket.onmessage = event => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if ((message.type === 'session_created' || message.type === 'session_joined') && message.token) {
        this.sessionCode = message.sessionCode
        this.token = message.token
      }
      for (const handler of this.handlers) handler(message)
    }
    this.socket.onclose = () => {
      this.isOpen = false
      this.notifyStatus('disconnected')
      if (this.manuallyClosed) return
      this.reconnectTimer = this.setTimer(() => this.connect(), 500)
    }
  }

  close(): void {
    this.manuallyClosed = true
    if (this.reconnectTimer !== null) this.clearTimer(this.reconnectTimer)
    this.socket?.close()
  }

  send(message: ClientMessage): boolean {
    if (!this.socket || !this.isOpen) {
      if (!QUEUEABLE_MESSAGE_TYPES.has(message.type)) return false
      this.queuedMessages.push(message)
      return true
    }
    this.socket.send(JSON.stringify(message))
    return true
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  private notifyStatus(status: WebSocketConnectionStatus): void {
    for (const handler of this.statusHandlers) handler(status)
  }
}
