/** Decoders, encoders, multiplexers: every L18 / T08 / R09 / past-paper fixture in docs/spec/logic.md and features/comb-seq.md. */
import { describe, expect, it } from 'vitest'
import { parseFunction, type BoolFunction } from '../boolean'
import {
  decode,
  decoderBuilds,
  decoderCircuit,
  decoderTree,
  demux,
  encode,
  encoderCircuit,
  encoderEquations,
  findDecoderWirings,
  mux,
  muxCircuit,
  muxImplement,
  muxSearch,
  outputFormula,
  priorityEncode,
  priorityEquations,
  priorityTable,
  type DecoderSpec,
  type DecoderUse,
  type DecoderWiring,
} from './index'

const ABC = ['A', 'B', 'C']
const ABCD = ['A', 'B', 'C', 'D']
const fn = (text: string, vars = ABC): BoolFunction => {
  const r = parseFunction(text, { vars })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}
const dec = (spec: DecoderSpec, w: DecoderWiring, use: DecoderUse, vars = ABC) => {
  const r = decoderCircuit(spec, w, vars, use)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.circuit
}
const plan = (f: BoolFunction, sel: string) => {
  const r = muxImplement(f, sel.split(''))
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.plan
}
const zeroLow: DecoderSpec = { k: 2, enable: 'zero', outputs: 'low' }

describe('decoder basics (L18 p13-20; R09 p19, p58)', () => {
  it('1-enable: disabled gives all 0; active-low: disabled gives all 1 [official]', () => {
    expect(decode({ k: 2, enable: 'one', outputs: 'high' }, 2, 0)).toMatchObject({ ok: true, outputs: [0, 0, 0, 0] })
    expect(decode({ k: 2, enable: 'one', outputs: 'high' }, 2, 1)).toMatchObject({ ok: true, outputs: [0, 0, 1, 0] })
    expect(decode({ k: 2, enable: 'one', outputs: 'low' }, 2, 1)).toMatchObject({ ok: true, outputs: [1, 1, 0, 1] })
    expect(decode({ k: 2, enable: 'zero', outputs: 'low' }, 1, 1)).toMatchObject({ ok: true, outputs: [1, 1, 1, 1] })
  })
  it('0-enable active-low output formula is E + M_i (R09 p58) [official]', () => {
    expect(outputFormula(zeroLow, 0)).toMatchObject({ short: 'E+M0', text: 'E+S1+S0' })
    expect(outputFormula({ k: 2, enable: 'one', outputs: 'high' }, 2).text).toBe("E∙S1∙S0'")
  })
})

