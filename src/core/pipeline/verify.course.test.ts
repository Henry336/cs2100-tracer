// Course-fidelity checks written by an independent verifier. Every expected value is re-read from the
// course PDFs (slide grids rendered and read cell by cell), not from the builder's fixtures.
import { describe, expect, it } from 'vitest'
import { AY2324S1_Q12, AY2324S1_Q16, AY2425_Q19, AY2526_Q19, L21_EX1, R11_Q6, R11_Q7 } from './fixtures'
import { buildStream, delaySlotCandidates, tracePipeline } from './index'
import { wordsToMem } from '../mips'

type Grid = [name: string, IF: number, ID: number, EX: number, MEM: number, WB: number][]
const grid = (t: ReturnType<typeof tracePipeline>): Grid =>
  t.instructions.map((i) => [i.name, i.stages.IF, i.stages.ID, i.stages.EX, i.stages.MEM, i.stages.WB])

describe('grids cell by cell (lecture and recitation slides)', () => {
  it('L21 p22: Exercise 1 without forwarding', () => {
    expect(grid(tracePipeline(L21_EX1, { forwarding: false }))).toEqual([
      ['i1', 1, 2, 3, 4, 5], ['i2', 2, 5, 6, 7, 8], ['i3', 5, 6, 7, 8, 9], ['i4', 6, 7, 8, 9, 10], ['i5', 7, 8, 9, 10, 11],
    ])
  })
  it('L21 p26: Exercise 2 with forwarding (blank between D and E, then between F and D)', () => {
    const src = L21_EX1.replace('sub $2, $1, $3', 'lw  $2, 20($3)')
    expect(grid(tracePipeline(src, { forwarding: true }))).toEqual([
      ['i1', 1, 2, 3, 4, 5], ['i2', 2, 3, 5, 6, 7], ['i3', 3, 5, 6, 7, 8], ['i4', 5, 6, 7, 8, 9], ['i5', 6, 7, 8, 9, 10],
    ])
  })
  it('R11 p44: Quiz Q6 both grids', () => {
    expect(grid(tracePipeline(R11_Q6, { forwarding: false }))).toEqual([
      ['A', 1, 2, 3, 4, 5], ['B', 2, 3, 4, 5, 6], ['C', 3, 6, 7, 8, 9], ['D', 6, 9, 10, 11, 12], ['E', 9, 12, 13, 14, 15], ['F', 12, 13, 14, 15, 16],
    ])
    expect(grid(tracePipeline(R11_Q6, { forwarding: true }))).toEqual([
      ['A', 1, 2, 3, 4, 5], ['B', 2, 3, 4, 5, 6], ['C', 3, 4, 6, 7, 8], ['D', 4, 6, 7, 8, 9], ['E', 6, 7, 8, 9, 10], ['F', 7, 8, 9, 10, 11],
    ])
  })
  it('R11 p46: Quiz Q8 counted rows and the two drawn wrong-path rows (sub F3 D5 E6, add F5 D6)', () => {
    const t = tracePipeline(R11_Q7, { branchStage: 'MEM', prediction: 'not-taken' }, { outcomes: [true] })
    expect(grid(t)).toEqual([['i1', 1, 2, 3, 4, 5], ['i2', 2, 3, 5, 6, 7], ['i4', 7, 8, 9, 10, 11]])
    const wrong = t.rows.filter((r) => r.wrongPath && !r.outside)
    expect(wrong.map((r) => [r.name, r.stages])).toEqual([
      ['i3', { IF: 3, ID: 5, EX: 6 }],
      ['i4', { IF: 5, ID: 6 }],
    ])
  })
})

