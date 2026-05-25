import { describe, expect, it, vi } from 'vitest'
import { sendInjectedEvent } from './eventInjectorCommand'

describe('sendInjectedEvent', () => {
  it('reports failed sends so callers preserve draft text', () => {
    const send = vi.fn(() => false)

    const sent = sendInjectedEvent(send, ' airway pressure rising ')

    expect(sent).toBe(false)
    expect(send).toHaveBeenCalledWith({ type: 'inject_event', text: 'airway pressure rising' })
  })

  it('reports successful sends so callers can clear draft text', () => {
    const send = vi.fn(() => true)

    expect(sendInjectedEvent(send, 'Event')).toBe(true)
  })
})
