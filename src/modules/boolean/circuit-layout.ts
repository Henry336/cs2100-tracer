import type { NetGateType } from '../../core/boolean'

/**
 * Where to draw a two-level circuit (L14 p13-16 style): one vertical rail per input literal on the left,
 * inverters on the rails that need them, then gate columns. Pure, so it can be tested without a DOM.
 */

/** A gate to draw: a two-level circuit gate (core circuit.ts) or an expression network gate (core gates.ts). */
export interface DrawGate {
  id: string
  type: NetGateType
  inputs: string[]
  output: string
  level: number
  arrival: number
  inverter?: boolean
}

/** What the layout needs: TwoLevelCircuit fits as is; a Network needs its inputs listed. */
export interface DrawCircuit {
  /** Input names in rail order: variables, then any constants the gates use. */
  inputs: string[]
  gates: DrawGate[]
  output: string
  constant?: 0 | 1
}

export const GW = 44
const BUBBLE = 8
const RAIL0 = 26
const RAIL_DX = 24
const TOP = 64
const VGAP = 16
const COL_GAP = 112

export interface Rail {
  signal: string
  x: number
  /** Input inverter that makes this rail (absent for a plain input or a free complement). */
  inverter?: DrawGate
  /** The rail it is inverted from. */
  fromX?: number
  y0: number
  y1: number
}

export interface PlacedGate {
  gate: DrawGate
  x: number
  y: number
  h: number
  col: number
  pins: { x: number; y: number }[]
  out: { x: number; y: number }
}

export interface Wire {
  from: string
  to: string
  points: [number, number][]
  /** Junction dot where the wire leaves a rail. */
  dot?: [number, number]
}

export interface CircuitLayout {
  rails: Rail[]
  gates: PlacedGate[]
  wires: Wire[]
  output: { x: number; y: number; label: string; from: string }
  width: number
  height: number
}

const isOr = (t: NetGateType) => t === 'OR' || t === 'NOR' || t === 'XOR' || t === 'XNOR'
const hasBubble = (t: NetGateType) => t === 'NAND' || t === 'NOR' || t === 'NOT' || t === 'XNOR'
const isXor = (t: NetGateType) => t === 'XOR' || t === 'XNOR'

/** x of the curved back of an OR body at height fraction f (quadratic, see gatePath). */
const orBack = (f: number) => 0.5 * GW * f * (1 - f)

