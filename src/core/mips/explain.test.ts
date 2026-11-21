import { describe, expect, it } from 'vitest'
import { assemble, branchOffsetExplain, decode, explainEncoding, jumpTargetExplain, type Instr } from './index'

const first = (line: string) => assemble(line).instructions[0]

describe('explainEncoding', () => {
  it('L08 p11-12 (official): add $8,$9,$10 fields, nibbles and hex', () => {
    const e = explainEncoding(first('add $8,$9,$10'))
    expect(e.fields.map((f) => [f.name, f.value])).toEqual([['opcode', 0], ['rs', 9], ['rt', 10], ['rd', 8], ['shamt', 0], ['funct', 32]])
    expect(e.fields.map((f) => f.binary).join(' ')).toBe('000000 01001 01010 01000 00000 100000')
    expect(e.nibbles.join(' ')).toBe('0000 0001 0010 1010 0100 0000 0010 0000')
    expect(e.hex).toBe('0x012A4020')
    expect(e.examplify).toBe('012A4020')
    expect(e.fields[3].why.cite).toBe('L08 p12')
  })

  it('L08 p13 (official): sll puts the source in rt and rs is 0', () => {
    const e = explainEncoding(first('sll $8,$9,4'))
    expect(e.fields.map((f) => f.value)).toEqual([0, 0, 9, 8, 4, 0])
    expect(e.fields[1].why.rule).toContain('rt')
  })

  it('L08 p20-21 (official): addi immediate field is -50 = 0xFFCE', () => {
    const e = explainEncoding(first('addi $21,$22,-50'))
    const imm = e.fields.find((f) => f.name === 'immediate')!
    expect(imm.value).toBe(-50)
    expect(imm.binary).toBe('1111111111001110')
    expect(imm.bits).toEqual([15, 0])
  })

  it('T03 Q2 (official): j decode explains the target splice', () => {
    const e = explainEncoding(decode(0x0810000b, 0x00400038) as Instr)
    expect(e.format).toBe('J')
    expect(e.fields[1].value).toBe(0x10000b)
    expect(e.steps[e.steps.length - 1].working).toContain('0x0040002C')
  })

  it('branch steps show the target from PC+4', () => {
    const e = explainEncoding(decode(0x10000103, 0x491) as Instr)
    expect(e.steps[e.steps.length - 1].working).toBe('0x00000495 + 259 x 4 = 0x000008A1')
  })
})

describe('branchOffsetExplain', () => {
  it('L08 p29-31 (official): forward branch from 0 to 16 is imm 3', () => {
    const b = branchOffsetExplain(0, 16)
    expect(b.pcPlus4).toBe(4)
    expect(b.byteOffset).toBe(12)
    expect(b.imm).toBe(3)
    expect(b.inRange).toBe(true)
  })

  it('L08 p32 (official): backward branch from 12 to 0 is imm -4 = 0xFFFC', () => {
    const b = branchOffsetExplain(12, 0)
    expect(b.imm).toBe(-4)
    expect(b.imm16).toBe('0xFFFC')
  })

  it('AY24/25 Q18c (official): exit 11 instructions after PC+4; the from-PC mistake gives 12', () => {
    const b = branchOffsetExplain(0x0040004c, 0x0040007c)
    expect(b.imm).toBe(11)
    expect(b.mistakes.fromPc).toBe(12)
  })

  it('Midterm AY25/26 Q16 (computed, no key): j 0x2B4 at 0x1014 is beq imm -857', () => {
    expect(branchOffsetExplain(0x1014, 0x2b4).imm).toBe(-857)
    expect(branchOffsetExplain(0x1014, 0x2b4).mistakes.bytes).toBe(-3428)
  })

  it('flags unaligned and out-of-range targets', () => {
    expect(branchOffsetExplain(0, 6).aligned).toBe(false)
    expect(branchOffsetExplain(0, 0x40000).inRange).toBe(false)
    expect(branchOffsetExplain(0x1000, 0x1000).reach).toEqual({ min: (0x1004 - 0x20000) >>> 0, max: 0x1004 + 0x1fffc })
  })
})

describe('jumpTargetExplain', () => {
  it('L08 p41 (official): j at 20 to 8 has field 2, word 0x08000002', () => {
    const j = jumpTargetExplain(20, 8)
    expect(j.field).toBe(2)
    expect(j.word).toBe(0x08000002)
    expect(j.sameBlock).toBe(true)
  })

  it('T03 Q3(c) (official): j loopEnd at 0xFFFFFF28 to 0xFFFFFF44 is 0x0BFFFFD1', () => {
    expect(jumpTargetExplain(0xffffff28, 0xffffff44).hex).toBe('0x0BFFFFD1')
  })

  it('AY25/26 Q15 (official): jump equivalent of the branch to 0x1010 is 0x08000404', () => {
    expect(jumpTargetExplain(0x1000, 0x1010).word).toBe(0x08000404)
  })

  it('AY21-22 S1 Q14 (computed, no key): j loop with loop = 0x2B001010 is 0x0AC00404', () => {
    expect(jumpTargetExplain(0x2b001040, 0x2b001010).word).toBe(0x0ac00404)
  })

  it('L08 p40 (derived): 256 MB block check and the last-word edge case', () => {
    expect(jumpTargetExplain(0x00400000, 0x10000000).sameBlock).toBe(false)
    const edge = jumpTargetExplain(0x0ffffffc, 0x10000000)
    expect(edge.blockEdge).toBe(true)
    expect(edge.sameBlock).toBe(true)
    expect(edge.block).toEqual({ start: 0x10000000, end: 0x1ffffffc })
  })

  it('jal uses opcode 3', () => {
    expect(jumpTargetExplain(0x00400000, 0x00400010, 'jal').word).toBe(0x0c100004)
  })
})
