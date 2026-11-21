/**
 * Block circuits: MSI blocks and gates chained into one netlist, each block's outputs usable as inputs of the
 * blocks after it (T07 Q1-Q4, T08 Q3-Q4, AY23/24 S1 Q17e, AY23/24 S2 Q21d-e). Every row is evaluated block by
 * block; a don't-care output (an encoder that sees an invalid input) is carried as X and resolved where it can be.
 */
import { compile, MAX_MIN_VARS, minimize, parseExpr, varsOf } from '../boolean'
import { activeEnable, type DecoderSpec, type EnableKind, type OutputPolarity } from './decoder'
import { bin, fnFromRows, range, sigmaOf, type Bit, type BoolFunction, type Built, type CellValue, type Explain, type PinIssue } from './signals'

export type GateOp = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'NOT'

/** Pins are text: a variable, 0, 1, an expression, or a signal named by an earlier block. Multi-bit pins are MSB first. */
export type Block =
  | { kind: 'ha'; a: string; b: string }
  | { kind: 'fa'; a: string; b: string; cin: string }
  | { kind: 'adder'; a: string[]; b: string[]; cin?: string }
  | { kind: 'comparator'; x: string[]; y: string[] }
  | { kind: 'decoder'; spec: DecoderSpec; selects: string[]; enable?: string }
  | { kind: 'mux'; selects: string[]; data: string[] }
  | { kind: 'quadmux'; s: string; eBar?: string; a: string[]; b: string[] }
  | { kind: 'demux'; selects: string[]; d: string }
  | { kind: 'encoder'; inputs: string[]; priority?: boolean; valid?: boolean }
  | { kind: 'count1' | 'count0'; inputs: string[] }
  | { kind: 'gate'; op: GateOp; inputs: string[] }

/** A placed block. `out` names the ports that later blocks may use, e.g. { S: 'S1', C: 'C1' }. */
export type NetBlock = Block & { id: string; out?: Record<string, string> }

interface Shape {
  pins: { pin: string; text: string }[]
  ports: string[]
  run: (v: Bit[]) => CellValue[]
  cite: string
}

const bitsOf = (value: number, width: number): Bit[] => bin(value, width).split('').map(Number) as Bit[]
const valueOf = (bits: Bit[]): number => bits.reduce((acc: number, b) => acc * 2 + b, 0)
const named = (prefix: string, texts: string[]) => texts.map((text, j) => ({ pin: `${prefix}${texts.length - 1 - j}`, text }))
const msbPorts = (prefix: string, w: number) => range(w).map((j) => `${prefix}${w - 1 - j}`)

