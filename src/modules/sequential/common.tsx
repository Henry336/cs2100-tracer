import { useState, type ReactNode } from 'react'
import type { Explain, Issue, Sig } from '../../core/sequential'
import { Tabs, Why } from '../../ui/kit'
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

export const bool = (raw: unknown, fallback: boolean): boolean => (typeof raw === 'boolean' ? raw : fallback)

export const splitNames = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** A list of state numbers such as '2, 3, 5-7'. Returns null for an empty field. */
export function parseStates(s: string): { states: number[] | null; error?: string } {
  if (!s.trim()) return { states: null }
  const out = new Set<number>()
  for (const tok of s.split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(tok)
    if (!m) return { states: null, error: `'${tok}' is not a state number or a range such as 2-5` }
    const a = Number(m[1])
    const b = m[2] === undefined ? a : Number(m[2])
    for (let k = Math.min(a, b); k <= Math.max(a, b); k++) out.add(k)
  }
  return { states: [...out].sort((a, b) => a - b) }
}

/** A Sig printed for a cell: X stays X. */
export const sig = (v: Sig) => String(v)

/** Value cell: 1, 0 or X, with X drawn quiet. The digit is always printed, so colour is never the only signal. */
export function Bitv({ v, e }: { v: Sig; e?: Explain }) {
  const cls = v === 'X' ? 'seq-v seq-vx' : v === 1 ? 'seq-v seq-v1' : 'seq-v'
  return (
    <span className={cls}>
      <W e={e}>{sig(v)}</W>
    </span>
  )
}