describe('decoder + gate', () => {
  it("AY24/25 Q6 key A [official]: 0-enable active-low, S1=A, S0=C, E=B, output 0 gives A+B+C", () => {
    const c = dec(zeroLow, { selects: ['A', 'C'], enable: 'B' }, { outputs: [0], gate: 'none' })
    expect(c.f.on).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it("AY23/24 S2 Q21b [official]: E=C, S1=A, S0=B, AND of outputs 1 and 3 gives B'+C", () => {
    const c = dec(zeroLow, { selects: ['A', 'B'], enable: 'C' }, { outputs: [1, 3], gate: 'AND' })
    expect(c.f.on).toEqual(fn("B'+C").on)
  })
  it('AY25/26 Q11 key B [official]: 3x8 active-high, NOR of D1, D3, D6 gives Σm(0,2,4,5,7)', () => {
    const c = dec({ k: 3, enable: 'none', outputs: 'high' }, { selects: ABC }, { outputs: [1, 3, 6], gate: 'NOR' })
    expect(c.f.on).toEqual([0, 2, 4, 5, 7])
  })
  it('L18 p23-24 [official]: the four builds of Σm(0,1,4,6,7) = ΠM(2,3,5) all give f', () => {
    const f = fn('Σm(0,1,4,6,7)')
    const builds = decoderBuilds(f)
    expect(builds.map((b) => [b.spec.outputs, b.use.gate, b.use.outputs])).toEqual([
      ['high', 'OR', [0, 1, 4, 6, 7]],
      ['low', 'NAND', [0, 1, 4, 6, 7]],
      ['high', 'NOR', [2, 3, 5]],
      ['low', 'AND', [2, 3, 5]],
    ])
    for (const b of builds) expect(dec(b.spec, { selects: ABC }, b.use).f.on).toEqual(f.on)
  })
  it('R09 p58 (AY19/20 Q5a) [official]: N = A+B+C with E=C, S1=A, S0=B, output 0', () => {
    expect(dec(zeroLow, { selects: ['A', 'B'], enable: 'C' }, { outputs: [0], gate: 'none' }).f.on).toEqual(fn('A+B+C').on)
  })
  it('R09 p56 (AY17/18 Q3c) [official]: H = Σm(12,13) with E=A, S1=B, S0=C, output 2', () => {
    const c = dec({ k: 2, enable: 'one', outputs: 'high' }, { selects: ['B', 'C'], enable: 'A' }, { outputs: [2], gate: 'none' }, ABCD)
    expect(c.f.on).toEqual([12, 13])
  })
  it("R09 p53 (AY16/17 Q2b) [official]: G = Σm(2,11) with EN=C, S1=A⊕D, S0=B, output 0", () => {
    const c = dec({ k: 2, enable: 'one', outputs: 'high' }, { selects: ['A⊕D', 'B'], enable: 'C' }, { outputs: [0], gate: 'none' }, ABCD)
    expect(c.f.on).toEqual([2, 11])
    expect(c.gated).toEqual(['S1'])
  })
  it('T08 Q2 [official]: K(W,X,Y,Z) = Σm(8,11) with E = Y⊙Z, S1=W, S0=X, output 2', () => {
    const c = dec({ k: 2, enable: 'one', outputs: 'high' }, { selects: ['W', 'X'], enable: 'Y⊙Z' }, { outputs: [2], gate: 'none' }, ['W', 'X', 'Y', 'Z'])
    expect(c.f.on).toEqual([8, 11])
  })
})

describe('decoder product finder', () => {
  const one: DecoderSpec = { k: 2, enable: 'one', outputs: 'high' }
  it("AY23/24 S1 Q9 key A [official]: ABC and A'BC' are possible, A'B'C' is not", () => {
    expect(findDecoderWirings(fn('A∙B∙C'), one).possible).toBe(true)
    const s = findDecoderWirings(fn("A'∙B∙C'"), one)
    expect(s.solutions.some((x) => x.enable === 'B' && x.selects.join('') === 'AC' && x.output === 0)).toBe(true)
    expect(findDecoderWirings(fn("A'∙B'∙C'"), one).possible).toBe(false)
  })
  it('R09 p56 [official]: finds E=A, S1=B, S0=C, output 2 for Σm(12,13)', () => {
    const s = findDecoderWirings(fn('Σm(12,13)', ABCD), one)
    expect(s.solutions.some((x) => x.text === 'E = A, S1 = B, S0 = C, output 2')).toBe(true)
  })
})

describe('larger decoders (L18 p17-19; R09 p18)', () => {
  it('3x8 from two 2x4 decoders and one inverter [official]', () => {
    const r = decoderTree(3, 2, 5)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect([r.tree.decoders, r.tree.inverters]).toEqual([2, 1])
    const hi = r.tree.nodes[r.tree.path[1]]
    expect(hi.enable).toEqual({ from: 'bit', text: 'A2' })
    expect(hi.outputs).toEqual([4, 5, 6, 7])
  })
  it('4x16 from five 2x4 decoders [official], and from two 3x8 decoders', () => {
    const r = decoderTree(4, 2, 9)
    expect(r.ok && [r.tree.decoders, r.tree.inverters]).toEqual([5, 0])
    if (r.ok) expect(r.tree.nodes[r.tree.path[1]].outputs).toContain(9)
    const r3 = decoderTree(4, 3)
    expect(r3.ok && [r3.tree.decoders, r3.tree.inverters]).toEqual([2, 1])
  })
})

describe('encoders (L18 p26-33)', () => {
  it('4-to-2: D0 = F1+F3, D1 = F2+F3; 8-to-3 z = D1+D3+D5+D7 [official]', () => {
    expect(encoderEquations(4).map((e) => e.text)).toEqual(['D2+D3', 'D1+D3'])
    expect(encoderEquations(8).map((e) => e.text)).toEqual(['D4+D5+D6+D7', 'D2+D3+D6+D7', 'D1+D3+D5+D7'])
  })
  it('AY23/24 S2 Q15 key D [official]: 16-to-4 Y (bit 1) = D2+D3+D6+D7+D10+D11+D14+D15', () => {
    expect(encoderEquations(16)[2].text).toBe('D2+D3+D6+D7+D10+D11+D14+D15')
  })
  it('a plain encoder with D1 and D2 high gives 11, which looks like D3', () => {
    expect(encode([0, 1, 1, 0])).toMatchObject({ code: [1, 1], misleading: true })
  })
  it('L18 p32-33 priority 4-to-2 [derived]: D0..D3 = 1010 gives fg = 10, V = 1; 0000 gives V = 0', () => {
    expect(priorityEncode([1, 0, 1, 0])).toMatchObject({ code: [1, 0], v: 1, winner: 2 })
    expect(priorityEncode([0, 0, 0, 0])).toMatchObject({ code: ['X', 'X'], v: 0 })
    expect(priorityTable(4)).toHaveLength(5)
    expect(priorityTable(4)[4].inputs).toEqual([1, 'X', 'X', 'X'])
  })
  it('L18 p33 priority equations [derived]: f = D2+D3, g = D3 + D1∙D2\', V = D0+D1+D2+D3', () => {
    const vars = ['D3', 'D2', 'D1', 'D0']
    const eq = priorityEquations(4)
    expect(fn(eq[0].text, vars).on).toEqual(fn('D2+D3', vars).on)
    expect(fn(eq[1].text, vars).on).toEqual(fn("D3+D1∙D2'", vars).on)
    expect(eq[2]).toMatchObject({ output: 'V', text: 'D0+D1+D2+D3' })
  })
  it("T08 Q5 / AY24/25 Q17c [official answer, derived wiring F7=A, F5=B, F3=C, F1=1]: H2 = A+B, H1 = A+B'C, H0 = 1", () => {
    const r = encoderCircuit(['0', '1', '0', 'C', '0', 'B', '0', 'A'], ABC, { priority: true, valid: false })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [h2, h1, h0] = r.circuit.outputs
    expect(h2.on).toEqual(fn('A+B').on)
    expect(h1.on).toEqual(fn("A+B'∙C").on)
    expect(h0.on).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('mux and demux (L18 p35-41)', () => {
  it('Y copies the selected data input', () => {
    const r = mux(2, [0, 0, 1, 0])
    expect(r.ok && r.output).toBe(1)
    expect(r.ok && r.terms.map((t) => t.value)).toEqual([0, 0, 1, 0])
  })
  it('demux sends D to Y_i only', () => {
    expect(demux(1, 3, 2).outputs).toEqual([0, 0, 0, 1])
  })
  it('a wired 4:1 mux evaluates to its function', () => {
    const r = muxCircuit(['A', 'B'], ['1', 'C', '0', "C'"], ABC)
    expect(r.ok && r.circuit.f.on).toEqual([0, 1, 3, 6])
  })
})

describe('mux function implementation', () => {
  const T08 = () => fn('ΠM(1,5,6)∙D(4)', ['X', 'Y', 'Z'])
  it('T08 Q1 [official]: 8:1 gives 1,0,1,1,X,0,0,1; 4:1 on XY gives Z\', 1, 0, Z', () => {
    expect(plan(T08(), 'XYZ').text).toBe('1, 0, 1, 1, X, 0, 0, 1')
    const p = plan(T08(), 'XY')
    expect(p.text).toBe("Z', 1, 0, Z")
    expect(p.inverters).toBe(1)
  })
  it("T08 Q1 [derived]: 4:1 on YZ gives 1, 0, X', 1", () => {
    expect(plan(T08(), 'YZ').text).toBe("1, 0, X', 1")
  })
  it("L18 p52-54 [official]: Σm(0,1,3,6) on AB gives 1, C, 0, C'; on BC gives A', A', A, A'", () => {
    expect(plan(fn('Σm(0,1,3,6)'), 'AB').text).toBe("1, C, 0, C'")
    expect(plan(fn('Σm(0,1,3,6)'), 'BC').text).toBe("A', A', A, A'")
  })
  it('AY23/24 S1 Q10 key B [official]: Σm(3,4,5,7) on AB, Σm(0,2,6) on AC, Σm(0) impossible', () => {
    expect(plan(fn('Σm(3,4,5,7)'), 'AB')).toMatchObject({ text: '0, C, 1, C', noGates: true })
    expect(plan(fn('Σm(0,2,6)'), 'AC')).toMatchObject({ text: '1, 0, B, 0', noGates: true })
    expect(muxSearch(fn('Σm(0)')).noGates).toHaveLength(0)
  })
  it('AY23/24 S2 Q21a [official]: F1 = Σm(0,2,3,5,6,7) needs selects AC (or CA), data 1, B, B, 1', () => {
    const s = muxSearch(fn('Σm(0,2,3,5,6,7)'))
    expect(s.noGates.map((p) => p.selects.join(''))).toEqual(['AC', 'CA'])
    expect(s.noGates[0].text).toBe('1, B, B, 1')
  })
  it('R09 p55 (AY17/18 Q3b) [official]: G = ΠM(1,2,6,8,9,11,13) on an 8:1 with ACD gives 1,B,0,1,B,0,1,B', () => {
    expect(plan(fn('ΠM(1,2,6,8,9,11,13)', ABCD), 'ACD')).toMatchObject({ text: '1, B, 0, 1, B, 0, 1, B', noGates: true })
  })
  it("L18 p56 74151A [derived]: Σm(0,1,2,3,4,9,13,14,15) on x1x2x3 gives 1,1,x4',0,x4,0,x4,1", () => {
    const v = ['x1', 'x2', 'x3', 'x4']
    const r = muxImplement(fn('Σm(0,1,2,3,4,9,13,14,15)', v), ['x1', 'x2', 'x3'])
    expect(r.ok && r.plan.text).toBe("1, 1, x4', 0, x4, 0, x4, 1")
  })
  it("T08 Q4 / AY24/25 Q17b [official rows, function rebuilt from them]: G on selects AB is 0, C'D + CD', D, 1", () => {
    const G = fn("A'∙B∙(C⊕D) + A∙B'∙D + A∙B", ABCD)
    const p = plan(G, 'AB')
    expect(p.data.map((d) => d.kind)).toEqual(['const', 'expression', 'literal', 'const'])
    expect(fn(p.data[1].text, ['C', 'D']).on).toEqual([1, 2])
    expect([p.data[0].text, p.data[2].text, p.data[3].text]).toEqual(['0', 'D', '1'])
  })
})