/** Pins, port names and the function of one block, or a message saying what is wrong with it. */
function shapeOf(b: Block): Shape | string {
  switch (b.kind) {
    case 'ha':
      return { pins: [{ pin: 'A', text: b.a }, { pin: 'B', text: b.b }], ports: ['S', 'C'], run: ([x, y]) => [(x ^ y) as Bit, (x & y) as Bit], cite: 'L17 p17-18' }
    case 'fa':
      return {
        pins: [{ pin: 'A', text: b.a }, { pin: 'B', text: b.b }, { pin: 'Cin', text: b.cin }],
        ports: ['S', 'C'],
        run: ([x, y, z]) => [(x ^ y ^ z) as Bit, ((x & y) | (x & z) | (y & z)) as Bit],
        cite: 'L17 p19-21',
      }
    case 'adder': {
      const w = b.a.length
      if (w < 1 || w > 8 || b.b.length !== w) return 'a parallel adder needs A and B of the same width (1 to 8 bits)'
      return {
        pins: [...named('A', b.a), ...named('B', b.b), { pin: 'Cin', text: b.cin ?? '0' }],
        ports: [...msbPorts('S', w), 'Cout'],
        run: (v) => {
          const sum = valueOf(v.slice(0, w)) + valueOf(v.slice(w, 2 * w)) + v[2 * w]
          return [...bitsOf(sum % (1 << w), w), sum >> w ? 1 : 0]
        },
        cite: 'L17 p27-29',
      }
    }
    case 'comparator': {
      const w = b.x.length
      if (w < 1 || w > 8 || b.y.length !== w) return 'a comparator needs X and Y of the same width (1 to 8 bits)'
      return {
        pins: [...named('X', b.x), ...named('Y', b.y)],
        ports: ['lt', 'eq', 'gt'],
        run: (v) => {
          const x = valueOf(v.slice(0, w))
          const y = valueOf(v.slice(w))
          return [x < y ? 1 : 0, x === y ? 1 : 0, x > y ? 1 : 0]
        },
        cite: 'L17 p30-32',
      }
    }
    case 'decoder': {
      const { spec } = b
      if (!Number.isInteger(spec.k) || spec.k < 1 || spec.k > 4 || b.selects.length !== spec.k) return `a ${spec.k}x${1 << spec.k} decoder needs ${spec.k} select pins (1 to 4)`
      const pins = named('S', b.selects)
      if (spec.enable !== 'none') pins.push({ pin: 'E', text: b.enable ?? String(activeEnable(spec)) })
      return {
        pins,
        ports: range(1 << spec.k).map((i) => `Y${i}`),
        run: (v) => {
          const select = valueOf(v.slice(0, spec.k))
          const on = spec.enable === 'none' || v[spec.k] === activeEnable(spec)
          return range(1 << spec.k).map((i) => ((on && i === select ? 1 : 0) ^ (spec.outputs === 'low' ? 1 : 0)) as Bit)
        },
        cite: 'L18 p13-20',
      }
    }
    case 'mux': {
      const k = b.selects.length
      if (k < 1 || k > 4 || b.data.length !== 1 << k) return 'a mux needs 1 to 4 selects and 2^k data inputs'
      return {
        pins: [...named('S', b.selects), ...b.data.map((text, i) => ({ pin: `I${i}`, text }))],
        ports: ['Y'],
        run: (v) => [v[k + valueOf(v.slice(0, k))]],
        cite: 'L18 p38-39',
      }
    }
    case 'quadmux': {
      const w = b.a.length
      if (w < 1 || w > 8 || b.b.length !== w) return 'a quad 2:1 mux needs A and B of the same width'
      return {
        pins: [{ pin: 'S', text: b.s }, { pin: "E'", text: b.eBar ?? '0' }, ...named('A', b.a), ...named('B', b.b)],
        ports: msbPorts('Y', w),
        run: ([s, eBar, ...ab]) => (eBar ? ab.slice(0, w).map(() => 0) : s ? ab.slice(w) : ab.slice(0, w)),
        cite: 'L18 p41',
      }
    }
    case 'demux': {
      const k = b.selects.length
      if (k < 1 || k > 4) return 'a demux needs 1 to 4 selects'
      return {
        pins: [...named('S', b.selects), { pin: 'D', text: b.d }],
        ports: range(1 << k).map((i) => `Y${i}`),
        run: (v) => range(1 << k).map((i) => (i === valueOf(v.slice(0, k)) ? v[k] : 0)),
        cite: 'L18 p35-36',
      }
    }
    case 'encoder': {
      const m = b.inputs.length
      if (m < 2 || m > 16) return 'an encoder needs 2 to 16 inputs'
      const n = Math.ceil(Math.log2(m))
      const valid = b.priority && (b.valid ?? true)
      return {
        pins: b.inputs.map((text, i) => ({ pin: `D${i}`, text })),
        ports: [...msbPorts('Y', n), ...(valid ? ['V'] : [])],
        run: (v) => {
          const highs = range(m).filter((i) => v[i])
          // Plain encoder: only one-high inputs are valid (L18 p29). Priority: the highest index wins (L18 p32).
          const w = b.priority ? (highs.length ? highs[highs.length - 1] : null) : highs.length === 1 ? highs[0] : null
          const code: CellValue[] = w === null ? Array(n).fill('X') : bitsOf(w, n)
          return valid ? [...code, w === null ? 0 : 1] : code
        },
        cite: b.priority ? 'L18 p32' : 'L18 p26-29',
      }
    }
    case 'count1':
    case 'count0': {
      const m = b.inputs.length
      if (m < 1 || m > 15) return 'a count device needs 1 to 15 inputs'
      const w = Math.ceil(Math.log2(m + 1))
      const pins = b.inputs.map((text, j) => ({ pin: m === 4 ? 'WXYZ'[j] : `D${m - 1 - j}`, text }))
      return {
        pins,
        ports: msbPorts('C', w),
        run: (v) => bitsOf(v.filter((x) => x === (b.kind === 'count1' ? 1 : 0)).length, w),
        cite: 'T08 Q3',
      }
    }
    case 'gate': {
      const m = b.inputs.length
      if (b.op === 'NOT' ? m !== 1 : m < 2) return b.op === 'NOT' ? 'a NOT gate has one input' : `an ${b.op} gate needs at least 2 inputs`
      const run = (v: Bit[]): Bit => {
        const and = v.every((x) => x) ? 1 : 0
        const or = v.some((x) => x) ? 1 : 0
        const odd = (v.filter((x) => x).length % 2) as Bit
        const table: Record<GateOp, Bit> = { NOT: (1 - v[0]) as Bit, AND: and, OR: or, NAND: (1 - and) as Bit, NOR: (1 - or) as Bit, XOR: odd, XNOR: (1 - odd) as Bit }
        return table[b.op]
      }
      return { pins: b.inputs.map((text, i) => ({ pin: `in${i + 1}`, text })), ports: ['Y'], run: (v) => [run(v)], cite: 'L14 p3-6' }
    }
  }
}

