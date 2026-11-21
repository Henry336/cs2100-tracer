/** Flip-flop characteristic and excitation tables (L19 p18-23, p27, p45) and one-step next-state rules. */
import type { Bit, Explain, FFType, Sig } from './types'

export interface CharRow {
  /** Input values in FF_INPUTS order. */
  inputs: Bit[]
  /** Q(t+1): a constant, 'Q' (no change), "Q'" (toggle) or '?' (invalid). */
  next: 0 | 1 | 'Q' | "Q'" | '?'
  comment: 'No change' | 'Reset' | 'Set' | 'Toggle' | 'Invalid'
}

export interface FFInfo {
  type: FFType
  name: string
  characteristic: CharRow[]
  /** Q+ equation in course notation. */
  equation: string
  cite: string
}

export const FLIP_FLOPS: Record<FFType, FFInfo> = {
  SR: {
    type: 'SR',
    name: 'S-R flip-flop',
    characteristic: [
      { inputs: [0, 0], next: 'Q', comment: 'No change' },
      { inputs: [0, 1], next: 0, comment: 'Reset' },
      { inputs: [1, 0], next: 1, comment: 'Set' },
      { inputs: [1, 1], next: '?', comment: 'Invalid' },
    ],
    equation: "Q+ = S + R'∙Q (with S∙R = 0)",
    cite: 'L19 p11, p18, p27',
  },
  D: {
    type: 'D',
    name: 'D flip-flop',
    characteristic: [
      { inputs: [0], next: 0, comment: 'Reset' },
      { inputs: [1], next: 1, comment: 'Set' },
    ],
    equation: 'Q+ = D',
    cite: 'L19 p19, p27',
  },
  JK: {
    type: 'JK',
    name: 'J-K flip-flop',
    characteristic: [
      { inputs: [0, 0], next: 'Q', comment: 'No change' },
      { inputs: [0, 1], next: 0, comment: 'Reset' },
      { inputs: [1, 0], next: 1, comment: 'Set' },
      { inputs: [1, 1], next: "Q'", comment: 'Toggle' },
    ],
    equation: "Q+ = J∙Q' + K'∙Q",
    cite: 'L19 p22, p27',
  },
  T: {
    type: 'T',
    name: 'T flip-flop',
    characteristic: [
      { inputs: [0], next: 'Q', comment: 'No change' },
      { inputs: [1], next: "Q'", comment: 'Toggle' },
    ],
    equation: "Q+ = T∙Q' + T'∙Q",
    cite: 'L19 p23, p27',
  },
}

/** Excitation table (L19 p45): the flip-flop inputs that move Q to Q+, indexed [Q][Q+], in FF_INPUTS order. */
export const EXCITATION: Record<FFType, Sig[][][]> = {
  JK: [
    [[0, 'X'], [1, 'X']],
    [['X', 1], ['X', 0]],
  ],
  SR: [
    [[0, 'X'], [1, 0]],
    [[0, 1], ['X', 0]],
  ],
  D: [[[0], [1]], [[0], [1]]],
  T: [[[0], [1]], [[1], [0]]],
}

const showInputs = (type: FFType, vals: Sig[]) => {
  const letters = type === 'JK' ? ['J', 'K'] : type === 'SR' ? ['S', 'R'] : [type]
  return letters.map((l, i) => `${l} = ${vals[i]}`).join(', ')
}

/**
 * Q(t+1) of one flip-flop from its inputs and Q(t), with the characteristic-table rule used.
 * `name` labels the working (e.g. 'A'). An S-R flip-flop with S = R = 1 gives X (invalid, L19 p18).
 */
