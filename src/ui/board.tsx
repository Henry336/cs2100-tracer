// The calm page layout shared by every module (docs/design.md):
// a command bar, a dot-grid board with the player inside it, a story that opens only the
// current step, folded options, and one tab strip for secondary tables.
// Styles live in src/styles/shell.css under the same class names.
import type { ReactNode } from 'react'
import { useUrlState } from '../lib/url-state'
import { Tabs } from './kit'
import type { Stepper } from './stepper'

/** Light on the paths that carry a value in this step: they draw in from their source, then packets travel. Change `id` to restart it. */
export function Flow({ id, paths, tone }: { id: string | number; paths: string[]; tone?: 'ctl' | 'data' | 'fwd' | 'dirty' | 'miss' }) {
  if (!paths.length) return null
  return (
    <>
      <g className="flow-draw" key={`d${id}`} aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} className={tone} />
        ))}
      </g>
      <g className="flow-packets" key={`p${id}`} aria-hidden="true">
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} className={tone} style={{ animationDelay: `${0.7 + (i % 5) * 0.18}s` }} />
        ))}
      </g>
    </>
  )
}

/** One-line input with the glow ring, e.g. an instruction or a Boolean function. */
export function CommandBar({
  id,
  label,
  value,
  onChange,
  placeholder,
  aside,
  mono = true,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Something short after the input, like the assembled word. */
  aside?: ReactNode
  mono?: boolean
}) {
  return (
    <div className="command-bar glow-input">
      <label className="command-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`command-input${mono ? ' mono' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {aside ? <span className="command-aside">{aside}</span> : null}
    </div>
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
  className,
  label,
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
  className?: string
  /** Name for screen readers when the title is not plain text. */
  label?: string
}) {
  return (
    <section className={`board canvas${className ? ` ${className}` : ''}`} aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
      <div className="board-bar">
        <p className="board-title">
          <span>{title}</span>
          {step !== undefined && step !== null && step !== false ? <span className="board-step">{step}</span> : null}
        </p>
        {tools ? <div className="board-tools">{tools}</div> : null}
      </div>
      {note ? <p className="board-note">{note}</p> : null}
      <div className="board-scroll">{children}</div>
      {play}
      {foot ? <div className="board-foot">{foot}</div> : null}
    </section>
  )
}

const PlayIcon = ({ playing }: { playing: boolean }) =>
  playing ? (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 3h3v10H4zM9 3h3v10H9z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.8l9 5.2-9 5.2z" />
    </svg>
  )

/**
 * The one primary action inside a board: a Play pill and a quiet Next, both driving the stepper.
 * `start` names what Play does from step 1 ("Trace this instruction"); `next` names the next step.
 */
export function PlayBar({ stepper, start, next }: { stepper: Stepper; start: string; next?: string | ((i: number) => string) }) {
  if (stepper.count < 2) return null
  const atEnd = stepper.index >= stepper.count - 1
  const label = stepper.playing ? 'Pause' : atEnd ? 'Play it again' : stepper.index === 0 ? start : 'Play from here'
  const nextLabel = typeof next === 'function' ? next(stepper.index + 1) : next
  const play = () => {
    if (!stepper.playing && atEnd) stepper.first()
    stepper.toggle()
  }
  return (
    <div className="board-play">
      <button type="button" className="play-pill" data-playing={stepper.playing} onClick={play}>
        <PlayIcon playing={stepper.playing} />
        {label}
      </button>
      {!atEnd ? (
        <button type="button" className="next-pill" onClick={stepper.next}>
          {nextLabel ? `Next: ${nextLabel}` : 'Next step'}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

/** A primary pill that is not a player, e.g. "Check my answers". */
export function PrimaryPill({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="play-pill" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

/** Steps in order: the current one bright with its explanation, the rest one line each. */
export function Story({
  titles,
  index,
  onPick,
  body,
  label,
  aside,
}: {
  titles: ReactNode[]
  index: number
  onPick: (i: number) => void
  body: ReactNode
  label: string
  /** Extra lines under a step title, e.g. "idle". */
  aside?: (i: number) => ReactNode
  }) {
  return (
    <aside className="story" aria-label={label}>
      <ol className="story-steps">
        {titles.map((t, i) => (
          <li key={i} className={i === index ? 'is-now' : i < index ? 'is-past' : 'is-next'}>
            <button type="button" className="story-btn" onClick={() => onPick(i)} aria-current={i === index ? 'step' : undefined}>
              <span className="story-dot" aria-hidden="true" />
              <span>{t}</span>
              {aside?.(i)}
            </button>
            {i === index ? <div className="story-body">{body}</div> : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}

/** Board on the left, story on the right (stacked on narrow screens). */
export function Stage({ children }: { children: ReactNode }) {
  return <div className="stage">{children}</div>
}

/** Secondary inputs, closed by default. Printing opens it (App). */
export function Options({ summary = 'Options', children, open }: { summary?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="options" open={open}>
      <summary>{summary}</summary>
      <div className="options-body">{children}</div>
    </details>
  )
}

/** Secondary tables and notes: one tab strip under the board, one visible at a time, the open tab kept in the URL. Empty tabs are skipped. */
export function Details({ tabs, urlKey = 'dt', label = 'Tables and notes' }: { tabs: { value: string; label: string; body: ReactNode }[]; urlKey?: string; label?: string }) {
  const [raw, setRaw] = useUrlState<string>(urlKey, '')
  const shown = tabs.filter((t) => t.body !== null && t.body !== undefined && t.body !== false)
  if (!shown.length) return null
  const cur = shown.find((t) => t.value === raw) ?? shown[0]
  return (
    <section className="details" aria-label={label}>
      <Tabs label={label} value={cur.value} onChange={setRaw} tabs={shown.map(({ value, label: l }) => ({ value, label: l }))} />
      <div className="detail-body" role="tabpanel">
        {cur.body}
      </div>
    </section>
  )
}
