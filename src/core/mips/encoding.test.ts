import { describe, expect, it } from 'vitest'
import { AY2324S2_Q16, AY2425_Q18_LOOP, T03_D1 } from './fixtures'
import { assemble, decode, encode, instrText, regName, regNumber, type Instr } from './index'

/** Assemble and fail the test on any assembly error. */
function asm(source: string, textBase?: number) {
  const p = assemble(source, textBase === undefined ? {} : { textBase })
  expect(p.errors).toEqual([])
  return p
}
const word = (line: string) => asm(line).instructions[0].word
const dec = (w: number, address = 0) => decode(w, address) as Instr

describe('registers (L08 p7)', () => {
  it('maps names and numbers both ways', () => {
    expect(regNumber('$t0')).toBe(8)
    expect(regNumber('$8')).toBe(8)
    expect(regNumber('t0')).toBe(8)
    expect(regNumber('$zero')).toBe(0)
    expect(regNumber('$ra')).toBe(31)
    expect(regNumber('$t8')).toBe(24)
    expect(regNumber('$t10')).toBeUndefined()
    expect(regNumber('$32')).toBeUndefined()
    expect(regNumber('8')).toBeUndefined()
    expect(regName(17)).toBe('$s1')
    expect(regName(29)).toBe('$sp')
  })
})

// Each row: [spec id, official?, assembly, expected word]
const SINGLE: [string, boolean, string, number][] = [
  ['FX7 L08 p12', true, 'add $8,$9,$10', 0x012a4020],
  ['FX7 L08 p13', true, 'sll $8,$9,4', 0x00094100],
  ['FX7 L08 p14', true, 'add $10,$7,$5', 0x00e55020],
  ['FX7 L08 p21', true, 'addi $21,$22,-50', 0x22d5ffce],
  ['FX7 L11 p29 (computed)', false, 'lw $21,-50($22)', 0x8ed5ffce],
  ['FX7 L11 p42 (computed)', false, 'sw $21,-50($22)', 0xaed5ffce],
  ['FX7 L08 p31', true, 'beq $9,$0,3', 0x11200003],
  ['FX7 L08 p22', true, 'lw $9,12($8)', 0x8d09000c],
  ['FX1 T04 Q3', true, 'beq $1,$3,12', 0x1023000c],
  ['FX2 T04 Q3', true, 'lw $24,0($15)', 0x8df80000],
  ['FX3 T04 Q3', true, 'sub $25,$20,$5', 0x0285c822],
  ['FX6 AY25/26 midterm Q20 (no key)', false, 'add $t4,$v0,$s1', 0x00516020],
  ['R04 p38', true, 'addi $9,$10,-32', 0x2149ffe0],
  ['R04 p39', true, 'beq $s0,$s1,4', 0x12110004],
  ['AY25/26 Q6', true, 'lui $s1,57007', 0x3c11deaf],
  ['AY23/24 S2 Q16e', true, 'slt $t1,$t0,$s0', 0x0110482a],
  ['AY23/24 S2 Q16g', true, 'sw $t3,0($a3)', 0xaceb0000],
  ['AY24/25 Q18d', true, 'sw $s4,0($t1)', 0xad340000],
  ['Midterm AY25/26 Q13 (no key)', false, 'lw $v1,-100($t7)', 0x8de3ff9c],
  ['AY21-22 S1 Q8 (no key)', false, 'andi $4,$3,1', 0x30640001],
  ['AY21-22 S2 Q15 (no key)', false, 'slt $t4,$t0,$t3', 0x010b602a],
  ['AY19-20 Q1 (no key)', false, 'srl $s0,$s0,4', 0x00108102],
  ['AY18-19 Q1 (no key)', false, 'srl $s0,$s0,1', 0x00108042],
  ['AY17-18 Q5 (no key)', false, 'sll $t8,$t8,2', 0x0018c080],
  ['AY17-18 Q5 (no key)', false, 'slt $t7,$t8,$zero', 0x0300782a],
  ['AY16-17 Q3 (no key)', false, 'add $s2,$s0,$zero', 0x02009020],
  ['AY21-22 S1 Q14 (no key)', false, 'lw $s1,0($t1)', 0x8d310000],
  ['T04 Q2(e) nop', true, 'nop', 0x00000000],
]

