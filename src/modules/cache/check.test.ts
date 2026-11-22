import { describe, expect, it } from 'vitest'
import { parseAccesses, simulate, type Trace } from '../../core/cache'
import { cellKey, markAll, normEntries, parseTag, parseWord, type Entries } from './check'
import { DEFAULT_CFG, TRACE_PRESETS, toConfig, type Cfg } from './presets'

const run = (id: string, cfg: Partial<Cfg> = {}): Trace => {
  const p = TRACE_PRESETS.find((x) => x.id === id)!
  const acc = p.gen ? p.gen() : { ok: true as const, value: parseAccesses(p.text ?? '').accesses }
  if (!acc.ok) throw new Error(acc.errors.join('; '))
  const r = simulate(toConfig({ ...DEFAULT_CFG, ...p.cfg, ...cfg }), acc.value)
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}

/** The right final table, typed the way a student would (M[i] words, decimal tags). */
function rightCells(t: Trace): Record<string, string> {
  const cells: Record<string, string> = {}
  for (const s of t.frames[t.frames.length - 1].cache) {
    s.lines.forEach((l, p) => {
      if (!l.valid) return
      cells[cellKey(s.index, p, 'v')] = '1'
      cells[cellKey(s.index, p, 't')] = String(l.tag)
      l.words.forEach((w, i) => (cells[cellKey(s.index, p, `w${i}`)] = w.data ?? `M[${w.address}]`))
    })
  }
  return cells
}

const opts = { lv: 'r12' as const, tf: 'dec' as const, byAddr: false }
// L22 p55-62: M H M H M M H, cold - cold - cold conflict -.
const L22_ANSWER = 'M(cold) H M(cold) H M(cold) M(conflict) H'

