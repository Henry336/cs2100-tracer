import { describe, expect, it } from 'vitest'
import { parseAccesses, simulate } from '../../core/cache'
import { evictedBy, lastStay, stays } from './history'
import { DEFAULT_CFG, toConfig } from './presets'

// L22 p55-62: 32 B direct mapped, 8 B blocks; loads 4 0 8 12 36 0 4 give M H M H M M H.
const trace = () => {
  const r = simulate(toConfig({ ...DEFAULT_CFG, cache: 32, block: 8, ways: 1 }), parseAccesses('4 0 8 12 36 0 4').accesses)
  if (!r.ok) throw new Error(r.errors.join())
  return r.value
}

describe('Cache line history', () => {
  it('records each block a line held and what evicted it', () => {
    const all = stays(trace())
    expect(all.map((s) => [s.block, s.set, s.loadedAt, s.evictedAt, s.evictedBy])).toEqual([
      [0, 0, 0, 4, 4],
      [1, 1, 2, null, null],
      [4, 0, 4, 5, 0],
      [0, 0, 5, null, null],
    ])
  })
  it('shows only evictions up to the current access', () => {
    const all = stays(trace())
    expect(evictedBy(all, 3).size).toBe(0)
    expect(evictedBy(all, 4).get('0:0')?.map((s) => s.block)).toEqual([0])
    expect(evictedBy(all, 6).get('0:0')?.map((s) => s.block)).toEqual([0, 4])
  })
  it('tells a cold miss from a repeat', () => {
    const all = stays(trace())
    expect(lastStay(all, 4, 4)).toBeNull()
    expect(lastStay(all, 0, 5)?.evictedAt).toBe(4)
  })
})
