import { addr, bin, fmtBytes, isPow2, log2 } from './format'
import type { AddressSplit, BitRange, CacheConfig, Explain, Field, Geometry, ResolvedConfig, Result } from './types'

export const DEFAULTS: Omit<ResolvedConfig, 'cacheBytes' | 'blockBytes'> = {
  addressBits: 32,
  wordBytes: 4,
  ways: 1,
  replacement: 'lru',
  seed: 1,
  writeHit: 'write-back',
  writeBuffer: false,
  writeMiss: 'allocate',
}

export function resolveConfig(c: CacheConfig): ResolvedConfig {
  const given = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined))
  return { ...DEFAULTS, ...given } as ResolvedConfig
}

const range = (hi: number, lo: number): BitRange | null => (hi < lo ? null : { hi, lo, text: `${hi}..${lo}` })

/** Field widths and counts for a cache (L22 p23-27, L23 p11, p26). Errors are plain sentences. */
export function geometry(input: CacheConfig): Result<Geometry> {
  const c = resolveConfig(input)
  const errors: string[] = []
  if (!Number.isInteger(c.addressBits) || c.addressBits < 1 || c.addressBits > 48) {
    errors.push(`Address width must be a whole number of bits from 1 to 48 (got ${c.addressBits}).`)
  }
  const sizes: [string, number][] = [
    ['Cache size', c.cacheBytes],
    ['Block size', c.blockBytes],
    ['Word size', c.wordBytes],
  ]
  for (const [name, v] of sizes) if (!isPow2(v)) errors.push(`${name} must be a power of two in bytes (got ${v}).`)
  // URL state is plain JSON, so policy names arrive unchecked.
  const policies: [string, unknown, readonly unknown[]][] = [
    ['Replacement', c.replacement, ['lru', 'fifo', 'random']],
    ['Write hit policy', c.writeHit, ['write-through', 'write-back']],
    ['Write miss policy', c.writeMiss, ['allocate', 'around']],
    ['Write buffer', c.writeBuffer, [true, false]],
  ]
  for (const [name, v, allowed] of policies) {
    if (!allowed.includes(v)) errors.push(`${name} must be ${allowed.map(String).join(' or ')} (got ${String(v)}).`)
  }
  if (!Number.isSafeInteger(c.seed)) errors.push(`The random seed must be a whole number (got ${String(c.seed)}).`)
  if (errors.length) return { ok: false, errors }
  if (c.blockBytes < c.wordBytes) errors.push(`A block (${c.blockBytes} B) must hold at least one word (${c.wordBytes} B).`)
  if (c.cacheBytes < c.blockBytes) errors.push(`The cache (${c.cacheBytes} B) must hold at least one block (${c.blockBytes} B).`)
  if (errors.length) return { ok: false, errors }

  const blocks = c.cacheBytes / c.blockBytes
  const ways = c.ways === 'full' ? blocks : c.ways
  if (!Number.isInteger(ways) || ways < 1 || ways > blocks || blocks % ways !== 0 || !isPow2(blocks / ways)) {
    return {
      ok: false,
      errors: [`Associativity ${c.ways} must split the ${blocks} cache blocks into a power-of-two number of sets.`],
    }
  }
  const sets = blocks / ways
  // A one-block cache chosen as fully associative stays FA, so its repeat misses are capacity (R12 p24-25).
  const mapping = c.ways === 'full' || (sets === 1 && ways > 1) ? 'full' : ways === 1 ? 'direct' : 'set'
  const offsetBits = log2(c.blockBytes)
  const blockNumberBits = c.addressBits - offsetBits
  const indexBits = log2(sets)
  const tagBits = c.addressBits - offsetBits - indexBits
  if (tagBits < 0) {
    return {
      ok: false,
      errors: [`A ${c.addressBits}-bit address is too short for ${offsetBits} offset bits and ${indexBits} index bits.`],
    }
  }
  const wordsPerBlock = c.blockBytes / c.wordBytes

  const why: Geometry['why'] = {
    offset: {
      rule: 'A block of 2^N bytes needs N offset bits.',
      working: `${fmtBytes(c.blockBytes)} = 2^${offsetBits}, so N = ${offsetBits}`,
      cite: 'L22 p23, p27',
    },
    blockNumber: {
      rule: 'Block number = the address without its offset bits, so it has address bits - N bits.',
      working: `${c.addressBits} - ${offsetBits} = ${blockNumberBits}`,
      cite: 'L22 p29, p54',
    },
    blocks: {
      rule: 'Number of cache blocks = cache size / block size.',
      working: `${fmtBytes(c.cacheBytes)} / ${fmtBytes(c.blockBytes)} = ${blocks}`,
      cite: 'L22 p29',
    },
    sets:
      mapping === 'direct'
        ? { rule: 'Direct mapped: each set is one block, so sets = blocks.', working: `${blocks} sets`, cite: 'L22 p25' }
        : mapping === 'full'
          ? { rule: 'Fully associative: one set holds every block.', working: `1 set of ${blocks} blocks`, cite: 'L23 p26' }
          : { rule: 'Number of sets = blocks / ways.', working: `${blocks} / ${ways} = ${sets}`, cite: 'L23 p11-12' },
    index:
      mapping === 'full'
        ? { rule: 'Fully associative: there is no index field.', working: 'M = 0', cite: 'L23 p26' }
        : {
            rule: mapping === 'direct' ? 'Index M = log2(number of blocks).' : 'Set index M = log2(number of sets), not blocks.',
            working: `${sets} = 2^${indexBits}, so M = ${indexBits}`,
            cite: mapping === 'direct' ? 'L22 p27' : 'L23 p11-12',
          },
    tag: {
      rule: 'Tag = address bits - offset bits - index bits.',
      working: `${c.addressBits} - ${offsetBits} - ${indexBits} = ${tagBits}`,
      cite: mapping === 'full' ? 'L23 p26' : mapping === 'direct' ? 'L22 p27' : 'L23 p11',
    },
    wordsPerBlock: {
      rule: 'Words per block = block size / word size.',
      working: `${c.blockBytes} / ${c.wordBytes} = ${wordsPerBlock}`,
      cite: c.wordBytes === 4 ? 'L22 p30' : 'T11 Q1',
    },
  }

  return {
    ok: true,
    value: {
      config: c,
      mapping,
      blocks,
      sets,
      ways,
      wordsPerBlock,
      offsetBits,
      blockNumberBits,
      indexBits,
      tagBits,
      ranges: {
        tag: range(c.addressBits - 1, offsetBits + indexBits),
        index: range(offsetBits + indexBits - 1, offsetBits),
        offset: range(offsetBits - 1, 0),
      },
      why,
    },
  }
}

