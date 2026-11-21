// Cycle model P0: every stage time is a lower bound problem solved in fetch order.
import { regLabel } from './stream'
import type {
  Explain, Forward, InstrResult, Operand, PipelineOptions, Row, Stage, StallCause, Stream, StreamItem,
} from './types'

export type Sched = Record<Stage, number>
interface Bound { stage: Stage; at: number }

/**
 * Earliest stage times after `prev`. A row may finish stage s only once the row ahead has finished
 * stage s+1 (it frees the latch), which also gives s >= prev.s + 1. Blank cells appear where a bound waits.
 */
export function place(prev: Sched | null, bounds: Bound[]): Sched {
  const lb = (s: Stage) => Math.max(0, ...bounds.filter((b) => b.stage === s).map((b) => b.at))
  const IF = Math.max(prev ? Math.max(prev.IF + 1, prev.ID) : 1, lb('IF'))
  const ID = Math.max(IF + 1, prev ? prev.EX : 0, lb('ID'))
  const EX = Math.max(ID + 1, prev ? prev.MEM : 0, lb('EX'))
  const MEM = Math.max(EX + 1, prev ? prev.WB : 0, lb('MEM'))
  const WB = Math.max(MEM + 1, prev ? prev.WB + 1 : 0, lb('WB'))
  return { IF, ID, EX, MEM, WB }
}

/** Internal row with the full (hypothetical) schedule, used again for the hardware view. */
export interface PlacedRow extends Row {
  full: Sched
  /** uid of the row ahead of it in the pipe (flushed rows are skipped by the next correct fetch). */
  prevUid: string | null
  /** Earliest fetch cycle allowed by a branch or jump (the PC is not known before it). */
  fetchFloor: number
  item?: StreamItem
}

export interface Simulated {
  instructions: InstrResult[]
  rows: PlacedRow[]
  bySeq: Map<number, Sched>
}

const resolvesIn = (it: StreamItem, o: PipelineOptions): 'ID' | 'MEM' | null =>
  it.cls === 'branch' ? o.branchStage : it.cls === 'jump' || it.cls === 'jr' ? o.jumpStage : null

