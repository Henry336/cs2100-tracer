/** Single-cycle datapath tracer: one instruction through the L11 p48 / L12 p30 datapath. */

import { assemble, bin, decode, hex, instrText, readWord, signExt16, type Instr } from '../mips'
import { aluCompute, aluControlGates, aluControlTable, aluopString, mainControl } from './control'
import { SIGNAL_MEANINGS } from './tables'
import { supportOf } from './support'
import type {
  Bit, Commit, ControlFault, ControlRow, DatapathInput, DatapathResult, Explain, Field, MuxStagePolicy, PortValue, StageFrame, StageId, UnitId, WireValue,
} from './types'
import { UNITS, unitStage, usedWires, wireSpecs } from './wires'

const u32 = (n: number) => n >>> 0
const dec = (n: number) => String(n | 0)
const show = (n: number) => `${hex(n)} (${dec(n)})`
// 0x with any number of digits (leading zeros are notation, L08 p23; too many digits gets decode's 32-bit error), or 8 bare digits; # comment allowed.
const HEX_WORD = /^\s*(?:0x([0-9a-f]+)|([0-9a-f]{8}))\s*(?:#.*)?$/i

export const DEFAULT_PC = 0x00400000

type Picked = { ins: Instr; data: { address: number; bytes: number[] }[] }

function pickInstr(input: DatapathInput): Picked | { errors: { line: number; message: string }[] } {
  const pc = u32(input.pc ?? DEFAULT_PC)
  const m = HEX_WORD.exec(input.source)
  if (m) {
    const d = decode(parseInt(m[1] ?? m[2], 16), pc)
    return 'error' in d ? { errors: [{ line: 1, message: d.error }] } : { ins: { ...d, line: 1 }, data: [] }
  }
  if (!input.source.trim()) return { errors: [{ line: 1, message: 'type one instruction, for example add $t2, $t0, $t1, or an 8-digit hex word' }] }
  const p = assemble(input.source, { textBase: pc })
  if (p.errors.length) return { errors: p.errors }
  const i = input.index ?? 0
  const ins = p.instructions[i]
  if (!ins) return { errors: [{ line: 0, message: p.instructions.length ? `there is no instruction number ${i + 1}; the source has ${p.instructions.length}` : 'the source has no instructions' }] }
  return { ins, data: p.data }
}

/** Trace one instruction for one clock cycle. Never throws on user input. */
export function traceDatapath(input: DatapathInput): DatapathResult {
  const picked = pickInstr(input)
  if ('errors' in picked) return { ok: false, errors: picked.errors }
  const { ins, data } = picked
  const support = supportOf(ins.mnemonic)
  const ctl = mainControl(ins.opcode, ins.mnemonic)
  if (support.level === 'unsupported' || !ctl) {
    return {
      ok: false,
      instr: ins,
      support,
      errors: [{ line: ins.line, message: `${ins.mnemonic} does not run on the course datapath: ${support.notes[support.notes.length - 1]?.rule ?? 'no control row'} (${support.notes[support.notes.length - 1]?.cite ?? 'L12 p9'})` }],
    }
  }
  // .data words the source defines (default base 0x10010000, Lab 4 p4) seed data memory; input.mem wins on a clash.
  const mem: Record<number, number> = {}
  for (const seg of data) seg.bytes.forEach((b, k) => { mem[u32(seg.address + k)] = b })
  const faults: ControlFault[] = Object.entries(input.faults ?? {})
    .filter(([k, v]) => (v === 0 || v === 1) && (k in ctl.row || k === 'BranchNE'))
    .map(([k, v]) => ({ signal: k as keyof ControlRow, table: ctl.row[k as keyof ControlRow], forced: v as 0 | 1 }))
  const row: ControlRow = { ...ctl.row, ...Object.fromEntries(faults.map((f) => [f.signal, f.forced])) }
  return build(ins, row, ctl.why, support, { ...input, mem: { ...mem, ...input.mem } }, faults)
}

function build(ins: Instr, row: ControlRow, rowWhy: Explain, support: ReturnType<typeof supportOf>, input: DatapathInput, faults: ControlFault[]): DatapathResult {
  const policy: MuxStagePolicy = input.muxStage ?? 'L11'
  const pc = ins.address
  const regs = Array.from({ length: 32 }, (_, n) => (n === 0 ? 0 : u32(input.regs?.[n] ?? 0)))
  const mem = input.mem ?? {}
  const { rs, rt, rd, opcode, funct, shamt, word } = ins
  const raw = word & 0xffff
  const isR = ins.format === 'R'
  const isBranch = row.Branch === 1 || row.BranchNE === 1

  // Values, in signal-flow order.
  const pc4 = u32(pc + 4)
  const rd1 = regs[rs]
  const rd2 = regs[rt]
  const sext = u32(signExt16(raw))
  const ofst = signExt16(raw)
  const shifted = u32(ofst * 4)
  const btarget = u32(pc4 + shifted)
  const aluB = row.ALUSrc === 1 ? sext : rd2
  const aluop = aluopString(row)
  const gates = aluControlGates(row.ALUop1 as 0 | 1, row.ALUop0 as 0 | 1, funct)
  // A faulted ALUop can leave the L12 p26 table (e.g. 11); the R06 p20 gates still give a code.
  const code = aluControlTable(aluop, funct) ?? gates.code
  const aluOrNull = aluCompute(code, rd1, aluB)
  if (!aluOrNull) return { ok: false, instr: ins, support, errors: [{ line: ins.line, message: `ALUop ${aluop} with funct ${bin(funct, 6)} gives ALUcontrol ${code}, which is not an ALU operation (L11 p34, R06 p20)` }] }
  const alu = aluOrNull
  const isZero = alu.isZero
  const pcSrc: 0 | 1 = (row.Branch === 1 && isZero === 1) || (row.BranchNE === 1 && isZero === 0) ? 1 : 0
  const nextPc = pcSrc ? btarget : pc4
  const addr = alu.result
  const readData = row.MemRead === 1 ? u32(readWord(mem, addr)) : null
  const wr = row.RegDst === 1 ? rd : row.RegDst === 0 || rt === rd ? rt : null
  const wd = row.MemToReg === 1 ? readData : row.MemToReg === 0 ? alu.result : null

  // Symbolic (T04 Answers p3 notation).
  const R = (n: number) => `$${n}`
  const C = (n: number) => `[$${n}]`
  const bSym = row.ALUSrc === 1 ? dec(ofst) : C(rt)
  const aluSym = (() => {
    const a = C(rs)
    switch (alu.op) {
      case 'add': return row.ALUSrc === 1 && ofst < 0 ? `${a}-${-ofst}` : `${a}+${bSym}`
      case 'subtract': return `${a}-${bSym}`
      case 'AND': return `${a} AND ${bSym}`
      case 'OR': return `${a} OR ${bSym}`
      case 'slt': return `(${a} < ${bSym} ? 1 : 0)`
      case 'NOR': return `${a} NOR ${bSym}`
    }
  })()
  const memSym = `Mem(${aluSym})`
  const opSign = { add: '+', subtract: '-', AND: 'AND', OR: 'OR', slt: '<', NOR: 'NOR' }[alu.op]

  const used = usedWires(row, pcSrc)
  const u = (...ids: string[]) => ids.some((id) => used.has(id))

  const P = (id: string, label: string, value: number | null, text: string, symbolic: string, isUsed: boolean, why: Explain): PortValue =>
    ({ id, label, value, text, symbolic, used: isUsed, why })

  const ports: Record<string, PortValue> = {}
  const add = (p: PortValue) => { ports[p.id] = p }
  add(P('pc', 'PC', pc, hex(pc), 'PC', true, { rule: 'The PC is read during the cycle and written at the next rising clock edge', working: `PC = ${hex(pc)}`, cite: 'L11 p18' }))
  add(P('instruction', 'Instruction', word, hex(word), ins.text, true, { rule: 'Instruction memory returns the word at address PC', working: `IM(${hex(pc)}) = ${hex(word)} = ${bin(word, 32)}`, cite: 'L11 p16' }))
  add(P('pc4', 'PC+4', pc4, hex(pc4), 'PC+4', u('pc4-pcsrc', 'pc4-badd'), { rule: 'A separate adder computes PC+4 every cycle', working: `${hex(pc)} + 4 = ${hex(pc4)}`, cite: 'L11 p17' }))
  add(P('RR1', 'RR1', rs, R(rs), R(rs), u('inst-rs'), { rule: 'RR1 = Inst[25:21] (rs)', working: `Inst[25:21] = ${bin(rs, 5)} = ${rs}`, cite: 'L11 p24' }))
  add(P('RR2', 'RR2', rt, R(rt), R(rt), u('inst-rt-rr2'), { rule: 'RR2 = Inst[20:16] (rt), for every format', working: `Inst[20:16] = ${bin(rt, 5)} = ${rt}`, cite: 'L11 p24' }))
  add(P('WR', 'WR', wr, wr === null ? `$${rt} or $${rd}` : R(wr), wr === null ? `${R(rt)} or ${R(rd)}` : R(wr), u('wr'),
    row.RegDst === 'X'
      ? { rule: 'RegDst is X: the mux passes Inst[20:16] or Inst[15:11], and RegWrite is 0 so neither is written', working: `rt = ${rt}, rd = ${rd}`, cite: 'L12 p34, T04 Answers p3' }
      : { rule: row.RegDst === 1 ? 'RegDst = 1 selects Inst[15:11] (rd) as the write register' : 'RegDst = 0 selects Inst[20:16] (rt) as the write register', working: `WR = ${wr}`, cite: 'L11 p26, L12 p10' }))
  add(P('RD1', 'RD1', rd1, hex(rd1), C(rs), u('rd1'), { rule: 'RD1 = contents of register RR1', working: `[$${rs}] = ${show(rd1)}`, cite: 'L11 p23' }))
  add(P('RD2', 'RD2', rd2, hex(rd2), C(rt), u('rd2-alusrc', 'rd2-dm'), { rule: 'RD2 = contents of register RR2 (read even when not needed)', working: `[$${rt}] = ${show(rd2)}`, cite: 'L11 p23' }))
  add(P('signExt', 'SignExt(Inst[15:0])', sext, hex(sext), hex(sext), u('sext-alusrc', 'sext-shift'),
    { rule: 'Sign extend copies bit 15 into bits 31..16; it runs for every instruction', working: `Inst[15:0] = ${hex(raw, 4)}, bit 15 = ${(raw >> 15) & 1}, so ${hex(sext)}`, cite: 'L11 p28' }))
  add(P('aluA', 'ALU input A (Opr1)', rd1, hex(rd1), C(rs), u('rd1'), { rule: 'ALU input A is always RD1', working: `[$${rs}] = ${show(rd1)}`, cite: 'L11 p33' }))
  add(P('aluB', 'ALU input B (Opr2)', aluB, hex(aluB), bSym, u('alub'),
    { rule: row.ALUSrc === 1 ? 'ALUSrc = 1 selects SignExt(Inst[15:0])' : 'ALUSrc = 0 selects RD2', working: row.ALUSrc === 1 ? `SignExt = ${show(sext)}` : `[$${rt}] = ${show(rd2)}`, cite: 'L11 p28, L12 p12' }))
  add(P('aluControl', 'ALUcontrol', parseInt(code, 2), code, code, u('c-alucontrol'),
    { rule: row.ALUop1 === 1 ? `ALUop 10 defers to funct ${bin(funct, 6)}: ${alu.op}` : `ALUop ${aluop} gives ${alu.op}; funct is ignored`, working: gates.why.working, cite: 'L12 p24-26, R06 p20' }))
  add(P('aluResult', 'ALU result', alu.result, hex(alu.result), aluSym, u('alu-dm', 'alu-mtr', 'iszero'),
    { rule: `ALUcontrol ${code} performs ${alu.op}`, working: alu.op === 'slt' ? `${dec(rd1)} < ${dec(aluB)} is ${alu.result ? 'true' : 'false'}, so ${alu.result}` : `${show(rd1)} ${opSign} ${show(aluB)} = ${show(alu.result)}`, cite: 'L11 p34' }))
  add(P('isZero', 'isZero', isZero, String(isZero), `(${aluSym}) == 0`, u('iszero'), { rule: 'isZero is 1 when the ALU result is 0', working: `result ${hex(alu.result)}, so isZero = ${isZero}`, cite: 'L11 p34' }))
  add(P('dmAddress', 'Data memory Address', addr, hex(addr), aluSym, u('alu-dm'), { rule: 'The ALU result always goes to the data memory address input', working: hex(addr), cite: 'L11 p40' }))
  add(P('dmWriteData', 'Data memory Write Data', rd2, hex(rd2), C(rt), u('rd2-dm'), { rule: 'RD2 always goes to Write Data; it is stored only if MemWrite = 1', working: `[$${rt}] = ${show(rd2)}`, cite: 'L11 p42' }))
  add(P('dmReadData', 'Data memory Read Data', readData, readData === null ? 'none' : hex(readData), readData === null ? 'random (MemRead = 0)' : memSym, u('dm-mtr'),
    readData === null
      ? { rule: 'With MemRead = 0 the memory returns nothing defined', cite: 'L11 p40, T04 Answers p3' }
      : { rule: 'MemRead = 1 reads the word at Address (big-endian)', working: `Mem(${hex(addr)}) = ${show(readData)}${addr % 4 ? `; ${hex(addr)} is not a multiple of 4, so a real lw would fault` : ''}`, cite: 'L11 p40, R02 p8' }))
  add(P('WD', 'WD', wd, wd === null ? (row.MemToReg === 1 ? 'random (MemRead = 0)' : 'ALU result or random') : hex(wd), row.MemToReg === 1 ? memSym : row.MemToReg === 0 ? aluSym : `${aluSym} or random value`, u('wd'),
    row.MemToReg === 'X'
      ? { rule: 'MemToReg is X, so WD is the ALU result or the (random) memory output; nothing is written because RegWrite is 0', working: `ALU result ${hex(alu.result)}`, cite: 'L12 p34, T04 Answers p3' }
      : { rule: row.MemToReg === 1 ? 'MemToReg = 1 selects the memory Read Data (the mux inputs are drawn swapped: 1 is on top)' : 'MemToReg = 0 selects the ALU result', working: wd === null ? '' : show(wd), cite: 'L11 p43, L12 p15' }))
  add(P('shifted', 'SignExt << 2', shifted, hex(shifted), `${dec(ofst)}×4`, u('shift-badd'), { rule: 'The branch offset counts instructions, so it is shifted left 2 bits (×4)', working: `${dec(ofst)} × 4 = ${dec(shifted)} = ${hex(shifted)}`, cite: 'L11 p37' }))
  add(P('branchTarget', 'Branch target', btarget, hex(btarget), `PC+4+${dec(shifted)}`, u('btarget'), { rule: 'Branch target = (PC+4) + SignExt(Inst[15:0]) << 2, computed every cycle', working: `${hex(pc4)} + ${hex(shifted)} = ${hex(btarget)}`, cite: 'L11 p37, L08 p28' }))
  const pcSrcWhy: Explain = row.BranchNE === 1
    ? { rule: 'bne logic: PCSrc = Branch·isZero + BranchNE·isZero\'', working: `0·${isZero} + 1·${isZero ? 0 : 1} = ${pcSrc}`, cite: 'AY25/26 Ans p15 (Q18 c, d)' }
    : { rule: 'PCSrc = Branch AND isZero; it is not a control-unit output', working: `${row.Branch} AND ${isZero} = ${pcSrc}`, cite: 'L12 p16-17' }
  add(P('pcSrc', 'PCSrc', pcSrc, String(pcSrc), isBranch ? (row.BranchNE === 1 ? "BranchNE·isZero'" : 'Branch·isZero') : '0', true, pcSrcWhy))
  add(P('nextPc', 'Next PC', nextPc, hex(nextPc), isBranch ? `PC+4 or PC+4+${dec(shifted)}` : 'PC+4', true,
    { rule: pcSrc ? 'PCSrc = 1 selects the branch target' : 'PCSrc = 0 selects PC+4', working: pcSrc ? `${hex(pc4)} + ${hex(shifted)} = ${hex(nextPc)}` : `${hex(pc)} + 4 = ${hex(nextPc)}`, cite: 'L12 p17' }))

  // Control signal explanations.
  const signalWhy: Partial<Record<keyof ControlRow, Explain>> = {}
  for (const k of Object.keys(row) as (keyof ControlRow)[]) {
    const v = row[k] as Bit
    const m = SIGNAL_MEANINGS[k]
    const fault = faults.find((f) => f.signal === k)
    signalWhy[k] = fault
      ? { rule: `${k} is stuck at ${v} by a hardware fault; the table gives ${fault.table ?? 'no such signal'}. ${v === 1 ? m.one : m.zero}`, cite: 'AY15/16 Q9b, AY17/18 Q4c' }
      : v === 'X'
      ? { rule: `${k} is X: nothing this instruction keeps passes through what it selects`, cite: 'L12 p34' }
      : k === 'ALUop1' || k === 'ALUop0'
        ? { rule: `ALUop = ${aluop}`, cite: 'L12 p24' }
        : { rule: `${k} = ${v}: ${v === 1 ? m.one : m.zero}`, cite: m.cite }
  }

  // Wires.
  const wireVal = (id: string): { value: number | null; bit?: Bit; text: string } => {
    switch (id) {
      case 'pc-im': case 'pc-add4': return { value: pc, text: hex(pc) }
      case 'four': return { value: 4, text: '4' }
      case 'pc4-pcsrc': case 'pc4-badd': return { value: pc4, text: hex(pc4) }
      case 'inst-op': return { value: opcode, text: bin(opcode, 6) }
      case 'inst-rs': return { value: rs, text: R(rs) }
      case 'inst-rt-rr2': case 'inst-rt-regdst': return { value: rt, text: R(rt) }
      case 'inst-rd': return { value: rd, text: R(rd) }
      case 'inst-imm': return { value: raw, text: hex(raw, 4) }
      case 'inst-funct': return { value: funct, text: bin(funct, 6) }
      case 'rd1': return { value: rd1, text: hex(rd1) }
      case 'rd2-alusrc': case 'rd2-dm': return { value: rd2, text: hex(rd2) }
      case 'sext-alusrc': case 'sext-shift': return { value: sext, text: hex(sext) }
      case 'alub': return { value: aluB, text: hex(aluB) }
      case 'shift-badd': return { value: shifted, text: hex(shifted) }
      case 'btarget': return { value: btarget, text: hex(btarget) }
      case 'alu-dm': case 'alu-mtr': return { value: alu.result, text: hex(alu.result) }
      case 'iszero': return { value: isZero, text: String(isZero) }
      case 'nextpc': return { value: nextPc, text: hex(nextPc) }
      case 'dm-mtr': return { value: readData, text: readData === null ? 'random' : hex(readData) }
      case 'wr': return { value: wr, text: wr === null ? `$${rt} or $${rd}` : R(wr) }
      case 'wd': return { value: wd, text: wd === null ? 'ALU result or random' : hex(wd) }
      case 'c-aluop': return { value: parseInt(aluop, 2), text: aluop }
      case 'c-alucontrol': return { value: parseInt(code, 2), text: code }
      case 'c-pcsrc': return { value: pcSrc, bit: pcSrc, text: String(pcSrc) }
    }
    const key = ({ 'c-regdst': 'RegDst', 'c-regwrite': 'RegWrite', 'c-alusrc': 'ALUSrc', 'c-memread': 'MemRead', 'c-memwrite': 'MemWrite', 'c-memtoreg': 'MemToReg', 'c-branch': 'Branch', 'c-branchne': 'BranchNE' } as Record<string, keyof ControlRow>)[id]
    const b = row[key] as Bit
    return { value: b === 'X' ? null : b, bit: b, text: String(b) }
  }
  const PORT_OF: Record<string, string> = {
    'pc-im': 'pc', 'pc-add4': 'pc', 'pc4-pcsrc': 'pc4', 'pc4-badd': 'pc4', 'inst-rs': 'RR1', 'inst-rt-rr2': 'RR2', rd1: 'RD1', 'rd2-alusrc': 'RD2', 'rd2-dm': 'dmWriteData',
    'sext-alusrc': 'signExt', 'sext-shift': 'signExt', alub: 'aluB', 'shift-badd': 'shifted', btarget: 'branchTarget', 'alu-dm': 'dmAddress', 'alu-mtr': 'aluResult',
    iszero: 'isZero', nextpc: 'nextPc', 'dm-mtr': 'dmReadData', wr: 'WR', wd: 'WD', 'c-alucontrol': 'aluControl', 'c-pcsrc': 'pcSrc',
  }
  const SIGNAL_OF: Record<string, keyof ControlRow> = { 'c-regdst': 'RegDst', 'c-regwrite': 'RegWrite', 'c-alusrc': 'ALUSrc', 'c-memread': 'MemRead', 'c-memwrite': 'MemWrite', 'c-memtoreg': 'MemToReg', 'c-branch': 'Branch', 'c-branchne': 'BranchNE', 'c-aluop': 'ALUop1' }
  const FIELD_WHY: Record<string, Explain> = {
    four: { rule: 'Constant 4 into the PC adder', cite: 'L11 p17' },
    'inst-op': { rule: 'Inst[31:26] goes to the control unit', working: `opcode ${bin(opcode, 6)}`, cite: 'L12 p7' },
    'inst-rt-regdst': { rule: 'Inst[20:16] also feeds RegDst mux input 0', cite: 'L11 p26' },
    'inst-rd': { rule: 'Inst[15:11] feeds RegDst mux input 1', cite: 'L11 p26' },
    'inst-imm': { rule: 'Inst[15:0] goes to sign extend', cite: 'L11 p28' },
    'inst-funct': { rule: 'Inst[5:0] goes to ALU control; only R-type (ALUop 10) looks at it', cite: 'L12 p25' },
  }
  const wires: WireValue[] = wireSpecs(policy, row.BranchNE !== undefined).map((s) => {
    const v = wireVal(s.id)
    const status = s.kind === 'control' && v.bit === 'X' ? 'dontcare' : used.has(s.id) ? 'used' : 'discarded'
    const why = PORT_OF[s.id] ? ports[PORT_OF[s.id]].why : SIGNAL_OF[s.id] ? signalWhy[SIGNAL_OF[s.id]]! : FIELD_WHY[s.id] ?? { rule: s.label }
    return { ...s, ...v, status, why }
  })

  // Units.
  const STATE: UnitId[] = ['pc', 'rf', 'dm']
  const units = UNITS.map((un) => {
    const active = un.id === 'pc' || wires.some((w) => w.status === 'used' && (w.from === un.id || (STATE.includes(un.id) && w.to === un.id && w.kind === 'data')))
    return { id: un.id, label: un.label, active, stage: unitStage(un.id, policy), why: active ? `Output kept (${un.cite})` : `Still runs; output discarded (${un.cite})` }
  })

  const fields = fieldList(ins)
  const frames = stageFrames({ ins, row, policy, wires, ports, code, aluOpName: alu.op, pcSrc, isBranch, readData, wr, wd, ofst })
  const commit = commitOf(row, ports, wr, wd, addr, rd2, nextPc, pcSrcWhy, u32(readWord(mem, addr)))

  return {
    ok: true as const,
    instr: ins,
    pc,
    support,
    fields,
    control: { row, source: rowWhy, aluop, aluControl: code, aluAction: alu.op, pcSrc, pcSrcWhy, signalWhy, faults },
    ports,
    t04: [
      { label: 'RR1', port: 'RR1' }, { label: 'RR2', port: 'RR2' }, { label: 'WR', port: 'WR' }, { label: 'WD', port: 'WD' },
      { label: 'Opr1', port: 'aluA' }, { label: 'Opr2', port: 'aluB' }, { label: 'Address', port: 'dmAddress' }, { label: 'Write Data', port: 'dmWriteData' },
      { label: 'Next PC', port: 'nextPc' },
    ],
    wires,
    units,
    frames,
    commit,
    traps: trapsFor(ins, row, isR, shamt),
  }
}

function fieldList(ins: Instr): Field[] {
  const w = ins.word
  const f = (name: Field['name'], hi: number, lo: number, feeds: string): Field => {
    const value = (w >>> lo) & (2 ** (hi - lo + 1) - 1)
    return { name, hi, lo, value, bin: bin(value, hi - lo + 1), feeds }
  }
  const common = [f('opcode', 31, 26, 'Control'), f('rs', 25, 21, 'RR1'), f('rt', 20, 16, 'RR2 and RegDst in0')]
  if (ins.format === 'R') return [...common, f('rd', 15, 11, 'RegDst in1'), f('shamt', 10, 6, 'unused'), f('funct', 5, 0, 'ALU control')]
  return [...common, f('imm', 15, 0, 'Sign extend (also RegDst in1 via Inst[15:11], ALU control via Inst[5:0])')]
}

interface FrameCtx {
  ins: Instr
  row: ControlRow
  policy: MuxStagePolicy
  wires: WireValue[]
  ports: Record<string, PortValue>
  code: string
  aluOpName: string
  pcSrc: 0 | 1
  isBranch: boolean
  readData: number | null
  wr: number | null
  wd: number | null
  ofst: number
}

const STAGES: { stage: StageId; title: string; cite: string }[] = [
  { stage: 'fetch', title: 'Fetch', cite: 'L11 p11-18' },
  { stage: 'decode', title: 'Decode', cite: 'L11 p19-31' },
  { stage: 'alu', title: 'ALU', cite: 'L11 p32-37' },
  { stage: 'memory', title: 'Memory', cite: 'L11 p38-43' },
  { stage: 'regwrite', title: 'Register write', cite: 'L11 p44-46' },
]

function stageFrames(c: FrameCtx): StageFrame[] {
  const { ins, row, ports: p } = c
  const out = (label: string, port: string) => ({ label, text: `${p[port].text} = ${p[port].symbolic}`, why: p[port].why })
  const sig = (name: keyof ControlRow) => ({ name, value: String(row[name]), meaning: row[name] === 'X' ? "don't care" : row[name] === 1 ? SIGNAL_MEANINGS[name].one : SIGNAL_MEANINGS[name].zero })
  const aluSrcIn: StageId = c.policy === 'L11' ? 'decode' : 'alu'
  const isStore = row.MemWrite === 1
  const isLoad = row.MemRead === 1
  const writes = row.RegWrite === 1

  const decodeDoes = [
    `Control decodes opcode ${bin(ins.opcode, 6)} into the control signals.`,
    `Read ${p.RD1.symbolic} = ${p.RD1.text} and ${p.RD2.symbolic} = ${p.RD2.text}.`,
    `Sign extend turns ${hex(ins.word & 0xffff, 4)} into ${p.signExt.text}.`,
    writes ? `RegDst = ${row.RegDst} picks ${p.WR.text} as the write register.` : 'RegDst is X: no register is written.',
    aluSrcIn === 'decode' ? `ALUSrc = ${row.ALUSrc} makes operand 2 ${p.aluB.symbolic}.` : '',
  ].filter(Boolean).join(' ')

  const aluDoes = (() => {
    const pre = aluSrcIn === 'alu' ? `ALUSrc = ${row.ALUSrc} makes operand 2 ${p.aluB.symbolic}. ` : ''
    const core = `ALUcontrol ${c.code} (${c.aluOpName}): ${p.aluResult.symbolic} = ${p.aluResult.text}, isZero = ${p.isZero.text}.`
    if (c.isBranch) {
      return `${pre}${core} In parallel the target (PC+4) + ${c.ofst}×4 = ${p.branchTarget.text} is computed (L11 p36). PCSrc = ${p.pcSrc.text}, so the branch is ${c.pcSrc ? 'taken' : 'not taken'}.`
    }
    if (isLoad || isStore) return `${pre}${core} This is the memory address.`
    return `${pre}${core}`
  })()

  const memDoes = isLoad
    ? `MemRead = 1: read Mem(${p.dmAddress.text}) = ${p.dmReadData.text}.`
    : isStore
      ? `MemWrite = 1: write ${p.dmWriteData.symbolic} = ${p.dmWriteData.text} into Mem(${p.dmAddress.text}).`
      : c.isBranch
        ? 'No memory access (MemRead 0, MemWrite 0).'
        : 'No memory access (MemRead 0, MemWrite 0); the ALU result passes to the MemToReg mux.'

  const regDoes = writes
    ? c.wr === 0
      ? `RegWrite = 1 and WR = $0: the write is ignored because $zero is always 0.`
      : `RegWrite = 1: write ${p.WD.text} (${row.MemToReg === 1 ? 'memory data' : 'ALU result'}) into ${p.WR.text}.`
    : `RegWrite = 0: nothing is written${c.isBranch ? '; the PC takes the next PC value' : ''}.`

  const does: Record<StageId, string> = {
    fetch: `Read the instruction at ${p.pc.text}: ${p.instruction.text} (${[...new Set([instrText(ins, 'number'), ins.text])].join(', that is ')}). The adder computes PC+4 = ${p.pc4.text}.`,
    decode: decodeDoes,
    alu: aluDoes,
    memory: memDoes,
    regwrite: regDoes,
  }
  const signals: Record<StageId, StageFrame['signals']> = {
    fetch: [],
    decode: [sig('RegDst'), sig('RegWrite'), ...(aluSrcIn === 'decode' ? [sig('ALUSrc')] : [])],
    alu: [...(aluSrcIn === 'alu' ? [sig('ALUSrc')] : []), { name: 'ALUop', value: `${row.ALUop1}${row.ALUop0}`, meaning: 'first-level ALU decode' }, { name: 'ALUcontrol', value: c.code, meaning: c.aluOpName }, sig('Branch'), ...(row.BranchNE !== undefined ? [sig('BranchNE')] : [])],
    memory: [sig('MemRead'), sig('MemWrite'), { name: 'PCSrc', value: String(c.pcSrc), meaning: c.pcSrc ? SIGNAL_MEANINGS.PCSrc.one : SIGNAL_MEANINGS.PCSrc.zero }],
    regwrite: [sig('MemToReg'), sig('RegWrite')],
  }
  const outputs: Record<StageId, StageFrame['outputs']> = {
    fetch: [{ label: 'Instruction', text: bin(ins.word, 32), why: p.instruction.why }],
    decode: c.policy === 'L11' ? [out('Operand 1', 'aluA'), out('Operand 2', 'aluB')] : [out('RD1', 'RD1'), out('RD2', 'RD2'), out('SignExt', 'signExt')],
    alu: [out('ALU result', 'aluResult'), out('isZero', 'isZero')],
    memory: isLoad ? [out('Read Data', 'dmReadData')] : [{ label: 'Read Data', text: 'stage not used', why: { rule: 'Only loads read memory; for other instructions this stage is not executed', cite: 'R05 p38' } }],
    regwrite: [{
      label: 'Output',
      text: writes && c.wr !== 0 ? `none (${p.WD.text} is written into ${p.WR.text})` : 'none',
      why: { rule: `This stage has no output; it only writes the ALU or memory data into the write register${writes ? (c.wr === 0 ? ', and $zero ignores the write (L06 p34)' : '') : ' (here RegWrite = 0, so nothing is written)'}`, cite: 'R05 p38' },
    }],
  }
  const idle: Record<StageId, boolean> = { fetch: false, decode: false, alu: false, memory: !isLoad && !isStore, regwrite: !writes }
  const unitsIn: Record<StageId, UnitId[]> = {
    fetch: ['pc', 'im', 'add4'],
    decode: ['control', 'rf', 'regdst', 'sext', ...(aluSrcIn === 'decode' ? ['alusrc' as UnitId] : [])],
    alu: [...(aluSrcIn === 'alu' ? ['alusrc' as UnitId] : []), 'aluctl', 'alu', 'shift', 'badd', 'and', 'pcsrc'],
    memory: ['dm', 'memtoreg'],
    regwrite: ['rf'],
  }
  const known: string[] = []
  return STAGES.map((s, index) => {
    const activeWires = c.wires.filter((w) => w.stage === s.stage).map((w) => w.id)
    known.push(...activeWires)
    return { index, stage: s.stage, title: s.title, cite: s.cite, does: does[s.stage], idle: idle[s.stage], units: unitsIn[s.stage], activeWires, knownWires: [...known], signals: signals[s.stage], outputs: outputs[s.stage] }
  })
}

function commitOf(row: ControlRow, p: Record<string, PortValue>, wr: number | null, wd: number | null, addr: number, rd2: number, nextPc: number, pcSrcWhy: Explain, memWord: number): Commit {
  const notes: string[] = []
  let reg: Commit['reg'] = null
  if (row.RegWrite === 1 && wr !== null && wd !== null) {
    if (wr === 0) notes.push('The write goes to $zero, which always reads 0, so no register changes (L06 p34).')
    else reg = { number: wr, value: wd, why: { rule: 'At the clock edge Reg[WR] = WD', working: `$${wr} = ${hex(wd)}`, cite: 'L11 p23' } }
  } else if (row.RegWrite === 1) {
    // Only reachable through a fault: the table never pairs RegWrite 1 with an X or an unread memory.
    if (wr === null) notes.push(`RegWrite = 1 but RegDst is X, so which register is written (${p.WR.text}) is not defined.`)
    else if (row.MemToReg === 1) notes.push(`MemToReg = 1 picks the memory output, but MemRead = 0 so it is not defined (L11 p40). If the memory drives Mem(${hex(addr)}) = ${hex(memWord)} (${memWord | 0}) anyway, $${wr} gets that value.`)
  }
  const mem = row.MemWrite === 1 ? { address: addr, value: rd2, why: { rule: 'MemWrite = 1: Mem[Address] = Write Data', working: `Mem(${hex(addr)}) = ${hex(rd2)}`, cite: 'L11 p40' } } : null
  if ((row.MemWrite === 1 || row.MemRead === 1) && addr % 4) notes.push(`Address ${hex(addr)} is not a multiple of 4; a real lw or sw needs a word-aligned address (L07 p15).`)
  return { pc: { value: nextPc, why: { ...p.nextPc.why, rule: `${p.nextPc.why.rule}; written at the next rising edge (L11 p18). ${pcSrcWhy.rule}` } }, reg, mem, notes }
}

function trapsFor(ins: Instr, row: ControlRow, isR: boolean, shamt: number): Explain[] {
  const t: Explain[] = [{ rule: 'Every unit computes every cycle; control signals only decide which results are kept', cite: 'T04 Answers p3' }]
  const m = ins.mnemonic
  if (row.RegDst === 'X') t.push({ rule: 'RegDst and MemToReg are X, but RegWrite must be 0: a signal that changes state is never X', cite: 'L12 p34' })
  if (isR) {
    t.push({ rule: 'For R-type, ALUcontrol needs funct as well as the opcode (two-level decoding)', cite: 'L12 p18, p23' })
    t.push({ rule: 'Sign extend still outputs SignExt(Inst[15:0]) for an R-type; the ALUSrc mux discards it', cite: 'T04 Answers p3, AY25/26 midterm Q23' })
    if (shamt) t.push({ rule: `shamt is ${shamt} but the datapath never reads Inst[10:6]`, cite: 'L11 p48' })
  }
  if (!isR) t.push({ rule: 'For I-format instructions the destination register is rt (Inst[20:16]), which is why the RegDst mux exists', cite: 'L11 p25-26' })
  if (m === 'lw') {
    t.push({ rule: 'lw still sends [rt] to Write Data; it is not stored because MemWrite is 0', cite: 'T04 Answers p3' })
  }
  if (m === 'sw') {
    t.push({ rule: 'For sw, ALU input B is the immediate (address offset) and RD2 goes to Write Data', cite: 'L11 p42' })
    t.push({ rule: 'MemRead must be 0 for sw: only one of MemRead and MemWrite may be 1', cite: 'L11 p40' })
  }
  if (row.Branch === 1 || row.BranchNE === 1) {
    t.push({ rule: 'PCSrc is not a control-unit output; it is computed from Branch and isZero', cite: 'L12 p16-17' })
    t.push({ rule: 'Target = (PC+4) + offset×4, not PC + offset', cite: 'L08 p28, L11 p37' })
    t.push({ rule: 'WR still receives a register number and WD a junk value; nothing is written because RegWrite = 0', cite: 'T04 Answers p3' })
  }
  return t
}
