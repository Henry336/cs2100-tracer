/** Main control (PLA), ALU control (table and gates) and the ALU itself. */

import { bin } from '../mips'
import { ALU_CODES, ALU_CONTROL_TABLE, DERIVED_ROWS, MAIN_CONTROL, NEVER_X, PLA_OUTPUTS, PLA_TERMS, SIGNAL_MEANINGS, SIGNAL_ORDER, type AluOp, type PlaTerm } from './tables'
import type { Bit, ControlRow, Explain, SignalName } from './types'

export interface PlaResult {
  opcodeBin: string
  terms: { term: PlaTerm; expr: string; value: 0 | 1; working: string }[]
  fired: PlaTerm | null
  outputs: Record<SignalName, 0 | 1>
  why: Explain
}

/** Evaluate the L12 p33 PLA on a 6-bit opcode. An opcode with no AND term gives all outputs 0. */
export function plaEval(opcode: number): PlaResult {
  const opcodeBin = bin(opcode & 63, 6)
  const terms = PLA_TERMS.map((t) => {
    const lits = [...t.bits].map((want, k) => {
      const have = opcodeBin[k]
      return { name: `Op${5 - k}${want === '0' ? "'" : ''}`, value: want === have ? 1 : 0 }
    })
    const value: 0 | 1 = lits.every((l) => l.value) ? 1 : 0
    return { term: t.term, expr: t.expr, value, working: `${lits.map((l) => `${l.name}=${l.value}`).join('·')} = ${value}` }
  })
  const on = (term: PlaTerm) => terms.find((t) => t.term === term)!.value
  const outputs = Object.fromEntries(PLA_OUTPUTS.map((o) => [o.signal, o.terms.some((t) => on(t)) ? 1 : 0])) as Record<SignalName, 0 | 1>
  const fired = terms.find((t) => t.value)?.term ?? null
  return {
    opcodeBin,
    terms,
    fired,
    outputs,
    why: fired
      ? { rule: `Opcode ${opcodeBin} matches the ${fired} AND term; each output ORs the terms it is connected to`, cite: 'L12 p33-34' }
      : { rule: `Opcode ${opcodeBin} matches none of the four AND terms, so every PLA output is 0`, cite: 'L12 p33-34' },
  }
}

export interface MainControlResult {
  row: ControlRow
  /** 'table' for the L12 p34 rows, 'derived' for rows outside L12 (addi, and bne from the AY25/26 key). */
  kind: 'table' | 'derived'
  name: string
  why: Explain
}

/** Control row for an instruction, or null when neither the course table nor a derived row covers it. */
export function mainControl(opcode: number, mnemonic: string): MainControlResult | null {
  const t = MAIN_CONTROL.find((m) => m.opcode === opcode)
  if (t) return { row: t.row, kind: 'table', name: t.name, why: { rule: `Opcode ${t.opcodeBin} selects the ${t.name} row of the main control table`, cite: 'L12 p34' } }
  const d = DERIVED_ROWS.find((r) => r.name === mnemonic && r.opcode === opcode)
  if (d) return { row: d.row, kind: 'derived', name: d.name, why: { ...d.why, rule: `${d.status === 'key' ? 'Row from a past-paper answer key (not in L12)' : 'Derived row (no slide gives it)'}: ${d.why.rule}` } }
  return null
}

export const aluopString = (r: ControlRow) => `${r.ALUop1}${r.ALUop0}`

/** ALU control from the L12 p26 table, or null when no row matches. */
export function aluControlTable(aluop: string, funct: number): string | null {
  const f = bin(funct, 6)
  const hit = ALU_CONTROL_TABLE.find((e) => e.aluop === aluop && (e.funct === 'xxxxxx' || e.funct === f))
  return hit?.code ?? null
}

export interface GateResult {
  code: string
  bits: { bit: 3 | 2 | 1 | 0; expr: string; working: string; value: 0 | 1 }[]
  /** Funct bits the gates read (F3..F0); F5 and F4 are ignored. */
  used: string[]
  why: Explain
}

