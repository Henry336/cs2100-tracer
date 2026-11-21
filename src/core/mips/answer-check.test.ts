import { describe, expect, it } from 'vitest'
import { assemble, checkAnswer, decode, likelyMistakes, parseWord, type Instr } from './index'

const one = (src: string, base = 0, k = 0) => assemble(src, { textBase: base }).instructions[k]

describe('parseWord', () => {
  it('reads Examplify, 0x, 0b and decimal words and rejects the rest', () => {
    expect(parseWord('012a4020')).toBe(0x012a4020)
    expect(parseWord(' 0x012A4020 ')).toBe(0x012a4020)
    expect(parseWord('0b1010')).toBe(10)
    expect(parseWord('0x1_0000')).toBe(0x10000)
    expect(parseWord('12')).toBe(12)
    expect(parseWord('-1')).toBeUndefined()
    expect(parseWord('0x100000000')).toBeUndefined()
    expect(parseWord('add')).toBeUndefined()
  })
})

describe('likely mistakes', () => {
  it('AY24/25 S1 Q18c (official key): 0x1180000B is right, the key lists 0x1180000C as counting from PC', () => {
    const ins = decode(0x1180000b, 0x00400000) as Instr
    const m = likelyMistakes(ins).find((x) => x.word === 0x1180000c)
    expect(m?.label).toBe('counted from the branch')
  })

  it('AY24/25 S1 Q18d (official key): sw $s4, 0($t1) is 0xAD340000; 0xAE890000 is rs and rt swapped', () => {
    const ins = one('sw $s4, 0($t1)')
    expect(ins.word).toBe(0xad340000)
    expect(likelyMistakes(ins).find((x) => x.word === 0xae890000)?.label).toBe('rs and rt swapped')
  })

  it('L08 p12 (derived): add $8, $9, $10 written in assembly order gives 0x01095020', () => {
    const ins = one('add $8, $9, $10')
    expect(likelyMistakes(ins).find((x) => x.label === 'fields in assembly order')?.word).toBe(0x01095020)
  })

  it('L08 p32 (derived): beq $0, $0, Loop with imm -4 gives -3 from PC and -16 in bytes', () => {
    const ins = one('Loop: addi $8, $8, 1\naddi $9, $9, 1\nadd $10, $8, $9\nbeq $0, $0, Loop', 0, 3)
    expect(ins.word).toBe(0x1000fffc)
    const words = likelyMistakes(ins).map((m) => m.word)
    expect(words).toContain(0x1000fffd)
    expect(words).toContain(0x1000fff0)
    expect(likelyMistakes(ins).some((m) => m.label === 'rs and rt swapped')).toBe(false) // both $0: same word
  })

  it('L08 p41 (derived): j Loop with Loop at 8 is field 2; keeping the low bits gives field 8', () => {
    const ins = one('addi $8, $0, 0\naddi $9, $0, 0\nLoop: addi $8, $8, 1\nadd $9, $9, $8\nslt $10, $9, $11\nj Loop', 0, 5)
    expect(ins.word).toBe(0x08000002)
    expect(likelyMistakes(ins).find((m) => m.label === 'low 2 bits kept')?.word).toBe(0x08000008)
  })

  it('sll puts its source in rt; the mistake moves it to rs', () => {
    const ins = one('sll $8, $9, 4')
    expect(likelyMistakes(ins)[0].word).toBe(0x01204100)
  })
})

describe('checkAnswer', () => {
  const ins = one('add $8, $9, $10')
  it('accepts the right word with every field matching', () => {
    const c = checkAnswer(ins, '012A4020')
    expect(c.ok).toBe(true)
    expect(c.fields.every((f) => f.ok)).toBe(true)
  })
  it('diffs a wrong word field by field and names the mistake', () => {
    const c = checkAnswer(ins, '0x01095020')
    expect(c.ok).toBe(false)
    expect(c.fields.filter((f) => !f.ok).map((f) => f.name)).toEqual(['rs', 'rt', 'rd'])
    expect(c.mistake?.label).toBe('fields in assembly order')
  })
  it('returns a plain error for text that is not a word, and nothing for blank input', () => {
    expect(checkAnswer(ins, 'zz').error).toMatch(/not a 32-bit word/)
    expect(checkAnswer(ins, '  ')).toEqual({ ok: false, fields: [] })
  })
})
