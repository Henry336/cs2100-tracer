import { compile, printExpr } from './expr'
import { termText, termToCube } from './cube'
import { parseExpr, varsOf, type Expr } from './parse'
import type { Bit, BoolFunction, CellValue, Explain, Issue, Span } from './types'

const SIGMA = 'Σ'
const PI = 'Π'
const AND = '∙'

export const defaultVars = (n: number): string[] => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const sortNum = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b)

/** Value of every row: 1, 0 or X. */
export function valuesOf(fn: BoolFunction): CellValue[] {
  const on = new Set(fn.on)
  const dc = new Set(fn.dc)
  return range(1 << fn.vars.length).map((m) => (on.has(m) ? 1 : dc.has(m) ? 'X' : 0))
}

export function offOf(fn: BoolFunction): number[] {
  return valuesOf(fn).flatMap((v, m) => (v === 0 ? [m] : []))
}

export function functionFromValues(vars: string[], values: CellValue[], name = 'F'): BoolFunction {
  return {
    name,
    vars,
    on: values.flatMap((v, m) => (v === 1 ? [m] : [])),
    dc: values.flatMap((v, m) => (v === 'X' ? [m] : [])),
  }
}

/** The function an expression computes (no don't-cares). */
export function functionFromExpr(e: Expr, vars: string[], name = 'F'): BoolFunction {
  const f = compile(e, vars)
  return { name, vars, on: range(1 << vars.length).filter((m) => f(m) === 1), dc: [] }
}

/* ---------- Parsing Σm / ΠM / expressions ---------- */

export interface FunctionOptions {
  /** Variables to use when the text has no F(A,B,...) header. */
  vars?: string[]
  name?: string
}

export type FunctionParse =
  | { ok: true; fn: BoolFunction; source: 'minterms' | 'maxterms' | 'expression'; expr?: Expr; warnings: Issue[]; why: Explain }
  | { ok: false; errors: Issue[]; warnings: Issue[] }

const HEADER = /^\s*([A-Za-z][A-Za-z0-9]*)\s*(?:\(([^()]*)\))?\s*=/
const LIST = /^\s*(Σ|∑|Π|∏|[Ss]um\s*-?|[Pp]rod\s*-?)?\s*([mMdDxX])?\s*\(([0-9,\s\-–.]*)\)/
const JOIN = /^\s*[+.∙·⋅*]?/
const VAR_NAME = /^[A-Za-z][0-9]*$/
const TERM_LIST = /^\s*[mM]\d+(\s*[+∙.·⋅*]\s*[mM]\d+)*\s*$/
const MAX_VARS = 16

/**
 * Parse `F(A,B,C,D) = Σm(1,3-5) + d(0,2)`, `ΠM(..) ∙ D(..)` / `X(..)`, `m(..) + x(..)`,
 * `Sum-m(..)`, `Prod-M(..)` (T06 SE2), or an expression. Ranges use - or .. (L13 p23).
 */
