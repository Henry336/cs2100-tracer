// RAW / WAR / WAW pairs over the counted stream. Only RAW can stall this pipeline (L21 p13-14).
import { regLabel } from './stream'
import type { Dependency, InstrResult, Stream } from './types'

const BEYOND = {
  rule: 'Beyond the course: WAR and WAW matter when instructions can finish out of order (for example superscalar or out-of-order issue), or when writes happen in different stages. Then a later write could land before an earlier read (WAR) or before an earlier write (WAW), leaving a wrong value.',
  cite: 'L21 p14 (named only); R11 p9',
}

/**
 * Every RAW (reader and its nearest earlier writer), WAR (writer and each earlier reader since the
 * previous writer) and WAW (writer and the previous writer) pair, with the distance in instructions.
 */
export function dependencies(stream: Stream, instructions: InstrResult[]): Dependency[] {
  const rl = (r: number) => regLabel(r, stream.regStyle)
  const out: Dependency[] = []
  const lastWriter = new Map<number, number>()
  const readersSince = new Map<number, number[]>()
  const bySeq = new Map(instructions.map((i) => [i.seq, i]))
  const name = (seq: number) => stream.items[seq - 1].name
  for (const it of stream.items) {
    for (const r of it.reads) {
      const w = lastWriter.get(r)
      if (w !== undefined) {
        const op = bySeq.get(it.seq)?.operands.find((o) => o.register === r)
        const stalls = op?.stalls ?? 0
        out.push({
          kind: 'RAW', from: w, to: it.seq, register: r, distance: it.seq - w, stalls,
          why: {
            rule: stalls
              ? `True dependency on ${rl(r)}: ${it.name} waits ${stalls} cycle${stalls > 1 ? 's' : ''} for ${name(w)}`
              : `True dependency on ${rl(r)}, but no stall: the value arrives in time (${op?.forward.path ?? 'register file'})`,
            ...(op ? { working: op.why.working } : {}),
            cite: op?.why.cite ?? 'L21 p13',
          },
        })
      }
      const since = readersSince.get(r)
      if (since) since.push(it.seq)
      else readersSince.set(r, [it.seq])
    }
    const r = it.writes
    if (r === null) continue
    for (const q of readersSince.get(r) ?? []) {
      if (q === it.seq) continue
      out.push({
        kind: 'WAR', from: q, to: it.seq, register: r, distance: it.seq - q, stalls: 0,
        why: { rule: `${name(q)} reads ${rl(r)} in ID (stage 2) before ${it.name} writes it in WB (stage 5); in-order issue keeps that order, so no stall`, cite: 'L21 p14; R11 p9' },
        beyond: BEYOND,
      })
    }
    const w = lastWriter.get(r)
    if (w !== undefined) {
      out.push({
        kind: 'WAW', from: w, to: it.seq, register: r, distance: it.seq - w, stalls: 0,
        why: { rule: `Both write ${rl(r)} in WB, and WB happens in program order, so ${it.name}'s value lands last; no stall`, cite: 'L21 p14; R11 p9' },
        beyond: BEYOND,
        examNote: 'The AY25/26 Q4 key still answers "WAW hazard" (E) for a snippet whose only dependency is this kind',
      })
    }
    lastWriter.set(r, it.seq)
    readersSince.set(r, [])
  }
  return out
}
