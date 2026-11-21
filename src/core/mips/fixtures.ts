/** Course programs used by the tests and offered as UI presets. Only code and numbers, no slide text. */

import { wordsToMem } from './interpreter'

export interface ProgramPreset {
  id: string
  title: string
  cite: string
  /** true when the expected results come from slides or an answer key. */
  official: boolean
  source: string
  textBase?: number
  init?: { regs?: Partial<Record<number, number>>; mem?: Record<number, number> }
}

export const T03_D1 = `
      addi $t0, $s0, 0
      addi $t1, $s1, 0
loop: lw   $t3, 0($t0)
      lw   $t4, 0($t1)
      slt  $t5, $t4, $t3      # line A
      beq  $t5, $zero, skip   # line B
      sw   $t4, 0($t0)
      sw   $t3, 0($t1)
skip: addi $t0, $t0, 4
      addi $t1, $t1, 4
      bne  $t3, $zero, loop`

export const T03_Q2 = `
      addi $s1, $zero, 0
loop: srl  $t0, $t0, 1
      beq  $t0, $zero, exit
      addi $s1, $s1, 1
      j    loop
exit:`

export const AY2324S2_Q16 = `
      addi $a1, $s1, 0    # i1
      addi $a2, $s2, 0    # i2
      addi $a3, $s3, 0    # i3
      addi $t0, $0, 0     # i4: i=0
      addi $s4, $0, 0     # i5: k=0
loop: slt  $t1, $t0, $s0  # i6: i<n?
      beq  $t1, $0, exit  # i7
      andi $t1, $t0, 3    # i8
      srl  $t1, $t1, 1    # i9
      bne  $t1, $0, skip  # i10
      lw   $t1, 0($a1)    # i11
      lw   $t2, 0($a2)    # i12
      add  $t3, $t1, $t2  # i13
      sw   $t3, 0($a3)    # i14
      addi $a3, $a3, 4    # i15
      addi $s4, $s4, 1    # i16
skip: addi $a1, $a1, 4    # i17
      addi $a2, $a2, 4    # i18
      addi $t0, $t0, 1    # i19: i=i+1
      j    loop           # i20
exit:`

export const AY2425_Q18_LOOP = `
      add  $t0, $0, $0    # Inst1
      addi $t1, $a1, 0    # Inst2
      addi $t2, $a2, 0    # Inst3
loop: slt  $t4, $t0, $a0  # Inst4
      beq  $t4, $0, exit  # Inst5
      lw   $s1, 0($t1)    # Inst6
      lw   $s2, 0($t2)    # Inst7
      andi $s3, $s2, 1    # Inst8
      beq  $s3, $0, hop   # Inst9
      add  $s4, $s1, $s1  # Inst10
      add  $s4, $s4, $s1  # Inst11
      sw   $s4, 0($t1)    # Inst12
hop:  addi $t0, $t0, 1    # Inst13
      addi $t1, $t1, 4    # Inst14
      addi $t2, $t2, 4    # Inst15
      j    loop           # Inst16
exit: li   $v0, 10
      syscall`

export const AY2425_Q18 = `
.data
size: .word 5
A:    .word 123, -13, 26, 30, 9
B:    .word 44, 765, 200, 999, 123
.text
main: la   $t0, size
      lw   $a0, 0($t0)
      la   $a1, A
      la   $a2, B
${AY2425_Q18_LOOP}`

export const L07_EX3 = `
       addi $t1, $zero, 10
       add  $t1, $t1, $t1
       addi $t2, $zero, 10
Loop:  addi $t2, $t2, 10
       addi $t1, $t1, -1
       beq  $t1, $zero, Loop`

export const L07_EX4 = `
       add  $t0, $zero, $zero
       add  $t1, $t0, $t0
       addi $t2, $t1, 4
Again: add  $t1, $t1, $t0
       addi $t0, $t0, 1
       bne  $t2, $t0, Again`

export const L07_FOR = `
       add  $s0, $zero, $zero
       addi $s1, $zero, 10
Loop:  beq  $s0, $s1, Exit
       addi $s2, $s2, 5
       addi $s0, $s0, 1
       j    Loop
Exit:`

export const L07_ARRAY_V1 = `
      addi $t8, $zero, 0
      addi $t1, $zero, 0
      addi $t2, $zero, 40
loop: bge  $t1, $t2, end
      sll  $t3, $t1, 2
      add  $t4, $t0, $t3
      lw   $t5, 0($t4)
      bne  $t5, $zero, skip
      addi $t8, $t8, 1
skip: addi $t1, $t1, 1
      j loop
end:`

export const L07_ARRAY_V2 = `
      addi $t8, $zero, 0
      addi $t1, $t0, 0
      addi $t2, $t0, 160
loop: bge  $t1, $t2, end
      lw   $t3, 0($t1)
      bne  $t3, $zero, skip
      addi $t8, $t8, 1
skip: addi $t1, $t1, 4
      j loop
end:`

const A = 0x10010000
const B = 0x10010100
const C = 0x10010200

export const PRESETS: ProgramPreset[] = [
  {
    id: 'T03 Q2',
    title: 'Coffee-spill loop: $s1 = floor(log2 $t0)',
    cite: 'T03 Q2',
    official: true,
    source: T03_Q2,
    textBase: 0x00400028,
    init: { regs: { 8: 37 } },
  },
  {
    id: 'T03 D1',
    title: 'Swap smaller elements of A and B',
    cite: 'T03 D1',
    official: true,
    source: T03_D1,
    init: { regs: { 16: A, 17: B }, mem: { ...wordsToMem(A, [7, 4, 1, 6, 0, 5, 9, 0]), ...wordsToMem(B, [3, 4, 5, 2, 1, 0, 0, 9]) } },
  },
  {
    id: 'AY23/24 S2 Q16',
    title: 'C[k] = A[i] + B[i] when (i%4)/2 == 0',
    cite: 'AY23/24 S2 Q16',
    official: true,
    source: AY2324S2_Q16,
    textBase: 0x00400050,
    init: {
      regs: { 16: 8, 17: A, 18: B, 19: C },
      mem: { ...wordsToMem(A, [1, 2, 3, 4, 5, 6, 7, 8]), ...wordsToMem(B, [9, 10, 11, 12, 13, 14, 15, 16]), ...wordsToMem(C, [111, 222, 333, 444, 555, 666, 777, 888]) },
    },
  },
  // The key (Inst16 at 0x00400078) puts main at 0x00400024, after QtSpim's startup lines (Lab 3 p5).
  { id: 'AY24/25 Q18', title: 'Triple A[i] when B[i] is odd', cite: 'AY24/25 S1 Q18', official: true, source: AY2425_Q18, textBase: 0x00400024 },
  { id: 'L07 Ex3', title: 'Simple loop (do-while shape)', cite: 'L07 p35', official: true, source: L07_EX3 },
  { id: 'L07 Ex4', title: 'Simple loop II', cite: 'L07 p36', official: true, source: L07_EX4 },
  { id: 'L07 for', title: 'for (i=0; i<10; i++) a = a + 5', cite: 'L07 p27', official: true, source: L07_FOR },
  { id: 'L07 array v1', title: 'Count zeros by index', cite: 'L07 p33', official: false, source: L07_ARRAY_V1, init: { regs: { 8: A } } },
  { id: 'L07 array v2', title: 'Count zeros by pointer', cite: 'L07 p34', official: false, source: L07_ARRAY_V2, init: { regs: { 8: A } } },
]
