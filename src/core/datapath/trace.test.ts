import { describe, expect, it } from 'vitest'
import { DATAPATH_PRESETS } from './fixtures'
import { traceDatapath } from './trace'
import type { DatapathInput, DatapathTrace } from './types'

function ok(input: DatapathInput): DatapathTrace {
  const r = traceDatapath(input)
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '))
  return r
}
const preset = (id: string) => DATAPATH_PRESETS.find((p) => p.id === id)!.input
const sym = (t: DatapathTrace, port: string) => t.ports[port].symbolic
const ctl = (t: DatapathTrace) => {
  const r = t.control.row
  return [r.RegDst, r.ALUSrc, r.MemToReg, r.RegWrite, r.MemRead, r.MemWrite, r.Branch].join(' ')
}
const wire = (t: DatapathTrace, id: string) => t.wires.find((w) => w.id === id)!

describe('FX1 beq $1,$3,12 (T04 Q3(a), official)', () => {
  const t = ok(preset('FX1'))
  it('encodes and decodes', () => {
    expect(t.instr.word).toBe(0x1023000c)
    expect(t.fields.map((f) => [f.name, f.value])).toEqual([['opcode', 4], ['rs', 1], ['rt', 3], ['imm', 12]])
  })
  it('T04 table', () => {
    expect(sym(t, 'RR1')).toBe('$1')
    expect(sym(t, 'RR2')).toBe('$3')
    expect(sym(t, 'WR')).toBe('$3 or $0')
    expect(sym(t, 'WD')).toBe('[$1]-[$3] or random value')
    expect(sym(t, 'aluA')).toBe('[$1]')
    expect(sym(t, 'aluB')).toBe('[$3]')
    expect(sym(t, 'dmAddress')).toBe('[$1]-[$3]')
    expect(sym(t, 'dmWriteData')).toBe('[$3]')
    expect(sym(t, 'nextPc')).toBe('PC+4 or PC+4+48')
  })
  it('sign extend and shift', () => {
    expect(t.ports.signExt.value).toBe(0x0000000c)
    expect(t.ports.shifted.value).toBe(0x30)
  })
  it('control (L12 p34, T05 Q1)', () => {
    expect(ctl(t)).toBe('X 0 X 0 0 0 1')
    expect(t.control.aluop).toBe('01')
    expect(t.control.aluControl).toBe('0110')
  })
  it('next PC depends on [$1] = [$3]', () => {
    const taken = ok({ source: 'beq $1,$3,12', pc: 0x1000, regs: { 1: 5, 3: 5 } })
    expect(taken.ports.nextPc.value).toBe(0x1000 + 4 + 48)
    expect(taken.commit.pc.value).toBe(0x1034)
    const not = ok({ source: 'beq $1,$3,12', pc: 0x1000, regs: { 1: 5, 3: 6 } })
    expect(not.ports.nextPc.value).toBe(0x1004)
    expect(wire(not, 'btarget').status).toBe('discarded')
  })
  it('WR and WD are computed but discarded; RegDst is a dont care', () => {
    expect(wire(t, 'wd').status).toBe('discarded')
    expect(wire(t, 'wr').status).toBe('discarded')
    expect(wire(t, 'c-regdst').status).toBe('dontcare')
    expect(t.commit.reg).toBeNull()
  })
})

describe('FX2 lw $24,0($15) (T04 Q3(b), official)', () => {
  const t = ok(preset('FX2'))
  it('T04 table', () => {
    expect(t.instr.word).toBe(0x8df80000)
    expect(sym(t, 'RR1')).toBe('$15')
    expect(sym(t, 'RR2')).toBe('$24')
    expect(sym(t, 'WR')).toBe('$24')
    expect(sym(t, 'WD')).toBe('Mem([$15]+0)')
    expect(sym(t, 'aluA')).toBe('[$15]')
    expect(sym(t, 'aluB')).toBe('0')
    expect(sym(t, 'dmAddress')).toBe('[$15]+0')
    expect(sym(t, 'dmWriteData')).toBe('[$24]')
    expect(sym(t, 'nextPc')).toBe('PC+4')
  })
  it('control', () => {
    expect(ctl(t)).toBe('0 1 1 1 1 0 0')
    expect(t.control.aluop).toBe('00')
    expect(t.control.aluControl).toBe('0010')
  })
  it('reads big-endian memory and writes $24', () => {
    const r = ok({ source: 'lw $24, 0($15)', regs: { 15: 0x10010000 }, mem: { 0x10010000: 0x12, 0x10010001: 0x34, 0x10010002: 0x56, 0x10010003: 0x78 } })
    expect(r.ports.dmReadData.value).toBe(0x12345678)
    expect(r.commit.reg).toMatchObject({ number: 24, value: 0x12345678 })
    expect(wire(r, 'rd2-dm').status).toBe('discarded')
    expect(wire(r, 'dm-mtr').status).toBe('used')
  })
})