export interface NetRow {
  row: number
  /** Per block id: the value on every pin, then on every port (X = don't care). */
  pins: Record<string, CellValue[]>
  ports: Record<string, CellValue[]>
}

export interface NetBlockInfo {
  id: string
  kind: Block['kind']
  pins: string[]
  pinText: string[]
  ports: string[]
  cite: string
}

export interface Netlist {
  vars: string[]
  blocks: NetBlockInfo[]
  /** One frame per input row. */
  rows: NetRow[]
  /** Every named signal as a function of the inputs (X rows become don't-cares). */
  signals: Record<string, BoolFunction>
  /** Devices by kind, gates by op. NOT gates are inverters. */
  devices: Record<string, number>
  gates: Record<string, number>
  /** Pins driven by a complemented literal or an expression: each hides an inverter or a gate (T07 p2). */
  implicit: string[]
  why: Record<string, Explain>
}

const NAME = /^[A-Za-z][0-9]*$/
/** Inputs plus named signals must fit one row index. */
const MAX_NAMES = 30
/** Unknown (X) pins are resolved by trying both values; beyond this many the outputs are just X. */
const MAX_X = 10

/** Evaluate a chain of blocks over every row of `vars`. Errors name the block and pin; nothing throws. */
export function netlist(blocks: NetBlock[], vars: string[]): Built<{ net: Netlist }> {
  const errors: PinIssue[] = []
  const ids = new Set<string>()
  const signalOf = new Map<string, { block: number; port: number }>()
  const shapes: Shape[] = []
  blocks.forEach((b, bi) => {
    if (!b.id || ids.has(b.id)) errors.push({ pin: b.id || `block ${bi + 1}`, message: `block ${bi + 1}: every block needs its own id` })
    ids.add(b.id)
    const sh = shapeOf(b)
    if (typeof sh === 'string') {
      errors.push({ pin: b.id, message: `${b.id}: ${sh}` })
      shapes.push({ pins: [], ports: [], run: () => [], cite: '' })
      return
    }
    shapes.push(sh)
    for (const [port, name] of Object.entries(b.out ?? {})) {
      const p = sh.ports.indexOf(port)
      if (p === -1) errors.push({ pin: `${b.id}.${port}`, message: `${b.id}: no output ${port} (outputs are ${sh.ports.join(', ')})` })
      else if (!NAME.test(name)) errors.push({ pin: `${b.id}.${port}`, message: `${b.id}.${port}: a signal name is a letter and optional digits, e.g. P or C1` })
      else if (vars.includes(name) || signalOf.has(name)) errors.push({ pin: `${b.id}.${port}`, message: `${b.id}.${port}: the name ${name} is already used` })
      else signalOf.set(name, { block: bi, port: p })
    }
  })
  const names = [...vars, ...signalOf.keys()]
  if (names.length > MAX_NAMES) errors.push({ pin: 'out', message: `at most ${MAX_NAMES} inputs and named signals in one circuit` })
  if (vars.length < 1 || vars.length > 10) errors.push({ pin: 'vars', message: 'use 1 to 10 input variables' })
  const badVar = vars.find((v, i) => !NAME.test(v) || vars.indexOf(v) !== i)
  if (badVar !== undefined)
    errors.push({ pin: 'vars', message: NAME.test(badVar) ? `the variable ${badVar} is listed twice` : `${badVar} is not a variable name: use a letter and optional digits, e.g. A or x1` })
  if (errors.length) return { ok: false, errors }

  const N = names.length
  const bitOf = (name: string) => 1 << (N - 1 - names.indexOf(name))
  type Pin = { eval: (idx: number) => Bit; refs: string[]; needsGate: boolean }
  const compiled: Pin[][] = blocks.map((b, bi) =>
    shapes[bi].pins.map(({ pin, text }) => {
      const p = parseExpr(text.trim())
      if (!p.ok) {
        errors.push({ pin: `${b.id}.${pin}`, message: `${b.id}.${pin}: ${p.errors[0]?.message ?? 'cannot read this wire'}` })
        return { eval: () => 0 as Bit, refs: [], needsGate: false }
      }
      const refs = varsOf(p.expr)
      const late = refs.filter((r) => !vars.includes(r) && !(signalOf.has(r) && (signalOf.get(r) as { block: number }).block < bi))
      if (late.length)
        errors.push({
          pin: `${b.id}.${pin}`,
          message: `${b.id}.${pin}: ${late.join(', ')} ${late.length === 1 ? 'is' : 'are'} not an input or a signal from an earlier block`,
        })
      return { eval: compile(p.expr, names), refs: refs.filter((r) => signalOf.has(r)), needsGate: p.expr.kind !== 'var' && p.expr.kind !== 'const' }
    }),
  )
  if (errors.length) return { ok: false, errors }

  const n = vars.length
  const rows: NetRow[] = range(1 << n).map((row) => {
    let idx = row << (N - n)
    const unknown = new Set<string>()
    const out: NetRow = { row, pins: {}, ports: {} }
    blocks.forEach((b, bi) => {
      const pinVals = compiled[bi].map((pin): CellValue => {
        const xs = pin.refs.filter((r) => unknown.has(r))
        if (!xs.length) return pin.eval(idx)
        // Try every value of the unknown signals: if the pin does not change, it is known.
        const seen = new Set(range(1 << xs.length).map((a) => pin.eval(xs.reduce((i, r, j) => ((a >> j) & 1 ? i | bitOf(r) : i), idx))))
        return seen.size === 1 ? [...seen][0] : 'X'
      })
      const xPins = range(pinVals.length).filter((i) => pinVals[i] === 'X')
      const sh = shapes[bi]
      let ports: CellValue[]
      if (xPins.length > MAX_X) ports = sh.ports.map(() => 'X')
      else {
        ports = []
        for (let a = 0; a < 1 << xPins.length; a++) {
          const v = pinVals.slice() as Bit[]
          xPins.forEach((p, j) => (v[p] = ((a >> j) & 1) as Bit))
          sh.run(v).forEach((x, i) => (ports[i] = a === 0 ? x : ports[i] === x ? x : 'X'))
        }
      }
      out.pins[b.id] = pinVals
      out.ports[b.id] = ports
      for (const [port, name] of Object.entries(b.out ?? {})) {
        const x = ports[sh.ports.indexOf(port)]
        if (x === 'X') unknown.add(name)
        else if (x === 1) idx |= bitOf(name)
      }
    })
    return out
  })

  const signals: Record<string, BoolFunction> = {}
  const why: Record<string, Explain> = {}
  for (const [name, { block, port }] of signalOf) {
    const f = fnFromRows(name, vars, rows.map((r) => r.ports[blocks[block].id][port]))
    signals[name] = f
    const sop = n <= MAX_MIN_VARS && n <= 6 ? minimize(f, 'sop').summary.answer : null
    why[name] = {
      rule: `${name} is output ${shapes[block].ports[port]} of ${blocks[block].id}, worked out row by row from the blocks before it.`,
      working: `${name} = ${sigmaOf(f)}${f.dc.length ? ` + d(${f.dc.join(', ')})` : ''}${sop ? `; simplified: ${sop}` : ''}`,
      cite: shapes[block].cite,
    }
  }
  const devices: Record<string, number> = {}
  const gates: Record<string, number> = {}
  for (const b of blocks) {
    if (b.kind === 'gate') gates[b.op] = (gates[b.op] ?? 0) + 1
    else devices[b.kind] = (devices[b.kind] ?? 0) + 1
  }
  return {
    ok: true,
    net: {
      vars,
      blocks: blocks.map((b, bi) => ({
        id: b.id,
        kind: b.kind,
        pins: shapes[bi].pins.map((p) => p.pin),
        pinText: shapes[bi].pins.map((p) => p.text.trim()),
        ports: shapes[bi].ports,
        cite: shapes[bi].cite,
      })),
      rows,
      signals,
      devices,
      gates,
      implicit: blocks.flatMap((b, bi) => shapes[bi].pins.filter((_, i) => compiled[bi][i].needsGate).map((p) => `${b.id}.${p.pin} = ${p.text.trim()}`)),
      why,
    },
  }
}

