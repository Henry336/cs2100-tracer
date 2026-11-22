import { useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import {
  bin,
  fmtBytes,
  geometry,
  hex,
  isPow2,
  linesByAddress,
  parseAccesses,
  simulate,
  type Access,
  type AddressSplit,
  type Explain,
  type Frame,
  type Geometry,
  type LineSnapshot,
  type Result,
  type SetSnapshot,
  type Trace,
} from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, CodeEditor, NumberField, Presets, Segmented, Select, TextField, Toggle, Why } from '../../ui/kit'
import { Flow, Options } from '../../ui/board'
import { DEFAULT_LOOP, collisions, loopTrace, normLoop, type LoopForm, type LoopRun } from './loop'
import { DEFAULT_CFG, PRESET_BY_ID, TRACE_PRESETS, normCfg, toConfig, toText, type Cfg, type TracePreset } from './presets'

/* ---------- Small helpers ---------- */

/** A value whose derivation is one engine Explain. */
export function W({ e, children }: { e?: Explain; children: ReactNode }) {
  if (!e) return <>{children}</>
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

export type TagFmt = 'dec' | 'hex' | 'bin'

export const fmtTag = (n: number | null, width: number, tf: TagFmt): string =>
  n === null ? '-' : tf === 'hex' ? hex(n, 8) : tf === 'bin' ? bin(n, width) || '0' : String(n)

/** Memory word name as the slides write it: M[24], or M[0x1020] for larger addresses. */
export const mem = (a: number): string => (a < 4096 ? `M[${a}]` : `M[0x${a.toString(16)}]`)

export const fmtAddr = (a: number): string => (a < 4096 ? String(a) : hex(a))

export const accessText = (a: Access): string => `${a.kind === 'write' ? 'W' : 'R'} ${a.label ?? fmtAddr(a.address)}`

export const pow2Options = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => 2 ** (from + i)).map((v) => ({ value: String(v), label: fmtBytes(v) }))

