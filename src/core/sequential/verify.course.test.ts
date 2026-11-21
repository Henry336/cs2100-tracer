/**
 * Course-fidelity checks for the sequential engine, re-derived from the slides and answer keys.
 * Each test names the page it comes from. Tests that fail mark engine behaviour that disagrees with CS2100.
 */
import { describe, expect, it } from 'vitest'
import { checkEquivalence, parseExpr, type Expr } from '../boolean'
import {
  analyse,
  buildGraph,
  design,
  gateCount,
  machineFromTable,
  parseCircuit,
  parseStateTable,
  settleLatch,
  simulateTiming,
  sinksOf,
  type Analysis,
  type Design,
  type DesignSpec,
} from '.'

const expr = (t: string): Expr => {
  const p = parseExpr(t)
  if (!p.ok) throw new Error(`bad ${t}`)
  return p.expr
}
const analysed = (text: string, used?: number[]): Analysis => {
  const p = parseCircuit(text)
  if (!p.ok) throw new Error(p.errors.map((e) => e.message).join('; '))
  const r = analyse(used ? { ...p.circuit, used } : p.circuit)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r.analysis
}
const designed = (spec: DesignSpec): Design => {
  const r = design(spec)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r.design
}
/** The key is one of the engine's minimal SOPs (don't-care choices included). */
const keyIsMinimal = (d: Design, label: string, key: string) =>
  d.functions.find((f) => f.label === label)!.sop.some((s) => checkEquivalence(expr(s), expr(key), d.vars).equivalent)

describe('latches (L19 p12-13, R10 p7-9)', () => {
  it('L19 p13 / R10 p9: the gated S-R latch is NAND-built, so EN = 1, S = R = 1 gives Q = Q\' = 1', () => {
    // p13 figure: S and R each go through a NAND with EN into a NAND latch (drawn as bubbled ORs, see p12).
    // With EN = S = R = 1 both front NANDs output 0, so both latch gates output 1.
    const s = settleLatch('gated-sr', { EN: 1, S: 1, R: 1 }, 0)
    expect(s.invalid).toBe(true)
    expect([s.q, s.qBar]).toEqual([1, 1])
  })
})

describe('sinks and reachability (T09 Q1, T09 Q4, AY20/21 S2 Q12)', () => {
  it('T09 Q4 / T09 Ans p5: state 3 never moves out (xy = 11 cannot happen), so it is a sink', () => {
    const t = parseStateTable('0: 0 2 1 X\n1: 1 3 2 X\n2: 2 3 3 X\n3: 3 3 3 X', { inputs: 2 })
    if (!t.ok) throw new Error('parse')
    const m = machineFromTable(t.table, { inputs: ['x', 'y'], bits: ['A', 'B'] })
    // T09 Q1 p2: "A state is called a sink if once the circuit enters this state, it never moves out of that state."
    expect(sinksOf(m)).toEqual([3])
    const g = buildGraph(m)
    expect(g.nodes[3].sink).toBe(true)
    // T09 Ans p5: the self-loop on 3 is labelled 00,01,10 and never includes 11.
    expect(g.edges.find((e) => e.from === 3 && e.to === 3)?.label).toBe('00,01,10')
  })

  it('T09 Q1(d) / comb-seq feature [1]: states no other state leads to are flagged unreachable (2 and 3)', () => {
    const a = analysed("p = A∙B + A'∙B'; TA = A∙B'; DB = A' + B")
    // Transitions 0→1, 1→1, 2→0, 3→3: nothing enters 2 or 3 from another state.
    const nodes = a.graph.nodes as unknown as { unreachable?: boolean }[]
    expect(nodes.map((n) => n.unreachable)).toEqual([false, false, true, true])
  })

  it('AY20/21 S2 Q12(b) (R10 p66): state 4 is unreachable from the other used states 0-3', () => {
    const a = analysed("JA = A∙x; KA = B; JB = x'; KB = C'; JC = x'; KC = 1", [0, 1, 2, 3, 4])
    const nodes = a.graph.nodes as unknown as { unreachable?: boolean }[]
    expect(nodes.slice(0, 5).map((n) => n.unreachable)).toEqual([false, false, false, false, true])
  })
})

