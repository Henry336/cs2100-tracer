import { countLiterals, printExpr } from './expr'
import { checkEquivalence, type Counterexample } from './func'
import { parseExpr, varsOf, type Expr } from './parse'
import type { Explain, Issue } from './types'

export type Law =
  | 'identity'
  | 'complement'
  | 'commutative'
  | 'associative'
  | 'distributive'
  | 'idempotency'
  | 'one-zero'
  | 'involution'
  | 'absorption-1'
  | 'absorption-2'
  | 'demorgan'
  | 'consensus'

/** Laws and theorems as named on L13 p10 and p12. */
export const LAWS: Record<Law, { name: string; forms: string; cite: string }> = {
  identity: { name: 'Identity', forms: 'A + 0 = A, A∙1 = A', cite: 'L13 p10' },
  complement: { name: 'Inverse/complement', forms: "A + A' = 1, A∙A' = 0", cite: 'L13 p10' },
  commutative: { name: 'Commutative', forms: 'A + B = B + A, A∙B = B∙A', cite: 'L13 p10' },
  associative: { name: 'Associative', forms: 'A + (B + C) = (A + B) + C, A∙(B∙C) = (A∙B)∙C', cite: 'L13 p10' },
  distributive: { name: 'Distributive', forms: 'A∙(B + C) = A∙B + A∙C, A + B∙C = (A + B)∙(A + C)', cite: 'L13 p10' },
  idempotency: { name: 'Idempotency', forms: 'X + X = X, X∙X = X', cite: 'L13 p12' },
  'one-zero': { name: 'One element / zero element', forms: 'X + 1 = 1, X∙0 = 0', cite: 'L13 p12' },
  involution: { name: 'Involution', forms: "(X')' = X", cite: 'L13 p12' },
  'absorption-1': { name: 'Absorption 1', forms: 'X + X∙Y = X, X∙(X + Y) = X', cite: 'L13 p12' },
  'absorption-2': { name: 'Absorption 2', forms: "X + X'∙Y = X + Y, X∙(X' + Y) = X∙Y", cite: 'L13 p12' },
  demorgan: { name: "DeMorgan's", forms: "(X + Y)' = X'∙Y', (X∙Y)' = X' + Y'", cite: 'L13 p12' },
  consensus: { name: 'Consensus', forms: "X∙Y + X'∙Z + Y∙Z = X∙Y + X'∙Z, (X+Y)∙(X'+Z)∙(Y+Z) = (X+Y)∙(X'+Z)", cite: 'L13 p12' },
}

/* ---------- Normalised trees ---------- */

type N = { k: 'c'; v: 0 | 1 } | { k: 'v'; n: string } | { k: 'not'; a: N } | { k: 'and' | 'or' | 'xor' | 'xnor'; a: N[] }

const toN = (e: Expr): N =>
  e.kind === 'const' ? { k: 'c', v: e.value } : e.kind === 'var' ? { k: 'v', n: e.name } : e.kind === 'not' ? { k: 'not', a: toN(e.arg) } : { k: e.kind, a: e.args.map(toN) }

// Nodes are never mutated, so a node's key can be cached (sorting and the law search call key constantly).
const KEYS = new WeakMap<N, string>()
const key = (x: N): string => {
  let k = KEYS.get(x)
  if (k === undefined) {
    k = x.k === 'c' ? String(x.v) : x.k === 'v' ? x.n : x.k === 'not' ? `~${key(x.a)}` : `${x.k}(${x.a.map(key).join(',')})`
    KEYS.set(x, k)
  }
  return k
}

/** Flatten nested AND/OR; with `sort`, also order operands so commutative rewrites compare equal. */
function norm(x: N, sort = true): N {
  // A rewrite changes one path; the untouched subtrees are already sorted, so skip them.
  if (sort && NORMED.has(x)) return x
  const done = (y: N): N => {
    if (sort) NORMED.add(y)
    return y
  }
  if (x.k === 'not') return done({ k: 'not', a: norm(x.a, sort) })
  if (x.k === 'c' || x.k === 'v') return done(x)
  let a = x.a.map((y) => norm(y, sort))
  if (x.k === 'and' || x.k === 'or') {
    a = a.flatMap((y) => (y.k === x.k ? y.a : [y]))
    if (a.length === 0) return done({ k: 'c', v: x.k === 'and' ? 1 : 0 })
    if (a.length === 1) return a[0]
  }
  if (sort) a = [...a].sort((p, q) => (key(p) < key(q) ? -1 : key(p) > key(q) ? 1 : 0))
  return done({ k: x.k, a })
}
const NORMED = new WeakSet<N>()

