// Every cache fixture from docs/spec/pipeline-cache.md (C1-C17), named by spec id.
// official = from slides or an answer key; derived = worked out with no key (T11, extra checks).
import { describe, expect, it } from 'vitest'
import {
  addressBitsForMemory,
  arrayLoopTrace,
  averageAccessTime,
  fetchLoopTrace,
  geometry,
  linesByAddress,
  matrixTrace,
  pipelineCacheModel,
  simulate,
  solveFromTag,
  splitAddress,
  type Access,
  type CacheConfig,
  type LineSnapshot,
  type Trace,
} from './index'

const fixture = (id: string, status: 'official' | 'derived', source: string, fn: () => void) => it(`${id} [${status}] ${source}`, fn)

function ok<T>(r: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}
const run = (c: CacheConfig, a: Access[]): Trace => ok(simulate(c, a))
const reads = (...addrs: number[]): Access[] => addrs.map((address) => ({ address, kind: 'read' }))
const widths = (c: CacheConfig) => {
  const g = ok(geometry(c))
  return [g.offsetBits, g.indexBits, g.tagBits]
}
const end = (t: Trace) => t.frames[t.frames.length - 1].cache
const labels = (t: Trace) => t.frames.map((f) => (f.hit ? 'H' : f.missType))
const line = (l: LineSnapshot) => ({ tag: l.tag, words: l.words.map((w) => w.address) })
const validLines = (t: Trace) => end(t).flatMap((s) => s.lines.filter((l) => l.valid).map((l) => ({ set: s.index, ...line(l) })))

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