/** Parse errors with their line numbers. */
export function Issues({ issues, kind = 'error' }: { issues: Issue[]; kind?: 'error' | 'warning' }) {
  if (!issues.length) return null
  return (
    <ul className={`seq-issues seq-issues-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {issues.map((i, k) => (
        <li key={k}>
          {i.message}
          {i.cite ? <span className="seq-cite"> ({i.cite})</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** Issues keyed by 0-based line for CodeEditor. */
export const lineErrors = (issues: Issue[]): Record<number, string> => {
  const out: Record<number, string> = {}
  for (const i of issues) if (i.line) out[i.line - 1] = out[i.line - 1] ? `${out[i.line - 1]}; ${i.message}` : i.message
  return out
}

/** One bit as a pressable switch. The value is printed, so colour is never the only signal. */
export function BitToggle({ label, value, onChange, title }: { label: ReactNode; value: 0 | 1; onChange: (v: 0 | 1) => void; title?: string }) {
  return (
    <button type="button" className={`seq-bit${value ? ' is-1' : ''}`} aria-pressed={value === 1} title={title} onClick={() => onChange(value ? 0 : 1)}>
      <span className="seq-bit-name">{label}</span>
      <span className="seq-bit-val mono">{value}</span>
    </button>
  )
}

/** Horizontal scroller for wide diagrams and tables. */
export function Scroll({ children, label }: { children: ReactNode; label?: string }) {
  return (
    // A scroll region must be focusable so keyboard users can scroll it.
    <div className="seq-scroll" tabIndex={0} role="region" aria-label={label ?? 'Scrollable diagram'}>
      {children}
    </div>
  )
}

/** Parse `label = expression` lines (your own equations) into a map. */
export function parseOverrides(src: string): { map: Record<string, string>; bad: string[] } {
  const map: Record<string, string> = {}
  const bad: string[] = []
  src.split(/\n|;/).forEach((line, i) => {
    if (!line.trim()) return
    const eq = line.indexOf('=')
    const label = eq < 0 ? '' : line.slice(0, eq).trim().replace(/\s+/g, '')
    if (eq < 0 || !/^[A-Za-z][A-Za-z0-9]*$/.test(label)) bad.push(`line ${i + 1}: write it as JA = B ⊕ x`)
    else map[label] = line.slice(eq + 1).trim()
  })
  return { map, bad }
}

/* ---------- Calm layout (docs/design.md): board with Play inside, story beside, one tab strip below ---------- */

/** The dot-grid board the picture sits on: a title bar, the picture, the play row, a legend foot. */
export function Board({ title, step, actions, children, play, foot }: { title: ReactNode; step?: ReactNode; actions?: ReactNode; children: ReactNode; play?: ReactNode; foot?: ReactNode }) {
  return (
    <div className="seq-board canvas">
      <div className="seq-board-bar">
        <p className="seq-board-title">
          <span>{title}</span>
          {step !== undefined && step !== null ? <span className="seq-board-step">{step}</span> : null}
        </p>
        {actions ? <div className="seq-board-actions">{actions}</div> : null}
      </div>
      <div className="seq-board-body">{children}</div>
      {play}
      {foot ? <div className="seq-board-foot">{foot}</div> : null}
    </div>
  )
}

/** The Play pill and a quiet Next button inside the board; both drive the same stepper as the bottom player. */
export function PlayBar({ stepper, label, next }: { stepper: Stepper; label: string; next?: string }) {
  if (stepper.count < 2) return null
  const atEnd = stepper.index >= stepper.count - 1
  const text = stepper.playing ? 'Pause' : atEnd ? 'Play it again' : stepper.index === 0 ? label : 'Play from here'
  return (
    <div className="seq-board-play">
      <button type="button" className="seq-play" onClick={stepper.toggle} data-playing={stepper.playing}>
        {stepper.playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8l9 5.2-9 5.2z" /></svg>
        )}
        {text}
      </button>
      {!atEnd ? (
        <button type="button" className="seq-next" onClick={stepper.next}>
          {next ?? 'Next'}
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </button>
      ) : null}
    </div>
  )
}

export interface StoryItem {
  title: ReactNode
  state: 'now' | 'past' | 'next'
  onPick?: () => void
}

/** The step story beside the board: only the current step is narrated, the others stay one-line titles. */
export function Story({ items, children, tip }: { items?: StoryItem[]; children: ReactNode; tip?: ReactNode }) {
  return (
    <aside className="seq-story" aria-label="What happens at this step">
      {items ? (
        <ol className="seq-story-steps">
          {items.map((it, i) => (
            <li key={i} className={`is-${it.state}`}>
              {it.onPick ? (
                <button type="button" className="seq-story-btn" onClick={it.onPick} aria-current={it.state === 'now' ? 'step' : undefined}>
                  <span className="seq-story-dot" aria-hidden="true" />
                  <span>{it.title}</span>
                </button>
              ) : (
                <span className="seq-story-btn">
                  <span className="seq-story-dot" aria-hidden="true" />
                  <span>{it.title}</span>
                </span>
              )}
              {it.state === 'now' ? <div className="seq-story-body">{children}</div> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="seq-story-body">{children}</div>
      )}
      {tip ? <p className="seq-tip">{tip}</p> : null}
    </aside>
  )
}

/** An engine explanation as narration: the rule, the working, the slide. */
export function Narrate({ e, head }: { e: Explain; head?: ReactNode }) {
  return (
    <div className="seq-explain">
      {head ? <p className="seq-explain-head">{head}</p> : null}
      <p>{e.rule}</p>
      {e.working ? <p className="mono seq-working">{e.working}</p> : null}
      {e.cite ? <p className="seq-cite">{e.cite}</p> : null}
    </div>
  )
}

/** Secondary inputs, closed by default. `whenClosed` shows only while it is folded (errors stay visible). */
export function Fold({ summary, children, whenClosed }: { summary: ReactNode; children: ReactNode; whenClosed?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <details className="seq-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>{summary}</summary>
        <div className="seq-fold-body">{children}</div>
      </details>
      {open ? null : whenClosed}
    </>
  )
}

/**
 * One tab strip for the secondary tables. Every panel is rendered so printing shows them all (sequential.css);
 * on screen only the chosen one is visible. A chosen tab that is not offered right now falls back to the first.
 */
export function TabStrip<T extends string>({ label, value, onChange, tabs }: { label: string; value: unknown; onChange: (v: T) => void; tabs: { value: T; label: string; body: ReactNode }[] }) {
  if (!tabs.length) return null
  const cur = tabs.some((t) => t.value === value) ? (value as T) : tabs[0].value
  return (
    <section className="seq-details" aria-label={label}>
      <Tabs label={label} value={cur} onChange={onChange} tabs={tabs.map((t) => ({ value: t.value, label: t.label }))} />
      {tabs.map((t) => (
        <div key={t.value} className="seq-detail-body" role="tabpanel" aria-label={t.label} data-label={t.label} hidden={t.value !== cur}>
          {t.body}
        </div>
      ))}
    </section>
  )
}
