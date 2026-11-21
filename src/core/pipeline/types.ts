// Public types for the pipeline engine. Inputs are plain JSON so they can live in the URL.
import type { AsmError, Instr, MemAccess, Program } from '../mips'

/** How a derived number was found. Rendered by <Why>. */
export interface Explain {
  rule: string
  working?: string
  cite?: string
}

export type Stage = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB'
export const STAGES: readonly Stage[] = ['IF', 'ID', 'EX', 'MEM', 'WB']
/** The pipeline register in front of each stage (L20 p16-17). IF has none (it reads the PC). */
export type PipeReg = 'IF/ID' | 'ID/EX' | 'EX/MEM' | 'MEM/WB'
export const PIPE_REGS: readonly PipeReg[] = ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB']

/** alu covers R-type, shifts and immediate arithmetic/logic; jr is a register jump (not taught in L20-L21). */
export type OpClass = 'alu' | 'load' | 'store' | 'branch' | 'jump' | 'jr' | 'other'

export interface PipelineOptions {
  /** EX/MEM->EX and MEM/WB->EX paths (L21 p18), plus ALU->ID and MEM->ID for an early branch (L21 p38-39). */
  forwarding: boolean
  /** Where a branch is decided: MEM in the base datapath (L21 p30-32) or ID with early branching (L21 p34-36). */
  branchStage: 'ID' | 'MEM'
  /** 'none' stalls until the branch is decided. 'taken' is beyond the lectures (L21 p40; used by R11 p45). */
  prediction: 'none' | 'not-taken' | 'taken'
  /** One delay slot after every beq/bne (L21 p46-48). A prediction, if set, still applies to the fetches after the slot (beyond the course). */
  delayedBranch: boolean
  /** j is not in L20-L21. AY23/24 S2 Q17 says ID; T10 Additional (e) says MEM. */
  jumpStage: 'ID' | 'MEM'
  /** lw then sw storing the loaded register: 'ex' treats the store data as an EX operand (1 stall);
   * 'mem' assumes a MEM/WB->MEM path (0 stalls). No source works this case (spec ambiguity 6). */
  storeData: 'ex' | 'mem'
}

export interface StreamOptions {
  /** Branch outcomes in dynamic order. When given, the program is walked without register values. */
  outcomes?: boolean[]
  /** Initial registers for running the code (register number -> value). */
  regs?: Partial<Record<number, number>>
  /** Initial memory bytes (byte address -> byte). */
  mem?: Record<number, number>
  textBase?: number
  /** Stop after this execution of a static instruction: 1-based number (i1 = 1) or its row name ('i20', 'H'). Default occurrence 1. */
  stopAfter?: { instr: number | string; occurrence?: number }
  /** Cap on counted dynamic instructions (at least 1). Default 300. */
  maxInstructions?: number
  /** Build the stream with one delay slot after every beq/bne (L21 p46). tracePipeline sets it from the options. */
  delayedBranch?: boolean
}

export interface StreamItem {
  /** 1-based position among counted (executed) instructions. */
  seq: number
  /** 0-based index into program.instructions. */
  index: number
  /** Row name: a '# i3' or '# Inst3' or '#inst A' comment tag, else i<n>. */
  name: string
  /** Source text without label and comment (canonical text for pseudo-instruction parts). */
  text: string
  instr: Instr
  cls: OpClass
  /** Source registers, $zero excluded. */
  reads: number[]
  /** For a store: the register whose value goes to memory (rt). */
  dataReg?: number
  /** Destination register, or null when nothing (or only $zero) is written. */
  writes: number | null
  /** Branch outcome. */
  taken?: boolean
  /** True for the instruction in a delay slot (delayed branching). */
  slot?: boolean
  /** Register and memory values when the stream came from running the code. */
  values?: { before: number[]; after: number[]; memRead?: MemAccess; memWrite?: MemAccess }
}

export interface Stream {
  ok: boolean
  errors: AsmError[]
  notes: string[]
  program: Program
  /** Row name and source text of every static instruction. */
  names: string[]
  texts: string[]
  /** 'number' when the source writes registers as $2, so explanations use the same style. */
  regStyle: 'name' | 'number'
  items: StreamItem[]
  /** True when items carry register values. */
  valued: boolean
  truncated: boolean
  /** True when the stream already has delay-slot semantics (slot items marked, run with the slot). */
  delaySlots?: boolean
}

export type Forwarder = 'EX/MEM' | 'MEM/WB' | 'register file'

export interface Forward {
  from: Forwarder
  to: 'ID' | 'EX' | 'MEM'
  /** Course name for the path, e.g. "EX/MEM -> EX" or "register file (split cycle)". */
  path: string
  producer: number
  consumer: number
  register: number
  /** Cycle in which the consumer uses the value. */
  cycle: number
  /** Set in a frame when one register feeds both ALU inputs (add $1,$1,$1): one entry per mux (T10 Answers p18). */
  input?: 'ForwardA' | 'ForwardB'
  why: Explain
}

