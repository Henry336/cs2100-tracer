import { useMemo, type ReactNode } from 'react'
import {
  analyse,
  bin,
  buildGraph,
  comboText,
  machineFromTable,
  parseCircuit,
  parseStateTable,
  selfCorrection,
  simulate,
  sinksOf,
  type Analysis,
  type AnalysisRow,
  type Issue,
  type Machine,
  type SelfCorrection,
  type SimFrame,
  type StateGraph,
} from '../../core/sequential'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Legend, NumberField, Presets, Segmented, Select, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Board, PlayBar, Stage } from '../../ui/board'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { Bitv, Fold, Issues, Narrate, Scroll, StepNote, TabStrip, W, bool, int, lineErrors, parseStates, pick, plural, splitNames, str } from './common'
import { ANALYSIS_PRESETS } from './presets'
import { StateDiagram } from './StateDiagram'

type Source = 'eq' | 'table'
type StepMode = 'sim' | 'rows'

/** Input sequence such as '100010' (one input) or '01 11 01' (two inputs), as input combinations. */
export function parseInputSequence(text: string, n: number): { combos: number[]; error?: string } {
  const t = text.trim()
  if (!t) return { combos: [] }
  let toks = t.split(/[\s,]+/).filter(Boolean)
  if (toks.length === 1 && n > 0 && toks[0].length % n === 0) toks = toks[0].match(new RegExp(`.{${n}}`, 'g')) ?? []
  else if (n === 1 && toks.every((x) => x.length > 1)) toks = toks.join('').split('')
  const combos: number[] = []
  for (const tok of toks) {
    if (!/^[01]+$/.test(tok) || tok.length !== n) return { combos: [], error: `'${tok}' is not ${n} input bit${n === 1 ? '' : 's'} (0 or 1)` }
    combos.push(parseInt(tok, 2))
  }
  return { combos }
}

interface Model {
  machine: Machine
  graph: StateGraph
  sinks: number[]
  sc: SelfCorrection
  analysis: Analysis | null
  warnings: Issue[]
}

