// Course pipeline examples (docs/spec/pipeline-cache.md P4-P19). Code and numbers only, no slide text.
import { wordsToMem } from '../mips'
import { AY2324S2_Q16 } from '../mips/fixtures'
import type { PipelineOptions, StreamOptions } from './types'

export interface PresetPart {
  label: string
  options: Partial<PipelineOptions>
  /** Replaces the preset's code for this part, e.g. part (e) edits one instruction. */
  source?: string
  stream?: StreamOptions
  expect: {
    cycles?: number
    stallCycles?: number
    /** Extra delay per named instruction (others 0), as in the AY23/24 S2 key. */
    delays?: Record<string, number>
    nops?: { after: string; count: number }[]
    flushed?: string[]
  }
  note?: string
}

export interface PipelinePreset {
  /** Spec fixture id. */
  id: string
  title: string
  cite: string
  /** true when the expected numbers come from slides or an answer key. */
  official: boolean
  source: string
  stream?: StreamOptions
  parts: PresetPart[]
}

const NOFWD = { forwarding: false } as const
const FWD = { forwarding: true } as const

export const L21_EX1 = `
sub $2, $1, $3
and $12, $2, $5
or  $13, $6, $2
add $14, $2, $2
sw  $15, 100($2)`

export const L21_EX3 = `
      addi $s0, $zero, 10
Loop: addi $s0, $s0, -1
      bne  $s0, $zero, Loop
      sub  $t0, $t1, $t2`

export const R11_Q6 = `
lw  $t2, 0($t1)    # inst A
lw  $t1, 100($t6)  # inst B
sub $t6, $t1, $t2  # inst C
add $t6, $t2, $t6  # inst D
and $t3, $t6, $0   # inst E
sw  $t6, 50($t1)   # inst F`

export const R11_Q7 = `
    lw  $s2, 0($s1)
    bne $s2, $s3, L1
    sub $s0, $s4, $s5
L1: add $s0, $s0, $s3`

export const AY2425_Q19 = `
lw   $s1, 20($s2)   # Inst1
lw   $s2, 40($s5)   # Inst2
add  $s5, $s2, $s1  # Inst3
addi $s5, $s1, 0x23 # Inst4
sub  $t1, $s5, $t2  # Inst5
sw   $s5, 50($s2)   # Inst6
add  $t5, $a0, $zero # Inst7`

export const AY2526_Q19 = `
add $s5, $s2, $s3   # Inst1
lw  $s2, 0($s4)     # Inst2
and $t2, $s5, $s4   # Inst3
or  $t1, $s2, $s3   # Inst4
and $s2, $s5, $t1   # Inst5
sw  $s2, 4($s4)     # Inst6
lw  $s3, 4($s4)     # Inst7
sub $s5, $t2, $t1   # Inst8
add $s0, $s4, $zero # Inst9`

export const AY2324S1_Q16 = `
      addi $2, $zero, 0     # i1
      addi $3, $zero, 0     # i2
Loop: add  $4, $2, $8       # i3
      lw   $5, 0($4)        # i4
      beq  $5, $zero, Skip  # i5
      addi $3, $3, 1        # i6
Skip: addi $2, $2, 4        # i7
      slti $5, $2, 8        # i8
      bne  $5, $zero, Loop  # i9
Exit:`

export const T10_Q3 = `
   add $1, $2, $3
   lw  $1, 0($1)
   beq $1, $0, L
   add $3, $2, $1
L: add $4, $2, $2`

export const T10_EXTRA = `
     add  $t0, $s0, $zero    #inst A
     add  $s2, $zero, $zero  #inst B
lp:  bne  $s2, $zero, done   #inst C
     beq  $t0, $zero, done   #inst D
     andi $t1, $t0, 0xFF     #inst E
     bne  $s1, $t1, nt       #inst F
     addi $s2, $s2, 1        #inst G
nt:  srl  $t0, $t0, 8        #inst H
     j    lp                 #inst J
done:`

export const AY2324S1_Q1 = `
      addi $1, $zero, 0
      addi $2, $zero, 0
Loop: beq  $2, $8, Exit
      sll  $3, $2, 2
      add  $3, $3, $7
      lw   $4, 0($3)
      slti $5, $4, 5
      bne  $5, $zero, Skip
      addi $1, $1, 1
Skip: addi $2, $2, 1
      j    Loop
Exit:`

