// Adversarial edge-case and robustness checks for the cache engine (verifier-owned).
// Each test encodes the behaviour the course (or the architecture contract) requires. All derived (no official key).
import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  arrayLoopTrace,
  averageAccessTime,
  fetchLoopTrace,
  matrixTrace,
  parseAccesses,
  simulate,
  solveFromTag,
  type Access,
  type CacheConfig,
  type MissType,
  type Trace,
} from './index'

function ok<T>(r: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}
const run = (c: CacheConfig, a: Access[]): Trace => ok(simulate(c, a))
const reads = (...addrs: number[]): Access[] => addrs.map((address) => ({ address, kind: 'read' }))
const KB = 1024
const MB = 1024 * KB

/** Warm up once, then the fastest of two timed runs, so JIT start-up does not count. */
function fastestMs(f: () => unknown): number {
  f()
  let best = Infinity
  for (let k = 0; k < 2; k++) {
    const t0 = performance.now()
    f()
    best = Math.min(best, performance.now() - t0)
  }
  return best
}

describe('3C totals (L23 p28)', () => {
  // L23 p28: Total miss = cold + conflict + capacity. A count of misses can never be negative.
  // These traces make DM / 2-way beat an equal-size FA LRU cache, so FA total - FA cold exceeds
  // the repeat misses this cache actually has; the bare formula would give conflict = -1 and -2.
  const cases: [string, CacheConfig, Access[], { cold: number; conflict: number; capacity: number }][] = [
    ['DM 2 blocks, blocks 0 1 2 0 1 2', { cacheBytes: 16, blockBytes: 8 }, reads(0, 8, 16, 0, 8, 16), { cold: 3, conflict: 0, capacity: 2 }],
    [
      '2-way 4 blocks, blocks 0..4 twice',
      { cacheBytes: 32, blockBytes: 8, ways: 2 },
      reads(0, 8, 16, 24, 32, 0, 8, 16, 24, 32),
      { cold: 5, conflict: 0, capacity: 3 },
    ],
  ]
  for (const [name, cfg, trace, want] of cases) {
    it(`never negative and adds up to total misses: ${name}`, () => {
      const t = run(cfg, trace)
      const { cold, conflict, capacity } = t.summary.threeC
      expect(conflict).toBeGreaterThanOrEqual(0)
      expect(capacity).toBeGreaterThanOrEqual(0)
      expect(cold + conflict + capacity).toBe(t.summary.misses)
      expect({ cold, conflict, capacity }).toEqual(want)
    })

    it(`summary agrees with the per-access missType3C labels: ${name}`, () => {
      const t = run(cfg, trace)
      const tally: Record<MissType, number> = { cold: 0, conflict: 0, capacity: 0 }
      for (const f of t.frames) if (f.missType3C) tally[f.missType3C]++
      const { cold, conflict, capacity } = t.summary.threeC
      expect({ cold, conflict, capacity }).toEqual(tally)
    })
  }
})

describe('fully associative with a single block', () => {
  // The student picked fully associative. L23 p27: no conflict miss, data can go anywhere.
  // L23 p28 obs 3: conflict miss is 0 for FA. R12 p24-25: a repeat miss in FA is a capacity miss.
  it('R12 p24-25: a repeat miss in a one-block FA cache is capacity, never conflict', () => {
    const t = run({ cacheBytes: 8, blockBytes: 8, ways: 'full' }, reads(0, 8, 0))
    expect(t.frames.map((f) => f.missType)).toEqual(['cold', 'cold', 'capacity'])
    expect(t.summary.missTypes.conflict).toBe(0)
  })
})

describe('generators', () => {
  // C[k++] = A[i] with no if: k advances every iteration (LoopStep doc: k counts iterations where `when`
  // held, and with no `when` it holds every time).
  it('C[k++] with no condition counts every iteration (AY23/24 S2 Q18 pattern without the if)', () => {
    const r = ok(
      arrayLoopTrace({
        arrays: [
          { name: 'A', elemBytes: 4, length: 4, base: 0 },
          { name: 'C', elemBytes: 4, length: 4 },
        ],
        iterations: 3,
        steps: [
          { array: 'A', kind: 'read' },
          { array: 'C', kind: 'write', index: 'k' },
        ],
      }),
    )
    expect(r.accesses.map((a) => a.label)).toEqual(['A[0]', 'C[0]', 'A[1]', 'C[1]', 'A[2]', 'C[2]'])
  })
})

