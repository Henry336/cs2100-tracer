import { describe, expect, it } from 'vitest'
import { termToCube } from './cube'
import { termsOf } from './expr'
import { parseFunction } from './func'
import { minimize } from './minimize'
import { parseExpr } from './parse'
import { traceKMap } from './trace'
import type { BoolFunction, Form } from './types'

/** Terms of a typed SOP/POS answer as sorted cube keys, so term order does not matter. */
function keys(text: string, vars: string[], form: Form): string[] {
  const p = parseExpr(text)
  if (!p.ok) throw new Error(`bad expected answer ${text}`)
  return termsOf(p.expr, form === 'sop' ? 'or' : 'and')
    .map((t) => {
      const c = termToCube(t, vars, form)
      if (!c || !('cube' in c)) throw new Error(`bad term in ${text}`)
      return `${c.cube.mask}/${c.cube.bits}`
    })
    .sort()
}
const coverKeys = (fn: BoolFunction, form: Form) =>
  minimize(fn, form)
    .covers.map((c) => keys(c.text, fn.vars, form).join(' '))
    .sort()

function fn(text: string): BoolFunction {
  const r = parseFunction(text)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}

interface Fixture {
  id: string
  kind: 'official' | 'derived'
  note?: string
  f: string
  pis?: number
  epis?: number
  /** EPI terms as typed by the source. */
  epiTerms?: string[]
  piTerms?: string[]
  notPis?: string[]
  covers?: number
  /** PIs that are not essential. */
  nonEpiTerms?: string[]
  /** Every minimal SOP (each must appear; with `covers` it is the full list). */
  sop?: string[]
  pos?: string[]
  posCovers?: number
  implicants?: number
}

