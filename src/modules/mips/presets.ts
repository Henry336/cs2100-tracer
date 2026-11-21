import { DEFAULT_TEXT_BASE, PRESETS, hex, memInitText, regInitText } from '../../core/mips'

export interface RunPreset {
  src: string
  regs: string
  mem: string
  base: string
}

const ARRAY_SUM = `.data
A:    .word 3, -1, 4, 1, 5
.text
main: la   $t0, A             # $t0 = &A[0]
      addi $t1, $zero, 5      # n = 5
      add  $s0, $zero, $zero  # sum = 0
      add  $t2, $zero, $zero  # i = 0
loop: slt  $t3, $t2, $t1      # i < n ?
      beq  $t3, $zero, end
      sll  $t4, $t2, 2        # byte offset = i x 4
      add  $t4, $t0, $t4      # &A[i]
      lw   $t5, 0($t4)
      add  $s0, $s0, $t5      # sum += A[i]
      addi $t2, $t2, 1
      j    loop
end:`

// Index version of the T03 Q1 palindrome check, written for this app with its own string.
const PALINDROME = `.data
str:  .asciiz "rotator"
.text
main: la   $s4, str           # base of string[]
      addi $s5, $zero, 7      # size
      addi $s0, $zero, 0      # low = 0
      addi $s1, $s5, -1       # high = size - 1
      addi $s3, $zero, 1      # matched = 1
loop: slt  $t0, $s0, $s1      # low < high ?
      beq  $t0, $zero, exit
      beq  $s3, $zero, exit   # && matched (short circuit)
      add  $t1, $s4, $s0
      lb   $t2, 0($t1)        # string[low], no x 4 for chars
      add  $t3, $s4, $s1
      lb   $t4, 0($t3)        # string[high]
      beq  $t2, $t4, same
      addi $s3, $zero, 0      # matched = 0
      j    loop
same: addi $s0, $s0, 1        # low++
      addi $s1, $s1, -1       # high--
      j    loop
exit:`

const CONST32 = `lui  $t0, 0xAAAA
ori  $t0, $t0, 0xF0F0      # 0xAAAAF0F0
lui  $t1, 0xAAAA
addi $t1, $t1, -3856       # same 16 bits 0xF0F0, but sign-extended`

export const RUN_PRESETS: { name: string; source: string; value: RunPreset }[] = [
  ...PRESETS.map((p) => ({
    name: p.title,
    source: p.cite,
    value: {
      src: p.source.replace(/^\n/, ''),
      regs: regInitText(p.init?.regs),
      mem: memInitText(p.init?.mem),
      base: hex(p.textBase ?? DEFAULT_TEXT_BASE),
    },
  })),
  { name: 'Array sum with a for loop', source: 'L05 p6 in MIPS, L07 p33 style', value: { src: ARRAY_SUM, regs: '', mem: '', base: hex(DEFAULT_TEXT_BASE) } },
  { name: 'Palindrome check by index', source: 'T03 Q1(a) shape', value: { src: PALINDROME, regs: '', mem: '', base: hex(DEFAULT_TEXT_BASE) } },
  { name: 'andi zero-extends: andi $t1, $t0, 51966', source: 'AY25/26 S1 Q14', value: { src: 'andi $t1, $t0, 51966      # 51966 = 0xCAFE, upper half 0', regs: '$t0 = 0xABCD0123', mem: '', base: hex(DEFAULT_TEXT_BASE) } },
  { name: '32-bit constant: lui then ori, not addi', source: 'L06 p44, p46', value: { src: CONST32, regs: '', mem: '', base: hex(DEFAULT_TEXT_BASE) } },
]

export interface EncodePreset {
  mode: 'asm' | 'hex'
  text: string
  base: string
  sel: number
}

const asm = (text: string, sel = 0, base = '0x00400000'): EncodePreset => ({ mode: 'asm', text, base, sel })
const words = (text: string, base = '0x00400000', sel = 0): EncodePreset => ({ mode: 'hex', text, base, sel })

