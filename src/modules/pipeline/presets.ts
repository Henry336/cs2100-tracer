// Presets for the pipeline page: every engine fixture part, plus a few dependency and timing examples.
import { buildStream, classMix, PIPELINE_PRESETS, pipelineFixtures, type PipelineOptions, type PipelinePreset, type PresetPart, type StreamOptions, type TimingInput } from '../../core/pipeline'
import { memInitText, regInitText, wordsToMem } from '../../core/mips'

/** Run settings as the URL keeps them: short editable text. */
export interface RunSettings {
  regs: string
  mem: string
  /** Branch outcomes in dynamic order, e.g. "T N T". Empty: run the code with register values. */
  outcomes: string
  /** Stop after this instruction (row name such as i20, or a 1-based number). Empty: run to the end. */
  stop: string
  occ: number
}

export interface FlatPreset {
  key: string
  id: string
  name: string
  cite: string
  official: boolean
  code: string
  options: Partial<PipelineOptions>
  run: RunSettings
  expect: PresetPart['expect']
  note?: string
}

const EMPTY_RUN: RunSettings = { regs: '', mem: '', outcomes: '', stop: '', occ: 1 }

export function runText(s: StreamOptions | undefined): RunSettings {
  if (!s) return EMPTY_RUN
  return {
    regs: regInitText(s.regs),
    mem: memInitText(s.mem),
    outcomes: (s.outcomes ?? []).map((t) => (t ? 'T' : 'N')).join(' '),
    stop: s.stopAfter ? String(s.stopAfter.instr) : '',
    occ: s.stopAfter?.occurrence ?? 1,
  }
}

const F = pipelineFixtures

/** Extra examples from the spec that have no cycle key in the engine fixtures. */
const EXTRA: PipelinePreset[] = [
  {
    id: 'P18', title: 'Dependency check (WAW only)', cite: 'AY25/26 Q4; R11 p43', official: true, source: F.AY2526_Q4,
    parts: [{ label: 'Forwarding', options: { forwarding: true }, expect: {}, note: 'The only dependency is WAW on $t2; the key answers E (WAW hazard) though it costs no stall' }],
  },
  {
    id: 'P19', title: 'Delay slot candidates', cite: 'AY23/24 S1 Q12', official: true, source: F.AY2324S1_Q12,
    parts: [{ label: 'Early branch, delayed branch', options: { forwarding: true, branchStage: 'ID', delayedBranch: true }, expect: {}, note: 'Key D: I5 (add $3, $3, $4) can fill the slot after I7; I6 cannot, because I7 reads $5' }],
  },
  {
    id: 'L21x', title: 'Load-use with a WAR pair', cite: 'L21 p19-20', official: false,
    source: `
lw  $2, 20($1)
and $4, $2, $5
or  $8, $2, $6
add $9, $4, $2
slt $1, $6, $7`,
    parts: [{ label: 'Forwarding', options: { forwarding: true }, expect: { cycles: 10 }, note: 'Derived: one load-use bubble; lw then slt is a WAR on $1 and costs nothing' }],
  },
  {
    id: 'T10Q2', title: 'Forwarding rules trace', cite: 'T10 Q2 (answers p13-19)', official: false,
    source: `
add $1, $2, $3
lw  $1, 0($1)
add $1, $1, $1
add $3, $2, $1`,
    parts: [{ label: 'Forwarding', options: { forwarding: true }, expect: { cycles: 9 }, note: 'Derived: EX/MEM to lw rs, one load-use nop, MEM/WB to both inputs of add $1, $1, $1, then EX/MEM to add $3' }],
  },
]

export const PRESETS: FlatPreset[] = [...PIPELINE_PRESETS, ...EXTRA].flatMap((p) =>
  p.parts.map((part, k) => ({
    key: `${p.id}.${k}`,
    id: p.id,
    name: `${p.id} ${p.title}: ${part.label}`,
    cite: p.cite,
    official: p.official,
    code: (part.source ?? p.source).replace(/^\n/, ''),
    options: part.options,
    run: runText(part.stream ?? p.stream),
    expect: part.expect,
    ...(part.note ? { note: part.note } : {}),
  })),
)

export const DEFAULT_PRESET = PRESETS[0]

/* ---------- Timing presets ---------- */

export interface TimingSettings {
  instructions: number
  /** Stage times as typed, e.g. "2, 1, 2, 2, 1". */
  stages: string
  td: number
  mode: 'cpi' | 'mix'
  cpi: number
  mix: { alu: number; load: number; store: number; branch: number; jump: number }
  /** Optional cycle times given directly (from a clock rate). Empty: derive from the stages. */
  single: string
  pipe: string
  n: number
  unit: string
}

const P14_MIX = (() => {
  const s = buildStream(F.AY2324S1_Q1, { regs: { 7: 0x10010000, 8: 8 }, mem: wordsToMem(0x10010000, [1, 9, 2, 8, 3, 7, 6, 5]) })
  const m = classMix(s.items)
  return { alu: m.alu ?? 0, load: m.load ?? 0, store: m.store ?? 0, branch: m.branch ?? 0, jump: m.jump ?? 0 }
})()

const NO_MIX = { alu: 0, load: 0, store: 0, branch: 0, jump: 0 }

