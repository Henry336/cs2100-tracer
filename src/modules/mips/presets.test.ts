import { describe, expect, it } from 'vitest'
import { assemble, decode, expandingOpcode, parseMemInit, parseRegInit, run } from '../../core/mips'
import { ENCODE_PRESETS, OPCODE_PRESETS, RUN_PRESETS } from './presets'

describe('UI presets', () => {
  it('every Run preset assembles and runs to the end', () => {
    for (const p of RUN_PRESETS) {
      const prog = assemble(p.value.src, { textBase: Number(p.value.base) })
      expect(prog.errors, p.name).toEqual([])
      const r = run(prog, { regs: parseRegInit(p.value.regs).regs, mem: parseMemInit(p.value.mem).mem }, 2000)
      expect(r.halted, p.name).toBe('end')
    }
  })

  it('array sum gives 12, the palindrome check matches, AY25/26 Q14 andi gives 0x22, L06 p44 constant', () => {
    const final = (name: string) => {
      const p = RUN_PRESETS.find((x) => x.name.startsWith(name))!
      const r = run(assemble(p.value.src), { regs: parseRegInit(p.value.regs).regs })
      return r.frames[r.frames.length - 1].regs
    }
    expect(final('Array sum')[16]).toBe(12)
    expect(final('Palindrome')[19]).toBe(1)
    expect(final('andi zero-extends')[9]).toBe(0x22)
    expect(final('32-bit constant')[8] >>> 0).toBe(0xaaaaf0f0)
    expect(final('32-bit constant')[9] >>> 0).toBe(0xaaa9f0f0)
  })

  it('encode presets give the course answers', () => {
    const word = (name: string) => {
      const v = ENCODE_PRESETS.find((x) => x.name.startsWith(name))!.value
      return v.mode === 'asm' ? assemble(v.text, { textBase: Number(v.base) }).instructions[v.sel].word : (decode(Number(v.text.split('\n')[v.sel]), Number(v.base)) as { word: number }).word
    }
    expect(word('R-format')).toBe(0x012a4020)
    expect(word('Branch forward')).toBe(0x11200003)
    expect(word('Branch backward')).toBe(0x1000fffc)
    expect(word('Jump')).toBe(0x08000002)
    expect(word('lui')).toBe(0x3c11deaf)
    expect(word('Store')).toBe(0xad340000)
    expect(word('R-format: add $10')).toBe(0x00e55020)
    expect(word('addi $9')).toBe(0x2149ffe0)
    expect(word('beq $s0')).toBe(0x12110004)
    expect(word('lw $v1')).toBe(0x8de3ff9c)
    for (const p of ENCODE_PRESETS.filter((x) => x.value.mode === 'hex')) {
      for (const w of p.value.text.split('\n')) expect('error' in decode(Number(w)), p.name).toBe(false)
    }
  })

  it('opcode presets have no errors; R04 p45 gives 241', () => {
    const toIn = (v: (typeof OPCODE_PRESETS)[number]['value']) => ({
      length: Number(v.length),
      registers: v.registers ? Number(v.registers) : undefined,
      memoryBytes: v.memoryBytes ? Number(v.memoryBytes) : undefined,
      objective: v.objective,
      classes: v.classes.map((c) => Object.fromEntries(Object.entries(c).map(([k, x]) => [k, k === 'name' ? x : x === '' ? undefined : Number(x)]))) as never,
    })
    for (const p of OPCODE_PRESETS) expect(expandingOpcode(toIn(p.value)).error, p.name).toBeUndefined()
    expect(expandingOpcode(toIn(OPCODE_PRESETS[0].value)).total).toBe(241)
  })
})
