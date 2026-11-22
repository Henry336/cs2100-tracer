import { describe, expect, it } from 'vitest'
import { traceDatapath, type DatapathTrace } from '../../core/datapath'
import { MS_PER_PS, WHOLE, buildTraceModel, pathLength, runOf } from './model'

const ok = (source: string) => {
  const r = traceDatapath({ source })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r as DatapathTrace
}
const run = (t: DatapathTrace, k: number) => runOf(t, buildTraceModel(t, k, false, 'hex'), k)

describe('playback dots', () => {
  it('measures M/H/V wire paths', () => {
    expect(pathLength('M290 120H300V200H220')).toBe(10 + 80 + 80)
  })

  it('a unit sends its result only after its delay (lw decode: RD1 waits 200 ps for the register file)', () => {
    const t = ok('lw $t0, 4($s1)')
    const r = run(t, 1)
    const rs = r.dots.find((d) => d.id === 'inst-rs')!
    const rd1 = r.dots.find((d) => d.id === 'rd1')!
    expect(rd1.start).toBe(rs.start + rs.dur + 200 * MS_PER_PS)
    expect(r.work.find((w) => w.unit === 'rf')).toMatchObject({ start: rs.start + rs.dur, dur: 200 * MS_PER_PS })
  })

  it('fetch shows instruction memory working for 400 ps after the PC arrives', () => {
    const r = run(ok('add $t2, $t0, $t1'), 0)
    const pc = r.dots.find((d) => d.id === 'pc-im')!
    expect(r.work.find((w) => w.unit === 'im')).toMatchObject({ start: pc.dur, dur: 400 * MS_PER_PS })
    expect(r.total).toBeGreaterThanOrEqual(pc.dur + 400 * MS_PER_PS)
  })

  it('only used wires carry dots, and an idle stage has none', () => {
    const t = ok('add $t2, $t0, $t1')
    const whole = run(t, WHOLE)
    expect(whole.dots.map((d) => d.id)).not.toContain('dm-mtr')
    expect(whole.dots.map((d) => d.id)).toContain('wd')
    expect(run(t, 3)).toMatchObject({ dots: [], total: 0 })
  })

  it('the whole cycle runs longer for lw than for add, as the critical path does', () => {
    expect(run(ok('lw $t0, 4($s1)'), WHOLE).total).toBeGreaterThan(run(ok('add $t2, $t0, $t1'), WHOLE).total)
  })
})

describe('paths box wiring', () => {
  it('the critical path of lw runs PC, Inst-Mem, RR1, RD1, ALU, Data-Mem, MemToReg, WD', async () => {
    const { pathWires } = await import('./PathsPanel')
    const t = ok('lw $t0, 4($s1)')
    expect(pathWires(t, ['IM', 'RFR', 'ALU', 'DM', 'MTR', 'RFW'])).toEqual(['pc-im', 'inst-rs', 'rd1', 'alu-dm', 'dm-mtr', 'wd'])
  })
})