export function parseFunction(text: string, opts: FunctionOptions = {}): FunctionParse {
  const warnings: Issue[] = []
  const fail = (message: string, at: Span, code = 'function'): FunctionParse => ({ ok: false, errors: [{ code, message, at }], warnings })
  let name = opts.name ?? 'F'
  let vars: string[] | undefined = opts.vars
  let pos = 0
  const head = HEADER.exec(text)
  if (head) {
    name = head[1]
    if (head[2] !== undefined) {
      vars = head[2].split(',').map((s) => s.trim())
      const bad = vars.find((v) => !VAR_NAME.test(v))
      if (bad !== undefined) return fail(`'${bad}' is not a variable name (one letter, optional digits)`, [0, head[0].length])
      if (new Set(vars).size !== vars.length) return fail('a variable is listed twice', [0, head[0].length])
    }
    pos = head[0].length
  }

  if (vars && vars.length > MAX_VARS) return fail(`too many variables (${MAX_VARS} at most)`, [0, pos])
  // Largest index any list may hold: 2^n - 1, or the 16-variable cap when n comes from the indices.
  const limit = (1 << (vars?.length ?? MAX_VARS)) - 1
  const tooBig = (i: number, at: Span) =>
    fail(vars ? `index ${i} is too big for ${vars.length} variables (0 to ${limit})` : `index ${i} is too big: ${MAX_VARS} variables at most (0 to ${limit})`, at, 'range')

  // Index-list form.
  const lists: { kind: 'm' | 'M' | 'd'; items: number[]; at: Span }[] = []
  let rest = text.slice(pos)
  let offset = pos
  // L13 p23-24 writes F = m1 + m3 + m4 and F = M0 ∙ M2 ∙ M3. Names that are header variables stay an expression.
  const named = TERM_LIST.exec(rest)
  if (named && !(vars && [...rest.matchAll(/[mM]\d+/g)].every((t) => vars!.includes(t[0])))) {
    const terms = [...rest.matchAll(/([mM])(\d+)/g)]
    const ops = [...rest.matchAll(/[+∙.·⋅*]/g)].map((o) => (o[0] === '+' ? '+' : '∙'))
    const letter = terms[0][1]
    if (terms.some((t) => t[1] !== letter) || ops.some((o) => o !== (letter === 'm' ? '+' : '∙')))
      return fail('write minterms as m1 + m3 (joined by +) and maxterms as M0 ∙ M2 (joined by ∙)', [pos, text.length], 'term-list')
    const items = terms.map((t) => Number(t[2]))
    const big = items.find((i) => i > limit)
    if (big !== undefined) return tooBig(big, [pos, text.length])
    lists.push({ kind: letter === 'm' ? 'm' : 'M', items, at: [pos, text.length] })
    rest = ''
  }
  while (rest) {
    const lm = LIST.exec(rest)
    if (!lm) break
    const pre = (lm[1] ?? '').toLowerCase()
    const letter = lm[2] ?? ''
    let kind: 'm' | 'M' | 'd' | null
    if (/[dDxX]/.test(letter)) kind = 'd'
    else if (pre.startsWith('σ') || pre.startsWith('∑') || pre.startsWith('sum')) kind = 'm'
    else if (pre.startsWith('π') || pre.startsWith('∏') || pre.startsWith('prod')) kind = 'M'
    else kind = letter === 'm' ? 'm' : letter === 'M' ? 'M' : null
    if (!kind) break
    const at: Span = [offset, offset + lm[0].length]
    const items: number[] = []
    for (const raw of lm[3].split(',')) {
      const item = raw.trim()
      if (!item) continue
      const r = /^(\d+)\s*(?:-|–|\.\.)\s*(\d+)$/.exec(item)
      if (r) {
        const [a, b] = [Number(r[1]), Number(r[2])]
        if (a > b) return fail(`range ${item} runs backwards`, at)
        if (b > limit) return tooBig(b, at)
        for (let i = a; i <= b; i++) items.push(i)
      } else if (/^\d+$/.test(item)) {
        if (Number(item) > limit) return tooBig(Number(item), at)
        items.push(Number(item))
      }
      else return fail(`'${item}' is not an index or a range like 3-5`, at)
    }
    lists.push({ kind, items, at })
    const after = rest.slice(lm[0].length)
    const j = JOIN.exec(after)![0].length
    rest = after.slice(j)
    offset = at[1] + j
  }

  if (lists.length) {
    if (rest.trim()) return fail(`unexpected text '${rest.trim()}' after the index lists`, [offset, text.length])
    const mains = lists.filter((l) => l.kind !== 'd')
    if (mains.length !== 1)
      return fail(mains.length ? `write one Σm or ΠM list, not ${mains.length}` : `the don't-care list needs a Σm or ΠM list before it`, lists[0].at)
    const main = mains[0]
    const dc = sortNum(lists.filter((l) => l.kind === 'd').flatMap((l) => l.items))
    const all = [...main.items, ...dc]
    if (!vars) {
      const max = all.reduce((a, b) => (b > a ? b : a), 0)
      const n = Math.max(2, max.toString(2).length)
      vars = defaultVars(n)
      warnings.push({ code: 'vars-assumed', message: `assumed ${n} variables ${vars.join(',')}; write ${name}(A,B,C) = ... to choose them`, at: [0, 0] })
    }
    const size = 1 << vars.length
    const out = all.find((i) => i >= size)
    if (out !== undefined) return fail(`index ${out} is too big for ${vars.length} variables (0 to ${size - 1})`, main.at, 'range')
    const dcSet = new Set(dc)
    const clash = main.items.find((i) => dcSet.has(i))
    if (clash !== undefined) return fail(`${clash} is in both the main list and the don't-care list`, main.at, 'overlap')
    const listed = sortNum(main.items)
    const listedSet = new Set(listed)
    const on = main.kind === 'm' ? listed : range(size).filter((m) => !listedSet.has(m) && !dcSet.has(m))
    return {
      ok: true,
      fn: { name, vars, on, dc },
      source: main.kind === 'm' ? 'minterms' : 'maxterms',
      warnings,
      why:
        main.kind === 'm'
          ? { rule: `${SIGMA}m lists the rows where ${name} = 1; d lists the don't-cares.`, cite: 'L13 p23; L15 p45' }
          : {
              rule: `${PI}M lists the rows where ${name} = 0, so ${name} = 1 on every other row that is not a don't-care.`,
              working: `${SIGMA}m(${on.join(',')})${dc.length ? ` + d(${dc.join(',')})` : ''}`,
              cite: 'L13 p24-25; T06 Q3(b)',
            },
    }
  }

  // Expression form.
  const body = text.slice(pos)
  const shift = (i: Issue): Issue => ({ ...i, at: [i.at[0] + pos, i.at[1] + pos] })
  const parsed = parseExpr(body)
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map(shift), warnings: [...warnings, ...parsed.warnings.map(shift)] }
  warnings.push(...parsed.warnings.map(shift))
  const used = varsOf(parsed.expr)
  if (vars) {
    const extra = used.find((v) => !vars!.includes(v))
    if (extra) return fail(`${extra} is not one of ${name}'s variables (${vars.join(',')}); names are case-sensitive`, [pos, text.length], 'unknown-var')
  } else vars = [...used].sort()
  if (vars.length === 0) vars = defaultVars(1)
  if (vars.length > MAX_VARS) return fail(`too many variables (${MAX_VARS} at most)`, [pos, text.length])
  return {
    ok: true,
    fn: functionFromExpr(parsed.expr, vars, name),
    source: 'expression',
    expr: parsed.expr,
    warnings,
    why: { rule: `Evaluate the expression on every row; ${name} = 1 rows are its minterms.`, cite: 'L13 p7-8' },
  }
}

