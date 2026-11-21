import { compile, printExpr } from './expr'
import type { Expr } from './parse'
import type { BoolFunction, Explain } from './types'

export type NetGateType = 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR'

export interface NetGate {
  id: string
  type: NetGateType
  /** Signal labels: an input name, a constant, or another gate's output label. */
  inputs: string[]
  /** The sub-expression this gate computes (course notation). */
  output: string
  level: number
  arrival: number
  why: Explain
}

export interface NetworkOptions {
  /** Complemented inputs come free (default false: T06 p2). */
  complementsAvailable?: boolean
  /** Delay per gate type in units of t (default 1 for every gate, R08 p24). */
  delays?: Partial<Record<NetGateType, number>>
  /** Gate delay = fan-in times its base delay (AY17/18 Q1c(ii) NAND of fan-in n has delay n∙t). */
  fanInDelay?: boolean
}

export interface Network {
  gates: NetGate[]
  output: string
  counts: { gates: number; inverters: number; byType: Partial<Record<NetGateType, number>>; why: Explain }
  levels: { value: number; why: Explain }
  delay: { value: number; path: string[]; why: Explain }
}

const NEG: Partial<Record<Expr['kind'], NetGateType>> = { and: 'NAND', or: 'NOR', xor: 'XNOR', xnor: 'XOR' }
const POS: Partial<Record<Expr['kind'], NetGateType>> = { and: 'AND', or: 'OR', xor: 'XOR', xnor: 'XNOR' }

/**
 * The gate network an expression describes. A NOT over AND/OR/XOR/XNOR is one NAND/NOR/XNOR/XOR gate, and
 * identical sub-expressions share one gate (so the 4-NAND XOR of AY23/24 S2 Q12 has 4 gates, 3 levels).
 * An inverter on an input does not add a level (R07 p14); an inverter deeper in the circuit does.
 */
export function exprNetwork(e: Expr, opts: NetworkOptions = {}): Network {
  const gates: NetGate[] = []
  const time = new Map<string, number>()
  const level = new Map<string, number>()
  const from = new Map<string, string>()
  const inputs = new Set<string>()
  const delayOf = (t: NetGateType, fanIn: number) => (opts.delays?.[t] ?? 1) * (opts.fanInDelay ? fanIn : 1)

  const gate = (type: NetGateType, ins: string[], out: string): string => {
    if (time.has(out)) return out
    const latest = ins.reduce((b, i) => (time.get(i)! > time.get(b)! ? i : b), ins[0])
    const d = delayOf(type, ins.length)
    const arrival = time.get(latest)! + d
    const onInput = type === 'NOT' && inputs.has(ins[0])
    const lv = Math.max(...ins.map((i) => level.get(i)!)) + (onInput ? 0 : 1)
    time.set(out, arrival)
    level.set(out, lv)
    from.set(out, latest)
    gates.push({
      id: `g${gates.length + 1}`,
      type,
      inputs: ins,
      output: out,
      level: lv,
      arrival,
      why: {
        rule: 'A gate output is stable at the latest input time plus the gate delay.',
        working: `max(${ins.map((i) => `${time.get(i)}t`).join(', ')}) + ${d}t = ${arrival}t`,
        cite: 'L17 p34; R08 p24',
      },
    })
    return out
  }
  const source = (name: string): string => {
    if (!time.has(name)) {
      time.set(name, 0)
      level.set(name, 0)
      inputs.add(name)
    }
    return name
  }
  const build = (x: Expr): string => {
    const label = printExpr(x)
    if (x.kind === 'const' || x.kind === 'var') return source(label)
    if (x.kind === 'not') {
      const a = x.arg
      if (a.kind === 'var' && opts.complementsAvailable) return source(label)
      const neg = NEG[a.kind]
      if (neg && a.kind !== 'not' && a.kind !== 'var' && a.kind !== 'const') return gate(neg, a.args.map(build), label)
      return gate('NOT', [build(a)], label)
    }
    return gate(POS[x.kind]!, x.args.map(build), label)
  }
  const output = build(e)

  const byType: Partial<Record<NetGateType, number>> = {}
  for (const g of gates) byType[g.type] = (byType[g.type] ?? 0) + 1
  const inverters = byType.NOT ?? 0
  const path: string[] = []
  for (let s: string | undefined = output; s !== undefined; s = from.get(s)) path.unshift(s)
  const lv = level.get(output)!
  const delay = time.get(output)!
  const tally = Object.entries(byType).map(([t, c]) => `${c} ${t}`).join(' + ')
  return {
    gates,
    output,
    counts: {
      gates: gates.length,
      inverters,
      byType,
      why: {
        rule: 'Count every gate, inverters included; a sub-expression used twice is one gate with two wires out.',
        working: gates.length ? `${tally} = ${gates.length}` : 'no gates: the output is a wire or a constant',
        cite: 'R07 p14; L14 p7-8',
      },
    },
    levels: {
      value: lv,
      why: {
        rule: 'Levels are gates on the longest path from an input. An inverter on an input is not a level.',
        working: `${lv} level${lv === 1 ? '' : 's'}`,
        cite: 'R07 p14',
      },
    },
    delay: {
      value: delay,
      path,
      why: {
        rule: `Output time = max(input times) + gate delay, along the slowest path; inputs arrive at 0.${opts.fanInDelay ? ' Each gate takes fan-in times its delay.' : ''}`,
        working: path.length > 1 ? path.map((s) => `${s} (${time.get(s)}t)`).join(' to ') : 'no gates on the path',
        cite: opts.fanInDelay ? 'L17 p34; AY17/18 Q1c(ii)' : 'L17 p34; R08 p24-28; AY23/24 S2 Q13',
      },
    },
  }
}

