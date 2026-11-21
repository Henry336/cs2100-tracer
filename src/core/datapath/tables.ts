/** Control tables of the course datapath, exported as data so the reference page can reuse them. */

import type { Bit, ControlRow, Explain, SignalName, StageId } from './types'

/** Column order of the main control table (L12 p34, R06 p26-27, L20 p27). */
export const SIGNAL_ORDER: SignalName[] = ['RegDst', 'ALUSrc', 'MemToReg', 'RegWrite', 'MemRead', 'MemWrite', 'Branch', 'ALUop1', 'ALUop0']

/** T05 Q1 asks for the signals in this order; kept so the UI can match the tutorial table. */
export const T05_ORDER: (SignalName | 'ALUop' | 'ALUcontrol')[] = ['RegDst', 'RegWrite', 'ALUSrc', 'MemRead', 'MemWrite', 'MemToReg', 'Branch', 'ALUop', 'ALUcontrol']

export interface MainControlEntry {
  name: 'R-type' | 'lw' | 'sw' | 'beq'
  opcode: number
  opcodeBin: string
  row: ControlRow
}

const row = (RegDst: Bit, ALUSrc: Bit, MemToReg: Bit, RegWrite: Bit, MemRead: Bit, MemWrite: Bit, Branch: Bit, ALUop1: Bit, ALUop0: Bit): ControlRow =>
  ({ RegDst, ALUSrc, MemToReg, RegWrite, MemRead, MemWrite, Branch, ALUop1, ALUop0 })

/** L12 p31/p34 (opcodes L12 p32). */
export const MAIN_CONTROL: MainControlEntry[] = [
  { name: 'R-type', opcode: 0x00, opcodeBin: '000000', row: row(1, 0, 0, 1, 0, 0, 0, 1, 0) },
  { name: 'lw', opcode: 0x23, opcodeBin: '100011', row: row(0, 1, 1, 1, 1, 0, 0, 0, 0) },
  { name: 'sw', opcode: 0x2b, opcodeBin: '101011', row: row('X', 1, 'X', 0, 0, 1, 0, 0, 0) },
  { name: 'beq', opcode: 0x04, opcodeBin: '000100', row: row('X', 0, 'X', 0, 0, 0, 1, 0, 1) },
]
export const MAIN_CONTROL_CITE = 'L12 p34'

export interface DerivedRowEntry {
  name: 'addi' | 'bne'
  opcode: number
  row: ControlRow
  /** 'derived': no slide or key gives the row. 'key': a past-paper answer key gives it (not in L12). */
  status: 'derived' | 'key'
  why: Explain
  /** Extra hardware the row needs beyond L12 p30. */
  extraHardware: string[]
}

/** Rows the L12 slides never tabulate. addi: derived (AY15/16 Q9a has no key); bne: AY25/26 S1 Q18(a) key, Ans p15. */
export const DERIVED_ROWS: DerivedRowEntry[] = [
  {
    name: 'addi',
    opcode: 0x08,
    row: row(0, 1, 0, 1, 0, 0, 0, 0, 0),
    status: 'derived',
    why: {
      rule: 'addi writes rt (RegDst 0), adds the sign-extended immediate (ALUSrc 1, ALUop 00 = add) and writes the ALU result (MemToReg 0, RegWrite 1)',
      working: 'Same as lw except MemToReg 0 and MemRead 0',
      cite: 'L11 p25-28, L12 p24 (derived; AY15/16 Q9a)',
    },
    extraHardware: ['an AND term for opcode 001000 in the PLA (the L12 p33 PLA has none, so it would output all 0)'],
  },
  {
    name: 'bne',
    opcode: 0x05,
    row: { ...row('X', 0, 'X', 0, 0, 0, 0, 0, 1), BranchNE: 1 },
    status: 'key',
    why: {
      rule: 'bne subtracts like beq (ALUop 01) but branches when isZero is 0, so it needs its own BranchNE signal',
      working: 'PCSrc = Branch AND isZero OR BranchNE AND NOT isZero',
      cite: 'AY25/26 Ans p15 (AY25/26 S1 Q18 a, b, d)',
    },
    extraHardware: [
      'a new control output BranchNE (0 for R-type, lw, sw and beq)',
      'a NOT gate on isZero, a second AND gate (BranchNE, NOT isZero) and an OR gate into PCSrc',
      'an AND term for opcode 000101 in the PLA',
    ],
  },
]