const FIXTURES: Fixture[] = [
  { id: 'L15 p37 (3-var)', kind: 'official', note: 'map read from the slide image', f: 'F(a,b,c) = Σm(0,1,2,5)', pis: 3, epis: 2, covers: 1, sop: ["a'∙c' + b'∙c"] },
  {
    id: 'L15 p37 / R07 p39 (4-var)',
    kind: 'official',
    note: 'counts official; cover list derived in logic.md',
    f: 'F(A,B,C,D) = Σm(0,2,3,4,7,8,9,10,11,13,14)',
    pis: 7,
    epis: 4,
    epiTerms: ["A'∙C'∙D'", "A'∙C∙D", "A∙C'∙D", "A∙C∙D'"],
    covers: 3,
    sop: [
      "A'C'D' + A'CD + AC'D + ACD' + B'D' + B'C",
      "A'C'D' + A'CD + AC'D + ACD' + B'D' + AB'",
      "A'C'D' + A'CD + AC'D + ACD' + B'C + AB'",
    ],
  },
  {
    id: 'L15 p39-41',
    kind: 'official',
    f: 'F(A,B,C,D) = Σm(2,3,4,5,7,8,10,13,15)',
    pis: 6,
    epis: 3,
    epiTerms: ['B∙D', "A'∙B∙C'", "A∙B'∙D'"],
    covers: 1,
    sop: ["BD + A'BC' + AB'D' + A'B'C"],
  },
  {
    id: 'L15 p42 G = AY25/26 Q17a H',
    kind: 'official',
    f: 'G(A,B,C,D) = Σm(3,4,5,7,9,13,14,15)',
    pis: 5,
    epis: 4,
    piTerms: ['B∙D', "A'∙B∙C'", "A∙C'∙D", 'A∙B∙C', "A'∙C∙D"],
    epiTerms: ["A'∙B∙C'", "A∙C'∙D", 'A∙B∙C', "A'∙C∙D"],
    covers: 1,
    sop: ["A'∙B∙C' + A∙C'∙D + A∙B∙C + A'∙C∙D"],
    pos: ["(A'+B+C')(A'+C+D)(A+B+C)(A+C'+D)"],
  },
  { id: 'L15 p43-44', kind: 'official', note: 'POS official; SOP derived', f: 'F(A,B,C,D) = Σm(0,1,2,3,5,7,8,9,10,11)', pos: ["(A'+B')(B'+D)"], posCovers: 1, sop: ["B' + A'D"], covers: 1 },
  {
    id: 'L15 p50-51',
    kind: 'official',
    f: "F(A,B,C,D) = A∙B∙C + B'∙C∙D' + A∙D + B'∙C'∙D'",
    pis: 4,
    epis: 3,
    piTerms: ['A∙D', 'A∙C', "A∙B'", "B'∙D'"],
    covers: 1,
    sop: ["AD + AC + B'D'"],
    pos: ["(A+B')(A+D')(B'+C+D)"],
  },
  {
    id: 'L15 p53-55',
    kind: 'official',
    note: 'second POS is derived (logic.md ambiguity 3)',
    f: 'F(A,B,C,D) = Σm(2,8,10,15) + d(0,1,3,7)',
    pis: 3,
    epis: 2,
    piTerms: ["A'∙B'", 'B∙C∙D', "B'∙D'"],
    covers: 1,
    sop: ["B'D' + BCD"],
    pos: ["(B'+C)(B'+D)(B+D')", "(B+D')(B'+D)(C+D')"],
    posCovers: 2,
  },
  { id: 'L15 p47 F', kind: 'official', f: 'F(A,B,C) = Σm(3,5,6) + d(0,7)', covers: 1, sop: ['AC + AB + BC'] },
  { id: 'L15 p47 G', kind: 'official', f: 'G(A,B,C) = Σm(1,2,4) + d(0,7)', covers: 1, sop: ["B'C' + A'B' + A'C'"] },
  {
    id: 'L15 p49',
    kind: 'official',
    f: 'F(K,L,M,N) = Σm(2,6,8) + d(3,7,11..15)',
    pis: 3,
    piTerms: ["K'∙M", 'L∙M', "K∙M'∙N'"],
    notPis: ['K∙L', 'M∙N'],
    epis: 2,
    covers: 1,
    sop: ["K'M + KM'N'"],
  },
  { id: 'R07 p36', kind: 'official', f: 'F(A,B,C) = Σm(1,3,6,7)', pis: 3, epis: 2, covers: 1, sop: ["A'C + AB"] },
  { id: 'R07 p37', kind: 'official', f: 'F(A,B,C) = Σm(1,2,3,5,7)', implicants: 11, pis: 2, piTerms: ['C', "A'∙B"], sop: ["C + A'B"], covers: 1 },
  { id: 'T06 SE3(a) F1', kind: 'official', note: 'POS derived', f: 'F1(A,B,C,D) = Σm(5,8,10,12,13,14)', pis: 3, epis: 2, covers: 1, sop: ["AD' + BC'D"], pos: ["(A+D)(B+D')(C'+D')"] },
  { id: 'T06 SE3(b) F2', kind: 'official', note: 'POS derived', f: 'F2(W,X,Y,Z) = ΠM(0,1,2,8,9,10)', pis: 2, epis: 2, covers: 1, sop: ['X + YZ'], pos: ['(X+Y)(X+Z)'] },
  {
    id: 'T06 SE3(c) F3',
    kind: 'official',
    note: 'POS alternatives derived',
    f: 'F3(K,L,M,N) = Σm(1,7,10,13,14) + d(0,5,8,15)',
    pis: 6,
    epis: 1,
    epiTerms: ['L∙N'],
    covers: 2,
    sop: ["LN + KMN' + K'L'M'", "LN + KMN' + K'M'N"],
    pos: ["(K+N)(K'+L+M)(L+M'+N')(M+N)", "(K+N)(K'+L+N')(L+M'+N')(M+N)", "(K+L+M')(K+N)(K'+L+N')(M+N)"],
    posCovers: 3,
  },
  {
    id: 'T06 Q2(d) F4',
    kind: 'official',
    f: 'F4(A,B,C,D) = ΠM(4,8,9,11,12) ∙ D(2,3,6,7,10,14)',
    pis: 4,
    piTerms: ["A'∙B'", "A'∙D", 'B∙D', 'B∙C'],
    notPis: ["A'∙C"],
    epis: 2,
    epiTerms: ["A'∙B'", 'B∙D'],
    covers: 1,
    sop: ["A'B' + BD"],
    pos: ["(A'+B)(B'+D)"],
  },
  {
    id: 'T06 Q3 T',
    kind: 'official',
    f: 'T(A,B,C,D) = ΠM(3,7,8,10,12,13) ∙ X(6,11,14,15)',
    pis: 4,
    piTerms: ["A'∙D'", "A'∙C'", "A∙B'∙D", "B'∙C'∙D"],
    epis: 2,
    epiTerms: ["A'∙D'", "A'∙C'"],
    covers: 2,
    sop: ["A'D' + A'C' + B'C'D", "A'D' + A'C' + AB'D"],
    pos: ["(A'+D)(C'+D')(A'+B')"],
  },
  {
    id: 'AY23/24 S2 Q19',
    kind: 'official',
    f: 'F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)',
    pis: 5,
    piTerms: ["A'∙D", "B'∙D", "A'∙B", "B∙D'", 'B∙C'],
    notPis: ['C∙D'],
    epis: 1,
    epiTerms: ["B'∙D"],
    covers: 3,
    sop: ["B'D + A'B + BD'", "B'D + A'B + BC", "B'D + A'D + BD'"],
  },
  {
    id: 'AY23/24 S1 Q17(a) P',
    kind: 'official',
    note: 'covers derived',
    f: 'P(W,X,Y,Z) = Σm(1,8,13) + d(0,2,5,9,10,15)',
    pis: 4,
    piTerms: ["Y'∙Z", "X'∙Y'", "X'∙Z'", 'W∙X∙Z'],
    epis: 0,
    covers: 2,
    sop: ["X'Y' + Y'Z", "X'Z' + Y'Z"],
  },
  {
    id: 'AY23/24 S1 Q17(b) Q',
    kind: 'official',
    f: 'Q(W,X,Y,Z) = ΠM(5,7,8,10,13,15) ∙ d(0,2,3,4,9,14)',
    pis: 4,
    piTerms: ["W'∙X'", "W'∙Z'", "X'∙Z", "X∙Z'"],
    epis: 2,
    epiTerms: ["X'∙Z", "X∙Z'"],
    covers: 1,
    sop: ["X'Z + XZ'"],
  },
  {
    id: 'AY24/25 Q3-Q4',
    kind: 'official',
    note: 'covers derived',
    f: 'F(A,B,C,D) = Σm(1,3,4,6,10,12) + x(2,5,7,13,14)',
    pis: 6,
    piTerms: ["B∙C'", "C∙D'", "A'∙D", "A'∙B", "A'∙C", "B∙D'"],
    epis: 2,
    epiTerms: ["C∙D'", "A'∙D"],
    covers: 2,
    sop: ["A'D + CD' + BD'", "A'D + CD' + BC'"],
  },
  {
    id: 'AY24/25 Q17(a)',
    kind: 'official',
    f: 'F(A,B,C,D) = Σm(0,1,4,6,9,11) + d(5,7,13,15)',
    pis: 4,
    piTerms: ["A'∙C'", "C'∙D", "A'∙B", 'A∙D'],
    notPis: ['B∙D'],
    epis: 3,
    covers: 1,
    sop: ["A'C' + A'B + AD"],
    pos: ["(A'+D)(A+B+C')"],
  },
  {
    id: 'AY25/26 Q1',
    kind: 'official',
    note: 'minterms reconstructed from the key EPI list',
    f: 'F(A,B,C,D) = Σm(0,1,2,6,8,10,12)',
    pis: 4,
    epis: 4,
    epiTerms: ["B'∙D'", "A'∙B'∙C'", "A∙C'∙D'", "A'∙C∙D'"],
  },
  { id: 'AY21/22 S2 Q14(c) / R08 p39', kind: 'official', f: 'G(A,B,C,D) = Σm(0,4,6,8,9,10,12..15)', pis: 5, epis: 5, covers: 1, sop: ["AB + C'D' + AC' + BD' + AD'"] },
  { id: 'AY20/21 S2 Q1-2', kind: 'derived', f: 'F(A,B,C,D) = Σm(0,1,2,7,15) + x(3,9,11,12,13)', pis: 4, piTerms: ["A'∙B'", "B'∙D", 'C∙D', 'A∙D'], epis: 2, epiTerms: ["A'∙B'", 'C∙D'], covers: 1, sop: ["A'B' + CD"] },
  { id: 'AY21/22 S1 Q5', kind: 'derived', f: 'F(A,B,C,D) = Σm(3,10,11,15) + x(1,2,4,7,9,12,14)', pis: 4, epis: 0, covers: 4 },
  {
    id: 'AY21/22 S2 Q5',
    kind: 'derived',
    f: 'F(A,B,C,D) = Σm(1,3,6,8,9,11,15) + x(7,14)',
    epiTerms: ['B∙C', "B'∙D", "A∙B'∙C'"],
    nonEpiTerms: ['C∙D'],
    covers: 1,
    sop: ["AB'C' + B'D + BC"],
  },
  { id: 'L15 p27-29', kind: 'official', f: 'F(w,x,y,z) = Σm(4,5,10,11,14,15)', covers: 1, sop: ["w'xy' + wy"] },
  { id: 'L15 p33', kind: 'derived', note: 'minterms official, SOP computed', f: "F(A,B,C,D) = A∙(C+D)'∙(B'+D') + C∙(B+C'+A'∙D)", covers: 1, sop: ["A'CD + AC'D' + BC"] },
  { id: 'R07 p9, p20', kind: 'derived', f: "F(A,B,C) = A∙B + A'∙C + A'∙B'", covers: 2, sop: ["A'B' + A'C + AB", "A'B' + AB + BC"] },
  { id: 'R07 p58-59', kind: 'derived', note: 'POS official, SOP computed', f: 'f(x,y,z) = Σm(0,1,2,3,4,7)', sop: ["x' + y'z' + yz"], covers: 1, pos: ["(x'+y+z')(x'+y'+z)"] },
  { id: 'L15 p18', kind: 'derived', f: 'F(a,b,c) = Σm(0,2,5)', covers: 1, sop: ["a'c' + ab'c"] },
]

