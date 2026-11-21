/** Encoders and priority encoders (L18 p26-33; T08 Q5; AY23/24 S2 Q15). */
import { MAX_MIN_VARS, minimize } from '../boolean'
import { bin, fnFromRows, range, wireAll, type Bit, type BoolFunction, type Built, type CellValue, type Explain } from './signals'

export interface EncodeResult {
  /** Output bits MSB first; 'X' when the priority encoder sees no input. */
  code: (Bit | 'X')[]
  /** Valid bit (priority encoder with V only). */
  v?: Bit
  /** Index that wins (priority) or the single high input (plain); null when none. */
  winner: number | null
  /** Plain encoder with more than one input high: the output is the OR of their codes and can look like another input. */
  misleading: boolean
  why: Explain
}

const widthOf = (inputs: number) => Math.ceil(Math.log2(inputs))

/** Output names MSB first, as the course writes them: f, g (L18 p32) and x, y, z (L18 p30-31); otherwise bit j. */
export function encoderOutputNames(inputs: number): string[] {
  const n = widthOf(inputs)
  return n === 2 ? ['f', 'g'] : n === 3 ? ['x', 'y', 'z'] : range(n).map((p) => `bit ${n - 1 - p}`)
}

/** Plain 2^n-to-n encoder: output bit j is the OR of every input whose index has bit j set (L18 p26-31). */
export function encode(d: Bit[]): EncodeResult {
  const n = widthOf(d.length)
  const highs = range(d.length).filter((i) => d[i])
  const value = highs.reduce((acc, i) => acc | i, 0)
  const code = bin(value, n).split('').map(Number) as Bit[]
  const misleading = highs.length > 1
  return {
    code,
    winner: highs.length === 1 ? highs[0] : null,
    misleading,
    why: misleading
      ? {
          rule: 'A plain encoder assumes exactly one input is high. With several, each output is still an OR, so the code is the OR of their codes.',
          working: `D${highs.join(', D')} are high: ${highs.map((i) => bin(i, n)).join(' OR ')} = ${bin(value, n)}, which looks like D${value}`,
          cite: 'L18 p26, p30',
        }
      : highs.length
        ? { rule: 'Exactly one input is high, so the output is its index in binary.', working: `D${highs[0]} gives ${bin(value, n)}`, cite: 'L18 p27' }
        : { rule: 'No input is high: a plain encoder outputs 0 (indistinguishable from D0).', working: bin(0, n), cite: 'L18 p26' },
  }
}

/** Priority encoder: the highest index wins (L18 p32). All inputs 0 gives X outputs, and V = 0 when there is a valid bit. */
export function priorityEncode(d: Bit[], opts: { valid?: boolean } = {}): EncodeResult {
  const n = widthOf(d.length)
  const highs = range(d.length).filter((i) => d[i])
  const winner = highs.length ? highs[highs.length - 1] : null
  const valid = opts.valid ?? true
  return {
    code: winner === null ? Array(n).fill('X') : (bin(winner, n).split('').map(Number) as Bit[]),
    v: valid ? (winner === null ? 0 : 1) : undefined,
    winner,
    misleading: false,
    why:
      winner === null
        ? { rule: `No input is high: the outputs are don't-cares${valid ? ' and V = 0 marks the code invalid' : ''}.`, cite: valid ? 'L18 p32' : 'T08 Q5' }
        : {
            rule: 'The highest-index input that is 1 wins; lower inputs are ignored.',
            working: `high inputs D${highs.join(', D')}: D${winner} wins, code ${bin(winner, n)}`,
            cite: 'L18 p32',
          },
  }
}

export interface EncoderEquation {
  /** Output name, MSB first: f, g; x, y, z; or bit j. */
  output: string
  /** Inputs ORed (plain encoder). */
  inputs: number[]
  /** OR of the inputs, e.g. D1+D3+D5+D7. */
  text: string
  why: Explain
}

/** Output bit equations of a plain encoder: bit j = OR of D_i for every i with bit j set (L18 p27, p31; AY23/24 S2 Q15). */
export function encoderEquations(inputs: number, names?: string[]): EncoderEquation[] {
  const n = widthOf(inputs)
  return range(n).map((p) => {
    const j = n - 1 - p
    const ins = range(inputs).filter((i) => (i >> j) & 1)
    const text = ins.map((i) => `D${i}`).join('+')
    const output = names?.[p] ?? encoderOutputNames(inputs)[p]
    return {
      output,
      inputs: ins,
      text,
      why: { rule: `Output bit ${j} is 1 for every input whose index has bit ${j} set.`, working: `${output} = ${text}`, cite: 'L18 p27, p31' },
    }
  })
}

export interface PriorityRow {
  /** Input pattern, highest index first: 1, 0 or X ("any value"). */
  inputs: CellValue[]
  code: (Bit | 'X')[]
  v?: Bit
}

/**
 * Compact priority-encoder table: the winner is 1, higher inputs are 0, lower inputs are X.
 * Columns run highest index first (T08 Q5, F7..F0) by default; `order: 'low-first'` gives the L18 p32 layout (D0..D3).
 */