describe('calculator validation', () => {
  // R12 p41 inverse question. An empty or fractional address width, or a negative tag, must be an error,
  // not ok with NaN sets and NaN cache size (or a cache built from a -2 bit tag).
  it('solveFromTag rejects a NaN or fractional address width and a negative tag width (R12 p41)', () => {
    expect(solveFromTag({ addressBits: NaN, blockBytes: 4 * KB, ways: 4, tagBits: 10 }).ok).toBe(false)
    expect(solveFromTag({ addressBits: 33.5, blockBytes: 4 * KB, ways: 4, tagBits: 10 }).ok).toBe(false)
    expect(solveFromTag({ addressBits: 34, blockBytes: 4 * KB, ways: 4, tagBits: -2 }).ok).toBe(false)
  })

  // L22 p20: "Hit time < Miss penalty", and the penalty includes the hit time.
  it('averageAccessTime rejects a miss penalty that is not above the hit time (L22 p20)', () => {
    expect(averageAccessTime({ hitTime: 1, missPenalty: -5, hitRate: 0.9 }).ok).toBe(false)
    expect(averageAccessTime({ hitTime: 5, missPenalty: 2, hitRate: 0.9 }).ok).toBe(false)
    expect(averageAccessTime({ hitTime: 1, memoryTime: -1, hitRate: 0.9 }).ok).toBe(false)
  })
})

describe('config validation (URL state is plain JSON, so enums arrive unchecked)', () => {
  // LFU is named in L23 p31 but not implemented, so it must be an error, not a silently mislabelled run.
  it('an unsupported replacement policy (LFU, L23 p31) is rejected', () => {
    const r = simulate({ cacheBytes: 32, blockBytes: 8, ways: 2, replacement: 'lfu' as never }, reads(0, 16, 0, 32, 48))
    expect(r.ok).toBe(false)
  })

  it('a misspelt write policy is rejected, not silently run as write-through (L22 p66)', () => {
    expect(simulate({ cacheBytes: 32, blockBytes: 8, writeHit: 'writeback' as never }, [{ address: 0, kind: 'write' }]).ok).toBe(false)
    expect(simulate({ cacheBytes: 32, blockBytes: 8, writeMiss: 'no-allocate' as never }, [{ address: 0, kind: 'write' }]).ok).toBe(false)
  })
})

describe('size limits and speed', () => {
  // Contract: never throw on user input. Both configs pass geometry() and then Array.from throws RangeError.
  it('a huge cache never throws (returns a trace or a plain error)', () => {
    expect(() => simulate({ cacheBytes: 2 ** 40, blockBytes: 16, addressBits: 48 }, reads(0))).not.toThrow()
    expect(() => simulate({ cacheBytes: 2 ** 40, blockBytes: 16, addressBits: 48, ways: 'full' }, reads(0))).not.toThrow()
  })

  // AY24/25 Q20 gives a 32 MB cache (2M sets). Sets must be created on first use.
  it('the AY24/25 Q20 32 MB cache runs (or is rejected) in under 100 ms', { timeout: 60_000 }, () => {
    const t0 = performance.now()
    simulate({ cacheBytes: 32 * MB, blockBytes: 16 }, reads(0, 16, 32, 0x100000, 0))
    expect(performance.now() - t0).toBeLessThan(100)
  })

  const q18 = ok(
    arrayLoopTrace({
      arrays: [
        { name: 'A', elemBytes: 4, length: 1000, base: 0xffff0000 },
        { name: 'B', elemBytes: 4, length: 1000 },
        { name: 'C', elemBytes: 4, length: 1000 },
      ],
      iterations: 1000,
      when: { mod: 4, in: [0, 1] },
      steps: [
        { array: 'A', kind: 'read' },
        { array: 'B', kind: 'read' },
        { array: 'C', kind: 'write', index: 'k', conditional: true },
      ],
    }),
  ).accesses
  const ay2021 = ok(
    arrayLoopTrace({
      arrays: [
        { name: 'A', elemBytes: 4, length: 3216, base: 0xff000c00 },
        { name: 'B', elemBytes: 4, length: 3216 },
      ],
      iterations: 3216,
      steps: [
        { array: 'A', kind: 'read' },
        { array: 'B', kind: 'read' },
      ],
    }),
  ).accesses

  // Same trace, fully associative at the same size (the organisation comparison, L23 p32-34, T11 (d)).
  // Unchanged lines must reuse their snapshot, or FA cost grows with slots x accesses x words.
  it('AY23/24 S2 Q18 n = 1000 (2500 accesses) on a 2 KB FA cache runs in under 100 ms', { timeout: 60_000 }, () => {
    expect(fastestMs(() => simulate({ cacheBytes: 2 * KB, blockBytes: 16, ways: 'full' }, q18))).toBeLessThan(100)
  })

  it('AY20/21 Q15 n = 3216 (6432 accesses) on a 512 B FA cache runs in under 100 ms', { timeout: 60_000 }, () => {
    expect(fastestMs(() => simulate({ cacheBytes: 512, blockBytes: 16, ways: 'full' }, ay2021))).toBeLessThan(100)
  })

  // L23 p39 L3 example (4 MB, 256 B blocks, DM = 16384 lines). Frames must not copy the whole set array.
  it('AY23/24 S2 Q18 n = 1000 on the L23 p39 L3 cache runs in under 100 ms', { timeout: 60_000 }, () => {
    expect(fastestMs(() => simulate({ cacheBytes: 4 * MB, blockBytes: 256 }, q18))).toBeLessThan(100)
  })
})

