// Delayed branching: the slot instruction after a beq/bne always runs (L21 p46-48).
import { opClass, regUse } from './classify'
import type { Stream, StreamItem } from './types'

/**
 * Re-orders a stream for delayed branching. The stream was built with normal branch semantics,
 * so after a taken branch the next static instruction is inserted as the slot; after a not-taken
 * branch the next item already is that instruction and is only marked.
 */
export function withDelaySlots(stream: Stream): Stream {
  if (stream.delaySlots) return stream
  const out: StreamItem[] = []
  const n = stream.program.instructions.length
  let inserted = false
  for (let k = 0; k < stream.items.length; k++) {
    const it = stream.items[k]
    out.push({ ...it })
    if (it.cls !== 'branch') continue
    const slotIndex = it.index + 1
    const next = stream.items[k + 1]
    if (next && next.index === slotIndex && !it.taken) {
      out.push({ ...next, slot: true })
      k++
    } else if (slotIndex < n && next) {
      const instr = stream.program.instructions[slotIndex]
      out.push({ seq: 0, index: slotIndex, name: stream.names[slotIndex], text: stream.texts[slotIndex], instr, cls: opClass(instr), ...regUse(instr), slot: true })
      inserted = true
    }
  }
  out.forEach((it, i) => { it.seq = i + 1 })
  const notes = [...stream.notes]
  if (inserted && stream.valued) notes.push('Delayed branching: the slot after a taken branch is added to the run. Values after it come from running the code without a delay slot, so treat them as approximate (L21 p46)')
  return { ...stream, items: out, notes, delaySlots: true }
}

/** Earlier instructions that can move into the delay slot of the branch at static index `branch` (L21 p46-48). */
export function delaySlotCandidates(stream: Stream, branch: number): { index: number; name: string; ok: boolean; why: string }[] {
  const ins = stream.program.instructions
  const b = ins[branch]
  if (!b || opClass(b) !== 'branch') return []
  const res: { index: number; name: string; ok: boolean; why: string }[] = []
  const bUse = regUse(b)
  // Same basic block only: stop at a label (another path may jump in) or an earlier branch/jump.
  for (let k = branch - 1; k >= 0; k--) {
    const c = ins[k]
    const cls = opClass(c)
    if (cls === 'branch' || cls === 'jump' || cls === 'jr') break
    const u = regUse(c)
    const between = ins.slice(k + 1, branch + 1).map(regUse)
    let why = ''
    if (u.writes !== null && bUse.reads.includes(u.writes)) why = `the branch reads ${stream.names[k]}'s result`
    else {
      for (const [j, o] of between.entries()) {
        const who = stream.names[k + 1 + j]
        if (u.writes !== null && o.reads.includes(u.writes)) { why = `RAW: ${who} reads its result`; break }
        if (o.writes !== null && u.reads.includes(o.writes)) { why = `WAR: ${who} overwrites a register it reads`; break }
        if (o.writes !== null && o.writes === u.writes) { why = `WAW: ${who} writes the same register`; break }
      }
    }
    res.push({ index: k, name: stream.names[k], ok: !why, why: why || 'no dependency with the instructions it jumps over, and the branch does not use its result' })
    if (c.label) break
  }
  return res
}
