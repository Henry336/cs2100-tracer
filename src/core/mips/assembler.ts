import { decode, encode, hex, instrText, toBytes, u32 } from './encoding'
import { OP_BY_NAME, dict, type OpInfo } from './isa'
import { regNumber } from './registers'
import type { AsmError, Endian, Instr, Program } from './types'

export const DEFAULT_TEXT_BASE = 0x00400000 // Lab 3 p4
export const DEFAULT_DATA_BASE = 0x10010000 // Lab 4 p4

export interface AssembleOptions {
  textBase?: number
  dataBase?: number
  /** Byte order for .word/.half and ulw; run() uses the same. Default big (R02 p8); QtSpim is little (L10 p18). */
  endian?: Endian
  /**
   * What a number after j/jal means. 'field' (default): the 26-bit target field, so j 2500 goes to 10000 (L08 p8;
   * R04 p44 Q7). 'address': the byte address, as QtSpim reads it and as T03 Q2's decoded answers are written.
   */
  jumpOperand?: 'field' | 'address'
}

class AsmFail extends Error {}
function fail(message: string): never {
  throw new AsmFail(message)
}

interface Stmt {
  line: number
  seg: 'text' | 'data'
  labels: string[]
  /** Lowercase mnemonic or directive; '' for a label-only marker. */
  m: string
  ops: string[]
  /** Operand text as typed (for .asciiz). */
  rest: string
  /** Statement text without labels and comment. */
  source: string
  address: number
  /** Real instructions after pseudo expansion (text segment only). */
  reals?: Real[]
}

interface Real {
  m: string
  ops: string[]
}

interface Ctx {
  addr: (label: string) => number | undefined
  isData: (label: string) => boolean
  /** true in the encode pass, when every label must be known. */
  strict?: boolean
  endian: Endian
  jumpOperand: 'field' | 'address'
}

/** Decimal, hex (0x), binary (0b), optional sign, or a one-character literal like 'a'. */
export function parseNumber(s: string): number | undefined {
  const t = s.trim()
  const m = /^([+-]?)(0x[0-9a-f]+|0b[01]+|\d+)$/i.exec(t)
  if (m) {
    const v = Number(m[2])
    return m[1] === '-' ? -v : v
  }
  const c = /^'(.)'$/.exec(t)
  return c ? c[1].charCodeAt(0) : undefined
}

// SPIM identifiers: letters, digits, _ and dots, not starting with a digit (Lab 3 SPIM-assembler p1).
const isLabelName = (s: string) => /^[A-Za-z_.][\w.]*$/.test(s)
const PSEUDOS = ['nop', 'move', 'li', 'la', 'blt', 'bgt', 'bge', 'ble', 'ulw']

function stripComment(line: string): string {
  let inStr = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inStr && ch === '\\') i++
    else if (ch === '"') inStr = !inStr
    else if (ch === '#' && !inStr) return line.slice(0, i)
  }
  return line
}

function splitOps(rest: string): string[] {
  return rest
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .split(/[\s,]+/)
    .filter(Boolean)
}

function parseString(rest: string): string {
  const m = /^"((?:[^"\\]|\\.)*)"$/.exec(rest.trim())
  if (!m) fail(`expected a string in double quotes, got ${rest || 'nothing'}`)
  const map: Record<string, string> = { n: '\n', t: '\t', '0': '\0', '\\': '\\', '"': '"' }
  return m![1].replace(/\\(.)/g, (_, c: string) => map[c] ?? c)
}

const align = (a: number, n: number) => u32(Math.ceil(a / n) * n)

const RANGE = {
  C16_2s: { lo: -32768, hi: 32767, what: 'the 16-bit 2s complement range -32768 to 32767 (C16_2s, L06 p45)' },
  C16: { lo: 0, hi: 0xffff, what: 'the raw 16-bit range 0 to 0xFFFF (C16, L08 p34)' },
  // AY24/25 S1 Q11 writes andi/ori with -1: a negative value stands for its 16-bit pattern, then zero-extends.
  C16_logic: { lo: -32768, hi: 0xffff, what: 'the raw 16-bit range 0 to 0xFFFF (C16, L08 p34; a negative value down to -32768 is read as its 16-bit pattern)' },
  C5: { lo: 0, hi: 31, what: 'the shift range 0 to 31 (C5, L06 p46)' },
}

