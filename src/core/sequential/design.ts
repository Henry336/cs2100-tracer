/** Design: state table + flip-flop types -> excitation table, K-maps, equations, gates, unused states (L19 p44-58). */
import {
  checkEquivalence,
  compile,
  functionFromValues,
  minimize,
  parseExpr,
  printExpr,
  singleGates,
  traceKMap,
  MAX_MIN_VARS,
  type BoolFunction,
  type CellValue,
  type Expr,
  type KMapTrace,
  type Minimization,
  type Orientation,
} from '../boolean'
import { analyse, type Analysis } from './analyse'
import { gateCount, totalGates, type GateCount } from './cost'
import { excite } from './flipflops'
import { bin } from './machine'
import type { TableRow } from './parse'
import { FF_INPUTS } from './types'
import type { Bit, CircuitSpec, Explain, FFType, Issue, Result, Sig } from './types'

export interface DesignSpec {
  /** State bit names, MSB first (A, B, ...). */
  bits: string[]
  /** External inputs, MSB first. */
  inputs: string[]
  outputs?: string[]
  /** One row per used state; states with no row are unused and become don't-cares (L19 p55-57). */
  rows: TableRow[]
  /** Flip-flop type per state bit; mixing is allowed (T09 Q3). */
  types: FFType[]
  /**
   * 'sop' (default) commits each equation to its first minimal SOP. 'fewest-gates' takes a single gate
   * instead when one fits and costs less (T09 Q2: KA = 1, JA = B ⊕ x).
   */
  prefer?: 'sop' | 'fewest-gates'
  /** Your own equations to check and commit instead, e.g. { JA: 'B ⊕ x' }. */
  overrides?: Record<string, string>
  /** K-map layout; the course draws AB on the rows and Cx on the columns (L19 p50, p56). */
  orientation?: Orientation
}

export interface DesignCell {
  /** e.g. 'JA', or an output name. */
  label: string
  value: Sig
  why: Explain
}

export interface DesignRow {
  index: number
  state: number
  combo: number
  present: Bit[]
  inputs: Bit[]
  /** False for an unused state or an input combination the table leaves open. */
  specified: boolean
  next: Sig[]
  nextState: number | null
  ffInputs: DesignCell[]
  outputs: DesignCell[]
}

export interface DesignFunction {
  label: string
  /** Flip-flop name, or null for an output. */
  ff: string | null
  letter: string | null
  fn: BoolFunction
  min: Minimization
  /** K-map steps (2 to 5 variables), else null. */
  kmap: KMapTrace | null
  /** Every minimal SOP (up to the minimiser's limit). */
  sop: string[]
  chosen: { text: string; fitb: string; source: 'sop' | 'single-gate' | 'yours'; why: Explain }
  /** Your equation was checked against every specified row. */
  check?: { ok: boolean; differing: number[]; why: Explain }
  gates: GateCount
  /** What each don't-care became once the equation was chosen: d(1) or d(0) (T09 Ans p3). */
  committed: { cell: number; value: Bit }[]
}

export interface UnusedTransition {
  state: number
  combo: number
  next: number | null
  out: Sig[]
  why: Explain
}

export type DesignPhase = 'excite' | 'kmap' | 'commit' | 'unused' | 'verdict'

export interface DesignFrame {
  phase: DesignPhase
  title: string
  /** Row of the excitation table (phase 'excite'). */
  row?: number
  /** Index into `functions` (phase 'kmap', 'commit'). */
  fn?: number
  why: Explain
}

export interface Design {
  spec: DesignSpec
  vars: string[]
  used: number[]
  unused: number[]
  rows: DesignRow[]
  functions: DesignFunction[]
  total: GateCount
  /** The circuit built from the chosen equations, analysed again (actual behaviour of unused states). */
  circuit: CircuitSpec
  analysis: Analysis
  unusedTransitions: UnusedTransition[]
  /** Every specified transition and output is reproduced by the chosen equations. */
  verified: boolean
  mismatches: string[]
  warnings: Issue[]
  frames: DesignFrame[]
}

