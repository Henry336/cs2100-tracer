// Engine checks beyond the spec fixtures: write policies, generators, calculators, parsing and validation.
// All derived (constructed and simulated under L22 p66-69 / L23 conventions, no official key).
import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  averageAccessTime,
  geometry,
  matrixTrace,
  parseAccesses,
  simulate,
  storageBits,
  type Access,
  type CacheConfig,
  type Trace,
} from './index'

function ok<T>(r: { ok: true; value: T } | { ok: false; errors: string[] }): T {
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}
const run = (c: CacheConfig, a: Access[]): Trace => ok(simulate(c, a))
const ops = (text: string) => parseAccesses(text).accesses
const traffic = (t: Trace) => {
  const { blockReads, wordWrites, writeBacks } = t.summary.traffic
  return { blockReads, wordWrites, writeBacks }
}
const dm4x8: CacheConfig = { cacheBytes: 32, blockBytes: 8 }

describe('write policies (derived, constructed under L22 p66-69)', () => {
  const t1 = ops('W0 W4 W0 W4 R32 R0')

  it('write-through + allocate', () => {
    const t = run({ ...dm4x8, writeHit: 'write-through', writeMiss: 'allocate' }, t1)
    expect(t.summary.resultString).toBe('M H H H M M')
    expect(traffic(t)).toEqual({ blockReads: 3, wordWrites: 4, writeBacks: 0 })
  })

  it('write-back + allocate writes back the dirty block once', () => {
    const t = run({ ...dm4x8, writeHit: 'write-back', writeMiss: 'allocate' }, t1)
    expect(t.summary.resultString).toBe('M H H H M M')
    expect(traffic(t)).toEqual({ blockReads: 3, wordWrites: 0, writeBacks: 1 })
    expect(t.frames[4].victim).toMatchObject({ block: 0, dirty: true })
    expect(t.frames[4].traffic.map((e) => e.kind)).toEqual(['write-back', 'block-read'])
    // the read of 0 after the write-back sees the stored value, now also in memory
    expect(t.frames[5].cache[0].lines[0].words).toEqual([
      { address: 0, data: 'W3', memoryStale: false },
      { address: 4, data: 'W4', memoryStale: false },
    ])
  })

  it('write around never loads the block', () => {
    for (const writeHit of ['write-through', 'write-back'] as const) {
      const t = run({ ...dm4x8, writeHit, writeMiss: 'around' }, t1)
      expect(t.summary.resultString).toBe('M M M M M M')
      expect(traffic(t)).toEqual({ blockReads: 2, wordWrites: 4, writeBacks: 0 })
      expect(t.frames[5].missType).toBe('cold') // block 0 was never in the cache
      expect(t.frames[5].why.missType?.rule).toContain('stays cold until a read loads it') // states the app's rule (R12 p22 does not cover write around)
    }
  })

  it('second trace: dirty blocks left at the end', () => {
    const t2 = ops('W4 R0 W8 W12 R36 W0 R4')
    const wt = run({ ...dm4x8, writeHit: 'write-through' }, t2)
    expect(wt.summary.resultString).toBe('M H M H M M H')
    expect(traffic(wt)).toEqual({ blockReads: 4, wordWrites: 4, writeBacks: 0 })
    const wb = run({ ...dm4x8, writeHit: 'write-back' }, t2)
    expect(wb.summary.resultString).toBe('M H M H M M H')
    expect(traffic(wb)).toEqual({ blockReads: 4, wordWrites: 0, writeBacks: 1 })
    expect(wb.summary.dirtyAtEnd).toBe(2)
    const around = run({ ...dm4x8, writeMiss: 'around' }, t2)
    expect(around.summary.misses).toBe(7)
    expect(traffic(around)).toEqual({ blockReads: 3, wordWrites: 4, writeBacks: 0 })
  })

  it('write buffer counts each write-through word', () => {
    const t = run({ ...dm4x8, writeHit: 'write-through', writeBuffer: true }, t1)
    expect(t.summary.traffic.bufferEntries).toBe(4)
    expect(t.frames[1].traffic).toMatchObject([{ kind: 'word-write', viaBuffer: true }])
    const wb = run({ ...dm4x8, writeHit: 'write-back', writeBuffer: true }, t1)
    expect(wb.summary.traffic.bufferEntries).toBe(0)
    expect(wb.notes.join(' ')).toContain('write buffer is ignored')
  })
})

describe('row- vs column-major traversal (derived, constructed)', () => {
  const walk = (order: 'row' | 'col') =>
    ok(matrixTrace({ rows: 8, cols: 8, elemBytes: 4, order, arrays: [{ name: 'M', base: 0, kind: 'read', storage: 'row' }] }))

  it('row-wise hits 48/64, column-wise 0/64 in a 4-block cache at any associativity', () => {
    expect(run({ cacheBytes: 64, blockBytes: 16 }, walk('row')).summary.hits).toBe(48)
    for (const ways of [1, 2, 'full'] as const) {
      expect(run({ cacheBytes: 64, blockBytes: 16, ways }, walk('col')).summary.hits).toBe(0)
    }
    expect(run({ cacheBytes: 256, blockBytes: 16 }, walk('col')).summary.hits).toBe(48)
  })
})

