import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { geometry, parseAccesses, simulate, type Trace } from '../../core/cache'
import CachePage from './CachePage'
import CalcTab, { drillConfig } from './CalcTab'
import CheckMode from './CheckMode'
import CompareTab from './CompareTab'
import SimulatorTab, { parseAnswer } from './SimulatorTab'
import WriteTab from './WriteTab'
import { AddressBar, CacheTable, TraceEditor, cursorOf, stateAfter, useInput, type Input } from './common'
import { DEFAULT_LOOP, collisions, loopTrace, parseBody, type LoopForm } from './loop'
import { DEFAULT_CFG, TRACE_PRESETS, normCfg, toConfig } from './presets'

function WithInput({ Tab }: { Tab: ComponentType<{ intro: ReactNode; input: Input }> }) {
  return <Tab intro={null} input={useInput()} />
}

const run = (id: string): Trace => {
  const p = TRACE_PRESETS.find((x) => x.id === id)!
  const g = p.gen?.()
  if (g && !g.ok) throw new Error(g.errors.join('; '))
  const list = g ? g.value : parseAccesses(p.text ?? '').accesses
  const r = simulate(toConfig({ ...DEFAULT_CFG, ...p.cfg }), list)
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.value
}

describe('cache page renders', () => {
  it('every tab renders its default state', () => {
    expect(renderToString(<CachePage />)).toContain('Check my answer')
    expect(renderToString(<WithInput Tab={WriteTab} />)).toContain('Write-back, write around')
    expect(renderToString(<WithInput Tab={CompareTab} />)).toContain('Fully associative')
    expect(renderToString(<WithInput Tab={SimulatorTab} />)).toContain('Cache contents')
    expect(renderToString(<CalcTab intro={null} />)).toContain('Storage bits')
  })

  it('each stepping tab puts its Play pill inside the board', () => {
    const sim = renderToString(<WithInput Tab={SimulatorTab} />)
    expect(sim).toContain('Run this trace')
    expect(sim).toContain('data-wire="src"')
    expect(sim).toContain('data-wire="row"')
    expect(renderToString(<WithInput Tab={WriteTab} />)).toContain('flow-draw')
    const cmp = renderToString(<WithInput Tab={CompareTab} />)
    expect(cmp).toContain('Run the trace on every cache')
    expect(cmp).toContain('ca-strip')
  })

  it('every preset simulates and its cache table renders', () => {
    for (const p of TRACE_PRESETS) {
      const t = run(p.id)
      expect(t.frames.length, p.id).toBeGreaterThan(0)
      for (const f of [t.frames[0], t.frames[t.frames.length >> 1], t.frames[t.frames.length - 1]]) {
        for (const byAddr of [false, true]) {
          const html = renderToString(<CacheTable g={t.geometry} sets={stateAfter(t, f)} cur={cursorOf(f)} tf="hex" byAddr={byAddr} dirty />)
          expect(html, p.id).toContain('<table')
        }
        expect(renderToString(<AddressBar g={t.geometry} split={f.split} />)).toContain(f.split.offset.bits)
      }
    }
  })

  it('check mode renders a fill-in table and reveals nothing before Check', () => {
    const noop = () => {}
    const html = renderToString(<CheckMode trace={run('t11')} lv="r12" setLv={noop} tf="dec" setTf={noop} byAddr={false} onJump={noop} />)
    expect(html).toContain('Check my answers')
    expect(html).toContain('Index 15, word 1')
    expect(html).not.toContain('M[264]')
    expect(html).not.toContain('ca-ck-icon')
  })

  it('presets match their sources', () => {
    expect(run('l22-ex').summary.resultString).toBe('M H M H M M H')
    expect(run('l22-read').summary.resultString).toBe('M H M M M')
    expect(run('l23-lru').summary.resultString).toBe('M M M M H M H M H')
    expect(run('t11').summary.resultString).toBe('M M H M M M M H H M H')
    expect(run('c16-ab').summary.misses).toBe(10)
    expect(run('c16-c').summary.misses).toBe(5)
    expect(run('c17-a').summary.hits).toBe(6)
    expect(run('ay1516').summary.hitRate.reduced).toBe('5/12')
    expect(run('rc-row').summary.hits).toBe(48)
    expect(run('rc-col').summary.hits).toBe(0)
  })

  it('reads answers and survives bad URL state', () => {
    expect(parseAnswer('M H M(cold) h m conflict MHM').map((t) => `${t.r}${t.type ?? ''}`)).toEqual(['M', 'H', 'Mcold', 'H', 'Mconflict', 'M', 'H', 'M'])
    const bad = simulate(toConfig(normCfg({ cache: 'x', ways: {}, repl: 3 })), [{ address: 4, kind: 'read' }])
    expect(bad.ok).toBe(false)
    expect(normCfg(null)).toEqual(DEFAULT_CFG)
  })

  it('loop builder reads bodies, rebuilds the loop presets and spots thrashing', () => {
    const body = parseBody('R A[i], w B[2i+1], sw C[k], A[3]')
    expect(body.ok && body.value).toEqual([
      { array: 'A', kind: 'read', index: 'i', scale: 1, offset: 0 },
      { array: 'B', kind: 'write', index: 'i', scale: 2, offset: 1 },
      { array: 'C', kind: 'write', index: 'k', scale: 1, offset: 0 },
      { array: 'A', kind: 'read', scale: 0, offset: 3 },
    ])
    expect(parseBody('R A[j]').ok).toBe(false)
    expect(parseBody('').ok).toBe(false)
    expect(loopTrace({ ...DEFAULT_LOOP, arrays: [{ name: 'A', base: 'zz', elem: 4, len: 4 }] }).ok).toBe(false)
    expect(loopTrace({ ...DEFAULT_LOOP, mod: 4, rem: '' }).ok).toBe(false)

    // The presets now come from loop forms: same numbers as the core fixtures (C16, AY20/21 Q15).
    const a = run('c16-e').summary.groups.find((g) => g.name === 'A')!
    expect(a.hits).toBe(248)
    expect(run('ay2021-3200').summary.hits).toBe(0)
    expect(run('ay2021-3216').summary.groups.map((g) => g.reduced)).toEqual(['3/4', '3/4'])
    expect(run('ay2021-3210').summary.groups.map((g) => g.hits)).toEqual([2407, 2407])

    const g = geometry(toConfig({ ...DEFAULT_CFG, cache: 512, block: 16, ways: 1 }))
    if (!g.ok) throw new Error(g.errors.join('; '))
    const thrashOf = (form: LoopForm) => {
      const r = loopTrace(form)
      if (!r.ok) throw new Error(r.errors.join('; '))
      return collisions(g.value, r.value)
    }
    const p3200 = TRACE_PRESETS.find((x) => x.id === 'ay2021-3200')!.loop!
    expect(thrashOf(p3200)).toEqual([{ arrays: ['A', 'B'], set: 0, thrash: true, span: 512 }])
    expect(thrashOf({ ...p3200, n: 3216, arrays: p3200.arrays.map((x) => ({ ...x, len: 3216 })) })).toEqual([])
    const g2 = geometry(toConfig({ ...DEFAULT_CFG, cache: 512, block: 16, ways: 2 }))
    if (!g2.ok) throw new Error(g2.errors.join('; '))
    const r = loopTrace(p3200)
    expect(r.ok && collisions(g2.value, r.value)[0].thrash).toBe(false)
  })

  it('loop builder renders, and every drill question is valid', () => {
    function LoopMode() {
      const input = useInput()
      const r = loopTrace(DEFAULT_LOOP)
      if (!r.ok) throw new Error(r.errors.join('; '))
      return <TraceEditor input={{ ...input, mode: 'loop', preset: undefined, loopRun: r.value, accesses: r.value.accesses }} />
    }
    const html = renderToString(<LoopMode />)
    expect(html).toContain('Thrashing: A, B')
    expect(html).toContain('One iteration')
    for (let seed = 1; seed <= 300; seed++) {
      const q = drillConfig(seed)
      const geo = geometry(q)
      expect(geo.ok, `seed ${seed}`).toBe(true)
      if (geo.ok) expect(geo.value.tagBits, `seed ${seed}`).toBeGreaterThan(0)
    }
    expect(drillConfig(7)).toEqual(drillConfig(7))
  })
})
