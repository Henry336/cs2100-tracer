import { describe, expect, it } from 'vitest'
import { expandingOpcode, type ExpandingOpcodeInput } from './index'

const counts = (r: ReturnType<typeof expandingOpcode>) => Object.fromEntries(r.classes.map((c) => [c.name, c.count]))
const widths = (r: ReturnType<typeof expandingOpcode>) => Object.fromEntries(r.classes.map((c) => [c.name, c.opcodeBits]))
const byOpcode = (bits: number[], objective: 'max' | 'min'): ExpandingOpcodeInput => ({
  length: Math.max(...bits),
  objective,
  classes: bits.map((b, i) => ({ name: String.fromCharCode(65 + i), opcodeBits: b })),
})

describe('expanding opcode', () => {
  it('FX10 R04 p45 (official): 4-bit and 8-bit opcodes, max 241, min 31', () => {
    const max = expandingOpcode(byOpcode([4, 8], 'max'))
    expect(max.total).toBe(241)
    expect(counts(max)).toEqual({ A: 1, B: 240 })
    const min = expandingOpcode(byOpcode([4, 8], 'min'))
    expect(min.total).toBe(31)
    expect(counts(min)).toEqual({ A: 15, B: 16 })
    expect(min.unused).toBe(0)
    expect(min.levels.map((l) => [l.opcodeBits, l.available, l.passedDown])).toEqual([[4, 16, 1], [8, 16, 0]])
  })

  it('AY23/24 S2 Q7 (official): 16-bit, 512 B, 12 registers, C fixed at 2, max 226', () => {
    const r = expandingOpcode({
      length: 16,
      registers: 12,
      memoryBytes: 512,
      objective: 'max',
      classes: [{ name: 'A', regs: 2 }, { name: 'B', regs: 1, addresses: 1 }, { name: 'C', fixed: 2 }],
    })
    expect(r.error).toBeUndefined()
    expect(widths(r)).toEqual({ A: 8, B: 3, C: 16 })
    expect(counts(r)).toEqual({ A: 223, B: 1, C: 2 })
    expect(r.total).toBe(226)
    expect(r.unused).toBe(254)
    expect(r.steps[0].working).toBe('ceil(log2 12) = 4')
    expect(r.levels.map((l) => [l.opcodeBits, l.available, l.passedDown])).toEqual([[3, 8, 7], [8, 224, 1], [16, 256, 254]])
  })

  it('AY20-21 Q3 (computed, no key): 3/5/7-bit opcodes, max 110', () => {
    expect(expandingOpcode(byOpcode([3, 5, 7], 'max')).total).toBe(110)
  })

  it('AY15-16 Q6 (computed, no key): 4/6/8-bit opcodes, type C at most 236', () => {
    expect(counts(expandingOpcode(byOpcode([4, 6, 8], 'max'))).C).toBe(236)
  })

  it('Midterm AY25/26 Q27 (computed, no key): 64 registers, mixed lengths, opcodes 4/8/6, max 238, min 22', () => {
    const input = (objective: 'max' | 'min'): ExpandingOpcodeInput => ({
      length: 32,
      registers: 64,
      objective,
      classes: [
        { name: 'A', length: 16, regs: 2 },
        { name: 'B', regs: 3, otherBits: 6 },
        { name: 'C', regs: 2, otherBits: 14 },
      ],
    })
    const max = expandingOpcode(input('max'))
    expect(widths(max)).toEqual({ A: 4, B: 8, C: 6 })
    expect(max.total).toBe(238)
    expect(expandingOpcode(input('min')).total).toBe(22)
  })

  it('Finals Notes p4-5 (student notes): 6/8/11 gives min 74 max 2010; 6/11 gives max 2017 min 95', () => {
    expect(expandingOpcode(byOpcode([6, 8, 11], 'min')).total).toBe(74)
    expect(expandingOpcode(byOpcode([6, 8, 11], 'max')).total).toBe(2010)
    expect(expandingOpcode(byOpcode([6, 11], 'max')).total).toBe(2017)
    expect(expandingOpcode(byOpcode([6, 11], 'min')).total).toBe(95)
  })

  it('Recitation and Tutorial Extras p17-18 (derived): 24-bit P/Q/R/S, max 261,043', () => {
    const r = expandingOpcode({
      length: 24,
      objective: 'max',
      classes: [{ name: 'P', otherBits: 16 }, { name: 'Q', otherBits: 12 }, { name: 'R', otherBits: 10 }, { name: 'S', otherBits: 6 }],
    })
    expect(r.total).toBe(261043)
  })

  it('AY16-17 Q4c-d Zephyr (computed, no key): max 4,290,183,101, min 2075', () => {
    const z = (objective: 'max' | 'min'): ExpandingOpcodeInput => ({
      length: 32,
      objective,
      classes: [0, 3, 16, 19, 6, 22].map((b, i) => ({ name: 'ABCDEF'[i], otherBits: b })),
    })
    expect(expandingOpcode(z('max')).total).toBe(2 ** 32 - 2 ** 22 - 2 ** 19 - 2 ** 16 - 2 ** 6 - 2 ** 3 + 5)
    expect(expandingOpcode(z('max')).total).toBe(4290183101)
    expect(expandingOpcode(z('min')).total).toBe(2075)
  })

  it('reports impossible inputs instead of throwing', () => {
    expect(expandingOpcode({ length: 8, objective: 'max', classes: [{ name: 'A', otherBits: 8 }] }).error).toContain('0 bits')
    expect(expandingOpcode({ length: 8, objective: 'max', classes: [{ name: 'A', regs: 1 }] }).error).toContain('number of registers')
    expect(expandingOpcode({ length: 4, objective: 'max', classes: [{ name: 'A', opcodeBits: 2, fixed: 5 }] }).error).toContain('need')
  })
})
