/** Text parsers for circuit equations, state tables and state sequences. They never throw on user input. */
import { parseExpr, varsOf } from '../boolean'
import { FF_INPUTS } from './types'
import type { CircuitSpec, FFType, FlipFlopSpec, Issue, Machine, OutputSpec, Result, Sig } from './types'

const NAME = /^[A-Za-z][0-9]*$/

interface Line {
  no: number
  start: number
  text: string
}

/** Split on newlines and ';', keeping 1-based line numbers and offsets into the source. */
function linesOf(src: string): Line[] {
  const out: Line[] = []
  let offset = 0
  src.split('\n').forEach((raw, i) => {
    let start = offset
    for (const part of raw.split(';')) {
      if (part.trim()) out.push({ no: i + 1, start, text: part })
      start += part.length + 1
    }
    offset += raw.length + 1
  })
  return out
}

const issue = (line: Line, message: string, code = 'parse'): Issue => ({ code, message: `line ${line.no}: ${message}`, at: [line.start, line.start + line.text.length], line: line.no })

export interface ParseCircuitOptions {
  /** External inputs, MSB first. Default: every other variable used, in alphabetical order. */
  inputs?: string[]
  /** State bits, MSB first. Default: the flip-flop names in alphabetical order. */
  bits?: string[]
}

/**
 * Parse flip-flop input equations and output equations, one per line (or separated by ';'):
 * `JA = B`, `KA = B∙x'`, `JB = KB = (A⊕x)'`, `DC = A + B`, `TB = A'∙C`, `A+ = A∙x + B∙x` (a D flip-flop),
 * `y = (A+B)∙x'`. The left side `JA` means input J of flip-flop A (L19 p36).
 */
export function parseCircuit(src: string, opts: ParseCircuitOptions = {}): Result<{ circuit: CircuitSpec }> {
  const errors: Issue[] = []
  const ffs = new Map<string, Map<string, { expr: string; line: Line }>>()
  const outputs: (OutputSpec & { line: Line })[] = []
  const used = new Set<string>()
  for (const line of linesOf(src)) {
    const parts = line.text.split('=')
    if (parts.length < 2) {
      errors.push(issue(line, 'expected an equation such as JA = B∙x\''))
      continue
    }
    const rhs = parts[parts.length - 1]
    const parsed = parseExpr(rhs)
    if (!parsed.ok) {
      const base = line.start + line.text.lastIndexOf('=') + 1
      errors.push(...parsed.errors.map((e) => ({ ...e, message: `line ${line.no}: ${e.message}`, line: line.no, at: [e.at[0] + base, e.at[1] + base] as [number, number] })))
      continue
    }
    for (const v of varsOf(parsed.expr)) used.add(v)
    for (const raw of parts.slice(0, -1)) {
      const lhs = raw.trim().replace(/\s+/g, '')
      const next = /^([A-Za-z][0-9]*)(\+|\(t\+1\))$/.exec(lhs)
      const input = /^([JKSRDT])([A-Za-z][0-9]*)$/.exec(lhs)
      if (next || input) {
        const ff = next ? next[1] : input![2]
        const letter = next ? '+' : input![1]
        if (!ffs.has(ff)) ffs.set(ff, new Map())
        const m = ffs.get(ff)!
        if (m.has(letter)) errors.push(issue(line, `${lhs} is given twice`))
        m.set(letter, { expr: rhs.trim(), line })
      } else if (NAME.test(lhs)) {
        if (outputs.some((o) => o.name === lhs)) errors.push(issue(line, `${lhs} is given twice`))
        outputs.push({ name: lhs, expr: rhs.trim(), line })
      } else errors.push(issue(line, `cannot read '${raw.trim()}': write a flip-flop input such as JA, DB or TC, a next state such as A+, or an output name`))
    }
  }
  const flipFlops: FlipFlopSpec[] = []
  for (const [name, m] of ffs) {
    const letters = [...m.keys()].sort()
    const line = [...m.values()][0].line
    let type: FFType | null = null
    if (letters.join() === '+' || letters.join() === 'D') type = 'D'
    else if (letters.join() === 'T') type = 'T'
    else if (letters.join() === 'J,K') type = 'JK'
    else if (letters.join() === 'R,S') type = 'SR'
    if (!type) {
      const has = letters.map((l) => (l === '+' ? `${name}+` : l + name)).join(', ')
      const hint = letters.includes('J') || letters.includes('K') ? `a J-K flip-flop needs both J${name} and K${name}` : letters.includes('S') || letters.includes('R') ? `an S-R flip-flop needs both S${name} and R${name}` : 'use one flip-flop type per state bit'
      errors.push(issue(line, `flip-flop ${name} has ${has}: ${hint}`))
      continue
    }
    const inputs: Record<string, string> = {}
    for (const l of FF_INPUTS[type]) inputs[l] = m.get(l === 'D' && m.has('+') ? '+' : l)!.expr
    flipFlops.push({ name, type, inputs })
  }
  if (!ffs.size && !errors.length) errors.push({ code: 'empty', message: 'no flip-flop equations found', at: [0, 0] })

  const bits = opts.bits ?? [...flipFlops.map((f) => f.name)].sort()
  for (const b of bits) if (!ffs.has(b) && !errors.length) errors.push({ code: 'bits', message: `state bit ${b} has no flip-flop equations`, at: [0, 0] })
  for (const f of flipFlops) if (!bits.includes(f.name)) errors.push({ code: 'bits', message: `flip-flop ${f.name} is not in the state bit list`, at: [0, 0] })
  const others = [...used].filter((v) => !bits.includes(v)).sort()
  const inputs = opts.inputs ?? others
  for (const v of others) if (!inputs.includes(v)) errors.push({ code: 'var', message: `unknown variable ${v}: it is neither a state bit nor an input`, at: [0, 0] })
  for (const o of outputs) if (bits.includes(o.name) || inputs.includes(o.name)) errors.push(issue(o.line, `output ${o.name} has the same name as a state bit or input`))
  if (errors.length) return { ok: false, errors }
  flipFlops.sort((a, b) => bits.indexOf(a.name) - bits.indexOf(b.name))
  return { ok: true, circuit: { flipFlops, inputs, outputs: outputs.map(({ name, expr }) => ({ name, expr })) } }
}

