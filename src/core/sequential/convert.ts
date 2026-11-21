/**
 * Flip-flop conversion: drive the flip-flop you have so it behaves like the one you want. This is the design
 * procedure of L19 p46 applied to one flip-flop: the wanted characteristic table gives Q+, the excitation table
 * of the flip-flop you have gives its inputs (L19 p44-45). Not a slide topic by itself (beyond the course).
 */
import { functionFromValues, minimize } from '../boolean'
import { EXCITATION, FLIP_FLOPS, ffNext } from './flipflops'
import { FF_INPUTS } from './types'
import type { Bit, Explain, FFType, Sig } from './types'

export interface ConvertRow {
  /** Row index over (wanted inputs, Q), MSB first. */
  index: number
  /** Wanted flip-flop's input values, in FF_INPUTS order. */
  inputs: Bit[]
  q: Bit
  /** Q+ from the wanted characteristic table; X when the wanted command is invalid (S = R = 1). */
  next: Sig
  /** Inputs of the flip-flop you have, in FF_INPUTS order. */
  have: Sig[]
  why: Explain
}

export interface Conversion {
  have: FFType
  want: FFType
  /** Variables of every equation: the wanted inputs, then Q. */
  vars: string[]
  rows: ConvertRow[]
  equations: { label: string; text: string; why: Explain }[]
}

export function convertFlipFlop(have: FFType, want: FFType): Conversion {
  const wantIn = FF_INPUTS[want]
  const haveIn = FF_INPUTS[have]
  const vars = [...wantIn, 'Q']
  const n = vars.length
  const rows: ConvertRow[] = []
  for (let index = 0; index < 1 << n; index++) {
    const all = vars.map((_, i) => ((index >> (n - 1 - i)) & 1) as Bit)
    const inputs = all.slice(0, -1)
    const q = all[n - 1]
    const step = ffNext(want, inputs, q)
    const next = step.next
    const have_: Sig[] = next === 'X' ? haveIn.map((): Sig => 'X') : EXCITATION[have][q][next]
    rows.push({
      index,
      inputs,
      q,
      next,
      have: have_,
      why: {
        rule: `Read Q+ from the ${FLIP_FLOPS[want].name} characteristic table, then the ${FLIP_FLOPS[have].name} inputs for Q -> Q+ from its excitation table.`,
        working:
          next === 'X'
            ? `${step.why.working}: never used, so every input is X`
            : `${step.why.working}; move ${q} -> ${next} needs ${haveIn.map((l, k) => `${l} = ${have_[k]}`).join(', ')}`,
        cite: `${FLIP_FLOPS[want].cite}; L19 p44-46`,
      },
    })
  }
  const equations = haveIn.map((label, k) => {
    const fn = functionFromValues(vars, rows.map((r) => r.have[k]), label)
    const min = minimize(fn)
    const text = min.summary.answer
    return {
      label,
      text,
      why: {
        rule: "Group the 1s with the don't-cares, as for any flip-flop input in a design.",
        working: `${label} = Σm(${fn.on.join(',')})${fn.dc.length ? ` + d(${fn.dc.join(',')})` : ''} over ${vars.join(', ')} = ${text}`,
        cite: 'L19 p46, p50',
      },
    }
  })
  return { have, want, vars, rows, equations }
}
