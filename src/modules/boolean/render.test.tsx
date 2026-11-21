import type { ComponentType, ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  checkSteps,
  combine,
  exprNetwork,
  kmapLayout,
  lintAnswer,
  minimize,
  parseFunction,
  printExpr,
  traceKMap,
  twoLevelCircuit,
  valuesOf,
  type BoolFunction,
  type CircuitKind,
} from '../../core/boolean'
import AlgebraTab from './AlgebraTab'
import BooleanPage from './BooleanPage'
import CheckTab from './CheckTab'
import { layoutCircuit, simulate } from './circuit-layout'
import { cycleCell, useFnInput, withVars, type FnInput } from './common'
import FormsTab from './FormsTab'
import GatesTab, { CircuitSvg, fromNetwork } from './GatesTab'
import { KMapSvg } from './KMapSvg'
import KMapTab, { frameLoops } from './KMapTab'
import { ANSWER_PRESETS, FN_PRESETS, FORMS_PRESETS, GATE_PRESETS, STEPS_PRESETS } from './presets'
import { UniversalPanel } from './UniversalPanel'

function WithInput({ Tab }: { Tab: ComponentType<{ intro: ReactNode; input: FnInput }> }) {
  return <Tab intro={null} input={useFnInput()} />
}

const fnOf = (text: string): BoolFunction => {
  const r = parseFunction(text)
  if (!r.ok) throw new Error(`${text}: ${r.errors.map((e) => e.message).join('; ')}`)
  return r.fn
}

const splitAxes = (a: { rows: string; cols: string }) => ({ rows: a.rows.split(','), cols: a.cols.split(',') })

describe('boolean page renders', () => {
  it('every tab renders its default state', () => {
    expect(renderToString(<BooleanPage />)).toContain('K-map of F')
    expect(renderToString(<WithInput Tab={KMapTab} />)).toContain('Prime implicants')
    expect(renderToString(<WithInput Tab={CheckTab} />)).toContain('Your answer')
    expect(renderToString(<WithInput Tab={GatesTab} />)).toContain('Delay timeline')
    expect(renderToString(<FormsTab intro={null} />)).toContain('Truth table, 8 rows')
    expect(renderToString(<AlgebraTab intro={null} />)).toContain('every step holds')
  })

  it('no em dashes in the module copy', () => {
    const files = import.meta.glob<string>('./*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true })
    expect(Object.keys(files).length).toBeGreaterThan(5)
    for (const [f, src] of Object.entries(files)) expect(src.includes(String.fromCharCode(0x2014)), f).toBe(false)
  })
})

describe('function presets', () => {
  it('every preset parses, traces and draws its first, middle and last frame', () => {
    for (const p of FN_PRESETS) {
      const fn = fnOf(p.f)
      const orientation = p.or === 'custom' && p.ax ? splitAxes(p.ax) : p.or === 'cols' ? 'cols' : 'rows'
      for (const form of ['sop', 'pos'] as const) {
        const r = traceKMap(fn, { orientation, form })
        expect(r.ok, `${p.source} ${form}`).toBe(true)
        if (!r.ok) continue
        const t = r.trace
        for (const f of [t.frames[0], t.frames[t.frames.length >> 1], t.frames[t.frames.length - 1]]) {
          const html = renderToString(
            <KMapSvg layout={t.layout} values={t.values} loops={frameLoops(t, f)} focus={f.focus} reasons={f.reasons} covered={f.covered} label="map" />,
          )
          expect(html, p.source).toContain('<svg')
          expect(html.match(/class="bo-cell[ "]/g)?.length, p.source).toBe(1 << fn.vars.length)
        }
      }
    }
  })

  it('T06 Q3 preset puts A,C on the rows (T06 Ans p3)', () => {
    const p = FN_PRESETS.find((x) => x.source === 'T06 Q3')!
    const l = kmapLayout(fnOf(p.f).vars, splitAxes(p.ax!))!
    expect(l.rowVars).toEqual(['A', 'C'])
    expect(l.grid[0][1]).toEqual([2, 3, 7, 6])
  })

  it('clicking a cell cycles 0, 1, X and keeps the header', () => {
    const fn = fnOf('G(a,b) = Σm(1)')
    expect(cycleCell(fn, 0)).toBe('G(a,b) = Σm(0, 1)')
    expect(cycleCell(fn, 1)).toBe('G(a,b) = Σm() + d(1)')
    expect(fnOf(cycleCell(fnOf('G(a,b) = Σm() + d(1)'), 1)).on).toEqual([])
    expect(withVars('F(A,B) = Σm(1)', 'x,y')).toBe('F(x,y) = Σm(1)')
    expect(withVars('Σm(1,2)', 'P,Q')).toBe('F(P,Q) = Σm(1,2)')
  })
})

describe('gates tab circuits', () => {
  it('every preset, every circuit kind: the drawn circuit computes the function on every care row', () => {
    const kinds: CircuitKind[] = ['and-or', 'nand-nand', 'or-and', 'nor-nor']
    const edge = ['F(A,B) = Σm(0,1,2,3)', 'F(A,B) = Σm()', 'F(A,B) = Σm(2,3)', 'F(A,B) = Σm(0,1)', 'F(A,B,C) = Σm(7)', 'F(A,B,C) = Σm(0)'].map((f) => ({ f, source: f }))
    for (const p of [...FN_PRESETS, ...edge]) {
      const fn = fnOf(p.f)
      const vals = valuesOf(fn)
      for (const kind of kinds)
        for (const cmp of [false, true]) {
          const form = kind === 'and-or' || kind === 'nand-nand' ? 'sop' : 'pos'
          const min = minimize(fn, form)
          const c = twoLevelCircuit(
            min.covers[0].primes.map((id) => min.primes[id].cube),
            fn.vars,
            kind,
            { complementsAvailable: cmp, name: fn.name },
          )
          const lay = layoutCircuit(c, fn.name)
          expect(lay.width, p.source).toBeGreaterThan(0)
          expect(renderToString(<CircuitSvg c={c} lay={lay} now={c.delay.value} focus path={new Set(c.delay.path)} values={simulate(c, 0)} />)).toContain('<svg')
          // Every gate input is wired (or is a rail feeding an inverter drawn on the rail).
          for (const pg of lay.gates) for (const i of pg.gate.inputs) expect(lay.wires.some((w) => w.from === i && w.to === pg.gate.output), `${p.source} ${kind} ${i}`).toBe(true)
          vals.forEach((v, m) => {
            if (v === 'X') return
            const out = c.constant ?? simulate(c, m).get(c.output)
            expect(out, `${p.source} ${kind} row ${m}`).toBe(v)
          })
        }
    }
  })
})

