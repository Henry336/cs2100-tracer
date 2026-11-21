/** Magnitude comparator (L17 p30-33): unsigned X vs Y with outputs X<Y, X=Y, X>Y and no cascade inputs. */
import { fnFromRows, range, sigmaOf, wireAll, type Bit, type BoolFunction, type Built, type Explain, type PinIssue } from './signals'

export type CmpOutput = 'lt' | 'eq' | 'gt'
export const CMP_OUTPUTS: CmpOutput[] = ['lt', 'eq', 'gt']
export const CMP_SYMBOL: Record<CmpOutput, string> = { lt: '<', eq: '=', gt: '>' }

/** One bit of the cascade from the MSB (L17 p31). */
export interface CompareBit {
  i: number
  a: Bit
  b: Bit
  /** x_i = A_i∙B_i + A_i'∙B_i' (1 when the bits are equal). */
  x: Bit
  /** Value of this bit's term in (A>B): x(n-1)..x(i+1)∙A_i∙B_i'. */
  gtTerm: Bit
  ltTerm: Bit
  why: { x: Explain; gtTerm: Explain; ltTerm: Explain }
}

export interface CompareFrame {
  /** Index into `bits` (0 = MSB), or null for the result frame. */
  bit: number | null
  label: string
  /** True once a differing bit has decided the answer. */
  decided: boolean
  why: Explain
}

export interface CompareTrace {
  width: number
  a: number
  b: number
  bits: CompareBit[]
  frames: CompareFrame[]
  out: Record<CmpOutput, Bit>
  /** Index into `bits` of the first differing bit, or null when A = B. */
  decidingBit: number | null
  why: Record<CmpOutput, Explain>
}

const prefix = (bits: CompareBit[], upto: number) => bits.slice(0, upto).map((b) => `x${b.i}`).join('')

/** Compare two unsigned values bit by bit from the MSB, showing every x_i and every term of (A>B) and (A<B). */
export function compareValues(a: number, b: number, width = 4): Built<{ trace: CompareTrace }> {
  const max = 2 ** width
  const errors: PinIssue[] = []
  if (!Number.isInteger(width) || width < 1 || width > 16) errors.push({ pin: 'width', message: 'width must be 1 to 16 bits' })
  if (!Number.isInteger(a) || a < 0 || a >= max) errors.push({ pin: 'a', message: `A must be 0 to ${max - 1}` })
  if (!Number.isInteger(b) || b < 0 || b >= max) errors.push({ pin: 'b', message: `B must be 0 to ${max - 1}` })
  if (errors.length) return { ok: false, errors }

  const bits: CompareBit[] = []
  let allEq: Bit = 1
  for (const i of range(width).reverse()) {
    const ai = ((a >> i) & 1) as Bit
    const bi = ((b >> i) & 1) as Bit
    const x = (ai === bi ? 1 : 0) as Bit
    const p = prefix(bits, bits.length)
    const gtTerm = (allEq & ai & (1 - bi)) as Bit
    const ltTerm = (allEq & (1 - ai) & bi) as Bit
    bits.push({
      i,
      a: ai,
      b: bi,
      x,
      gtTerm,
      ltTerm,
      why: {
        x: { rule: `x${i} = A${i}∙B${i} + A${i}'∙B${i}': 1 when the two bits are equal`, working: `A${i} = ${ai}, B${i} = ${bi}, so x${i} = ${x}`, cite: 'L17 p31' },
        gtTerm: {
          rule: `Term ${p}A${i}∙B${i}' of (A>B): every higher bit equal and A${i} = 1, B${i} = 0`,
          working: `${p ? `${p} = ${allEq}, ` : ''}A${i}∙B${i}' = ${ai}∙${1 - bi}, term = ${gtTerm}`,
          cite: 'L17 p31',
        },
        ltTerm: {
          rule: `Term ${p}A${i}'∙B${i} of (A<B): every higher bit equal and A${i} = 0, B${i} = 1`,
          working: `${p ? `${p} = ${allEq}, ` : ''}A${i}'∙B${i} = ${1 - ai}∙${bi}, term = ${ltTerm}`,
          cite: 'L17 p31',
        },
      },
    })
    allEq = (allEq & x) as Bit
  }
  const gt = bits.some((t) => t.gtTerm) ? 1 : 0
  const lt = bits.some((t) => t.ltTerm) ? 1 : 0
  const eq = allEq
  const deciding = bits.findIndex((t) => !t.x)
  const frames: CompareFrame[] = bits.map((t, k) => ({
    bit: k,
    label: `Bit ${t.i}: A${t.i} = ${t.a}, B${t.i} = ${t.b}`,
    decided: deciding !== -1 && k >= deciding,
    why:
      deciding !== -1 && k > deciding
        ? { rule: `Bit ${bits[deciding].i} already decided the answer, so x${bits[deciding].i} = 0 switches off every lower term.`, cite: 'L17 p30-31' }
        : t.x
          ? { rule: `The bits are equal (x${t.i} = 1), so move on to the next lower bit.`, cite: 'L17 p30' }
          : { rule: `First differing bit: A${t.i} ${t.a ? '>' : '<'} B${t.i} decides A ${t.a ? '>' : '<'} B.`, cite: 'L17 p30' },
  }))
  frames.push({
    bit: null,
    label: `Result: A ${gt ? '>' : lt ? '<' : '='} B`,
    decided: true,
    why: { rule: 'Exactly one of the three outputs is 1.', working: `${a} ${gt ? '>' : lt ? '<' : '='} ${b}`, cite: 'L17 p32' },
  })
  const names = bits.map((t) => `x${t.i}`).join('')
  return {
    ok: true,
    trace: {
      width,
      a,
      b,
      bits,
      frames,
      out: { lt: lt as Bit, eq, gt: gt as Bit },
      decidingBit: deciding === -1 ? null : deciding,
      why: {
        eq: { rule: `(A=B) = ${names}: every bit equal`, working: bits.map((t) => t.x).join('∙') + ` = ${eq}`, cite: 'L17 p31' },
        gt: {
          rule: `(A>B) = ${bits.map((t, k) => `${prefix(bits, k)}A${t.i}∙B${t.i}'`).join(' + ')}`,
          working: bits.map((t) => t.gtTerm).join(' + ') + ` = ${gt}`,
          cite: 'L17 p31',
        },
        lt: {
          rule: `(A<B) = ${bits.map((t, k) => `${prefix(bits, k)}A${t.i}'∙B${t.i}`).join(' + ')}`,
          working: bits.map((t) => t.ltTerm).join(' + ') + ` = ${lt}`,
          cite: 'L17 p31',
        },
      },
    },
  }
}