describe('calculators', () => {
  it('AY16/17 Q6 storage and AMAT (derived, no key)', () => {
    const g = ok(geometry({ cacheBytes: 64 * 1024, blockBytes: 32, ways: 4 }))
    expect([g.offsetBits, g.blocks, g.sets, g.indexBits, g.tagBits]).toEqual([5, 2048, 512, 9, 18])
    const s = storageBits(g, true)
    expect(s.tagBitsPerSet).toBe(72)
    expect(s.totalBits).toBe(565248)
    expect(storageBits(g, false).perLine.total).toBe(256 + 18 + 1)
    const a = ok(averageAccessTime({ hitTime: 5, memoryTime: 80, target: 7 }))
    expect(a.missPenalty).toBe(85)
    expect(a.hitRate).toBe(0.975)
    expect(ok(averageAccessTime({ hitTime: 0.8, memoryTime: 10, hitRate: 0.98 })).average).toBe(1)
  })

  it('L23 p39 multilevel splits (derived)', () => {
    const w = (c: CacheConfig) => {
      const g = ok(geometry(c))
      return [g.offsetBits, g.indexBits, g.tagBits]
    }
    expect(w({ cacheBytes: 32 * 1024, blockBytes: 32, ways: 4 })).toEqual([5, 8, 19])
    expect(w({ cacheBytes: 256 * 1024, blockBytes: 128, ways: 8 })).toEqual([7, 8, 17])
    expect(w({ cacheBytes: 4 * 1024 * 1024, blockBytes: 256 })).toEqual([8, 14, 10])
  })

  it('rejects unreachable targets and bad configs with plain messages', () => {
    expect(averageAccessTime({ hitTime: 1, memoryTime: 10, target: 0.5 }).ok).toBe(false)
    const bad = geometry({ cacheBytes: 48, blockBytes: 8 })
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.errors[0]).toContain('power of two')
    expect(geometry({ cacheBytes: 32, blockBytes: 8, ways: 3 }).ok).toBe(false)
    expect(geometry({ cacheBytes: 32, blockBytes: 8, addressBits: 4 }).ok).toBe(false)
    const far = simulate({ cacheBytes: 32, blockBytes: 8, addressBits: 8 }, [{ address: 256, kind: 'read' }])
    expect(!far.ok && far.errors[0]).toBe('Access 1: address 0x100 does not fit in 8 bits.')
  })
})

describe('replacement', () => {
  it('random is repeatable for a seed', () => {
    const trace = ops('0 8 16 24 32 0 40 8 48 16')
    const c: CacheConfig = { cacheBytes: 32, blockBytes: 8, ways: 'full', replacement: 'random', seed: 7 }
    expect(run(c, trace).summary.resultString).toBe(run(c, trace).summary.resultString)
    expect(run(c, trace).frames.every((f) => f.hit || f.victim === null || f.why.placement?.working?.includes('seed 7'))).toBe(true)
  })
})

describe('parseAccesses', () => {
  it('reads decimal, hex, binary, R/W prefixes and write values', () => {
    const r = parseAccesses('4, 0x1C 0b100\nW 24=X  sw:0x18, R 8 # comment\nlw 12 // done')
    expect(r.errors).toEqual([])
    expect(r.accesses).toEqual([
      { address: 4, kind: 'read' },
      { address: 28, kind: 'read' },
      { address: 4, kind: 'read' },
      { address: 24, kind: 'write', data: 'X' },
      { address: 24, kind: 'write' },
      { address: 8, kind: 'read' },
      { address: 12, kind: 'read' },
    ])
  })

  it('reports problems with line numbers', () => {
    const r = parseAccesses('4\n0xZZ 8\nR8=Q W')
    expect(r.errors.map((e) => e.message)).toEqual([
      'line 2: cannot read "0xZZ" as an address (use decimal, 0x hex or 0b binary)',
      'line 3: "R8=Q" gives a value, but only writes store one',
      'line 3: W needs an address after it',
    ])
    expect(r.accesses.map((a) => a.address)).toEqual([4, 8, 8])
  })
})

it('explanations contain no em dashes', () => {
  const t = run({ cacheBytes: 32, blockBytes: 8, ways: 2, writeHit: 'write-through', writeBuffer: true }, ops('W4 R0 W8 W12 R36 W0 R4 R68'))
  const json = JSON.stringify(t)
  expect(json).not.toContain(String.fromCharCode(0x2014))
  // Lazy fields live on the frame prototype; toJSON must keep them.
  const f = JSON.parse(json).frames[1]
  expect([typeof f.why.lookup.rule, f.split.tag.width, f.compares.length, f.cache.length]).toEqual(['string', 28, 2, 2])
})

it('a trace over LIMITS.accesses is refused with a plain hint', () => {
  const r = simulate({ cacheBytes: 32, blockBytes: 8 }, Array.from({ length: LIMITS.accesses + 1 }, () => ({ address: 0, kind: 'read' as const })))
  expect(!r.ok && r.errors[0]).toContain('smaller array')
})