export type StallKind = 'raw' | 'load-use' | 'branch-operand' | 'store-data' | 'branch' | 'jump'

export interface StallCause {
  kind: StallKind
  /** Extra cycles this cause alone forces on this instruction's WB (over previous WB + 1). */
  cycles: number
  /** True when this cause sets the instruction's delay. */
  binding: boolean
  /** Stage whose start was held back. */
  stage: Stage
  producer?: number
  register?: number
  /** seq of the branch or jump for control stalls. */
  control?: number
  why: Explain
}

/** One source operand that has an earlier producer (a RAW dependency on the nearest writer). */
export interface Operand {
  register: number
  producer: number
  distance: number
  /** Stage in which the consumer needs the value. */
  need: 'ID' | 'EX' | 'MEM'
  /** Stall cycles this dependency costs on its own, by the exam rules (distance based). */
  isolated: number
  /** Stall cycles it actually adds here (0 when an earlier stall already covered it). */
  stalls: number
  forward: Forward
  why: Explain
}

export interface Row {
  /** 'c<seq>' for counted instructions, 'w<seq>.<k>' for wrong-path fetches after counted instruction seq. */
  uid: string
  seq: number | null
  name: string
  text: string
  wrongPath: boolean
  /** Not in the program (fetched past its end), like i10-i12 in AY23/24 S1 Q16. */
  outside?: boolean
  /** Cycle of each stage reached. A flushed row has only the stages it reached. */
  stages: Partial<Record<Stage, number>>
  /** Cycle at whose end the row was squashed. */
  flushedAt?: number
  flushedBy?: number
  index: number | null
}

export interface InstrResult extends Row {
  seq: number
  index: number
  stages: Record<Stage, number>
  /** WB - (previous WB + 1): the "+n" of the AY23/24 S2 Q17 key. */
  delay: number
  delayWhy: Explain
  stalls: StallCause[]
  operands: Operand[]
  slot?: boolean
  taken?: boolean
  /** Wrong-path rows this branch or jump caused. */
  flushes: string[]
  /** Control rule applied after this instruction (branches and jumps). */
  control?: Explain
}

export type Bit = 0 | 1 | 'X'

export interface ControlRow {
  EX: { RegDst: Bit; ALUSrc: Bit; ALUop: string }
  M: { MemRead: Bit; MemWrite: Bit; Branch: Bit }
  WB: { MemToReg: Bit; RegWrite: Bit }
  /** Set when the row is not in the course table (L20 p27). */
  note?: string
}

export interface RegField {
  label: string
  text: string
  value?: number
  note?: string
}

export interface RegContents {
  /** null for a bubble (nop: every control signal 0). */
  uid: string | null
  name: string
  fields: RegField[]
  /** Control groups still carried by this register (L20 p27-28). */
  control: Partial<ControlRow>
  flushed?: boolean
}

export interface CycleFrame {
  cycle: number
  /** uid of the row doing each stage this cycle, or null (bubble). */
  stages: Record<Stage, string | null>
  /** Rows waiting between two stages (drawn as blank cells). */
  waiting: { uid: string; after: Stage }[]
  /** Register read by each stage this cycle, i.e. latched at the end of the previous cycle. */
  regs: Record<PipeReg, RegContents>
  forwards: Forward[]
  /** Register written in the first half of this cycle (split cycle, L21 p10-11). */
  regWrite?: { register: number; value?: number; by: string }
  events: string[]
}

export interface Dependency {
  kind: 'RAW' | 'WAR' | 'WAW'
  from: number
  to: number
  register: number
  distance: number
  stalls: number
  why: Explain
  /** Beyond the course: when WAR/WAW would matter. */
  beyond?: Explain
  /** How exam keys word it, when they differ from the lecture. */
  examNote?: string
}

export interface Totals {
  instructions: number
  stages: number
  ideal: number
  cycles: number
  stallCycles: number
  /** Instructions that were delayed (AY24/25 key style: "2 stalls ... each 2 cycles"; AY25/26 counts stallCycles instead). */
  stallEvents: number
  dataStallCycles: number
  controlStallCycles: number
  flushed: number
  /** Nops a compiler would insert for the data stalls (no hazard detection unit). */
  nops: { after: string; count: number }[]
  why: { ideal: Explain; cycles: Explain; stallCycles: Explain; nops: Explain }
}

export interface PipelineTrace {
  ok: boolean
  errors: AsmError[]
  notes: string[]
  options: PipelineOptions
  stream: Stream
  instructions: InstrResult[]
  /** Grid rows in fetch order, wrong-path rows included. */
  rows: Row[]
  frames: CycleFrame[]
  dependencies: Dependency[]
  totals: Totals
}
