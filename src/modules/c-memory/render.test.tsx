import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { arrayAddress, PRESETS, traceC } from '../../core/c-memory'
import { ByteStrip, memoryWords } from './ByteStrip'
import { addressToIndex, paddedLayout, parseMembers } from './calc'
import CalcTab from './CalcTab'
import CMemoryPage from './CMemoryPage'
import { PRESET_LIST, relevantTraps } from './common'
import { findCell, layoutFrame, leaves } from './layout'
import { MemoryDiagram } from './MemoryDiagram'

const run = (id: string) => {
  const p = PRESETS.find((x) => x.id === id)!
  return traceC(p.code, p.config)
}

describe('c-memory page renders', () => {
  it('both tabs render their default state', () => {
    const html = renderToString(<CMemoryPage />)
    // picture first: the board with its step title and Play inside it, tables in one tab strip below
    expect(html).toContain('class="board canvas"')
    expect(html).toContain('Step 1')
    expect(html).toContain('Run this program')
    expect(html).toContain('Next step')
    expect(html).toContain('Memory strip')
    expect(html).toContain('Name, address, value')
    expect(html.indexOf('class="board canvas"')).toBeLessThan(html.indexOf('role="tablist" aria-label="Tables"'))
    const calc = renderToString(<CalcTab intro={null} />)
    expect(calc).toContain('A0 + 36')
    expect(calc).toContain('flow-draw')
    // one calculator at a time; the others are a click away
    const struct = renderToString(<CalcTab intro={null} defaultTool="struct" />)
    expect(struct).toContain('sizeof')
    expect(struct).toContain('flow-draw')
    const bytes = renderToString(<CalcTab intro={null} defaultTool="bytes" />)
    expect(bytes).toContain('Big-endian')
    expect(bytes).toContain('Little-endian')
    expect(bytes).toContain('flow-packets')
  })

  it('every engine preset is offered once, with its source', () => {
    expect(PRESET_LIST.map((p) => p.value.id).sort()).toEqual(PRESETS.map((p) => p.id).sort())
    for (const p of PRESET_LIST) expect(p.source, p.value.id).toBeTruthy()
  })

  it('every preset draws at the first, middle and last step', () => {
    for (const p of PRESETS) {
      const t = traceC(p.code, p.config)
      const fs = t.frames
      for (const f of [fs[0], fs[fs.length >> 1], fs[fs.length - 1]]) {
        for (const showAddr of [true, false]) {
          const L = layoutFrame(f, showAddr)
          expect(L.width, p.id).toBeGreaterThan(0)
          expect(Number.isFinite(L.height), p.id).toBe(true)
        }
        expect(renderToString(<MemoryDiagram frame={f} showAddr selected={null} onSelect={() => {}} />), p.id).toContain('<svg')
        renderToString(<ByteStrip frame={f} endian="big" selected={null} onSelect={() => {}} />)
      }
    }
  })
})

