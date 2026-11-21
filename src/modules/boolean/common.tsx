import { useMemo, type ReactNode } from 'react'
import {
  canonical,
  functionFromValues,
  kmapLayout,
  parseFunction,
  valuesOf,
  type Axes,
  type BoolFunction,
  type CellValue,
  type Explain,
  type Form,
  type FunctionParse,
  type Issue,
  type KMapLayout,
} from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Chip, Presets, Segmented, TextField, Why } from '../../ui/kit'
import { FN_PRESETS, type Orient } from './presets'

export const DEFAULT_F = 'F(A,B,C,D) = Σm(2,3,4,5,7,8,10,13,15)'

/** <Why> straight from an engine Explain. */
export function W({ e, children }: { e?: Explain; children: ReactNode }) {
  if (!e) return <>{children}</>
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

/** Errors and warnings with the offending part of the input underlined. */
export function IssueList({ text, issues, kind = 'error' }: { text: string; issues: Issue[]; kind?: 'error' | 'warning' }) {
  if (!issues.length) return null
  return (
    <ul className={`bo-issues bo-issues-${kind}`}>
      {issues.map((i, k) => {
        const [a, b] = i.at
        const shown = b > a && b <= text.length
        return (
          <li key={k}>
            <span>
              {i.line ? <span className="mono">line {i.line}: </span> : null}
              {i.message}
              {i.cite ? <span className="bo-cite"> ({i.cite})</span> : null}
            </span>
            {shown ? (
              <code className="bo-snippet">
                {text.slice(Math.max(0, a - 12), a)}
                <mark>{text.slice(a, b)}</mark>
                {text.slice(b, b + 12)}
              </code>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

const HEADER = /^\s*([A-Za-z][A-Za-z0-9]*)\s*(?:\(([^()]*)\))?\s*=\s*/

/** Rewrite (or add) the F(A,B,...) header so the variable list changes and the body stays. */
export function withVars(text: string, vars: string): string {
  const h = HEADER.exec(text)
  const name = h?.[1] ?? 'F'
  const body = h ? text.slice(h[0].length) : text.trim()
  return `${name}(${vars}) = ${body}`
}

export function headerVars(text: string, fallback: string[]): string {
  const h = HEADER.exec(text)
  return h?.[2] !== undefined ? h[2] : fallback.join(',')
}

const splitNames = (s: string) =>
  s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** The function shared by the K-map, answer checker and gates tabs, kept in the URL. */
export interface FnInput {
  text: string
  setText: (t: string) => void
  parse: FunctionParse
  fn: BoolFunction | null
  form: Form
  setForm: (f: Form) => void
  orient: Orient
  setOrient: (o: Orient) => void
  axes: { rows: string; cols: string }
  setAxes: (a: { rows: string; cols: string }) => void
  /** What to pass to kmapLayout / traceKMap. */
  orientation: 'rows' | 'cols' | Axes
  layout: KMapLayout | null
}

export function useFnInput(): FnInput {
  const [rawText, setText] = useUrlState<unknown>('f', DEFAULT_F)
  const [rawForm, setForm] = useUrlState<Form>('form', 'sop')
  const [rawOrient, setOrient] = useUrlState<Orient>('or', 'rows')
  const [rawAxes, setAxes] = useUrlState<{ rows: string; cols: string }>('ax', { rows: 'A,C', cols: 'B,D' })
  const text = typeof rawText === 'string' ? rawText : DEFAULT_F
  const form: Form = rawForm === 'pos' ? 'pos' : 'sop'
  const orient: Orient = rawOrient === 'cols' || rawOrient === 'custom' ? rawOrient : 'rows'
  const axes = rawAxes && typeof rawAxes.rows === 'string' && typeof rawAxes.cols === 'string' ? rawAxes : { rows: '', cols: '' }
  const parse = useMemo(() => parseFunction(text), [text])
  const fn = parse.ok ? parse.fn : null
  const orientation = useMemo<'rows' | 'cols' | Axes>(
    () => (orient === 'custom' ? { rows: splitNames(axes.rows), cols: splitNames(axes.cols) } : orient),
    [orient, axes.rows, axes.cols],
  )
  const layout = useMemo(() => (fn ? kmapLayout(fn.vars, orientation) : null), [fn, orientation])
  return { text, setText, parse, fn, form, setForm, orient, setOrient, axes, setAxes, orientation, layout }
}

/** Load a preset into the shared function state. */
export function FnPresets({ input, onPick }: { input: FnInput; onPick?: () => void }) {
  return (
    <Presets
      presets={FN_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        input.setText(p.f)
        input.setOrient(p.or ?? 'rows')
        if (p.ax) input.setAxes(p.ax)
        onPick?.()
      }}
    />
  )
}

/** Function text, variable names, and how it was read. */
export function FunctionFields({ input, extra }: { input: FnInput; extra?: ReactNode }) {
  const { parse, fn, text } = input
  return (
    <div className="bo-fnfields">
      <div className="bo-row">
        <div className="bo-grow">
          <TextField label="Function: Σm(..) + d(..), ΠM(..) ∙ D(..), or an expression" value={text} onChange={input.setText} placeholder="F(A,B,C,D) = Σm(1,3,5) + d(0)" />
        </div>
        <TextField
          label="Variables, first is the MSB"
          value={headerVars(text, fn?.vars ?? [])}
          onChange={(v) => input.setText(withVars(text, v))}
          width="9em"
        />
        {extra}
      </div>
      <p className="bo-status">
        {parse.ok ? (
          <>
            <Chip signal="hit">read</Chip>{' '}
            <W e={parse.why}>
              {parse.source === 'expression' ? 'an expression' : parse.source === 'minterms' ? 'a Σm list' : 'a ΠM list'}
            </W>{' '}
            over {parse.fn.vars.join(', ')}: <span className="mono">{canonical(parse.fn).sigma}</span>
          </>
        ) : (
          <>
            <Chip signal="miss">cannot read</Chip> fix the function below
          </>
        )}
      </p>
      {!parse.ok ? <IssueList text={text} issues={parse.errors} /> : null}
      <IssueList text={text} issues={parse.warnings} kind="warning" />
    </div>
  )
}

/** Form and K-map orientation controls. */
export function MapControls({ input, showForm = true }: { input: FnInput; showForm?: boolean }) {
  const n = input.fn?.vars.length ?? 0
  return (
    <div className="bo-row">
      {showForm ? (
        <Segmented
          label="Group"
          value={input.form}
          onChange={input.setForm}
          options={[
            { value: 'sop', label: 'the 1s (SOP)' },
            { value: 'pos', label: 'the 0s (POS)', title: "Group the 0s for F', then DeMorgan (L15 p43-44)" },
          ]}
        />
      ) : null}
      <Segmented
        label="Map layout"
        value={input.orient}
        onChange={input.setOrient}
        options={[
          { value: 'rows', label: 'first variables on rows', title: 'As in the tutorial and exam keys (L15 p19, R07 p31)' },
          { value: 'cols', label: 'on columns', title: 'As in the A,B,C,D examples of L15 p32-55' },
          { value: 'custom', label: 'custom', title: 'Any variables on any axis (T06 Q3)' },
        ]}
      />
      {input.orient === 'custom' ? (
        <>
          <TextField label="Row variables" value={input.axes.rows} onChange={(rows) => input.setAxes({ ...input.axes, rows })} width="5em" />
          <TextField label="Column variables" value={input.axes.cols} onChange={(cols) => input.setAxes({ ...input.axes, cols })} width="5em" />
        </>
      ) : null}
      {input.orient === 'custom' && n >= 2 && n <= 5 && !input.layout ? (
        <p className="bo-status bo-bad">
          Put one or two variables on each axis and use each once{n === 5 ? ', leaving one variable to pick the map' : ''}.
        </p>
      ) : null}
    </div>
  )
}

/** Click a cell to cycle 0, 1, X; rewrites the function as Σm(..) + d(..). */
export function cycleCell(fn: BoolFunction, m: number): string {
  const vals = valuesOf(fn).slice()
  const next: Record<string, CellValue> = { '0': 1, '1': 'X', X: 0 }
  vals[m] = next[String(vals[m])]
  const g = functionFromValues(fn.vars, vals, fn.name)
  return `${g.name}(${g.vars.join(',')}) = ${canonical(g).sigma}`
}