/* ---------- A comparator wired to variables: which function does each output give? ---------- */

/** Pins MSB first: x = [X3, X2, X1, X0], y = [Y3, Y2, Y1, Y0] (T07 block). Each pin is a variable, 0, 1 or an expression. */
export interface CmpWiring {
  x: string[]
  y: string[]
}

export interface CmpCircuit {
  vars: string[]
  /** Per row: the X and Y values the comparator sees. */
  rows: { row: number; x: number; y: number; out: Record<CmpOutput, Bit> }[]
  fns: Record<CmpOutput, BoolFunction>
  /** Pins driven by a complemented variable or a gate (not allowed in the gate-free questions, T07 p2). */
  gated: string[]
  text: Record<CmpOutput, string>
  why: Record<CmpOutput, Explain>
}

/** Strip leading 0 pins: as numbers, 00AD < 00BC reads AD < BC (AY25/26 Q8). */
export const shortSide = (pins: string[]): string => {
  const k = pins.findIndex((p) => p !== '0')
  return k === -1 ? '0' : pins.slice(k).join('')
}

export const wiringText = (w: CmpWiring, out: CmpOutput): string => `${shortSide(w.x)} ${CMP_SYMBOL[out]} ${shortSide(w.y)}`

export function comparatorCircuit(w: CmpWiring, vars: string[]): Built<{ circuit: CmpCircuit }> {
  if (w.x.length !== w.y.length || w.x.length < 1) return { ok: false, errors: [{ pin: 'x', message: 'X and Y need the same number of pins' }] }
  const n = w.x.length
  const pins = [...w.x.map((t, k) => ({ pin: `X${n - 1 - k}`, text: t })), ...w.y.map((t, k) => ({ pin: `Y${n - 1 - k}`, text: t }))]
  const built = wireAll(pins, vars)
  if (!built.ok) return built
  const xs = built.wires.slice(0, n)
  const ys = built.wires.slice(n)
  const value = (ws: typeof xs, r: number) => ws.reduce((acc, wi) => (acc << 1) | wi.rows[r], 0)
  const rows = range(1 << vars.length).map((row) => {
    const x = value(xs, row)
    const y = value(ys, row)
    return { row, x, y, out: { lt: (x < y ? 1 : 0) as Bit, eq: (x === y ? 1 : 0) as Bit, gt: (x > y ? 1 : 0) as Bit } }
  })
  const fns = {} as Record<CmpOutput, BoolFunction>
  const text = {} as Record<CmpOutput, string>
  const why = {} as Record<CmpOutput, Explain>
  for (const o of CMP_OUTPUTS) {
    fns[o] = fnFromRows(`X${CMP_SYMBOL[o]}Y`, vars, rows.map((r) => r.out[o]))
    text[o] = wiringText(w, o)
    why[o] = {
      rule: `Output X${CMP_SYMBOL[o]}Y is 1 on every row where the unsigned value on X${n - 1}..X0 is ${o === 'lt' ? 'less than' : o === 'eq' ? 'equal to' : 'greater than'} the value on Y${n - 1}..Y0.`,
      working: `${text[o]} gives ${sigmaOf(fns[o])}`,
      cite: 'L17 p30-32; T07 Q5',
    }
  }
  return { ok: true, circuit: { vars, rows, fns, gated: built.wires.filter((x) => x.needsGate).map((x) => x.pin), text, why } }
}