const toCell = (v: Sig): CellValue => v

export function design(spec: DesignSpec): Result<{ design: Design }> {
  const errors: Issue[] = []
  const { bits, inputs, types } = spec
  const outputs = spec.outputs ?? []
  const m = bits.length
  const n = inputs.length
  const vars = [...bits, ...inputs]
  const count = 1 << m
  const combos = 1 << n
  const err = (message: string) => errors.push({ code: 'design', message, at: [0, 0] })
  if (!m) err('give at least one state bit')
  if (types.length !== m) err(`give one flip-flop type per state bit (${m} bits, ${types.length} types)`)
  if (new Set([...vars, ...outputs]).size !== vars.length + outputs.length) err('state bits, inputs and outputs need distinct names')
  if (m + n > MAX_MIN_VARS) err(`at most ${MAX_MIN_VARS} state bits and inputs together`)
  const table = new Map<number, TableRow>()
  for (const r of spec.rows) {
    if (!Number.isInteger(r.state) || r.state < 0 || r.state >= count) err(`state ${r.state} does not fit in ${m} bit${m === 1 ? '' : 's'}`)
    else if (table.has(r.state)) err(`state ${r.state} has two rows`)
    if (r.next.length !== combos) err(`state ${r.state}: give ${combos} next state${combos === 1 ? '' : 's'}, one per input combination`)
    for (const nx of r.next) if (nx !== null && (!Number.isInteger(nx) || nx < 0 || nx >= count)) err(`state ${r.state}: next state ${nx} does not fit in ${m} bits`)
    if (outputs.length && r.out && (r.out.length !== combos || r.out.some((o) => o.length !== outputs.length))) err(`state ${r.state}: give ${outputs.length} output value${outputs.length === 1 ? '' : 's'} per input combination`)
    table.set(r.state, r)
  }
  if (errors.length) return { ok: false, errors }

  const used = [...table.keys()].sort((a, b) => a - b)
  const unused = Array.from({ length: count }, (_, s) => s).filter((s) => !table.has(s))
  const labels = bits.flatMap((b, i) => FF_INPUTS[types[i]].map((l) => l + b))

  /* Excitation table, one row per (state, input). */
  const rows: DesignRow[] = []
  for (let index = 0; index < 1 << (m + n); index++) {
    const state = index >> n
    const combo = index & (combos - 1)
    const present = bits.map((_, i) => ((state >> (m - 1 - i)) & 1) as Bit)
    const ins = inputs.map((_, i) => ((combo >> (n - 1 - i)) & 1) as Bit)
    const row = table.get(state)
    const nx = row ? row.next[combo] : null
    const specified = nx !== null
    const next: Sig[] = specified ? bits.map((_, i) => ((nx! >> (m - 1 - i)) & 1) as Bit) : bits.map(() => 'X')
    const ffInputs: DesignCell[] = []
    bits.forEach((b, i) => {
      const letters = FF_INPUTS[types[i]]
      if (!specified) {
        const reason = row ? `the table leaves ${inputs.join('')} = ${bin(combo, n)} open` : `state ${state} is unused`
        for (const l of letters) ffInputs.push({ label: l + b, value: 'X', why: { rule: 'Unused states and impossible inputs give don\'t-cares.', working: `${reason}, so ${l}${b} = X`, cite: 'L19 p55-57' } })
        return
      }
      const ex = excite(types[i], present[i], next[i] as Bit, b)
      letters.forEach((l, k) => ffInputs.push({ label: l + b, value: ex.inputs[k], why: ex.why }))
    })
    const outCells: DesignCell[] = outputs.map((o, k) => {
      const v: Sig = row?.out ? row.out[combo][k] : 'X'
      return {
        label: o,
        value: v,
        why:
          v === 'X'
            ? { rule: 'An output nobody specified is a don\'t-care.', working: `${o} = X`, cite: 'L19 p55' }
            : { rule: 'Outputs are copied from the state table.', working: `state ${state}${n ? `, ${inputs.join('')} = ${bin(combo, n)}` : ''}: ${o} = ${v}`, cite: 'L19 p52-53' },
      }
    })
    rows.push({ index, state, combo, present, inputs: ins, specified, next, nextState: specified ? nx : null, ffInputs, outputs: outCells })
  }

  /* One K-map and equation per flip-flop input and output. */
  const warnings: Issue[] = []
  const functions: DesignFunction[] = []
  const chosenExprs: Expr[] = []
  const targets = [
    ...labels.map((label, j) => ({ label, ff: label.slice(1), letter: label[0], values: rows.map((r) => r.ffInputs[j].value) })),
    ...outputs.map((o, k) => ({ label: o, ff: null, letter: null, values: rows.map((r) => r.outputs[k].value) })),
  ]
  for (const t of targets) {
    const fn = functionFromValues(vars, t.values.map(toCell), t.label)
    const traced = m + n >= 2 && m + n <= 5 ? traceKMap(fn, { orientation: spec.orientation ?? 'rows' }) : null
    const kmap = traced && traced.ok ? traced.trace : null
    const min = kmap ?? minimize(fn)
    const sop = min.covers.map((c) => c.text)
    const sopExpr = parse(sop[0])
    const sopCost = gateCount(sopExpr, bits)
    let chosenExpr = sopExpr
    let chosen: DesignFunction['chosen'] = {
      text: sop[0],
      fitb: min.covers[0].fitb,
      source: 'sop',
      why: { rule: 'Group the 1s with the don\'t-cares to get a minimal SOP.', working: `${t.label} = ${sop[0]}${sop.length > 1 ? ` (${min.summary.covers.value} minimal answers)` : ''}`, cite: 'L19 p50, p56; L15 p38' },
    }
    let check: DesignFunction['check']
    const care = (r: number) => t.values[r] !== 'X'
    const mine = spec.overrides?.[t.label]
    if (mine !== undefined) {
      const p = parseExpr(mine)
      const unknown = p.ok ? p.vars.filter((v) => !vars.includes(v)) : []
      if (!p.ok || unknown.length) {
        errors.push(...(p.ok ? [{ code: 'var', message: `${t.label}: unknown variable ${unknown.join(', ')}`, at: [0, 0] as [number, number] }] : p.errors.map((e) => ({ ...e, message: `${t.label}: ${e.message}` }))))
        continue
      }
      const eq = checkEquivalence(p.expr, sopExpr, vars, care)
      check = {
        ok: eq.equivalent,
        differing: eq.differing,
        why: eq.equivalent
          ? { rule: 'Your equation only has to match the rows that are not don\'t-cares.', working: `${t.label} = ${printExpr(p.expr)} matches all ${t.values.filter((v) => v !== 'X').length} specified rows`, cite: 'L19 p50; T09 Q2' }
          : { rule: 'Your equation only has to match the rows that are not don\'t-cares.', working: `differs on row${eq.differing.length > 1 ? 's' : ''} ${eq.differing.map((r) => bin(r, m + n)).join(', ')} (needs ${t.values[eq.differing[0]]})`, cite: 'L19 p50' },
      }
      chosenExpr = p.expr
      chosen = { text: printExpr(p.expr), fitb: printExpr(p.expr, 'fitb'), source: 'yours', why: check.why }
    } else if (spec.prefer === 'fewest-gates') {
      const singles = singleGates(fn).matches.map((g) => ({ g, e: parse(g.text) })).map((x) => ({ ...x, cost: gateCount(x.e, bits).gates }))
      const best = singles.sort((a, b) => a.cost - b.cost)[0]
      if (best && best.cost < sopCost.gates) {
        chosenExpr = best.e
        chosen = {
          text: printExpr(best.e),
          fitb: printExpr(best.e, 'fitb'),
          source: 'single-gate',
          why: {
            rule: 'Fewest gates is not always the simplest SOP: check whether one gate fits the specified rows.',
            working: `${t.label} = ${printExpr(best.e)} (${best.cost} gate${best.cost === 1 ? '' : 's'}) instead of ${sop[0]} (${sopCost.gates} gate${sopCost.gates === 1 ? '' : 's'})`,
            cite: 'T09 Q2 Ans p3; AY23/24 S2 Q20e',
          },
        }
      }
    }
    chosenExprs.push(chosenExpr)
    const f = compile(chosenExpr, vars)
    functions.push({
      label: t.label,
      ff: t.ff,
      letter: t.letter,
      fn,
      min,
      kmap,
      sop,
      chosen,
      check,
      gates: gateCount(chosenExpr, bits),
      committed: fn.dc.map((cell) => ({ cell, value: f(cell) })),
    })
  }
  if (errors.length) return { ok: false, errors }

  /*
   * S-R flip-flops: S∙R = 0 must also hold on the don't-cares once they are committed (L19 p11). When the
   * first minimal SOPs give S = R = 1 somewhere, take the first pair of minimal SOPs that does not
   * (L19 p56 and R10 p43 pick RB = B∙C + B∙x for this reason). Your own equations are never replaced.
   */
  bits.forEach((b, i) => {
    if (types[i] !== 'SR') return
    const si = functions.findIndex((f) => f.label === 'S' + b)
    const ri = functions.findIndex((f) => f.label === 'R' + b)
    const [S, R] = [functions[si], functions[ri]]
    const clash = (se: Expr, re: Expr) => {
      const fs = compile(se, vars)
      const fr = compile(re, vars)
      return rows.filter((r) => fs(r.index) && fr(r.index)).map((r) => r.index)
    }
    const bad = clash(chosenExprs[si], chosenExprs[ri])
    if (!bad.length) return
    const sOpts = S.chosen.source === 'yours' ? [{ c: null, e: chosenExprs[si] }] : S.min.covers.map((c) => ({ c, e: parse(c.text) }))
    const rOpts = R.chosen.source === 'yours' ? [{ c: null, e: chosenExprs[ri] }] : R.min.covers.map((c) => ({ c, e: parse(c.text) }))
    for (const so of sOpts)
      for (const ro of rOpts) {
        if (clash(so.e, ro.e).length) continue
        const where = bad.map((x) => bin(x, m + n)).join(', ')
        for (const [k, o] of [[si, so], [ri, ro]] as const) {
          if (!o.c || o.c.text === functions[k].chosen.text) continue
          const f = functions[k]
          const was = f.chosen.text
          chosenExprs[k] = o.e
          f.chosen = {
            text: o.c.text,
            fitb: o.c.fitb,
            source: 'sop',
            why: {
              rule: "An S-R flip-flop must never get S = R = 1, so choose a minimal SOP that keeps S∙R = 0 on the don't-cares too.",
              working: `${f.label} = ${o.c.text} instead of ${was}: with ${was}, S${b} = R${b} = 1 on row${bad.length > 1 ? 's' : ''} ${where}`,
              cite: 'L19 p11, p56; R10 p43',
            },
          }
          f.gates = gateCount(o.e, bits)
          const fc = compile(o.e, vars)
          f.committed = f.fn.dc.map((cell) => ({ cell, value: fc(cell) }))
        }
        return
      }
  })

  /* Build the circuit from the chosen equations and analyse it again. */
  const exprOf = (label: string) => functions.find((f) => f.label === label)!.chosen.text
  const circuit: CircuitSpec = {
    flipFlops: bits.map((b, i) => ({ name: b, type: types[i], inputs: Object.fromEntries(FF_INPUTS[types[i]].map((l) => [l, exprOf(l + b)])) })),
    inputs,
    outputs: outputs.map((o) => ({ name: o, expr: exprOf(o) })),
    used,
  }
  const re = analyse(circuit)
  if (!re.ok) return re
  const analysis = re.analysis
  const mismatches: string[] = []
  for (const r of rows) {
    if (!r.specified) continue
    const got = analysis.rows[r.index]
    const at = `state ${r.state}${n ? `, ${inputs.join('')} = ${bin(r.combo, n)}` : ''}`
    if (got.nextState !== r.nextState) mismatches.push(`${at}: goes to ${got.nextState ?? '?'} instead of ${r.nextState}`)
    r.outputs.forEach((o, k) => {
      if (o.value !== 'X' && got.outputs[k].value !== o.value) mismatches.push(`${at}: ${o.label} = ${got.outputs[k].value} instead of ${o.value}`)
    })
  }
  for (const r of analysis.rows)
    if (r.nextState === null) warnings.push({ code: 'sr-invalid', message: `state ${r.state}${n ? `, ${inputs.join('')} = ${bin(r.combo, n)}` : ''}: S = R = 1 after committing the don't-cares`, at: [0, 0], cite: 'L19 p18' })

  const unusedTransitions: UnusedTransition[] = unused.flatMap((s) =>
    Array.from({ length: combos }, (_, c) => {
      const r = analysis.rows[(s << n) | c]
      return {
        state: s,
        combo: c,
        next: r.nextState,
        out: r.outputs.map((o) => o.value),
        why: {
          rule: 'Once the equations are fixed, the don\'t-cares are no longer free: put the unused state into the equations to see where it really goes.',
          working: `state ${s}${n ? `, ${inputs.join('')} = ${bin(c, n)}` : ''}: ${r.ffInputs.map((f) => `${f.label} = ${f.value}`).join(', ')}, so next state ${r.nextState ?? '?'}`,
          cite: 'T09 Q2 Ans p3; L19 p55-57',
        },
      }
    }),
  )

  const total = totalGates(chosenExprs, bits)
  const frames: DesignFrame[] = [
    ...rows.map((r) => ({
      phase: 'excite' as const,
      row: r.index,
      title: `Row ${bin(r.index, m + n)}: ${r.specified ? `${r.state} -> ${r.nextState}` : 'don\'t care'}`,
      why: {
        rule: 'Look up each flip-flop\'s move Q -> Q+ in its excitation table.',
        working: r.ffInputs.map((c) => `${c.label} = ${c.value}`).join(', ') || 'no flip-flop inputs',
        cite: 'L19 p45, p48',
      },
    })),
    ...functions.map((f, i) => ({ phase: 'kmap' as const, fn: i, title: `K-map for ${f.label}`, why: f.chosen.why })),
    ...functions.map((f, i) => ({
      phase: 'commit' as const,
      fn: i,
      title: `Commit the don't-cares of ${f.label}`,
      why: {
        rule: 'After choosing the equation, each don\'t-care takes the value the equation gives it.',
        working: f.committed.length ? f.committed.map((d) => `${bin(d.cell, m + n)}: d(${d.value})`).join(', ') : 'no don\'t-cares',
        cite: 'T09 Ans p3',
      },
    })),
    ...unusedTransitions.map((u) => ({ phase: 'unused' as const, title: `Unused state ${u.state}${n ? `, ${inputs.join('')} = ${bin(u.combo, n)}` : ''}`, why: u.why })),
    { phase: 'verdict', title: 'Self-correcting?', why: { ...analysis.selfCorrection.why, working: analysis.selfCorrection.sentence } },
  ]

  return {
    ok: true,
    design: {
      spec,
      vars,
      used,
      unused,
      rows,
      functions,
      total,
      circuit,
      analysis,
      unusedTransitions,
      verified: mismatches.length === 0,
      mismatches,
      warnings,
      frames,
    },
  }
}

function parse(text: string): Expr {
  const p = parseExpr(text)
  if (!p.ok) throw new Error(`internal: cannot parse ${text}`)
  return p.expr
}
