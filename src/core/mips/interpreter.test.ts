import { describe, expect, it } from 'vitest'
import { AY2425_Q18, L07_ARRAY_V1, L07_ARRAY_V2, L07_EX3, L07_EX4, L07_FOR, PRESETS, T03_Q2 } from './fixtures'
import { assemble, decode, memoryAt, readWords, regNumber, run, wordsToMem, type RunResult } from './index'

const R = (name: string) => regNumber(name)!

function exec(source: string, init?: Parameters<typeof run>[1], opts?: Parameters<typeof run>[3], textBase?: number) {
  const p = assemble(source, textBase === undefined ? {} : { textBase })
  expect(p.errors).toEqual([])
  const r = run(p, init, 10000, opts)
  expect(r.error).toBeUndefined()
  return { p, r, last: r.frames[r.frames.length - 1] }
}
const finalMem = (r: RunResult) => memoryAt(r, r.frames.length - 1)
const preset = (id: string) => PRESETS.find((p) => p.id === id)!

describe('course loop traces', () => {
  it('T03 Q2 (official formula): $s1 = floor(log2 $t0)', () => {
    for (const [t0, s1] of [[1, 0], [2, 1], [10, 3], [37, 5], [1024, 10]]) {
      const { r, last } = exec(T03_Q2, { regs: { [R('$t0')]: t0 } }, {}, 0x00400028)
      expect(r.halted).toBe('end')
      expect(last.regs[R('$s1')]).toBe(s1)
    }
  })

  it('T03 D1(b)-(c) (official): final arrays and 4 sw', () => {
    const t = preset('T03 D1')
    const { r } = exec(t.source, t.init)
    const mem = finalMem(r)
    expect(readWords(mem, 0x10010000, 8)).toEqual([3, 4, 1, 2, 0, 5, 9, 0])
    expect(readWords(mem, 0x10010100, 8)).toEqual([7, 4, 5, 6, 1, 0, 0, 9])
    expect(r.frames.filter((f) => f.instr.mnemonic === 'sw')).toHaveLength(4)
  })

  it('T03 D1(e) (official): bge $t4,$t3,skip expands to lines A and B', () => {
    const p = assemble('bge $t4, $t3, skip\nskip:')
    expect(p.instructions.map((i) => i.text)).toEqual(['slt $at, $t4, $t3', 'beq $at, $zero, skip'])
  })

  it('L07 p35 Ex3 (official): 6 instructions, $t2 = 20', () => {
    const { r, last } = exec(L07_EX3)
    expect(r.frames).toHaveLength(6)
    expect(last.regs[R('$t2')]).toBe(20)
  })

  it('L07 p36 Ex4 (official): 15 instructions, $t1 = 6', () => {
    const { r, last } = exec(L07_EX4)
    expect(r.frames).toHaveLength(15)
    expect(last.regs[R('$t1')]).toBe(6)
  })

  it('L07 p27 for loop (R03 p67 count): 2 + 4 x 10 + 1 = 43 instructions, a = 50', () => {
    const { r, last } = exec(L07_FOR)
    expect(r.frames).toHaveLength(43)
    expect(last.regs[R('$s2')]).toBe(50)
  })

  it('L07 p33-34 (computed): 40 non-zero words take 325 vs 245 real instructions', () => {
    const words = Array.from({ length: 40 }, (_, i) => i + 1)
    const init = { regs: { [R('$t0')]: 0x10010000 }, mem: wordsToMem(0x10010000, words) }
    expect(exec(L07_ARRAY_V1, init).r.frames).toHaveLength(325)
    expect(exec(L07_ARRAY_V2, init).r.frames).toHaveLength(245)
    words[5] = 0
    const one = exec(L07_ARRAY_V1, { ...init, mem: wordsToMem(0x10010000, words) })
    expect(one.r.frames).toHaveLength(326)
    expect(one.last.regs[R('$t8')]).toBe(1)
  })

  it('AY23/24 S2 Q16c-d (official): k = 4 and C = 10,12,18,20,555,666,777,888', () => {
    const t = preset('AY23/24 S2 Q16')
    const { r, last } = exec(t.source, t.init, {}, t.textBase)
    expect(last.regs[R('$s4')]).toBe(4)
    expect(readWords(finalMem(r), 0x10010200, 8).join(',')).toBe('10,12,18,20,555,666,777,888')
  })

  it('AY24/25 Q18a (official): A = {123,-39,26,90,27}, with .data, la and syscall exit', () => {
    const { p, r } = exec(AY2425_Q18)
    expect(p.labels.size).toBe(0x10010000)
    expect(p.labels.A).toBe(0x10010004)
    // la size is a single lui (low half 0); la A and la B need lui + ori
    expect(p.instructions.slice(0, 6).map((i) => i.mnemonic)).toEqual(['lui', 'lw', 'lui', 'ori', 'lui', 'ori'])
    expect(r.halted).toBe('end')
    expect(r.frames[r.frames.length - 1].note).toBe('exit')
    expect(readWords(finalMem(r), p.labels.A, 5)).toEqual([123, -39, 26, 90, 27])
  })
})