export function simulate(stream: Stream, o: PipelineOptions): Simulated {
  const items = stream.items
  const rl = (r: number) => regLabel(r, stream.regStyle)
  const instructions: InstrResult[] = []
  const rows: PlacedRow[] = []
  const bySeq = new Map<number, Sched>()
  const resBySeq = new Map<number, InstrResult>()
  const lastWriter = new Map<number, StreamItem>()
  // Pending control effect on the next correct fetch.
  let pending: { from: StreamItem; floor: number; why: Explain; kind: 'branch' | 'jump' } | null = null
  let prev: { sched: Sched; uid: string } | null = null

  for (let k = 0; k < items.length; k++) {
    const it = items[k]
    const causes: { bound: Bound; cause: Omit<StallCause, 'cycles' | 'binding'> }[] = []
    const operands: (Omit<Operand, 'stalls' | 'forward'> & { bound: Bound; prod: StreamItem })[] = []

    // Data hazards: each source register against its nearest earlier writer.
    for (const r of it.reads) {
      const p = lastWriter.get(r)
      if (!p) continue
      const ps = bySeq.get(p.seq)!
      const d = it.seq - p.seq
      const load = p.cls === 'load'
      const pk = load ? 'lw' : 'an ALU instruction'
      let need: Operand['need'] = 'EX'
      let bound: Bound
      let kind: StallCause['kind']
      let why: Explain
      let isolated: number
      const isData = it.cls === 'store' && r === it.dataReg && it.instr.rs !== r
      if (!o.forwarding) {
        need = 'ID'
        bound = { stage: 'ID', at: ps.WB }
        kind = 'raw'
        isolated = Math.max(0, 3 - d)
        why = {
          rule: 'No forwarding: the reader gets the value in ID, which may share the writer\'s WB cycle (write in the first half, read in the second)',
          working: `ID of ${it.name} >= WB of ${p.name} = cycle ${ps.WB}; distance ${d} costs ${isolated}`,
          cite: 'L21 p10-11, p22',
        }
      } else if (resolvesIn(it, o) === 'ID' && it.cls !== 'jump') {
        need = 'ID'
        const ready = load ? ps.MEM : ps.EX
        bound = { stage: 'ID', at: ready + 1 }
        kind = 'branch-operand'
        isolated = Math.max(0, (load ? 3 : 2) - d)
        why = {
          rule: isolated
            ? `Early branch: the comparator in ID needs ${rl(r)} from ${pk}, so ID waits until the ${load ? 'memory data (MEM->ID)' : 'ALU result (ALU->ID)'} can be forwarded`
            : `Early branch: ${rl(r)} from ${pk} ${d} instructions back is forwarded to the comparator in ID in time, so no stall`,
          working: `ID of ${it.name} >= ${load ? 'MEM' : 'EX'} of ${p.name} + 1 = ${ready + 1}`,
          cite: load ? 'L21 p39' : 'L21 p38',
        }
      } else if (isData && o.storeData === 'mem') {
        need = 'MEM'
        const ready = load ? ps.MEM : ps.EX
        bound = { stage: 'MEM', at: ready + 1 }
        kind = 'store-data'
        isolated = 0
        why = {
          rule: 'Store data option "MEM": the value to store is only needed in MEM, so a MEM/WB->MEM path covers lw then sw. This path is not taught (only forwarding to EX, R11 p14)',
          working: `MEM of ${it.name} >= ${load ? 'MEM' : 'EX'} of ${p.name} + 1 = ${ready + 1}`,
          cite: 'spec ambiguity 6',
        }
      } else {
        const ready = load ? ps.MEM : ps.EX
        bound = { stage: 'EX', at: ready + 1 }
        kind = load ? (isData ? 'store-data' : 'load-use') : 'raw'
        isolated = Math.max(0, (load ? 2 : 1) - d)
        why = load
          ? {
            rule: !isolated
              ? `lw ${d} instructions back: its data reaches EX through MEM/WB or the register file in time, so no stall`
              : isData
                ? 'lw then sw of the loaded value: the store data is treated as an EX operand, so it waits like any load-use (option "EX", the course\'s EX-only forwarding)'
                : 'Load-use: lw has its data only after MEM, so the user\'s EX waits one cycle even with forwarding',
            working: `EX of ${it.name} >= MEM of ${p.name} + 1 = ${ready + 1}`,
            cite: isData ? 'R11 p14; spec ambiguity 6' : 'L21 p19-20',
          }
          : { rule: 'Forwarding: the ALU result goes from EX/MEM or MEM/WB straight to the next EX, so no stall', working: `EX of ${it.name} >= EX of ${p.name} + 1 = ${ready + 1}`, cite: 'L21 p18' }
      }
      operands.push({ register: r, producer: p.seq, distance: d, need, isolated, why, bound, prod: p })
      causes.push({ bound, cause: { kind, stage: bound.stage, producer: p.seq, register: r, why } })
    }

    // Control: the PC after a branch or jump is known only when it resolves.
    let fetchFloor = 0
    if (pending) {
      fetchFloor = pending.floor
      causes.push({ bound: { stage: 'IF', at: pending.floor }, cause: { kind: pending.kind, stage: 'IF', control: pending.from.seq, why: pending.why } })
      pending = null
    }

    const sched = place(prev?.sched ?? null, causes.map((c) => c.bound))
    const base = prev ? prev.sched.WB + 1 : 5
    const delay = sched.WB - base
    const stalls: StallCause[] = causes.map((c) => {
      const alone = place(prev?.sched ?? null, [c.bound]).WB - base
      return { ...c.cause, cycles: alone, binding: delay > 0 && alone === delay }
    }).filter((s) => s.cycles > 0)
    const uid = `c${it.seq}`
    bySeq.set(it.seq, sched)

    const ops: Operand[] = operands.map((op) => {
      const alone = place(prev?.sched ?? null, [op.bound]).WB - base
      const { bound: _b, prod, ...rest } = op
      void _b
      return { ...rest, stalls: alone, forward: forwardFor(op.register, op.need, prod, bySeq.get(prod.seq)!, it, sched, o, rl) }
    })

    const res: InstrResult = {
      uid, seq: it.seq, index: it.index, name: it.name, text: it.text, wrongPath: false,
      stages: sched, delay,
      delayWhy: prev
        ? { rule: 'Extra delay = WB - (previous WB + 1)', working: `${sched.WB} - (${prev.sched.WB} + 1) = ${delay}`, cite: 'AY23/24 S2 Q17 key' }
        : { rule: 'The first instruction finishes WB in cycle 5', working: `${sched.WB} - 5 = ${delay}`, cite: 'L20 p32' },
      stalls, operands: ops, flushes: [],
      ...(it.slot ? { slot: true } : {}),
      ...(it.taken !== undefined ? { taken: it.taken } : {}),
    }
    instructions.push(res)
    resBySeq.set(res.seq, res)
    rows.push({ ...res, full: sched, prevUid: prev?.uid ?? null, fetchFloor, item: it })
    if (it.writes !== null) lastWriter.set(it.writes, it)
    prev = { sched, uid }

    // Work out the control effect of a branch or jump (after its delay slot, if any).
    const ctrl = controlOf(k)
    if (ctrl) {
      const { b } = ctrl
      const bs = bySeq.get(b.seq)!
      const stage = resolvesIn(b, o)!
      const R = bs[stage]
      const next = items[k + 1]
      const effect = controlEffect(b, o, stage, R)
      resBySeq.get(b.seq)!.control = effect.why
      if (!next) continue
      if (effect.wrongFrom !== null) {
        let ps = sched
        let pu = uid
        let idx = effect.wrongFrom
        for (let w = 1; ; w++, idx++) {
          const s = place(ps, [])
          if (s.IF > R) break
          const inProg = idx >= 0 && idx < stream.program.instructions.length
          const wuid = `w${b.seq}.${w}`
          const stages: Partial<Sched> = {}
          for (const st of ['IF', 'ID', 'EX', 'MEM', 'WB'] as Stage[]) if (s[st] <= R) stages[st] = s[st]
          rows.push({
            uid: wuid, seq: null, index: inProg ? idx : null,
            name: inProg ? stream.names[idx] : outsideName(stream, idx),
            text: inProg ? stream.texts[idx] : '(not in the program)',
            wrongPath: true, ...(inProg ? {} : { outside: true }),
            stages, flushedAt: R, flushedBy: b.seq, full: s, prevUid: pu, fetchFloor: 0,
          })
          resBySeq.get(b.seq)!.flushes.push(wuid)
          ps = s
          pu = wuid
        }
      }
      if (effect.floor !== null) pending = { from: b, floor: effect.floor, why: effect.why, kind: b.cls === 'branch' ? 'branch' : 'jump' }
    }
  }
  return { instructions, rows, bySeq }

  /** The branch or jump whose shadow starts after item k (the slot, when delayed). */
  function controlOf(k: number): { b: StreamItem; after: StreamItem } | null {
    const it = items[k]
    if (it.slot && k > 0 && items[k - 1].cls === 'branch') return { b: items[k - 1], after: it }
    if (it.cls === 'branch' || it.cls === 'jump' || it.cls === 'jr') {
      if (it.cls === 'branch' && o.delayedBranch && items[k + 1]?.slot) return null
      return { b: it, after: it }
    }
    return null
  }

  function controlEffect(b: StreamItem, o: PipelineOptions, stage: 'ID' | 'MEM', R: number): { floor: number | null; wrongFrom: number | null; why: Explain } {
    const isBranch = b.cls === 'branch'
    const taken = isBranch ? !!b.taken : true
    const fall = b.index + 1 + (isBranch && o.delayedBranch ? 1 : 0)
    const target = targetIndex(b)
    const where = stage === 'MEM'
      ? (isBranch ? 'in MEM (base datapath)' : 'in MEM (T10 Additional assumption)')
      : (isBranch ? 'in ID (early branch)' : 'in ID (AY23/24 S2 Q17 assumption)')
    const cite = isBranch ? (stage === 'MEM' ? 'L21 p30-32' : 'L21 p34-36') : (stage === 'MEM' ? 'T10 Additional p10' : 'AY23/24 S2 Q17')
    const slot = isBranch && o.delayedBranch ? ' The delay slot runs first either way (L21 p46).' : ''
    const what = isBranch ? `${b.name} (${taken ? 'taken' : 'not taken'})` : `${b.name} (jump)`
    const working = `next fetch >= ${stage} of ${b.name} + 1 = ${R + 1}`
    if (o.prediction === 'none') {
      return { floor: R + 1, wrongFrom: null, why: { rule: `No prediction: fetching stops until ${what} resolves ${where}.${slot}`, working, cite } }
    }
    // Prediction is for branches only (L21 p40); T10 Additional p12 draws no wrong-path fetch after j.
    if (!isBranch) {
      return { floor: R + 1, wrongFrom: null, why: { rule: `Prediction covers branches only, so fetching waits until ${what} resolves ${where} (T10 Additional draws no flushed row after j)`, working, cite } }
    }
    if (o.prediction === 'not-taken') {
      if (!taken) return { floor: null, wrongFrom: null, why: { rule: `Predict not taken: ${what} goes the predicted way, so nothing is lost.${slot}`, cite: 'L21 p40' } }
      return {
        floor: R + 1, wrongFrom: fall,
        why: { rule: `Predict not taken: ${what} resolves ${where}; the instructions fetched after it are flushed and the target is fetched next.${slot}`, working, cite: `L21 p40-42; ${cite}` },
      }
    }
    // Predict taken: beyond the lectures; the target is fetched right after the branch (R11 p45).
    if (taken) return { floor: null, wrongFrom: null, why: { rule: `Predict taken (beyond the course): the target is fetched in the cycle after ${b.name}'s IF, so nothing is lost.${slot}`, cite: 'R11 p45; L21 p40' } }
    return {
      floor: R + 1, wrongFrom: target,
      why: { rule: `Predict taken (beyond the course): ${what} resolves ${where}; the target-path fetches are flushed and the next instruction is fetched.${slot}`, working, cite: 'R11 p45' },
    }
  }

  function targetIndex(b: StreamItem): number {
    const ins = stream.program.instructions
    const t = ins.findIndex((x) => x.address === b.instr.targetAddress)
    return t >= 0 ? t : ins.length
  }
}

