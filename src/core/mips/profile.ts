import type { Program, RunResult } from './types'

export type LineCount = { line: number; runs: number; branches: number; taken: number }

/** Whole-run counts per source line: how often it ran (once per pass, even when it expands) and how often its branch was taken. */
export function lineProfile(p: Program, r: RunResult): LineCount[] {
  const first = new Map<number, number>()
  for (const ins of p.instructions) if (!first.has(ins.line)) first.set(ins.line, ins.address)
  const rows = new Map<number, LineCount>()
  for (const f of r.frames) {
    const ln = f.instr.line
    const row = rows.get(ln) ?? { line: ln, runs: 0, branches: 0, taken: 0 }
    if (first.get(ln) === f.pc) row.runs++
    if (f.taken !== undefined) {
      row.branches++
      if (f.taken) row.taken++
    }
    rows.set(ln, row)
  }
  return [...rows.values()].sort((a, b) => a.line - b.line)
}

/** Distinct byte addresses read by loads over the whole run (L07 Ex5 counts 13 for its ulw loop). */
export function uniqueBytesRead(r: RunResult): number {
  const set = new Set<number>()
  for (const f of r.frames) for (const m of f.memReads) for (let k = 0; k < m.size; k++) set.add((m.address + k) >>> 0)
  return set.size
}
