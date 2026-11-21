/**
 * Course-fidelity checks written by the verifier. Each test re-derives an answer from the
 * course material (page cited in the name) and compares it with the engine.
 * Tests marked "regression" pass today; the others encode course behaviour the engine misses.
 */
import { describe, expect, it } from 'vitest'
import { PRESETS } from './fixtures'
import { OP_BY_NAME, assemble, decode, memoryAt, readWord, readWords, regNumber, run, wordsToMem, type Instr } from './index'

const R = (n: string) => regNumber(n)!

describe('QtSpim layout used by past papers', () => {
  // AY24/25 S1 Q18(e)-(f) assume Inst16 (j loop) at 0x00400078 and the key gives Inst4 at 0x00400048,
  // j loop = 0x08100012. That only happens when main starts at 0x00400024, where QtSpim puts user code
  // after its startup lines (Lab 3 p5), with la size as one lui and la A / la B as lui + ori.
  // AY21-22 S2 Q15(d) (I19 at 0x00400084) fits the same layout, so this is the papers' convention.
  it('AY24/25 S1 Q18 e-f (official key p16): the preset puts Inst16 at 0x00400078 and encodes j loop as 0x08100012', () => {
    const t = PRESETS.find((x) => x.id === 'AY24/25 Q18')!
    const p = assemble(t.source, t.textBase === undefined ? {} : { textBase: t.textBase })
    expect(p.errors).toEqual([])
    const inst16 = p.instructions.find((i) => i.mnemonic === 'j' && i.targetLabel === 'loop')!
    expect(inst16.address).toBe(0x00400078)
    expect(inst16.word).toBe(0x08100012)
    expect(p.labels.loop).toBe(0x00400048) // Inst4
  })

  it('AY21-22 S2 Q15 (regression, computed, no key): with main at 0x00400024, I19 is at 0x00400084, I5 at 0x0040004C, B = {1,3,2,5,3,8,2,5,5,4}', () => {
    const src = `.data
size: .word 5
A: .word 1, 2, 3, 4, 5
B: .word 5, 3, 4, 5, 3, 8, 2, 5, 9, 4
.text
main: la   $t0, size
      lw   $a0, 0($t0)
      la   $a1, A
      la   $a2, B
      add  $t0, $0, $0
      addi $t1, $a1, 0
      addi $t2, $a2, 0
      sll  $t3, $a0, 2
loop: slt  $t4, $t0, $t3
      beq  $t4, $0, end
      lw   $s1, 0($t1)
      lw   $s2, 0($t2)
      slt  $t4, $s1, $s2
      beq  $t4, $0, skip
      add  $t9, $s1, $0
      add  $s1, $s2, $0
      add  $s2, $t9, $0
skip: sw   $s1, 0($t1)
      sw   $s2, 0($t2)
      addi $t0, $t0, 4
      addi $t1, $t1, 4
      addi $t2, $t2, 8
      j    loop
end:  li   $v0, 10
      syscall`
    const p = assemble(src, { textBase: 0x00400024 })
    expect(p.errors).toEqual([])
    const j = p.instructions.find((i) => i.mnemonic === 'j')!
    expect(j.address).toBe(0x00400084)
    expect(j.word).toBe(0x08100013)
    expect(p.labels.loop).toBe(0x0040004c)
    expect(p.instructions.find((i) => i.address === 0x0040004c)!.word).toBe(0x010b602a)
    const r = run(p)
    expect(r.halted).toBe('end')
    expect(readWords(memoryAt(r, r.frames.length - 1), p.labels.B, 10)).toEqual([1, 3, 2, 5, 3, 8, 2, 5, 5, 4])
  })
})

describe('L07 p37-38 Exercise 5 (official answers): ulw loop', () => {
  // The spec (features/mips-isa.md, MIPS Stepper inputs) lists ulw, and L07 Ex5 is an official fixture.
  // The slide counts ulw as one instruction: 2 + 10 x 4 = 42.
  const src = `
          addi $t1, $t0, 10
          add  $t2, $zero, $zero
   Loop:  ulw  $t3, 0($t1)
          add  $t2, $t2, $t3
          addi $t1, $t1, -1
          bne  $t1, $t0, Loop`

  it('assembles and runs: bne executed 10 times, taken 9, 42 source instructions, 13 unique bytes read', () => {
    const p = assemble(src)
    expect(p.errors).toEqual([])
    const r = run(p, { regs: { [R('$t0')]: 0x10010000 } })
    expect(r.halted).toBe('end')
    const bne = r.frames.filter((f) => f.instr.mnemonic === 'bne' && !f.instr.pseudoOf)
    expect(bne).toHaveLength(10) // i. (d)
    expect(bne.filter((f) => f.taken)).toHaveLength(9) // ii. (c)
    // iii. (d) 42: count each source statement once per execution, however ulw is expanded.
    const firstOfLine = new Map<number, number>()
    for (const i of p.instructions) if (!firstOfLine.has(i.line)) firstOfLine.set(i.line, i.address)
    expect(r.frames.filter((f) => firstOfLine.get(f.instr.line) === f.instr.address)).toHaveLength(42)
    // iv. (d) 13: ten overlapping 4-byte windows from base+1 to base+13.
    const bytes = new Set<number>()
    for (const f of r.frames) for (const m of f.memReads) for (let k = 0; k < m.size; k++) bytes.add(m.address + k)
    expect(bytes.size).toBe(13)
  })
})

