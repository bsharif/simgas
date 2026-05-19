import type { PatientState } from '../../patient'

/**
 * Tiny expression language for scenario predicates (enter_when, resolve_when,
 * fail_when). Hand-rolled tokenizer + Pratt parser, no eval, no surprises.
 *
 * Grammar:
 *   expr     := or
 *   or       := and ('||' and)*
 *   and      := equality ('&&' equality)*
 *   equality := comparison (('==' | '!=') comparison)*
 *   comparison := unary (('<' | '<=' | '>' | '>=') unary)*
 *   unary    := '!' unary | primary
 *   primary  := number | string | bool | ident ( '(' args ')' )? | '(' expr ')'
 *
 * Available variables (read from PredicateContext):
 *   time, phase_elapsed                — numbers (seconds)
 *   hr, spo2, etco2, rr, temp          — current vital values
 *   tube_position                       — string
 *
 * Available functions:
 *   any('id-glob')                     — bool: is any matching intervention in history?
 *   count('id')                        — number: applications of this intervention
 *   phase_done('id')                   — bool: has the named phase completed?
 *
 * Literals: numbers, single- or double-quoted strings, true / false.
 */

export interface PredicateContext {
  time: number
  phaseElapsed: number
  interventions: readonly string[]
  state: PatientState
  completedPhases: ReadonlySet<string>
}

type TokenKind =
  | 'number' | 'string' | 'ident'
  | 'op' | 'lparen' | 'rparen' | 'comma'

interface Token {
  kind: TokenKind
  value: string
  pos: number
}

type Ast =
  | { kind: 'lit'; value: number | string | boolean }
  | { kind: 'var'; name: string }
  | { kind: 'call'; name: string; args: Ast[] }
  | { kind: 'unary'; op: '!'; arg: Ast }
  | { kind: 'binary'; op: string; left: Ast; right: Ast }

const KEYWORDS = new Set(['true', 'false'])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    const c = input[i]

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }

    if (c === '(') { tokens.push({ kind: 'lparen', value: c, pos: i }); i++; continue }
    if (c === ')') { tokens.push({ kind: 'rparen', value: c, pos: i }); i++; continue }
    if (c === ',') { tokens.push({ kind: 'comma', value: c, pos: i }); i++; continue }

    if (c === "'" || c === '"') {
      const start = i
      const quote = c
      i++
      let value = ''
      while (i < len && input[i] !== quote) {
        value += input[i]
        i++
      }
      if (i >= len) throw new Error(`unterminated string at ${start}: ${input}`)
      i++ // closing quote
      tokens.push({ kind: 'string', value, pos: start })
      continue
    }

    if (c >= '0' && c <= '9') {
      const start = i
      while (i < len && (
        (input[i] >= '0' && input[i] <= '9') || input[i] === '.'
      )) i++
      tokens.push({ kind: 'number', value: input.slice(start, i), pos: start })
      continue
    }

    // Multi-char operators
    const twoChar = input.slice(i, i + 2)
    if (twoChar === '&&' || twoChar === '||' || twoChar === '==' || twoChar === '!=' || twoChar === '<=' || twoChar === '>=') {
      tokens.push({ kind: 'op', value: twoChar, pos: i })
      i += 2
      continue
    }

    if (c === '!' || c === '<' || c === '>') {
      tokens.push({ kind: 'op', value: c, pos: i })
      i++
      continue
    }

    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      const start = i
      while (i < len && (
        (input[i] >= 'a' && input[i] <= 'z') ||
        (input[i] >= 'A' && input[i] <= 'Z') ||
        (input[i] >= '0' && input[i] <= '9') ||
        input[i] === '_'
      )) i++
      tokens.push({ kind: 'ident', value: input.slice(start, i), pos: start })
      continue
    }

    throw new Error(`unexpected character ${JSON.stringify(c)} at ${i} in: ${input}`)
  }

  return tokens
}

class Parser {
  private idx = 0
  private readonly tokens: Token[]
  private readonly source: string
  constructor(tokens: Token[], source: string) {
    this.tokens = tokens
    this.source = source
  }

  parse(): Ast {
    const ast = this.parseOr()
    if (this.idx < this.tokens.length) {
      const t = this.tokens[this.idx]
      throw new Error(`unexpected token ${JSON.stringify(t.value)} at ${t.pos} in: ${this.source}`)
    }
    return ast
  }