/* ---------- Single-gate detector (AY23/24 S2 Q12, AY23/24 S1 Q6) ---------- */

export type Gate2 = 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR'
const GATE2: Record<Gate2, (a: number, b: number) => number> = {
  AND: (a, b) => a & b,
  OR: (a, b) => a | b,
  NAND: (a, b) => 1 - (a & b),
  NOR: (a, b) => 1 - (a | b),
  XOR: (a, b) => a ^ b,
  XNOR: (a, b) => 1 - (a ^ b),
}
const GATE2_TEXT: Record<Gate2, (a: string, b: string) => string> = {
  AND: (a, b) => `${a}∙${b}`,
  OR: (a, b) => `${a} + ${b}`,
  NAND: (a, b) => `(${a}∙${b})'`,
  NOR: (a, b) => `(${a} + ${b})'`,
  XOR: (a, b) => `${a} ⊕ ${b}`,
  XNOR: (a, b) => `${a} ⊙ ${b}`,
}

export interface SingleGate {
  gate: Gate2 | 'NOT' | 'WIRE' | 'CONST'
  inputs: string[]
  text: string
}

/** Every single 2-input gate, inverter, wire or constant that equals the function on its care rows. */
export function singleGates(fn: BoolFunction): { matches: SingleGate[]; why: Explain } {
  const n = fn.vars.length
  const on = new Set(fn.on)
  const dc = new Set(fn.dc)
  const rows = Array.from({ length: 1 << n }, (_, r) => r).filter((r) => !dc.has(r))
  const bit = (r: number, i: number) => (r >> (n - 1 - i)) & 1
  const fits = (g: (r: number) => number) => rows.every((r) => g(r) === (on.has(r) ? 1 : 0))
  const matches: SingleGate[] = []
  for (const c of [0, 1]) if (fits(() => c)) matches.push({ gate: 'CONST', inputs: [], text: String(c) })
  fn.vars.forEach((v, i) => {
    if (fits((r) => bit(r, i))) matches.push({ gate: 'WIRE', inputs: [v], text: v })
    if (fits((r) => 1 - bit(r, i))) matches.push({ gate: 'NOT', inputs: [v], text: `${v}'` })
  })
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (const g of Object.keys(GATE2) as Gate2[])
        if (fits((r) => GATE2[g](bit(r, i), bit(r, j)))) matches.push({ gate: g, inputs: [fn.vars[i], fn.vars[j]], text: GATE2_TEXT[g](fn.vars[i], fn.vars[j]) })
  return {
    matches,
    why: {
      rule: 'Compare the truth table with every single gate on every pair of inputs.',
      working: matches.length ? matches.map((m) => `${m.gate === 'CONST' || m.gate === 'WIRE' ? '' : `${m.gate}: `}${m.text}`).join('; ') : 'no single gate matches',
      cite: 'L14 p3-6; AY23/24 S2 Q12',
    },
  }
}

