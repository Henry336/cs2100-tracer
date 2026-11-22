import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PIPELINE_PRESETS as PIPELINE_CORE } from '../../core/pipeline'
import { __test } from '../../lib/url-state'
import { PRESET_BY_ID, normCfg } from '../cache/presets'
import { TRACE_PRESETS as DATAPATH_PRESETS } from '../datapath/presets'
import { PRESETS as PIPELINE_PRESETS } from '../pipeline/presets'
import { MODULES } from '../registry'
import { ERRATA, INDEX, PAPERS, TASKS, parseCites } from './data'
import PapersPage, { Row } from './PapersPage'
import { Presets } from '../../ui/kit'

/** Tab values each page accepts (its `type Tab`), read from the page files. */
const TABS: Record<string, string[]> = {
  '/c-memory': ['trace', 'calc'],
  '/mips': ['run', 'encode', 'const', 'branch', 'opcode'],
  '/datapath': ['trace', 'control', 'quiz', 'timing'],
  '/pipeline': ['diagram', 'exam', 'datapath', 'hazards', 'branches', 'timing'],
  '/cache': ['sim', 'write', 'compare', 'calc'],
  '/boolean': ['kmap', 'forms', 'check', 'algebra', 'gates'],
  '/msi': ['adder', 'cmp', 'dec', 'enc', 'mux', 'wb'],
  '/sequential': ['ff', 'analysis', 'design', 'check'],
}

