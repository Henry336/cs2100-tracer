import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type Signal = 'path' | 'data' | 'control' | 'forward' | 'stall' | 'flush' | 'hit' | 'miss' | 'dirty' | 'dontcare'

/* ---------- Layout ---------- */

/**
 * Standard module page: title row, main workspace, optional inspector column, optional transport bar.
 * The inspector holds tables, explanations and "why" details; it stacks under the workspace on narrow screens.
 */
export function Workspace({
  title,
  lectures,
  intro,
  toolbar,
  children,
  inspector,
  transport,
}: {
  title: string
  /** Course references shown under the title, e.g. "L20 to L21, T10, R11". */
  lectures?: string
  intro?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  inspector?: ReactNode
  transport?: ReactNode
}) {
  const [more, setMore] = useState(false)
  return (
    <div className={`workspace${inspector ? ' has-inspector' : ''}${transport ? ' has-transport' : ''}`}>
      <header className="ws-head">
        <div className="ws-title">
          <h1>{title}</h1>
          {lectures ? <p className="ws-refs">{lectures}</p> : null}
        </div>
        <div className="ws-toolbar">
          {toolbar}
          <ExportPdfButton />
        </div>
        {intro ? (
          <div className={`ws-intro${more ? ' is-open' : ''}`}>
            {intro}
            <button type="button" className="ws-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              {more ? 'Less' : 'About this view'}
            </button>
          </div>
        ) : null}
      </header>
      <section className="ws-main" aria-label={`${title} workspace`}>
        {children}
      </section>
      {inspector ? (
        <aside className="ws-inspector" aria-label="Inspector">
          {inspector}
        </aside>
      ) : null}
      {transport ? <div className="ws-transport">{transport}</div> : null}
    </div>
  )
}

/**
 * Download the current view as a PDF, laid out by the print styles (no navigation or controls,
 * diagrams and explanations as they are at the current step). Falls back to the print dialog.
 */
export function ExportPdfButton({ label = 'Export PDF' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const { downloadPdf } = await import('../lib/export-pdf')
      await downloadPdf()
    } catch {
      window.print()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className="btn export-pdf" onClick={run} disabled={busy} title="Downloads this view as a PDF">
      {busy ? 'Making PDF' : label}
    </button>
  )
}

