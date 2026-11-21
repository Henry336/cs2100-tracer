/** Gate counts for flip-flop input equations, with each flip-flop's Q' output free (AY23/24 S1 Q18b). */
import { exprNetwork, type Expr, type NetGate } from '../boolean'
import type { Explain } from './types'

/** Replace A' (A a state bit) with a plain input named A', since Q' comes from the flip-flop. */
function freeComplements(e: Expr, bits: string[]): Expr {
  switch (e.kind) {
    case 'not':
      return e.arg.kind === 'var' && bits.includes(e.arg.name) ? { kind: 'var', name: `${e.arg.name}'`, span: e.span } : { ...e, arg: freeComplements(e.arg, bits) }
    case 'and':
    case 'or':
      return { ...e, args: e.args.map((a) => freeComplements(a, bits)) }
    case 'xor':
    case 'xnor':
      return { ...e, args: [freeComplements(e.args[0], bits), freeComplements(e.args[1], bits)] }
    default:
      return e
  }
}

export interface GateCount {
  gates: number
  /** The gates, e.g. 'AND: B\'∙x'. */
  list: string[]
  why: Explain
}

const show = (g: NetGate) => `${g.type}: ${g.output}`

/** Gates needed for one expression: state-bit complements are free, complemented inputs need an inverter. */
export function gateCount(e: Expr, bits: string[]): GateCount {
  const net = exprNetwork(freeComplements(e, bits))
  const list = net.gates.map(show)
  return {
    gates: list.length,
    list,
    why: {
      rule: "Count every gate. A complemented state bit costs nothing because each flip-flop also gives Q'; here a complemented external input needs an inverter (the AY23/24 S2 Q20e key does not count that inverter).",
      working: list.length ? `${list.join('; ')} = ${list.length} gate${list.length === 1 ? '' : 's'}` : 'no gates: a wire, a constant or a free Q\'',
      cite: 'AY23/24 S1 Q18b',
    },
  }
}

/** Total gates over several expressions; a gate computing the same thing twice is built once. */
export function totalGates(exprs: Expr[], bits: string[]): GateCount {
  const seen = new Set<string>()
  for (const e of exprs) for (const g of exprNetwork(freeComplements(e, bits)).gates) seen.add(show(g))
  const list = [...seen]
  return {
    gates: list.length,
    list,
    why: {
      rule: "Add up the gates of every equation, with Q' free; one gate can feed several equations.",
      working: list.length ? `${list.join('; ')} = ${list.length} gate${list.length === 1 ? '' : 's'}` : 'no gates',
      cite: 'AY23/24 S1 Q18b; AY24/25 Q16c; T09 Q2',
    },
  }
}
