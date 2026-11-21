/** Fixes and features added after the verifier pass: finder ranking and limits, two comparators + gate, mux trees, quad mux, netlists. */
import { describe, expect, it } from 'vitest'
import { minimize, parseFunction, type BoolFunction } from '../boolean'
import {
  blockFromSpec,
  blockPins,
  comparatorCircuit,
  encoderCircuit,
  encoderEquations,
  pinCount,
  reachableFunctions,
  decode,
  demuxCircuit,
  decoderCircuit,
  findComparatorPairs,
  findComparatorWirings,
  findDecoderWirings,
  implementsWith,
  mismatchRows,
  mux,
  muxImplement,
  muxTree,
  netlist,
  priorityEquations,
  priorityTable,
  quadMux,
  type CmpOutput,
  type NetBlock,
} from './index'

const ABCD = ['A', 'B', 'C', 'D']
const fn = (text: string, vars = ABCD): BoolFunction => {
  const r = parseFunction(text, { vars })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}

describe('comparator finder: exhaustive count, streaming rank, 8 variables', () => {
  it('count matches a brute-force implementsWith run (2-bit comparator, 4 variables) [derived]', () => {
    const src = ['A', 'B', 'C', 'D', '0', '1']
    for (const f of [fn('Σm(1,4,5,6,7,13)'), fn('Σm(0,5,10,15)'), fn('A∙B')]) {
      let brute = 0
      for (let c = 0; c < 6 ** 4; c++) {
        const p = [0, 1, 2, 3].map((j) => src[Math.floor(c / 6 ** (3 - j)) % 6])
        for (const o of ['lt', 'eq', 'gt'] as CmpOutput[]) if (implementsWith(f, { x: p.slice(0, 2), y: p.slice(2) }, o)) brute++
      }
      expect(findComparatorWirings(f, { width: 2 }).count).toBe(brute)
    }
  })
  it('AY20/21 S2 Q11 F1 = ABC [derived]: every one of the 34968 solutions is ranked, so the default list shows ABC = 111', () => {
    const s = findComparatorWirings(fn('A∙B∙C'))
    expect(s.count).toBe(34968)
    expect(s.complete).toBe(true)
    expect(s.solutions.some((x) => x.text === 'ABC = 111')).toBe(true)
  })
  it('R09 p57 (AY18/19 Q5c) [official]: a multiple of 17 on 8 bits is ABCD = EFGH, found with no gates', () => {
    const vars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const F = fn(`Σm(${Array.from({ length: 16 }, (_, i) => 17 * i).join(',')})`, vars)
    const t = performance.now()
    const s = findComparatorWirings(F)
    expect(performance.now() - t).toBeLessThan(3000)
    expect(s.solutions.some((x) => x.text === 'ABCD = EFGH')).toBe(true)
  }, 20000)
  it('more than 8 variables: a structured answer, not a throw', () => {
    const vars = 'ABCDEFGHI'.split('')
    const s = findComparatorWirings(fn('A', vars))
    expect(s).toMatchObject({ possible: false, complete: false })
  })
})

describe('two comparators and one gate (L17 p33; AY15/16 Q8; AY21/22 S2 Q14c)', () => {
  // Rebuild a pair solution and check it against F on every care row.
  const works = (F: BoolFunction, s: ReturnType<typeof findComparatorPairs>['solutions'][number]) => {
    const f1 = comparatorCircuit(s.first, F.vars)
    const f2 = comparatorCircuit(s.second, F.vars)
    if (!f1.ok || !f2.ok) return false
    const a = new Set(f1.circuit.fns[s.first.output].on)
    const b = new Set(f2.circuit.fns[s.second.output].on)
    return Array.from({ length: 1 << F.vars.length }, (_, r) => r).every((r) => {
      if (F.dc.includes(r)) return true
      const and = a.has(r) && b.has(r)
      const or = a.has(r) || b.has(r)
      const v = { AND: and, OR: or, NAND: !and, NOR: !or }[s.gate]
      return v === F.on.includes(r)
    })
  }
  it('L17 p33 [official]: 3 <= ABCD <= 12 is two 4-bit comparators and an AND', () => {
    const F = fn('Σm(3,4,5,6,7,8,9,10,11,12)')
    const s = findComparatorPairs(F, { gates: ['AND'] })
    expect(s.possible).toBe(true)
    expect(s.solutions.every((x) => works(F, x))).toBe(true)
    expect(findComparatorWirings(F).possible).toBe(false)
  })
  it('AY15/16 Q8 [derived]: Σm(5,6,9,10) with two 2-bit comparators and one gate', () => {
    const F = fn('Σm(5,6,9,10)')
    const s = findComparatorPairs(F, { width: 2 })
    expect(s.possible).toBe(true)
    expect(s.solutions.every((x) => works(F, x))).toBe(true)
  })
  it('AY21/22 S2 Q14c(iii) [derived]: G = Σm(0,4,6,8,9,10,12,13,14,15) with two comparators and an OR', () => {
    const F = fn('Σm(0,4,6,8,9,10,12,13,14,15)')
    const s = findComparatorPairs(F, { gates: ['OR'] })
    expect(s.possible).toBe(true)
    expect(s.solutions.every((x) => works(F, x))).toBe(true)
  })
})

