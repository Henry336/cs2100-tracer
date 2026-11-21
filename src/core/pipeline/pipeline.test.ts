import { describe, expect, it } from 'vitest'
import {
  AY2324S1_Q1, AY2324S1_Q12, AY2526_Q4, L21_EX1, L21_EX3, PIPELINE_PRESETS, R11_Q6, R11_Q7, T10_EXTRA, T10_Q3,
} from './fixtures'
import { buildStream, classMix, delaySlotCandidates, idealCycles, timing, tracePipeline } from './index'
import { wordsToMem } from '../mips'

// Every fixture here is official (slides or an answer key) unless the test name says derived.
describe('course presets (official)', () => {
  for (const p of PIPELINE_PRESETS) {
    for (const part of p.parts) {
      it(`${p.id} ${p.cite}: ${part.label}`, () => {
        const t = tracePipeline(part.source ?? p.source, part.options, part.stream ?? p.stream ?? {})
        expect(t.ok, JSON.stringify(t.errors)).toBe(true)
        const e = part.expect
        if (e.cycles !== undefined) expect(t.totals.cycles).toBe(e.cycles)
        if (e.stallCycles !== undefined) expect(t.totals.stallCycles).toBe(e.stallCycles)
        if (e.delays) {
          const got = Object.fromEntries(t.instructions.filter((i) => i.delay > 0).map((i) => [i.name, i.delay]))
          if (p.id === 'P16') for (const [k, v] of Object.entries(e.delays)) expect(got[k] ?? 0).toBe(v)
          else expect(got).toEqual(e.delays)
          if (p.id === 'P16' && !Object.keys(e.delays).length) expect(got.C ?? 0).toBe(0)
        }
        if (e.nops) expect(t.totals.nops).toEqual(e.nops)
        if (e.flushed) expect(t.rows.filter((r) => r.wrongPath).map((r) => r.name)).toEqual(e.flushed)
      })
    }
  }
})

describe('totals explain every number (reviewer: stall split, events, flushed)', () => {
  const run = (id: string, k = 0) => {
    const p = PIPELINE_PRESETS.find((x) => x.id === id)!
    const part = p.parts[k]
    return tracePipeline(part.source ?? p.source, part.options, part.stream ?? p.stream ?? {}).totals
  }
  it('P9 R11 p46: the third flushed fetch is named as outside the program', () => {
    const t = run('P9')
    expect(t.flushed).toBe(3)
    expect(t.why.flushed.working).toContain('(not in the program)')
    expect(t.why.flushed.working).toContain('= 3')
  })
  it('every preset: the split Why lists each delay and data + control = stall cycles', () => {
    for (const p of PIPELINE_PRESETS) p.parts.forEach((_, k) => {
      const t = run(p.id, k)
      expect(t.dataStallCycles + t.controlStallCycles).toBe(t.stallCycles)
      expect(t.why.split.working).toContain(`= ${t.dataStallCycles}; control`)
      expect(t.why.stallEvents.working).toEqual(t.stallEvents ? expect.stringContaining(`= ${t.stallEvents}`) : 'none')
    })
  })
})

describe('ideal counts', () => {
  it('P3 R11 p5, p40: I + N - 1', () => {
    expect(idealCycles(10, 5).cycles).toBe(14)
    expect(idealCycles(10, 6).cycles).toBe(15)
  })
  it('P12 AY23/24 S2 Q17(a): ideal 24', () => {
    const p = PIPELINE_PRESETS.find((x) => x.id === 'P12')!
    expect(tracePipeline(p.source, {}, p.stream).totals.ideal).toBe(24)
  })
  it('P6 L21 p43: 22 instructions, ideal 26', () => {
    const t = tracePipeline(L21_EX3)
    expect(t.totals.instructions).toBe(22)
    expect(t.totals.ideal).toBe(26)
  })
  it('P17 AY24/25 Q13 = 30, AY25/26 Q2 = 36 (bne $s0, 0 counts as one instruction)', () => {
    const a = PIPELINE_PRESETS.find((x) => x.id === 'P17a')!
    const b = PIPELINE_PRESETS.find((x) => x.id === 'P17b')!
    const ta = tracePipeline(a.source)
    const tb = tracePipeline(b.source)
    expect([ta.totals.instructions, ta.totals.ideal]).toEqual([26, 30])
    expect([tb.totals.instructions, tb.totals.ideal]).toEqual([32, 36])
  })
})

