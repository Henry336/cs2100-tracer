import { describe, expect, it } from 'vitest'
import { parseAccesses, simulate, type Trace } from '../../core/cache'
import { cellKey, markAll, normEntries, parseTag, parseWord, type Entries } from './check'
import { DEFAULT_CFG, TRACE_PRESETS, toConfig } from './presets'

const run = (id: string): Trace => {
  const p = TRACE_PRESETS.find((x) => x.id === id)!
  const r = simulate(toConfig({ ...DEFAULT_CFG, ...p.cfg }), parseAccesses(p.text ?? '').accesses)
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
})
