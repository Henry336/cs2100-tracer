/** Multiplexers and demultiplexers (L18 p34-56): evaluation, function implementation and gate-free selector search. */
import { canonical, minimize } from '../boolean'
import { bin, fnFromRows, mintermText, range, selectNames, selectValue, sigmaOf, wireAll, type Bit, type BoolFunction, type Built, type CellValue, type Explain } from './signals'

export interface MuxResult {
  index: number
  output: Bit
  /** Every term I_i∙m_i of Y with its value (L18 p39). */
  terms: { i: number; data: Bit; minterm: Bit; value: Bit; text: string }[]
  why: Explain
}

/** Y = Σ I_i∙m_i over the selects, S(k-1) the MSB (L18 p38-39). */
export function mux(select: number, data: Bit[]): Built<MuxResult> {
  const k = Math.log2(data.length)
  if (data.length < 2 || !Number.isInteger(k)) return { ok: false, errors: [{ pin: 'data', message: 'a mux has 2, 4, 8, ... data inputs' }] }
  if (!Number.isInteger(select) || select < 0 || select >= data.length)
    return { ok: false, errors: [{ pin: 'S', message: `a ${data.length}:1 mux takes a select value from 0 to ${data.length - 1}` }] }
  const names = selectNames(k)
  const terms = data.map((d, i) => {
    const minterm = (i === select ? 1 : 0) as Bit
    return { i, data: d, minterm, value: (d & minterm) as Bit, text: `I${i}∙${mintermText(i, names)}` }
  })
  const output = data[select]
  return {
    ok: true,
    index: select,
    output,
    terms,
    why: {
      rule: 'Y = I0∙m0 + I1∙m1 + ...: the selects make exactly one minterm 1, so Y copies that data input.',
      working: `${names.join('')} = ${bin(select, k)} = ${select}, so Y = I${select} = ${output}`,
      cite: 'L18 p38-39',
    },
  }
}

/** Y_i = D∙m_i: the same as a decoder with D on its enable (L18 p35-36). An out-of-range select gives no outputs. */
export function demux(d: Bit, select: number, k: number): { outputs: Bit[]; why: Explain } {
  if (!Number.isInteger(k) || k < 1 || k > 8 || !Number.isInteger(select) || select < 0 || select >= 1 << k)
    return { outputs: [], why: { rule: 'A 1:2^k demux needs 1 to 8 select lines and a select value from 0 to 2^k - 1.', cite: 'L18 p35' } }
  const outputs = range(1 << k).map((i) => (i === select ? d : 0) as Bit)
  return {
    outputs,
    why: {
      rule: 'The data input goes to output Y_i picked by the selects; every other output is 0. This is a decoder with D on the enable.',
      working: `${selectNames(k).join('')} = ${bin(select, k)}: Y${select} = D = ${d}`,
      cite: 'L18 p35-36',
    },
  }
}

export interface MuxCircuit {
  vars: string[]
  rows: { row: number; select: number; data: Bit[]; y: Bit }[]
  f: BoolFunction
  gated: string[]
  why: Explain
}

/** A multiplexer whose selects and data inputs are wired to variables, constants or expressions. */
export function muxCircuit(selects: string[], data: string[], vars: string[]): Built<{ circuit: MuxCircuit }> {
  if (data.length !== 1 << selects.length) return { ok: false, errors: [{ pin: 'data', message: `${selects.length} selects need ${1 << selects.length} data inputs` }] }
  const names = selectNames(selects.length)
  const built = wireAll([...selects.map((t, j) => ({ pin: names[j], text: t })), ...data.map((t, i) => ({ pin: `I${i}`, text: t }))], vars)
  if (!built.ok) return built
  const sel = built.wires.slice(0, selects.length)
  const dat = built.wires.slice(selects.length)
  const rows = range(1 << vars.length).map((row) => {
    const select = selectValue(sel, row)
    const d = dat.map((w) => w.rows[row])
    return { row, select, data: d, y: d[select] }
  })
  const f = fnFromRows('F', vars, rows.map((r) => r.y))
  return {
    ok: true,
    circuit: {
      vars,
      rows,
      f,
      gated: built.wires.filter((w) => w.needsGate).map((w) => w.pin),
      why: { rule: 'On each row Y is the data input picked by the selects.', working: `F = ${sigmaOf(f)}`, cite: 'L18 p38-39' },
    },
  }
}