function num(s: string, range: keyof typeof RANGE, m: string): number {
  const v = parseNumber(s)
  if (v === undefined) fail(`${m}: expected a number, got ${s}`)
  const r = RANGE[range]
  if (v! < r.lo || v! > r.hi) fail(`${m}: ${s} is outside ${r.what}`)
  return v!
}

function reg(s: string): number {
  if (s === '0') return 0 // past papers write "bne $s0, 0, Loop" meaning $zero
  const n = regNumber(s)
  if (n === undefined) fail(`unknown register ${s}`)
  return n!
}

const FORMS: Record<string, string> = {
  arith: 'rd, rs, rt',
  shift: 'rd, rt, shamt',
  jr: 'rs',
  syscall: '',
  arithImm: 'rt, rs, immediate',
  logicImm: 'rt, rs, immediate',
  lui: 'rt, immediate',
  load: 'rt, offset(rs)',
  store: 'rt, offset(rs)',
  branch: 'rs, rt, label',
  jump: 'label',
}

function need(m: string, ops: string[], n: number, form: string) {
  if (ops.length !== n) fail(`${m} needs ${n} operand${n === 1 ? '' : 's'} (${form}), got ${ops.length}`)
}

const HINTS: Record<string, string> = dict({
  subi: 'there is no subi: use addi with a negative constant (L06 p33)',
  not: 'there is no not: use nor $rd, $rs, $zero (L06 p42)',
  nori: 'there is no nori in MIPS (L06 p43)',
  usw: 'usw is a pseudo-instruction this tracer does not expand (L07 p12)',
})

const IMM_FORM: Record<string, string> = dict({ add: 'addi', and: 'andi', or: 'ori', xor: 'xori', slt: 'slti' })

/** Pseudo-instruction expansion: L06 p34, L07 p29, T04 Q2, L06 p44. */
function expand(m: string, ops: string[], ctx: Ctx): Real[] {
  switch (m) {
    case 'nop':
      need(m, ops, 0, 'no operands')
      return [{ m: 'sll', ops: ['$zero', '$zero', '0'] }]
    case 'move':
      need(m, ops, 2, 'rd, rs')
      return [{ m: 'add', ops: [ops[0], ops[1], '$zero'] }]
    case 'li': {
      need(m, ops, 2, 'rt, constant')
      const v = parseNumber(ops[1])
      if (v === undefined || v < -(2 ** 31) || v > 0xffffffff) fail(`li: ${ops[1]} is not a 32-bit constant`)
      const u = u32(v!)
      if (u <= 0xffff) return [{ m: 'ori', ops: [ops[0], '$zero', String(u)] }]
      return [
        { m: 'lui', ops: [ops[0], String(u >>> 16)] },
        { m: 'ori', ops: [ops[0], ops[0], String(u & 0xffff)] },
      ]
    }
    case 'la': {
      need(m, ops, 2, 'rt, label')
      let v = parseNumber(ops[1])
      // A text label's address is not known while sizes are worked out, so it always takes lui + ori.
      let pair = false
      if (v === undefined) {
        if (!isLabelName(ops[1])) fail(`la: expected a label, got ${ops[1]}`)
        pair = !ctx.isData(ops[1])
        v = ctx.addr(ops[1])
        if (v === undefined && ctx.strict) fail(`unknown label ${ops[1]}`)
        v ??= 0
      }
      const u = u32(v)
      const out: Real[] = [{ m: 'lui', ops: [ops[0], String(u >>> 16)] }]
      if (pair || u & 0xffff) out.push({ m: 'ori', ops: [ops[0], ops[0], String(u & 0xffff)] })
      return out
    }
    case 'blt':
    case 'bgt':
    case 'bge':
    case 'ble': {
      need(m, ops, 3, 'rs, rt, label')
      const [a, b, label] = ops
      const lt = m === 'blt' || m === 'bge' // these test a < b; bgt/ble test b < a
      return [
        { m: 'slt', ops: ['$at', lt ? a : b, lt ? b : a] },
        { m: m === 'blt' || m === 'bgt' ? 'bne' : 'beq', ops: ['$at', '$zero', label] },
      ]
    }
    case 'ulw': {
      // L07 p12: ulw becomes byte loads plus other operations. The most significant byte is loaded first: the
      // lowest address when big-endian (R02 p8), the highest when little-endian. lbu, not lb, so no sign bits leak.
      need(m, ops, 2, 'rt, offset(rs)')
      const mm = /^(.*)\((.+)\)$/.exec(ops[1])
      if (!mm) fail(`ulw: expected offset(register), got ${ops[1]}`)
      const off = mm![1] === '' ? 0 : num(mm![1], 'C16_2s', m)
      if (off > 32764) fail(`ulw: offset ${off} + 3 is outside the 16-bit 2s complement range (L06 p45)`)
      const rt = reg(ops[0])
      if (rt === reg(mm![2]) || rt === 1) fail('ulw: the destination must differ from the base register and $at, which this expansion overwrites')
      const at = (k: number) => `${off + (ctx.endian === 'little' ? 3 - k : k)}(${mm![2]})`
      return [
        { m: 'lbu', ops: [ops[0], at(0)] },
        ...[1, 2, 3].flatMap((k) => [
          { m: 'sll', ops: [ops[0], ops[0], '8'] },
          { m: 'lbu', ops: ['$at', at(k)] },
          { m: 'or', ops: [ops[0], ops[0], '$at'] },
        ]),
      ]
    }
  }
  // R-format written with a constant, e.g. "slt $2,$2,124" in AY23/24 S1 Q12: read it as the immediate form.
  if (IMM_FORM[m] && ops.length === 3 && parseNumber(ops[2]) !== undefined) return [{ m: IMM_FORM[m], ops }]
  if (!OP_BY_NAME[m]) fail(HINTS[m] ?? `unknown instruction ${m}`)
  return [{ m, ops }]
}

