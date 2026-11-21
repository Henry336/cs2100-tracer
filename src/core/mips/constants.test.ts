import { describe, expect, it } from 'vitest'
import { constantPlan } from './constants'

describe('32-bit constants (L06 p44-45)', () => {
  it('L06 p44 (official): 0xAAAAF0F0 is lui 0xAAAA then ori 0xF0F0; lui + addi would give 0xAAA9F0F0', () => {
    const p = constantPlan(0xaaaaf0f0)
    expect(p.lines).toEqual(['lui $t0, 0xAAAA', 'ori $t0, $t0, 0xF0F0'])
    expect(p.addi.ok).toBe(false)
    expect(p.addi.result).toBe(0xaaa9f0f0)
  })
  it('derived: one instruction when a half is 0; addi is fine when bit 15 is 0', () => {
    expect(constantPlan(0x00010000).lines).toEqual(['lui $t0, 0x0001'])
    expect(constantPlan(0xffff).lines).toEqual(['ori $t0, $zero, 0xFFFF'])
    expect(constantPlan(0x12345678).addi.ok).toBe(true)
  })
  it('L06 p45: C5, C16_2s and C16 ranges', () => {
    const fits = (v: number) => Object.fromEntries(constantPlan(v).fits.map((f) => [f.kind, f.ok]))
    expect(fits(31)).toEqual({ C5: true, C16_2s: true, C16: true })
    expect(fits(0xffff)).toEqual({ C5: false, C16_2s: false, C16: true })
    expect(fits(-1)).toEqual({ C5: false, C16_2s: true, C16: false })
    expect(fits(32768)).toEqual({ C5: false, C16_2s: false, C16: true })
  })
})
