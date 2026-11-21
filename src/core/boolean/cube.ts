import type { Expr } from './parse'
import { isLiteral, termsOf } from './expr'
import type { Cube, Form } from './types'

export const popcount = (x: number): number => {
  let c = 0
  for (; x; c++) x &= x - 1
  return c
}

export const covers = (c: Cube, m: number): boolean => (m & c.mask) === c.bits

export const mintermsOf = (c: Cube, n: number): number[] => Array.from({ length: 1 << n }, (_, m) => m).filter((m) => covers(c, m))

export const literalCount = (c: Cube): number => popcount(c.mask)

export const sameCube = (a: Cube, b: Cube): boolean => a.mask === b.mask && a.bits === b.bits

export interface Literal {
  v: string
  neg: boolean
}

/**
 * Literals of a cube in variable order. For `sop` the cube is a product term (bit 0 gives a complemented
 * literal). For `pos` the cube is a group of 0s and gives a sum term, so the polarity flips (L13 p20: a 0
 * bit gives an uncomplemented literal in a maxterm).
 */
export function literalsOf(c: Cube, vars: string[], form: Form): Literal[] {
  const n = vars.length
  const out: Literal[] = []
  vars.forEach((v, i) => {
    const bit = 1 << (n - 1 - i)
    if (c.mask & bit) out.push({ v, neg: form === 'sop' ? !(c.bits & bit) : !!(c.bits & bit) })
  })
  return out
}

const byName = (a: Literal, b: Literal) => (a.v < b.v ? -1 : a.v > b.v ? 1 : 0)

/** One term. `fitb` sorts literals alphabetically and uses . (AY23/24 S2 Q19d); `course` keeps variable order and ∙. */
export function termText(c: Cube, vars: string[], form: Form, style: 'course' | 'fitb' = 'course'): string {
  const lits = literalsOf(c, vars, form)
  if (style === 'fitb') lits.sort(byName)
  const parts = lits.map((l) => l.v + (l.neg ? "'" : ''))
  if (form === 'sop') return parts.length ? parts.join(style === 'course' ? '∙' : '.') : '1'
  return parts.length ? parts.join('+') : '0'
}

/** A whole SOP or POS expression from its terms, in the order given. */
export function coverText(cubes: Cube[], vars: string[], form: Form, style: 'course' | 'fitb' = 'course'): string {
  if (form === 'sop') return cubes.length ? cubes.map((c) => termText(c, vars, 'sop', style)).join(style === 'course' ? ' + ' : '+') : '0'
  if (!cubes.length) return '1'
  return cubes
    .map((c) => {
      const t = termText(c, vars, 'pos', style)
      return literalCount(c) > 1 ? `(${t})` : t
    })
    .join(style === 'course' ? '∙' : '.')
}

export type TermCube = { cube: Cube } | { constant: 0 | 1 } | { never: true } | null

/**
 * Turn one typed SOP term (product of literals) or POS term (sum of literals) into a cube.
 * Returns `never` for a term that can never contribute (A∙A' in SOP, A+A' in POS), a constant for 0/1,
 * and null when it is not a term of that form.
 */
export function termToCube(e: Expr, vars: string[], form: Form): TermCube {
  if (e.kind === 'const') return { constant: e.value }
  const lits = termsOf(e, form === 'sop' ? 'and' : 'or')
  if (!lits.every(isLiteral)) return null
  const n = vars.length
  let mask = 0
  let bits = 0
  for (const l of lits) {
    const name = l.kind === 'var' ? l.name : l.kind === 'not' && l.arg.kind === 'var' ? l.arg.name : ''
    const i = vars.indexOf(name)
    if (i < 0) return null
    const bit = 1 << (n - 1 - i)
    // SOP: plain literal needs bit 1. POS sum term: plain literal marks a 0 in the group.
    const value = (l.kind === 'var') === (form === 'sop') ? bit : 0
    if (mask & bit && (bits & bit) !== value) return { never: true }
    mask |= bit
    bits |= value
  }
  return { cube: { mask, bits } }
}