function encodeReal(r: Real, pc: number, ctx: Ctx): Instr {
  const op: OpInfo = OP_BY_NAME[r.m]
  const o = r.ops
  const form = FORMS[op.kind]
  need(r.m, o, form ? form.split(',').length : 0, form || 'no operands')
  let rs = 0, rt = 0, rd = 0, shamt = 0, imm = 0, target = 0
  let targetLabel: string | undefined
  const labelAddr = (s: string) => {
    if (!isLabelName(s)) fail(`${r.m}: expected a label or number, got ${s}`)
    const a = ctx.addr(s)
    if (a === undefined) fail(`unknown label ${s}`)
    targetLabel = s
    return a!
  }
  switch (op.kind) {
    case 'arith': rd = reg(o[0]); rs = reg(o[1]); rt = reg(o[2]); break
    case 'shift': rd = reg(o[0]); rt = reg(o[1]); shamt = num(o[2], 'C5', r.m); break
    case 'jr': rs = reg(o[0]); break
    case 'syscall': break
    case 'arithImm': rt = reg(o[0]); rs = reg(o[1]); imm = num(o[2], 'C16_2s', r.m); break
    case 'logicImm': rt = reg(o[0]); rs = reg(o[1]); imm = num(o[2], 'C16_logic', r.m) & 0xffff; break
    case 'lui': rt = reg(o[0]); imm = num(o[1], 'C16', r.m); break
    case 'load':
    case 'store': {
      rt = reg(o[0])
      const mm = /^(.*)\((.+)\)$/.exec(o[1])
      if (!mm) fail(`${r.m}: expected offset(register), got ${o[1]}`)
      imm = mm![1] === '' ? 0 : num(mm![1], 'C16_2s', r.m)
      rs = reg(mm![2])
      break
    }
    case 'branch': {
      rs = reg(o[0])
      rt = reg(o[1])
      if (parseNumber(o[2]) !== undefined) {
        imm = num(o[2], 'C16_2s', r.m) // a number is the immediate itself, as on L08 p31
        break
      }
      const t = labelAddr(o[2])
      const bytes = (t - u32(pc + 4)) | 0
      if (bytes % 4) fail(`${r.m}: target ${hex(t)} is not word-aligned`)
      imm = bytes / 4
      if (imm < -32768 || imm > 32767) fail(`${r.m}: ${o[2]} is ${imm} instructions from PC+4, beyond the 16-bit range (L08 p42)`)
      break
    }
    case 'jump': {
      const n = parseNumber(o[0])
      if (n !== undefined && ctx.jumpOperand === 'field') {
        if (n < 0 || n > 0x3ffffff) fail(`${r.m}: ${o[0]} is wider than the 26-bit target field (0 to 0x3FFFFFF). A number after ${r.m} is the field, not an address (L08 p8: j 2500 goes to 10000), so ${r.m} stays in the 256 MB block of PC+4 (L08 p40)`)
        target = n
        break
      }
      const t = n === undefined ? labelAddr(o[0]) : u32(n)
      if (t % 4) fail(`${r.m}: target ${hex(t)} is not word-aligned`)
      const block = u32(pc + 4) & 0xf0000000
      if (u32(t & 0xf0000000) !== u32(block)) fail(`${r.m}: target ${hex(t)} is outside the 256 MB block of PC+4 (${hex(block)} to ${hex(block + 0x0ffffffc)}, L08 p40)`)
      target = (t >>> 2) & 0x3ffffff
      break
    }
  }
  const word = encode({ address: pc, line: 0, text: '', mnemonic: op.mnemonic, format: op.format, opcode: op.opcode, rs, rt, rd, shamt, funct: op.funct ?? 0, imm, target })
  const d = decode(word, pc) as Instr
  if (targetLabel) d.targetLabel = targetLabel
  d.text = instrText(d)
  return d
}