/** Expression version: the single gates equal to `e` over `vars`. */
export function singleGatesOf(e: Expr, vars: string[]): { matches: SingleGate[]; why: Explain } {
  const f = compile(e, vars)
  return singleGates({ name: 'F', vars, on: Array.from({ length: 1 << vars.length }, (_, r) => r).filter((r) => f(r)), dc: [] })
}

/* ---------- Complete sets and inverters (L14 p10-12; AY24/25 Q1-Q2) ---------- */

export type SetGate = Gate2 | 'NOT'

// 2-variable truth tables as 4-bit masks, bit r = value on row r (a is the MSB).
const A = 0b1100
const B = 0b1010
const NAND_AB = 0b0111
const MASK_OP: Record<Gate2, (x: number, y: number) => number> = {
  AND: (x, y) => x & y,
  OR: (x, y) => x | y,
  NAND: (x, y) => ~(x & y) & 15,
  NOR: (x, y) => ~(x | y) & 15,
  XOR: (x, y) => x ^ y,
  XNOR: (x, y) => ~(x ^ y) & 15,
}

export interface CompleteSet {
  complete: boolean
  /** How NOT a and a AND b are built (gate notation), when they can be. */
  not?: string
  and?: string
  /** NAND a,b from the set: building it proves completeness ({NAND} is complete, L14 p10). */
  nand?: string
  why: Explain
}

/**
 * Is a set of gates complete? Build every 2-input function of a, b reachable from the set (with the constants
 * 0 and 1 when allowed, T06 p2). The set is complete exactly when NAND(a,b) is reachable.
 */
export function completeSet(set: SetGate[], opts: { constants?: boolean } = {}): CompleteSet {
  const constants = opts.constants ?? true
  const made = new Map<number, string>([
    [A, 'a'],
    [B, 'b'],
  ])
  if (constants) {
    made.set(0, '0')
    made.set(15, '1')
  }
  for (let grew = true; grew; ) {
    grew = false
    const have = [...made]
    for (const g of set) {
      const add = (m: number, text: string) => {
        if (!made.has(m)) {
          made.set(m, text)
          grew = true
        }
      }
      if (g === 'NOT') for (const [x, tx] of have) add(~x & 15, `NOT(${tx})`)
      else for (const [x, tx] of have) for (const [y, ty] of have) add(MASK_OP[g](x, y), `${g}(${tx}, ${ty})`)
    }
  }
  const not = made.get(~A & 15)
  const and = made.get(A & B)
  const nand = made.get(NAND_AB)
  const name = `{${set.join(', ')}}`
  return {
    complete: nand !== undefined,
    not,
    and,
    nand,
    why: {
      rule: `A set is complete if it can build NOT and AND (or simply NAND), which build everything.${constants ? ' The constants 0 and 1 are available.' : ' Constants are not available here.'}`,
      working:
        nand !== undefined
          ? `${name}: a' = ${not}; a∙b = ${and}`
          : `${name} cannot build ${not === undefined ? 'NOT' : 'AND'} from a, b${constants ? ', 0 and 1' : ''}`,
      cite: 'L14 p10-12; T06 p2; AY24/25 Q2',
    },
  }
}

/** Ways a 2-input gate acts as an inverter: tied inputs, or one input fixed to 0 or 1 (AY24/25 Q1). */
export function inverterUses(g: Gate2): { ways: string[]; why: Explain } {
  const ways: string[] = []
  const notA = ~A & 15
  if (MASK_OP[g](A, A) === notA) ways.push(`${g}(a, a)`)
  if (MASK_OP[g](A, 0) === notA) ways.push(`${g}(a, 0)`)
  if (MASK_OP[g](A, 15) === notA) ways.push(`${g}(a, 1)`)
  return {
    ways,
    why: {
      rule: 'A 2-input gate is an inverter if tying its inputs together, or fixing one input to 0 or 1, gives a\'.',
      working: ways.length ? ways.join(', ') : `${g} gives a or a constant in every case, never a'`,
      cite: 'L14 p11-12; AY24/25 Q1',
    },
  }
}
