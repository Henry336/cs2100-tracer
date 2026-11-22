/** Critical-path and cycle-time calculator for the single-cycle datapath (R06 p41-42, T05 Q2, L12 p36). */

import type { Explain } from './types'

export type DelayKey = 'instMem' | 'adder' | 'mux' | 'alu' | 'regFile' | 'dataMem' | 'control' | 'aluControl' | 'signExt' | 'shift' | 'andGate'

export interface Delays {
  unit: 'ps' | 'ns'
  values: Record<DelayKey, number>
}

export const DELAY_LABELS: Record<DelayKey, string> = {
  instMem: 'Inst-Mem', adder: 'Adder', mux: 'MUX', alu: 'ALU', regFile: 'Reg-File', dataMem: 'Data-Mem',
  control: 'Control', aluControl: 'ALU control', signExt: 'Sign-extend', shift: 'Left shift', andGate: 'AND',
}

export const LATENCY_PRESETS: { id: 'r06' | 'l12'; title: string; cite: string; delays: Delays }[] = [
  {
    id: 'r06',
    title: 'Component delays in ps (T05 Q2, R06 p42)',
    cite: 'T05 Q2, R06 p42',
    delays: { unit: 'ps', values: { instMem: 400, adder: 100, mux: 30, alu: 120, regFile: 200, dataMem: 350, control: 100, aluControl: 100, signExt: 20, shift: 20, andGate: 20 } },
  },
  {
    id: 'l12',
    title: 'Simplified ns model: memory 2, ALU and adders 2, register file 1, the rest negligible (L12 p36)',
    cite: 'L12 p36, L20 p31',
    delays: { unit: 'ns', values: { instMem: 2, adder: 2, mux: 0, alu: 2, regFile: 1, dataMem: 2, control: 0, aluControl: 0, signExt: 0, shift: 0, andGate: 0 } },
  },
]

export type TimingClass = 'R' | 'addi' | 'lw' | 'sw' | 'beq' | 'bne'

export function timingClassOf(mnemonic: string): TimingClass | null {
  if (['add', 'sub', 'and', 'or', 'slt'].includes(mnemonic)) return 'R'
  return (['addi', 'lw', 'sw', 'beq', 'bne'] as const).find((m) => m === mnemonic) ?? null
}

export type NodeId = 'IM' | 'ADD4' | 'CTRL' | 'RFR' | 'REGDST' | 'SEXT' | 'ALUSRC' | 'ALUCTL' | 'ALU' | 'SHIFT' | 'BADD' | 'AND' | 'PCSRC' | 'DM' | 'MTR' | 'RFW'

const NODES: Record<NodeId, { label: string; key: DelayKey }> = {
  IM: { label: 'Inst-Mem', key: 'instMem' },
  ADD4: { label: 'Adder (PC+4)', key: 'adder' },
  CTRL: { label: 'Control', key: 'control' },
  RFR: { label: 'Reg-File (read)', key: 'regFile' },
  REGDST: { label: 'MUX (RegDst)', key: 'mux' },
  SEXT: { label: 'Sign-extend', key: 'signExt' },
  ALUSRC: { label: 'MUX (ALUSrc)', key: 'mux' },
  ALUCTL: { label: 'ALU control', key: 'aluControl' },
  ALU: { label: 'ALU', key: 'alu' },
  SHIFT: { label: 'Left shift 2', key: 'shift' },
  BADD: { label: 'Adder (branch target)', key: 'adder' },
  AND: { label: 'AND (PCSrc)', key: 'andGate' },
  PCSRC: { label: 'MUX (PCSrc)', key: 'mux' },
  DM: { label: 'Data-Mem', key: 'dataMem' },
  MTR: { label: 'MUX (MemToReg)', key: 'mux' },
  RFW: { label: 'Reg-File (write)', key: 'regFile' },
}

/** Inputs each unit waits for, given the instruction class. Inputs a mux does not select are left out. */
function graph(cls: TimingClass): { inputs: Partial<Record<NodeId, NodeId[]>>; sinks: NodeId[] } {
  const branch = cls === 'beq' || cls === 'bne'
  const writes = cls === 'R' || cls === 'addi' || cls === 'lw'
  const imm = cls === 'addi' || cls === 'lw' || cls === 'sw'
  const inputs: Partial<Record<NodeId, NodeId[]>> = {
    IM: [], ADD4: [], CTRL: ['IM'], RFR: ['IM'], SEXT: ['IM'],
    ALUSRC: [imm ? 'SEXT' : 'RFR', 'CTRL'],
    ALUCTL: ['CTRL', 'IM'],
    ALU: ['RFR', 'ALUSRC', 'ALUCTL'],
    SHIFT: ['SEXT'],
    BADD: ['ADD4', 'SHIFT'],
    // With Branch = 0 the AND output is 0 whatever isZero is, so it only waits for Control.
    AND: branch ? ['ALU', 'CTRL'] : ['CTRL'],
    PCSRC: branch ? ['ADD4', 'BADD', 'AND'] : ['ADD4', 'AND'],
  }
  if (cls === 'lw') inputs.DM = ['ALU', 'CTRL']
  if (cls === 'sw') inputs.DM = ['ALU', 'RFR', 'CTRL']
  if (writes) {
    inputs.REGDST = ['IM', 'CTRL']
    inputs.MTR = [cls === 'lw' ? 'DM' : 'ALU', 'CTRL']
    inputs.RFW = ['MTR', 'REGDST', 'CTRL']
  }
  return { inputs, sinks: [...(writes ? ['RFW' as NodeId] : cls === 'sw' ? ['DM' as NodeId] : []), 'PCSRC'] }
}

