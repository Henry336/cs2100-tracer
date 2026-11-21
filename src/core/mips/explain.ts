import { bin, hex, u32 } from './encoding'
import { OP_BY_NAME } from './isa'
import { regName } from './registers'
import type { Explain, Format, Instr } from './types'

export interface EncodingField {
  name: 'opcode' | 'rs' | 'rt' | 'rd' | 'shamt' | 'funct' | 'immediate' | 'target'
  /** [high bit, low bit], e.g. [31, 26]. */
  bits: [number, number]
  /** Field value as used (immediates signed or zero-extended). */
  value: number
  /** The field's bits, width characters long. */
  binary: string
  why: Explain
}

export interface EncodingExplain {
  format: Format
  fields: EncodingField[]
  /** All 32 bits. */
  binary: string
  /** The 32 bits regrouped into 8 nibbles for hex conversion (L08 p12). */
  nibbles: string[]
  /** '0x012A4020'. */
  hex: string
  /** Exam answer format: 8 digits, capitals, no 0x (AY23/24 S2 Q16e). */
  examplify: string
  steps: Explain[]
}

const LAYOUT: Record<Format, [EncodingField['name'], number, number][]> = {
  R: [['opcode', 31, 26], ['rs', 25, 21], ['rt', 20, 16], ['rd', 15, 11], ['shamt', 10, 6], ['funct', 5, 0]],
  I: [['opcode', 31, 26], ['rs', 25, 21], ['rt', 20, 16], ['immediate', 15, 0]],
  J: [['opcode', 31, 26], ['target', 25, 0]],
}

function fieldWhy(i: Instr, name: EncodingField['name']): Explain {
  const op = OP_BY_NAME[i.mnemonic]
  const k = op?.kind
  const r = (n: number) => `${regName(n)} = $${n}`
  const unused = (why: string, cite?: string): Explain => ({ rule: `0: ${why}`, cite })
  switch (name) {
    case 'opcode':
      return i.format === 'R'
        ? { rule: 'Opcode 0 for every R-format instruction; funct picks the operation', cite: 'L08 p10' }
        : { rule: `${i.mnemonic} has opcode ${hex(i.opcode, 2)}, which alone identifies it`, cite: 'L08 p18, green card' }
    case 'funct':
      return { rule: `funct ${hex(i.funct, 2)} selects ${i.mnemonic}`, cite: 'L08 p10, green card' }
    case 'shamt':
      return k === 'shift' ? { rule: 'Shift amount, 0 to 31 (C5)', working: String(i.shamt), cite: 'L08 p13' } : unused('not a shift', 'L08 p10')
    case 'rd':
      return k === 'arith' || k === 'shift'
        ? { rule: 'Destination register: written first in assembly, but third in the bits', working: r(i.rd), cite: 'L08 p12' }
        : unused(`${i.mnemonic} does not use rd`)
    case 'rs':
      if (k === 'shift') return unused('shifts take their source from rt, not rs', 'L08 p13')
      if (k === 'lui') return unused('lui has no source register', 'AY25/26 Q6')
      if (k === 'syscall') return unused('syscall has no register fields')
      if (k === 'jr') return { rule: 'Register holding the jump address', working: r(i.rs), cite: 'L08 p8' }
      if (k === 'load' || k === 'store') return { rule: 'Base register: the address is rs + offset', working: r(i.rs), cite: 'L08 p33' }
      if (k === 'branch') return { rule: 'First register in the assembly goes in rs, not rt', working: r(i.rs), cite: 'L08 p34' }
      return { rule: k === 'arith' ? 'First source register' : 'Source register', working: r(i.rs), cite: k === 'arith' ? 'L08 p10' : 'L08 p18' }
    case 'rt':
      if (k === 'jr' || k === 'syscall') return unused(`${i.mnemonic} does not use rt`)
      if (k === 'shift') return { rule: 'Source register of the shift', working: r(i.rt), cite: 'L08 p13' }
      if (k === 'arith') return { rule: 'Second source register', working: r(i.rt), cite: 'L08 p10' }
      if (k === 'store') return { rule: 'Register whose value is stored', working: r(i.rt), cite: 'L08 p33' }
      if (k === 'branch') return { rule: 'Second register compared', working: r(i.rt), cite: 'L08 p34' }
      return { rule: 'Destination register: rt receives the result in I-format', working: r(i.rt), cite: 'L08 p18' }
    case 'immediate': {
      const raw = hex(i.word & 0xffff, 4)
      if (k === 'logicImm') return { rule: 'Raw 16-bit pattern, zero-extended when used', working: `${raw} = ${i.imm}`, cite: 'L08 p19, L06 p46' }
      if (k === 'lui') return { rule: 'The constant for the upper 16 bits', working: `${raw} = ${i.imm}`, cite: 'L06 p44' }
      if (k === 'branch') return { rule: 'Instructions to skip, counted from PC+4: (target - (PC+4)) / 4, 16-bit 2s complement', working: `${i.imm} = ${raw}`, cite: 'L08 p28' }
      if (k === 'load' || k === 'store') return { rule: 'Byte offset from the base register, 16-bit 2s complement', working: `${i.imm} = ${raw}`, cite: 'L08 p22' }
      if (i.format === 'I') return { rule: 'Constant in 16-bit 2s complement, sign-extended when used', working: `${i.imm} = ${raw}`, cite: 'L08 p19-21' }
      return { rule: 'Bits 15-0 (not an immediate in this format)', working: raw }
    }
    case 'target':
      return { rule: 'Target address bits 27-2: drop the top 4 bits (taken from PC+4) and the last 2 bits (always 00)', working: `${hex(i.targetAddress ?? i.target << 2)} -> ${hex(i.target, 7)}`, cite: 'L08 p37-39' }
  }
}

