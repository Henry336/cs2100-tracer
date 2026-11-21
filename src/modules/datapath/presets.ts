/** Presets for the tracer: every course example from the engine fixtures, plus the two stuck-at fault questions. */

import { DATAPATH_PRESETS, DEFAULT_PC, type ControlRow } from '../../core/datapath'
import { hex, memInitText, regInitText, wordsToMem } from '../../core/mips'

export type Fault = { s: keyof ControlRow; v: 0 | 1 } | null

export interface TracePreset {
  name: string
  source: string
  src: string
  pc: string
  regs: string
  mem: string
  fault: Fault
}

const memWords = (words: Record<number, number>) =>
  memInitText(Object.assign({}, ...Object.entries(words).map(([a, v]) => wordsToMem(+a, [v >>> 0]))))

export const TRACE_PRESETS: TracePreset[] = [
  ...DATAPATH_PRESETS.map((p) => ({
    name: p.title,
    source: p.source,
    src: p.input.source,
    pc: hex(p.input.pc ?? DEFAULT_PC),
    regs: regInitText(p.input.regs ?? {}),
    mem: memInitText(p.input.mem ?? {}),
    fault: null,
  })),
  {
    name: 'addi $s1, $t1, 12 with MemToReg stuck at 1',
    source: 'AY15/16 S1 Q9b, no key',
    src: 'addi $s1, $t1, 12',
    pc: hex(DEFAULT_PC),
    regs: regInitText({ 17: 4, 9: 8 }),
    mem: memWords({ 0: 57, 4: -43, 8: 100, 12: 3, 16: 98, 20: 62, 24: -31 }),
    fault: { s: 'MemToReg', v: 1 },
  },
  {
    name: 'lw $t1, 0($t0) with ALUSrc stuck at 0',
    source: 'AY17/18 S2 Q4c',
    src: 'lw $t1, 0($t0)',
    pc: hex(DEFAULT_PC),
    regs: regInitText({ 8: 12, 9: 34 }),
    mem: '',
    fault: { s: 'ALUSrc', v: 0 },
  },
]

/** Opening state: T04 Q3(b) with a base address and one memory word so every wire has a value. */
export const DEFAULT_TRACE = {
  src: 'lw $24, 0($15)',
  pc: hex(DEFAULT_PC),
  regs: regInitText({ 15: 0x10010000, 24: 7 }),
  mem: memWords({ 0x10010000: 42 }),
}
