import type { ReactNode } from 'react'
import type { Explain } from '../../core/mips'
import { Why } from '../../ui/kit'

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
