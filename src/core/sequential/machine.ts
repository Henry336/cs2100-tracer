/** State graph, checks (sinks, self-correction, lockout) and clocked simulation for any Machine. */
import type { Explain, Machine, Sig } from './types'

export const bin = (v: number, width: number): string => (width ? v.toString(2).padStart(width, '0') : '')

/** Input combination c as the input bits, e.g. '10' for xy = 10. */
export const comboText = (m: Machine, c: number): string => bin(c, m.inputs.length)

const outText = (o: Sig[]) => o.map(String).join('')

/** True when every output depends only on the present state (written /p inside the state, T09 Q1). */
export function outputsOnStateOnly(m: Machine): boolean {
  if (!m.outputs.length) return false
  return m.out.every((row) => row.every((o) => outText(o) === outText(row[0])))
}

export interface GraphNode {
  id: number
  label: string
  /** State bits, MSB first ('' for named states). */
  binary: string
  used: boolean
  /** Output written inside the circle when it depends only on the state. */
  output?: string
  sink: boolean
  selfLoop: boolean
  /** No used state other than this one has a path to it (T09 Q1(d); AY20/21 S2 Q12(b), R10 p66). */
  unreachable: boolean
}

export interface GraphEdge {
  from: number
  to: number
  /** Input combinations on this arrow. */
  combos: number[]
  /** Arrow label in the course form input/output, e.g. '0,1/0' or '1' (L19 p33). */
  label: string
  /** True when the arrow leaves an unused state. */
  fromUnused: boolean
}

export interface StateGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Outputs shown inside states rather than on arrows. */
  stateOutputs: boolean
  /** Simple circle layout positions in a 0..1 box (the UI may re-lay out). */
  layout: { id: number; x: number; y: number }[]
  why: Explain
}

/** Next states out of s that the table specifies; out-of-range entries (a typo) are ignored. */
const succOf = (m: Machine, s: number) => (m.next[s] ?? []).flatMap((n, c) => (n === null || !m.next[n] ? [] : [{ n, c }]))

/** Once entered, never left (T09 Q1). Open entries (xy = 11 cannot happen, T09 Q4) are not a way out. */
export function sinksOf(m: Machine): number[] {
  return m.labels.map((_, s) => s).filter((s) => m.next[s].some((n) => n !== null) && m.next[s].every((n) => n === null || n === s))
}

/** States that no other used state can lead to, by any input sequence. */
export function unreachableOf(m: Machine): number[] {
  const hit = new Set<number>()
  for (const u of m.used) {
    const seen = new Set<number>()
    const queue = succOf(m, u).map((x) => x.n)
    while (queue.length) {
      const s = queue.shift()!
      if (seen.has(s)) continue
      seen.add(s)
      if (s !== u) hit.add(s)
      queue.push(...succOf(m, s).map((x) => x.n))
    }
  }
  return m.labels.map((_, s) => s).filter((s) => !hit.has(s))
}

