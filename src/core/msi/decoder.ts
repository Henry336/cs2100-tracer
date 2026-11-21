/** Decoders (L18 p5-24; R09 p10-19, p53-58): enable type, output polarity, decoder + gate, product finder, larger decoders. */
import { fnFromRows, range, maxtermText, mintermText, selectNames, selectValue, sigmaOf, wireAll, type Bit, type BoolFunction, type Built, type Explain } from './signals'

/** none, 1-enable (active when E = 1) or 0-enable (active when E = 0, drawn E' or with a bubble, L18 p15-16). */
export type EnableKind = 'none' | 'one' | 'zero'
/** Active-high (normal) or active-low (negated) outputs (L18 p20; R09 p19). */
export type OutputPolarity = 'high' | 'low'

export interface DecoderSpec {
  /** Number of select inputs: a k x 2^k decoder. */
  k: number
  enable: EnableKind
  outputs: OutputPolarity
}

export const decoderName = (s: DecoderSpec): string =>
  `${s.k}x${1 << s.k} decoder${s.enable === 'one' ? ', 1-enable' : s.enable === 'zero' ? ', 0-enable' : ''}, active-${s.outputs} outputs`

/** Output formula Y_i in terms of E and the selects, e.g. E + M_i for a 0-enable decoder with active-low outputs (R09 p58). */
export function outputFormula(s: DecoderSpec, i: number): { text: string; short: string; why: Explain } {
  const names = selectNames(s.k)
  const m = mintermText(i, names)
  const M = maxtermText(i, names)
  const table: Record<EnableKind, Record<OutputPolarity, [string, string, string]>> = {
    none: {
      high: [m, `m${i}`, 'Output i is minterm m_i of the selects (L18 p12-13).'],
      low: [M, `M${i}`, "Active-low output i is m_i' = M_i (L18 p20; R09 p19)."],
    },
    one: {
      high: [`E∙${m}`, `E∙m${i}`, 'A 1-enable decoder ANDs every minterm with E: all outputs are 0 when E = 0 (L18 p15).'],
      low: [`E'+${M}`, `E'+M${i}`, "Active-low with 1-enable: (E∙m_i)' = E' + M_i, so all outputs are 1 when E = 0."],
    },
    zero: {
      high: [`E'∙${m}`, `E'∙m${i}`, 'A 0-enable decoder is active when E = 0, so output i = E\'∙m_i (L18 p16).'],
      low: [`E+${M}`, `E+M${i}`, "Active-low with 0-enable: (E'∙m_i)' = E + M_i (R09 p58)."],
    },
  }
  const [text, short, rule] = table[s.enable][s.outputs]
  return { text, short, why: { rule, working: `Y${i} = ${short} = ${text}`, cite: s.enable === 'zero' && s.outputs === 'low' ? 'R09 p58' : 'L18 p13-20' } }
}

export interface DecodeResult {
  enabled: boolean
  /** Index selected by the select lines (S(k-1) is the MSB). */
  index: number
  outputs: Bit[]
  why: Explain
}

/** The enable level that turns the decoder on: an unwired enable is tied to it (L18 p15-16). */
export const activeEnable = (s: DecoderSpec): Bit => (s.enable === 'zero' ? 0 : 1)

/** One evaluation: select value (S(k-1)..S0 as a number) and enable level (default: the active level). */
export function decode(s: DecoderSpec, select: number, e: Bit = activeEnable(s)): Built<DecodeResult> {
  if (!Number.isInteger(select) || select < 0 || select >= 1 << s.k)
    return { ok: false, errors: [{ pin: 'S', message: `a ${s.k}x${1 << s.k} decoder takes a select value from 0 to ${(1 << s.k) - 1}` }] }
  return { ok: true, ...decodeRow(s, select, e) }
}