/** Meaning of each value (L12 p10-17). */
export const SIGNAL_MEANINGS: Record<SignalName | 'BranchNE' | 'PCSrc', { zero: string; one: string; cite: string }> = {
  RegDst: { zero: 'write register = Inst[20:16] (rt)', one: 'write register = Inst[15:11] (rd)', cite: 'L12 p10' },
  RegWrite: { zero: 'no register write', one: 'write WD into register WR', cite: 'L12 p11' },
  ALUSrc: { zero: 'ALU input B = RD2', one: 'ALU input B = SignExt(Inst[15:0])', cite: 'L12 p12' },
  MemRead: { zero: 'memory not read', one: 'read Mem[Address]', cite: 'L12 p13' },
  MemWrite: { zero: 'memory not written', one: 'Mem[Address] = Write Data (RD2)', cite: 'L12 p14' },
  MemToReg: { zero: 'WD = ALU result', one: 'WD = memory Read Data', cite: 'L12 p15' },
  Branch: { zero: 'not a branch', one: 'beq: branch if isZero', cite: 'L12 p16' },
  BranchNE: { zero: 'not bne', one: 'bne: branch if not isZero', cite: 'AY25/26 Ans p15' },
  ALUop1: { zero: 'see ALUop', one: 'see ALUop', cite: 'L12 p24' },
  ALUop0: { zero: 'see ALUop', one: 'see ALUop', cite: 'L12 p24' },
  PCSrc: { zero: 'next PC = PC+4', one: 'next PC = (PC+4) + SignExt(Inst[15:0]) << 2', cite: 'L12 p17' },
}

/** Execution stage of each control signal (L12 p5). */
export const SIGNAL_STAGE: { signal: string; stages: StageId[]; purpose: string }[] = [
  { signal: 'RegDst', stages: ['decode'], purpose: 'select the destination register number' },
  { signal: 'RegWrite', stages: ['decode', 'regwrite'], purpose: 'enable writing of the register file' },
  { signal: 'ALUSrc', stages: ['alu'], purpose: 'select the second ALU operand' },
  { signal: 'ALUcontrol', stages: ['alu'], purpose: 'select the ALU operation' },
  { signal: 'MemRead / MemWrite', stages: ['memory'], purpose: 'enable reading or writing data memory' },
  { signal: 'MemToReg', stages: ['regwrite'], purpose: 'select the result written to the register file' },
  { signal: 'PCSrc', stages: ['memory', 'regwrite'], purpose: 'select the next PC' },
]
export const SIGNAL_STAGE_CITE = 'L12 p5'

/** First-level decode (L12 p24). */
export const ALUOP_TABLE: { instrs: string; aluop: string; action: string }[] = [
  { instrs: 'lw, sw', aluop: '00', action: 'add (address)' },
  { instrs: 'beq', aluop: '01', action: 'subtract (compare)' },
  { instrs: 'R-type', aluop: '10', action: 'given by funct' },
]
export const ALUOP_CITE = 'L12 p24'

export interface AluControlEntry {
  instr: string
  aluop: string
  funct: string
  action: string
  code: string
}

/** Second-level decode (L12 p26). */
export const ALU_CONTROL_TABLE: AluControlEntry[] = [
  { instr: 'lw', aluop: '00', funct: 'xxxxxx', action: 'add', code: '0010' },
  { instr: 'sw', aluop: '00', funct: 'xxxxxx', action: 'add', code: '0010' },
  { instr: 'beq', aluop: '01', funct: 'xxxxxx', action: 'subtract', code: '0110' },
  { instr: 'add', aluop: '10', funct: '100000', action: 'add', code: '0010' },
  { instr: 'sub', aluop: '10', funct: '100010', action: 'subtract', code: '0110' },
  { instr: 'and', aluop: '10', funct: '100100', action: 'AND', code: '0000' },
  { instr: 'or', aluop: '10', funct: '100101', action: 'OR', code: '0001' },
  { instr: 'slt', aluop: '10', funct: '101010', action: 'slt', code: '0111' },
]
export const ALU_CONTROL_CITE = 'L12 p26'

export type AluOp = 'AND' | 'OR' | 'add' | 'subtract' | 'slt' | 'NOR'

/** ALU codes (L11 p34); bits are Ainvert, Binvert, Operation[1:0] (L12 p22). */
export const ALU_CODES: { code: string; op: AluOp; ainvert: 0 | 1; binvert: 0 | 1; operation: string }[] = [
  { code: '0000', op: 'AND', ainvert: 0, binvert: 0, operation: '00' },
  { code: '0001', op: 'OR', ainvert: 0, binvert: 0, operation: '01' },
  { code: '0010', op: 'add', ainvert: 0, binvert: 0, operation: '10' },
  { code: '0110', op: 'subtract', ainvert: 0, binvert: 1, operation: '10' },
  { code: '0111', op: 'slt', ainvert: 0, binvert: 1, operation: '11' },
  { code: '1100', op: 'NOR', ainvert: 1, binvert: 1, operation: '00' },
]
export const ALU_CODES_CITE = 'L11 p34, L12 p22'

