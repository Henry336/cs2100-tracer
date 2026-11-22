// Marking for "Check my answers": the student's per-access results and final cache table against the trace.
// Pure functions, so the marking is tested without React.
import { linesByAddress, parseNumber, simulate, type Frame, type Geometry, type LineSnapshot, type MissType, type Trace } from '../../core/cache'
import type { TagFmt } from './common'

export type LabelView = 'r12' | 'l23'

export const typeOf = (f: Frame, view: LabelView): MissType | null => (view === 'r12' ? f.missType : f.missType3C)

export interface Given {
  r: 'H' | 'M'
  type: MissType | null
}

/** Answer tokens: H or M, an M optionally followed by its type ("M(cold)", "M conflict"). */
export function parseAnswer(text: string): Given[] {
  const out: Given[] = []
  const re = /([hm])(?:[\s(:-]*(cold|compulsory|conflict|capacity)\)?)?/gi
  for (const m of text.matchAll(re)) {
    const t = m[2]?.toLowerCase()
    out.push({ r: m[1].toUpperCase() as 'H' | 'M', type: !t ? null : t === 'compulsory' ? 'cold' : (t as MissType) })
  }
  return out
}

/** Longest trace the per-access check takes, and the largest cache (lines, words per line) the table check takes. */
export const CHECK_ACCESSES = 100
export const CHECK_LINES = 32
export const CHECK_WORDS = 4

export const tableCheckable = (g: Geometry) => g.blocks <= CHECK_LINES && g.wordsPerBlock <= CHECK_WORDS

/** Key of one typed cell: set, position in the set (way), field (v, t, w0, w1, ...). */
export const cellKey = (set: number, pos: number, field: string) => `${set}.${pos}.${field}`

export type Slip = 'byte-word' | 'tag-block' | 'tag-index' | 'tag-byte' | 'whole-block' | 'lru-hit' | 'cold-first' | 'label' | 'way-order'

export const SLIPS: Record<Slip, { title: string; text: string; cite: string }> = {
  'byte-word': {
    title: 'M[i] takes the byte address',
    text: 'Write each word by its byte address, not its word number. Word k of a block is at the block start + k x word size.',
    cite: 'T11 Q1(b)',
  },
  'tag-block': {
    title: 'That tag is the whole block number',
    text: 'Tag = block number / number of sets. The rest of the block number is the index.',
    cite: 'L22 p25-26',
  },
  'tag-index': {
    title: 'That is the index, not the tag',
    text: 'Index = block number mod sets, tag = block number / sets.',
    cite: 'L22 p25-26',
  },
  'tag-byte': {
    title: 'Cut the tag from the block number',
    text: 'That tag came from the byte address. Shift out the offset bits first: block number = address >> offset bits.',
    cite: 'L22 p25-26',
  },
  'whole-block': {
    title: 'A miss loads the whole block',
    text: 'Every word of the line is filled on a miss, not only the word asked for.',
    cite: 'L22 p39',
  },
  'lru-hit': {
    title: 'Hits update LRU too',
    text: 'Your answer matches a cache that orders blocks only when they are loaded. Under LRU a hit also makes the block the most recently used.',
    cite: 'L23 p29-30',
  },
  'cold-first': {
    title: 'A first access is always cold',
    text: 'The block was never in the cache before, so it is a cold miss even when the line holds another valid block.',
    cite: 'L22 p45',
  },
  label: {
    title: 'Check which miss labels you used',
    text: 'Your type fits the other framework. R12 calls a repeat miss conflict in DM and set associative caches, capacity in FA. L23 p28 compares with an equal-size fully associative LRU cache. Switch Miss labels to match.',
    cite: 'R12 p23-25; L23 p28',
  },
  'way-order': {
    title: 'Right blocks, other ways',
    text: 'The lectures fill the first free way. AY23/24 S1 Q20(b) puts the lower address in Way 0. Switch "Way 0 holds the lower address" in the options to match your order.',
    cite: 'L23 p18; AY23/24 S1 Q20(b)',
  },
}

export interface AccessMark {
  index: number
  given: Given | null
  resultOk: boolean
  /** null when no type was given (or none was needed). */
  typeOk: boolean | null
  ok: boolean
}

