// Per-cycle view for the pipelined datapath: who is in each stage and what each pipeline register holds.
import { hex, OP_BY_NAME } from '../mips'
import { BUBBLE_CONTROL, controlRow } from './classify'
import type { PlacedRow, Sched } from './schedule'
import { regLabel } from './stream'
import type { CycleFrame, Forward, InstrResult, PipeReg, RegContents, RegField, Stage, Stream, StreamItem } from './types'

interface Hw { ifStart: number; idStart: number; full: Sched; end: number }

/**
 * Hardware occupancy. Grid letters mark when a stage is done; in the hardware a stalled instruction
 * repeats ID while a bubble goes into EX, and the one behind it is held in IF (T10 Answers p16).
 */
function occupancy(rows: PlacedRow[]): Map<string, Hw> {
  const hw = new Map<string, Hw>()
  for (const r of rows) {
    const prev = r.prevUid ? hw.get(r.prevUid) : undefined
    const ifStart = Math.max(prev ? prev.idStart : 1, r.fetchFloor)
    const idStart = Math.max(ifStart + 1, prev ? prev.full.EX : 0)
    hw.set(r.uid, { ifStart, idStart, full: r.full, end: r.flushedAt ?? Infinity })
  }
  return hw
}

function stageAt(h: Hw, c: number): Stage | null {
  if (c > h.end) return null
  if (c >= h.ifStart && c < h.idStart) return 'IF'
  if (c >= h.idStart && c < h.full.EX) return 'ID'
  for (const s of ['EX', 'MEM', 'WB'] as Stage[]) if (h.full[s] === c) return s
  return null
}

/** Instruction kinds whose rs and rt both go through the ALU input muxes (rt is the store data for sw). */
const BOTH_INPUTS = new Set(['arith', 'store', 'branch'])

const READER: Record<PipeReg, Stage> = { 'IF/ID': 'ID', 'ID/EX': 'EX', 'EX/MEM': 'MEM', 'MEM/WB': 'WB' }

