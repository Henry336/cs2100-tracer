import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyse, buildGraph, design, machineFromTable, parseCircuit, parseStateTable, simulateTiming, type Bit } from '../../core/sequential'
import AnalysisTab, { parseInputSequence } from './AnalysisTab'
import CheckTab from './CheckTab'
import DesignTab from './DesignTab'
import FlipFlopTab from './FlipFlopTab'
import SequentialPage from './SequentialPage'
import { StateDiagram } from './StateDiagram'
import { ANALYSIS_PRESETS, CHECK_PRESETS, DESIGN_PRESETS, TIMING_PRESETS } from './presets'
import { parseStates, splitNames } from './common'

const EM_DASH = String.fromCharCode(0x2014)

describe('sequential page renders', () => {
  it('every tab renders its default state', () => {
    expect(renderToString(<SequentialPage />)).toContain('Timing diagram')
    expect(renderToString(<FlipFlopTab intro={null} />)).toContain('Excitation table')
    expect(renderToString(<AnalysisTab intro={null} />)).toContain('Compact state table')
    expect(renderToString(<DesignTab intro={null} />)).toContain('Excitation table')
    expect(renderToString(<CheckTab intro={null} />)).toContain('Entry by entry')
  })

  it('no em dashes in the copy', () => {
    for (const el of [<SequentialPage />, <FlipFlopTab intro={null} />, <AnalysisTab intro={null} />, <DesignTab intro={null} />, <CheckTab intro={null} />]) expect(renderToString(el)).not.toContain(EM_DASH)
    const all = JSON.stringify([ANALYSIS_PRESETS, CHECK_PRESETS, DESIGN_PRESETS, TIMING_PRESETS])
    expect(all).not.toContain(EM_DASH)
  })

  it('stepping views put the picture on a board with a Play pill inside it', () => {
    for (const el of [<FlipFlopTab intro={null} />, <AnalysisTab intro={null} />, <DesignTab intro={null} />]) {
      const html = renderToString(el)
      expect(html).toMatch(/class="seq-board canvas"[\s\S]*class="seq-board-play"[\s\S]*class="seq-play"/)
      expect(html).toContain('role="tablist"')
    }
  })

  it('the active arrow carries light that restarts with the step', () => {
    const p = parseCircuit("A+ = A∙x + B∙x\nB+ = A'∙x")
    if (!p.ok) throw new Error('parse')
    const a = analyse(p.circuit)
    if (!a.ok) throw new Error('analyse')
    const still = renderToString(<StateDiagram graph={a.analysis.graph} current={1} active={{ from: 1, to: 3 }} label="test" />)
    expect(still).not.toContain('flow-packets')
    const lit = renderToString(<StateDiagram graph={a.analysis.graph} current={1} active={{ from: 1, to: 3 }} step={2} label="test" />)
    expect(lit.match(/pathLength="1"/g)).toHaveLength(2)
  })

  it('the state diagram draws every state and an arrow label', () => {
    const p = parseCircuit("A+ = A∙x + B∙x\nB+ = A'∙x\ny = (A+B)∙x'")
    if (!p.ok) throw new Error('parse')
    const a = analyse(p.circuit)
    if (!a.ok) throw new Error('analyse')
    const html = renderToString(<StateDiagram graph={a.analysis.graph} current={1} active={{ from: 1, to: 3 }} label="test" />)
    expect(html.match(/class="sd-disc"/g)).toHaveLength(4)
    expect(html).toContain('1/0')
  })
})

describe('presets match their sources', () => {
  it('every timing preset simulates', () => {
    for (const p of TIMING_PRESETS) {
      const clock = p.element === 'gated-d' || p.element === 'gated-sr' ? 'EN' : 'CLK'
      const waves: Record<string, Bit[]> = { [clock]: p.waves.CLK }
      for (const [k, v] of Object.entries(p.waves)) if (k !== 'CLK') waves[k] = v
      const r = simulateTiming({ element: p.element, edge: p.edge, asyncLevel: p.asyncLevel, waves })
      expect(r.ok, p.name).toBe(true)
    }
    const p25 = TIMING_PRESETS.find((p) => p.source === 'L19 p25 figure')!
    const r = simulateTiming({ element: 'JK', asyncLevel: 'low', waves: p25.waves })
    expect(r.ok && r.trace.q).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0])
  })

  it('every analysis preset parses, and its sequence fits its inputs', () => {
    for (const p of ANALYSIS_PRESETS) {
      const ins = splitNames(p.inputs ?? '')
      let inputs: string[]
      if (p.mode === 'eq') {
        const c = parseCircuit(p.text, ins.length ? { inputs: ins } : {})
        expect(c.ok, p.name).toBe(true)
        if (!c.ok) continue
        const used = parseStates(p.used ?? '').states
        const a = analyse(used ? { ...c.circuit, used } : c.circuit)
        expect(a.ok, p.name).toBe(true)
        inputs = c.circuit.inputs
      } else {
        const t = parseStateTable(p.text, { inputs: ins.length, outputs: splitNames(p.outputs ?? '').length })
        expect(t.ok, p.name).toBe(true)
        if (!t.ok) continue
        expect(buildGraph(machineFromTable(t.table, { inputs: ins, outputs: splitNames(p.outputs ?? ''), bits: splitNames(p.bits ?? 'A, B') })).nodes.length).toBeGreaterThan(0)
        inputs = ins
      }
      if (p.seq) expect(parseInputSequence(p.seq, inputs.length).error, p.name).toBeUndefined()
    }
  })

  it('every design preset designs and reproduces its table', () => {
    for (const p of DESIGN_PRESETS) {
      const r = design({ bits: splitNames(p.bits), inputs: splitNames(p.inputs), outputs: splitNames(p.outputs), types: p.types, rows: p.rows, prefer: p.prefer })
      expect(r.ok, p.name).toBe(true)
      expect(r.ok && r.design.verified, p.name).toBe(true)
    }
  })

  it('checker presets: the keys match, the slip does not', () => {
    for (const p of CHECK_PRESETS) {
      const c = parseCircuit(p.eq)
      if (!c.ok) throw new Error(p.name)
      const t = parseStateTable(p.table, { inputs: c.circuit.inputs.length, outputs: c.circuit.outputs?.length ?? 0 })
      if (!t.ok) throw new Error(p.name)
      const a = analyse(c.circuit)
      if (!a.ok) throw new Error(p.name)
      const ok = t.table.rows.every((r) => r.next.every((n, k) => n === null || a.analysis.machine.next[r.state][k] === n) && (r.out ?? []).every((o, k) => o.every((v, i) => v === 'X' || a.analysis.machine.out[r.state][k][i] === v)))
      expect(ok, p.name).toBe(!p.name.includes('slip'))
    }
  })

  it('input sequences: one input as a string, two inputs in pairs', () => {
    expect(parseInputSequence('100010', 1).combos).toEqual([1, 0, 0, 0, 1, 0])
    expect(parseInputSequence('01 11 01', 2).combos).toEqual([1, 3, 1])
    expect(parseInputSequence('011101', 2).combos).toEqual([1, 3, 1])
    expect(parseInputSequence('012', 1).error).toBeDefined()
  })
})
