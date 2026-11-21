import { describe, expect, it } from 'vitest'
import { assemble, lineProfile, regNumber, run, uniqueBytesRead } from './index'

describe('line profile (L07 p37-38 Exercise 5, official answers)', () => {
  const p = assemble(`addi $t1, $t0, 10
add  $t2, $zero, $zero
Loop: ulw  $t3, 0($t1)
add  $t2, $t2, $t3
addi $t1, $t1, -1
bne  $t1, $t0, Loop`)
  const r = run(p, { regs: { [regNumber('$t0')!]: 0x10010000 } })
  const rows = lineProfile(p, r)

  it('counts each line once per pass, so ulw counts once and the total is 42', () => {
    expect(rows.map((x) => x.runs)).toEqual([1, 1, 10, 10, 10, 10])
    expect(rows.reduce((n, x) => n + x.runs, 0)).toBe(42)
  })

  it('bne runs 10 times and is taken 9; 13 unique bytes are read', () => {
    expect(rows[5]).toEqual({ line: 6, runs: 10, branches: 10, taken: 9 })
    expect(uniqueBytesRead(r)).toBe(13)
  })
})