const ARR = 0x10010000
const T10_REGS = { 16: 0xafaffafa | 0, 17: 0xff }

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: 'P4', title: 'RAW exercise 1', cite: 'L21 p21-23', official: true, source: L21_EX1,
    parts: [
      { label: 'No forwarding', options: NOFWD, expect: { cycles: 11, delays: { i2: 2 } } },
      { label: 'Forwarding', options: FWD, expect: { cycles: 9 } },
    ],
  },
  {
    id: 'P5', title: 'RAW exercise 2 (lw first)', cite: 'L21 p24-26', official: true, source: L21_EX1.replace('sub $2, $1, $3', 'lw  $2, 20($3)'),
    parts: [
      { label: 'No forwarding', options: NOFWD, expect: { cycles: 11 } },
      { label: 'Forwarding', options: FWD, expect: { cycles: 10, delays: { i2: 1 } } },
    ],
  },
  {
    id: 'P6', title: 'Branch prediction loop', cite: 'L21 p43-45', official: true, source: L21_EX3,
    parts: [
      { label: 'No prediction (early branch)', options: { ...FWD, branchStage: 'ID', prediction: 'none' }, expect: { cycles: 46 } },
      { label: 'Predict not taken (early branch)', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, expect: { cycles: 45 } },
    ],
  },
  {
    id: 'P7', title: 'Recitation quiz Q6', cite: 'R11 p44', official: true, source: R11_Q6,
    parts: [
      { label: 'No forwarding', options: NOFWD, expect: { cycles: 16, delays: { C: 2, D: 2, E: 2 } } },
      { label: 'Forwarding', options: FWD, expect: { cycles: 11, delays: { C: 1 } } },
    ],
  },
  {
    id: 'P8', title: 'Recitation quiz Q7 (predict taken)', cite: 'R11 p45', official: true, source: R11_Q7, stream: { outcomes: [true] },
    parts: [{ label: 'Forwarding, early branch, predict taken (beyond the course)', options: { ...FWD, branchStage: 'ID', prediction: 'taken' }, expect: { cycles: 9 } }],
  },
  {
    id: 'P9', title: 'Recitation quiz Q8', cite: 'R11 p46', official: true, source: R11_Q7, stream: { outcomes: [true] },
    parts: [{ label: 'Forwarding, branch in MEM, predict not taken', options: { ...FWD, branchStage: 'MEM', prediction: 'not-taken' }, expect: { cycles: 11 }, note: 'sub and add are flushed; the target add is fetched in cycle 7' }],
  },
  {
    id: 'P10', title: 'Exam template (a)-(e)', cite: 'AY24/25 Q19; R11 Addendum p3-4', official: true, source: AY2425_Q19,
    parts: [
      { label: '(a) stall cycles, no forwarding', options: NOFWD, expect: { stallCycles: 4, delays: { Inst3: 2, Inst5: 2 } } },
      { label: '(b) no forwarding', options: NOFWD, expect: { cycles: 15 } },
      { label: '(c) forwarding', options: FWD, expect: { cycles: 12, delays: { Inst3: 1 } } },
      { label: '(d) nops with forwarding', options: FWD, expect: { nops: [{ after: 'Inst2', count: 1 }] } },
      { label: '(e) Inst5 = sub $s5,$t1,$t2, forwarding', options: FWD, source: AY2425_Q19.replace('sub  $t1, $s5, $t2', 'sub  $s5, $t1, $t2'), expect: { cycles: 12 } },
    ],
  },
  {
    id: 'P11', title: 'Exam template (a)-(e)', cite: 'AY25/26 Q19; R11 Addendum p5-8', official: true, source: AY2526_Q19,
    parts: [
      { label: '(a) stall cycles, no forwarding', options: NOFWD, expect: { stallCycles: 5, delays: { Inst3: 1, Inst5: 2, Inst6: 2 } } },
      { label: '(b) no forwarding', options: NOFWD, expect: { cycles: 18 } },
      { label: '(c) forwarding', options: FWD, expect: { cycles: 13 } },
      { label: '(d) nops with forwarding', options: FWD, expect: { nops: [] } },
      { label: '(e) Inst8 = sub $s5,$t2,$s3, forwarding', options: FWD, source: AY2526_Q19.replace('sub $s5, $t2, $t1', 'sub $s5, $t2, $s3'), expect: { cycles: 14, delays: { Inst8: 1 } } },
    ],
  },
  {
    id: 'P12', title: 'Per-instruction delays, first iteration', cite: 'AY23/24 S2 Q17 (key p16-17)', official: true, source: AY2324S2_Q16,
    stream: { regs: { 16: 8, 17: ARR, 18: ARR + 0x100, 19: ARR + 0x200 }, stopAfter: { instr: 'i20' } },
    parts: [
      { label: '(a) ideal', options: FWD, expect: {}, note: 'ideal = 20 + 5 - 1 = 24' },
      { label: '(b) no forwarding, branch in MEM', options: { ...NOFWD, branchStage: 'MEM', jumpStage: 'ID' }, expect: { stallCycles: 17, delays: { i6: 1, i7: 2, i8: 3, i9: 2, i10: 2, i11: 3, i13: 2, i14: 2 } } },
      { label: '(c) forwarding, branch in MEM', options: { ...FWD, branchStage: 'MEM', jumpStage: 'ID' }, expect: { stallCycles: 7, delays: { i8: 3, i11: 3, i13: 1 } } },
      { label: '(d) forwarding, early branch, predict not taken', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken', jumpStage: 'ID' }, expect: { stallCycles: 3, delays: { i7: 1, i10: 1, i13: 1 } } },
    ],
  },
  {
    id: 'P13', title: 'Loop over non-zero elements, 2 iterations', cite: 'AY23/24 S1 Q16 (key p9)', official: true, source: AY2324S1_Q16,
    stream: { regs: { 8: ARR }, mem: wordsToMem(ARR, [3, 7]) },
    parts: [
      { label: '(b) no forwarding, early branch, no prediction', options: { ...NOFWD, branchStage: 'ID', prediction: 'none' }, expect: { cycles: 40 } },
      { label: '(c) forwarding, early branch, no prediction', options: { ...FWD, branchStage: 'ID', prediction: 'none' }, expect: { cycles: 29 } },
      { label: '(d) forwarding, early branch, predict not taken', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, expect: { cycles: 27 } },
    ],
  },
  {
    id: 'P15', title: 'lw then early branch', cite: 'T10 Q3 (answers p21-22)', official: true, source: T10_Q3,
    parts: [
      { label: 'Not taken (drawn like predict not taken)', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, stream: { outcomes: [false], stopAfter: { instr: 4 } }, expect: { cycles: 10, delays: { i3: 2 } }, note: 'T10 Q3 only says "resolution at ID"; its grid lets the next add continue, which is predict not taken (spec ambiguity 2). No prediction would give 11' },
      { label: 'Taken', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, stream: { outcomes: [true] }, expect: { cycles: 11, flushed: ['i4'] } },
    ],
  },
  {
    id: 'P16', title: 'Byte search loop', cite: 'T10 Additional Question', official: true, source: T10_EXTRA,
    stream: { regs: T10_REGS },
    parts: [
      { label: '(a) forwarding, no control hazard mechanism, A to H', options: { ...FWD, branchStage: 'MEM', prediction: 'none' }, stream: { regs: T10_REGS, stopAfter: { instr: 'H' } }, expect: { cycles: 20 } },
      { label: '(b) forwarding, predict not taken, A to H', options: { ...FWD, branchStage: 'MEM', prediction: 'not-taken' }, stream: { regs: T10_REGS, stopAfter: { instr: 'H' } }, expect: { cycles: 14 } },
      { label: '(c) early branch before the swap', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, stream: { regs: T10_REGS, stopAfter: { instr: 'C' } }, expect: { delays: { C: 1 } } },
      { label: '(c) after swapping A and B', options: { ...FWD, branchStage: 'ID', prediction: 'not-taken' }, source: swapAB(T10_EXTRA), stream: { regs: T10_REGS, stopAfter: { instr: 'C' } }, expect: { delays: {} } },
      { label: '(d) whole run, no control hazard mechanism, j in MEM', options: { ...FWD, branchStage: 'MEM', prediction: 'none', jumpStage: 'MEM' }, expect: { cycles: 83 } },
      { label: '(e) whole run, predict not taken, j in MEM', options: { ...FWD, branchStage: 'MEM', prediction: 'not-taken', jumpStage: 'MEM' }, expect: { cycles: 56 } },
    ],
  },
  {
    id: 'P17a', title: 'Ideal loop count (step -2)', cite: 'AY24/25 Q13', official: true,
    source: `
      addi $s0, $zero, 0x10
Loop: addi $s0, $s0, -2
      sub  $t0, $t1, $t2
      bne  $s0, 0, Loop
      add  $t3, $t4, $t5`,
    parts: [{ label: 'Ideal pipeline', options: FWD, expect: {} }],
  },
  {
    id: 'P17b', title: 'Ideal loop count (step -5)', cite: 'AY25/26 Q2', official: true,
    source: `
      addi $s0, $zero, 0x32
Loop: addi $s0, $s0, -5
      sub  $t0, $t1, $t2
      bne  $s0, 0, Loop
      add  $t3, $t4, $t5`,
    parts: [{ label: 'Ideal pipeline', options: FWD, expect: {} }],
  },
]

function swapAB(src: string): string {
  const lines = src.split('\n')
  const a = lines.findIndex((l) => l.includes('#inst A'))
  const b = lines.findIndex((l) => l.includes('#inst B'))
  ;[lines[a], lines[b]] = [lines[b], lines[a]]
  return lines.join('\n')
}

export const AY2526_Q4 = `
addi $s0, $0, 0x500
addi $s1, $t0, -2
addi $t2, $t1, 0x10
add  $t2, $s2, $s3`

export const AY2324S1_Q12 = `
L8: lw   $2, 0($5)    # I1
    slti $2, $2, 124  # I2
    bne  $2, $0, L3   # I3
    sw   $3, 0($5)    # I4
L3: add  $3, $3, $4   # I5
    lw   $5, 4($5)    # I6
    bne  $5, $0, L8   # I7`