function decodeHref(href: string): { path: string; state: Record<string, unknown> } {
  const [path, qs = ''] = href.replace(/^#/, '').split('?')
  const state: Record<string, unknown> = {}
  for (const [k, v] of new URLSearchParams(qs)) state[k] = __test.decode(v)
  return { path, state }
}

/** En and em dashes, which the copy rules forbid (built from char codes so this file has none). */
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const BAD = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}!]`)

const links = INDEX.questions.flatMap((q) => q.links.map((l) => ({ q, l, ...decodeHref(l.href) })))

describe('past paper index', () => {
  it('finds questions across every tracer, and every cite resolves to a paper', () => {
    expect(INDEX.unresolved).toEqual([])
    expect(INDEX.questions.length).toBeGreaterThan(60)
    expect(new Set(INDEX.questions.flatMap((q) => q.topics))).toEqual(new Set(['C', 'MIPS', 'datapath', 'pipeline', 'cache', 'Boolean', 'MSI', 'sequential']))
    for (const q of INDEX.questions) expect(PAPERS.map((p) => p.id), q.id).toContain(q.paper)
  })

  it('lists each paper and question once', () => {
    const ids = INDEX.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(INDEX.papers.map((p) => p.id)).size).toBe(INDEX.papers.length)
    expect(INDEX.papers.map((p) => p.id)).toContain('AY25/26 midterm')
  })

  it('reads the cite styles the presets use', () => {
    expect(parseCites('AY24/25 Q19; R11 Addendum p3-4')).toEqual([{ paper: 'AY24/25 S1', q: 19, to: 19 }])
    expect(parseCites('Midterm AY25/26 Q11-Q12')).toEqual([{ paper: 'AY25/26 midterm', q: 11, to: 12 }])
    expect(parseCites('AY25/26 midterm Q20-25')).toEqual([{ paper: 'AY25/26 midterm', q: 20, to: 25 }])
    expect(parseCites('AY21/22 S1 Final Q2 and Q3')).toEqual([{ paper: 'AY21/22 S1', q: 2, to: 3 }])
    expect(parseCites('AY18-19 Q3b, computed')).toEqual([{ paper: 'AY18/19 S2', q: 3, to: 3 }])
    expect(parseCites('T09 Q3 (AY18/19)')).toEqual([])
    const unresolved: string[] = []
    expect(parseCites('AY23/24 Q5', unresolved)).toEqual([])
    expect(unresolved).toEqual(['AY23/24 Q5'])
  })

  it('every link opens a registered module and decodes to state that module reads', () => {
    const paths = new Set(MODULES.map((m) => m.path))
    expect(links.length).toBeGreaterThan(100)
    for (const { q, l, path, state } of links) {
      const where = `${q.id} ${l.preset}`
      expect(paths.has(path), where).toBe(true)
      expect(path).toBe(l.path)
      for (const [k, v] of Object.entries(state)) expect(v, `${where}: ${k}`).not.toBeUndefined()
      if ('tab' in state) expect(TABS[path], where).toContain(state.tab)
      if (path === '/pipeline' && 'pre' in state) {
        const p = PIPELINE_PRESETS.find((x) => x.key === state.pre)
        expect(p, where).toBeDefined()
        expect(state.src).toBe(p!.code)
        expect(state.run).toEqual(p!.run)
      }
      if (path === '/datapath') expect(DATAPATH_PRESETS.some((p) => p.src === state.src && p.regs === state.regs), where).toBe(true)
      if (path === '/cache' && state.tab === 'sim') {
        expect(PRESET_BY_ID.has(state.p as string), where).toBe(true)
        expect(normCfg(state.c)).toEqual(state.c)
        expect(['', 'loop', state.p]).toContain(state.g)
      }
    }
  })

  it('only calculator presets that are not exported fall back to a pick-by-name link', () => {
    const loose = links.filter((x) => !x.l.exact)
    expect(loose.length).toBeGreaterThan(0)
    for (const { state } of loose) expect(state.tab).toBe('calc')
  })

  it('has a short plain task line for every question and no orphan hand-kept entries', () => {
    const ids = new Set(INDEX.questions.map((q) => q.id))
    for (const q of INDEX.questions) {
      expect(q.task, q.id).not.toBe('')
      expect(q.task.split(/\s+/).length, q.id).toBeLessThanOrEqual(12)
    }
    for (const id of [...Object.keys(TASKS), ...Object.keys(ERRATA)]) expect(ids.has(id), id).toBe(true)
  })

  it('keeps errata in house style, each with a kind and a source', () => {
    const text = [...Object.values(TASKS), ...Object.values(ERRATA).flat().flatMap((e) => [e.note, e.source])]
    for (const t of text) expect(t).not.toMatch(BAD)
    for (const e of Object.values(ERRATA).flat()) {
      expect(['key slip', 'sources disagree']).toContain(e.kind)
      expect(e.source.length).toBeGreaterThan(3)
    }
  })

  it('opens the (a)-(e) papers in the Exam tab with the paper code loaded, then each part in the diagram', () => {
    for (const [id, pre] of [['AY24/25 S1 Q19', 'P10'], ['AY25/26 S1 Q19', 'P11']]) {
      const q = INDEX.questions.find((x) => x.id === id)!
      const [first, ...rest] = q.links
      const { state } = decodeHref(first.href)
      expect(first.tool, id).toBe('Exam (a) to (e)')
      expect(state.tab).toBe('exam')
      expect(state.pre).toBe(`${pre}.0`)
      // ExamTab shows the key only while the code is the paper's own (paperKey intact).
      expect(state.src).toBe(PIPELINE_CORE.find((x) => x.id === pre)!.source.replace(/^\n/, ''))
      expect(rest.length).toBe(5)
      for (const l of rest) expect(decodeHref(l.href).state.tab, l.preset).toBeUndefined()
    }
    // Other lettered presets (per-instruction delays, loops) are not the five-part template.
    for (const { l, state } of links) if (state.tab === 'exam') expect(['P10.0', 'P11.0'], l.preset).toContain(state.pre)
  })

  it('errata name course sources only, never repo files', () => {
    for (const e of Object.values(ERRATA).flat()) expect(e.source).not.toMatch(/docs\/|\.md\b|DECISIONS|spec|ambiguit|gaps/i)
    // R06 p39 heads its Q28 pages "midterm questions": they are not finals questions.
    expect(INDEX.questions.some((x) => x.id === 'AY24/25 S1 Q28')).toBe(false)
    expect(INDEX.questions.find((x) => x.id === 'AY24/25 midterm Q28')?.links[0].path).toBe('/datapath')
  })

  it('marks a key only on the four finals with an answer file', () => {
    expect(PAPERS.filter((p) => p.key).map((p) => p.id)).toEqual(['AY23/24 S1', 'AY23/24 S2', 'AY24/25 S1', 'AY25/26 S1'])
    for (const q of INDEX.questions) expect(q.key).toBe(PAPERS.find((p) => p.id === q.paper)!.key)
  })
})

describe('past papers page', () => {
  it('renders the index with links, errata and the help tab', () => {
    const html = renderToString(<PapersPage />)
    for (const text of ['Past papers', 'AY24/25 S1 Q19', 'AY25/26 midterm', 'Open in Pipeline', 'key slip', 'sources disagree', 'Exam mode', 'Has official key', 'How to use', 'Errata only'])
      expect(html).toContain(text)
    expect(html).not.toMatch(DASH)
  })

  it('exam mode hides the link until the student has tried the question', () => {
    const q = INDEX.questions.find((x) => x.id === 'AY24/25 S1 Q19')!
    const locked = renderToString(<Row q={q} exam tried={false} onTried={() => {}} />)
    expect(locked).toContain('I have tried it')
    expect(locked).not.toContain('href=')
    expect(locked).not.toContain(q.errata[0].note)
    const open = renderToString(<Row q={q} exam tried onTried={() => {}} />)
    expect(open).toContain('href="#/pipeline?')
    expect(open).toContain(q.errata[0].note)
  })
})

describe('landing on a module', () => {
  it('the preset menu shows the preset the link loaded, and Choose otherwise', () => {
    const list = [
      { name: 'First', value: 1 },
      { name: 'Second', value: 2 },
    ]
    const shown = renderToString(<Presets presets={list} onPick={() => {}} isCurrent={(v) => v === 2} />)
    expect(shown).toMatch(/<option value="1" selected="">Second/)
    const none = renderToString(<Presets presets={list} onPick={() => {}} isCurrent={() => false} />)
    expect(none).toMatch(/<option value="" disabled="" selected="">/)
  })
})