export const ENCODE_PRESETS: { name: string; source: string; value: EncodePreset }[] = [
  { name: 'R-format: add $8, $9, $10', source: 'L08 p11-12', value: asm('add $8, $9, $10') },
  { name: 'Shift: sll $8, $9, 4', source: 'L08 p13', value: asm('sll $8, $9, 4') },
  { name: 'R-format: add $10, $7, $5', source: 'L08 p14', value: asm('add $10, $7, $5') },
  { name: 'addi $9, $10, -32', source: 'R04 p38', value: asm('addi $9, $10, -32') },
  { name: 'beq $s0, $s1, 4 instructions on', source: 'R04 p39', value: asm('beq $s0, $s1, 4') },
  { name: 'lw $v1, -100($t7)', source: 'Midterm AY25/26 Q13, computed', value: asm('lw $v1, -100($t7)') },
  { name: 'Negative immediate: addi $21, $22, -50', source: 'L08 p20-21', value: asm('addi $21, $22, -50') },
  { name: 'Load: lw $9, 12($8)', source: 'L08 p22', value: asm('lw $9, 12($8)') },
  { name: 'Store: sw $s4, 0($t1)', source: 'AY24/25 S1 Q18d', value: asm('sw $s4, 0($t1)') },
  {
    name: 'Branch forward, End 4 words on',
    source: 'L08 p29-31',
    value: asm('      beq  $9, $0, End\n      addi $8, $8, 1\n      addi $9, $9, -1\n      add  $10, $8, $9\nEnd:  sub  $11, $8, $9', 0, '0x00000000'),
  },
  {
    name: 'Branch backward to Loop',
    source: 'L08 p32',
    value: asm('Loop: addi $8, $8, 1\n      addi $9, $9, 1\n      add  $10, $8, $9\n      beq  $0, $0, Loop', 3, '0x00000000'),
  },
  {
    name: 'Jump: j Loop at 20, Loop at 8',
    source: 'L08 p41',
    value: asm('      addi $8, $0, 0\n      addi $9, $0, 0\nLoop: addi $8, $8, 1\n      add  $9, $9, $8\n      slt  $10, $9, $11\n      j    Loop', 5, '0x00000000'),
  },
  { name: 'lui $s1, 57007', source: 'AY25/26 S1 Q6', value: asm('lui $s1, 57007') },
  { name: 'Three words to encode', source: 'T04 Q3', value: asm('beq $1, $3, 12\nlw  $24, 0($15)\nsub $25, $20, $5') },
  { name: 'Decode 0x8D8BFF1D', source: 'R04 p40', value: words('0x8D8BFF1D') },
  { name: 'Decode 0x001289C2', source: 'R04 p41', value: words('0x001289C2') },
  { name: 'Decode 0x02898820', source: 'AY25/26 S1 Q7', value: words('0x02898820') },
  {
    name: 'Coffee-spill words from 0x00400028',
    source: 'T03 Q2',
    value: words('0x20110000\n0x00084042\n0x11000002\n0x22310001\n0x0810000B', '0x00400028', 2),
  },
  { name: 'Decode 0x12310003 at PC 0x1000', source: 'AY25/26 S1 Q15', value: words('0x12310003', '0x00001000') },
  { name: 'Decode 0x12C3FBAD at PC 0x5204', source: 'Midterm AY25/26 Q14, computed', value: words('0x12C3FBAD', '0x00005204') },
  { name: 'Decode 0x080000AD at PC 0x1014', source: 'Midterm AY25/26 Q16, computed', value: words('0x080000AD', '0x00001014') },
  { name: 'Decode j 0x0800C840 at 0x2100FFFC', source: 'AY18-19 Q3b, computed', value: words('0x0800C840', '0x2100FFFC') },
]

/** Expanding-opcode question as strings, so blank means "not given". */
export interface OpClassText {
  name: string
  opcodeBits: string
  length: string
  regs: string
  addresses: string
  otherBits: string
  fixed: string
  min: string
}
export interface OpcodeText {
  length: string
  registers: string
  memoryBytes: string
  objective: 'max' | 'min'
  classes: OpClassText[]
}

export const blankClass = (name: string, over: Partial<OpClassText> = {}): OpClassText => ({
  name, opcodeBits: '', length: '', regs: '', addresses: '', otherBits: '', fixed: '', min: '', ...over,
})
const q = (length: string, classes: OpClassText[], over: Partial<OpcodeText> = {}): OpcodeText => ({
  length, registers: '', memoryBytes: '', objective: 'max', classes, ...over,
})
const byWidth = (bits: number[]) => bits.map((b, i) => blankClass(String.fromCharCode(65 + i), { opcodeBits: String(b) }))

export const OPCODE_PRESETS: { name: string; source: string; value: OpcodeText }[] = [
  { name: '8-bit: 4-bit and 8-bit opcodes', source: 'R04 p45', value: q('8', byWidth([4, 8])) },
  {
    name: '16-bit, 12 registers, 512 bytes, C exactly 2',
    source: 'AY23/24 S2 Q7',
    value: q('16', [blankClass('A', { regs: '2' }), blankClass('B', { regs: '1', addresses: '1' }), blankClass('C', { fixed: '2' })], { registers: '12', memoryBytes: '512' }),
  },
  {
    name: '64 registers, 16-bit and 32-bit types',
    source: 'Midterm AY25/26 Q27, computed',
    value: q('32', [blankClass('A', { length: '16', regs: '2' }), blankClass('B', { regs: '3', otherBits: '6' }), blankClass('C', { regs: '2', otherBits: '14' })], { registers: '64' }),
  },
  { name: '3, 5 and 7-bit opcodes', source: 'AY20-21 Q3, computed', value: q('7', byWidth([3, 5, 7])) },
  { name: '4, 6 and 8-bit opcodes', source: 'AY15-16 Q6, computed', value: q('8', byWidth([4, 6, 8])) },
  { name: '6, 8 and 11-bit opcodes, minimum', source: 'Finals notes p4-5', value: q('11', byWidth([6, 8, 11]), { objective: 'min' }) },
  {
    name: '24-bit, four operand sizes',
    source: 'Recitation and Tutorial Extras p17-18',
    value: q('24', ['16', '12', '10', '6'].map((b, i) => blankClass('PQRS'[i], { otherBits: b }))),
  },
  {
    name: 'Zephyr: six types in 32 bits',
    source: 'AY16-17 Q4c-d, computed',
    value: q('32', ['0', '3', '16', '19', '6', '22'].map((b, i) => blankClass('ABCDEF'[i], { otherBits: b }))),
  },
]