/* ---------- Implementing F on a mux (L18 p48-56; T08 Q1) ---------- */

export type DataKind = 'const' | 'dontcare' | 'literal' | 'complement' | 'expression'

export interface DataInput {
  kind: DataKind
  /** 0, 1, X, a literal such as C or C', or a minimal SOP of the residual variables. */
  text: string
  /** Needs an inverter (complemented literal, not available by default, T06 p2). */
  needsInverter: boolean
  /** Needs a gate other than an inverter. */
  needsGate: boolean
  why: Explain
}

export interface MuxGroup {
  /** Data line index = binary value of the selects. */
  index: number
  /** Select values, e.g. "AB = 01". */
  label: string
  /** The rows of F in this group, residual variables changing. */
  rows: { row: number; residual: number; value: CellValue }[]
  data: DataInput
}

export interface MuxPlan {
  fn: BoolFunction
  selects: string[]
  /** Variables left for the data inputs. */
  residual: string[]
  groups: MuxGroup[]
  data: DataInput[]
  /** Data inputs in order, comma separated, e.g. "1, C, 0, C'". */
  text: string
  /** Inverters: one per complemented variable, shared by every input that uses it (R07 p14 counts them as gates). */
  inverters: number
  /** AND and OR gates in the data-input expressions; the same expression on two inputs is built once. */
  gates: number
  /** True when every data input is a constant, a don't-care or an uncomplemented literal. */
  noGates: boolean
  why: Explain
}

function dataFor(values: CellValue[], residual: string[], label: string): DataInput {
  const fits = (want: (r: number) => Bit) => values.every((v, r) => v === 'X' || v === want(r))
  const m = residual.length
  const bitOf = (j: number) => (r: number) => ((r >> (m - 1 - j)) & 1) as Bit
  const mk = (kind: DataKind, text: string, rule: string): DataInput => ({
    kind,
    text,
    needsInverter: kind === 'complement' || (kind === 'expression' && text.includes("'")),
    needsGate: kind === 'expression',
    why: { rule, working: `${label}: F = ${values.join(', ')} for ${residual.length ? residual.join('') + ' = ' + range(values.length).map((r) => bin(r, m)).join(', ') : 'this row'}, so the input is ${text}`, cite: 'L18 p51-55; T08 Q1' },
  })
  if (values.every((v) => v === 'X')) return mk('dontcare', 'X', "Every row in the group is a don't-care, so this input can be anything.")
  if (fits(() => 0)) return mk('const', '0', "F is 0 on every row of the group (a don't-care is set to 0: a constant is simpler than a literal).")
  if (fits(() => 1)) return mk('const', '1', "F is 1 on every row of the group (a don't-care is set to 1: a constant is simpler than a literal).")
  for (const [j, v] of residual.entries()) if (fits(bitOf(j))) return mk('literal', v, `F follows ${v} in this group, so the input is ${v}.`)
  for (const [j, v] of residual.entries())
    if (fits((r) => (1 - bitOf(j)(r)) as Bit)) return mk('complement', `${v}'`, `F is the opposite of ${v} in this group, so the input is ${v}'. That needs an inverter.`)
  const sub = minimize(fnFromRows('F', residual, values), 'sop')
  return mk('expression', sub.summary.answer, 'F in this group is not a constant or a single literal, so the input is its simplified SOP. The selects already fix the other variables (T08 Q4).')
}

/**
 * Put `selects` (MSB first, S(k-1) = selects[0]) on the select lines and work out every data input from the
 * truth table regrouped by select value (L18 p54). The other variables stay on the data inputs.
 */