export function ffNext(type: FFType, inputs: Sig[], q: Sig, name = 'Q'): { next: Sig; why: Explain; comment: CharRow['comment'] } {
  const info = FLIP_FLOPS[type]
  const shown = showInputs(type, inputs)
  const fixed = inputs.every((v) => v !== 'X') ? info.characteristic.find((r) => r.inputs.every((v, i) => v === inputs[i])) : undefined
  // Set and reset fix Q+ whatever Q was (L19 p18, p22, p27), so only no change and toggle need a known Q.
  if (q === 'X' && fixed && (fixed.next === 0 || fixed.next === 1)) {
    return { next: fixed.next, comment: fixed.comment, why: { rule: `${info.name}: ${info.equation}.`, working: `${shown}: ${fixed.comment.toLowerCase()}, so ${name}+ = ${fixed.next} whatever ${name} was`, cite: info.cite } }
  }
  if (inputs.some((v) => v === 'X') || q === 'X') {
    const known = type === 'D' && inputs[0] !== 'X'
    const next: Sig = known ? (inputs[0] as Bit) : 'X'
    return {
      next,
      comment: known ? (next ? 'Set' : 'Reset') : 'Invalid',
      why: { rule: `${info.name}: ${info.equation}.`, working: `${shown}, ${name} = ${q}: ${known ? `${name}+ = D = ${next}` : 'an unknown value gives an unknown next state'}`, cite: info.cite },
    }
  }
  const row = info.characteristic.find((r) => r.inputs.every((v, i) => v === inputs[i]))!
  const next: Sig = row.next === 'Q' ? q : row.next === "Q'" ? ((1 - q) as Bit) : row.next === '?' ? 'X' : row.next
  const how =
    row.next === 'Q'
      ? `no change, so ${name}+ = ${name} = ${next}`
      : row.next === "Q'"
        ? `toggle, so ${name}+ = ${name}' = ${next}`
        : row.next === '?'
          ? `S = R = 1 is invalid, so ${name}+ is unpredictable`
          : `${row.comment.toLowerCase()}, so ${name}+ = ${next}`
  return { next, comment: row.comment, why: { rule: `${info.name}: ${info.equation}.`, working: `${shown}: ${how}`, cite: info.cite } }
}

/** Flip-flop inputs needed for the move Q -> Q+, from the excitation table (L19 p45). */
export function excite(type: FFType, q: Bit, qNext: Bit, name = 'Q'): { inputs: Sig[]; why: Explain } {
  const inputs = EXCITATION[type][q][qNext]
  const letters = type === 'JK' ? ['J', 'K'] : type === 'SR' ? ['S', 'R'] : [type]
  const reason =
    type === 'JK'
      ? q === qNext
        ? `${q ? 'no change (0,0) or set (1,0)' : 'no change (0,0) or reset (0,1)'} both work, so ${q ? 'J' : 'K'} is free`
        : `${qNext ? 'set (1,0) or toggle (1,1)' : 'reset (0,1) or toggle (1,1)'} both work, so ${qNext ? 'K' : 'J'} is free`
      : type === 'SR'
        ? q === qNext
          ? `no change (0,0) or ${q ? 'set (1,0)' : 'reset (0,1)'} both work`
          : qNext
            ? 'only set (1,0) works'
            : 'only reset (0,1) works'
        : type === 'D'
          ? `D is the next state`
          : q === qNext
            ? 'no change needs T = 0'
            : 'a change needs T = 1'
  return {
    inputs,
    why: {
      rule: 'Excitation table: the inputs that move the flip-flop from Q to Q+.',
      working: `${name}: ${q} -> ${qNext}: ${reason}. Inputs: ${letters.map((l, i) => `${l}${name === 'Q' ? '' : name} = ${inputs[i]}`).join(', ')}`,
      cite: 'L19 p44-45',
    },
  }
}

/* ---------- Latches, gate level (L19 p9-15; R10 p6) ---------- */

export type LatchType = 'sr-nor' | 'sr-nand' | 'gated-sr' | 'gated-d'

export interface LatchInfo {
  type: LatchType
  name: string
  /** Input names in order. */
  inputs: string[]
  /** Command table: input values -> what happens. */
  commands: { inputs: Bit[]; next: 0 | 1 | 'Q' | '?'; comment: string }[]
  equation?: string
  cite: string
}

export const LATCHES: Record<LatchType, LatchInfo> = {
  'sr-nor': {
    type: 'sr-nor',
    name: 'Active-high S-R latch (NOR)',
    inputs: ['S', 'R'],
    commands: [
      { inputs: [0, 0], next: 'Q', comment: 'No change' },
      { inputs: [0, 1], next: 0, comment: 'Reset' },
      { inputs: [1, 0], next: 1, comment: 'Set' },
      { inputs: [1, 1], next: '?', comment: 'Invalid: Q = Q\' = 0' },
    ],
    equation: "Q+ = S + R'∙Q (with S∙R = 0)",
    cite: 'L19 p9-11',
  },
  'sr-nand': {
    type: 'sr-nand',
    name: 'Active-low S-R latch (NAND)',
    inputs: ["S'", "R'"],
    commands: [
      { inputs: [0, 0], next: '?', comment: 'Invalid: Q = Q\' = 1' },
      { inputs: [0, 1], next: 1, comment: 'Set' },
      { inputs: [1, 0], next: 0, comment: 'Reset' },
      { inputs: [1, 1], next: 'Q', comment: 'No change' },
    ],
    cite: 'L19 p12 (you may skip this slide)',
  },
  'gated-sr': {
    type: 'gated-sr',
    name: 'Gated S-R latch',
    inputs: ['EN', 'S', 'R'],
    commands: [
      { inputs: [0, 0, 0], next: 'Q', comment: 'EN = 0: no change' },
      { inputs: [1, 0, 0], next: 'Q', comment: 'No change' },
      { inputs: [1, 0, 1], next: 0, comment: 'Reset' },
      { inputs: [1, 1, 0], next: 1, comment: 'Set' },
      { inputs: [1, 1, 1], next: '?', comment: "Invalid: Q = Q' = 1" },
    ],
    cite: 'L19 p13',
  },
  'gated-d': {
    type: 'gated-d',
    name: 'Gated D latch',
    inputs: ['EN', 'D'],
    commands: [
      { inputs: [0, 0], next: 'Q', comment: 'EN = 0: no change' },
      { inputs: [1, 0], next: 0, comment: 'Reset' },
      { inputs: [1, 1], next: 1, comment: 'Set' },
    ],
    equation: 'When EN = 1, Q+ = D',
    cite: 'L19 p14-15',
  },
}

