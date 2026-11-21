// Array loop builder: a form kept in the URL, turned into an arrayLoopTrace spec, plus the thrash check.
import { arrayLoopTrace, parseNumber, type Access, type ArraySpec, type Geometry, type LoopStep, type PlacedArray, type Result } from '../../core/cache'

export interface LoopArray {
  name: string
  /** Base address as typed; blank means "right after the previous array". */
  base: string
  elem: number
  len: number
}

export interface LoopForm {
  arrays: LoopArray[]
  n: number
  /** 0 means every iteration runs the body. */
  mod: number
  /** Remainders of i mod `mod` that run the body, e.g. "0 1". */
  rem: string
  /** One iteration, in order: "R A[i], R B[i], W C[k]". */
  body: string
}

export const DEFAULT_LOOP: LoopForm = {
  arrays: [
    { name: 'A', base: '0xff000c00', elem: 4, len: 3200 },
    { name: 'B', base: '', elem: 4, len: 3200 },
  ],
  n: 3200,
  mod: 0,
  rem: '',
  body: 'R A[i], R B[i]',
}

/** URL state is any JSON: keep the shape, let loopTrace report bad values. */
export function normLoop(raw: unknown): LoopForm {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_LOOP
  const r = raw as Partial<Record<keyof LoopForm, unknown>>
  const arrays = Array.isArray(r.arrays)
    ? r.arrays.slice(0, 8).map((a: Partial<Record<keyof LoopArray, unknown>> | null) => ({
        name: typeof a?.name === 'string' ? a.name : '',
        base: typeof a?.base === 'string' ? a.base : '',
        elem: Number(a?.elem),
        len: Number(a?.len),
      }))
    : DEFAULT_LOOP.arrays
  return {
    arrays,
    n: Number(r.n ?? DEFAULT_LOOP.n),
    mod: Number(r.mod ?? 0),
    rem: typeof r.rem === 'string' ? r.rem : '',
    body: typeof r.body === 'string' ? r.body : DEFAULT_LOOP.body,
  }
}

// R A[i], W C[k], lw B[2i+1], A[3]. The op needs a space so a name like RA is not read as R A.
const STEP = /^(?:(lw|sw|r|w)\s+)?([a-z_]\w*)\s*\[\s*(\d+)?\s*\*?\s*([ik])?\s*(?:\+\s*(\d+))?\s*\]$/i

export function parseBody(body: string): Result<LoopStep[]> {
  const steps: LoopStep[] = []
  const errors: string[] = []
  body
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s, k) => {
      const m = STEP.exec(s)
      if (!m || (m[3] === undefined && m[4] === undefined && m[5] === undefined)) {
        errors.push(`Access ${k + 1} ("${s}"): write it as R A[i] or W C[k], with an index such as i, k, 2i, i+1 or 3.`)
        return
      }
      const [, op, array, num, v, plus] = m
      const kind = op && /^(w|sw)$/i.test(op) ? 'write' : 'read'
      steps.push(
        v
          ? { array, kind, index: v.toLowerCase() as 'i' | 'k', scale: num === undefined ? 1 : Number(num), offset: Number(plus ?? 0) }
          : { array, kind, scale: 0, offset: Number(num ?? 0) + Number(plus ?? 0) },
      )
    })
  if (!errors.length && !steps.length) errors.push('Write the accesses of one iteration, such as R A[i], R B[i].')
  return errors.length ? { ok: false, errors } : { ok: true, value: steps }
}

export interface LoopRun {
  accesses: Access[]
  arrays: PlacedArray[]
  steps: LoopStep[]
}

export function loopTrace(f: LoopForm): Result<LoopRun> {
  const body = parseBody(f.body)
  const errors: string[] = body.ok ? [] : [...body.errors]
  const arrays: ArraySpec[] = []
  const seen = new Set<string>()
  f.arrays.forEach((a, k) => {
    const name = a.name.trim()
    if (!/^[a-z_]\w*$/i.test(name)) errors.push(`Array ${k + 1}: give it a C name such as A.`)
    else if (seen.has(name)) errors.push(`Array ${name} is listed twice.`)
    seen.add(name)
    const t = a.base.trim()
    const base = t ? parseNumber(t) : undefined
    if (base === null) errors.push(`Array ${name || k + 1}: cannot read the base address "${t}". Use decimal or 0x hex.`)
    arrays.push({ name, elemBytes: a.elem, length: a.len, ...(base !== undefined && base !== null ? { base } : {}) })
  })
  let when: { mod: number; in: number[] } | undefined
  if (f.mod) {
    const rems = f.rem.split(/[^0-9]+/).filter(Boolean).map(Number)
    if (!rems.length) errors.push(`List which values of i mod ${f.mod} run the body, such as 0 1.`)
    when = { mod: f.mod, in: rems }
  }
  if (errors.length || !body.ok) return { ok: false, errors }
  const steps = body.value.map((s) => ({ ...s, conditional: when !== undefined }))
  const r = arrayLoopTrace({ arrays, iterations: f.n, steps, when })
  return r.ok ? { ok: true, value: { ...r.value, steps } } : r
}

export const loopAccesses = (f: LoopForm): Result<Access[]> => {
  const r = loopTrace(f)
  return r.ok ? { ok: true, value: r.value.accesses } : r
}

export interface Collision {
  arrays: string[]
  /** Set of the first access of the group. */
  set: number
  /** More arrays share the set than it has ways, so with LRU or FIFO each access evicts the next one's block. */
  thrash: boolean
  /** Bytes one way covers: sets x block size. */
  span: number
}

/**
 * Arrays whose accesses land in the same set on every iteration: same index variable and byte stride, and start
 * addresses a multiple of sets x block bytes apart (AY20/21 Q15, AY23/24 S2 Q18).
 * shortcut: only exact lockstep collisions are found, not partial overlaps; enough for the exam loops.
 */
export function collisions(g: Geometry, run: LoopRun): Collision[] {
  const span = g.sets * g.config.blockBytes
  const byName = new Map(run.arrays.map((a) => [a.name, a]))
  const groups = new Map<string, { names: string[]; start: number }>()
  for (const s of run.steps) {
    const a = byName.get(s.array)
    if (!a || s.scale === 0) continue
    const start = a.base + (s.offset ?? 0) * a.elemBytes
    const key = `${s.index ?? 'i'}|${(s.scale ?? 1) * a.elemBytes}|${start % span}`
    const grp = groups.get(key) ?? { names: [], start }
    if (!grp.names.includes(a.name)) grp.names.push(a.name)
    groups.set(key, grp)
  }
  return [...groups.values()]
    .filter((x) => x.names.length > 1)
    .map((x) => ({ arrays: x.names, set: Math.floor(x.start / g.config.blockBytes) % g.sets, thrash: x.names.length > g.ways, span }))
}