describe('priority encoder equations and table', () => {
  it('the closed form equals the minimiser for 4 and 8 inputs, with the same number of terms [derived]', () => {
    for (const m of [4, 8]) {
      const vars = Array.from({ length: m }, (_, i) => `D${m - 1 - i}`)
      const winner = (r: number) => {
        for (let i = m - 1; i >= 0; i--) if ((r >> i) & 1) return i
        return -1
      }
      priorityEquations(m, { valid: false }).forEach((eq, p) => {
        const j = Math.log2(m) - 1 - p
        const rows = Array.from({ length: 1 << m }, (_, r) => r)
        const want = rows.filter((r) => winner(r) >= 0 && (winner(r) >> j) & 1)
        expect(fn(eq.text, vars).on.filter((r) => r !== 0)).toEqual(want)
        const min = minimize(fn(`Σm(${want.join(',')})∙D(0)`, vars), 'sop')
        expect(eq.text.split(' + ')).toHaveLength(min.summary.terms)
      })
    }
  })
  it('L18 p33 [derived]: g = D3 + D2\'∙D1; 16-to-4 is instant', () => {
    expect(priorityEquations(4)[1].text).toBe("D3 + D2'∙D1")
    const t = performance.now()
    expect(priorityEquations(16)).toHaveLength(5)
    expect(performance.now() - t).toBeLessThan(100)
  })
  it('L18 p32 [official]: with columns D0..D3 the D3 row reads X X X 1', () => {
    expect(priorityTable(4, { order: 'low-first' })[4].inputs).toEqual(['X', 'X', 'X', 1])
  })
})

describe('decoder finder speed (L18 p17 sizes)', () => {
  it('a 4x16 0-enable active-low decoder on 4 variables is searched in well under a second', () => {
    const t = performance.now()
    const s = findDecoderWirings(fn("A'∙B'∙C'∙D'"), { k: 4, enable: 'zero', outputs: 'low' })
    expect(performance.now() - t).toBeLessThan(1000)
    expect(s.possible).toBe(false)
  })
})

describe('validation returns errors (architecture: never throw, never print garbage)', () => {
  it('decode rejects a select value out of range; an unwired 0-enable decoder is enabled', () => {
    expect(decode({ k: 2, enable: 'none', outputs: 'high' }, 7).ok).toBe(false)
    expect(decode({ k: 2, enable: 'zero', outputs: 'high' }, 1)).toMatchObject({ ok: true, enabled: true, outputs: [0, 1, 0, 0] })
  })
  it('mux rejects a data list whose length is not a power of 2', () => {
    expect(mux(1, [0, 1, 0]).ok).toBe(false)
  })
})

describe('mux plan gate cost (R07 p14)', () => {
  it("T08 Q4 [derived]: data 0, C'∙D + C∙D', D, 1 needs 2 inverters (C, D) and 3 gates (2 AND, 1 OR)", () => {
    const G = fn("A'∙B∙(C⊕D) + A∙B'∙D + A∙B")
    const r = muxImplement(G, ['A', 'B'])
    expect(r.ok && [r.plan.inverters, r.plan.gates]).toEqual([2, 3])
  })
})