describe('FX3 sub $25,$20,$5 (T04 Q3(c), official)', () => {
  const t = ok(preset('FX3'))
  it('T04 table', () => {
    expect(t.instr.word).toBe(0x0285c822)
    expect(t.instr.rd).toBe(25)
    expect(t.instr.funct).toBe(0x22)
    expect(sym(t, 'RR1')).toBe('$20')
    expect(sym(t, 'RR2')).toBe('$5')
    expect(sym(t, 'WR')).toBe('$25')
    expect(sym(t, 'WD')).toBe('[$20]-[$5]')
    expect(sym(t, 'aluA')).toBe('[$20]')
    expect(sym(t, 'aluB')).toBe('[$5]')
    expect(sym(t, 'dmAddress')).toBe('[$20]-[$5]')
    expect(sym(t, 'dmWriteData')).toBe('[$5]')
    expect(sym(t, 'nextPc')).toBe('PC+4')
  })
  it('sign extend still runs (unused)', () => {
    expect(t.ports.signExt.value).toBe(0xffffc822)
    expect(t.ports.signExt.used).toBe(false)
    expect(wire(t, 'sext-alusrc').status).toBe('discarded')
  })
  it('control', () => {
    expect(ctl(t)).toBe('1 0 0 1 0 0 0')
    expect(t.control.aluop).toBe('10')
    expect(t.control.aluControl).toBe('0110')
  })
})

describe('FX4 0x10000103 at PC 0x491 (R06 p43-44, official)', () => {
  const t = ok(preset('FX4'))
  it('decodes to beq $0,$0,0x0103 and is taken to 0x8A1', () => {
    expect(t.instr.mnemonic).toBe('beq')
    expect([t.instr.rs, t.instr.rt, t.instr.imm]).toEqual([0, 0, 0x103])
    expect(sym(t, 'RR1')).toBe('$0')
    expect(sym(t, 'WR')).toBe('$0')
    expect(sym(t, 'aluA')).toBe('[$0]')
    expect(t.ports.aluA.value).toBe(0)
    expect(sym(t, 'WD')).toBe('[$0]-[$0] or random value')
    expect(t.control.pcSrc).toBe(1)
    expect(t.ports.nextPc.value).toBe(0x8a1)
  })
})

describe('FX5 beq $9,$0,End at 0x1080 (R05 Q8, official)', () => {
  const t = ok(preset('FX5'))
  it('word, memory signals and next PC', () => {
    expect(t.instr.text).toBe('beq $t1, $zero, 4')
    expect(t.control.row.MemRead).toBe(0)
    expect(t.control.row.MemWrite).toBe(0)
    expect(t.ports.isZero.value).toBe(1)
    expect(t.ports.nextPc.value).toBe(0x1094)
  })
  it('same result from assembly with a label', () => {
    const r = ok({ source: 'beq $9, $0, End\nadd $1,$1,$1\nadd $1,$1,$1\nadd $1,$1,$1\nadd $1,$1,$1\nEnd: add $1,$1,$1', pc: 0x1080 })
    expect(r.instr.word).toBe(0x11200004)
    expect(r.ports.nextPc.value).toBe(0x1094)
  })
})

describe('FX6 add $t4,$v0,$s1 (AY25/26 midterm Q20-25, official)', () => {
  const t = ok(preset('FX6'))
  it('wire values', () => {
    expect(t.instr.word).toBe(0x00516020)
    expect(t.ports.RR1.value).toBe(2)
    expect(t.ports.RR2.value).toBe(17)
    expect(t.ports.WR.value).toBe(12)
    expect(t.ports.signExt.value).toBe(0x00006020)
    expect(t.ports.RD1.value).toBe(0x200)
    expect(t.ports.RD2.value).toBe(0x300)
    expect(t.ports.aluResult.value).toBe(0x500)
    expect(t.commit.reg).toMatchObject({ number: 12, value: 0x500 })
  })
  it('Q25 control row (option B)', () => {
    const r = t.control.row
    expect([r.RegDst, r.RegWrite, r.ALUSrc, r.MemRead, r.MemWrite, r.MemToReg]).toEqual([1, 1, 0, 0, 0, 0])
  })
})

