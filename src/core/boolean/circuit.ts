import { coverText, literalsOf, termText, type Literal } from './cube'
import type { Cube, Explain, Form } from './types'

export type CircuitKind = 'and-or' | 'nand-nand' | 'or-and' | 'nor-nor'
export type GateType = 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR'

export interface Gate {
  id: string
  type: GateType
  inputs: string[]
  output: string
  /** Inverters count as gates but not as a level (R07 p14). */
  inverter: boolean
  /** In a NAND-only or NOR-only circuit an inverter is that gate with its inputs tied. */
  realisedAs?: 'NAND' | 'NOR'
  level: number
  /** Time the output is stable, in units of t. */
  arrival: number
  why: Explain
}

export interface CircuitOptions {
  /** Complemented literals come free (default false: T06 p2). Flip-flop Q' outputs are one such case. */
  complementsAvailable?: boolean
  /** Delay of each AND/OR/NAND/NOR gate (default 1, i.e. t). */
  gateDelay?: number
  /** Delay of an inverter. No source says; default equals gateDelay (every gate has delay t, R08 p24). */
  inverterDelay?: number
  /** Output name (default F). */
  name?: string
}

export interface TwoLevelCircuit {
  kind: CircuitKind
  form: Form
  /** The expression this circuit computes, in the gate style used (e.g. NAND form). */
  expression: string
  inputs: string[]
  gates: Gate[]
  /** Signal that drives the output, or a constant/input name when no gate is needed. */
  output: string
  constant?: 0 | 1
  counts: { gates: number; inverters: number; byType: Partial<Record<GateType, number>>; why: Explain }
  levels: { value: number; why: Explain }
  delay: { value: number; path: string[]; why: Explain }
}

const KIND: Record<CircuitKind, { form: Form; first: GateType; second: GateType; universal?: 'NAND' | 'NOR'; cite: string }> = {
  'and-or': { form: 'sop', first: 'AND', second: 'OR', cite: 'L14 p13' },
  'nand-nand': { form: 'sop', first: 'NAND', second: 'NAND', universal: 'NAND', cite: 'L14 p14' },
  'or-and': { form: 'pos', first: 'OR', second: 'AND', cite: 'L14 p15' },
  'nor-nor': { form: 'pos', first: 'NOR', second: 'NOR', universal: 'NOR', cite: 'L14 p16' },
}

/**
 * Build a 2-level circuit from SOP terms (and-or, nand-nand) or POS groups of 0s (or-and, nor-nor), as returned
 * by `minimize(fn, form).covers`. A lone-literal term enters a NAND/NOR output gate complemented (L14 p14, p16).
 */
export function twoLevelCircuit(terms: Cube[], vars: string[], kind: CircuitKind, opts: CircuitOptions = {}): TwoLevelCircuit {
  const k = KIND[kind]
  const { form, first, second, universal } = k
  const gateDelay = opts.gateDelay ?? 1
  const invDelay = opts.inverterDelay ?? gateDelay
  const name = opts.name ?? 'F'
  const gates: Gate[] = []
  const time = new Map<string, number>(vars.map((v) => [v, 0]))
  const level = new Map<string, number>(vars.map((v) => [v, 0]))
  const from = new Map<string, string>()
  const AND = '∙'

  const gate = (type: GateType, inputs: string[], output: string, inverter = false) => {
    const latest = inputs.reduce((b, i) => (time.get(i)! > time.get(b)! ? i : b), inputs[0])
    const d = inverter ? invDelay : gateDelay
    const arrival = time.get(latest)! + d
    time.set(output, arrival)
    level.set(output, Math.max(...inputs.map((i) => level.get(i)!)) + (inverter ? 0 : 1))
    from.set(output, latest)
    gates.push({
      id: `g${gates.length + 1}`,
      type,
      inputs,
      output,
      inverter,
      realisedAs: inverter ? universal : undefined,
      level: level.get(output)!,
      arrival,
      why: {
        rule: 'A gate output is stable at the latest input time plus the gate delay.',
        working: `max(${inputs.map((i) => time.get(i)).join(', ')}) + ${d} = ${arrival}t`,
        cite: 'L17 p34; R08 p24',
      },
    })
    return output
  }
  const lit = (l: Literal): string => {
    if (!l.neg) return l.v
    const s = `${l.v}'`
    if (!time.has(s)) {
      if (opts.complementsAvailable) {
        time.set(s, 0)
        level.set(s, 0)
      } else gate('NOT', [l.v], s, true)
    }
    return s
  }

  let output: string
  let constant: 0 | 1 | undefined
  let expression: string
  const plain = coverText(terms, vars, form)
  const lits = terms.map((t) => literalsOf(t, vars, form))
  if (!terms.length || lits.some((l) => l.length === 0)) {
    constant = (form === 'sop') === (terms.length > 0) ? 1 : 0
    output = String(constant)
    expression = String(constant)
  } else if (terms.length === 1 && lits[0].length === 1) {
    output = lit(lits[0][0])
    expression = plain
  } else if (terms.length === 1) {
    const g = gate(first, lits[0].map(lit), universal ? `(${termText(terms[0], vars, form)})'` : name)
    output = universal ? gate('NOT', [g], name, true) : g
    expression = universal ? `((${termText(terms[0], vars, form)})')'` : plain
  } else {
    const ins = terms.map((t, i) => {
      if (lits[i].length > 1) {
        const text = termText(t, vars, form)
        return gate(first, lits[i].map(lit), universal ? `(${text})'` : form === 'pos' ? `(${text})` : text)
      }
      const l = lits[i][0]
      return lit(universal ? { v: l.v, neg: !l.neg } : l)
    })
    output = gate(second, ins, name)
    expression = universal ? `(${ins.join(universal === 'NAND' ? AND : ' + ')})'` : plain
  }

  const byType: Partial<Record<GateType, number>> = {}
  for (const g of gates) byType[g.type] = (byType[g.type] ?? 0) + 1
  const inverters = gates.filter((g) => g.inverter).length
  const levels = level.get(output) ?? 0
  const path: string[] = []
  for (let s: string | undefined = output; s !== undefined; s = from.get(s)) path.unshift(s)
  const delay = time.get(output) ?? 0
  const tally = Object.entries(byType)
    .map(([t, c]) => `${c} ${t}`)
    .join(' + ')

  return {
    kind,
    form,
    expression,
    inputs: vars,
    gates,
    output,
    constant,
    counts: {
      gates: gates.length,
      inverters,
      byType,
      why: {
        rule: `Count every gate. Inverters are gates too${opts.complementsAvailable ? '' : ', and complemented inputs are not available unless stated'}.`,
        working: gates.length ? `${tally} = ${gates.length} gate${gates.length === 1 ? '' : 's'}` : 'no gates: the output is a wire or a constant',
        cite: opts.complementsAvailable ? 'R07 p14' : 'R07 p14; T06 p2',
      },
    },
    levels: {
      value: levels,
      why: {
        rule: 'An inverter is not a level (it turns a literal into a literal), so this is a 2-level circuit at most.',
        working: `${levels} level${levels === 1 ? '' : 's'}`,
        cite: `R07 p14; ${k.cite}`,
      },
    },
    delay: {
      value: delay,
      path,
      why: {
        rule: `Output time = max(input times) + gate delay along the slowest path; inputs arrive at 0. Gate delay ${gateDelay}t, inverter delay ${invDelay}t (no source fixes the inverter delay).`,
        working: path.length > 1 ? path.map((s) => `${s} (${time.get(s)}t)`).join(' to ') : 'no gates on the path',
        cite: 'L17 p34; R08 p24',
      },
    },
  }
}