export function buildFrames(stream: Stream, rows: PlacedRow[], instructions: InstrResult[]): CycleFrame[] {
  const rl = (r: number) => regLabel(r, stream.regStyle)
  const hw = occupancy(rows)
  const total = Math.max(0, ...instructions.map((i) => i.stages.WB))
  const byUid = new Map(rows.map((r) => [r.uid, r]))
  const res = new Map(instructions.map((i) => [i.uid, i]))
  const bySeq = new Map(instructions.map((i) => [i.seq, i]))
  const initial = stream.items[0]?.values?.before
  // Per register: WB cycle and value of each write, in WB order (WB times strictly increase).
  const writesTo = new Map<number, { wb: number; v: number | undefined }[]>()
  for (const i of instructions) {
    const it = byUid.get(i.uid)!.item!
    if (it.writes === null) continue
    const list = writesTo.get(it.writes) ?? []
    list.push({ wb: i.stages.WB, v: it.values?.after[it.writes] })
    writesTo.set(it.writes, list)
  }

  /** Register file content read in the second half of `cycle` (writes land in the first half, L21 p11). */
  const regFile = (r: number, cycle: number): number | undefined => {
    const list = writesTo.get(r) ?? []
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (list[m].wb <= cycle) lo = m + 1
      else hi = m
    }
    return lo ? list[lo - 1].v : initial?.[r]
  }

  // Who is in each stage, who waits, which forwards and flushes happen: indexed by cycle (1-based).
  const at = <T,>(make: () => T): T[] => Array.from({ length: total + 1 }, make)
  const stageOf = at<Record<Stage, string | null>>(() => ({ IF: null, ID: null, EX: null, MEM: null, WB: null }))
  const waitingOf = at<CycleFrame['waiting']>(() => [])
  const forwardsOf = at<Forward[]>(() => [])
  const flushEvents = at<string[]>(() => [])
  const order: Stage[] = ['IF', 'ID', 'EX', 'MEM', 'WB']
  for (const r of rows) {
    const h = hw.get(r.uid)!
    for (let c = h.ifStart; c <= Math.min(total, h.end, h.full.WB); c++) {
      const s = stageAt(h, c)
      if (s) stageOf[c][s] = r.uid
    }
    for (let k = 1; k < order.length; k++) {
      const a = r.stages[order[k - 1]]
      const b = r.stages[order[k]]
      if (a !== undefined && b !== undefined) for (let c = a + 1; c < b && c <= total; c++) waitingOf[c].push({ uid: r.uid, after: order[k - 1] })
    }
  }
  for (const i of instructions) {
    const ins = stream.program.instructions[i.index]
    for (const o of i.operands) {
      const f = o.forward
      if (f.cycle > total || f.from === 'register file' && !f.path.includes('split')) continue
      // The same register on rs and rt: both ALU input muxes forward it (T10 Answers p18).
      if (f.to === 'EX' && f.from !== 'register file' && ins.rs === o.register && ins.rt === o.register && BOTH_INPUTS.has(OP_BY_NAME[ins.mnemonic]?.kind ?? '')) {
        forwardsOf[f.cycle].push({ ...f, input: 'ForwardA' }, { ...f, input: 'ForwardB' })
      } else forwardsOf[f.cycle].push(f)
    }
    const byCycle = new Map<number, string[]>()
    for (const u of i.flushes) {
      const r = byUid.get(u)!
      if (r.flushedAt === undefined) continue
      byCycle.set(r.flushedAt, [...(byCycle.get(r.flushedAt) ?? []), r.name])
    }
    for (const [c, names] of byCycle) if (c <= total) flushEvents[c].push(`${i.name} resolves: flush ${names.join(', ')}`)
  }

  const frames: CycleFrame[] = []
  let nextFetch = 0
  for (let c = 1; c <= total; c++) {
    const stages = stageOf[c]
    const regs = {} as Record<PipeReg, RegContents>
    for (const pr of ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'] as PipeReg[]) {
      const uid = stages[READER[pr]]
      regs[pr] = uid ? contents(byUid.get(uid)!, pr) : bubble(pr)
    }
    const forwards = forwardsOf[c]
    const events: string[] = []
    const wbUid = stages.WB
    let regWrite: CycleFrame['regWrite']
    if (wbUid && res.has(wbUid)) {
      const it = byUid.get(wbUid)!.item!
      if (it.writes !== null) {
        const v = it.values?.after[it.writes]
        regWrite = { register: it.writes, by: wbUid, ...(v === undefined ? {} : { value: v }) }
        events.push(`${it.name} writes ${rl(it.writes)}${v === undefined ? '' : ` = ${v}`} in the first half of the cycle`)
      }
    }
    for (const f of forwards) {
      if (f.input === 'ForwardB') continue
      const p = bySeq.get(f.producer)!
      const q = bySeq.get(f.consumer)!
      events.push(`${f.path}: ${rl(f.register)} from ${p.name} to ${q.name}${f.input ? ' (both ALU inputs)' : ''}`)
    }
    const idUid = stages.ID
    const idRes = idUid ? res.get(idUid) : undefined
    if (idUid && idRes) {
      const h = hw.get(idUid)!
      const exRes = stages.EX ? res.get(stages.EX) : undefined
      const exLoad = exRes && byUid.get(exRes.uid)!.item!.cls === 'load' ? exRes : undefined
      const lu = exLoad ? idRes.stalls.find((s) => s.stage === 'EX' && s.producer === exLoad.seq) : undefined
      if (exLoad && lu?.register !== undefined) {
        events.push(`Hazard detection: ${exLoad.name} in EX is a lw (ID/EX.MemRead = 1) and ID/EX.RegisterRt ${rl(lu.register)} is a source of ${idRes.name} in IF/ID, so HAZARD = 1. The PC and IF/ID hold, and a bubble enters EX next cycle (T10 Answers p16)`)
      }
      if (c > h.idStart) {
        const cause = idRes.stalls.find((s) => s.binding && s.kind !== 'branch' && s.kind !== 'jump')
        const p = cause?.producer ? bySeq.get(cause.producer) : undefined
        events.push(cause && p && cause.register !== undefined
          ? `${idRes.name} stays in ID and a bubble enters EX: ${KIND[cause.kind]} on ${rl(cause.register)} from ${p.name}`
          : `${idRes.name} stays in ID and a bubble enters EX`)
      }
    }
    if (!stages.IF) {
      while (nextFetch < instructions.length && hw.get(instructions[nextFetch].uid)!.ifStart <= c) nextFetch++
      const next = instructions[nextFetch]
      const ctrl = next && byUid.get(next.uid)!.fetchFloor > c ? next.stalls.find((s) => s.control !== undefined) : undefined
      const from = ctrl?.control !== undefined ? bySeq.get(ctrl.control) : undefined
      if (from) events.push(`IF is idle: the next PC is not known until ${from.name} resolves`)
    }
    events.push(...flushEvents[c])
    frames.push({ cycle: c, stages, waiting: waitingOf[c], regs, forwards, ...(regWrite ? { regWrite } : {}), events })
  }
  return frames

  function bubble(pr: PipeReg): RegContents {
    return { uid: null, name: 'bubble', fields: [], control: groups(pr, BUBBLE_CONTROL) }
  }

  function contents(r: PlacedRow, pr: PipeReg): RegContents {
    const ins = r.index !== null ? stream.program.instructions[r.index] : undefined
    if (!ins) return { uid: r.uid, name: r.name, fields: [{ label: 'Instruction', text: r.text }], control: {}, flushed: true }
    const it: StreamItem | undefined = r.item
    const v = it?.values
    const ctl = controlRow(ins)
    const val = (reg: number) => (v ? v.before[reg] : undefined)
    const f = (label: string, text: string, value?: number, note?: string): RegField => ({ label, text, ...(value === undefined ? {} : { value }), ...(note ? { note } : {}) })
    const shown = (reg: number, x: number | undefined) => `[${rl(reg)}]${x === undefined ? '' : ` = ${x}`}`
    const fields: RegField[] = []
    const wr = ins.mnemonic === 'jal' ? 31 : ctl.EX.RegDst === 1 ? ins.rd : ins.rt
    const wrNote = ctl.EX.RegDst === 'X' && ins.mnemonic !== 'jal' ? 'RegDst is X: nothing is written' : undefined
    const alu = aluResult(it, ins.imm)
    if (pr === 'IF/ID') {
      fields.push(f('Instruction', `${hex(ins.word)} ${r.text}`, ins.word), f('PC+4', hex(ins.address + 4), (ins.address + 4) >>> 0))
    } else if (pr === 'ID/EX') {
      const readCycle = hw.get(r.uid)!.full.EX - 1
      const opFor = (reg: number) => res.get(r.uid)?.operands.find((o) => o.register === reg)
      for (const [label, reg] of [['RD1', ins.rs], ['RD2', ins.rt]] as const) {
        const stale = v ? regFile(reg, readCycle) : undefined
        const op = opFor(reg)
        const note = op && op.forward.from !== 'register file' ? `EX takes ${shown(reg, val(reg))} from ${op.forward.path}` : undefined
        fields.push(f(label, shown(reg, reg === 0 ? 0 : stale), reg === 0 ? 0 : stale, note))
      }
      fields.push(
        f('Immediate (sign-extended)', `${hex(ins.imm, 8)} (${ins.imm})`, ins.imm, it?.cls === 'alu' && (OP_BY_NAME[ins.mnemonic]?.kind === 'logicImm' || ins.mnemonic === 'lui') ? `${ins.mnemonic} needs a zero-extended or shifted immediate; this datapath only sign-extends (L11 p6)` : undefined),
        f('PC+4', hex(ins.address + 4), (ins.address + 4) >>> 0),
        f('rt (Inst[20:16])', rl(ins.rt), ins.rt),
        f('rd (Inst[15:11])', rl(ins.rd), ins.rd),
      )
    } else if (pr === 'EX/MEM') {
      const target = (ins.address + 4 + ins.imm * 4) >>> 0
      fields.push(
        f('Branch target', hex(target), target, '(PC+4) + imm x 4, computed for every instruction'),
        f('ALU result', alu.text, alu.value),
        f('isZero', alu.zero === undefined ? 'X' : alu.zero ? '1' : '0', alu.zero === undefined ? undefined : alu.zero ? 1 : 0),
        f('RD2', shown(ins.rt, val(ins.rt)), val(ins.rt), 'after the forwarding mux; the store data for sw'),
        f('Write register', rl(wr), wr, wrNote),
      )
    } else {
      const md = v?.memRead
      fields.push(
        f('ALU result', alu.text, alu.value),
        f('Memory data', md ? `Mem[${hex(md.address)}] = ${md.value | 0}` : 'X (no read)', md ? md.value | 0 : undefined),
        f('Write register', rl(wr), wr, wrNote),
      )
    }
    return { uid: r.uid, name: r.name, fields, control: groups(pr, ctl), ...(r.wrongPath ? { flushed: true } : {}) }

    function aluResult(item: StreamItem | undefined, imm: number): { text: string; value?: number; zero?: boolean } {
      const cls = item?.cls
      const vals = item?.values
      if (!item || !ins) return { text: 'X' }
      if (cls === 'load' || cls === 'store') {
        const x = vals ? (vals.before[ins.rs] + imm) | 0 : undefined
        return { text: `[${rl(ins.rs)}] + ${imm}${x === undefined ? '' : ` = ${hex(x)}`}`, ...(x === undefined ? {} : { value: x }) }
      }
      if (cls === 'branch') {
        const x = vals ? (vals.before[ins.rs] - vals.before[ins.rt]) | 0 : undefined
        return { text: `[${rl(ins.rs)}] - [${rl(ins.rt)}]${x === undefined ? '' : ` = ${x}`}`, ...(x === undefined ? {} : { value: x, zero: x === 0 }) }
      }
      if (cls === 'alu' && item.writes !== null) {
        const x = vals?.after[item.writes]
        return { text: `${ins.mnemonic} result${x === undefined ? '' : ` = ${x}`}`, ...(x === undefined ? {} : { value: x, zero: x === 0 }) }
      }
      return { text: 'X' }
    }
  }
}

const KIND: Record<string, string> = { raw: 'RAW', 'load-use': 'load-use', 'branch-operand': 'branch operand', 'store-data': 'store data', branch: 'branch', jump: 'jump' }

function groups(pr: PipeReg, ctl: ReturnType<typeof controlRow>): RegContents['control'] {
  if (pr === 'IF/ID') return {}
  if (pr === 'ID/EX') return { EX: ctl.EX, M: ctl.M, WB: ctl.WB, ...(ctl.note ? { note: ctl.note } : {}) }
  if (pr === 'EX/MEM') return { M: ctl.M, WB: ctl.WB }
  return { WB: ctl.WB }
}
