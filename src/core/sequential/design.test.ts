import { describe, expect, it } from 'vitest'
import { checkEquivalence, parseExpr, type Expr } from '../boolean'
import { design, parseSequence, type Design, type DesignFunction, type DesignSpec, type TableRow } from '.'

const run = (spec: DesignSpec): Design => {
  const r = design(spec)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r.design
}
const expr = (t: string): Expr => {
  const p = parseExpr(t)
  if (!p.ok) throw new Error(`bad ${t}`)
  return p.expr
}
const fn = (d: Design, label: string): DesignFunction => d.functions.find((f) => f.label === label)!
/** The chosen equation equals the key on every row the table specifies. */
const matchesKey = (d: Design, label: string, key: string) => {
  const f = fn(d, label)
  const care = new Set(f.fn.dc)
  return checkEquivalence(expr(f.chosen.text), expr(key), d.vars, (r) => !care.has(r)).equivalent
}
/** One of the minimal SOPs is exactly the key, don't-care choices included. */
const keyIsMinimal = (d: Design, label: string, key: string) => fn(d, label).sop.some((s) => checkEquivalence(expr(s), expr(key), d.vars).equivalent)
const seq = (text: string): TableRow[] => {
  const p = parseSequence(text)
  if (!p.ok) throw new Error('bad sequence')
  return p.rows
}
const unusedText = (d: Design) => d.unusedTransitions.map((u) => `${u.state}:${u.combo}>${u.next}`).join(' ')