describe('K-map fixtures (logic.md)', () => {
  for (const fx of FIXTURES)
    it(`${fx.id} [${fx.kind}]`, () => {
      const f = fn(fx.f)
      const m = minimize(f, 'sop')
      if (fx.pis !== undefined) expect(m.summary.primes.value).toBe(fx.pis)
      if (fx.epis !== undefined) expect(m.summary.essentials.value).toBe(fx.epis)
      if (fx.covers !== undefined) expect(m.summary.covers.value).toBe(fx.covers)
      if (fx.implicants !== undefined) expect(m.summary.implicants.value).toBe(fx.implicants)
      const termKey = (t: string) => keys(t, f.vars, 'sop')[0]
      if (fx.piTerms) expect(m.primes.map((p) => termKey(p.term)).sort()).toEqual(fx.piTerms.map(termKey).sort())
      if (fx.epiTerms) expect(m.essentials.map((id) => termKey(m.primes[id].term)).sort()).toEqual(fx.epiTerms.map(termKey).sort())
      for (const t of fx.nonEpiTerms ?? []) expect(m.primes.find((p) => termKey(p.term) === termKey(t))?.essential).toBe(false)
      if (fx.notPis) for (const t of fx.notPis) expect(m.dcOnly.map((g) => termKey(g.term))).toContain(termKey(t))
      if (fx.sop) {
        const got = coverKeys(f, 'sop')
        for (const s of fx.sop) expect(got).toContain(keys(s, f.vars, 'sop').join(' '))
        if (fx.covers === fx.sop.length) expect(got.length).toBe(fx.sop.length)
      }
      if (fx.pos) {
        const got = coverKeys(f, 'pos')
        for (const s of fx.pos) expect(got).toContain(keys(s, f.vars, 'pos').join(' '))
        if (fx.posCovers !== undefined) expect(got.length).toBe(fx.posCovers)
      }
    })
})