describe('single-instruction encodings', () => {
  it.each(SINGLE)('%s (official %s): %s', (_id, _official, line, expected) => {
    expect(word(line)).toBe(expected >>> 0)
  })

  it('FX7 L08 p21: addi immediate -50 is 0xFFCE and sign-extends to 0xFFFFFFCE', () => {
    const i = asm('addi $21,$22,-50').instructions[0]
    expect(i.imm).toBe(-50)
    expect((i.imm >>> 0).toString(16)).toBe('ffffffce')
  })

  it('FX3: sub keeps imm bits sign-extended for the datapath (0xC822 -> 0xFFFFC822)', () => {
    expect(asm('sub $25,$20,$5').instructions[0].imm >>> 0).toBe(0xffffc822)
  })
})

describe('label-based branch and jump encodings', () => {
  it('FX7 L08 p31 (official): beq to End 16 bytes below gives imm 3', () => {
    const p = asm('beq $9,$0,End\nnop\nnop\nnop\nEnd: nop', 0)
    expect(p.instructions[0].word).toBe(0x11200003)
    expect(p.instructions[0].targetAddress).toBe(16)
  })

  it('FX7 L08 p32 (official): backward beq at 12 to Loop at 0 gives imm -4', () => {
    const p = asm('Loop: nop\nnop\nnop\nbeq $0,$0,Loop', 0)
    expect(p.instructions[3].imm).toBe(-4)
    expect(p.instructions[3].word).toBe(0x1000fffc)
  })

  it('FX7 L08 p41 (official): j Loop at 20 with Loop at 8 is 0x08000002', () => {
    const p = asm('nop\nnop\nLoop: nop\nnop\nnop\nj Loop', 0)
    expect(p.instructions[5].address).toBe(20)
    expect(p.instructions[5].word).toBe(0x08000002)
  })

  it('FX8 T03 Q2 (official): coffee-spill program at 0x00400028', () => {
    const p = asm(
      `addi $s1, $zero, 0
loop: srl $t0, $t0, 1
      beq $t0, $zero, exit
      addi $s1, $s1, 1
      j loop
exit:`,
      0x00400028,
    )
    expect(p.instructions.map((i) => i.word)).toEqual([0x20110000, 0x00084042, 0x11000002, 0x22310001, 0x0810000b])
    expect(p.labels.exit).toBe(0x0040003c)
    expect(p.instructions[2].targetAddress).toBe(0x0040003c)
  })

  it('T03 Q3(b)-(d) (official): binary search at 0xFFFFFF00, bne imm 16, both j loopEnd = 0x0BFFFFD1', () => {
    const p = asm(
      `loop: slt $t9, $s3, $s2
   bne $t9, $zero, end
   add $s4, $s2, $s3
   srl $s4, $s4, 1
   sll $t0, $s4, 2
   add $t0, $s0, $t0
   lw  $t1, 0($t0)
   slt $t9, $s1, $t1
   beq $t9, $zero, bigger
   addi $s3, $s4, -1
   j loopEnd
bigger:
   slt $t9, $t1, $s1
   beq $t9, $zero, equal
   addi $s2, $s4, 1
   j loopEnd
equal:
   add $s5, $s4, $zero
   j end
loopEnd:
   j loop
end:`,
      0xffffff00,
    )
    expect(p.instructions[1].imm).toBe(16)
    expect(p.labels.loopEnd).toBe(0xffffff44)
    const jumps = p.instructions.filter((i) => i.targetLabel === 'loopEnd')
    expect(jumps.map((i) => i.word)).toEqual([0x0bffffd1, 0x0bffffd1])
  })

  it('AY23/24 S2 Q16f,h (official): bne $t1,$0,skip = 15200006, j loop = 08100019 with i1 at 0x00400050', () => {
    const p = asm(AY2324S2_Q16, 0x00400050)
    const byTag = (n: number) => p.instructions[n - 1]
    expect(byTag(6).word).toBe(0x0110482a)
    expect(byTag(10).word).toBe(0x15200006)
    expect(byTag(14).word).toBe(0xaceb0000)
    expect(byTag(20).word).toBe(0x08100019)
    expect(p.labels.loop).toBe(0x00400064)
  })

  it('AY24/25 Q18c,e,f (official): Inst16 at 0x00400078 puts Inst4 at 0x00400048', () => {
    const p = asm(AY2425_Q18_LOOP, 0x0040003c)
    const inst = (n: number) => p.instructions[n - 1]
    expect(inst(16).address).toBe(0x00400078)
    expect(inst(4).address).toBe(0x00400048)
    expect(inst(5).word).toBe(0x1180000b)
    expect(inst(12).word).toBe(0xad340000)
    expect(inst(16).word).toBe(0x08100012)
  })

  it('T03 D1(d) (official): the bne back to loop has immediate -9', () => {
    const p = asm(T03_D1)
    expect(p.instructions.find((i) => i.mnemonic === 'bne')!.imm).toBe(-9)
  })

  it('AY21-22 S1 Q8 (computed, no key): hand-assembled loop at address 0', () => {
    const p = asm('addi $3,$0,0\naddi $5,$0,0\nloop: addi $3,$3,1\nandi $4,$3,1\nbne $4,$0,loop\naddi $5,$5,1\nj loop', 0)
    expect(p.instructions.map((i) => i.word)).toEqual([0x20030000, 0x20050000, 0x20630001, 0x30640001, 0x1480fffd, 0x20a50001, 0x08000002])
  })
})