export function buildGraph(m: Machine): StateGraph {
  const stateOutputs = outputsOnStateOnly(m)
  const used = new Set(m.used)
  const sinks = new Set(sinksOf(m))
  const unreachable = new Set(unreachableOf(m))
  const nodes: GraphNode[] = m.labels.map((label, id) => ({
    id,
    label,
    binary: bin(id, m.bits.length),
    used: used.has(id),
    output: stateOutputs ? outText(m.out[id][0]) : undefined,
    sink: sinks.has(id),
    selfLoop: m.next[id].some((n) => n === id),
    unreachable: unreachable.has(id),
  }))
  const edges: GraphEdge[] = []
  m.next.forEach((row, from) => {
    const groups = new Map<string, number[]>()
    row.forEach((to, c) => {
      if (to === null || !m.next[to]) return
      const key = `${to}|${stateOutputs ? '' : outText(m.out[from][c])}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    })
    for (const [key, combos] of groups) {
      const [to, out] = key.split('|')
      const ins = m.inputs.length ? combos.map((c) => comboText(m, c)).join(',') : ''
      edges.push({ from, to: Number(to), combos, label: out ? `${ins}/${out}` : ins, fromUnused: !used.has(from) })
    }
  })
  const n = m.labels.length
  const layout = m.labels.map((_, id) => {
    const a = (2 * Math.PI * id) / n - Math.PI / 2
    return { id, x: 0.5 + 0.4 * Math.cos(a), y: 0.5 + 0.4 * Math.sin(a) }
  })
  return {
    nodes,
    edges,
    stateOutputs,
    layout,
    why: {
      rule: stateOutputs
        ? 'One circle per state. The output depends only on the state, so it is written inside the circle (/p) and arrows carry the input.'
        : 'One circle per state; each arrow is labelled input/output.',
      working: `${n} states, ${edges.length} arrows${m.bits.length ? ` (${m.bits.length} flip-flops give up to 2^${m.bits.length} = ${1 << m.bits.length} states)` : ''}`,
      cite: stateOutputs ? 'L19 p33; T09 Q1' : 'L19 p33',
    },
  }
}

/* ---------- Self-correction ---------- */

export interface UnusedPath {
  state: number
  /** Can some input sequence take it to a used state? */
  reaches: boolean
  /** Shortest path to a used state (states, starting at `state`), when it reaches one. */
  path: number[]
  /** Input combination taken at each step of `path`. */
  combos: number[]
  /** Every state reachable from it (for a lockout, all unused). */
  reachable: number[]
  /** Can it stay among unused states forever on some input sequence? */
  canStay: boolean
  /** The path written out, e.g. '3 -(x=1)-> 2' or '4 → 1 → 0 → 0'. */
  text: string
}

export interface SelfCorrection {
  /** False when every state is used (nothing to check). */
  applicable: boolean
  unused: number[]
  /** Course reading: every unused state has some path to a used state (T09 Ans p3; AY23/24 S1 Q18). */
  course: boolean
  /**
   * False when some unused state has no specified transition at all (a state table before the don't-cares are
   * committed). Self-correction can only be judged once the equations are fixed (T09 Ans p3).
   */
  determined: boolean
  /** Transitions out of unused states the machine leaves open or unpredictable (S = R = 1). */
  open: { state: number; combo: number }[]
  /** Strict reading: no input sequence can keep the circuit among unused states forever. */
  strict: boolean
  /** Unused states with no way back (lockout). */
  lockout: number[]
  paths: UnusedPath[]
  /** One-line exam-style answer with its reason. */
  sentence: string
  why: Explain
}

function walkText(m: Machine, states: number[], combos: number[]): string {
  if (!m.inputs.length) return states.map((s) => m.labels[s]).join(' → ')
  let s = m.labels[states[0]]
  for (let i = 1; i < states.length; i++) s += ` -(${m.inputs.join('')}=${comboText(m, combos[i - 1])})-> ${m.labels[states[i]]}`
  return s
}

export function selfCorrection(m: Machine): SelfCorrection {
  const used = new Set(m.used)
  const unused = m.labels.map((_, s) => s).filter((s) => !used.has(s))
  const succ = (s: number) => succOf(m, s)
  // Unused states that can loop among unused states forever (part of, or lead to, an unused-only cycle).
  const stay = new Set(unused)
  for (let changed = true; changed; ) {
    changed = false
    for (const s of [...stay])
      if (!succ(s).some(({ n }) => stay.has(n))) {
        stay.delete(s)
        changed = true
      }
  }
  const paths: UnusedPath[] = unused.map((state) => {
    const prev = new Map<number, { from: number; c: number }>()
    const seen = new Set([state])
    const queue = [state]
    let hit = -1
    while (queue.length) {
      const s = queue.shift()!
      if (s !== state && used.has(s)) {
        hit = s
        break
      }
      for (const { n, c } of succ(s))
        if (!seen.has(n)) {
          seen.add(n)
          prev.set(n, { from: s, c })
          queue.push(n)
        }
    }
    const path: number[] = []
    const combos: number[] = []
    if (hit >= 0) {
      for (let s = hit; s !== state; s = prev.get(s)!.from) {
        path.unshift(s)
        combos.unshift(prev.get(s)!.c)
      }
      path.unshift(state)
    }
    let text: string
    if (hit >= 0) text = walkText(m, path, combos)
    else if (!m.inputs.length) {
      const walk = [state]
      for (let n = succ(state)[0]?.n; n !== undefined; n = succ(n)[0]?.n) {
        const again = walk.includes(n)
        walk.push(n)
        if (again) break
      }
      text = walk.map((s) => m.labels[s]).join(' → ')
    } else text = `${m.labels[state]} can only reach ${[...seen].sort((a, b) => a - b).map((s) => m.labels[s]).join(', ')}`
    return { state, reaches: hit >= 0, path, combos, reachable: [...seen].sort((a, b) => a - b), canStay: stay.has(state), text }
  })
  const lockout = paths.filter((p) => !p.reaches).map((p) => p.state)
  const course = lockout.length === 0
  const strict = course && stay.size === 0
  const applicable = unused.length > 0
  const name = (s: number) => m.labels[s]
  const blank = unused.filter((s) => !succ(s).length)
  const determined = blank.length === 0
  const open = unused.flatMap((state) => (m.next[state] ?? []).flatMap((n, combo) => (n === null || !m.next[n] ? [{ state, combo }] : [])))
  const openText = open.map((o) => `${name(o.state)}${m.inputs.length ? ` on ${m.inputs.join('')} = ${comboText(m, o.combo)}` : ''}`).join(', ')
  const openNote = open.length && determined ? ` Note: the transition${open.length > 1 ? 's' : ''} out of ${openText} ${open.length > 1 ? 'are' : 'is'} unpredictable or unspecified, so this answer only follows the transitions that are known.` : ''
  const sentence = !applicable
    ? 'Every state is used, so there is no unused state to check.'
    : !determined
      ? `Not determined yet: the table leaves every transition out of ${blank.map(name).join(', ')} open. Fix the equations (commit the don't-cares) first, then check where the unused states go.`
      : (course
      ? `Yes: every unused state reaches a used state (${paths.map((p) => p.text).join('; ')}).`
      : `No: ${paths
          .filter((p) => !p.reaches)
          .map((p) => (m.inputs.length ? p.text : `from ${name(p.state)} the circuit goes ${p.text} and never reaches a used state`))
          .join('; ')}.`) + openNote
  const stayNote = [...stay].sort((a, b) => a - b).map(name).join(', ')
  return {
    applicable,
    unused,
    course,
    determined,
    open,
    strict,
    lockout,
    paths,
    sentence,
    why: {
      rule:
        'A circuit is self-correcting if, after entering an unused state, it can reach a valid state in a finite number of transitions. The keys accept one arrow out to a used state, even if another input keeps it in the unused state.',
      working: !applicable
        ? 'no unused states'
        : !determined
          ? `no transitions known yet for ${blank.map(name).join(', ')}`
          : `course reading: ${course ? 'yes' : 'no'}; strict reading (no input sequence can keep it in unused states forever): ${strict ? 'yes' : `no${stayNote ? `, ${stayNote} can stay unused forever` : ''}`}`,
      cite: 'R10 p40-43; T09 Q2 Ans p3; AY23/24 S1 Q18; AY24/25 Q16',
    },
  }
}

/* ---------- Simulation ---------- */

export interface SimFrame {
  clock: number
  state: number
  combo: number | null
  next: number | null
  out: Sig[]
  why: Explain
}

export interface Simulation {
  frames: SimFrame[]
  states: number[]
  outputs: string[]
  why: Explain
}

/**
 * Clock the machine from `start` with one input combination per clock (T09 SE1). With no inputs, pass
 * `clocks` instead. The output in each frame is the one produced in that clock, before the edge.
 */
export function simulate(m: Machine, start: number, inputs: number[] | { clocks: number }): Simulation {
  const seq = Array.isArray(inputs) ? inputs : Array.from({ length: inputs.clocks }, () => 0)
  const frames: SimFrame[] = []
  let s: number | null = start
  for (let k = 0; k < seq.length && s !== null; k++) {
    const c = seq[k]
    if (!m.next[s]) break
    const next: number | null = m.next[s][c] ?? null
    const out = m.out[s]?.[c] ?? []
    const inText = m.inputs.length ? `${m.inputs.join('')} = ${comboText(m, c)}` : 'clock'
    frames.push({
      clock: k + 1,
      state: s,
      combo: m.inputs.length ? c : null,
      next,
      out,
      why: {
        rule: 'Read the row for the present state and the column for the input: it gives the next state and the output.',
        working: `state ${m.labels[s]}, ${inText}: next ${next === null ? 'unspecified' : m.labels[next]}${out.length ? `, ${m.outputs.join('')} = ${outText(out)}` : ''}`,
        cite: 'L19 p30-33; T09 SE1',
      },
    })
    s = next
  }
  const states = [start, ...frames.map((f) => f.next).filter((x): x is number => x !== null)]
  const outputs = frames.map((f) => outText(f.out))
  return {
    frames,
    states,
    outputs,
    why: {
      rule: 'One transition per clock.',
      working: `states ${states.map((x) => m.labels[x]).join(', ')}${outputs.some(Boolean) ? `; outputs ${outputs.join(m.outputs.length > 1 ? ' ' : '')}` : ''}`,
      cite: 'L19 p30-33',
    },
  }
}

/** For a machine with no inputs: the states visited from `start` until one repeats (e.g. 0→1→2→3→4→5→5). */
export function sequenceFrom(m: Machine, start: number): { states: number[]; loopStart: number; text: string } {
  const states = [start]
  while (m.next[start]) {
    const n = m.next[states[states.length - 1]]?.[0] ?? null
    if (n === null) break
    states.push(n)
    if (states.indexOf(n) < states.length - 1) break
  }
  const last = states[states.length - 1]
  return { states, loopStart: states.indexOf(last), text: states.map((s) => m.labels[s] ?? String(s)).join(' → ') }
}