function decodeRow(s: DecoderSpec, select: number, e: Bit): DecodeResult {
  const enabled = s.enable === 'none' || (s.enable === 'one' ? e === 1 : e === 0)
  const active = (i: number) => enabled && i === select
  const outputs = range(1 << s.k).map((i) => ((active(i) ? 1 : 0) ^ (s.outputs === 'low' ? 1 : 0)) as Bit)
  const idle = s.outputs === 'low' ? 1 : 0
  return {
    enabled,
    index: select,
    outputs,
    why: enabled
      ? {
          rule: `Enabled: only output ${select} is active (${s.outputs === 'low' ? '0' : '1'}), every other output is ${idle}.`,
          working: `${selectNames(s.k).join('')} = ${select.toString(2).padStart(s.k, '0')} = ${select}`,
          cite: 'L18 p13',
        }
      : { rule: `Disabled (E = ${e}): every output is inactive (${idle}).`, cite: s.outputs === 'low' ? 'R09 p19' : 'L18 p15' },
  }
}

/* ---------- A decoder wired to variables, optionally feeding one gate ---------- */

export type OutputGate = 'none' | 'OR' | 'NOR' | 'AND' | 'NAND'

export interface DecoderWiring {
  /** Select pins MSB first, e.g. ['A', 'C'] for S1 = A, S0 = C. Variables, 0, 1 or expressions. */
  selects: string[]
  /** Enable pin text (ignored when the decoder has no enable). */
  enable?: string
}

export interface DecoderUse {
  /** Outputs that feed the gate (or the one output taken as F when gate is 'none'). */
  outputs: number[]
  gate: OutputGate
}

export interface DecoderRow {
  row: number
  select: number
  e: Bit
  enabled: boolean
  outputs: Bit[]
  f: Bit
}

export interface DecoderCircuit {
  spec: DecoderSpec
  vars: string[]
  /** One frame per truth-table row. */
  rows: DecoderRow[]
  /** Each decoder output as a function of the inputs. */
  outputFns: BoolFunction[]
  f: BoolFunction
  /** Pins driven by a complemented variable or a gate output. */
  gated: string[]
  why: { f: Explain; outputs: Explain[] }
}

function gateRule(spec: DecoderSpec, use: DecoderUse): string {
  const low = spec.outputs === 'low'
  const list = use.outputs.join(', ')
  switch (use.gate) {
    case 'none':
      return `F is output ${use.outputs[0]} directly.`
    case 'OR':
      return low
        ? `OR of active-low outputs ${list}: each is a maxterm, and an OR of maxterms is 1 unless every one of them is 0.`
        : `OR of active-high outputs ${list}: F = 1 on exactly those minterms (L18 p23).`
    case 'NOR':
      return low
        ? `NOR of active-low outputs ${list}: F = 1 only when every one of them is 0.`
        : `NOR of active-high outputs ${list}: F = 0 on those minterms and 1 on every other (L18 p24; AY25/26 Q11).`
    case 'AND':
      return low
        ? `AND of active-low outputs ${list}: a product of maxterms, F = 0 on exactly those rows (L18 p24; AY23/24 S2 Q21b).`
        : `AND of active-high outputs ${list}: at most one output is 1 at a time, so F = 1 only if a single output is listed.`
    case 'NAND':
      return low
        ? `NAND of active-low outputs ${list}: F = 1 when any of them is 0, i.e. on those minterms (L18 p23).`
        : `NAND of active-high outputs ${list}: F = 0 only when every listed output is 1.`
  }
}