describe('stall rules', () => {
  it('P4 L21 p22: distance 1 costs 2 and distance 2 costs 1 without forwarding', () => {
    const t = tracePipeline(L21_EX1, { forwarding: false })
    const and = t.instructions[1]
    expect(and.operands[0]).toMatchObject({ register: 2, distance: 1, isolated: 2, stalls: 2, need: 'ID' })
    const or = t.instructions[2]
    expect(or.operands[0]).toMatchObject({ distance: 2, isolated: 1, stalls: 0 })
    expect(and.stalls[0]).toMatchObject({ kind: 'raw', binding: true, cycles: 2 })
    // Blank cells between F and D, and the next fetch lines up with the stalled D (L21 p22).
    expect(and.stages).toMatchObject({ IF: 2, ID: 5 })
    expect(t.rows[2].stages.IF).toBe(5)
  })
  it('P5 L21 p26: with forwarding the load-use blank sits between D and E', () => {
    const t = tracePipeline(L21_EX1.replace('sub $2, $1, $3', 'lw  $2, 20($3)'), { forwarding: true })
    expect(t.instructions[1].stages).toMatchObject({ IF: 2, ID: 3, EX: 5 })
    expect(t.instructions[2].stages).toMatchObject({ IF: 3, ID: 5 })
    expect(t.instructions[1].stalls[0].kind).toBe('load-use')
    expect(t.instructions[1].operands[0].forward.path).toBe('MEM/WB -> EX')
  })
  it('P8 R11 p45: predict taken (beyond the course) is labelled', () => {
    const t = tracePipeline(R11_Q7, { branchStage: 'ID', prediction: 'taken' }, { outcomes: [true] })
    expect(t.notes.some((n) => n.includes('beyond the course'))).toBe(true)
    expect(t.instructions[1].stages.ID).toBe(5)
    expect(t.instructions[1].operands[0].forward.path).toBe('MEM/WB -> ID')
  })
  it('P9 R11 p46: sub and add are flushed, the target is fetched in cycle 7', () => {
    const t = tracePipeline(R11_Q7, { branchStage: 'MEM', prediction: 'not-taken' }, { outcomes: [true] })
    const wrong = t.rows.filter((r) => r.wrongPath)
    expect(wrong.filter((r) => !r.outside).map((r) => r.text)).toEqual(['sub $s0, $s4, $s5', 'add $s0, $s0, $s3'])
    expect(wrong.every((r) => r.flushedAt === 6)).toBe(true)
    expect(t.instructions[2].stages.IF).toBe(7)
    expect(t.totals.flushed).toBe(wrong.length)
  })
  it('P15 T10 Q3: beq reaches ID in cycle 6 (two bubbles)', () => {
    const t = tracePipeline(T10_Q3, { branchStage: 'ID', prediction: 'not-taken' }, { outcomes: [false] })
    expect(t.instructions[2].stages.ID).toBe(6)
    expect(t.instructions[2].delay).toBe(2)
    const nopred = tracePipeline(T10_Q3, { branchStage: 'ID', prediction: 'none' }, { outcomes: [false], stopAfter: { instr: 4 } })
    expect(nopred.totals.cycles).toBe(11)
    const taken = tracePipeline(T10_Q3, { branchStage: 'ID', prediction: 'not-taken' }, { outcomes: [true] })
    expect(taken.instructions[3].stages.IF).toBe(7)
  })
  it('P6 L21 p38: ALU result right before an early branch costs 1 (ALU->ID)', () => {
    const t = tracePipeline(L21_EX3, { branchStage: 'ID', prediction: 'not-taken' })
    const bne = t.instructions[2]
    expect(bne.delay).toBe(1)
    expect(bne.stalls.find((s) => s.binding)?.kind).toBe('branch-operand')
    expect(bne.operands[0].forward.path).toBe('EX/MEM -> ID')
    expect(t.totals.controlStallCycles).toBe(9)
    expect(t.totals.dataStallCycles).toBe(10)
  })
  it('derived: lw two before an early branch costs 1 (spec section 4)', () => {
    const t = tracePipeline('lw $1, 0($2)\nadd $3, $4, $5\nbeq $1, $0, L\nL: add $6, $6, $6', { branchStage: 'ID' }, { outcomes: [false] })
    expect(t.instructions[2].delay).toBe(1)
  })
  it('derived: lw then sw of the loaded value is an option (spec ambiguity 6)', () => {
    const src = 'lw $1, 0($2)\nsw $1, 4($2)'
    expect(tracePipeline(src, { storeData: 'ex' }).totals.cycles).toBe(7)
    const mem = tracePipeline(src, { storeData: 'mem' })
    expect(mem.totals.cycles).toBe(6)
    expect(mem.instructions[1].operands.find((o) => o.register === 1)?.forward.path).toBe('MEM/WB -> MEM')
    expect(mem.notes.some((n) => n.includes('no course source covers this case'))).toBe(true)
  })
  it('derived: delayed branch with early branch removes the branch delay (L21 p46)', () => {
    const src = 'add $1, $2, $3\nbeq $4, $5, L\nadd $6, $7, $8\nsub $9, $9, $9\nL: or $10, $11, $12'
    const t = tracePipeline(src, { branchStage: 'ID', delayedBranch: true }, { outcomes: [true] })
    expect(t.instructions.map((i) => i.name)).toEqual(['i1', 'i2', 'i3', 'i5'])
    expect(t.instructions[2].slot).toBe(true)
    expect(t.totals.stallCycles).toBe(0)
  })
})

