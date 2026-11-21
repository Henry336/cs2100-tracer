/** Units and wires of the L11 p48 / L12 p30 drawing, and which wire values the cycle keeps. */

import type { ControlRow, MuxStagePolicy, StageId, UnitId, WireSpec } from './types'

export const UNITS: { id: UnitId; label: string; cite: string }[] = [
  { id: 'pc', label: 'PC', cite: 'L11 p18' },
  { id: 'im', label: 'Instruction memory', cite: 'L11 p16' },
  { id: 'add4', label: 'Adder (PC+4)', cite: 'L11 p17' },
  { id: 'control', label: 'Control', cite: 'L12 p7' },
  { id: 'rf', label: 'Register file', cite: 'L11 p23' },
  { id: 'regdst', label: 'RegDst mux', cite: 'L11 p26' },
  { id: 'sext', label: 'Sign extend', cite: 'L11 p28' },
  { id: 'alusrc', label: 'ALUSrc mux', cite: 'L11 p28' },
  { id: 'aluctl', label: 'ALU control', cite: 'L12 p25' },
  { id: 'alu', label: 'ALU', cite: 'L11 p34' },
  { id: 'shift', label: 'Left shift 2-bit', cite: 'L11 p37' },
  { id: 'badd', label: 'Adder (branch target)', cite: 'L11 p37' },
  { id: 'and', label: 'AND gate', cite: 'L12 p17' },
  { id: 'pcsrc', label: 'PCSrc mux', cite: 'L11 p37' },
  { id: 'dm', label: 'Data memory', cite: 'L11 p40' },
  { id: 'memtoreg', label: 'MemToReg mux', cite: 'L11 p43' },
]

/** Stage of each unit (L11 p11-46). The policy moves the ALUSrc mux: L11 p31 draws it in Decode, L12 p5 puts ALUSrc in the ALU stage. */
export function unitStage(id: UnitId, policy: MuxStagePolicy = 'L11'): StageId {
  switch (id) {
    case 'pc': case 'im': case 'add4': return 'fetch'
    case 'control': case 'rf': case 'regdst': case 'sext': return 'decode'
    case 'alusrc': return policy === 'L11' ? 'decode' : 'alu'
    case 'aluctl': case 'alu': case 'shift': case 'badd': case 'and': case 'pcsrc': return 'alu'
    case 'dm': case 'memtoreg': return 'memory'
  }
}

type Spec = Omit<WireSpec, 'stage'> & { stage: StageId | 'alusrc' }

const W = (id: string, from: WireSpec['from'], to: UnitId, port: string, label: string, bits: number, stage: Spec['stage'], kind: WireSpec['kind'] = 'data'): Spec =>
  ({ id, from, to, port, label, bits, kind, stage })

// Stage = when the wire carries its value. Instruction fields light up where they are used; WR and WD in the register-write stage (L11 p44-46).
const SPECS: Spec[] = [
  W('pc-im', 'pc', 'im', 'Instruction address', 'PC', 32, 'fetch'),
  W('pc-add4', 'pc', 'add4', 'in A', 'PC', 32, 'fetch'),
  W('four', 'const4', 'add4', 'in B', '4', 32, 'fetch'),
  W('pc4-pcsrc', 'add4', 'pcsrc', 'in0', 'PC+4', 32, 'fetch'),
  W('pc4-badd', 'add4', 'badd', 'in A', 'PC+4', 32, 'fetch'),
  W('inst-op', 'im', 'control', 'Inst[31:26]', 'opcode', 6, 'decode'),
  W('inst-rs', 'im', 'rf', 'RR1', 'Inst[25:21]', 5, 'decode'),
  W('inst-rt-rr2', 'im', 'rf', 'RR2', 'Inst[20:16]', 5, 'decode'),
  W('inst-rt-regdst', 'im', 'regdst', 'in0', 'Inst[20:16]', 5, 'decode'),
  W('inst-rd', 'im', 'regdst', 'in1', 'Inst[15:11]', 5, 'decode'),
  W('inst-imm', 'im', 'sext', 'in', 'Inst[15:0]', 16, 'decode'),
  W('inst-funct', 'im', 'aluctl', 'funct', 'Inst[5:0]', 6, 'alu'),
  W('rd1', 'rf', 'alu', 'A', 'RD1', 32, 'decode'),
  W('rd2-alusrc', 'rf', 'alusrc', 'in0', 'RD2', 32, 'decode'),
  W('rd2-dm', 'rf', 'dm', 'Write Data', 'RD2', 32, 'decode'),
  W('sext-alusrc', 'sext', 'alusrc', 'in1', 'SignExt', 32, 'decode'),
  W('sext-shift', 'sext', 'shift', 'in', 'SignExt', 32, 'decode'),
  W('alub', 'alusrc', 'alu', 'B', 'ALU B', 32, 'alusrc'),
  W('shift-badd', 'shift', 'badd', 'in B', 'SignExt << 2', 32, 'alu'),
  W('btarget', 'badd', 'pcsrc', 'in1', 'Branch target', 32, 'alu'),
  W('alu-dm', 'alu', 'dm', 'Address', 'ALU result', 32, 'alu'),
  W('alu-mtr', 'alu', 'memtoreg', 'in0', 'ALU result', 32, 'alu'),
  W('iszero', 'alu', 'and', 'in', 'isZero', 1, 'alu'),
  W('nextpc', 'pcsrc', 'pc', 'next PC', 'Next PC', 32, 'alu'),
  W('dm-mtr', 'dm', 'memtoreg', 'in1', 'Read Data', 32, 'memory'),
  W('wr', 'regdst', 'rf', 'WR', 'WR', 5, 'regwrite'),
  W('wd', 'memtoreg', 'rf', 'WD', 'WD', 32, 'regwrite'),
  W('c-regdst', 'control', 'regdst', 'select', 'RegDst', 1, 'decode', 'control'),
  W('c-regwrite', 'control', 'rf', 'RegWrite', 'RegWrite', 1, 'decode', 'control'),
  W('c-alusrc', 'control', 'alusrc', 'select', 'ALUSrc', 1, 'decode', 'control'),
  W('c-aluop', 'control', 'aluctl', 'ALUop', 'ALUop', 2, 'decode', 'control'),
  W('c-memread', 'control', 'dm', 'MemRead', 'MemRead', 1, 'decode', 'control'),
  W('c-memwrite', 'control', 'dm', 'MemWrite', 'MemWrite', 1, 'decode', 'control'),
  W('c-memtoreg', 'control', 'memtoreg', 'select', 'MemToReg', 1, 'decode', 'control'),
  W('c-branch', 'control', 'and', 'in', 'Branch', 1, 'decode', 'control'),
  W('c-alucontrol', 'aluctl', 'alu', 'ALUcontrol', 'ALUcontrol', 4, 'alu', 'control'),
  W('c-pcsrc', 'and', 'pcsrc', 'select', 'PCSrc', 1, 'alu', 'control'),
]

