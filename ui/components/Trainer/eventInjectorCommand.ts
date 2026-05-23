import type { ClientMessage } from '../../../shared/protocol'

export function sendInjectedEvent(send: (message: ClientMessage) => boolean, text: string): boolean {
  const clean = text.trim()
  if (!clean) return false
  return send({ type: 'inject_event', text: clean })
}