describe('robustness, second pass', () => {
  // geometry() accepts any power-of-two block up to the cache size, and every allocation or write builds one
  // snapshot entry per word. A 1 MB block (262144 words) already takes about 70 ms for three accesses, 4 MB about
  // 350 ms, and a 64 MB or 1 GB block runs the tab out of memory on the first access (an uncatchable crash).
  // Course blocks are at most 4 KB (R12 p41). Either reject huge blocks with a plain error or build words lazily.
  it('a 1 MB block never hangs: three accesses run (or are rejected) in under 20 ms', () => {
    const t0 = performance.now()
    const r = simulate({ cacheBytes: MB, blockBytes: MB }, [
      { address: 0, kind: 'read' },
      { address: 4, kind: 'write' },
      { address: 8, kind: 'read' },
    ])
    const ms = performance.now() - t0
    expect(r.ok === false || ms < 20).toBe(true)
  })

  // Task budget: exam-size traces must run well under 100 ms. AY20/21 Q15(b) n = 3216 (6432 accesses) on the
  // paper's own cache (DM 128 words, 4-word blocks = 512 B) takes 73 to 86 ms here: each frame retains about 5 KB.
  const ay2021 = ok(
    arrayLoopTrace({
      arrays: [
        { name: 'A', elemBytes: 4, length: 3216, base: 0xff000c00 },
        { name: 'B', elemBytes: 4, length: 3216 },
      ],
      iterations: 3216,
      steps: [
        { array: 'A', kind: 'read' },
        { array: 'B', kind: 'read' },
      ],
    }),
  ).accesses
  it('AY20/21 Q15 n = 3216 on the paper DM 512 B cache runs well under 100 ms (under 50 ms)', { timeout: 60_000 }, () => {
    expect(fastestMs(() => simulate({ cacheBytes: 512, blockBytes: 16 }, ay2021))).toBeLessThan(50)
  })

  // simulate() refuses more than LIMITS.accesses, but the generators build any number first. A student typing
  // n = 10000000 would allocate gigabytes before that check. Generators must stop at the same limit.
  it('generators never build more accesses than simulate() accepts (LIMITS.accesses)', () => {
    const n = LIMITS.accesses + 10_000
    const count = (r: unknown): number => {
      if (Array.isArray(r)) return r.length
      const res = r as { ok: boolean; value?: unknown }
      if (!res.ok) return 0
      const v = res.value as { accesses?: unknown[] } | unknown[]
      return Array.isArray(v) ? v.length : (v.accesses?.length ?? 0)
    }
    const loop = arrayLoopTrace({ arrays: [{ name: 'A', elemBytes: 4, length: n, base: 0 }], iterations: n, steps: [{ array: 'A', kind: 'read' }] })
    expect(count(loop)).toBeLessThanOrEqual(LIMITS.accesses)
    const matrix = matrixTrace({ rows: 250, cols: 250, elemBytes: 4, order: 'row', arrays: [{ name: 'A', base: 0, kind: 'read', storage: 'row' }] })
    expect(count(matrix)).toBeLessThanOrEqual(LIMITS.accesses)
    const fetch = fetchLoopTrace({ base: 0x00400050, iterations: n, body: [{ from: 1, to: 2 }] })
    expect(count(fetch)).toBeLessThanOrEqual(LIMITS.accesses)
  })

  // C array indices are whole numbers (R02 p25-26 linearisation). scale 0.5 currently yields "A[0.5]" at a
  // half-word address, and 2.5 iterations silently runs 3. B[i/2] in C is integer division (0, 0, 1, 1).
  it('loop counts and element indices are whole numbers (no A[0.5], no 2.5 iterations)', () => {
    const arrays = [{ name: 'A', elemBytes: 4, length: 8, base: 0 }]
    const half = arrayLoopTrace({ arrays, iterations: 4, steps: [{ array: 'A', kind: 'read', scale: 0.5 }] })
    if (half.ok) for (const a of half.value.accesses) expect(Number.isInteger(a.address / 4)).toBe(true)
    expect(arrayLoopTrace({ arrays, iterations: 2.5, steps: [{ array: 'A', kind: 'read' }] }).ok).toBe(false)
  })

  // Contract: parsers never throw on user input. Trace text comes from URL state, which is any JSON a link carries.
  it('parseAccesses does not throw on a non-string value from a doctored link', () => {
    expect(() => parseAccesses(42 as never)).not.toThrow()
    expect(() => parseAccesses(undefined as never)).not.toThrow()
  })
})
