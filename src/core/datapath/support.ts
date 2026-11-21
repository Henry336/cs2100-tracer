/** Which instructions the course datapath runs, and what is missing for the rest (L11 p6, p47; L12 p9). */

import { COURSE_SUBSET } from './tables'
import type { Explain, SupportInfo } from './types'

const L11P6: Explain = {
  rule: 'L11 lists add, sub, and, or, addi, andi, ori, slt, lw, sw, beq, bne for the single-cycle design, but the L12 control unit only implements add, sub, and, or, slt, lw, sw and beq',
  cite: 'L11 p6, L12 p9',
}

const UNSUPPORTED: Record<string, { missing: string[]; note: Explain }> = {
  andi: {
    missing: ['a zero-extend unit: this datapath always sign-extends Inst[15:0]', 'an ALUop value that asks for AND with an immediate (00 only gives add)'],
    note: { rule: 'andi is not supported because the design always sign-extends the immediate', cite: 'L11 p6' },
  },
  ori: {
    missing: ['a zero-extend unit: this datapath always sign-extends Inst[15:0]', 'an ALUop value that asks for OR with an immediate (00 only gives add)'],
    note: { rule: 'ori is not supported because the design always sign-extends the immediate', cite: 'L11 p6' },
  },
  xori: {
    missing: ['a zero-extend unit', 'an XOR operation in the ALU (L11 p34 has none)'],
    note: { rule: 'xori is not part of the course datapath', cite: 'L11 p6, L11 p34' },
  },
  sll: {
    missing: ['a shifter: the ALU has no shift operation (L11 p34)', 'a wire from shamt Inst[10:6]: the field is unused in the datapath'],
    note: { rule: 'Shifts are not supported; the slide suggests doing a shift by multiplication, which is an add in a loop', cite: 'L11 p6, p47' },
  },
  srl: {
    missing: ['a shifter: the ALU has no shift operation (L11 p34)', 'a wire from shamt Inst[10:6]: the field is unused in the datapath'],
    note: { rule: 'Shifts are not supported; the slide suggests doing a shift by multiplication, which is an add in a loop', cite: 'L11 p6, p47' },
  },
  j: {
    missing: ['a path that builds {PC+4[31:28], Inst[25:0], 00}: Inst[25:0] is not wired anywhere', 'a jump mux on the next-PC path and a Jump control signal'],
    note: { rule: 'j is not supported; beq $zero, $zero, label does the same job if you ignore the 256 MB block limit', cite: 'L11 p6, p47' },
  },
  jal: {
    missing: ['the jump path that j also lacks', 'a way to write PC+4 into $ra (no wire from PC+4 to WD, no way to force WR = 31)'],
    note: { rule: 'jal is not part of the course datapath (procedures are out of scope)', cite: 'L11 p47, L07 p39' },
  },
  jr: {
    missing: ['a wire from RD1 to the next-PC mux'],
    note: { rule: 'jr is not part of the course datapath', cite: 'L11 p47, L08 p38' },
  },
  lui: {
    missing: ['a unit that places Inst[15:0] in the upper half (imm << 16): the datapath only sign-extends'],
    note: { rule: 'lui is not part of the course datapath', cite: 'L11 p6' },
  },
  slti: {
    missing: ['an ALUop value that asks for slt with an immediate (00 gives add, 01 subtract, 10 defers to funct, which an I-format has none of)'],
    note: { rule: 'slti is not part of the course datapath; the ALU can do slt, but control cannot ask for it on an I-format', cite: 'L11 p6, L12 p24' },
  },
  nor: {
    missing: ['an ALU control output 1100: ALUcontrol3 is always 0, so NOR can never be selected'],
    note: { rule: 'The ALU has NOR (1100), but the ALU control unit never outputs it', cite: 'L11 p34, R06 p20' },
  },
  xor: {
    missing: ['an XOR operation in the ALU (L11 p34 has none)'],
    note: { rule: 'xor is not part of the course datapath', cite: 'L11 p34' },
  },
  syscall: {
    missing: ['any system-call hardware'],
    note: { rule: 'syscall is a simulator service, not part of the course datapath', cite: 'L11 p6' },
  },
}

