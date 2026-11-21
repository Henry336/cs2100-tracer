import { describe, expect, it } from 'vitest'
import { memInitText, parseMemInit, parseRegInit, PRESETS, readWords, regInitText } from './index'

describe('initial values text', () => {
  it('parses registers by name or number, decimal or hex', () => {
    const r = parseRegInit('$t0 = 37, $s0 = 0x10010000\n$9=-1')
    expect(r.errors).toEqual([])
    expect(r.regs).toEqual({ 8: 37, 16: 0x10010000, 9: -1 })
  })

  it('reports bad register lines with line numbers', () => {
    const r = parseRegInit('$t0 = 1\n$t10 = 2\n$zero = 3\n$t1 = abc')
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4])
    expect(r.errors[0].message).toBe('unknown register $t10')
  })

  it('lays words out 4 bytes apart and rejects misaligned starts', () => {
    const r = parseMemInit('0x10010000: 7, -13 FFFFFFFF')
    expect(r.errors).toEqual([])
    expect(readWords(r.mem, 0x10010000, 3)).toEqual([7, -13, -1])
    expect(parseMemInit('0x10010002: 1').errors[0].message).toContain('not a multiple of 4')
  })

  it('round-trips every preset init through text', () => {
    for (const p of PRESETS) {
      const regs = parseRegInit(regInitText(p.init?.regs))
      expect(regs.errors).toEqual([])
      expect(regs.regs).toEqual(p.init?.regs ?? {})
      const mem = parseMemInit(memInitText(p.init?.mem))
      expect(mem.errors).toEqual([])
      const words = (m: Record<number, number>) => Object.keys(m).filter((a) => m[+a]).sort()
      expect(words(mem.mem)).toEqual(words(p.init?.mem ?? {}))
    }
  })
})