/* ---------- Canonical forms (L13 p19-25) ---------- */

export interface TermInfo {
  index: number
  bits: string
  minterm: string
  maxterm: string
  why: Explain
}

/** m_i and M_i for one index. The first variable is the MSB (L13 p21). */
export function termInfo(index: number, vars: string[]): TermInfo {
  const n = vars.length
  const bits = index.toString(2).padStart(n, '0')
  const full = (1 << n) - 1
  return {
    index,
    bits,
    minterm: termText({ mask: full, bits: index }, vars, 'sop'),
    maxterm: termText({ mask: full, bits: index }, vars, 'pos'),
    why: {
      rule: 'Write the index in binary under the variables. In a minterm a 0 bit gives a complemented literal; in a maxterm a 0 bit gives an uncomplemented literal.',
      working: `${index} = ${vars.map((v, i) => `${v}=${bits[i]}`).join(' ')}`,
      cite: 'L13 p19-21',
    },
  }
}

export type TermIdentify =
  | { ok: true; kind: 'minterm' | 'maxterm'; index: number; info: TermInfo; why: Explain }
  | { ok: false; errors: Issue[] }

/** Name a typed minterm (A'∙B'∙C∙D = m3) or maxterm (A+B+C'+D' = M3). */
export function identifyTerm(text: string, vars: string[]): TermIdentify {
  const p = parseExpr(text)
  if (!p.ok) return p
  const full = (1 << vars.length) - 1
  const err = (message: string): TermIdentify => ({ ok: false, errors: [{ code: 'term', message, at: [0, text.length] }] })
  const extra = p.vars.find((v) => !vars.includes(v))
  if (extra) return err(`${extra} is not one of ${vars.join(',')}`)
  for (const kind of ['minterm', 'maxterm'] as const) {
    const t = termToCube(p.expr, vars, kind === 'minterm' ? 'sop' : 'pos')
    if (!t || !('cube' in t)) continue
    if (t.cube.mask !== full) return err(`a ${kind} needs every variable exactly once; missing ${vars.filter((_, i) => !(t.cube.mask & (1 << (vars.length - 1 - i)))).join(', ')}`)
    const index = t.cube.bits
    const bits = index.toString(2).padStart(vars.length, '0')
    return {
      ok: true,
      kind,
      index,
      info: termInfo(index, vars),
      why: {
        rule:
          kind === 'minterm'
            ? 'A minterm is 1 on one row: read each plain literal as 1 and each complemented literal as 0.'
            : 'A maxterm is 0 on one row: read each plain literal as 0 and each complemented literal as 1.',
        working: `${vars.map((v, i) => `${v}=${bits[i]}`).join(' ')} gives ${bits} = ${index}, so ${kind === 'minterm' ? 'm' : 'M'}${index}`,
        cite: 'L13 p21',
      },
    }
  }
  return err('not a minterm (AND of every variable) or a maxterm (OR of every variable)')
}