describe('5-variable K-map: T07 SE3 [derived]', () => {
  const d = 'd(0,1,2,4,8,16)'
  it('P and Q covers, and the fate of input 00100', () => {
    const P = fn(`P(A,B,C,D,E) = Σm(9,17,18) + ${d}`)
    const Q = fn(`Q(A,B,C,D,E) = Σm(5,10,17,20,21) + ${d}`)
    const pc = coverKeys(P, 'sop')
    const qc = coverKeys(Q, 'sop')
    const pAns = keys("A'C'D' + B'C'D' + B'C'E'", P.vars, 'sop').join(' ')
    const qAns = keys("A'C'E' + B'D'", Q.vars, 'sop').join(' ')
    expect(pc).toContain(pAns)
    expect(qc).toContain(qAns)
    // With those covers, m4 (00100) gives P = 0 and Q = 1.
    const at4 = (f: BoolFunction, ans: string) =>
      minimize(f).covers.find((c) => keys(c.text, f.vars, 'sop').join(' ') === ans)!.dcValues.find((d) => d.cell === 4)!.value
    expect([at4(P, pAns), at4(Q, qAns)]).toEqual([0, 1])
  })
})

describe("T06 Q4 comparator outputs with 0000 as a don't-care [official, T06 Ans p6]", () => {
  // Y's comparison symbol is lost in the text; <= is the reading that matches the key (features/boolean-kmap.md).
  const build = (name: string, rule: (m: number) => boolean) =>
    fn(`${name}(K,L,M,N) = Σm(${Array.from({ length: 16 }, (_, m) => m).filter((m) => m && rule(m)).join(',')}) + d(0)`)
  const X = build('X', (m) => m >> 2 === (m & 3))
  const Y = build('Y', (m) => m >> 2 <= (m & 3))
  const Z = build('Z', (m) => m >> 1 < (m & 7))
  it('X, Y, Z minimal SOPs; Y has 5 PIs and 4 EPIs', () => {
    expect(coverKeys(X, 'sop')).toEqual([keys("K'LM'N + KL'MN' + KLMN", X.vars, 'sop').join(' ')])
    expect(coverKeys(Y, 'sop')).toEqual([keys("MN + K'N + K'M + L'M", Y.vars, 'sop').join(' ')])
    expect(minimize(Y).summary.primes.value).toBe(5)
    expect(minimize(Y).summary.essentials.value).toBe(4)
    expect(coverKeys(Z, 'sop')).toEqual([keys("K'", Z.vars, 'sop').join(' ')])
  })
  it('the built circuit outputs XYZ = 001 on input 0000 (T06 Q4(d))', () => {
    expect([X, Y, Z].map((f) => minimize(f).covers[0].dcValues[0])).toEqual([0, 0, 1].map((value) => ({ cell: 0, value })))
  })
})

