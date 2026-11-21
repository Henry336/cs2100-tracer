// Adversarial edge-case and robustness checks for the pipeline engine (verifier-owned).
// Failing tests describe behaviour the engine does not meet yet; passing ones guard invariants.
import { describe, expect, it } from 'vitest'
import { buildStream, DEFAULT_OPTIONS, timing, tracePipeline, type PipelineOptions, type PipelineTrace } from './index'
import { PIPELINE_PRESETS, R11_Q6, R11_Q7 } from './fixtures'

const ODD_INPUTS = [
  '', '   \n\t\n', '# only a comment', 'L:', 'A: B:\n\nC:', 'foo bar', 'add $t10, $t1, $t2', 'add $t0, $t1', 'constructor',
  '__proto__ $t0, $t1, $t2', 'beq $t0, $t1, toString', 'j nowhere', 'lw $t0, 3($zero)\nadd $t1, $t0, $t0', 'jr $ra',
  'L: j L', 'L: beq $zero, $zero, L', 'beq $zero, $zero, 100', 'add $1,$2,$3\r\nadd $4,$1,$1\r\n', 'addi $t0, $zero, -0x10',
  'syscall', 'addi $v0, $zero, 10\nsyscall\nadd $1, $1, $1', 'li $t0, 0x12345678', 'blt $t0, $t1, L\nL:',
]

describe('never throws on student input (architecture.md: parsers return errors, never throw)', () => {
  const all: Partial<PipelineOptions>[] = [
    {}, { forwarding: false }, { branchStage: 'ID', prediction: 'not-taken' }, { prediction: 'taken' },
    { delayedBranch: true, branchStage: 'ID' }, { jumpStage: 'MEM', storeData: 'mem' },
  ]
  for (const src of ODD_INPUTS) {
    it(JSON.stringify(src), () => {
      for (const o of all) {
        expect(() => tracePipeline(src, o)).not.toThrow()
        expect(() => tracePipeline(src, o, { outcomes: [true, false] })).not.toThrow()
      }
    })
  }
})

describe('stream edge cases', () => {
  it('L21 p46: the delay-slot instruction always executes, so a loop scheduled for delayed branching exits after 4 passes', () => {
    // s0 = 3; the slot decrements it after every bne. Delayed semantics: bne sees 3, 2, 1 (taken) then 0 (not taken).
    const src = 'addi $s0, $zero, 3\nLoop: addi $t0, $t0, 1\nbne $s0, $zero, Loop\naddi $s0, $s0, -1'
    const t = tracePipeline(src, { forwarding: true, branchStage: 'ID', delayedBranch: true })
    expect(t.instructions.map((i) => i.name)).toEqual(['i1', 'i2', 'i3', 'i4', 'i2', 'i3', 'i4', 'i2', 'i3', 'i4', 'i2', 'i3', 'i4'])
    expect(t.instructions.map((i) => i.taken).filter((x) => x !== undefined)).toEqual([true, true, true, false])
    expect(t.totals.cycles).toBe(17)
    expect(t.stream.truncated).toBe(false)
  })

  it('pseudo-instruction parts share their statement number (li -> i1.1, i1.2)', () => {
    const s = buildStream('li $t0, 0x12345678\nadd $t1, $t0, $t0', { outcomes: [] })
    expect(s.names.slice(0, 2)).toEqual(['i1.1', 'i1.2'])
  })

  it('stopAfter with a number outside the program gets the same "not in the program" note as an unknown name', () => {
    const s = buildStream('add $1, $2, $3', { stopAfter: { instr: 99 } })
    expect(s.notes.some((n) => n.includes('not in the program'))).toBe(true)
  })

  it('maxInstructions: the count in the note matches the number of instructions counted', () => {
    for (const max of [0, 1, 5]) {
      const t = tracePipeline('L: j L', {}, { maxInstructions: max })
      const note = t.notes.find((n) => n.startsWith('only the first'))
      if (note) expect(note, `max ${max}`).toContain(`first ${t.totals.instructions} `)
    }
  })

  it('a main: label gives the same stream whether the code is run or walked with outcomes (Lab 3: QtSpim starts at main)', () => {
    const src = 'add $1, $1, $1\nmain: sub $2, $2, $2\nor $3, $3, $3'
    const run = buildStream(src).items.map((i) => i.name)
    const walk = buildStream(src, { outcomes: [] }).items.map((i) => i.name)
    expect(walk).toEqual(run)
  })

  it('options left undefined (for example a missing URL key) fall back to the defaults', () => {
    const a = tracePipeline(R11_Q7, {}, { outcomes: [true] })
    const b = tracePipeline(R11_Q7, { forwarding: undefined, prediction: undefined, branchStage: undefined }, { outcomes: [true] })
    expect(b.options).toEqual(DEFAULT_OPTIONS)
    expect(b.totals.cycles).toBe(a.totals.cycles)
  })
})