function outsideName(stream: Stream, idx: number): string {
  const last = stream.names[stream.names.length - 1] ?? ''
  const m = /^(.*?)(\d+)$/.exec(last)
  return m ? `${m[1]}${Number(m[2]) + (idx - stream.names.length) + 1}` : '(past the end)'
}

/** Where the consumer actually gets the value, from the final schedule. */
function forwardFor(r: number, need: Operand['need'], p: StreamItem, ps: Sched, c: StreamItem, cs: Sched, o: PipelineOptions, rl: (r: number) => string): Forward {
  const base = { producer: p.seq, consumer: c.seq, register: r }
  const reg = (cycle: number): Forward => ({
    ...base, from: 'register file', to: 'ID', cycle,
    path: ps.WB === cycle ? 'register file (split cycle)' : 'register file',
    why: ps.WB === cycle
      ? { rule: `${p.name} writes ${rl(r)} in the first half of cycle ${cycle} and ${c.name} reads it in the second half`, cite: 'L21 p10-11' }
      : { rule: `${p.name} wrote ${rl(r)} in cycle ${ps.WB}, before ${c.name} reads it in cycle ${cycle}`, cite: 'L21 p11' },
  })
  const fwd = (from: 'EX/MEM' | 'MEM/WB', to: 'ID' | 'EX' | 'MEM', cycle: number, rule: string, cite: string): Forward => ({
    ...base, from, to, cycle, path: `${from} -> ${to}`, why: { rule, working: `cycle ${cycle}: ${p.name} is in ${from === 'EX/MEM' ? 'MEM' : 'WB'}`, cite },
  })
  // Same cycle as WB: L21 p39 calls it MEM->ID forwarding only for a stalled lw (fewer than 3 back); otherwise it is the split-cycle read.
  const lwStalled = p.cls === 'load' && c.seq - p.seq < 3
  if (!o.forwarding || need === 'ID' && (ps.WB < cs.ID || ps.WB === cs.ID && !lwStalled)) return reg(cs.ID)
  if (need === 'ID') {
    if (ps.WB === cs.ID) return fwd('MEM/WB', 'ID', cs.ID, `${rl(r)} from ${p.name} reaches the comparator in ID (L21 p39 calls it MEM->ID forwarding; the split-cycle register read gives the same value)`, 'L21 p39')
    return fwd('EX/MEM', 'ID', cs.ID, `ALU result ${rl(r)} from ${p.name} is forwarded to the comparator in ID (ALU->ID)`, 'L21 p38')
  }
  const ready = p.cls === 'load' ? ps.MEM : ps.EX
  if (need === 'MEM' && ready >= cs.EX) return fwd('MEM/WB', 'MEM', cs.MEM, `${rl(r)} from ${p.name} goes from MEM/WB to the data memory's write data (not taught)`, 'spec ambiguity 6')
  if (ps.WB <= cs.EX - 1) return reg(cs.EX - 1)
  if (ps.WB === cs.EX) return fwd('MEM/WB', 'EX', cs.EX, `${rl(r)} from ${p.name} is forwarded from MEM/WB to ${c.name}'s ALU input`, 'L21 p18; R11 p13')
  return fwd('EX/MEM', 'EX', cs.EX, `${rl(r)} from ${p.name} is forwarded from EX/MEM to ${c.name}'s ALU input`, 'L21 p18; R11 p13')
}