/** Split an address into tag, index and offset, working from the block number (L22 p25-26, L23 p11). */
export function splitAddress(g: Geometry, address: number): AddressSplit {
  const { blockBytes, wordBytes, addressBits } = g.config
  const block = Math.floor(address / blockBytes)
  const offset = address - block * blockBytes
  const set = block % g.sets
  const tag = Math.floor(block / g.sets)
  const word = Math.floor(offset / wordBytes)
  const field = (width: number, value: number, r: BitRange | null): Field => ({ width, value, bits: bin(value, width), range: r })
  // Built on first read: a long trace splits every address, and the UI reads only the shown step's working.
  const explain = (): AddressSplit['why'] => ({
    block: {
      rule: 'Block number = address >> N (drop the offset bits).',
      working: `${addr(address)} >> ${g.offsetBits} = ${address} / ${blockBytes} = ${block}`,
      cite: 'L22 p23, p25',
    },
    set:
      g.mapping === 'full'
        ? { rule: 'Fully associative: no index, the block may go in any slot.', working: 'set 0 (the only set)', cite: 'L23 p26' }
        : {
            rule:
              g.mapping === 'direct'
                ? 'Index = block number mod number of cache blocks (not the byte address).'
                : 'Set index = block number mod number of sets.',
            working: `${block} mod ${g.sets} = ${set}`,
            cite: g.mapping === 'direct' ? 'L22 p25-26' : 'L23 p11',
          },
    tag:
      g.mapping === 'full'
        ? { rule: 'Fully associative: the tag is the whole block number.', working: `tag = ${block}`, cite: 'L23 p26' }
        : {
            rule: g.mapping === 'direct' ? 'Tag = block number / number of cache blocks.' : 'Tag = block number / number of sets.',
            working: `${block} / ${g.sets} = ${tag} (whole part)`,
            cite: g.mapping === 'direct' ? 'L22 p26' : 'L23 p11, p21',
          },
    offset: {
      rule: 'Offset = address mod block size (the low N bits).',
      working: `${address} mod ${blockBytes} = ${offset}`,
      cite: 'L22 p23',
    },
    word: {
      rule: 'Word in block = offset / word size.',
      working: `${offset} / ${wordBytes} = ${word} (whole part), so Word${word}`,
      cite: 'L22 p30',
    },
  })
  let why: AddressSplit['why'] | undefined
  return {
    address,
    bits: bin(address, addressBits),
    block,
    blockBase: block * blockBytes,
    tag: field(g.tagBits, tag, g.ranges.tag),
    index: field(g.indexBits, set, g.ranges.index),
    offset: field(g.offsetBits, offset, g.ranges.offset),
    set,
    wordInBlock: word,
    get why() {
      return (why ??= explain())
    },
  }
}