const comp = (x: N): N => (x.k === 'not' ? x.a : { k: 'not', a: x })
const without = <T,>(xs: T[], ...idx: number[]) => xs.filter((_, i) => !idx.includes(i))

/** Every single application of one law at the top of `x` (forward direction). */
function local(x: N): { n: N; law: Law }[] {
  const out: { n: N; law: Law }[] = []
  if (x.k === 'not') {
    const y = x.a
    if (y.k === 'not') out.push({ n: y.a, law: 'involution' })
    if (y.k === 'c') out.push({ n: { k: 'c', v: y.v ? 0 : 1 }, law: 'complement' })
    // Wrap each operand in a NOT (not `comp`): (x'∙y')' becomes (x')'+(y')' as on L14 p11; involution is its own step.
    if (y.k === 'and' || y.k === 'or') out.push({ n: { k: y.k === 'and' ? 'or' : 'and', a: y.a.map((z): N => ({ k: 'not', a: z })) }, law: 'demorgan' })
    return out
  }
  if (x.k !== 'and' && x.k !== 'or') return out
  const isOr = x.k === 'or'
  const unit = isOr ? 0 : 1
  const zero: N = { k: 'c', v: isOr ? 1 : 0 }
  const inner = isOr ? 'and' : 'or'
  const a = x.a
  const parts = (y: N): N[] => (y.k === inner ? y.a : [y])
  const mk = (args: N[]): N => ({ k: x.k, a: args })
  const mkInner = (args: N[]): N => ({ k: inner, a: args })
  const keys = a.map(key)
  const partKeys = a.map((y) => parts(y).map(key))
  const subset = (p: string[], q: string[]) => {
    const rest = [...q]
    return p.every((k) => {
      const i = rest.indexOf(k)
      if (i < 0) return false
      rest.splice(i, 1)
      return true
    })
  }

  a.forEach((y, i) => {
    if (y.k === 'c' && y.v === unit) out.push({ n: mk(without(a, i)), law: 'identity' })
    if (y.k === 'c' && y.v !== unit) out.push({ n: zero, law: 'one-zero' })
    // Distributive (expanding): X∙(B + C) = X∙B + X∙C, and its dual.
    if (y.k === inner && a.length > 1) out.push({ n: mkInner(y.a.map((t) => mk([...without(a, i), t]))), law: 'distributive' })
  })
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < a.length; j++) {
      if (i === j) continue
      if (i < j && keys[j] === key(comp(a[i]))) out.push({ n: mk([...without(a, i, j), zero]), law: 'complement' })
      if (i < j && keys[i] === keys[j]) out.push({ n: mk(without(a, j)), law: 'idempotency' })
      if (partKeys[i].length < partKeys[j].length && subset(partKeys[i], partKeys[j])) out.push({ n: mk(without(a, j)), law: 'absorption-1' })
      const ci = key(comp(a[i]))
      const at = partKeys[j].indexOf(ci)
      const pj = parts(a[j])
      if (at >= 0 && partKeys[j].length > 1) out.push({ n: mk(a.map((y, q) => (q === j ? mkInner(without(pj, at)) : y))), law: 'absorption-2' })
      // Absorption 2 under a common factor C: C∙X + C∙X'∙Y = C∙X + C∙Y, as cited on L15 p6 / R07 p29 (b(ad + d') = b(a + d')).
      if (a[i].k === inner && partKeys[j].length > partKeys[i].length)
        parts(a[i]).forEach((f, fi) => {
          const g = partKeys[j].indexOf(key(comp(f)))
          if (g >= 0 && subset(without(partKeys[i], fi), without(partKeys[j], g)))
            out.push({ n: mk(a.map((y, q) => (q === j ? mkInner(without(pj, g)) : y))), law: 'absorption-2' })
        })
      // Consensus: X∙Y + X'∙Z + Y∙Z, drop the Y∙Z term (and the dual).
      if (i < j)
        parts(a[i]).forEach((f, fi) => {
          const gi = partKeys[j].indexOf(key(comp(f)))
          if (gi < 0) return
          const yz = new Set([...without(partKeys[i], fi), ...without(partKeys[j], gi)])
          if (!yz.size) return
          a.forEach((_, k) => {
            if (k !== i && k !== j && new Set(partKeys[k]).size === yz.size && partKeys[k].every((p) => yz.has(p))) out.push({ n: mk(without(a, k)), law: 'consensus' })
          })
        })
    }
  return out
}

