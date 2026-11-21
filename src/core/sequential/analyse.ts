/** Analysis: flip-flop input equations -> state table, compact table, state diagram, checks (L19 p28-43). */
import { compile, parseExpr, printExpr, varsOf, type Expr } from '../boolean'
import { ffNext } from './flipflops'
import { bin, buildGraph, comboText, selfCorrection, sinksOf, type SelfCorrection, type StateGraph } from './machine'
import { FF_INPUTS } from './types'
import type { Bit, CircuitSpec, Explain, FFType, Issue, Machine, Result, Sig } from './types'

export interface FFInputValue {
  /** e.g. 'JA'. */
  label: string
  ff: string
  letter: string
  value: Bit
  why: Explain
}

export interface AnalysisRow {
  /** Row number: binary value of (state bits, inputs), MSB first (L19 p30). */
  index: number
  state: number
  combo: number
  present: Bit[]
  inputs: Bit[]
  ffInputs: FFInputValue[]
  next: Sig[]
  /** Null when an S-R flip-flop gets S = R = 1 (unpredictable). */
  nextState: number | null
  nextWhy: Explain[]
  outputs: { name: string; value: Bit; why: Explain }[]
}

export interface CompactCell {
  next: number | null
  out: Sig[]
  /** As written in the compact table, e.g. '01 / 1'. */
  text: string
}

export interface CompactRow {
  state: number
  label: string
  binary: string
  cells: CompactCell[]
}

export interface Equation {
  label: string
  text: string
  fitb: string
}

export interface AnalysisFrame {
  /** Row of the full table this step fills. */
  row: number
  title: string
  why: Explain
}

export interface Analysis {
  circuit: CircuitSpec
  /** Variables of every equation: state bits then inputs, MSB first. */
  vars: string[]
  bits: string[]
  inputs: string[]
  outputs: string[]
  equations: Equation[]
  rows: AnalysisRow[]
  compact: CompactRow[]
  /** Column headers of the compact table: one per input combination, e.g. 'x=0'. */
  columns: string[]
  machine: Machine
  graph: StateGraph
  sinks: number[]
  selfCorrection: SelfCorrection
  /** Warnings such as S = R = 1 rows. */
  warnings: Issue[]
  frames: AnalysisFrame[]
  why: { rows: Explain; compact: Explain }
}

interface Compiled {
  ffs: { name: string; type: FFType; letters: string[]; exprs: Expr[]; fns: ((r: number) => Bit)[] }[]
  outs: { name: string; expr: Expr; fn: (r: number) => Bit }[]
}

function compileCircuit(c: CircuitSpec, vars: string[]): Result<{ compiled: Compiled }> {
  const errors: Issue[] = []
  const parse = (label: string, text: string): Expr | null => {
    const p = parseExpr(text)
    if (!p.ok) {
      errors.push(...p.errors.map((e) => ({ ...e, message: `${label}: ${e.message}` })))
      return null
    }
    const unknown = varsOf(p.expr).filter((v) => !vars.includes(v))
    if (unknown.length) errors.push({ code: 'var', message: `${label}: unknown variable ${unknown.join(', ')}`, at: [0, 0] })
    return unknown.length ? null : p.expr
  }
  const ffs: Compiled['ffs'] = []
  for (const f of c.flipFlops) {
    const letters = FF_INPUTS[f.type]
    const exprs = letters.map((l) => {
      if (f.inputs[l] === undefined) {
        errors.push({ code: 'missing', message: `${l}${f.name} is missing`, at: [0, 0] })
        return null
      }
      return parse(l + f.name, f.inputs[l])
    })
    if (exprs.every((e): e is Expr => e !== null)) ffs.push({ name: f.name, type: f.type, letters, exprs, fns: exprs.map((e) => compile(e, vars)) })
  }
  const outs: Compiled['outs'] = []
  for (const o of c.outputs ?? []) {
    const e = parse(o.name, o.expr)
    if (e) outs.push({ name: o.name, expr: e, fn: compile(e, vars) })
  }
  if (new Set(vars).size !== vars.length) errors.push({ code: 'names', message: 'state bits and inputs need distinct names', at: [0, 0] })
  if (vars.length > 10) errors.push({ code: 'size', message: 'at most 10 state bits and inputs together (1024 rows)', at: [0, 0] })
  return errors.length ? { ok: false, errors } : { ok: true, compiled: { ffs, outs } }
}

/** Print an expression with every variable replaced by its value in this row, e.g. B∙x' -> 1∙0'. */
function substitute(e: Expr, vals: Record<string, Bit>): string {
  const go = (x: Expr): Expr => {
    switch (x.kind) {
      case 'var':
        return { kind: 'const', value: vals[x.name], span: x.span }
      case 'const':
        return x
      case 'not':
        return { ...x, arg: go(x.arg) }
      case 'xor':
      case 'xnor':
        return { ...x, args: [go(x.args[0]), go(x.args[1])] }
      default:
        return { ...x, args: x.args.map(go) }
    }
  }
  return printExpr(go(e))
}

const evalWhy = (label: string, e: Expr, vals: Record<string, Bit>, value: Bit): Explain => {
  const text = printExpr(e)
  const sub = substitute(e, vals)
  return {
    rule: 'Evaluate the equation with this row\'s present state and input values.',
    working: text === sub ? `${label} = ${text}` : `${label} = ${text} = ${sub} = ${value}`,
    cite: 'L19 p36-37',
  }
}

