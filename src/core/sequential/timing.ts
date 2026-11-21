/** Timing diagrams: a latch or an edge-triggered flip-flop driven by waveforms (L19 p7-8, p14-25). */
import { FF_INPUTS } from './types'
import type { Bit, Explain, FFType, Issue, Result, Sig } from './types'
import { ffNext } from './flipflops'

export type TimingElement = 'gated-d' | 'gated-sr' | FFType

export interface TimingSpec {
  element: TimingElement
  /** Flip-flops only: positive (0 -> 1) or negative (1 -> 0) edge (L19 p8, p16-17). */
  edge?: 'pos' | 'neg'
  /**
   * Active level of PRE and CLR. L19 p24 describes them active-high (the default); the p25 figure draws a
   * J-K flip-flop with active-low PRE and CLR.
   */
  asyncLevel?: 'high' | 'low'
  /** Q before the first tick. */
  q0?: Sig
  /**
   * Which column an edge samples. The edge sits between ticks t-1 and t. 'before' (default) reads the inputs
   * at t-1, the values held while the edge arrives; 'after' reads tick t.
   */
  sample?: 'before' | 'after'
  /** One value per tick. CLK for flip-flops, EN for latches; D, J, K, T, S, R as needed; PRE and CLR optional. */
  waves: Record<string, Bit[]>
}

export type TimingEvent = 'start' | 'edge' | 'transparent' | 'hold' | 'preset' | 'clear' | 'async-conflict'

export interface TimingFrame {
  t: number
  q: Sig
  event: TimingEvent
  /** The tick whose inputs were used (edges and transparent latches). */
  sampled?: number
  why: Explain
}

export interface TimingTrace {
  spec: TimingSpec
  ticks: number
  /** Ticks at which a triggering edge happens (flip-flops). */
  edges: number[]
  /** Ticks where the latch is transparent (EN = 1). */
  transparent: number[]
  /** Ticks where PRE or CLR overrides the clock. */
  overrides: number[]
  q: Sig[]
  frames: TimingFrame[]
}

const isLatch = (e: TimingElement) => e === 'gated-d' || e === 'gated-sr'

export function simulateTiming(spec: TimingSpec): Result<{ trace: TimingTrace }> {
  const errors: Issue[] = []
  const clockName = isLatch(spec.element) ? 'EN' : 'CLK'
  const dataNames = spec.element === 'gated-d' ? ['D'] : spec.element === 'gated-sr' ? ['S', 'R'] : FF_INPUTS[spec.element]
  const ticks = spec.waves[clockName]?.length ?? 0
  if (!ticks) errors.push({ code: 'wave', message: `${clockName} needs at least one tick`, at: [0, 0] })
  for (const name of [clockName, ...dataNames, 'PRE', 'CLR']) {
    const w = spec.waves[name]
    if (!w) {
      if (name !== 'PRE' && name !== 'CLR') errors.push({ code: 'wave', message: `missing waveform ${name}`, at: [0, 0] })
      continue
    }
    if (w.length !== ticks) errors.push({ code: 'wave', message: `${name} has ${w.length} ticks but ${clockName} has ${ticks}`, at: [0, 0] })
    if (w.some((v) => v !== 0 && v !== 1)) errors.push({ code: 'wave', message: `${name} values must be 0 or 1`, at: [0, 0] })
  }
  if (errors.length) return { ok: false, errors }

  const edge = spec.edge ?? 'pos'
  const level = spec.asyncLevel ?? 'high'
  const sample = spec.sample ?? 'before'
  const active = (name: string, t: number) => {
    const w = spec.waves[name]
    if (!w) return false
    return level === 'high' ? w[t] === 1 : w[t] === 0
  }
  const asyncCite = level === 'high' ? 'L19 p24' : 'L19 p25 (figure: active-low PRE and CLR)'
  const clk = spec.waves[clockName]
  const frames: TimingFrame[] = []
  const edges: number[] = []
  const transparent: number[] = []
  const overrides: number[] = []
  let q: Sig = spec.q0 ?? 0
  const valuesAt = (t: number) => dataNames.map((n) => spec.waves[n][t])
  const text = (t: number) => dataNames.map((n) => `${n} = ${spec.waves[n][t]}`).join(', ')

  for (let t = 0; t < ticks; t++) {
    const pre = active('PRE', t)
    const clr = active('CLR', t)
    if (pre || clr) {
      overrides.push(t)
      const lv = level === 'high' ? 'HIGH' : 'LOW'
      q = pre && clr ? 'X' : pre ? 1 : 0
      frames.push({
        t,
        q,
        event: pre && clr ? 'async-conflict' : pre ? 'preset' : 'clear',
        why: {
          rule: `PRE and CLR are asynchronous: they act at once, whatever the clock (active ${level}).`,
          working: pre && clr ? `PRE and CLR both ${lv}: the course gives no result, so Q is unknown` : `${pre ? 'PRE' : 'CLR'} = ${lv}, so Q = ${q}`,
          cite: asyncCite,
        },
      })
      continue
    }
    if (isLatch(spec.element)) {
      if (clk[t] === 1) {
        transparent.push(t)
        const v = valuesAt(t)
        let next: Sig
        if (spec.element === 'gated-d') next = v[0]
        else next = ffNext('SR', v, q).next
        q = next
        frames.push({
          t,
          q,
          event: 'transparent',
          sampled: t,
          why: {
            rule: spec.element === 'gated-d' ? 'A gated D latch is level-triggered: while EN = 1, Q follows D.' : 'A gated S-R latch acts on S and R while EN = 1.',
            working: `EN = 1, ${text(t)}: Q = ${q}`,
            cite: spec.element === 'gated-d' ? 'L19 p8, p14-15' : 'L19 p8, p13',
          },
        })
      } else {
        frames.push({ t, q, event: t ? 'hold' : 'start', why: { rule: 'With EN = 0 the latch keeps its value.', working: `EN = 0: Q stays ${q}`, cite: 'L19 p13-15' } })
      }
      continue
    }
    const rising = t > 0 && clk[t - 1] === 0 && clk[t] === 1
    const falling = t > 0 && clk[t - 1] === 1 && clk[t] === 0
    if ((edge === 'pos' && rising) || (edge === 'neg' && falling)) {
      edges.push(t)
      const at = sample === 'before' ? t - 1 : t
      const step = ffNext(spec.element as FFType, valuesAt(at), q, 'Q')
      q = step.next
      frames.push({
        t,
        q,
        event: 'edge',
        sampled: at,
        why: {
          rule: `Edge-triggered: Q changes only on the ${edge === 'pos' ? 'positive (0 to 1)' : 'negative (1 to 0)'} clock edge. ${step.why.rule}`,
          working: `edge at tick ${t}, inputs read at tick ${at}: ${step.why.working}`,
          cite: `L19 p8, p16-17; ${step.why.cite}`,
        },
      })
    } else {
      frames.push({
        t,
        q,
        event: t ? 'hold' : 'start',
        why: { rule: 'Between triggering edges a flip-flop ignores its inputs.', working: `no ${edge === 'pos' ? 'positive' : 'negative'} edge: Q stays ${q}`, cite: 'L19 p16' },
      })
    }
  }
  return { ok: true, trace: { spec, ticks, edges, transparent, overrides, q: frames.map((f) => f.q), frames } }
}