export interface Canonical {
  minterms: number[]
  maxterms: number[]
  dontCares: number[]
  /** Σm(..) + d(..) */
  sigma: string
  /** ΠM(..) ∙ D(..) */
  pi: string
  /** Comma lists as typed in fill-in-the-blank answers, e.g. "2,5,6". */
  fitbMinterms: string
  fitbMaxterms: string
  sumOfMinterms: string
  productOfMaxterms: string
  why: { sigma: Explain; pi: Explain }
}

export function canonical(fn: BoolFunction): Canonical {
  const off = offOf(fn)
  const d = fn.dc.length ? fn.dc.join(', ') : ''
  const full = (1 << fn.vars.length) - 1
  return {
    minterms: fn.on,
    maxterms: off,
    dontCares: fn.dc,
    sigma: `${SIGMA}m(${fn.on.join(', ')})${d ? ` + d(${d})` : ''}`,
    pi: `${PI}M(${off.join(', ')})${d ? ` ${AND} D(${d})` : ''}`,
    fitbMinterms: fn.on.join(','),
    fitbMaxterms: off.join(','),
    sumOfMinterms: fn.on.length ? fn.on.map((m) => termText({ mask: full, bits: m }, fn.vars, 'sop')).join(' + ') : '0',
    productOfMaxterms: off.length ? off.map((m) => `(${termText({ mask: full, bits: m }, fn.vars, 'pos')})`).join(AND) : '1',
    why: {
      sigma: { rule: `${SIGMA}m lists the rows where ${fn.name} = 1 (canonical SOP).`, cite: 'L13 p23' },
      pi: {
        rule: `${PI}M lists the rows where ${fn.name} = 0 (canonical POS): every index not in ${SIGMA}m and not a don't-care.`,
        working: `m_i' = M_i, so ${fn.name}' = ${SIGMA}m(${off.join(',')}) gives ${fn.name} = ${PI}M(${off.join(',')})`,
        cite: 'L13 p24-25',
      },
    },
  }
}

/* ---------- Combining functions (T06 SE2, AY25/26 Q17a) ---------- */

export type CombineOp = 'and' | 'or' | 'xor'

/**
 * F+G, F∙G, F⊕G row by row. Don't-cares follow 3-valued logic: 0∙X = 0, 1+X = 1, otherwise X.
 * Returns null if the variable lists differ.
 */
