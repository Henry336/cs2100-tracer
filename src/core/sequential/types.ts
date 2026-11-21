/** Shared types for the sequential engine. Everything is plain JSON so it can live in the URL. */
import type { Explain, Issue } from '../boolean'

export type { Explain, Issue }

export type Bit = 0 | 1
/** A signal or table value: 0, 1 or X (don't care, invalid or unknown). */
export type Sig = 0 | 1 | 'X'

export type FFType = 'D' | 'T' | 'JK' | 'SR'

/** Input letters of each flip-flop type, in the order the course lists them (L19 p27, p45). */
export const FF_INPUTS: Record<FFType, string[]> = { D: ['D'], T: ['T'], JK: ['J', 'K'], SR: ['S', 'R'] }

/** One flip-flop of a circuit: its name (A, B, ...), type, and an equation per input letter. */
export interface FlipFlopSpec {
  name: string
  type: FFType
  /** Expression text per input letter, e.g. { J: 'B', K: "B∙x'" }. */
  inputs: Record<string, string>
}

export interface OutputSpec {
  name: string
  expr: string
}

/** A circuit to analyse: flip-flops (first = MSB of the state number), external inputs (first = MSB) and outputs. */
export interface CircuitSpec {
  flipFlops: FlipFlopSpec[]
  inputs: string[]
  outputs?: OutputSpec[]
  /** States the circuit is meant to use. When given, unused states are checked for self-correction. */
  used?: number[]
}

/**
 * A state machine as a table. States are numbered 0..count-1; for a circuit the number is the binary value of
 * the state bits, MSB first (L19 p30). `next[s][c]` is null when the table leaves it open (unused state or an
 * input combination that cannot happen, such as xy = 11 in T09 Q4).
 */
export interface Machine {
  /** State bit names, MSB first. Empty for a machine given with named states (T09 SE1). */
  bits: string[]
  inputs: string[]
  outputs: string[]
  /** Display name per state: the decimal number for a circuit, the letter for named states. */
  labels: string[]
  next: (number | null)[][]
  /** out[s][c][k] = output k in state s on input combination c. */
  out: Sig[][][]
  /** States in use; every state when not given. */
  used: number[]
}

export type Result<T> = ({ ok: true } & T) | { ok: false; errors: Issue[] }