describe('hex questions (official keys)', () => {
  it('AY25/26 Q7: 0x02898820 is add $s1,$s4,$t1, ALUop 10', () => {
    const t = ok(preset('AY2526Q7'))
    expect(t.instr.text).toBe('add $s1, $s4, $t1')
    expect(t.control.aluop).toBe('10')
  })
  it('AY24/25 Q15: 0x0235C020 is add $t8,$s1,$s5, ALUcontrol 0010', () => {
    const t = ok(preset('AY2425Q15'))
    expect(t.instr.text).toBe('add $t8, $s1, $s5')
    expect(t.control.aluControl).toBe('0010')
  })
})

describe('derived rows outside the L12 subset', () => {
  it('addi $s1,$t1,12 with $t1 = 8 gives 20 (AY15/16 Q9, derived)', () => {
    const t = ok(preset('AY1516Q9'))
    expect(t.support.level).toBe('derived')
    expect(t.support.notInCourseDatapath).toBe(false)
    expect(t.support.notes[0].cite).toBe('L11 p6, L12 p9')
    expect(ctl(t)).toBe('0 1 0 1 0 0 0')
    expect(t.ports.aluResult.value).toBe(20)
    expect(t.commit.reg).toMatchObject({ number: 17, value: 20 })
  })
  it('bne uses BranchNE: taken when isZero is 0 (row from AY25/26 Ans p15, values derived)', () => {
    const t = ok(preset('bne'))
    expect(t.control.row.BranchNE).toBe(1)
    expect(t.control.row.Branch).toBe(0)
    expect(t.control.aluControl).toBe('0110')
    expect(t.control.pcSrc).toBe(1)
    expect(t.ports.nextPc.value).toBe(0x00400000 + 4 + 12)
    expect(wire(t, 'c-branchne').status).toBe('used')
    const eq = ok({ source: 'bne $t0, $t1, 3', regs: { 8: 2, 9: 2 } })
    expect(eq.control.pcSrc).toBe(0)
  })
})

describe('instructions the course datapath cannot run (L11 p6, p47)', () => {
  for (const [src, hint] of [['sll $t0, $t1, 4', 'shifter'], ['srl $t0, $t1, 1', 'shifter'], ['j 0x00400000', 'Inst[25:0]'], ['andi $t0, $t1, 5', 'zero-extend'], ['ori $t0, $t1, 5', 'zero-extend'], ['lui $t0, 1', 'upper half'], ['nor $t0,$t1,$t2', '1100']] as const) {
    it(src, () => {
      const r = traceDatapath({ source: src })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.support!.notInCourseDatapath).toBe(true)
      expect(r.support!.notes[0].cite).toBe('L11 p6, L12 p9')
      expect(r.support!.missing.join(' ')).toContain(hint)
    })
  }
})

