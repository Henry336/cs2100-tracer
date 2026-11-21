/** Half adder, full adder and the n-bit ripple-carry (parallel) adder with gate-delay timing (L17). */
import { bin, range, type Bit, type Built, type Explain, type PinIssue } from './signals'

export interface HalfAdder {
  x: Bit
  y: Bit
  c: Bit
  s: Bit
  why: { c: Explain; s: Explain }
}

/** C = X∙Y, S = X⊕Y (L17 p6-7). */
export function halfAdder(x: Bit, y: Bit): HalfAdder {
  const c = (x & y) as Bit
  const s = (x ^ y) as Bit
  return {
    x,
    y,
    c,
    s,
    why: {
      c: { rule: 'Half adder carry C = X∙Y', working: `${x}∙${y} = ${c}`, cite: 'L17 p7' },
      s: { rule: 'Half adder sum S = X⊕Y', working: `${x}⊕${y} = ${s}`, cite: 'L17 p7' },
    },
  }
}

export interface FullAdder {
  x: Bit
  y: Bit
  z: Bit
  /** First half adder on X, Y. */
  ha1: HalfAdder
  /** Second half adder on X⊕Y and Z. */
  ha2: HalfAdder
  s: Bit
  c: Bit
  why: { c: Explain; s: Explain }
}

/** S = X⊕Y⊕Z, C = X∙Y + (X⊕Y)∙Z, built from 2 half adders and an OR gate (L17 p9-12). Z is the carry-in. */
export function fullAdder(x: Bit, y: Bit, z: Bit): FullAdder {
  const ha1 = halfAdder(x, y)
  const ha2 = halfAdder(ha1.s, z)
  const c = (ha1.c | ha2.c) as Bit
  return {
    x,
    y,
    z,
    ha1,
    ha2,
    s: ha2.s,
    c,
    why: {
      s: { rule: 'S = X⊕Y⊕Z: the sum bit is 1 when an odd number of inputs are 1', working: `${x}⊕${y}⊕${z} = ${ha2.s}`, cite: 'L17 p10' },
      c: {
        rule: 'C = X∙Y + (X⊕Y)∙Z: carry out when at least two inputs are 1',
        working: `${x}∙${y} + (${x}⊕${y})∙${z} = ${ha1.c} + ${ha1.s}∙${z} = ${c}`,
        cite: 'L17 p11-12',
      },
    },
  }
}

/** Arrival times of every gate output in one full adder, in units of the gate delay t (L17 p34, p37). */
export interface FullAdderTiming {
  /** When Xi, Yi and Ci are stable. */
  xy: number
  cin: number
  /** X⊕Y and X∙Y of the first half adder. */
  ha1: number
  /** Sum and carry gates of the second half adder. */
  ha2: number
  s: number
  cout: number
  why: { s: Explain; cout: Explain }
}

const T = (n: number) => (n === 0 ? '0' : n === 1 ? 't' : `${n}t`)

/** Output time = max(input times) + t for every gate, with the FA drawn as 2 half adders + OR (L17 p35, p37). */
export function fullAdderTiming(cin: number, xy = 0): FullAdderTiming {
  const ha1 = xy + 1
  const ha2 = Math.max(ha1, cin) + 1
  const cout = Math.max(ha1, ha2) + 1
  return {
    xy,
    cin,
    ha1,
    ha2,
    s: ha2,
    cout,
    why: {
      s: {
        rule: 'Each gate output is stable at max(input times) + t. S comes out of the second XOR, which waits for X⊕Y and Ci.',
        working: `X⊕Y at max(${T(xy)}, ${T(xy)}) + t = ${T(ha1)}; S at max(${T(ha1)}, ${T(cin)}) + t = ${T(ha2)}`,
        cite: 'L17 p34, p37',
      },
      cout: {
        rule: 'C out of the OR gate, which waits for X∙Y and (X⊕Y)∙Ci.',
        working: `(X⊕Y)∙Ci at max(${T(ha1)}, ${T(cin)}) + t = ${T(ha2)}; C at max(${T(ha1)}, ${T(ha2)}) + t = ${T(cout)}`,
        cite: 'L17 p35, p37',
      },
    },
  }
}

/** One full adder in the chain. `i` is the lecture numbering (1 = LSB), `bit` the tutorial numbering (0 = LSB). */
export interface AdderStage {
  i: number
  bit: number
  fa: FullAdder
  timing: FullAdderTiming
  /** Names as the lecture writes them: Xi, Yi, Ci, Si, Ci+1. */
  names: { x: string; y: string; cin: string; s: string; cout: string }
}

export interface AdderFrame {
  /** Stage being computed (index into `stages`), or null for the input and result frames. */
  stage: number | null
  label: string
  /** Sum bits known so far, LSB first; null if not yet computed. */
  sums: (Bit | null)[]
  /** Carries C1..Cn+1 known so far (C1 is the carry-in). */
  carries: (Bit | null)[]
  /** Time (units of t) when everything shown in this frame is stable. */
  time: number
  why: Explain
}

export interface AdderTrace {
  width: number
  x: number
  y: number
  cin: Bit
  stages: AdderStage[]
  frames: AdderFrame[]
  sum: number
  cout: Bit
  /** sum + cout∙2^n: the full (n+1)-bit result as an unsigned number. */
  total: number
  /** Column addition rows as on L17 p27, MSB first. */
  columns: { carryIn: string; x: string; y: string; sum: string; carryOut: string }
  delay: { s: number; cout: number; why: Explain }
  why: { total: Explain }
}