export function combine(f: BoolFunction, g: BoolFunction, op: CombineOp, name = 'H'): { fn: BoolFunction; why: Explain } | null {
  if (f.vars.join() !== g.vars.join()) return null
  const a = valuesOf(f)
  const b = valuesOf(g)
  const vals = a.map((x, m): CellValue => {
    const y = b[m]
    if (op === 'and') return x === 0 || y === 0 ? 0 : x === 1 && y === 1 ? 1 : 'X'
    if (op === 'or') return x === 1 || y === 1 ? 1 : x === 0 && y === 0 ? 0 : 'X'
    return x === 'X' || y === 'X' ? 'X' : x === y ? 0 : 1
  })
  const fn = functionFromValues(f.vars, vals, name)
  const sym = op === 'and' ? AND : op === 'or' ? '+' : '⊕'
  return {
    fn,
    why: {
      rule:
        op === 'and'
          ? 'F∙G is 1 where both are 1: the intersection of the minterm lists.'
          : op === 'or'
            ? 'F+G is 1 where either is 1: the union of the minterm lists.'
            : 'F⊕G is 1 where exactly one is 1: the symmetric difference of the minterm lists.',
      working: `${f.name}${sym}${g.name} = ${SIGMA}m(${fn.on.join(',')})${fn.dc.length ? ` + d(${fn.dc.join(',')})` : ''}`,
      cite: 'T06 SE2; AY25/26 Q17a',
    },
  }
}

export function complementOf(fn: BoolFunction, name = `${fn.name}'`): BoolFunction {
  return { name, vars: fn.vars, on: offOf(fn), dc: fn.dc }
}

/* ---------- Truth table (L13 p7-8) ---------- */

export interface TruthTable {
  vars: string[]
  /** Input columns first, then one column per distinct sub-expression, the whole expression last. */
  columns: { label: string; input: boolean }[]
  rows: { index: number; values: Bit[] }[]
}

export function truthTable(e: Expr, vars: string[]): TruthTable {
  const subs: Expr[] = []
  const seen = new Set<string>(vars)
  const walk = (x: Expr) => {
    if (x.kind === 'not') walk(x.arg)
    else if (x.kind !== 'var' && x.kind !== 'const') x.args.forEach(walk)
    const label = printExpr(x)
    if (!seen.has(label)) {
      seen.add(label)
      subs.push(x)
    }
  }
  walk(e)
  const cols = [...vars.map((v): Expr => ({ kind: 'var', name: v, span: [0, 0] })), ...subs]
  const fs = cols.map((c) => compile(c, vars))
  return {
    vars,
    columns: cols.map((c, i) => ({ label: printExpr(c), input: i < vars.length })),
    rows: range(1 << vars.length).map((index) => ({ index, values: fs.map((f) => f(index)) })),
  }
}

/* ---------- Equivalence (L13 p7-8, p14) ---------- */

export interface Counterexample {
  index: number
  assignment: Record<string, Bit>
  left: Bit
  right: Bit
}

export interface Equivalence {
  equivalent: boolean
  vars: string[]
  /** Rows where the two sides differ. */
  differing: number[]
  counterexample?: Counterexample
  why: Explain
}

export const assignmentOf = (index: number, vars: string[]): Record<string, Bit> =>
  Object.fromEntries(vars.map((v, i) => [v, ((index >> (vars.length - 1 - i)) & 1) as Bit]))

/** Compare two expressions on every row (or only rows where `care` is true). */
export function checkEquivalence(a: Expr, b: Expr, vars?: string[], care?: (m: number) => boolean): Equivalence {
  const vs = vars ?? [...new Set([...varsOf(a), ...varsOf(b)])].sort()
  const fa = compile(a, vs)
  const fb = compile(b, vs)
  const differing = range(1 << vs.length).filter((m) => (!care || care(m)) && fa(m) !== fb(m))
  const first = differing[0]
  const counterexample = first === undefined ? undefined : { index: first, assignment: assignmentOf(first, vs), left: fa(first), right: fb(first) }
  return {
    equivalent: differing.length === 0,
    vars: vs,
    differing,
    counterexample,
    why: counterexample
      ? {
          rule: 'One row where the two sides differ is enough to show they are not equal.',
          working: `${vs.map((v) => `${v}=${counterexample.assignment[v]}`).join(', ')}: left = ${counterexample.left}, right = ${counterexample.right}`,
          cite: 'L13 p7-8; R07 p51',
        }
      : { rule: 'Both sides agree on all rows of the truth table, so they are equal.', working: `${1 << vs.length} rows checked`, cite: 'L13 p7-8, p14' },
  }
}
