// Adversarial edge-case and robustness checks for the MIPS engine (verifier-owned).
// Failing tests here describe course behaviour the engine does not meet yet.
import { describe, expect, it } from 'vitest'
import { assemble, branchOffsetExplain, decode, expandingOpcode, hex, memoryAt, run, type Instr } from './index'

const errs = (src: string) => assemble(src).errors

describe('parsers never throw on user text (architecture.md: never throw on user input)', () => {
  it('mnemonics that are Object.prototype keys give a plain error, not a TypeError', () => {
    for (const src of ['constructor', '__proto__ $t0, $t1, $t2', 'constructor $t0, $t1, 5']) {
      expect(() => assemble(src), src).not.toThrow()
      expect(assemble(src).errors.length, src).toBeGreaterThan(0)
    }
    expect(() => run(assemble('constructor'))).not.toThrow()
  })

  it('undefined labels named like Object.prototype keys are reported as unknown labels', () => {
    expect(errs('j toString')).toEqual([{ line: 1, message: 'unknown label toString' }])
    expect(errs('beq $t0, $t1, constructor')).toEqual([{ line: 1, message: 'unknown label constructor' }])
    expect(errs('la $t0, valueOf')).toEqual([{ line: 1, message: 'unknown label valueOf' }])
  })

  it('a label called __proto__ is a valid SPIM identifier and keeps its address (Lab 3 SPIM-assembler p1)', () => {
    const p = assemble('__proto__: nop\nj __proto__')
    expect(p.errors).toEqual([])
    expect(p.instructions[1].word).toBe(0x08100000)
  })
})

describe('SPIM identifiers and directives (Lab 3 SPIM-assembler p1-2)', () => {
  it('p1: identifiers may contain and start with dots, e.g. the appendix example .mydata: .word 1', () => {
    const p = assemble('.data\n.mydata: .word 1\n.text\nla $t0, .mydata')
    expect(p.errors).toEqual([])
    expect(p.labels['.mydata']).toBe(0x10010000)
    expect(p.instructions[0].text).toBe('lui $t0, 0x1001')
  })

  it('p1: instruction opcodes are reserved words and cannot be labels', () => {
    const e = errs('add: nop\nj add')
    expect(e.length).toBeGreaterThan(0)
    expect(e[0].line).toBe(1)
  })

  it('p2: .half stores 16-bit values (big-endian like .word, R02 p8)', () => {
    const p = assemble('.data\nh: .half 1, 0xABCD, -1')
    expect(p.errors).toEqual([])
    expect(p.labels.h).toBe(0x10010000)
    expect(p.data).toEqual([{ address: 0x10010000, bytes: [0x00, 0x01, 0xab, 0xcd, 0xff, 0xff] }])
  })
})

describe('instruction addresses are word-aligned (L08 p23)', () => {
  it('.text with an address that is not a multiple of 4 is rejected or aligned, never used as is', () => {
    const p = assemble('.text 0x00400002\nnop\nadd $t0, $t0, $t0')
    const ok = p.errors.length > 0 || p.instructions.every((i) => i.address % 4 === 0)
    expect(ok, p.instructions.map((i) => i.address.toString(16)).join(',')).toBe(true)
  })
})

describe('run entry point and end of program (QtSpim behaviour, Lab 3 p5, p7; SPIM-assembler p1)', () => {
  it('starts at main when a main label exists (".globl main # Must be global"; startup code runs before user code)', () => {
    const src = 'f: addi $t0, $zero, 5\njr $ra\nmain: jal f\naddi $t1, $t0, 1\nli $v0, 10\nsyscall'
    const r = run(assemble(src))
    expect(r.frames[0]?.pc).toBe(0x00400008)
    expect(r.halted).toBe('end')
    expect(r.frames.at(-1)?.regs[9]).toBe(6)
  })

  it('a branch or jump to an empty address far past the program is an error, not a normal end ("Attempt to execute non-instruction", Lab 3 p7)', () => {
    expect(run(assemble('beq $zero, $zero, 100')).halted).toBe('error')
    expect(run(assemble('j 0x00500000')).halted).toBe('error')
    expect(run(assemble('lui $t0, 0x0050\njr $t0')).halted).toBe('error')
  })

  it('falling through to the end, or branching to a label after the last instruction, still ends normally (guard)', () => {
    expect(run(assemble('nop')).halted).toBe('end')
    expect(run(assemble('beq $zero, $zero, End\nnop\nEnd:')).halted).toBe('end')
  })
})