describe('larger muxes from smaller ones (L18 p42-45)', () => {
  it('L18 p42 [official]: two 4:1 + one 2:1, S2S1S0 = 110 gives I6', () => {
    const r = muxTree(3, [2, 1], 6)
    expect(r.ok && [r.tree.output, r.tree.blocks]).toEqual([6, { 4: 2, 2: 1 }])
  })
  it('L18 p44 [official]: four 2:1 (S0) + one 4:1 (S2S1), 101 gives I5', () => {
    const r = muxTree(3, [1, 2], 5)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tree.output).toBe(5)
    expect(r.tree.blocks).toEqual({ 2: 4, 4: 1 })
    expect(r.tree.nodes[0]).toMatchObject({ selects: ['S0'], inputs: ['I0', 'I1'] })
    expect(r.tree.nodes[4].selects).toEqual(['S2', 'S1'])
  })
  it('L18 p45 [official]: 16:1 from five 4:1, every select value reaches its own input', () => {
    for (let s = 0; s < 16; s++) {
      const r = muxTree(4, [2, 2], s)
      expect(r.ok && [r.tree.output, r.tree.nodes.length]).toEqual([s, 5])
    }
    expect(muxTree(3, [2, 2]).ok).toBe(false)
  })
  it("L18 p41 [official]: quad 2:1, E' = 1 gives all 0s, S picks A or B", () => {
    expect(quadMux([1, 0, 1, 1], [0, 1, 1, 0], 1, 1)).toMatchObject({ ok: true, y: [0, 0, 0, 0] })
    expect(quadMux([1, 0, 1, 1], [0, 1, 1, 0], 0)).toMatchObject({ ok: true, y: [1, 0, 1, 1] })
    expect(quadMux([1, 0, 1, 1], [0, 1, 1, 0], 1)).toMatchObject({ ok: true, y: [0, 1, 1, 0] })
  })
  it('L18 p35-36 [official]: a demux is a decoder with D on the enable', () => {
    const d = demuxCircuit(['A', 'B'], 'C', ['A', 'B', 'C'])
    const e = decoderCircuit({ k: 2, enable: 'one', outputs: 'high' }, { selects: ['A', 'B'], enable: 'C' }, ['A', 'B', 'C'], { outputs: [3], gate: 'none' })
    expect(d.ok && e.ok && d.circuit.outputs[3].on).toEqual(e.ok ? e.circuit.f.on : null)
  })
})

describe('block netlists (chaining)', () => {
  const run = (blocks: NetBlock[], vars = ABCD) => {
    const r = netlist(blocks, vars)
    if (!r.ok) throw new Error(r.errors[0].message)
    return r.net
  }
  it("AY23/24 S2 Q21e [official key table]: two HAs into a 4-to-2 encoder, P = C + D on the valid rows, invalid rows X", () => {
    const net = run([
      { id: 'HA1', kind: 'ha', a: 'A', b: 'B', out: { C: 'K1', S: 'S1' } },
      { id: 'HA2', kind: 'ha', a: 'C', b: 'D', out: { C: 'K2', S: 'S2' } },
      { id: 'ENC', kind: 'encoder', inputs: ['K1', 'S1', 'K2', 'S2'], out: { Y1: 'P', Y0: 'Q' } },
    ])
    expect(net.signals.P.on).toEqual([1, 2, 3])
    expect(net.signals.P.dc).toEqual([0, 5, 6, 7, 9, 10, 11, 13, 14, 15])
    expect(mismatchRows(net.signals.P, fn('C+D'))).toEqual([])
    expect(net.devices).toEqual({ ha: 2, encoder: 1 })
  })
  it('L17 aha [derived]: a 4-bit adder with B = 0011 turns BCD into Excess-3', () => {
    const net = run([{ id: 'ADD', kind: 'adder', a: ['A', 'B', 'C', 'D'], b: ['0', '0', '1', '1'], out: { S3: 'W', S2: 'X', S1: 'Y', S0: 'Z' } }])
    for (let r = 0; r < 10; r++) {
      const v = ['W', 'X', 'Y', 'Z'].reduce((acc, s) => acc * 2 + (net.signals[s].on.includes(r) ? 1 : 0), 0)
      expect(v).toBe(r + 3)
    }
  })
  it('two chained full adders equal a 2-bit parallel adder (L17 p27)', () => {
    const net = run([
      { id: 'FA0', kind: 'fa', a: 'B', b: 'D', cin: '0', out: { S: 'S0', C: 'C1' } },
      { id: 'FA1', kind: 'fa', a: 'A', b: 'C', cin: 'C1', out: { S: 'S1', C: 'C2' } },
      { id: 'ADD', kind: 'adder', a: ['A', 'B'], b: ['C', 'D'], out: { S1: 'T1', S0: 'T0', Cout: 'T2' } },
    ])
    expect([net.signals.S1.on, net.signals.S0.on, net.signals.C2.on]).toEqual([net.signals.T1.on, net.signals.T0.on, net.signals.T2.on])
  })
  it('T08 Q3 [official examples]: Count-1 of 0111 is 011, Count-0 of 0111 is 001', () => {
    const net = run([
      { id: 'N1', kind: 'count1', inputs: ['A', 'B', 'C', 'D'] },
      { id: 'N0', kind: 'count0', inputs: ['A', 'B', 'C', 'D'] },
    ])
    expect(net.rows[7].ports.N1).toEqual([0, 1, 1])
    expect(net.rows[7].ports.N0).toEqual([0, 0, 1])
  })
  it('a known 0 on an AND gate hides an X from an encoder; complemented pins are flagged', () => {
    const net = run([
      { id: 'ENC', kind: 'encoder', inputs: ['A', 'B'], out: { Y0: 'P' } },
      { id: 'G', kind: 'gate', op: 'AND', inputs: ['P', 'C'], out: { Y: 'F' } },
      { id: 'G2', kind: 'gate', op: 'OR', inputs: ["P'", 'D'], out: { Y: 'H' } },
    ])
    // Row 0: A = B = 0 makes the plain encoder invalid (X); C = 0 there makes F = 0 anyway.
    expect(net.rows[0].ports.G).toEqual([0])
    expect(net.rows[2].ports.G).toEqual(['X'])
    expect(net.implicit).toEqual(["G2.in1 = P'"])
  })
  it('wiring errors name the block and pin, and nothing throws', () => {
    const r = netlist(
      [
        { id: 'G', kind: 'gate', op: 'AND', inputs: ['P', 'A'], out: { Y: 'F' } },
        { id: 'ENC', kind: 'encoder', inputs: ['A', 'B'], out: { Y0: 'P' } },
      ],
      ABCD,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].pin).toBe('G.in1')
    expect(netlist([{ id: 'M', kind: 'mux', selects: ['A'], data: ['B'] }], ABCD).ok).toBe(false)
  })
})

