import type { Trace } from '../../core/cache'

/** One block's stay in one cache line: loaded by access loadedAt, evicted by access evictedAt (0-based), if ever. */
export interface Stay {
  block: number
  set: number
  way: number
  loadedAt: number
  evictedAt: number | null
  /** Block that took its place. */
  evictedBy: number | null
}

export const lineKey = (set: number, way: number) => `${set}:${way}`

/** Every stay in every line over the whole trace, in load order. */
export function stays(t: Trace): Stay[] {
  const all: Stay[] = []
  const open = new Map<string, Stay>()
  for (const f of t.frames) {
    if (!f.allocated || f.way === null) continue
    const key = lineKey(f.set, f.way)
    const prev = open.get(key)
    if (prev) {
      prev.evictedAt = f.index
      prev.evictedBy = f.split.block
    }
    const s: Stay = { block: f.split.block, set: f.set, way: f.way, loadedAt: f.index, evictedAt: null, evictedBy: null }
    all.push(s)
    open.set(key, s)
  }
  return all
}

/** Blocks each line held and lost by access `index` (inclusive), oldest first, keyed by lineKey. */
export function evictedBy(all: Stay[], index: number): Map<string, Stay[]> {
  const out = new Map<string, Stay[]>()
  for (const s of all) {
    if (s.evictedAt === null || s.evictedAt > index) continue
    const key = lineKey(s.set, s.way)
    out.set(key, [...(out.get(key) ?? []), s])
  }
  return out
}

/** The last time `block` was in the cache before access `index`, or null if it never was (a cold miss). */
export function lastStay(all: Stay[], block: number, index: number): Stay | null {
  let found: Stay | null = null
  for (const s of all) if (s.block === block && s.loadedAt < index) found = s
  return found
}