describe('decode only accepts 32-bit words (L08 p9, p23: instructions are 32 bits long)', () => {
  it('rejects values that are not 32-bit integers instead of silently truncating them', () => {
    expect('error' in decode(2 ** 32)).toBe(true) // would otherwise decode as nop
    expect('error' in decode(NaN)).toBe(true)
    expect('error' in decode(1.5)).toBe(true)
  })

  it('R06 p43 prints 0x100000103 (9 hex digits, a typo): the error should say the word is longer than 32 bits', () => {
    const d = decode(0x100000103)
    expect('error' in d).toBe(true)
    expect((d as { error: string }).error).toMatch(/32/)
  })

  it('still accepts a signed 32-bit word (guard)', () => {
    expect((decode(-1 >>> 0) as { error: string }).error).toContain('opcode 0x3F')
    expect((decode(0x8d8bff1d) as Instr).text).toBe('lw $t3, -227($t4)')
  })
})

describe('expanding opcode rejects impossible classes (R04 p45, AY23/24 S2 Q7)', () => {
  it('an opcode wider than the instruction is an error', () => {
    expect(expandingOpcode({ length: 8, objective: 'max', classes: [{ name: 'A', opcodeBits: 12 }] }).error).toBeDefined()
  })

  it('a given opcode width plus the operand bits cannot exceed the instruction length', () => {
    // 6 + 3 x 5 = 21 bits in a 16-bit instruction
    expect(expandingOpcode({ length: 16, registers: 32, objective: 'max', classes: [{ name: 'A', opcodeBits: 6, regs: 3 }] }).error).toBeDefined()
  })

  it('negative operand counts, fractional or negative instruction counts are errors', () => {
    expect(expandingOpcode({ length: 16, registers: 16, objective: 'max', classes: [{ name: 'A', regs: -1 }] }).error).toBeDefined()
    expect(expandingOpcode({ length: 8, objective: 'max', classes: [{ name: 'A', opcodeBits: 4, fixed: 1.5 }, { name: 'B', opcodeBits: 8 }] }).error).toBeDefined()
    expect(expandingOpcode({ length: 8, objective: 'max', classes: [{ name: 'A', opcodeBits: 4, min: -3 }, { name: 'B', opcodeBits: 8 }] }).error).toBeDefined()
  })
})

describe('performance at the engine limits (must stay well under 100 ms)', () => {
  it('one .space 65536 (the largest the assembler accepts): assemble, run and memoryAt stay under 100 ms', () => {
    const t0 = performance.now()
    const p = assemble('.data\nbuf: .space 65536\n.text\nla $t0, buf\nL: sw $t0, 0($t0)\naddi $t0, $t0, 4\nj L')
    const r = run(p, {}, 100)
    memoryAt(r, 50)
    const ms = performance.now() - t0
    expect(p.errors).toEqual([])
    expect(ms).toBeLessThan(100)
  })
})