/* ---------- Finder: which single comparator, with no gates, implements F? (T07 Q5, AY24/25 Q7, AY25/26 Q8) ---------- */

export interface CmpSolution {
  x: string[]
  y: string[]
  output: CmpOutput
  /** Course style, leading zeros dropped, e.g. "ABCD > 1011" or "AD < BC". */
  text: string
}

export interface CmpSearch {
  possible: boolean
  /** Every (wiring, output) pair that works (each pin one of the sources). A lower bound when `complete` is false. */
  count: number
  /** False when the search stopped early (too many variables, or the node budget ran out). */
  complete: boolean
  /** The simplest `limit` solutions: variables on X in order first, then shortest text. */
  solutions: CmpSolution[]
  sources: string[]
  why: Explain
}

export interface CmpSearchOptions {
  /** Comparator width: 4 (T07) or 2 (R09 p52). */
  width?: number
  /** Allow constants 0 and 1 on pins (default true, T07 p2). */
  constants?: boolean
  limit?: number
}

/** Largest number of input variables the finder accepts (8 covers the R09 p57 multiple-of-17 detector). */
export const MAX_CMP_VARS = 8
/** Search nodes before the finder stops and reports a partial result. */
const CMP_NODE_BUDGET = 4_000_000

const ORDER: Record<CmpOutput, number> = { eq: 0, lt: 1, gt: 2 }

/** What the ranking needs from one side's pins (source indices, MSB first). */
function sideFeatures(p: number[], sources: string[], n: number): { hasVar: boolean; plain: boolean; natural: boolean; len: number } {
  const k = p.findIndex((s) => sources[s] !== '0')
  const lead = k === -1 ? p.slice(-1) : p.slice(k)
  const v = lead.filter((s) => s < n)
  let plain = true
  let zeros = false
  for (const s of lead) {
    if (sources[s] === '1') plain = false
    else if (sources[s] === '0') zeros = true
    else if (zeros) plain = false
  }
  return {
    hasVar: p.some((s) => s < n),
    plain,
    natural: v.every((s, j) => j === 0 || s > v[j - 1]),
    len: lead.reduce((sum, s) => sum + sources[s].length, 0),
  }
}

/** Rank parts of each side, so rank = xPart + yPart + output order. */
const xPart = (f: ReturnType<typeof sideFeatures>) => ((f.hasVar ? 0 : 4) + (f.plain ? 0 : 2) + (f.natural ? 0 : 1)) * 1e6 + f.len * 4
// A constant Y (ABCD > 0010) reads better than a mixed one of the same length (ABCD > 001A, L17 p33), so it wins ties.
const yPart = (f: ReturnType<typeof sideFeatures>) => (f.natural ? 0 : 1) * 1e6 + (f.len + 3) * 4 + (f.hasVar ? 2 : 0)

/**
 * Numeric rank of a wiring, the way the keys write answers: variables on X, X reads as variables then
 * trailing 0s, each side's variables distinct and in order, then the shortest text, then = before < before >.
 */
const rankOf = (x: number[], y: number[], o: CmpOutput, sources: string[], n: number): number =>
  xPart(sideFeatures(x, sources, n)) + yPart(sideFeatures(y, sources, n)) + ORDER[o]