/** Rows where F and the target disagree, ignoring rows that are a don't-care in either. */
export function mismatchRows(f: BoolFunction, target: BoolFunction): number[] {
  const fOn = new Set(f.on)
  const tOn = new Set(target.on)
  const dc = new Set([...f.dc, ...target.dc])
  return range(1 << f.vars.length).filter((r) => !dc.has(r) && fOn.has(r) !== tOn.has(r))
}

/* ---------- Editor form of a block: kind, size, options and every pin text in pin order ---------- */

export type BlockKind = Block['kind']

export interface BlockSpec {
  id: string
  kind: BlockKind
  /** Bits (adder, comparator, quad mux), selects (decoder, mux, demux) or inputs (encoder, count, gate). Ignored for HA and FA. */
  size: number
  op?: GateOp
  enable?: EnableKind
  outputs?: OutputPolarity
  priority?: boolean
  valid?: boolean
  /** Pin texts in the order blockPins lists them. */
  pins: string[]
  out?: Record<string, string>
}

/** Allowed size per kind, and what the size counts. */
export const BLOCK_SIZE: Record<BlockKind, { min: number; max: number; def: number; unit: string }> = {
  ha: { min: 1, max: 1, def: 1, unit: '' },
  fa: { min: 1, max: 1, def: 1, unit: '' },
  adder: { min: 1, max: 8, def: 4, unit: 'bits' },
  comparator: { min: 1, max: 8, def: 4, unit: 'bits' },
  decoder: { min: 1, max: 4, def: 2, unit: 'selects' },
  mux: { min: 1, max: 4, def: 2, unit: 'selects' },
  quadmux: { min: 1, max: 8, def: 4, unit: 'bits' },
  demux: { min: 1, max: 4, def: 2, unit: 'selects' },
  encoder: { min: 2, max: 16, def: 4, unit: 'inputs' },
  count1: { min: 1, max: 15, def: 4, unit: 'inputs' },
  count0: { min: 1, max: 15, def: 4, unit: 'inputs' },
  gate: { min: 1, max: 8, def: 2, unit: 'inputs' },
}