describe('memory diagram layout', () => {
  it('T01 Q6: every arrow lands on a box (no stubs) and b, d point at a', () => {
    const t = run('CM02')
    const f = t.frames[t.frames.length - 2]
    const L = layoutFrame(f, true)
    expect(L.edges.length).toBeGreaterThan(0)
    expect(L.edges.every((e) => !e.stub && e.ok)).toBe(true)
    const names = Object.fromEntries(f.edges.map((e) => [e.fromName, e.toName]))
    expect(names.b).toBe('a')
    expect(names.d).toBe('a')
    expect(names.f).toBe('e')
  })

  it('a pointer into an array lands on the element cell, from below', () => {
    const t = run('CM53')
    const f = t.frames.find((x) => x.edges.length > 0)!
    const L = layoutFrame(f, true)
    const e = L.edges[0]
    expect(e.edge.toName).toBe('a[0][0]')
    expect(e.d).toMatch(/V[\d.]+$/) // last segment goes up into the cell
  })

  it('swap of pointer copies: the callee frame has its own pointer boxes', () => {
    const t = run('CM10')
    const f = t.frames.find((x) => x.stack.length > 1)!
    expect(layoutFrame(f, true).items.filter((i) => i.kind === 'group')).toHaveLength(f.stack.length)
  })

  it('a dangling pointer is drawn as a bad arrow', () => {
    const t = run('CM39')
    const bad = t.frames.flatMap((f) => layoutFrame(f, true).edges).filter((e) => !e.ok)
    expect(bad.length).toBeGreaterThan(0)
  })

  it('findCell and leaves walk nested structs and arrays', () => {
    const t = run('CM22')
    const f = t.frames[t.frames.length - 3]
    const st = f.stack[0].vars.find((v) => v.name === 'st')!
    expect(leaves(st).map((c) => c.name)).toEqual(['st[0].val', 'st[0].ch[0]', 'st[0].ch[1]', 'st[1].val', 'st[1].ch[0]', 'st[1].ch[1]'])
    expect(findCell(f, `${st.id}[1].ch[1]`)?.cell.value).toContain("'f'")
  })

  it('the byte strip covers every byte of every variable', () => {
    const t = run('CM20')
    const f = t.frames[t.frames.length - 2]
    const segs = memoryWords(f)
    const owned = segs.flatMap((s) => s.rows.flatMap((r) => ('gap' in r ? [] : r.bytes.filter((b) => b?.leaf))))
    const total = f.stack.flatMap((s) => s.vars).reduce((n, v) => n + v.size, 0)
    expect(owned).toHaveLength(total)
  })
})

describe('address calculator', () => {
  it('R02 p26: offset 36 of int a[3][4] is a[2][1], and back again', () => {
    const b = addressToIndex([3, 4], 4, 36)
    expect(b.ok && b.index).toEqual([2, 1])
    const f = arrayAddress({ elemSize: 4, dims: [3, 4], index: [2, 1] })
    expect(f.ok && f.offsetBytes).toBe(36)
  })

  it('Extras p7: offset 56 of int C[4][3][2] is C[2][1][0]', () => {
    const b = addressToIndex([4, 3, 2], 4, 56)
    expect(b.ok && b.index).toEqual([2, 1, 0])
  })

  it('round trips every element, row- and column-major, and reports a byte inside an element', () => {
    const dims = [3, 4, 5]
    for (const order of ['row', 'column'] as const)
      for (let k = 0; k < 60; k++) {
        const b = addressToIndex(dims, 8, k * 8 + 3, order)
        if (!b.ok) throw new Error(b.error)
        expect(b.byteIn).toBe(3)
        const f = arrayAddress({ elemSize: 8, dims, index: b.index, order })
        expect(f.ok && f.offsetElems).toBe(k)
      }
    expect(addressToIndex([3, 4], 4, 48).ok).toBe(false)
  })

  it('struct members parse and lay out with no padding (L05C p3)', () => {
    const m = parseMembers('int val;\nchar ch[2];\ndouble *x, *y;', 4)
    expect(m.errors).toEqual([])
    expect(m.members.map((x) => [x.name, x.size])).toEqual([['val', 4], ['ch', 2], ['x', 4], ['y', 4]])
    expect(parseMembers('struct foo bar;', 4).errors).toHaveLength(1)
    // beyond the course: padded, x aligns to 4 after 6 bytes
    const p = paddedLayout(m.members)
    expect(p.rows.map((r) => r.offset)).toEqual([0, 4, 8, 12])
    expect(paddedLayout(parseMembers('char c;\ndouble d;', 4).members).size).toBe(16)
  })

  it('traps follow what the program uses', () => {
    const ids = (id: string) => relevantTraps(PRESETS.find((p) => p.id === id)!.code).map((t) => t.id)
    expect(ids('CM10')).toContain('ptr-param')
    expect(ids('CM12')).toContain('post-inc')
    expect(ids('CM21')).toContain('arrow')
    expect(ids('CM35')).toContain('sizeof')
    expect(ids('CM02')).toEqual(expect.arrayContaining(['decl-star', 'garbage']))
    expect(ids('CM16')).not.toContain('decl-star')
  })
})