export function explainEncoding(instr: Instr): EncodingExplain {
  const all = bin(instr.word, 32)
  const fields: EncodingField[] = LAYOUT[instr.format].map(([name, hi, lo]) => {
    const binary = all.slice(31 - hi, 32 - lo)
    const value = name === 'immediate' ? instr.imm : parseInt(binary, 2)
    return { name, bits: [hi, lo], value, binary, why: fieldWhy(instr, name) }
  })
  const nibbles = all.match(/.{4}/g)!
  const h = hex(instr.word)
  const op = OP_BY_NAME[instr.mnemonic]
  const steps: Explain[] = [
    {
      rule: `${instr.mnemonic} is ${instr.format}-format${instr.format === 'R' ? `: opcode 0, funct ${hex(instr.funct, 2)}` : `: opcode ${hex(instr.opcode, 2)}`}`,
      working: 'Opcode 0 means R-format, 2 or 3 means J-format, anything else is I-format',
      cite: op?.source === 'standard MIPS' ? 'standard MIPS value (not on the course card)' : 'L08 p9, green card',
    },
    { rule: 'Fields in decimal', working: fields.map((f) => `${f.name} ${f.value}`).join(' | '), cite: 'L08 p12' },
    { rule: 'Fields in binary', working: fields.map((f) => f.binary).join(' '), cite: 'L08 p12' },
    { rule: 'Read the 32 bits 4 at a time, one hex digit per group', working: `${nibbles.join(' ')} = ${h}`, cite: 'L08 p12' },
  ]
  if (op?.kind === 'branch') {
    steps.push({ rule: 'If taken, target = (PC+4) + immediate x 4', working: `${hex(u32(instr.address + 4))} + ${instr.imm} x 4 = ${hex(instr.targetAddress ?? 0)}`, cite: 'L08 p28' })
  }
  if (op?.kind === 'jump') {
    const top = u32(instr.address + 4) >>> 28
    steps.push({
      rule: 'Target = {PC+4[31:28], target field, 00}',
      working: `${bin(top, 4)} ${bin(instr.target, 26)} 00 = ${hex(instr.targetAddress ?? 0)}`,
      cite: 'L08 p39',
    })
  }
  return { format: instr.format, fields, binary: all, nibbles, hex: h, examplify: h.slice(2), steps }
}

export interface BranchOffsetExplain {
  pc: number
  pcPlus4: number
  target: number
  /** target - (PC+4), signed. */
  byteOffset: number
  aligned: boolean
  /** The immediate field value (instructions from PC+4). */
  imm: number
  inRange: boolean
  /** The 16-bit 2s complement pattern, e.g. '0xFFFC'. */
  imm16: string
  /** Lowest and highest reachable targets from this PC. */
  reach: { min: number; max: number }
  /** Wrong answers the keys warn about. */
  mistakes: { fromPc: number; bytes: number }
  steps: Explain[]
}