describe('K-map trace', () => {
  it('AY23/24 S2 Q19: frames, EPI reason and the not-a-PI group', () => {
    const r = traceKMap(fn('F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)'))
    if (!r.ok) throw new Error('trace failed')
    const t = r.trace
    const phases = t.frames.map((f) => f.phase)
    expect(phases[0]).toBe('fill')
    expect(phases.filter((p) => p === 'prime')).toHaveLength(5)
    expect(phases).toContain('not-prime')
    expect(phases.filter((p) => p === 'cover')).toHaveLength(3)
    expect(phases[phases.length - 1]).toBe('answer')
    const epi = t.primes[t.essentials[0]]
    expect(epi.fitb).toBe("B'.D")
    // m1 is also under A'.D, so only m9 makes B'.D essential.
    expect(epi.reasons).toEqual([9])
    expect(t.summary.fitb.startsWith("B'.D+")).toBe(true)
    for (const p of t.primes) expect(p.pieces!.length).toBeGreaterThan(0)
  })

  it('four corners wrap into four pieces with open sides', () => {
    const r = traceKMap(fn('F(A,B,C,D) = Σm(0,2,8,10)'))
    if (!r.ok) throw new Error('trace failed')
    const pieces = r.trace.primes[0].pieces!
    expect(r.trace.primes[0].term).toBe("B'∙D'")
    expect(pieces).toHaveLength(4)
    expect(pieces.every((p) => Object.values(p.open).filter(Boolean).length === 2)).toBe(true)
  })

  it('a 5-variable group across both maps has a piece in each map', () => {
    const r = traceKMap(fn('F(A,B,C,D,E) = Σm(5,21)'))
    if (!r.ok) throw new Error('trace failed')
    expect(r.trace.primes[0].term).toBe("B'∙C∙D'∙E")
    expect(r.trace.primes[0].pieces!.map((p) => p.map)).toEqual([0, 1])
  })

  it('POS trace ends with the DeMorgan step (L15 p43-44)', () => {
    const r = traceKMap(fn('F(A,B,C,D) = Σm(0,1,2,3,5,7,8,9,10,11)'), { form: 'pos' })
    if (!r.ok) throw new Error('trace failed')
    const last = r.trace.frames[r.trace.frames.length - 1]
    expect(last.why.working).toContain("F' = ")
    expect(r.trace.summary.fitb.split('.').sort()).toEqual(["(A'+B')", "(B'+D)"])
  })

  it('constant functions', () => {
    const zero = traceKMap(fn('F(A,B) = Σm()'))
    const one = traceKMap(fn('F(A,B) = Σm(0,1,2,3)'))
    if (!zero.ok || !one.ok) throw new Error('trace failed')
    expect(zero.trace.summary.answer).toBe('0')
    expect(one.trace.summary.answer).toBe('1')
    expect(traceKMap(fn('F(A) = Σm(1)')).ok).toBe(false)
  })
})
