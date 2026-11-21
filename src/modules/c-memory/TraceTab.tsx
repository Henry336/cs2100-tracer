import { useDeferredValue, useEffect, useMemo, type ReactNode } from 'react'
import { exprTreesByLine, traceC, type CMemConfig, type CTrace, type Endian, type ExprNode, type TraceFrame, type VarView } from '../../core/c-memory'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, CodeEditor, DataTable, Legend, Panel, Presets, Segmented, Toggle, Workspace, type Column } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'
import { Transport } from '../../ui/Transport'
import { ByteReading, ByteStrip } from './ByteStrip'
import { DEFAULT_PRESET, PRESET_LIST, TRAPS, W, relevantTraps } from './common'
import { findCell, touched } from './layout'
import { MemoryDiagram } from './MemoryDiagram'
import { checkPrediction } from './predict'

const stripLine = (m: string) => m.replace(/^line \d+: /, '')
const frameChanges = (f: TraceFrame) => [...f.stack.flatMap((s) => s.vars), ...f.globals, ...f.heap, ...f.literals].some(touched)

export function useTrace(src: string, cfg: Partial<CMemConfig>): CTrace {
  const key = JSON.stringify(cfg)
  return useMemo(() => traceC(src, cfg), [src, key]) // eslint-disable-line react-hooks/exhaustive-deps
}

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
        <Chip signal="hit">finished</Chip> main returned after {frames.length} steps.
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
    frames.length > 0 ? (
      <Transport
        stepper={stepper}
        label="Step"
        marks={marks}
        describe={f ? `line ${f.line}: ${f.description}` : undefined}
      />
    ) : undefined

  const expected = preset?.expect.output
  const defaults = cfg.pointerSize === 4 && cfg.pointerFormat === 'slides' && topNow === presetTop
  const traps = useMemo(() => relevantTraps(code), [code])

  return (
    <Workspace
      title="C memory and pointers"
      lectures="L02 to L05, R01 to R02, T01"
      intro={intro}
      toolbar={<Presets presets={PRESET_LIST} onPick={pick} />}
      transport={transport}
      inspector={
        <>
          <StepPanel f={f} srcLines={srcLines} overTo={overTo} outTo={outTo} onJump={stepper.set} />
          {f ? <GroupingPanel trees={trees.get(f.line) ?? []} line={f.line} /> : null}
          <SelectedPanel f={f} found={found} sel={sel} endian={cfg.endian ?? 'big'} />
          {f ? <VariablesPanel f={f} sel={sel} onSelect={setSel} /> : null}
          <Panel title="Traps in this program">
            <div className="cm-callouts">
              {traps.length === 0 ? <p className="cm-muted">None of the listed traps apply to this program.</p> : null}
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
          </Panel>
          <ConventionsPanel trace={trace} />
        </>
      }
    >
      <div className="cm-setup">
        <Panel
          title="Program"
          actions={
            preset ? (
              <span className="cm-muted">
                {preset.id}, {preset.source}, {preset.status === 'official' ? 'result from the source' : 'result worked out'}
              </span>
            ) : (
              <span className="cm-muted">Your program</span>
            )
          }
        >
          <CodeEditor
            label="C source"
            value={typeof src === 'string' ? src : ''}
            onChange={(v) => setSrc(v)}
            rows={Math.min(26, Math.max(14, srcLines.length))}
            marks={f ? { [f.line - 1]: 'path' } : undefined}
            errors={Object.keys(parseErrors).length ? parseErrors : rte && rte.line > 0 && f?.error ? { [rte.line - 1]: stripLine(rte.message) } : undefined}
          />
          {usesInput ? (
            <div className="cm-stdin">
              <CodeEditor label="Keyboard input (what the user types, read by scanf, fgets and getchar)" value={cfg.stdin ?? ''} onChange={(v) => setStdin(v)} rows={2} />
            </div>
          ) : null}
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
          <p className="cm-status">{status}</p>
          {trace.summary.warnings.map((w, k) => (
            <Callout key={k} kind="note" title={`Compiler warning, line ${w.line}`}>
              {stripLine(w.message)}
            </Callout>
          ))}
          {cfg.pointerFormat === 'gcc' ? (
            <Callout kind="beyond" title="Beyond the course: gcc's %p">
              The slides print addresses as plain hex digits from the course's old Sun machines. gcc on Linux writes them with a 0x prefix, and NULL as (nil).
            </Callout>
          ) : null}
        </Panel>
        <Panel title="Output" className="cm-console-panel">
          <pre className="cm-console mono" aria-live="polite">
            {f ? (
              <>
                {f.output.slice(0, f.output.length - f.newOutput.length)}
                {f.newOutput ? <mark className="cm-new-out">{f.newOutput}</mark> : null}
              </>
            ) : null}
            {!f || !f.output ? <span className="cm-muted">Nothing printed yet.</span> : null}
          </pre>
          {expected !== undefined ? (
            <div className="cm-expect">
              <p className="control-label">Expected by {preset?.source}</p>
              <pre className="cm-console mono">{expected}</pre>
              <p className="cm-status">
                {!defaults ? (
                  <span className="cm-muted">The source assumes 4-byte pointers and %p as the slides print it.</span>
                ) : trace.summary.output === expected ? (
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
          ) : preset?.expect.errorKind ? (
            <p className="cm-status">
              <Chip signal="miss">expected error</Chip> The source shows this program going wrong: {preset.expect.errorKind}.
            </p>
          ) : null}
          <div className="cm-expect">
            <CodeEditor label="Your prediction of the output (optional)" value={guess} onChange={(v) => setGuess(v)} rows={3} />
            {check ? (
              <p className="cm-status">
                {check.match ? (
                  <>
                    <Chip signal="hit">matches</Chip> Your prediction is exactly what the full run prints.
                  </>
                ) : (
                  <>
                    <Chip signal="miss">differs</Chip> Output line {check.line}: you wrote <span className="mono">{check.want}</span>, the program prints{' '}
                    <span className="mono">{check.got}</span>.
                    <Button onClick={() => stepper.set(check.step)}>{`Go to step ${check.step + 1}`}</Button>
                  </>
                )}
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      {f ? (
        <Panel
          flush
          title={`Memory after step ${i + 1}, line ${f.line}`}
          actions={
            <>
              <Toggle label="Addresses" checked={showAddr !== false} onChange={(v) => setShowAddr(v)} hint="Turn off to see only boxes and arrows" />
              <Toggle label="Show only what this step changes" checked={focus === true} onChange={(v) => setFocus(v)} hint="Hides every box this step leaves alone; the rest stay where they were" />
            </>
          }
        >
          <div className="cm-legend">
            <Legend
              items={[
                { signal: 'path', label: 'current line, value changed this step' },
                { signal: 'data', label: 'pointer box and its arrow' },
                { signal: 'dontcare', label: 'garbage (never given a value)' },
                { signal: 'miss', label: 'error, dangling or bad pointer' },
                { signal: 'control', label: 'call or return (timeline)' },
              ]}
            />
          </div>
          {f.error ? (
            <div className="cm-pad">
              <Callout kind="trap" title={`Stopped at line ${f.error.line}: ${f.error.kind}`} cite={f.error.cite}>
                {stripLine(f.error.message)}
              </Callout>
            </div>
          ) : null}
          {focus === true && !frameChanges(f) ? <p className="cm-pad cm-muted">This step changes nothing in memory: it only reads values, tests a condition or prints.</p> : null}
          <MemoryDiagram frame={f} showAddr={showAddr !== false} focus={focus === true} selected={sel} onSelect={(id) => setSel(id === sel ? null : id)} />
        </Panel>
      ) : (
        <Panel title="Cannot run">
          <ul className="cm-errors">
            {trace.errors.map((e, k) => (
              <li key={k}>{e.message}</li>
            ))}
          </ul>
        </Panel>
      )}

      {f ? (
        <Panel
          title="Memory strip"
          actions={
            <Segmented
              label="Byte order"
              value={cfg.endian ?? 'big'}
              onChange={(v) => setEndian(v)}
              options={[
                { value: 'big', label: 'Big-endian', title: 'Most significant byte at the lowest address' },
                { value: 'little', label: 'Little-endian', title: 'Least significant byte at the lowest address' },
              ]}
            />
          }
        >
          <ByteStrip frame={f} endian={cfg.endian ?? 'big'} selected={sel} onSelect={setSel} />
          <div className="cm-callouts">
            <Callout kind="course" title="Which byte order?" cite="R02 p8; L10 p17-18">
              Big-endian is the default because R02 labels our MIPS big-endian. L10 says MIPS byte order depends on the implementation, and the online interpreter is little-endian, so the order is always stated.
            </Callout>
            <Callout kind="trap" title="Endianness only reorders the bytes of one value" cite="L10 p17-18">
              A char array is stored in index order either way, and the bits inside a byte never move. Only an int, float, double or pointer has its bytes reversed.
            </Callout>
          </div>
        </Panel>
      ) : null}
    </Workspace>
  )
}

function StepPanel({ f, srcLines, overTo, outTo, onJump }: { f: TraceFrame | undefined; srcLines: string[]; overTo: number; outTo: number; onJump: (i: number) => void }) {
  if (!f) return null
  return (
    <Panel title={`Step ${f.index + 1}`} actions={<span className="cm-muted">{f.kind === 'cond' ? 'condition' : f.kind === 'decl' ? 'declaration' : f.kind === 'expr' ? 'statement' : f.kind}</span>}>
      <div className="cm-row cm-jumps">
        <Button onClick={() => onJump(overTo)} disabled={overTo < 0} title="Run any function this step calls, and stop at the next step in this function">
          Step over
        </Button>
        <Button onClick={() => onJump(outTo)} disabled={outTo < 0} title="Run to the end of this function and stop back in the caller">
          Step out
        </Button>
      </div>
      <p className="cm-codeline mono">
        <span className="cm-muted">{f.line}</span> {srcLines[f.line - 1]?.trim()}
      </p>
      <p className="cm-line">{f.description}</p>
      {f.whys.length ? (
        <ul className="cm-whys">
          {f.whys.map((w, k) => (
            <li key={k}>
              <span>{w.rule}</span>
              {w.working ? <span className="why-working mono">{w.working}</span> : null}
              {w.cite ? <span className="cm-cite">{w.cite}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {f.newOutput ? (
        <p className="cm-line">
          Prints <span className="mono cm-printed">{JSON.stringify(f.newOutput)}</span>
        </p>
      ) : null}
    </Panel>
  )
}

function SelectedPanel({ f, found, sel, endian }: { f: TraceFrame | undefined; found: ReturnType<typeof findCell>; sel: string | null; endian: Endian }) {
  if (!f) return null
  if (!found)
    return (
      <Panel title="Selected box">
        <p className="cm-muted">
          {sel ? 'That variable is not in memory at this step. ' : ''}Click a box in the diagram, or a name in a table, to see its address, size and bytes.
        </p>
      </Panel>
    )
  const { cell, top, where } = found
  const out = f.edges.find((e) => e.from === cell.id)
  const into = f.edges.filter((e) => e.toId === cell.id && e.status === 'ok')
  return (
    <Panel title={`Selected: ${cell.name}`} actions={<span className="cm-muted">{where}</span>}>
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
    </Panel>
  )
}

type VarRow = { v: VarView; where: string }

function VariablesPanel({ f, sel, onSelect }: { f: TraceFrame; sel: string | null; onSelect: (id: string) => void }) {
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
  return (
    <Panel flush title="Name, address, value" actions={<span className="cm-muted">L04A p11</span>}>
      {rows.length ? <DataTable compact columns={cols} rows={rows} rowSignal={(r) => (r.v.changed ? 'path' : undefined)} /> : <p className="cm-pad cm-muted">No variables yet.</p>}
    </Panel>
  )
}

function ConventionsPanel({ trace }: { trace: CTrace }) {
  return (
    <Panel title="Conventions">
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
    </Panel>
  )
}

function GroupingPanel({ trees, line }: { trees: ExprNode[]; line: number }) {
  if (trees.length === 0) return null
  return (
    <Panel title={`How line ${line} groups`} actions={<span className="cm-muted">L02C p9</span>}>
      <p className="cm-muted">The operator lowest in the precedence table is applied last, so it sits at the top. Level 1 binds tightest.</p>
      <ul className="cm-tree">
        {trees.map((t, k) => (
          <TreeNode key={k} n={t} />
        ))}
      </ul>
    </Panel>
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