describe('check my answers', () => {
  it('marks an all-correct answer right (L22 p55-62)', () => {
    const t = run('l22-ex')
    const m = markAll(t, { acc: L22_ANSWER, cells: rightCells(t) }, opts)
    expect(m.accessRight).toBe(7)
    expect(m.firstWrong).toBeNull()
    // 4 lines: valid bit each, plus tag and 2 words for the 2 valid lines.
    expect(m.cellTotal).toBe(4 + 2 * 3)
    expect(m.cellRight).toBe(m.cellTotal)
    expect(m.slips).toEqual([])
  })

  it('marks a wrong tag and names the slip', () => {
    const t = run('l22-ex')
    const cells = rightCells(t)
    // Index 1 holds block 1, tag 0. Typing the block number is the tag vs index slip.
    const m = markAll(t, { acc: L22_ANSWER, cells: { ...cells, [cellKey(1, 0, 't')]: '1' } }, opts)
    expect(m.cells[cellKey(1, 0, 't')]).toBe(false)
    expect(m.cellRight).toBe(m.cellTotal - 1)
    expect(m.slips).toContain('tag-block')
    // A tag that fits no known slip is just wrong.
    const plain = markAll(t, { acc: '', cells: { ...cells, [cellKey(1, 0, 't')]: '7' } }, opts)
    expect(plain.cells[cellKey(1, 0, 't')]).toBe(false)
    expect(plain.slips).toEqual([])
  })

  it('marks a wrong miss type and points to the first wrong access', () => {
    const t = run('l22-ex')
    const m = markAll(t, { acc: 'M(cold) H M(cold) H M(cold) M(cold) H', cells: {} }, opts)
    expect(m.firstWrong).toBe(5)
    expect(m.accesses[5]).toMatchObject({ resultOk: true, typeOk: false, ok: false })
    expect(m.accessRight).toBe(6)
    // Calling a first access a conflict miss is the cold-miss slip (L22 p45).
    expect(markAll(t, { acc: 'M(conflict)', cells: {} }, opts).slips).toContain('cold-first')
    // A missing type is not marked; a missing result is wrong.
    const short = markAll(t, { acc: 'M H M', cells: {} }, opts)
    expect(short.accesses[0].typeOk).toBeNull()
    expect(short.firstWrong).toBe(3)
  })

  it('reads M[i] notation and plain numbers', () => {
    expect(parseWord('M[24]')).toEqual({ address: 24 })
    expect(parseWord(' m[ 0x1020 ] ')).toEqual({ address: 0x1020 })
    expect(parseWord('M[0b11000]')).toEqual({ address: 24 })
    expect(parseWord('24')).toEqual({ address: 24 })
    expect(parseWord('X')).toEqual({ label: 'X' })
    expect(parseWord('')).toBeNull()
    expect(parseWord('-')).toBeNull()
    expect(parseTag('0x00000081', 'dec')).toBe(0x81)
    expect(parseTag('81', 'hex')).toBe(0x81)
    expect(parseTag('101', 'bin')).toBe(5)
    expect(parseTag('101', 'dec')).toBe(101)

    // Plain numbers in the table are byte addresses too.
    const t = run('l22-ex')
    const cells = { ...rightCells(t), [cellKey(0, 0, 'w0')]: '0', [cellKey(0, 0, 'w1')]: '4' }
    const m = markAll(t, { acc: '', cells }, opts)
    expect(m.cellRight).toBe(m.cellTotal)
  })

  it('spots word numbers, half-filled lines, ignored LRU hits and swapped ways', () => {
    const t = run('l22-ex')
    const cells = rightCells(t)
    const words = markAll(t, { acc: '', cells: { ...cells, [cellKey(0, 0, 'w1')]: 'M[1]' } }, opts)
    expect(words.cells[cellKey(0, 0, 'w1')]).toBe(false)
    expect(words.slips).toContain('byte-word')
    expect(markAll(t, { acc: '', cells: { ...cells, [cellKey(0, 0, 'w1')]: '' } }, opts).slips).toContain('whole-block')

    // T11: 2-byte words, so the second word of block 1 is M[6], not M[8].
    const t11 = run('t11')
    const c11 = rightCells(t11)
    expect(c11[cellKey(1, 0, 'w1')]).toBe('M[6]')
    expect(markAll(t11, { acc: '', cells: { ...c11, [cellKey(1, 0, 'w1')]: 'M[8]' } }, opts).slips).toContain('byte-word')

    // L23 p30 under FIFO order: access 9 is a miss, but LRU kept block 4 because of the hit at access 5.
    const lru = run('l23-lru')
    const m = markAll(lru, { acc: 'M M M M H M H M M', cells: {} }, opts)
    expect(m.firstWrong).toBe(8)
    expect(m.slips).toContain('lru-hit')

    // L23 p17-22: set 0 holds tag 0 in way 0 and tag 2 in way 1. Swapping them is a way order slip.
    const two = run('l23-2way')
    const c2 = rightCells(two)
    const swapped: Entries = { acc: '', cells: { ...c2 } }
    for (const f of ['v', 't', 'w0', 'w1']) {
      swapped.cells[cellKey(0, 0, f)] = c2[cellKey(0, 1, f)]
      swapped.cells[cellKey(0, 1, f)] = c2[cellKey(0, 0, f)]
    }
    expect(markAll(two, swapped, opts).slips).toContain('way-order')
    expect(markAll(two, { acc: '', cells: c2 }, opts).cellRight).toBe(markAll(two, { acc: '', cells: c2 }, opts).cellTotal)
  })

  it('survives bad URL state', () => {
    expect(normEntries(null)).toEqual({ acc: '', cells: {} })
    expect(normEntries({ acc: 3, cells: { a: 'x', b: 4 } })).toEqual({ acc: '', cells: { a: 'x' } })
  })

  /* ---------- Course examples, typed by hand the way the key or slide writes them ---------- */

  /** A table typed as rows of [set, way, tag, word0, word1, ...], valid bit 1 for each row given. */
  const typed = (rows: [number, number, string, ...string[]][]): Record<string, string> => {
    const cells: Record<string, string> = {}
    for (const [set, way, tag, ...words] of rows) {
      cells[cellKey(set, way, 'v')] = '1'
      cells[cellKey(set, way, 't')] = tag
      words.forEach((w, i) => (cells[cellKey(set, way, `w${i}`)] = w))
    }
    return cells
  }
  const allRight = (m: ReturnType<typeof markAll>, n: number) => {
    expect(m.accessRight).toBe(n)
    if (n) expect(m.firstWrong).toBeNull()
    expect(m.cellTotal).toBeGreaterThan(0)
    expect(m.cellRight).toBe(m.cellTotal)
    expect(m.slips).toEqual([])
  }

  it('L22 Exercise 2 (p55-62), typed from the slide: right, then the usual slips', () => {
    const t = run('l22-ex')
    const slide = typed([
      [0, 0, '0', 'M[0]', 'M[4]'],
      [1, 0, '0', 'M[8]', 'M[12]'],
    ])
    allRight(markAll(t, { acc: L22_ANSWER, cells: slide }, opts), 7)
    // "compulsory" is read as cold.
    expect(markAll(t, { acc: 'M(compulsory) H M(compulsory) H M(cold) M(conflict) H', cells: {} }, opts).accessRight).toBe(7)
    // Forgetting that 36 evicted block 0 gives H at access 6.
    expect(markAll(t, { acc: 'M H M H M H H', cells: {} }, opts).firstWrong).toBe(5)
    // Word numbers instead of byte addresses in index 1.
    const words = markAll(t, { acc: '', cells: { ...slide, [cellKey(1, 0, 'w0')]: 'M[2]', [cellKey(1, 0, 'w1')]: 'M[3]' } }, opts)
    expect(words.cellRight).toBe(words.cellTotal - 2)
    expect(words.slips).toEqual(['byte-word'])
    // Leaving block 4 (tag 1, M[32] M[36]) in index 0 after 0 came back.
    const stale = markAll(t, { acc: '', cells: { ...slide, ...typed([[0, 0, '1', 'M[32]', 'M[36]']]) } }, opts)
    expect(stale.cellRight).toBe(stale.cellTotal - 3)
  })

  it('L23 p32-34: the same trace on direct mapped, fully associative and 2-way, typed from the slides', () => {
    // p32 direct mapped: all 7 miss. The 6th access (0) is conflict under R12 but capacity under L23 p28, since FA LRU also misses it.
    const dm = run('l23-org')
    const dmTable = typed([
      [0, 0, '1', 'M[32]', 'M[36]'],
      [1, 0, '0', 'M[8]', 'M[12]'],
      [2, 0, '1', 'M[48]', 'M[52]'],
    ])
    const r12 = 'M(cold) M(cold) M(cold) M(cold) M(cold) M(conflict) M(conflict)'
    const l23 = 'M(cold) M(cold) M(cold) M(cold) M(cold) M(capacity) M(conflict)'
    allRight(markAll(dm, { acc: r12, cells: dmTable }, opts), 7)
    allRight(markAll(dm, { acc: l23, cells: dmTable }, { ...opts, lv: 'l23' }), 7)
    // R12 labels while marking by L23 p28: wrong at access 6, with the label hint.
    const mixed = markAll(dm, { acc: r12, cells: {} }, { ...opts, lv: 'l23' })
    expect(mixed.firstWrong).toBe(5)
    expect(mixed.slips).toEqual(['label'])
    // Typing the block number (4 for M[32]) as the tag.
    expect(markAll(dm, { acc: '', cells: { ...dmTable, [cellKey(0, 0, 't')]: '4' } }, opts).slips).toEqual(['tag-block'])

    // p33 fully associative LRU: 68 evicts block 0, then 0 evicts block 1; 32 hits.
    const fa = run('l23-org', { ways: 'full' })
    const faTable = typed([
      [0, 0, '8', 'M[64]', 'M[68]'],
      [0, 1, '0', 'M[0]', 'M[4]'],
      [0, 2, '4', 'M[32]', 'M[36]'],
      [0, 3, '6', 'M[48]', 'M[52]'],
    ])
    allRight(markAll(fa, { acc: 'M(cold) M(cold) M(cold) M(cold) M(cold) M(capacity) H', cells: faTable }, opts), 7)
    // Calling the FA repeat miss conflict: FA has no conflict misses (AY23/24 S1 Q13).
    expect(markAll(fa, { acc: 'M M M M M M(conflict) H', cells: {} }, opts).accesses[5]).toMatchObject({ resultOk: true, typeOk: false })

    // p34 2-way LRU: set 0 ends with 0 in way 0 and 32 in way 1; set 1 holds 8.
    const sa = run('l23-org', { ways: 2 })
    const saTable = typed([
      [0, 0, '0', 'M[0]', 'M[4]'],
      [0, 1, '2', 'M[32]', 'M[36]'],
      [1, 0, '0', 'M[8]', 'M[12]'],
    ])
    allRight(markAll(sa, { acc: 'M M M M M M M', cells: saTable }, opts), 7)
    // Swapping the two ways of set 0 is the way-order slip.
    const swapped = typed([
      [0, 0, '2', 'M[32]', 'M[36]'],
      [0, 1, '0', 'M[0]', 'M[4]'],
      [1, 0, '0', 'M[8]', 'M[12]'],
    ])
    expect(markAll(sa, { acc: '', cells: swapped }, opts).slips).toEqual(['way-order'])
  })

  it('T11 Q1 (derived, no key): 2-byte words and odd byte addresses', () => {
    // Direct mapped: 30 (block 7) evicts block 23, so 95 is the one conflict miss.
    const t = run('t11')
    const dm = 'M(cold) M(cold) H M(cold) M(cold) M(conflict) M(cold) H H M(cold) H'
    allRight(markAll(t, { acc: dm, cells: rightCells(t) }, opts), 11)
    // 146 loads block 36 into index 4: bytes 144-147, so M[144] and M[146]. The odd address 145 is not a word start.
    expect(rightCells(t)[cellKey(4, 0, 'w0')]).toBe('M[144]')
    expect(markAll(t, { acc: '', cells: { ...rightCells(t), [cellKey(4, 0, 'w0')]: 'M[145]' } }, opts).cells[cellKey(4, 0, 'w0')]).toBe(false)
    // 2-way and FA: 6 cold misses, 5 hits.
    for (const ways of [2, 'full'] as const) {
      const r = run('t11', { ways })
      allRight(markAll(r, { acc: 'M(cold) M(cold) H M(cold) M(cold) H M(cold) H H M(cold) H', cells: rightCells(r) }, opts), 11)
      // Copying the direct mapped answer is wrong at 95.
      expect(markAll(r, { acc: dm, cells: {} }, opts).firstWrong).toBe(5)
    }
  })

  it('AY23/24 S1 Q20: the transpose, typed from the key', () => {
    // (a) direct mapped, sw allocates (key p17): tags 0x81, 0x502, 0x81, 0x81; index 1 holds two words of B; 6 hits.
    const a = run('c17-a')
    expect(a.frames.filter((f) => f.result === 'H').length).toBe(6)
    const keyA = typed([
      [0, 0, '0x81', 'M[0x1020]', 'M[0x1024]'],
      [1, 0, '0x502', 'M[0xa048]', 'M[0xa04c]'],
      [2, 0, '0x81', 'M[0x1030]', 'M[0x1034]'],
      [3, 0, '0x81', 'M[0x1038]', 'M[0x103c]'],
    ])
    allRight(markAll(a, { acc: '', cells: keyA }, opts), 0)
    // Bare hex tags are right when Bare tags is Hex, and wrong when read as decimal.
    const bare = Object.fromEntries(Object.entries(keyA).map(([k, v]) => [k, k.endsWith('.t') ? v.replace(/^0x/, '') : v]))
    expect(markAll(a, { acc: '', cells: bare }, { ...opts, tf: 'hex' }).cellRight).toBe(16)
    expect(markAll(a, { acc: '', cells: bare }, opts).cellRight).toBe(12)
    // The accepted alternative (sw ignored) is its own preset: typed here, index 1 is wrong.
    const lwRow = typed([[1, 0, '0x81', 'M[0x1028]', 'M[0x102c]']])
    const lw = markAll(a, { acc: '', cells: { ...keyA, ...lwRow } }, opts)
    expect(lw.cellRight).toBe(lw.cellTotal - 3)
    allRight(markAll(run('c17-a-lw'), { acc: '', cells: { ...keyA, ...lwRow } }, opts), 0)

    // (b) 2-way LRU, drawn with Way 0 holding the lower address (key p18).
    const b = run('c17-b')
    const keyB = typed([
      [0, 0, '0x102', 'M[0x1020]', 'M[0x1024]'],
      [0, 1, '0x103', 'M[0x1030]', 'M[0x1034]'],
      [1, 0, '0x103', 'M[0x1038]', 'M[0x103c]'],
      [1, 1, '0xa04', 'M[0xa048]', 'M[0xa04c]'],
    ])
    allRight(markAll(b, { acc: '', cells: keyB }, { ...opts, byAddr: true }), 0)

    // A store the trace names (L22 p63-66, W 24=X) still needs its name: the cache holds X, not the old M[24].
    const st = run('l22-store', { cache: 64 }) // 4 blocks of 16 B, small enough to type; same indices as 16 KB
    const set1 = st.frames[st.frames.length - 1].cache.find((x) => x.index === 1)!.lines[0]
    expect(set1.words[2].data).toBe('X')
    const c = rightCells(st)
    expect(markAll(st, { acc: '', cells: c }, opts).cellRight).toBe(markAll(st, { acc: '', cells: c }, opts).cellTotal)
    expect(markAll(st, { acc: '', cells: { ...c, [cellKey(1, 0, 'w2')]: 'M[24]' } }, opts).cells[cellKey(1, 0, 'w2')]).toBe(false)
  })
})
