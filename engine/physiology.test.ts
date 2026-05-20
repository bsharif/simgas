import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './physiology'
import type { Scenario } from './scenario'

function createScenario(): Scenario {
  return {
    id: 'runtime-test',
    label: 'Runtime Test',
    description: 'Runtime test scenario',
    difficulty: 'easy',
    hints: [],
    initialModifiers: {},
    check: () => ({ modifiers: {}, events: [], resolved: false, failed: false }),
  }
}

function createRuntime() {
  let nowMs = 0
  let nextHandle = 1
  const callbacks = new Map<number, (timestamp: number) => void>()
  const cancelled: number[] = []

  return {
    runtime: {
      now: () => nowMs,
      scheduleFrame: (callback: (timestamp: number) => void) => {
        const handle = nextHandle++
        callbacks.set(handle, callback)
        return handle
      },
      cancelFrame: (handle: unknown) => {
        cancelled.push(Number(handle))
        callbacks.delete(Number(handle))
      },
    },
    setNow: (value: number) => {
      nowMs = value
    },
    runFrame: (handle: number, timestamp: number) => {
      callbacks.get(handle)?.(timestamp)
    },
    scheduledHandles: () => [...callbacks.keys()],
    cancelledHandles: () => cancelled,
  }
}

describe('SimulationEngine runtime injection', () => {
  it('start schedules a frame with the injected runtime', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })

    engine.start(createScenario())

    expect(fake.scheduledHandles()).toHaveLength(1)
  })

  it('stop cancels the scheduled runtime frame', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })

    engine.start(createScenario())
    const [handle] = fake.scheduledHandles()
    engine.stop()

    expect(fake.cancelledHandles()).toEqual([handle])
  })

  it('togglePause uses the injected clock when resuming', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })

    engine.start(createScenario())
    engine.togglePause()
    fake.setNow(5_000)
    engine.togglePause()

    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 5_016)

    expect(engine.elapsedSeconds).toBeCloseTo(0.016, 3)
  })

  it('runtime tick delta clamps long delays at 100 ms', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })

    engine.start(createScenario())

    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 10_000)

    expect(engine.elapsedSeconds).toBeCloseTo(0.1, 3)
  })
})

describe('SimulationEngine modifier hook', () => {
  it('applies hook modifiers after scenario modifiers before broadcast', () => {
    const fake = createRuntime()
    const scenario = createScenario()
    scenario.check = () => ({
      modifiers: { hr: 80 },
      events: [],
      resolved: false,
      failed: false,
    })
    const seenHr: number[] = []
    const engine = new SimulationEngine({
      runtime: fake.runtime,
      modifierHook: () => ({ hr: 123 }),
    })
    engine.subscribe(state => seenHr.push(state.hr))

    engine.start(scenario)
    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 16)

    expect(engine.state.hr).toBe(123)
    expect(seenHr.at(-1)).toBe(123)
  })
})
