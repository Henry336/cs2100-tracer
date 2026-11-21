import { describe, expect, it } from 'vitest'
import { loopIdeal } from './index'

describe('loop ideal-cycle counter', () => {
  it('P17a AY24/25 Q13 (official): 0x10 step -2, 8 iterations, I = 26, 30 cycles', () => {
    const r = loopIdeal({ init: 0x10, step: -2, exit: 0, body: 3, before: 1, after: 1 })
    expect([r.iterations, r.instructions, r.cycles]).toEqual([8, 26, 30])
  })
  it('P17b AY25/26 Q2 (official): 0x32 step -5, 10 iterations, I = 32, 36 cycles', () => {
    const r = loopIdeal({ init: 0x32, step: -5, exit: 0, body: 3, before: 1, after: 1 })
    expect([r.iterations, r.instructions, r.cycles]).toEqual([10, 32, 36])
  })
  it('P6 L21 p43 (official): 10 step -1, body 2, I = 22, ideal 26', () => {
    const r = loopIdeal({ init: 10, step: -1, exit: 0, body: 2, before: 1, after: 1 })
    expect([r.instructions, r.cycles]).toEqual([22, 26])
  })
  it('warns when the counter skips or never reaches the exit value (derived)', () => {
    expect(loopIdeal({ init: 0x11, step: -2, exit: 0, body: 3, before: 1, after: 1 }).iterations).toBeUndefined()
    expect(loopIdeal({ init: 0, step: -1, exit: 0, body: 3, before: 1, after: 1 }).iterations).toBeUndefined()
    expect(loopIdeal({ init: 4, step: 0, exit: 0, body: 3, before: 1, after: 1 }).why.iterations.rule).toMatch(/step is 0/)
  })
})
