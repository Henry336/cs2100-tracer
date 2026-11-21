import { addr, fmtBytes, fraction, hex } from './format'
import { geometry, splitAddress } from './geometry'
import type {
  Access,
  AddressSplit,
  CacheConfig,
  Explain,
  Frame,
  Geometry,
  LineSnapshot,
  MissType,
  Result,
  SetSnapshot,
  Summary,
  Trace,
  Traffic,
  Victim,
  WayCompare,
} from './types'

interface Line {
  valid: boolean
  dirty: boolean
  block: number
  /** Word values held in the cache; undefined = original memory word. */
  data: (string | undefined)[]
  /** Word address -> access index that last used it since the block was loaded. */
  used: Map<number, number>
  loadedAt: number
  /** Snapshot of the current contents; cleared whenever the line changes. */
  snap?: LineSnapshot
}

interface SetState {
  lines: Line[]
  /** Valid ways, LRU (or oldest) first. */
  order: number[]
}

const invalidLine = (): Line => ({ valid: false, dirty: false, block: -1, data: [], used: new Map(), loadedAt: -1 })

/** Up to this many sets, frame.cache lists every set; above it, only sets holding a valid block. */
export const DENSE_SETS = 1024
/**
 * Step-by-step limits, so a low-memory phone never runs out of heap. The longest spec trace, C16, is about 12,000
 * accesses (AY23/24 S2 Q18 instruction fetches). Each line snapshot holds one entry per word, and each frame a few
 * arrays as long as the set, so accesses x words per block and accesses x ways are capped too.
 */
export const LIMITS = { accesses: 20_000, waysPerSet: 4096, wordsPerBlock: 4096, work: 2 ** 20 }

/** Hint shown when a loop is too long to step through. */
export const REPEAT_HINT =
  'Loop hit rates repeat every few blocks, so a smaller array usually gives the same hit rate. Try two smaller sizes and check they agree.'

