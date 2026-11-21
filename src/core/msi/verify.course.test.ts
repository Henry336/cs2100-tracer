/** Course-fidelity checks for the msi engine, re-derived from the course text (adversarial verifier). */
import { describe, expect, it } from 'vitest'
import { parseFunction, type BoolFunction } from '../boolean'
import { decoderCircuit, encoderCircuit, findComparatorWirings, findDecoderWirings, implementsWith, muxImplement, muxSearch } from './index'

const ABC = ['A', 'B', 'C']
const ABCD = ['A', 'B', 'C', 'D']
const fn = (text: string, vars: string[]): BoolFunction => {
  const r = parseFunction(text, { vars })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}

describe('decoder enable defaults (L18 p15-16)', () => {
  it('L18 p16: a 0-enable decoder with no enable wire is enabled (E tied to its active level 0), not silently disabled', () => {
    const r = decoderCircuit({ k: 2, enable: 'zero', outputs: 'high' }, { selects: ['A', 'B'] }, ['A', 'B'], { outputs: [0], gate: 'none' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Output 0 of an enabled 2x4 decoder with S1 = A, S0 = B is A'B' = m0.
    expect(r.circuit.f.on).toEqual([0])
  })
})

describe('decoder product finder, more past papers', () => {
  it("AY21/22 S2 Q6 [derived]: one 1-enable 2x4 decoder makes ABC, A'BC, AB'C but not A'B'C'", () => {
    const one = { k: 2, enable: 'one', outputs: 'high' } as const
    expect(['A∙B∙C', "A'∙B∙C", "A∙B'∙C"].map((t) => findDecoderWirings(fn(t, ABC), one).possible)).toEqual([true, true, true])
    expect(findDecoderWirings(fn("A'∙B'∙C'", ABC), one).possible).toBe(false)
  })
})

describe('mux gate counting (L18 p55; R07 p14 inverters count as gates)', () => {
  it("L18 p55: selects BC give A', A', A, A'. One inverter on A feeds all three A' inputs, so the plan needs 1 inverter, not 3", () => {
    const r = muxImplement(fn('Σm(0,1,3,6)', ABC), ['B', 'C'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.text).toBe("A', A', A, A'")
    expect(r.plan.inverters).toBe(1)
  })
  it('AY20/21 S2 Q13b [derived]: Σm(4,6,7,9,11,12,14,15) on one 4:1 mux with no gates, selects BD give 0, A, 1, C', () => {
    const s = muxSearch(fn('Σm(4,6,7,9,11,12,14,15)', ABCD), 2)
    expect(s.noGates.some((p) => p.selects.join('') === 'BD' && p.text === '0, A, 1, C')).toBe(true)
  })
  it('AY18/19 S2 Q5d [derived]: R = Σm(0,2,3,4,6,7,12,14) on one 4:1 mux with no gates, selects AD give 1, C, B, 0', () => {
    const s = muxSearch(fn('Σm(0,2,3,4,6,7,12,14)', ABCD), 2)
    expect(s.noGates.some((p) => p.selects.join('') === 'AD' && p.text === '1, C, B, 0')).toBe(true)
  })
})

describe('comparator finder keeps every solution it ranks (AY20/21 S2 Q11)', () => {
  it('AY20/21 S2 Q11 F1 = ABC [derived]: the course-style wiring 0ABC = 0111 ("ABC = 111") is listed', () => {
    const F1 = fn('A∙B∙C', ABCD)
    expect(implementsWith(F1, { x: ['0', 'A', 'B', 'C'], y: ['0', '1', '1', '1'] }, 'eq')).toBe(true)
    // count is about 35k, but only the first 20,000 in enumeration order are kept, so wirings with a leading 0 pin are dropped before ranking.
    const s = findComparatorWirings(F1, { limit: 100000 })
    expect(s.solutions.some((x) => x.text === 'ABC = 111')).toBe(true)
  })
})

describe("plain encoder: invalid inputs are don't-cares (L18 p26, p29; AY23/24 S2 Q21e key p20)", () => {
  // AY23/24 S2 Q21e: two half adders feed a 4-to-2 encoder, D0 = AB, D1 = A⊕B, D2 = CD, D3 = C⊕D (wiring read off the key's working table).
  // The key's table gives PQ = XX whenever zero or several encoder inputs are high, and answers P = C + D.
  it("rows with no input high or several inputs high are don't-cares in P and Q", () => {
    const r = encoderCircuit(['A∙B', 'A⊕B', 'C∙D', 'C⊕D'], ABCD)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [P, Q] = r.circuit.outputs
    const invalid = [0, 5, 6, 7, 9, 10, 11, 13, 14, 15]
    expect(P.on).toEqual([1, 2, 3])
    expect(P.dc).toEqual(invalid)
    expect(Q.on).toEqual([1, 2, 4, 8])
    expect(Q.dc).toEqual(invalid)
    // The key answers C + D (L15 p34: bigger groups). A'∙B' is also a 2-literal cover of the same care rows, and the
    // boolean minimiser breaks the tie by fewest terms, so only check that the answer agrees with the key on care rows.
    const answer = r.circuit.why[0].working?.replace(/^\S+ = /, '') ?? ''
    const care = (f: BoolFunction) => f.on.filter((m) => !invalid.includes(m))
    expect(care(fn(answer, ABCD))).toEqual(care(fn('C+D', ABCD)))
  })
})