  private parseOr(): Ast {
    let left = this.parseAnd()
    while (this.peekOp('||')) {
      this.idx++
      const right = this.parseAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  private parseAnd(): Ast {
    let left = this.parseEquality()
    while (this.peekOp('&&')) {
      this.idx++
      const right = this.parseEquality()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  private parseEquality(): Ast {
    let left = this.parseComparison()
    while (this.peekOp('==') || this.peekOp('!=')) {
      const op = this.tokens[this.idx].value
      this.idx++
      const right = this.parseComparison()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseComparison(): Ast {
    let left = this.parseUnary()
    while (this.peekOp('<') || this.peekOp('<=') || this.peekOp('>') || this.peekOp('>=')) {
      const op = this.tokens[this.idx].value
      this.idx++
      const right = this.parseUnary()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseUnary(): Ast {
    if (this.peekOp('!')) {
      this.idx++
      const arg = this.parseUnary()
      return { kind: 'unary', op: '!', arg }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Ast {
    if (this.idx >= this.tokens.length) {
      throw new Error(`unexpected end of expression in: ${this.source}`)
    }
    const t = this.tokens[this.idx]
    if (t.kind === 'number') {
      this.idx++
      return { kind: 'lit', value: parseFloat(t.value) }
    }
    if (t.kind === 'string') {
      this.idx++
      return { kind: 'lit', value: t.value }
    }
    if (t.kind === 'ident') {
      this.idx++
      if (KEYWORDS.has(t.value)) {
        return { kind: 'lit', value: t.value === 'true' }
      }
      // Function call?
      if (this.peek('lparen')) {
        this.idx++
        const args: Ast[] = []
        if (!this.peek('rparen')) {
          args.push(this.parseOr())
          while (this.peek('comma')) {
            this.idx++
            args.push(this.parseOr())
          }
        }
        this.expect('rparen')
        return { kind: 'call', name: t.value, args }
      }
      return { kind: 'var', name: t.value }
    }
    if (t.kind === 'lparen') {
      this.idx++
      const inner = this.parseOr()
      this.expect('rparen')
      return inner
    }
    throw new Error(`unexpected ${t.kind} ${JSON.stringify(t.value)} at ${t.pos} in: ${this.source}`)
  }

  private peek(kind: TokenKind): boolean {
    return this.idx < this.tokens.length && this.tokens[this.idx].kind === kind
  }

  private peekOp(op: string): boolean {
    return this.idx < this.tokens.length &&
      this.tokens[this.idx].kind === 'op' &&
      this.tokens[this.idx].value === op
  }

  private expect(kind: TokenKind): Token {
    if (!this.peek(kind)) {
      const t = this.tokens[this.idx]
      throw new Error(`expected ${kind}, got ${t ? `${t.kind} ${JSON.stringify(t.value)}` : 'end'} in: ${this.source}`)
    }
    return this.tokens[this.idx++]
  }
}

export function parsePredicate(source: string): Ast {
  const tokens = tokenize(source)
  return new Parser(tokens, source).parse()
}

function globMatch(glob: string, value: string): boolean {
  if (!glob.includes('*')) return glob === value
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(value)
}

function asNumber(v: unknown, where: string): number {
  if (typeof v !== 'number') throw new Error(`expected number in ${where}, got ${typeof v}`)
  return v
}

function asString(v: unknown, where: string): string {
  if (typeof v !== 'string') throw new Error(`expected string in ${where}, got ${typeof v}`)
  return v
}

function evalAst(ast: Ast, ctx: PredicateContext): number | string | boolean {
  switch (ast.kind) {
    case 'lit':
      return ast.value

    case 'var': {
      switch (ast.name) {
        case 'time': return ctx.time
        case 'phase_elapsed': return ctx.phaseElapsed
        case 'hr': return ctx.state.hr
        case 'spo2': return ctx.state.spo2
        case 'etco2': return ctx.state.etco2
        case 'rr': return ctx.state.rr
        case 'temp': return ctx.state.temp
        case 'tube_position': return ctx.state.tubePosition
        default:
          throw new Error(`unknown identifier: ${ast.name}`)
      }
    }

    case 'call': {
      switch (ast.name) {
        case 'any': {
          if (ast.args.length !== 1) throw new Error(`any() takes 1 argument`)
          const glob = asString(evalAst(ast.args[0], ctx), `any()`)
          return ctx.interventions.some(id => globMatch(glob, id))
        }
        case 'count': {
          if (ast.args.length !== 1) throw new Error(`count() takes 1 argument`)
          const id = asString(evalAst(ast.args[0], ctx), `count()`)
          return ctx.interventions.filter(x => x === id).length
        }
        case 'phase_done': {
          if (ast.args.length !== 1) throw new Error(`phase_done() takes 1 argument`)
          const id = asString(evalAst(ast.args[0], ctx), `phase_done()`)
          return ctx.completedPhases.has(id)
        }
        default:
          throw new Error(`unknown function: ${ast.name}`)
      }
    }

    case 'unary': {
      const v = evalAst(ast.arg, ctx)
      return !v
    }

    case 'binary': {
      const l = evalAst(ast.left, ctx)
      const r = evalAst(ast.right, ctx)
      switch (ast.op) {
        case '&&': return Boolean(l) && Boolean(r)
        case '||': return Boolean(l) || Boolean(r)
        case '==': return l === r
        case '!=': return l !== r
        case '<':  return asNumber(l, '<') <  asNumber(r, '<')
        case '<=': return asNumber(l, '<=') <= asNumber(r, '<=')
        case '>':  return asNumber(l, '>') >  asNumber(r, '>')
        case '>=': return asNumber(l, '>=') >= asNumber(r, '>=')
        default: throw new Error(`unknown operator: ${ast.op}`)
      }
    }
  }
}

export function evaluatePredicate(source: string, ctx: PredicateContext): boolean {
  const ast = parsePredicate(source)
  return Boolean(evalAst(ast, ctx))
}

/**
 * Pre-compile a predicate string into a closure. Used by the interpreter so
 * each predicate is parsed once at scenario load, not every tick.
 */
export function compilePredicate(source: string): (ctx: PredicateContext) => boolean {
  const ast = parsePredicate(source)
  return (ctx) => Boolean(evalAst(ast, ctx))
}