export function layoutCircuit(c: DrawCircuit, name = 'F'): CircuitLayout {
  const producer = new Map(c.gates.map((g) => [g.output, g]))
  const isInputInv = (g: DrawGate) => g.type === 'NOT' && c.inputs.includes(g.inputs[0]) && !producer.has(g.inputs[0])
  const used = new Set(c.gates.flatMap((g) => g.inputs))
  if (!c.gates.length && c.constant === undefined) used.add(c.output)

  // Rails: each input literal in variable order, its complement right after it.
  const rails: Rail[] = []
  for (const v of c.inputs) {
    const comp = `${v}'`
    const inv = producer.get(comp)
    const needComp = used.has(comp) || c.output === comp
    if (used.has(v) || (inv && needComp) || c.output === v) rails.push({ signal: v, x: 0, y0: 18, y1: 0 })
    if (needComp) rails.push({ signal: comp, x: 0, inverter: inv && isInputInv(inv) ? inv : undefined, y0: inv ? 50 : 18, y1: 0 })
  }
  rails.forEach((r, i) => (r.x = RAIL0 + i * RAIL_DX))
  for (const r of rails) if (r.inverter) r.fromX = rails.find((q) => q.signal === r.inverter!.inputs[0])?.x
  const railOf = new Map(rails.map((r) => [r.signal, r]))
  const railsEnd = rails.length ? rails[rails.length - 1].x : RAIL0

  // Columns: gates fed only by rails are column 1.
  const body = c.gates.filter((g) => !(isInputInv(g) && railOf.has(g.output)))
  const col = new Map<string, number>()
  for (const g of body) col.set(g.output, 1 + Math.max(0, ...g.inputs.map((i) => col.get(i) ?? 0)))
  const colX = (k: number) => railsEnd + 44 + (k - 1) * (GW + BUBBLE + COL_GAP)

  // Column 1 order follows the inputs of the later gates, so wires do not cross. A rail feeding a later gate gets a pass-through slot.
  type Item = { kind: 'gate'; g: DrawGate } | { kind: 'pass'; signal: string; key: string }
  const col1: Item[] = []
  const placed = new Set<string>()
  for (const g of body)
    if ((col.get(g.output) ?? 1) > 1)
      for (const i of g.inputs) {
        const pg = producer.get(i)
        if (pg && col.get(i) === 1 && !placed.has(i)) {
          col1.push({ kind: 'gate', g: pg })
          placed.add(i)
        } else if (railOf.has(i)) col1.push({ kind: 'pass', signal: i, key: `${i}>${g.output}` })
      }
  for (const g of body) if (col.get(g.output) === 1 && !placed.has(g.output)) col1.push({ kind: 'gate', g })

  const gates: PlacedGate[] = []
  const at = new Map<string, { x: number; y: number }>()
  const passAt = new Map<string, { x: number; y: number }>()
  const wires: Wire[] = []
  const heightOf = (g: DrawGate) => Math.max(30, g.inputs.length * 14 + 4)
  const pinsOf = (g: DrawGate, x: number, y: number, h: number) =>
    g.inputs.map((_, k) => {
      const f = (k + 1) / (g.inputs.length + 1)
      return { x: x + (isOr(g.type) ? orBack(f) : 0), y: y + h * f }
    })
  const place = (g: DrawGate, k: number, y: number) => {
    const x = colX(k)
    const h = heightOf(g)
    const outX = x + (g.type === 'NOT' ? GW * 0.7 : GW) + (hasBubble(g.type) ? BUBBLE : 0)
    const pg: PlacedGate = { gate: g, x, y, h, col: k, pins: pinsOf(g, x, y, h), out: { x: outX, y: y + h / 2 } }
    gates.push(pg)
    at.set(g.output, pg.out)
    return pg
  }

  let y = TOP
  for (const it of col1) {
    if (it.kind === 'gate') {
      place(it.g, 1, y)
      y += heightOf(it.g) + VGAP
    } else {
      passAt.set(it.key, { x: colX(1) + GW + BUBBLE, y: y + 11 })
      y += 22 + VGAP
    }
  }
  let bottom = y - VGAP
  const maxCol = Math.max(1, ...body.map((g) => col.get(g.output) ?? 1))
  for (let k = 2; k <= maxCol; k++) {
    let floor = TOP
    for (const g of body.filter((q) => col.get(q.output) === k)) {
      const srcY = g.inputs.map((i) => passAt.get(`${i}>${g.output}`)?.y ?? at.get(i)?.y ?? TOP)
      const h = heightOf(g)
      const want = srcY.reduce((a, b) => a + b, 0) / srcY.length - h / 2
      const pg = place(g, k, Math.max(floor, want))
      floor = pg.y + h + VGAP
      bottom = Math.max(bottom, pg.y + h)
    }
  }

  // Wires.
  const byPin = new Map<PlacedGate, { src: { x: number; y: number }; pin: { x: number; y: number }; from: string }[]>()
  for (const pg of gates)
    pg.gate.inputs.forEach((i, k) => {
      const pin = pg.pins[k]
      const rail = railOf.get(i)
      if (pg.col === 1 && rail) {
        wires.push({ from: i, to: pg.gate.output, points: [[rail.x, pin.y], [pin.x, pin.y]], dot: [rail.x, pin.y] })
        rail.y1 = Math.max(rail.y1, pin.y)
        return
      }
      let src = at.get(i)
      if (rail) {
        const p = passAt.get(`${i}>${pg.gate.output}`)!
        wires.push({ from: i, to: pg.gate.output, points: [[rail.x, p.y], [p.x, p.y]], dot: [rail.x, p.y] })
        rail.y1 = Math.max(rail.y1, p.y)
        src = p
      }
      if (!src) return
      const list = byPin.get(pg) ?? []
      list.push({ src, pin, from: i })
      byPin.set(pg, list)
    })
  for (const [pg, list] of byPin) {
    const down = list.filter((w) => w.src.y < w.pin.y - 0.5).sort((a, b) => a.src.y - b.src.y)
    const up = list.filter((w) => w.src.y > w.pin.y + 0.5).sort((a, b) => b.src.y - a.src.y)
    // The wire that turns first sits furthest right, so no horizontal crosses a vertical.
    const rank = new Map<(typeof list)[number], number>()
    down.forEach((w, i) => rank.set(w, down.length - 1 - i))
    up.forEach((w, i) => rank.set(w, up.length - 1 - i))
    // Verticals sit next to the consumer, leaving room after each output for its label.
    const k = Math.max(down.length, up.length)
    for (const w of list) {
      const r = rank.get(w)
      const xm = pg.x - 12 - (k - 1 - (r ?? 0)) * 9
      wires.push({
        from: w.from,
        to: pg.gate.output,
        points: r === undefined ? [[w.src.x, w.src.y], [w.pin.x, w.pin.y]] : [[w.src.x, w.src.y], [xm, w.src.y], [xm, w.pin.y], [w.pin.x, w.pin.y]],
      })
    }
  }

  // Output.
  const last = at.get(c.output)
  const rail = railOf.get(c.output)
  let output: CircuitLayout['output']
  if (last) output = { x: last.x + 30, y: last.y, label: name, from: c.output }
  else if (rail) {
    const yy = Math.max(TOP, rail.y0 + 20)
    const x = railsEnd + 60
    wires.push({ from: c.output, to: name, points: [[rail.x, yy], [x, yy]], dot: [rail.x, yy] })
    rail.y1 = Math.max(rail.y1, yy)
    output = { x, y: yy, label: name, from: c.output }
    bottom = Math.max(bottom, yy)
  } else output = { x: RAIL0 + 60, y: TOP, label: `${name} = ${c.constant ?? c.output}`, from: c.output }
  if (last) wires.push({ from: c.output, to: name, points: [[last.x, last.y], [output.x, output.y]] })
  for (const r of rails) r.y1 = Math.max(r.y1, r.y0 + 10)
  const width = Math.max(output.x + 40, railsEnd + 80)
  return { rails, gates, wires, output, width, height: bottom + 24 }
}

