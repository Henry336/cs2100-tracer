// Trace presets and the shared UI config. Every preset names its source; derived ones say they have no key.
import {
  fetchLoopTrace,
  matrixTrace,
  type Access,
  type CacheConfig,
  type Replacement,
  type Result,
  type WriteHitPolicy,
  type WriteMissPolicy,
} from '../../core/cache'
import { loopAccesses, type LoopForm } from './loop'

/** UI form of a cache config. Short keys keep the URL short. */
export interface Cfg {
  cache: number
  block: number
  word: number
  addr: number
  ways: number | 'full'
  repl: Replacement
  hit: WriteHitPolicy
  buf: boolean
  miss: WriteMissPolicy
}

export const DEFAULT_CFG: Cfg = { cache: 32, block: 8, word: 4, addr: 32, ways: 1, repl: 'lru', hit: 'write-back', buf: false, miss: 'allocate' }

/** URL state is any JSON, so start from the defaults; the engine reports bad values as plain errors. */
export const normCfg = (raw: unknown): Cfg =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...DEFAULT_CFG, ...(raw as Partial<Cfg>) } : DEFAULT_CFG

export const toConfig = (c: Cfg): CacheConfig => ({
  cacheBytes: c.cache,
  blockBytes: c.block,
  wordBytes: c.word,
  addressBits: c.addr,
  ways: c.ways,
  replacement: c.repl,
  writeHit: c.hit,
  writeBuffer: c.buf,
  writeMiss: c.miss,
})

export interface TracePreset {
  id: string
  name: string
  source: string
  cfg: Partial<Cfg>
  /** Typed trace, loaded into the editor. */
  text?: string
  /** Generated trace (loops), kept as a preset id in the URL. */
  gen?: () => Result<Access[]>
  /** Array loop: loads into the loop builder so n and the bases can be changed. */
  loop?: LoopForm
  /** What the source expects, shown when the preset is loaded. */
  expect: string
}

const KB = 1024

const c16Fetch = () =>
  fetchLoopTrace({
    base: 0x00400050,
    prologue: [{ from: 1, to: 5 }],
    iterations: 1000,
    body: [
      { from: 6, to: 10 },
      { from: 11, to: 16, when: { mod: 4, in: [0, 1] } },
      { from: 17, to: 20 },
    ],
    exit: [{ from: 6, to: 7 }],
  })

const arrays3 = (n: number): LoopForm => ({
  arrays: [
    { name: 'A', base: '0xffff0000', elem: 4, len: n },
    { name: 'B', base: '', elem: 4, len: n },
    { name: 'C', base: '', elem: 4, len: n },
  ],
  n,
  mod: 4,
  rem: '0 1',
  body: 'R A[i], R B[i], W C[k]',
})

const thrash = (n: number): LoopForm => ({
  arrays: [
    { name: 'A', base: '0xff000c00', elem: 4, len: n },
    { name: 'B', base: '', elem: 4, len: n },
  ],
  n,
  mod: 0,
  rem: '',
  body: 'R A[i], R B[i]',
})

const loopPreset = (form: LoopForm) => ({ loop: form, gen: () => loopAccesses(form) })

const transpose = (lwOnly: boolean): Result<Access[]> => {
  const r = matrixTrace({
    rows: 4,
    cols: 4,
    elemBytes: 4,
    order: 'row',
    arrays: [
      { name: 'A', base: 0x1000, kind: 'read', storage: 'row' },
      { name: 'B', base: 0xa010, kind: 'write', storage: 'col' },
    ],
  })
  return r.ok && lwOnly ? { ok: true, value: r.value.filter((a) => a.kind === 'read') } : r
}

const grid = (order: 'row' | 'col') =>
  matrixTrace({ rows: 8, cols: 8, elemBytes: 4, order, arrays: [{ name: 'A', base: 0, kind: 'read', storage: 'row' }] })

const seq = (from: number, to: number, step: number) => Array.from({ length: (to - from) / step + 1 }, (_, i) => from + i * step).join(', ')