export function priorityTable(inputs: number, opts: { valid?: boolean; order?: 'high-first' | 'low-first' } = {}): PriorityRow[] {
  const n = widthOf(inputs)
  const valid = opts.valid ?? true
  const rows: PriorityRow[] = [{ inputs: Array(inputs).fill(0), code: Array(n).fill('X'), v: valid ? 0 : undefined }]
  for (const w of range(inputs)) {
    const pattern = range(inputs)
      .reverse()
      .map((i): CellValue => (i > w ? 0 : i === w ? 1 : 'X'))
    if (opts.order === 'low-first') pattern.reverse()
    rows.push({ inputs: pattern, code: bin(w, n).split('').map(Number) as Bit[], v: valid ? 1 : undefined })
  }
  return rows
}

/**
 * Simplified output equations of a priority encoder over D(m-1)..D0 (derived; L18 p33 leaves it as an exercise).
 * Bit j is the OR, over every input w with bit j set, of D_w ANDed with D_i' for each higher input i whose bit j
 * is 0 (a higher input with bit j set gives bit j = 1 anyway, so it drops out). This closed form equals the
 * K-map minimum (checked against the minimiser for 4 and 8 inputs) and needs no truth table, so 16 inputs is instant.
 */
export function priorityEquations(inputs: number, opts: { valid?: boolean } = {}): { output: string; text: string; why: Explain }[] {
  if (!Number.isInteger(inputs) || inputs < 2) return []
  const n = widthOf(inputs)
  const out = range(n).map((p) => {
    const j = n - 1 - p
    const terms = range(inputs)
      .reverse()
      .filter((w) => (w >> j) & 1)
      .map((w) => [...range(inputs).reverse().filter((i) => i > w && !((i >> j) & 1)).map((i) => `D${i}'`), `D${w}`].join('∙'))
    const text = terms.join(' + ')
    const output = encoderOutputNames(inputs)[p]
    return {
      output,
      text,
      why: {
        rule: `${output.startsWith('bit') ? output : `${output} (bit ${j})`} is 1 when the winning input has bit ${j} set: D_w wins when every higher input is 0, and higher inputs that also set bit ${j} can be ignored. The all-zero row is a don't-care.`,
        working: `${output} = ${text}`,
        cite: 'L18 p32-33 (derived)',
      },
    }
  })
  if (opts.valid ?? true) {
    const v = range(inputs).map((i) => `D${i}`).join('+')
    out.push({ output: 'V', text: v, why: { rule: 'V = 1 when any input is 1.', working: v, cite: 'L18 p32' } })
  }
  return out
}

/* ---------- An encoder whose inputs are wired to variables (T08 Q5 / AY24/25 Q17c) ---------- */

export interface EncoderCircuit {
  vars: string[]
  rows: { row: number; d: Bit[]; result: EncodeResult }[]
  /** One function per output bit, MSB first; don't-care rows where the priority encoder sees no input. */
  outputs: BoolFunction[]
  v?: BoolFunction
  why: Explain[]
}

/**
 * Inputs D0..D(m-1) are wired to variables, constants or expressions; each output bit becomes a function.
 * A plain encoder assumes exactly one input is high, so by default the other rows are don't-cares (L18 p29;
 * AY23/24 S2 Q21e key). `invalid: 'or'` instead gives what the OR gates output on those rows (L18 p27).
 */
export function encoderCircuit(
  pins: string[],
  vars: string[],
  opts: { priority?: boolean; valid?: boolean; invalid?: 'dontcare' | 'or' } = {},
): Built<{ circuit: EncoderCircuit }> {
  if (pins.length < 2) return { ok: false, errors: [{ pin: 'D', message: 'an encoder needs at least 2 inputs' }] }
  if (vars.length > MAX_MIN_VARS) return { ok: false, errors: [{ pin: 'vars', message: `at most ${MAX_MIN_VARS} input variables` }] }
  const built = wireAll(pins.map((t, i) => ({ pin: `D${i}`, text: t })), vars)
  if (!built.ok) return built
  const n = widthOf(pins.length)
  const rows = range(1 << vars.length).map((row) => {
    const d = built.wires.map((w) => w.rows[row])
    return { row, d, result: opts.priority ? priorityEncode(d, { valid: opts.valid }) : encode(d) }
  })
  const dcRow = (r: (typeof rows)[number]) => !opts.priority && opts.invalid !== 'or' && r.result.winner === null
  const names = encoderOutputNames(pins.length)
  const outputs = range(n).map((p) => fnFromRows(names[p], vars, rows.map((r) => (dcRow(r) ? 'X' : r.result.code[p]))))
  const v = opts.priority && (opts.valid ?? true) ? fnFromRows('V', vars, rows.map((r) => r.result.v ?? 0)) : undefined
  return {
    ok: true,
    circuit: {
      vars,
      rows,
      outputs,
      v,
      why: outputs.map((f, p) => {
        const m = minimize(f, 'sop')
        return {
          rule: opts.priority
            ? 'On each row the highest-index input that is 1 decides the code.'
            : opts.invalid === 'or'
              ? 'Each output bit ORs the inputs whose index has that bit set, also on rows with no input or several inputs high.'
              : "Each output bit ORs the inputs whose index has that bit set. Rows with no input or several inputs high break the encoder's assumption, so they are don't-cares.",
          working: `${names[p]} = ${m.summary.answer}`,
          cite: opts.priority ? 'L18 p32; T08 Q5' : opts.invalid === 'or' ? 'L18 p27' : 'L18 p29; AY23/24 S2 Q21e',
        }
      }),
    },
  }
}