export interface TimingNode {
  id: NodeId
  label: string
  delay: number
  start: number
  finish: number
  inputs: { id: NodeId; finish: number }[]
  onPath: boolean
  /** How much later this unit could finish without delaying the instruction. */
  slack: number
}

export interface TimingResult {
  cls: TimingClass
  unit: 'ps' | 'ns'
  total: number
  /** Critical path from start to finish. */
  path: NodeId[]
  nodes: TimingNode[]
  /** Units the instruction does not need, with the reason. */
  notNeeded: { id: NodeId; label: string; reason: string }[]
  /** Off-path units that finish exactly when needed (slack 0): an equally long path. */
  ties: { id: NodeId; label: string; finish: number }[]
  why: Explain
}

const NOT_NEEDED: Record<NodeId, string> = {
  IM: '', ADD4: '', CTRL: '', RFR: '', ALUCTL: '', ALU: '', AND: '', PCSRC: '',
  REGDST: 'no register is written',
  SEXT: 'the ALUSrc mux selects RD2 and the branch target is discarded',
  ALUSRC: '',
  SHIFT: 'only a branch needs the shifted offset',
  BADD: 'only a branch needs the target',
  DM: 'no load or store',
  MTR: 'no register is written',
  RFW: 'no register is written',
}

export function criticalPath(cls: TimingClass, delays: Delays): TimingResult {
  // A cleared field (NaN), a missing key or a negative number counts as 0 ps, so the page never shows NaN or a path that skips units.
  const val = (k: DelayKey) => { const x = delays.values[k]; return Number.isFinite(x) && x > 0 ? x : 0 }
  const { inputs, sinks } = graph(cls)
  const finish = {} as Record<NodeId, number>
  const start = {} as Record<NodeId, number>
  // Post-order from the sinks: only units the instruction needs, each after its inputs.
  const ids: NodeId[] = []
  const visit = (id: NodeId): number => {
    if (finish[id] !== undefined) return finish[id]
    start[id] = Math.max(0, ...inputs[id]!.map(visit))
    finish[id] = start[id] + val(NODES[id].key)
    ids.push(id)
    return finish[id]
  }
  sinks.forEach(visit)
  // First sink wins a tie, and the first-listed (datapath) input wins a tie on the way back, as R06 p42 draws it.
  const pick = (list: NodeId[]) => list.reduce((best, id) => (finish[id] > finish[best] ? id : best), list[0])
  const end = pick(sinks)
  const total = finish[end]
  const path: NodeId[] = []
  for (let id: NodeId | undefined = end; id; id = inputs[id]!.length ? pick(inputs[id]!) : undefined) path.unshift(id)

  // Required times, backwards from the end of the cycle.
  const req = Object.fromEntries(ids.map((id) => [id, total])) as Record<NodeId, number>
  for (const id of [...ids].reverse()) for (const inp of inputs[id]!) req[inp] = Math.min(req[inp], req[id] - val(NODES[id].key))

  const nodes: TimingNode[] = ids.map((id) => ({
    id,
    label: NODES[id].label,
    delay: val(NODES[id].key),
    start: start[id],
    finish: finish[id],
    inputs: inputs[id]!.map((i) => ({ id: i, finish: finish[i] })),
    onPath: path.includes(id),
    slack: req[id] - finish[id],
  }))
  const ties = nodes.filter((n) => !n.onPath && n.slack === 0 && n.delay > 0).map((n) => ({ id: n.id, label: n.label, finish: n.finish }))
  const notNeeded = (Object.keys(NODES) as NodeId[]).filter((id) => !ids.includes(id)).map((id) => ({ id, label: NODES[id].label, reason: NOT_NEEDED[id] }))
  const terms = path.filter((id) => val(NODES[id].key) > 0)
  const working = `${terms.map((id) => val(NODES[id].key)).join(' + ')} = ${total} ${delays.unit}`
  const parallel = nodes.filter((n) => !n.onPath && n.delay > 0).map((n) => `${n.label} ends at ${n.finish} (slack ${n.slack})`)
  return {
    cls,
    unit: delays.unit,
    total,
    path,
    nodes,
    notNeeded,
    ties,
    why: {
      rule: 'Delays in series add; parallel paths take the max. The critical path is the longest path from start to finish',
      working: `${terms.map((id) => NODES[id].label).join(' -> ')}: ${working}${parallel.length ? `. In parallel: ${parallel.join('; ')}` : ''}`,
      cite: 'R06 p41-42',
    },
  }
}

