import { describe, expect, it } from 'vitest'
import type { SimulationPhase } from '../../engine/physiology'
import type { RemotePatientSnapshot } from '../../shared/protocol'
import { getRemoteStateApplication, shouldResetRemoteWaveforms } from './RemoteSimulationContext'

function snapshot(phase: SimulationPhase, elapsedSeconds: number): Pick<RemotePatientSnapshot, 'phase' | 'elapsedSeconds'> {
  return { phase, elapsedSeconds }
}

describe('shouldResetRemoteWaveforms', () => {
  it('detects a new run when local phase transitions from idle to running at the beginning', () => {
    expect(shouldResetRemoteWaveforms('idle', snapshot('running', 0))).toBe(true)
  })

  it('does not reset during an in-progress reconnect snapshot', () => {
    expect(shouldResetRemoteWaveforms('idle', snapshot('running', 30))).toBe(false)
  })

  it('does not reset during normal running snapshots', () => {
    expect(shouldResetRemoteWaveforms('running', snapshot('running', 0))).toBe(false)
  })
})

describe('getRemoteStateApplication', () => {
  it('rejects stale snapshots before state or waveform updates', () => {
    expect(getRemoteStateApplication({
      latestElapsedSeconds: 12,
      hasReceivedState: true,
      previousPhase: 'running',
      pendingRunStart: false,
      snapshot: snapshot('running', 11.9),
    })).toBe('reject')
  })

  it('accepts equal-time snapshots without writing waveform buffers', () => {
    expect(getRemoteStateApplication({
      latestElapsedSeconds: 12,
      hasReceivedState: true,
      previousPhase: 'running',
      pendingRunStart: false,
      snapshot: snapshot('running', 12),
    })).toBe('skip-waveforms')
  })

  it('resets and pre-fills waveforms on the first accepted state even mid-run', () => {
    expect(getRemoteStateApplication({
      latestElapsedSeconds: 0,
      hasReceivedState: false,
      previousPhase: 'idle',
      pendingRunStart: false,
      snapshot: snapshot('running', 45),
    })).toBe('reset')
  })

  it('preserves existing waveforms on later active-session reconnect snapshots', () => {
    expect(getRemoteStateApplication({
      latestElapsedSeconds: 45,
      hasReceivedState: true,
      previousPhase: 'idle',
      pendingRunStart: false,
      snapshot: snapshot('running', 45),
    })).toBe('skip-waveforms')
  })
})
