import type { Issue, Span } from './types'

/**
 * Expression tree. `and`/`or` are n-ary chains as typed; `paren` marks a node the user wrapped in brackets.
 * Precedence is NOT, then AND, then OR (L13 p9). XOR/XNOR sit between AND and OR (not defined by the course;
 * mixing them without brackets gives a warning).
 */
export type Expr =
  | { kind: 'const'; value: 0 | 1; span: Span; paren?: boolean }
  | { kind: 'var'; name: string; span: Span; paren?: boolean }
  | { kind: 'not'; arg: Expr; span: Span; paren?: boolean }
  | { kind: 'and'; args: Expr[]; span: Span; paren?: boolean }
  | { kind: 'or'; args: Expr[]; span: Span; paren?: boolean }
  | { kind: 'xor' | 'xnor'; args: [Expr, Expr]; span: Span; paren?: boolean }

export type ParseResult =
  | { ok: true; expr: Expr; vars: string[]; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] }

type Tok =
  | { t: 'var'; name: string; at: Span }
  | { t: 'const'; value: 0 | 1; at: Span }
  | { t: 'not' | 'and' | 'or' | 'xor' | 'xnor' | '(' | ')'; at: Span; sym: string }

const SINGLE: Record<string, 'not' | 'and' | 'or' | 'xor' | 'xnor' | '(' | ')'> = {
  "'": 'not', '’': 'not', '′': 'not', '̄': 'not', '̅': 'not', '¯': 'not',
  '.': 'and', '∙': 'and', '·': 'and', '⋅': 'and', '*': 'and',
  '+': 'or', '⊕': 'xor', '^': 'xor', '⊙': 'xnor', '(': '(', ')': ')',
}
const BAR = new Set(['̄', '̅'])

const HINTS: Record<string, string> = {
  '&': 'use ∙ (or .) for AND',
  '∧': 'use ∙ (or .) for AND',
  '|': 'use + for OR',
  '∨': 'use + for OR',
  '~': "write NOT as ' after the term, e.g. A' or (A+B)'",
  '!': "write NOT as ' after the term, e.g. A' or (A+B)'",
  '¬': "write NOT as ' after the term, e.g. A' or (A+B)'",
  '=': 'an expression cannot contain =',
}

class Stop {
  issue: Issue
  constructor(issue: Issue) {
    this.issue = issue
  }
}
const stop = (code: string, message: string, at: Span, cite?: string): never => {
  throw new Stop({ code, message, at, cite })
}

function lex(src: string, warnings: Issue[]): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const nfd = ch.normalize('NFD')
    if (/[A-Za-z]/.test(nfd[0])) {
      if (nfd.length > 1 && !BAR.has(nfd[1])) stop('char', `unexpected character '${ch}'`, [i, i + 1])
      let j = i + 1
      if (nfd.length === 1) while (j < src.length && /[0-9]/.test(src[j])) j++
      toks.push({ t: 'var', name: nfd[0] + src.slice(i + 1, j), at: [i, j] })
      // A precomposed letter with a macron (e.g. A with bar) is the letter followed by an overbar NOT.
      if (nfd.length > 1) toks.push({ t: 'not', at: [i, i + 1], sym: nfd[1] })
      i = j
      continue
    }
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9]/.test(src[j])) j++
      const run = src.slice(i, j)
      if (run !== '0' && run !== '1') stop('number', `unexpected number '${run}': the only constants are 0 and 1`, [i, j])
      toks.push({ t: 'const', value: run === '1' ? 1 : 0, at: [i, j] })
      i = j
      continue
    }
    const kind = SINGLE[ch]
    if (!kind) stop('char', `unexpected character '${ch}'${HINTS[ch] ? `: ${HINTS[ch]}` : ''}`, [i, i + 1])
    if (ch === '*')
      warnings.push({ code: 'symbol', message: 'course notation writes AND as ∙ (or . in fill-in-the-blank), not *', at: [i, i + 1], cite: 'L13 p5' })
    toks.push({ t: kind, at: [i, i + 1], sym: ch })
    i++
  }
  return toks
}

