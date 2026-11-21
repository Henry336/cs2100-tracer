/** Types for the single-cycle datapath and control engine (L11, L12). */

import type { Explain, Instr } from '../mips'

export type { Explain }

/** A control bit as the course tables write it: 0, 1 or X (don't care). */
export type Bit = 0 | 1 | 'X'

export type SignalName = 'RegDst' | 'ALUSrc' | 'MemToReg' | 'RegWrite' | 'MemRead' | 'MemWrite' | 'Branch' | 'ALUop1' | 'ALUop0'

/** One row of the main control table (L12 p34), plus the derived BranchNE column for bne. */
export interface ControlRow {
  RegDst: Bit
  ALUSrc: Bit
  MemToReg: Bit
  RegWrite: Bit
  MemRead: Bit
  MemWrite: Bit
  Branch: Bit
  ALUop1: Bit
  ALUop0: Bit
  /** Only in the bne row (AY25/26 Ans p15). Absent means the course datapath has no such signal. */
  BranchNE?: Bit
}

/** Datapath units, named after the L11 p48 drawing. */
export type UnitId =
  | 'pc' | 'im' | 'add4' | 'control' | 'rf' | 'regdst' | 'sext' | 'alusrc' | 'aluctl' | 'alu'
  | 'shift' | 'badd' | 'and' | 'pcsrc' | 'dm' | 'memtoreg'

export type StageId = 'fetch' | 'decode' | 'alu' | 'memory' | 'regwrite'

/** Where the RegDst/ALUSrc muxes are drawn: L11 p31 (decode) or L12 p5 (ALUSrc in the ALU stage). */
export type MuxStagePolicy = 'L11' | 'L12'

export type WireKind = 'data' | 'control'

/**
 * used: the value reaches state that is written this cycle (PC, a register, memory) or decides the next PC.
 * discarded: the unit still computes it, but a mux or an enable throws it away (T04 Answers p3).
 * dontcare: a control wire whose table value is X.
 */
export type WireStatus = 'used' | 'discarded' | 'dontcare'

export interface WireSpec {
  id: string
  from: UnitId | 'const4'
  to: UnitId
  /** Port name on the receiving side, e.g. 'RR1', 'in0', 'Address'. */
  port: string
  label: string
  bits: number
  kind: WireKind
  stage: StageId
}

export interface WireValue extends WireSpec {
  /** Unsigned value on the wire, or null when the drawing has no defined value (memory output with MemRead 0). */
  value: number | null
  /** Control wires: the table value, which may be X. */
  bit?: Bit
  /** Display text, e.g. '0x0000000C' or '$3'. */
  text: string
  status: WireStatus
  why: Explain
}

/** A named port value of the T04 table and its friends. */
export interface PortValue {
  id: string
  label: string
  value: number | null
  /** Number shown to the student: hex for 32-bit values, $n for register numbers. */
  text: string
  /** T04 Answers p3 notation: $5 is a register number, [$5] its contents, Mem(X) a memory word. */
  symbolic: string
  /** false when control throws the value away (still computed). */
  used: boolean
  why: Explain
}

export interface Field {
  name: 'opcode' | 'rs' | 'rt' | 'rd' | 'shamt' | 'funct' | 'imm' | 'target'
  hi: number
  lo: number
  value: number
  bin: string
  /** Port or unit this field feeds in the course datapath ('unused' for shamt). */
  feeds: string
}

export interface StageFrame {
  index: number
  stage: StageId
  title: string
  cite: string
  /** What this stage does for this instruction. */
  does: string
  /** true when the stage does nothing useful for this instruction (memory for add, register write for sw). */
  idle: boolean
  units: UnitId[]
  /** Wires that get their value in this stage. */
  activeWires: string[]
  /** All wires known by the end of this stage (cumulative). */
  knownWires: string[]
  /** Control signals that act in this stage (L12 p5). */
  signals: { name: string; value: string; meaning: string }[]
  /** Stage outputs in R05 p38 style (register write has none). */
  outputs: { label: string; text: string; why: Explain }[]
}

export type SupportLevel = 'course' | 'derived' | 'unsupported'

export interface SupportInfo {
  level: SupportLevel
  /** true when the L11 p48 hardware cannot run it as drawn (bne needs extra gates; addi only lacks a control row, so false). */
  notInCourseDatapath: boolean
  notes: Explain[]
  /** What the L11 p48 hardware lacks for this instruction (unsupported only). */
  missing: string[]
  /** Unsupported only: which register fields the instruction reads and writes in the ISA (AY23/24 S2 Q10: sll and lui leave RR1 unused). */
  fieldUse?: { reads: ('rs' | 'rt')[]; writes: 'rs' | 'rt' | 'rd' | '$31' | null; why: Explain }
}

export interface Commit {
  pc: { value: number; why: Explain }
  reg: { number: number; value: number; why: Explain } | null
  mem: { address: number; value: number; why: Explain } | null
  /** Plain-language note, e.g. 'writes to $zero are ignored'. */
  notes: string[]
}

export interface DatapathTrace {
  ok: true
  instr: Instr
  pc: number
  support: SupportInfo
  fields: Field[]
  control: { row: ControlRow; source: Explain; aluop: string; aluControl: string; aluAction: string; pcSrc: number; pcSrcWhy: Explain; signalWhy: Partial<Record<keyof ControlRow, Explain>>; faults: ControlFault[] }
  ports: Record<string, PortValue>
  /** The T04 Q3 table in its column order. */
  t04: { label: string; port: string }[]
  wires: WireValue[]
  units: { id: UnitId; label: string; active: boolean; stage: StageId; why: string }[]
  frames: StageFrame[]
  commit: Commit
  /** Mistakes students make on this instruction, with cites. */
  traps: Explain[]
}

export interface DatapathError {
  ok: false
  errors: { line: number; message: string }[]
  /** Present when the instruction decoded but this datapath cannot run it. */
  instr?: Instr
  support?: SupportInfo
}

export type DatapathResult = DatapathTrace | DatapathError

export interface DatapathInput {
  /** One instruction as assembly or an 8-hex-digit word; a short program works too (see index). */
  source: string
  /** Address of the first instruction (default 0x00400000). */
  pc?: number
  /** Which real instruction of the source to trace (default 0). */
  index?: number
  /** Register number -> value. $zero is forced to 0. */
  regs?: Partial<Record<number, number>>
  /** Byte address -> byte, big-endian words (R02 p8). */
  mem?: Record<number, number>
  /** Stage placement of the RegDst/ALUSrc muxes (default L11). */
  muxStage?: MuxStagePolicy
  /** Hardware fault: control signals stuck at a value regardless of the table (AY15/16 Q9b MemToReg = 1, AY17/18 Q4c ALUSrc = 0). */
  faults?: Partial<Record<keyof ControlRow, 0 | 1>>
}

/** One faulted control signal: what the table gives and what the hardware outputs. */
export interface ControlFault {
  signal: keyof ControlRow
  table: Bit | undefined
  forced: 0 | 1
}