/** Evaluate every row of a decoder whose pins are wired to variables, with an optional gate on chosen outputs. */
export function decoderCircuit(spec: DecoderSpec, w: DecoderWiring, vars: string[], use: DecoderUse): Built<{ circuit: DecoderCircuit }> {
  if (w.selects.length !== spec.k) return { ok: false, errors: [{ pin: 'S', message: `a ${spec.k}x${1 << spec.k} decoder needs ${spec.k} select pins` }] }
  const bad = use.outputs.find((o) => !Number.isInteger(o) || o < 0 || o >= 1 << spec.k)
  if (bad !== undefined) return { ok: false, errors: [{ pin: 'outputs', message: `output ${bad} does not exist on a ${spec.k}x${1 << spec.k} decoder` }] }
  if (!use.outputs.length) return { ok: false, errors: [{ pin: 'outputs', message: 'pick at least one output' }] }
  if (use.gate === 'none' && use.outputs.length !== 1) return { ok: false, errors: [{ pin: 'outputs', message: 'without a gate, F is a single output' }] }
  const names = selectNames(spec.k)
  const pins = w.selects.map((t, j) => ({ pin: names[j], text: t }))
  if (spec.enable !== 'none') pins.push({ pin: 'E', text: w.enable ?? String(activeEnable(spec)) })
  const built = wireAll(pins, vars)
  if (!built.ok) return built
  const sel = built.wires.slice(0, spec.k)
  const en = built.wires[spec.k]

  const rows: DecoderRow[] = range(1 << vars.length).map((row) => {
    const select = selectValue(sel, row)
    const e = (en ? en.rows[row] : activeEnable(spec)) as Bit
    const d = decodeRow(spec, select, e)
    const ins = use.outputs.map((o) => d.outputs[o])
    const or = ins.some((v) => v) ? 1 : 0
    const and = ins.every((v) => v) ? 1 : 0
    const f = (use.gate === 'none' ? ins[0] : use.gate === 'OR' ? or : use.gate === 'NOR' ? 1 - or : use.gate === 'AND' ? and : 1 - and) as Bit
    return { row, select, e, enabled: d.enabled, outputs: d.outputs, f }
  })
  const outputFns = range(1 << spec.k).map((i) => fnFromRows(`Y${i}`, vars, rows.map((r) => r.outputs[i])))
  const f = fnFromRows('F', vars, rows.map((r) => r.f))
  const wiringText = [...sel.map((x) => `${x.pin} = ${x.text}`), ...(en ? [`E = ${en.text}`] : [])].join(', ')
  const used = use.outputs.map((o) => `Y${o} = ${outputFormula(spec, o).short}`).join('; ')
  return {
    ok: true,
    circuit: {
      spec,
      vars,
      rows,
      outputFns,
      f,
      gated: built.wires.filter((x) => x.needsGate).map((x) => x.pin),
      why: {
        f: { rule: gateRule(spec, use), working: `${wiringText}. ${used}. F = ${sigmaOf(f)}`, cite: 'L18 p23-24; R09 p53-58' },
        outputs: range(1 << spec.k).map((i) => ({ ...outputFormula(spec, i).why, working: `${outputFormula(spec, i).why.working}; with ${wiringText}: ${sigmaOf(outputFns[i])}` })),
      },
    },
  }
}

/* ---------- Four ways to build f with one decoder and one gate (L18 p23-24) ---------- */

export interface DecoderBuild {
  spec: DecoderSpec
  use: DecoderUse
  label: string
  /** Gate inputs needed. */
  fanIn: number
  why: Explain
}

