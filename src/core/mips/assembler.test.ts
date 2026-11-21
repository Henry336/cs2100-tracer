import { describe, expect, it } from 'vitest'
import { assemble } from './index'

const texts = (src: string) => {
  const p = assemble(src)
  expect(p.errors).toEqual([])
  return p.instructions.map((i) => i.text)
}
const errorsOf = (src: string) => assemble(src).errors

describe('pseudo-instructions', () => {
  it('T04 Q2(a)-(c) (official): bgt, bge, ble expand with $at', () => {
    expect(texts('bgt $t1, $t2, L\nL:')).toEqual(['slt $at, $t2, $t1', 'bne $at, $zero, L'])
    expect(texts('bge $t1, $t2, L\nL:')).toEqual(['slt $at, $t1, $t2', 'beq $at, $zero, L'])
    expect(texts('ble $t1, $t2, L\nL:')).toEqual(['slt $at, $t2, $t1', 'beq $at, $zero, L'])
  })

  it('L07 p29 (official): blt is slt + bne (the assembler uses $at)', () => {
    expect(texts('blt $s1, $s2, L\nL:')).toEqual(['slt $at, $s1, $s2', 'bne $at, $zero, L'])
  })

  it('T04 Q2(d) (official): li uses ori when the constant fits 16 bits, else lui + ori', () => {
    expect(texts('li $v0, 10')).toEqual(['ori $v0, $zero, 0x000A'])
    expect(texts('li $t0, 0x12345678')).toEqual(['lui $t0, 0x1234', 'ori $t0, $t0, 0x5678'])
    expect(texts('li $t0, -1')).toEqual(['lui $t0, 0xFFFF', 'ori $t0, $t0, 0xFFFF'])
  })

  it('T04 Q2(e) (official): nop is sll $zero,$zero,0 = 0x00000000', () => {
    const p = assemble('nop')
    expect(p.instructions[0].text).toBe('sll $zero, $zero, 0')
    expect(p.instructions[0].word).toBe(0)
    expect(p.instructions[0].pseudoOf).toBe('nop')
  })

  it('L06 p34 (official): move is add with $zero', () => {
    expect(texts('move $t0, $s1')).toEqual(['add $t0, $s1, $zero'])
  })

  it('la is one lui when the low half is 0, else lui + ori; a text label always takes two', () => {
    const p = assemble('.data\nx: .word 1\ny: .byte 2\n.text\nla $a0, x\nla $a1, y\nla $a2, here\nhere: nop')
    expect(p.errors).toEqual([])
    expect(p.instructions.map((i) => i.text)).toEqual([
      'lui $a0, 0x1001',
      'lui $a1, 0x1001',
      'ori $a1, $a1, 0x0004',
      'lui $a2, 0x0040',
      'ori $a2, $a2, 0x0014',
      'sll $zero, $zero, 0',
    ])
    expect(p.labels.here).toBe(0x00400014)
  })

  it('labels after a pseudo-instruction account for its expansion', () => {
    const p = assemble('blt $t0, $t1, end\nadd $t2, $t2, $t2\nend:')
    expect(p.labels.end).toBe(0x0040000c)
    expect(p.instructions[1].imm).toBe(1)
  })
})

describe('lenient past-paper forms', () => {
  it('reads "bne $s0, 0, Loop" as $zero (AY24/25 Q13, AY25/26 Q2)', () => {
    const p = assemble('Loop: bne $s0, 0, Loop')
    expect(p.errors).toEqual([])
    expect(p.instructions[0].rt).toBe(0)
  })

  it('reads "slt $2,$2,124" as slti (AY23/24 S1 Q12)', () => {
    const p = assemble('slt $2,$2,124')
    expect(p.instructions[0].mnemonic).toBe('slti')
    expect(p.instructions[0].pseudoOf).toBe('slt $2,$2,124')
  })

  it('accepts operands without commas and spaces inside the offset', () => {
    expect(texts('beq $8 $0 2\nlw $t0, 4 ( $s0 )')).toEqual(['beq $t0, $zero, 2', 'lw $t0, 4($s0)'])
  })
})