describe('explanations', () => {
  it('copy: register names follow what the student wrote; R11 p44 code uses $t6 and also $0', () => {
    const t = tracePipeline(R11_Q6, { forwarding: true })
    const raw = t.dependencies.filter((d) => d.kind === 'RAW').map((d) => d.why.rule).join(' | ')
    expect(raw).toContain('$t6')
    expect(raw).not.toMatch(/\$1[0-9]\b|\$9\b/)
  })

  it('L21 p10-11: an ALU result three instructions before an early branch comes from the register file (split cycle), not a forwarding path', () => {
    const t = tracePipeline('add $1, $2, $3\nnop\nnop\nbeq $1, $0, L\nL: add $4, $1, $1', { forwarding: true, branchStage: 'ID' }, { outcomes: [false] })
    const op = t.instructions[3].operands.find((o) => o.register === 1)!
    expect(op.stalls).toBe(0)
    expect(op.forward.from).toBe('register file')
  })
})

describe('timing calculator robustness', () => {
  const finite = (x: unknown): boolean => typeof x === 'number' ? Number.isFinite(x) : typeof x === 'object' && x !== null ? Object.values(x).every(finite) : true
  it('an empty stage-time list gives no -Infinity cycle time', () => {
    expect(finite(timing({ instructions: 10, stageTimes: [] }))).toBe(true)
  })
})

describe('performance', () => {
  const ms = (f: () => unknown) => { f(); const t0 = performance.now(); for (let k = 0; k < 3; k++) f(); return (performance.now() - t0) / 3 }
  it('every course preset traces in well under 100 ms', () => {
    for (const p of PIPELINE_PRESETS) for (const part of p.parts) {
      expect(ms(() => tracePipeline(part.source ?? p.source, part.options, part.stream ?? p.stream ?? {})), `${p.id} ${part.label}`).toBeLessThan(25)
    }
  })
  it('a runaway loop at the default 300-instruction cap with predict not taken traces in under 100 ms', () => {
    expect(ms(() => tracePipeline('L: beq $zero, $zero, L', { prediction: 'not-taken', branchStage: 'MEM' }))).toBeLessThan(100)
  })
})

// Seeded random programs over every option combination: structural invariants of the cycle model (spec P0).
function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) }
function randomProgram(r: () => number): string {
  const n = 3 + Math.floor(r() * 7)
  const reg = () => `$${1 + Math.floor(r() * 4)}`
  const lines: string[] = []
  for (let k = 0; k < n; k++) {
    const p = r()
    const lab = `L${Math.floor(r() * (n + 1))}`
    if (p < 0.35) lines.push(`${['add', 'sub', 'and', 'or', 'slt'][Math.floor(r() * 5)]} ${reg()}, ${reg()}, ${reg()}`)
    else if (p < 0.5) lines.push(`lw ${reg()}, ${4 * Math.floor(r() * 3)}($0)`)
    else if (p < 0.6) lines.push(`sw ${reg()}, ${4 * Math.floor(r() * 3)}($0)`)
    else if (p < 0.7) lines.push(`addi ${reg()}, ${reg()}, ${Math.floor(r() * 7) - 3}`)
    else if (p < 0.9) lines.push(`${r() < 0.5 ? 'beq' : 'bne'} ${reg()}, ${reg()}, ${lab}`)
    else lines.push(`j ${lab}`)
  }
  return lines.map((l, k) => `L${k}: ${l}`).join('\n') + `\nL${n}:`
}
const STAGE_KEYS = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const

