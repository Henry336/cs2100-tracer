/** Adders, delays and comparators: every L17 / T07 / past-paper fixture in docs/spec/logic.md and features/comb-seq.md. */
import { describe, expect, it } from 'vitest'
import { combine, parseFunction, type BoolFunction } from '../boolean'
import { compareValues, comparatorCircuit, findComparatorWirings, fullAdder, fullAdderTiming, implementsWith, rippleAdd, rippleDelay } from './index'
import type { Bit } from './signals'

const fn = (text: string, vars = ['A', 'B', 'C', 'D']): BoolFunction => {
  const r = parseFunction(text, { vars })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}
const add = (width: number, x: number, y: number, cin: Bit = 0) => {
  const r = rippleAdd({ width, x, y, cin })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.trace
}

describe('full adder (L17 p9-12) [official]', () => {
  it('XYZ = 011 gives C=1,S=0 and 111 gives C=1,S=1', () => {
    expect(fullAdder(0, 1, 1)).toMatchObject({ c: 1, s: 0 })
    expect(fullAdder(1, 1, 1)).toMatchObject({ c: 1, s: 1 })
  })
  it('C = Σm(3,5,6,7), S = Σm(1,2,4,7)', () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => fullAdder(((r >> 2) & 1) as Bit, ((r >> 1) & 1) as Bit, (r & 1) as Bit))
    expect(rows.flatMap((f, r) => (f.c ? [r] : []))).toEqual([3, 5, 6, 7])
    expect(rows.flatMap((f, r) => (f.s ? [r] : []))).toEqual([1, 2, 4, 7])
  })
})

describe('ripple-carry adder', () => {
  it('L17 p20: X=1010, Y=1111, Cin=0 gives C5=1, S=1001 (25) [official]', () => {
    const t = add(4, 0b1010, 0b1111)
    expect(t.cout).toBe(1)
    expect(t.columns.sum).toBe('1001')
    expect(t.total).toBe(25)
  })
  it('L17 p27: A=1011, B=0011 gives carry-in row 0110, S=1110, carry-out row 0011 [official]', () => {
    const t = add(4, 0b1011, 0b0011)
    expect(t.columns).toMatchObject({ carryIn: '0110', sum: '1110', carryOut: '0011' })
  })
  it('one frame per FA plus input and result frames', () => {
    const t = add(4, 5, 3)
    expect(t.frames).toHaveLength(6)
    expect(t.frames[4].carries).toEqual([0, 1, 1, 1, 0])
  })
  it('BCD to Excess-3 as BCD + 0011 (L17 p22-23) [official]: 0101 → 1000, 1001 → 1100', () => {
    expect(add(4, 0b0101, 0b0011).sum).toBe(0b1000)
    expect(add(4, 0b1001, 0b0011).sum).toBe(0b1100)
  })
  it('T07 Q2a (ABCD+1)/2 with one adder [official]: 0110 → 0011, 1101 → 0111, 1111 → 1000', () => {
    const half = (v: number) => Math.floor(add(4, v, 1).total / 2)
    expect([0b0110, 0b1101, 0b1111].map(half)).toEqual([0b0011, 0b0111, 0b1000])
  })
  it('rejects out-of-range inputs with a plain message', () => {
    const r = rippleAdd({ width: 4, x: 16, y: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].message).toMatch(/0 to 15/)
  })
})

describe('gate delays (L17 p34-38) [official]', () => {
  it('full adder: S at 2t, C at 3t', () => {
    expect(fullAdderTiming(0)).toMatchObject({ ha1: 1, s: 2, cout: 3 })
  })
  it('4-bit: S1=2t, C2=3t, S2=4t, C3=5t, S3=6t, C4=7t, S4=8t, C5=9t', () => {
    const t = add(4, 0, 0)
    expect(t.stages.map((s) => [s.timing.s, s.timing.cout])).toEqual([
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
    ])
    expect(t.delay).toMatchObject({ s: 8, cout: 9 })
  })
  it('16-bit: S16 = 32t, C17 = 33t, matching ((n-1)∙2+2)t and ((n-1)∙2+3)t', () => {
    expect(add(16, 0, 0).delay).toMatchObject({ s: 32, cout: 33 })
    expect(rippleDelay(16)).toEqual({ s: 32, cout: 33 })
  })
})