describe('green card (L08 p47: summarises the ISA used by this course)', () => {
  // T02 D1 shows godbolt output with addiu and addu and says they are on the card but not covered.
  // The card lists addiu (9hex) and addu (0/21hex), so the decoder should not call them
  // "not in the course instruction set" (mark them non-lecture instead).
  it('decodes addiu (opcode 0x09) and addu (funct 0x21) from the card', () => {
    const a = decode(0x24080005) as Instr & { error?: string }
    expect(a.error).toBeUndefined()
    expect(a.mnemonic).toBe('addiu')
    const b = decode(0x00851021) as Instr & { error?: string }
    expect(b.error).toBeUndefined()
    expect(b.mnemonic).toBe('addu')
  })

  it('sb (28hex) is on the course card, so its source is "green card", not "standard MIPS"', () => {
    expect(OP_BY_NAME.sb.source).toBe('green card')
  })
})

describe('regression: other official course programs', () => {
  const parity = `
      add  $t0, $s0, $zero
      lui  $t1, 0x8000
lp:   beq  $t0, $zero, e
      andi $t2, $t0, 1
      beq  $t2, $zero, s
      xor  $s0, $s0, $t1
s:    srl  $t0, $t0, 1
      j    lp
e:`

  it('T02 Q4 (official answers p6): $s0 = 31 ends as 0x8000001F, $s0 = 0x0AAAAAAA stays 0x0AAAAAAA', () => {
    const p = assemble(parity)
    expect(p.errors).toEqual([])
    for (const [s0, out] of [[31, 0x8000001f], [0x0aaaaaaa, 0x0aaaaaaa]]) {
      const r = run(p, { regs: { [R('$s0')]: s0 } })
      expect(r.halted).toBe('end')
      expect(r.frames[r.frames.length - 1].regs[R('$s0')] >>> 0).toBe(out)
    }
  })

  it('AY19-20 Q1 (computed, no key): $s0 = 0xBEBEC0C0 gives $s1 = 0x4A; 0xFFFFFFFF gives the max 0x78; bne = 0x1600FFFC', () => {
    const p = assemble(`
    addi $s1, $zero, 0
L:  andi $t0, $s0, 0xF
    add  $s1, $s1, $t0
    srl  $s0, $s0, 4
    bne  $s0, $zero, L`)
    expect(p.errors).toEqual([])
    expect(p.instructions[4].word).toBe(0x1600fffc)
    const last = (s0: number) => { const r = run(p, { regs: { [R('$s0')]: s0 } }); return r.frames[r.frames.length - 1].regs[R('$s1')] }
    expect(last(0xbebec0c0)).toBe(0x4a)
    expect(last(0xffffffff)).toBe(0x78)
  })

  it('AY18-19 Q1 (computed, no key): $s0 = 32 gives $t0 = 26, $t1 = 31; $s0 = 43 takes the two beqs 3 times', () => {
    const p = assemble(`
    addi $t0, $zero, 32
    addi $t1, $zero, 32
L:  beq  $s0, $zero, N
    andi $t2, $s0, 0x0001
    beq  $t2, $zero, E
    addi $t1, $t1, -1
E:  addi $t0, $t0, -1
    srl  $s0, $s0, 1
    j    L
N:`)
    expect(p.errors).toEqual([])
    const a = run(p, { regs: { [R('$s0')]: 32 } })
    const lastA = a.frames[a.frames.length - 1]
    expect([lastA.regs[R('$t0')], lastA.regs[R('$t1')]]).toEqual([26, 31])
    const b = run(p, { regs: { [R('$s0')]: 43 } })
    expect(b.frames.filter((f) => f.instr.mnemonic === 'beq' && f.taken)).toHaveLength(3)
  })
})

