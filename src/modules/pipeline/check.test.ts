import { describe, expect, it } from 'vitest'
import { tracePipeline } from '../../core/pipeline'
import { expected, markRow } from './CheckGrid'

// L21 p21-23 exercise 1 without forwarding: and waits 2 cycles, 11 cycles in all.
const SRC = 'sub $2, $1, $3\nand $12, $2, $5\nor $13, $6, $2\nadd $14, $2, $2\nsw $15, 100($2)'

describe('Pipeline check mode', () => {
  it('expects the +n delay and WB cycle of each instruction', () => {
    const want = expected(tracePipeline(SRC, { forwarding: false }))
    expect(want.map((w) => [w.delay, w.wb])).toEqual([
      [0, 5],
      [2, 8],
      [0, 9],
      [0, 10],
      [0, 11],
    ])
    expect(want[1].why[0].rule).toMatch(/No forwarding/)
  })
  it('marks typed answers', () => {
    expect(markRow('', 2)).toBe('blank')
    expect(markRow(' +2 ', 2)).toBe('right')
    expect(markRow('1', 2)).toBe('wrong')
  })
})
