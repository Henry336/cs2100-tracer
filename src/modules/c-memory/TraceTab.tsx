import { useDeferredValue, useEffect, useMemo, type ReactNode } from 'react'
import { exprTreesByLine, traceC, type CMemConfig, type CTrace, type Endian, type ExprNode, type TraceFrame, type VarView } from '../../core/c-memory'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, CodeEditor, DataTable, Legend, Presets, Segmented, Tabs, Toggle, Workspace, type Column } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'
import { Transport } from '../../ui/Transport'
import { ByteReading, ByteStrip } from './ByteStrip'
import { DEFAULT_PRESET, PRESET_LIST, TRAPS, W, relevantTraps } from './common'
import { findCell, touched } from './layout'
import { MemoryDiagram } from './MemoryDiagram'
import { checkPrediction } from './predict'

const stripLine = (m: string) => m.replace(/^line \d+: /, '')
const frameChanges = (f: TraceFrame) => [...f.stack.flatMap((s) => s.vars), ...f.globals, ...f.heap, ...f.literals].some(touched)
const kindName = (f: TraceFrame) => (f.kind === 'cond' ? 'condition' : f.kind === 'decl' ? 'declaration' : f.kind === 'expr' ? 'statement' : f.kind)

export function useTrace(src: string, cfg: Partial<CMemConfig>): CTrace {
  const key = JSON.stringify(cfg)
  return useMemo(() => traceC(src, cfg), [src, key]) // eslint-disable-line react-hooks/exhaustive-deps
}

type DetailTab = 'output' | 'strip' | 'vars' | 'group' | 'traps' | 'conv'

const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: 'output', label: 'Output' },
  { value: 'strip', label: 'Memory strip' },
  { value: 'vars', label: 'Name, address, value' },
  { value: 'group', label: 'Operator grouping' },
  { value: 'traps', label: 'Traps' },
  { value: 'conv', label: 'Conventions' },
]

