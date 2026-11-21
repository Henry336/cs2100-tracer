import { parseNumber } from './assembler'
import { encode, hex, jumpTarget } from './encoding'
import { explainEncoding } from './explain'
import { OP_BY_NAME } from './isa'
import type { Explain, Instr } from './types'

/** A wrong encoding the keys warn about, built from the right one. */
export interface Mistake {
  label: string
  word: number
  why: Explain
}

export interface FieldCheck {
  name: string
  bits: [number, number]
  expected: string
  given: string
  ok: boolean
}

export interface AnswerCheck {
  error?: string
  given?: number
  ok: boolean
  fields: FieldCheck[]
  /** Set when the given word matches a known wrong answer. */
  mistake?: Mistake
}

/** A 32-bit word as typed: 0x hex, 0b binary, decimal, or 8 bare hex digits as Examplify answers are written (AY23/24 S2 Q16e). */
export function parseWord(text: string): number | undefined {
  const t = text.trim().replace(/_/g, '')
  const v = /^[0-9a-f]{8}$/i.test(t) ? parseInt(t, 16) : parseNumber(t)
  return v !== undefined && Number.isInteger(v) && v >= 0 && v <= 0xffffffff ? v : undefined
}

/** Wrong answers students commonly give for this instruction, each re-encoded so a typed word can be matched. */
export function likelyMistakes(ins: Instr): Mistake[] {
  const k = OP_BY_NAME[ins.mnemonic]?.kind
  const out: Mistake[] = []
  const add = (label: string, change: Partial<Instr>, why: Explain) => {
    const word = encode({ ...ins, ...change })
    if (word !== ins.word && !out.some((m) => m.word === word)) out.push({ label, word, why })
  }
  if (k === 'arith') {
    add('fields in assembly order', { rs: ins.rd, rt: ins.rs, rd: ins.rt }, { rule: 'The registers were written in assembly order rd, rs, rt. The bits go rs, rt, rd', cite: 'L08 p12' })
    add('rs and rt swapped', { rs: ins.rt, rt: ins.rs }, { rule: 'The first source register goes in rs, the second in rt', cite: 'L08 p10' })
  }
  if (k === 'shift') {
    add('source in rs', { rs: ins.rt, rt: 0 }, { rule: 'A shift takes its source from rt and leaves rs at 0', cite: 'L08 p13' })
  }
  if (k === 'arithImm' || k === 'logicImm' || k === 'load' || k === 'store') {
    add('rs and rt swapped', { rs: ins.rt, rt: ins.rs }, {
      rule: k === 'store' ? 'rt holds the value stored and rs is the base register' : k === 'load' ? 'rt is the destination and rs is the base register' : 'rt is the destination and rs is the source',
      cite: k === 'load' || k === 'store' ? 'L08 p33' : 'L08 p18',
    })
  }
  if (k === 'branch') {
    add('rs and rt swapped', { rs: ins.rt, rt: ins.rs }, { rule: 'In beq and bne the first register goes in rs', cite: 'L08 p34' })
    add('counted from the branch', { imm: ins.imm + 1 }, { rule: 'The immediate counts from PC+4, not from the branch itself', working: `${ins.imm} + 1 = ${ins.imm + 1}`, cite: 'L08 p28' })
    if (Math.abs(ins.imm * 4) <= 32767) add('bytes, not words', { imm: ins.imm * 4 }, { rule: 'The immediate counts instructions, so divide the byte distance by 4', working: `${ins.imm * 4} / 4 = ${ins.imm}`, cite: 'L08 p27' })
  }
  if (k === 'jump') {
    const target = jumpTarget(ins.address, ins.target)
    add('low 2 bits kept', { target: target & 0x3ffffff }, { rule: 'The field holds address bits 27 to 2: drop the last two 0 bits (shift right by 2)', working: `${hex(target)} >> 2 = ${hex(ins.target, 7)}`, cite: 'L08 p37' })
  }
  return out
}

/** Compare a typed word with the right encoding, field by field. */
export function checkAnswer(ins: Instr, text: string): AnswerCheck {
  if (text.trim() === '') return { ok: false, fields: [] }
  const given = parseWord(text)
  if (given === undefined) return { ok: false, fields: [], error: `${text.trim()} is not a 32-bit word. Type 8 hex digits, e.g. 012A4020` }
  const fields = explainEncoding(ins).fields.map(({ name, bits: [hi, lo] }) => {
    const w = hi - lo + 1
    const slice = (x: number) => ((x >>> lo) & (2 ** w - 1)).toString(2).padStart(w, '0')
    const expected = slice(ins.word)
    const g = slice(given)
    return { name, bits: [hi, lo] as [number, number], expected, given: g, ok: expected === g }
  })
  return { given, ok: given === ins.word, fields, mistake: likelyMistakes(ins).find((m) => m.word === given) }
}
