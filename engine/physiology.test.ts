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

  it('timeScale multiplies elapsed time (clamp applies before scaling)', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime, timeScale: 10 })

    engine.start(createScenario())
    const [handle] = fake.scheduledHandles()

    // 16 ms real frame → 0.16 s of sim time at 10×.
    fake.runFrame(handle, 16)
    expect(engine.elapsedSeconds).toBeCloseTo(0.16, 3)

    // A long delay clamps to 100 ms real first, then scales: +1.0 s.
    fake.runFrame(handle, 10_000)
    expect(engine.elapsedSeconds).toBeCloseTo(1.16, 3)
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

describe('SimulationEngine intervention history and manual ventilation', () => {
  it('records timestamped intervention events', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })
    engine.start(createScenario())
    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 16)

    engine.applyIntervention({
      id: 'test-drug',
      label: 'Test Drug',
      category: 'drug',
      description: '',
      effect: { hrDelta: 5 },
      durationMs: 0,
      onsetMs: 0,
    })

    const events = engine.getInterventionEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('test-drug')
    expect(events[0].atSec).toBeCloseTo(0.016, 3)
  })

  it('records realistic bag breaths as manual-vent interventions', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })
    engine.start(createScenario())

    engine.setManualVentilation(true)
    engine.setManualVentilation(false)
    // Within the debounce window — no second breath recorded.
    fake.setNow(100)
    engine.setManualVentilation(true)
    engine.setManualVentilation(false)
    // Past the debounce window — second breath recorded.
    fake.setNow(1000)
    engine.setManualVentilation(true)

    expect(engine.interventionList.filter(id => id === 'manual-vent')).toHaveLength(2)
    expect(engine.getDoseLedger().get('manual-vent')?.count).toBe(2)
  })
})

describe('SimulationEngine learning modes', () => {
  it('free play ignores scripted resolve/fail terminal states', () => {
    const fake = createRuntime()
    const scenario = createScenario()
    scenario.check = () => ({ modifiers: {}, events: [], resolved: true, failed: false })
    const engine = new SimulationEngine({ runtime: fake.runtime })
    engine.setMode('free')

    engine.start(scenario)
    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 16)

    expect(engine.phase).toBe('running')
    // And the loop was not frozen (freeze() would cancel the frame).
    expect(fake.cancelledHandles()).toHaveLength(0)
  })

  it('passes freePlay and suppressHints flags to the scenario context', () => {
    const fake = createRuntime()
    const scenario = createScenario()
    const seenCtx: Array<{ freePlay?: boolean; suppressHints?: boolean }> = []
    scenario.check = (_elapsed, _interventions, ctx) => {
      seenCtx.push({ freePlay: ctx?.freePlay, suppressHints: ctx?.suppressHints })
      return { modifiers: {}, events: [], resolved: false, failed: false }
    }
    const engine = new SimulationEngine({ runtime: fake.runtime })
    engine.setMode('exam')

    engine.start(scenario)
    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 16)

    expect(seenCtx.at(-1)).toEqual({ freePlay: false, suppressHints: true })
  })
})

describe('SimulationEngine vitals history', () => {
  it('records a sample on the terminal tick so the replay ends on the final state', () => {
    const fake = createRuntime()
    const scenario = createScenario()
    scenario.check = (elapsed) => ({
      modifiers: {},
      events: [],
      resolved: elapsed > 0.05,
      failed: false,
    })
    const engine = new SimulationEngine({ runtime: fake.runtime })

    engine.start(scenario)
    const [handle] = fake.scheduledHandles()
    fake.runFrame(handle, 16)
    const [handle2] = fake.scheduledHandles()
    fake.runFrame(handle2, 80)

    expect(engine.phase).toBe('resolved')
    const history = engine.getVitalsHistory()
    expect(history.length).toBeGreaterThan(0)
    expect(history.at(-1)!.hr).toBe(engine.state.hr)
  })
})

describe('SimulationEngine obstructed airway', () => {
  it('records but does not oxygenate bag breaths while the airway is obstructed', () => {
    const fake = createRuntime()
    const engine = new SimulationEngine({ runtime: fake.runtime })
    engine.start(createScenario())
    engine.state.airwayObstructed = true
    engine.state.spo2 = 80
    engine.state.fio2 = 1.0

    engine.setManualVentilation(true)

    expect(engine.interventionList).toContain('manual-vent')
    expect(engine.state.spo2).toBe(80)

    // Once the obstruction clears (e.g. cricothyroidotomy), breaths work again.
    engine.setManualVentilation(false)
    engine.state.airwayObstructed = false
    fake.setNow(1000)
    engine.setManualVentilation(true)
    expect(engine.state.spo2).toBeGreaterThan(80)
  })
})