export default function TraceTab({ intro }: { intro: ReactNode }) {
  const [src, setSrc] = useUrlState('src', DEFAULT_PRESET.code)
  const [stdin, setStdin] = useUrlState('in', DEFAULT_PRESET.config?.stdin ?? '')
  const [top, setTop] = useUrlState<number>('top', DEFAULT_PRESET.config?.stackTop ?? 0)
  const [endian, setEndian] = useUrlState<Endian>('end', 'big')
  const [psize, setPsize] = useUrlState<4 | 8>('ps', 4)
  const [pfmt, setPfmt] = useUrlState<'slides' | 'gcc'>('pf', 'slides')
  const [showAddr, setShowAddr] = useUrlState('addr', true)
  const [focus, setFocus] = useUrlState('focus', false)
  const [rawSel, setSel] = useUrlState<string | null>('sel', null)
  const [stepQ, setStepQ] = useUrlState('step', 0)
  const [rawGuess, setGuess] = useUrlState('guess', '')
  const [rawDetail, setDetail] = useUrlState<DetailTab>('ct', 'output')
  const detail = DETAIL_TABS.some((t) => t.value === rawDetail) ? rawDetail : 'output'
  const guess = typeof rawGuess === 'string' ? rawGuess : ''

  const code = useDeferredValue(typeof src === 'string' ? src : '')
  const cfg: Partial<CMemConfig> = {
    endian: endian === 'little' ? 'little' : 'big',
    pointerSize: psize === 8 ? 8 : 4,
    pointerFormat: pfmt === 'gcc' ? 'gcc' : 'slides',
    stdin: typeof stdin === 'string' ? stdin : '',
    ...(typeof top === 'number' && top > 0 ? { stackTop: top } : {}),
  }
  const trace = useTrace(code, cfg)
  const frames = trace.frames
  const stepper = useStepper(frames.length, { initial: typeof stepQ === 'number' ? stepQ : 0 })
  const i = stepper.index
  useEffect(() => {
    if (i !== stepQ) setStepQ(i)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  const f: TraceFrame | undefined = frames[i]
  const sel = typeof rawSel === 'string' ? rawSel : null
  const found = f && sel ? findCell(f, sel) : undefined

  const preset = PRESET_LIST.find((p) => p.value.code === src)?.value
  const presetTop = preset?.config?.stackTop ?? 0
  const topNow = typeof top === 'number' ? top : 0
  const pick = (p: (typeof PRESET_LIST)[number]['value']) => {
    setSrc(p.code)
    setStdin(p.config?.stdin ?? '')
    setTop(p.config?.stackTop ?? 0)
    setSel(null)
    setGuess('')
    stepper.first()
  }
  // a fresh stack top in the same region the slides use (ffb.....), 16-byte aligned
  const shuffle = () => setTop((0xffb00000 + Math.floor(Math.random() * 0xff) * 0x1000 + 0x800) >>> 0)

  const parseErrors = useMemo(() => {
    const m: Record<number, string> = {}
    for (const e of trace.errors) if (e.line > 0) m[e.line - 1] = m[e.line - 1] ? `${m[e.line - 1]}; ${stripLine(e.message)}` : stripLine(e.message)
    return m
  }, [trace])
  const srcLines = (typeof src === 'string' ? src : '').split('\n')
  const usesInput = /\b(scanf|fgets|getchar)\b/.test(src) || cfg.stdin !== ''
  const rte = trace.summary.runtimeError

  const status =
    frames.length === 0 ? (
      <>
        <Chip signal="miss">does not compile</Chip> Fix the errors marked in the code to run it.
      </>
    ) : rte?.kind === 'limit' ? (
      <>
        <Chip signal="stall">stopped</Chip> {stripLine(rte.message)}
      </>
    ) : rte ? (
      <>
        <Chip signal="miss">runtime error</Chip> Stops at line {rte.line}, step {frames.length}: {rte.kind}.
      </>
    ) : !trace.ok ? (
      <>
        <Chip signal="miss">error</Chip> {trace.errors.map((e) => stripLine(e.message)).join('; ')}
      </>
    ) : (
      <>
        <Chip signal="hit">finished</Chip> main returns after {frames.length} steps.
      </>
    )

  const marks = useMemo(() => frames.map((x) => (x.error ? 'miss' : x.kind === 'call' || x.kind === 'return' ? 'control' : undefined)), [frames])
  const outputs = useMemo(() => frames.map((x) => x.output), [frames])
  const check = useMemo(() => (guess.trim() && outputs.length ? checkPrediction(outputs, guess) : undefined), [outputs, guess])
  const trees = useMemo(() => exprTreesByLine(code, cfg.pointerSize ?? 4), [code, cfg.pointerSize])
  // step over: next step back in this function or a caller; step out: next step in a caller
  const depth = f?.stack.length ?? 0
  const overTo = frames.findIndex((x, j) => j > i && x.stack.length <= depth)
  const outTo = depth > 1 ? frames.findIndex((x, j) => j > i && x.stack.length < depth) : -1

  const transport =
    frames.length > 0 ? <Transport stepper={stepper} label="Step" marks={marks} describe={f ? `line ${f.line}: ${f.description}` : undefined} /> : undefined

  const expected = preset?.expect.output
  const defaults = cfg.pointerSize === 4 && cfg.pointerFormat === 'slides' && topNow === presetTop
  const traps = useMemo(() => relevantTraps(code), [code])

  const atEnd = i >= frames.length - 1
  const playLabel = stepper.playing ? 'Pause' : atEnd ? 'Run it again' : i === 0 ? 'Run this program' : 'Play from here'

  return (
    <Workspace title="C memory and pointers" lectures="L02 to L05, R01 to R02, T01" intro={intro} toolbar={<Presets presets={PRESET_LIST} onPick={pick} />} transport={transport}>
      <div className="cm-command">
        <p className="cm-status">
          <span className="cm-muted" title={preset ? (preset.status === 'official' ? 'Result from the source' : 'Result worked out, no answer key') : undefined}>
            {preset ? `${preset.id}, ${preset.source}` : 'Your program'}
          </span>{' '}
          {status}
        </p>
        {trace.summary.warnings.map((w, k) => (
          <Callout key={k} kind="note" title={`Compiler warning, line ${w.line}`}>
            {stripLine(w.message)}
          </Callout>
        ))}
        <details className="cm-options">
          <summary>Pointer size, addresses and options</summary>
          <div className="cm-row">
            <Segmented
              label="Pointer size"
              value={cfg.pointerSize ?? 4}
              onChange={(v) => setPsize(v)}
              options={[
                { value: 4, label: '4 bytes', title: '32-bit addresses, as the slides print them (L04A p7)' },
                { value: 8, label: '8 bytes', title: '64-bit lab machines (Lab 2)' },
              ]}
            />
            <Segmented
              label="printf %p"
              value={cfg.pointerFormat ?? 'slides'}
              onChange={(v) => setPfmt(v)}
              options={[
                { value: 'slides', label: 'As the slides', title: 'Plain hex digits, e.g. ffbff7dc (L04A p7)' },
                { value: 'gcc', label: 'gcc (0x)', title: 'gcc on Linux adds 0x; beyond the slides' },
              ]}
            />
            <Button onClick={shuffle} title="Real addresses vary from run to run (L04A p7); the boxes and arrows stay the same">
              New stack addresses
            </Button>
            {topNow !== presetTop ? (
              <Button onClick={() => setTop(presetTop)} title="Back to the addresses the source uses">
                Reset addresses
              </Button>
            ) : null}
          </div>
          {cfg.pointerFormat === 'gcc' ? (
            <Callout kind="beyond" title="gcc's %p">
              The slides print addresses as plain hex digits from the course's old Sun machines. gcc on Linux writes them with a 0x prefix, and NULL as (nil).
            </Callout>
          ) : null}
        </details>
      </div>

      <div className="cm-stage">
        <div className="cm-board canvas">
          <div className="cm-board-bar">
            <p className="cm-board-title">
              {f ? (
                <>
                  <span className="cm-board-step">Step {i + 1}</span>
                  <span className="cm-muted">of {frames.length}, line {f.line}</span>
                </>
              ) : (
                'Cannot run'
              )}
            </p>
            {f ? (
              <div className="cm-board-actions">
                <Toggle label="Addresses" checked={showAddr !== false} onChange={(v) => setShowAddr(v)} hint="Turn off to see only boxes and arrows" />
                <Toggle label="Show only what this step changes" checked={focus === true} onChange={(v) => setFocus(v)} hint="Hides the boxes this step leaves alone. The others keep their place." />
              </div>
            ) : null}
          </div>
          {f ? (
            <>
              {f.error ? (
                <div className="cm-pad">
                  <Callout kind="trap" title={`Stopped at line ${f.error.line}: ${f.error.kind}`} cite={f.error.cite}>
                    {stripLine(f.error.message)}
                  </Callout>
                </div>
              ) : null}
              {focus === true && !frameChanges(f) ? <p className="cm-pad cm-muted">This step changes nothing in memory.</p> : null}
              <MemoryDiagram
                frame={f}
                line={srcLines[f.line - 1]}
                showAddr={showAddr !== false}
                focus={focus === true}
                selected={sel}
                onSelect={(id) => setSel(id === sel ? null : id)}
              />
              <div className="cm-board-play">
                <button type="button" className="cm-play" onClick={stepper.toggle} data-playing={stepper.playing}>
                  {stepper.playing ? (
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 3h3v10H4zM9 3h3v10H9z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4.5 2.8l9 5.2-9 5.2z" />
                    </svg>
                  )}
                  {playLabel}
                </button>
                {!atEnd ? (
                  <button type="button" className="cm-next" onClick={stepper.next}>
                    Next step
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </button>
                ) : null}
                <button type="button" className="cm-quiet" onClick={() => stepper.set(overTo)} disabled={overTo < 0} title="Run any function this step calls, and stop at the next step in this function">
                  Step over
                </button>
                <button type="button" className="cm-quiet" onClick={() => stepper.set(outTo)} disabled={outTo < 0} title="Run to the end of this function and stop back in the caller">
                  Step out
                </button>
              </div>
              <div className="cm-board-foot">
                <Legend
                  items={[
                    { signal: 'path', label: 'changed this step' },
                    { signal: 'data', label: 'pointer and its arrow' },
                    { signal: 'dontcare', label: 'garbage (never given a value)' },
                    { signal: 'miss', label: 'error or bad pointer' },
                    { signal: 'control', label: 'call or return (timeline)' },
                  ]}
                />
              </div>
            </>
          ) : (
            <ul className="cm-errors cm-pad">
              {trace.errors.map((e, k) => (
                <li key={k}>{e.message}</li>
              ))}
            </ul>
          )}
        </div>

        <aside className="cm-story" aria-label="Program and the current step">
          <CodeEditor
            label="C source"
            value={typeof src === 'string' ? src : ''}
            onChange={(v) => setSrc(v)}
            rows={Math.min(20, Math.max(10, srcLines.length))}
            marks={f ? { [f.line - 1]: 'path' } : undefined}
            errors={Object.keys(parseErrors).length ? parseErrors : rte && rte.line > 0 && f?.error ? { [rte.line - 1]: stripLine(rte.message) } : undefined}
          />
          {usesInput ? <CodeEditor label="Keyboard input (read by scanf, fgets and getchar)" value={cfg.stdin ?? ''} onChange={(v) => setStdin(v)} rows={2} /> : null}
          {f ? <StepStory frames={frames} i={i} srcLines={srcLines} onJump={stepper.set} /> : null}
          {f && found ? (
            <SelectedBox f={f} found={found} endian={cfg.endian ?? 'big'} onClear={() => setSel(null)} />
          ) : f ? (
            <p className="cm-tip">{sel ? 'That variable is not in memory at this step. ' : ''}Click a box to see its address, size and bytes.</p>
          ) : null}
        </aside>
      </div>

      {f ? (
        <section className="cm-details" aria-label="Tables for this step">
          <Tabs label="Tables" value={detail} onChange={setDetail} tabs={DETAIL_TABS} />
          <div className="cm-detail-body">
            {detail === 'output' ? (
              <OutputPane
                f={f}
                expected={expected}
                source={preset?.source}
                errorKind={preset?.expect.errorKind}
                defaults={defaults}
                fullOutput={trace.summary.output}
                guess={guess}
                setGuess={setGuess}
                check={check}
                onJump={stepper.set}
              />
            ) : null}
            {detail === 'strip' ? (
              <>
                <div className="cm-row cm-row-top">
                  <Segmented
                    label="Byte order"
                    value={cfg.endian ?? 'big'}
                    onChange={(v) => setEndian(v)}
                    options={[
                      { value: 'big', label: 'Big-endian', title: 'Most significant byte at the lowest address' },
                      { value: 'little', label: 'Little-endian', title: 'Least significant byte at the lowest address' },
                    ]}
                  />
                </div>
                <ByteStrip frame={f} endian={cfg.endian ?? 'big'} selected={sel} onSelect={setSel} />
                <div className="cm-callouts">
                  <Callout kind="course" title="Which byte order?" cite="R02 p8; L10 p17-18">
                    R02 calls our MIPS big-endian, so that is the default. L10 says it depends on the implementation, and the online interpreter is little-endian, so a question always states the order.
                  </Callout>
                  <Callout kind="trap" title="Endianness only reorders the bytes of one value" cite="L10 p17-18">
                    A char array is stored in index order either way, and the bits inside a byte never move. Only an int, float, double or pointer has its bytes reversed.
                  </Callout>
                </div>
              </>
            ) : null}
            {detail === 'vars' ? <VariablesTable f={f} sel={sel} onSelect={setSel} /> : null}
            {detail === 'group' ? <Grouping trees={trees.get(f.line) ?? []} line={f.line} /> : null}
            {detail === 'traps' ? <TrapList traps={traps} /> : null}
            {detail === 'conv' ? <Conventions trace={trace} /> : null}
          </div>
        </section>
      ) : null}
    </Workspace>
  )
}

/** The current step bright and opened; the steps either side as one clickable line. */
function StepStory({ frames, i, srcLines, onJump }: { frames: TraceFrame[]; i: number; srcLines: string[]; onJump: (i: number) => void }) {
  const items = [i - 1, i, i + 1].filter((k) => k >= 0 && k < frames.length)
  return (
    <ol className="cm-story-steps" aria-label="Steps around this one">
      {items.map((k) => {
        const x = frames[k]
        const now = k === i
        return (
          <li key={k} className={now ? 'is-now' : k < i ? 'is-past' : 'is-next'}>
            <button type="button" className="cm-story-btn" onClick={() => onJump(k)} aria-current={now ? 'step' : undefined}>
              <span className="cm-story-dot" aria-hidden="true" />
              <span className="cm-story-line">{now ? `Step ${k + 1}, ${kindName(x)}` : `Step ${k + 1}: ${x.description}`}</span>
            </button>
            {now ? (
              <div className="cm-story-body">
                <p className="cm-codeline mono">
                  <span className="cm-muted">{x.line}</span> {srcLines[x.line - 1]?.trim()}
                </p>
                <p className="cm-does">{x.description}</p>
                {x.newOutput ? (
                  <p className="cm-line">
                    Prints <span className="mono cm-printed">{JSON.stringify(x.newOutput)}</span>
                  </p>
                ) : null}
                {x.whys.length ? (
                  <details className="cm-why">
                    <summary>How this step works</summary>
                    <ul className="cm-whys">
                      {x.whys.map((w, n) => (
                        <li key={n}>
                          <span>{w.rule}</span>
                          {w.working ? <span className="why-working mono">{w.working}</span> : null}
                          {w.cite ? <span className="cm-cite">{w.cite}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function OutputPane(p: {
  f: TraceFrame
  expected: string | undefined
  source: string | undefined
  errorKind: string | undefined
  defaults: boolean
  fullOutput: string
  guess: string
  setGuess: (v: string) => void
  check: ReturnType<typeof checkPrediction> | undefined
  onJump: (i: number) => void
}) {
  const { f, check } = p
  return (
    <div className="cm-output">
      <div>
        <p className="control-label">Printed so far</p>
        <pre className="cm-console mono" aria-live="polite">
          {f.output.slice(0, f.output.length - f.newOutput.length)}
          {f.newOutput ? <mark className="cm-new-out">{f.newOutput}</mark> : null}
          {!f.output ? <span className="cm-muted">Nothing printed yet.</span> : null}
        </pre>
        {p.expected !== undefined ? (
          <div className="cm-expect">
            <p className="control-label">Expected by {p.source}</p>
            <pre className="cm-console mono">{p.expected}</pre>
            <p className="cm-status">
              {!p.defaults ? (
                <span className="cm-muted">The source assumes 4-byte pointers and %p as the slides print it.</span>
              ) : p.fullOutput === p.expected ? (
                <>
                  <Chip signal="hit">matches</Chip> The full run prints exactly this.
                </>
              ) : (
                <>
                  <Chip signal="miss">differs</Chip> The full run prints something else.
                </>
              )}
            </p>
          </div>
        ) : p.errorKind ? (
          <p className="cm-status">
            <Chip signal="miss">expected error</Chip> The source shows this program going wrong: {p.errorKind}.
          </p>
        ) : null}
      </div>
      <div>
        <CodeEditor label="Your prediction of the output" value={p.guess} onChange={(v) => p.setGuess(v)} rows={3} />
        {check ? (
          <p className="cm-status">
            {check.match ? (
              <>
                <Chip signal="hit">matches</Chip> Your prediction is exactly what the full run prints.
              </>
            ) : (
              <>
                <Chip signal="miss">differs</Chip> Output line {check.line}: you wrote <span className="mono">{check.want}</span>, the program prints <span className="mono">{check.got}</span>.
                <Button onClick={() => p.onJump(check.step)}>{`Go to step ${check.step + 1}`}</Button>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SelectedBox({ f, found, endian, onClear }: { f: TraceFrame; found: NonNullable<ReturnType<typeof findCell>>; endian: Endian; onClear: () => void }) {
  const { cell, top, where } = found
  const out = f.edges.find((e) => e.from === cell.id)
  const into = f.edges.filter((e) => e.toId === cell.id && e.status === 'ok')
  return (
    <section className="cm-selected" aria-label={`Selected: ${cell.name}`}>
      <div className="cm-selected-head">
        <p className="cm-selected-title">
          <span className="mono">{cell.name}</span> <span className="cm-muted">{where}</span>
        </p>
        <button type="button" className="btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <dl className="cm-facts">
        <dt>Type</dt>
        <dd className="mono">{cell.type}</dd>
        <dt>Address</dt>
        <dd className="mono">
          <W e={cell.addressWhy}>{cell.addressHex}</W>
        </dd>
        <dt>Size</dt>
        <dd>
          <W e={cell.sizeWhy}>{`${cell.size} byte${cell.size === 1 ? '' : 's'}`}</W>
        </dd>
        <dt>Value</dt>
        <dd className="mono cm-wrap">
          {cell.value}
          {cell.prev !== undefined ? <span className="cm-muted"> (was {cell.prev})</span> : null}
        </dd>
        {cell.kind === 'pointer' ? (
          <>
            <dt>Points to</dt>
            <dd>
              {!out ? (
                cell.initialised ? 'nothing (NULL)' : 'unknown: it has no value yet'
              ) : out.status === 'ok' ? (
                <>
                  <span className="mono">{out.toName ?? out.toHex}</span> at <span className="mono">{out.toHex}</span>
                </>
              ) : out.status === 'dangling' ? (
                <>
                  <Chip signal="miss">dangling</Chip> <span className="mono">{out.toHex}</span>, where {out.toName ?? 'a variable'} used to be
                </>
              ) : (
                <>
                  <Chip signal="miss">outside</Chip> <span className="mono">{out.toHex}</span> is not inside any variable
                </>
              )}
            </dd>
          </>
        ) : null}
        {into.length ? (
          <>
            <dt>Pointed to by</dt>
            <dd className="mono">{into.map((e) => e.fromName).join(', ')}</dd>
          </>
        ) : null}
      </dl>
      {into.length > 1 ? (
        <Callout kind="note" title="Aliases">
          {into.length} pointers reach this box, so writing through any of them changes the same bytes. {into.map((e) => `*${e.fromName}`).join(' and ')} are all {cell.name}.
        </Callout>
      ) : null}
      <ByteReading cell={cell} top={top} endian={endian} />
    </section>
  )
}

type VarRow = { v: VarView; where: string }

function VariablesTable({ f, sel, onSelect }: { f: TraceFrame; sel: string | null; onSelect: (id: string) => void }) {
  const rows: VarRow[] = [
    ...f.stack.flatMap((s) => s.vars.map((v) => ({ v, where: s.func }))),
    ...f.globals.map((v) => ({ v, where: v.staticIn ? `static (${v.staticIn})` : 'global' })),
    ...f.heap.map((v) => ({ v, where: v.freed ? 'heap, freed' : 'heap' })),
  ]
  const cols: Column<VarRow>[] = [
    {
      key: 'n',
      header: 'Name',
      cell: (r) => (
        <button type="button" className="cm-link mono" aria-pressed={sel === r.v.id} onClick={() => onSelect(r.v.id)}>
          {r.v.name}
        </button>
      ),
    },
    { key: 'w', header: 'In', cell: (r) => <span className="cm-muted">{r.where}</span> },
    { key: 'a', header: 'Address', mono: true, cell: (r) => <W e={r.v.addressWhy}>{r.v.addressHex}</W> },
    { key: 'v', header: 'Value', mono: true, cell: (r) => (r.v.value.length > 26 ? `${r.v.value.slice(0, 25)}…` : r.v.value) },
  ]
  return rows.length ? (
    <DataTable compact columns={cols} rows={rows} rowSignal={(r) => (r.v.changed ? 'path' : undefined)} caption="Every variable at this step (L04A p11)" />
  ) : (
    <p className="cm-muted">No variables yet.</p>
  )
}

function TrapList({ traps }: { traps: typeof TRAPS }) {
  return (
    <div className="cm-callouts">
      {traps.length === 0 ? <p className="cm-muted">No trap applies to this program.</p> : null}
      {traps.map((t) => (
        <Callout key={t.id} kind="trap" title={t.title} cite={t.cite}>
          {t.body}
        </Callout>
      ))}
      {traps.length < TRAPS.length ? (
        <details className="cm-more">
          <summary>Other traps ({TRAPS.length - traps.length})</summary>
          <div className="cm-callouts">
            {TRAPS.filter((t) => !traps.includes(t)).map((t) => (
              <Callout key={t.id} kind="trap" title={t.title} cite={t.cite}>
                {t.body}
              </Callout>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function Conventions({ trace }: { trace: CTrace }) {
  return (
    <>
      <table className="dtable dtable-compact cm-sizes">
        <thead>
          <tr>
            {trace.summary.sizes.map((s) => (
              <th key={s.type}>{s.type}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {trace.summary.sizes.map((s) => (
              <td key={s.type} className="mono">
                <W e={s.why}>{s.bytes}</W>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <Callout kind="course" title="What this tracer assumes">
        <ul className="cm-assume">
          {trace.summary.assumptions.map((a, k) => (
            <li key={k}>
              {a.rule}. <span className="cm-cite">{a.cite}</span>
            </li>
          ))}
        </ul>
      </Callout>
    </>
  )
}

function Grouping({ trees, line }: { trees: ExprNode[]; line: number }) {
  if (trees.length === 0) return <p className="cm-muted">Line {line} has no operators to group.</p>
  return (
    <>
      <p className="cm-muted">The operator applied last sits at the top. Level 1 binds tightest (L02C p9).</p>
      <ul className="cm-tree">
        {trees.map((t, k) => (
          <TreeNode key={k} n={t} />
        ))}
      </ul>
    </>
  )
}

function TreeNode({ n }: { n: ExprNode }) {
  return (
    <li>
      <span className="cm-tree-row">
        {n.op ? <span className="cm-tree-op mono">{n.op}</span> : null}
        <span className="mono">{n.text}</span>
        {n.op ? <span className="cm-muted">{n.row ? `level ${n.row.level}, ${n.row.group.toLowerCase()}, ${n.row.assoc}` : 'not in the table'}</span> : null}
      </span>
      {n.note ? <span className="cm-tree-note">{n.note}</span> : null}
      {n.kids.length ? (
        <ul>
          {n.kids.map((c, k) => (
            <TreeNode key={k} n={c} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
