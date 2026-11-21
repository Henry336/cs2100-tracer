/** Turns an engine trace (or a timing result) into what the diagram draws. No simulation happens here. */

import { UNITS, wireSpecs, type DatapathTrace, type NodeId, type StageId, type TimingResult, type UnitId, type WireValue } from '../../core/datapath'
import { signExt16 } from '../../core/mips'
import type { NumMode } from './common'
import type { DiagramModel, Tone } from './Diagram'

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
export function buildTimingModel(r: TimingResult, writesRt: boolean): DiagramModel {
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
    const tone: Tone = pathWires.has(s.id) ? 'path' : both && needed.has(s.to) ? 'past' : 'future'
    wires[s.id] = { tone, control: s.kind === 'control', title: `${s.label} to ${s.port}${tone === 'path' ? ': on the critical path' : ''}` }
  }
  const units = {} as DiagramModel['units']
  for (const u of UNITS) {
    const ns = nodeOf(u.id)
    const tone: Tone = onPath.has(u.id) ? 'path' : needed.has(u.id) ? 'past' : 'future'
    const badge = u.id === 'pc' ? `0 ${r.unit}` : ns.length ? ns.map((n) => (u.id === 'rf' ? `${n.id === 'RFR' ? 'read' : 'write'} ${n.start} to ${n.finish}` : `${n.start} to ${n.finish}`)).join(', ') : undefined
    units[u.id] = { tone, badge, title: `${u.label}${ns.length ? `: ${ns.map((n) => `${n.label} starts ${n.start}, ends ${n.finish} ${r.unit}, slack ${n.slack}`).join('; ')}` : ': not needed'}` }
  }
  return { wires, units, mux: {}, bne: r.cls === 'bne' }
}