describe('instruction semantics', () => {
  it('AY25/26 Q14 (official): andi zero-extends, 0xABCD0123 & 51966 = 0x22', () => {
    const { last } = exec('andi $t1, $t0, 51966', { regs: { [R('$t0')]: 0xabcd0123 } })
    expect(last.regs[R('$t1')]).toBe(0x22)
  })

  it('L06 p37-41 (official): shift and logic examples', () => {
    const { r } = exec('sll $t2, $s0, 4\nand $t0, $t1, $t3\nandi $t4, $t5, 0xFFF\nori $t6, $t5, 0xFFF', {
      regs: { [R('$s0')]: 0xb8000009, [R('$t1')]: 0x632f0d59, [R('$t3')]: 0x00003c00, [R('$t5')]: 0x09c35d9c },
    })
    const [f1, f2, f3, f4] = r.frames
    expect(f1.regs[R('$t2')] >>> 0).toBe(0x80000090)
    expect(f2.regs[R('$t0')]).toBe(0x00000c00)
    expect(f3.regs[R('$t4')]).toBe(0x00000d9c)
    expect(f4.regs[R('$t6')]).toBe(0x09c35fff)
  })

  it('L06 p44 (official): li 0xAAAAF0F0 is lui + ori and loads the constant', () => {
    const { p, last } = exec('li $t0, 0xAAAAF0F0')
    expect(p.instructions.map((i) => i.text)).toEqual(['lui $t0, 0xAAAA', 'ori $t0, $t0, 0xF0F0'])
    expect(p.instructions[0].pseudoOf).toBe('li $t0, 0xAAAAF0F0')
    expect(last.regs[R('$t0')] >>> 0).toBe(0xaaaaf0f0)
  })

  it('srl is logical, slt is signed', () => {
    const { r } = exec('srl $t1, $t0, 4\nslt $t2, $t0, $zero', { regs: { [R('$t0')]: -16 } })
    expect(r.frames[0].regs[R('$t1')]).toBe(0x0fffffff)
    expect(r.frames[1].regs[R('$t2')]).toBe(1)
  })

  it('green-card extras (T02 p1, non-lecture): sltu is unsigned, addu and addiu add', () => {
    const { r } = exec('sltu $t2, $t0, $zero\naddu $t3, $t0, $t0\naddiu $t4, $t0, -1', { regs: { [R('$t0')]: -16 } })
    expect(r.frames.map((f) => f.regs[f.changedRegs[0]])).toEqual([0, -32, -17])
  })

  it('lb sign-extends, lbu does not, memory is big-endian (R02 p8)', () => {
    const mem = wordsToMem(0x10010000, [0x80ff1234])
    const { r } = exec('lb $t0, 1($s0)\nlbu $t1, 1($s0)\nlw $t2, 0($s0)\nsb $t2, 3($s0)', { regs: { [R('$s0')]: 0x10010000 }, mem })
    expect(r.frames[0].regs[R('$t0')]).toBe(-1)
    expect(r.frames[1].regs[R('$t1')]).toBe(255)
    expect(r.frames[2].regs[R('$t2')] >>> 0).toBe(0x80ff1234)
    expect(r.frames[2].memReads).toEqual([{ address: 0x10010000, size: 4, value: 0x80ff1234 }])
    expect(r.frames[3].memWrites).toEqual([{ address: 0x10010003, size: 1, value: 0x34 }])
  })

  it('writes to $zero are discarded', () => {
    const { last } = exec('addi $zero, $zero, 5')
    expect(last.regs[0]).toBe(0)
    expect(last.changedRegs).toEqual([])
    expect(last.note).toContain('discarded')
  })

  it('branch frames report taken and the target working', () => {
    const { r } = exec('beq $t0, $t1, L\nnop\nL: bne $t0, $t1, L2\nL2:', { regs: { [R('$t0')]: 3, [R('$t1')]: 3 } }, {}, 0)
    expect(r.frames[0].taken).toBe(true)
    expect(r.frames[0].nextPc).toBe(8)
    expect(r.frames[0].why.map((w) => w.cite)).toContain('L08 p28')
    expect(r.frames[1].taken).toBe(false)
    expect(r.frames).toHaveLength(2)
  })

  it('jal saves PC+4 by default (L08 p8) or PC+8 (green card); jr returns', () => {
    const src = 'jal f\nj done\nf: addi $v0, $zero, 7\njr $ra\ndone:'
    const a = exec(src)
    expect(a.r.frames[0].regs[31]).toBe(0x00400004)
    expect(a.last.regs[2]).toBe(7)
    expect(a.r.frames.map((f) => f.instr.mnemonic)).toEqual(['jal', 'addi', 'jr', 'j'])
    const b = exec(src, {}, { jalLink: 'pc+8' })
    expect(b.r.frames[0].regs[31]).toBe(0x00400008)
  })

  it('syscall prints ints and strings', () => {
    const { r } = exec('.data\nmsg: .asciiz "Hi"\n.text\nli $v0, 4\nla $a0, msg\nsyscall\nli $v0, 1\nli $a0, -5\nsyscall\nli $v0, 10\nsyscall\naddi $t0, $t0, 1')
    expect(r.output).toBe('Hi-5')
    expect(r.halted).toBe('end')
    expect(r.frames[r.frames.length - 1].regs[R('$t0')]).toBe(0)
  })

  it('unaligned lw stops with an error (L07 p15)', () => {
    const p = assemble('lw $t0, 2($zero)')
    const r = run(p)
    expect(r.halted).toBe('error')
    expect(r.error).toContain('not a multiple of 4')
  })

  it('an endless loop stops at maxSteps', () => {
    const r = run(assemble('L: j L'), {}, 50)
    expect(r.halted).toBe('maxSteps')
    expect(r.frames).toHaveLength(50)
  })

  it('jumping to an address with no instruction is an error', () => {
    const r = run(assemble('jr $zero'))
    expect(r.halted).toBe('error')
    expect(r.error).toContain('does not hold an instruction')
  })

  it('refuses to run a program with assembly errors', () => {
    expect(run(assemble('add $t0, $t1')).halted).toBe('error')
  })

  it('memoryAt replays writes up to a frame', () => {
    const { r } = exec('addi $t0, $zero, 9\nsw $t0, 0($s0)\naddi $t0, $zero, 4\nsw $t0, 0($s0)', { regs: { [R('$s0')]: 0x10010000 } })
    expect(readWords(memoryAt(r, -1), 0x10010000, 1)).toEqual([0])
    expect(readWords(memoryAt(r, 1), 0x10010000, 1)).toEqual([9])
    expect(readWords(memoryAt(r, 3), 0x10010000, 1)).toEqual([4])
  })
})

