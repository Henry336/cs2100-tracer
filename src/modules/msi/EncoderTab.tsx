import { useMemo, type ReactNode } from 'react'
import { canonical } from '../../core/boolean'
import { encode, encoderCircuit, encoderEquations, encoderOutputNames, priorityEncode, priorityEquations, priorityTable, type Bit, type PriorityRow } from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Presets, Segmented, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitRow, bitOf, Board, Details, Flow, FocusToggle, int, Options, pick, PinErrors, pins, PlayBar, seg, splitVars, str, W } from './common'
import { ENC_PRESETS } from './presets'

type Mode = 'live' | 'wired'
type Order = 'high-first' | 'low-first'

const widthOf = (m: number) => Math.log2(m)

export default function EncoderTab({ intro }: { intro: ReactNode }) {
  const [rawMode, setMode] = useUrlState<Mode>('emo', 'live')
  const [rawM, setM] = useUrlState<number>('em', 4)
  const [prio, setPrio] = useUrlState<boolean>('ep', false)
  const [valid, setValid] = useUrlState<boolean>('ev', true)
  const [rawD, setD] = useUrlState<number>('ed', 0b0110)
  const [rawOrder, setOrder] = useUrlState<Order>('eo', 'high-first')
  const [rawVars, setVars] = useUrlState<string>('evr', 'A,B,C')
  const [rawPins, setPins] = useUrlState<string[]>('ew', ['0', '1', '0', 'C', '0', 'B', '0', 'A'])
  const [orRows, setOrRows] = useUrlState<boolean>('ei', false)

  const mode = pick(rawMode, ['live', 'wired'] as const, 'live')
  const m = [4, 8, 16].includes(rawM as number) ? (rawM as number) : 4
  const nb = widthOf(m)
  const priority = prio === true
  const hasV = priority && valid !== false
  const d = int(rawD, 0, 2 ** m - 1, 0)
  const order = pick(rawOrder, ['high-first', 'low-first'] as const, 'high-first')
  const varsText = str(rawVars, 'A,B,C')
  const vars = useMemo(() => splitVars(varsText), [varsText])
  const outNames = encoderOutputNames(m)
  const ps = pins(rawPins, m, () => '0')
  const psKey = ps.join('|')

  const circuit = useMemo(
    () => (mode === 'wired' ? encoderCircuit(psKey.split('|'), vars, { priority, valid: hasV, invalid: orRows === true ? 'or' : 'dontcare' }) : null),
    [mode, psKey, vars, priority, hasV, orRows],
  )
  const wired = circuit?.ok ? circuit.circuit : null
  const steps = wired ? wired.rows.length : 1
  const stepper = useStepper(steps)
  const ri = Math.min(stepper.index, steps - 1)

  const toolbar = (
    <Presets
      presets={ENC_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setMode(p.mode)
        setM(p.m)
        setPrio(p.priority)
        if (p.valid !== undefined) setValid(p.valid)
        if (p.d !== undefined) setD(p.d)
        if (p.vars) setVars(p.vars)
        if (p.pins) setPins(p.pins)
        if (p.order) setOrder(p.order)
        stepper.first()
      }}
    />
  )

  const command = (
    <div className="ms-command">
      <Segmented
        label="Use"
        value={mode}
        onChange={(v) => {
          setMode(v)
          stepper.first()
        }}
        options={[
          { value: 'live', label: 'toggle inputs', title: 'L18 p26-33' },
          { value: 'wired', label: 'inputs wired to variables', title: 'Each output bit becomes a function (T08 Q5)' },
        ]}
      />
      <Segmented
        label="Type"
        value={priority ? 'p' : 'e'}
        onChange={(v) => setPrio(v === 'p')}
        options={[
          { value: 'e', label: 'encoder', title: 'Assumes exactly one input is high (L18 p26)' },
          { value: 'p', label: 'priority encoder', title: 'The highest-index input that is 1 wins (L18 p32)' },
        ]}
      />
      {mode === 'live' ? (
        <BitRow label="Inputs" names={Array.from({ length: m }, (_, j) => `D${m - 1 - j}`)} value={d} onChange={setD} />
      ) : (
        <div className="ms-row">
          <TextField label="Input variables, first is the MSB" value={varsText} onChange={setVars} width="11em" />
          {ps.map((p, i) => (
            <TextField key={i} label={`D${i}`} value={p} width="4.4em" onChange={(v) => setPins(ps.map((q, j) => (j === i ? v : q)))} />
          ))}
        </div>
      )}
    </div>
  )

  const options = (
    <Options>
      <div className="ms-row ms-toggles">
        <Segmented
          label="Size"
          value={m}
          onChange={(v) => {
            setM(v)
            setD(d & (2 ** v - 1))
          }}
          options={[4, 8, 16].map((v) => ({ value: v, label: `${v}-to-${widthOf(v)}` }))}
        />
        {priority ? <Toggle label="Valid bit V" checked={valid !== false} onChange={setValid} hint="L18 p32 has V; T08 Q5 and AY24/25 have none" /> : null}
        {mode === 'live' ? (
          <Segmented
            label="Table columns"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'high-first', label: 'highest input first', title: 'F7..F0 as in T08 Q5' },
              { value: 'low-first', label: 'D0 first', title: 'D0..D3 as on L18 p32' },
            ]}
          />
        ) : !priority ? (
          <Toggle
            label="OR value on rows with no input or several inputs high"
            checked={orRows === true}
            onChange={setOrRows}
            hint="Off: those rows are don't-cares, as in the AY23/24 S2 Q21e key (L18 p29)"
          />
        ) : null}
      </div>
    </Options>
  )

  const rules = (
    <div className="ms-callouts">
      <Callout kind="course" title="Output bit = OR of the inputs that set it" cite="L18 p27, p31">
        Bit j is the OR of every D_i whose index i has bit j set. For an 8-to-3 encoder, z = D1+D3+D5+D7.
      </Callout>
      {!priority ? (
        <Callout kind="trap" title="Only one input may be high" cite="L18 p26, p30">
          With D1 and D2 both high, a plain encoder outputs 01 OR 10 = 11, which looks like D3. A priority encoder fixes this.
        </Callout>
      ) : (
        <Callout kind="course" title="X in the compact table" cite="L18 p32-33; T08 Q5">
          X under an input means any value, since a higher input already decided. With no input high the code is XX..X. L18 marks that row with V = 0; T08 Q5 and
          AY24/25 have no V.
        </Callout>
      )}
    </div>
  )

  /* ---------- Toggle inputs ---------- */
  if (mode === 'live') {
    const bits = Array.from({ length: m }, (_, i) => bitOf(d, i))
    const res = priority ? priorityEncode(bits, { valid: hasV }) : encode(bits)
    const highs = bits.flatMap((b, i) => (b ? [i] : []))
    const eqs = priority ? priorityEquations(m, { valid: hasV }) : []
    const plainEqs = priority ? [] : encoderEquations(m)
    // One-hot rows for the plain encoder, compact rows for the priority encoder.
    const ptable = priority ? priorityTable(m, { valid: hasV, order }) : []
    const inCols = Array.from({ length: m }, (_, j) => (order === 'high-first' ? m - 1 - j : j))
    type One = number
    const plainCols: Column<One>[] = [
      ...inCols.map((i) => ({ key: `d${i}`, header: `D${i}`, cell: (r: One) => (r === i ? 1 : 0), align: 'center' as const, mono: true })),
      ...Array.from({ length: nb }, (_, p) => ({ key: `b${p}`, header: outNames[p], cell: (r: One) => bitOf(r, nb - 1 - p), align: 'center' as const, mono: true })),
    ]
    const prCols: Column<PriorityRow>[] = [
      ...Array.from({ length: m }, (_, j) => ({ key: `d${j}`, header: `D${inCols[j]}`, cell: (r: PriorityRow) => r.inputs[j], align: 'center' as const, mono: true })),
      ...Array.from({ length: nb }, (_, p) => ({ key: `b${p}`, header: outNames[p], cell: (r: PriorityRow) => r.code[p], align: 'center' as const, mono: true })),
      ...(hasV ? [{ key: 'v', header: 'V', cell: (r: PriorityRow) => r.v ?? '', align: 'center' as const, mono: true }] : []),
    ]
    const winRow = res.winner === null ? 0 : res.winner + 1
    const who = priority ? (res.winner === null ? 'no input high' : `D${res.winner} wins`) : highs.length ? `${highs.map((i) => `D${i}`).join(', ')} high` : 'no input high'
    return (
      <Workspace title="Combinational and MSI" lectures="L18 p26-33, T08 Q5" intro={intro} toolbar={toolbar}>
        {command}
        {options}
        <Board
          title={`${m}-to-${nb} ${priority ? 'priority encoder' : 'encoder'}`}
          step={
            <W e={res.why}>
              code {res.code.join('')}
              {res.v !== undefined ? `, V = ${res.v}` : ''}
            </W>
          }
          note={
            <>
              {who}
              {res.misleading ? (
                <>
                  {' '}
                  <Chip signal="miss">misleading</Chip>
                </>
              ) : null}
            </>
          }
          tools={<FocusToggle />}
          foot={
            <Legend
              items={[
                { signal: 'path', label: priority ? 'winning input' : 'the high input' },
                { signal: 'hit', label: 'value 1' },
                ...(priority ? [] : [{ signal: 'miss' as const, label: 'code is misleading' }]),
                { signal: 'dontcare', label: 'X, no valid code' },
              ]}
            />
          }
        >
          <EncBlock m={m} bits={bits} code={res.code} v={res.v} winner={priority ? res.winner : highs.length === 1 ? highs[0] : null} bad={res.misleading} flowId={d} />
        </Board>
        <Details
          tabs={[
            {
              value: 'table',
              label: priority ? 'Compact table' : 'Truth table (one input high)',
              body: (
                <>
                  <div className="ms-tall">
                    {priority ? (
                      <DataTable compact columns={prCols} rows={ptable} rowSignal={(_, i) => (i === winRow ? 'path' : undefined)} />
                    ) : (
                      <DataTable compact columns={plainCols} rows={Array.from({ length: m }, (_, i) => i)} rowSignal={(r) => (highs.length === 1 && r === highs[0] ? 'path' : undefined)} />
                    )}
                  </div>
                  {!priority ? <p className="ms-muted">Every other input pattern is a don't-care (L18 p29).</p> : null}
                </>
              ),
            },
            {
              value: 'eqs',
              label: priority ? 'Simplified equations' : 'Output equations',
              body: (
                <>
                  <div className="ms-eqs mono">
                    {priority
                      ? eqs.map((e) => (
                          <p key={e.output}>
                            <span className="ms-eq-name">{e.output}</span> = <W e={e.why}>{e.text}</W>
                          </p>
                        ))
                      : plainEqs.map((e, p) => (
                          <p key={e.output}>
                            <span className="ms-eq-name">{e.output}</span> ={' '}
                            <W e={e.why}>
                              {e.inputs.map((i, k) => (
                                <span key={i}>
                                  {k ? '+' : ''}
                                  <span className={bits[i] ? 'ms-term is-1' : 'ms-term'}>D{i}</span>
                                </span>
                              ))}
                            </W>{' '}
                            <span className="ms-muted">= {res.code[p]}</span>
                          </p>
                        ))}
                  </div>
                  {priority ? <p className="ms-muted">Derived from the compact table and checked against the K-map minimum. L18 p33 leaves it as an exercise.</p> : null}
                </>
              ),
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Wired inputs ---------- */
  const row = wired?.rows[ri]
  const nv = vars.length
  type R = NonNullable<typeof wired>['rows'][number]
  const cols: Column<R>[] = [
    { key: 'in', header: vars.join(''), cell: (r) => r.row.toString(2).padStart(nv, '0'), mono: true },
    { key: 'd', header: `D${m - 1}..D0`, cell: (r) => [...r.d].reverse().join(''), mono: true },
    { key: 'c', header: 'Code', cell: (r) => (!priority && orRows !== true && r.result.winner === null ? 'X'.repeat(nb) : r.result.code.join('')), mono: true },
    ...(hasV ? [{ key: 'v', header: 'V', cell: (r: R) => r.result.v ?? '', align: 'center' as const, mono: true }] : []),
  ]
  const describe = row ? `${vars.join('')} = ${row.row.toString(2).padStart(nv, '0')}: ${row.result.winner === null ? 'no valid input' : `D${row.result.winner}${priority ? ' wins' : ' is high'}`}` : undefined
  return (
    <Workspace
      title="Combinational and MSI"
      lectures="L18 p26-33, T08 Q5, AY23/24 S2 Q21e"
      intro={intro}
      toolbar={toolbar}
      transport={
        wired && row ? <Transport stepper={stepper} label="Row" marks={wired.rows.map((r) => (r.result.winner === null ? 'stall' : undefined))} describe={describe} /> : undefined
      }
    >
      {command}
      {options}
      {circuit && !circuit.ok ? <PinErrors errors={circuit.errors} /> : null}
      {wired && row ? (
        <Board
          title={`Wired ${m}-to-${nb} ${priority ? 'priority encoder' : 'encoder'}`}
          step={`row ${row.row}`}
          note={describe}
          tools={<FocusToggle />}
          play={<PlayBar stepper={stepper} start="Step through the rows" next={`row ${row.row + 1}`} />}
          foot={
            <Legend
              items={[
                { signal: 'path', label: priority ? 'winning input' : 'the high input' },
                { signal: 'hit', label: 'value 1' },
                { signal: 'dontcare', label: "X, a don't-care row" },
              ]}
            />
          }
        >
          <EncBlock
            m={m}
            bits={row.d}
            labels={ps}
            code={!priority && orRows !== true && row.result.winner === null ? Array(nb).fill('X') : row.result.code}
            v={row.result.v}
            winner={row.result.winner}
            bad={row.result.misleading && orRows === true}
            flowId={ri}
          />
        </Board>
      ) : null}
      <Details
        tabs={[
          {
            value: 'fns',
            label: 'Each output as a function',
            body: wired ? (
              <dl className="ms-facts">
                {wired.outputs.map((f, p) => (
                  <div key={p} className="ms-fact">
                    <dt>{f.name}</dt>
                    <dd className="mono ms-wrap">
                      <W e={wired.why[p]}>{wired.why[p].working?.replace(/^.+? = /, '')}</W>
                      <span className="ms-muted"> {canonical(f).sigma}</span>
                    </dd>
                  </div>
                ))}
                {wired.v ? (
                  <div className="ms-fact">
                    <dt>V</dt>
                    <dd className="mono ms-wrap">{canonical(wired.v).sigma}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null,
          },
          {
            value: 'rows',
            label: 'Rows',
            body: wired ? (
              <div className="ms-tall">
                <DataTable compact columns={cols} rows={wired.rows} rowSignal={(r) => (r.row === row?.row ? 'path' : r.result.winner === null ? 'stall' : undefined)} />
              </div>
            ) : null,
          },
          { value: 'rules', label: 'Rules and traps', body: rules },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Encoder block: D0 at the top, code bits MSB first, then V ---------- */

function EncBlock({
  m,
  bits,
  labels,
  code,
  v,
  winner,
  bad,
  flowId,
}: {
  m: number
  bits: Bit[]
  labels?: string[]
  code: (Bit | 'X')[]
  v?: Bit
  winner: number | null
  bad: boolean
  /** Restarts the light: the winning input, then every output that is 1. */
  flowId: number
}) {
  const nb = code.length
  const P = 20
  const top = 18
  const L = labels ? 96 : 60
  const BX = L + 30
  const BW = 120
  const bh = m * P + 12
  const outs = [...code.map((c, p) => ({ name: encoderOutputNames(m)[p], v: c })), ...(v !== undefined ? [{ name: 'V', v: v as Bit | 'X' }] : [])]
  const oy = (k: number) => top + bh / 2 - ((outs.length - 1) * 26) / 2 + k * 26
  const VW = BX + BW + 120
  const H = top + bh + 10
  const flow = [
    ...(winner === null ? [] : [seg(L, top + 6 + winner * P, BX, top + 6 + winner * P)]),
    ...outs.flatMap((o, k) => (o.v === 1 ? [seg(BX + BW, oy(k), BX + BW + 48, oy(k))] : [])),
  ]
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label="Encoder">
      <title>Encoder</title>
      <rect x={BX} y={top - 6} width={BW} height={bh} rx={3} className="ms-block" />
      <text x={BX + BW / 2} y={top + bh / 2} textAnchor="middle" className="ms-small">
        {m}-to-{nb}
      </text>
      {bits.map((b, i) => {
        const y = top + 6 + i * P
        return (
          <g key={i} className={`ms-net ${winner === i ? 'is-now' : b ? 'is-ready' : 'is-off'}`}>
            <text x={L - 6} y={y + 4} textAnchor="end" className="ms-label-sm">
              {labels ? labels[i] : `D${i}`}
            </text>
            <line x1={L} y1={y} x2={BX} y2={y} className="ms-wire" />
            <text x={L + 8} y={y - 3} className={`ms-val v-${b}`}>
              {b}
            </text>
            <text x={BX + 6} y={y + 4} className="ms-small">
              D{i}
            </text>
          </g>
        )
      })}
      {outs.map((o, k) => {
        const y = oy(k)
        return (
          <g key={o.name} className={`ms-net ${o.v === 'X' ? 'is-wait' : 'is-ready'}${bad && o.name !== 'V' ? ' is-bad' : ''}`}>
            <text x={BX + BW - 6} y={y + 4} textAnchor="end" className="ms-small">
              {o.name}
            </text>
            <line x1={BX + BW} y1={y} x2={BX + BW + 48} y2={y} className="ms-wire" />
            <text x={BX + BW + 54} y={y + 4} className={`ms-val v-${o.v === 'X' ? 'x' : o.v}`}>
              {o.v}
            </text>
          </g>
        )
      })}
      <Flow id={flowId} paths={flow} />
    </svg>
  )
}
