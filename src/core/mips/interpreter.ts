import { hex, jumpTarget, toBytes, u32 } from './encoding'
import { OP_BY_NAME } from './isa'
import { regName } from './registers'
import type { Endian, ExecFrame, Explain, Instr, MemAccess, Program, RunInit, RunOptions, RunResult } from './types'

const ORDER: Record<Endian, Explain> = {
  big: { rule: 'Big-endian: the most significant byte sits at the lowest address', cite: 'R02 p8' },
  little: { rule: 'Little-endian: the least significant byte sits at the lowest address. The online MIPS interpreter uses it (L10 p18). QtSpim on a PC shows words this way too, a lab observation, not a slide fact', cite: 'L10 p17-18' },
}

/** Byte map for init.mem from 32-bit words laid out from `base` (big-endian unless told otherwise). */
export function wordsToMem(base: number, words: number[], endian: Endian = 'big'): Record<number, number> {
  const mem: Record<number, number> = {}
  words.forEach((w, i) => writeBytes(mem, u32(base + 4 * i), 4, w, endian))
  return mem
}

/** Unsigned value of `size` bytes from `address`. */
function readBytes(mem: Record<number, number>, address: number, size: 1 | 2 | 4, endian: Endian): number {
  let v = 0
  for (let k = 0; k < size; k++) v = v * 256 + (mem[u32(address + (endian === 'big' ? k : size - 1 - k))] ?? 0)
  return v
}

export function readWord(mem: Record<number, number>, address: number, endian: Endian = 'big'): number {
  return readBytes(mem, address, 4, endian) | 0
}

/** `count` signed words from `base`. */
export function readWords(mem: Record<number, number>, base: number, count: number, endian: Endian = 'big'): number[] {
  return Array.from({ length: count }, (_, i) => readWord(mem, u32(base + 4 * i), endian))
}

function writeBytes(mem: Record<number, number>, address: number, size: 1 | 2 | 4, value: number, endian: Endian) {
  toBytes(value, size, endian).forEach((b, k) => { mem[u32(address + k)] = b })
}

/** Memory after frame `index` (any index below 0 gives the initial state), replayed from the recorded writes. */
export function memoryAt(result: RunResult, index: number): Record<number, number> {
  const mem = { ...result.initialMem }
  for (const f of result.frames.slice(0, Math.max(0, index + 1))) for (const w of f.memWrites) writeBytes(mem, w.address, w.size, w.value, result.endian)
  return mem
}

export function run(program: Program, init: RunInit = {}, maxSteps = 10000, opts: RunOptions = {}): RunResult {
  const endian = program.endian ?? 'big'
  const regs = new Array<number>(32).fill(0)
  for (const [k, v] of Object.entries(init.regs ?? {})) if (v !== undefined && +k > 0 && +k < 32) regs[+k] = v | 0
  const mem: Record<number, number> = {}
  // Missing bytes read as 0, so zero bytes (.space) are not stored: keeps big buffers cheap to copy.
  for (const d of program.data) d.bytes.forEach((b, i) => { if (b) mem[u32(d.address + i)] = b })
  for (const [a, b] of Object.entries(init.mem ?? {})) mem[u32(+a)] = b & 255
  const frames: ExecFrame[] = []
  let output = ''
  let statements = 0
  const base = { initialRegs: [...regs], initialMem: { ...mem }, endian }
  const done = (halted: RunResult['halted'], error?: string): RunResult =>
    ({ frames, halted, ...(error === undefined ? {} : { error }), output, statements, ...base })
  if (program.errors.length) return done('error', 'fix the assembly errors before running')
  if (!program.instructions.length) return done('end')

  const byAddr = new Map(program.instructions.map((i) => [i.address, i]))
  // First real instruction of each source statement (a pseudo-instruction expands into consecutive instructions).
  const starts = new Set(program.instructions.filter((i, k, a) => k === 0 || i.line === 0 || a[k - 1].line !== i.line).map((i) => i.address))
  const end = u32(program.instructions.reduce((m, i) => Math.max(m, i.address), 0) + 4)
  const link = opts.jalLink ?? 'pc+4'
  const io = { lines: (init.input ?? '').split(/\r?\n/), next: 0 }
  // QtSpim's startup code calls main (Lab 3 SPIM-assembler p1: .globl main), so start there if it exists.
  const main = program.labels.main
  let pc = main !== undefined && byAddr.has(main) ? main : program.instructions[0].address

  for (let step = 0; step < maxSteps; step++) {
    const instr = byAddr.get(pc)
    if (!instr) {
      if (pc === end) return done('end')
      return done('error', `PC ${hex(pc)} does not hold an instruction (QtSpim: attempt to execute non-instruction, Lab 3 p7)`)
    }
    try {
      const [f, exit] = execute(instr, regs, mem, link, endian, io)
      frames.push(f)
      if (starts.has(pc)) statements++
      if (f.output) output += f.output
      if (exit) return done('end')
      pc = f.nextPc
    } catch (e) {
      if (e instanceof Error) return done('error', `${hex(pc)} ${instr.text}: ${e.message}`)
      throw e
    }
  }
  return done('maxSteps')
}

