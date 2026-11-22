/** Turns an engine trace (or a timing result) into what the diagram draws. No simulation happens here. */

import { LATENCY_PRESETS, UNITS, wireSpecs, type DatapathTrace, type DelayKey, type NodeId, type StageId, type TimingResult, type UnitId, type WireValue } from '../../core/datapath'
import { signExt16 } from '../../core/mips'
import type { NumMode } from './common'
import type { DiagramModel, Tone } from './Diagram'
import { WIRE_PATH } from './geometry'

export const STAGE_INDEX: Record<StageId, number> = { fetch: 0, decode: 1, alu: 2, memory: 3, regwrite: 4 }
/** Frames 0 to 4 are the L11 stages; frame 5 is the whole cycle up to the clock edge. */
export const WHOLE = 5

const STATUS_TEXT = { used: 'used', discarded: 'computed but discarded', dontcare: "don't care (X)" } as const

export function wireText(w: WireValue, num: NumMode): string {
  if (w.value === null || num === 'hex') return w.text
  if (w.kind === 'data' && w.bits === 32) return String(w.value | 0)
  if (w.id === 'inst-imm') return String(signExt16(w.value))
  return w.text
}

export function buildTraceModel(t: DatapathTrace, k: number, focus: boolean, num: NumMode): DiagramModel {
  const frame = k < WHOLE ? t.frames[k] : null
  const wires: DiagramModel['wires'] = {}
  for (const w of t.wires) {
    const s = STAGE_INDEX[w.stage]
    const used = w.status === 'used'
    let tone: Tone
    if (k === WHOLE) tone = used ? 'now' : w.status === 'dontcare' ? 'x' : 'disc'
    else if (s > k) tone = 'future'
    else tone = used ? (s === k ? 'now' : 'past') : w.status === 'dontcare' ? 'x' : 'disc'
    if (focus && (!used || tone === 'future')) tone = 'hidden'
    wires[w.id] = {
      tone,
      control: w.kind === 'control',
      text: tone === 'future' ? undefined : wireText(w, num),
      title: `${w.label} to ${w.port}: ${tone === 'future' ? 'not reached yet' : `${wireText(w, num)}, ${STATUS_TEXT[w.status]}`}`,
    }
  }
  const units = {} as DiagramModel['units']
  for (const u of t.units) {
    const s = STAGE_INDEX[u.stage]
    const inNow = frame ? frame.units.includes(u.id) : true
    let tone: Tone
    if (k === WHOLE) tone = u.active ? 'now' : 'disc'
    else if (inNow) tone = u.active ? 'now' : 'disc'
    else if (s > k) tone = 'future'
    else tone = u.active ? 'past' : 'disc'
    if (focus && (!u.active || tone === 'future')) tone = 'hidden'
    units[u.id] = { tone, title: `${u.label}: ${u.why}` }
  }
  // Focus mode: a wire into or out of a hidden unit would dangle, so it goes too.
  if (focus) for (const w of t.wires) if (units[w.to].tone === 'hidden' || (w.from !== 'const4' && units[w.from].tone === 'hidden')) wires[w.id].tone = 'hidden'
  const r = t.control.row
  return {
    wires,
    units,
    mux: { regdst: r.RegDst, alusrc: r.ALUSrc, memtoreg: r.MemToReg, pcsrc: t.control.pcSrc ? 1 : 0 },
    bne: r.BranchNE !== undefined,
  }
}

/** The bare datapath, everything faint: shown when the instruction cannot be traced. */
export function blankModel(): DiagramModel {
  const wires: DiagramModel['wires'] = {}
  for (const w of wireSpecs()) wires[w.id] = { tone: 'future', control: w.kind === 'control', title: `${w.label} to ${w.port}` }
  const units = Object.fromEntries(UNITS.map((u) => [u.id, { tone: 'future' as Tone, title: u.label }])) as DiagramModel['units']
  return { wires, units, mux: {}, bne: false }
}

