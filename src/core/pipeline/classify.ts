// What an instruction reads, writes and which control row it carries in the pipeline.
import { OP_BY_NAME, type Instr } from '../mips'
import type { ControlRow, OpClass } from './types'

export function opClass(i: Instr): OpClass {
  switch (OP_BY_NAME[i.mnemonic]?.kind) {
    case 'load': return 'load'
    case 'store': return 'store'
    case 'branch': return 'branch'
    case 'jump': return 'jump'
    case 'jr': return 'jr'
    case 'syscall': return 'other'
    default: return 'alu'
  }
}

/** Source and destination registers; $zero is never a dependency (R11 p15: Rd != 0). */
export function regUse(i: Instr): { reads: number[]; writes: number | null; dataReg?: number } {
  const kind = OP_BY_NAME[i.mnemonic]?.kind
  let reads: number[] = []
  let writes: number | null = null
  let dataReg: number | undefined
  switch (kind) {
    case 'arith': reads = [i.rs, i.rt]; writes = i.rd; break
    case 'shift': reads = [i.rt]; writes = i.rd; break
    case 'arithImm': case 'logicImm': case 'load': reads = [i.rs]; writes = i.rt; break
    case 'lui': writes = i.rt; break
    case 'store': reads = [i.rs, i.rt]; dataReg = i.rt; break
    case 'branch': reads = [i.rs, i.rt]; break
    case 'jr': reads = [i.rs]; break
    case 'jump': if (i.mnemonic === 'jal') writes = 31; break
  }
  return {
    reads: [...new Set(reads.filter((r) => r !== 0))],
    writes: writes === 0 ? null : writes,
    ...(dataReg !== undefined && dataReg !== 0 ? { dataReg } : {}),
  }
}

const row = (RegDst: ControlRow['EX']['RegDst'], ALUSrc: ControlRow['EX']['ALUSrc'], ALUop: string, MemRead: 0 | 1, MemWrite: 0 | 1, Branch: 0 | 1 | 'X', MemToReg: ControlRow['WB']['MemToReg'], RegWrite: 0 | 1, note?: string): ControlRow => ({
  EX: { RegDst, ALUSrc, ALUop },
  M: { MemRead, MemWrite, Branch },
  WB: { MemToReg, RegWrite },
  ...(note ? { note } : {}),
})

export const BUBBLE_CONTROL: ControlRow = row(0, 0, '00', 0, 0, 0, 0, 0, 'Bubble (nop): every control signal is 0, so nothing is written (T10 Answers p16)')

/** Control signals grouped by the stage that uses them (L20 p27). Rows outside the table are marked derived. */
export function controlRow(i: Instr): ControlRow {
  const kind = OP_BY_NAME[i.mnemonic]?.kind
  switch (kind) {
    case 'arith': return row(1, 0, '10', 0, 0, 0, 0, 1)
    case 'shift': return row(1, 0, '10', 0, 0, 0, 0, 1, 'Shifts are R-type, but the L11 datapath does not support them (L11 p47)')
    case 'load': return row(0, 1, '00', 1, 0, 0, 1, 1)
    case 'store': return row('X', 1, '00', 0, 1, 0, 'X', 0)
    case 'branch':
      return i.mnemonic === 'beq'
        ? row('X', 0, '01', 0, 0, 1, 'X', 0)
        : row('X', 0, '01', 0, 0, 1, 'X', 0, 'bne has no row in L12/L20; shown like beq. AY25/26 Q18 adds a separate bne signal')
    case 'arithImm':
      return row(0, 1, '00', 0, 0, 0, 0, 1, `${i.mnemonic} has no row in L12/L20; derived like addi (AY15/16 Q9a)`)
    case 'logicImm': case 'lui':
      return row(0, 1, '00', 0, 0, 0, 0, 1, i.mnemonic === 'lui'
        ? 'lui is not in the L11 p6 subset. Shown with the addi row (AY15/16 Q9a) only so the timing can be traced: ALUop 00 asks for an add and the immediate is sign-extended, so this datapath cannot do lui'
        : `${i.mnemonic} is not supported by the course datapath, which always sign-extends the immediate (L11 p6). Shown with the addi row (AY15/16 Q9a) only so the timing can be traced: ALUop 00 asks for an add, not ${i.mnemonic.slice(0, -1).toUpperCase()}`)
    default:
      return row('X', 'X', 'XX', 0, 0, 0, 'X', i.mnemonic === 'jal' ? 1 : 0, `${i.mnemonic} is not in the L20 datapath; assumed to change no state through these signals`)
  }
}