describe('input errors', () => {
  it('reports an assembler error with its line', () => {
    const r = traceDatapath({ source: 'add $t10, $t0, $t1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].line).toBe(1)
  })
  it('reports a bad hex word', () => {
    const r = traceDatapath({ source: '0xFC000000' })
    expect(r.ok).toBe(false)
  })
  it('empty source', () => {
    expect(traceDatapath({ source: '   ' }).ok).toBe(false)
  })
})

describe('stage frames (L11 p7-46)', () => {
  it('five stages, cumulative wires, idle stages', () => {
    const add = ok(preset('FX6'))
    expect(add.frames.map((f) => f.stage)).toEqual(['fetch', 'decode', 'alu', 'memory', 'regwrite'])
    expect(add.frames[3].idle).toBe(true)
    expect(add.frames[4].idle).toBe(false)
    expect(add.frames[4].knownWires.length).toBe(add.wires.length)
    const sw = ok(preset('FX7-sw'))
    expect(sw.frames[3].idle).toBe(false)
    expect(sw.frames[4].idle).toBe(true)
    expect(sw.commit.mem).toMatchObject({ address: 0x10010040 - 50, value: 7 })
    expect(sym(sw, 'dmAddress')).toBe('[$22]-50')
  })
  it('ALUSrc mux moves to the ALU stage under the L12 p5 policy', () => {
    const l11 = ok({ source: 'add $1,$2,$3' })
    const l12 = ok({ source: 'add $1,$2,$3', muxStage: 'L12' })
    expect(l11.frames[1].units).toContain('alusrc')
    expect(l12.frames[2].units).toContain('alusrc')
    expect(l12.frames[2].activeWires).toContain('alub')
  })
  it('a write to $zero is ignored', () => {
    const t = ok({ source: 'add $0, $1, $2', regs: { 1: 1, 2: 2 } })
    expect(t.commit.reg).toBeNull()
    expect(t.commit.notes[0]).toContain('$zero')
  })
  it('register write stage has no output (R05 p38)', () => {
    const add = ok(preset('FX6'))
    expect(add.frames[4].outputs).toHaveLength(1)
    expect(add.frames[4].outputs[0].text).toMatch(/^none/)
    expect(add.frames[4].outputs[0].why.cite).toBe('R05 p38')
  })
  it('no em dashes in any generated text', () => {
    for (const p of DATAPATH_PRESETS) expect(JSON.stringify(traceDatapath(p.input))).not.toContain(String.fromCharCode(0x2014))
  })
})

// Big-endian bytes of signed words at the given addresses (R02 p8).
const words = (w: Record<number, number>) => {
  const m: Record<number, number> = {}
  for (const [a, v] of Object.entries(w)) for (let k = 0; k < 4; k++) m[Number(a) + k] = ((v >>> 0) >>> (24 - 8 * k)) & 0xff
  return m
}

describe('control faults (stuck-at signals)', () => {
  // AY15/16 S1 Q9b: $s1 = 4, $t1 = 8, memory table 0:57 4:-43 8:100 12:3 16:98 20:62 24:-31. No key exists.
  it('AY15/16 Q9b: addi $s1,$t1,12 with MemToReg stuck at 1 picks the memory output, which MemRead 0 leaves undefined', () => {
    const t = ok({ source: 'addi $s1, $t1, 12', regs: { 17: 4, 9: 8 }, mem: words({ 0: 57, 4: -43, 8: 100, 12: 3, 16: 98, 20: 62, 24: -31 }), faults: { MemToReg: 1 } })
    expect(t.control.faults).toEqual([{ signal: 'MemToReg', table: 0, forced: 1 }])
    expect(t.control.row.MemToReg).toBe(1)
    expect(t.ports.dmAddress.value).toBe(20)
    expect(t.ports.WD.value).toBeNull()
    expect(t.commit.reg).toBeNull()
    expect(t.commit.notes.join(' ')).toContain('(62)')
    expect(t.control.signalWhy.MemToReg!.rule).toContain('stuck at 1')
  })
  // AY17/18 S2 Q4c: lw $t1, 0($t0) with $t0 = 12, $t1 = 34 and ALUSrc stuck at 0: the ALU adds RD2 instead of the offset.
  it('AY17/18 Q4c: lw with ALUSrc stuck at 0 reads address 12 + 34 = 46', () => {
    const good = ok({ source: 'lw $t1, 0($t0)', regs: { 8: 12, 9: 34 } })
    const bad = ok({ source: 'lw $t1, 0($t0)', regs: { 8: 12, 9: 34 }, faults: { ALUSrc: 0 } })
    expect(good.ports.dmAddress.value).toBe(12)
    expect(bad.ports.dmAddress.value).toBe(46)
    expect(bad.ports.aluB.symbolic).toBe('[$9]')
  })
  it('a faulted ALUop outside the table uses the R06 p20 gates, and an undefined code is an error, not a throw', () => {
    const t = ok({ source: 'lw $t1, 0($t0)', faults: { ALUop1: 1, ALUop0: 1 } })
    expect(t.control.aluControl).toBe('0110')
    // and (funct 100100) with ALUop 11: bit2 = 1, bit1 = 0' + 1' = 0, bit0 = 0, so 0100, which the ALU does not define (L11 p34).
    const r = traceDatapath({ source: 'and $1, $2, $3', faults: { ALUop1: 1, ALUop0: 1 } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].message).toContain('0100')
  })
  it('values other than 0 or 1 are ignored', () => {
    const t = ok({ source: 'add $1, $2, $3', faults: { RegWrite: 'X' as unknown as 0 } })
    expect(t.control.faults).toEqual([])
  })
})

describe('field use of refused instructions (AY23/24 S2 Q10 key D)', () => {
  it('sll reads rt and writes rd, so RR1 (rs) is unused', () => {
    const r = traceDatapath({ source: 'sll $8, $9, 4' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.support!.fieldUse).toMatchObject({ reads: ['rt'], writes: 'rd' })
    expect(r.support!.fieldUse!.why.rule).toContain('rs field is not used')
  })
  it('lui reads no register and writes rt', () => {
    const r = traceDatapath({ source: 'lui $8, 0x1001' })
    if (r.ok) throw new Error('lui should be refused')
    expect(r.support!.fieldUse).toMatchObject({ reads: [], writes: 'rt' })
  })
})

describe('bne row from the AY25/26 key', () => {
  it('preset is official and the row status is key', async () => {
    const { DERIVED_ROWS } = await import('./tables')
    expect(DATAPATH_PRESETS.find((p) => p.id === 'bne')!.official).toBe(true)
    expect(DERIVED_ROWS.find((d) => d.name === 'bne')!.status).toBe('key')
  })
})
