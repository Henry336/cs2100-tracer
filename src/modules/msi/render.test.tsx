import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseFunction } from '../../core/boolean'
import { blockFromSpec, comparatorCircuit, decoderCircuit, decoderTree, encoderCircuit, findComparatorWirings, findDecoderWirings, mismatchRows, muxImplement, muxTree, netlist, rippleAdd } from '../../core/msi'
import AdderTab from './AdderTab'
import ComparatorTab from './ComparatorTab'
import DecoderTab from './DecoderTab'
import EncoderTab from './EncoderTab'
import MsiPage from './MsiPage'
import MuxTab from './MuxTab'
import WorkbenchTab from './WorkbenchTab'
import { ADDER_PRESETS, CMP_PRESETS, DEC_PRESETS, ENC_PRESETS, MUX_PRESETS, TREE_PRESETS, WB_PRESETS } from './presets'

const fn = (text: string, vars?: string[]) => {
  const r = parseFunction(text, vars ? { vars } : {})
  if (!r.ok) throw new Error(`${text}: ${r.errors[0].message}`)
  return r.fn
}
const split = (s: string) => s.split(',').map((x) => x.trim())

describe('msi page renders', () => {
  it('every tab renders its default state', () => {
    expect(renderToString(<MsiPage />)).toContain('ripple-carry adder')
    expect(renderToString(<AdderTab intro={null} />)).toContain('Column addition')
    expect(renderToString(<ComparatorTab intro={null} />)).toContain('Bit cascade from the MSB')
    expect(renderToString(<DecoderTab intro={null} />)).toContain('Output formulas')
    expect(renderToString(<EncoderTab intro={null} />)).toContain('misleading')
    expect(renderToString(<MuxTab intro={null} />)).toContain('Truth table split by the selects')
    expect(renderToString(<WorkbenchTab intro={null} />)).toContain('Every block on row 0')
  })

  it('no em dashes in the copy', () => {
    for (const html of [<MsiPage />, <ComparatorTab intro={null} />, <DecoderTab intro={null} />, <EncoderTab intro={null} />, <MuxTab intro={null} />, <WorkbenchTab intro={null} />].map((e) => renderToString(e)))
      expect(html).not.toContain(String.fromCharCode(0x2014))
  })
})

describe('presets match their sources', () => {
  it('adder presets', () => {
    for (const p of ADDER_PRESETS.filter((q) => q.mode === 'rc')) {
      const r = rippleAdd({ width: p.n!, x: p.x!, y: p.y!, cin: p.cin })
      expect(r.ok, p.name).toBe(true)
    }
    const l17 = rippleAdd({ width: 4, x: 0b1010, y: 0b1111 })
    expect(l17.ok && l17.trace.total).toBe(25)
    const big = rippleAdd({ width: 16, x: 0xffff, y: 1 })
    expect(big.ok && [big.trace.delay.s, big.trace.delay.cout]).toEqual([32, 33])
  })

  it('comparator presets: finder verdicts and wirings', () => {
    const possible: Record<string, boolean> = {
      'T07 Q5': true,
      'AY24/25 Q7, derived': true,
      'R09 p52': true,
    }
    for (const p of CMP_PRESETS) {
      if (p.mode === 'find' && !p.pairs) {
        const s = findComparatorWirings(fn(p.f!), { width: p.width })
        const want = p.name.includes('not possible') ? false : (possible[p.source] ?? true)
        expect(s.possible, p.name).toBe(want)
      }
      if (p.mode === 'wire') expect(comparatorCircuit({ x: p.x!, y: p.y! }, split(p.vars!)).ok, p.name).toBe(true)
    }
  })

  it('decoder presets: every circuit matches its target, every finder verdict holds', () => {
    for (const p of DEC_PRESETS) {
      const spec = { k: p.k ?? 2, enable: p.enable ?? 'none', outputs: p.outputs ?? 'high' } as const
      if (p.mode === 'circuit') {
        const vars = split(p.vars!)
        const c = decoderCircuit(spec, { selects: p.selects!, enable: p.en }, vars, { outputs: p.used!, gate: p.gate! })
        expect(c.ok, p.name).toBe(true)
        if (c.ok && p.f) expect(mismatchRows(c.circuit.f, fn(p.f, vars)), p.name).toEqual([])
      }
      if (p.mode === 'find') expect(findDecoderWirings(fn(p.f!), spec).possible, p.name).toBe(!p.name.includes('impossible'))
      if (p.mode === 'tree') expect(decoderTree(p.n!, p.block!, p.code).ok, p.name).toBe(true)
    }
    const ay2526 = DEC_PRESETS.find((p) => p.source === 'AY25/26 Q11')!
    const c = decoderCircuit({ k: 3, enable: 'none', outputs: 'high' }, { selects: ay2526.selects! }, split(ay2526.vars!), { outputs: ay2526.used!, gate: 'NOR' })
    expect(c.ok && c.circuit.f.on).toEqual([0, 2, 4, 5, 7])
  })

  it('encoder presets: T08 Q5 gives H2 = A+B, H1 = A+B\'C, H0 = 1', () => {
    for (const p of ENC_PRESETS.filter((q) => q.mode === 'wired')) {
      const r = encoderCircuit(p.pins!, split(p.vars!), { priority: p.priority, valid: p.valid })
      expect(r.ok, p.name).toBe(true)
    }
    const t08 = ENC_PRESETS.find((p) => p.source.startsWith('T08 Q5;'))!
    const r = encoderCircuit(t08.pins!, split(t08.vars!), { priority: true, valid: false })
    expect(r.ok && r.circuit.outputs.map((f) => f.on)).toEqual([fn('A+B', ['A', 'B', 'C']).on, fn("A+B'∙C", ['A', 'B', 'C']).on, [0, 1, 2, 3, 4, 5, 6, 7]])
  })

  it('mux presets: data inputs as the sources give them', () => {
    const want: Record<string, string> = {
      'L18 p52-54': "1, C, 0, C'",
      'L18 p55': "A', A', A, A'",
      'T08 Q1, derived': "1, 0, X', 1",
      'AY23/24 S1 Q10': '0, C, 1, C',
      'R09 p55': '1, B, 0, 1, B, 0, 1, B',
      'L18 p56, derived': "1, 1, x4', 0, x4, 0, x4, 1",
    }
    for (const p of MUX_PRESETS) {
      const r = muxImplement(fn(p.f), split(p.selects))
      expect(r.ok, p.name).toBe(true)
      if (r.ok && want[p.source] && !p.name.startsWith('F2') && !p.name.startsWith('F3')) expect(r.plan.text, p.name).toBe(want[p.source])
    }
    for (const p of TREE_PRESETS) {
      const t = muxTree(p.n, p.levels, p.select)
      expect(t.ok && t.tree.output, p.name).toBe(p.select)
    }
  })

  it('workbench presets: every circuit builds and its checked signal matches the target', () => {
    for (const p of WB_PRESETS) {
      const vars = split(p.vars)
      const r = netlist(p.blocks.map(blockFromSpec), vars)
      if (!r.ok) throw new Error(`${p.name}: ${r.errors[0].message}`)
      if (p.target && p.check) expect(mismatchRows(r.net.signals[p.check], fn(p.target, vars)), p.name).toEqual([])
    }
  })
})
