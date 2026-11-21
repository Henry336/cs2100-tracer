// Single-cycle vs multi-cycle vs pipelined timing (L20 p31-33).
import type { Explain, OpClass } from './types'

/** Stages each class uses in a multi-cycle design that skips unused stages (AY23/24 S1 Q3 key). */
export const STAGES_USED: Record<OpClass, number> = { alu: 4, load: 5, store: 4, branch: 3, jump: 2, jr: 2, other: 4 }

export interface TimingInput {
  /** Instructions executed (I). */
  instructions: number
  /** Stage times T1..TN (same unit throughout, usually ns). */
  stageTimes?: number[]
  /** Pipeline register delay Td. */
  td?: number
  /** Average CPI for multi-cycle. Ignored when `mix` is given. */
  cpi?: number
  /** Instruction counts by class; multi-cycle cycles = sum of count x stages used. */
  mix?: Partial<Record<OpClass, number>>
  /** Single-cycle cycle time when given directly (e.g. from a 100 MHz clock: 10 ns). */
  singleCycleTime?: number
  /** Pipelined cycle time when given directly. */
  pipelineCycleTime?: number
  /** Number of pipeline stages N. Default stageTimes.length, else 5. */
  stages?: number
}

export interface DesignTime {
  cycleTime: number
  cycles: number
  time: number
  why: { cycleTime: Explain; cycles: Explain; time: Explain }
}

export interface TimingResult {
  single?: DesignTime
  multi?: DesignTime
  pipelined?: DesignTime
  /** Clock rate in GHz of the multi-cycle (and pipeline before Td) design: 1 / max stage time in ns. */
  multiClockGHz?: number
  speedup?: { value: number; why: Explain }
}

const r9 = (x: number) => Math.round(x * 1e9) / 1e9
const fmt = (x: number) => String(r9(x))

export function idealCycles(instructions: number, stages = 5): { cycles: number; why: Explain } {
  if (instructions <= 0) return { cycles: 0, why: { rule: 'No instructions, so no cycles', cite: 'L20 p32' } }
  const cycles = instructions + stages - 1
  return { cycles, why: { rule: 'Ideal pipeline: the first instruction takes N cycles, then one finishes every cycle', working: `I + N - 1 = ${instructions} + ${stages} - 1 = ${cycles}`, cite: 'L20 p32; R11 p5' } }
}

export function timing(t: TimingInput): TimingResult {
  const I = t.instructions
  const st = t.stageTimes?.length ? t.stageTimes : undefined
  const N = t.stages ?? st?.length ?? 5
  const out: TimingResult = {}
  const sum = st ? st.reduce((a, b) => a + b, 0) : undefined
  const max = st ? Math.max(...st) : undefined

  const singleCT = t.singleCycleTime ?? sum
  if (singleCT !== undefined) {
    out.single = {
      cycleTime: r9(singleCT), cycles: I, time: r9(I * singleCT),
      why: {
        cycleTime: t.singleCycleTime !== undefined
          ? { rule: 'Cycle time as given (1 / clock rate)', working: fmt(singleCT), cite: 'L20 p34' }
          : { rule: 'Single-cycle: the clock must fit the slowest instruction, which uses every stage', working: `${st!.join(' + ')} = ${fmt(singleCT)}`, cite: 'L20 p31' },
        cycles: { rule: 'One cycle per instruction', working: `${I}`, cite: 'L20 p31' },
        time: { rule: 'Time = I x CT', working: `${I} x ${fmt(singleCT)} = ${fmt(I * singleCT)}`, cite: 'L20 p31' },
      },
    }
  }

  if (max !== undefined) {
    out.multiClockGHz = r9(1 / max)
    let cycles: number | undefined
    let cyclesWhy: Explain | undefined
    if (t.mix) {
      const parts = Object.entries(t.mix).filter(([, n]) => n) as [OpClass, number][]
      cycles = parts.reduce((a, [c, n]) => a + n * STAGES_USED[c], 0)
      cyclesWhy = { rule: 'Each instruction takes one cycle per stage it uses (R-type/addi 4, lw 5, sw 4, branch 3, j 2)', working: `${parts.map(([c, n]) => `${n} x ${STAGES_USED[c]}`).join(' + ')} = ${cycles}`, cite: 'AY23/24 S1 Q3 key' }
    } else if (t.cpi !== undefined) {
      cycles = r9(I * t.cpi)
      cyclesWhy = { rule: 'Cycles = I x average CPI', working: `${I} x ${t.cpi} = ${fmt(cycles)}`, cite: 'L20 p31' }
    }
    if (cycles !== undefined && cyclesWhy) {
      out.multi = {
        cycleTime: max, cycles, time: r9(cycles * max),
        why: {
          cycleTime: { rule: 'Multi-cycle: one stage per cycle, so the slowest stage sets the clock', working: `max(${st!.join(', ')}) = ${fmt(max)}`, cite: 'L20 p31' },
          cycles: cyclesWhy,
          time: { rule: 'Time = cycles x CT', working: `${fmt(cycles)} x ${fmt(max)} = ${fmt(cycles * max)}`, cite: 'L20 p31' },
        },
      }
    }
  }

  const pipeCT = t.pipelineCycleTime ?? (max !== undefined ? max + (t.td ?? 0) : undefined)
  if (pipeCT !== undefined) {
    const ideal = idealCycles(I, N)
    out.pipelined = {
      cycleTime: r9(pipeCT), cycles: ideal.cycles, time: r9(ideal.cycles * pipeCT),
      why: {
        cycleTime: t.pipelineCycleTime !== undefined
          ? { rule: 'Cycle time as given (1 / clock rate)', working: fmt(pipeCT), cite: 'L20 p34' }
          : { rule: 'Pipelined: slowest stage plus the pipeline register delay Td', working: `${fmt(max!)} + ${fmt(t.td ?? 0)} = ${fmt(pipeCT)}`, cite: 'L20 p31-32' },
        cycles: ideal.why,
        time: { rule: 'Time = (I + N - 1) x CT', working: `${ideal.cycles} x ${fmt(pipeCT)} = ${fmt(ideal.cycles * pipeCT)}`, cite: 'L20 p32' },
      },
    }
  }

  if (out.single && out.pipelined) {
    const value = r9(out.single.time / out.pipelined.time)
    out.speedup = { value, why: { rule: 'Speedup = single-cycle time / pipelined time; ideally N, with equal stages, Td = 0 and I much larger than N', working: `${fmt(out.single.time)} / ${fmt(out.pipelined.time)} = ${fmt(value)}`, cite: 'L20 p33' } }
  }
  return out
}