/** A titled block. `flush` removes inner padding (for tables/diagrams that draw their own edges). */
export function Panel({
  title,
  actions,
  children,
  flush,
  className,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section className={`panel${flush ? ' panel-flush' : ''}${className ? ` ${className}` : ''}`}>
      {title || actions ? (
        <header className="panel-head">
          {title ? <h2 className="panel-title">{title}</h2> : <span />}
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  )
}

/* ---------- Controls ---------- */

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <span className="control-label">{label}</span>
      <div className="segmented-track">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            title={o.title}
            className={`seg${o.value === value ? ' seg-on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <label className="toggle" htmlFor={id} title={hint}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  width,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  width?: string
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span className="control-label">{label}</span>
      <span className="field-box">
        <input
          id={id}
          className="mono"
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          style={width ? { width } : undefined}
          onChange={(e) => {
            const v = e.target.valueAsNumber
            if (Number.isFinite(v)) onChange(v)
          }}
        />
        {suffix ? <span className="field-suffix">{suffix}</span> : null}
      </span>
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono = true,
  width,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  width?: string
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span className="control-label">{label}</span>
      <span className="field-box">
        <input
          id={id}
          className={mono ? 'mono' : undefined}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          style={width ? { width } : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  )
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span className="control-label">{label}</span>
      <span className="field-box">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'plain',
  title,
  disabled,
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'plain' | 'primary'
  title?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button type="button" className={`btn btn-${variant}`} onClick={onClick} title={title} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  )
}

/**
 * A code/text editor with line numbers. `marks` highlights lines (0-based) with a signal colour,
 * e.g. the instruction currently executing.
 */
export function CodeEditor({
  label,
  value,
  onChange,
  rows = 12,
  marks,
  errors,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  marks?: Record<number, Signal>
  /** Line (0-based) to message. */
  errors?: Record<number, string>
}) {
  const id = useId()
  const gutterRef = useRef<HTMLDivElement>(null)
  const lines = value.split('\n')
  const count = Math.max(lines.length, rows)
  return (
    <div className="code-editor">
      <label htmlFor={id} className="control-label">
        {label}
      </label>
      <div className="code-frame" style={{ ['--rows' as string]: rows }}>
        <div className="code-gutter mono" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className={`code-ln${marks?.[i] ? ` ln-${marks[i]}` : ''}${errors?.[i] ? ' ln-error' : ''}`}
              title={errors?.[i]}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          id={id}
          className="code-text mono"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
          }}
        />
      </div>
      {errors && Object.keys(errors).length > 0 ? (
        <ul className="code-errors">
          {Object.entries(errors).map(([ln, msg]) => (
            <li key={ln}>
              <span className="mono">line {Number(ln) + 1}</span> {msg}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** A menu of named presets (course examples). Each preset says where it comes from. */
export function Presets<T>({
  presets,
  onPick,
  label = 'Load example',
  isCurrent,
}: {
  presets: { name: string; source?: string; value: T }[]
  onPick: (value: T, name: string) => void
  label?: string
  /** True for the preset the page holds now (e.g. after a past-paper link), so the menu shows it. */
  isCurrent?: (value: T) => boolean
}) {
  const id = useId()
  const cur = isCurrent ? presets.findIndex((p) => isCurrent(p.value)) : -1
  return (
    <label className="field presets" htmlFor={id}>
      <span className="control-label">{label}</span>
      <span className="field-box">
        <select
          id={id}
          value={cur >= 0 ? String(cur) : ''}
          onChange={(e) => {
            const p = presets[Number(e.target.value)]
            if (p) onPick(p.value, p.name)
          }}
        >
          <option value="" disabled>
            Choose…
          </option>
          {presets.map((p, i) => (
            <option key={i} value={i}>
              {p.name}
              {p.source ? ` (${p.source})` : ''}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}

/* ---------- Explanation ---------- */

/**
 * Wrap any computed value so a click reveals how it was derived: the rule, the working,
 * and the course reference. This is the main "aha" device of the app.
 */
export function Why({
  children,
  rule,
  working,
  cite,
}: {
  children: ReactNode
  rule: ReactNode
  working?: ReactNode
  cite?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      // Clicking Export PDF keeps the explanation open so it is printed.
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.('.export-pdf')) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span className="why" ref={ref}>
      <button type="button" className="why-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {children}
      </button>
      {open ? (
        <span className="why-pop" id={id} role="note">
          <span className="why-rule">{rule}</span>
          {working ? <span className="why-working mono">{working}</span> : null}
          {cite ? <span className="why-cite">{cite}</span> : null}
        </span>
      ) : null}
    </span>
  )
}

/** A course note or trap. `kind` decides the colour: note (neutral), trap (flush red), course (control violet). */
export function Callout({
  kind = 'note',
  title,
  children,
  cite,
}: {
  kind?: 'note' | 'trap' | 'course' | 'beyond'
  title?: string
  children: ReactNode
  cite?: string
}) {
  // Notes stay open; traps, course conventions and beyond-the-course asides fold to one line
  // so a page never opens on a wall of text. Printing opens them (see App).
  if (kind === 'note') {
    return (
      <div className={`callout callout-${kind}`}>
        {title ? <p className="callout-title">{title}</p> : null}
        <div className="callout-body">{children}</div>
        {cite ? <p className="callout-cite">{cite}</p> : null}
      </div>
    )
  }
  return (
    <details className={`callout callout-${kind}`}>
      <summary className="callout-title">
        <span className="callout-kind">{CALLOUT_KIND[kind]}</span>
        {title && title.toLowerCase() !== CALLOUT_KIND[kind].toLowerCase() ? <span>{title}</span> : null}
      </summary>
      <div className="callout-body">{children}</div>
      {cite ? <p className="callout-cite">{cite}</p> : null}
    </details>
  )
}

const CALLOUT_KIND = { note: 'Note', trap: 'Watch out', course: 'Course rule', beyond: 'Beyond the course' } as const

/* ---------- Signals ---------- */

export function Chip({ signal, children, title }: { signal: Signal; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip-${signal}`} title={title}>
      {children}
    </span>
  )
}

/** A compact legend explaining which colours this view uses. */
export function Legend({ items }: { items: { signal: Signal; label: string }[] }) {
  return (
    <ul className="legend" aria-label="Colour legend">
      {items.map((it) => (
        <li key={it.signal + it.label}>
          <span className={`swatch swatch-${it.signal}`} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

/* ---------- Tables ---------- */

export interface Column<R> {
  key: string
  header: ReactNode
  cell: (row: R, i: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  mono?: boolean
}

/** Dense data table. `rowSignal` colours a row (e.g. the active control-table row). */
export function DataTable<R>({
  columns,
  rows,
  rowSignal,
  caption,
  compact,
}: {
  columns: Column<R>[]
  rows: R[]
  rowSignal?: (row: R, i: number) => Signal | undefined
  caption?: ReactNode
  compact?: boolean
}) {
  return (
    <div className="table-wrap">
      <table className={`dtable${compact ? ' dtable-compact' : ''}`}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const sig = rowSignal?.(r, i)
            return (
              <tr key={i} className={sig ? `row-${sig}` : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.mono ? 'mono' : undefined} style={{ textAlign: c.align ?? 'left' }}>
                    {c.cell(r, i)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Tabs for switching between sub-tools inside one module. */
export function Tabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
}: {
  value: T
  tabs: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className={`tab${t.value === value ? ' tab-on' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