/** Gate equations for the ALU control unit (R06 p20; the lecture derives bits 3 and 2 on L12 p27-28). */
export const ALU_CONTROL_GATES: { bit: 3 | 2 | 1 | 0; expr: string }[] = [
  { bit: 3, expr: '0' },
  { bit: 2, expr: "ALUop0 + ALUop1·F1" },
  { bit: 1, expr: "ALUop1' + F2'" },
  { bit: 0, expr: 'ALUop1·(F3 + F0)' },
]
export const ALU_CONTROL_GATES_CITE = 'R06 p20, L12 p28'

export type PlaTerm = 'R-format' | 'lw' | 'sw' | 'beq'

/** AND plane of the PLA (L12 p33): the literal for each opcode bit Op5..Op0 (1 = true, 0 = complemented). */
export const PLA_TERMS: { term: PlaTerm; bits: string; expr: string }[] = [
  { term: 'R-format', bits: '000000', expr: "Op5'·Op4'·Op3'·Op2'·Op1'·Op0'" },
  { term: 'lw', bits: '100011', expr: "Op5·Op4'·Op3'·Op2'·Op1·Op0" },
  { term: 'sw', bits: '101011', expr: "Op5·Op4'·Op3·Op2'·Op1·Op0" },
  { term: 'beq', bits: '000100', expr: "Op5'·Op4'·Op3'·Op2·Op1'·Op0'" },
]

/** OR plane (L12 p33-34). The PLA outputs 0 where the table has X. */
export const PLA_OUTPUTS: { signal: SignalName; terms: PlaTerm[] }[] = [
  { signal: 'RegDst', terms: ['R-format'] },
  { signal: 'ALUSrc', terms: ['lw', 'sw'] },
  { signal: 'MemToReg', terms: ['lw'] },
  { signal: 'RegWrite', terms: ['R-format', 'lw'] },
  { signal: 'MemRead', terms: ['lw'] },
  { signal: 'MemWrite', terms: ['sw'] },
  { signal: 'Branch', terms: ['beq'] },
  { signal: 'ALUop1', terms: ['R-format'] },
  { signal: 'ALUop0', terms: ['beq'] },
]
export const PLA_CITE = 'L12 p33-34'

/** The subset the control unit implements (L12 p9, R06 p5). */
export const COURSE_SUBSET: { mnemonic: string; opcode: number; funct?: number; format: 'R' | 'I' }[] = [
  { mnemonic: 'add', opcode: 0, funct: 0x20, format: 'R' },
  { mnemonic: 'sub', opcode: 0, funct: 0x22, format: 'R' },
  { mnemonic: 'and', opcode: 0, funct: 0x24, format: 'R' },
  { mnemonic: 'or', opcode: 0, funct: 0x25, format: 'R' },
  { mnemonic: 'slt', opcode: 0, funct: 0x2a, format: 'R' },
  { mnemonic: 'lw', opcode: 0x23, format: 'I' },
  { mnemonic: 'sw', opcode: 0x2b, format: 'I' },
  { mnemonic: 'beq', opcode: 0x04, format: 'I' },
]
export const COURSE_SUBSET_CITE = 'L12 p9'

/** Pipeline grouping of the same signals (L20 p27): generated in ID, used in EX, MEM or WB. */
export const PIPELINE_GROUP: Record<SignalName, 'EX' | 'MEM' | 'WB'> = {
  RegDst: 'EX', ALUSrc: 'EX', ALUop1: 'EX', ALUop0: 'EX', MemRead: 'MEM', MemWrite: 'MEM', Branch: 'MEM', MemToReg: 'WB', RegWrite: 'WB',
}
/** Column order of the stage-grouped table (L20 p27). */
export const PIPELINE_ORDER: SignalName[] = ['RegDst', 'ALUSrc', 'ALUop1', 'ALUop0', 'MemRead', 'MemWrite', 'Branch', 'MemToReg', 'RegWrite']
export const PIPELINE_GROUP_CITE = 'L20 p27'

/** Where each signal acts in the single-cycle datapath (L12 p5; Branch and ALUop act through PCSrc and ALUcontrol). */
export const SINGLE_CYCLE_STAGE: Record<SignalName | 'BranchNE', string> = {
  RegDst: 'Decode', RegWrite: 'Decode and RegWrite', ALUSrc: 'ALU', ALUop1: 'ALU (as ALUcontrol)', ALUop0: 'ALU (as ALUcontrol)',
  MemRead: 'Memory', MemWrite: 'Memory', MemToReg: 'RegWrite', Branch: 'Memory and RegWrite (as PCSrc)', BranchNE: 'Memory and RegWrite (as PCSrc)',
}

/**
 * Signals the control table never leaves as X, because a wrong value would change state or the next PC
 * (RegWrite, MemWrite, Branch), or because only one of MemRead and MemWrite may be on (L11 p40). L12 p34.
 */
export const NEVER_X: SignalName[] = ['RegWrite', 'MemRead', 'MemWrite', 'Branch']
