import type { ReactNode } from 'react'
import type { Explain } from '../../core/mips'
import { Why } from '../../ui/kit'
import type { Stepper } from '../../ui/stepper'

/** A value whose derivation is one engine Explain. */
export function W({ e, children }: { e: Explain; children: ReactNode }) {
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

/** Numbered working, one Explain per line. */
export function Steps({ steps, label }: { steps: Explain[]; label: string }) {
  return (
    <ol className="mp-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i}>
          <span className="mp-step-rule">{s.rule}</span>
          {s.working ? <span className="mp-step-work mono">{s.working}</span> : null}
          {s.cite ? <span className="mp-step-cite">{s.cite}</span> : null}
        </li>
      ))}
    </ol>
  )
}

/** Label and value pairs in a dense two-column grid. */
export function Facts({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="mp-facts">
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd className="mono">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Parse an address field: decimal, 0x hex or 0b binary. */
export function parseAddress(s: string): number | undefined {
  const m = /^\s*(0x[0-9a-f]+|0b[01]+|\d+)\s*$/i.exec(s)
  if (!m) return undefined
  const v = Number(m[1])
  return v <= 0xffffffff ? v : undefined
}

/** The primary action inside a board: a labelled Play pill and a quiet Next button, both driving the page stepper. */
export function BoardPlay({ stepper, start, next }: { stepper: Stepper; start: string; next: string }) {
  const atEnd = stepper.index >= stepper.count - 1
  const label = stepper.playing ? 'Pause' : atEnd ? 'Run it again' : stepper.index === 0 ? start : 'Play from here'
  return (
    <div className="mp-board-play">
      <button type="button" className="mp-play" onClick={stepper.toggle} data-playing={stepper.playing}>
        {stepper.playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8l9 5.2-9 5.2z" /></svg>
        )}
        {label}
      </button>
      {!atEnd ? (
        <button type="button" className="mp-next" onClick={stepper.next}>
          {next}
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </button>
      ) : null}
    </div>
  )
}

/** Light along the paths that carry a value now: they draw in, then packets travel. Keyed so it restarts when `k` changes. */
export function Flow({ k, paths }: { k: string | number; paths: string[] }) {
  if (!paths.length) return null
  return (
    <>
      <g className="flow-draw" key={`d${k}`} aria-hidden="true">
        {paths.map((d, i) => <path key={i} d={d} pathLength={1} />)}
      </g>
      <g className="flow-packets" key={`p${k}`} aria-hidden="true">
        {paths.map((d, i) => <path key={i} d={d} pathLength={1} style={{ animationDelay: `${0.7 + (i % 4) * 0.2}s` }} />)}
      </g>
    </>
  )
}
