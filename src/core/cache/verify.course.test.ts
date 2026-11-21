// Course-fidelity checks from the adversarial verifier. Each test names the course page it encodes.
// All derived (no official key); they pin course behaviour the first engine draft got wrong.
import { describe, expect, it } from 'vitest'
import { arrayLoopTrace, fetchLoopTrace, geometry, simulate, splitAddress, type Access, type CacheConfig, type MissType, type Trace } from './index'

function ok<T>(r: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}
const run = (c: CacheConfig, a: Access[]): Trace => ok(simulate(c, a))
const reads = (...addrs: number[]): Access[] => addrs.map((address) => ({ address, kind: 'read' }))
const tally3C = (t: Trace, k: MissType) => t.frames.filter((f) => f.missType3C === k).length

describe('verify: course fidelity (cache)', () => {
  it('L23 p27 ("No Conflict Miss"), L23 p28 obs 3 and formula, AY23/24 S1 Q13 (C): an FA cache has 0 conflict misses even with FIFO; capacity(FA) = total(FA) - cold(FA)', () => {
    // L23 p30 trace on a 4-block FA cache with FIFO (derived: M M M M H M H M M, 7 misses, 5 cold).
    const blocks = [0, 4, 8, 12, 4, 16, 12, 0, 4]
    const t = run({ cacheBytes: 16, blockBytes: 4, ways: 'full', replacement: 'fifo' }, reads(...blocks.map((b) => b * 4)))
    expect(t.summary.resultString).toBe('M M M M H M H M M')
    // An FA cache is its own shadow, so an LRU shadow must not turn FIFO's extra miss into a conflict.
    expect(t.summary.threeC).toMatchObject({ cold: 5, capacity: 2, conflict: 0 })
    expect(tally3C(t, 'conflict')).toBe(0)
  })

  it('L23 p28 (Total miss = cold + conflict + capacity): 3C totals are never negative and agree with the per-access 3C labels', () => {
    // DM, four 8 B blocks; blocks 0..4 twice. DM: M M M M M M H H H M (7 misses, 5 cold).
    // An equal-size FA LRU cache misses all 10, so the bare L23 p28 formula would give capacity 5 and conflict -3.
    // Totals are tallied from the per-access labels instead.
    const t = run({ cacheBytes: 32, blockBytes: 8 }, reads(...[0, 1, 2, 3, 4, 0, 1, 2, 3, 4].map((b) => b * 8)))
    expect(t.summary.resultString).toBe('M M M M M M H H H M')
    const { cold, conflict, capacity } = t.summary.threeC
    expect(conflict).toBeGreaterThanOrEqual(0)
    expect(capacity).toBeGreaterThanOrEqual(0)
    expect(cold + conflict + capacity).toBe(t.summary.misses)
    expect({ cold, conflict, capacity }).toEqual({
      cold: tally3C(t, 'cold'),
      conflict: tally3C(t, 'conflict'),
      capacity: tally3C(t, 'capacity'),
    })
  })

  it('L23 p26-27, R12 p24-25: a cache set to fully associative stays FA when it has one block (repeat miss is capacity, never conflict)', () => {
    const t = run({ cacheBytes: 8, blockBytes: 8, ways: 'full' }, reads(0, 8, 0))
    expect(t.geometry.mapping).toBe('full')
    expect(t.frames.map((f) => f.missType)).toEqual(['cold', 'cold', 'capacity'])
  })

  it('L22 p29, p54 (Exercise #1 "Block Number = 29"); L23 p12, p17; R12 p40: geometry gives the block-number width = address bits - offset bits', () => {
    // Suggested field name: blockNumberBits. The course computes it as its own step on every split.
    expect(ok(geometry({ cacheBytes: 16 * 1024, blockBytes: 16 }))).toMatchObject({ blockNumberBits: 28 }) // L22 p29
    expect(ok(geometry({ cacheBytes: 32, blockBytes: 8 }))).toMatchObject({ blockNumberBits: 29 }) // L22 p54
    expect(ok(geometry({ cacheBytes: 4 * 1024, blockBytes: 4, ways: 4 }))).toMatchObject({ blockNumberBits: 30 }) // L23 p12
    expect(ok(geometry({ cacheBytes: 32, blockBytes: 8, ways: 2 }))).toMatchObject({ blockNumberBits: 29 }) // L23 p17
    expect(ok(geometry({ cacheBytes: 32 * 1024, blockBytes: 32 }))).toMatchObject({ blockNumberBits: 27 }) // R12 p40
  })

  it('generator robustness: C[k++] in a loop with no condition advances k every iteration (k = i)', () => {
    const r = ok(
      arrayLoopTrace({
        arrays: [
          { name: 'A', elemBytes: 4, length: 4, base: 0 },
          { name: 'C', elemBytes: 4, length: 4 },
        ],
        iterations: 4,
        steps: [
          { array: 'A', kind: 'read' },
          { array: 'C', kind: 'write', index: 'k' },
        ],
      }),
    )
    expect(r.accesses.map((a) => a.label)).toEqual(['A[0]', 'C[0]', 'A[1]', 'C[1]', 'A[2]', 'C[2]', 'A[3]', 'C[3]'])
  })
})