// Register fields each refused instruction reads and writes in the ISA (L08 p13 sll puts its source in rt, rs = 0).
// RR1 is wired to rs for every word, but these instructions ignore it (AY23/24 S2 Ans p5 Q10).
const FIELD_USE: Record<string, { reads: ('rs' | 'rt')[]; writes: 'rs' | 'rt' | 'rd' | '$31' | null }> = {
  sll: { reads: ['rt'], writes: 'rd' }, srl: { reads: ['rt'], writes: 'rd' },
  lui: { reads: [], writes: 'rt' },
  andi: { reads: ['rs'], writes: 'rt' }, ori: { reads: ['rs'], writes: 'rt' }, xori: { reads: ['rs'], writes: 'rt' }, slti: { reads: ['rs'], writes: 'rt' }, addiu: { reads: ['rs'], writes: 'rt' },
  lb: { reads: ['rs'], writes: 'rt' }, lbu: { reads: ['rs'], writes: 'rt' }, lh: { reads: ['rs'], writes: 'rt' }, lhu: { reads: ['rs'], writes: 'rt' },
  sb: { reads: ['rs', 'rt'], writes: null }, sh: { reads: ['rs', 'rt'], writes: null },
  addu: { reads: ['rs', 'rt'], writes: 'rd' }, sltu: { reads: ['rs', 'rt'], writes: 'rd' }, nor: { reads: ['rs', 'rt'], writes: 'rd' }, xor: { reads: ['rs', 'rt'], writes: 'rd' },
  j: { reads: [], writes: null }, jal: { reads: [], writes: '$31' }, jr: { reads: ['rs'], writes: null },
}

function fieldUseOf(mnemonic: string): SupportInfo['fieldUse'] {
  const f = FIELD_USE[mnemonic]
  if (!f) return undefined
  const read = f.reads.length ? `reads ${f.reads.join(' and ')}` : 'reads no register'
  const unused = (['rs', 'rt'] as const).filter((r) => !f.reads.includes(r) && f.writes !== r)
  return {
    ...f,
    why: {
      rule: `${mnemonic} ${read}${f.writes ? ` and writes ${f.writes}` : ''}${unused.length ? `; the ${unused.join(' and ')} field is not used` : ''}`,
      cite: 'L08 p13, AY23/24 S2 Ans p5 Q10',
    },
  }
}

const BYTE_HALF = new Set(['lb', 'lbu', 'sb', 'lh', 'lhu', 'sh'])
const UNSIGNED = new Set(['addu', 'addiu', 'sltu'])

export function supportOf(mnemonic: string): SupportInfo {
  if (COURSE_SUBSET.some((c) => c.mnemonic === mnemonic)) return { level: 'course', notInCourseDatapath: false, notes: [], missing: [] }
  if (mnemonic === 'addi') {
    return {
      level: 'derived',
      // L11 p6 lists addi in the subset and R06 p40-42 times it on the course diagram; only the L12 control row is missing.
      notInCourseDatapath: false,
      notes: [L11P6, { rule: 'addi uses the existing datapath with a derived control row (RegDst 0, ALUSrc 1, MemToReg 0, RegWrite 1, ALUop 00); the L12 PLA has no term for opcode 001000', cite: 'L11 p25-28, L12 p33 (derived)' }],
      missing: [],
    }
  }
  if (mnemonic === 'bne') {
    return {
      level: 'derived',
      // L11 p6 lists bne, but the L11 p48 hardware has no BranchNE signal or NOT/AND/OR gates for it (AY25/26 Ans p15 adds them).
      notInCourseDatapath: true,
      notes: [L11P6, { rule: 'bne needs an extra BranchNE signal and gates so that PCSrc = Branch·isZero + BranchNE·isZero\'; the rest is the beq path', cite: 'L11 p36, AY25/26 Ans p15 (Q18 a-d)' }],
      missing: [],
    }
  }
  const r = unsupportedOf(mnemonic)
  const fieldUse = fieldUseOf(mnemonic)
  return fieldUse ? { ...r, fieldUse } : r
}

function unsupportedOf(mnemonic: string): SupportInfo {
  const u = UNSUPPORTED[mnemonic]
  if (u) return { level: 'unsupported', notInCourseDatapath: true, notes: [L11P6, u.note], missing: u.missing }
  if (BYTE_HALF.has(mnemonic)) {
    return {
      level: 'unsupported',
      notInCourseDatapath: true,
      notes: [L11P6, { rule: `${mnemonic} moves a byte or halfword; the course data memory reads and writes whole words only`, cite: 'L11 p40' }],
      missing: ['byte or halfword select and extend logic on the data memory'],
    }
  }
  if (UNSIGNED.has(mnemonic)) {
    return {
      level: 'unsupported',
      notInCourseDatapath: true,
      notes: [L11P6, { rule: `${mnemonic} is not in the course instruction subset`, cite: 'L12 p9' }],
      missing: ['a control row or ALU control row for this opcode or funct'],
    }
  }
  return { level: 'unsupported', notInCourseDatapath: true, notes: [L11P6], missing: ['a control row for this instruction'] }
}