describe('block specs for the workbench editor', () => {
  it('pin counts and pin names follow the engine order (S MSB first, then E; S, then I0..)', () => {
    expect(pinCount({ id: 'D', kind: 'decoder', size: 2, enable: 'zero', pins: [] })).toBe(3)
    expect(blockPins({ id: 'D', kind: 'decoder', size: 2, enable: 'zero', pins: [] })).toMatchObject({ pins: ['S1', 'S0', 'E'], ports: ['Y0', 'Y1', 'Y2', 'Y3'] })
    expect(blockPins({ id: 'M', kind: 'mux', size: 2, pins: [] })).toMatchObject({ pins: ['S1', 'S0', 'I0', 'I1', 'I2', 'I3'], ports: ['Y'] })
    expect(blockPins({ id: 'A', kind: 'adder', size: 2, pins: [] })).toMatchObject({ pins: ['A1', 'A0', 'B1', 'B0', 'Cin'], ports: ['S1', 'S0', 'Cout'] })
    expect(pinCount({ id: 'N', kind: 'gate', op: 'NOT', size: 5, pins: [] })).toBe(1)
  })
  it('a spec builds the same circuit as the hand-written block, and empty pins read as 0', () => {
    const net = netlist([blockFromSpec({ id: 'ADD', kind: 'adder', size: 4, pins: ['A', 'B', 'C', 'D', '', '', '1', '1'], out: { S3: 'W' } })], ABCD)
    expect(net.ok && net.net.signals.W.on.slice(0, 5)).toEqual([5, 6, 7, 8, 9])
  })
  it('bad variable lists are errors, not crashes', () => {
    expect(netlist([], ['A', 'A']).ok).toBe(false)
    expect(netlist([], ['AB']).ok).toBe(false)
    expect(comparatorCircuit({ x: ['A'], y: ['B'] }, ['A', 'B', 'A']).ok).toBe(false)
    expect(comparatorCircuit({ x: ['A'], y: ['B'] }, 'ABCDEFGHI'.split('')).ok).toBe(false)
  })
})

describe('encoder output names follow the course (L18 p30-32)', () => {
  it('f, g for 4-to-2; x, y, z for 8-to-3 with z = D1+D3+D5+D7', () => {
    expect(encoderEquations(8).map((e) => `${e.output} = ${e.text}`)).toEqual(['x = D4+D5+D6+D7', 'y = D2+D3+D6+D7', 'z = D1+D3+D5+D7'])
    expect(priorityEquations(4, { valid: false }).map((e) => e.output)).toEqual(['f', 'g'])
    const r = encoderCircuit(['A', 'B', 'C', 'D'], ABCD)
    expect(r.ok && r.circuit.outputs.map((f) => f.name)).toEqual(['f', 'g'])
  })
})

describe('every function one decoder output can give (AY23/24 S1 Q9)', () => {
  it("[official answer A] 1-enable 2x4 over A, B, C reaches A∙B∙C and A'∙B∙C' but not A'∙B'∙C'", () => {
    const r = reachableFunctions(['A', 'B', 'C'], { k: 2, enable: 'one', outputs: 'high' })
    const ons = r.items.map((it) => it.fn.on.join())
    expect(ons).toContain('7')
    expect(ons).toContain('2')
    expect(ons).not.toContain('0')
    // Every reachable active-high output is a product: at most one row block, never two disjoint minterms like m0 + m7.
    expect(ons).not.toContain('0,7')
  })
  it('agrees with the single-target finder on every 3-variable product', () => {
    const spec = { k: 2, enable: 'zero', outputs: 'low' } as const
    const r = reachableFunctions(['A', 'B', 'C'], spec)
    for (const it of r.items) expect(findDecoderWirings(it.fn, spec).possible).toBe(true)
  })
})