describe('options for course ambiguities (verifier round 2)', () => {
  it('L10 p17-18, Lab 3 p7 (derived): little-endian lays out .word LSB first, so QtSpim shows "Hello" as 0x6C6C6548', () => {
    const src = '.data\nmsg: .asciiz "Hello"\nw: .word 0x12345678\n.text\nla $a0, msg\nlw $t0, 0($a0)\nla $a1, w\nlw $t1, 0($a1)\nlb $t2, 0($a1)\nsh $t1, 0($a0)'
    const big = run(assemble(src))
    const little = run(assemble(src, { endian: 'little' }))
    expect(assemble(src, { endian: 'little' }).data[1].bytes).toEqual([0x78, 0x56, 0x34, 0x12])
    expect(big.frames[1].regs[R('$t0')]).toBe(0x48656c6c)
    expect(little.frames[1].regs[R('$t0')]).toBe(0x6c6c6548)
    expect(little.frames[4].regs[R('$t1')]).toBe(0x12345678) // the same value either way
    expect([big.frames[5].regs[R('$t2')], little.frames[5].regs[R('$t2')]]).toEqual([0x12, 0x78])
    const mem = memoryAt(little, little.frames.length - 1)
    expect([mem[0x10010000], mem[0x10010001]]).toEqual([0x78, 0x56]) // sh replayed little-endian
    expect(little.endian).toBe('little')
  })

  it('L07 p12, p38: ulw reads the same word in both byte orders, and Ex5 counts 42 statements', () => {
    const src = 'addi $t1, $t0, 10\nadd $t2, $zero, $zero\nLoop: ulw $t3, 0($t1)\nadd $t2, $t2, $t3\naddi $t1, $t1, -1\nbne $t1, $t0, Loop'
    const r = run(assemble(src), { regs: { [R('$t0')]: 0x10010000 } })
    expect(r.statements).toBe(42)
    expect(r.frames.length).toBe(132)
    const one = (endian: 'big' | 'little') =>
      run(assemble('ulw $t3, 1($t0)', { endian }), { regs: { [R('$t0')]: 0x100 }, mem: endian === 'big' ? { 0x101: 0x11, 0x104: 0x44 } : { 0x101: 0x44, 0x104: 0x11 } })
    expect(one('big').frames.at(-1)!.regs[R('$t3')]).toBe(0x11000044)
    expect(one('little').frames.at(-1)!.regs[R('$t3')]).toBe(0x11000044)
  })

  it('L08 p8 vs QtSpim: jumpOperand "address" reads a number after j as the byte address', () => {
    expect(assemble('j 0x0040002C', { jumpOperand: 'address' }).instructions[0].word).toBe(0x0810000b) // T03 Q2
    expect(assemble('j 2500').instructions[0].targetAddress).toBe(10000)
    expect(assemble('j 0x4000000').errors[0].message).toContain('26-bit')
  })

  it('Lab 4 p2: read_int ignores text after the number and reports missing input', () => {
    const p = assemble('li $v0, 5\nsyscall')
    expect(run(p, { input: '42 apples' }).frames.at(-1)!.regs[R('$v0')]).toBe(42)
    expect(run(p).error).toContain('no input line left')
    expect(run(p, { input: 'abc' }).error).toContain('expected an integer')
  })

  it('green card: jr and syscall words with stray bits are not decoded; lh needs an even address', () => {
    expect('error' in decode(0x03e10008)).toBe(true) // jr $ra with rt = 1
    expect('error' in decode(0x0000010c)).toBe(true) // syscall with bit 8 set
    expect((decode(0x03e00008) as { text: string }).text).toBe('jr $ra')
    expect(run(assemble('lh $t0, 1($zero)')).error).toContain('multiple of 2')
  })
})
