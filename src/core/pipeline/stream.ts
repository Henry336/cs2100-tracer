// The dynamic instruction stream: loops unrolled, each branch with its outcome.
import { assemble, hex, memoryAt, regName, run, type ExecFrame, type Program, type RunInit, type RunResult } from '../mips'
import { opClass, regUse } from './classify'
import type { Stream, StreamItem, StreamOptions } from './types'

const TAG = /#\s*(?:(i\d+|Inst\d+)\b|inst\s+([A-Za-z0-9]+)\b)/i

/** Row names from '# i3', '# Inst3' or '#inst A' tags; i<n> otherwise. Pseudo parts get .1, .2. */
function rowNames(program: Program, lines: string[]): { names: string[]; texts: string[] } {
  const names: string[] = []
  const texts: string[] = []
  let stmt = 0
  program.instructions.forEach((ins, k) => {
    // A pseudo-instruction's parts share one statement number (li -> i1.1, i1.2).
    if (k === 0 || ins.line === 0 || program.instructions[k - 1].line !== ins.line) stmt++
    const line = lines[ins.line - 1] ?? ''
    const hash = line.indexOf('#')
    const m = hash >= 0 ? TAG.exec(line.slice(hash)) : null
    let name = m ? (m[1] ?? m[2]) : `i${stmt}`
    const parts = program.instructions.filter((o) => o.line === ins.line && ins.line > 0)
    if (parts.length > 1) name += `.${parts.indexOf(ins) + 1}`
    names.push(name)
    const src = (hash >= 0 ? line.slice(0, hash) : line).replace(/^\s*([A-Za-z_][\w.]*\s*:\s*)+/, '').trim()
    texts.push(ins.pseudoOf || !src ? ins.text : src.replace(/\s+/g, ' '))
  })
  return { names, texts }
}

function stopIndex(stop: StreamOptions['stopAfter'], names: string[]): number | undefined {
  if (!stop) return undefined
  if (typeof stop.instr === 'number') return Number.isInteger(stop.instr) && stop.instr >= 1 && stop.instr <= names.length ? stop.instr - 1 : undefined
  const i = names.findIndex((n) => n.toLowerCase() === String(stop.instr).toLowerCase())
  return i >= 0 ? i : undefined
}

/**
 * Builds the stream either by running the code (register values decide each branch) or,
 * when `outcomes` is given, by walking the code with those taken/not-taken answers.
 */