const sizeOf = (s: BlockSpec) => {
  const r = BLOCK_SIZE[s.kind]
  const v = Number.isInteger(s.size) ? s.size : r.def
  return s.kind === 'gate' && s.op === 'NOT' ? 1 : Math.min(r.max, Math.max(s.kind === 'gate' ? 2 : r.min, v))
}

/** Number of pins the editor shows for a block. */
export function pinCount(s: BlockSpec): number {
  const w = sizeOf(s)
  switch (s.kind) {
    case 'ha':
      return 2
    case 'fa':
      return 3
    case 'adder':
      return 2 * w + 1
    case 'comparator':
      return 2 * w
    case 'decoder':
      return w + ((s.enable ?? 'none') === 'none' ? 0 : 1)
    case 'mux':
      return w + (1 << w)
    case 'quadmux':
      return 2 + 2 * w
    case 'demux':
      return w + 1
    default:
      return w
  }
}

/** The engine block for an editor spec. Missing pin texts read as 0 (GND, L17 p23). */
export function blockFromSpec(s: BlockSpec): NetBlock {
  const w = sizeOf(s)
  const t = Array.from({ length: pinCount(s) }, (_, i) => (typeof s.pins[i] === 'string' && s.pins[i].trim() ? s.pins[i] : '0'))
  const base = { id: s.id, out: s.out }
  switch (s.kind) {
    case 'ha':
      return { ...base, kind: 'ha', a: t[0], b: t[1] }
    case 'fa':
      return { ...base, kind: 'fa', a: t[0], b: t[1], cin: t[2] }
    case 'adder':
      return { ...base, kind: 'adder', a: t.slice(0, w), b: t.slice(w, 2 * w), cin: t[2 * w] }
    case 'comparator':
      return { ...base, kind: 'comparator', x: t.slice(0, w), y: t.slice(w) }
    case 'decoder': {
      const spec: DecoderSpec = { k: w, enable: s.enable ?? 'none', outputs: s.outputs ?? 'high' }
      return { ...base, kind: 'decoder', spec, selects: t.slice(0, w), enable: spec.enable === 'none' ? undefined : t[w] }
    }
    case 'mux':
      return { ...base, kind: 'mux', selects: t.slice(0, w), data: t.slice(w) }
    case 'quadmux':
      return { ...base, kind: 'quadmux', s: t[0], eBar: t[1], a: t.slice(2, 2 + w), b: t.slice(2 + w) }
    case 'demux':
      return { ...base, kind: 'demux', selects: t.slice(0, w), d: t[w] }
    case 'encoder':
      return { ...base, kind: 'encoder', inputs: t, priority: s.priority === true, valid: s.valid !== false }
    case 'count1':
    case 'count0':
      return { ...base, kind: s.kind, inputs: t }
    case 'gate':
      return { ...base, kind: 'gate', op: s.op ?? 'AND', inputs: t }
  }
}

/** Pin and output names of a block, in the order the editor shows them, or what is wrong with it. */
export function blockPins(s: BlockSpec): { pins: string[]; ports: string[]; cite: string } | string {
  const sh = shapeOf(blockFromSpec(s))
  return typeof sh === 'string' ? sh : { pins: sh.pins.map((p) => p.pin), ports: sh.ports, cite: sh.cite }
}