export interface Marking {
  accesses: AccessMark[]
  accessRight: number
  /** Tokens typed beyond the trace length. */
  extra: number
  firstWrong: number | null
  /** Right or wrong for every marked table cell, by cellKey. Empty when the table is not checked. */
  cells: Record<string, boolean>
  cellRight: number
  cellTotal: number
  slips: Slip[]
}

export interface Entries {
  acc: string
  cells: Record<string, string>
}

export const EMPTY_ENTRIES: Entries = { acc: '', cells: {} }

/** URL state can hold any JSON. */
export function normEntries(raw: unknown): Entries {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_ENTRIES
  const r = raw as Partial<Entries>
  const cells: Record<string, string> = {}
  if (r.cells && typeof r.cells === 'object') for (const [k, v] of Object.entries(r.cells)) if (typeof v === 'string') cells[k] = v
  return { acc: typeof r.acc === 'string' ? r.acc : '', cells }
}

/** A typed tag: 0x hex and 0b binary by prefix, bare digits in the board's tag format. */
export function parseTag(text: string, tf: TagFmt): number | null {
  const t = text.trim().toLowerCase().replace(/_/g, '')
  if (!t) return null
  if (/^0[xb]/.test(t)) return parseNumber(t)
  const n = tf === 'hex' && /^[0-9a-f]+$/.test(t) ? parseInt(t, 16) : tf === 'bin' && /^[01]+$/.test(t) ? parseInt(t, 2) : parseNumber(t)
  return n !== null && Number.isSafeInteger(n) ? n : null
}

export type WordEntry = { address: number } | { label: string } | null

/** A typed word: M[24], M[0x1020], a plain address (24), or a stored value label (X, W3). Blank or "-" is empty. */
export function parseWord(text: string): WordEntry {
  const t = text.trim()
  if (!t || t === '-') return null
  const m = /^m\s*\[\s*([^\]]+?)\s*\]$/i.exec(t)
  const a = parseNumber(m ? m[1] : t)
  return a === null ? { label: t } : { address: a }
}

/** The same trace under FIFO, to spot an LRU order that ignored hits. null when the slip cannot happen. */
function fifoOf(trace: Trace): Trace | null {
  const c = trace.geometry.config
  if (trace.geometry.ways < 2 || c.replacement !== 'lru') return null
  const r = simulate({ ...c, replacement: 'fifo' }, trace.frames.map((f) => f.access))
  return r.ok ? r.value : null
}

/** Every set after the last access, each with its lines in display order. */
function finalLines(trace: Trace, byAddr: boolean): (LineSnapshot | undefined)[][] {
  const last = trace.frames[trace.frames.length - 1]
  const snaps = new Map((last ? last.cache : trace.initial).map((s) => [s.index, s]))
  return Array.from({ length: trace.geometry.sets }, (_, i) => {
    const s = snaps.get(i)
    const lines = s ? (byAddr ? linesByAddress(s) : s.lines) : []
    return Array.from({ length: trace.geometry.ways }, (_, p) => lines[p])
  })
}

function tagSlip(t: number, line: LineSnapshot, set: number, g: Geometry): Slip | null {
  const block = line.block ?? 0
  if (g.sets > 1 && t === block) return 'tag-block'
  if (g.sets > 1 && t === set) return 'tag-index'
  const base = block * g.config.blockBytes
  if (g.offsetBits > 0 && t >= Math.floor(base / g.sets) && t <= Math.floor((base + g.config.blockBytes - 1) / g.sets)) return 'tag-byte'
  return null
}

/** The simulator's name for a store with no value given ("W" + access number). The keys write such a word by its address, M[0xa048] (AY23/24 S1 Q20). */
const UNNAMED = /^W\d+$/

const byteWordSlip = (a: number, want: number, base: number, i: number, wb: number) =>
  a !== want && ((want % wb === 0 && a === want / wb) || a === base + i || (wb !== 4 && a === base + 4 * i))