export interface TimingPath {
  nodes: NodeId[]
  total: number
  /** The longest path, or one tied with it. */
  critical: boolean
}

/** Every start-to-finish path the instruction uses, longest first (R06 p41-42: the critical path is the longest). */
export function allPaths(cls: TimingClass, delays: Delays): TimingPath[] {
  const r = criticalPath(cls, delays)
  const node = new Map(r.nodes.map((n) => [n.id, n]))
  const out: { nodes: NodeId[]; total: number }[] = []
  const walk = (id: NodeId, tail: NodeId[], sum: number) => {
    const n = node.get(id)!
    const nodes = [id, ...tail]
    if (!n.inputs.length) out.push({ nodes, total: sum + n.delay })
    else n.inputs.forEach((i) => walk(i.id, nodes, sum + n.delay))
  }
  const sinks = r.nodes.filter((n) => !r.nodes.some((m) => m.inputs.some((i) => i.id === n.id)))
  sinks.forEach((s) => walk(s.id, [], 0))
  // On a tie, the path criticalPath picks (the one R06 p42 draws) comes first.
  const main = r.path.join('>')
  const rank = (p: { nodes: NodeId[] }) => (p.nodes.join('>') === main ? 0 : 1)
  return out.sort((a, b) => b.total - a.total || rank(a) - rank(b) || b.nodes.length - a.nodes.length).map((p) => ({ ...p, critical: p.total === r.total }))
}

export interface CycleTimeResult {
  rows: { cls: TimingClass; total: number }[]
  cycle: number
  /** null when no class is selected (cycle 0). */
  slowest: TimingClass | null
  unit: 'ps' | 'ns'
  why: Explain
}

/** Single-cycle clock = the slowest instruction (L12 p36). */
export function cycleTime(delays: Delays, classes: TimingClass[] = ['R', 'lw', 'sw', 'beq']): CycleTimeResult {
  const rows = classes.map((cls) => ({ cls, total: criticalPath(cls, delays).total }))
  const slow = rows.reduce<{ cls: TimingClass | null; total: number }>((a, b) => (b.total > a.total ? b : a), { cls: null, total: 0 })
  return {
    rows,
    cycle: slow.total,
    slowest: slow.cls,
    unit: delays.unit,
    why: { rule: 'Every instruction takes one cycle, so the cycle must fit the slowest instruction', working: rows.length ? `max(${rows.map((r) => `${r.cls} ${r.total}`).join(', ')}) = ${slow.total} ${delays.unit}` : 'no instruction class selected', cite: 'L12 p36' },
  }
}

export type StageColumn = 'instMem' | 'regRead' | 'alu' | 'dataMem' | 'regWrite'

const STAGE_USE: Record<'R' | 'lw' | 'sw' | 'beq', StageColumn[]> = {
  R: ['instMem', 'regRead', 'alu', 'regWrite'],
  lw: ['instMem', 'regRead', 'alu', 'dataMem', 'regWrite'],
  sw: ['instMem', 'regRead', 'alu', 'dataMem'],
  beq: ['instMem', 'regRead', 'alu'],
}

/** The L12 p36 table: per-stage times summed, other delays ignored. */
export function stageTable(delays: Delays): { rows: { cls: 'R' | 'lw' | 'sw' | 'beq'; cells: Record<StageColumn, number | null>; total: number; working: string }[]; cycle: number; why: Explain } {
  const v = delays.values
  const t: Record<StageColumn, number> = { instMem: v.instMem, regRead: v.regFile, alu: v.alu, dataMem: v.dataMem, regWrite: v.regFile }
  const rows = (Object.keys(STAGE_USE) as (keyof typeof STAGE_USE)[]).map((cls) => {
    const use = STAGE_USE[cls]
    const cells = Object.fromEntries((Object.keys(t) as StageColumn[]).map((c) => [c, use.includes(c) ? t[c] : null])) as Record<StageColumn, number | null>
    const total = use.reduce((s, c) => s + t[c], 0)
    return { cls, cells, total, working: `${use.map((c) => t[c]).join(' + ')} = ${total} ${delays.unit}` }
  })
  const cycle = Math.max(...rows.map((r) => r.total))
  return { rows, cycle, why: { rule: 'Add the stages each instruction uses; the cycle time is the largest total', working: `max(${rows.map((r) => r.total).join(', ')}) = ${cycle} ${delays.unit}`, cite: 'L12 p36' } }
}