describe('cache fixtures', () => {
  fixture('C1', 'official', 'L22 p29; p54', () => {
    expect(widths({ cacheBytes: 16 * KB, blockBytes: 16 })).toEqual([4, 10, 18])
    expect(widths({ cacheBytes: 32, blockBytes: 8 })).toEqual([3, 2, 27])
  })

  const c2Config: CacheConfig = { cacheBytes: 16 * KB, blockBytes: 16 }
  const c2Reads = reads(0x14, 0x1c, 0x34, 0x8018, 0x10)

  fixture('C2', 'official', 'L22 p31-51', () => {
    const t = run(c2Config, c2Reads)
    expect(t.summary.resultString).toBe('M H M M M')
    expect(labels(t)).toEqual(['cold', 'H', 'cold', 'cold', 'conflict'])
    // Load 4: valid but tags mismatch, still cold (L22 p45)
    const f4 = t.frames[3]
    expect(f4.compares[0]).toMatchObject({ valid: true, match: false, tag: 0 })
    expect(f4.split).toMatchObject({ set: 1, block: 2049 })
    expect(f4.split.tag.value).toBe(2)
    expect(f4.split.offset.value).toBe(8)
    expect(f4.victim).toMatchObject({ block: 1, tag: 0 })
    expect(t.frames[4].victim).toMatchObject({ block: 2049, tag: 2 })
    expect(t.frames[1].locality).toBe('spatial') // L22 p39
    expect(validLines(t)).toEqual([
      { set: 1, tag: 0, words: [16, 20, 24, 28] },
      { set: 3, tag: 0, words: [48, 52, 56, 60] },
    ])
  })

  fixture('C3', 'official', 'L22 p63-65', () => {
    const store: Access = { address: 0x18, kind: 'write', data: 'X' }
    const wb = run({ ...c2Config, writeHit: 'write-back' }, [...c2Reads, store])
    const f = wb.frames[5]
    expect(f.hit).toBe(true)
    expect(f.split.offset.value).toBe(8)
    expect(f.split.wordInBlock).toBe(2)
    const w2 = f.cache[1].lines[0].words[2]
    expect(w2).toEqual({ address: 24, data: 'X', memoryStale: true })
    expect(f.cache[1].lines[0].dirty).toBe(true)
    // Write-through keeps memory consistent (L22 p66)
    const wt = run({ ...c2Config, writeHit: 'write-through' }, [...c2Reads, store])
    expect(wt.frames[5].cache[1].lines[0].words[2].memoryStale).toBe(false)
    expect(wt.frames[5].traffic).toMatchObject([{ kind: 'word-write', address: 24, data: 'X' }])
  })

  fixture('C4', 'official', 'L22 p55-62', () => {
    const t = run({ cacheBytes: 32, blockBytes: 8 }, reads(4, 0, 8, 12, 36, 0, 4))
    expect(t.summary.resultString).toBe('M H M H M M H')
    expect(labels(t)).toEqual(['cold', 'H', 'cold', 'H', 'cold', 'conflict', 'H'])
    expect(t.frames[4].split.tag.value).toBe(1)
    expect(t.frames[4].split.set).toBe(0)
    expect(validLines(t)).toEqual([
      { set: 0, tag: 0, words: [0, 4] },
      { set: 1, tag: 0, words: [8, 12] },
    ])
  })

  fixture('C5', 'official', 'L22 p21', () => {
    const r = ok(averageAccessTime({ hitTime: 0.8, memoryTime: 10, target: 1 }))
    expect(r.missPenalty).toBe(10.8)
    expect(r.hitRate).toBe(0.98)
  })

  fixture('C6', 'official', 'L23 p12; p17; p27', () => {
    expect(widths({ cacheBytes: 4 * KB, blockBytes: 4, ways: 4 })).toEqual([2, 8, 22])
    expect(widths({ cacheBytes: 32, blockBytes: 8, ways: 2 })).toEqual([3, 1, 28])
    const fa = ok(geometry({ cacheBytes: 4 * KB, blockBytes: 16, ways: 'full' }))
    expect([fa.offsetBits, fa.indexBits, fa.tagBits, fa.blocks, fa.mapping]).toEqual([4, 0, 28, 256, 'full'])
  })

  fixture('C7', 'official', 'L23 p14-15 (= R12 p26)', () => {
    const trace = reads(...[0, 4, 0, 4, 0, 4, 0, 4].map((b) => b * 4))
    const dm = run({ cacheBytes: 16, blockBytes: 4 }, trace)
    expect(dm.summary.missTypes).toEqual({ cold: 2, conflict: 6, capacity: 0 })
    expect(dm.summary.hits).toBe(0)
    const sa = run({ cacheBytes: 16, blockBytes: 4, ways: 2 }, trace)
    expect(sa.summary.missTypes).toEqual({ cold: 2, conflict: 0, capacity: 0 })
    expect(sa.summary.hits).toBe(6)
  })

  fixture('C8', 'official', 'L23 p17-22', () => {
    const t = run({ cacheBytes: 32, blockBytes: 8, ways: 2 }, reads(4, 0, 8, 36, 0))
    expect(t.summary.resultString).toBe('M H M M H')
    expect(t.frames[3].split).toMatchObject({ set: 0, block: 4 })
    expect(t.frames[3].split.tag.value).toBe(2)
    expect(t.frames[3].way).toBe(1)
    expect(validLines(t)).toEqual([
      { set: 0, tag: 0, words: [0, 4] },
      { set: 0, tag: 2, words: [32, 36] },
      { set: 1, tag: 0, words: [8, 12] },
    ])
    expect(t.frames[4].locality).toBe('temporal') // L23 p22
  })

  fixture('C9', 'official', 'L23 p30', () => {
    const blocks = [0, 4, 8, 12, 4, 16, 12, 0, 4]
    const t = run({ cacheBytes: 16, blockBytes: 4, ways: 4 }, reads(...blocks.map((b) => b * 4)))
    expect(t.summary.resultString).toBe('M M M M H M H M H')
    expect(t.frames[5].victim?.block).toBe(0)
    expect(t.frames[7].victim?.block).toBe(8)
    expect(t.frames[8].orderAfter).toEqual([16, 12, 0, 4])
  })

  fixture('C9 FIFO', 'derived', 'L23 p30-31 by simulation', () => {
    const blocks = [0, 4, 8, 12, 4, 16, 12, 0, 4]
    const t = run({ cacheBytes: 16, blockBytes: 4, ways: 4, replacement: 'fifo' }, reads(...blocks.map((b) => b * 4)))
    expect(t.summary.resultString).toBe('M M M M H M H M M')
    expect([t.frames[5], t.frames[7], t.frames[8]].map((f) => f.victim?.block)).toEqual([0, 4, 8])
  })

  fixture('C10', 'official', 'L23 p32-34', () => {
    const trace = reads(4, 8, 36, 48, 68, 0, 32)
    const dm = run({ cacheBytes: 32, blockBytes: 8 }, trace)
    expect(dm.summary.misses).toBe(7)
    expect(validLines(dm)).toEqual([
      { set: 0, tag: 1, words: [32, 36] },
      { set: 1, tag: 0, words: [8, 12] },
      { set: 2, tag: 1, words: [48, 52] },
    ])
    const fa = run({ cacheBytes: 32, blockBytes: 8, ways: 'full' }, trace)
    expect(fa.summary.resultString).toBe('M M M M M M H')
    expect(end(fa)[0].lines.map((l) => l.tag)).toEqual([8, 0, 4, 6])
    const sa = run({ cacheBytes: 32, blockBytes: 8, ways: 2 }, trace)
    expect(sa.summary.misses).toBe(7)
    expect(validLines(sa).map((l) => [l.set, l.tag])).toEqual([
      [0, 0],
      [0, 2],
      [1, 0],
    ])
    // Ambiguity 10: R12 labels vs L23 p28 totals for the DM cache
    expect(dm.summary.threeC).toMatchObject({ cold: 5, capacity: 1, conflict: 1, faMisses: 6 })
    expect(dm.frames[5].missType).toBe('conflict')
    expect(dm.frames[5].missType3C).toBe('capacity')
    expect(dm.frames[6].missType3C).toBe('conflict')
  })

  describe('C11 T11 Q1 (no key)', () => {
    const t11 = reads(4, 92, 7, 146, 30, 95, 176, 93, 145, 264, 6)
    const base: CacheConfig = { cacheBytes: 64, blockBytes: 4, wordBytes: 2 }

    fixture('C11 direct mapped', 'derived', 'T11 Q1(a)(b)', () => {
      expect(widths(base)).toEqual([2, 4, 26])
      const t = run(base, t11)
      expect(labels(t)).toEqual(['cold', 'cold', 'H', 'cold', 'cold', 'conflict', 'cold', 'H', 'H', 'cold', 'H'])
      expect(validLines(t)).toEqual([
        { set: 1, tag: 0, words: [4, 6] },
        { set: 2, tag: 4, words: [264, 266] },
        { set: 4, tag: 2, words: [144, 146] },
        { set: 7, tag: 1, words: [92, 94] },
        { set: 12, tag: 2, words: [176, 178] },
      ])
    })

    fixture('C11 2-way', 'derived', 'T11 Q1(c)', () => {
      expect(widths({ ...base, ways: 2 })).toEqual([2, 3, 27])
      const t = run({ ...base, ways: 2 }, t11)
      expect(t.summary.resultString).toBe('M M H M M H M H H M H')
      expect(t.summary.missTypes).toEqual({ cold: 6, conflict: 0, capacity: 0 })
      const tags = (s: number) => end(t)[s].lines.filter((l) => l.valid).map(line)
      expect(tags(4).map((l) => l.tag).sort()).toEqual([4, 5])
      expect(tags(7)).toEqual([
        { tag: 2, words: [92, 94] },
        { tag: 0, words: [28, 30] },
      ])
    })

    fixture('C11 fully associative', 'derived', 'T11 Q1(d)', () => {
      const t = run({ ...base, ways: 'full' }, t11)
      expect(t.summary.resultString).toBe('M M H M M H M H H M H')
      expect(t.summary.missTypes).toEqual({ cold: 6, conflict: 0, capacity: 0 })
      expect(validLines(t).map((l) => l.tag)).toEqual([1, 23, 36, 7, 44, 66])
      expect(validLines(t)[3].words).toEqual([28, 30])
    })
  })

  fixture('C12', 'official', 'R12 p40-42', () => {
    // Q1: 4 GB memory, 32 KB DM, 32 B blocks
    const bits1 = ok(addressBitsForMemory(4 * GB)).bits
    const g = ok(geometry({ addressBits: bits1, cacheBytes: 32 * KB, blockBytes: 32 }))
    expect([g.offsetBits, g.indexBits, g.tagBits, g.blocks]).toEqual([5, 10, 17, 1024])
    const sp = splitAddress(g, 0x12345678)
    expect([sp.tag.bits, sp.index.bits, sp.offset.bits]).toEqual(['00010010001101000', '1010110011', '11000'])
    expect([sp.tag.value, sp.index.value, sp.offset.value]).toEqual([0x2468, 691, 24])
    // Q2: 4-way, 4 KB blocks, 16 GB memory, 10 tag bits
    const bits2 = ok(addressBitsForMemory(16 * GB)).bits
    expect(bits2).toBe(34)
    const inv = ok(solveFromTag({ addressBits: bits2, blockBytes: 4 * KB, ways: 4, tagBits: 10 }))
    expect([inv.offsetBits, inv.indexBits, inv.sets, inv.cacheBytes]).toEqual([12, 12, 4096, 64 * MB])
    // Q3: FA, 256 MB memory, 16 KB cache, 256 B blocks
    const bits3 = ok(addressBitsForMemory(256 * MB)).bits
    expect(widths({ addressBits: bits3, cacheBytes: 16 * KB, blockBytes: 256, ways: 'full' })).toEqual([8, 0, 20])
  })

  describe('C13 MCQs', () => {
    fixture('C13 AY24/25 Q14', 'official', 'AY24/25 key p17', () => {
      expect(widths({ cacheBytes: 32 * KB, blockBytes: 16, ways: 4 })[2]).toBe(19)
    })
    fixture('C13 AY25/26 Q9', 'official', 'AY25/26 key p5; R12 p47', () => {
      expect(widths({ cacheBytes: 32 * KB, blockBytes: 8, ways: 8 })[2]).toBe(20)
    })
    fixture('C13 AY23/24 S1 Q15', 'official', 'AY23/24 S1 key (D)', () => {
      const g = ok(geometry({ cacheBytes: 2048 * 16, blockBytes: 16, ways: 4 }))
      expect([g.ranges.tag?.text, g.ranges.index?.text, g.ranges.offset?.text]).toEqual(['31..13', '12..4', '3..0'])
    })
    fixture('C13 AY25/26 Q5', 'official', 'R12 p46 (A); options B and C shown false', () => {
      // A is the L23 p16 rule of thumb, not a computation. B: DM caches do have conflict misses. C: FA caches do have cold misses.
      const trace = reads(0, 16, 0, 16)
      expect(run({ cacheBytes: 16, blockBytes: 4 }, trace).summary.missTypes.conflict).toBeGreaterThan(0)
      expect(run({ cacheBytes: 16, blockBytes: 4, ways: 'full' }, trace).summary.missTypes.cold).toBeGreaterThan(0)
    })
    fixture('C13 AY23/24 S1 Q13', 'official', 'AY23/24 S1 key (C)', () => {
      const t = run({ cacheBytes: 16, blockBytes: 8, ways: 'full' }, reads(0, 8, 16, 0, 8, 16))
      expect(t.summary.missTypes).toEqual({ cold: 3, conflict: 0, capacity: 3 })
      expect(t.frames.some((f) => f.missType === 'conflict')).toBe(false)
    })
    fixture('C13 AY23/24 S1 Q14', 'official', 'AY23/24 S1 key (B)', () => {
      const t = run({ cacheBytes: 1 * KB, blockBytes: 16 }, reads(0x804ab0, 0x804ab4, 0x804ab8, 0x804ab0))
      expect(t.summary.resultString).toBe('M H H H')
      expect(t.frames.map((f) => f.locality)).toEqual([null, 'spatial', 'spatial', 'temporal'])
    })
  })

  fixture('C14', 'official', 'AY24/25 Q20; R12 p44-45', () => {
    const base = { blockBytes: 16, cyclesPerWord: 10, hitRate: 0.95, dataFraction: 0.32, instructions: 100 }
    const r = ok(pipelineCacheModel({ ...base, restart: false }))
    expect([r.missPenalty, r.lwHit, r.lwMiss, r.cyclesLost]).toEqual([40, 5, 45, 64])
    expect(r.dataAccessCycles).toBe(94.4)
    // Accepted alternatives: penalty 41, lost 66 (65.6), total 96
    const alt = ok(pipelineCacheModel({ ...base, restart: true }))
    expect([alt.missPenalty, alt.cyclesLost, Math.round(alt.cyclesLost), alt.dataAccessCycles]).toEqual([41, 65.6, 66, 96])
    // (e) False: a faster CPU makes each word cost more cycles, so lost cycles rise
    expect(ok(pipelineCacheModel({ ...base, cyclesPerWord: 20, restart: false })).cyclesLost).toBeGreaterThan(r.cyclesLost)
  })

  fixture('C15', 'official', 'AY25/26 Q20; R12 p48', () => {
    const r = ok(pipelineCacheModel({ blockBytes: 16, cyclesPerWord: 5, restart: true, hitRate: 0.9, dataFraction: 1, instructions: 1 }))
    expect([r.missPenalty, r.lwHit, r.lwMiss, r.beq]).toEqual([21, 5, 25, 5])
    // (e) False: associativity is not an input to the penalty
    expect(r.notes.some((n) => n.includes('associativity'))).toBe(true)
  })

  describe('C16 AY23/24 S2 Q18', () => {
    const fetch = ok(fetchLoopTrace({
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

    fixture('C16 (a)(b)', 'official', 'key p17-18', () => {
      const c: CacheConfig = { cacheBytes: 64, blockBytes: 8, ways: 2 }
      expect(widths(c).slice(0, 2)).toEqual([3, 2])
      const t = run(c, fetch)
      expect(t.frames[0].set).toBe(2)
      expect(t.summary.misses).toBe(10)
    })

    fixture('C16 (c)', 'official', 'key p18 (key slip: offset is 4 bits, I1 in set 1)', () => {
      const c: CacheConfig = { cacheBytes: 64, blockBytes: 16, ways: 2 }
      expect(widths(c).slice(0, 2)).toEqual([4, 1])
      const t = run(c, fetch)
      expect(t.frames[0].set).toBe(1)
      expect(t.summary.misses).toBe(5)
    })

    const data = (n: number) =>
      ok(
        arrayLoopTrace({
          arrays: [
            { name: 'A', elemBytes: 4, length: n, base: 0xffff0000 },
            { name: 'B', elemBytes: 4, length: n },
            { name: 'C', elemBytes: 4, length: n },
          ],
          iterations: n,
          when: { mod: 4, in: [0, 1] },
          steps: [
            { array: 'A', kind: 'read', conditional: true },
            { array: 'B', kind: 'read', conditional: true },
            { array: 'C', kind: 'write', index: 'k', conditional: true },
          ],
        }),
      )
    const dcache: CacheConfig = { cacheBytes: 512 * 4, blockBytes: 16, writeHit: 'write-back', writeMiss: 'allocate' }
    const hitsOf = (t: Trace, name: string) => t.summary.groups.find((g) => g.name === name)?.hits

    fixture('C16 (d)', 'official', 'key p18', () => {
      expect(widths(dcache).slice(0, 2).reverse()).toEqual([7, 4])
      const { arrays } = data(1000)
      expect(arrays.map((a) => a.base)).toEqual([0xffff0000, 0xffff0fa0, 0xffff1f40])
      const g = ok(geometry(dcache))
      expect([splitAddress(g, arrays[1].base).set, splitAddress(g, arrays[2].base).set]).toEqual([122, 116])
    })

    fixture('C16 (e)', 'official', 'key p18 (248, range 248-250)', () => {
      expect(hitsOf(run(dcache, data(1000).accesses), 'A')).toBe(248)
    })

    fixture('C16 (f)(g)', 'official', 'key p18 (191 in 191-192; 190 in 190-192)', () => {
      const t = run(dcache, data(768).accesses)
      expect(hitsOf(t, 'A')).toBe(191)
      expect(hitsOf(t, 'B')).toBe(190)
    })
  })

  describe('C17 AY23/24 S1 Q20', () => {
    const loop = ok(matrixTrace({
      rows: 4,
      cols: 4,
      elemBytes: 4,
      order: 'row',
      arrays: [
        { name: 'A', base: 0x1000, kind: 'read', storage: 'row' },
        { name: 'B', base: 0xa010, kind: 'write', storage: 'col' },
      ],
    }))
    const lwOnly = loop.filter((a) => a.kind === 'read')

    it('generates the loop addresses in program order', () => {
      expect(loop.slice(0, 4).map((a) => a.address)).toEqual([0x1000, 0xa010, 0x1004, 0xa020])
      // sw $t0, 48($a1) with $a1 = 0xa010 + 4j
      expect([loop[7].address, loop[15].address, loop[31].address]).toEqual([0xa040, 0xa044, 0xa04c])
      expect(loop.length).toBe(32)
    })

    fixture('C17 (a)', 'official', 'key p15-17', () => {
      const c: CacheConfig = { cacheBytes: 32, blockBytes: 8, writeMiss: 'allocate' }
      const t = run(c, loop)
      expect(validLines(t)).toEqual([
        { set: 0, tag: 0x81, words: [0x1020, 0x1024] },
        { set: 1, tag: 0x502, words: [0xa048, 0xa04c] },
        { set: 2, tag: 0x81, words: [0x1030, 0x1034] },
        { set: 3, tag: 0x81, words: [0x1038, 0x103c] },
      ])
      expect(t.summary.hits).toBe(6)
      // Alternative key when sw is ignored
      const alt = run(c, lwOnly)
      expect(validLines(alt)[1]).toEqual({ set: 1, tag: 0x81, words: [0x1028, 0x102c] })
      expect(alt.summary.hits).toBe(8)
    })

    fixture('C17 (b)', 'official', 'key p17-18 (way 0 = lower address)', () => {
      const c: CacheConfig = { cacheBytes: 32, blockBytes: 8, ways: 2, writeMiss: 'allocate' }
      const sets = (t: Trace) => end(t).map((s) => linesByAddress(s).map((l) => [l.tag, l.words[0]?.address]))
      expect(sets(run(c, loop))).toEqual([
        [
          [0x102, 0x1020],
          [0x103, 0x1030],
        ],
        [
          [0x103, 0x1038],
          [0xa04, 0xa048],
        ],
      ])
      expect(sets(run(c, lwOnly))[1]).toEqual([
        [0x102, 0x1028],
        [0x103, 0x1038],
      ])
    })
  })

  // Worked examples from docs/spec/features/cache.md that have no answer key (computed by the spec author).
  describe('worked examples without a key', () => {
    const loop = (arrays: { name: string; base?: number }[], length: number, iterations = length) =>
      ok(
        arrayLoopTrace({
          arrays: arrays.map((a) => ({ ...a, elemBytes: 4, length })),
          iterations,
          steps: arrays.map((a) => ({ array: a.name, kind: 'read' as const })),
        }),
      ).accesses
    const hits = (t: Trace) => t.summary.groups.map((g) => g.hits)

    fixture('AY20/21 Q15', 'derived', 'past paper p9-10, simulated', () => {
      const c: CacheConfig = { cacheBytes: 128 * 4, blockBytes: 16 }
      expect(widths(c).slice(0, 2).reverse()).toEqual([5, 4])
      const ab = (n: number) => run(c, loop([{ name: 'A', base: 0xff000c00 }, { name: 'B' }], n))
      expect(hits(ab(3200))).toEqual([0, 0])
      expect(hits(ab(3216))).toEqual([2412, 2412]) // 3/4 of 3216
      expect(ab(3216).summary.groups.map((g) => g.reduced)).toEqual(['3/4', '3/4'])
      expect(hits(ab(3210))).toEqual([2407, 2407])
    })

    fixture('AY15/16 Q12', 'derived', 'past paper p6, simulated', () => {
      const t = run(
        { cacheBytes: 8 * 16, blockBytes: 16 },
        loop([{ name: 'A', base: 0x80 }, { name: 'B', base: 0xffff0040 }, { name: 'C', base: 0x12345688 }], 34, 32),
      )
      expect(t.summary.hitRate.text).toBe('40/96')
      expect(t.summary.hitRate.reduced).toBe('5/12') // features/cache.md: hit rate 5/12 (40/96)
      const first = (name: string, base: number, i: number) => ({ name, address: base + 4 * i })
      const want = [
        first('C', 0x12345688, 30),
        first('B', 0xffff0040, 20),
        first('B', 0xffff0040, 24),
        first('B', 0xffff0040, 28),
        first('A', 0x80, 16),
        first('A', 0x80, 20),
        first('A', 0x80, 24),
        first('A', 0x80, 28),
      ]
      expect(validLines(t).map((l) => [l.set, l.words[0]])).toEqual(want.map((w, set) => [set, w.address]))
    })
  })
})