/** Running count of frames where pick(f) is true, one entry per frame. */
export function cumulative(frames: Frame[], pick: (f: Frame) => number): Int32Array {
  const out = new Int32Array(frames.length)
  let n = 0
  frames.forEach((f, i) => {
    n += pick(f)
    out[i] = n
  })
  return out
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

export function Errors({ list }: { list: string[] }) {
  if (!list.length) return null
  return (
    <ul className="ca-errors" role="alert">
      {list.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  )
}

/* ---------- Shared input: config and trace, kept in the URL ---------- */

export interface Input {
  cfg: Cfg
  setCfg: (next: Cfg) => void
  text: string
  setText: (t: string) => void
  preset: TracePreset | undefined
  /** Where the accesses come from: typed text, a generated preset, or the array loop builder. */
  mode: 'text' | 'gen' | 'loop'
  loop: LoopForm
  setLoop: (f: LoopForm) => void
  /** The built loop, when mode is 'loop' and it builds. */
  loopRun: LoopRun | undefined
  buildLoop: () => void
  /** Accesses that parsed (or the generated loop). */
  accesses: Access[]
  /** Editor errors by 0-based line. */
  lineErrors: Record<number, string>
  genErrors: string[]
  loaded: TracePreset | undefined
  load: (p: TracePreset) => void
  toEditor: () => void
  /** Leave the generated loop and go back to the typed trace. */
  clearGen: () => void
}

const DEFAULT_TEXT = TRACE_PRESETS[0].text ?? ''

export function useInput(): Input {
  const [rawCfg, setRawCfg] = useUrlState<unknown>('c', DEFAULT_CFG)
  const [rawText, setText] = useUrlState<unknown>('t', DEFAULT_TEXT)
  const [rawGen, setGen] = useUrlState<unknown>('g', '')
  const [rawLoaded, setLoaded] = useUrlState<unknown>('p', TRACE_PRESETS[0].id)
  const [rawLoop, setRawLoop] = useUrlState<unknown>('lp', DEFAULT_LOOP)
  const cfg = useMemo(() => normCfg(rawCfg), [rawCfg])
  const loop = useMemo(() => normLoop(rawLoop), [rawLoop])
  const looping = rawGen === 'loop'
  const text = typeof rawText === 'string' ? rawText : ''
  const preset = typeof rawGen === 'string' ? PRESET_BY_ID.get(rawGen) : undefined
  const generated = preset?.gen
  const loaded = typeof rawLoaded === 'string' ? PRESET_BY_ID.get(rawLoaded) : undefined

  const parsed = useMemo(() => {
    if (looping) {
      const r = loopTrace(loop)
      return { accesses: r.ok ? r.value.accesses : [], lineErrors: {}, genErrors: r.ok ? [] : r.errors, loopRun: r.ok ? r.value : undefined }
    }
    if (generated) {
      const r = generated()
      return { accesses: r.ok ? r.value : [], lineErrors: {}, genErrors: r.ok ? [] : r.errors }
    }
    const p = parseAccesses(text)
    const lineErrors: Record<number, string> = {}
    for (const e of p.errors) lineErrors[e.line - 1] = e.message.replace(/^line \d+: /, '')
    return { accesses: p.accesses, lineErrors, genErrors: [] as string[] }
  }, [looping, loop, generated, text])

  return {
    cfg,
    setCfg: (next) => setRawCfg(next),
    text,
    setText: (t) => {
      setText(t)
      setLoaded('')
    },
    preset: generated ? preset : undefined,
    mode: looping ? 'loop' : generated ? 'gen' : 'text',
    loop,
    setLoop: (f) => {
      setRawLoop(f)
      setLoaded('')
    },
    buildLoop: () => {
      setGen('loop')
      setLoaded('')
    },
    loopRun: undefined,
    ...parsed,
    loaded,
    load: (p) => {
      setRawCfg({ ...DEFAULT_CFG, ...p.cfg })
      setLoaded(p.id)
      if (p.loop) {
        setRawLoop(p.loop)
        setGen('loop')
      } else if (p.gen) setGen(p.id)
      else {
        setGen('')
        setText(p.text ?? '')
      }
    },
    toEditor: () => {
      setText(toText(parsed.accesses))
      setGen('')
      setLoaded('')
    },
    clearGen: () => {
      setGen('')
      setLoaded('')
    },
  }
}

/** Run the shared trace on the shared config, with optional overrides (other ways, other policies). */
export function useSim(input: Input, override?: Partial<Cfg>): Result<Trace> {
  const key = JSON.stringify(override ?? {})
  return useMemo(
    () => simulate(toConfig({ ...input.cfg, ...override }), input.accesses),
    [input.cfg, input.accesses, key], // eslint-disable-line react-hooks/exhaustive-deps
  )
}

/* ---------- Config bar ---------- */

const CACHE_SIZES = pow2Options(2, 26)
const BLOCK_SIZES = pow2Options(0, 12)
const WORD_SIZES = [1, 2, 4, 8].map((v) => ({ value: String(v), label: fmtBytes(v) }))

export function waysOptions(blocks: number, max = 16): { value: number | 'full'; label: string; title?: string }[] {
  const out: { value: number | 'full'; label: string; title?: string }[] = [{ value: 1, label: 'DM', title: 'Direct mapped (1-way)' }]
  for (let w = 2; w < blocks && w <= max; w *= 2) out.push({ value: w, label: `${w}-way` })
  if (blocks > 1) out.push({ value: 'full', label: 'FA', title: 'Fully associative (one set)' })
  return out
}

/** Apply a config change, keeping the associativity valid when the size shrinks under it. */
export function patchCfg(cfg: Cfg, patch: Partial<Cfg>): Cfg {
  const next = { ...cfg, ...patch }
  const b = next.cache / next.block
  if (typeof next.ways === 'number' && next.ways > 1 && next.ways >= b) next.ways = b > 1 ? 'full' : 1
  return next
}

const blocksOf = (cfg: Cfg) => (isPow2(cfg.cache) && isPow2(cfg.block) ? Math.max(1, cfg.cache / cfg.block) : 1)

/** A small labelled select for the one-line command bar. */
export function BarSelect({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="ca-bar-field">
      <span className="ca-bar-label">{label}</span>
      <select aria-label={name} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The one-line cache picker above the board: size, block size and (optionally) associativity. */
export function CacheBar({ input, ways = true }: { input: Input; ways?: boolean }) {
  const { cfg, setCfg } = input
  const set = (patch: Partial<Cfg>) => setCfg(patchCfg(cfg, patch))
  const bad = Object.keys(input.lineErrors).length > 0 || input.genErrors.length > 0
  return (
    <div className="command-bar glow-input ca-selects">
      <span className="command-label">Cache</span>
      <BarSelect label="Size" name="Cache size" value={String(cfg.cache)} options={CACHE_SIZES} onChange={(v) => set({ cache: Number(v) })} />
      <BarSelect label="Blocks of" name="Block size" value={String(cfg.block)} options={BLOCK_SIZES} onChange={(v) => set({ block: Number(v) })} />
      {ways ? (
        <BarSelect
          label="Ways"
          name="Associativity"
          value={String(cfg.ways)}
          options={waysOptions(blocksOf(cfg)).map((o) => ({ value: String(o.value), label: o.value === 1 ? 'Direct mapped' : o.value === 'full' ? 'Fully associative' : o.label }))}
          onChange={(v) => set({ ways: v === 'full' ? 'full' : Number(v) })}
        />
      ) : null}
      <span className={`command-aside${bad ? ' ca-bad' : ''}`}>{bad ? 'trace has errors' : plural(input.accesses.length, 'access', 'accesses')}</span>
    </div>
  )
}

/** Everything else (the trace text, word size, policies) folds into one disclosure, closed unless the trace has errors. */
export function Setup({ input, config, rows }: { input: Input; config: ReactNode; rows?: number }) {
  const bad = Object.keys(input.lineErrors).length > 0 || input.genErrors.length > 0
  return (
    <Options summary="Edit the trace and options" open={bad || undefined}>
      <div className="ca-setup">
        <section>
          <h3 className="ca-h">Trace</h3>
          <TraceEditor input={input} rows={rows} />
        </section>
        <section>
          <h3 className="ca-h">More options</h3>
          {config}
        </section>
      </div>
    </Options>
  )
}

/* ---------- Light along the lookup and the line fill ---------- */

interface Wire {
  id: string
  d: string
  tone?: 'data' | 'dirty'
}

/**
 * Wires drawn over an HTML board: address field to the set it selects, memory to the line being filled,
 * the line back to memory on a write. Anchors are data-wire attributes inside the board.
 * shortcut: re-measures on board resize and step change only, not on a sideways scroll of the table.
 */
export function BoardWires({
  board,
  step,
  read,
  write,
  layout = '',
}: {
  board: RefObject<HTMLDivElement | null>
  step: number
  read: boolean
  write: boolean
  /** Anything that can move the anchors without resizing the board (tag format, way order). */
  layout?: string
}) {
  const [box, setBox] = useState<{ w: number; h: number; wires: Wire[] } | null>(null)
  useLayoutEffect(() => {
    const el = board.current
    if (!el) return
    const measure = () => {
      const b = el.getBoundingClientRect()
      const r = (s: string) => el.querySelector(`[data-wire="${s}"]`)?.getBoundingClientRect()
      const src = r('src')
      const row = r('row')
      const wrap = r('table')
      const memo = r('mem')
      const wires: Wire[] = []
      if (row && wrap) {
        const ry = row.top + row.height / 2 - b.top
        const left = wrap.left - b.left
        const right = Math.min(row.right, wrap.right) - b.left
        if (src) {
          const sx = Math.min(Math.max(src.left + src.width / 2, b.left + 8), b.right - 8) - b.left
          const sy = src.bottom - b.top
          wires.push({ id: 'look', d: `M${sx} ${sy} V${sy + 10} H${left - 10} V${ry} H${left + 4}`, })
        }
        if (memo) {
          const mx = memo.left + memo.width / 2 - b.left
          const my = memo.bottom - b.top
          if (read) wires.push({ id: 'read', d: `M${mx} ${my} V${my + 10} H${right + 10} V${ry} H${right - 4}`, tone: 'data' })
          if (write) wires.push({ id: 'write', d: `M${right - 4} ${ry + 4} H${right + 16} V${my + 16} H${mx + 6} V${my}`, tone: 'dirty' })
        }
      }
      setBox({ w: b.width, h: b.height, wires })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [board, step, read, write, layout])
  if (!box || !box.wires.length) return null
  return (
    <svg className="ca-wires" width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
      {/* One Flow per tone: the lookup in the path colour, the block read as data, the write as write traffic. */}
      {([undefined, 'data', 'dirty'] as const).map((tone) => (
        <Flow key={tone ?? 'path'} id={step} tone={tone} paths={box.wires.filter((w) => w.tone === tone).map((w) => w.d)} />
      ))}
    </svg>
  )
}

export function ConfigBar({
  cfg,
  setCfg,
  ways = true,
  writePolicies = true,
  core = true,
}: {
  cfg: Cfg
  setCfg: (c: Cfg) => void
  ways?: boolean
  writePolicies?: boolean
  /** false leaves out cache size, block size and associativity, which the command bar already shows. */
  core?: boolean
}) {
  const blocks = blocksOf(cfg)
  const set = (patch: Partial<Cfg>) => setCfg(patchCfg(cfg, patch))
  return (
    <div className="ca-config">
      {core ? <Select label="Cache size" value={String(cfg.cache)} options={CACHE_SIZES} onChange={(v) => set({ cache: Number(v) })} /> : null}
      {core ? <Select label="Block size" value={String(cfg.block)} options={BLOCK_SIZES} onChange={(v) => set({ block: Number(v) })} /> : null}
      <Select label="Word size" value={String(cfg.word)} options={WORD_SIZES} onChange={(v) => set({ word: Number(v) })} />
      <NumberField label="Address" value={cfg.addr} min={1} max={48} suffix="bits" width="4em" onChange={(v) => set({ addr: v })} />
      {ways && core ? <Segmented label="Associativity" value={cfg.ways} options={waysOptions(blocks)} onChange={(v) => set({ ways: v })} /> : null}
      {!ways || cfg.ways !== 1 ? (
        <Segmented
          label="Replacement"
          value={cfg.repl}
          options={[
            { value: 'lru', label: 'LRU', title: 'Least recently used (L23 p29)' },
            { value: 'fifo', label: 'FIFO', title: 'First in, first out (named only, L23 p31)' },
            { value: 'random', label: 'Random', title: 'Random with a fixed seed (named only, L23 p31)' },
          ]}
          onChange={(v) => set({ repl: v })}
        />
      ) : null}
      {writePolicies ? (
        <Segmented
          label="Write hit"
          value={cfg.hit}
          options={[
            { value: 'write-back', label: 'Write-back' },
            { value: 'write-through', label: 'Write-through' },
          ]}
          onChange={(v) => set({ hit: v })}
        />
      ) : null}
      {writePolicies ? (
        <Segmented
          label="Write miss"
          value={cfg.miss}
          options={[
            { value: 'allocate', label: 'Allocate' },
            { value: 'around', label: 'Around', title: 'Write around, also called write no allocate' },
          ]}
          onChange={(v) => set({ miss: v })}
        />
      ) : null}
      {!writePolicies || cfg.hit === 'write-through' ? (
        <Toggle label="Write buffer" checked={cfg.buf === true} onChange={(v) => set({ buf: v })} hint="Write-through only (L22 p67)" />
      ) : null}
    </div>
  )
}

/* ---------- Trace editor ---------- */

export function TracePresets({ input, onPick }: { input: Input; onPick?: () => void }) {
  return (
    <Presets
      label="Load example"
      presets={TRACE_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      isCurrent={(p) => p.id === input.loaded?.id}
      onPick={(p) => {
        input.load(p)
        onPick?.()
      }}
    />
  )
}

export function TraceEditor({ input, rows = 7 }: { input: Input; rows?: number }) {
  const p = input.preset
  return (
    <div className="ca-trace">
      {p ? (
        <div className="ca-gen">
          <p>
            <strong>{p.name}</strong> <span className="ca-muted">({p.source})</span>
          </p>
          <p className="ca-muted">
            Generated loop, {plural(input.accesses.length, 'access')}. First few:{' '}
            <span className="mono">
              {input.accesses
                .slice(0, 6)
                .map((a) => `${accessText(a)} @ ${fmtAddr(a.address)}`)
                .join(', ')}
            </span>
          </p>
          <Errors list={input.genErrors} />
          <div className="ca-buttons">
            <Button onClick={input.toEditor} disabled={input.accesses.length > 2000} title={input.accesses.length > 2000 ? 'Too long to edit as text' : undefined}>
              Edit as text
            </Button>
            <Button onClick={input.clearGen}>Type my own trace</Button>
          </div>
        </div>
      ) : input.mode === 'loop' ? (
        <LoopBuilder input={input} />
      ) : (
        <>
          <CodeEditor label="Accesses" value={input.text} onChange={input.setText} rows={rows} errors={input.lineErrors} />
          <p className="ca-muted">
            Addresses in decimal, 0x hex or 0b binary, split by commas, spaces or lines. Plain addresses are loads. <span className="mono">W 24=X</span> stores X. # starts a comment.
          </p>
          <div className="ca-buttons">
            <Button onClick={input.buildLoop}>Build an array loop</Button>
          </div>
        </>
      )}
      {input.loaded ? (
        <p className="ca-expect">
          <span className="ca-expect-src">{input.loaded.source}:</span> {input.loaded.expect}
        </p>
      ) : null}
    </div>
  )
}

/* ---------- Array loop builder ---------- */

const MAX_ARRAYS = 6

function LoopBuilder({ input }: { input: Input }) {
  const f = input.loop
  const run = input.loopRun
  const set = (patch: Partial<LoopForm>) => input.setLoop({ ...f, ...patch })
  const setArr = (k: number, patch: Partial<LoopForm['arrays'][number]>) => set({ arrays: f.arrays.map((a, j) => (j === k ? { ...a, ...patch } : a)) })
  const geo = useMemo(() => geometry(toConfig(input.cfg)), [input.cfg])
  const g = geo.ok ? geo.value : null
  const hits = useMemo(() => (g && run ? collisions(g, run) : []), [g, run])
  const unused = 'ABCDEFGH'.split('').find((c) => !f.arrays.some((a) => a.name === c)) ?? ''
  return (
    <div className="ca-loop">
      <p className="ca-muted">
        Runs <span className="mono">for (i = 0; i &lt; n; i++)</span> over the arrays below.
      </p>
      {f.arrays.map((a, k) => (
        <fieldset key={k} className="ca-config ca-arr">
          <legend className="visually-hidden">Array {k + 1}</legend>
          <TextField label="Array" value={a.name} onChange={(v) => setArr(k, { name: v })} width="4em" />
          <TextField label="Base address" value={a.base} onChange={(v) => setArr(k, { base: v })} placeholder={k ? 'after the last one' : '0x1000'} width="11em" />
          <NumberField label="Element" value={a.elem} min={1} suffix="bytes" width="4em" onChange={(v) => setArr(k, { elem: v })} />
          <NumberField label="Length" value={a.len} min={0} width="6em" onChange={(v) => setArr(k, { len: v })} />
          {f.arrays.length > 1 ? (
            <Button onClick={() => set({ arrays: f.arrays.filter((_, j) => j !== k) })} title={`Remove array ${a.name}`}>
              Remove
            </Button>
          ) : null}
        </fieldset>
      ))}
      {f.arrays.length < MAX_ARRAYS ? (
        <div className="ca-buttons">
          <Button onClick={() => set({ arrays: [...f.arrays, { name: unused, base: '', elem: 4, len: f.n }] })}>Add an array</Button>
        </div>
      ) : null}
      <div className="ca-config">
        {/* Arrays sized n grow with it, so 3200 to 3216 is one edit. */}
        <NumberField
          label="Iterations n"
          value={f.n}
          min={0}
          width="6em"
          onChange={(v) => set({ n: v, arrays: f.arrays.map((a) => (a.len === f.n ? { ...a, len: v } : a)) })}
        />
        <NumberField label="Only when i mod" value={f.mod} min={0} width="4em" onChange={(v) => set({ mod: v })} />
        {f.mod ? <TextField label="is one of" value={f.rem} onChange={(v) => set({ rem: v })} placeholder="0 1" width="6em" /> : null}
      </div>
      <TextField label="One iteration" value={f.body} onChange={(v) => set({ body: v })} placeholder="R A[i], R B[i], W C[k]" width="100%" />
      <p className="ca-muted">
        R loads, W stores. Index with i, k, 2i, i+1 or a number. k counts the iterations whose condition held, like C[k++]. Arrays sized n follow n. Mod 0 runs every iteration.
      </p>
      <Errors list={input.genErrors} />
      {run ? (
        <>
          <ul className="ca-placed">
            {run.arrays.map((a) => (
              <li key={a.name} className="mono">
                {a.name}[0] at <W e={a.why}>{fmtAddr(a.base)}</W>
                {g ? `, ${g.mapping === 'direct' ? 'index' : 'set'} ${Math.floor(a.base / g.config.blockBytes) % g.sets}` : ''}; {plural(a.length, 'element')} of {a.elemBytes} B
              </li>
            ))}
          </ul>
          <p className="ca-muted">{plural(input.accesses.length, 'access')}.</p>
          {hits.map((h) => (
            <Callout key={h.arrays.join()} kind={h.thrash ? 'trap' : 'note'} title={h.thrash ? `Thrashing: ${h.arrays.join(', ')}` : `${h.arrays.join(', ')} share a set`} cite="AY20/21 Q15; AY23/24 S2 Q18">
              Their starts are a multiple of {fmtBytes(h.span)} apart (sets x block size), so each iteration maps them to the same {g?.mapping === 'direct' ? 'index' : 'set'} with different
              tags.{' '}
              {h.thrash
                ? `${h.arrays.length} arrays share ${plural(g?.ways ?? 1, 'way')}, so each access evicts the block the next one needs.`
                : `The set has ${plural(g?.ways ?? 1, 'way')}, enough to keep all ${h.arrays.length}.`}
            </Callout>
          ))}
        </>
      ) : null}
      <div className="ca-buttons">
        <Button onClick={input.toEditor} disabled={input.accesses.length === 0 || input.accesses.length > 2000} title={input.accesses.length > 2000 ? 'Too long to edit as text' : undefined}>
          Edit as text
        </Button>
        <Button onClick={input.clearGen}>Type my own trace</Button>
      </div>
    </div>
  )
}

/* ---------- Address breakdown ---------- */

export function AddressBar({ g, split, compact = false }: { g: Geometry; split?: AddressSplit; compact?: boolean }) {
  const parts = [
    { key: 'tag', name: 'Tag', width: g.tagBits, range: g.ranges.tag, field: split?.tag, why: split?.why.tag ?? g.why.tag },
    { key: 'index', name: g.mapping === 'direct' ? 'Index' : 'Set index', width: g.indexBits, range: g.ranges.index, field: split?.index, why: split?.why.set ?? g.why.index },
    { key: 'offset', name: 'Offset', width: g.offsetBits, range: g.ranges.offset, field: split?.offset, why: split?.why.offset ?? g.why.offset },
  ].filter((p) => p.width > 0)
  // The lookup wire leaves from the field that picks the set: the index, or the tag when there is none (FA).
  const src = parts.some((p) => p.key === 'index') ? 'index' : 'tag'
  return (
    <div className="ca-addr">
      <div className="ca-addr-bar" role="group" aria-label="Address fields">
        {parts.map((p) => (
          <div key={p.key} className={`ca-seg ca-seg-${p.key}`} data-wire={p.key === src ? 'src' : undefined} style={{ flexGrow: p.width, minWidth: `calc(${p.width}ch + 14px)` }}>
            <div className="ca-seg-head">
              <span>{p.name}</span>
              <span className="mono">{p.range?.text}</span>
            </div>
            <div className="ca-seg-bits mono">{p.field ? p.field.bits : `${p.width} bit${p.width === 1 ? '' : 's'}`}</div>
            {p.field ? <div className="ca-seg-val mono">= {p.field.value}</div> : null}
          </div>
        ))}
      </div>
      {compact && g.mapping !== 'full' ? null : (
      <p className="ca-line">
        {compact ? null : parts.map((p, i) => (
          <span key={p.key}>
            {i ? ', ' : ''}
            {p.name.toLowerCase()} <W e={p.why}>{p.field ? p.field.value : `${p.width} bit${p.width === 1 ? '' : 's'}`}</W>
          </span>
        ))}
        {g.mapping === 'full' ? `${compact ? '' : '. '}Fully associative: no index field, the tag is the whole block number (L23 p26).` : '.'}
      </p>
      )}
    </div>
  )
}

/* ---------- Cache contents ---------- */

export interface Cursor {
  set: number
  way: number | null
  hit: boolean
  /** Word offset in the block that the access selects. */
  word: number
  victimTag: number | null
  /** Restarts the flash animation on every step. */
  key: number
}

/** The cache state to draw after a frame: every set (small caches) or only sets in use, with the current set always present. */
export function stateAfter(t: Trace, f: Frame | undefined): SetSnapshot[] {
  if (!f) return t.initial
  const list = f.cache
  return list.some((s) => s.index === f.set) ? list : [...list, f.setAfter].sort((a, b) => a.index - b.index)
}

export const cursorOf = (f: Frame | undefined): Cursor | undefined =>
  f
    ? { set: f.set, way: f.way, hit: f.hit, word: f.split.wordInBlock, victimTag: f.victim ? f.victim.tag : null, key: f.index }
    : undefined

const MAX_ROWS = 64

export function CacheTable({
  g,
  sets,
  cur,
  tf,
  byAddr,
  dirty,
  caption,
}: {
  g: Geometry
  sets: SetSnapshot[]
  cur?: Cursor
  tf: TagFmt
  byAddr: boolean
  dirty: boolean
  caption?: ReactNode
}) {
  const words = g.wordsPerBlock
  const wordCols = words <= 4 ? words : 1
  const keepAll = g.sets <= 16
  let rows = keepAll ? sets : sets.filter((s) => s.index === cur?.set || s.lines.some((l) => l.valid))
  const hiddenSets = g.sets - rows.length
  let windowed = false
  if (rows.length > MAX_ROWS) {
    const at = Math.max(0, rows.findIndex((s) => s.index === cur?.set))
    const start = Math.max(0, Math.min(rows.length - MAX_ROWS, at - MAX_ROWS / 2))
    rows = rows.slice(start, start + MAX_ROWS)
    windowed = true
  }
  const ordered = rows.map((s) => ({ s, lines: byAddr ? linesByAddress(s) : s.lines }))
  const curPos = (lines: LineSnapshot[]) => (cur && cur.way !== null ? lines.findIndex((l) => l.way === cur.way) : -1)
  let positions = Array.from({ length: g.ways }, (_, i) => i)
  if (g.ways > 8) {
    positions = positions.filter((p) => ordered.some(({ s, lines }) => lines[p]?.valid || (s.index === cur?.set && curPos(lines) === p)))
  }
  const assoc = g.ways > 1
  const setName = g.mapping === 'direct' ? 'Index' : 'Set'
  const groupCols = 2 + (dirty ? 1 : 0) + wordCols
  const orderName = g.config.replacement === 'lru' ? 'LRU to MRU' : 'Oldest to newest'

  return (
    <div className="table-wrap" data-wire="table">
      <table className="dtable dtable-compact ca-cache">
        {caption || hiddenSets > 0 || windowed ? (
          <caption>
            {caption}
            {hiddenSets > 0 ? ` ${plural(hiddenSets, 'set')} with every valid bit 0 ${hiddenSets === 1 ? 'is' : 'are'} hidden.` : ''}
            {windowed ? ` Showing ${MAX_ROWS} sets around the current one.` : ''}
            {g.ways > 8 && positions.length < g.ways ? ` Empty ways are hidden.` : ''}
          </caption>
        ) : null}
        <thead>
          {assoc ? (
            <tr>
              <th rowSpan={2}>{setName}</th>
              {positions.map((p) => (
                <th key={p} colSpan={groupCols} className="ca-way-head">
                  {g.mapping === 'full' ? 'Slot' : 'Way'} {p}
                  {byAddr && p === 0 ? ' (lower address)' : ''}
                </th>
              ))}
              <th rowSpan={2}>{orderName} (blocks)</th>
            </tr>
          ) : null}
          <tr>
            {!assoc ? <th>{setName}</th> : null}
            {positions.map((p) => (
              <GroupHead key={p} dirty={dirty} words={words} />
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.length === 0 ? (
            <tr>
              <td colSpan={1 + positions.length * groupCols + (assoc ? 1 : 0)} className="ca-muted">
                Every valid bit is 0: the cache starts empty (L22 p32).
              </td>
            </tr>
          ) : null}
          {ordered.map(({ s, lines }) => {
            const isCur = s.index === cur?.set
            const cp = isCur ? curPos(lines) : -1
            return (
              <tr key={s.index} className={isCur ? 'row-path' : undefined} data-wire={isCur ? 'row' : undefined}>
                <td className="mono">{s.index}</td>
                {positions.map((p) => (
                  <LineCells
                    key={`${p}-${isCur && p === cp ? cur?.key : 'x'}`}
                    line={lines[p]}
                    g={g}
                    tf={tf}
                    dirty={dirty}
                    wordCols={wordCols}
                    cur={isCur && p === cp ? cur : undefined}
                  />
                ))}
                {assoc ? <td className="mono ca-order">{orderText(s)}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function orderText(s: SetSnapshot): string {
  const blocks = s.order.map((w) => s.lines[w]?.block).filter((b): b is number => b !== null && b !== undefined)
  if (!blocks.length) return '-'
  return blocks.length > 8 ? `${blocks.slice(0, 8).join(', ')} +${blocks.length - 8} more` : blocks.join(', ')
}

function GroupHead({ dirty, words }: { dirty: boolean; words: number }) {
  return (
    <>
      <th title="Valid bit">V</th>
      {dirty ? <th title="Dirty bit">D</th> : null}
      <th>Tag</th>
      {words <= 4 ? Array.from({ length: words }, (_, w) => <th key={w}>Word{w}</th>) : <th>Data ({words} words)</th>}
    </>
  )
}

function LineCells({
  line,
  g,
  tf,
  dirty,
  wordCols,
  cur,
}: {
  line: LineSnapshot | undefined
  g: Geometry
  tf: TagFmt
  dirty: boolean
  wordCols: number
  cur?: Cursor
}) {
  const state = cur ? (cur.hit ? ' ca-cur ca-cur-hit' : ' ca-cur ca-cur-miss') : ''
  const flash = cur && cur.victimTag !== null ? ' ca-evict' : ''
  const cls = (extra = '') => `mono ca-cell${state}${flash}${extra}`
  if (!line || !line.valid) {
    return (
      <>
        <td className={cls(' ca-first')}>0</td>
        {dirty ? <td className={cls()} /> : null}
        <td className={cls()}>-</td>
        {Array.from({ length: wordCols }, (_, w) => (
          <td key={w} className={cls(w === wordCols - 1 ? ' ca-last' : '')} />
        ))}
      </>
    )
  }
  const wordCell = (i: number) => {
    const w = line.words[i]
    const sel = cur && cur.word === i ? ' ca-word' : ''
    const stale = w.memoryStale ? ' ca-stale' : ''
    return (
      <td key={i} className={cls(`${sel}${stale}${i === wordCols - 1 ? ' ca-last' : ''}`)} title={w.memoryStale ? 'Cache holds a newer value than memory' : undefined}>
        {w.data ?? mem(w.address)}
      </td>
    )
  }
  const written = line.words.filter((w) => w.data !== null)
  return (
    <>
      <td className={cls(' ca-first ca-valid')}>1</td>
      {dirty ? <td className={cls(line.dirty ? ' ca-dirty' : '')}>{line.dirty ? 1 : 0}</td> : null}
      <td className={cls()}>
        {fmtTag(line.tag, g.tagBits, tf)}
        {cur && cur.victimTag !== null ? <span className="ca-victim">replaced tag {fmtTag(cur.victimTag, g.tagBits, tf)}</span> : null}
      </td>
      {wordCols === g.wordsPerBlock ? (
        line.words.map((_, i) => wordCell(i))
      ) : (
        <td className={cls(` ca-last${written.some((w) => w.memoryStale) ? ' ca-stale' : ''}`)}>
          {mem(line.words[0].address)} .. {mem(line.words[line.words.length - 1].address)}
          {written.length ? <span className="ca-sub ca-written">{plural(written.length, 'word')} written</span> : null}
        </td>
      )}
    </>
  )
}