export function assemble(source: string, opts: AssembleOptions = {}): Program {
  const endian = opts.endian ?? 'big'
  const errors: AsmError[] = []
  const stmts: Stmt[] = []
  const defined = new Map<string, number>() // label -> line
  let seg: 'text' | 'data' = 'text'
  let pending: string[] = []
  const push = (st: Omit<Stmt, 'labels' | 'address' | 'seg'>) => {
    stmts.push({ ...st, seg, labels: pending, address: 0 })
    pending = []
  }
  const flushLabels = (line: number) => {
    if (pending.length) push({ line, m: '', ops: [], rest: '', source: '' })
  }

  // Pass 1: split lines into labels and statements.
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    let s = stripComment(raw).trim()
    let lm: RegExpExecArray | null
    while ((lm = /^([A-Za-z_.][\w.]*)\s*:/.exec(s))) {
      const name = lm[1]
      if (OP_BY_NAME[name] || PSEUDOS.includes(name)) errors.push({ line, message: `${name} is an instruction name, so it cannot be a label (Lab 3 SPIM-assembler p1)` })
      if (defined.has(name)) errors.push({ line, message: `label ${name} is already defined on line ${defined.get(name)}` })
      else {
        defined.set(name, line)
        pending.push(name)
      }
      s = s.slice(lm[0].length).trim()
    }
    if (!s) return
    const sp = s.search(/\s/)
    const m = (sp < 0 ? s : s.slice(0, sp)).toLowerCase()
    const rest = sp < 0 ? '' : s.slice(sp + 1).trim()
    if (m === '.globl' || m === '.global') return
    if (m === '.text' || m === '.data') {
      flushLabels(line)
      seg = m === '.text' ? 'text' : 'data'
    }
    push({ line, m, ops: splitOps(rest), rest, source: s })
  })
  flushLabels(source.split(/\r?\n/).length)

  const labels: Record<string, number> = dict()
  const dataLabels = new Set<string>()
  const ctx: Ctx = { addr: (l) => labels[l], isData: (l) => dataLabels.has(l), endian, jumpOperand: opts.jumpOperand ?? 'field' }
  const attempt = (line: number, f: () => void): boolean => {
    try {
      f()
      return true
    } catch (e) {
      if (!(e instanceof AsmFail)) throw e
      errors.push({ line, message: e.message })
      return false
    }
  }
  const segAddress = (st: Stmt, current: number) => {
    if (!st.ops[0]) return current
    const v = parseNumber(st.ops[0])
    if (v === undefined || v < 0 || v > 0xffffffff) fail(`${st.m}: expected an address, got ${st.ops[0]}`)
    return u32(v!)
  }

  // Pass 2: lay out the data segment (it does not depend on text sizes).
  const data: Program['data'] = []
  let dc = u32(opts.dataBase ?? DEFAULT_DATA_BASE)
  for (const st of stmts.filter((x) => x.seg === 'data')) {
    let bytes: number[] = []
    const ok = attempt(st.line, () => {
      switch (st.m) {
        case '.data': dc = segAddress(st, dc); break
        case '': break
        case '.word':
          dc = align(dc, 4)
          for (const t of st.ops) {
            const v = parseNumber(t)
            if (v === undefined || v < -(2 ** 31) || v > 0xffffffff) fail(`.word: ${t} is not a 32-bit number`)
            bytes.push(...toBytes(u32(v!), 4, endian))
          }
          break
        case '.half':
          dc = align(dc, 2)
          for (const t of st.ops) {
            const v = parseNumber(t)
            if (v === undefined || v < -32768 || v > 0xffff) fail(`.half: ${t} is not a 16-bit number`)
            bytes.push(...toBytes(v!, 2, endian))
          }
          break
        case '.byte':
          bytes = st.ops.map((t) => {
            const v = parseNumber(t)
            if (v === undefined || v < -128 || v > 255) fail(`.byte: ${t} is not an 8-bit number`)
            return v! & 255
          })
          break
        case '.ascii':
        case '.asciiz': {
          const text = parseString(st.rest)
          bytes = [...new TextEncoder().encode(text)]
          if (st.m === '.asciiz') bytes.push(0)
          break
        }
        case '.space': {
          const n = parseNumber(st.ops[0] ?? '')
          if (n === undefined || n < 0 || n > 65536) fail(`.space: expected a byte count from 0 to 65536, got ${st.ops[0] ?? 'nothing'}`)
          bytes = new Array(n!).fill(0)
          break
        }
        case '.align': {
          const n = parseNumber(st.ops[0] ?? '')
          if (n === undefined || n < 0 || n > 3) fail(`.align: expected 0 to 3, got ${st.ops[0] ?? 'nothing'}`)
          dc = align(dc, 2 ** n!)
          break
        }
        default:
          fail(st.m.startsWith('.') ? `unknown directive ${st.m}` : `instruction ${st.m} must be in the .text segment`)
      }
    })
    // A failed line takes no space, but its label keeps the (aligned) address it would have had.
    if (!ok) bytes = []
    st.address = dc
    if (bytes.length) data.push({ address: dc, bytes })
    dc = u32(dc + bytes.length)
    for (const l of st.labels) {
      labels[l] = st.address
      dataLabels.add(l)
    }
  }

  // Pass 3: lay out the text segment (pseudo-instruction sizes need data label addresses).
  const textStmts = stmts.filter((x) => x.seg === 'text')
  let tc = u32(opts.textBase ?? DEFAULT_TEXT_BASE)
  if (tc % 4) errors.push({ line: 0, message: `text start ${hex(tc)} is not a multiple of 4; instruction addresses are word-aligned (L08 p23)` })
  const used = new Map<number, number>() // instruction address -> line
  let overlapShown = false
  for (const st of textStmts) {
    let size = 0
    attempt(st.line, () => {
      if (st.m === '.text') {
        const a = segAddress(st, tc)
        if (a % 4) fail(`.text: ${hex(a)} is not a multiple of 4; instruction addresses are word-aligned (L08 p23)`)
        tc = a
        overlapShown = false
      } else if (st.m.startsWith('.')) fail(['.word', '.half', '.byte', '.ascii', '.asciiz', '.space', '.align'].includes(st.m) ? `${st.m} belongs in the .data segment` : `unknown directive ${st.m}`)
      else if (st.m) {
        size = 1 // keeps later addresses stable if this line fails
        st.reals = expand(st.m, st.ops, ctx)
        size = st.reals.length
      }
    })
    st.address = tc
    for (let k = 0; k < size; k++) {
      const a = u32(tc + 4 * k)
      const prev = used.get(a)
      if (prev !== undefined && !overlapShown) {
        errors.push({ line: st.line, message: `${hex(a)} already holds the instruction from line ${prev}: two .text sections overlap` })
        overlapShown = true
      }
      used.set(a, st.line)
    }
    tc = u32(tc + 4 * size)
    for (const l of st.labels) labels[l] = st.address
  }

  // Pass 4: encode.
  const instructions: Instr[] = []
  const strict: Ctx = { ...ctx, strict: true }
  for (const st of textStmts) {
    if (!st.reals) continue
    attempt(st.line, () => {
      const reals = expand(st.m, st.ops, strict) // again, now that text labels are known
      const isPseudo = reals.length !== 1 || reals[0].m !== st.m
      const out = reals.map((r, k) => {
        const ins = encodeReal(r, u32(st.address + 4 * k), strict)
        ins.line = st.line
        if (k === 0 && st.labels.length) ins.label = st.labels[0]
        if (isPseudo) ins.pseudoOf = st.source
        return ins
      })
      instructions.push(...out)
    })
  }

  errors.sort((a, b) => a.line - b.line)
  return { instructions, labels, data, errors, endian }
}