// Second verifier pass: claims made in answer-key explanations that no fixture pins yet.
describe('verify: answer-key explanations (cache)', () => {
  const iFetch = ok(fetchLoopTrace({
    base: 0x00400050,
    prologue: [{ from: 1, to: 5 }],
    iterations: 1000,
    body: [
      { from: 6, to: 10 },
      { from: 11, to: 16, when: { mod: 4, in: [0, 1] } },
      { from: 17, to: 20 },
    ],
    exit: [{ from: 6, to: 7 }],
  }))
  const firstIteration = 20 // i1-i5, then i6-i20 with i = 0 (both branches not taken)

  it('AY23/24 S2 Q18(b)(c) key p17-18 ("1st iteration: 10 misses. No misses in the subsequent 999 iterations"): every I-cache miss is a cold miss in iteration 1', () => {
    for (const [blockBytes, want] of [
      [8, 10],
      [16, 5],
    ] as const) {
      const t = run({ cacheBytes: 64, blockBytes, ways: 2 }, iFetch)
      const missAt = t.frames.filter((f) => !f.hit).map((f) => f.index)
      expect(missAt.length).toBe(want)
      expect(missAt.every((i) => i < firstIteration)).toBe(true)
      expect(t.summary.missTypes).toEqual({ cold: want, conflict: 0, capacity: 0 })
    }
  })

  it('AY23/24 S2 Q18(e) key p18 ("2 clashes at A[925] and A[929] with C[463] and C[465]"): those are the only A conflict misses, caused by the C block written just before', () => {
    const r = arrayLoopTrace({
      arrays: [
        { name: 'A', elemBytes: 4, length: 1000, base: 0xffff0000 },
        { name: 'B', elemBytes: 4, length: 1000 },
        { name: 'C', elemBytes: 4, length: 1000 },
      ],
      iterations: 1000,
      when: { mod: 4, in: [0, 1] },
      steps: [
        { array: 'A', kind: 'read', conditional: true },
        { array: 'B', kind: 'read', conditional: true },
        { array: 'C', kind: 'write', index: 'k', conditional: true },
      ],
    })
    if (!r.ok) throw new Error(r.errors.join('; '))
    const t = run({ cacheBytes: 2048, blockBytes: 16, writeHit: 'write-back', writeMiss: 'allocate' }, r.value.accesses)
    const aRepeat = t.frames.filter((f) => f.access.group === 'A' && f.missType === 'conflict').map((f) => f.access.label)
    expect(aRepeat).toEqual(['A[925]', 'A[929]'])
    // C[460..463] and C[464..467] are single blocks, so the key's C[463]/C[465] name the same blocks the sw of C[462]/C[464] loads.
    for (const [c, a] of [
      ['C[462]', 924],
      ['C[464]', 928],
    ] as const) {
      const f = t.frames.find((x) => x.access.label === c)!
      expect(f.victim?.block).toBe(Math.floor((0xffff0000 + 4 * a) / 16))
    }
  })

  it('AY19/20 Q8(a)-(e) (derived, no key; lw only): A = 0x0040CCC0 and B = 0x000002C0 share every index, so DM hits 0 and 2-way LRU hits 3/4', () => {
    const n = 64
    const r = arrayLoopTrace({
      arrays: [
        { name: 'A', elemBytes: 4, length: n, base: 0x0040ccc0 },
        { name: 'B', elemBytes: 4, length: n, base: 0x000002c0 },
      ],
      iterations: n,
      steps: [
        { array: 'A', kind: 'read' },
        { array: 'B', kind: 'read' },
      ],
    })
    if (!r.ok) throw new Error(r.errors.join('; '))
    const hits = (t: Trace) => t.summary.groups.map((g) => g.hits)
    const dm: CacheConfig = { cacheBytes: 64 * 4, blockBytes: 16 }
    const g = geometry(dm)
    if (!g.ok) throw new Error(g.errors.join('; '))
    expect([g.value.indexBits, g.value.offsetBits]).toEqual([4, 4])
    expect([splitAddress(g.value, 0x0040ccc0).set, splitAddress(g.value, 0x2c0 + 60 * 4).set]).toEqual([12, 11])
    expect(hits(run(dm, r.value.accesses))).toEqual([0, 0])
    const sa: CacheConfig = { ...dm, ways: 2 }
    const g2 = geometry(sa)
    if (!g2.ok) throw new Error(g2.errors.join('; '))
    expect([splitAddress(g2.value, 0x0040ccc0).set, splitAddress(g2.value, 0x2c0 + 60 * 4).set]).toEqual([4, 3])
    expect(hits(run(sa, r.value.accesses))).toEqual([(3 * n) / 4, (3 * n) / 4])
  })
})