function violations(t: PipelineTrace, o: Partial<PipelineOptions>): string[] {
  const bad: string[] = []
  const I = t.instructions
  for (const row of t.rows) {
    const v = STAGE_KEYS.map((s) => row.stages[s]).filter((x) => x !== undefined) as number[]
    for (let k = 1; k < v.length; k++) if (v[k] <= v[k - 1]) bad.push(`${row.uid} stages ${v}`)
    for (const s of STAGE_KEYS) {
      const c = row.stages[s]
      if (c !== undefined && t.frames[c - 1]?.stages[s] !== row.uid) bad.push(`frame ${c} ${s} is not ${row.uid}`)
    }
  }
  for (let k = 1; k < I.length; k++) for (const s of STAGE_KEYS) if (I[k].stages[s] <= I[k - 1].stages[s]) bad.push(`${I[k].uid} ${s} order`)
  const tot = t.totals
  if (I.length && tot.cycles !== I[I.length - 1].stages.WB) bad.push('cycles')
  if (tot.stallCycles !== I.reduce((a, i) => a + i.delay, 0)) bad.push('sum of delays')
  if (tot.dataStallCycles + tot.controlStallCycles !== tot.stallCycles) bad.push('data + control')
  if (t.frames.length !== tot.cycles) bad.push('frame count')
  for (const i of I) if (i.delay > 0 && !i.stalls.some((s) => s.binding)) bad.push(`${i.uid} delay without cause`)
  for (const d of t.dependencies) {
    if (d.kind !== 'RAW') continue
    const p = I[d.from - 1]
    const c = I[d.to - 1]
    const pi = t.stream.items[d.from - 1]
    const ci = t.stream.items[d.to - 1]
    const ready = (pi.cls === 'load' ? p.stages.MEM : p.stages.EX) + 1
    const isData = ci.cls === 'store' && d.register === ci.dataReg && ci.instr.rs !== d.register
    if (!o.forwarding) { if (c.stages.ID < p.stages.WB) bad.push(`RAW ${d.from}->${d.to} ID < WB`) }
    else if (ci.cls === 'branch' && o.branchStage === 'ID') { if (c.stages.ID < ready) bad.push(`RAW ${d.from}->${d.to} early branch`) }
    else if (isData && o.storeData === 'mem') { if (c.stages.MEM < ready) bad.push(`RAW ${d.from}->${d.to} MEM`) }
    else if (c.stages.EX < ready) bad.push(`RAW ${d.from}->${d.to} EX`)
  }
  return bad
}

describe('random programs (spec P0 invariants, determinism)', () => {
  const opts: Partial<PipelineOptions>[] = []
  for (const forwarding of [true, false]) for (const branchStage of ['ID', 'MEM'] as const) for (const prediction of ['none', 'not-taken', 'taken'] as const)
    for (const delayedBranch of [false, true]) for (const jumpStage of ['ID', 'MEM'] as const)
      opts.push({ forwarding, branchStage, prediction, delayedBranch, jumpStage, storeData: forwarding && prediction === 'none' ? 'mem' : 'ex' })
  it('stage order, frames, totals and RAW bounds hold for 20 seeded programs under every option set', () => {
    const r = rng(7)
    const problems: string[] = []
    for (let n = 0; n < 20; n++) {
      const src = randomProgram(r)
      const so = n % 2 ? { maxInstructions: 40 } : { maxInstructions: 40, outcomes: [true, false, true, true, false] }
      for (const o of opts) {
        const t = tracePipeline(src, o, so)
        for (const b of violations(t, o)) problems.push(`${JSON.stringify(o)} ${b}\n${src}`)
        if (JSON.stringify(tracePipeline(src, o, so)) !== JSON.stringify(t)) problems.push(`not deterministic\n${src}`)
      }
    }
    expect(problems.slice(0, 5)).toEqual([])
  }, 60000)
})
