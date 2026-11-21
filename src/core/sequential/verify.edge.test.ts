/** Adversarial edge-case checks for the sequential engine. Each test names the course page it relies on. */
import { describe, expect, it } from 'vitest'
import { analyse, ffNext, machineFromTable, parseCircuit, parseStateTable, selfCorrection, sequenceFrom, simulateTiming, buildGraph } from '.'

describe('unknown present state (Q = X)', () => {
  it('L19 p22, p27: J-K set (J=1, K=0) gives Q+ = 1 and reset (J=0, K=1) gives Q+ = 0 whatever Q was', () => {
    expect(ffNext('JK', [1, 0], 'X').next).toBe(1)
    expect(ffNext('JK', [0, 1], 'X').next).toBe(0)
  })

  it('L19 p18, p27: S-R set (1,0) gives 1 and reset (0,1) gives 0 even from an unknown Q', () => {
    expect(ffNext('SR', [1, 0], 'X').next).toBe(1)
    expect(ffNext('SR', [0, 1], 'X').next).toBe(0)
  })

  it('L19 p22, p25: a J-K timing diagram that starts unknown becomes 1 on the first edge with J=1, K=0', () => {
    const r = simulateTiming({ element: 'JK', q0: 'X', waves: { CLK: [0, 1, 0, 1], J: [1, 1, 0, 0], K: [0, 0, 1, 1] } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.trace.q).toEqual(['X', 1, 1, 0])
  })

  it('L19 p13: a gated S-R latch that starts unknown is set by EN=1, S=1, R=0', () => {
    const r = simulateTiming({ element: 'gated-sr', q0: 'X', waves: { EN: [1, 1], S: [1, 0], R: [0, 1] } })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.trace.q).toEqual([1, 0])
  })
})

describe('parsers and checks never throw on user input (architecture: parsers never throw)', () => {
  it('L19 p32: a next state outside the table (typo 9 in a 2-bit table) is reported or handled, not a crash', () => {
    expect(() => {
      const p = parseStateTable('0: 9\n1: 0', { inputs: 0 })
      if (!p.ok) return
      const m = machineFromTable(p.table, { inputs: [], bits: ['A', 'B'] })
      buildGraph(m)
      selfCorrection(m)
      sequenceFrom(m, 0)
    }).not.toThrow()
  })

  it('L19 p30: sequenceFrom a start state the circuit does not have (7 for 2 flip-flops) does not throw', () => {
    const p = parseCircuit("DA = B\nDB = A'")
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const a = analyse(p.circuit)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    expect(() => sequenceFrom(a.analysis.machine, 7)).not.toThrow()
  })

  it('L19 p36: an expression error on line 2 is located inside line 2 of the source', () => {
    const src = 'DA = B\nDB = A + + x'
    const p = parseCircuit(src)
    expect(p.ok).toBe(false)
    if (p.ok) return
    const e = p.errors[0]
    expect(e.line).toBe(2)
    // at must be offsets into the whole source, so the editor can underline the bad '+' on line 2
    expect(e.at[0]).toBeGreaterThanOrEqual(src.indexOf('\n') + 1)
    expect(src.slice(e.at[0], e.at[1]).trim()).toBe('+')
  })

  it('L19 p32: a bad state number (-1) is named in the error, not reported as an unknown next state', () => {
    const p = parseStateTable('-1: 2\n2: 2', { inputs: 0 })
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.errors.some((e) => e.message.includes('-1'))).toBe(true)
  })
})