/** Runs one instruction in place; the flag is true when the program asked to exit (syscall 10). */
function execute(
  ins: Instr,
  regs: number[],
  mem: Record<number, number>,
  link: 'pc+4' | 'pc+8',
  endian: Endian,
  io: { lines: string[]; next: number },
): [ExecFrame, boolean] {
  const op = OP_BY_NAME[ins.mnemonic]
  const pc = ins.address
  const n = (r: number) => regName(r)
  const v = (r: number) => regs[r]
  const why: Explain[] = []
  const memReads: MemAccess[] = []
  const memWrites: MemAccess[] = []
  const changedRegs: number[] = []
  let nextPc = u32(pc + 4)
  let taken: boolean | undefined
  let note = ''
  let output: string | undefined
  let exit = false

  const write = (r: number, value: number, expr: string) => {
    note = `${n(r)} <- ${expr}`
    if (r === 0) {
      note += ' (write to $zero discarded)'
      why.push({ rule: '$zero always reads 0, so the write is discarded', cite: 'L06 p34' })
      return
    }
    regs[r] = value | 0
    changedRegs.push(r)
  }
  const load = (address: number, size: 1 | 2 | 4) => {
    const value = readBytes(mem, address, size, endian)
    memReads.push({ address, size, value })
    return value
  }
  const store = (address: number, size: 1 | 2 | 4, value: number) => {
    const raw = size === 4 ? u32(value) : value & (size === 2 ? 0xffff : 255)
    writeBytes(mem, address, size, raw, endian)
    memWrites.push({ address, size, value: raw })
  }
  const sizeOf = (m: string): 1 | 2 | 4 => (m === 'lw' || m === 'sw' ? 4 : m[1] === 'h' ? 2 : 1)
  const aligned = (a: number, size: 1 | 2 | 4) => {
    if (a % size === 0) return
    throw new Error(size === 4
      ? `${ins.mnemonic} address ${hex(a)} is not a multiple of 4 (L07 p15)`
      : `${ins.mnemonic} address ${hex(a)} is not a multiple of 2 (QtSpim requires halfwords at even addresses)`)
  }
  const effAddr = () => {
    const a = u32(v(ins.rs) + ins.imm)
    why.push({ rule: 'Effective address = base register + sign-extended offset', working: `${n(ins.rs)} + ${ins.imm} = ${hex(v(ins.rs))} + ${ins.imm} = ${hex(a)}`, cite: 'L07 p8' })
    return a
  }

  switch (ins.mnemonic) {
    case 'add':
    case 'addu':
    case 'sub':
    case 'and':
    case 'or':
    case 'xor':
    case 'nor':
    case 'slt':
    case 'sltu': {
      const a = v(ins.rs)
      const b = v(ins.rt)
      const sym: Record<string, string> = { add: '+', addu: '+', sub: '-', and: '&', or: '|', xor: '^', nor: 'nor', slt: '<', sltu: '<' }
      const res =
        ins.mnemonic === 'add' || ins.mnemonic === 'addu' ? a + b
        : ins.mnemonic === 'sltu' ? (a >>> 0 < b >>> 0 ? 1 : 0)
        : ins.mnemonic === 'sub' ? a - b
        : ins.mnemonic === 'and' ? a & b
        : ins.mnemonic === 'or' ? a | b
        : ins.mnemonic === 'xor' ? a ^ b
        : ins.mnemonic === 'nor' ? ~(a | b)
        : a < b ? 1 : 0
      const bitwise = ['and', 'or', 'xor', 'nor'].includes(ins.mnemonic)
      const show = (x: number) => (bitwise ? hex(x) : String(x))
      const expr = ins.mnemonic === 'sltu'
        ? `(${n(ins.rs)} < ${n(ins.rt)}) ? 1 : 0 = (${a >>> 0} < ${b >>> 0}) = ${res}`
        : ins.mnemonic === 'slt'
        ? `(${n(ins.rs)} < ${n(ins.rt)}) ? 1 : 0 = (${a} < ${b}) = ${res}`
        : `${n(ins.rs)} ${sym[ins.mnemonic]} ${n(ins.rt)} = ${show(a)} ${sym[ins.mnemonic]} ${show(b)} = ${show(res | 0)}`
      const rule = ins.mnemonic === 'slt' ? 'slt sets rd to 1 if rs < rt (signed), else 0'
        : ins.mnemonic === 'sltu' ? 'sltu compares rs and rt as unsigned numbers: rd = 1 if rs < rt, else 0'
        : `${ins.mnemonic}: rd = rs ${sym[ins.mnemonic]} rt`
      why.push({ rule, working: expr, cite: op.cite })
      write(ins.rd, res, expr)
      break
    }
    case 'sll':
    case 'srl': {
      const a = v(ins.rt)
      const res = ins.mnemonic === 'sll' ? a << ins.shamt : a >>> ins.shamt
      const expr = `${n(ins.rt)} ${ins.mnemonic === 'sll' ? '<<' : '>>'} ${ins.shamt} = ${hex(a)} ${ins.mnemonic === 'sll' ? '<<' : '>>'} ${ins.shamt} = ${hex(res)}`
      why.push({ rule: `${ins.mnemonic} shifts ${ins.mnemonic === 'sll' ? 'left' : 'right'} and fills the emptied bits with 0`, working: expr, cite: op.cite })
      write(ins.rd, res, expr)
      break
    }
    case 'addi':
    case 'addiu':
    case 'slti': {
      const a = v(ins.rs)
      const res = ins.mnemonic === 'slti' ? (a < ins.imm ? 1 : 0) : a + ins.imm
      const expr = ins.mnemonic !== 'slti'
        ? `${n(ins.rs)} + ${ins.imm} = ${a} + ${ins.imm} = ${res | 0}`
        : `(${n(ins.rs)} < ${ins.imm}) ? 1 : 0 = (${a} < ${ins.imm}) = ${res}`
      why.push({ rule: `${ins.mnemonic} sign-extends its 16-bit immediate`, working: `${hex(ins.word & 0xffff, 4)} -> ${hex(ins.imm)} = ${ins.imm}`, cite: 'L08 p19' })
      write(ins.rt, res, expr)
      break
    }
    case 'andi':
    case 'ori':
    case 'xori': {
      const a = v(ins.rs)
      const res = ins.mnemonic === 'andi' ? a & ins.imm : ins.mnemonic === 'ori' ? a | ins.imm : a ^ ins.imm
      const sym = ins.mnemonic === 'andi' ? '&' : ins.mnemonic === 'ori' ? '|' : '^'
      const expr = `${n(ins.rs)} ${sym} ${hex(ins.imm)} = ${hex(a)} ${sym} ${hex(ins.imm)} = ${hex(res)}`
      why.push({ rule: `${ins.mnemonic} zero-extends its 16-bit immediate, so bits 31-16 of the constant are 0`, working: `${hex(ins.imm, 4)} -> ${hex(ins.imm)}`, cite: 'L06 p46' })
      write(ins.rt, res, expr)
      break
    }
    case 'lui': {
      const res = ins.imm << 16
      const expr = `${hex(ins.imm, 4)} << 16 = ${hex(res)}`
      why.push({ rule: 'lui puts the 16-bit constant in the upper half and clears the lower half', working: expr, cite: 'L06 p44' })
      write(ins.rt, res, expr)
      break
    }
    case 'lw':
    case 'lh':
    case 'lhu':
    case 'lb':
    case 'lbu': {
      const a = effAddr()
      const size = sizeOf(ins.mnemonic)
      aligned(a, size)
      const raw = load(a, size)
      const val = ins.mnemonic === 'lb' ? (raw << 24) >> 24 : ins.mnemonic === 'lh' ? (raw << 16) >> 16 : raw | 0
      if (size > 1) why.push(ORDER[endian])
      if (ins.mnemonic === 'lb') why.push({ rule: 'lb sign-extends the byte to 32 bits', working: `${hex(raw, 2)} -> ${val}`, cite: 'L07 p11' })
      if (ins.mnemonic === 'lh') why.push({ rule: 'lh sign-extends the halfword to 32 bits (standard MIPS, not covered in lectures)', working: `${hex(raw, 4)} -> ${val}`, cite: 'L07 p12' })
      if (ins.mnemonic === 'lhu') why.push({ rule: 'lhu zero-extends the halfword to 32 bits', working: `${hex(raw, 4)} -> ${val}`, cite: 'green card' })
      write(ins.rt, val, `Mem[${n(ins.rs)} + ${ins.imm}] = Mem[${hex(a)}] = ${val}`)
      break
    }
    case 'sw':
    case 'sh':
    case 'sb': {
      const a = effAddr()
      const size = sizeOf(ins.mnemonic)
      aligned(a, size)
      store(a, size, v(ins.rt))
      if (size > 1) why.push(ORDER[endian])
      if (size === 2) why.push({ rule: 'sh stores only the low 16 bits of rt', working: `${hex(v(ins.rt))} -> ${hex(v(ins.rt) & 0xffff, 4)}`, cite: 'green card' })
      if (size === 1) why.push({ rule: 'sb stores only the lowest byte of rt', working: `${hex(v(ins.rt))} -> ${hex(v(ins.rt) & 255, 2)}`, cite: 'L07 p11' })
      note = `Mem[${hex(a)}] <- ${n(ins.rt)} = ${size === 4 ? v(ins.rt) : hex(v(ins.rt) & (size === 2 ? 0xffff : 255), size * 2)}`
      break
    }
    case 'beq':
    case 'bne': {
      const a = v(ins.rs)
      const b = v(ins.rt)
      taken = ins.mnemonic === 'beq' ? a === b : a !== b
      const t = u32(pc + 4 + ins.imm * 4)
      const cmp = ins.mnemonic === 'beq' ? '==' : '!='
      why.push({ rule: `${ins.mnemonic} is taken when rs ${cmp} rt`, working: `${n(ins.rs)} ${cmp} ${n(ins.rt)}: ${a} ${cmp} ${b} is ${taken}`, cite: op.cite })
      why.push(
        taken
          ? { rule: 'Taken: PC = (PC+4) + imm x 4', working: `${hex(u32(pc + 4))} + ${ins.imm} x 4 = ${hex(t)}`, cite: 'L08 p28' }
          : { rule: 'Not taken: PC = PC+4', working: `${hex(pc)} + 4 = ${hex(u32(pc + 4))}`, cite: 'L08 p28' },
      )
      if (taken) nextPc = t
      note = `${a} ${cmp} ${b}? ${taken ? `taken, PC <- ${hex(t)}` : 'not taken, PC <- PC+4'}`
      break
    }
    case 'j':
    case 'jal': {
      nextPc = jumpTarget(pc, ins.target)
      why.push({ rule: 'PC = {PC+4[31:28], target, 00}', working: `${hex(u32(pc + 4) >>> 28, 1)} | ${hex(ins.target, 7)} << 2 = ${hex(nextPc)}`, cite: 'L08 p37-39' })
      note = `PC <- ${hex(nextPc)}`
      if (ins.mnemonic === 'jal') {
        const ra = u32(pc + (link === 'pc+4' ? 4 : 8))
        why.push({
          rule: link === 'pc+4' ? 'jal saves PC+4 in $ra (the green card says PC+8)' : 'jal saves PC+8 in $ra, as on the green card (L08 p8 says PC+4)',
          working: `${hex(pc)} + ${link === 'pc+4' ? 4 : 8} = ${hex(ra)}`,
          cite: link === 'pc+4' ? 'L08 p8' : 'green card',
        })
        write(31, ra, `${hex(ra)}`)
        note = `$ra <- ${hex(ra)}, PC <- ${hex(nextPc)}`
      }
      break
    }
    case 'jr': {
      nextPc = u32(v(ins.rs))
      why.push({ rule: 'jr jumps to the address held in rs', working: `${n(ins.rs)} = ${hex(nextPc)}`, cite: 'L08 p8' })
      note = `PC <- ${n(ins.rs)} = ${hex(nextPc)}`
      break
    }
    case 'syscall': {
      const code = v(2)
      why.push({ rule: 'syscall reads the service code from $v0 and its argument from $a0', working: `$v0 = ${code}`, cite: 'Lab 4 p1' })
      if (code === 10) exit = true
      else if (code === 5) {
        // Lab 4 p2: read_int reads a whole line; characters after the number are ignored.
        if (io.next >= io.lines.length || (io.next === io.lines.length - 1 && io.lines[io.next].trim() === '')) {
          throw new Error('read_int (syscall 5) has no input line left: add one integer per line to the input')
        }
        const line = io.lines[io.next++]
        const m = /^\s*([+-]?\d+)/.exec(line)
        if (!m) throw new Error(`read_int (syscall 5) expected an integer, got "${line}"`)
        const val = Number(m[1]) | 0
        why.push({ rule: 'read_int reads one line of input and returns the integer in $v0', working: `line ${io.next}: ${JSON.stringify(line)} -> ${val}`, cite: 'Lab 4 p2' })
        write(2, val, `read_int = ${val}`)
        break
      } else if (code === 1) output = String(v(4))
      else if (code === 11) output = String.fromCharCode(v(4) & 255)
      else if (code === 4) {
        const bytes: number[] = []
        for (let a = u32(v(4)); bytes.length < 10000; a = u32(a + 1)) {
          const b = mem[a] ?? 0
          if (!b) break
          bytes.push(b)
        }
        output = new TextDecoder().decode(new Uint8Array(bytes))
      } else throw new Error(`syscall code ${code} is not supported (1 print_int, 4 print_string, 5 read_int, 10 exit, 11 print_char)`)
      note = exit ? 'exit' : `print ${JSON.stringify(output)}`
      break
    }
  }

  return [{ pc, instr: ins, regs: [...regs], changedRegs, memWrites, memReads, nextPc, taken, note, why, output }, exit]
}
