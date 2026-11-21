import { describe, expect, it } from 'vitest'
import { criticalPath, cycleTime, LATENCY_PRESETS, stageTable, timingClassOf } from './timing'

const r06 = LATENCY_PRESETS.find((p) => p.id === 'r06')!.delays
const l12 = LATENCY_PRESETS.find((p) => p.id === 'l12')!.delays

describe('FX9 L12 p36 ns model (official)', () => {
  it('per-instruction times 6 / 8 / 7 / 5 ns and cycle time 8 ns', () => {
    expect(criticalPath('R', l12).total).toBe(6)
    expect(criticalPath('lw', l12).total).toBe(8)
    expect(criticalPath('sw', l12).total).toBe(7)
    expect(criticalPath('beq', l12).total).toBe(5)
    expect(cycleTime(l12)).toMatchObject({ cycle: 8, slowest: 'lw' })
  })
  it('stage table matches the slide columns', () => {
    const t = stageTable(l12)
    expect(t.rows.map((r) => r.total)).toEqual([6, 8, 7, 5])
    expect(t.rows[0].cells).toEqual({ instMem: 2, regRead: 1, alu: 2, dataMem: null, regWrite: 1 })
    expect(t.cycle).toBe(8)
    expect(criticalPath('lw', l12).why.working).toContain('2 + 1 + 2 + 2 + 1 = 8 ns')
  })
})

describe('FX9 R06 p42 addi = 950 ps (official)', () => {
  const r = criticalPath('addi', r06)
  it('total and path', () => {
    expect(r.total).toBe(950)
    expect(r.path).toEqual(['IM', 'RFR', 'ALU', 'MTR', 'RFW'])
    expect(r.why.working).toContain('400 + 200 + 120 + 30 + 200 = 950 ps')
  })
  it('sign extend + ALUSrc mux and Control are off the path; data memory is not needed', () => {
    for (const id of ['SEXT', 'ALUSRC', 'CTRL'] as const) expect(r.nodes.find((n) => n.id === id)!.onPath).toBe(false)
    expect(r.nodes.find((n) => n.id === 'ALUSRC')!.slack).toBe(70) // 450 + 30 is ready 70 ps before RD1 at 600
    expect(r.notNeeded.map((n) => n.id)).toContain('DM')
  })
})

describe('FX9 T05 Q2 (derived, no key)', () => {
  it('sub = 980 ps: RD2 passes through the ALUSrc mux', () => {
    const r = criticalPath(timingClassOf('sub')!, r06)
    expect(r.total).toBe(980)
    expect(r.why.working).toContain('400 + 200 + 30 + 120 + 30 + 200 = 980 ps')
  })
  it('lw = 1300 ps, so the cycle time is at least 1300 ps', () => {
    expect(criticalPath('lw', r06).total).toBe(1300)
    expect(cycleTime(r06)).toMatchObject({ cycle: 1300, slowest: 'lw' })
  })
  it('sw = 1070 ps and beq = 800 ps', () => {
    expect(criticalPath('sw', r06).total).toBe(1070)
    const beq = criticalPath('beq', r06)
    expect(beq.total).toBe(800)
    expect(beq.path).toEqual(['IM', 'RFR', 'ALUSRC', 'ALU', 'AND', 'PCSRC'])
  })
})

describe('editable delays', () => {
  it('a slow sign extend moves the addi critical path', () => {
    const slow = { unit: 'ps' as const, values: { ...r06.values, signExt: 300 } }
    const r = criticalPath('addi', slow)
    expect(r.path).toEqual(['IM', 'SEXT', 'ALUSRC', 'ALU', 'MTR', 'RFW'])
    expect(r.total).toBe(400 + 300 + 30 + 120 + 30 + 200)
  })
  it('a tie is reported', () => {
    // Control + ALU control (100 + 100) ends at 600 ps, the same time as the register read.
    expect(criticalPath('addi', r06).ties.map((t) => t.id)).toContain('ALUCTL')
  })
})

describe('bad delay values', () => {
  it('NaN, negative and missing delays count as 0, so the total is a number and lw still uses the ALU', () => {
    const nan = criticalPath('lw', { unit: 'ps', values: { ...r06.values, alu: Number.NaN } })
    expect(Number.isNaN(nan.total)).toBe(false)
    const neg = criticalPath('lw', { unit: 'ps', values: { ...r06.values, alu: -500 } })
    expect(neg.total).toBe(nan.total)
    expect(cycleTime(r06, []).slowest).toBeNull()
  })
})