describe('magnitude comparator (L17 p30-33)', () => {
  it('cascade from the MSB: 1010 vs 1001 is decided at bit 1 [derived]', () => {
    const r = compareValues(0b1010, 0b1001)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trace.out).toEqual({ lt: 0, eq: 0, gt: 1 })
    expect(r.trace.bits.map((b) => b.x)).toEqual([1, 1, 0, 0])
    expect(r.trace.bits.map((b) => b.gtTerm)).toEqual([0, 0, 1, 0])
    expect(r.trace.decidingBit).toBe(2)
  })
  it('equal values give x3x2x1x0 = 1 [derived]', () => {
    const r = compareValues(6, 6)
    expect(r.ok && r.trace.out).toEqual({ lt: 0, eq: 1, gt: 0 })
  })
  it('L17 p33: (ABCD > 0010) AND (ABCD < 1101) = Σm(3..12) [official]', () => {
    const v = ['A', 'B', 'C', 'D']
    const c1 = comparatorCircuit({ x: v, y: ['0', '0', '1', '0'] }, v)
    const c2 = comparatorCircuit({ x: v, y: ['1', '1', '0', '1'] }, v)
    if (!c1.ok || !c2.ok) throw new Error('wiring')
    expect(combine(c1.circuit.fns.gt, c2.circuit.fns.lt, 'and')?.fn.on).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
  it('R09 p57 (AY18/19 Q5c): multiple of 17 is ABCD = EFGH on 8 variables [official]', () => {
    const v = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const c = comparatorCircuit({ x: v.slice(0, 4), y: v.slice(4) }, v)
    if (!c.ok) throw new Error('wiring')
    expect(c.circuit.fns.eq.on.includes(0b00110011)).toBe(true)
    expect(c.circuit.fns.eq.on.includes(0b00110100)).toBe(false)
    expect(c.circuit.fns.eq.on.every((m) => m % 17 === 0)).toBe(true)
  })
  it('reports a bad wire by pin name', () => {
    const c = comparatorCircuit({ x: ['A', 'B', 'C', 'Q'], y: ['0', '0', '0', '0'] }, ['A', 'B', 'C', 'D'])
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.errors[0].message).toMatch(/X0: unknown variable Q/)
  })
})

describe('single comparator, no gates (finder)', () => {
  const expectWorks = (f: BoolFunction, x: string, y: string, out: 'lt' | 'eq' | 'gt') =>
    expect(implementsWith(f, { x: x.split(''), y: y.split('') }, out), `${x} ${out} ${y}`).toBe(true)

  it('T07 Q5 [official]: F=Σm(12-15), G=Σm(0,6,9,15), H=Σm(0,1,6,7,8,9,14,15), Z=odd except 15', () => {
    const F = fn('Σm(12,13,14,15)')
    const G = fn('Σm(0,6,9,15)')
    const H = fn('Σm(0,1,6,7,8,9,14,15)')
    const Z = fn('Σm(1,3,5,7,9,11,13)')
    expectWorks(F, 'ABCD', '1011', 'gt')
    expectWorks(G, 'ABCD', 'DCBA', 'eq')
    expectWorks(H, 'B000', 'C000', 'eq')
    expectWorks(Z, 'ABCD', 'DDDD', 'lt')
    expectWorks(Z, 'ABCD', 'DABC', 'lt')
    for (const f of [F, G, H, Z]) expect(findComparatorWirings(f).possible).toBe(true)
    expect(findComparatorWirings(F).solutions[0].text).toBe('AB = 11')
    expect(findComparatorWirings(G).solutions[0].text).toBe('AB = DC') // same function as ABCD = DCBA: A = D and B = C
  })
  it('the finder lists the T07 answers among its solutions', () => {
    const s = findComparatorWirings(fn('Σm(0,6,9,15)'), { limit: 100000 })
    expect(s.solutions.some((x) => x.text === 'ABCD = DCBA')).toBe(true)
    expect(s.count).toBeGreaterThan(1)
  })
  it('AY24/25 Q7 [derived: key is red-only]: ABCD < 1001, A = D, ABCD = BCDA all work', () => {
    const F1 = fn('Σm(0,1,2,3,4,5,6,7,8)')
    const F2 = fn('Σm(0,2,4,6,9,11,13,15)')
    const F3 = fn('Σm(0,15)')
    expectWorks(F1, 'ABCD', '1001', 'lt')
    expectWorks(F2, '000A', '000D', 'eq')
    expectWorks(F3, 'ABCD', 'BCDA', 'eq')
    expect(findComparatorWirings(F2).solutions[0].text).toBe('A = D')
  })
  it('AY25/26 Q8 key D [official]: AD < BC and ABC < D work, F2 is impossible', () => {
    const F1 = fn('Σm(2,4,5,6,7,14)')
    const F2 = fn('Σm(2,4,6,8,9,11,13,15)')
    const F3 = fn('ΠM(0,2,3,4,5,6,7,8,9,10,11,12,13,14,15)')
    expectWorks(F1, '00AD', '00BC', 'lt')
    expectWorks(F3, '0ABC', '000D', 'lt')
    expect(findComparatorWirings(F1).solutions.some((s) => s.text === 'AD < BC')).toBe(true)
    expect(findComparatorWirings(F3).solutions.some((s) => s.text === 'ABC < D')).toBe(true)
    const none = findComparatorWirings(F2)
    expect(none.possible).toBe(false)
    expect(none.count).toBe(0)
  })
  it('R09 p52 (AY16/17 Q2a): 2-bit comparator, F = Σm(1,4,5,6,7,13) = (AC < BD) [official]', () => {
    const F = fn('Σm(1,4,5,6,7,13)')
    expectWorks(F, 'AC', 'BD', 'lt')
    expect(findComparatorWirings(F, { width: 2 }).solutions.some((s) => s.text === 'AC < BD')).toBe(true)
  })
})