/** Timing node to the unit it is drawn as. The register file appears twice: read and write. */
export const NODE_UNIT: Record<NodeId, UnitId> = {
  IM: 'im', ADD4: 'add4', CTRL: 'control', RFR: 'rf', REGDST: 'regdst', SEXT: 'sext', ALUSRC: 'alusrc', ALUCTL: 'aluctl', ALU: 'alu',
  SHIFT: 'shift', BADD: 'badd', AND: 'and', PCSRC: 'pcsrc', DM: 'dm', MTR: 'memtoreg', RFW: 'rf',
}

/** The critical path drawn on the same diagram: path units and the wires between them in the path colour. */
/** focus: hide what the instruction does not need, instead of drawing it faint. */
export function buildTimingModel(r: TimingResult, writesRt: boolean, focus = false): DiagramModel {
  const specs = wireSpecs('L11', r.cls === 'bne')
  const needed = new Set<UnitId>(['pc', ...r.nodes.map((n) => NODE_UNIT[n.id])])
  const onPath = new Set<UnitId>(['pc', ...r.path.map((id) => NODE_UNIT[id])])
  const pathWires = new Set<string>(['pc-im'])
  for (let i = 1; i < r.path.length; i++) {
    const a = NODE_UNIT[r.path[i - 1]]
    const b = NODE_UNIT[r.path[i]]
    for (const s of specs) if (s.from === a && s.to === b) pathWires.add(s.id)
  }
  // Only the RegDst input the class selects is on the path.
  pathWires.delete(writesRt ? 'inst-rd' : 'inst-rt-regdst')
  // addi and lw write rt rather than read it, so only rs feeds the register read.
  if (writesRt) pathWires.delete('inst-rt-rr2')
  const nodeOf = (u: UnitId) => r.nodes.filter((n) => NODE_UNIT[n.id] === u)
  const wires: DiagramModel['wires'] = {}
  for (const s of specs) {
    const both = needed.has(s.from as UnitId) || s.from === 'const4'
    const tone: Tone = pathWires.has(s.id) ? 'path' : both && needed.has(s.to) ? 'past' : focus ? 'hidden' : 'future'
    wires[s.id] = { tone, control: s.kind === 'control', title: `${s.label} to ${s.port}${tone === 'path' ? ': on the critical path' : ''}` }
  }
  const units = {} as DiagramModel['units']
  for (const u of UNITS) {
    const ns = nodeOf(u.id)
    const tone: Tone = onPath.has(u.id) ? 'path' : needed.has(u.id) ? 'past' : focus ? 'hidden' : 'future'
    const badge = u.id === 'pc' ? `0 ${r.unit}` : ns.length ? ns.map((n) => (u.id === 'rf' ? `${n.id === 'RFR' ? 'read' : 'write'} ${n.start} to ${n.finish}` : `${n.start} to ${n.finish}`)).join(', ') : undefined
    units[u.id] = { tone, badge, title: `${u.label}${ns.length ? `: ${ns.map((n) => `${n.label} starts ${n.start}, ends ${n.finish} ${r.unit}, slack ${n.slack}`).join('; ')}` : ': not needed'}` }
  }
  return { wires, units, mux: {}, bne: r.cls === 'bne' }
}

/* ---------- Playback timing: dots that wait for each unit's delay ---------- */

/** Delays the dots use: T05 Q2 / R06 p42, in ps. */
export const RUN_DELAYS = LATENCY_PRESETS.find((p) => p.id === 'r06')!.delays
const UNIT_DELAY: Record<UnitId, DelayKey | null> = {
  pc: null, im: 'instMem', add4: 'adder', control: 'control', rf: 'regFile', regdst: 'mux', sext: 'signExt', alusrc: 'mux',
  aluctl: 'aluControl', alu: 'alu', shift: 'shift', badd: 'adder', and: 'andGate', pcsrc: 'mux', dm: 'dataMem', memtoreg: 'mux',
}
/** Inputs that end the cycle (register write, next PC): they do not feed the unit's outputs. */
const END_INPUTS = new Set(['wr', 'wd', 'c-regwrite', 'nextpc'])
/** Animation scale: 1 ps of unit delay is 2.5 ms on screen; dots cross wires at 0.8 px per ms. */
export const MS_PER_PS = 2.5
const PX_PER_MS = 0.8
/** Time to read the step after the last dot lands. */
export const DWELL_MS = 900

