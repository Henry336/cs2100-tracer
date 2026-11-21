import { describe, expect, it } from 'vitest'
import { aluCompute, aluControlGates, aluControlTable, aluRaw, gradeControlRow, mainControl, plaEval } from './control'
import { ALU_CODES, ALU_CONTROL_TABLE, MAIN_CONTROL, SIGNAL_ORDER } from './tables'

describe('PLA (L12 p33-34), official', () => {
  const cases: [string, number, string][] = [
    // RegDst ALUSrc MemToReg RegWrite MemRead MemWrite Branch ALUop1 ALUop0; the PLA outputs 0 where the table has X
    ['R-format', 0x00, '100100010'],
    ['lw', 0x23, '011110000'],
    ['sw', 0x2b, '010001000'],
    ['beq', 0x04, '000000101'],
  ]
  for (const [term, opcode, bits] of cases) {
    it(`${term} opcode fires only its term`, () => {
      const r = plaEval(opcode)
      expect(r.fired).toBe(term)
      expect(r.terms.filter((t) => t.value).map((t) => t.term)).toEqual([term])
      expect(SIGNAL_ORDER.map((s) => r.outputs[s]).join('')).toBe(bits)
    })
  }

  it('matches every non-X entry of the main control table', () => {
    for (const m of MAIN_CONTROL) {
      const r = plaEval(m.opcode)
      for (const s of SIGNAL_ORDER) if (m.row[s] !== 'X') expect(r.outputs[s], `${m.name} ${s}`).toBe(m.row[s])
    }
  })

  it('addi opcode 001000 fires no term, so every output is 0 (derived)', () => {
    const r = plaEval(0x08)
    expect(r.fired).toBeNull()
    expect(Object.values(r.outputs).every((v) => v === 0)).toBe(true)
  })
})

describe('main control rows', () => {
  it('table rows and derived rows', () => {
    expect(mainControl(0x2b, 'sw')!.row).toMatchObject({ RegDst: 'X', MemToReg: 'X', RegWrite: 0, MemRead: 0, MemWrite: 1 })
    expect(mainControl(0x08, 'addi')!.kind).toBe('derived')
    expect(mainControl(0x05, 'bne')!.row.BranchNE).toBe(1)
    expect(mainControl(0x0c, 'andi')).toBeNull()
  })
})

describe('ALU control gates vs the L12 p26 table, official (R06 p20)', () => {
  for (const e of ALU_CONTROL_TABLE) {
    it(`${e.instr}: ALUop ${e.aluop} funct ${e.funct} -> ${e.code}`, () => {
      const op1 = Number(e.aluop[0]) as 0 | 1
      const op0 = Number(e.aluop[1]) as 0 | 1
      const functs = e.funct === 'xxxxxx' ? Array.from({ length: 64 }, (_, i) => i) : [parseInt(e.funct, 2)]
      for (const f of functs) {
        expect(aluControlGates(op1, op0, f).code).toBe(e.code)
        expect(aluControlTable(e.aluop, f)).toBe(e.code)
      }
    })
  }

  it('R06 example: ALUop 10, funct 100100 (and) gives 0000 with working', () => {
    const g = aluControlGates(1, 0, 0b100100)
    expect(g.code).toBe('0000')
    expect(g.bits.map((b) => b.working)).toEqual(['0', '0 + 1·0 = 0', '0 + 0 = 0', '1·(0 + 0) = 0'])
  })

  it('F5 and F4 are ignored (L12 p27)', () => {
    expect(aluControlGates(1, 0, 0b010010).code).toBe(aluControlGates(1, 0, 0b100010).code)
  })

  it('nor (funct 100111) cannot be produced: the gates give 0101, not 1100 (derived)', () => {
    expect(aluControlGates(1, 0, 0b100111).code).toBe('0101')
    expect(aluControlTable('10', 0b100111)).toBeNull()
  })
})

describe('ALU (L11 p34)', () => {
  it('computes each code', () => {
    expect(aluCompute('0010', 0x200, 0x300)!.result).toBe(0x500)
    expect(aluCompute('0110', 5, 5)).toMatchObject({ result: 0, isZero: 1 })
    expect(aluCompute('0110', 0, 1)!.result).toBe(0xffffffff)
    expect(aluCompute('0111', 0xffffffff, 0)!.result).toBe(1) // -1 < 0, signed
    expect(aluCompute('0000', 0b1100, 0b1010)!.result).toBe(0b1000)
    expect(aluCompute('0001', 0b1100, 0b1010)!.result).toBe(0b1110)
    expect(aluCompute('1100', 0, 0)!.result).toBe(0xffffffff)
    expect(aluCompute('0101', 0, 0)).toBeNull()
  })
})

describe('raw ALU from Ainvert, Binvert, Operation (L12 p21-22)', () => {
  it('every named code matches aluCompute', () => {
    for (const c of ALU_CODES) {
      const r = aluRaw(c.ainvert, c.binvert, c.operation as '00', 0x1234, 0x00ff)
      expect(r.result, c.code).toBe(aluCompute(c.code, 0x1234, 0x00ff)!.result)
      expect(r.named).toBe(true)
    }
  })
  it('NAND = 1101 needs no new hardware (AY21/22 S2 Q4, derived)', () => {
    const r = aluRaw(1, 1, '01', 0b1100, 0b1010)
    expect(r.result).toBe(~(0b1100 & 0b1010) >>> 0)
    expect(r.name).toContain('NAND')
    expect(r.named).toBe(false)
  })
  it('subtract is A + B\' + 1, and isZero follows the result', () => {
    expect(aluRaw(0, 1, '10', 5, 5)).toMatchObject({ result: 0, isZero: 1 })
    expect(aluRaw(0, 1, '10', 0, 1).result).toBe(0xffffffff)
  })
  it('Operation 11 outside slt is left undefined', () => {
    expect(aluRaw(1, 0, '11', 1, 2)).toMatchObject({ result: null, isZero: null })
  })
})

describe('control row quiz marking (T05 Q1, L12 p34)', () => {
  const beq = MAIN_CONTROL.find((m) => m.name === 'beq')!.row
  it('accepts 0 or 1 where the table has X, rejects X where state changes', () => {
    const cells = gradeControlRow(beq, '0110', { RegDst: 0, ALUSrc: 0, MemToReg: 'X', RegWrite: 'X', MemRead: 0, MemWrite: 0, Branch: 1, ALUop1: 0, ALUop0: 1 }, '0110')
    const v = Object.fromEntries(cells.map((c) => [c.signal, c.verdict]))
    expect(v).toMatchObject({ RegDst: 'accepted', MemToReg: 'right', RegWrite: 'wrong', Branch: 'right', ALUcontrol: 'right' })
    expect(cells.find((c) => c.signal === 'RegWrite')!.why.rule).toContain('never be X')
  })
  it('blank cells and a wrong ALUcontrol are marked', () => {
    const cells = gradeControlRow(beq, '0110', {}, '0010')
    expect(cells.filter((c) => c.verdict === 'blank')).toHaveLength(9)
    expect(cells.at(-1)).toMatchObject({ verdict: 'wrong' })
  })
})
