import { describe, expect, it } from 'vitest'
import {
  initialManualVentilationReleaseState,
  manualVentilationCommandsAvailable,
  manualVentilationCommandsUnavailable,
  manualVentilationPointerDown,
  manualVentilationPointerRelease,
} from './manualVentilationRelease'

describe('manual ventilation release state', () => {
  it('sends a delayed release when commands return after disconnecting during a press', () => {
    const pressed = manualVentilationPointerDown(initialManualVentilationReleaseState, true)
    expect(pressed.command).toBe(true)

    const releasedWhileDisconnected = manualVentilationPointerRelease(pressed.state, false)
    expect(releasedWhileDisconnected.command).toBeNull()
    expect(releasedWhileDisconnected.state.releasePending).toBe(true)

    const reconnected = manualVentilationCommandsAvailable(releasedWhileDisconnected.state)
    expect(reconnected.command).toBe(false)
    expect(reconnected.state.releasePending).toBe(false)
  })

  it('does not replay stale manual ventilation true when pressing while unavailable', () => {
    const pressedWhileDisconnected = manualVentilationPointerDown(initialManualVentilationReleaseState, false)
    expect(pressedWhileDisconnected.command).toBeNull()

    const reconnected = manualVentilationCommandsAvailable(pressedWhileDisconnected.state)
    expect(reconnected.command).toBeNull()
  })

  it('schedules a release when commands become unavailable during an active press', () => {
    const pressed = manualVentilationPointerDown(initialManualVentilationReleaseState, true)

    const disconnected = manualVentilationCommandsUnavailable(pressed.state)
    expect(disconnected.command).toBeNull()
    expect(disconnected.state).toEqual({ pressActive: false, releasePending: true })

    const reconnected = manualVentilationCommandsAvailable(disconnected.state)
    expect(reconnected.command).toBe(false)
  })
})
