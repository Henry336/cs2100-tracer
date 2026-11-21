/** Johnson and ring counters as plain D flip-flop circuits (beyond the course: only AY23/24 S2 Q14 uses them). */
import type { CircuitSpec, Explain } from './types'

export type CounterKind = 'johnson' | 'ring'

/**
 * A chain of D flip-flops, each copying the one before it. The first takes the last flip-flop's Q' (Johnson)
 * or Q (ring). Analyse it like any other circuit, e.g. with `analyse` and `sequenceFrom`.
 */
export function shiftCounter(kind: CounterKind, bits: string[] = ['W', 'X', 'Y', 'Z']): { circuit: CircuitSpec; note: Explain } {
  const last = bits[bits.length - 1]
  const circuit: CircuitSpec = {
    flipFlops: bits.map((b, i) => ({ name: b, type: 'D', inputs: { D: i ? bits[i - 1] : kind === 'johnson' ? `${last}'` : last } })),
    inputs: [],
  }
  const k = bits.length
  return {
    circuit,
    note: {
      rule: 'Beyond the course: counters and shift registers are not taught by name, so treat this as D flip-flop analysis.',
      working:
        kind === 'johnson'
          ? `the last Q' feeds the first D: ${2 * k} states in the main cycle (2n for n flip-flops)`
          : `the last Q feeds the first D: a single 1 circulates through ${k} states (n for n flip-flops)`,
      cite: 'AY23/24 S2 Q14; L19 p20',
    },
  }
}