describe('data directives', () => {
  it('lays out .word big-endian and aligned, .byte and .asciiz as bytes', () => {
    const p = assemble('.data\nc: .byte 1\nw: .word 0x01020304, -1\ns: .asciiz "ok"\n.space 2')
    expect(p.errors).toEqual([])
    expect(p.labels).toEqual({ c: 0x10010000, w: 0x10010004, s: 0x1001000c })
    expect(p.data).toEqual([
      { address: 0x10010000, bytes: [1] },
      { address: 0x10010004, bytes: [1, 2, 3, 4, 255, 255, 255, 255] },
      { address: 0x1001000c, bytes: [111, 107, 0] },
      { address: 0x1001000f, bytes: [0, 0] },
    ])
  })

  it('.text and .data take an address, and the options set the defaults', () => {
    expect(assemble('.text 0x00400028\nnop').instructions[0].address).toBe(0x00400028)
    expect(assemble('nop', { textBase: 0x1000 }).instructions[0].address).toBe(0x1000)
    expect(assemble('.data\nx: .word 1', { dataBase: 0x2000 }).labels.x).toBe(0x2000)
  })

  it('keeps # inside strings', () => {
    expect(assemble('.data\ns: .asciiz "a#b" # comment').data[0].bytes).toEqual([97, 35, 98, 0])
  })
})

describe('errors (line numbers, plain messages, never thrown)', () => {
  it('unknown register', () => {
    expect(errorsOf('nop\nadd $t0, $t1, $t10')).toEqual([{ line: 2, message: 'unknown register $t10' }])
  })

  it('T02 D2(c) (official): there is no subi', () => {
    expect(errorsOf('subi $t2, $t1, 3')[0].message).toContain('addi with a negative constant')
  })

  it('T02 D2(d) (official): a 32-bit constant does not fit in ori', () => {
    expect(errorsOf('ori $t3, $t4, 0xAC120000')[0].message).toContain('0 to 0xFFFF')
  })

  it('T02 D2(e) (official): shift amount must be 0 to 31', () => {
    expect(errorsOf('sll $t5, $t2, 33')[0].message).toContain('0 to 31')
  })

  it('Midterm AY25/26 Q17(ii) (computed): 0x9200 is outside the addi range', () => {
    expect(errorsOf('addi $t0, $zero, 0x9200')[0].message).toContain('-32768 to 32767')
  })

  it('operand count, unknown labels, duplicates, unknown instructions and directives', () => {
    expect(errorsOf('add $t0, $t1')[0].message).toBe('add needs 3 operands (rd, rs, rt), got 2')
    expect(errorsOf('j nowhere')[0].message).toBe('unknown label nowhere')
    expect(errorsOf('la $a0, nowhere')[0].message).toBe('unknown label nowhere')
    expect(errorsOf('a: nop\na: nop')).toEqual([{ line: 2, message: 'label a is already defined on line 1' }])
    expect(errorsOf('frob $t0')[0].message).toBe('unknown instruction frob')
    expect(errorsOf('.data\n.dword 3')[0].message).toBe('unknown directive .dword')
    expect(errorsOf('.word 3')[0].message).toContain('.data')
    expect(errorsOf('.data\nadd $t0, $t0, $t0')[0].message).toContain('.text')
  })

  it('L08 p40: j cannot leave the 256 MB block of PC+4', () => {
    expect(errorsOf('j 0x10000000')[0].message).toContain('256 MB')
  })

  it('L08 p42: a branch more than 2^15 instructions away is rejected', () => {
    expect(errorsOf('.text 0\nbeq $t0, $t1, far\n.text 0x00100000\nfar: nop')[0].message).toContain('16-bit range')
  })

  it('keeps later addresses stable when a line fails', () => {
    const p = assemble('add $t0\nL: nop')
    expect(p.errors).toHaveLength(1)
    expect(p.labels.L).toBe(0x00400004)
  })

  it('survives junk input', () => {
    expect(() => assemble('$$$ ,,, ((( \n : \n .asciiz "unterminated\n lw $t0, x($t1)\n beq $t0')).not.toThrow()
  })
})
