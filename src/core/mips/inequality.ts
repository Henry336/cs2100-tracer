import type { Explain } from './types'

export type Cond = '<' | '>' | '<=' | '>='

export interface InequalityRow {
  /** Condition on which the branch is taken, e.g. a >= b. */
  cond: Cond
  pseudo: 'blt' | 'bgt' | 'ble' | 'bge'
  /** slt operands in order: 'ab' means slt $at, a, b. */
  sltOrder: 'ab' | 'ba'
  branch: 'bne' | 'beq'
}

/** All four come from slt: swap the operands for > and <=, use beq instead of bne to negate (L07 p28-30). */
export const INEQUALITIES: InequalityRow[] = [
  { cond: '<', pseudo: 'blt', sltOrder: 'ab', branch: 'bne' },
  { cond: '>', pseudo: 'bgt', sltOrder: 'ba', branch: 'bne' },
  { cond: '>=', pseudo: 'bge', sltOrder: 'ab', branch: 'beq' },
  { cond: '<=', pseudo: 'ble', sltOrder: 'ba', branch: 'beq' },
]

const NEGATE: Record<Cond, Cond> = { '<': '>=', '>=': '<', '>': '<=', '<=': '>' }

export interface InequalityInput {
  cond: Cond
  /** true: branch when cond holds; false: branch to skip the body when it fails, as an if compiles (L07 p22). */
  branchWhen: boolean
  a: string
  b: string
  label: string
  /** Register for the slt result; the assembler uses $at (T04 Q2a). */
  tmp: string
  aValue: number
  bValue: number
}

export interface InequalityResult {
  row: InequalityRow
  /** The condition the branch tests after any negation. */
  branchCond: Cond
  lines: [string, string]
  pseudoText: string
  slt: number
  taken: boolean
  steps: Explain[]
}

export function inequalityBranch(i: InequalityInput): InequalityResult {
  const branchCond = i.branchWhen ? i.cond : NEGATE[i.cond]
  const row = INEQUALITIES.find((r) => r.cond === branchCond)!
  const [x, y] = row.sltOrder === 'ab' ? [i.a, i.b] : [i.b, i.a]
  const [xv, yv] = row.sltOrder === 'ab' ? [i.aValue, i.bValue] : [i.bValue, i.aValue]
  const slt = xv < yv ? 1 : 0
  const taken = row.branch === 'bne' ? slt !== 0 : slt === 0
  const lines: [string, string] = [`slt ${i.tmp}, ${x}, ${y}`, `${row.branch} ${i.tmp}, $zero, ${i.label}`]
  const sltMeans = row.sltOrder === 'ab' ? `${i.a} < ${i.b}` : `${i.b} < ${i.a}`
  const steps: Explain[] = [
    i.branchWhen
      ? { rule: `Branch when ${i.a} ${i.cond} ${i.b}`, cite: 'L07 p28' }
      : { rule: `Skip the body when the condition fails: branch when ${i.a} ${branchCond} ${i.b}`, working: `not (${i.a} ${i.cond} ${i.b}) = ${i.a} ${branchCond} ${i.b}`, cite: 'L07 p22' },
    {
      rule: row.sltOrder === 'ab' ? `slt ${i.tmp}, ${i.a}, ${i.b} sets ${i.tmp} = 1 when ${i.a} < ${i.b}` : `Swap the operands: slt ${i.tmp}, ${i.b}, ${i.a} sets ${i.tmp} = 1 when ${i.b} < ${i.a}, that is ${i.a} > ${i.b}`,
      working: `${sltMeans}: ${xv} < ${yv} is ${xv < yv}, so ${i.tmp} = ${slt}`,
      cite: 'L07 p28-29',
    },
    row.branch === 'bne'
      ? { rule: `bne ${i.tmp}, $zero branches when slt gave 1`, working: `${i.tmp} = ${slt}: ${taken ? 'taken' : 'not taken'}`, cite: 'L07 p29' }
      : { rule: `beq ${i.tmp}, $zero branches when slt gave 0, which negates it: ${i.a} ${branchCond} ${i.b}`, working: `${i.tmp} = ${slt}: ${taken ? 'taken' : 'not taken'}`, cite: 'L07 p30' },
  ]
  return { row, branchCond, lines, pseudoText: `${row.pseudo} ${i.a}, ${i.b}, ${i.label}`, slt, taken, steps }
}
