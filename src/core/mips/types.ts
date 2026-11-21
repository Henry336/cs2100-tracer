/** Shared types for the MIPS engine (assembler, encoder, interpreter, explainers). */

export type Format = 'R' | 'I' | 'J'

/** An explanation for a derived number, rendered by the UI with <Why>. */
export interface Explain {
  rule: string
  working?: string
  cite?: string
}

export interface Instr {
  address: number
  /** 1-based source line; 0 when the instruction came from decode(). */
  line: number
  /** Canonical assembly text (register names, labels kept for branch and jump targets). */
  text: string
  mnemonic: string
  format: Format
  /** All fields are sliced from `word`, whatever the format, so they always match the bits. */
  opcode: number
  rs: number
  rt: number
  rd: number
  shamt: number
  funct: number
  /** Bits 15..0 as used: zero-extended for andi/ori/xori/lui, sign-extended otherwise. */
  imm: number
  /** Bits 25..0 (the J-format target field). */
  target: number
  /** Encoded instruction, unsigned 32-bit. */
  word: number
  /** First label defined at this address. */
  label?: string
  /** Label named as the branch or jump target in the source. */
  targetLabel?: string
  /** Original pseudo-instruction text if this real instruction came from an expansion. */
  pseudoOf?: string
  /** Where a branch (if taken) or jump goes, computed from this instruction's address. */
  targetAddress?: number
}

export interface AsmError {
  /** 1-based source line; 0 for a problem with an option such as textBase. */
  line: number
  /** Plain message without the line prefix, e.g. "unknown register $t10". */
  message: string
}

/** Byte order in memory. R02 p8 calls our MIPS big-endian; QtSpim on a PC is little-endian (L10 p17-18). */
export type Endian = 'big' | 'little'

export interface Program {
  instructions: Instr[]
  labels: Record<string, number>
  data: { address: number; bytes: number[] }[]
  errors: AsmError[]
  /** Byte order used for .word/.half and by run(); big when absent. */
  endian?: Endian
}

export interface MemAccess {
  address: number
  size: 1 | 2 | 4
  /** Raw unsigned value of the bytes: 0..2^32-1 for a word, 0..65535 for a halfword, 0..255 for a byte. */
  value: number
}

export interface ExecFrame {
  pc: number
  instr: Instr
  /** All 32 registers after executing, as signed 32-bit values. */
  regs: number[]
  /** Destination registers written this step (a write to $zero is discarded and not listed). */
  changedRegs: number[]
  memWrites: MemAccess[]
  memReads: MemAccess[]
  nextPc: number
  /** Branches only. */
  taken?: boolean
  /** Register-transfer summary, e.g. "$t2 <- $t0 + $t1 = 5 + 3 = 8". */
  note: string
  /** One explanation per derived number in this step. */
  why: Explain[]
  /** Text printed by a syscall in this step. */
  output?: string
}

export interface RunOptions {
  /** Return address saved by jal. L08 p8 gives PC+4 (default); the green card gives PC+8. */
  jalLink?: 'pc+4' | 'pc+8'
}

export interface RunInit {
  regs?: Partial<Record<number, number>>
  /** Byte address -> byte, applied after the program's .data. */
  mem?: Record<number, number>
  /** Console input for read_int (syscall 5): one integer per line (Lab 4 p2). */
  input?: string
}

export interface RunResult {
  frames: ExecFrame[]
  halted: 'end' | 'maxSteps' | 'error'
  error?: string
  /** Registers before the first step (signed 32-bit). */
  initialRegs: number[]
  /** Memory before the first step: byte address -> byte. Replay with memoryAt(). */
  initialMem: Record<number, number>
  /** Everything printed by syscalls. */
  output: string
  /** Byte order the run used (memoryAt replays writes with it). */
  endian: Endian
  /** Source statements executed: a pseudo-instruction counts once, as L07 p38 counts ulw (Ex5: 42). frames.length counts real instructions. */
  statements: number
}