describe('pipelined datapath view', () => {
  // L21 p16-18: $2 = 10, sub gives -20; EX/MEM holds it in CC4, MEM/WB in CC5.
  const t = tracePipeline(L21_EX1, { forwarding: true }, { regs: { 1: 10, 2: 10, 3: 30 } })
  it('derived: forwards per cycle match L21 p18', () => {
    expect(t.frames[3].forwards.map((f) => f.path)).toEqual(['EX/MEM -> EX'])
    expect(t.frames[4].forwards.map((f) => f.path)).toContain('MEM/WB -> EX')
    expect(t.instructions[3].operands[0].forward.path).toBe('register file (split cycle)')
  })
  it('derived: ID/EX holds the stale register value while EX uses the forwarded one', () => {
    const idex = t.frames[3].regs['ID/EX']
    expect(idex.name).toBe('i2')
    const rd1 = idex.fields.find((f) => f.label === 'RD1')!
    expect(rd1.value).toBe(10)
    expect(rd1.note).toContain('-20')
    const exmem = t.frames[3].regs['EX/MEM']
    expect(exmem.fields.find((f) => f.label === 'ALU result')?.value).toBe(-20)
    expect(exmem.control).toEqual({ M: { MemRead: 0, MemWrite: 0, Branch: 0 }, WB: { MemToReg: 0, RegWrite: 1 } })
    expect(t.frames[4].regWrite).toMatchObject({ register: 2, value: -20 })
  })
  it('derived: a stall puts a bubble into ID/EX and keeps the instruction in ID', () => {
    const s = tracePipeline(L21_EX1, { forwarding: false })
    expect(s.frames[3].stages.ID).toBe('c2')
    expect(s.frames[3].regs['ID/EX'].uid).toBeNull()
    expect(s.frames[3].events.some((e) => e.includes('stays in ID'))).toBe(true)
    expect(s.frames.length).toBe(11)
  })
  it('T10 Additional Question / L11 p6: andi in ID/EX says it is not supported and why', () => {
    const andi = T10_EXTRA.split(/\r?\n/).find((l) => l.includes('andi'))!.replace(/#.*/, '')
    const regs = tracePipeline(andi, { forwarding: true }).frames.map((fr) => fr.regs['ID/EX']).find((r) => r.uid)!
    expect(regs.control.EX?.ALUop).toBe('00')
    expect(regs.control.note).toContain('L11 p6')
    expect(regs.fields.find((f) => f.label === 'Immediate (sign-extended)')?.note).toContain('only sign-extends')
    expect(tracePipeline('sll $1, $2, 2', {}).frames.map((fr) => fr.regs['ID/EX']).find((r) => r.uid)?.control.note).toContain('L11 p47')
  })
})

describe('dependencies', () => {
  it('P18 AY25/26 Q4: the only dependency is WAW on $t2, and it does not stall', () => {
    const t = tracePipeline(AY2526_Q4)
    expect(t.dependencies.map((d) => [d.kind, d.register, d.stalls])).toEqual([['WAW', 10, 0]])
    expect(t.dependencies[0].examNote).toContain('AY25/26')
    expect(t.dependencies[0].beyond?.rule).toContain('Beyond the course')
  })
  it('P18 R11 p43 checklist on the R11 Q6 code', () => {
    const t = tracePipeline(R11_Q6)
    const has = (kind: string, to: string, from: string) =>
      t.dependencies.some((d) => d.kind === kind && t.instructions[d.to - 1].name === to && t.instructions[d.from - 1].name === from)
    expect(has('WAR', 'B', 'A')).toBe(true)
    expect(has('RAW', 'F', 'D')).toBe(true)
    expect(has('RAW', 'E', 'D')).toBe(true)
    expect(has('WAW', 'D', 'C')).toBe(true)
    expect(t.dependencies.filter((d) => d.kind !== 'RAW').every((d) => d.stalls === 0)).toBe(true)
  })
  it('P19 AY23/24 S1 Q12: only I5 can fill the delay slot of I7 (key D)', () => {
    const s = buildStream(AY2324S1_Q12, { outcomes: [] })
    const c = delaySlotCandidates(s, 6)
    expect(c.filter((x) => x.ok).map((x) => x.name)).toEqual(['I5'])
    expect(c.find((x) => x.name === 'I6')?.ok).toBe(false)
  })
})

describe('timing calculator', () => {
  it('P1 L20 p34: 40 ns single-cycle, 8 cycles = 16 ns pipelined', () => {
    const r = timing({ instructions: 4, singleCycleTime: 10, pipelineCycleTime: 2, stages: 5 })
    expect(r.single?.time).toBe(40)
    expect([r.pipelined?.cycles, r.pipelined?.time]).toEqual([8, 16])
  })
  it('P2 L20 p31-32: 800 / 920 / 260 ns', () => {
    const r = timing({ instructions: 100, stageTimes: [2, 1, 2, 2, 1], td: 0.5, cpi: 4.6 })
    expect([r.single?.time, r.multi?.time, r.pipelined?.time]).toEqual([800, 920, 260])
  })
  it('P14 AY23/24 S1 Q1-4: 144 ns, 2.5 GHz, 105.2 ns, 34.2 ns', () => {
    const s = buildStream(AY2324S1_Q1, { regs: { 7: 0x10010000, 8: 8 }, mem: wordsToMem(0x10010000, [1, 9, 2, 8, 3, 7, 6, 5]) })
    expect(s.items.length).toBe(72)
    const r = timing({ instructions: 72, singleCycleTime: 2, stageTimes: [0.1, 0.2, 0.2, 0.4, 0.2], td: 0.05, mix: classMix(s.items) })
    expect(r.single?.time).toBe(144)
    expect(r.multiClockGHz).toBe(2.5)
    expect(r.multi?.time).toBe(105.2)
    expect(r.pipelined?.time).toBe(34.2)
  })
})

describe('input handling', () => {
  it('reports assembly errors with line numbers instead of throwing', () => {
    const t = tracePipeline('add $t0, $t1\nfoo $1')
    expect(t.ok).toBe(false)
    expect(t.errors.length).toBeGreaterThan(0)
  })
  it('caps the stream and says so', () => {
    const t = tracePipeline('L: j L', {}, { maxInstructions: 5 })
    expect(t.totals.instructions).toBe(5)
    expect(t.stream.truncated).toBe(true)
  })
})

describe('fixes after verification', () => {
  it('T10 Additional p12: no flushed row after j even with predict not taken (prediction is for branches)', () => {
    const t = tracePipeline(T10_EXTRA, { forwarding: true, branchStage: 'MEM', prediction: 'not-taken', jumpStage: 'MEM' }, { regs: { 16: 0xafaffafa | 0, 17: 0xff } })
    expect(t.totals.cycles).toBe(56)
    expect(t.rows.filter((r) => r.wrongPath).every((r) => t.instructions.find((i) => i.seq === r.flushedBy)?.text.startsWith('b'))).toBe(true)
  })
  it('T10 Answers p16: the hazard unit fires in the cycle lw is in EX and its user is in ID', () => {
    const t = tracePipeline('add $1, $2, $3\nlw  $1, 0($1)\nadd $1, $1, $1\nadd $3, $2, $1', { forwarding: true })
    expect(t.frames[3].events.some((e) => e.startsWith('Hazard detection: i2'))).toBe(true)
    expect(t.frames.filter((f) => f.events.some((e) => e.startsWith('Hazard detection'))).length).toBe(1)
  })
  it('notes the past-the-end flushed row that R11 p46 leaves out', () => {
    const t = tracePipeline(R11_Q7, { branchStage: 'MEM', prediction: 'not-taken' }, { outcomes: [true] })
    expect(t.notes.some((n) => n.includes('R11 p46'))).toBe(true)
  })
  it('delayed branching with outcomes walks the slot after every branch (L21 p46)', () => {
    const s = buildStream('Loop: addi $t0, $t0, 1\nbne $s0, $zero, Loop\naddi $s0, $s0, -1', { outcomes: [true, false], delayedBranch: true })
    expect(s.items.map((i) => `${i.name}${i.slot ? '*' : ''}`)).toEqual(['i1', 'i2', 'i3*', 'i1', 'i2', 'i3*'])
  })
})
