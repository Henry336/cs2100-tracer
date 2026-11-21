import { useMemo, useState, type ReactNode } from 'react'
import { bin, design, parseSequence, FF_INPUTS, FLIP_FLOPS, type Design, type DesignFrame, type DesignFunction, type DesignPhase, type DesignRow, type FFType, type Sig, type TableRow, type UnusedTransition } from '../../core/sequential'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, Presets, Segmented, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { Checks } from './AnalysisTab'
import { Bitv, Board, Fold, Issues, Narrate, PlayBar, Scroll, Story, TabStrip, W, bool, parseOverrides, pick, plural, splitNames, str } from './common'
import { KMap } from './KMap'
import { DESIGN_PRESETS } from './presets'
import { StateDiagram, type EdgeRef } from './StateDiagram'

const FF_TYPES: FFType[] = ['D', 'T', 'JK', 'SR']
const FF_LABEL: Record<FFType, string> = { D: 'D', T: 'T', JK: 'J-K', SR: 'S-R' }
const PHASES: { phase: DesignPhase | 'table'; label: string; cite: string }[] = [
  { phase: 'table', label: 'State table and flip-flop types', cite: 'L19 p46' },
  { phase: 'excite', label: 'Excitation table', cite: 'L19 p45, p48' },
  { phase: 'kmap', label: 'K-maps and equations', cite: 'L19 p50, p56' },
  { phase: 'commit', label: "Commit the don't-cares", cite: 'T09 Ans p3' },
  { phase: 'unused', label: 'Where unused states go', cite: 'L19 p55-57' },
  { phase: 'verdict', label: 'Self-correcting check', cite: 'R10 p40-43' },
]
const ORDER: DesignPhase[] = ['excite', 'kmap', 'commit', 'unused', 'verdict']
const SOURCE_TEXT = { sop: 'minimal SOP', 'single-gate': 'one gate', yours: 'yours' } as const

/** Rows from the URL, cleaned and fitted to the current number of input combinations and outputs. */
function normRows(raw: unknown, combos: number, nOut: number): TableRow[] {
  if (!Array.isArray(raw)) return []
  const out: TableRow[] = []
  for (const r of raw as Partial<TableRow>[]) {
    if (!r || typeof r.state !== 'number' || !Number.isInteger(r.state) || r.state < 0) continue
    if (out.some((x) => x.state === r.state)) continue
    const next = Array.from({ length: combos }, (_, c) => {
      const v = Array.isArray(r.next) ? r.next[c] : null
      return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null
    })
    const o = nOut
      ? Array.from({ length: combos }, (_, c) =>
          Array.from({ length: nOut }, (_, k): Sig => {
            const v = Array.isArray(r.out) && Array.isArray(r.out[c]) ? r.out[c][k] : 'X'
            return v === 0 || v === 1 ? v : 'X'
          }),
        )
      : undefined
    out.push({ state: r.state, next, out: o })
  }
  return out.sort((a, b) => a.state - b.state)
}

