/** Shared types for the Boolean engine. Everything here is plain JSON so it can live in the URL. */

/** Explanation attached to every derived number (rendered with `<Why>`). */
export interface Explain {
  rule: string
  working?: string
  cite?: string
}

/** [start, end) character offsets into the source text. */
export type Span = [number, number]

/** A parse error or warning. `line` is set by multi-line inputs (algebra steps). */
export interface Issue {
  code: string
  message: string
  at: Span
  line?: number
  cite?: string
}

export type Bit = 0 | 1
export type CellValue = 0 | 1 | 'X'

/** A Boolean function over named variables. The first variable is the MSB of every index (L13 p21). */
export interface BoolFunction {
  name: string
  vars: string[]
  /** Minterms where F = 1, ascending. */
  on: number[]
  /** Don't-care indices, ascending. Never overlaps `on`. */
  dc: number[]
}

/**
 * A product term (or, for POS, a group of 0s) as bit masks over n variables.
 * Variable i (0 = first) is bit n-1-i. `mask` marks the variables that appear, `bits` their values.
 */
export interface Cube {
  mask: number
  bits: number
}

export type Form = 'sop' | 'pos'

export type Result<T> = ({ ok: true } & T) | { ok: false; errors: Issue[] }
