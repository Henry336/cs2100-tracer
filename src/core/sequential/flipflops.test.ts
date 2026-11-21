import { describe, expect, it } from 'vitest'
import { checkEquivalence, parseExpr } from '../boolean'
import { EXCITATION, FLIP_FLOPS, convertFlipFlop, excite, ffNext, settleLatch, simulateTiming, type TimingSpec } from '.'

describe('flip-flop tables', () => {
  it('L19 p45 excitation tables [official]', () => {
    const moves: [0 | 1, 0 | 1][] = [[0, 0], [0, 1], [1, 0], [1, 1]]
    const show = (t: 'JK' | 'SR' | 'D' | 'T') => moves.map(([q, n]) => EXCITATION[t][q][n].join('')).join(',')
    expect(show('JK')).toBe('0X,1X,X1,X0')
    expect(show('SR')).toBe('0X,10,01,X0')
    expect(show('D')).toBe('0,1,0,1')
    expect(show('T')).toBe('0,1,1,0')
    expect(excite('JK', 0, 1, 'A').why.working).toContain('JA = 1, KA = X')
  })

  it('L19 p27 characteristic tables [official]', () => {
    expect(FLIP_FLOPS.JK.equation).toBe("Q+ = J∙Q' + K'∙Q")
    expect(ffNext('JK', [1, 1], 0).next).toBe(1)
    expect(ffNext('JK', [0, 0], 1).next).toBe(1)
    expect(ffNext('JK', [0, 1], 1).next).toBe(0)
    expect(ffNext('SR', [1, 1], 0).next).toBe('X')
    expect(ffNext('T', [1], 1).next).toBe(0)
    expect(ffNext('D', [1], 0).next).toBe(1)
  })

  it('AY25/26 Q13: a JK with J and K tied together is a T flip-flop [official]', () => {
    for (const q of [0, 1] as const) for (const t of [0, 1] as const) expect(ffNext('JK', [t, t], q).next).toBe(ffNext('T', [t], q).next)
  })

  it('every excitation row really moves Q to Q+ through the characteristic table [derived]', () => {
    for (const type of ['JK', 'SR', 'D', 'T'] as const)
      for (const q of [0, 1] as const)
        for (const n of [0, 1] as const) {
          const ins = EXCITATION[type][q][n]
          const fills = ins.map((v) => (v === 'X' ? [0, 1] : [v])) as (0 | 1)[][]
          const combos = fills.reduce<(0 | 1)[][]>((acc, f) => acc.flatMap((a) => f.map((v) => [...a, v])), [[]])
          for (const c of combos) expect(ffNext(type, c, q).next).toBe(n)
        }
  })
})

describe('latches', () => {
  it('L19 p10-11 S-R latch trace [official]', () => {
    const a = settleLatch('sr-nor', { S: 0, R: 1 }, 1)
    expect([a.q, a.qBar]).toEqual([0, 1])
    const b = settleLatch('sr-nor', { S: 0, R: 0 }, 0)
    expect([b.q, b.qBar]).toEqual([0, 1])
    const c = settleLatch('sr-nor', { S: 1, R: 1 }, 0)
    expect([c.q, c.qBar, c.invalid]).toEqual([0, 0, true])
  })

  it('releasing S = R = 1 together is indeterminate [derived]', () => {
    const d = settleLatch('sr-nor', { S: 0, R: 0 }, 0, 0)
    expect(d.stable).toBe(false)
    expect(d.q).toBe('X')
  })

  it('L19 p12 active-low latch, p14-15 gated D latch [official]', () => {
    expect(settleLatch('sr-nand', { "S'": 0, "R'": 1 }, 0).q).toBe(1)
    expect(settleLatch('sr-nand', { "S'": 0, "R'": 0 }, 0).invalid).toBe(true)
    expect(settleLatch('gated-d', { EN: 1, D: 1 }, 0).q).toBe(1)
    expect(settleLatch('gated-d', { EN: 0, D: 1 }, 0).q).toBe(0)
    expect(settleLatch('gated-sr', { EN: 0, S: 1, R: 0 }, 0).q).toBe(0)
  })
})

