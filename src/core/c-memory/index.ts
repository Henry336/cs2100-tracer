/** C memory tracer: parse a small C program, run it over real bytes, return one frame per step. */
import { Interp } from './interp'
import { parse, type CError } from './parser'
import { DEFAULT_CONFIG, hex, sizeWhy, T_CHAR, T_DOUBLE, T_FLOAT, T_INT, ptr, type CMemConfig, type Explain, type Layout } from './types'
import type { RunError, TraceFrame } from './view'

export type CTrace = {
  /** False when the program did not parse or stopped with a runtime error. */
  ok: boolean
  /** Parse errors (no frames) or the runtime error, each "line N: message". */
  errors: CError[]
  frames: TraceFrame[]
  summary: {
    output: string
    steps: number
    /** True when main returned normally. */
    finished: boolean
    runtimeError?: RunError
    warnings: CError[]
    config: CMemConfig
    /** The sizes this run uses, for a sizes legend. */
    sizes: { type: string; bytes: number; why: Explain }[]
    /** Conventions the tracer assumes, each with its source. */
    assumptions: Explain[]
  }
}

export function traceC(source: string, config: Partial<CMemConfig> = {}): CTrace {
  const cfg: CMemConfig = { ...DEFAULT_CONFIG, ...config }
  const L: Layout = { structs: {}, ptrSize: cfg.pointerSize }
  const summary: CTrace['summary'] = {
    output: '',
    steps: 0,
    finished: false,
    warnings: [],
    config: cfg,
    sizes: [
      { type: 'char', t: T_CHAR },
      { type: 'int', t: T_INT },
      { type: 'float', t: T_FLOAT },
      { type: 'double', t: T_DOUBLE },
      { type: 'pointer', t: ptr(T_INT) },
    ].map(({ type, t }) => ({ type, bytes: type === 'pointer' ? cfg.pointerSize : { char: 1, int: 4, float: 4, double: 8 }[type]!, why: sizeWhy(t, L) })),
    assumptions: [
      {
        rule: `Values bigger than one byte are stored ${cfg.endian}-endian: the ${cfg.endian === 'big' ? 'most' : 'least'} significant byte sits at the lowest address`,
        working: 'R02 p8 labels "our MIPS" big-endian and x86 little-endian; L10 p17 says MIPS endianness is implementation specific',
        cite: 'R02 p8',
      },
      {
        rule: `Addresses are fixed so diagrams stay stable: locals grow down from ${hex(cfg.stackTop)}, globals up from ${hex(cfg.globalBase)}, the heap from ${hex(cfg.heapBase)}. Real addresses vary from run to run`,
        cite: 'L04A p7',
      },
      { rule: 'Struct members sit back to back with no padding (the course never teaches padding; real compilers may add gaps)', cite: 'L05C p3' },
      { rule: 'A local with no initialiser holds garbage, so the tracer stops if one is read before it is given a value. Globals and static locals start as 0', cite: 'L02A p22' },
      {
        rule:
          cfg.pointerFormat === 'gcc'
            ? 'printf %p writes an address with a 0x prefix, as gcc on Linux does (the slides print it without one)'
            : 'printf %p writes an address as plain hex digits, as the slides print it (gcc on Linux adds a 0x prefix)',
        working: 'L04A p7 prints ffbff7dc; L04B p5 prints ffbff0a4',
        cite: 'L04A p7',
      },
      {
        rule: cfg.stdin
          ? 'scanf, fgets and getchar read the keyboard input given with the program, in order; at the end of it they return EOF (-1) or NULL'
          : 'No keyboard input is given, so scanf and getchar return EOF (-1) and fgets returns NULL; give input to run programs that read it',
        cite: 'L05B p5-7',
      },
    ],
  }
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(source, cfg.pointerSize)
  } catch (e) {
    return { ok: false, errors: [{ line: 0, message: crashMessage(e) }], frames: [], summary }
  }
  if (!parsed.ok) return { ok: false, errors: parsed.errors, frames: [], summary }

  const I = new Interp(parsed.program, cfg)
  try {
    I.run()
  } catch (e) {
    // a bug in the tracer must not take the page down
    const message = crashMessage(e)
    return { ok: false, errors: [{ line: 0, message }], frames: I.trace, summary: { ...summary, output: I.out, steps: I.trace.length, warnings: I.warnings } }
  }
  return {
    ok: !I.error,
    errors: I.error ? [{ line: I.error.line, message: I.error.message }] : [],
    frames: I.trace,
    summary: {
      ...summary,
      output: I.out,
      steps: I.trace.length,
      finished: !I.error,
      ...(I.error ? { runtimeError: I.error } : {}),
      warnings: I.warnings,
    },
  }
}

/** A bug in the tracer, or nesting so deep that JavaScript runs out of stack, must not take the page down. */
function crashMessage(e: unknown): string {
  if (e instanceof RangeError) return 'the program is nested too deeply for the tracer (very long expression or recursion); simplify it'
  return `internal tracer error: ${e instanceof Error ? e.message : String(e)}`
}

export { parse } from './parser'
export type { CError, ParseResult } from './parser'
export { arrayAddress, structLayout, endianBytes, wordFromBytes } from './helpers'
export type { ArrayAddressInput, ArrayAddressResult, StructLayoutResult, StructMemberInput, ByteCell } from './helpers'
export { DEFAULT_CONFIG, SCALAR_SIZE } from './types'
export type { CMemConfig, Endian, Explain } from './types'
export type { AliasGroup, CellKind, CellView, PointerEdge, RunError, StackFrameView, StepKind, TraceFrame, VarView } from './view'
export { PRESETS } from './presets'
export type { Preset } from './presets'
export { exprTreesByLine } from './exprtree'
export type { ExprNode, PrecRow } from './exprtree'