describe('answer and step presets', () => {
  it('answer presets give the verdicts their sources describe', () => {
    const verdict = (name: string) => {
      const p = ANSWER_PRESETS.find((x) => x.name === name)!
      return lintAnswer(p.ans, fnOf(p.f), { form: p.af, fitb: p.fitb, epiFirst: p.epi }).verdict
    }
    expect(verdict('Fill-in-the-blank, EPI first')).toBe('correct')
    expect(verdict('Literals out of order')).toBe('format')
    expect(verdict("A term of only don't-cares")).toBe('not-minimal')
    expect(verdict('A term that is not a PI')).toBe('not-minimal')
    expect(verdict('Missing AND dots')).toBe('format')
    expect(verdict('EPIs alone do not cover')).toBe('wrong')
    expect(verdict('XOR is not SOP')).toBe('wrong')
    expect(verdict('POS answer')).toBe('correct')
  })

  it('step presets: the worked chains hold and the traps do not', () => {
    for (const p of STEPS_PRESETS) {
      const r = checkSteps(p.text)
      const trap = p.source === 'T06 SE1'
      expect(r.valid, p.name).toBe(!trap)
      if (p.name === 'Wrong law cited') expect(r.steps[1].claimMatches).toBe(false)
    }
  })

  it('forms presets parse', () => {
    for (const p of FORMS_PRESETS) expect(parseFunction(p.ex).ok, p.source).toBe(true)
  })
})

describe('review additions', () => {
  it('expression mode: every gate preset draws a wired circuit that computes the expression (AY23/24 S2 Q12-13, R08 p25)', () => {
    for (const p of GATE_PRESETS) {
      const r = parseFunction(p.gx)
      expect(r.ok && r.expr, p.source).toBeTruthy()
      if (!r.ok || !r.expr) continue
      const net = exprNetwork(r.expr, { delays: { NAND: p.gd ?? 1, AND: p.gd ?? 1, OR: 1, XOR: 1, NOT: 1 }, fanInDelay: p.fi })
      const c = fromNetwork(net, r.fn.vars, printExpr(r.expr))
      const lay = layoutCircuit(c, r.fn.name)
      for (const pg of lay.gates) for (const i of pg.gate.inputs) expect(lay.wires.some((w) => w.from === i && w.to === pg.gate.output), `${p.source} ${i}`).toBe(true)
      valuesOf(r.fn).forEach((v, m) => expect(simulate(c, m, r.fn.vars).get(c.output), `${p.source} row ${m}`).toBe(v))
    }
    const xor = parseFunction(GATE_PRESETS[0].gx)
    if (xor.ok && xor.expr) expect(exprNetwork(xor.expr, { delays: { NAND: 3 } }).delay.value).toBe(9)
    expect(renderToString(<UniversalPanel />)).toContain('complete')
  })

  it('default views show the new panels', () => {
    const forms = renderToString(<FormsTab intro={null} />)
    expect(forms).toContain('Set operations on F3 and G')
    expect(forms).toContain('Σm(1, 3, 4, 5)')
    // The counts moved into the tab strip under the map; the tab is open when no answer is typed.
    const check = renderToString(<WithInput Tab={CheckTab} />)
    expect(check).toContain('Your counts')
    expect(check).toContain('Grouping the 1s')
    const kmap = renderToString(<WithInput Tab={KMapTab} />)
    expect(kmap).toContain('Left after the EPIs')
  })

  it('a constant and an unused header variable keep the simulator rows right', () => {
    const r = parseFunction('F(A,B,C) = A∙1 + B∙0')
    if (!r.ok || !r.expr) throw new Error('parse')
    const c = fromNetwork(exprNetwork(r.expr), r.fn.vars, printExpr(r.expr))
    expect(c.inputs).toEqual(['A', 'B', '0', '1'])
    valuesOf(r.fn).forEach((v, m) => expect(simulate(c, m, r.fn.vars).get(c.output)).toBe(v))
  })

  it('L15 ABCD presets put AB on the columns, as the slides do (docs/spec/logic.md)', () => {
    const p = FN_PRESETS.find((x) => x.source === 'L15 p39-41')!
    expect(p.or).toBe('cols')
    const l = kmapLayout(fnOf(p.f).vars, 'cols')!
    expect(l.colVars).toEqual(['A', 'B'])
  })

  it('T06 SE2 set operations (computed)', () => {
    const F = fnOf('F(A,B,C) = Σm(0,2,4,6,7)')
    const G = fnOf('G(A,B,C) = Σm(1,2,3,6)')
    expect(combine(F, G, 'xor')!.fn.on).toEqual([0, 1, 3, 4, 7])
    const p = FORMS_PRESETS.find((x) => x.source === 'T06 SE2 (computed)')!
    expect(parseFunction(p.eq, { vars: F.vars }).ok).toBe(true)
  })
})
