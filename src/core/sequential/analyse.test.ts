import { describe, expect, it } from 'vitest'
import { analyse, machineFromTable, parseCircuit, parseSequence, parseStateTable, selfCorrection, sequenceFrom, shiftCounter, simulate, type Analysis, type CircuitSpec } from '.'

const circuit = (text: string, opts: { inputs?: string[]; bits?: string[] } = {}): CircuitSpec => {
  const p = parseCircuit(text, opts)
  if (!p.ok) throw new Error(p.errors.map((e) => e.message).join('; '))
  return p.circuit
}
const run = (c: CircuitSpec): Analysis => {
  const r = analyse(c)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r.analysis
}
const nextBits = (a: Analysis) => a.rows.map((r) => r.next.join(''))
const nextStates = (a: Analysis) => a.machine.next.map((row) => row[0])

describe('analysis fixtures (logic.md section 6)', () => {
  it('L19 Analysis Example 1, D flip-flops (L19 p31-34) [official]', () => {
    const a = run(circuit("A+ = A∙x + B∙x\nB+ = A'∙x\ny = (A+B)∙x'"))
    expect(a.rows).toHaveLength(8)
    expect(a.compact.map((r) => r.cells.map((c) => c.text))).toEqual([
      ['00 / 0', '01 / 0'],
      ['00 / 1', '11 / 0'],
      ['00 / 1', '10 / 0'],
      ['00 / 1', '10 / 0'],
    ])
    expect(a.columns).toEqual(['x=0', 'x=1'])
    expect(a.graph.stateOutputs).toBe(false)
    expect(a.graph.edges.find((e) => e.from === 1 && e.to === 3)?.label).toBe('1/0')
  })

  it('L19 Example 2, JK (L19 p38-40) [official]', () => {
    const a = run(circuit("JA = B; KA = B∙x'; JB = x'; KB = A⊕x"))
    expect(nextBits(a)).toEqual(['01', '00', '11', '10', '11', '10', '00', '11'])
    expect(a.rows[2].ffInputs.map((f) => `${f.label}=${f.value}`)).toEqual(['JA=1', 'KA=1', 'JB=1', 'KB=0'])
    expect(a.rows[2].nextWhy[0].working).toContain('toggle')
  })

  it('L19 Example 3, JK (L19 p41-43); y read from the table [official next / derived y]', () => {
    const a = run(circuit("JA = B; KA = B'; JB = KB = (A⊕x)'; y = A⊕B⊕x"))
    expect(nextBits(a)).toEqual(['01', '00', '10', '11', '00', '01', '11', '10'])
    expect(a.rows.filter((r) => r.outputs[0].value === 1).map((r) => r.index)).toEqual([1, 2, 4, 7])
  })

  it('T09 Q1: T and D flip-flops, output inside the state [official]', () => {
    const a = run(circuit("p = A∙B + A'∙B'; TA = A∙B'; DB = A' + B"))
    expect(nextStates(a)).toEqual([1, 1, 0, 3])
    expect(a.graph.stateOutputs).toBe(true)
    expect(a.graph.nodes.map((n) => n.output)).toEqual(['1', '0', '0', '1'])
    const sim = simulate(a.machine, 0, { clocks: 3 })
    expect(sim.states[sim.states.length - 1]).toBe(1)
    expect(sim.outputs.join('')).toBe('100')
    expect(a.sinks).toEqual([1, 3])
  })

  it('AY23/24 S1 Q18a: next states of 0..3 [official]', () => {
    expect(nextStates(run(circuit("DA = A + B'; TB = A∙B'")))).toEqual([2, 1, 3, 3])
  })

  it('AY24/25 Q16: transitions and not self-correcting [official]', () => {
    const c = circuit('JA = B; KA = 1; JB = A∙C; KB = 0; DC = A + B')
    const a = run({ ...c, used: [2, 3, 5, 6, 7] })
    expect(nextStates(a)).toEqual([0, 0, 7, 7, 1, 3, 3, 3])
    const sc = a.selfCorrection
    expect(sc.course).toBe(false)
    expect(sc.lockout).toEqual([0, 1, 4])
    expect(sc.paths.find((p) => p.state === 4)?.text).toBe('4 → 1 → 0 → 0')
    expect(sc.sentence.startsWith('No:')).toBe(true)
  })

  it('AY15/16 S1 Q7 (R10 p61-63): sequence and not self-correcting [official]', () => {
    const a = run({ ...circuit("JA = B∙C; KA = 0; TB = A'∙C; DC = A + C'"), used: [0, 1, 2, 3, 4, 5] })
    expect(sequenceFrom(a.machine, 0).text).toBe('0 → 1 → 2 → 3 → 4 → 5 → 5')
    expect(sequenceFrom(a.machine, 6).text).toBe('6 → 7 → 7')
    expect(a.selfCorrection.course).toBe(false)
  })

  it('L19 Design Example 3 equations: unused states (R10 p42-43) [derived]', () => {
    const c = circuit("SA = B∙x; RA = C∙x'; SB = A'∙B'∙x; RB = B∙C + B∙x; SC = x'; RC = x; y = A∙x")
    const a = run({ ...c, used: [1, 2, 3, 4, 5] })
    expect([0, 6, 7].map((s) => a.machine.next[s])).toEqual([[1, 2], [7, 4], [1, 4]])
    expect(a.selfCorrection.course).toBe(true)
    expect(a.selfCorrection.strict).toBe(true)
  })

  it('AY23/24 S2 Q14: Johnson counter; ring counter for contrast [official / derived]', () => {
    const j = run(shiftCounter('johnson').circuit)
    expect(sequenceFrom(j.machine, 1).text).toBe('1 → 0 → 8 → 12 → 14 → 15 → 7 → 3 → 1')
    const r = run(shiftCounter('ring').circuit)
    expect(sequenceFrom(r.machine, 1).text).toBe('1 → 8 → 4 → 2 → 1')
  })

  it('AY19/20 Q4b: Johnson counter from 0000 has 8 states [official]', () => {
    const j = run(shiftCounter('johnson', ['A', 'B', 'C', 'D']).circuit)
    expect(sequenceFrom(j.machine, 0).states).toEqual([0, 8, 12, 14, 15, 7, 3, 1, 0])
  })

  it('T09 SE1: named states, start A, x = 100010 [derived]', () => {
    const t = parseStateTable('A: C/0 A/1\nB: D/1 B/0\nC: B/1 D/0\nD: C/0 D/0', { inputs: 1, outputs: 1 })
    if (!t.ok) throw new Error('parse')
    const m = machineFromTable(t.table, { inputs: ['x'], outputs: ['z'] })
    const sim = simulate(m, 0, [1, 0, 0, 0, 1, 0])
    expect(sim.outputs.join('')).toBe('101100')
    expect(sim.states.slice(1).map((s) => m.labels[s])).toEqual(['A', 'C', 'B', 'D', 'D', 'C'])
  })
})