/** Extra control wire for the derived bne row. */
export const BRANCHNE_WIRE: Spec = W('c-branchne', 'control', 'and', 'in', 'BranchNE', 1, 'decode', 'control')

export function wireSpecs(policy: MuxStagePolicy = 'L11', withBranchNE = false): WireSpec[] {
  return [...SPECS, ...(withBranchNE ? [BRANCHNE_WIRE] : [])].map((s) => ({ ...s, stage: s.stage === 'alusrc' ? unitStage('alusrc', policy) : s.stage }))
}

/**
 * Wires whose values are kept this cycle: traced back from the PC, the register write (if RegWrite) and the memory write (if MemWrite).
 * Every other wire still carries a value that a mux or an enable discards (T04 Answers p3).
 */
export function usedWires(row: ControlRow, pcSrc: 0 | 1): Set<string> {
  const used = new Set<string>(['pc-im', 'inst-op', 'nextpc', 'c-pcsrc', 'c-branch', 'c-regwrite', 'c-memread', 'c-memwrite'])
  const mark = (...ids: string[]) => ids.forEach((id) => used.add(id))
  mark(pcSrc === 1 ? 'btarget' : 'pc4-pcsrc')
  if (row.BranchNE !== undefined) mark('c-branchne')
  if (row.Branch === 1 || row.BranchNE === 1) mark('iszero')
  if (row.RegWrite === 1) {
    mark('wd', 'wr', 'c-memtoreg', 'c-regdst')
    mark(row.MemToReg === 1 ? 'dm-mtr' : 'alu-mtr')
    mark(row.RegDst === 1 ? 'inst-rd' : 'inst-rt-regdst')
  }
  if (row.MemWrite === 1) mark('alu-dm', 'rd2-dm')
  if (used.has('dm-mtr')) mark('alu-dm')
  if (['alu-dm', 'alu-mtr', 'iszero'].some((id) => used.has(id))) mark('rd1', 'alub', 'c-alucontrol', 'c-alusrc')
  if (used.has('alub')) mark(row.ALUSrc === 1 ? 'sext-alusrc' : 'rd2-alusrc')
  if (used.has('btarget')) mark('pc4-badd', 'shift-badd', 'sext-shift')
  if (used.has('c-alucontrol')) {
    mark('c-aluop')
    if (row.ALUop1 === 1) mark('inst-funct')
  }
  if (used.has('rd1')) mark('inst-rs')
  if (used.has('rd2-alusrc') || used.has('rd2-dm')) mark('inst-rt-rr2')
  if (used.has('sext-alusrc') || used.has('sext-shift')) mark('inst-imm')
  if (used.has('pc4-pcsrc') || used.has('pc4-badd')) mark('pc-add4', 'four')
  return used
}
