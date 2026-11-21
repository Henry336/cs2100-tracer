// Entry point: code + options -> full pipeline trace (grid rows, per-cycle frames, totals, dependencies).
import { withDelaySlots } from './delay-slot'
import { dependencies } from './deps'
import { buildFrames } from './frames'
import { simulate } from './schedule'
import { buildStream } from './stream'
import { idealCycles } from './timing'
import type { PipelineOptions, PipelineTrace, Row, Stream, StreamOptions, Totals } from './types'

export const DEFAULT_OPTIONS: PipelineOptions = {
  forwarding: true,
  branchStage: 'MEM',
  prediction: 'none',
  delayedBranch: false,
  jumpStage: 'ID',
  storeData: 'ex',
}

/** Notes on the course ambiguities each option touches (spec AMBIGUITIES 2-7). */
function optionNotes(o: PipelineOptions, s: Stream): string[] {
  const n: string[] = []
  const has = (c: string) => s.items.some((i) => i.cls === c)
  if (has('jump')) n.push(`j resolves in ${o.jumpStage}. j is not in L20-L21: AY23/24 S2 Q17 assumes ID (+1), T10 Additional assumes MEM (+3)`)
  if (o.prediction === 'taken') n.push('Predict taken is beyond the course (L21 p40 covers only predict not taken). This follows R11 Quiz Q7: the target is fetched right after the branch')
  if (o.delayedBranch && o.branchStage === 'MEM') n.push('The course uses one delay slot with the early branch (L21 p46). With the decision in MEM, the slot hides only one of the three cycles')
  if (o.forwarding && s.items.some((i, k) => i.cls === 'store' && k > 0 && s.items[k - 1].cls === 'load' && s.items[k - 1].writes === i.dataReg && i.instr.rs !== i.dataReg)) {
    n.push(`lw then sw of the loaded value: no source works this case. Option "${o.storeData}" ${o.storeData === 'ex' ? 'treats the store data as an EX operand (1 stall)' : 'assumes a MEM/WB->MEM path (0 stalls)'}`)
  }
  if (o.forwarding && o.branchStage === 'ID' && s.items.some((i, k) => i.cls === 'branch' && k > 0 && s.items[k - 1].cls === 'load' && s.items[k - 1].writes !== null && i.reads.includes(s.items[k - 1].writes!))) {
    n.push('lw right before an early branch costs 2 data stall cycles (T10 Q3 shows two bubbles). L21 p39 says "3 total" because it also counts the 1-cycle branch delay with no prediction')
  }
  if (s.program.instructions.some((i) => i.pseudoOf)) n.push('Pseudo-instructions are expanded into real instructions and each one is counted. Exam keys count a line such as "bne $s0, 0, Loop" as one instruction')
  return n
}

const CHOICES: { [K in keyof PipelineOptions]: readonly PipelineOptions[K][] } = {
  forwarding: [true, false],
  branchStage: ['ID', 'MEM'],
  prediction: ['none', 'not-taken', 'taken'],
  delayedBranch: [true, false],
  jumpStage: ['ID', 'MEM'],
  storeData: ['ex', 'mem'],
}

/** Defaults for every option that is missing, undefined or not a known value (URL state can give any of these). */
export function normalizeOptions(options: Partial<PipelineOptions> = {}): PipelineOptions {
  const o = { ...DEFAULT_OPTIONS }
  for (const k of Object.keys(CHOICES) as (keyof PipelineOptions)[]) {
    const v = options[k]
    if ((CHOICES[k] as readonly unknown[]).includes(v)) (o as Record<string, unknown>)[k] = v
  }
  return o
}