export interface RippleOptions {
  width: number
  x: number
  y: number
  cin?: Bit
}

/** n-bit ripple-carry adder: full adders chained by their carries (L17 p18-21, p24), with the delay of every stage (p36-38). */
export function rippleAdd(o: RippleOptions): Built<{ trace: AdderTrace }> {
  const { width: n, x, y } = o
  const cin = o.cin ?? 0
  const errors: PinIssue[] = []
  if (!Number.isInteger(n) || n < 1 || n > 32) errors.push({ pin: 'width', message: 'width must be 1 to 32 bits' })
  else {
    const max = 2 ** n
    if (!Number.isInteger(x) || x < 0 || x >= max) errors.push({ pin: 'x', message: `X must be 0 to ${max - 1} for ${n} bits` })
    if (!Number.isInteger(y) || y < 0 || y >= max) errors.push({ pin: 'y', message: `Y must be 0 to ${max - 1} for ${n} bits` })
  }
  if (errors.length) return { ok: false, errors }

  const bitOf = (v: number, k: number) => (Math.floor(v / 2 ** k) % 2) as Bit
  const stages: AdderStage[] = []
  let c: Bit = cin
  let cTime = 0
  for (const k of range(n)) {
    const fa = fullAdder(bitOf(x, k), bitOf(y, k), c)
    const timing = fullAdderTiming(cTime)
    const i = k + 1
    stages.push({ i, bit: k, fa, timing, names: { x: `X${i}`, y: `Y${i}`, cin: `C${i}`, s: `S${i}`, cout: `C${i + 1}` } })
    c = fa.c
    cTime = timing.cout
  }
  const sum = stages.reduce((acc, s) => acc + s.fa.s * 2 ** s.bit, 0)
  const cout = c
  const total = sum + cout * 2 ** n

  const frames: AdderFrame[] = []
  const sums: (Bit | null)[] = Array(n).fill(null)
  const carries: (Bit | null)[] = [cin, ...Array(n).fill(null)]
  frames.push({
    stage: null,
    label: 'Inputs',
    sums: [...sums],
    carries: [...carries],
    time: 0,
    why: { rule: 'All inputs X, Y and C1 are stable at time 0.', cite: 'L17 p35-36' },
  })
  stages.forEach((s, idx) => {
    sums[idx] = s.fa.s
    carries[idx + 1] = s.fa.c
    frames.push({
      stage: idx,
      label: `FA ${s.i}: ${s.names.x}=${s.fa.x}, ${s.names.y}=${s.fa.y}, ${s.names.cin}=${s.fa.z}`,
      sums: [...sums],
      carries: [...carries],
      time: s.timing.cout,
      why: {
        rule: `Full adder ${s.i} adds ${s.names.x}, ${s.names.y} and the carry ${s.names.cin} from the stage below.`,
        working: `${s.fa.x} + ${s.fa.y} + ${s.fa.z} = ${s.fa.c}${s.fa.s} (binary), so ${s.names.s} = ${s.fa.s} at ${T(s.timing.s)} and ${s.names.cout} = ${s.fa.c} at ${T(s.timing.cout)}`,
        cite: 'L17 p20, p37',
      },
    })
  })
  const last = stages[n - 1].timing
  frames.push({
    stage: null,
    label: 'Result',
    sums: [...sums],
    carries: [...carries],
    time: last.cout,
    why: {
      rule: `The result is C${n + 1} followed by S${n}..S1.`,
      working: `${cout}${bin(sum, n)} = ${total}`,
      cite: 'L17 p20',
    },
  })

  const carryBits = stages.map((s) => s.fa.z)
  const outBits = stages.map((s) => s.fa.c)
  const msbFirst = (bits: Bit[]) => [...bits].reverse().join('')
  return {
    ok: true,
    trace: {
      width: n,
      x,
      y,
      cin,
      stages,
      frames,
      sum,
      cout,
      total,
      columns: { carryIn: msbFirst(carryBits), x: bin(x, n), y: bin(y, n), sum: bin(sum, n), carryOut: msbFirst(outBits) },
      delay: {
        s: last.s,
        cout: last.cout,
        why: {
          rule: `For an n-bit ripple-carry adder, Sn = ((n-1)∙2+2)t and Cn+1 = ((n-1)∙2+3)t: each stage waits 2t more for its carry.`,
          working: `n = ${n}: S${n} = ((${n}-1)∙2+2)t = ${T(last.s)}, C${n + 1} = ((${n}-1)∙2+3)t = ${T(last.cout)}`,
          cite: 'L17 p38',
        },
      },
      why: {
        total: {
          rule: 'Unsigned sum X + Y + C1; the carry out is the extra MSB.',
          working: `${x} + ${y} + ${cin} = ${total}`,
          cite: 'L17 p18-20',
        },
      },
    },
  }
}

/** Delay of S_n and C_n+1 for an n-bit ripple-carry adder, in units of t (L17 p38). */
export const rippleDelay = (n: number): { s: number; cout: number } => ({ s: (n - 1) * 2 + 2, cout: (n - 1) * 2 + 3 })