export const TIMING_PRESETS: { name: string; source: string; value: TimingSettings; expect: string }[] = [
  { name: 'P2 Three implementations', source: 'L20 p31-32', expect: '800 / 920 / 260 ns', value: { instructions: 100, stages: '2, 1, 2, 2, 1', td: 0.5, mode: 'cpi', cpi: 4.6, mix: NO_MIX, single: '', pipe: '', n: 5, unit: 'ns' } },
  { name: 'P1 Review question', source: 'L20 p34', expect: '40 ns single-cycle; 8 cycles = 16 ns pipelined', value: { instructions: 4, stages: '', td: 0, mode: 'cpi', cpi: 4, mix: NO_MIX, single: '10', pipe: '2', n: 5, unit: 'ns' } },
  { name: 'P3 Ideal count, 5 stages', source: 'R11 p5', expect: '14 cycles', value: { instructions: 10, stages: '', td: 0, mode: 'cpi', cpi: 4, mix: NO_MIX, single: '', pipe: '', n: 5, unit: 'ns' } },
  { name: 'P3 Ideal count, 6 stages', source: 'R11 p40', expect: '15 cycles', value: { instructions: 10, stages: '', td: 0, mode: 'cpi', cpi: 4, mix: NO_MIX, single: '', pipe: '', n: 6, unit: 'ns' } },
  { name: 'P14 Loop over 8 elements', source: 'AY23/24 S1 Q1-4', expect: '144 ns; 2.5 GHz; 105.2 ns; 34.2 ns', value: { instructions: 72, stages: '0.1, 0.2, 0.2, 0.4, 0.2', td: 0.05, mode: 'mix', cpi: 4, mix: P14_MIX, single: '2', pipe: '', n: 5, unit: 'ns' } },
  { name: 'Laundry, 4 loads of 4 stages', source: 'L20 p7-8', expect: '480 min (8 h) sequential; 210 min (3.5 h) pipelined', value: { instructions: 4, stages: '30, 30, 30, 30', td: 0, mode: 'cpi', cpi: 4, mix: NO_MIX, single: '', pipe: '', n: 4, unit: 'min' } },
  { name: 'Maximum speedup', source: 'AY15/16 Q5', expect: '320 vs 120 ns, speedup 2.67 (derived)', value: { instructions: 20, stages: '2, 3, 4, 5, 2', td: 0, mode: 'cpi', cpi: 4, mix: NO_MIX, single: '', pipe: '', n: 5, unit: 'ns' } },
]

/** Parse the timing settings into engine input, with plain errors. */
export function timingInput(t: TimingSettings): { input: TimingInput; errors: string[] } {
  const errors: string[] = []
  const stageTimes: number[] = []
  for (const tok of t.stages.split(/[\s,]+/).filter(Boolean)) {
    const v = Number(tok)
    if (!Number.isFinite(v) || v <= 0) errors.push(`stage time ${tok} is not a positive number`)
    else stageTimes.push(v)
  }
  const opt = (s: string, what: string) => {
    if (!s.trim()) return undefined
    const v = Number(s)
    if (!Number.isFinite(v) || v <= 0) {
      errors.push(`${what} ${s} is not a positive number`)
      return undefined
    }
    return v
  }
  const single = opt(t.single, 'single-cycle cycle time')
  const pipe = opt(t.pipe, 'pipelined cycle time')
  const I = Math.max(0, Math.floor(t.instructions || 0))
  const input: TimingInput = {
    instructions: I,
    ...(stageTimes.length ? { stageTimes } : {}),
    td: t.td || 0,
    stages: stageTimes.length || Math.max(1, Math.floor(t.n || 5)),
    ...(t.mode === 'mix' ? { mix: t.mix } : { cpi: t.cpi }),
    ...(single !== undefined ? { singleCycleTime: single } : {}),
    ...(pipe !== undefined ? { pipelineCycleTime: pipe } : {}),
  }
  return { input, errors }
}

export const DEFAULT_TIMING = TIMING_PRESETS[0].value

/* ---------- Loop ideal-cycle counter ---------- */

/** Quick fields as the URL keeps them; init is text so 0x32 stays hex. */
export interface LoopSettings {
  init: string
  step: number
  exit: number
  body: number
  before: number
  after: number
  n: number
}

export const LOOP_PRESETS: { name: string; source: string; value: LoopSettings; expect: string }[] = [
  { name: 'P17a Count down from 0x10 by 2', source: 'AY24/25 Q13', expect: '8 iterations, I = 26, 30 cycles', value: { init: '0x10', step: -2, exit: 0, body: 3, before: 1, after: 1, n: 5 } },
  { name: 'P17b Count down from 0x32 by 5', source: 'AY25/26 Q2', expect: '10 iterations, I = 32, 36 cycles', value: { init: '0x32', step: -5, exit: 0, body: 3, before: 1, after: 1, n: 5 } },
  { name: 'P6 Count down from 10 by 1', source: 'L21 p43', expect: 'I = 22, ideal 26', value: { init: '10', step: -1, exit: 0, body: 2, before: 1, after: 1, n: 5 } },
]

export const DEFAULT_LOOP = LOOP_PRESETS[0].value