export function traceStream(input: Stream, options: Partial<PipelineOptions> = {}): PipelineTrace {
  const o = normalizeOptions(options)
  // A stream built with delay slots cannot be undone, so the option follows it.
  if (input.delaySlots) o.delayedBranch = true
  const stream = o.delayedBranch ? withDelaySlots(input) : input
  if (!stream.ok) return empty(stream, o)
  const { instructions, rows } = simulate(stream, o)
  const frames = buildFrames(stream, rows, instructions)
  const I = instructions.length
  const ideal = idealCycles(I, 5)
  const cycles = I ? instructions[I - 1].stages.WB : 0
  const stallCycles = cycles - (I ? ideal.cycles : 0)
  let data = 0
  let control = 0
  const nops: Totals['nops'] = []
  instructions.forEach((i, k) => {
    if (i.delay <= 0) return
    const dataBinding = i.stalls.some((s) => s.binding && s.kind !== 'branch' && s.kind !== 'jump')
    if (dataBinding) {
      data += i.delay
      nops.push({ after: k > 0 ? instructions[k - 1].name : '(start)', count: i.delay })
    } else control += i.delay
  })
  const totals: Totals = {
    instructions: I, stages: 5, ideal: I ? ideal.cycles : 0, cycles, stallCycles,
    stallEvents: instructions.filter((i) => i.delay > 0).length,
    dataStallCycles: data, controlStallCycles: control,
    flushed: rows.filter((r) => r.wrongPath).length,
    nops,
    why: {
      ideal: ideal.why,
      cycles: { rule: 'Count up to the WB of the last instruction counted', working: I ? `${instructions[I - 1].name} finishes WB in cycle ${cycles}` : 'no instructions', cite: 'L20 p32; AY23/24 S2 Q17' },
      stallCycles: {
        rule: 'Stall cycles = total - ideal. Keys word this differently: AY24/25 says 2 stalls of 2 cycles, AY25/26 says 5 stalls of 1 cycle; both are stall cycles',
        working: `${cycles} - ${I ? ideal.cycles : 0} = ${stallCycles} (data ${data}, control ${control}; ${instructions.filter((i) => i.delay > 0).length} instructions delayed)`,
        cite: 'AY24/25 Q19 key; AY25/26 Q19 key',
      },
      nops: {
        rule: 'Without hazard detection, the compiler puts one nop per data stall cycle just before the stalled instruction',
        working: nops.length ? nops.map((x) => `${x.count} after ${x.after}`).join(', ') : 'none needed',
        cite: 'AY24/25 Q19(d)',
      },
    },
  }
  const publicRows: Row[] = rows.map(({ full: _f, prevUid: _p, fetchFloor: _ff, item: _i, ...r }) => r)
  const gridNotes: string[] = []
  if (rows.some((r) => r.outside)) gridNotes.push('Rows marked outside were fetched past the end of the program and flushed. AY23/24 S1 Q16(d) draws such a row (i10); R11 p46 leaves it out')
  if (o.prediction !== 'none' && instructions.some((i) => i.stalls.some((s) => s.binding && s.stage !== 'IF') && stream.items[i.seq - 1].cls === 'branch')) {
    gridNotes.push('After a branch that stalls in ID, this grid fetches the next instruction when the stall ends, as L21 p22 and R11 p44 draw stalls. R11 p45 and T10 Answers p21-22 draw that fetch earlier and hold it in IF; the cycle totals are the same')
  }
  return {
    ok: true, errors: [], notes: [...stream.notes, ...optionNotes(o, stream), ...gridNotes], options: o, stream,
    instructions, rows: publicRows, frames, dependencies: dependencies(stream, instructions), totals,
  }
}

export function tracePipeline(source: string, options: Partial<PipelineOptions> = {}, streamOpts: StreamOptions = {}): PipelineTrace {
  const o = normalizeOptions(options)
  return traceStream(buildStream(source, { ...streamOpts, delayedBranch: o.delayedBranch }), o)
}

function empty(stream: Stream, options: PipelineOptions): PipelineTrace {
  const none = { rule: 'Fix the code first' }
  return {
    ok: false, errors: stream.errors, notes: stream.notes, options, stream, instructions: [], rows: [], frames: [], dependencies: [],
    totals: { instructions: 0, stages: 5, ideal: 0, cycles: 0, stallCycles: 0, stallEvents: 0, dataStallCycles: 0, controlStallCycles: 0, flushed: 0, nops: [], why: { ideal: none, cycles: none, stallCycles: none, nops: none } },
  }
}