function markAccesses(trace: Trace, answer: string, lv: LabelView, fifo: Trace | null, slips: Set<Slip>) {
  const given = parseAnswer(answer)
  const accesses: AccessMark[] = trace.frames.map((f) => {
    const t = given[f.index] ?? null
    const resultOk = !!t && t.r === f.result
    // A type on a hit is wrong; a missing type on a miss is not marked.
    const typeOk = !t || t.type === null ? null : t.type === typeOf(f, lv)
    if (t && resultOk && typeOk === false && t.type) {
      const want = typeOf(f, lv)
      if (want === 'cold') slips.add('cold-first')
      else if (t.type === typeOf(f, lv === 'r12' ? 'l23' : 'r12')) slips.add('label')
    }
    return { index: f.index, given: t, resultOk, typeOk, ok: resultOk && typeOk !== false }
  })
  const firstWrong = accesses.find((m) => !m.ok)?.index ?? null
  if (fifo && firstWrong !== null) {
    const t = accesses[firstWrong].given
    if (t && !accesses[firstWrong].resultOk && fifo.frames[firstWrong].result === t.r) slips.add('lru-hit')
  }
  return { accesses, accessRight: accesses.filter((m) => m.ok).length, extra: Math.max(0, given.length - trace.frames.length), firstWrong }
}

function markTable(trace: Trace, typed: Record<string, string>, tf: TagFmt, byAddr: boolean, fifo: Trace | null, slips: Set<Slip>) {
  const g = trace.geometry
  const wb = g.config.wordBytes
  const cells: Record<string, boolean> = {}
  let right = 0
  let total = 0
  const fifoSets = fifo ? finalLines(fifo, byAddr) : null
  const cell = (k: string) => typed[k] ?? ''
  finalLines(trace, byAddr).forEach((lines, s) => {
    let setOk = true
    // Slips seen in this set; dropped when the set is only in the other way order, since every cell then looks wrong.
    const local = new Set<Slip>()
    const mark = (k: string, good: boolean) => {
      cells[k] = good
      total++
      if (good) right++
      else setOk = false
    }
    const givenTags = lines.map((_, p) => (cell(cellKey(s, p, 'v')).trim() === '1' ? parseTag(cell(cellKey(s, p, 't')), tf) : null))
    lines.forEach((line, p) => {
      // A blank valid bit reads as 0, so an untouched empty line is right.
      mark(cellKey(s, p, 'v'), (cell(cellKey(s, p, 'v')).trim() === '1') === !!line?.valid)
      if (!line?.valid) return
      const t = parseTag(cell(cellKey(s, p, 't')), tf)
      mark(cellKey(s, p, 't'), t === line.tag)
      const slip = t !== null && t !== line.tag ? tagSlip(t, line, s, g) : null
      if (slip) local.add(slip)
      const base = (line.block ?? 0) * g.config.blockBytes
      const words = line.words.map((_, i) => parseWord(cell(cellKey(s, p, `w${i}`))))
      if (words.some((w) => w === null) && words.some((w) => w !== null)) local.add('whole-block')
      line.words.forEach((w, i) => {
        const e = words[i]
        const good =
          !!e &&
          (w.data === null
            ? 'address' in e && e.address === w.address
            : 'label' in e
              ? e.label.toLowerCase() === w.data.toLowerCase()
              : String(e.address) === w.data || (UNNAMED.test(w.data) && e.address === w.address))
        mark(cellKey(s, p, `w${i}`), good)
        if (!good && e && 'address' in e && w.data === null && byteWordSlip(e.address, w.address, base, i, wb)) local.add('byte-word')
      })
    })
    if (setOk) return
    const want = lines.map((l) => (l?.valid ? l.tag : null))
    const sorted = (xs: (number | null)[]) => JSON.stringify([...xs].sort())
    if (g.ways > 1 && JSON.stringify(givenTags) !== JSON.stringify(want) && sorted(givenTags) === sorted(want)) slips.add('way-order')
    else for (const x of local) slips.add(x)
    const alt = fifoSets?.[s].map((l) => (l?.valid ? l.tag : null))
    if (alt && JSON.stringify(alt) !== JSON.stringify(want) && JSON.stringify(alt) === JSON.stringify(givenTags)) slips.add('lru-hit')
  })
  return { cells, cellRight: right, cellTotal: total }
}

/** Mark everything the student typed. The table is marked only when the cache is small enough to type in. */
export function markAll(trace: Trace, entries: Entries, opts: { lv: LabelView; tf: TagFmt; byAddr: boolean }): Marking {
  const slips = new Set<Slip>()
  const fifo = fifoOf(trace)
  const acc = markAccesses(trace, entries.acc, opts.lv, fifo, slips)
  const table = tableCheckable(trace.geometry) ? markTable(trace, entries.cells, opts.tf, opts.byAddr, fifo, slips) : { cells: {}, cellRight: 0, cellTotal: 0 }
  return { ...acc, ...table, slips: [...slips] }
}
