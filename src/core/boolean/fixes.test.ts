/** Fixes for the verifier findings: layouts, term order, notation, limits and cover counting. */
import { describe, expect, it } from 'vitest'
import { checkSteps } from './algebra'
import { defaultVars, parseFunction } from './func'
import { kmapLayout } from './kmap'
import { lintAnswer } from './lint'
import { MAX_COVERS, minimize } from './minimize'
import { parseExpr } from './parse'
import { traceKMap } from './trace'
import type { BoolFunction } from './types'

const fn = (src: string): BoolFunction => {
  const r = parseFunction(src)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}
const mod3 = (n: number): BoolFunction => {
  const all = Array.from({ length: 1 << n }, (_, i) => i)
  return { name: 'F', vars: defaultVars(n), on: all.filter((i) => i % 3 === 0), dc: all.filter((i) => i % 3 === 1) }
}

describe('K-map axes chosen per variable', () => {
  it('T06 Q3(a): A,C on the rows and B,D on the columns, as drawn in T06 Ans p3 [official]', () => {
    const l = kmapLayout(['A', 'B', 'C', 'D'], { rows: ['A', 'C'], cols: ['B', 'D'] })!
    expect(l.grid[0]).toEqual([
      [0, 1, 5, 4],
      [2, 3, 7, 6],
      [10, 11, 15, 14],
      [8, 9, 13, 12],
    ])
    expect(l.orientation).toBe('custom')
    expect(l.rowBars).toEqual([{ v: 'A', indices: [2, 3] }, { v: 'C', indices: [1, 2] }])
    expect(l.colBars).toEqual([{ v: 'B', indices: [2, 3] }, { v: 'D', indices: [1, 2] }])
    expect(l.where[10]).toEqual({ map: 0, row: 2, col: 0 })
  })
  it('the default orientations are unchanged, and bad axes give null or a clean trace error [derived]', () => {
    expect(kmapLayout(['A', 'B', 'C', 'D'])!.grid[0][1]).toEqual([4, 5, 7, 6])
    expect(kmapLayout(['A', 'B', 'C', 'D', 'E'], { rows: ['B', 'C'], cols: ['D', 'E'] })!.maps).toEqual([{ label: "A'" }, { label: 'A' }])
    expect(kmapLayout(['A', 'B', 'C'], { rows: ['A'], cols: ['A', 'B'] })).toBeNull()
    expect(kmapLayout(['A', 'B', 'C', 'D'], { rows: ['A'], cols: ['B', 'C'] })).toBeNull()
    const t = traceKMap(fn('F(A,B,C,D) = Σm(0,1)'), { orientation: { rows: ['A'], cols: ['B'] } })
    expect(t.ok).toBe(false)
  })
})

describe('minimal answers print terms in variable order', () => {
  it("T06 Q1(b): p'∙q' + r + s' as the key prints it; POS x∙y∙z' [official]", () => {
    expect(minimize(fn('G(p,q,r,s) = ΠM(5,9,13)')).summary.answer).toBe("p'∙q' + r + s'")
    expect(minimize(fn("F(x,y,z) = x∙y∙z'"), 'pos').summary.answer).toBe("x∙y∙z'")
  })
})

describe('cover counting stays exact without building every cover', () => {
  it('5 variables, 59049 minimal covers: exact count, first MAX_COVERS kept, trace title gives the count [derived]', () => {
    const m = minimize(mod3(5))
    expect(m.summary.covers).toMatchObject({ value: 59049, exact: true })
    expect(m.covers).toHaveLength(MAX_COVERS)
    expect(m.covers.every((c) => c.terms === 11 && c.literals === 45)).toBe(true)
    const t = traceKMap(mod3(5))
    expect(t.ok && t.trace.frames.find((f) => f.phase === 'cover')!.title).toMatch(/^Minimal cover 1 of 59049: /)
  })
  it('6 variables with millions of covers finishes and says the count is a lower bound [derived]', () => {
    const s = performance.now()
    const m = minimize(mod3(6))
    expect(performance.now() - s).toBeLessThan(5000)
    expect(m.summary.covers.exact).toBe(false)
    expect(m.summary.covers.why.working).toMatch(/at least|limit/)
  })
})

describe('notation and limits', () => {
  it('m1 + M3 is an error; header variables named m1, m3 stay an expression (L13 p23-24) [derived]', () => {
    const r = parseFunction('m1 + M3')
    expect(r.ok).toBe(false)
    const e = parseFunction('F(m1,m3) = m1 + m3')
    expect(e.ok && e.source).toBe('expression')
  })
  it('out-of-range indices and too many variables are clean errors [derived]', () => {
    const r = parseFunction('Σm(0-70000)')
    expect(!r.ok && r.errors[0].message).toMatch(/16 variables at most/)
    const big = parseFunction(`F(${defaultVars(17).join(',')}) = Σm(1)`)
    expect(!big.ok && big.errors[0].message).toMatch(/16 at most/)
  })
  it('deep nesting is a clean parse error, normal brackets still parse [derived]', () => {
    const r = parseExpr('('.repeat(300) + 'A' + ')'.repeat(300))
    expect(!r.ok && r.errors[0].code).toBe('deep')
    expect(parseExpr("((A+B)')'").ok).toBe(true)
  })
})

describe('marking modes', () => {
  it("fill-in-the-blank mode keeps a dot-less answer correct with a warning (the AY23/24 S2 key prints B'D+A'B+BD') [official]", () => {
    const r = lintAnswer("B'D+A'B+BD'", fn('F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)'))
    expect(r.verdict).toBe('correct')
    expect(r.checks.find((c) => c.id === 'dots')?.status).toBe('warn')
  })
  it('POS fill-in-the-blank answers may use brackets [derived]', () => {
    const f = fn('F(A,B) = ΠM(0,3)')
    expect(lintAnswer("(A+B).(A'+B')", f, { form: 'pos' }).verdict).toBe('correct')
    expect(lintAnswer("(A+B).(A'+B')", f).verdict).toBe('wrong')
  })
  it('a full one-line expansion is named distributive only when nothing else changed [derived]', () => {
    expect(checkSteps("(a+b)∙(c+d)\n= a∙c + a∙d + b∙c + b∙d").steps[1].laws).toEqual(['distributive'])
    expect(checkSteps("(a+b)∙(c+d)\n= a∙c + a∙d + b∙c + b∙d + a∙b∙c").steps[1].laws).toBeNull()
  })
})
