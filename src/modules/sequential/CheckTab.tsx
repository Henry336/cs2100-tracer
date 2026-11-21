import { useMemo, type ReactNode } from 'react'
import { parseExpr, type Expr } from '../../core/boolean'
import { analyse, bin, comboText, parseCircuit, parseStateTable, totalGates, type Analysis, type Issue, type Sig } from '../../core/sequential'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Legend, Presets, TextField, Workspace, type Column } from '../../ui/kit'
import { Checks } from './AnalysisTab'
import { Board, Fold, Issues, Scroll, TabStrip, W, lineErrors, plural, splitNames, str } from './common'
import { CHECK_PRESETS } from './presets'
import { StateDiagram } from './StateDiagram'

interface CheckRow {
  state: number
  combo: number
  want: number | null
  wantOut: Sig[]
  got: number | null
  gotOut: Sig[]
  ok: boolean
}

export default function CheckTab({ intro }: { intro: ReactNode }) {
  const first = CHECK_PRESETS[0]
  const [rawEq, setEq] = useUrlState<string>('ceq', first.eq)
  const [rawTable, setTable] = useUrlState<string>('ctb', first.table)
  const [rawIn, setIn] = useUrlState<string>('cin', '')
  const eqText = str(rawEq, '')
  const tableText = str(rawTable, '')
  const inText = str(rawIn, '')
  const [tab, setTab] = useUrlState<string>('ctab', 'entries')

  const res = useMemo(() => {
    const ins = splitNames(inText)
    const p = parseCircuit(eqText, ins.length ? { inputs: ins } : {})
    if (!p.ok) return { eqErrors: p.errors, tableErrors: [] as Issue[], a: null, rows: [] as CheckRow[], used: [] as number[] }
    const nOut = p.circuit.outputs?.length ?? 0
    const t = parseStateTable(tableText, { inputs: p.circuit.inputs.length, outputs: nOut })
    if (!t.ok) return { eqErrors: [] as Issue[], tableErrors: t.errors, a: null, rows: [], used: [] }
    if (t.table.names.length) return { eqErrors: [], tableErrors: [{ code: 'named', message: 'number the states (0, 1, 2, ...) so they can be matched to the flip-flop bits', at: [0, 0] as [number, number] }], a: null, rows: [], used: [] }
    const count = 1 << p.circuit.flipFlops.length
    const bad = t.table.rows.flatMap((r) => [r.state, ...r.next.filter((x): x is number => x !== null)]).filter((s) => s >= count)
    if (bad.length) return { eqErrors: [], tableErrors: [{ code: 'range', message: `state ${bad[0]} does not fit in ${p.circuit.flipFlops.length} flip-flops (0 to ${count - 1})`, at: [0, 0] as [number, number] }], a: null, rows: [], used: [] }
    const used = t.table.rows.map((r) => r.state).sort((x, y) => x - y)
    const r = analyse({ ...p.circuit, used })
    if (!r.ok) return { eqErrors: r.errors, tableErrors: [], a: null, rows: [], used }
    const a: Analysis = r.analysis
    const rows: CheckRow[] = t.table.rows.flatMap((tr) =>
      tr.next.map((want, c) => {
        const got = a.machine.next[tr.state][c]
        const wantOut = tr.out?.[c] ?? []
        const gotOut = a.machine.out[tr.state][c]
        const ok = (want === null || want === got) && wantOut.every((v, i) => v === 'X' || v === gotOut[i])
        return { state: tr.state, combo: c, want, wantOut, got, gotOut, ok }
      }),
    )
    return { eqErrors: [], tableErrors: [], a, rows, used }
  }, [eqText, tableText, inText])

  const a = res.a
  const bitsN = a?.bits.length ?? 0
  const lab = (s: number | null) => (s === null ? 'X' : `${s} (${bin(s, bitsN)})`)
  const bad = res.rows.filter((r) => !r.ok)
  const gates = useMemo(() => {
    if (!a) return null
    const exprs = a.equations.map((e) => parseExpr(e.text)).flatMap((p): Expr[] => (p.ok ? [p.expr] : []))
    return totalGates(exprs, a.bits)
  }, [a])

  const cols: Column<CheckRow>[] = [
    { key: 's', header: 'Present', mono: true, cell: (r) => lab(r.state) },
    ...(a && a.inputs.length ? [{ key: 'c', header: a.inputs.join(''), align: 'center' as const, mono: true, cell: (r: CheckRow) => comboText(a.machine, r.combo) }] : []),
    { key: 'w', header: 'Table says', mono: true, cell: (r) => `${lab(r.want)}${r.wantOut.length ? ` / ${r.wantOut.join('')}` : ''}` },
    {
      key: 'g',
      header: 'Equations give',
      mono: true,
      cell: (r) => {
        const row = a?.rows[(r.state << (a?.inputs.length ?? 0)) | r.combo]
        const why = row
          ? { rule: "Evaluate each flip-flop input, then apply that flip-flop's characteristic table.", working: `${row.ffInputs.map((f) => `${f.label} = ${f.value}`).join(', ')}; ${row.nextWhy.map((w) => w.working).join('; ')}`, cite: 'L19 p36-43' }
          : undefined
        return <W e={why}>{`${r.got === null ? 'unpredictable' : lab(r.got)}${r.gotOut.length ? ` / ${r.gotOut.join('')}` : ''}`}</W>
      },
    },
    { key: 'ok', header: 'Check', cell: (r) => <Chip signal={r.ok ? 'hit' : 'miss'}>{r.ok ? 'matches' : 'differs'}</Chip> },
  ]

  const diffs = bad.filter((r) => r.got !== null).map((r) => ({ from: r.state, to: r.got! }))
  const errors = [...res.eqErrors, ...res.tableErrors]

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      toolbar={
        <Presets
          presets={CHECK_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
          onPick={(p) => {
            setEq(p.eq)
            setTable(p.table)
            setIn('')
          }}
        />
      }
    >
      <div className="seq-split">
        <div className="seq-grow">
          <CodeEditor label="Your equations, one per line, e.g. JA = B ⊕ x" value={eqText} onChange={setEq} rows={4} errors={lineErrors(res.eqErrors)} />
        </div>
        <div className="seq-grow">
          <CodeEditor label="State table to match: state: next/output per input value" value={tableText} onChange={setTable} rows={4} errors={lineErrors(res.tableErrors)} />
        </div>
      </div>
      <Issues issues={errors.filter((e) => !e.line)} />
      <Fold summary="Options">
        <div className="seq-row">
          <TextField label="Inputs, MSB first" value={inText} onChange={setIn} placeholder="auto" width="11em" />
          {a ? (
            <span className="seq-muted">
              State bits {a.bits.join('')}, inputs {a.inputs.join('') || 'none'}; states listed in the table count as used ({res.used.join(', ')}).
            </span>
          ) : null}
        </div>
      </Fold>

      {a ? (
        <>
          <Board
            title="State diagram of your circuit"
            step={bad.length ? <Chip signal="miss">{plural(bad.length, 'entry', 'entries')} differ</Chip> : <Chip signal="hit">all {res.rows.length} entries match</Chip>}
            foot={
              <>
                <Legend items={[{ signal: 'path', label: 'a transition that differs' }, { signal: 'dontcare', label: 'unused state (dashed, hatched)' }]} />
                {gates ? (
                  <span className="seq-muted">
                    <W e={gates.why}>{plural(gates.gates, 'gate')}</W> in total, with Q' free.
                  </span>
                ) : null}
              </>
            }
          >
            <Scroll label="State diagram of your circuit">
              <StateDiagram graph={a.graph} path={diffs} step={diffs.map((d) => `${d.from}>${d.to}`).join()} label="State diagram of the circuit your equations build" />
            </Scroll>
          </Board>

          <TabStrip
            label="Check details"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: 'entries',
                label: 'Entry by entry',
                body: (
                  <>
                    <Legend items={[{ signal: 'hit', label: 'matches' }, { signal: 'miss', label: 'differs' }]} />
                    <DataTable compact columns={cols} rows={res.rows} rowSignal={(r) => (r.ok ? undefined : 'miss')} />
                  </>
                ),
              },
              { value: 'checks', label: 'Checks', body: <Checks model={{ machine: a.machine, graph: a.graph, sinks: a.sinks, sc: a.selfCorrection }} /> },
              {
                value: 'notes',
                label: 'Course notes',
                body: (
                  <div className="seq-notes">
                    <Callout kind="course" title="Only the specified entries count" cite="L19 p50; T09 Q2">
                      Your equation can differ from the K-map answer on don't-cares. It has to match only the entries the table specifies. X entries are skipped.
                    </Callout>
                    <Callout kind="trap" title="Then check the unused states" cite="T09 Ans p3">
                      Two correct answers can send the unused states to different places. The Checks tab uses your equations, so the self-correcting verdict is for your circuit.
                    </Callout>
                  </div>
                ),
              },
            ]}
          />
        </>
      ) : (
        <p className="seq-muted">Fix the errors to check.</p>
      )}
    </Workspace>
  )
}