export function branchOffsetExplain(pcAddress: number, targetAddress: number): BranchOffsetExplain {
  const pc = u32(pcAddress)
  const target = u32(targetAddress)
  const pcPlus4 = u32(pc + 4)
  const byteOffset = (target - pcPlus4) | 0
  const aligned = byteOffset % 4 === 0
  const imm = aligned ? byteOffset / 4 : Math.trunc(byteOffset / 4)
  const inRange = aligned && imm >= -32768 && imm <= 32767
  const imm16 = hex(imm & 0xffff, 4)
  const steps: Explain[] = [
    { rule: 'The branch counts from PC+4, the instruction after the branch', working: `${hex(pc)} + 4 = ${hex(pcPlus4)}`, cite: 'L08 p28' },
    { rule: 'Byte distance = target - (PC+4)', working: `${hex(target)} - ${hex(pcPlus4)} = ${byteOffset}`, cite: 'L08 p28' },
    aligned
      ? { rule: 'Divide by 4: the immediate counts instructions (words), not bytes', working: `${byteOffset} / 4 = ${imm}`, cite: 'L08 p27' }
      : { rule: 'The distance is not a multiple of 4, so the target is not an instruction address', working: `${byteOffset} / 4 is not a whole number`, cite: 'L08 p23' },
  ]
  // A misaligned target has no immediate, so there is no range to check.
  if (aligned) {
    steps.push({
      rule: inRange ? 'The immediate fits in 16-bit 2s complement' : 'The immediate does not fit in 16 bits: branch with the opposite condition over a j instead',
      working: inRange ? `${imm} = ${imm16}` : `${imm} is outside -32768 to 32767`,
      cite: inRange ? 'L08 p21' : 'L08 p42',
    })
  }
  return {
    pc,
    pcPlus4,
    target,
    byteOffset,
    aligned,
    imm,
    inRange,
    imm16,
    reach: { min: u32(pcPlus4 - 32768 * 4), max: u32(pcPlus4 + 32767 * 4) },
    mistakes: { fromPc: ((target - pc) | 0) / 4, bytes: byteOffset },
    steps,
  }
}

export interface JumpTargetExplain {
  pc: number
  pcPlus4: number
  target: number
  aligned: boolean
  /** The target shares the top 4 bits of PC+4 (same 256 MB block). */
  sameBlock: boolean
  /** PC is in a different 256 MB block from PC+4 (j at the last word of a block). */
  blockEdge: boolean
  block: { start: number; end: number }
  /** 26-bit field: target bits 27..2. */
  field: number
  word: number
  hex: string
  steps: Explain[]
}

export function jumpTargetExplain(pcAddress: number, targetAddress: number, mnemonic: 'j' | 'jal' = 'j'): JumpTargetExplain {
  const pc = u32(pcAddress)
  const target = u32(targetAddress)
  const pcPlus4 = u32(pc + 4)
  const start = u32(pcPlus4 & 0xf0000000)
  const sameBlock = u32(target & 0xf0000000) === start
  const aligned = target % 4 === 0
  const field = (target >>> 2) & 0x3ffffff
  const word = u32(((mnemonic === 'j' ? 2 : 3) << 26) | field)
  const steps: Explain[] = [
    { rule: 'The top 4 bits of the new PC come from PC+4', working: `PC+4 = ${hex(pcPlus4)}, top 4 bits ${bin(pcPlus4 >>> 28, 4)}`, cite: 'L08 p39' },
    sameBlock
      ? { rule: 'The target is in the same 256 MB block, so j can reach it', working: `${hex(start)} to ${hex(start + 0x0ffffffc)}`, cite: 'L08 p40' }
      : { rule: 'The target is outside the 256 MB block of PC+4, so j cannot reach it (use jr)', working: `target top 4 bits ${bin(target >>> 28, 4)}, PC+4 top 4 bits ${bin(pcPlus4 >>> 28, 4)}`, cite: 'L08 p40' },
    aligned
      ? { rule: 'Drop the top 4 bits and the last 2 bits (always 00): keep bits 27-2', working: `${bin(target, 32)} -> ${bin(field, 26)} = ${hex(field, 7)}`, cite: 'L08 p37' }
      : { rule: 'The target is not a multiple of 4, so it is not an instruction address', working: hex(target), cite: 'L08 p37' },
    { rule: `Prepend opcode ${mnemonic === 'j' ? '000010' : '000011'} and read as hex`, working: `${mnemonic === 'j' ? '000010' : '000011'} ${bin(field, 26)} = ${hex(word)}`, cite: 'L08 p41' },
  ]
  if (u32(pc & 0xf0000000) !== start) {
    steps.push({ rule: 'This j is the last word of its block, so PC+4 is already in the next block', working: `${hex(pc)} + 4 = ${hex(pcPlus4)}`, cite: 'L08 p39-40' })
  }
  return {
    pc,
    pcPlus4,
    target,
    aligned,
    sameBlock,
    blockEdge: u32(pc & 0xf0000000) !== start,
    block: { start, end: u32(start + 0x0ffffffc) },
    field,
    word,
    hex: hex(word),
    steps,
  }
}