export function buildStream(source: string, opts: StreamOptions = {}): Stream {
  const program = assemble(source, opts.textBase === undefined ? {} : { textBase: opts.textBase })
  const lines = source.split(/\r?\n/)
  const { names, texts } = rowNames(program, lines)
  // $0 alone does not count: R11 Q6 writes $t6 and $0 side by side.
  const regStyle: Stream['regStyle'] = /\$([1-9]|[12]\d|3[01])\b/.test(source.replace(/#.*$/gm, '')) ? 'number' : 'name'
  const notes: string[] = []
  const base = { program, names, texts, regStyle, notes }
  if (program.errors.length) return { ok: false, errors: program.errors, items: [], valued: false, truncated: false, ...base }

  const max = Math.max(1, Math.floor(opts.maxInstructions ?? 300))
  const stopAt = stopIndex(opts.stopAfter, names)
  if (opts.stopAfter && stopAt === undefined) notes.push(`stop instruction ${String(opts.stopAfter.instr)} is not in the program, so the whole run is counted`)
  const wantOcc = opts.stopAfter?.occurrence ?? 1
  const byAddr = new Map(program.instructions.map((ins, k) => [ins.address, k]))
  const delay = opts.delayedBranch ? { delaySlots: true } : {}
  const items: StreamItem[] = []
  let truncated = false
  let seen = 0
  const push = (index: number, extra: Partial<StreamItem>): boolean => {
    const instr = program.instructions[index]
    items.push({ seq: items.length + 1, index, name: names[index], text: texts[index], instr, cls: opClass(instr), ...regUse(instr), ...extra })
    if (index === stopAt && ++seen >= wantOcc) return true
    if (items.length >= max) { truncated = true; return true }
    return false
  }

  /** Walk the code from static index k with the given outcomes (missing ones count as not taken). */
  const walk = (k: number, outcomes: boolean[]): void => {
    let b = 0
    while (k >= 0 && k < program.instructions.length) {
      const ins = program.instructions[k]
      const cls = opClass(ins)
      let next = k + 1
      let taken: boolean | undefined
      if (cls === 'branch') {
        taken = outcomes[b++] ?? false
        if (taken) next = byAddr.get(ins.targetAddress ?? -1) ?? program.instructions.length
      } else if (cls === 'jump') {
        next = byAddr.get(ins.targetAddress ?? -1) ?? program.instructions.length
      } else if (cls === 'jr') {
        notes.push(`${names[k]}: jr needs register values, so the walk stops here`)
        push(k, {})
        return
      }
      if (push(k, taken === undefined ? {} : { taken })) return
      if (cls === 'branch' && opts.delayedBranch && k + 1 < program.instructions.length) {
        // Delay slot (L21 p46): the next instruction runs whatever the outcome.
        if (push(k + 1, { slot: true })) return
        if (!taken) next = k + 2
      }
      k = next
    }
    if (b < outcomes.length) notes.push(`${outcomes.length - b} outcome(s) were not used`)
  }

  // QtSpim starts at main when it exists (Lab 3); run() does the same.
  const start = byAddr.get(program.labels.main ?? -1) ?? 0
  if (opts.outcomes) {
    walk(start, opts.outcomes)
    if (truncated) notes.push(`only the first ${items.length} instructions are counted`)
    return { ok: true, errors: [], items, valued: false, truncated, ...base, ...delay }
  }

  const res: RunResult & { slots?: Set<ExecFrame> } = opts.delayedBranch
    ? runDelayed(program, { regs: opts.regs ?? {}, mem: opts.mem ?? {} }, max + 1)
    : run(program, { regs: opts.regs ?? {}, mem: opts.mem ?? {} }, max + 1)
  let before = res.initialRegs
  let stopped = false
  for (const f of res.frames) {
    const index = byAddr.get(f.instr.address)
    if (index === undefined) break
    const values = {
      before, after: f.regs,
      ...(f.memReads[0] ? { memRead: f.memReads[0] } : {}),
      ...(f.memWrites[0] ? { memWrite: f.memWrites[0] } : {}),
    }
    before = f.regs
    const slot = res.slots?.has(f) ? { slot: true } : {}
    if (push(index, { values, ...slot, ...(f.taken === undefined ? {} : { taken: f.taken }) })) { stopped = true; break }
  }
  if (res.halted === 'error' && !stopped) {
    // Timing questions often use made-up addresses (sw $s5, 50($s2)); keep counting without values.
    const last = res.frames[res.frames.length - 1]
    const at = last ? (byAddr.get(last.nextPc) ?? -1) : start
    notes.push(`run stopped (${res.error ?? 'error'}); the rest is walked without register values and branches count as not taken`)
    walk(at, [])
  }
  if (truncated) notes.push(`only the first ${items.length} instructions are counted`)
  return { ok: true, errors: [], items, valued: true, truncated, ...base, ...delay }
}

/**
 * run() with one delay slot after every beq/bne (L21 p46): the branch decides with the registers it
 * sees, the next instruction always runs, then the PC goes to the target or past the slot.
 * run() has no delay-slot option, so this steps it one instruction at a time from the current state.
 */
function runDelayed(program: Program, init: RunInit, maxSteps: number): RunResult & { slots: Set<ExecFrame> } {
  const first = run(program, init, 1)
  const frames: ExecFrame[] = []
  const slots = new Set<ExecFrame>()
  const out = (halted: RunResult['halted'], error?: string) => ({ ...first, frames, halted, ...(error === undefined ? {} : { error }), slots })
  if (first.halted === 'error' && !first.frames.length) return out('error', first.error)
  let regs: number[] = first.initialRegs
  let mem = first.initialMem
  let pc = first.frames[0]?.pc ?? 0
  let after: number | null = null
  const addrs = new Set(program.instructions.map((i) => i.address))
  const end = (Math.max(...addrs) + 4) >>> 0
  for (let step = 0; step < maxSteps; step++) {
    if (!addrs.has(pc)) return pc === end ? out('end') : out('error', `PC ${hex(pc)} does not hold an instruction (QtSpim: attempt to execute non-instruction, Lab 3 p7)`)
    const r = run({ ...program, labels: { ...program.labels, main: pc } }, { regs: { ...regs }, mem }, 1)
    const f = r.frames[0]
    if (!f) return out(r.halted, r.error)
    frames.push(f)
    regs = f.regs
    mem = memoryAt(r, 0)
    if (after !== null) {
      slots.add(f)
      // A branch in a slot is undefined in MIPS; its own outcome is ignored here.
      pc = after
      after = null
    } else if (f.taken !== undefined) {
      after = f.nextPc === (f.pc + 4) >>> 0 ? (f.pc + 8) >>> 0 : f.nextPc
      pc = (f.pc + 4) >>> 0
    } else pc = f.nextPc
    if (r.halted === 'end' && r.frames.length) return out('end')
    if (r.halted === 'error') return out('error', r.error)
  }
  return out('maxSteps')
}

/** Register name in the source's own style ($2 or $v0). */
export function regLabel(r: number, style: Stream['regStyle']): string {
  return style === 'number' ? `$${r}` : regName(r)
}