/** Address width from memory size: 4 GB gives 32 bits, 16 GB gives 34 (R12 p40-42). */
export function addressBitsForMemory(memoryBytes: number): Result<{ bits: number; why: Explain }> {
  if (!isPow2(memoryBytes)) return { ok: false, errors: [`Memory size must be a power of two in bytes (got ${memoryBytes}).`] }
  const bits = log2(memoryBytes)
  return {
    ok: true,
    value: {
      bits,
      why: { rule: 'A byte-addressed memory of 2^k bytes needs k address bits.', working: `${fmtBytes(memoryBytes)} = 2^${bits}`, cite: 'R12 p40-42' },
    },
  }
}

/** Inverse question: given the tag width, find sets and cache size (R12 p41). */
export function solveFromTag(p: {
  addressBits: number
  blockBytes: number
  ways: number
  tagBits: number
}): Result<{ offsetBits: number; indexBits: number; sets: number; cacheBytes: number; why: Record<'offset' | 'index' | 'sets' | 'cache', Explain> }> {
  if (!isPow2(p.blockBytes)) return { ok: false, errors: [`Block size must be a power of two in bytes (got ${p.blockBytes}).`] }
  if (!Number.isInteger(p.ways) || p.ways < 1) return { ok: false, errors: [`Ways must be a whole number of at least 1 (got ${p.ways}).`] }
  if (!Number.isInteger(p.addressBits) || p.addressBits < 1 || p.addressBits > 64) {
    return { ok: false, errors: [`Address width must be a whole number of bits from 1 to 64 (got ${p.addressBits}).`] }
  }
  if (!Number.isInteger(p.tagBits) || p.tagBits < 0) return { ok: false, errors: [`Tag width must be a whole number of bits, 0 or more (got ${p.tagBits}).`] }
  const offsetBits = log2(p.blockBytes)
  const indexBits = p.addressBits - p.tagBits - offsetBits
  if (indexBits < 0) {
    return { ok: false, errors: [`Tag ${p.tagBits} bits and offset ${offsetBits} bits do not fit in ${p.addressBits} address bits.`] }
  }
  const sets = 2 ** indexBits
  const cacheBytes = sets * p.ways * p.blockBytes
  return {
    ok: true,
    value: {
      offsetBits,
      indexBits,
      sets,
      cacheBytes,
      why: {
        offset: { rule: 'A block of 2^N bytes needs N offset bits.', working: `${fmtBytes(p.blockBytes)} = 2^${offsetBits}`, cite: 'R12 p41' },
        index: {
          rule: 'Set index bits = address bits - tag bits - offset bits.',
          working: `${p.addressBits} - ${p.tagBits} - ${offsetBits} = ${indexBits}`,
          cite: 'R12 p41',
        },
        sets: { rule: 'Number of sets = 2^(set index bits).', working: `2^${indexBits} = ${sets}`, cite: 'R12 p41' },
        cache: {
          rule: 'Cache size = sets × ways × block size.',
          working: `${sets} × ${p.ways} × ${fmtBytes(p.blockBytes)} = ${fmtBytes(cacheBytes)}`,
          cite: 'R12 p41',
        },
      },
    },
  }
}