/** Row masks as 32-bit words (row r is bit r % 32 of word r / 32). */
function columnMasks(vars: string[], sources: string[]): { cols: Uint32Array[]; W: number; rowsN: number } {
  const n = vars.length
  const rowsN = 1 << n
  const W = Math.ceil(rowsN / 32)
  const cols = sources.map((src, s) => {
    const m = new Uint32Array(W)
    for (let r = 0; r < rowsN; r++) if (s < n ? (r >> (n - 1 - s)) & 1 : src === '1') m[r >> 5] |= 1 << (r & 31)
    return m
  })
  return { cols, W, rowsN }
}

const maskOf = (rows: number[], W: number): Uint32Array => {
  const m = new Uint32Array(W)
  for (const r of rows) m[r >> 5] |= 1 << (r & 31)
  return m
}

/**
 * Try every wiring of X(w-1)..X0 and Y(w-1)..Y0 to the uncomplemented variables and the constants, and keep
 * the ones where an output equals F on every care row. The search walks the cascade from the MSB pair (L17 p31):
 * rows where this pair differs are decided here and must already match F, rows where it is equal go down a bit.
 * Every solution is counted and ranked as it is found, so the best ones are never dropped.
 */
export function findComparatorWirings(target: BoolFunction, opts: CmpSearchOptions = {}): CmpSearch {
  const width = opts.width ?? 4
  const limit = opts.limit ?? 50
  const vars = target.vars
  const n = vars.length
  const sources = [...vars, ...(opts.constants === false ? [] : ['0', '1'])]
  const S = sources.length
  if (n > MAX_CMP_VARS || !Number.isInteger(width) || width < 1 || width > 8)
    return {
      possible: false,
      count: 0,
      complete: false,
      solutions: [],
      sources,
      why: {
        rule: n > MAX_CMP_VARS ? `The finder takes at most ${MAX_CMP_VARS} variables. Wire one by hand instead.` : 'The comparator width must be 1 to 8 bits.',
        cite: 'T07 Q5',
      },
    }
  const { cols, W } = columnMasks(vars, sources)
  const on = maskOf(target.on, W)
  const allRows = new Uint32Array(W).map((_, w) => fullWord(w, 1 << n))
  const care = maskOf(target.dc, W).map((d, w) => ~d & allRows[w])
  const off = care.map((c, w) => c & ~on[w])
  const onCare = on.map((v, w) => v & care[w])
  const und = Array.from({ length: width + 1 }, () => new Uint32Array(W))
  const xs: number[] = Array(width).fill(0)
  const ys: number[] = Array(width).fill(0)

  type Entry = { key: number; x: number[]; y: number[]; o: CmpOutput; text?: string }
  let buf: Entry[] = []
  let threshold = Infinity
  const textOf = (e: Entry) => (e.text ??= wiringText({ x: e.x.map((s) => sources[s]), y: e.y.map((s) => sources[s]) }, e.o))
  const cmp = (p: Entry, q: Entry) => p.key - q.key || (textOf(p) < textOf(q) ? -1 : textOf(p) > textOf(q) ? 1 : 0)
  const flush = () => {
    buf.sort(cmp)
    buf = buf.slice(0, limit)
    if (buf.length === limit && limit > 0) threshold = buf[limit - 1].key
  }
  let count = 0
  let nodes = 0
  let o: CmpOutput = 'eq'
  const dfs = (level: number): void => {
    if (++nodes > CMP_NODE_BUDGET) return
    const u = und[level]
    if (level === width) {
      // Rows still undecided have X = Y: X=Y is 1 there, X<Y and X>Y are 0.
      const bad = o === 'eq' ? off : onCare
      for (let w = 0; w < W; w++) if (u[w] & bad[w]) return
      count++
      if (limit > 0) {
        const key = rankOf(xs, ys, o, sources, n)
        if (key <= threshold) {
          buf.push({ key, x: xs.slice(), y: ys.slice(), o })
          if (buf.length >= Math.max(2 * limit, 256)) flush()
        }
      }
      return
    }
    const nx = und[level + 1]
    for (let sx = 0; sx < S; sx++) {
      const a = cols[sx]
      for (let sy = 0; sy < S; sy++) {
        const b = cols[sy]
        let ok = true
        for (let w = 0; w < W && ok; w++) {
          const uw = u[w]
          const aw = a[w]
          const bw = b[w]
          const xGreater = uw & aw & ~bw
          const xLess = uw & ~aw & bw
          if (o === 'eq') ok = ((xGreater | xLess) & onCare[w]) === 0
          else if (o === 'gt') ok = (xGreater & off[w]) === 0 && (xLess & onCare[w]) === 0
          else ok = (xLess & off[w]) === 0 && (xGreater & onCare[w]) === 0
          nx[w] = uw & ~(aw ^ bw)
        }
        if (!ok) continue
        xs[level] = sx
        ys[level] = sy
        dfs(level + 1)
      }
    }
  }
  for (const out of CMP_OUTPUTS) {
    o = out
    und[0].set(allRows)
    dfs(0)
  }
  flush()
  const complete = nodes <= CMP_NODE_BUDGET
  const solutions = buf.map((e) => ({ x: e.x.map((s) => sources[s]), y: e.y.map((s) => sources[s]), output: e.o, text: textOf(e) }))
  return {
    possible: count > 0,
    count,
    complete,
    solutions,
    sources,
    why: count
      ? {
          rule: 'Pins take uncomplemented variables or constants, with no gates. A wiring works when one output equals F on every row except don\'t-cares.',
          working: `${complete ? '' : 'at least '}${count} of ${S ** (2 * width) * 3} (wiring, output) pairs work${solutions.length ? `; simplest: ${solutions[0].text}` : ''}`,
          cite: 'T07 Q5; AY24/25 Q7; AY25/26 Q8',
        }
      : complete
        ? {
            rule: 'No wiring of the pins to variables and constants makes any output equal F.',
            working: `all ${S ** (2 * width)} wirings and 3 outputs checked`,
            cite: 'AY25/26 Q8',
          }
        : { rule: 'The search stopped early, so F may still be possible.', working: `${CMP_NODE_BUDGET} search nodes`, cite: 'T07 Q5' },
  }
}

