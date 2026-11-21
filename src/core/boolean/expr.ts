import type { Expr } from './parse'
import type { Bit, Explain, Span } from './types'

export type PrintStyle = 'course' | 'fitb'

const PREC: Record<Expr['kind'], number> = { or: 1, xor: 2, xnor: 2, and: 3, not: 4, var: 5, const: 5 }

/**
 * Print an expression. `course` uses ∙ and spaced +, `fitb` the exam fill-in-the-blank form
 * (' . + with no spaces, AY23/24 S2 Q19d). Brackets are added only where precedence needs them.
 */
export function printExpr(e: Expr, style: PrintStyle = 'course'): string {
  const AND = style === 'course' ? '∙' : '.'
  const OR = style === 'course' ? ' + ' : '+'
  const sp = style === 'course' ? ' ' : ''
  const wrap = (x: Expr, min: number) => (PREC[x.kind] < min ? `(${printExpr(x, style)})` : printExpr(x, style))
  switch (e.kind) {
    case 'const':
      return String(e.value)
    case 'var':
      return e.name
    case 'not':
      return `${wrap(e.arg, 4)}'`
    case 'and':
      return e.args.map((a) => wrap(a, 3)).join(AND)
    case 'or':
      return e.args.map((a) => printExpr(a, style)).join(OR)
    default:
      // Bracket every compound operand: the course never defines XOR precedence.
      return `${wrap(e.args[0], 4)}${sp}${e.kind === 'xor' ? '⊕' : '⊙'}${sp}${wrap(e.args[1], 4)}`
  }
}

/** Compile to a row evaluator. Row index bits follow `vars` with the first variable as MSB (L13 p21). */
export function compile(e: Expr, vars: string[]): (row: number) => Bit {
  const n = vars.length
  const go = (x: Expr): ((r: number) => Bit) => {
    switch (x.kind) {
      case 'const': {
        const v = x.value
        return () => v
      }
      case 'var': {
        const shift = n - 1 - vars.indexOf(x.name)
        return (r) => ((r >> shift) & 1) as Bit
      }
      case 'not': {
        const a = go(x.arg)
        return (r) => (a(r) ? 0 : 1)
      }
      case 'and': {
        const fs = x.args.map(go)
        return (r) => (fs.every((f) => f(r)) ? 1 : 0)
      }
      case 'or': {
        const fs = x.args.map(go)
        return (r) => (fs.some((f) => f(r)) ? 1 : 0)
      }
      default: {
        const [a, b] = x.args.map(go)
        const odd = x.kind === 'xor' ? 1 : 0
        return (r) => ((a(r) ^ b(r)) === odd ? 1 : 0)
      }
    }
  }
  return go(e)
}

/** Every row of the truth table (2^n values). */
export function rowsOf(e: Expr, vars: string[]): Bit[] {
  const f = compile(e, vars)
  return Array.from({ length: 1 << vars.length }, (_, r) => f(r))
}

/** Number of literals: every occurrence of a variable, complemented or not (L15 p4). */
export function countLiterals(e: Expr): number {
  if (e.kind === 'var') return 1
  if (e.kind === 'const') return 0
  if (e.kind === 'not') return countLiterals(e.arg)
  return e.args.reduce((s, a) => s + countLiterals(a), 0)
}

/** Product terms of an SOP-shaped tree, or sum terms of a POS-shaped tree (no shape check). */
export const termsOf = (e: Expr, op: 'or' | 'and'): Expr[] => (e.kind === op ? e.args.flatMap((a) => termsOf(a, op)) : [e])

export const isLiteral = (e: Expr): boolean => e.kind === 'var' || (e.kind === 'not' && e.arg.kind === 'var')

const SPAN: Span = [0, 0]

/** Dual: swap ∙ and +, swap 0 and 1, keep every literal (L13 p11). XOR and XNOR swap too. */
export function dualOf(e: Expr): Expr {
  switch (e.kind) {
    case 'const':
      return { kind: 'const', value: e.value ? 0 : 1, span: SPAN }
    case 'var':
      return e
    case 'not':
      return { kind: 'not', arg: dualOf(e.arg), span: SPAN }
    case 'and':
    case 'or':
      return { kind: e.kind === 'and' ? 'or' : 'and', args: e.args.map(dualOf), span: SPAN }
    default:
      return { kind: e.kind === 'xor' ? 'xnor' : 'xor', args: [dualOf(e.args[0]), dualOf(e.args[1])], span: SPAN }
  }
}

