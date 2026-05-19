import { describe, it, expect } from 'vitest'
import { createBaselineState } from '../../patient'
import { evaluatePredicate, parsePredicate, type PredicateContext } from './predicate'

function makeCtx(over: Partial<PredicateContext> = {}): PredicateContext {
  return {
    time: 0,
    phaseElapsed: 0,
    interventions: [],
    state: createBaselineState(),
    completedPhases: new Set(),
    ...over,
  }
}

describe('predicate tokenizer + parser', () => {
  it('parses simple comparison', () => {
    expect(evaluatePredicate('time > 30', makeCtx({ time: 31 }))).toBe(true)
    expect(evaluatePredicate('time > 30', makeCtx({ time: 30 }))).toBe(false)
  })

  it('parses boolean operators with precedence', () => {
    // && binds tighter than ||
    const ctx = makeCtx({ time: 10 })
    expect(evaluatePredicate('time > 5 && time < 20', ctx)).toBe(true)
    expect(evaluatePredicate('time > 5 && time < 5 || time > 5', ctx)).toBe(true)
    expect(evaluatePredicate('false || true && false', ctx)).toBe(false)
  })

  it('handles parens and unary !', () => {
    expect(evaluatePredicate('!(1 == 2)', makeCtx())).toBe(true)
    expect(evaluatePredicate('!true', makeCtx())).toBe(false)
  })

  it('supports string equality', () => {
    const state = createBaselineState()
    state.tubePosition = 'oesophagus'
    expect(evaluatePredicate("tube_position == 'oesophagus'", makeCtx({ state }))).toBe(true)
    expect(evaluatePredicate("tube_position == 'trachea'", makeCtx({ state }))).toBe(false)
    expect(evaluatePredicate("tube_position != 'trachea'", makeCtx({ state }))).toBe(true)
  })

  it('any() matches glob patterns', () => {
    const ctx = makeCtx({ interventions: ['adrenaline-10', 'fluid-bolus'] })
    expect(evaluatePredicate("any('adrenaline-*')", ctx)).toBe(true)
    expect(evaluatePredicate("any('dantrolene')", ctx)).toBe(false)
  })

  it('count() counts intervention applications', () => {
    const ctx = makeCtx({ interventions: ['fluid-bolus', 'fluid-bolus', 'adrenaline-1'] })
    expect(evaluatePredicate("count('fluid-bolus') >= 2", ctx)).toBe(true)
    expect(evaluatePredicate("count('adrenaline-1') == 1", ctx)).toBe(true)
    expect(evaluatePredicate("count('missing') == 0", ctx)).toBe(true)
  })

  it('phase_done() reads completedPhases', () => {
    const ctx = makeCtx({ completedPhases: new Set(['onset']) })
    expect(evaluatePredicate("phase_done('onset')", ctx)).toBe(true)
    expect(evaluatePredicate("phase_done('recovery')", ctx)).toBe(false)
  })

  it('rejects unknown identifiers and functions', () => {
    expect(() => evaluatePredicate('nope', makeCtx())).toThrow(/unknown identifier/)
    expect(() => evaluatePredicate('bogus(1)', makeCtx())).toThrow(/unknown function/)
  })

  it('rejects malformed expressions', () => {
    expect(() => parsePredicate('1 +')).toThrow()
    expect(() => parsePredicate('time >')).toThrow()
    expect(() => parsePredicate('(1 == 1')).toThrow()
  })

  it('vital accessors read from state', () => {
    const state = createBaselineState()
    state.spo2 = 85
    state.hr = 130
    const ctx = makeCtx({ state })
    expect(evaluatePredicate('spo2 < 92 && hr > 100', ctx)).toBe(true)
  })
})
