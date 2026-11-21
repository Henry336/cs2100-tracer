// Loading a 32-bit constant with lui + ori, and which immediate kinds a value fits (L06 p33, p41, p44-45).
import { hex } from './encoding'
import type { Explain } from './types'

export interface ConstantPlan {
  value: number
  upper: number
  lower: number
  /** Instructions that load the constant into `reg`. */
  lines: string[]
  fits: { kind: 'C5' | 'C16_2s' | 'C16'; ok: boolean; why: Explain }[]
  /** What lui + addi would give instead (wrong when bit 15 of the lower half is 1). */
  addi: { result: number; ok: boolean; why: Explain }
  why: { split: Explain; lines: Explain }
}

/** `value` may be signed or unsigned; it is taken as its 32-bit pattern. */
export function constantPlan(value: number, reg = '$t0'): ConstantPlan {
  const v = value >>> 0
  const upper = v >>> 16
  const lower = v & 0xffff
  const h4 = (n: number) => hex(n, 4)
  const lines = upper === 0 ? [`ori ${reg}, $zero, ${h4(lower)}`] : lower === 0 ? [`lui ${reg}, ${h4(upper)}`] : [`lui ${reg}, ${h4(upper)}`, `ori ${reg}, ${reg}, ${h4(lower)}`]
  const signed = value | 0
  const signedLower = lower >= 0x8000 ? lower - 0x10000 : lower
  const addiResult = ((upper << 16) + signedLower) >>> 0
  return {
    value: v,
    upper,
    lower,
    lines,
    fits: [
      { kind: 'C5', ok: v <= 31, why: { rule: 'C5 is an unsigned 5-bit shift amount, 0 to 31', working: `${v} ${v <= 31 ? 'is' : 'is not'} in 0 to 31`, cite: 'L06 p45' } },
      {
        kind: 'C16_2s',
        ok: signed >= -32768 && signed <= 32767,
        why: { rule: 'C16_2s is a 16-bit 2s complement number, -32768 to 32767; addi, slti, lw, sw, beq and bne sign-extend it', working: `${signed} ${signed >= -32768 && signed <= 32767 ? 'is' : 'is not'} in -32768 to 32767`, cite: 'L06 p45' },
      },
      { kind: 'C16', ok: v <= 0xffff, why: { rule: 'C16 is any 16-bit pattern, 0x0000 to 0xFFFF; andi, ori and xori zero-extend it', working: `${hex(v)} ${v <= 0xffff ? 'fits' : 'does not fit'} in 16 bits`, cite: 'L06 p41, p45' } },
    ],
    addi: {
      result: addiResult,
      ok: addiResult === v,
      why: {
        rule: 'addi sign-extends, so when bit 15 of the lower half is 1 it adds a negative number and the upper half drops by 1. ori zero-extends, so it is safe',
        working: `lui gives ${hex(upper << 16)}; addi adds ${signedLower} -> ${hex(addiResult)}${addiResult === v ? ' (correct here)' : `, not ${hex(v)}`}`,
        cite: 'L06 p41, p44',
      },
    },
    why: {
      split: { rule: 'Upper half = bits 31 to 16, lower half = bits 15 to 0', working: `${hex(v)} -> upper ${h4(upper)}, lower ${h4(lower)}`, cite: 'L06 p44' },
      lines: {
        rule: 'lui puts the upper half in place and fills the lower 16 bits with 0; ori then sets the lower half. If one half is 0, one instruction is enough',
        working: lines.join('; '),
        cite: 'L06 p44',
      },
    },
  }
}