describe('AY23/24 S1 Q16 key p9: every cell of the (b), (c), (d) grids', () => {
  const stream = { regs: { 8: 0x10010000 }, mem: wordsToMem(0x10010000, [3, 7]) }
  it('(b) no forwarding, early branch, no prediction: 40', () => {
    const t = tracePipeline(AY2324S1_Q16, { forwarding: false, branchStage: 'ID', prediction: 'none' }, stream)
    expect(grid(t)).toEqual([
      ['i1', 1, 2, 3, 4, 5], ['i2', 2, 3, 4, 5, 6], ['i3', 3, 5, 6, 7, 8], ['i4', 5, 8, 9, 10, 11], ['i5', 8, 11, 12, 13, 14],
      ['i6', 12, 13, 14, 15, 16], ['i7', 13, 14, 15, 16, 17], ['i8', 14, 17, 18, 19, 20], ['i9', 17, 20, 21, 22, 23],
      ['i3', 21, 22, 23, 24, 25], ['i4', 22, 25, 26, 27, 28], ['i5', 25, 28, 29, 30, 31], ['i6', 29, 30, 31, 32, 33],
      ['i7', 30, 31, 32, 33, 34], ['i8', 31, 34, 35, 36, 37], ['i9', 34, 37, 38, 39, 40],
    ])
  })
  it('(c) forwarding, early branch, no prediction: 29', () => {
    const t = tracePipeline(AY2324S1_Q16, { forwarding: true, branchStage: 'ID', prediction: 'none' }, stream)
    expect(grid(t)).toEqual([
      ['i1', 1, 2, 3, 4, 5], ['i2', 2, 3, 4, 5, 6], ['i3', 3, 4, 5, 6, 7], ['i4', 4, 5, 6, 7, 8], ['i5', 5, 8, 9, 10, 11],
      ['i6', 9, 10, 11, 12, 13], ['i7', 10, 11, 12, 13, 14], ['i8', 11, 12, 13, 14, 15], ['i9', 12, 14, 15, 16, 17],
      ['i3', 15, 16, 17, 18, 19], ['i4', 16, 17, 18, 19, 20], ['i5', 17, 20, 21, 22, 23], ['i6', 21, 22, 23, 24, 25],
      ['i7', 22, 23, 24, 25, 26], ['i8', 23, 24, 25, 26, 27], ['i9', 24, 26, 27, 28, 29],
    ])
  })
  it('(d) forwarding, early branch, predict not taken: 27, i10 fetched in 13 and squashed', () => {
    const t = tracePipeline(AY2324S1_Q16, { forwarding: true, branchStage: 'ID', prediction: 'not-taken' }, stream)
    expect(grid(t)).toEqual([
      ['i1', 1, 2, 3, 4, 5], ['i2', 2, 3, 4, 5, 6], ['i3', 3, 4, 5, 6, 7], ['i4', 4, 5, 6, 7, 8], ['i5', 5, 8, 9, 10, 11],
      ['i6', 8, 9, 10, 11, 12], ['i7', 9, 10, 11, 12, 13], ['i8', 10, 11, 12, 13, 14], ['i9', 11, 13, 14, 15, 16],
      ['i3', 14, 15, 16, 17, 18], ['i4', 15, 16, 17, 18, 19], ['i5', 16, 19, 20, 21, 22], ['i6', 19, 20, 21, 22, 23],
      ['i7', 20, 21, 22, 23, 24], ['i8', 21, 22, 23, 24, 25], ['i9', 22, 24, 25, 26, 27],
    ])
    const wrong = t.rows.filter((r) => r.wrongPath)
    expect(wrong.map((r) => [r.name, r.stages.IF, r.flushedAt])).toEqual([['i10', 13, 13]])
  })
})

describe('forwarding (R11 p13-20, T10 Answers p13-19)', () => {
  const T10_Q2 = 'add $1, $2, $3\nlw  $1, 0($1)\nadd $1, $1, $1\nadd $3, $2, $1'
  it('T10 Q2: EX/MEM -> lw rs, one load-use bubble, EX/MEM -> rt of add $3; 9 cycles', () => {
    const t = tracePipeline(T10_Q2, { forwarding: true })
    expect(t.totals.cycles).toBe(9)
    expect(t.instructions[1].operands[0].forward.path).toBe('EX/MEM -> EX')
    expect(t.instructions[2].delay).toBe(1)
    expect(t.instructions[3].operands.find((o) => o.register === 1)?.forward.path).toBe('EX/MEM -> EX')
  })
  it('T10 Answers p18: add $1,$1,$1 gets MEM/WB -> EX forwarding to BOTH ALU operands (ForwardA and ForwardB)', () => {
    const t = tracePipeline(T10_Q2, { forwarding: true })
    const c = t.instructions[2].stages.EX
    const toAdd = t.frames[c - 1].forwards.filter((f) => f.consumer === 3)
    expect(toAdd.map((f) => f.path)).toEqual(['MEM/WB -> EX', 'MEM/WB -> EX'])
  })
  it('R11 p19-20: double data hazard, the EX/MEM (newer) producer wins', () => {
    const t = tracePipeline('add $1, $1, $2\nadd $1, $1, $3\nadd $1, $1, $4', { forwarding: true })
    const op = t.instructions[2].operands.find((o) => o.register === 1)!
    expect(op.producer).toBe(2)
    expect(op.forward.path).toBe('EX/MEM -> EX')
  })
  it('R11 p15: no forwarding (and no dependency) through $0', () => {
    const t = tracePipeline('add $0, $1, $2\nadd $3, $0, $4', { forwarding: false })
    expect(t.totals.stallCycles).toBe(0)
    expect(t.dependencies.filter((d) => d.kind === 'RAW')).toEqual([])
  })
})