/* ---------- State tables ---------- */

export interface TableRow {
  state: number
  /** Next state per input combination (binary order of the inputs); null = don't care. */
  next: (number | null)[]
  /** out[c][k]: output k on input combination c. */
  out?: Sig[][]
}

export interface ParsedTable {
  rows: TableRow[]
  /** State names when the table uses letters (T09 SE1); empty for numbered states. */
  names: string[]
}

/**
 * Parse a compact state table, one present state per line: `1: 2/0 4/1` gives the next state and outputs
 * for each input combination in binary order. `X` (or `-`) marks a don't-care next state or output.
 * With no inputs a line has one entry: `3: 4`. States may be numbers or letters (`A: C/0 A/1`).
 * States with no line are unused.
 */
export function parseStateTable(src: string, opts: { inputs: number; outputs?: number }): Result<{ table: ParsedTable }> {
  const errors: Issue[] = []
  const combos = 1 << opts.inputs
  const nOut = opts.outputs ?? 0
  const lines = src.split('\n').map((text, i) => ({ no: i + 1, start: 0, text })).filter((l) => l.text.trim())
  let offset = 0
  src.split('\n').forEach((t, i) => {
    const l = lines.find((x) => x.no === i + 1)
    if (l) l.start = offset
    offset += t.length + 1
  })
  const heads = lines.map((l) => l.text.split(':')[0].trim())
  const isNum = (h: string) => /^\d+$/.test(h)
  const isName = (h: string) => /^[A-Za-z][A-Za-z0-9_']*$/.test(h) && !/^[Xx]$/.test(h)
  lines.forEach((l, i) => {
    if (l.text.includes(':') && !isNum(heads[i]) && !isName(heads[i])) errors.push(issue(l, `'${heads[i]}' is not a state number (0, 1, 2, ...) or a state letter`))
  })
  const named = heads.some(isName)
  if (named && heads.some(isNum)) errors.push({ code: 'parse', message: 'the table mixes numbered and lettered states: use one or the other', at: [0, src.length] })
  if (errors.length) return { ok: false, errors }
  const names = named ? heads : []
  const stateOf = (tok: string, line: Line): number | null | undefined => {
    if (tok === 'X' || tok === 'x' || tok === '-') return null
    if (named) {
      const i = names.indexOf(tok)
      if (i < 0) errors.push(issue(line, `unknown state ${tok}`))
      return i < 0 ? undefined : i
    }
    if (!/^\d+$/.test(tok)) {
      errors.push(issue(line, `'${tok}' is not a state number`))
      return undefined
    }
    return Number(tok)
  }
  const rows: TableRow[] = []
  for (const line of lines) {
    const colon = line.text.indexOf(':')
    if (colon < 0) {
      errors.push(issue(line, `expected 'state: next next ...', e.g. '1: 2/0 4/1'`))
      continue
    }
    const state = stateOf(line.text.slice(0, colon).trim(), line)
    if (state === undefined || state === null) continue
    if (rows.some((r) => r.state === state)) errors.push(issue(line, `state ${line.text.slice(0, colon).trim()} is listed twice`))
    const cells = line.text.slice(colon + 1).trim().split(/[\s,]+/).filter(Boolean)
    if (cells.length !== combos) {
      errors.push(issue(line, `expected ${combos} entr${combos === 1 ? 'y' : 'ies'} (one per input combination), found ${cells.length}`))
      continue
    }
    const next: (number | null)[] = []
    const out: Sig[][] = []
    for (const cell of cells) {
      const [ns, os = ''] = cell.split('/')
      const n = stateOf(ns, line)
      next.push(n ?? null)
      const o = os.replace(/[^01Xx-]/g, '').split('').map((ch): Sig => (ch === '0' ? 0 : ch === '1' ? 1 : 'X'))
      if (nOut && o.length === 1 && o[0] === 'X') while (o.length < nOut) o.push('X')
      if (o.length !== nOut) errors.push(issue(line, `entry '${cell}' needs ${nOut} output bit${nOut === 1 ? '' : 's'} after '/'`))
      out.push(o)
    }
    rows.push({ state, next, out: nOut ? out : undefined })
  }
  if (!rows.length && !errors.length) errors.push({ code: 'empty', message: 'the table is empty', at: [0, 0] })
  if (errors.length) return { ok: false, errors }
  return { ok: true, table: { rows, names } }
}

/**
 * Parse a state sequence for a circuit with no inputs, e.g. `1→3→5→7→1` or `0, 1, 2, 3, 4, 5, 5`.
 * Several chains may be given on separate lines. Each state gets the state after it as its next state.
 */
export function parseSequence(src: string): Result<{ rows: TableRow[] }> {
  const errors: Issue[] = []
  const next = new Map<number, number>()
  for (const line of linesOf(src.replace(/;/g, '\n'))) {
    const toks = line.text.split(/\s*(?:→|->|,|\s)\s*/).filter(Boolean)
    if (toks.some((t) => !/^\d+$/.test(t))) {
      errors.push(issue(line, 'write states as numbers joined by → (or ->), e.g. 1→3→5'))
      continue
    }
    const xs = toks.map(Number)
    for (let i = 0; i + 1 < xs.length; i++) {
      const prev = next.get(xs[i])
      if (prev !== undefined && prev !== xs[i + 1]) errors.push(issue(line, `state ${xs[i]} goes to both ${prev} and ${xs[i + 1]}; a circuit with no inputs has one next state`))
      next.set(xs[i], xs[i + 1])
    }
  }
  if (!next.size && !errors.length) errors.push({ code: 'empty', message: 'give at least one transition, e.g. 0→1', at: [0, 0] })
  if (errors.length) return { ok: false, errors }
  const states = new Set<number>([...next.keys(), ...next.values()])
  const rows = [...states].sort((a, b) => a - b).map((state) => ({ state, next: [next.has(state) ? next.get(state)! : null] }))
  return { ok: true, rows }
}

/**
 * Turn a parsed table into a Machine for simulation and checks. Numbered states need `bits` (state bit names);
 * named states (T09 SE1) keep their letters and have no bits. States with no row are unused.
 */
export function machineFromTable(table: ParsedTable, opts: { inputs: string[]; outputs?: string[]; bits?: string[] }): Machine {
  const outputs = opts.outputs ?? []
  const combos = 1 << opts.inputs.length
  const named = table.names.length > 0
  const bits = named ? [] : (opts.bits ?? [])
  // Next states count too, so a typo such as 9 in a 2-bit table gives an (unused) state 9 instead of a crash.
  const count = named ? table.names.length : Math.max(1 << bits.length, ...table.rows.flatMap((r) => [r.state + 1, ...r.next.map((n) => (n ?? 0) + 1)]))
  const byState = new Map(table.rows.map((r) => [r.state, r]))
  return {
    bits,
    inputs: opts.inputs,
    outputs,
    labels: named ? table.names : Array.from({ length: count }, (_, s) => String(s)),
    next: Array.from({ length: count }, (_, s) => byState.get(s)?.next ?? Array.from({ length: combos }, () => null)),
    out: Array.from({ length: count }, (_, s) => Array.from({ length: combos }, (_, c) => byState.get(s)?.out?.[c] ?? outputs.map((): Sig => 'X'))),
    used: table.rows.map((r) => r.state).sort((a, b) => a - b),
  }
}
