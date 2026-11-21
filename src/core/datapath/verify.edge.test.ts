// Edge-case and robustness checks for the datapath engine (adversarial verifier).
// Failing tests here mark real gaps; passing ones are guards against regressions.
import { describe, expect, it } from 'vitest'
import { criticalPath, cycleTime, LATENCY_PRESETS, type TimingClass } from './timing'
import { traceDatapath } from './trace'
import type { DatapathInput, DatapathTrace } from './types'

function ok(input: DatapathInput): DatapathTrace {
  const r = traceDatapath(input)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r
}

const PS = LATENCY_PRESETS[0].delays

describe('hex word input a student would type', () => {
  // AY25/26 S1 Q7 word 0x02898820 = add $s1, $s4, $t1. Leading zeros are only notation (L08 p23: a 32-bit word),
  // so 0x2898820 is the same number and must decode the same way, not fall through to the assembler.
  it('AY25/26 Q7: 0x2898820 (leading zero dropped) traces as 0x02898820', () => {
    const t = ok({ source: '0x2898820' })
    expect(t.instr.word).toBe(0x02898820)
    expect(t.instr.mnemonic).toBe('add')
  })

  // Comments are stripped everywhere else in the input (Lab 3 SPIM-assembler p1); a hex word with a note after it is still one word.
  it('AY25/26 Q7: a hex word followed by a # comment still traces', () => {
    const t = ok({ source: '0x02898820 # add $s1, $s4, $t1' })
    expect(t.instr.word).toBe(0x02898820)
  })

  // docs/spec ambiguity 8: R06 p43 prints the FX4 word as 0x100000103 (9 digits) with PC 0x491.
  // A student copying the slide should get one plain error that the word is longer than 32 bits,
  // not "unknown instruction" plus an unrelated "text start 0x491 is not a multiple of 4".
  it('R06 p43 9-digit typo 0x100000103 at PC 0x491: one error saying the word is longer than 32 bits', () => {
    const r = traceDatapath({ source: '0x100000103', pc: 0x491 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].message).toMatch(/32 bits|8 (hex )?digits/i)
    expect(r.errors[0].message).not.toMatch(/unknown instruction/i)
  })
})

describe('short programs', () => {
  // A .data word sits at the default data base 0x10010000 (Lab 4 p4). The trace of lw from that address
  // must read it: data memory holds what the program put there (L11 p40), not 0.
  it('Lab 4 p4: lw reads a .data word the same source defines', () => {
    const t = ok({ source: '.data\narr: .word 5\n.text\nlw $t0, 0($t1)', regs: { 9: 0x10010000 } })
    expect(t.ports.dmReadData.value).toBe(5)
    expect(t.ports.WD.value).toBe(5)
    expect(t.commit.reg).toMatchObject({ number: 8, value: 5 })
  })

  it('R02 p8: explicit mem bytes are read big-endian', () => {
    const t = ok({ source: 'lw $t0, 0($t1)', regs: { 9: 0x2000 }, mem: { 0x2003: 7 } })
    expect(t.ports.dmReadData.value).toBe(7)
  })
})

describe('timing robustness', () => {
  // L12 p36: the cycle is the max over the classes given. An empty selection must not crash the page.
  it('cycleTime with no classes selected does not throw', () => {
    expect(() => cycleTime(PS, [])).not.toThrow()
  })

  it('all-zero delays give a 0 total without throwing', () => {
    const zero = { unit: 'ps' as const, values: Object.fromEntries(Object.keys(PS.values).map((k) => [k, 0])) as typeof PS.values }
    for (const c of ['R', 'addi', 'lw', 'sw', 'beq', 'bne'] as TimingClass[]) expect(criticalPath(c, zero).total).toBe(0)
  })

  it('random delays never throw and the total is at least the longest single unit on the path', () => {
    let s = 12345
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) % 1000)
    for (let n = 0; n < 300; n++) {
      const values = Object.fromEntries(Object.keys(PS.values).map((k) => [k, rnd()])) as typeof PS.values
      for (const c of ['R', 'addi', 'lw', 'sw', 'beq', 'bne'] as TimingClass[]) {
        const r = criticalPath(c, { unit: 'ps', values })
        expect(r.total).toBe(r.path.reduce((a, id) => a + r.nodes.find((x) => x.id === id)!.delay, 0))
      }
    }
  })
})

describe('never throws, deterministic, fast', () => {
  it('5000 random 32-bit words never throw', () => {
    let s = 987654321
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0))
    for (let n = 0; n < 5000; n++) {
      const w = rnd()
      expect(() => traceDatapath({ source: `0x${w.toString(16).padStart(8, '0')}`, pc: rnd() & ~3, regs: { [rnd() & 31]: rnd() } })).not.toThrow()
    }
  })

  it('odd but legal inputs never throw', () => {
    const cases: DatapathInput[] = [
      { source: '' }, { source: '\n\n' }, { source: '# only a comment' }, { source: 'L:' },
      { source: 'add $t0,$t1,$t2', index: -1 }, { source: 'add $t0,$t1,$t2', index: 0.5 }, { source: 'add $t0,$t1,$t2', pc: Number.NaN },
      { source: 'beq $0,$0,-2', pc: 0 }, { source: 'lw $t0, 1($t1)', regs: { 9: 0xfffffffe } }, { source: 'A: B: beq $t0,$t0,A' },
      { source: 'add $t0,$t1,$t2', regs: { 9: Number.NaN, 10: 2 ** 40 } }, { source: 'add $t0,$t1,$t2', muxStage: 'L12' },
    ]
    for (const c of cases) expect(() => traceDatapath(c)).not.toThrow()
  })

  it('same input twice gives the same trace', () => {
    const input = { source: 'sw $t0, -4($t1)', regs: { 8: 5, 9: 0x100 } }
    expect(JSON.stringify(traceDatapath(input))).toBe(JSON.stringify(traceDatapath(input)))
  })

  it('a 4000-instruction program traces its last instruction in well under 100 ms', () => {
    const src = Array.from({ length: 2000 }, (_, i) => `L${i}: add $t0,$t1,$t2\nbeq $t0,$t1,L${Math.max(0, i - 3)}`).join('\n')
    traceDatapath({ source: src, index: 3999 })
    const t0 = performance.now()
    const r = traceDatapath({ source: src, index: 3999 })
    expect(r.ok).toBe(true)
    expect(performance.now() - t0).toBeLessThan(100)
  })
})