describe('predict then run', () => {
  it('a correct prediction matches; a wrong line points at the step that prints it', async () => {
    const { checkPrediction } = await import('./predict')
    const t = run('CM02')
    const outs = t.frames.map((f) => f.output)
    const full = t.summary.output
    expect(full.length).toBeGreaterThan(0)
    expect(checkPrediction(outs, `${full}\n\n`)).toEqual({ match: true })
    const ls = full.split('\n')
    const bad = ls.map((l, k) => (k === 0 ? `${l}x` : l)).join('\n')
    const c = checkPrediction(outs, bad)
    if (c.match) throw new Error('should differ')
    expect(c.line).toBe(1)
    // the step that finished line 1 is the first whose output differs from the guess
    expect(outs[c.step].split('\n')[0]).toBe(ls[0])
    expect(outs.slice(0, c.step).every((o) => !o.includes('\n'))).toBe(true)
    const short = checkPrediction(outs, `${full}\nmore`)
    expect(short.match).toBe(false)
    if (!short.match) expect(short.step).toBe(outs.length - 1)
  })

  it('the tracer page offers step over, step out and a prediction box', () => {
    const html = renderToString(<CMemoryPage />)
    expect(html).toContain('Step over')
    expect(html).toContain('Step out')
    expect(html).toContain('Your prediction of the output')
    expect(html).toContain('New stack addresses')
  })
})

describe('focus mode', () => {
  it('hides boxes and arrows the step did not change, and keeps the changed ones', () => {
    const t = run('CM02')
    const f = t.frames.find((x) => x.edges.length > 1 && x.stack[0].vars.some((v) => v.changed))!
    const count = (html: string, cls: string) => html.split(`class="${cls}`).length - 1
    const all = renderToString(<MemoryDiagram frame={f} showAddr selected={null} onSelect={() => {}} />)
    const some = renderToString(<MemoryDiagram frame={f} showAddr focus selected={null} onSelect={() => {}} />)
    expect(count(some, 'cm-cell')).toBeGreaterThan(0)
    expect(count(some, 'cm-cell')).toBeLessThan(count(all, 'cm-cell'))
    expect(count(some, 'cm-edge')).toBeLessThanOrEqual(count(all, 'cm-edge'))
    // the same layout either way, so boxes do not jump when the toggle flips
    expect(some.match(/viewBox="[^"]+"/)![0]).toBe(all.match(/viewBox="[^"]+"/)![0])
  })
})

describe('travelling light', () => {
  it('lights the arrow a step sets, and the one a write goes through', () => {
    const t = run('CM02')
    const svg = (f: (typeof t.frames)[number], line?: string) => renderToString(<MemoryDiagram frame={f} line={line} showAddr selected={null} onSelect={() => {}} />)
    // a step that gives a pointer its value draws light along that pointer's arrow
    const set = t.frames.find((f) => f.edges.some((e) => e.status === 'ok' && f.stack.some((s) => s.vars.some((v) => v.id === e.from && v.changed))))!
    expect(svg(set)).toContain('flow-draw')
    // a step that changes nothing lights nothing
    const quiet = t.frames.find((f) => f.edges.length > 0 && ![...f.stack.flatMap((s) => s.vars), ...f.globals, ...f.heap].some((v) => v.changed))
    if (quiet) expect(svg(quiet)).not.toContain('flow-draw')
  })
})

describe('union layout (R02 p32)', () => {
  it('every member at offset 0, size is the largest member', async () => {
    const { unionLayout } = await import('./calc')
    const u = unionLayout([{ name: 'i', type: 'int', size: 4 }, { name: 'f', type: 'float', size: 4 }, { name: 'c', type: 'char', size: 1 }], 0x100)
    expect(u.size).toBe(4)
    expect(u.members.every((m) => m.offset === 0 && m.address === 0x100)).toBe(true)
  })
})