/** Word w of the all-rows mask. */
function fullWord(w: number, rowsN: number): number {
  const left = rowsN - w * 32
  return left >= 32 ? 0xffffffff : left <= 0 ? 0 : (1 << left) - 1
}

/* ---------- Two comparators and one gate (L17 p33; AY15/16 Q8; AY21/22 S2 Q14c) ---------- */

export type PairGate = 'AND' | 'OR' | 'NAND' | 'NOR'

export interface CmpPairSolution {
  gate: PairGate
  first: CmpSolution
  second: CmpSolution
  /** e.g. "(ABCD > 10) AND (ABCD < 1101)". */
  text: string
}

export interface CmpPairSearch {
  possible: boolean
  /** Distinct (gate, pair of comparator functions) that work. A lower bound when `complete` is false. */
  count: number
  complete: boolean
  solutions: CmpPairSolution[]
  why: Explain
}

/** Largest number of variables the two-comparator search accepts (masks are kept per 16-row function). */
export const MAX_PAIR_VARS = 4
const PAIR_BUDGET = 30_000_000

/**
 * F from two comparators (each wired with no gates) and one gate on one output of each. Every function one
 * comparator can make is listed once with its simplest wiring, then every pair is tried with each gate.
 * A pair of the same function is left out: that is a single comparator.
 */
