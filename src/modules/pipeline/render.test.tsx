import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PRESETS } from './presets'
import BranchesTab from './BranchesTab'
import DatapathTab from './DatapathTab'
import DiagramTab, { idealTrace } from './DiagramTab'
import ExamTab, { changedLine, nopListing, replaceInstruction } from './ExamTab'
import { tracePipeline } from '../../core/pipeline'
import HazardsTab from './HazardsTab'
import PipelinePage from './PipelinePage'
import TimingTab from './TimingTab'
import { parseRun, useProgram } from './common'

// Smoke test: every tab renders its default state without throwing.
function With({ tab }: { tab: 'datapath' | 'hazards' | 'branches' | 'exam' }) {
  const p = useProgram()
  return tab === 'datapath' ? <DatapathTab intro={null} p={p} /> : tab === 'hazards' ? <HazardsTab intro={null} p={p} /> : tab === 'exam' ? <ExamTab intro={null} p={p} /> : <BranchesTab intro={null} p={p} />
}

describe('pipeline page renders', () => {
  it('diagram (page default), datapath, hazards, branches and timing', () => {
    const page = renderToString(<PipelinePage />)
    expect(page).toContain('Totals in exam terms')
    expect(page).toContain('Why each instruction waits')
    expect(renderToString(<With tab="datapath" />)).toContain('Pipeline registers')
    expect(renderToString(<With tab="hazards" />)).toContain('RAW')
    expect(renderToString(<With tab="branches" />)).toContain('Scoreboard')
    expect(renderToString(<With tab="exam" />)).toContain('Your answers')
    expect(renderToString(<TimingTab intro={null} />)).toContain('920')
    expect(DiagramTab).toBeTypeOf('function')
  })
  it('every preset names its source and parses its run settings', () => {
    for (const p of PRESETS) {
      expect(p.cite, p.key).not.toBe('')
      const r = parseRun(p.run)
      expect(Object.keys(r.errors), p.key).toEqual([])
    }
  })
  it('P10 (e): the paper change is found and applied with the label and tag kept', () => {
    const a = 'Loop: add $1, $2, $3 # Inst1\n  sub $4, $1, $1 # Inst2'
    const b = replaceInstruction(a, 1, 'and $5, $6, $7')
    expect(b.split('\n')[0]).toBe('Loop: and $5, $6, $7 # Inst1')
    expect(changedLine(a, b)).toEqual({ line: 1, text: 'and $5, $6, $7' })
    expect(changedLine(a, a)).toBeUndefined()
    const p10 = PRESETS.filter((x) => x.id === 'P10')
    const ch = changedLine(p10[0].code, p10[4].code)!
    expect(replaceInstruction(p10[0].code, ch.line, ch.text)).toBe(p10[4].code)
    // (d) AY24/25 key: 1 nop after Inst2, printed as code.
    const lines = nopListing(p10[0].code, tracePipeline(p10[0].code, { forwarding: true })).split('\n')
    const at = lines.findIndex((l) => l.includes('# Inst2'))
    expect(lines[at + 1].trim()).toBe('nop')
    expect(lines.filter((l) => l.trim() === 'nop')).toHaveLength(1)
  })
  it('parseRun reads outcomes and a stop instruction', () => {
    const r = parseRun({ regs: '$t0 = 5', mem: '', outcomes: 'T n 1', stop: 'i20', occ: 2 })
    expect(r.stream.outcomes).toEqual([true, false, true])
    expect(r.stream.stopAfter).toEqual({ instr: 'i20', occurrence: 2 })
    expect(r.stream.regs).toEqual({ 8: 5 })
    expect(parseRun({ regs: '', mem: '', outcomes: 'maybe', stop: '4', occ: 1 }).errors.outcomes).toBeTruthy()
  })
})

describe('ideal view', () => {
  it('redraws the same stream with no stalls or flushes in I + 4 cycles', () => {
    const src = ['lw $1, 0($2)', 'add $3, $1, $1', 'beq $3, $0, L', 'add $4, $4, $4', 'L: sub $5, $5, $5'].join('\n')
    const t = tracePipeline(src, { forwarding: true, prediction: 'not-taken' })
    expect(t.ok).toBe(true)
    const i = idealTrace(t)
    expect(i.totals.cycles).toBe(t.totals.instructions + 4)
    expect(i.rows.every((r) => !r.wrongPath)).toBe(true)
    i.rows.forEach((r, k) => expect(r.stages).toEqual({ IF: k + 1, ID: k + 2, EX: k + 3, MEM: k + 4, WB: k + 5 }))
    expect(t.totals.ideal + t.totals.dataStallCycles + t.totals.controlStallCycles).toBe(t.totals.cycles)
  })
})