export const TRACE_PRESETS: TracePreset[] = [
  {
    id: 'l22-ex',
    name: 'Direct mapped, 4 blocks of 8 B',
    source: 'L22 p55-62',
    cfg: { cache: 32, block: 8, ways: 1 },
    text: '4, 0, 8, 12, 36, 0, 4',
    expect: 'M H M H M M H. Cold, -, cold, -, cold, conflict, -. Address 36 is tag 1, index 0.',
  },
  {
    id: 'l22-read',
    name: 'Lecture read trace, 16 KB direct mapped',
    source: 'L22 p31-51',
    cfg: { cache: 16 * KB, block: 16, ways: 1 },
    text: '# p31 gives these as bit strings\nR 20\nR 28\nR 52\nR 32792\nR 16',
    expect: 'M H M M M. Load 4 is cold although index 1 is valid (tags differ); load 5 is a conflict miss.',
  },
  {
    id: 'l22-store',
    name: 'Store X after the read trace',
    source: 'L22 p63-66',
    cfg: { cache: 16 * KB, block: 16, ways: 1, hit: 'write-back' },
    text: 'R 20\nR 28\nR 52\nR 32792\nR 16\nW 24=X  # sw to tag 0, index 1, offset 8',
    expect: 'The store hits. Word2 of index 1 becomes X, so cache and memory now disagree.',
  },
  {
    id: 'l23-assoc',
    name: 'Blocks 0 4 0 4 ... on a 4-block cache',
    source: 'L23 p14-15, R12 p26',
    cfg: { cache: 16, block: 4, ways: 1 },
    text: '# block numbers 0 4 0 4 0 4 0 4\n0, 16, 0, 16, 0, 16, 0, 16',
    expect: 'Direct mapped: 2 cold and 6 conflict misses. Try 2-way: 2 cold misses and 6 hits.',
  },
  {
    id: 'l23-2way',
    name: '2-way, four 8 B blocks',
    source: 'L23 p17-22',
    cfg: { cache: 32, block: 8, ways: 2 },
    text: '4, 0, 8, 36, 0',
    expect: 'M H M M H. Address 36 goes to set 0, block 1, tag 2.',
  },
  {
    id: 'l23-lru',
    name: 'LRU, one 4-way set',
    source: 'L23 p30',
    cfg: { cache: 16, block: 4, ways: 'full', repl: 'lru' },
    text: '# block numbers 0 4 8 12 4 16 12 0 4\n0, 16, 32, 48, 16, 64, 48, 0, 16',
    expect: 'M M M M H M H M H. Block 0 is evicted at access 6, block 8 at access 8.',
  },
  {
    id: 'l23-fifo',
    name: 'Same set with FIFO',
    source: 'derived from L23 p30-31, no key',
    cfg: { cache: 16, block: 4, ways: 'full', repl: 'fifo' },
    text: '# block numbers 0 4 8 12 4 16 12 0 4\n0, 16, 32, 48, 16, 64, 48, 0, 16',
    expect: 'M M M M H M H M M (by simulation). FIFO evicts 0, then 4, then 8.',
  },
  {
    id: 'l23-org',
    name: 'Same trace, DM vs 2-way vs FA',
    source: 'L23 p32-34',
    cfg: { cache: 32, block: 8, ways: 1 },
    text: '4, 8, 36, 48, 68, 0, 32',
    expect: 'Direct mapped 7 misses, 2-way 7 misses, fully associative 6 misses and 1 hit. Open Compare organisations.',
  },
  {
    id: 't11',
    name: '16-bit words, 2-word blocks, 16 blocks',
    source: 'T11 Q1, derived, no key',
    cfg: { cache: 64, block: 4, word: 2, ways: 1 },
    text: '4, 92, 7, 146, 30, 95, 176, 93, 145, 264, 6',
    expect: 'Direct mapped (by simulation): M M H M M M M H H M H, 6 cold and 1 conflict. 2-way and FA: 6 cold misses, 5 hits.',
  },
  {
    id: 'mcq-fa',
    name: 'Which miss cannot happen in FA',
    source: 'AY23/24 S1 Q13',
    cfg: { cache: 16, block: 8, ways: 'full' },
    text: '0, 8, 16, 0, 8, 16',
    expect: 'Answer C (conflict). Here: 3 cold and 3 capacity misses, no conflict misses.',
  },
  {
    id: 'mcq-locality',
    name: 'Spatial or temporal hits',
    source: 'AY23/24 S1 Q14',
    cfg: { cache: 1 * KB, block: 16, ways: 1 },
    text: '0x804ab0, 0x804ab4, 0x804ab8, 0x804ab0',
    expect: 'M H H H. Accesses 2 and 3 are spatial hits, access 4 is temporal. Answer B.',
  },
  {
    id: 'mcq-dm-conflict',
    name: 'DM caches do have conflict misses',
    source: 'AY25/26 Q5 option B, R12 p46',
    cfg: { cache: 16, block: 4, ways: 1 },
    text: '0, 16, 0, 16',
    expect: 'Two conflict misses, so option B is false. On FA the first two misses are cold, so option C is false too.',
  },
  {
    id: 'c17-a',
    name: '4x4 transpose, lw and sw, direct mapped',
    source: 'AY23/24 S1 Q20(a)',
    cfg: { cache: 32, block: 8, ways: 1, miss: 'allocate' },
    gen: () => transpose(false),
    expect: 'Final tags 0x81, 0x502, 0x81, 0x81; index 1 holds M[0xa048] M[0xa04c]. 6 hits.',
  },
  {
    id: 'c17-a-lw',
    name: '4x4 transpose, lw only',
    source: 'AY23/24 S1 Q20(a), accepted alternative',
    cfg: { cache: 32, block: 8, ways: 1 },
    gen: () => transpose(true),
    expect: 'With the stores ignored, index 1 holds tag 0x81, M[0x1028] M[0x102c]. 8 hits of 16.',
  },
  {
    id: 'c17-b',
    name: '4x4 transpose, 2-way LRU',
    source: 'AY23/24 S1 Q20(b)',
    cfg: { cache: 32, block: 8, ways: 2, miss: 'allocate' },
    gen: () => transpose(false),
    expect: 'Turn on "way 0 holds the lower address". Set 0: 0x102, 0x103. Set 1: 0x103, 0xa04.',
  },
  {
    id: 'c16-ab',
    name: 'Instruction cache, 2-word blocks',
    source: 'AY23/24 S2 Q18(a)(b)',
    cfg: { cache: 64, block: 8, ways: 2, repl: 'lru' },
    gen: c16Fetch,
    expect: 'Offset 3 bits, set index 2 bits, I1 in set 2, 10 misses.',
  },
  {
    id: 'c16-c',
    name: 'Instruction cache, 4-word blocks',
    source: 'AY23/24 S2 Q18(c)',
    cfg: { cache: 64, block: 16, ways: 2, repl: 'lru' },
    gen: c16Fetch,
    expect: 'Offset 4 bits, set index 1 bit, I1 in set 1, 5 misses. The key says offset 3 and set 0, a slip.',
  },
  {
    id: 'c16-e',
    name: 'Back-to-back arrays, n = 1000',
    source: 'AY23/24 S2 Q18(d)(e)',
    cfg: { cache: 2 * KB, block: 16, ways: 1, hit: 'write-back', miss: 'allocate' },
    ...loopPreset(arrays3(1000)),
    expect: 'Index 7 bits, offset 4 bits. A hits 248 times (key accepts 248 to 250).',
  },
  {
    id: 'c16-fg',
    name: 'Back-to-back arrays, n = 768',
    source: 'AY23/24 S2 Q18(f)(g)',
    cfg: { cache: 2 * KB, block: 16, ways: 1, hit: 'write-back', miss: 'allocate' },
    ...loopPreset(arrays3(768)),
    expect: 'A hits 191 times (key 191 to 192), B 190 times (key 190 to 192).',
  },
  {
    id: 'ay2021-3200',
    name: 'Array thrash, n = 3200',
    source: 'AY20/21 Q15, derived, no key',
    cfg: { cache: 512, block: 16, ways: 1 },
    ...loopPreset(thrash(3200)),
    expect: 'A and B share every index: 0 hits for both (by simulation). Set n to 3216 in the loop builder and watch the thrash warning go.',
  },
  {
    id: 'ay2021-3216',
    name: 'Array thrash, n = 3216',
    source: 'AY20/21 Q15, derived, no key',
    cfg: { cache: 512, block: 16, ways: 1 },
    ...loopPreset(thrash(3216)),
    expect: 'One block of shift breaks the collision: 3/4 of each array hits (by simulation).',
  },
  {
    id: 'ay2021-3210',
    name: 'Array thrash, n = 3210',
    source: 'AY20/21 Q15, derived, no key',
    cfg: { cache: 512, block: 16, ways: 1 },
    ...loopPreset(thrash(3210)),
    expect: 'B starts half a block after a clash: 2407 of 3210 hits for each array (by simulation).',
  },
  {
    id: 'ay1516',
    name: 'Three arrays, 32 iterations',
    source: 'AY15/16 Q12, derived, no key',
    cfg: { cache: 128, block: 16, ways: 1 },
    ...loopPreset({
      arrays: [
        { name: 'A', base: '0x80', elem: 4, len: 34 },
        { name: 'B', base: '0xffff0040', elem: 4, len: 34 },
        { name: 'C', base: '0x12345688', elem: 4, len: 34 },
      ],
      n: 32,
      mod: 0,
      rem: '',
      body: 'R A[i], R B[i], R C[i]',
    }),
    expect: 'Hit rate 5/12 (40/96) by simulation.',
  },
  {
    id: 'wp-1',
    name: 'Stores to one block, then two reads',
    source: 'constructed under L22 p66-69',
    cfg: { cache: 32, block: 8, ways: 1 },
    text: 'W 0, W 4, W 0, W 4, R 32, R 0',
    expect: 'Write-back + allocate: 3 block reads, 0 word writes, 1 write-back. Write-through + allocate: 4 word writes. Open Write policies.',
  },
  {
    id: 'wp-2',
    name: 'Mixed stores and loads',
    source: 'constructed under L22 p66-69',
    cfg: { cache: 32, block: 8, ways: 1 },
    text: 'W 4, R 0, W 8, W 12, R 36, W 0, R 4',
    expect: 'Allocate: M H M H M M H. Write-back writes block 0 back at R 36 and ends with 2 dirty blocks.',
  },
  {
    id: 'loc-seq',
    name: 'Walk an array word by word',
    source: 'locality demo, L22 p17, p39',
    cfg: { cache: 64, block: 16, ways: 1 },
    text: `# A[0] to A[15], 4-byte ints\n${seq(0, 60, 4)}`,
    expect: 'M H H H repeated: each miss brings in the next 3 words (spatial locality).',
  },
  {
    id: 'loc-loop',
    name: 'Run the same loop three times',
    source: 'locality demo, L22 p17',
    cfg: { cache: 64, block: 16, ways: 1 },
    text: `# same 4 words, three passes\n${seq(0, 12, 4)}\n${seq(0, 12, 4)}\n${seq(0, 12, 4)}`,
    expect: 'Only the first access misses; the later passes reuse the same words (temporal locality).',
  },
  {
    id: 'loc-thrash',
    name: 'Stride equal to the cache size',
    source: 'locality demo, R12 p23',
    cfg: { cache: 64, block: 16, ways: 1 },
    text: '0, 64, 0, 64, 0, 64',
    expect: 'Every access misses although 3 of the 4 lines stay empty. Try 2-way.',
  },
  {
    id: 'rc-row',
    name: '8x8 ints, row by row',
    source: 'constructed, row vs column',
    cfg: { cache: 64, block: 16, ways: 1 },
    gen: () => grid('row'),
    expect: '48 of 64 hit: each block serves 4 neighbours in a row.',
  },
  {
    id: 'rc-col',
    name: '8x8 ints, column by column',
    source: 'constructed, row vs column',
    cfg: { cache: 64, block: 16, ways: 1 },
    gen: () => grid('col'),
    expect: '0 of 64 hit on DM, 2-way and FA alike. A 256 B cache gives 48 of 64.',
  },
]

export const PRESET_BY_ID = new Map(TRACE_PRESETS.map((p) => [p.id, p]))

/** Text form of an access list (the editor format). */
export const toText = (list: Access[]): string =>
  list.map((a) => `${a.kind === 'write' ? 'W' : 'R'} 0x${a.address.toString(16)}${a.data !== undefined ? `=${a.data}` : ''}`).join('\n')