describe('course cases the engine rejects or reads differently (verifier, round 2)', () => {
  // AY24/25 S1 Q11 lists "andi $z, $x, -1" and "ori $z, $x, -1" as templates made of real MIPS instructions.
  // A logical immediate is a raw 16-bit pattern that is zero-extended (L08 p19; L06 p41, p46), so -1 is written
  // as 0xFFFF and used as 0x0000FFFF. That is also why the spec says andi with -1 is not the identity.
  it('AY24/25 S1 Q11 (official paper), L06 p46: andi/ori take -1 as the 16-bit pattern 0xFFFF, zero-extended', () => {
    const p = assemble('andi $s2, $s0, -1\nori $s3, $s0, -1')
    expect(p.errors).toEqual([])
    expect(p.instructions.map((i) => i.word)).toEqual([0x3212ffff, 0x3613ffff]) // ori rt = $s3 = 19, so 0x3613FFFF
    const r = run(p, { regs: { [R('$s0')]: 0x12345678 } })
    const last = r.frames[r.frames.length - 1]
    expect(last.regs[R('$s2')] >>> 0).toBe(0x00005678)
    expect(last.regs[R('$s3')] >>> 0).toBe(0x1234ffff)
  })

  // L08 p8 (summary table, an image): "j 2500" goes to 2500 x 4 = 10000 and "jal 2500" sets $ra = PC + 4 and goes
  // to 10000, just as "beq $s1, $s2, 25" goes to PC + 4 + 100. R04 p44 (Week-4 quiz Q7, marked true): the label in
  // a jump refers to the partial target address. The engine reads a numeric j operand as a byte address (2500).
  it('L08 p8 (official slide): a numeric j/jal operand is the 26-bit target field, so j 2500 goes to 10000', () => {
    const p = assemble('j 2500\njal 2500')
    expect(p.errors).toEqual([])
    expect(p.instructions.map((i) => i.word)).toEqual([0x080009c4, 0x0c0009c4])
    expect(p.instructions.map((i) => i.targetAddress)).toEqual([10000, 10000])
  })

  // L07 p12 names lh and sh; the course green card defines lhu (25hex, zero-extends) and sh (29hex, stores bits
  // 15-0); lh is standard MIPS 21hex and sign-extends like lb. docs/spec/features/mips-isa.md (Gaps) says the
  // stepper should support lh and sh and mark them non-lecture. Today they are "unknown instruction".
  it('L07 p12 + green card: sh, lhu and lh assemble (A5280002, 952A0002, 852B0002) and run big-endian', () => {
    const p = assemble('sh $t0, 2($t1)\nlhu $t2, 2($t1)\nlh $t3, 2($t1)')
    expect(p.errors).toEqual([])
    expect(p.instructions.map((i) => i.word)).toEqual([0xa5280002, 0x952a0002, 0x852b0002])
    const r = run(p, { regs: { [R('$t0')]: 0x12348001, [R('$t1')]: 0x10010000 } })
    expect(r.halted).toBe('end')
    const last = r.frames[r.frames.length - 1]
    expect(last.regs[R('$t2')]).toBe(0x8001)
    expect(last.regs[R('$t3')]).toBe(-32767) // 0xFFFF8001
  })

  // Lab 4 p1-2 lists print_int 1, print_string 4, read_int 5, exit 10; read_int returns the integer in $v0 and
  // reads one whole line (Lab 4 p2). Lab 5 p4 shows the same read_int sequence. The engine stops with
  // "syscall code 5 is not supported". The init field name `input` (text, one integer per line) is a proposal.
  it('Lab 4 p1-2, Lab 5 p4 (official): syscall 5 (read_int) puts the next input line in $v0', () => {
    const p = assemble('li $v0, 5\nsyscall\naddi $t0, $v0, 0\nli $v0, 5\nsyscall\naddi $t1, $v0, 0')
    expect(p.errors).toEqual([])
    const init = { regs: {}, input: '3\n-7\n' }
    const r = run(p, init)
    expect(r.error).toBeUndefined()
    expect(r.halted).toBe('end')
    const last = r.frames[r.frames.length - 1]
    expect([last.regs[R('$t0')], last.regs[R('$t1')]]).toEqual([3, -7])
  })

  it('R03 p62-63, p68 Week-3 quiz answers (official, regression): "4 ($t0)" with a space, and the slt/bne program', () => {
    const mem = wordsToMem(2004, [10, 15, 20])
    const regs = { [R('$t0')]: 2000, [R('$s0')]: 2010 }
    const lw = run(assemble('lw $s0, 4 ($t0)'), { regs, mem })
    expect(lw.frames[0].regs[R('$s0')]).toBe(10) // Q2
    const sw = run(assemble('sw $s0, 4 ($t0)'), { regs, mem })
    expect(readWord(memoryAt(sw, 0), 2004)).toBe(2010) // Q3
    const q8 = assemble('slt $t0, $s0, $s1\nbne $t0, $0, label1\nadd $s2, $s2, $s0\nj label2\nlabel1: add $s2, $s2, $s1\nlabel2:')
    expect(q8.errors).toEqual([])
    const r = run(q8, { regs: { [R('$s0')]: 10, [R('$s1')]: 15, [R('$s2')]: 20 } })
    expect(r.frames[r.frames.length - 1].regs[R('$s2')]).toBe(35) // Q8
  })
})