/** ALU control from the gate equations (R06 p20). ALUop bits must be 0/1. */
export function aluControlGates(aluop1: 0 | 1, aluop0: 0 | 1, funct: number): GateResult {
  const F = (k: number) => ((funct >> k) & 1) as 0 | 1
  const not = (v: 0 | 1) => (v ? 0 : 1) as 0 | 1
  const or = (a: number, b: number) => (a || b ? 1 : 0) as 0 | 1
  const and = (a: number, b: number) => (a && b ? 1 : 0) as 0 | 1
  const b2 = or(aluop0, and(aluop1, F(1)))
  const b1 = or(not(aluop1), not(F(2)))
  const b0 = and(aluop1, or(F(3), F(0)))
  const bits: GateResult['bits'] = [
    { bit: 3, expr: '0', working: '0', value: 0 },
    { bit: 2, expr: 'ALUop0 + ALUop1·F1', working: `${aluop0} + ${aluop1}·${F(1)} = ${b2}`, value: b2 },
    { bit: 1, expr: "ALUop1' + F2'", working: `${not(aluop1)} + ${not(F(2))} = ${b1}`, value: b1 },
    { bit: 0, expr: 'ALUop1·(F3 + F0)', working: `${aluop1}·(${F(3)} + ${F(0)}) = ${b0}`, value: b0 },
  ]
  const code = bits.map((b) => b.value).join('')
  return {
    code,
    bits,
    used: ['F3', 'F2', 'F1', 'F0'],
    why: { rule: 'Each ALUcontrol bit is a small gate expression of ALUop and funct bits F3..F0', working: bits.map((b) => `bit${b.bit} = ${b.working}`).join('; '), cite: 'R06 p20, L12 p28' },
  }
}

export function aluOpOf(code: string): AluOp | null {
  return ALU_CODES.find((c) => c.code === code)?.op ?? null
}

const s32 = (n: number) => n | 0
const u32 = (n: number) => n >>> 0

/** The ALU of L11 p34 on 32-bit values. Returns null for a code the ALU does not define. */
export function aluCompute(code: string, a: number, b: number): { result: number; isZero: 0 | 1; op: AluOp } | null {
  const op = aluOpOf(code)
  if (!op) return null
  let r: number
  switch (op) {
    case 'AND': r = a & b; break
    case 'OR': r = a | b; break
    case 'add': r = s32(a) + s32(b); break
    case 'subtract': r = s32(a) - s32(b); break
    case 'slt': r = s32(a) < s32(b) ? 1 : 0; break
    case 'NOR': r = ~(a | b); break
  }
  const result = u32(r)
  return { result, isZero: result === 0 ? 1 : 0, op }
}

const hex8 = (n: number) => `0x${u32(n).toString(16).toUpperCase().padStart(8, '0')}`

export interface RawAluResult {
  code: string
  /** null when Operation 11 is used other than as slt: the course does not show how slt is wired (L12 p22). */
  result: number | null
  isZero: 0 | 1 | null
  /** Course name of the code (L11 p34), or a description such as "A' OR B'" for a code the course never names. */
  name: string
  named: boolean
  why: Explain
}

/**
 * The ALU driven by its four control bits directly (L12 p21-22): Ainvert and Binvert invert the inputs,
 * Operation picks AND (00), OR (01), the adder (10) or slt (11). Binvert also feeds the carry into bit 0,
 * which is what makes 0110 compute A + B' + 1 = A - B.
 */
export function aluRaw(ainvert: 0 | 1, binvert: 0 | 1, operation: '00' | '01' | '10' | '11', a: number, b: number): RawAluResult {
  const code = `${ainvert}${binvert}${operation}`
  const A = ainvert ? ~a : a
  const B = binvert ? ~b : b
  const an = ainvert ? "A'" : 'A'
  const bn = binvert ? "B'" : 'B'
  const known = aluOpOf(code)
  const cite = 'L12 p21-22, L11 p34'
  let result: number | null
  let name: string
  let working: string
  switch (operation) {
    case '00':
      result = u32(A & B)
      name = `${an} AND ${bn}`
      working = `${hex8(A)} AND ${hex8(B)} = ${hex8(result)}`
      break
    case '01':
      result = u32(A | B)
      name = `${an} OR ${bn}`
      working = `${hex8(A)} OR ${hex8(B)} = ${hex8(result)}`
      break
    case '10':
      result = u32(s32(A) + s32(B) + binvert)
      name = `${an} + ${bn}${binvert ? ' + 1' : ''}`
      working = `${hex8(A)} + ${hex8(B)}${binvert ? ' + 1 (carry in = Binvert)' : ''} = ${hex8(result)}`
      break
    case '11':
      result = known === 'slt' ? aluCompute(code, a, b)!.result : null
      name = known === 'slt' ? 'slt' : `Operation 11 with Ainvert ${ainvert}, Binvert ${binvert}`
      working = known === 'slt' ? `${s32(a)} < ${s32(b)} is ${result ? 'true' : 'false'}, so the result is ${result}` : 'not defined'
      break
  }
  const isZero = result === null ? null : result === 0 ? 1 : 0
  const nand = code === '1101'
  return {
    code,
    result,
    isZero,
    name: known ?? (nand ? `${name}, which is NAND` : name),
    named: known !== null,
    why: result === null
      ? { rule: 'Operation 11 picks the slt result, and the course only shows it with Ainvert 0 and Binvert 1 (the slt wiring is not shown)', cite: 'L12 p22' }
      : {
          rule: `Ainvert ${ainvert} and Binvert ${binvert} ${ainvert || binvert ? 'invert' : 'pass'} the inputs, then Operation ${operation} picks ${operation === '00' ? 'AND' : operation === '01' ? 'OR' : operation === '10' ? 'the adder' : 'slt'}${known ? `: ALUcontrol ${code} is ${known}` : nand ? ": A' OR B' is NAND by De Morgan, so no new hardware is needed" : ': the course gives this code no name'}`,
          working,
          cite,
        },
  }
}