describe('extra course fixtures not covered by the builder (R10 p52-66)', () => {
  it('AY20/21 S2 Q12(a) (R10 p64-65): JK analysis, next states for ABC x [official]', () => {
    const a = analysed("JA = A∙x; KA = B; JB = x'; KB = C'; JC = x'; KC = 1")
    expect(a.machine.next).toEqual([[3, 0], [2, 0], [1, 0], [2, 2], [7, 4], [6, 4], [1, 0], [2, 2]])
  })

  it('AY20/21 S2 Q12(b) (R10 p66): D redesign without state 4, DF = F\'∙x\' + F∙G, DG = G\'∙x\' [official]', () => {
    const d = designed({ bits: ['F', 'G'], inputs: ['x'], types: ['D', 'D'], rows: [{ state: 0, next: [3, 0] }, { state: 1, next: [2, 0] }, { state: 2, next: [1, 0] }, { state: 3, next: [2, 2] }] })
    expect(keyIsMinimal(d, 'DF', "F'∙x' + F∙G")).toBe(true)
    expect(keyIsMinimal(d, 'DG', "G'∙x'")).toBe(true)
    expect(d.verified).toBe(true)
  })

  it('R10 p52-53 Quiz 1: T design TA = x\', TB = A\'∙x\' + A∙x, y = B\'∙x\' + A∙B∙x; JK JA = KA = x\', JB = KB = A xnor x [official]', () => {
    const rows: DesignSpec['rows'] = [
      { state: 0, next: [3, 0], out: [[1], [0]] },
      { state: 1, next: [2, 1], out: [[0], [0]] },
      { state: 2, next: [0, 3], out: [[1], [0]] },
      { state: 3, next: [1, 2], out: [[0], [1]] },
    ]
    const t = designed({ bits: ['A', 'B'], inputs: ['x'], outputs: ['y'], types: ['T', 'T'], rows })
    expect(keyIsMinimal(t, 'TA', "x'")).toBe(true)
    expect(keyIsMinimal(t, 'TB', "A'∙x' + A∙x")).toBe(true)
    expect(keyIsMinimal(t, 'y', "B'∙x' + A∙B∙x")).toBe(true)
    const jk = designed({ bits: ['A', 'B'], inputs: ['x'], outputs: ['y'], types: ['JK', 'JK'], rows, prefer: 'fewest-gates' })
    for (const [label, key] of [['JA', "x'"], ['KA', "x'"], ['JB', "(A⊕x)'"], ['KB', "(A⊕x)'"]])
      expect(keyIsMinimal(jk, label, key) || checkEquivalence(expr(jk.functions.find((f) => f.label === label)!.chosen.text), expr(key), jk.vars, (r) => !jk.functions.find((f) => f.label === label)!.fn.dc.includes(r)).equivalent, label).toBe(true)
  })

  it('R10 p55-57 Quiz 2: S-R analysis gives 00→01/00, 01→10/00, 10→11/01, 11→11/10 [official]', () => {
    const a = analysed("SA = B∙x'; RA = B'∙x; SB = B'∙x' + A∙B'; RB = A'∙B + B∙x")
    expect(a.machine.next).toEqual([[1, 0], [2, 0], [3, 1], [3, 2]])
    expect(a.warnings).toEqual([])
  })
})

describe('gate counts (L19 p51, T09 Ans p3)', () => {
  it('L19 p50-51: KB = (A⊕x)\' is one XNOR gate, not XOR plus an inverter', () => {
    expect(gateCount(expr("(A⊕x)'"), ['A', 'B']).gates).toBe(1)
  })
})

describe('design defaults that must match the slides', () => {
  it('L19 p55-58 / R10 p42-43: the default S-R design of Design Example 3 keeps S∙R = 0, so unused 0 -> 1/2, 6 -> 7/4, 7 -> 1/4', () => {
    // RB has three minimal SOPs: B∙C + C'∙x, B∙x + C∙x', B∙C + B∙x (the slide's). The first one gives
    // SB = RB = 1 in unused state 0 on x = 1, which L19 p11 forbids (S∙R = 0). The default must not pick it.
    const d = designed({
      bits: ['A', 'B', 'C'],
      inputs: ['x'],
      outputs: ['y'],
      types: ['SR', 'SR', 'SR'],
      rows: [
        { state: 1, next: [1, 2], out: [[0], [0]] },
        { state: 2, next: [3, 4], out: [[0], [0]] },
        { state: 3, next: [1, 4], out: [[0], [0]] },
        { state: 4, next: [5, 4], out: [[0], [1]] },
        { state: 5, next: [1, 4], out: [[0], [1]] },
      ],
    })
    expect(d.warnings.filter((w) => w.code === 'sr-invalid')).toEqual([])
    expect(d.unusedTransitions.map((u) => `${u.state}:${u.combo}>${u.next}`).join(' ')).toBe('0:0>1 0:1>2 6:0>7 6:1>4 7:0>1 7:1>4')
  })
})

describe('timing (L19 p25 figure)', () => {
  it('L19 p25: positive-edge J-K with J = K = 1 and active-low PRE, CLR: preset, toggle on rising edges, clear', () => {
    // One tick per half clock period, read off the figure: PRE low before the first rising edge until the
    // fourth low phase; CLR low from the eighth low phase. Clock edges while PRE or CLR is active are ignored.
    const CLK = [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] as (0 | 1)[]
    const ones = CLK.map(() => 1) as (0 | 1)[]
    const PRE = CLK.map((_, t) => (t >= 1 && t <= 6 ? 0 : 1)) as (0 | 1)[]
    const CLR = CLK.map((_, t) => (t >= 15 ? 0 : 1)) as (0 | 1)[]
    const r = simulateTiming({ element: 'JK', asyncLevel: 'low', waves: { CLK, J: ones, K: ones, PRE, CLR } })
    if (!r.ok) throw new Error('timing')
    expect(r.trace.q).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0])
    expect(r.trace.edges).toEqual([8, 10, 12, 14])
  })
})