/** Complement pushed down to the literals with DeMorgan: the dual with every literal flipped (L13 p15). */
export function negationOf(e: Expr): Expr {
  switch (e.kind) {
    case 'const':
      return { kind: 'const', value: e.value ? 0 : 1, span: SPAN }
    case 'var':
      return { kind: 'not', arg: e, span: SPAN }
    case 'not':
      return e.arg
    case 'and':
    case 'or':
      return { kind: e.kind === 'and' ? 'or' : 'and', args: e.args.map(negationOf), span: SPAN }
    default:
      // (A⊕B)' = A⊙B: keep the operands, swap the operator.
      return { kind: e.kind === 'xor' ? 'xnor' : 'xor', args: e.args, span: SPAN }
  }
}

/* ---------- SOP / POS classification (L13 p16-18) ---------- */

export interface FormVerdict {
  yes: boolean
  why: Explain
  /** The sub-expression that stops it being this form. */
  breaker?: Span
}

export interface Classification {
  sop: FormVerdict
  pos: FormVerdict
  canonicalSop: FormVerdict
  canonicalPos: FormVerdict
  literals: { value: number; why: Explain }
}

function checkForm(e: Expr, outer: 'or' | 'and'): { ok: boolean; breaker?: Expr } {
  const inner = outer === 'or' ? 'and' : 'or'
  if (e.kind === 'const') return { ok: true }
  for (const term of termsOf(e, outer)) {
    if (isLiteral(term)) continue
    if (term.kind !== inner) return { ok: false, breaker: term }
    const bad = termsOf(term, inner).find((l) => !isLiteral(l))
    if (bad) return { ok: false, breaker: bad }
  }
  return { ok: true }
}

/** SOP, POS and canonical verdicts. `vars` is the function's variable list (for the canonical check). */
export function classify(e: Expr, vars: string[]): Classification {
  const verdict = (outer: 'or' | 'and'): FormVerdict => {
    const name = outer === 'or' ? 'SOP' : 'POS'
    const term = outer === 'or' ? 'product term' : 'sum term'
    const r = checkForm(e, outer)
    if (r.ok)
      return {
        yes: true,
        why: {
          rule: `${name}: ${outer === 'or' ? 'an OR' : 'an AND'} of ${term}s, where a ${term} is one literal or ${outer === 'or' ? 'an AND' : 'an OR'} of literals. A single literal or constant counts.`,
          cite: 'L13 p16-17; T06 p2',
        },
      }
    const b = r.breaker!
    const why =
      b.kind === 'xor' || b.kind === 'xnor'
        ? `${printExpr(b)} uses ${b.kind === 'xor' ? '⊕' : '⊙'}, which is not an SOP or POS operator (T08 Q4)`
        : `${printExpr(b)} is not a ${b.kind === 'not' ? 'literal (only a single variable may be complemented)' : term}`
    return { yes: false, why: { rule: `${name} needs every term to be a ${term} of literals.`, working: why, cite: 'L13 p16-18' }, breaker: b.span }
  }
  const canonical = (outer: 'or' | 'and', base: FormVerdict): FormVerdict => {
    const name = outer === 'or' ? 'canonical SOP (sum of minterms)' : 'canonical POS (product of maxterms)'
    const rule = `A ${name} has every variable exactly once in every term.`
    if (!base.yes || e.kind === 'const') return { yes: false, why: { rule, working: base.yes ? 'a constant has no terms' : 'it is not in the basic form', cite: 'L13 p22-25' } }
    for (const t of termsOf(e, outer)) {
      const lits = termsOf(t, outer === 'or' ? 'and' : 'or')
      const names = lits.map((l) => (l.kind === 'var' ? l.name : l.kind === 'not' && l.arg.kind === 'var' ? l.arg.name : ''))
      const missing = vars.filter((v) => !names.includes(v))
      if (missing.length || new Set(names).size !== names.length)
        return {
          yes: false,
          why: { rule, working: `${printExpr(t)} ${missing.length ? `is missing ${missing.join(', ')}` : 'repeats a variable'}`, cite: 'L13 p22-25' },
          breaker: t.span,
        }
    }
    return { yes: true, why: { rule, cite: 'L13 p22-25' } }
  }
  const sop = verdict('or')
  const pos = verdict('and')
  const lits = countLiterals(e)
  return {
    sop,
    pos,
    canonicalSop: canonical('or', sop),
    canonicalPos: canonical('and', pos),
    literals: { value: lits, why: { rule: 'Count every occurrence of a literal.', working: `${printExpr(e)} has ${lits}`, cite: 'L15 p4' } },
  }
}
