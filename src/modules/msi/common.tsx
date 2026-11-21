import { useMemo, type ReactNode } from 'react'
import { canonical, parseFunction, type BoolFunction, type Explain, type FunctionParse } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Chip, Tabs, TextField, Toggle, Why } from '../../ui/kit'
import type { Stepper } from '../../ui/stepper'

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

/** Read an integer from URL state, falling back when the URL holds something else. */
export const int = (raw: unknown, min: number, max: number, fallback: number): number => {
  const v = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : fallback
  return Math.min(max, Math.max(min, v))
}

export const pick = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(raw as T) ? (raw as T) : fallback)

export const str = (raw: unknown, fallback: string): string => (typeof raw === 'string' ? raw : fallback)

/** A list of pin texts of a fixed length, padded from `fill`. */
export const pins = (raw: unknown, n: number, fill: (j: number) => string): string[] =>
  Array.from({ length: n }, (_, j) => (Array.isArray(raw) && typeof raw[j] === 'string' ? (raw[j] as string) : fill(j)))

export const bitOf = (v: number, k: number) => ((v >> k) & 1) as 0 | 1

export const splitVars = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** One input bit as a pressable switch. The value is printed, so colour is never the only signal. */
export function BitToggle({ label, value, onChange, title }: { label: ReactNode; value: 0 | 1; onChange: (v: 0 | 1) => void; title?: string }) {
  return (
    <button type="button" className={`ms-bit${value ? ' is-1' : ''}`} aria-pressed={value === 1} title={title} onClick={() => onChange(value ? 0 : 1)}>
      <span className="ms-bit-name">{label}</span>
      <span className="ms-bit-val mono">{value}</span>
    </button>
  )
}

/** A row of bit switches for a value, MSB first. `names[j]` labels bit (width - 1 - j). */
export function BitRow({
  label,
  names,
  value,
  onChange,
}: {
  label: string
  names: string[]
  value: number
  onChange: (v: number) => void
}) {
  const w = names.length
  return (
    <div className="ms-bitrow" role="group" aria-label={label}>
      <span className="control-label">{label}</span>
      <div className="ms-bits">
        {names.map((nm, j) => {
          const k = w - 1 - j
          return <BitToggle key={nm + j} label={nm} value={bitOf(value, k)} onChange={(b) => onChange(b ? value | (1 << k) : value & ~(1 << k))} />
        })}
      </div>
    </div>
  )
}

/** A function typed as Σm(..) + d(..), ΠM(..) or an expression, kept in the URL under `key`. */
export interface FnState {
  text: string
  setText: (t: string) => void
  parse: FunctionParse
  fn: BoolFunction | null
}

export function useFn(key: string, initial: string): FnState {
  const [raw, setText] = useUrlState<unknown>(key, initial)
  const text = str(raw, initial)
  const parse = useMemo(() => parseFunction(text), [text])
  return { text, setText, parse, fn: parse.ok ? parse.fn : null }
}

/** Function field with how it was read, or why it could not be. */
export function FnField({ state, label = 'Function: Σm(..) + d(..), ΠM(..) or an expression' }: { state: FnState; label?: string }) {
  const { parse, text } = state
  return (
    <div className="ms-fnfield">
      <div className="ms-grow">
        <TextField label={label} value={text} onChange={state.setText} placeholder="F(A,B,C) = Σm(0,1,3,6)" />
      </div>
      <p className="ms-status">
        {parse.ok ? (
          <>
            <Chip signal="hit">read</Chip> over {parse.fn.vars.join(', ')} (first is the MSB): <span className="mono">{canonical(parse.fn).sigma}</span>
          </>
        ) : (
          <>
            <Chip signal="miss">cannot read</Chip> {parse.errors[0]?.message ?? 'check the function'}
          </>
        )}
      </p>
    </div>
  )
}

/** Inline errors from an engine Built result. */
export function PinErrors({ errors }: { errors: { pin: string; message: string }[] }) {
  if (!errors.length) return null
  return (
    <ul className="ms-errors">
      {errors.map((e, i) => (
        <li key={i}>{e.message}</li>
      ))}
    </ul>
  )
}

/* ---------- Gate shapes for the SVG diagrams ---------- */

export type Shape = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'NOT'

/** Outline of a gate whose inputs meet the left edge at x and whose output is at (x + w, y + h/2). */
export function gatePath(t: Shape, x: number, y: number, w: number, h: number): string {
  const r = h / 2
  const bw = t === 'NAND' || t === 'NOR' ? w - 8 : w
  if (t === 'NOT') return `M${x},${y} L${x + w - 8},${y + r} L${x},${y + h} Z`
  if (t === 'AND' || t === 'NAND') return `M${x},${y} H${x + bw - r} A${r},${r} 0 0 1 ${x + bw - r},${y + h} H${x} Z`
  const or = `M${x},${y} Q${x + bw * 0.6},${y} ${x + bw},${y + r} Q${x + bw * 0.6},${y + h} ${x},${y + h} Q${x + bw * 0.3},${y + r} ${x},${y} Z`
  return t === 'XOR' ? `${or} M${x - 6},${y} Q${x + bw * 0.3 - 6},${y + r} ${x - 6},${y + h}` : or
}

/** Bubble centre for NAND, NOR and NOT. */
export const bubble = (t: Shape, x: number, y: number, w: number, h: number) => (t === 'NAND' || t === 'NOR' || t === 'NOT' ? { cx: x + w - 4, cy: y + h / 2 } : null)