export default function DesignTab({ intro }: { intro: ReactNode }) {
  const first = DESIGN_PRESETS[0]
  const [rawBits, setBits] = useUrlState<string>('dbt', first.bits)
  const [rawIns, setIns] = useUrlState<string>('din', first.inputs)
  const [rawOuts, setOuts] = useUrlState<string>('dou', first.outputs)
  const [rawTypes, setTypes] = useUrlState<FFType[]>('dty', first.types)
  const [rawRows, setRows] = useUrlState<TableRow[]>('drw', first.rows)
  const [rawPrefer, setPrefer] = useUrlState<'sop' | 'fewest-gates'>('dpr', 'sop')
  const [rawOv, setOv] = useUrlState<string>('dov', '')
  const [rawSeq, setSeq] = useUrlState<string>('dsq', '')
  const [rawFocus, setFocus] = useUrlState<boolean>('dfo', false)
  const [rawPickFn, setPickFn] = useUrlState<string>('dkf', '')
  const [seqError, setSeqError] = useState('')
  const [tab, setTab] = useUrlState<string>('dtab', 'eq')

  const bits = splitNames(str(rawBits, 'A, B'))
  const inputs = splitNames(str(rawIns, ''))
  const outputs = splitNames(str(rawOuts, ''))
  const m = bits.length
  const n = inputs.length
  const combos = 1 << n
  const types: FFType[] = bits.map((_, i) => pick(Array.isArray(rawTypes) ? rawTypes[i] : undefined, FF_TYPES, 'D'))
  const rows = normRows(rawRows, combos, outputs.length).filter((r) => r.state < 1 << Math.min(m, 5))
  const prefer = pick(rawPrefer, ['sop', 'fewest-gates'] as const, 'sop')
  const ovText = str(rawOv, '')
  const ov = parseOverrides(ovText)
  const focus = bool(rawFocus, false)
  const tooBig = m > 5 || m + n > 8

  const key = JSON.stringify([bits, inputs, outputs, types, rows, prefer, ov.map])
  const result = useMemo(
    () => (m && !tooBig ? design({ bits, inputs, outputs, rows, types, prefer, overrides: Object.keys(ov.map).length ? ov.map : undefined }) : null),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const d: Design | null = result?.ok ? result.design : null
  const frames = d?.frames ?? []
  const stepper = useStepper(frames.length)
  const k = Math.min(stepper.index, Math.max(0, frames.length - 1))
  const frame: DesignFrame | undefined = frames[k]
  const phase = frame?.phase
  const phaseAt = (p: DesignPhase) => ORDER.indexOf(p)
  const reached = (p: DesignPhase) => !!phase && phaseAt(phase) >= phaseAt(p)
  const firstOf = (p: DesignPhase) => frames.findIndex((f) => f.phase === p)

  const labels = d?.functions.map((f) => f.label) ?? []
  const unknownOv = Object.keys(ov.map).filter((l) => d && !labels.includes(l))
  const fnIndex = frame && (phase === 'kmap' || phase === 'commit') && frame.fn !== undefined ? frame.fn : Math.max(0, labels.indexOf(str(rawPickFn, '')))

  const write = (next: TableRow[]) => setRows(next.sort((a, b) => a.state - b.state))
  const setUsed = (s: number, on: boolean) =>
    write(on ? [...rows, { state: s, next: Array.from({ length: combos }, () => null), out: outputs.length ? Array.from({ length: combos }, () => outputs.map((): Sig => 'X')) : undefined }] : rows.filter((r) => r.state !== s))
  const setNext = (s: number, c: number, v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    write(rows.map((r) => (r.state === s ? { ...r, next: r.next.map((x, i) => (i === c ? (digits ? Number(digits) : null) : x)) } : r)))
  }
  const setOut = (s: number, c: number, v: string) => {
    const chars = v.toUpperCase().replace(/[^01X]/g, '').slice(-outputs.length).padStart(outputs.length, 'X').split('')
    const val = chars.map((ch): Sig => (ch === '0' ? 0 : ch === '1' ? 1 : 'X'))
    write(rows.map((r) => (r.state === s ? { ...r, out: (r.out ?? []).map((o, i) => (i === c ? val : o)) } : r)))
  }

  const toolbar = (
    <Presets
      presets={DESIGN_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setBits(p.bits)
        setIns(p.inputs)
        setOuts(p.outputs)
        setTypes(p.types)
        setRows(p.rows)
        setPrefer(p.prefer ?? 'sop')
        setOv(p.overrides ?? '')
        setPickFn('')
        stepper.first()
      }}
    />
  )

  const anySR = types.includes('SR')
  const kmapFn = phase === 'kmap' || phase === 'commit' ? fnIndex : -1
  const kmapProps = { index: fnIndex, driven: phase === 'kmap' || phase === 'commit', committed: reached('commit') && (phase !== 'commit' || (frame?.fn ?? 0) >= fnIndex), onPick: (l: string) => setPickFn(l) }
  const unusedIndex = phase === 'unused' ? k - firstOf('unused') : -1
  const summary = `${plural(rows.length, 'used state')}; flip-flops ${bits.map((b, i) => `${b} ${FF_LABEL[types[i]]}`).join(', ') || 'none'}; ${n ? `input${n > 1 ? 's' : ''} ${inputs.join(', ')}` : 'no inputs'}`
  const errorList = [
    ...(tooBig ? [{ code: 'size', message: 'use at most 5 state bits, and at most 8 state bits and inputs together', at: [0, 0] as [number, number] }] : []),
    ...(result && !result.ok ? result.errors : []),
  ]

  let board: ReactNode = null
  if (!d) {
    board = (
      <Board title="Design wizard">
        <p className="seq-muted">Fill in the state table above to start.</p>
      </Board>
    )
  } else if (phase === 'kmap' || phase === 'commit') {
    board = (
      <Board
        title={`K-map for ${d.functions[fnIndex]?.label ?? ''}`}
        step={frame?.title}
        play={<PlayBar stepper={stepper} label="Design it step by step" next="Next step" />}
        foot={<Legend items={[{ signal: 'dontcare', label: "X: don't care, d(1) or d(0) once committed" }]} />}
      >
        <KMapView d={d} {...kmapProps} step={k} />
      </Board>
    )
  } else if (phase === 'unused' || phase === 'verdict') {
    const u = unusedIndex >= 0 ? d.unusedTransitions[unusedIndex] : undefined
    const sc = d.analysis.selfCorrection
    const path: EdgeRef[] = phase === 'verdict' ? sc.paths.flatMap((p) => p.path.slice(1).map((to, i) => ({ from: p.path[i], to }))) : []
    board = (
      <Board
        title="State diagram of the built circuit"
        step={frame?.title}
        actions={<Toggle label="Show only what this step uses" checked={focus} onChange={setFocus} hint="Hides every arrow this step does not use." />}
        play={<PlayBar stepper={stepper} label="Design it step by step" next="Next step" />}
        foot={<Legend items={[{ signal: 'path', label: phase === 'verdict' ? 'paths back to a used state' : 'this transition' }, { signal: 'dontcare', label: 'unused state (dashed, hatched)' }]} />}
      >
        <Scroll label="State diagram of the designed circuit">
          <StateDiagram graph={d.analysis.graph} current={u ? u.state : null} next={u?.next ?? null} active={u && u.next !== null ? { from: u.state, to: u.next } : null} path={path} focus={focus} step={k} label="State diagram of the designed circuit, unused states included" />
        </Scroll>
      </Board>
    )
  } else {
    board = (
      <Board
        title="Excitation table"
        step={frame?.title}
        play={<PlayBar stepper={stepper} label="Design it step by step" next="Next step" />}
        foot={<Legend items={[{ signal: 'path', label: 'this row' }, { signal: 'dontcare', label: "don't care (X)" }]} />}
      >
        <ExciteTable d={d} frame={frame} reached={reached} fnIndex={kmapFn} />
      </Board>
    )
  }

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      toolbar={toolbar}
      transport={frames.length ? <Transport stepper={stepper} label="step" marks={frames.map((f) => (f.phase === 'verdict' ? 'hit' : f.phase === 'unused' ? 'dontcare' : f.phase === 'excite' ? undefined : 'control'))} describe={frame?.title} /> : undefined}
    >
      <Fold
        summary={
          <>
            State table: <span className="seq-fold-sum">{summary}</span>
          </>
        }
        whenClosed={<Issues issues={errorList} />}
      >
        <div className="seq-row">
          <TextField label="State bits, MSB first" value={str(rawBits, '')} onChange={setBits} width="9em" />
          <TextField label="Inputs, MSB first" value={str(rawIns, '')} onChange={setIns} placeholder="none" width="8em" />
          <TextField label="Outputs" value={str(rawOuts, '')} onChange={setOuts} placeholder="none" width="8em" />
          <Segmented
            label="Equations"
            value={prefer}
            onChange={setPrefer}
            options={[
              { value: 'sop', label: 'minimal SOP', title: 'First minimal SOP of each K-map (L19 p50)' },
              { value: 'fewest-gates', label: 'fewest gates', title: 'Take one gate when it fits and costs less (T09 Q2)' },
            ]}
          />
        </div>
        <div className="seq-row">
          {bits.map((b, i) => (
            <Segmented
              key={b + i}
              label={`Flip-flop ${b}`}
              value={types[i]}
              onChange={(v) => setTypes(types.map((t, j) => (j === i ? v : t)))}
              options={FF_TYPES.map((t) => ({ value: t, label: FF_LABEL[t], title: FLIP_FLOPS[t].name }))}
            />
          ))}
        </div>
        {tooBig ? <Issues issues={[{ code: 'size', message: 'use at most 5 state bits, and at most 8 state bits and inputs together', at: [0, 0] }]} /> : null}
        {!tooBig && m ? (
          <Scroll label="State table editor">
            <table className="dtable dtable-compact seq-editor">
              <thead>
                <tr>
                  <th>Used</th>
                  <th>Present</th>
                  {Array.from({ length: combos }, (_, c) => (
                    <th key={c}>{n ? `${inputs.join('')} = ${bin(c, n)}` : 'Next'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 1 << m }, (_, s) => {
                  const row = rows.find((r) => r.state === s)
                  return (
                    <tr key={s} className={row ? undefined : 'row-dontcare'}>
                      <td>
                        <input type="checkbox" checked={!!row} onChange={(e) => setUsed(s, e.target.checked)} aria-label={`State ${s} is used`} />
                      </td>
                      <td className="mono">
                        {bin(s, m)} ({s})
                      </td>
                      {Array.from({ length: combos }, (_, c) => (
                        <td key={c} className="mono">
                          {row ? (
                            <span className="seq-cellin">
                              <input
                                className="mono"
                                value={row.next[c] === null ? 'X' : String(row.next[c])}
                                onChange={(e) => setNext(s, c, e.target.value)}
                                aria-label={`Next state of ${s}${n ? ` on ${inputs.join('')} = ${bin(c, n)}` : ''}`}
                                size={3}
                              />
                              {outputs.length ? (
                                <>
                                  <span aria-hidden="true">/</span>
                                  <input
                                    className="mono"
                                    value={(row.out?.[c] ?? []).join('')}
                                    onChange={(e) => setOut(s, c, e.target.value)}
                                    aria-label={`Output ${outputs.join('')} of ${s}${n ? ` on ${inputs.join('')} = ${bin(c, n)}` : ''}`}
                                    size={Math.max(2, outputs.length)}
                                  />
                                </>
                              ) : null}
                            </span>
                          ) : (
                            <span className="seq-muted">unused</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Scroll>
        ) : null}
        <p className="seq-muted">Next states are decimal; X leaves an entry open. Untick a state to make it unused.</p>
        {n === 0 ? (
          <div className="seq-row">
            <TextField label="Or type a sequence" value={str(rawSeq, '')} onChange={setSeq} placeholder="1→3→5→7→1" width="16em" />
            <Button
              onClick={() => {
                const p = parseSequence(str(rawSeq, ''))
                if (!p.ok) setSeqError(p.errors.map((e) => e.message).join('; '))
                else {
                  setSeqError('')
                  write(p.rows)
                  stepper.first()
                }
              }}
            >
              Fill the table
            </Button>
          </div>
        ) : null}
        {seqError ? <Issues issues={[{ code: 'seq', message: seqError, at: [0, 0] }]} /> : null}
        <div className="seq-row">
          <div className="seq-grow">
            <label className="field seq-areafield">
              <span className="control-label">Your equations (optional), one per line, e.g. JA = B ⊕ x</span>
              <span className="field-box">
                <textarea className="mono seq-area" rows={3} value={ovText} spellCheck={false} onChange={(e) => setOv(e.target.value)} />
              </span>
            </label>
          </div>
        </div>
        <Issues issues={[...ov.bad, ...unknownOv.map((l) => `${l} is not a flip-flop input or output of this design (${labels.join(', ')})`)].map((message) => ({ code: 'ov', message, at: [0, 0] as [number, number] }))} kind="warning" />
        {result && !result.ok ? <Issues issues={result.errors} /> : null}
      </Fold>

      <div className="seq-stage">
        {board}
        <Story
          items={PHASES.map((p) => {
            const state = p.phase === 'table' ? 'past' : !phase ? 'next' : p.phase === phase ? 'now' : reached(p.phase) ? 'past' : 'next'
            return { title: p.label, state, onPick: p.phase === 'table' || !d ? undefined : () => stepper.set(firstOf(p.phase as DesignPhase)) }
          })}
        >
          {frame ? <Narrate e={frame.why} head={<Chip signal="path">{frame.title}</Chip>} /> : null}
        </Story>
      </div>

      {d ? (
        <TabStrip
          label="Design tables"
          value={tab}
          onChange={setTab}
          tabs={[
            ...(phase !== 'excite' ? [{ value: 'excite', label: 'Excitation table', body: <ExciteTable d={d} frame={frame} reached={reached} fnIndex={kmapFn} /> }] : []),
            ...(reached('kmap') ? [{ value: 'eq', label: 'Equations', body: <EquationsTable d={d} upto={phase === 'kmap' ? fnIndex : d.functions.length - 1} now={kmapFn} /> }] : []),
            ...(reached('unused') ? [{ value: 'kmaps', label: 'K-maps', body: <KMapView d={d} {...kmapProps} /> }] : []),
            ...(reached('unused') ? [{ value: 'unused', label: 'Unused states', body: <UnusedTable d={d} now={unusedIndex} /> }] : []),
            ...(phase === 'verdict' ? [{ value: 'checks', label: 'Checks', body: <Checks model={{ machine: d.analysis.machine, graph: d.analysis.graph, sinks: d.analysis.sinks, sc: d.analysis.selfCorrection }} /> }] : []),
            ...(phase === 'verdict' ? [{ value: 'circuit', label: 'Circuit', body: <CircuitList d={d} /> }] : []),
            {
              value: 'notes',
              label: 'Course notes',
              body: (
                <div className="seq-notes">
                  <Callout kind="trap" title="Don't-cares become real arrows" cite="T09 Ans p3; L19 p55-57">
                    The don't-cares make the equations smaller. Once the equations are fixed, every X has a value, and that decides where each unused state goes. Check the unused states after the equations.
                  </Callout>
                  <Callout kind="course" title="Counting gates" cite="AY23/24 S1 Ans p13; T09 Q2">
                    Each flip-flop gives Q' for free, so a complemented state variable needs no inverter. Fewest gates is not always the simplest SOP: try one XOR or XNOR, or a constant.
                  </Callout>
                  <Callout kind="course" title="K-map layout" cite="L19 p50, p56">
                    The course puts the state bits on the rows (A, AB) and the rest on the columns (x, Cx).
                  </Callout>
                  {n >= 2 ? (
                    <Callout kind="course" title="Separate inputs" cite="T09 Ans p5">
                      Inputs such as x and y are separate lines, not one 2-bit number. A combination that cannot happen is left as X.
                    </Callout>
                  ) : null}
                  {anySR ? (
                    <Callout kind="trap" title="S-R needs S∙R = 0" cite="L19 p11, p56; R10 p43">
                      An S-R flip-flop must never get S = R = 1, including on the don't-cares after they are committed. The wizard picks a pair of minimal SOPs that keeps S∙R = 0.
                    </Callout>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      ) : null}
    </Workspace>
  )
}

function ExciteTable({ d, frame, reached, fnIndex }: { d: Design; frame?: DesignFrame; reached: (p: DesignPhase) => boolean; fnIndex: number }) {
  const { bits, inputs } = d.spec
  const outputs = d.spec.outputs ?? []
  const excite = frame?.phase === 'excite'
  const upto = excite ? (frame?.row ?? 0) : reached('kmap') ? d.rows.length - 1 : -1
  const fnLabel = fnIndex >= 0 ? d.functions[fnIndex]?.label : undefined
  const hide = (r: DesignRow) => r.index > upto
  const head = (l: string) => (l === fnLabel ? <span className="seq-colnow">{l}</span> : l)
  const cols: Column<DesignRow>[] = [
    ...bits.map((b, i) => ({ key: `p${b}`, header: b, align: 'center' as const, mono: true, cell: (r: DesignRow) => r.present[i] })),
    ...inputs.map((x, i) => ({ key: `i${x}`, header: x, align: 'center' as const, mono: true, cell: (r: DesignRow) => r.inputs[i] })),
    ...bits.map((b, i) => ({ key: `n${b}`, header: `${b}+`, align: 'center' as const, mono: true, cell: (r: DesignRow) => (hide(r) ? '' : <Bitv v={r.next[i]} />) })),
    ...(d.rows[0]?.ffInputs ?? []).map((f, j) => ({ key: `f${f.label}`, header: head(f.label), align: 'center' as const, mono: true, cell: (r: DesignRow) => (hide(r) ? '' : <Bitv v={r.ffInputs[j].value} e={r.ffInputs[j].why} />) })),
    ...outputs.map((o, k) => ({ key: `o${o}`, header: head(o), align: 'center' as const, mono: true, cell: (r: DesignRow) => (hide(r) ? '' : <Bitv v={r.outputs[k].value} e={r.outputs[k].why} />) })),
  ]
  return (
    <DataTable
      compact
      columns={cols}
      rows={d.rows}
      rowSignal={(r) => (excite && r.index === frame?.row ? 'path' : !r.specified ? 'dontcare' : undefined)}
      caption={`${plural(d.rows.length, 'row')}: ${d.used.length} used state${d.used.length === 1 ? '' : 's'}${d.unused.length ? `, unused ${d.unused.join(', ')} (don't-cares)` : ''}.`}
    />
  )
}

function KMapView({ d, index, driven, committed, onPick, step }: { d: Design; index: number; driven: boolean; committed: boolean; onPick: (l: string) => void; step?: number }) {
  const f: DesignFunction | undefined = d.functions[index]
  if (!f) return null
  const cover = f.min.covers.find((c) => c.text === f.chosen.text)
  const loops = cover && f.kmap ? cover.primes.map((id) => f.min.primes.find((p) => p.id === id)).filter((p) => !!p?.pieces).map((p) => ({ key: String(p!.id), pieces: p!.pieces!, term: p!.term })) : []
  const comm = committed ? new Map(f.committed.map((c) => [c.cell, c.value])) : undefined
  return (
    <div className="seq-kmapview">
      {driven ? null : <Segmented label="Function" value={f.label} onChange={onPick} options={d.functions.map((g) => ({ value: g.label, label: g.label }))} />}
      {f.kmap ? (
        <Scroll label={`K-map for ${f.label}`}>
          <KMap layout={f.kmap.layout} values={f.kmap.values} loops={loops} committed={comm} step={step ?? f.label} label={`K-map for ${f.label}`} />
        </Scroll>
      ) : (
        <p className="seq-muted">
          K-maps are drawn for 2 to 5 variables; this one has {d.vars.length}. Minterms: Σm({f.fn.on.join(', ')}){f.fn.dc.length ? ` + d(${f.fn.dc.join(', ')})` : ''}.
        </p>
      )}
      <p className="seq-eqline mono">
        {f.label} = <W e={f.chosen.why}>{f.chosen.text}</W> <Chip signal={f.chosen.source === 'yours' ? (f.check?.ok ? 'hit' : 'miss') : 'control'}>{SOURCE_TEXT[f.chosen.source]}</Chip>
      </p>
      {loops.length ? <p className="seq-muted">Loops: {loops.map((l) => l.term).join(', ')}.</p> : f.kmap ? <p className="seq-muted">No loops: this equation is not one SOP read off the map.</p> : null}
      {f.sop.length > 1 ? <p className="seq-muted">Other minimal SOPs: {f.sop.filter((s) => s !== f.chosen.text).join('; ')}</p> : null}
      {comm && f.committed.length ? (
        <p className="seq-muted">
          <W e={{ rule: "After choosing the equation, each don't-care takes the value the equation gives it.", working: f.committed.map((c) => `m${c.cell}: d(${c.value})`).join(', '), cite: 'T09 Ans p3' }}>
            Committed don't-cares: {f.committed.filter((c) => c.value === 1).length} became 1, {f.committed.filter((c) => c.value === 0).length} became 0
          </W>
        </p>
      ) : null}
    </div>
  )
}

function EquationsTable({ d, upto, now }: { d: Design; upto: number; now: number }) {
  const rows = d.functions.slice(0, upto + 1)
  const cols: Column<DesignFunction>[] = [
    { key: 'l', header: 'Input', mono: true, cell: (f) => f.label },
    { key: 'e', header: 'Equation', mono: true, cell: (f) => <W e={f.chosen.why}>{f.chosen.text}</W> },
    { key: 's', header: 'From', cell: (f) => SOURCE_TEXT[f.chosen.source] },
    { key: 'g', header: 'Gates', align: 'right', mono: true, cell: (f) => <W e={f.gates.why}>{f.gates.gates}</W> },
    {
      key: 'c',
      header: 'Your check',
      cell: (f) => (f.check ? <W e={f.check.why}><Chip signal={f.check.ok ? 'hit' : 'miss'}>{f.check.ok ? 'matches' : 'differs'}</Chip></W> : <span className="seq-muted">none</span>),
    },
  ]
  return (
    <>
      <DataTable
        compact
        columns={cols}
        rows={rows}
        rowSignal={(_, i) => (i === now ? 'path' : undefined)}
        caption={
          upto === d.functions.length - 1 ? (
            <>
              Total: <W e={d.total.why}>{plural(d.total.gates, 'gate')}</W>, with Q' free.{' '}
              {d.verified ? <Chip signal="hit">every specified transition reproduced</Chip> : <Chip signal="miss">{plural(d.mismatches.length, 'mismatch', 'mismatches')}</Chip>}
            </>
          ) : undefined
        }
      />
      {d.mismatches.length ? <Issues issues={d.mismatches.map((message) => ({ code: 'mismatch', message, at: [0, 0] as [number, number] }))} /> : null}
      {d.warnings.length ? <Issues issues={d.warnings} kind="warning" /> : null}
    </>
  )
}

function UnusedTable({ d, now }: { d: Design; now: number }) {
  const { inputs } = d.spec
  const n = inputs.length
  if (!d.unusedTransitions.length) return <p>Every state is used.</p>
  const cols: Column<UnusedTransition>[] = [
    { key: 's', header: 'Unused state', mono: true, cell: (u) => `${u.state} (${bin(u.state, d.spec.bits.length)})` },
    ...(n ? [{ key: 'c', header: inputs.join(''), align: 'center' as const, mono: true, cell: (u: UnusedTransition) => bin(u.combo, n) }] : []),
    { key: 'f', header: 'Flip-flop inputs', mono: true, cell: (u) => d.analysis.rows[(u.state << n) | u.combo].ffInputs.map((f) => `${f.label} = ${f.value}`).join(', ') },
    { key: 'n', header: 'Next', mono: true, cell: (u) => <W e={u.why}>{u.next === null ? 'unpredictable' : String(u.next)}</W> },
    ...(hasOutputs(d) ? [{ key: 'o', header: (d.spec.outputs ?? []).join(''), align: 'center' as const, mono: true, cell: (u: UnusedTransition) => u.out.join('') }] : []),
  ]
  return <DataTable compact columns={cols} rows={d.unusedTransitions} rowSignal={(_, i) => (i === now ? 'path' : undefined)} caption="Each unused state put into the chosen equations (T09 Ans p3)." />
}
const hasOutputs = (d: Design) => (d.spec.outputs ?? []).length > 0

function CircuitList({ d }: { d: Design }) {
  return (
    <ul className="seq-eqs">
      {d.circuit.flipFlops.map((ff) => (
        <li key={ff.name} className="mono">
          {FF_INPUTS[ff.type].map((l) => `${l}${ff.name} = ${ff.inputs[l]}`).join(';  ')}
        </li>
      ))}
      {(d.circuit.outputs ?? []).map((o) => (
        <li key={o.name} className="mono">
          {o.name} = {o.expr}
        </li>
      ))}
    </ul>
  )
}
