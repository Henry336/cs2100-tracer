import type { Format } from './types'

/** How the operands and fields of an instruction are laid out. */
export type Kind =
  | 'arith' // op rd, rs, rt
  | 'shift' // op rd, rt, shamt
  | 'jr' // jr rs
  | 'syscall'
  | 'arithImm' // op rt, rs, C16_2s (sign-extended)
  | 'logicImm' // op rt, rs, C16 (zero-extended)
  | 'lui' // lui rt, C16
  | 'load' // op rt, C16_2s(rs)
  | 'store'
  | 'branch' // op rs, rt, label
  | 'jump' // op label

export interface OpInfo {
  mnemonic: string
  format: Format
  opcode: number
  funct?: number
  kind: Kind
  /** Where the course teaches it. */
  cite: string
  /** Where the opcode/funct value comes from. */
  source: 'green card' | 'standard MIPS'
  /** false for instructions the lectures do not teach (lab-only or extra). */
  lecture: boolean
}

const R = (mnemonic: string, funct: number, kind: Kind, cite: string, source: OpInfo['source'] = 'green card', lecture = true): OpInfo => ({
  mnemonic, format: 'R', opcode: 0, funct, kind, cite, source, lecture,
})
const I = (mnemonic: string, opcode: number, kind: Kind, cite: string, source: OpInfo['source'] = 'green card', lecture = true): OpInfo => ({
  mnemonic, format: 'I', opcode, kind, cite, source, lecture,
})

// Opcode/funct values: green card (L08 p47-50); xor, xori, lb are standard MIPS values not on the course card.
// addu, addiu, sltu, lbu, lhu, sh are on the card but not covered in lectures (T02 p1), so lecture is false.
export const OPS: OpInfo[] = [
  R('add', 0x20, 'arith', 'L06 p27'),
  R('addu', 0x21, 'arith', 'T02 p1', 'green card', false),
  R('sub', 0x22, 'arith', 'L06 p29'),
  R('and', 0x24, 'arith', 'L06 p40'),
  R('or', 0x25, 'arith', 'L06 p41'),
  R('xor', 0x26, 'arith', 'L06 p43', 'standard MIPS'),
  R('nor', 0x27, 'arith', 'L06 p42'),
  R('slt', 0x2a, 'arith', 'L07 p28'),
  R('sltu', 0x2b, 'arith', 'T02 p1', 'green card', false),
  R('sll', 0x00, 'shift', 'L06 p37'),
  R('srl', 0x02, 'shift', 'L06 p38'),
  R('jr', 0x08, 'jr', 'L08 p8'),
  R('syscall', 0x0c, 'syscall', 'Lab 4 p1', 'green card', false),
  I('addi', 0x08, 'arithImm', 'L06 p33'),
  I('addiu', 0x09, 'arithImm', 'T02 p1', 'green card', false),
  I('slti', 0x0a, 'arithImm', 'L07 p28'),
  I('andi', 0x0c, 'logicImm', 'L06 p41'),
  I('ori', 0x0d, 'logicImm', 'L06 p41'),
  I('xori', 0x0e, 'logicImm', 'L06 p43', 'standard MIPS'),
  I('lui', 0x0f, 'lui', 'L06 p44'),
  I('lw', 0x23, 'load', 'L07 p8'),
  I('sw', 0x2b, 'store', 'L07 p8'),
  I('lb', 0x20, 'load', 'L07 p11', 'standard MIPS'),
  I('lbu', 0x24, 'load', 'green card', 'green card', false),
  I('sb', 0x28, 'store', 'L07 p11'),
  // L07 p12 names lh and sh; T02 p1 says they are not covered. lhu and sh are on the card, lh is standard MIPS.
  I('lh', 0x21, 'load', 'L07 p12', 'standard MIPS', false),
  I('lhu', 0x25, 'load', 'green card', 'green card', false),
  I('sh', 0x29, 'store', 'L07 p12', 'green card', false),
  I('beq', 0x04, 'branch', 'L07 p18'),
  I('bne', 0x05, 'branch', 'L07 p18'),
  { mnemonic: 'j', format: 'J', opcode: 0x02, kind: 'jump', cite: 'L08 p37', source: 'green card', lecture: true },
  { mnemonic: 'jal', format: 'J', opcode: 0x03, kind: 'jump', cite: 'L08 p8', source: 'green card', lecture: false },
]

/** Lookup table with no prototype, so user text like "constructor" is not found by accident. */
export function dict<T>(entries: Record<string, T> = {}): Record<string, T> {
  return Object.assign(Object.create(null) as Record<string, T>, entries)
}

export const OP_BY_NAME: Record<string, OpInfo> = dict(Object.fromEntries(OPS.map((o) => [o.mnemonic, o])))

export function lookupWord(opcode: number, funct: number): OpInfo | undefined {
  return OPS.find((o) => o.opcode === opcode && (opcode !== 0 || o.funct === funct))
}

/** andi/ori/xori zero-extend (L08 p19, L06 p46); lui uses the raw 16 bits as the upper half. */
export function zeroExtends(kind: Kind): boolean {
  return kind === 'logicImm' || kind === 'lui'
}