export interface LatchRound {
  round: number
  q: Bit
  qBar: Bit
  /** Gate outputs that changed this round. */
  changed: ('Q' | "Q'")[]
}

export interface LatchSettle {
  /** Values the cross-coupled pair sees: S and R for the NOR latch; the active-low S' and R' for the NAND latch and the gated latches (after their front NANDs). */
  s: Bit
  r: Bit
  rounds: LatchRound[]
  /** Final Q, or X when the pair never settles (both inputs released together from Q = Q'). */
  q: Sig
  qBar: Sig
  stable: boolean
  invalid: boolean
  why: Explain
}

const nor = (a: Bit, b: Bit): Bit => (a | b ? 0 : 1)
const nand = (a: Bit, b: Bit): Bit => (a & b ? 0 : 1)

/**
 * Settle a latch gate by gate. Both cross-coupled gates are evaluated from the previous round's values,
 * repeated until nothing changes (R10 p6: trace about 3 rounds). Returns X if it oscillates.
 */
export function settleLatch(type: LatchType, values: Record<string, Bit>, q: Bit, qBar: Bit = (1 - q) as Bit, maxRounds = 6): LatchSettle {
  const info = LATCHES[type]
  let s: Bit
  let r: Bit
  // Gated latches are two front NANDs into a NAND latch (L19 p13-14, drawn as bubbled ORs per p12; R10 p9).
  const nandPair = type !== 'sr-nor'
  if (type === 'gated-d') {
    s = nand(values.EN, values.D)
    r = nand(values.EN, (1 - values.D) as Bit)
  } else if (type === 'gated-sr') {
    s = nand(values.EN, values.S)
    r = nand(values.EN, values.R)
  } else if (type === 'sr-nand') {
    s = values["S'"]
    r = values["R'"]
  } else {
    s = values.S
    r = values.R
  }
  const rounds: LatchRound[] = [{ round: 0, q, qBar, changed: [] }]
  let cq = q
  let cqb = qBar
  let stable = false
  for (let k = 1; k <= maxRounds; k++) {
    // NOR pair: Q = NOR(R, Q'), Q' = NOR(S, Q). NAND pair: Q = NAND(S', Q'), Q' = NAND(R', Q).
    const nq = nandPair ? nand(s, cqb) : nor(r, cqb)
    const nqb = nandPair ? nand(r, cq) : nor(s, cq)
    const changed: LatchRound['changed'] = []
    if (nq !== cq) changed.push('Q')
    if (nqb !== cqb) changed.push("Q'")
    if (!changed.length) {
      stable = true
      break
    }
    cq = nq
    cqb = nqb
    rounds.push({ round: k, q: cq, qBar: cqb, changed })
  }
  const invalid = stable && cq === cqb
  const inputsText = info.inputs.map((n) => `${n} = ${values[n]}`).join(', ')
  const cmd = info.commands.find((c) => c.inputs.every((v, i) => v === values[info.inputs[i]]))
  return {
    s,
    r,
    rounds,
    q: stable ? cq : 'X',
    qBar: stable ? cqb : 'X',
    stable,
    invalid,
    why: {
      rule: `${info.name}: ${info.commands.map((c) => `${c.inputs.join('')} ${c.comment.toLowerCase()}`).join('; ')}.`,
      working: stable
        ? `${inputsText}: settles after ${rounds.length - 1} round${rounds.length === 2 ? '' : 's'} at Q = ${cq}, Q' = ${cqb}${invalid ? ' (Q and Q\' equal: invalid)' : ''}${cmd ? ` (${cmd.comment.toLowerCase()})` : ''}`
        : `${inputsText}: the two gates keep flipping together, so Q is indeterminate`,
      cite: `${info.cite}; R10 p6`,
    },
  }
}