describe('official lab fixtures not covered elsewhere (guards)', () => {
  it('Lab 5 p2-3 (official): jal sayHi at 0x0040000C, PC becomes 0x00400028, $ra = 0x00400010 = Addr(jal) + 4', () => {
    const src = [
      '.data', 'str1: .asciiz "Before function\\n"', 'str2: .asciiz "After function\\n"', 'str3: .asciiz "Inside function: Say Hi!\\n"',
      '.text', 'main:', 'li $v0, 4', 'la $a0, str1', 'syscall', 'jal sayHi', 'li $v0, 4', 'la $a0, str2', 'syscall', 'li $v0, 10', 'syscall',
      'sayHi:', 'li $v0, 4', 'la $a0, str3', 'syscall', 'jr $ra',
    ].join('\n')
    const p = assemble(src)
    expect(p.errors).toEqual([])
    const r = run(p)
    const jal = r.frames.find((f) => f.instr.mnemonic === 'jal')!
    expect(jal.pc).toBe(0x0040000c)
    expect(jal.nextPc).toBe(0x00400028)
    expect(jal.regs[31]).toBe(0x00400010)
    expect(r.output).toBe('Before function\nInside function: Say Hi!\nAfter function\n')
    expect(r.halted).toBe('end')
  })

  it('Lab 3 p6-8 (official): Hello at 0x10000100, lb $t0, 4($a0), addi -32, sb prints HelloHellO', () => {
    const src = '.data 0x10000100\nmsg: .asciiz "Hello"\n.text\nmain: li $v0, 4\nla $a0, msg\nsyscall\nlb $t0, 4($a0)\naddi $t0, $t0, -32\nsb $t0, 4($a0)\nsyscall\nli $v0, 10\nsyscall'
    const p = assemble(src)
    expect(p.errors).toEqual([])
    expect(p.data[0].bytes.slice(0, 5)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    const r = run(p)
    expect(r.output).toBe('HelloHellO')
  })
})

describe('decode does not hide bits that the course fixes at 0 (L08 p15, AY25/26 Q6)', () => {
  // L08 p15: arith has shamt always 0, shift has rs always 0. AY25/26 Q6 key: lui $s1,57007 = 0x3C11DEAF (rs = 0).
  // A word with those bits set is not the encoding of the text decode prints, so a student checking their own
  // hex would be told a wrong answer is fine (and explainEncoding says "0: not a shift" next to a shamt of 1).
  it('rejects, or prints text that re-assembles to the same word, for add with shamt 1, sll with rs set, lui with rs set', () => {
    for (const w of [0x012a4060, 0x01294080, 0x3d11deaf]) {
      const d = decode(w, 0x00400000)
      const back = 'error' in d ? undefined : assemble(d.text).instructions[0]?.word
      expect('error' in d || back === w, `${hex(w)} decoded as ${'error' in d ? d.error : d.text}, which assembles to ${back === undefined ? 'nothing' : hex(back)}`).toBe(true)
    }
  })

  it('still decodes the well-formed words (guard)', () => {
    expect((decode(0x012a4020) as Instr).text).toBe('add $t0, $t1, $t2')
    expect((decode(0x00094080) as Instr).text).toBe('sll $t0, $t1, 2')
    expect((decode(0x3c11deaf) as Instr).text).toBe('lui $s1, 0xDEAF')
  })
})

describe('branchOffsetExplain with a target that is not a multiple of 4 (L08 p23, p21)', () => {
  it('does not also claim the immediate is outside the 16-bit range (it prints "0 is outside -32768 to 32767")', () => {
    const b = branchOffsetExplain(0x00400000, 0x00400002)
    expect(b.aligned).toBe(false)
    expect(b.steps.filter((s) => /does not fit in 16 bits|is outside -32768 to 32767/.test(`${s.rule} ${s.working ?? ''}`))).toEqual([])
  })

  it('a far, aligned target still gets the out-of-range step (guard, L08 p42)', () => {
    const b = branchOffsetExplain(0x00400000, 0x00400004 + 32768 * 4)
    expect(b.inRange).toBe(false)
    expect(b.steps.at(-1)?.working).toBe('32768 is outside -32768 to 32767')
  })
})

describe('instruction addresses stay word-aligned and distinct (L08 p23)', () => {
  it('the textBase option is checked like .text: 0x00400002 is rejected or aligned, never used as is', () => {
    const p = assemble('nop\nadd $t0, $t0, $t0', { textBase: 0x00400002 })
    const ok = p.errors.length > 0 || p.instructions.every((i) => i.address % 4 === 0)
    expect(ok, p.instructions.map((i) => hex(i.address)).join(',')).toBe(true)
  })

  it('two .text sections that overlap give an error, not two instructions at one address (run would skip one)', () => {
    for (const src of [
      '.text 0x00400000\naddi $t0, $t0, 1\n.text 0x00400000\naddi $t1, $t1, 1',
      '.text 0x00400000\nnop\nnop\n.text 0x00400004\naddi $t1, $t1, 1',
    ]) {
      const p = assemble(src)
      const addrs = p.instructions.map((i) => i.address)
      expect(p.errors.length > 0 || new Set(addrs).size === addrs.length, `${JSON.stringify(src)}: ${addrs.map((a) => hex(a)).join(',')}`).toBe(true)
    }
  })
})

describe('a data line with an error keeps its label address (labels take no space, L07 p19)', () => {
  it('the label on a bad .asciiz or .word line is the address it would have had, not 0', () => {
    const a = assemble('.data\nb: .byte 1\ns: .asciiz "ab\nw: .word 7')
    expect(a.errors.map((e) => e.line)).toEqual([3])
    expect(a.labels.s).toBe(0x10010001)
    expect(a.labels.w).toBe(0x10010004)
    const c = assemble('.data\nw: .word 1, oops')
    expect(c.errors.length).toBe(1)
    expect(c.labels.w).toBe(0x10010000)
  })
})

describe('memoryAt index handling', () => {
  it('any index below 0 gives the initial memory (memoryAt(r, -2) currently replays all frames but the last)', () => {
    const r = run(assemble('.data\nx: .word 0\n.text\nla $t0, x\naddi $t1, $zero, 5\nsw $t1, 0($t0)\nnop'))
    expect(r.frames.length).toBe(4)
    expect(memoryAt(r, -2)).toEqual(memoryAt(r, -1))
  })
})