export const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ')

/** Wire state classes shared by every diagram: now (settles at this step), ready, wait (not settled), off (not used). */
export type NetState = 'now' | 'ready' | 'wait' | 'off'
export const netClass = (s: NetState, focus: boolean) => `ms-net is-${s}${focus && (s === 'wait' || s === 'off') ? ' is-hidden' : ''}`

/* ---------- Calm layout: board with the player inside, one-line story, one tab strip ---------- */

/** SVG path for a straight wire or a polyline, drawn from its source (first point). */
export const seg = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1}L${x2},${y2}`
export const polyD = (p: [number, number][]) => `M${p.map((q) => q.join(',')).join('L')}`

/** Light on the wires that carry a value in this step: they draw in, then packets travel (shell.css). `id` restarts it. */
export function Flow({ id, paths }: { id: string | number; paths: string[] }) {
  if (!paths.length) return null
  return (
    <>
      <g className="flow-draw" key={`d${id}`} aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} />
        ))}
      </g>
      <g className="flow-packets" key={`p${id}`} aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} style={{ animationDelay: `${0.7 + (i % 5) * 0.18}s` }} />
        ))}
      </g>
    </>
  )
}

/** The picture: a dot-grid board with the current step named, view tools, the diagram, the player and the legend. */
export function Board({
  title,
  step,
  note,
  tools,
  play,
  foot,
  children,
}: {
  title: ReactNode
  /** What the board shows now, in the display font. */
  step?: ReactNode
  /** One line about the current step only. */
  note?: ReactNode
  tools?: ReactNode
  play?: ReactNode
  foot?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ms-board canvas">
      <div className="ms-board-bar">
        <p className="ms-board-title">
          <span>{title}</span>
          {step !== undefined && step !== null ? <span className="ms-board-step">{step}</span> : null}
        </p>
        {tools ? <div className="ms-board-tools">{tools}</div> : null}
      </div>
      {note ? <p className="ms-board-note">{note}</p> : null}
      <div className="ms-scroll">{children}</div>
      {play}
      {foot ? <div className="ms-board-foot">{foot}</div> : null}
    </section>
  )
}

/** The one primary action inside the board: a Play pill and a quiet Next, both driving the stepper. */
export function PlayBar({ stepper, start, next }: { stepper: Stepper; start: string; next?: string }) {
  if (stepper.count < 2) return null
  const atEnd = stepper.index >= stepper.count - 1
  const label = stepper.playing ? 'Pause' : atEnd ? 'Play it again' : stepper.index === 0 ? start : 'Play from here'
  return (
    <div className="ms-board-play">
      <button type="button" className="ms-play" data-playing={stepper.playing} onClick={stepper.toggle}>
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
        <button type="button" className="ms-next" onClick={stepper.next}>
          {next ? `Next: ${next}` : 'Next step'}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

/** Steps in order: the current one bright with its explanation, the rest one line each. */
export function Story({ titles, index, onPick, body, label }: { titles: ReactNode[]; index: number; onPick: (i: number) => void; body: ReactNode; label: string }) {
  return (
    <aside className="ms-story" aria-label={label}>
      <ol className="ms-steps">
        {titles.map((t, i) => (
          <li key={i} className={i === index ? 'is-now' : i < index ? 'is-past' : 'is-next'}>
            <button type="button" className="ms-step-btn" onClick={() => onPick(i)} aria-current={i === index ? 'step' : undefined}>
              <span className="ms-step-dot" aria-hidden="true" />
              <span>{t}</span>
            </button>
            {i === index ? <div className="ms-step-body">{body}</div> : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}

/** An engine explanation as a short paragraph: the rule, the working, the page. */
export function StepNote({ e }: { e: Explain }) {
  return (
    <>
      <p className="ms-does">
        {e.rule} {e.cite ? <span className="ms-cite">{e.cite}</span> : null}
      </p>
      {e.working ? <p className="mono ms-wrap ms-working">{e.working}</p> : null}
    </>
  )
}

/** Secondary inputs, closed by default. Printing opens it (App). */
export function Options({ summary = 'Options', children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="ms-options">
      <summary>{summary}</summary>
      <div className="ms-options-body">{children}</div>
    </details>
  )
}

/** Secondary tables and notes: one tab strip under the board, one table visible at a time. Skips empty tabs. */
export function Details({ tabs }: { tabs: { value: string; label: string; body: ReactNode }[] }) {
  const [raw, setRaw] = useUrlState<string>('mt', '')
  const shown = tabs.filter((t) => t.body !== null && t.body !== undefined && t.body !== false)
  if (!shown.length) return null
  const cur = shown.find((t) => t.value === raw) ?? shown[0]
  return (
    <section className="ms-details" aria-label="Tables and notes">
      <Tabs label="Tables and notes" value={cur.value} onChange={setRaw} tabs={shown.map(({ value, label }) => ({ value, label }))} />
      <div className="ms-detail-body" role="tabpanel">
        {cur.body}
      </div>
    </section>
  )
}

/** Focus mode for the diagrams of every tab but the adder (which has its own "settled" toggle). */
export function FocusToggle() {
  const [fo, setFo] = useUrlState<boolean>('fo', false)
  return (
    <Toggle
      label="Show only what this step uses"
      checked={fo === true}
      onChange={setFo}
      hint="Hides the outputs, inputs and blocks the current row or step does not use. Off draws them faint."
    />
  )
}
