/** Wires: a pin is driven by a variable, a constant or a small expression (e.g. "A⊕D" in R09 p53). */
import { canonical, compile, functionFromValues, parseExpr, varsOf, type Bit, type BoolFunction, type CellValue, type Explain } from '../boolean'

export type { Bit, BoolFunction, CellValue, Explain }

/** A pin that could not be wired, named so the UI can point at it. */
export interface PinIssue {
  pin: string
  message: string
}

export type Built<T> = ({ ok: true } & T) | { ok: false; errors: PinIssue[] }

/** One driven pin: its text and its value on every row of the truth table. */
export interface Wire {
  pin: string
  text: string
  rows: Bit[]
  /** True when the wire is a complemented variable or a gate output (costs an inverter or gate, T07 p2). */
  needsGate: boolean
}

/** Parse every pin text against `vars` (first variable = MSB of the row index, L13 p21). */
/** Wired circuits list every row, so the variable count is capped (8 variables = 256 rows, the R09 p57 example). */
export const MAX_WIRE_VARS = 8

export function wireAll(pins: { pin: string; text: string }[], vars: string[]): Built<{ wires: Wire[] }> {
  if (vars.length < 1 || vars.length > MAX_WIRE_VARS) return { ok: false, errors: [{ pin: 'vars', message: `use 1 to ${MAX_WIRE_VARS} input variables` }] }
  const dup = vars.find((v, i) => vars.indexOf(v) !== i)
  if (dup) return { ok: false, errors: [{ pin: 'vars', message: `the variable ${dup} is listed twice` }] }
  const errors: PinIssue[] = []
  const wires: Wire[] = []
  for (const { pin, text } of pins) {
    const p = parseExpr(text.trim())
    if (!p.ok) {
      errors.push({ pin, message: `${pin}: ${p.errors[0]?.message ?? 'cannot read this wire'}` })
      continue
    }
    const unknown = varsOf(p.expr).filter((v) => !vars.includes(v))
    if (unknown.length) {
      errors.push({ pin, message: `${pin}: unknown variable ${unknown.join(', ')} (the inputs are ${vars.join(', ')})` })
      continue
    }
    const f = compile(p.expr, vars)
    const rows = Array.from({ length: 1 << vars.length }, (_, r) => f(r))
    const k = p.expr.kind
    wires.push({ pin, text: text.trim(), rows, needsGate: k !== 'var' && k !== 'const' })
  }
  return errors.length ? { ok: false, errors } : { ok: true, wires }
}

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

/** Binary string of `value`, `width` bits, MSB first. */
export const bin = (value: number, width: number): string => (width ? value.toString(2).padStart(width, '0') : '')

/** Function of `vars` from row values. */
export const fnFromRows = (name: string, vars: string[], rows: CellValue[]): BoolFunction => functionFromValues(vars, rows, name)

/** Σm text of a function, e.g. Σm(0, 2, 4). */
export const sigmaOf = (fn: BoolFunction): string => canonical(fn).sigma

/** Variable names for minterm m_i over selects S(k-1)..S0, e.g. S1'∙S0. */
export function mintermText(i: number, names: string[]): string {
  const k = names.length
  return names.map((s, j) => s + (((i >> (k - 1 - j)) & 1) ? '' : "'")).join('∙')
}

/** Maxterm M_i over the same names, e.g. S1+S0'. */
export function maxtermText(i: number, names: string[]): string {
  const k = names.length
  return names.map((s, j) => s + (((i >> (k - 1 - j)) & 1) ? "'" : '')).join('+')
}

/** Names S(k-1)..S0, MSB first (L18 p13, p38). */
export const selectNames = (k: number): string[] => range(k).map((j) => `S${k - 1 - j}`)

/** Value of the select pins on a row, MSB first. */
export const selectValue = (wires: Wire[], row: number): number => wires.reduce((acc, w) => (acc << 1) | w.rows[row], 0)
