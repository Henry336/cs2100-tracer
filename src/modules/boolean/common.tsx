import { useId, useMemo, type ReactNode } from 'react'
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
import { Chip, Presets, Segmented, Tabs, TextField, Why } from '../../ui/kit'
import type { Stepper } from '../../ui/stepper'
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

/** A one-line input styled as the page's command bar (the datapath tracer's look). */
export function CommandBar({
  label,
  value,
  onChange,
  placeholder,
  word,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** A short read-back shown at the end of the bar. */
  word?: ReactNode
}) {
  const id = useId()
  return (
    <div className="bo-command-bar glow-input">
      <label className="bo-command-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="bo-command-input mono" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off" />
      {word ? <span className="bo-command-word">{word}</span> : null}
    </div>
  )
}

/** Secondary inputs, closed by default (printing opens it). */
export function Options({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="bo-options">
      <summary>{summary}</summary>
      <div className="bo-options-body">{children}</div>
    </details>
  )
}

/** The shared function as a command bar, with how it was read and any errors under it. */
export function FnCommand({ input, label = 'Function' }: { input: FnInput; label?: string }) {
  const { parse, text } = input
  return (
    <>
      <CommandBar
        label={label}
        value={text}
        onChange={input.setText}
        placeholder="F(A,B,C,D) = Σm(1,3,5) + d(0)"
        word={
          parse.ok ? (
            <W e={parse.why}>
              {parse.source === 'expression' ? 'expression' : parse.source === 'minterms' ? 'Σm list' : 'ΠM list'} over {parse.fn.vars.join(', ')}
            </W>
          ) : (
            <Chip signal="miss">cannot read</Chip>
          )
        }
      />
      {!parse.ok ? <IssueList text={text} issues={parse.errors} /> : null}
      <IssueList text={text} issues={parse.warnings} kind="warning" />
    </>
  )
}

/** Rename the variables; the first is the MSB. */
export function VarsField({ input }: { input: FnInput }) {
  return <TextField label="Variables, first is the MSB" value={headerVars(input.text, input.fn?.vars ?? [])} onChange={(v) => input.setText(withVars(input.text, v))} width="9em" />
}

/** Play pill and a quiet Next button inside a board, driving the same stepper as the bottom player. */
export function BoardPlay({ stepper, start, next }: { stepper: Stepper; start: string; next?: string }) {
  if (stepper.count < 2) return null
  const atEnd = stepper.index >= stepper.count - 1
  const label = stepper.playing ? 'Pause' : stepper.index === 0 || atEnd ? start : 'Play from here'
  return (
    <div className="bo-board-play">
      {/* toggle() restarts from the first step when it is at the end. */}
      <button type="button" className="bo-play" onClick={stepper.toggle} data-playing={stepper.playing}>
        {stepper.playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 3h3v10H4zM9 3h3v10H9z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2.8l9 5.2-9 5.2z" />
          </svg>
        )}
        {label}
      </button>
      {!atEnd ? (
        <button type="button" className="bo-next" onClick={stepper.next}>
          {next ? `Next: ${next}` : 'Next step'}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

/** One tab strip for a view's secondary tables; the chosen tab is kept in the URL under `key`. */
export function useDetailTab<T extends string>(key: string, tabs: { value: T; label: string }[]) {
  const [raw, set] = useUrlState<string>(key, tabs[0]?.value ?? '')
  const value = (tabs.some((t) => t.value === raw) ? raw : tabs[0]?.value) as T
  return [value, set as (v: T) => void] as const
}

export function DetailTabs<T extends string>({ label, tabs, value, onChange, children }: { label: string; tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; children: ReactNode }) {
  if (!tabs.length) return null
  return (
    <section className="bo-details" aria-label={label}>
      <Tabs label={label} value={value} onChange={onChange} tabs={tabs} />
      <div className="bo-detail-body">{children}</div>
    </section>
  )
}

/** Steps in order: the current one is bright and opened, the rest are one-line titles. */
export function StepStory({ label, steps, current, onPick }: { label: string; steps: { key: string; title: ReactNode; body?: ReactNode; disabled?: boolean }[]; current: number; onPick: (i: number) => void }) {
  return (
    <aside className="bo-story" aria-label={label}>
      <ol className="bo-steps">
        {steps.map((s, i) => (
          <li key={s.key} className={i === current ? 'is-now' : i < current ? 'is-past' : 'is-next'}>
            <button type="button" className="bo-step-btn" onClick={() => onPick(i)} disabled={s.disabled} aria-current={i === current ? 'step' : undefined}>
              <span className="bo-step-dot" aria-hidden="true" />
              <span>{s.title}</span>
            </button>
            {i === current && s.body ? <div className="bo-step-body">{s.body}</div> : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}

/** Group the 1s (SOP) or the 0s (POS). */
export function FormSwitch({ input }: { input: FnInput }) {
  return (
    <Segmented
      label="Group"
      value={input.form}
      onChange={input.setForm}
      options={[
        { value: 'sop', label: 'the 1s (SOP)' },
        { value: 'pos', label: 'the 0s (POS)', title: "Group the 0s for F', then DeMorgan (L15 p43-44)" },
      ]}
    />
  )
}

/** Form and K-map orientation controls. */
export function MapControls({ input, showForm = true }: { input: FnInput; showForm?: boolean }) {
  const n = input.fn?.vars.length ?? 0
  return (
    <div className="bo-row">
      {showForm ? <FormSwitch input={input} /> : null}
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