function rewrites(x: N): { n: N; law: Law }[] {
  const out = local(x)
  if (x.k === 'not') for (const r of rewrites(x.a)) out.push({ n: { k: 'not', a: r.n }, law: r.law })
  else if (x.k !== 'c' && x.k !== 'v')
    x.a.forEach((y, i) => {
      for (const r of rewrites(y)) out.push({ n: { k: x.k, a: x.a.map((z, q) => (q === i ? r.n : z)) }, law: r.law })
    })
  return out.map((r) => ({ n: norm(r.n), law: r.law }))
}

const LIMIT = 300

/** Laws that turn `p` into `q` in one or two applications (either direction), or null. */
function findLaws(p: N, q: N): Law[] | null {
  const pk = key(p)
  const qk = key(q)
  const r1 = rewrites(p)
  const hit = r1.find((r) => key(r.n) === qk)
  if (hit) return [hit.law]
  const s1 = rewrites(q)
  const back = s1.find((s) => key(s.n) === pk)
  if (back) return [back.law]
  const mid = new Map(r1.map((r) => [key(r.n), r.law]))
  for (const s of s1) {
    const l = mid.get(key(s.n))
    if (l) return [l, s.law]
  }
  // Many rewrites land on the same tree; expand each distinct one once.
  const unique = (rs: { n: N; law: Law }[]) => [...new Map(rs.map((r) => [key(r.n), r] as const).reverse()).values()].reverse()
  for (const r of unique(r1).slice(0, LIMIT)) {
    const r2 = rewrites(r.n).find((x) => key(x.n) === qk)
    if (r2) return [r.law, r2.law]
  }
  for (const s of unique(s1).slice(0, LIMIT)) {
    const s2 = rewrites(s.n).find((x) => key(x.n) === pk)
    if (s2) return [s2.law, s.law]
  }
  return null
}

/**
 * Multiply out `op` over the other operator (op 'and' gives a sum of products) with no other law applied.
 * Null when it would pass `cap` terms.
 */
function expand(x: N, op: 'and' | 'or', cap = 256): N | null {
  const inner = op === 'and' ? 'or' : 'and'
  const go = (y: N): N[][] | null => {
    if (y.k === inner) {
      const out: N[][] = []
      for (const z of y.a) {
        const t = go(z)
        if (!t || out.length + t.length > cap) return null
        out.push(...t)
      }
      return out
    }
    if (y.k === op) {
      let out: N[][] = [[]]
      for (const z of y.a) {
        const t = go(z)
        if (!t || out.length * t.length > cap) return null
        out = out.flatMap((p) => t.map((q) => [...p, ...q]))
      }
      return out
    }
    return [[y]]
  }
  const terms = go(x)
  return terms && norm({ k: inner, a: terms.map((t): N => ({ k: op, a: t })) })
}

/** Equal by distributivity alone (repeated, plus reordering), e.g. (x+y)∙(x+y') = x∙x + x∙y' + x∙y + y∙y' on L15 p5. */
function byDistribution(p: N, q: N): boolean {
  return (['and', 'or'] as const).some((op) => {
    const ep = expand(p, op)
    const eq = ep && expand(q, op)
    return !!eq && key(ep) === key(eq)
  })
}

/* ---------- Step checker ---------- */

export interface StepInput {
  expr: string
  /** The law the student cites for this step. */
  law?: string
  /** Source line (1-based) when parsed from text. */
  line?: number
}

/** One expression per line; a leading = is dropped; a law can follow `//`, or sit in a trailing `(by ...)`, `(law)` or `[law]`. */
export function parseSteps(text: string): StepInput[] {
  const out: StepInput[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    let body = raw
    let law: string | undefined
    const c = body.indexOf('//')
    if (c >= 0) {
      law = body.slice(c + 2).trim() || undefined
      body = body.slice(0, c)
    }
    const by = /\(\s*by\s+([^()]*)\)\s*$/i.exec(body)
    // L15 p5-6 and R07 p29 write "(distributivity)", T06 Ans p1 "[distributive]": a trailing bracket that names a law.
    const tag = by ? null : /[([]\s*([^()[\]]+?)\s*[)\]]\s*$/.exec(body)
    if (by) {
      law = by[1].trim()
      body = body.slice(0, by.index)
    } else if (tag && parseLawName(tag[1]).length) {
      law = tag[1]
      body = body.slice(0, tag.index)
    }
    body = body.replace(/^\s*=/, '').trim()
    if (body) out.push({ expr: body, law, line: i + 1 })
  })
  return out
}