export type QuizVerdict = 'right' | 'accepted' | 'wrong' | 'blank'

export interface QuizCell {
  signal: SignalName | 'ALUcontrol'
  key: string
  given: string
  verdict: QuizVerdict
  why: Explain
}

/**
 * Mark a filled-in control row against the table (L12 p34) and ALU control (L12 p26).
 * A 0 or 1 where the table has X is accepted: X only means either value works.
 * An X where the table fixes a value is wrong, and for state-changing signals it is never allowed.
 */
export function gradeControlRow(key: ControlRow, keyAluControl: string, answer: Partial<Record<SignalName, Bit>>, answerAluControl: string): QuizCell[] {
  const cells: QuizCell[] = SIGNAL_ORDER.map((s) => {
      const k = key[s]
      const g = answer[s]
      const m = SIGNAL_MEANINGS[s]
      const meaning = (v: Bit) => (s === 'ALUop1' || s === 'ALUop0' ? `ALUop = ${key.ALUop1}${key.ALUop0} (L12 p24)` : v === 1 ? m.one : m.zero)
      const base = { signal: s, key: String(k), given: g === undefined ? '' : String(g) }
      if (g === undefined) return { ...base, verdict: 'blank' as const, why: { rule: `Not filled in. The table gives ${s} = ${k}`, cite: 'L12 p34' } }
      if (k === 'X') {
        return g === 'X'
          ? { ...base, verdict: 'right' as const, why: { rule: `${s} is X: nothing this instruction keeps passes through what it selects`, cite: 'L12 p34' } }
          : { ...base, verdict: 'accepted' as const, why: { rule: `${g} works too. The table has X because nothing this instruction keeps passes through what ${s} selects`, cite: 'L12 p34' } }
      }
      if (g === k) return { ...base, verdict: 'right' as const, why: { rule: `${s} = ${k}: ${meaning(k)}`, cite: m.cite } }
      if (g === 'X') {
        return {
          ...base,
          verdict: 'wrong' as const,
          why: NEVER_X.includes(s)
            ? { rule: `${s} can never be X: a wrong value would ${s === 'MemRead' ? 'read memory when it must not (only one of MemRead and MemWrite may be on)' : s === 'Branch' ? 'change the next PC' : 'write state that must not change'}. It must be ${k}`, cite: s === 'MemRead' ? 'L11 p40, L12 p34' : 'L12 p34' }
            : { rule: `${s} is used by this instruction, so it must be ${k}: ${meaning(k)}`, cite: m.cite },
        }
      }
      const alt = s === 'ALUop1' || s === 'ALUop0' ? '' : `. ${g} would mean: ${meaning(g)}`
      return { ...base, verdict: 'wrong' as const, why: { rule: `${s} must be ${k}: ${meaning(k)}${alt}`, cite: m.cite } }
    })
  const a = answerAluControl.trim()
  const op = aluOpOf(keyAluControl)
  cells.push({
    signal: 'ALUcontrol',
    key: keyAluControl,
    given: a,
    verdict: a === '' ? 'blank' : a === keyAluControl ? 'right' : 'wrong',
    why: { rule: `ALUop ${key.ALUop1}${key.ALUop0} and funct give ALUcontrol ${keyAluControl} (${op})${a && a !== keyAluControl ? `; ${a} is ${aluOpOf(a) ?? 'not an ALU code'}` : ''}`, cite: 'L12 p26, L11 p34' },
  })
  return cells
}
