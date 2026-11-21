import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DATAPATH_PRESETS, LATENCY_PRESETS, UNITS, criticalPath, traceDatapath, wireSpecs, type DatapathTrace } from '../../core/datapath'
import ControlTab, { MainTable, RawAlu } from './ControlTab'
import DatapathPage from './DatapathPage'
import QuizTab from './QuizTab'
import TimingTab from './TimingTab'
import { useTraceInputs } from './TraceTab'
import { CONTROL_LABELS, LABELS, UNIT_GEOM, WIRE_PATH } from './geometry'
import { WHOLE, buildTimingModel, buildTraceModel } from './model'
import { TRACE_PRESETS } from './presets'

const ok = (source: string, extra = {}) => {
  const r = traceDatapath({ source, ...extra })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r as DatapathTrace
}

describe('datapath page', () => {
  it('renders the tracer by default with the diagram and the T04 table', () => {
    const html = renderToString(<DatapathPage />)
    expect(html).toContain('T04 Q3 table')
    expect(html).toContain('dp-svg')
    expect(html).toContain('Main control table')
  })

  it('every wire and unit of the engine has geometry, and every label names real wires', () => {
    const ids = wireSpecs('L11', true).map((w) => w.id)
    for (const id of ids) expect(WIRE_PATH[id], id).toBeTruthy()
    for (const u of UNITS) expect(UNIT_GEOM[u.id], u.id).toBeTruthy()
    for (const l of LABELS) for (const w of l.wires) expect(ids, l.id).toContain(w)
    for (const c of CONTROL_LABELS) expect(ids).toContain(c.wire)
  })

  it('control tab shows the PLA, the stage-grouping toggle and the raw ALU (0110 on 12 and 5 gives 7)', () => {
    function Wrap() {
      return <ControlTab intro={null} x={useTraceInputs()} />
    }
    const html = renderToString(<Wrap />)
    expect(html).toContain('dp-pla')
    expect(html).toContain('flow-draw') // the lw term fires, so its path is lit
    expect(html).toContain('ALU from its four control bits')
    // The column switch and the raw ALU sit in tabs of the Details strip, so render those bodies directly.
    expect(renderToString(<MainTable active="lw" order="L12" setOrder={() => {}} />)).toContain('By stage (L20 p27)')
    expect(renderToString(<RawAlu code={0b0110} setCode={() => {}} a="12" setA={() => {}} b="5" setB={() => {}} fromGates="0110" />)).toContain('0x00000007 (7)')
  })

  it('timing tab lights the critical path on the board', () => {
    const html = renderToString(<TimingTab intro={null} />)
    expect(html).toContain('Critical path of addi')
    expect(html).toContain('950 ps')
    expect(html).toContain('flow-draw')
  })

  it('quiz tab blanks the row: no answer is on the page before checking', () => {
    const html = renderToString(<QuizTab intro={null} />)
    expect(html).toContain('Fill in the control row for beq')
    expect(html).toContain('Check my answers')
    expect(html).not.toContain('Marked:')
    expect(html).not.toContain('Main control')
  })

  it('every preset names its source and traces (or is refused with a reason)', () => {
    expect(TRACE_PRESETS.length).toBe(DATAPATH_PRESETS.length + 2)
    for (const p of TRACE_PRESETS) expect(p.source, p.name).not.toBe('')
  })
})

describe('diagram model', () => {
  it('FX1 beq: WR and WD discarded, RegDst dashed X, PCSrc mux shows the input taken', () => {
    const t = ok('beq $1, $3, 12', { regs: { 1: 5, 3: 5 } })
    const m = buildTraceModel(t, WHOLE, false, 'hex')
    expect(m.wires.wd.tone).toBe('disc')
    expect(m.wires['c-regdst'].tone).toBe('x')
    expect(m.wires.btarget.tone).toBe('now')
    expect(m.mux.pcsrc).toBe(1)
    expect(m.mux.regdst).toBe('X')
  })

  it('stepping: in decode the ALU result is not reached yet; focus mode hides it and discarded wires', () => {
    const t = ok('sub $25, $20, $5')
    const m = buildTraceModel(t, 1, false, 'hex')
    expect(m.wires['alu-mtr'].tone).toBe('future')
    expect(m.wires['inst-rs'].tone).toBe('now')
    expect(m.wires['pc-im'].tone).toBe('past')
    const f = buildTraceModel(t, 1, true, 'hex')
    expect(f.wires['alu-mtr'].tone).toBe('hidden')
    expect(f.wires['sext-alusrc'].tone).toBe('hidden')
    expect(f.units.dm.tone).toBe('hidden')
    expect(f.units.rf.tone).toBe('now')
  })

  it('decimal toggle shows signed 32-bit values', () => {
    const t = ok('sw $21, -50($22)', { regs: { 21: 7, 22: 0x10010040 } })
    expect(buildTraceModel(t, WHOLE, false, 'hex').wires['sext-alusrc'].text).toBe('0xFFFFFFCE')
    expect(buildTraceModel(t, WHOLE, false, 'dec').wires['sext-alusrc'].text).toBe('-50')
    expect(buildTraceModel(t, WHOLE, false, 'dec').wires['inst-imm'].text).toBe('-50')
  })

  it('R06 p42 addi: the critical path ends in the register write and skips sign extend', () => {
    const r = criticalPath('addi', LATENCY_PRESETS[0].delays)
    expect(r.total).toBe(950)
    const m = buildTimingModel(r, true)
    expect(m.wires.wd.tone).toBe('path')
    expect(m.wires['inst-imm'].tone).not.toBe('path')
    expect(m.units.sext.tone).toBe('past')
    expect(m.units.dm.tone).toBe('future')
  })
  it('architecture.md focus mode: the timing diagram hides what addi does not need and keeps the rest', () => {
    const m = buildTimingModel(criticalPath('addi', LATENCY_PRESETS[0].delays), true, true)
    expect(m.units.dm.tone).toBe('hidden')
    expect(m.units.sext.tone).toBe('past')
    expect(m.wires.wd.tone).toBe('path')
  })
})