export function muxImplement(fn: BoolFunction, selects: string[]): Built<{ plan: MuxPlan }> {
  const vars = fn.vars
  const n = vars.length
  const missing = selects.filter((s) => !vars.includes(s))
  if (missing.length) return { ok: false, errors: [{ pin: 'selects', message: `unknown select variable ${missing.join(', ')}` }] }
  if (new Set(selects).size !== selects.length) return { ok: false, errors: [{ pin: 'selects', message: 'a variable can go on only one select line' }] }
  if (!selects.length) return { ok: false, errors: [{ pin: 'selects', message: 'pick at least one select variable' }] }
  const residual = vars.filter((v) => !selects.includes(v))
  const k = selects.length
  const m = residual.length
  const on = new Set(fn.on)
  const dc = new Set(fn.dc)
  const posOf = (v: string) => n - 1 - vars.indexOf(v)
  const groups: MuxGroup[] = range(1 << k).map((index) => {
    const rows = range(1 << m).map((res) => {
      let row = 0
      selects.forEach((s, j) => (row |= ((index >> (k - 1 - j)) & 1) << posOf(s)))
      residual.forEach((v, j) => (row |= ((res >> (m - 1 - j)) & 1) << posOf(v)))
      const value: CellValue = dc.has(row) ? 'X' : on.has(row) ? 1 : 0
      return { row, residual: res, value }
    })
    const label = `${selects.join('')} = ${bin(index, k)}`
    return { index, label, rows, data: dataFor(rows.map((r) => r.value), residual, label) }
  })
  const data = groups.map((g) => g.data)
  const inverters = new Set(data.flatMap((d) => [...d.text.matchAll(/([A-Za-z][0-9]*)'/g)].map((x) => x[1]))).size
  const gates = [...new Set(data.filter((d) => d.needsGate).map((d) => d.text))].reduce((sum, t) => {
    const terms = t.split(' + ')
    return sum + terms.filter((x) => x.includes('∙')).length + (terms.length > 1 ? 1 : 0)
  }, 0)
  const text = data.map((d) => d.text).join(', ')
  return {
    ok: true,
    plan: {
      fn,
      selects,
      residual,
      groups,
      data,
      text,
      inverters,
      gates,
      noGates: inverters === 0 && gates === 0,
      why: {
        rule:
          m === 0
            ? 'Every variable is on a select line, so each data input is the value of F on its row (L18 p48-49).'
            : `Selects ${selects.map((s, j) => `S${k - 1 - j} = ${s}`).join(', ')}; ${residual.join(', ')} ${m === 1 ? 'is' : 'are'} left for the data inputs, each one 0, 1, ${residual[0]} or ${residual[0]}' when one variable is left (L18 p51-55).`,
        working: `${canonical(fn).sigma}: data inputs ${text}${inverters + gates ? ` (${inverters} inverter${inverters === 1 ? '' : 's'}, ${gates} other gate${gates === 1 ? '' : 's'})` : ''}`,
        cite: m === 0 ? 'L18 p48-49' : 'L18 p51-55',
      },
    },
  }
}

export interface MuxSearch {
  /** Every ordered choice of k select variables, best first (no gates, then fewest inverters and gates). */
  plans: MuxPlan[]
  noGates: MuxPlan[]
  why: Explain
}

/** Try every ordered choice of k select variables (AY23/24 S1 Q10, S2 Q21a). Default k = n - 1, a 2^(n-1):1 mux. */
export function muxSearch(fn: BoolFunction, k = fn.vars.length - 1): MuxSearch {
  const perms = (pool: string[], len: number): string[][] =>
    len === 0 ? [[]] : pool.flatMap((v) => perms(pool.filter((x) => x !== v), len - 1).map((rest) => [v, ...rest]))
  const plans = perms(fn.vars, k)
    .map((sel) => muxImplement(fn, sel))
    .flatMap((r) => (r.ok ? [r.plan] : []))
    .sort((a, b) => Number(b.noGates) - Number(a.noGates) || a.inverters + a.gates - (b.inverters + b.gates))
  const noGates = plans.filter((p) => p.noGates)
  return {
    plans,
    noGates,
    why: noGates.length
      ? {
          rule: 'Select choices that need no inverter or gate: every data input is 0, 1 or an uncomplemented variable.',
          working: noGates.map((p) => `${p.selects.join('')}: ${p.text}`).join('; '),
          cite: 'AY23/24 S1 Q10; AY23/24 S2 Q21a',
        }
      : {
          rule: 'Every select order leaves some data input needing a complemented literal or a gate.',
          working: `${plans.length} select orders checked`,
          cite: 'AY23/24 S1 Q10',
        },
  }
}

/* ---------- Larger multiplexers from smaller ones (L18 p42-45) ---------- */

export interface MuxTreeNode {
  id: number
  /** 0 = the stage on the data inputs. */
  level: number
  /** Position in its stage, 0 at the top. */
  index: number
  /** Data inputs of this block (2^k of them). */
  size: number
  /** Select bits on this block, MSB first, e.g. ['S1', 'S0']. */
  selects: string[]
  /** What drives each input: I_i at the first stage, the outputs of the stage before it later. */
  inputs: string[]
  /** Input this block passes for the current select value. */
  chosen: number
  /** The original data input that reaches this block's output. */
  carries: number
  /** On the path from the selected input to Y. */
  active: boolean
}

export interface MuxTree {
  n: number
  levels: number[]
  nodes: MuxTreeNode[]
  /** Blocks used, by size, e.g. { 4: 2, 2: 1 }. */
  blocks: Record<number, number>
  select: number
  /** Data input that reaches Y. */
  output: number
  why: { build: Explain; path: Explain }
}

/**
 * A 2^n:1 mux from stages of smaller muxes. `levels` lists the select bits per stage from the data inputs to Y:
 * [2, 1] is two 4:1 then a 2:1 (L18 p42), [1, 2] is four 2:1 then a 4:1 (L18 p44), [2, 2] is five 4:1 (L18 p45).
 * The first stage gets the low select bits, so the MSB always sits on the last stage (both p42 and p44).
 */
export function muxTree(n: number, levels: number[], select = 0): Built<{ tree: MuxTree }> {
  if (!Number.isInteger(n) || n < 2 || n > 6) return { ok: false, errors: [{ pin: 'n', message: 'the target mux must be 4:1 to 64:1' }] }
  if (!levels.length || levels.some((k) => !Number.isInteger(k) || k < 1) || levels.reduce((a, b) => a + b, 0) !== n)
    return { ok: false, errors: [{ pin: 'levels', message: `the stages must use ${n} select bits in total, at least 1 each` }] }
  if (!Number.isInteger(select) || select < 0 || select >= 1 << n) return { ok: false, errors: [{ pin: 'S', message: `the select value must be 0 to ${(1 << n) - 1}` }] }
  const nodes: MuxTreeNode[] = []
  let prev: MuxTreeNode[] = []
  let offset = 0
  levels.forEach((k, level) => {
    const chosen = (select >> offset) & ((1 << k) - 1)
    const activeIndex = select >> (offset + k)
    const stage = range(1 << (n - offset - k)).map((index): MuxTreeNode => {
      const kids = range(1 << k).map((i) => index * (1 << k) + i)
      return {
        id: nodes.length + index,
        level,
        index,
        size: 1 << k,
        selects: range(k).map((j) => `S${offset + k - 1 - j}`),
        inputs: level === 0 ? kids.map((i) => `I${i}`) : kids.map((i) => `stage ${level} block ${i}`),
        chosen,
        carries: level === 0 ? kids[chosen] : prev[kids[chosen]].carries,
        active: index === activeIndex,
      }
    })
    nodes.push(...stage)
    prev = stage
    offset += k
  })
  const blocks: Record<number, number> = {}
  for (const x of nodes) blocks[x.size] = (blocks[x.size] ?? 0) + 1
  const output = nodes[nodes.length - 1].carries
  const path = levels.map((_, l) => nodes.find((m) => m.level === l && m.active) as MuxTreeNode)
  return {
    ok: true,
    tree: {
      n,
      levels,
      nodes,
      blocks,
      select,
      output,
      why: {
        build: {
          rule: 'Each stage is a row of small muxes. The first stage takes the low select bits and the last stage takes the MSB, so where a select bit goes decides which inputs share a block.',
          working: Object.entries(blocks)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([size, c]) => `${c} x ${size}:1`)
            .join(' + '),
          cite: 'L18 p42-45',
        },
        path: {
          rule: 'At every stage the active block passes the input picked by its select bits.',
          working: `${selectNames(n).join('')} = ${bin(select, n)}: ${path.map((x, l) => `stage ${l + 1} block ${x.index} passes its input ${x.chosen}`).join(', ')}, so Y = I${output}`,
          cite: 'L18 p43-44',
        },
      },
    },
  }
}

/* ---------- Quad 2:1 mux chip with a shared select and active-low enable (L18 p41; T08 Q3) ---------- */

/** E' = 1 gives all 0s; E' = 0 passes A when S = 0 and B when S = 1. Inputs and output MSB first. */
export function quadMux(a: Bit[], b: Bit[], s: Bit, eBar: Bit = 0): Built<{ y: Bit[]; why: Explain }> {
  if (a.length !== b.length || !a.length) return { ok: false, errors: [{ pin: 'B', message: 'A and B need the same number of bits' }] }
  const y = eBar ? a.map((): Bit => 0) : (s ? b : a).slice()
  return {
    ok: true,
    y,
    why: eBar
      ? { rule: "E' = 1 disables the chip: every output is 0.", working: `Y = ${y.join('')}`, cite: 'L18 p41' }
      : { rule: `E' = 0 and S = ${s}, so every output copies its ${s ? 'B' : 'A'} input.`, working: `Y = ${s ? 'B' : 'A'} = ${y.join('')}`, cite: 'L18 p41' },
  }
}

/* ---------- A demux wired to variables (L18 p35-36; AY19/20 Q5b) ---------- */

export interface DemuxCircuit {
  vars: string[]
  rows: { row: number; select: number; d: Bit; outputs: Bit[] }[]
  outputs: BoolFunction[]
  why: Explain[]
}

/** Selects (MSB first) and the data input D wired to variables, constants or expressions. */
export function demuxCircuit(selects: string[], d: string, vars: string[]): Built<{ circuit: DemuxCircuit }> {
  if (!selects.length || selects.length > 4) return { ok: false, errors: [{ pin: 'S', message: 'a demux needs 1 to 4 select lines' }] }
  const names = selectNames(selects.length)
  const built = wireAll([...selects.map((t, j) => ({ pin: names[j], text: t })), { pin: 'D', text: d }], vars)
  if (!built.ok) return built
  const sel = built.wires.slice(0, selects.length)
  const dw = built.wires[selects.length]
  const rows = range(1 << vars.length).map((row) => {
    const select = selectValue(sel, row)
    return { row, select, d: dw.rows[row], outputs: demux(dw.rows[row], select, selects.length).outputs }
  })
  const outputs = range(1 << selects.length).map((i) => fnFromRows(`Y${i}`, vars, rows.map((r) => r.outputs[i])))
  return {
    ok: true,
    circuit: {
      vars,
      rows,
      outputs,
      why: outputs.map((f, i) => ({
        rule: `Y${i} = D∙m${i}: D reaches Y${i} only when the selects read ${i}.`,
        working: `with ${sel.map((w) => `${w.pin} = ${w.text}`).join(', ')}, D = ${dw.text}: Y${i} = ${sigmaOf(f)}`,
        cite: 'L18 p35-36',
      })),
    },
  }
}