/** Parse course notation: ' (or overbar) for NOT, ∙ . or juxtaposition for AND, + for OR, ⊕ ^ for XOR, ⊙ for XNOR. */
export function parseExpr(src: string): ParseResult {
  const warnings: Issue[] = []
  try {
    const toks = lex(src, warnings)
    if (toks.length === 0) stop('empty', 'type an expression', [0, src.length])
    let p = 0
    let depth = 0
    const end: Span = [src.length, src.length]
    const isStart = (tk: Tok | undefined) => !!tk && (tk.t === 'var' || tk.t === 'const' || tk.t === '(')
    const mixWarn = (e: Expr) =>
      warnings.push({
        code: 'xor-precedence',
        message: 'XOR mixed with AND/OR without brackets; the course does not define its precedence, so add brackets',
        at: e.span,
      })

    const primary = (): Expr => {
      const tk = toks[p]
      if (!tk) return stop('end', 'the expression ends too early', end)
      if (tk.t === 'var') {
        p++
        return { kind: 'var', name: tk.name, span: tk.at }
      }
      if (tk.t === 'const') {
        p++
        return { kind: 'const', value: tk.value, span: tk.at }
      }
      if (tk.t === '(') {
        // The parser recurses per bracket; cap it so URL text cannot overflow the stack.
        if (++depth > MAX_DEPTH) stop('deep', `brackets nested more than ${MAX_DEPTH} deep`, tk.at)
        p++
        const inner = or()
        depth--
        const close = toks[p]
        if (!close || close.t !== ')') return stop('paren', 'this ( is never closed', tk.at)
        p++
        return { ...inner, span: [tk.at[0], close.at[1]], paren: true }
      }
      if (tk.t === 'not') return stop('not', "' must come after the term it negates, e.g. A' or (A+B)'", tk.at, 'L13 p5')
      if (tk.t === ')') return stop('paren', 'this ) has no matching (', tk.at)
      return stop('operand', `missing a term before '${tk.sym}'`, tk.at)
    }
    const unary = (): Expr => {
      let e = primary()
      while (toks[p]?.t === 'not') {
        const tk = toks[p++]
        e = { kind: 'not', arg: e, span: [e.span[0], tk.at[1]] }
      }
      return e
    }
    const and = (): Expr => {
      const args = [unary()]
      for (;;) {
        const tk = toks[p]
        if (tk?.t === 'and') {
          p++
          if (!isStart(toks[p])) stop('operand', `missing a term after '${tk.sym}'`, tk.at)
        } else if (isStart(tk)) {
          const prev = args[args.length - 1]
          warnings.push({
            code: 'implicit-and',
            message: 'AND written without ∙: the course says always write it (AB reads as a 2-bit value)',
            at: [prev.span[0], tk!.at[1]],
            cite: 'T06 p2',
          })
        } else break
        args.push(unary())
      }
      return args.length === 1 ? args[0] : { kind: 'and', args, span: [args[0].span[0], args[args.length - 1].span[1]] }
    }
    const xor = (): Expr => {
      let left = and()
      while (toks[p]?.t === 'xor' || toks[p]?.t === 'xnor') {
        const tk = toks[p++] as Extract<Tok, { sym: string }>
        if (!isStart(toks[p])) stop('operand', `missing a term after '${tk.sym}'`, tk.at)
        const right = and()
        for (const side of [left, right]) if (side.kind === 'and' && !side.paren) mixWarn(side)
        left = { kind: tk.t as 'xor' | 'xnor', args: [left, right], span: [left.span[0], right.span[1]] }
      }
      return left
    }
    const or = (): Expr => {
      const args = [xor()]
      while (toks[p]?.t === 'or') {
        const tk = toks[p++]
        if (!isStart(toks[p])) stop('operand', "missing a term after '+'", tk.at)
        args.push(xor())
      }
      if (args.length === 1) return args[0]
      for (const a of args) if ((a.kind === 'xor' || a.kind === 'xnor') && !a.paren) mixWarn(a)
      return { kind: 'or', args, span: [args[0].span[0], args[args.length - 1].span[1]] }
    }

    const expr = or()
    if (p < toks.length) {
      const tk = toks[p]
      stop('extra', tk.t === ')' ? 'this ) has no matching (' : 'unexpected text after the expression', tk.at)
    }
    // Long runs of ' build a deep tree without recursion here; every tree walker recurses, so cap the depth.
    if (treeDepth(expr) > MAX_DEPTH) stop('deep', `the expression is nested more than ${MAX_DEPTH} levels deep`, expr.span)
    return { ok: true, expr, vars: varsOf(expr), warnings }
  } catch (e) {
    if (e instanceof Stop) return { ok: false, errors: [e.issue], warnings }
    throw e
  }
}

const MAX_DEPTH = 256

/** Tree depth, computed without recursion. */
function treeDepth(e: Expr): number {
  let max = 0
  const stack: [Expr, number][] = [[e, 1]]
  while (stack.length) {
    const [x, d] = stack.pop()!
    if (d > max) max = d
    if (d > MAX_DEPTH) break
    if (x.kind === 'not') stack.push([x.arg, d + 1])
    else if (x.kind !== 'var' && x.kind !== 'const') for (const a of x.args) stack.push([a, d + 1])
  }
  return max
}

/** Variables in order of first appearance. */
export function varsOf(e: Expr): string[] {
  const seen: string[] = []
  const walk = (x: Expr) => {
    if (x.kind === 'var') {
      if (!seen.includes(x.name)) seen.push(x.name)
    } else if (x.kind === 'not') walk(x.arg)
    else if (x.kind !== 'const') x.args.forEach(walk)
  }
  walk(e)
  return seen
}