describe('design fixtures (logic.md section 6)', () => {
  it('L19 Design Example 1, JK (L19 p47-51) [official]', () => {
    const d = run({ bits: ['A', 'B'], inputs: ['x'], types: ['JK', 'JK'], rows: [{ state: 0, next: [0, 1] }, { state: 1, next: [2, 1] }, { state: 2, next: [2, 3] }, { state: 3, next: [3, 0] }] })
    expect(d.rows.map((r) => r.ffInputs.map((c) => c.value).join('')).join(' ')).toBe('0X0X 0X1X 1XX1 0XX0 X00X X01X X0X0 X1X1')
    expect(fn(d, 'JA').chosen.text).toBe("B∙x'")
    expect(fn(d, 'KA').chosen.text).toBe('B∙x')
    expect(fn(d, 'JB').chosen.text).toBe('x')
    expect(matchesKey(d, 'KB', "(A⊕x)'")).toBe(true)
    expect(fn(d, 'JA').kmap?.layout.rowVars).toEqual(['A'])
    expect(d.verified).toBe(true)
    const fewest = run({ ...d.spec, prefer: 'fewest-gates' })
    expect(fn(fewest, 'KB').chosen.source).toBe('single-gate')
    expect(fn(fewest, 'KB').chosen.text).toBe('A ⊙ x')
  })

  it('L19 Design Example 2, D (L19 p52-54) [official]', () => {
    const d = run({
      bits: ['A', 'B'],
      inputs: ['x'],
      outputs: ['y'],
      types: ['D', 'D'],
      rows: [
        { state: 0, next: [0, 1], out: [[0], [1]] },
        { state: 1, next: [2, 1], out: [[0], [0]] },
        { state: 2, next: [2, 3], out: [[0], [1]] },
        { state: 3, next: [3, 0], out: [[0], [0]] },
      ],
    })
    expect(fn(d, 'DA').fn.on).toEqual([2, 4, 5, 6])
    expect(fn(d, 'DB').fn.on).toEqual([1, 3, 5, 6])
    expect(fn(d, 'y').fn.on).toEqual([1, 5])
    expect(matchesKey(d, 'DA', "A∙B' + B∙x'")).toBe(true)
    expect(matchesKey(d, 'DB', "A'∙x + B'∙x + A∙B∙x'")).toBe(true)
    expect(fn(d, 'y').chosen.text).toBe("B'∙x")
  })

  const ex3: DesignSpec = {
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
  }
  const ex3Key: Record<string, string> = { SA: 'B∙x', RA: "C∙x'", SB: "A'∙B'∙x", RB: 'B∙C + B∙x', SC: "x'", RC: 'x', y: 'A∙x' }

  it('L19 Design Example 3, S-R with unused states 0, 6, 7 (L19 p55-58) [official]', () => {
    const d = run(ex3)
    expect(d.unused).toEqual([0, 6, 7])
    for (const [label, key] of Object.entries(ex3Key)) {
      expect(keyIsMinimal(d, label, key), label).toBe(true)
      expect(matchesKey(d, label, key), label).toBe(true)
    }
    expect(d.verified).toBe(true)
  })

  it('L19 Design Example 3 with the key equations: unused 0 -> 1/2, 6 -> 7/4, 7 -> 1/4, self-correcting (R10 p42-43) [derived]', () => {
    const d = run({ ...ex3, overrides: ex3Key })
    expect(d.functions.every((f) => f.check?.ok)).toBe(true)
    expect(unusedText(d)).toBe('0:0>1 0:1>2 6:0>7 6:1>4 7:0>1 7:1>4')
    expect(d.analysis.selfCorrection.course).toBe(true)
  })

  it('T09 Q2: JK with fewest gates; unused 3 -> 0; self-correcting [official]', () => {
    const spec: DesignSpec = { bits: ['A', 'B'], inputs: ['x'], types: ['JK', 'JK'], rows: [{ state: 0, next: [1, 2] }, { state: 1, next: [2, 0] }, { state: 2, next: [0, 1] }] }
    const sop = run(spec)
    expect(keyIsMinimal(sop, 'JA', 'B⊕x')).toBe(true)
    expect(fn(sop, 'KA').chosen.text).toBe('1')
    expect(keyIsMinimal(sop, 'JB', 'A⊙x')).toBe(true)
    expect(fn(sop, 'KB').chosen.text).toBe('1')
    const d = run({ ...spec, prefer: 'fewest-gates' })
    expect(fn(d, 'JA').chosen.text).toBe('B ⊕ x')
    expect(fn(d, 'JB').chosen.text).toBe('A ⊙ x')
    expect(d.total.gates).toBe(2)
    expect(sop.total.gates).toBeGreaterThan(2)
    expect(unusedText(d)).toBe('3:0>0 3:1>0')
    expect(d.analysis.selfCorrection.course).toBe(true)
    expect(d.analysis.selfCorrection.strict).toBe(true)
    // T09 Ans p3: JA's don't-cares in rows 100, 101, 110, 111 become d(0), d(1), d(1), d(0).
    expect(fn(d, 'JA').committed.filter((c) => c.cell >= 4).map((c) => c.value)).toEqual([0, 1, 1, 0])
  })

  it('T09 Q3 (AY18/19): D, T, T, JK on 1→3→5→7→9→11→13→15→2→4→6→1 [official equations / derived transitions]', () => {
    const spec: DesignSpec = { bits: ['A', 'B', 'C', 'D'], inputs: [], types: ['D', 'T', 'T', 'JK'], rows: seq('1→3→5→7→9→11→13→15→2→4→6→1') }
    const d = run(spec)
    const key: Record<string, string> = { DA: "A∙B' + A∙C' + A'∙B∙C∙D", TB: 'C', TC: "A' + B' + C'", JD: 'B∙C', KD: 'A∙B∙C' }
    for (const [label, k] of Object.entries(key)) expect(keyIsMinimal(d, label, k), label).toBe(true)
    const k = run({ ...spec, overrides: key })
    expect(k.verified).toBe(true)
    expect(unusedText(k)).toBe('0:0>2 8:0>10 10:0>12 12:0>14 14:0>3')
    expect(k.analysis.selfCorrection.course).toBe(true)
  })

  it('T09 Q4: locker with D flip-flops, xy = 11 never happens [official]', () => {
    const d = run({
      bits: ['A', 'B'],
      inputs: ['x', 'y'],
      types: ['D', 'D'],
      rows: [
        { state: 0, next: [0, 2, 1, null] },
        { state: 1, next: [1, 3, 2, null] },
        { state: 2, next: [2, 3, 3, null] },
        { state: 3, next: [3, 3, 3, null] },
      ],
    })
    expect(keyIsMinimal(d, 'DA', 'A + y + B∙x')).toBe(true)
    expect(fn(d, 'DA').sop).toHaveLength(1)
    expect(keyIsMinimal(d, 'DB', "B∙x' + B'∙x + A∙y + A∙x")).toBe(true)
    expect(keyIsMinimal(d, 'DB', "B∙x' + B'∙x + A∙y + A∙B")).toBe(true)
  })

  it('AY23/24 S2 Q20: JK, states 1-3, input C; 1 gate; state 0 -> 2 or 3 [official]', () => {
    const spec: DesignSpec = { bits: ['A', 'B'], inputs: ['C'], types: ['JK', 'JK'], rows: [{ state: 1, next: [2, 2] }, { state: 2, next: [2, 3] }, { state: 3, next: [2, 3] }] }
    const d = run(spec)
    expect(fn(d, 'JA').chosen.text).toBe('1')
    expect(fn(d, 'KA').chosen.text).toBe('0')
    expect(fn(d, 'JB').chosen.text).toBe('C')
    expect(fn(d, 'KB').chosen.text).toBe("A' + C'")
    expect(fn(d, 'KB').gates.gates).toBe(2)
    const f = run({ ...spec, prefer: 'fewest-gates' })
    expect(f.total.gates).toBe(1)
    expect(fn(f, 'KB').chosen.text).toBe("(A∙C)'")
    expect(unusedText(d)).toBe('0:0>2 0:1>3')
  })

  it('AY23/24 S1 Q18b: JK design, 1 gate, state 3 loops on x = 0 but is self-correcting by the key [official]', () => {
    const d = run({ bits: ['A', 'B'], inputs: ['x'], types: ['JK', 'JK'], rows: [{ state: 0, next: [0, 2] }, { state: 1, next: [1, 0] }, { state: 2, next: [2, 2] }] })
    expect(fn(d, 'JA').chosen.fitb).toBe("B'.x")
    expect(fn(d, 'KA').chosen.text).toBe('0')
    expect(fn(d, 'JB').chosen.text).toBe('0')
    expect(fn(d, 'KB').chosen.text).toBe('x')
    expect(d.total.gates).toBe(1)
    expect(unusedText(d)).toBe('3:0>3 3:1>2')
    expect(d.analysis.selfCorrection.course).toBe(true)
    expect(d.analysis.selfCorrection.strict).toBe(false)
  })

  it('AY24/25 Q16c: T redesign, 0 gates [official]', () => {
    const d = run({ bits: ['A', 'B', 'C'], inputs: [], types: ['T', 'T', 'T'], rows: [2, 3, 5, 6, 7].map((s) => ({ state: s, next: [s === 2 || s === 3 ? 7 : 3] })) })
    expect(fn(d, 'TA').chosen.text).toBe('1')
    expect(fn(d, 'TB').chosen.text).toBe("B'")
    expect(fn(d, 'TC').chosen.text).toBe("C'")
    expect(d.total.gates).toBe(0)
  })

  it('AY15/16 S1 Q7 (R10 p61-63): JK, T, D on 0→1→2→3→4→5→5; unused 6 -> 7 -> 7 [official]', () => {
    const d = run({ bits: ['A', 'B', 'C'], inputs: [], types: ['JK', 'T', 'D'], rows: seq('0→1→2→3→4→5→5') })
    expect(fn(d, 'JA').chosen.text).toBe('B∙C')
    expect(fn(d, 'KA').chosen.text).toBe('0')
    expect(fn(d, 'TB').chosen.text).toBe("A'∙C")
    expect(fn(d, 'DC').chosen.text).toBe("A + C'")
    expect(unusedText(d)).toBe('6:0>7 7:0>7')
    expect(d.analysis.selfCorrection.course).toBe(false)
    expect(d.analysis.selfCorrection.sentence).toContain('6 → 7 → 7')
  })

  it('AY25/26 Q16: state table to SOP with D flip-flops, X0 the MSB [official]', () => {
    const rows: TableRow[] = [0, 1, 2, 3].map((s) => ({ state: s, next: [0, s === 1 || s === 3 ? 2 : 0, 0, s === 0 ? 1 : 0], out: [0, 1, 2, 3].map(() => [s >> 1 ? 1 : 0] as (0 | 1)[]) }))
    const d = run({ bits: ['A', 'B'], inputs: ['X0', 'X1'], outputs: ['G'], types: ['D', 'D'], rows })
    expect(fn(d, 'DA').chosen.text).toBe("B∙X0'∙X1")
    expect(fn(d, 'DB').chosen.text).toBe("A'∙B'∙X0∙X1")
    expect(fn(d, 'G').chosen.text).toBe('A')
  })
})

describe('design checks', () => {
  it('rejects bad tables with plain messages', () => {
    const r = design({ bits: ['A'], inputs: ['x'], types: ['D'], rows: [{ state: 2, next: [0, 1] }] })
    expect(!r.ok && r.errors[0].message).toContain('does not fit')
  })

  it('flags your equation when it breaks a specified row', () => {
    const d = run({ bits: ['A', 'B'], inputs: ['x'], types: ['JK', 'JK'], rows: [{ state: 0, next: [1, 2] }, { state: 1, next: [2, 0] }, { state: 2, next: [0, 1] }], overrides: { JA: 'B' } })
    expect(fn(d, 'JA').check?.ok).toBe(false)
    expect(d.verified).toBe(false)
    expect(d.mismatches.length).toBeGreaterThan(0)
  })
})
