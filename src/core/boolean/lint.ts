import { termText, termToCube, mintermsOf, sameCube } from './cube'
import { classify, compile, countLiterals, printExpr, termsOf } from './expr'
import { assignmentOf, valuesOf } from './func'
import { minimize, MAX_MIN_VARS } from './minimize'
import { parseExpr, type Expr } from './parse'
import type { BoolFunction, Cube, Explain, Form, Span } from './types'

export interface LintOptions {
  /** Expected form. 'any' accepts SOP or POS. Default 'sop'. */
  form?: Form | 'any'
  /** Apply the exam fill-in-the-blank rules (' . + only, no spaces, alphabetical literals). Default true. */
  fitb?: boolean
  /** The question asks for EPIs first (AY23/24 S2 Q19d). Default false. */
  epiFirst?: boolean
}

export type CheckStatus = 'pass' | 'fail' | 'warn'

export interface LintCheck {
  id: 'syntax' | 'variables' | 'dots' | 'symbols' | 'spaces' | 'form' | 'equivalent' | 'term' | 'minimal' | 'order' | 'epi-first' | 'xor'
  status: CheckStatus
  message: string
  why?: Explain
  at?: Span
}

export interface TermReport {
  text: string
  at: Span
  /** prime: a PI; implicant: valid but could be bigger; dc-only: covers only don't-cares; wrong: covers a cell it must not; never: always 0 (SOP) or 1 (POS). */
  kind: 'prime' | 'implicant' | 'dc-only' | 'wrong' | 'never' | 'constant'
  prime?: number
}

export interface LintResult {
  verdict: 'correct' | 'format' | 'not-minimal' | 'wrong' | 'invalid'
  checks: LintCheck[]
  equivalent: boolean
  minimal: boolean
  /** Care rows where the answer differs from the function. */
  differing: number[]
  terms: TermReport[]
  literals: number
  best?: { terms: number; literals: number; answer: string }
  /** Index into minimize(...).covers when the answer is exactly one of the minimal covers. */
  matchedCover?: number
  expr?: Expr
}