/** Last entry of `at` that is <= i, or -1. */
function lastAtOrBefore(at: number[], i: number): number {
  let lo = 0
  let hi = at.length - 1
  let best = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (at[mid] <= i) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

/** Small seeded PRNG so 'random' replacement is repeatable from the URL. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const moveToEnd = (order: number[], way: number) => {
  const i = order.indexOf(way)
  if (i >= 0) order.splice(i, 1)
  order.push(way)
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Tag check of every way, from the set as it was before the access. */
const compareSet = (before: SetSnapshot, block: number): WayCompare[] =>
  before.lines.map((l) => ({ way: l.way, valid: l.valid, tag: l.tag, match: l.valid && l.block === block }))

function lookupWhy(g: Geometry, set: number, tag: number, before: SetSnapshot, block: number, hitWay: number, valid: number): Explain {
  const one = (x: WayCompare) => (x.valid ? `valid 1, tag ${x.tag} vs ${tag}, ${x.match ? 'match' : 'no match'}` : 'valid 0')
  if (g.mapping === 'direct') {
    return {
      rule: `Check the block at index ${set}: hit = Valid AND tags match.`,
      working: `index ${set}: ${one(compareSet(before, block)[0])}`,
      cite: 'L22 p28, p33-34',
    }
  }
  const name = g.mapping === 'full' ? 'slot' : 'way'
  const working =
    g.ways <= 8
      ? compareSet(before, block)
          .map((x) => `${name} ${x.way}: ${one(x)}`)
          .join('; ')
      : hitWay >= 0
        ? `${name} ${hitWay} holds tag ${tag}`
        : `${valid} of ${g.ways} slots valid, none holds tag ${tag}`
  return g.mapping === 'full'
    ? { rule: 'Fully associative: compare the tag with every slot in parallel.', working, cite: 'L23 p27' }
    : { rule: `Compare the tag with every way of set ${set} in parallel.`, working, cite: 'L23 p13, p18' }
}

type LazyKey = 'split' | 'compares' | 'cache' | 'memory' | 'why'
const LAZY = Symbol('lazy')

/**
 * Prototype of every frame. Its getters build split, compares, cache, memory and why on first read. Getters
 * written into each frame literal cost about 2 KB per frame; shared ones keep a long trace small.
 * toJSON keeps the lazy fields in JSON.stringify output. A spread copy of a frame drops them.
 */
class FrameBase {
  declare [LAZY]: (k: LazyKey) => unknown
  get split() {
    return this[LAZY]('split') as AddressSplit
  }
  get compares() {
    return this[LAZY]('compares') as WayCompare[]
  }
  get cache() {
    return this[LAZY]('cache') as SetSnapshot[]
  }
  get memory() {
    return this[LAZY]('memory') as Frame['memory']
  }
  get why() {
    return this[LAZY]('why') as Frame['why']
  }
  toJSON() {
    return { ...this, split: this.split, compares: this.compares, cache: this.cache, memory: this.memory, why: this.why }
  }
}

/**
 * Run a trace of reads and writes through one cache. Returns one frame per access plus a summary.
 * Never throws on user input: bad configs or addresses come back as errors.
 */
export function simulate(config: CacheConfig, accesses: Access[]): Result<Trace> {
  const geo = geometry(config)
  if (!geo.ok) return geo
  const g = geo.value
  const c = g.config
  if (!Array.isArray(accesses)) return { ok: false, errors: ['The trace must be a list of accesses.'] }
  const errors: string[] = []
  const limit = 2 ** c.addressBits
  if (accesses.length > LIMITS.accesses) {
    errors.push(`The trace has ${accesses.length} accesses; step-by-step simulation stops at ${LIMITS.accesses}. ${REPEAT_HINT}`)
  } else {
    accesses.forEach((a, i) => {
      if (!Number.isSafeInteger(a?.address) || a.address < 0) errors.push(`Access ${i + 1}: the address must be a whole number, 0 or more.`)
      else if (a.address >= limit) errors.push(`Access ${i + 1}: address ${hex(a.address)} does not fit in ${c.addressBits} bits.`)
      if (a?.kind !== 'read' && a?.kind !== 'write') errors.push(`Access ${i + 1}: kind must be read or write.`)
    })
  }
  if (g.wordsPerBlock > LIMITS.wordsPerBlock) {
    errors.push(
      `A block of ${g.wordsPerBlock} words is too large to step through (limit ${LIMITS.wordsPerBlock} words). The 4 KB block in R12 p41 is 1024 four-byte words. The field widths still apply.`,
    )
  } else if (accesses.length * g.wordsPerBlock > LIMITS.work) {
    errors.push(
      `${accesses.length} accesses on ${g.wordsPerBlock}-word blocks is too much to step through (limit ${LIMITS.work} accesses x words per block). Use fewer accesses or smaller blocks.`,
    )
  }
  if (g.ways > LIMITS.waysPerSet) {
    errors.push(`This cache has ${g.ways} blocks per set; step-by-step simulation supports up to ${LIMITS.waysPerSet}. The field widths still apply.`)
  } else if (accesses.length * g.ways > LIMITS.work) {
    errors.push(
      `${accesses.length} accesses on ${g.ways} blocks per set is too much to step through (limit ${LIMITS.work} accesses x blocks per set). Use fewer accesses or fewer ways.`,
    )
  }
  if (errors.length) return { ok: false, errors }

  const wb = c.writeHit === 'write-back'
  const buffered = !wb && c.writeBuffer
  const notes: string[] = []
  if (wb && c.writeBuffer) notes.push('The write buffer is ignored: the course pairs it with write-through (L22 p67).')
  if (c.replacement !== 'lru' && g.mapping !== 'direct') {
    notes.push('Only LRU is worked in the course. FIFO and random are only named (L23 p31), so these results are the app\'s own.')
  }

  const tagOf = (block: number) => Math.floor(block / g.sets)
  const wordAddr = (a: number) => Math.floor(a / c.wordBytes) * c.wordBytes
  const memory = new Map<number, string>()

  const invalidSnaps: LineSnapshot[] = Array.from({ length: g.ways }, (_, way) => ({ way, valid: false, dirty: false, tag: null, block: null, words: [] }))
  // memoryStale is safe to cache: memory only changes for a cached word when its line changes too.
  const snapLine = (l: Line, way: number): LineSnapshot => {
    if (!l.valid) return invalidSnaps[way]
    if (l.snap) return l.snap
    const base = l.block * c.blockBytes
    return (l.snap = {
      way,
      valid: true,
      dirty: l.dirty,
      tag: tagOf(l.block),
      block: l.block,
      words: l.data.map((d, w) => {
        const address = base + w * c.wordBytes
        return { address, data: d ?? null, memoryStale: d !== undefined && memory.get(address) !== d }
      }),
    })
  }
  const snapSet = (s: SetState, index: number): SetSnapshot => ({ index, lines: s.lines.map(snapLine), order: [...s.order] })

  // Sets are created on first touch, so a 32 MB cache costs nothing until used.
  const sets = new Map<number, SetState>()
  const getSet = (index: number): SetState => {
    let s = sets.get(index)
    if (!s) sets.set(index, (s = { lines: Array.from({ length: g.ways }, invalidLine), order: [] }))
    return s
  }
  const dense = g.sets <= DENSE_SETS
  const emptySets = new Map<number, SetSnapshot>()
  const emptySet = (index: number): SetSnapshot => {
    let e = emptySets.get(index)
    if (!e) emptySets.set(index, (e = { index, lines: invalidSnaps, order: [] }))
    return e
  }
  // Per-set history of snapshots, so each frame's full cache state is rebuilt on demand instead of copied.
  // `blocks` is each snapshot's LRU order as block numbers (the frame's orderAfter, and the next frame's orderBefore).
  const history = new Map<number, { at: number[]; snaps: SetSnapshot[]; blocks: number[][] }>()
  let touched: number[] = []
  const stateAt = (i: number): SetSnapshot[] => {
    const latest = (s: number): SetSnapshot | undefined => {
      const h = history.get(s)
      const k = h ? lastAtOrBefore(h.at, i) : -1
      return h && k >= 0 ? h.snaps[k] : undefined
    }
    if (dense) return Array.from({ length: g.sets }, (_, s) => latest(s) ?? emptySet(s))
    return touched.flatMap((s) => {
      const x = latest(s)
      return x && x.lines.some((l) => l.valid) ? [x] : []
    })
  }
  const memLog: { at: number; address: number; data: string }[] = []
  const memoryAt = (i: number): Frame['memory'] => {
    const m = new Map<number, string>()
    for (const e of memLog) {
      if (e.at > i) break
      m.set(e.address, e.data)
    }
    return [...m].map(([address, data]) => ({ address, data })).sort((x, y) => x.address - y.address)
  }
  const initial = dense ? Array.from({ length: g.sets }, (_, s) => emptySet(s)) : []

  const resident = new Set<number>() // blocks ever loaded: a miss on any other block is cold (L22 p45)
  const evictedBy = new Map<number, { by: number; at: number }>()
  // Equal-size FA LRU cache for the L23 p28 view. A Map keeps insertion order, so the first key is the LRU block.
  // An FA cache is its own shadow: it has no conflict misses whatever the policy (L23 p27).
  const useShadow = g.mapping !== 'full'
  const shadow = new Map<number, true>()
  const rng = mulberry32(c.seed)

  const frames: Frame[] = []
  let hits = 0
  let misses = 0
  const missTypes: Record<MissType, number> = { cold: 0, conflict: 0, capacity: 0 }
  let faMisses = 0
  const tally = { blockReads: 0, wordWrites: 0, writeBacks: 0, bufferEntries: 0 }
  const groups = new Map<string, { name: string; accesses: number; hits: number; misses: number }>()
  const setWord = g.mapping === 'direct' ? 'index' : 'set'

  // Explanations that do not depend on the access are built once.
  const throughWhy: Explain = buffered
    ? { rule: 'Write-through with a write buffer: the word goes into the buffer and the memory controller writes it to memory.', cite: 'L22 p67' }
    : { rule: 'Write-through: write the word to the cache and to main memory.', cite: 'L22 p66' }
  const aroundWhy: Explain = { rule: 'Write around: write the word to memory only.', cite: 'L22 p69' }
  const loadRule = `Load the whole block (${fmtBytes(c.blockBytes)}) from memory; set Tag and Valid.`
  const span = (base: number) => `bytes ${base} to ${base + c.blockBytes - 1}`
  // The app's rule: a block is cold until it is first brought in. Write around never brings it in (L22 p53, p69).
  const coldRule =
    'Cold (compulsory) miss: this block has never been brought into the cache.' +
    (c.writeMiss === 'around' ? ' Write around misses do not bring a block in, so a block stays cold until a read loads it.' : '')

  accesses.forEach((a, i) => {
    // The full split (bit strings and its working) is built when first read; simulating needs only these numbers.
    const block = Math.floor(a.address / c.blockBytes)
    const setIndex = block % g.sets
    const blockBase = block * c.blockBytes
    const wordInBlock = Math.floor((a.address - blockBase) / c.wordBytes)
    let sp: AddressSplit | undefined
    const split = () => (sp ??= splitAddress(g, a.address))
    const st = getSet(setIndex)
    const isWrite = a.kind === 'write'
    const data = isWrite ? (a.data ?? `W${i + 1}`) : ''
    const wa = wordAddr(a.address)
    // The set's last snapshot is its state before this access, so compares are built from it only when read.
    const past = history.get(setIndex)
    const before = past ? past.snaps[past.snaps.length - 1] : emptySet(setIndex)
    const orderBefore = past ? past.blocks[past.blocks.length - 1] : []
    const validBefore = st.order.length
    const hitWay = st.lines.findIndex((l) => l.valid && l.block === block)
    const hit = hitWay >= 0
    const traffic: Traffic[] = []
    const allocates = !isWrite || c.writeMiss === 'allocate'
    let way: number | null = null
    let victim: Victim | null = null
    let missType: MissType | null = null
    let locality: Frame['locality'] = null
    let prevUse: number | undefined
    let loadedAt = -1
    let ev: { by: number; at: number } | undefined
    const setMemory = (address: number, d: string) => {
      memory.set(address, d)
      memLog.push({ at: i, address, data: d })
    }
    const writeMemory = (reason: Explain) => {
      setMemory(wa, data)
      tally.wordWrites++
      if (buffered) tally.bufferEntries++
      traffic.push({ kind: 'word-write', address: wa, data, viaBuffer: buffered, why: reason })
    }

    // Shadow FA LRU of the same size and block size, with the same allocation rule (L23 p28).
    const wasResident = resident.has(block)
    const shadowHit = useShadow ? shadow.has(block) : hit
    if (useShadow) {
      if (shadowHit) shadow.delete(block)
      if (shadowHit || allocates) shadow.set(block, true)
      if (shadow.size > g.blocks) shadow.delete(shadow.keys().next().value!)
    }
    if (!shadowHit) faMisses++

    if (hit) {
      hits++
      way = hitWay
      const line = st.lines[way]
      prevUse = line.used.get(wa)
      loadedAt = line.loadedAt
      locality = prevUse === undefined ? 'spatial' : 'temporal'
      if (isWrite) {
        line.data[wordInBlock] = data
        line.snap = undefined
        if (wb) line.dirty = true
        else writeMemory(throughWhy)
      }
      line.used.set(wa, i)
      if (c.replacement === 'lru') moveToEnd(st.order, way)
    } else {
      misses++
      missType = !wasResident ? 'cold' : g.mapping === 'full' ? 'capacity' : 'conflict'
      missTypes[missType]++
      ev = evictedBy.get(block)
      if (allocates) {
        const free = st.lines.findIndex((l) => !l.valid)
        if (free >= 0) way = free
        else {
          way = g.ways === 1 ? 0 : c.replacement === 'random' ? Math.floor(rng() * g.ways) : st.order[0]
          const old = st.lines[way]
          victim = { way, block: old.block, tag: tagOf(old.block), dirty: old.dirty }
          evictedBy.set(old.block, { by: block, at: i })
          if (old.dirty) {
            old.data.forEach((d, w) => {
              if (d !== undefined) setMemory(old.block * c.blockBytes + w * c.wordBytes, d)
            })
            tally.writeBacks++
            traffic.push({
              kind: 'write-back',
              block: old.block,
              base: old.block * c.blockBytes,
              words: g.wordsPerBlock,
              why: { rule: 'Write-back: the evicted block is dirty, so write it to memory first.', working: `block ${old.block}, dirty = 1`, cite: 'L22 p68' },
            })
          }
        }
        const line: Line = {
          valid: true,
          dirty: false,
          block: block,
          data: Array.from({ length: g.wordsPerBlock }, (_, w) => memory.get(blockBase + w * c.wordBytes)),
          used: new Map(),
          loadedAt: i,
        }
        st.lines[way] = line
        moveToEnd(st.order, way)
        resident.add(block)
        tally.blockReads++
        traffic.push({
          kind: 'block-read',
          block: block,
          base: blockBase,
          words: g.wordsPerBlock,
          why: { rule: loadRule, working: span(blockBase), cite: 'L22 p35' },
        })
        if (isWrite) {
          line.data[wordInBlock] = data
          if (wb) line.dirty = true
          else writeMemory(throughWhy)
        }
        line.used.set(wa, i)
      } else {
        writeMemory(aroundWhy)
      }
    }

    const missType3C: MissType | null = hit ? null : !wasResident ? 'cold' : shadowHit ? 'conflict' : 'capacity'

    // Explanations are only text, so they are built when the UI first reads frame.why. This keeps long traces light.
    const explain = (): Frame['why'] => {
      const w = wordInBlock
      const lookup = lookupWhy(g, setIndex, split().tag.value, before, block, hitWay, validBefore)
      if (hit) {
        return {
          lookup,
          locality:
            prevUse === undefined
              ? {
                  rule: 'Spatial locality: this word was not used before, but its block was brought in with a neighbour.',
                  working: `block ${block} loaded by access ${loadedAt + 1}`,
                  cite: 'L22 p17, p39 (per-hit rule is the app\'s)',
                }
              : {
                  rule: 'Temporal locality: this same word was used earlier while the block stayed in the cache.',
                  working: `last used by access ${prevUse + 1}`,
                  cite: 'L22 p17; L23 p22 (per-hit rule is the app\'s)',
                },
          outcome: !isWrite
            ? { rule: `Read hit: return Word${w} to the register.`, working: `offset ${split().offset.value} selects Word${w}`, cite: 'L22 p38-39' }
            : wb
              ? {
                  rule: 'Write hit, write-back: write the word in the cache only and set the dirty bit. Memory is now out of date.',
                  working: `Word${w} = ${data}, dirty = 1`,
                  cite: 'L22 p65, p68',
                }
              : { ...throughWhy, rule: `Write hit. ${throughWhy.rule}`, working: `Word${w} = ${data}` },
        }
      }
      const held = validBefore > 0
      const why: Frame['why'] = {
        lookup,
        outcome: { rule: '' },
        missType:
          missType === 'cold'
            ? {
                rule: coldRule,
                working: held && g.mapping === 'direct' ? `block ${block}; the line is valid but holds another block, still cold` : `block ${block}`,
                cite: held ? 'L22 p45; R12 p22' : 'L22 p34; R12 p22',
              }
            : missType === 'conflict'
              ? {
                  rule: `Conflict miss: block ${block} was in the cache before, but another block mapping to the same ${setWord} evicted it.`,
                  working: ev ? `evicted by block ${ev.by} at access ${ev.at + 1}` : undefined,
                  cite: 'L22 p49; R12 p23',
                }
              : {
                  rule: `Capacity miss: block ${block} was in the cache before, but the full cache had to discard it.`,
                  working: ev ? `evicted by block ${ev.by} at access ${ev.at + 1}` : undefined,
                  cite: 'R12 p24-25',
                },
      }
      if (missType3C !== 'cold') {
        why.missType3C = shadowHit
          ? { rule: 'L23 p28 view: an equal-size fully associative LRU cache would hit here, so the mapping caused this miss (conflict).', cite: 'L23 p28' }
          : { rule: 'L23 p28 view: an equal-size fully associative LRU cache also misses here, so it counts as capacity.', cite: 'L23 p28' }
      }
      if (!allocates) {
        why.outcome = {
          rule: 'Write miss, write around (write no allocate): write memory only; the block is not loaded.',
          working: `M[${addr(wa)}] = ${data}`,
          cite: 'L22 p69; L23 p37',
        }
        return why
      }
      const slot = g.mapping === 'full' ? 'slot' : 'way'
      const orderText = orderBefore.join(', ')
      why.placement = !victim
        ? g.mapping === 'direct'
          ? { rule: `Direct mapped: the block can only go to index ${setIndex}, which is empty.`, cite: 'L22 p25, p35' }
          : {
              rule: g.mapping === 'full' ? 'Use the lowest free slot.' : 'Use the lowest free way in the set (Block 0 before Block 1).',
              working: `${slot} ${way} is invalid`,
              cite: g.mapping === 'full' ? 'L23 p33' : 'L23 p18, p21',
            }
        : g.mapping === 'direct'
          ? { rule: `Direct mapped: no choice, replace the block at index ${setIndex}.`, working: `evict block ${victim.block} (tag ${victim.tag})`, cite: 'L22 p46; L23 p37' }
          : c.replacement === 'lru'
            ? {
                rule: 'Set is full: evict the least recently used block. Hits count as uses.',
                working: `LRU to MRU before: ${orderText}; evict block ${victim.block}`,
                cite: 'L23 p29-30',
              }
            : c.replacement === 'fifo'
              ? {
                  rule: 'Set is full: evict the block that was loaded first. Hits do not change the order.',
                  working: `oldest to newest before: ${orderText}; evict block ${victim.block}`,
                  cite: 'L23 p31 (named only)',
                }
              : {
                  rule: 'Set is full: evict a block chosen at random.',
                  working: `seed ${c.seed} picked ${slot} ${way}, which holds block ${victim.block}`,
                  cite: 'L23 p31 (named only)',
                }
      why.outcome = isWrite
        ? {
            rule: `Write miss, write allocate: load the block, write the word, then ${wb ? 'write-back sets the dirty bit' : 'write-through also writes memory'}.`,
            working: `${span(blockBase)}; Word${w} = ${data}${wb ? ', dirty = 1' : ''}`,
            cite: wb ? 'L22 p68-69' : 'L22 p66, p69',
          }
        : { rule: `Read miss: load the block into the cache, then return Word${w} to the register.`, working: span(blockBase), cite: 'L22 p35, p69' }
      return why
    }

    // A read hit or a write-around miss changes no line, so its snapshots are reused; so is an unchanged order.
    const sameOrder = orderBefore.length === st.order.length && st.order.every((w, k) => st.lines[w].block === orderBefore[k])
    const orderAfter = sameOrder ? orderBefore : st.order.map((w) => st.lines[w].block)
    const linesSame = past !== undefined && (hit ? !isWrite : !allocates)
    const setAfter = !linesSame ? snapSet(st, setIndex) : sameOrder ? before : { index: setIndex, lines: before.lines, order: [...st.order] }
    const h = past ?? { at: [], snaps: [], blocks: [] }
    h.at.push(i)
    h.snaps.push(setAfter)
    h.blocks.push(orderAfter)
    history.set(setIndex, h)

    if (a.group !== undefined) {
      const gr = groups.get(a.group) ?? { name: a.group, accesses: 0, hits: 0, misses: 0 }
      gr.accesses++
      if (hit) gr.hits++
      else gr.misses++
      groups.set(a.group, gr)
    }

    let compares: WayCompare[] | undefined
    let why: Frame['why'] | undefined
    const lazy = (k: LazyKey): unknown =>
      k === 'split'
        ? split()
        : k === 'compares'
          ? (compares ??= compareSet(before, block))
          : k === 'cache'
            ? stateAt(i)
            : k === 'memory'
              ? memoryAt(i)
              : (why ??= explain())
    frames.push(
      Object.assign(new FrameBase(), {
        index: i,
        access: a,
        set: setIndex,
        hit,
        result: hit ? ('H' as const) : ('M' as const),
        way,
        missType,
        missType3C,
        shadowHit,
        locality,
        allocated: !hit && allocates,
        victim,
        orderBefore,
        orderAfter,
        traffic,
        setAfter,
        running: { hits, misses },
        [LAZY]: lazy,
      }),
    )
  })
  touched = [...history.keys()].sort((x, y) => x - y)

  const total = accesses.length
  const cold = missTypes.cold
  const per3C = (k: MissType) => frames.filter((f) => f.missType3C === k).length
  const capacity = per3C('capacity')
  const conflict = per3C('conflict')
  // L23 p28 writes capacity = FA misses - FA cold. That overcounts when the FA cache misses where this one hits.
  const faOnly = faMisses - cold - capacity
  const wordsMoved = (tally.blockReads + tally.writeBacks) * g.wordsPerBlock + tally.wordWrites
  const reduced = fraction(hits, total)
  const summary: Summary = {
    accesses: total,
    reads: accesses.filter((a) => a.kind === 'read').length,
    writes: accesses.filter((a) => a.kind === 'write').length,
    hits,
    misses,
    hitRate: {
      value: total ? hits / total : 0,
      text: `${hits}/${total}`,
      reduced,
      why: {
        rule: 'Hit rate = hits / accesses.',
        working: `${hits} / ${total}${reduced !== `${hits}/${total}` ? ` = ${reduced}` : ''}${total ? ` = ${+(hits / total).toFixed(4)}` : ''}`,
        cite: 'L22 p20',
      },
    },
    missTypes,
    threeC: {
      cold,
      conflict,
      capacity,
      faMisses,
      faCold: cold,
      why:
        g.mapping === 'full'
          ? {
              rule: 'A fully associative cache has no conflict misses: every repeat miss is a capacity miss.',
              working: `${misses} misses - ${cold} cold = ${capacity} capacity`,
              cite: 'L23 p27-28',
            }
          : {
              rule: 'Run the same trace on an equal-size fully associative LRU cache. A repeat miss it also has is capacity; one it avoids is conflict.',
              working:
                `cold ${cold}, capacity ${capacity}, conflict ${conflict} (total ${misses})` +
                (faOnly > 0
                  ? `. The L23 p28 formula gives capacity ${faMisses} - ${cold} = ${faMisses - cold}, but ${faOnly} of the ${faMisses} FA misses are hits here, so they are left out`
                  : `. This matches the L23 p28 formula: capacity = FA misses - cold = ${faMisses} - ${cold}`),
              cite: 'L23 p28 (per-access labels follow R12 p23-25)',
            },
    },
    traffic: {
      ...tally,
      wordsMoved,
      why: {
        rule: 'Words moved = (block reads + write-backs) × words per block + single-word writes.',
        working: `(${tally.blockReads} + ${tally.writeBacks}) × ${g.wordsPerBlock} + ${tally.wordWrites} = ${wordsMoved}`,
        cite: 'L22 p66-69 (counts are the app\'s)',
      },
    },
    groups: [...groups.values()].map((gr) => ({ ...gr, reduced: fraction(gr.hits, gr.accesses) })),
    resultString: frames.map((f) => f.result).join(' '),
    dirtyAtEnd: [...sets.values()].reduce((s, st) => s + st.lines.filter((l) => l.valid && l.dirty).length, 0),
  }
  if (summary.dirtyAtEnd) notes.push(`${plural(summary.dirtyAtEnd, 'dirty block')} still in the cache at the end; they are not written back here.`)

  return { ok: true, value: { geometry: g, frames, initial, allSets: dense, summary, notes } }
}

/** Lines of a set with valid blocks in address order (way 0 lowest), for papers that want that layout (AY23/24 S1 Q20(b)). */
export function linesByAddress(set: SetSnapshot): LineSnapshot[] {
  return [...set.lines].sort((x, y) => (x.block ?? Number.MAX_SAFE_INTEGER) - (y.block ?? Number.MAX_SAFE_INTEGER))
}