/** Corner points of an M/H/V wire path. */
export function pathPoints(d: string): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  let x = 0
  let y = 0
  for (const [, cmd, args] of d.matchAll(/([MHV])([^MHV]*)/g)) {
    const n = args.trim().split(/[\s,]+/).map(Number)
    if (cmd === 'M') [x, y] = n
    else if (cmd === 'H') x = n[0]
    else y = n[0]
    pts.push({ x, y })
  }
  return pts
}

/** Length of an M/H/V wire path. */
export function pathLength(d: string): number {
  const p = pathPoints(d)
  return p.slice(1).reduce((s, q, i) => s + Math.abs(q.x - p[i].x) + Math.abs(q.y - p[i].y), 0)
}

export interface Run {
  /** A dot leaves at `start` ms and lands `dur` ms later. */
  dots: { id: string; start: number; dur: number }[]
  /** A unit works on its inputs for its delay. */
  work: { unit: UnitId; start: number; dur: number }[]
  /** When the last dot lands or the last unit finishes. */
  total: number
}

/**
 * When each dot moves in one step: a unit starts once its inputs in this step have arrived and its outputs leave after
 * its delay. Inputs set in an earlier step are already waiting. Delays are scaled, wires are not (they take no time in
 * the course model; the travel time is only so the eye can follow).
 */
export function runOf(t: DatapathTrace, model: DiagramModel, k: number): Run {
  const moving = new Set(Object.keys(model.wires).filter((id) => model.wires[id].tone === 'now' && WIRE_PATH[id]))
  const wires = t.wires.filter((w) => moving.has(w.id))
  const inStep = new Set<UnitId>(k < WHOLE ? t.frames[k].units : t.units.map((u) => u.id))
  const delay = (u: UnitId) => {
    const key = UNIT_DELAY[u]
    return key ? RUN_DELAYS.values[key] * MS_PER_PS : 0
  }
  const travel = (id: string) => Math.max(120, pathLength(WIRE_PATH[id]) / PX_PER_MS)
  const ready = new Map<UnitId, number>()
  const arrive = new Map<string, number>()
  const work: Run['work'] = []
  const busy = new Set<UnitId>()
  const readyOf = (u: UnitId): number => {
    if (ready.has(u)) return ready.get(u)!
    if (busy.has(u)) return 0
    busy.add(u)
    const ins = wires.filter((w) => w.to === u && !END_INPUTS.has(w.id))
    let out = 0
    if (ins.length) {
      const start = Math.max(...ins.map((w) => arriveOf(w.id)))
      out = start + delay(u)
      if (delay(u) && inStep.has(u)) work.push({ unit: u, start, dur: delay(u) })
    }
    ready.set(u, out)
    return out
  }
  const arriveOf = (id: string): number => {
    if (arrive.has(id)) return arrive.get(id)!
    const w = wires.find((x) => x.id === id)!
    const leave = w.from === 'const4' ? 0 : readyOf(w.from)
    arrive.set(id, leave + travel(id))
    return arrive.get(id)!
  }
  const dots = wires.map((w) => {
    const end = arriveOf(w.id)
    return { id: w.id, start: end - travel(w.id), dur: travel(w.id) }
  })
  // Units that only receive in this step still work before the next step: memory reads, the register write.
  for (const u of new Set(wires.map((w) => w.to))) {
    if (!inStep.has(u) || work.some((x) => x.unit === u) || !delay(u)) continue
    const ins = wires.filter((w) => w.to === u)
    work.push({ unit: u, start: Math.max(...ins.map((w) => arriveOf(w.id))), dur: delay(u) })
  }
  const total = Math.max(0, ...dots.map((d) => d.start + d.dur), ...work.map((x) => x.start + x.dur))
  return { dots, work, total }
}
