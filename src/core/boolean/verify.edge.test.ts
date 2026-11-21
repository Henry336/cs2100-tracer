/**
 * Adversarial edge-case and robustness checks for the Boolean engine (verifier-owned).
 * Every test here encodes behaviour the engine must have; a failing test is a bug for the fixer.
 */
import { describe, expect, it } from 'vitest'
import { checkSteps } from './algebra'
import { defaultVars, parseFunction, termInfo } from './func'
import { lintAnswer } from './lint'
import { minimize } from './minimize'
import { parseExpr } from './parse'
import { traceKMap } from './trace'
import type { BoolFunction } from './types'

const VAR_NAME = /^[A-Za-z][0-9]*$/
const timed = <T,>(f: () => T): { value: T; ms: number } => {
  const s = performance.now()
  const value = f()
  return { value, ms: performance.now() - s }
}

describe('course notation: m1 + m3 and M0 ∙ M2 (L13 p23-24)', () => {
  it('F = m1 + m3 + m4 + m5 is Σm(1,3,4,5) (L13 p23 F3)', () => {
    const r = parseFunction('F(x,y,z) = m1 + m3 + m4 + m5')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.fn.vars).toEqual(['x', 'y', 'z'])
      expect(r.fn.on).toEqual([1, 3, 4, 5])
    }
  })

  it('F2 = M0 ∙ M2 ∙ M3 is ΠM(0,2,3) = Σm(1,4,5,6,7) (L13 p23-24 F2)', () => {
    const r = parseFunction('F(x,y,z) = M0 ∙ M2 ∙ M3')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.fn.on).toEqual([1, 4, 5, 6, 7])
  })

  it('without a header, m0 + m2 + m3 is not silently read as an OR of 3 variables named m0, m2, m3 (L13 p25)', () => {
    const r = parseFunction('m0 + m2 + m3')
    if (r.ok) expect(r.fn.vars).not.toContain('m0')
  })
})

describe('index lists: huge or out-of-scope sizes must fail fast, never hang or crash', () => {
  it('a huge range is rejected before it is expanded (Σm(0-3000000) on 3 variables)', () => {
    const { value: r, ms } = timed(() => parseFunction('F(A,B,C) = Σm(0-3000000)'))
    expect(r.ok).toBe(false)
    expect(ms).toBeLessThan(30)
  })

  it('a large range without a header does not throw (Math.max spread over 200001 items)', () => {
    expect(() => parseFunction('Σm(0-200000)')).not.toThrow()
  })

  it('a large index without a header never invents variable names past Z, and keeps the 16-variable cap of the expression form', () => {
    const r = parseFunction('Σm(100000000)')
    if (r.ok) {
      expect(r.fn.vars.every((v) => VAR_NAME.test(v))).toBe(true)
      expect(r.fn.vars.length).toBeLessThanOrEqual(16)
    }
  })

  it('a 20-variable header with ΠM(0) answers quickly (expression form caps at 16 variables)', () => {
    const vars = 'ABCDEFGHIJKLMNOPQRST'.split('')
    const { ms } = timed(() => parseFunction(`F(${vars.join(',')}) = ΠM(0)`))
    expect(ms).toBeLessThan(100)
  })

  it('a 31-variable header does not report a negative index range', () => {
    const vars = Array.from({ length: 31 }, (_, i) => `A${i}`)
    const r = parseFunction(`F(${vars.join(',')}) = Σm(1)`)
    if (!r.ok) expect(r.errors[0].message).not.toMatch(/-\d/)
  })
})

describe('parser must never throw (URL state can carry any text)', () => {
  it('5000 nested brackets give a result or a clean error', () => {
    expect(() => parseExpr('('.repeat(5000) + 'A' + ')'.repeat(5000))).not.toThrow()
  })

  it("A followed by 20000 primes gives a result or a clean error (parseExpr and parseFunction)", () => {
    const src = 'A' + "'".repeat(20000)
    expect(() => parseExpr(src)).not.toThrow()
    expect(() => parseFunction(src)).not.toThrow()
  })
})

describe('performance at exam size (under 100 ms)', () => {
  // 5 variables, 11 ones and 11 don't-cares: 59049 minimal covers. The count must stay exact
  // (AY23/24 S2 Q19(c) asks for it), but the engine must not build 59049 cover objects and frames.
  const all = Array.from({ length: 32 }, (_, i) => i)
  const mod3: BoolFunction = { name: 'F', vars: defaultVars(5), on: all.filter((i) => i % 3 === 0), dc: all.filter((i) => i % 3 === 1) }

  it('5-variable K-map with many minimal covers: minimize under 100 ms', () => {
    const { ms } = timed(() => minimize(mod3))
    expect(ms).toBeLessThan(100)
  })

  it('5-variable K-map with many minimal covers: trace stays steppable (at most 100 frames) and fast', () => {
    const { value: r, ms } = timed(() => traceKMap(mod3))
    expect(ms).toBeLessThan(100)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.trace.frames.length).toBeLessThanOrEqual(100)
  })

  it('5-variable K-map with many minimal covers: lintAnswer under 100 ms', () => {
    const { ms } = timed(() => lintAnswer('A', mod3))
    expect(ms).toBeLessThan(100)
  })

  it('step checker: canonical SOP of Σm(0,1,2,3,5,7,8,9,10,11) to its minimal form in one line (L15 p43 function)', () => {
    const canon = [0, 1, 2, 3, 5, 7, 8, 9, 10, 11].map((m) => termInfo(m, ['A', 'B', 'C', 'D']).minterm).join(' + ')
    checkSteps(canon + '\n' + "B' + A'∙D") // warm-up
    const { value: r, ms } = timed(() => checkSteps(canon + '\n' + "B' + A'∙D"))
    expect(r.steps[1].equivalent).toBe(true)
    expect(ms).toBeLessThan(100)
  })
})