const FITB_CHARS = /^[A-Za-z0-9'.+()]$/

/** Check a typed answer against a function: syntax, form, equivalence, minimality and exam format. */
export function lintAnswer(text: string, fn: BoolFunction, opts: LintOptions = {}): LintResult {
  const fitb = opts.fitb ?? true
  const want = opts.form ?? 'sop'
  const checks: LintCheck[] = []
  const out = (verdict: LintResult['verdict'], extra: Partial<LintResult> = {}): LintResult => ({
    verdict,
    checks,
    equivalent: false,
    minimal: false,
    differing: [],
    terms: [],
    literals: 0,
    ...extra,
  })

  const parsed = parseExpr(text)
  if (!parsed.ok) {
    for (const e of parsed.errors) checks.push({ id: 'syntax', status: 'fail', message: e.message, at: e.at, why: e.cite ? { rule: e.message, cite: e.cite } : undefined })
    return out('invalid')
  }
  const expr = parsed.expr
  const unknown = parsed.vars.filter((v) => !fn.vars.includes(v))
  if (unknown.length) {
    checks.push({
      id: 'variables',
      status: 'fail',
      message: `${unknown.join(', ')} ${unknown.length > 1 ? 'are' : 'is'} not ${fn.name}'s variable${unknown.length > 1 ? 's' : ''} (${fn.vars.join(', ')}); names are case-sensitive`,
    })
    return out('invalid', { expr })
  }
  let format = false
  for (const w of parsed.warnings) {
    // Tutorials give zero marks for xy instead of x∙y (T06 Ans p1). The AY23/24 S2 fill-in-the-blank key itself
    // prints answers without dots, so there it is only a warning.
    if (w.code === 'implicit-and') {
      if (!fitb) format = true
      checks.push({
        id: 'dots',
        status: fitb ? 'warn' : 'fail',
        message: `${text.slice(w.at[0], w.at[1])}: write ${fitb ? '.' : '∙'} between literals; AB reads as a 2-bit value`,
        at: w.at,
        why: fitb
          ? { rule: 'Always write the AND operator.', working: 'the AY23/24 S2 key itself prints answers without dots, so this may not lose marks there', cite: 'T06 p2; AY23/24 S2 Ans p19' }
          : { rule: 'Always write the AND operator: writing xy for x∙y gets zero marks in tutorials.', cite: 'T06 Ans p1; L13 p6' },
      })
    }
    else if (w.code === 'xor-precedence') checks.push({ id: 'xor', status: 'warn', message: w.message, at: w.at })
  }
  if (fitb) {
    const bad = [...new Set([...text].filter((ch) => !/\s/.test(ch) && !FITB_CHARS.test(ch)))]
    if (bad.length) {
      format = true
      checks.push({
        id: 'symbols',
        status: 'fail',
        message: `fill-in-the-blank answers use only letters, 0, 1, ' . + and brackets; found ${bad.join(' ')}`,
        why: { rule: "Use ' for NOT, . for AND and + for OR.", cite: 'AY23/24 S2 Q19(d)' },
      })
    }
    if (/\s/.test(text.trim())) {
      format = true
      checks.push({ id: 'spaces', status: 'fail', message: 'remove the spaces', why: { rule: 'Fill-in-the-blank answers have no spaces.', cite: 'AY23/24 S2 Q19(d)' } })
    }
  }

  // Form.
  const cls = classify(expr, fn.vars)
  const form: Form | null = want === 'any' ? (cls.sop.yes ? 'sop' : cls.pos.yes ? 'pos' : null) : cls[want].yes ? want : null
  if (want !== 'any' || !form)
    checks.push({
      id: 'form',
      status: form ? 'pass' : 'fail',
      message: form ? `it is ${form === 'sop' ? 'an SOP' : 'a POS'} expression` : `it is not ${want === 'any' ? 'an SOP or POS' : want === 'sop' ? 'an SOP' : 'a POS'} expression`,
      why: want === 'any' ? cls.sop.why : cls[want].why,
      at: form ? undefined : (want === 'pos' ? cls.pos : cls.sop).breaker,
    })

  // Equivalence on the care rows.
  const values = valuesOf(fn)
  const f = compile(expr, fn.vars)
  const differing = values.flatMap((v, m) => (v !== 'X' && f(m) !== v ? [m] : []))
  const equivalent = differing.length === 0
  checks.push({
    id: 'equivalent',
    status: equivalent ? 'pass' : 'fail',
    message: equivalent
      ? `equal to ${fn.name} on every row that is not a don't-care`
      : `differs from ${fn.name} at ${differing.map((m) => `m${m}`).join(', ')}`,
    why: equivalent
      ? { rule: "Answers only need to match on rows that are not don't-cares.", cite: 'L15 p46' }
      : {
          rule: 'One differing row is enough to make the answer wrong.',
          working: `${Object.entries(assignmentOf(differing[0], fn.vars)).map(([k, v]) => `${k}=${v}`).join(', ')}: your answer gives ${f(differing[0])}, ${fn.name} is ${values[differing[0]]}`,
          cite: 'L13 p7-8',
        },
  })
  const literals = countLiterals(expr)
  if (!form) return out('wrong', { expr, differing, equivalent, literals })
  // Brackets are only needed in POS answers (AY24/25, AY25/26 Q17); the SOP blanks allow only ' . and + (AY23/24 S2 Q19(d)).
  if (fitb && form === 'sop' && /[()]/.test(text)) {
    format = true
    checks.push({
      id: 'symbols',
      status: 'fail',
      message: 'remove the brackets',
      why: { rule: "An SOP blank takes only letters, ' . and +.", cite: 'AY23/24 S2 Q19(d)' },
    })
  }

  // Terms: implicant, prime, don't-care-only.
  const min = fn.vars.length <= MAX_MIN_VARS ? minimize(fn, form) : null
  const allowed = new Set(values.flatMap((v, m) => (v === 'X' || v === (form === 'sop' ? 1 : 0) ? [m] : [])))
  const target = new Set(values.flatMap((v, m) => (v === (form === 'sop' ? 1 : 0) ? [m] : [])))
  const cubes: Cube[] = []
  const reports: TermReport[] = []
  const termExprs = expr.kind === 'const' ? [expr] : termsOf(expr, form === 'sop' ? 'or' : 'and')
  for (const t of termExprs) {
    let tc = termToCube(t, fn.vars, form)
    // A constant 1 in SOP (0 in POS) is the group of every cell.
    if (tc && 'constant' in tc && tc.constant === (form === 'sop' ? 1 : 0)) tc = { cube: { mask: 0, bits: 0 } }
    const tx = printExpr(t, fitb ? 'fitb' : 'course')
    let kind: TermReport['kind'] = 'constant'
    let prime: number | undefined
    if (tc && 'never' in tc) {
      kind = 'never'
      checks.push({ id: 'term', status: 'fail', message: `${tx} is always ${form === 'sop' ? 0 : 1}; remove it`, at: t.span, why: { rule: form === 'sop' ? "A∙A' = 0" : "A + A' = 1", cite: 'L13 p10' } })
    } else if (tc && 'cube' in tc) {
      const ms = mintermsOf(tc.cube, fn.vars.length)
      cubes.push(tc.cube)
      prime = min?.primes.findIndex((p) => sameCube(p.cube, tc.cube))
      if (prime === -1) prime = undefined
      if (!ms.every((m) => allowed.has(m))) kind = 'wrong'
      else if (!ms.some((m) => target.has(m))) {
        kind = 'dc-only'
        checks.push({
          id: 'term',
          status: 'fail',
          message: `${tx} covers only don't-cares; remove it`,
          at: t.span,
          why: { rule: 'No term is needed only to cover don\'t-cares.', cite: 'L15 p53; R07 p46' },
        })
      } else if (prime !== undefined) kind = 'prime'
      else {
        kind = 'implicant'
        const bigger = min?.primes.find((p) => (p.cube.mask & tc.cube.mask) === p.cube.mask && (tc.cube.bits & p.cube.mask) === p.cube.bits)
        checks.push({
          id: 'term',
          status: 'fail',
          message: `${tx} is not a PI${bigger ? `: its group fits inside ${bigger.term}` : ''}`,
          at: t.span,
          why: { rule: 'A minimal answer uses only PIs, the biggest groups possible.', cite: 'L15 p35, p38' },
        })
      }
    }
    reports.push({ text: tx, at: t.span, kind, prime })
  }

  // Minimality against the best cover.
  const best = min ? { terms: min.summary.terms, literals: min.summary.literals, answer: fitb ? min.summary.fitb : min.summary.answer } : undefined
  // A 0 term in SOP (1 in POS) adds nothing, so a lone 0 is an SOP with no terms.
  const termCount = termExprs.filter((t) => !(t.kind === 'const' && t.value === (form === 'sop' ? 0 : 1))).length
  const minimal = !!best && equivalent && termCount === best.terms && literals === best.literals
  if (best && equivalent)
    checks.push({
      id: 'minimal',
      status: minimal ? 'pass' : 'fail',
      message: minimal
        ? `minimal: ${termCount} terms, ${literals} literals`
        : `not minimal: ${termCount} terms and ${literals} literals, but ${best.terms} terms and ${best.literals} literals are possible`,
      why: { rule: 'Minimal means fewest terms, then fewest literals.', working: `one minimal answer: ${best.answer}`, cite: 'L15 p12, p34' },
    })
  const matchedCover = min?.covers.findIndex((c) => c.primes.length === cubes.length && c.primes.every((id) => cubes.some((q) => sameCube(q, min.primes[id].cube))))

  // Exam format.
  if (fitb)
    for (const t of termExprs) {
      const names = termsOf(t, form === 'sop' ? 'and' : 'or').map((l) => (l.kind === 'var' ? l.name : l.kind === 'not' && l.arg.kind === 'var' ? l.arg.name : ''))
      if (names.some((v, i) => i > 0 && v < names[i - 1])) {
        format = true
        const fixed = termToCube(t, fn.vars, form)
        checks.push({
          id: 'order',
          status: 'fail',
          message: `literals in ${printExpr(t, 'fitb')} are not in alphabetical order${fixed && 'cube' in fixed ? `: write ${termText(fixed.cube, fn.vars, form, 'fitb')}` : ''}`,
          at: t.span,
          why: { rule: 'Literals inside a term must be in alphabetical order; terms may be in any order.', cite: 'AY23/24 S2 Q19(d)' },
        })
      }
    }
  if (opts.epiFirst && min && equivalent) {
    const k = min.essentials.length
    const lead = cubes.slice(0, k)
    const ok = min.essentials.every((id) => lead.some((c) => sameCube(c, min.primes[id].cube)))
    if (!ok) format = true
    checks.push({
      id: 'epi-first',
      status: ok ? 'pass' : 'fail',
      message: ok ? 'EPIs come first' : `write the EPIs first: ${min.essentials.map((id) => min.primes[id].fitb).join(', ')}`,
      why: { rule: 'This question asks for the EPIs first.', cite: 'AY23/24 S2 Q19(d)' },
    })
  }

  const verdict = !equivalent ? 'wrong' : !minimal ? 'not-minimal' : format ? 'format' : 'correct'
  return {
    verdict,
    checks,
    equivalent,
    minimal,
    differing,
    terms: reports,
    literals,
    best,
    matchedCover: matchedCover !== undefined && matchedCover >= 0 ? matchedCover : undefined,
    expr,
  }
}
