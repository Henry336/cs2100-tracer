// Access-pattern generators for exam-style loops. All inputs are plain JSON so presets can live in the URL.
// Inputs arrive unchecked from the URL, so every count and index is checked to be a whole number, and no generator
// builds more accesses than simulate() steps through (LIMITS.accesses).
import { hex } from './format'
import { LIMITS, REPEAT_HINT } from './simulate'
import type { Access, AccessKind, Explain, Result } from './types'

/** A per-iteration condition on the loop variable i: run when i mod `mod` is one of `in`. (i&3)>>1 == 0 is { mod: 4, in: [0, 1] }. */
export interface IterCondition {
  mod: number
  in: number[]
}

const holds = (cond: IterCondition | undefined, i: number) => !cond || cond.in.includes(i % cond.mod)

const whole = (n: unknown): n is number => Number.isSafeInteger(n)

const tooMany = (n?: number) =>
  `${n === undefined ? `This loop makes more than ${LIMITS.accesses} accesses` : `This loop makes ${n} accesses`}; the simulator steps through at most ${LIMITS.accesses}. ${REPEAT_HINT}`

const loopCountErrors = (iterations: unknown): string[] =>
  !whole(iterations) || iterations < 0
    ? [`The loop count must be a whole number, 0 or more (got ${String(iterations)}).`]
    : iterations > LIMITS.accesses
      ? [tooMany()]
      : []

function conditionErrors(cond: IterCondition | undefined, where: string): string[] {
  if (cond === undefined) return []
  const fine = whole(cond?.mod) && cond.mod >= 1 && Array.isArray(cond.in) && cond.in.every(whole)
  return fine ? [] : [`${where}: the condition needs a whole-number modulus of at least 1 and a list of whole-number remainders.`]
}

export interface ArraySpec {
  name: string
  elemBytes: number
  length: number
  /** Omit to place the array right after the previous one (AY23/24 S2 Q18, AY20/21 Q15). */
  base?: number
}

export interface PlacedArray {
  name: string
  elemBytes: number
  length: number
  base: number
  why: Explain
}

export function layoutArrays(arrays: ArraySpec[]): Result<PlacedArray[]> {
  if (!Array.isArray(arrays)) return { ok: false, errors: ['List the arrays the loop uses.'] }
  const out: PlacedArray[] = []
  const errors: string[] = []
  arrays.forEach((a, i) => {
    if (!whole(a?.elemBytes) || a.elemBytes < 1 || !whole(a.length) || a.length < 0) {
      errors.push(`Array ${a?.name}: element size and length must be whole numbers (size 1 or more, length 0 or more).`)
      return
    }
    if (a.base !== undefined && (!whole(a.base) || a.base < 0)) {
      errors.push(`Array ${a.name}: the base address must be a whole number, 0 or more.`)
      return
    }
    const prev = out[i - 1]
    if (a.base !== undefined) {
      out.push({ ...a, base: a.base, why: { rule: `${a.name} starts at the given base address.`, working: hex(a.base) } })
    } else if (prev) {
      const base = prev.base + prev.length * prev.elemBytes
      out.push({
        ...a,
        base,
        why: {
          rule: `${a.name} follows ${prev.name} immediately: base = base of ${prev.name} + length × element size.`,
          working: `${hex(prev.base)} + ${prev.length} × ${prev.elemBytes} = ${hex(base)}`,
          cite: 'AY23/24 S2 Q18',
        },
      })
    } else {
      errors.push(`Array ${a.name}: the first array needs a base address.`)
    }
  })
  return errors.length ? { ok: false, errors } : { ok: true, value: out }
}

export interface LoopStep {
  array: string
  kind: AccessKind
  /** Loop variable i (default) or the counter k of iterations so far where `when` held. */
  index?: 'i' | 'k'
  /** Element = scale × index + offset, whole numbers. Defaults 1 and 0 (B[2i] is scale 2). */
  scale?: number
  offset?: number
  /** Only run in iterations where the loop's `when` condition holds. */
  conditional?: boolean
}

export interface ArrayLoopSpec {
  arrays: ArraySpec[]
  iterations: number
  steps: LoopStep[]
  when?: IterCondition
}

/** Data accesses of a 1D array loop such as for (i...) { if (cond) { x = A[i] + B[i]; C[k++] = x } }. */
export function arrayLoopTrace(spec: ArrayLoopSpec): Result<{ accesses: Access[]; arrays: PlacedArray[] }> {
  const placed = layoutArrays(spec?.arrays)
  if (!placed.ok) return placed
  if (!Array.isArray(spec.steps)) return { ok: false, errors: ['List the array accesses in one loop iteration.'] }
  const byName = new Map(placed.value.map((a) => [a.name, a]))
  const errors: string[] = loopCountErrors(spec.iterations)
  spec.steps.forEach((s, i) => {
    if (!byName.has(s?.array)) errors.push(`Step ${i + 1}: no array named ${s?.array}.`)
    else if ((s.scale !== undefined && !whole(s.scale)) || (s.offset !== undefined && !whole(s.offset))) {
      errors.push(`Step ${i + 1}: the index scale and offset must be whole numbers, as C array indices are.`)
    }
  })
  errors.push(...conditionErrors(spec.when, 'The loop'))
  if (errors.length) return { ok: false, errors }

  const accesses: Access[] = []
  let k = 0
  for (let i = 0; i < spec.iterations; i++) {
    const on = holds(spec.when, i)
    for (const s of spec.steps) {
      if (s.conditional && !on) continue
      const arr = byName.get(s.array)!
      const element = (s.scale ?? 1) * (s.index === 'k' ? k : i) + (s.offset ?? 0)
      if (element < 0 || element >= arr.length) return { ok: false, errors: [`Iteration ${i}: ${arr.name}[${element}] is outside the array (length ${arr.length}).`] }
      if (accesses.length === LIMITS.accesses) return { ok: false, errors: [tooMany()] }
      accesses.push({ address: arr.base + element * arr.elemBytes, kind: s.kind, label: `${arr.name}[${element}]`, group: arr.name })
    }
    if (on) k++
  }
  return { ok: true, value: { accesses, arrays: placed.value } }
}