describe('timing', () => {
  const run = (spec: TimingSpec) => {
    const r = simulateTiming(spec)
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
    return r.trace
  }

  it('positive-edge D flip-flop samples only at rising edges [derived]', () => {
    const t = run({ element: 'D', waves: { CLK: [0, 1, 1, 0, 0, 1, 0], D: [1, 0, 0, 0, 0, 1, 1] } })
    expect(t.edges).toEqual([1, 5])
    expect(t.q).toEqual([0, 1, 1, 1, 1, 0, 0])
  })

  it('negative-edge flip-flop and gated D latch differ (L19 p8, p14) [derived]', () => {
    const waves: TimingSpec['waves'] = { CLK: [1, 0, 1, 0], EN: [1, 0, 1, 0], D: [1, 0, 0, 1] }
    expect(run({ element: 'D', edge: 'neg', waves }).q).toEqual([0, 1, 1, 0])
    expect(run({ element: 'gated-d', waves }).q).toEqual([1, 1, 0, 0])
  })

  it('JK toggles on J = K = 1; active-low PRE and CLR override (L19 p25) [derived]', () => {
    const t = run({
      element: 'JK',
      asyncLevel: 'low',
      waves: { CLK: [0, 1, 0, 1, 0, 1, 0, 1], J: [1, 1, 1, 1, 1, 1, 1, 1], K: [1, 1, 1, 1, 1, 1, 1, 1], PRE: [1, 1, 1, 1, 0, 1, 1, 1], CLR: [1, 1, 1, 1, 1, 1, 0, 1] },
    })
    expect(t.q).toEqual([0, 1, 1, 0, 1, 0, 0, 1])
    expect(t.overrides).toEqual([4, 6])
    expect(t.frames[4].event).toBe('preset')
  })

  it('active-high async inputs (L19 p24) and bad waveforms [derived]', () => {
    expect(run({ element: 'T', waves: { CLK: [0, 1, 0], T: [1, 1, 1], CLR: [0, 0, 1] } }).q).toEqual([0, 1, 0])
    const bad = simulateTiming({ element: 'D', waves: { CLK: [0, 1], D: [1] } })
    expect(bad.ok).toBe(false)
  })
})

describe('flip-flop conversion (L19 p44-46 applied to one flip-flop)', () => {
  const eq = (c: ReturnType<typeof convertFlipFlop>, label: string) => c.equations.find((e) => e.label === label)!.text
  const same = (a: string, b: string, vars: string[]) => {
    const pa = parseExpr(a)
    const pb = parseExpr(b)
    if (!pa.ok || !pb.ok) throw new Error('parse')
    return checkEquivalence(pa.expr, pb.expr, vars).equivalent
  }
  it('a T flip-flop made into a J-K: T = J∙Q\' + K∙Q [derived]', () => {
    const c = convertFlipFlop('T', 'JK')
    expect(c.vars).toEqual(['J', 'K', 'Q'])
    expect(same(eq(c, 'T'), "J∙Q' + K∙Q", c.vars)).toBe(true)
  })
  it('a J-K made into a T: J = K = T, matching AY25/26 Q13 [derived]', () => {
    const c = convertFlipFlop('JK', 'T')
    expect(eq(c, 'J')).toBe('T')
    expect(eq(c, 'K')).toBe('T')
  })
  it('a D made into an S-R: S = R = 1 rows are don\'t-cares [derived]', () => {
    const c = convertFlipFlop('D', 'SR')
    expect(c.rows.filter((r) => r.next === 'X')).toHaveLength(2)
    expect(same(eq(c, 'D'), "S + R'∙Q", c.vars)).toBe(true)
  })
})
