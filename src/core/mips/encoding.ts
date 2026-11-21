import { OP_BY_NAME, lookupWord, zeroExtends, type Kind } from './isa'
import { regName } from './registers'
import type { Endian, Instr } from './types'

export const u32 = (n: number) => n >>> 0
export const signExt16 = (v: number) => ((v & 0xffff) << 16) >> 16

/** '0x012A4020' style, uppercase. */
export function hex(n: number, digits = 8): string {
  return `0x${(n >>> 0).toString(16).toUpperCase().padStart(digits, '0')}`
}

export function bin(n: number, width: number): string {
  return (width >= 32 ? n >>> 0 : (n >>> 0) & (2 ** width - 1)).toString(2).padStart(width, '0')
}

/** The bytes of a value in address order: MSB first when big-endian, LSB first when little-endian (L10 p17). */
export function toBytes(value: number, size: 1 | 2 | 4, endian: Endian = 'big'): number[] {
  const b = Array.from({ length: size }, (_, k) => (value >>> (8 * (size - 1 - k))) & 255)
  return endian === 'little' ? b.reverse() : b
}

export function encode(i: Omit<Instr, 'word'>): number {
  const op = (i.opcode & 63) << 26
  if (i.format === 'R') return u32(op | ((i.rs & 31) << 21) | ((i.rt & 31) << 16) | ((i.rd & 31) << 11) | ((i.shamt & 31) << 6) | (i.funct & 63))
  if (i.format === 'I') return u32(op | ((i.rs & 31) << 21) | ((i.rt & 31) << 16) | (i.imm & 0xffff))
  return u32(op | (i.target & 0x3ffffff))
}

/** Branch: (PC+4) + imm*4 (L08 p28). Jump: {PC+4[31:28], target, 00} (L08 p37-39). */
export function branchTarget(pc: number, imm: number): number {
  return u32(pc + 4 + imm * 4)
}
export function jumpTarget(pc: number, field: number): number {
  return u32((u32(pc + 4) & 0xf0000000) | ((field & 0x3ffffff) << 2))
}

// Fields the course fixes at 0: [name, low bit, mask, cite]. A word with them set is not the encoding of any course text.
const ZERO_FIELDS: Partial<Record<Kind, [string, number, number, string][]>> = {
  arith: [['shamt', 6, 31, 'L08 p15']],
  shift: [['rs', 21, 31, 'L08 p15']],
  lui: [['rs', 21, 31, 'AY25/26 Q6']],
  jr: [['rt', 16, 31, 'green card'], ['rd', 11, 31, 'green card'], ['shamt', 6, 31, 'green card']],
  syscall: [['bits 25-6', 6, 0xfffff, 'green card']],
}

export function decode(word: number, address = 0): Instr | { error: string } {
  if (!Number.isInteger(word) || word < -(2 ** 31) || word > 0xffffffff) {
    return {
      error: Number.isInteger(word) && word > 0
        ? `0x${word.toString(16).toUpperCase()} is longer than 32 bits; an instruction word is exactly 32 bits (L08 p23)`
        : `${word} is not a 32-bit instruction word (L08 p23)`,
    }
  }
  const w = u32(word)
  const opcode = w >>> 26
  const funct = w & 63
  const op = lookupWord(opcode, funct)
  if (!op) {
    return {
      error: opcode === 0
        ? `funct ${hex(funct, 2)} with opcode 0 is not in the course instruction set`
        : `opcode ${hex(opcode, 2)} is not in the course instruction set`,
    }
  }
  for (const [name, lo, mask, cite] of ZERO_FIELDS[op.kind] ?? []) {
    const v = (w >>> lo) & mask
    if (v) return { error: `${name} is ${v}, but ${op.mnemonic} always has ${name} 0, so this word is not a valid ${op.mnemonic} (${cite})` }
  }
  const raw = w & 0xffff
  const instr: Instr = {
    address: u32(address),
    line: 0,
    text: '',
    mnemonic: op.mnemonic,
    format: op.format,
    opcode,
    rs: (w >>> 21) & 31,
    rt: (w >>> 16) & 31,
    rd: (w >>> 11) & 31,
    shamt: (w >>> 6) & 31,
    funct,
    imm: zeroExtends(op.kind) ? raw : signExt16(raw),
    target: w & 0x3ffffff,
    word: w,
  }
  if (op.kind === 'branch') instr.targetAddress = branchTarget(address, instr.imm)
  if (op.kind === 'jump') instr.targetAddress = jumpTarget(address, instr.target)
  instr.text = instrText(instr)
  return instr
}

/** Assembly text for an instruction. 'name' style uses $t0, 'number' style uses $8. */
export function instrText(i: Instr, style: 'name' | 'number' = 'name'): string {
  const op = OP_BY_NAME[i.mnemonic]
  const r = (n: number) => (style === 'name' ? regName(n) : `$${n}`)
  const m = i.mnemonic
  switch (op?.kind) {
    case 'arith': return `${m} ${r(i.rd)}, ${r(i.rs)}, ${r(i.rt)}`
    case 'shift': return `${m} ${r(i.rd)}, ${r(i.rt)}, ${i.shamt}`
    case 'jr': return `jr ${r(i.rs)}`
    case 'syscall': return 'syscall'
    case 'arithImm': return `${m} ${r(i.rt)}, ${r(i.rs)}, ${i.imm}`
    case 'logicImm': return `${m} ${r(i.rt)}, ${r(i.rs)}, ${hex(i.imm, 4)}`
    case 'lui': return `lui ${r(i.rt)}, ${hex(i.imm, 4)}`
    case 'load':
    case 'store': return `${m} ${r(i.rt)}, ${i.imm}(${r(i.rs)})`
    case 'branch': return `${m} ${r(i.rs)}, ${r(i.rt)}, ${i.targetLabel ?? i.imm}`
    case 'jump': return `${m} ${i.targetLabel ?? hex(i.targetAddress ?? jumpTarget(i.address, i.target))}`
    default: return m
  }
}