/** Map a typed law name to the laws it could mean ("absorption" alone could be either). */
export function parseLawName(text: string): Law[] {
  const t = text.toLowerCase()
  if (/de\s*-?\s*morgan/.test(t)) return ['demorgan']
  if (/absorption/.test(t)) return /(2|ii|two)\b/.test(t) ? ['absorption-2'] : /(1|i|one)\b/.test(t) ? ['absorption-1'] : ['absorption-1', 'absorption-2']
  if (/consensus/.test(t)) return ['consensus']
  if (/distribut/.test(t)) return ['distributive']
  if (/idempot/.test(t)) return ['idempotency']
  if (/involution|double\s*(negation|complement)/.test(t)) return ['involution']
  if (/(one|zero|null)\s*element|dominat|annihilat/.test(t)) return ['one-zero']
  if (/identity/.test(t)) return ['identity']
  if (/inverse|complement/.test(t)) return ['complement']
  if (/commutat/.test(t)) return ['commutative']
  if (/associat/.test(t)) return ['associative']
  return []
}

export interface StepCheck {
  line: number
  text: string
  claimed?: string
  errors: Issue[]
  warnings: Issue[]
  /** Course-notation print of the parsed line. */
  expr?: string
  literals?: number
  /** Compared with the previous valid line (absent on the first). */
  equivalent?: boolean
  counterexample?: Counterexample
  /** Laws that explain the step; [] when only commutative/associative reordering; null when equivalent but not one or two recognised laws. */
  laws?: Law[] | null
  claimMatches?: boolean
  why?: Explain
}

export interface StepsResult {
  vars: string[]
  steps: StepCheck[]
  /** Every line parsed and each is equal to the one before. */
  valid: boolean
  why: Explain
}

/** Check a chain of rewrites: each line must equal the previous one; name the law where one or two applications explain it. */
export function checkSteps(input: string | StepInput[], opts: { vars?: string[] } = {}): StepsResult {
  const steps = typeof input === 'string' ? parseSteps(input) : input
  const parsed = steps.map((s) => ({ s, p: parseExpr(s.expr) }))
  const vars =
    opts.vars ?? [...new Set(parsed.flatMap(({ p }) => (p.ok ? varsOf(p.expr) : [])))].sort()
  let prev: Expr | undefined
  const out: StepCheck[] = parsed.map(({ s, p }, i) => {
    const line = s.line ?? i + 1
    const base: StepCheck = { line, text: s.expr, claimed: s.law, errors: [], warnings: [] }
    if (!p.ok) return { ...base, errors: p.errors.map((e) => ({ ...e, line })), warnings: p.warnings.map((w) => ({ ...w, line })) }
    const cur = p.expr
    const r: StepCheck = { ...base, warnings: p.warnings.map((w) => ({ ...w, line })), expr: printExpr(cur), literals: countLiterals(cur) }
    if (prev) {
      const eq = checkEquivalence(prev, cur, vars)
      r.equivalent = eq.equivalent
      if (!eq.equivalent) {
        r.counterexample = eq.counterexample
        r.why = eq.why
      } else {
        const a = toN(prev)
        const b = toN(cur)
        let laws: Law[] | null
        if (key(norm(a)) === key(norm(b))) laws = key(a) === key(b) ? [] : key(norm(a, false)) === key(norm(b, false)) ? ['associative'] : ['commutative']
        else laws = findLaws(norm(a), norm(b)) ?? (byDistribution(a, b) ? ['distributive'] : null)
        r.laws = laws ? [...new Set(laws)] : null
        r.why = laws?.length
          ? { rule: laws.map((l) => `${LAWS[l].name}: ${LAWS[l].forms}`).join('. '), cite: [...new Set(laws.map((l) => LAWS[l].cite))].join('; ') }
          : laws
            ? { rule: 'Same expression.', cite: 'L13 p10' }
            : { rule: 'The lines are equal on every row, but no one or two L13 laws explain the step. Split it into smaller steps.', cite: 'L13 p13' }
        if (s.law) {
          const claimed = parseLawName(s.law)
          r.claimMatches = laws ? claimed.some((l) => laws!.includes(l)) : undefined
        }
      }
    }
    prev = cur
    return r
  })
  const lits = out.filter((s) => s.literals !== undefined)
  const valid = out.every((s) => !s.errors.length && s.equivalent !== false)
  return {
    vars,
    steps: out,
    valid,
    why: {
      rule: 'Each line must equal the previous one; aim for fewer literals.',
      working: lits.length ? `${lits[0].literals} literals to ${lits[lits.length - 1].literals}` : undefined,
      cite: 'L13 p13; L15 p4-6',
    },
  }
}
