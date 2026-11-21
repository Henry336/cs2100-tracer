import { describe, expect, it } from 'vitest'
import { inequalityBranch, type Cond, type InequalityInput } from './index'

const base: InequalityInput = { cond: '<', branchWhen: true, a: '$s1', b: '$s2', label: 'L', tmp: '$t0', aValue: 1, bValue: 2 }

describe('inequality branch builder', () => {
  it('L07 p29 (official): blt $s1, $s2, L is slt $t0, $s1, $s2 then bne $t0, $zero, L', () => {
    const r = inequalityBranch(base)
    expect(r.lines).toEqual(['slt $t0, $s1, $s2', 'bne $t0, $zero, L'])
    expect(r.pseudoText).toBe('blt $s1, $s2, L')
    expect(r.taken).toBe(true)
  })

  it('T03 D1(e) (official): slt $t5, $t4, $t3 then beq $t5, $zero, skip is bge $t4, $t3, skip', () => {
    const r = inequalityBranch({ ...base, cond: '>=', a: '$t4', b: '$t3', tmp: '$t5', label: 'skip' })
    expect(r.lines).toEqual(['slt $t5, $t4, $t3', 'beq $t5, $zero, skip'])
    expect(r.row.pseudo).toBe('bge')
  })

  it('L07 p22 and p30 (derived): if (a < b) skips its body with bge, and a > b swaps the slt operands', () => {
    const skip = inequalityBranch({ ...base, branchWhen: false })
    expect(skip.branchCond).toBe('>=')
    expect(skip.lines[1]).toMatch(/^beq/)
    expect(inequalityBranch({ ...base, cond: '>' }).lines[0]).toBe('slt $t0, $s2, $s1')
  })

  it('every condition and value pair branches exactly when the condition holds', () => {
    const holds = (c: Cond, x: number, y: number) => (c === '<' ? x < y : c === '>' ? x > y : c === '<=' ? x <= y : x >= y)
    for (const cond of ['<', '>', '<=', '>='] as Cond[])
      for (const branchWhen of [true, false])
        for (const aValue of [-2, 0, 3])
          for (const bValue of [-2, 0, 3]) {
            const r = inequalityBranch({ ...base, cond, branchWhen, aValue, bValue })
            expect(r.taken, `${cond} ${branchWhen} ${aValue} ${bValue}`).toBe(holds(r.branchCond, aValue, bValue))
            expect(r.taken).toBe(branchWhen ? holds(cond, aValue, bValue) : !holds(cond, aValue, bValue))
          }
  })
})
