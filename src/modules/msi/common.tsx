import { useMemo, type ReactNode } from 'react'
import { canonical, parseFunction, type BoolFunction, type Explain, type FunctionParse } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Chip, TextField, Why } from '../../ui/kit'

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