describe('dependency classifier (L21 p13-14, p19-20; R11 p43)', () => {
  const has = (t: ReturnType<typeof tracePipeline>, kind: string, from: string, to: string, reg: number) =>
    t.dependencies.some((d) => d.kind === kind && d.register === reg && t.instructions[d.from - 1].name === from && t.instructions[d.to - 1].name === to)
  it('L21 p19-20: lw ... slt $1 is a WAR on $1 with only the load-use bubble (10 cycles)', () => {
    const t = tracePipeline('lw  $2, 20($1)\nand $4, $2, $5\nor  $8, $2, $6\nadd $9, $4, $2\nslt $1, $6, $7', { forwarding: true })
    expect(t.totals.cycles).toBe(10)
    expect(has(t, 'WAR', 'i1', 'i5', 1)).toBe(true)
    expect(t.dependencies.find((d) => d.kind === 'WAR' && d.register === 1)?.stalls).toBe(0)
  })
  it('R11 Q6: B -> C WAR on $t6, C -> D WAW on $t6', () => {
    const t = tracePipeline(R11_Q6)
    expect(has(t, 'WAR', 'B', 'C', 14)).toBe(true)
    expect(has(t, 'WAW', 'C', 'D', 14)).toBe(true)
    expect(has(t, 'RAW', 'A', 'B', 9)).toBe(false)
  })
  it('AY24/25 Q19: Inst2 -> Inst3 WAR on $s5, Inst3 -> Inst4 WAW on $s5', () => {
    const t = tracePipeline(AY2425_Q19)
    expect(has(t, 'WAR', 'Inst2', 'Inst3', 21)).toBe(true)
    expect(has(t, 'WAW', 'Inst3', 'Inst4', 21)).toBe(true)
  })
})

describe('exam keys, parts not pinned elsewhere', () => {
  it('AY25/26 Q19(e) key: 1 stall after the lw (Inst7), so 1 nop after Inst7', () => {
    const src = AY2526_Q19.replace('sub $s5, $t2, $t1', 'sub $s5, $t2, $s3')
    const t = tracePipeline(src, { forwarding: true })
    expect(t.totals.cycles).toBe(14)
    expect(t.totals.nops).toEqual([{ after: 'Inst7', count: 1 }])
  })
  it('AY24/25 Q19(a) key: "2 stalls ... each 2 cycles": 2 delayed instructions, 4 stall cycles', () => {
    const t = tracePipeline(AY2425_Q19, { forwarding: false })
    expect([t.totals.stallEvents, t.totals.stallCycles]).toEqual([2, 4])
  })
  it('AY23/24 S1 Q12 key D: I6 cannot fill the slot of I7 (bne reads $5), I5 can', () => {
    const c = delaySlotCandidates(buildStream(AY2324S1_Q12, { outcomes: [] }), 6)
    expect(c.find((x) => x.name === 'I5')?.ok).toBe(true)
    expect(c.find((x) => x.name === 'I6')?.ok).toBe(false)
  })
  it('L21 p47: "or $8,$9,$10" can move into the slot after beq $1,$4; add and sub cannot', () => {
    const src = 'or  $8, $9, $10\nadd $1, $2, $3\nsub $4, $5, $6\nbeq $1, $4, Exit\nxor $10, $1, $11\nExit:'
    const c = delaySlotCandidates(buildStream(src, { outcomes: [] }), 3)
    expect(Object.fromEntries(c.map((x) => [x.name, x.ok]))).toEqual({ i1: true, i2: false, i3: false })
  })
})

describe('more course cases', () => {
  it('L21 p19-20 rule: lw then a store whose BASE register is the loaded value costs the load-use bubble', () => {
    const t = tracePipeline('lw $t0, 0($t1)\nsw $t2, 0($t0)', { forwarding: true })
    expect(t.instructions[1].delay).toBe(1)
    expect(t.instructions[1].stalls[0].kind).toBe('load-use')
  })
  it('L21 p48 / AY24/25 Q19(d): a nop can be written in the code (delay slot filler, or instead of stalling)', () => {
    const t = tracePipeline('beq $1, $2, L\nnop\nL: add $3, $4, $5', { branchStage: 'ID', delayedBranch: true }, { outcomes: [true] })
    expect(t.ok, JSON.stringify(t.errors)).toBe(true)
    expect(t.instructions.map((i) => i.name)).toEqual(['i1', 'i2', 'i3'])
    expect(t.totals.stallCycles).toBe(0)
  })
  it('AY15/16 S1 Q5 (worked in the feature spec): stages 2,3,4,5,2 ns, 20 instructions', async () => {
    const { timing } = await import('./index')
    const r = timing({ instructions: 20, stageTimes: [2, 3, 4, 5, 2] })
    expect(r.single?.time).toBe(320)
    expect([r.pipelined?.cycles, r.pipelined?.time]).toEqual([24, 120])
    expect(r.speedup?.value).toBeCloseTo(8 / 3, 6)
  })
})