/** Analyse a circuit: the full state table with 2^(m+n) rows, the compact table, the state diagram and checks. */
export function analyse(c: CircuitSpec): Result<{ analysis: Analysis }> {
  const bits = c.flipFlops.map((f) => f.name)
  const inputs = c.inputs
  const vars = [...bits, ...inputs]
  const comp = compileCircuit(c, vars)
  if (!comp.ok) return comp
  const { ffs, outs } = comp.compiled
  const m = bits.length
  const n = inputs.length
  const warnings: Issue[] = []
  const rows: AnalysisRow[] = []
  for (let index = 0; index < 1 << (m + n); index++) {
    const all = vars.map((_, i) => ((index >> (m + n - 1 - i)) & 1) as Bit)
    const vals = Object.fromEntries(vars.map((v, i) => [v, all[i]])) as Record<string, Bit>
    const present = all.slice(0, m)
    const ffInputs: FFInputValue[] = []
    const next: Sig[] = []
    const nextWhy: Explain[] = []
    ffs.forEach((f, i) => {
      const values = f.fns.map((fn) => fn(index))
      f.letters.forEach((l, k) => ffInputs.push({ label: l + f.name, ff: f.name, letter: l, value: values[k], why: evalWhy(l + f.name, f.exprs[k], vals, values[k]) }))
      const step = ffNext(f.type, values, present[i], f.name)
      next.push(step.next)
      nextWhy.push(step.why)
    })
    const nextState = next.includes('X') ? null : next.reduce<number>((s, b) => (s << 1) | (b as number), 0)
    if (nextState === null)
      warnings.push({ code: 'sr-invalid', message: `row ${bin(index, m + n)}: S = R = 1 on an S-R flip-flop, so the next state is unpredictable`, at: [0, 0], cite: 'L19 p18' })
    rows.push({
      index,
      state: index >> n,
      combo: index & ((1 << n) - 1),
      present,
      inputs: all.slice(m),
      ffInputs,
      next,
      nextState,
      nextWhy,
      outputs: outs.map((o) => {
        const value = o.fn(index)
        return { name: o.name, value, why: evalWhy(o.name, o.expr, vals, value) }
      }),
    })
  }
  const count = 1 << m
  const machine: Machine = {
    bits,
    inputs,
    outputs: outs.map((o) => o.name),
    labels: Array.from({ length: count }, (_, s) => String(s)),
    next: Array.from({ length: count }, (_, s) => rows.slice(s << n, (s + 1) << n).map((r) => r.nextState)),
    out: Array.from({ length: count }, (_, s) => rows.slice(s << n, (s + 1) << n).map((r) => r.outputs.map((o) => o.value))),
    used: c.used ? [...c.used].sort((a, b) => a - b) : Array.from({ length: count }, (_, s) => s),
  }
  const columns = n ? Array.from({ length: 1 << n }, (_, k) => `${inputs.join('')}=${bin(k, n)}`) : ['next']
  const compact: CompactRow[] = machine.next.map((row, s) => ({
    state: s,
    label: String(s),
    binary: bin(s, m),
    cells: row.map((nx, k) => {
      const out = machine.out[s][k]
      return { next: nx, out, text: `${nx === null ? '?' : bin(nx, m)}${out.length ? ` / ${out.join('')}` : ''}` }
    }),
  }))
  const equations: Equation[] = [
    ...ffs.flatMap((f) => f.letters.map((l, k) => ({ label: l + f.name, text: printExpr(f.exprs[k]), fitb: printExpr(f.exprs[k], 'fitb') }))),
    ...outs.map((o) => ({ label: o.name, text: printExpr(o.expr), fitb: printExpr(o.expr, 'fitb') })),
  ]
  const frames: AnalysisFrame[] = rows.map((r) => ({
    row: r.index,
    title: `Row ${bin(r.index, m + n)}: state ${r.state}${n ? `, ${inputs.join('')} = ${comboText(machine, r.combo)}` : ''}`,
    why: {
      rule: 'Evaluate each flip-flop input, then apply that flip-flop\'s characteristic table to get the next state.',
      working: `${r.ffInputs.map((f) => `${f.label} = ${f.value}`).join(', ')}; ${r.nextWhy.map((w) => w.working).join('; ')}; next state ${r.nextState === null ? 'unpredictable' : `${bin(r.nextState, m)} (${r.nextState})`}${r.outputs.length ? `; ${r.outputs.map((o) => `${o.name} = ${o.value}`).join(', ')}` : ''}`,
      cite: 'L19 p36-43',
    },
  }))
  return {
    ok: true,
    analysis: {
      circuit: c,
      vars,
      bits,
      inputs,
      outputs: machine.outputs,
      equations,
      rows,
      compact,
      columns,
      machine,
      graph: buildGraph(machine),
      sinks: sinksOf(machine),
      selfCorrection: selfCorrection(machine),
      warnings,
      frames,
      why: {
        rows: {
          rule: 'A state table for m flip-flops and n inputs has 2^(m+n) rows, in binary order of present state then inputs.',
          working: `${m} flip-flop${m === 1 ? '' : 's'} and ${n} input${n === 1 ? '' : 's'}: 2^${m + n} = ${rows.length} rows`,
          cite: 'L19 p30',
        },
        compact: {
          rule: 'The compact table has one row per present state and one column per input value.',
          working: `${count} rows, ${columns.length} column${columns.length === 1 ? '' : 's'}`,
          cite: 'L19 p32',
        },
      },
    },
  }
}
