import type { ReactNode } from 'react'
import type { Explain, Issue, Sig } from '../../core/sequential'
import { Why } from '../../ui/kit'

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
