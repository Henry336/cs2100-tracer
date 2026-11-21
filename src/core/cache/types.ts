// Public types for the cache engine. Everything is plain JSON so it can live in the URL.

/** How a derived number was found. Rendered by <Why>. */
export interface Explain {
  rule: string
  working?: string
  cite?: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

export type AccessKind = 'read' | 'write'

export interface Access {
  address: number
  kind: AccessKind
  /** Display name, e.g. "A[3]" or "i6". */
  label?: string
  /** Tally key for per-array hit counts, e.g. "A". */
  group?: string
  /** Value stored by a write. Defaults to "W<n>", the value written by access n. */
  data?: string
}

export type Replacement = 'lru' | 'fifo' | 'random'
export type WriteHitPolicy = 'write-through' | 'write-back'
/** "around" is write around, also called write no allocate (L22 p69, L23 p37). */
export type WriteMissPolicy = 'allocate' | 'around'
export type Mapping = 'direct' | 'set' | 'full'
export type MissType = 'cold' | 'conflict' | 'capacity'

export interface CacheConfig {
  cacheBytes: number
  blockBytes: number
  /** Default 32. R12 p41-42 use 34 and 28. */
  addressBits?: number
  /** Default 4. T11 uses 2-byte words. */
  wordBytes?: number
  /** 1 = direct mapped, N = N-way, 'full' = fully associative. Default 1. */
  ways?: number | 'full'
  /** Default 'lru', the only policy the course works (L23 p29-30). */
  replacement?: Replacement
  /** Seed for 'random'. Default 1. */
  seed?: number
  /** Default 'write-back'. */
  writeHit?: WriteHitPolicy
  /** Only used with write-through (L22 p67). Default false. */
  writeBuffer?: boolean
  /** Default 'allocate' (AY23/24 S1 Q20 key, AY23/24 S2 Q18). */
  writeMiss?: WriteMissPolicy
}

export type ResolvedConfig = Required<CacheConfig>

export interface BitRange {
  hi: number
  lo: number
  /** Exam style, e.g. "31..13". */
  text: string
}

export interface Geometry {
  config: ResolvedConfig
  mapping: Mapping
  /** Number of cache blocks (lines). */
  blocks: number
  sets: number
  ways: number
  wordsPerBlock: number
  offsetBits: number
  /** Address bits - offset bits (L22 p29 "block number 28 bits"). */
  blockNumberBits: number
  indexBits: number
  tagBits: number
  ranges: { tag: BitRange | null; index: BitRange | null; offset: BitRange | null }
  why: {
    offset: Explain
    blockNumber: Explain
    blocks: Explain
    sets: Explain
    index: Explain
    tag: Explain
    wordsPerBlock: Explain
  }
}

export interface Field {
  width: number
  value: number
  /** Binary, exactly `width` digits ('' when width is 0). */
  bits: string
  range: BitRange | null
}

export interface AddressSplit {
  address: number
  /** Full address in binary, addressBits digits. */
  bits: string
  /** Block number = address >> N. */
  block: number
  /** First byte address of the block. */
  blockBase: number
  tag: Field
  index: Field
  offset: Field
  /** Set (or line) the block maps to; 0 for fully associative. */
  set: number
  wordInBlock: number
  /** Built on first read (a getter). */
  readonly why: { block: Explain; set: Explain; tag: Explain; offset: Explain; word: Explain }
}

export interface WordSnapshot {
  address: number
  /** null means the original memory word, shown as M[address]. */
  data: string | null
  /** Cache holds a newer value than memory (write-back before eviction). */
  memoryStale: boolean
}

export interface LineSnapshot {
  way: number
  valid: boolean
  dirty: boolean
  tag: number | null
  block: number | null
  /** Empty when invalid. */
  words: WordSnapshot[]
}

export interface SetSnapshot {
  index: number
  lines: LineSnapshot[]
  /** Valid way numbers, least recently used (LRU) or oldest (FIFO, random) first. */
  order: number[]
}

export interface WayCompare {
  way: number
  valid: boolean
  tag: number | null
  match: boolean
}

export interface Victim {
  way: number
  block: number
  tag: number
  dirty: boolean
}

export type Traffic =
  | { kind: 'block-read'; block: number; base: number; words: number; why: Explain }
  | { kind: 'word-write'; address: number; data: string; viaBuffer: boolean; why: Explain }
  | { kind: 'write-back'; block: number; base: number; words: number; why: Explain }

/**
 * One step of the trace. split, compares, cache, memory and why are getters on a shared prototype, built on first
 * read, so a long trace stays small. JSON.stringify includes them (toJSON); a spread copy ({ ...frame }) does not.
 */
export interface Frame {
  /** 0-based position in the trace. */
  index: number
  access: Access
  /** Built on first read (a getter). */
  readonly split: AddressSplit
  /** Set examined (0 for fully associative). */
  set: number
  /** Tag check of every way in the set, before the access. Built on first read (a getter). */
  readonly compares: WayCompare[]
  hit: boolean
  result: 'H' | 'M'
  /** Way read or written; null for a write-around miss. */
  way: number | null
  /** Per-access label in the R12 p22-25 framework. */
  missType: MissType | null
  /** Per-access label in the L23 p28 framework (equal-size FA LRU shadow cache). */
  missType3C: MissType | null
  shadowHit: boolean
  locality: 'spatial' | 'temporal' | null
  /** Block was loaded into the cache by this access. */
  allocated: boolean
  victim: Victim | null
  /** Blocks in the examined set, LRU (or oldest) first. */
  orderBefore: number[]
  orderAfter: number[]
  traffic: Traffic[]
  /** The examined set after this access. */
  setAfter: SetSnapshot
  /**
   * Cache state after this access, built on read (a getter): every set when Trace.allSets, else only sets
   * holding a valid block, by index. Snapshots are shared between frames: treat as read-only.
   */
  readonly cache: SetSnapshot[]
  /** Memory words that differ from their original value, by address. Built on read. */
  readonly memory: { address: number; data: string }[]
  running: { hits: number; misses: number }
  readonly why: {
    lookup: Explain
    outcome: Explain
    missType?: Explain
    missType3C?: Explain
    placement?: Explain
    locality?: Explain
  }
}

export interface Summary {
  accesses: number
  reads: number
  writes: number
  hits: number
  misses: number
  /** text is hits/accesses as counted ("40/96"); reduced is in lowest terms ("5/12"), as papers that ask for a fraction expect. */
  hitRate: { value: number; text: string; reduced: string; why: Explain }
  /** R12 per-access labels. */
  missTypes: Record<MissType, number>
  /** L23 p28 view, tallied from the per-access missType3C labels (so it always adds up to misses). */
  threeC: { cold: number; conflict: number; capacity: number; faMisses: number; faCold: number; why: Explain }
  traffic: {
    blockReads: number
    wordWrites: number
    writeBacks: number
    bufferEntries: number
    wordsMoved: number
    why: Explain
  }
  /** Per-array tallies; reduced is hits/accesses in lowest terms. */
  groups: { name: string; accesses: number; hits: number; misses: number; reduced: string }[]
  /** e.g. "M H M H M M H". */
  resultString: string
  dirtyAtEnd: number
}

export interface Trace {
  geometry: Geometry
  frames: Frame[]
  /** Cache state before the first access (all invalid); empty when allSets is false. */
  initial: SetSnapshot[]
  /** True when the cache has at most DENSE_SETS sets, so frame.cache lists every set. */
  allSets: boolean
  summary: Summary
  notes: string[]
}