export interface MatrixSpec {
  rows: number
  cols: number
  elemBytes: number
  /** 'row': i outer, j inner. 'col': j outer, i inner. */
  order: 'row' | 'col'
  /** Touched in this order for each element [i][j]. A transposed write B[j][i] is B[i][j] stored column-major. */
  arrays: { name: string; base: number; kind: AccessKind; storage: 'row' | 'col' }[]
}

/** 2D traversal (R02 p25-26 linearisation): row-major element [i][j] is at base + (i × cols + j) × size. */
export function matrixTrace(spec: MatrixSpec): Result<Access[]> {
  const errors: string[] = []
  if (!whole(spec?.rows) || spec.rows < 1 || !whole(spec.cols) || spec.cols < 1) errors.push('Rows and columns must be whole numbers, 1 or more.')
  if (!whole(spec?.elemBytes) || spec.elemBytes < 1) errors.push('Element size must be a whole number of bytes, 1 or more.')
  if (!Array.isArray(spec?.arrays)) errors.push('List the arrays the loop uses.')
  else spec.arrays.forEach((a) => !(whole(a?.base) && a.base >= 0) && errors.push(`Array ${a?.name}: the base address must be a whole number, 0 or more.`))
  if (errors.length) return { ok: false, errors }
  const n = spec.rows * spec.cols * spec.arrays.length
  if (n > LIMITS.accesses) return { ok: false, errors: [tooMany(n)] }

  const out: Access[] = []
  const outer = spec.order === 'row' ? spec.rows : spec.cols
  const inner = spec.order === 'row' ? spec.cols : spec.rows
  for (let o = 0; o < outer; o++) {
    for (let m = 0; m < inner; m++) {
      const [i, j] = spec.order === 'row' ? [o, m] : [m, o]
      for (const a of spec.arrays) {
        const linear = a.storage === 'row' ? i * spec.cols + j : j * spec.rows + i
        out.push({ address: a.base + linear * spec.elemBytes, kind: a.kind, label: `${a.name}[${i}][${j}]`, group: a.name })
      }
    }
  }
  return { ok: true, value: out }
}

export interface FetchSegment {
  /** Instruction numbers, 1-based and inclusive. */
  from: number
  to: number
  when?: IterCondition
}

export interface FetchLoopSpec {
  /** Address of instruction 1. */
  base: number
  instrBytes?: number
  prologue?: FetchSegment[]
  iterations: number
  body: FetchSegment[]
  /** Fetched once after the last iteration, e.g. the loop test that exits. */
  exit?: FetchSegment[]
}

/** Instruction fetch addresses for a loop: instruction n is at base + (n - 1) × 4 (AY23/24 S2 Q18). */
export function fetchLoopTrace(spec: FetchLoopSpec): Result<Access[]> {
  const size = spec?.instrBytes ?? 4
  const errors: string[] = []
  if (!whole(spec?.base) || spec.base < 0) errors.push('The address of instruction 1 must be a whole number, 0 or more.')
  if (!whole(size) || size < 1) errors.push('Instruction size must be a whole number of bytes, 1 or more.')
  errors.push(...loopCountErrors(spec?.iterations))
  const parts: [string, FetchSegment[] | undefined][] = [
    ['Before the loop', spec?.prologue],
    ['Loop body', spec?.body],
    ['After the loop', spec?.exit],
  ]
  for (const [name, segs] of parts) {
    if (segs === undefined) continue
    if (!Array.isArray(segs)) {
      errors.push(`${name}: list the instruction ranges.`)
      continue
    }
    segs.forEach((s, k) => {
      if (!whole(s?.from) || !whole(s.to) || s.from < 1 || s.to < s.from) errors.push(`${name}, range ${k + 1}: use whole instruction numbers from 1, with the end no smaller than the start.`)
      else errors.push(...conditionErrors(s.when, `${name}, range ${k + 1}`))
    })
  }
  if (errors.length) return { ok: false, errors }

  const out: Access[] = []
  /** False once the trace would pass LIMITS.accesses. */
  const emit = (segs: FetchSegment[] | undefined, i: number): boolean => {
    for (const s of segs ?? []) {
      if (!holds(s.when, i)) continue
      for (let n = s.from; n <= s.to; n++) {
        if (out.length === LIMITS.accesses) return false
        out.push({ address: spec.base + (n - 1) * size, kind: 'read', label: `i${n}`, group: 'fetch' })
      }
    }
    return true
  }
  let fits = emit(spec.prologue, 0)
  for (let i = 0; fits && i < spec.iterations; i++) fits = emit(spec.body, i)
  if (fits) fits = emit(spec.exit, spec.iterations)
  return fits ? { ok: true, value: out } : { ok: false, errors: [tooMany()] }
}