export default function AnalysisTab({ intro }: { intro: ReactNode }) {
  const [rawSrc, setSrc] = useUrlState<Source>('amo', 'eq')
  const [rawEq, setEq] = useUrlState<string>('aeq', ANALYSIS_PRESETS[0].text)
  const [rawIn, setIn] = useUrlState<string>('ain', '')
  const [rawOut, setOut] = useUrlState<string>('aou', '')
  const [rawBits, setBits] = useUrlState<string>('abt', 'A, B')
  const [rawUsed, setUsed] = useUrlState<string>('aus', '')
  const [rawStart, setStart] = useUrlState<number>('ast', 0)
  const [rawSeq, setSeq] = useUrlState<string>('asq', ANALYSIS_PRESETS[0].seq ?? '')
  const [rawClocks, setClocks] = useUrlState<number>('acl', 4)
  const [rawMode, setMode] = useUrlState<StepMode>('asm', 'sim')
  const [rawFocus, setFocus] = useUrlState<boolean>('afo', false)
  const [rawShown, setShown] = useUrlState<number>('apx', -1)
  const [tab, setTab] = useUrlState<string>('atab', '')

  const src = pick(rawSrc, ['eq', 'table'] as const, 'eq')
  const text = str(rawEq, '')
  const inText = str(rawIn, '')
  const outText = str(rawOut, '')
  const bitsText = str(rawBits, 'A, B')
  const usedText = str(rawUsed, '')
  const seqText = str(rawSeq, '')
  const focus = bool(rawFocus, false)
  const used = parseStates(usedText)

  const built = useMemo((): { model: Model | null; errors: Issue[] } => {
    if (src === 'eq') {
      const ins = splitNames(inText)
      const p = parseCircuit(text, ins.length ? { inputs: ins } : {})
      if (!p.ok) return { model: null, errors: p.errors }
      const r = analyse(used.states ? { ...p.circuit, used: used.states } : p.circuit)
      if (!r.ok) return { model: null, errors: r.errors }
      const a = r.analysis
      return { model: { machine: a.machine, graph: a.graph, sinks: a.sinks, sc: a.selfCorrection, analysis: a, warnings: a.warnings }, errors: [] }
    }
    const ins = splitNames(inText)
    const outs = splitNames(outText)
    const p = parseStateTable(text, { inputs: ins.length, outputs: outs.length })
    if (!p.ok) return { model: null, errors: p.errors }
    const base = machineFromTable(p.table, { inputs: ins, outputs: outs, bits: splitNames(bitsText) })
    const m = used.states ? { ...base, used: used.states.filter((s) => s < base.labels.length) } : base
    return { model: { machine: m, graph: buildGraph(m), sinks: sinksOf(m), sc: selfCorrection(m), analysis: null, warnings: [] }, errors: [] }
  }, [src, text, inText, outText, bitsText, usedText]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = built.model
  const m = model?.machine
  const nIn = m?.inputs.length ?? 0
  const start = int(rawStart, 0, Math.max(0, (m?.labels.length ?? 1) - 1), 0)
  const seq = parseInputSequence(seqText, nIn)
  const clocks = int(rawClocks, 1, 40, 4)
  const sim = useMemo(() => (m ? simulate(m, start, nIn ? seq.combos : { clocks }) : null), [m, start, nIn, seq.combos.join(), clocks]) // eslint-disable-line react-hooks/exhaustive-deps
  const mode: StepMode = src === 'eq' ? pick(rawMode, ['sim', 'rows'] as const, 'sim') : 'sim'
  const a = model?.analysis ?? null
  const count = mode === 'rows' ? (a?.frames.length ?? 0) : (sim?.frames.length ?? 0)
  const stepper = useStepper(count)
  const k = Math.min(stepper.index, Math.max(0, count - 1))

  const simFrame: SimFrame | undefined = mode === 'sim' ? sim?.frames[k] : undefined
  const rowNow: AnalysisRow | undefined = mode === 'rows' && a ? a.rows[a.frames[k]?.row ?? 0] : undefined
  const current = simFrame ? simFrame.state : rowNow ? rowNow.state : start
  const nextState = simFrame ? simFrame.next : rowNow ? rowNow.nextState : null
  const combo = simFrame ? simFrame.combo : rowNow ? rowNow.combo : null
  const active = count && nextState !== null ? { from: current, to: nextState } : null
  const shownPath = model?.sc.paths.find((p) => p.state === rawShown)
  const pathEdges = shownPath ? shownPath.path.slice(1).map((to, i) => ({ from: shownPath.path[i], to })) : []

  const toolbar = (
    <Presets
      presets={ANALYSIS_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setSrc(p.mode)
        setEq(p.text)
        setIn(p.inputs ?? '')
        setOut(p.outputs ?? '')
        setBits(p.bits ?? 'A, B')
        setUsed(p.used ?? '')
        setStart(p.start)
        setSeq(p.seq ?? '')
        if (p.clocks) setClocks(p.clocks)
        setMode('sim')
        stepper.first()
      }}
    />
  )

  const label = (s: number | null) => (s === null || !m ? '?' : m.bits.length ? `${m.labels[s]} (${bin(s, m.bits.length)})` : m.labels[s])
  const describe = simFrame
    ? `clock ${simFrame.clock}: ${label(simFrame.state)}${simFrame.combo !== null && m ? `, ${m.inputs.join('')} = ${comboText(m, simFrame.combo)}` : ''} to ${label(simFrame.next)}`
    : rowNow && a
      ? a.frames[k].title
      : undefined
  const why = simFrame ? simFrame.why : rowNow && a ? a.frames[k].why : null
  const summary = src === 'eq' ? text.split('\n').map((l) => l.trim()).filter(Boolean).join(';  ') : `state table, ${plural(text.split('\n').filter((l) => l.trim()).length, 'line')}`
  const allErrors = [...built.errors.map((e) => (e.line ? { ...e, message: `line ${e.line}: ${e.message}` } : e)), ...(used.error ? [{ code: 'used', message: `Used states: ${used.error}`, at: [0, 0] as [number, number] }] : [])]

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      toolbar={toolbar}
      transport={count ? <Transport stepper={stepper} label={mode === 'rows' ? 'row' : 'clock'} describe={describe} /> : undefined}
    >
      {model ? (
        <div className="seq-command">
          <Select
            label="Start state"
            value={String(start)}
            onChange={(v) => {
              setStart(Number(v))
              stepper.first()
            }}
            options={model.machine.labels.map((l, s) => ({ value: String(s), label: model.machine.bits.length ? `${l} (${bin(s, model.machine.bits.length)})` : l }))}
          />
          {nIn ? (
            <TextField label={`Input sequence, ${model.machine.inputs.join('')} per clock`} value={seqText} onChange={setSeq} placeholder={nIn === 1 ? '100010' : '01 11 01'} width="12em" />
          ) : (
            <NumberField label="Clocks" value={clocks} onChange={setClocks} min={1} max={40} width="5em" />
          )}
        </div>
      ) : null}
      {seq.error ? <Issues issues={[{ code: 'seq', message: `Input sequence: ${seq.error}`, at: [0, 0] }]} /> : null}
      <Fold
        summary={
          <>
            Circuit: <span className="mono seq-fold-sum">{summary}</span>
          </>
        }
        whenClosed={<Issues issues={allErrors} />}
      >
        <div className="seq-row">
          <Segmented
            label="Start from"
            value={src}
            onChange={(v) => {
              setSrc(v)
              stepper.first()
            }}
            options={[
              { value: 'eq', label: 'flip-flop equations', title: 'Analysis: equations to state table (L19 p28-43)' },
              { value: 'table', label: 'a state table', title: 'Trace a given table, numbered or lettered states (T09 SE1)' },
            ]}
          />
          {src === 'eq' ? (
            <Segmented
              label="Step through"
              value={mode}
              onChange={(v) => {
                setMode(v)
                stepper.first()
              }}
              options={[
                { value: 'sim', label: 'input sequence', title: 'One transition per clock' },
                { value: 'rows', label: 'state table rows', title: 'Build the state table one row at a time (L19 p30)' },
              ]}
            />
          ) : null}
        </div>
        <div className="seq-split">
          <div className="seq-grow">
            <CodeEditor
              label={src === 'eq' ? 'Equations, one per line: JA = B, DB = A + x, A+ = A∙x, y = A∙x' : "State table, one line per state: next/output per input value, e.g. 1: 2/0 3/1 (X: don't care)"}
              value={text}
              onChange={setEq}
              rows={7}
              errors={lineErrors(built.errors)}
            />
          </div>
          <div className="seq-fields">
            <TextField label="Inputs, MSB first" value={inText} onChange={setIn} placeholder={src === 'eq' ? 'auto' : 'none'} width="10em" />
            {src === 'table' ? (
              <>
                <TextField label="Outputs" value={outText} onChange={setOut} placeholder="none" width="10em" />
                <TextField label="State bits (numbered states)" value={bitsText} onChange={setBits} width="10em" />
              </>
            ) : null}
            <TextField label="Used states (blank: all)" value={usedText} onChange={setUsed} placeholder="e.g. 1-5" width="10em" />
          </div>
        </div>
        <Issues issues={built.errors.filter((e) => !e.line)} />
        {used.error ? <Issues issues={[{ code: 'used', message: `Used states: ${used.error}`, at: [0, 0] }]} /> : null}
        {model?.warnings.length ? <Issues issues={model.warnings} kind="warning" /> : null}
      </Fold>

      {model ? (
        <>
          <Stage>
            <Board
              title="State diagram"
              step={simFrame ? `Clock ${simFrame.clock}` : rowNow && a ? `Row ${rowNow.index}` : undefined}
              tools={<Toggle label="Show only what this step uses" checked={focus} onChange={setFocus} hint="Hides every arrow except this step's transition." />}
              play={count ? <PlayBar stepper={stepper} start={mode === 'rows' ? 'Build the state table' : 'Clock the circuit'} next={(i) => (mode === 'rows' ? `row ${a?.rows[a.frames[i]?.row ?? 0]?.index ?? i}` : `clock ${sim?.frames[i]?.clock ?? i}`)} /> : null}
              foot={
                <>
                  <Legend
                    items={[
                      { signal: 'path', label: shownPath ? 'current transition and the chosen unused-state path' : 'current state and transition' },
                      { signal: 'dontcare', label: 'unused state (dashed, hatched)' },
                    ]}
                  />
                  <span className="seq-muted">
                    <W e={model.graph.why}>{plural(model.graph.nodes.length, 'state')}, {plural(model.graph.edges.length, 'arrow')}</W>
                    {model.graph.stateOutputs ? ', outputs written inside the states' : ''}
                  </span>
                </>
              }
            >
              <Scroll label="State diagram">
                <StateDiagram graph={model.graph} current={count ? current : null} next={nextState} active={active} path={pathEdges} focus={focus} step={`${k}-${shownPath?.state ?? ''}`} label={`State diagram, ${plural(model.graph.nodes.length, 'state')}`} />
              </Scroll>
            </Board>
            <StepNote>
              {why ? <Narrate e={why} head={describe ? <span>{describe}</span> : undefined} /> : <p className="seq-muted">{nIn ? 'Type an input sequence to clock the circuit.' : 'Set the number of clocks.'}</p>}
            </StepNote>
          </Stage>

          <TabStrip
            label="Tables for this circuit"
            value={tab}
            onChange={setTab}
            tabs={[
              ...(mode === 'rows' && a ? [{ value: 'full', label: 'State table', body: <FullTable a={a} k={k} mode={mode} highlight={rowNow?.index} /> }] : []),
              ...(mode === 'sim' && sim && sim.frames.length ? [{ value: 'seq', label: 'Input sequence', body: <SequenceTable machine={model.machine} frames={sim.frames} k={k} why={sim.why} /> }] : []),
              { value: 'compact', label: 'Compact state table', body: <CompactTable machine={model.machine} current={count ? current : null} combo={combo} why={a?.why.compact} /> },
              ...(mode === 'sim' && a ? [{ value: 'full', label: 'State table', body: <FullTable a={a} k={k} mode={mode} highlight={simFrame ? (simFrame.state << a.inputs.length) | (simFrame.combo ?? 0) : undefined} /> }] : []),
              { value: 'checks', label: 'Checks', body: <Checks model={model} shown={shownPath?.state ?? null} onShow={(s) => setShown(s ?? -1)} /> },
              {
                value: 'notes',
                label: 'Course notes',
                body: (
                  <div className="seq-notes">
                    <Callout kind="trap" title="Two-letter names" cite="L19 p36">
                      JA means input J of flip-flop A: the input letter first, then the flip-flop.
                    </Callout>
                    <Callout kind="trap" title="Q' is not the next state" cite="R10 p20; L19 p28">
                      Q' is the complement of Q. The next state is written A+ or A(t+1).
                    </Callout>
                    <Callout kind="course" title="Reading the diagram" cite="L19 p30, p33; T09 Q1">
                      Arrows are labelled input/output. An output that depends only on the state is written inside the circle as state/output. A state table for m flip-flops and n inputs has 2^(m+n) rows, state bits first, MSB first.
                    </Callout>
                  </div>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </Workspace>
  )
}

/** Sinks, unreachable states and the self-correcting verdict with its paths. */
export function Checks({
  model,
  shown,
  onShow,
}: {
  model: Pick<Model, 'machine' | 'graph' | 'sinks' | 'sc'>
  /** Unused state whose path is drawn on the state diagram. */
  shown?: number | null
  onShow?: (state: number | null) => void
}) {
  const { machine: m, graph, sinks, sc } = model
  const unreachable = graph.nodes.filter((n) => n.unreachable && n.used).map((n) => n.label)
  return (
    <div className="seq-checks">
      <dl className="seq-dl">
        <dt>Sinks</dt>
        <dd>
          <W e={{ rule: 'A sink is a state that, once entered, is never left.', working: sinks.length ? `${sinks.map((s) => m.labels[s]).join(', ')}: every arrow out loops back` : 'none: every state has a way out', cite: 'T09 Q1' }}>
            {sinks.length ? sinks.map((s) => m.labels[s]).join(', ') : 'none'}
          </W>
        </dd>
        <dt>Unreachable</dt>
        <dd>
          <W e={{ rule: 'A state no other used state can lead to, by any input sequence.', working: unreachable.length ? unreachable.join(', ') : 'none', cite: 'T09 Q1(d); R10 p66' }}>{unreachable.length ? unreachable.join(', ') : 'none'}</W>
        </dd>
        <dt>Self-correcting</dt>
        <dd>
          {!sc.applicable ? (
            <span className="seq-muted">every state is used</span>
          ) : !sc.determined ? (
            <Chip signal="dontcare">not determined</Chip>
          ) : (
            <>
              <Chip signal={sc.course ? 'hit' : 'miss'}>{sc.course ? 'yes' : 'no'}</Chip>{' '}
              <span className="seq-muted">
                strict reading: <W e={sc.why}>{sc.strict ? 'yes' : 'no'}</W>
              </span>
            </>
          )}
        </dd>
      </dl>
      {sc.applicable ? (
        <>
          <p className="seq-sentence">
            <W e={sc.why}>{sc.sentence}</W>
          </p>
          {sc.determined ? (
            <ul className="seq-paths">
              {sc.paths.map((p) => (
                <li key={p.state}>
                  <Chip signal={p.reaches ? 'hit' : 'miss'}>{p.reaches ? 'reaches a used state' : 'lockout'}</Chip> <span className="mono">{p.text}</span>
                  {p.canStay && p.reaches ? <span className="seq-muted"> (can also stay unused)</span> : null}
                  {onShow && p.path.length > 1 ? (
                    <>
                      {' '}
                      <button type="button" className="btn btn-plain seq-showpath" aria-pressed={shown === p.state} onClick={() => onShow(shown === p.state ? null : p.state)}>
                        {shown === p.state ? 'Hide on diagram' : 'Show on diagram'}
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <Callout kind="course" title="Two readings" cite="R10 p40-43; T09 Ans p3; AY23/24 S1 Q18">
            The keys say yes when every unused state has a path to a used state, even if another input keeps it unused. The strict reading also asks that no input sequence keeps it unused forever.
          </Callout>
        </>
      ) : null}
    </div>
  )
}

function SequenceTable({ machine: m, frames, k, why }: { machine: Machine; frames: SimFrame[]; k: number; why: { rule: string; working?: string; cite?: string } }) {
  const name = (s: number | null) => (s === null ? '?' : m.bits.length ? `${m.labels[s]} (${bin(s, m.bits.length)})` : m.labels[s])
  const cols: Column<SimFrame>[] = [
    { key: 'c', header: 'Clock', align: 'right', mono: true, cell: (f) => f.clock },
    { key: 's', header: 'State', mono: true, cell: (f) => name(f.state) },
    ...(m.inputs.length ? [{ key: 'i', header: m.inputs.join(''), align: 'center' as const, mono: true, cell: (f: SimFrame) => (f.combo === null ? '' : comboText(m, f.combo)) }] : []),
    ...(m.outputs.length ? [{ key: 'o', header: m.outputs.join(''), align: 'center' as const, mono: true, cell: (f: SimFrame) => <W e={f.why}>{f.out.join('')}</W> }] : []),
    { key: 'n', header: 'Next', mono: true, cell: (f) => <W e={f.why}>{name(f.next)}</W> },
  ]
  return (
    <DataTable compact columns={cols} rows={frames} rowSignal={(_, i) => (i === k ? 'path' : undefined)} caption={<W e={why}>{why.working}</W>} />
  )
}

function CompactTable({ machine: m, current, combo, why }: { machine: Machine; current: number | null; combo: number | null; why?: { rule: string; working?: string; cite?: string } }) {
  const n = m.inputs.length
  const combos = Array.from({ length: 1 << n }, (_, c) => c)
  const lab = (s: number) => (m.bits.length ? bin(s, m.bits.length) : m.labels[s])
  const used = new Set(m.used)
  type Row = { s: number }
  const cols: Column<Row>[] = [
    { key: 's', header: 'Present', mono: true, cell: (r) => `${lab(r.s)}${m.bits.length ? ` (${r.s})` : ''}${used.has(r.s) ? '' : ', unused'}` },
    ...combos.map((c) => ({
      key: `c${c}`,
      header: n ? `${m.inputs.join('')} = ${comboText(m, c)}` : 'Next',
      mono: true,
      cell: (r: Row) => {
        const nx = m.next[r.s][c]
        const out = m.out[r.s][c]
        const txt = `${nx === null ? 'X' : lab(nx)}${out.length ? ` / ${out.join('')}` : ''}`
        return <span className={r.s === current && c === combo ? 'seq-cell-now' : nx === null ? 'seq-vx' : undefined}>{txt}</span>
      },
    })),
  ]
  return (
    <DataTable
      compact
      columns={cols}
      rows={m.labels.map((_, s) => ({ s }))}
      rowSignal={(r) => (r.s === current ? 'path' : used.has(r.s) ? undefined : 'dontcare')}
      caption={why ? <W e={why}>{why.working}</W> : 'next state / output, one column per input value (L19 p32)'}
    />
  )
}

function FullTable({ a, k, mode, highlight }: { a: Analysis; k: number; mode: StepMode; highlight?: number }) {
  const shownUpTo = mode === 'rows' ? (a.frames[k]?.row ?? 0) : a.rows.length - 1
  const hide = (r: AnalysisRow) => r.index > shownUpTo
  const cols: Column<AnalysisRow>[] = [
    ...a.bits.map((b, i) => ({ key: `p${b}`, header: b, align: 'center' as const, mono: true, cell: (r: AnalysisRow) => r.present[i] })),
    ...a.inputs.map((x, i) => ({ key: `i${x}`, header: x, align: 'center' as const, mono: true, cell: (r: AnalysisRow) => r.inputs[i] })),
    ...(a.rows[0]?.ffInputs ?? []).map((f, j) => ({ key: `f${f.label}`, header: f.label, align: 'center' as const, mono: true, cell: (r: AnalysisRow) => (hide(r) ? '' : <Bitv v={r.ffInputs[j].value} e={r.ffInputs[j].why} />) })),
    ...a.bits.map((b, i) => ({ key: `n${b}`, header: `${b}+`, align: 'center' as const, mono: true, cell: (r: AnalysisRow) => (hide(r) ? '' : <Bitv v={r.next[i]} e={r.nextWhy[i]} />) })),
    ...a.outputs.map((o, i) => ({ key: `o${o}`, header: o, align: 'center' as const, mono: true, cell: (r: AnalysisRow) => (hide(r) ? '' : <Bitv v={r.outputs[i].value} e={r.outputs[i].why} />) })),
  ]
  return (
    <DataTable
        compact
        columns={cols}
        rows={a.rows}
        rowSignal={(r) => (r.index === highlight ? 'path' : r.nextState === null && !hide(r) ? 'miss' : undefined)}
        caption={
          <>
            <W e={a.why.rows}>{plural(a.rows.length, 'row')}</W>. Equations:{' '}
            {a.equations.map((e, i) => (
              <span key={e.label} className="mono">
                {i ? '; ' : ''}
                {e.label} = {e.text}
              </span>
            ))}
          </>
        }
      />
  )
}
