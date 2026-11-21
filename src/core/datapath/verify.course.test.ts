// Course-fidelity checks for the datapath engine. Each test cites the course page it re-derives.
import { describe, expect, it } from 'vitest'
import { aluControlGates } from './control'
import { DERIVED_ROWS, SIGNAL_MEANINGS } from './tables'
import { traceDatapath } from './trace'
import type { DatapathInput, DatapathTrace } from './types'

function ok(input: DatapathInput): DatapathTrace {
  const r = traceDatapath(input)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r
}

describe('past-paper keys', () => {
  it('AY21/22 S1 Q4 (key C): lw $20,100($10) does not use RD2 or the data memory Write Data', () => {
    const t = ok({ source: 'lw $20, 100($10)', regs: { 10: 0x1000, 20: 7 } })
    expect(t.ports.RD2.used).toBe(false)
    expect(t.ports.dmWriteData.used).toBe(false)
    expect(t.ports.RD1.used).toBe(true)
    expect(t.ports.WR.used).toBe(true)
    expect(t.ports.WD.used).toBe(true)
  })
  it('AY23/24 S2 Q9 C is false: beq $0,$0,0 goes to PC+4, not an infinite loop', () => {
    const t = ok({ source: 'beq $0, $0, 0', pc: 0x1000 })
    expect(t.control.pcSrc).toBe(1)
    expect(t.ports.nextPc.value).toBe(0x1004)
  })
  it('AY23/24 S2 Q8 B is false: the ALU is used by beq (isZero decides PCSrc)', () => {
    const t = ok({ source: 'beq $1, $2, 3' })
    expect(t.units.find((u) => u.id === 'alu')!.active).toBe(true)
  })
  it('AY25/26 midterm Q14: 0x12c3fbad at 0x5204 branches to 0x40bc (option C)', () => {
    const t = ok({ source: '0x12c3fbad', pc: 0x5204 })
    expect(t.ports.branchTarget.value).toBe(0x40bc)
  })
  it('AY18/19 S2 Q3(e): ALUop 11 with funct of 0x08000031 gives ALUcontrol 0111 from the R06 p20 gates', () => {
    expect(aluControlGates(1, 1, 0x31).code).toBe('0111')
  })
  it('AY25/26 S1 Q18(a) key (Ans p15): bne row X 0 X 0 0 0 beq 0 bne 1 ALUop 01', () => {
    const r = DERIVED_ROWS.find((d) => d.name === 'bne')!.row
    expect([r.RegDst, r.ALUSrc, r.MemToReg, r.RegWrite, r.MemRead, r.MemWrite, r.Branch, r.BranchNE, r.ALUop1, r.ALUop0]).toEqual(['X', 0, 'X', 0, 0, 0, 0, 1, 0, 1])
  })
})

describe('labels and cites', () => {
  // L11 p6 lists addi in the subset the single-cycle datapath implements, and R06 p40-42 (AY25/26 midterm Q28)
  // times addi on the course diagram. Only its control row is missing from L12, so it is not "outside the datapath".
  it('addi runs on the course datapath (L11 p6, R06 p42): notInCourseDatapath is false', () => {
    const t = ok({ source: 'addi $s1, $t1, 12' })
    expect(t.support.notInCourseDatapath).toBe(false)
  })
  it('MemRead meaning is on L12 p13 (p14 is MemWrite)', () => {
    expect(SIGNAL_MEANINGS.MemRead.cite).toBe('L12 p13')
    expect(SIGNAL_MEANINGS.MemWrite.cite).toBe('L12 p14')
  })
})