/** SVG path of a gate body with its left edge at x and top at y. */
export function gatePath(type: NetGateType, x: number, y: number, h: number): string {
  if (type === 'NOT') {
    const w = GW * 0.7
    return `M${x},${y + h / 2 - 12} L${x + w},${y + h / 2} L${x},${y + h / 2 + 12} Z`
  }
  // XOR and XNOR: the OR body plus a second curved line behind it (L14 p6).
  const back = isXor(type) ? ` M${x - 6},${y} Q${x - 6 + GW * 0.25},${y + h / 2} ${x - 6},${y + h}` : ''
  if (isOr(type))
    return `M${x},${y} Q${x + GW * 0.62},${y} ${x + GW},${y + h / 2} Q${x + GW * 0.62},${y + h} ${x},${y + h} Q${x + GW * 0.25},${y + h / 2} ${x},${y} Z${back}`
  return `M${x},${y} H${x + GW / 2} A${GW / 2},${h / 2} 0 0 1 ${x + GW / 2},${y + h} H${x} Z`
}

export function bubbleAt(type: NetGateType, x: number, y: number, h: number): { cx: number; cy: number } | null {
  if (!hasBubble(type)) return null
  return { cx: x + (type === 'NOT' ? GW * 0.7 : GW) + BUBBLE / 2, cy: y + h / 2 }
}

/** Value of every signal for one input row over `vars` (first variable is the MSB; default: the circuit's inputs). */
export function simulate(c: DrawCircuit, row: number, vars = c.inputs.filter((x) => x !== '0' && x !== '1')): Map<string, 0 | 1> {
  const n = vars.length
  const v = new Map<string, 0 | 1>([
    ['0', 0],
    ['1', 1],
  ])
  vars.forEach((x, i) => {
    const b = ((row >> (n - 1 - i)) & 1) as 0 | 1
    v.set(x, b)
    v.set(`${x}'`, (1 - b) as 0 | 1)
  })
  for (const g of c.gates) {
    const ins = g.inputs.map((i) => v.get(i) ?? 0)
    const and = ins.every((b) => b === 1)
    const or = ins.some((b) => b === 1)
    const odd = ins.filter((b) => b === 1).length % 2 === 1
    const out = { AND: and, OR: or, NAND: !and, NOR: !or, XOR: odd, XNOR: !odd, NOT: !ins[0] }[g.type]
    v.set(g.output, out ? 1 : 0)
  }
  return v
}
