/** Edge cases, robustness and speed of the msi engine (adversarial verifier, edge lens). */
import { describe, expect, it } from 'vitest'
import { parseFunction, type BoolFunction } from '../boolean'
import { comparatorCircuit, decoderTree, findComparatorWirings, findDecoderWirings, priorityEquations } from './index'

const ABCD = ['A', 'B', 'C', 'D']
const fn = (text: string, vars: string[]): BoolFunction => {
  const r = parseFunction(text, { vars })
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}
const time = (f: () => unknown): number => {
  const t = performance.now()
  f()
  return performance.now() - t
}

describe('speed at exam size (contract: well under 100 ms)', () => {
  it('T07 Q5 / AY25/26 Q8 size: the comparator finder on 4 variables and a 4-bit comparator runs in under 100 ms', () => {
    const F = fn('Σm(12,13,14,15)', ABCD)
    findComparatorWirings(F) // warm up the JIT
    expect(time(() => findComparatorWirings(F))).toBeLessThan(100)
  })
  it('L18 p17 / R09 p56 size: the decoder finder on a 3x8 1-enable decoder with 4 variables runs in under 300 ms', () => {
    // Measured about 1.3 s: every candidate wiring rebuilds a full decoderCircuit (9 functions and Σm texts).
    // A 4x16 0-enable decoder on 4 variables takes about 25 s and freezes the page.
    const F = fn('Σm(8,9)', ABCD)
    const spec = { k: 3, enable: 'one', outputs: 'high' } as const
    let found = 0
    const ms = time(() => (found = findDecoderWirings(F, spec).solutions.length))
    expect(found).toBeGreaterThan(0)
    expect(ms).toBeLessThan(300)
  }, 20000)
})

describe('never throw on input a student can give (architecture: parsers and tools never throw)', () => {
  it('R09 p57 (AY18/19 Q5c) is an 8-variable gate-free comparator question: the finder must not throw on 8 variables', () => {
    const vars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const F = fn('A∙B∙C∙D∙E∙F∙G∙H', vars)
    expect(() => findComparatorWirings(F)).not.toThrow()
  })
  it('L18 p32-33: priority equations for a 16-to-4 priority encoder must not throw (and must return quickly)', () => {
    let ms = 0
    expect(() => {
      ms = time(() => priorityEquations(16))
    }).not.toThrow()
    expect(ms).toBeLessThan(2000)
  }, 20000)
})

describe('larger decoders from 1x2 blocks (L18 p17-19)', () => {
  it('2x4 from 1x2 decoders: the count explanation names the decoders the tree actually draws', () => {
    // Engine draws 2 decoders + 1 inverter but the working says "(2^2 - 1)/(2^1 - 1) = 3 decoders".
    const r = decoderTree(2, 1)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tree.why.count.working).toContain(`${r.tree.decoders} decoder`)
  })
  it('3x8 from 1x2 decoders: same check (engine draws 6 decoders + 1 inverter, text says 7)', () => {
    const r = decoderTree(3, 1)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tree.why.count.working).toContain(`${r.tree.decoders} decoder`)
  })
})

describe('comparator width in the explanation (R09 p52 uses a 2-bit comparator)', () => {
  it('a 2-pin wiring is explained with X1..X0, not X3..X0', () => {
    const r = comparatorCircuit({ x: ['A', 'B'], y: ['1', '0'] }, ['A', 'B'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.circuit.why.gt.rule).not.toContain('X3')
    expect(r.circuit.why.gt.rule).toContain('X1..X0')
  })
})
