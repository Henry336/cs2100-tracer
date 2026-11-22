/** Course examples for the datapath tracer, used by the tests and offered as UI presets. Numbers and instructions only. */

import type { DatapathInput } from './types'

export interface DatapathPreset {
  id: string
  title: string
  source: string
  /** true when the expected values come from slides or an answer key. */
  official: boolean
  input: DatapathInput
}

export const DATAPATH_PRESETS: DatapathPreset[] = [
  { id: 'FX1', title: 'beq $1, $3, 12', source: 'T04 Q3(a), T04 Answers p3', official: true, input: { source: 'beq $1, $3, 12' } },
  { id: 'FX2', title: 'lw $24, 0($15)', source: 'T04 Q3(b), T04 Answers p3', official: true, input: { source: 'lw $24, 0($15)' } },
  { id: 'FX3', title: 'sub $25, $20, $5', source: 'T04 Q3(c), T04 Answers p3', official: true, input: { source: 'sub $25, $20, $5' } },
  { id: 'FX4', title: '0x10000103 at PC 0x491', source: 'R06 p43-44 (AY24/25 midterm Q28)', official: true, input: { source: '0x10000103', pc: 0x491 } },
  { id: 'FX5', title: 'beq $9, $0, End at 0x1080', source: 'R05 Q8 p45-48', official: true, input: { source: '0x11200004', pc: 0x1080, regs: { 9: 0 } } },
  { id: 'FX6', title: 'add $t4, $v0, $s1', source: 'AY25/26 midterm Q20-25', official: true, input: { source: 'add $t4, $v0, $s1', regs: { 12: 0x100, 2: 0x200, 17: 0x300 } } },
  { id: 'AY2526Q7', title: '0x02898820', source: 'AY25/26 S1 Q7', official: true, input: { source: '0x02898820' } },
  { id: 'AY2425Q15', title: '0x0235C020', source: 'AY24/25 S1 Q15', official: true, input: { source: '0x0235C020' } },
  { id: 'AY1516Q9', title: 'addi $s1, $t1, 12 (derived row)', source: 'AY15/16 S1 Q9 (derived, no key)', official: false, input: { source: 'addi $s1, $t1, 12', regs: { 9: 8 } } },
  { id: 'FX7-sw', title: 'sw $21, -50($22)', source: 'L11 p42 (values derived)', official: false, input: { source: 'sw $21, -50($22)', regs: { 21: 7, 22: 0x10010040 } } },
  { id: 'bne', title: 'bne $t0, $t1, 3 (BranchNE)', source: 'AY25/26 S1 Q18(a), Ans p15 (row from key; values derived)', official: true, input: { source: 'bne $t0, $t1, 3', regs: { 8: 1, 9: 2 } } },
]