describe('decode', () => {
  it('FX8 T03 Q2 (official): decodes the spilled words back to the program', () => {
    const words = [0x20110000, 0x00084042, 0x11000002, 0x22310001, 0x0810000b]
    const texts = words.map((w, k) => dec(w, 0x00400028 + 4 * k).text)
    expect(texts).toEqual(['addi $s1, $zero, 0', 'srl $t0, $t0, 1', 'beq $t0, $zero, 2', 'addi $s1, $s1, 1', 'j 0x0040002C'])
    expect(instrText(dec(0x20110000), 'number')).toBe('addi $17, $0, 0')
  })

  it('R04 p40-41 (official)', () => {
    expect(instrText(dec(0x8d8bff1d), 'number')).toBe('lw $11, -227($12)')
    expect(instrText(dec(0x001289c2), 'number')).toBe('srl $17, $18, 7')
  })

  it('AY25/26 Q7 and AY24/25 (official): R-type decodes', () => {
    expect(dec(0x02898820).text).toBe('add $s1, $s4, $t1')
    expect(dec(0x0235c020).text).toBe('add $t8, $s1, $s5')
  })

  it('AY25/26 Q15 (official): 0x12310003 at 0x1000 is beq $s1,$s1,3 to 0x1010', () => {
    const d = dec(0x12310003, 0x1000)
    expect(d.text).toBe('beq $s1, $s1, 3')
    expect(d.targetAddress).toBe(0x1010)
    expect(dec(0x08000404, 0x1000).targetAddress).toBe(0x1010)
    expect(dec(0x08000003, 0x1000).targetAddress).toBe(0x0000000c)
    expect(dec(0x15100003, 0x1000).text).toBe('bne $t0, $s0, 3')
    expect(dec(0x13a00003, 0x1000).text).toBe('beq $sp, $zero, 3')
  })

  it('FX4 R06 p43-44 (official): 0x10000103 at PC 0x491 branches to 0x8A1', () => {
    const d = dec(0x10000103, 0x491)
    expect(d.text).toBe('beq $zero, $zero, 259')
    expect(d.targetAddress).toBe(0x8a1)
  })

  it('FX5 R05 Q8 (official): beq $9,$0,End = 0x11200004 at 0x1080 goes to 0x1094', () => {
    expect(word('beq $9,$0,4')).toBe(0x11200004)
    expect(dec(0x11200004, 0x1080).targetAddress).toBe(0x1094)
  })

  it('Midterm AY25/26 Q14 (computed, no key): 0x12C3FBAD at 0x5204 targets 0x40BC', () => {
    const d = dec(0x12c3fbad, 0x5204)
    expect(d.text).toBe('beq $s6, $v1, -1107')
    expect(d.targetAddress).toBe(0x40bc)
  })

  it('AY18-19 Q3b (computed): j 0x0800C840 at 0x2100FFFC targets 0x20032100', () => {
    expect(dec(0x0800c840, 0x2100fffc).targetAddress).toBe(0x20032100)
  })

  it('lui and logical immediates are zero-extended, the rest sign-extended (L08 p19)', () => {
    expect(dec(0x3c11deaf).imm).toBe(0xdeaf)
    expect(dec(0x3109cafe).imm).toBe(0xcafe)
    expect(dec(0x2149ffe0).imm).toBe(-32)
  })

  it('rejects words outside the course set', () => {
    expect(decode(0xfc000000)).toHaveProperty('error')
    expect(decode(0x0000003f)).toHaveProperty('error')
  })

  it('encode(decode(w)) returns w for every supported instruction', () => {
    const words = [0x012a4020, 0x00094100, 0x22d5ffce, 0x8d09000c, 0x0810000b, 0x0c100000, 0x03e00008, 0x0000000c, 0x3c11deaf, 0xa1090003, 0x81090003, 0x91090003, 0x01095027, 0x01095026, 0x3909ffff, 0x2909fff0]
    for (const w of words) {
      const d = dec(w, 0x00400000)
      expect(encode(d)).toBe(w)
    }
  })
})