describe('parsers', () => {
  it('reports line numbers and plain messages', () => {
    const bad = parseCircuit("JA = B\nKA = B∙q'\nJB = x'", { inputs: ['x'] })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.map((e) => e.message).join(' ')).toMatch(/unknown variable q|flip-flop B has J/)
    const half = parseCircuit('JA = B')
    expect(!half.ok && half.errors[0].message).toContain('needs both JA and KA')
    const syntax = parseCircuit('DA = A +')
    expect(!syntax.ok && syntax.errors[0].message.startsWith('line 1:')).toBe(true)
  })

  it('parses sequences and rejects two successors', () => {
    const s = parseSequence('1→3→5→1')
    expect(s.ok && s.rows.map((r) => `${r.state}:${r.next[0]}`)).toEqual(['1:3', '3:5', '5:1'])
    expect(parseSequence('0→1\n0→2').ok).toBe(false)
  })

  it('AY25/26 Q16 clarification: X0 is the MSB input', () => {
    const c = circuit("A+ = B∙X0'∙X1; B+ = A'∙B'∙X0∙X1; G = A")
    expect(c.inputs).toEqual(['X0', 'X1'])
    const a = run(c)
    expect(a.machine.next[1][1]).toBe(2)
    expect(a.machine.next[0][3]).toBe(1)
  })
})

describe('self-correction needs known transitions (T09 Ans p3)', () => {
  it('a table with no rows for its unused states is not determined yet, not a lockout [derived]', () => {
    const t = parseStateTable('0: 1 2\n1: 2 0\n2: 0 1', { inputs: 1 })
    if (!t.ok) throw new Error('parse')
    const sc = selfCorrection(machineFromTable(t.table, { inputs: ['x'], bits: ['A', 'B'] }))
    expect(sc.determined).toBe(false)
    expect(sc.sentence.startsWith('Not determined yet')).toBe(true)
  })

  it('an unpredictable transition out of an unused state is named in the answer [derived]', () => {
    // State 3 (A = B = 1): SA = RA = 1 on x = 1, so that transition is unpredictable (L19 p18).
    const a = run(circuit("SA = A∙B∙x; RA = A∙B; SB = 0; RB = 1", {}))
    const sc = selfCorrection({ ...a.machine, used: [0, 1, 2] })
    expect(sc.open).toEqual([{ state: 3, combo: 1 }])
    expect(sc.sentence).toContain('3 on x = 1')
  })

  it('mixed numbered and lettered states and bad state names are errors [derived]', () => {
    expect(parseStateTable('A: 1\n1: A', { inputs: 0 }).ok).toBe(false)
    expect(parseStateTable('0x1: 0', { inputs: 0 }).ok).toBe(false)
  })
})