export function findComparatorPairs(target: BoolFunction, opts: CmpSearchOptions & { gates?: PairGate[] } = {}): CmpPairSearch {
  const width = opts.width ?? 4
  const limit = opts.limit ?? 20
  const gates = opts.gates ?? ['AND', 'OR', 'NAND', 'NOR']
  const vars = target.vars
  const n = vars.length
  if (n > MAX_PAIR_VARS || !Number.isInteger(width) || width < 1 || width > 4)
    return {
      possible: false,
      count: 0,
      complete: false,
      solutions: [],
      why: { rule: `The two-comparator search takes at most ${MAX_PAIR_VARS} variables and comparators of 1 to 4 bits.`, cite: 'L17 p33' },
    }
  const sources = [...vars, ...(opts.constants === false ? [] : ['0', '1'])]
  const S = sources.length
  const rowsN = 1 << n
  const all = (1 << rowsN) - 1
  const col = sources.map((src, s) => range(rowsN).reduce((m, r) => m | ((s < n ? (r >> (n - 1 - s)) & 1 : src === '1' ? 1 : 0) << r), 0))
  const halves = S ** width
  const pinsOf = (h: number): number[] => {
    const out: number[] = []
    for (let k = 0; k < width; k++) {
      out.unshift(h % S)
      h = Math.floor(h / S)
    }
    return out
  }
  const planes = range(halves).map((h) => pinsOf(h).map((s) => col[s]))
  // Best (lowest rank) wiring for every function mask one comparator can make.
  const bestKey = new Float64Array(1 << rowsN).fill(Infinity)
  const bestCode = new Int32Array(1 << rowsN)
  const feats = range(halves).map((h) => sideFeatures(pinsOf(h), sources, n))
  const xs = feats.map(xPart)
  const ys = feats.map(yPart)
  const offer = (mask: number, key: number, code: number) => {
    if (key < bestKey[mask]) {
      bestKey[mask] = key
      bestCode[mask] = code
    }
  }
  for (let hx = 0; hx < halves; hx++) {
    const px = planes[hx]
    for (let hy = 0; hy < halves; hy++) {
      const py = planes[hy]
      let eq = all
      let gt = 0
      let lt = 0
      for (let k = 0; k < width; k++) {
        gt |= eq & px[k] & ~py[k]
        lt |= eq & ~px[k] & py[k]
        eq &= ~(px[k] ^ py[k])
      }
      const base = xs[hx] + ys[hy]
      const code = (hx * halves + hy) * 3
      offer(eq & all, base, code)
      offer(lt & all, base + 1, code + 1)
      offer(gt & all, base + 2, code + 2)
    }
  }
  const masks = range(1 << rowsN).filter((m) => bestKey[m] !== Infinity)
  const solOf = (mask: number): CmpSolution => {
    const code = bestCode[mask]
    const o = CMP_OUTPUTS.find((x) => ORDER[x] === code % 3) as CmpOutput
    const pair = Math.floor(code / 3)
    const x = pinsOf(Math.floor(pair / halves)).map((s) => sources[s])
    const y = pinsOf(pair % halves).map((s) => sources[s])
    return { x, y, output: o, text: wiringText({ x, y }, o) }
  }
  const dc = target.dc.reduce((m, r) => m | (1 << r), 0)
  const care = all & ~dc
  const on = target.on.reduce((m, r) => m | (1 << r), 0) & care
  const found: { gate: PairGate; a: number; b: number; key: number }[] = []
  let count = 0
  let steps = 0
  for (const gate of gates) {
    // NAND and NOR: the AND or OR of the two outputs must be F'.
    const want = gate === 'AND' || gate === 'OR' ? on : care & ~on
    const zero = care & ~want
    const and = gate === 'AND' || gate === 'NAND'
    const cand = masks.filter((m) => (and ? (m & want) === want : (m & zero) === 0))
    for (let i = 0; i < cand.length && steps < PAIR_BUDGET; i++)
      for (let j = i + 1; j < cand.length; j++) {
        steps++
        const a = cand[i]
        const b = cand[j]
        if (and ? (a & b & zero) === 0 : ((a | b) & want) === want) {
          count++
          found.push({ gate, a, b, key: bestKey[a] + bestKey[b] })
          if (found.length > 4 * limit + 64) {
            found.sort((p, q) => p.key - q.key)
            found.length = limit
          }
        }
      }
  }
  found.sort((p, q) => p.key - q.key)
  const solutions = found.slice(0, limit).map(({ gate, a, b }) => {
    const first = solOf(a)
    const second = solOf(b)
    return { gate, first, second, text: `(${first.text}) ${gate} (${second.text})` }
  })
  const complete = steps < PAIR_BUDGET
  return {
    possible: count > 0,
    count,
    complete,
    solutions,
    why: count
      ? {
          rule: 'Each comparator is wired with no gates and gives one output; the gate combines the two outputs. For a range, AND a lower bound with an upper bound (L17 p33).',
          working: `${complete ? '' : 'at least '}${count} (gate, pair) choices work; simplest: ${solutions[0].text}`,
          cite: 'L17 p33; AY15/16 Q8; AY21/22 S2 Q14c',
        }
      : {
          rule: 'No pair of single-comparator functions gives F through one of these gates.',
          working: `${masks.length} single-comparator functions, gates ${gates.join(', ')}`,
          cite: 'L17 p33',
        },
  }
}

/** Does this wiring and output implement F on every care row? */
export function implementsWith(target: BoolFunction, w: CmpWiring, output: CmpOutput): boolean {
  const c = comparatorCircuit(w, target.vars)
  if (!c.ok) return false
  const dc = new Set(target.dc)
  const on = new Set(target.on)
  return c.circuit.rows.every((r) => dc.has(r.row) || r.out[output] === (on.has(r.row) ? 1 : 0))
}