/** Class counts of a stream, for the multi-cycle mix. */
export function classMix(items: { cls: OpClass }[]): Partial<Record<OpClass, number>> {
  const m: Partial<Record<OpClass, number>> = {}
  for (const it of items) m[it.cls] = (m[it.cls] ?? 0) + 1
  return m
}

export interface LoopInput {
  /** Counter value before the loop. */
  init: number
  /** Added to the counter once per iteration (negative counts down). */
  step: number
  /** The loop exits when the counter equals this (bne counter, exit, Loop). */
  exit: number
  /** Instructions in the loop body, the update and the branch included. */
  body: number
  before: number
  after: number
  stages?: number
}

export interface LoopResult {
  /** Undefined when the counter never equals the exit value. */
  iterations?: number
  instructions?: number
  cycles?: number
  why: { iterations: Explain; instructions?: Explain; cycles?: Explain }
}

/** Ideal cycles of a counted do-while loop (update, then bne): I = before + iterations x body + after, then I + N - 1. */
export function loopIdeal(l: LoopInput): LoopResult {
  const N = l.stages ?? 5
  const gap = l.exit - l.init
  const n = l.step === 0 ? NaN : gap / l.step
  if (!Number.isInteger(n) || n < 1) {
    const reason = l.step === 0
      ? 'the step is 0, so the counter never changes'
      : n < 1 && Number.isInteger(n)
        ? 'the counter moves away from the exit value (or starts on it, and the update comes before the test)'
        : `${gap} is not a multiple of the step ${l.step}, so the counter jumps past the exit value`
    return { why: { iterations: { rule: `The loop never exits by this count: ${reason}. In 32-bit registers it would run until the counter wraps around`, cite: 'AY24/25 Q13; AY25/26 Q2' } } }
  }
  const iterations = n
  const I = l.before + iterations * l.body + l.after
  const ideal = idealCycles(I, N)
  return {
    iterations,
    instructions: I,
    cycles: ideal.cycles,
    why: {
      iterations: { rule: 'The body runs until the counter equals the exit value', working: `(exit - init) / step = (${l.exit} - ${l.init}) / ${l.step} = ${iterations}`, cite: 'AY24/25 Q13; AY25/26 Q2' },
      instructions: { rule: 'Dynamic count: the body is counted once per iteration, not once in the source', working: `${l.before} + ${iterations} x ${l.body} + ${l.after} = ${I}`, cite: 'L21 p43; AY25/26 Ans p3' },
      cycles: ideal.why,
    },
  }
}