/** f over n variables on an n x 2^n decoder with the variables on the selects (first variable on the MSB, L18 p13). */
export function decoderBuilds(fn: BoolFunction): DecoderBuild[] {
  const k = fn.vars.length
  const ones = fn.on
  const zeros = range(1 << k).filter((m) => !fn.on.includes(m) && !fn.dc.includes(m))
  const mk = (outputs: OutputPolarity, gate: OutputGate, list: number[], label: string, rule: string): DecoderBuild => ({
    spec: { k, enable: 'none', outputs },
    use: { outputs: list, gate },
    label,
    fanIn: list.length,
    why: { rule, working: `${gate}(${list.map((m) => (outputs === 'low' ? `m${m}'` : `m${m}`)).join(', ')})`, cite: 'L18 p23-24' },
  })
  return [
    mk('high', 'OR', ones, 'Active-high outputs into OR', 'OR the outputs of the minterms where f = 1.'),
    mk('low', 'NAND', ones, 'Active-low outputs into NAND', "Each active-low output is m_i'; NAND(m_i', ...) = m_i + ... by DeMorgan."),
    mk('high', 'NOR', zeros, 'Active-high outputs into NOR', 'NOR the minterms where f = 0: f is 0 exactly there.'),
    mk('low', 'AND', zeros, 'Active-low outputs into AND', "AND of m_i' = M_i over the 0 rows is the product of maxterms of f."),
  ]
}

/* ---------- Product finder: what one decoder makes with no gates (AY23/24 S1 Q9; R09 p56, p58) ---------- */

export interface DecoderSolution {
  selects: string[]
  enable?: string
  output: number
  text: string
}

export interface DecoderSearch {
  possible: boolean
  solutions: DecoderSolution[]
  why: Explain
}

/**
 * Try every wiring of the selects and enable to uncomplemented variables and constants, and every output.
 * Each output is a row mask: the AND of the enable term and one literal per select (L18 p15-16).
 * `visit` gets the output's row mask (after the output polarity) and returns false to stop.
 */
function eachWiring(
  spec: DecoderSpec,
  vars: string[],
  constants: boolean,
  visit: (mask: bigint, solution: () => DecoderSolution) => boolean | void,
): { tried: number; all: bigint } {
  const n = vars.length
  const sources = [...vars, ...(constants ? ['0', '1'] : [])]
  const pinCount = spec.k + (spec.enable === 'none' ? 0 : 1)
  const S = sources.length
  const rowsN = 1 << n
  const all = (1n << BigInt(rowsN)) - 1n
  const maskOf = (rows: number[]) => rows.reduce((m, r) => m | (1n << BigInt(r)), 0n)
  const col = sources.map((src, s) => maskOf(range(rowsN).filter((r) => (s < n ? (r >> (n - 1 - s)) & 1 : src === '1'))))
  const pick = Array<number>(pinCount).fill(0)
  for (let c = 0; c < S ** pinCount; c++) {
    for (let j = pinCount - 1, t = c; j >= 0; j--, t = Math.floor(t / S)) pick[j] = t % S
    const en = spec.enable === 'none' ? all : spec.enable === 'one' ? col[pick[spec.k]] : all ^ col[pick[spec.k]]
    for (let o = 0; o < 1 << spec.k; o++) {
      let m = en
      for (let j = 0; j < spec.k && m; j++) m &= (o >> (spec.k - 1 - j)) & 1 ? col[pick[j]] : all ^ col[pick[j]]
      const solution = (): DecoderSolution => {
        const w: DecoderWiring = { selects: pick.slice(0, spec.k).map((x) => sources[x]), enable: spec.enable === 'none' ? undefined : sources[pick[spec.k]] }
        const sel = selectNames(spec.k).map((x, j) => `${x} = ${w.selects[j]}`)
        return { ...w, output: o, text: [...(w.enable ? [`E = ${w.enable}`] : []), ...sel, `output ${o}`].join(', ') }
      }
      if (visit(spec.outputs === 'low' ? all ^ m : m, solution) === false) return { tried: c + 1, all }
    }
  }
  return { tried: S ** pinCount, all }
}

export function findDecoderWirings(target: BoolFunction, spec: DecoderSpec, opts: { constants?: boolean; limit?: number } = {}): DecoderSearch {
  const vars = target.vars
  const maskOf = (rows: number[]) => rows.reduce((m, r) => m | (1n << BigInt(r)), 0n)
  const all = (1n << BigInt(1 << vars.length)) - 1n
  const care = all & ~maskOf(target.dc)
  const want = maskOf(target.on) & care
  const solutions: DecoderSolution[] = []
  const { tried } = eachWiring(spec, vars, opts.constants !== false, (m, sol) => {
    if ((m & care) === want) solutions.push(sol())
  })
  const limit = opts.limit ?? 50
  return {
    possible: solutions.length > 0,
    solutions: solutions.slice(0, limit),
    why: solutions.length
      ? { rule: 'Some wiring of E and the selects to variables or constants makes one output equal F, with no gates.', working: solutions[0].text, cite: 'L18 p15; R09 p56' }
      : {
          rule:
            spec.enable === 'one' && spec.outputs === 'high'
              ? 'A 1-enable output is E∙m_i. The enable adds only an uncomplemented literal and the selects give at most k literals, so this product needs an inverter.'
              : 'No wiring of the pins to variables and constants gives F on any output.',
          working: `${tried} wirings x ${1 << spec.k} outputs checked`,
          cite: 'L18 p15; AY23/24 S1 Q9',
        },
  }
}

export interface DecoderReach {
  /** Rows where the output is 1, as a function of `vars`. */
  fn: BoolFunction
  /** First wiring found that gives it. */
  wiring: DecoderSolution
  /** How many wirings give it. */
  count: number
}

/** Variables the reachable-functions list takes: (n + 2)^(k + 1) wirings stay small. */
export const MAX_REACH_VARS = 5

/**
 * Every distinct function one decoder output can give with no gates, for the variables `vars`
 * (pins on uncomplemented variables and, by default, the constants). Answers "which of these can one decoder make" (AY23/24 S1 Q9).
 */
export function reachableFunctions(vars: string[], spec: DecoderSpec, opts: { constants?: boolean } = {}): { items: DecoderReach[]; why: Explain } {
  if (vars.length < 1 || vars.length > MAX_REACH_VARS || spec.k < 1 || spec.k > 4)
    return { items: [], why: { rule: `The list takes 1 to ${MAX_REACH_VARS} variables and a decoder with 1 to 4 selects.` } }
  const seen = new Map<bigint, DecoderReach>()
  const rowsN = 1 << vars.length
  const { tried } = eachWiring(spec, vars, opts.constants !== false, (m, sol) => {
    const hit = seen.get(m)
    if (hit) hit.count++
    else seen.set(m, { fn: fnFromRows('F', vars, range(rowsN).map((r) => ((m >> BigInt(r)) & 1n ? 1 : 0))), wiring: sol(), count: 1 })
  })
  const items = [...seen.values()].sort((a, b) => a.fn.on.length - b.fn.on.length || a.fn.on.join().localeCompare(b.fn.on.join()))
  return {
    items,
    why: {
      rule:
        spec.outputs === 'high'
          ? 'Each active-high output is the enable term ANDed with one literal per select, so every reachable function is a product (or 0).'
          : "Each active-low output is the complement of that product, so every reachable function is a sum (or 1).",
      working: `${tried} wirings x ${1 << spec.k} outputs give ${items.length} different functions`,
      cite: 'L18 p15-16, p20; AY23/24 S1 Q9',
    },
  }
}

/* ---------- Larger decoders from smaller ones (L18 p17-19; R09 p16-18) ---------- */

export interface TreeNode {
  id: number
  /** 0 = the decoder (or inverter stage) on the MSBs. */
  level: number
  kind: 'decoder' | 'inverter'
  /** Input bits it decodes, MSB first (e.g. ['w'] or ['A3', 'A2']). */
  inputs: string[]
  /** What drives its enable: 'E' (external or tied 1), w / w' (MSB direct or inverted), or another node's output. */
  enable: { from: 'external' } | { from: 'bit'; text: string } | { from: 'node'; id: number; output: number }
  /** Final output indices produced by a leaf decoder, in order. */
  outputs: number[]
  /** Select pins tied to 0 because the block is wider than the bits it decodes. */
  tiedLow: number
  /** Value of the higher bits that enables this node (0 for the top). */
  prefix: number
}

export interface DecoderTree {
  n: number
  k: number
  nodes: TreeNode[]
  decoders: number
  inverters: number
  /** Nodes on the active path for `code`, top first. */
  path: number[]
  code: number
  why: { count: Explain; path: Explain }
}

/** Build an n x 2^n decoder from k x 2^k decoders with enable: the LSBs go to every leaf, the MSBs pick the leaf. */
export function decoderTree(n: number, k: number, code = 0): Built<{ tree: DecoderTree }> {
  if (!Number.isInteger(k) || k < 1 || k > 4) return { ok: false, errors: [{ pin: 'k', message: 'the building block must be 1x2 to 4x16' }] }
  if (!Number.isInteger(n) || n <= k || n > 8) return { ok: false, errors: [{ pin: 'n', message: `the target must be larger than ${k}x${1 << k} and at most 8x256` }] }
  if (!Number.isInteger(code) || code < 0 || code >= 1 << n) return { ok: false, errors: [{ pin: 'code', message: `the code must be 0 to ${(1 << n) - 1}` }] }
  const bits = range(n).map((j) => `A${n - 1 - j}`)
  const nodes: TreeNode[] = []
  // Iterative: level 0 decodes the top h bits, each later level decodes k more.
  const h = n % k === 0 ? k : n % k
  let groups: { enable: TreeNode['enable']; prefix: number }[] = []
  if (h === 1 && n > 1) {
    const w = bits[0]
    nodes.push({ id: 0, level: 0, kind: 'inverter', inputs: [w], enable: { from: 'external' }, outputs: [], tiedLow: 0, prefix: 0 })
    groups = [
      { enable: { from: 'bit', text: `${w}'` }, prefix: 0 },
      { enable: { from: 'bit', text: w }, prefix: 1 },
    ]
  } else {
    nodes.push({ id: 0, level: 0, kind: 'decoder', inputs: bits.slice(0, h), enable: { from: 'external' }, outputs: [], tiedLow: k - h, prefix: 0 })
    groups = range(1 << h).map((o) => ({ enable: { from: 'node', id: 0, output: o }, prefix: o }))
  }
  let done = h
  let level = 1
  while (done < n) {
    const inputs = bits.slice(done, done + k)
    const leaf = done + k === n
    const next: typeof groups = []
    for (const g of groups) {
      const id = nodes.length
      nodes.push({
        id,
        level,
        kind: 'decoder',
        inputs,
        enable: g.enable,
        outputs: leaf ? range(1 << k).map((o) => (g.prefix << k) | o) : [],
        tiedLow: 0,
        prefix: g.prefix,
      })
      for (const o of range(1 << k)) next.push({ enable: { from: 'node', id, output: o }, prefix: (g.prefix << k) | o })
    }
    groups = next
    done += k
    level++
  }
  // Active path: at each level the node whose prefix matches the code's higher bits.
  const path = [0, ...nodes.filter((x) => x.level > 0 && x.prefix === code >> (n - h - (x.level - 1) * k)).map((x) => x.id)]
  const decoders = nodes.filter((x) => x.kind === 'decoder').length
  const inverters = nodes.length - decoders
  const exact = n % k === 0
  return {
    ok: true,
    tree: {
      n,
      k,
      nodes,
      decoders,
      inverters,
      path,
      code,
      why: {
        count: {
          rule:
            h === 1
              ? `The MSB drives the two enables directly and through an inverter, so no decoder is needed on top (L18 p17).`
              : exact
                ? `When k divides n, a ${n}x${1 << n} decoder needs (2^n - 1)/(2^k - 1) blocks: one per level node.`
                : `The top block decodes the ${h} leftover MSBs with ${k - h} select pin(s) tied to 0.`,
          working:
            exact && h !== 1 ? `(2^${n} - 1)/(2^${k} - 1) = ${decoders} decoders` : `${decoders} decoder${decoders === 1 ? '' : 's'} and ${inverters} inverter${inverters === 1 ? '' : 's'}`,
          cite: 'L18 p17-19; R09 p18',
        },
        path: {
          rule: 'The MSBs pick which small decoder is enabled; the LSBs pick the line inside it.',
          working: `code ${code.toString(2).padStart(n, '0')} enables ${path.map((p) => (nodes[p].kind === 'inverter' ? 'the inverter stage' : `decoder ${p}`)).join(' then ')}, output D${code}`,
          cite: 'L18 p17',
        },
      },
    },
  }
}
