import { useMemo, type ReactNode } from 'react'
import {
  CMP_OUTPUTS,
  CMP_SYMBOL,
  comparatorCircuit,
  compareValues,
  findComparatorPairs,
  findComparatorWirings,
  MAX_CMP_VARS,
  MAX_PAIR_VARS,
  sigmaOf,
  type CmpOutput,
  type CmpSolution,
  type CompareTrace,
  type Explain,
  type PairGate,
} from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, Presets, Segmented, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitRow, Board, Details, Flow, FnField, FocusToggle, int, Options, pick, PinErrors, pins, PlayBar, plural, seg, splitVars, StepNote, Story, str, useFn, W } from './common'
import { CMP_PRESETS } from './presets'

type Mode = 'values' | 'wire' | 'find'
type GateChoice = 'any' | PairGate

const OUT_LABEL: Record<CmpOutput, string> = { lt: '<', eq: '=', gt: '>' }

export default function ComparatorTab({ intro }: { intro: ReactNode }) {
  const [rawMode, setMode] = useUrlState<Mode>('cmo', 'values')
  const [rawW, setW] = useUrlState<number>('cw', 4)
  const [rawA, setA] = useUrlState<number>('ca', 0b1010)
  const [rawB, setB] = useUrlState<number>('cb', 0b1001)
  const [rawVars, setVars] = useUrlState<string>('cv', 'A,B,C,D')
  const [rawX, setX] = useUrlState<string[]>('cx', ['A', 'B', 'C', 'D'])
  const [rawY, setY] = useUrlState<string[]>('cy', ['1', '0', '1', '1'])
  const [consts, setConsts] = useUrlState<boolean>('ck', true)
  const [pairs, setPairs] = useUrlState<boolean>('cp', false)
  const [rawGate, setGate] = useUrlState<GateChoice>('cg', 'any')
  const fs = useFn('cf', 'F(A,B,C,D) = Σm(12,13,14,15)')

  const mode = pick(rawMode, ['values', 'wire', 'find'] as const, 'values')
  const width = mode === 'values' ? (int(rawW, 1, 8, 4) > 4 ? 8 : int(rawW, 1, 8, 4) > 2 ? 4 : 2) : int(rawW, 1, 8, 4) > 2 ? 4 : 2
  const max = 2 ** width - 1
  const a = int(rawA, 0, max, 0) & max
  const b = int(rawB, 0, max, 0) & max
  const varsText = str(rawVars, 'A,B,C,D')
  const vars = useMemo(() => splitVars(varsText), [varsText])
  const xs = pins(rawX, width, (j) => vars[j] ?? '0')
  const ys = pins(rawY, width, () => '0')
  const gate = pick(rawGate, ['any', 'AND', 'OR', 'NAND', 'NOR'] as const, 'any')
  const xsKey = xs.join('|')
  const ysKey = ys.join('|')

  const values = useMemo(() => (mode === 'values' ? compareValues(a, b, width) : null), [mode, a, b, width])
  const circuit = useMemo(
    () => (mode === 'wire' ? comparatorCircuit({ x: xsKey.split('|'), y: ysKey.split('|') }, vars) : null),
    [mode, xsKey, ysKey, vars],
  )
  const fn = fs.fn
  const search = useMemo(
    () => (mode === 'find' && fn ? findComparatorWirings(fn, { width, constants: consts !== false, limit: 12 }) : null),
    [mode, fn, width, consts],
  )
  const pairSearch = useMemo(
    () =>
      mode === 'find' && pairs === true && fn
        ? findComparatorPairs(fn, { width, constants: consts !== false, limit: 12, gates: gate === 'any' ? undefined : [gate] })
        : null,
    [mode, pairs, fn, width, consts, gate],
  )

  const trace = values?.ok ? values.trace : null
  const wired = circuit?.ok ? circuit.circuit : null
  const steps = trace ? trace.frames.length : wired ? wired.rows.length : 1
  const stepper = useStepper(steps)
  const i = Math.min(stepper.index, steps - 1)

  const wireIt = (s: CmpSolution, f = fn) => {
    if (!f) return
    setMode('wire')
    setVars(f.vars.join(','))
    setX(s.x)
    setY(s.y)
    setW(s.x.length)
    stepper.first()
  }

  const toolbar = (
    <Presets
      presets={CMP_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setMode(p.mode)
        if (p.width) setW(p.width)
        if (p.a !== undefined) setA(p.a)
        if (p.b !== undefined) setB(p.b)
        if (p.vars) setVars(p.vars)
        if (p.x) setX(p.x)
        if (p.y) setY(p.y)
        if (p.f) fs.setText(p.f)
        setPairs(p.pairs === true)
        setGate(p.gates?.length === 1 ? p.gates[0] : 'any')
        stepper.first()
      }}
    />
  )

  const widthOptions = (mode === 'values' ? [2, 4, 8] : [2, 4]).map((w) => ({ value: w, label: `${w}-bit` }))
  const command = (
    <div className="ms-command">
      <Segmented
        label="Use"
        value={mode}
        onChange={(m) => {
          setMode(m)
          stepper.first()
        }}
        options={[
          { value: 'values', label: 'compare two numbers', title: 'Bit cascade from the MSB (L17 p30-31)' },
          { value: 'wire', label: 'wire to variables', title: 'Pins wired to variables or constants (T07 Q5)' },
          { value: 'find', label: 'find a wiring for F', title: 'Which single comparator, with no gates, gives F? (AY24/25 Q7, AY25/26 Q8)' },
        ]}
      />
      {mode === 'values' ? (
        <>
          <BitRow label={`A = ${a}`} names={Array.from({ length: width }, (_, j) => `A${width - 1 - j}`)} value={a} onChange={setA} />
          <BitRow label={`B = ${b}`} names={Array.from({ length: width }, (_, j) => `B${width - 1 - j}`)} value={b} onChange={setB} />
        </>
      ) : mode === 'wire' ? (
        <div className="ms-row">
          {xs.map((p, j) => (
            <TextField key={`x${j}`} label={`X${width - 1 - j}`} value={p} width="4.2em" onChange={(v) => setX(xs.map((q, k) => (k === j ? v : q)))} />
          ))}
          <span className="ms-sep" aria-hidden="true" />
          {ys.map((p, j) => (
            <TextField key={`y${j}`} label={`Y${width - 1 - j}`} value={p} width="4.2em" onChange={(v) => setY(ys.map((q, k) => (k === j ? v : q)))} />
          ))}
        </div>
      ) : (
        <div className="ms-grow">
          <FnField state={fs} />
        </div>
      )}
    </div>
  )

  const options = (
    <Options summary={mode === 'find' ? 'Width, constants and gates' : mode === 'wire' ? 'Width and input variables' : 'Width'}>
      <div className="ms-row">
        <Segmented label="Width" value={width} onChange={(w) => setW(w)} options={widthOptions} />
        {mode === 'wire' ? <TextField label="Input variables, first is the MSB" value={varsText} onChange={setVars} width="12em" /> : null}
      </div>
      {mode === 'find' ? (
        <div className="ms-row ms-toggles">
          <Toggle label="Constants 0 and 1 on pins" checked={consts !== false} onChange={setConsts} hint="Allowed by default (T07 p2)" />
          <Toggle label="Also try two comparators and one gate" checked={pairs === true} onChange={setPairs} hint="L17 p33: cascading means gates on the outputs" />
          {pairs === true ? (
            <Segmented
              label="Gate"
              value={gate}
              onChange={setGate}
              options={[
                { value: 'any', label: 'any' },
                { value: 'AND', label: 'AND' },
                { value: 'OR', label: 'OR' },
                { value: 'NAND', label: 'NAND' },
                { value: 'NOR', label: 'NOR' },
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </Options>
  )

  const rules = (
    <div className="ms-callouts">
      <Callout kind="course" title="No cascade inputs" cite="L17 p33">
        The course comparator has only A and B and the three outputs. Cascading means putting gates on the outputs of several comparators, for example (ABCD &gt; 0010) AND
        (ABCD &lt; 1101) for 3 ≤ ABCD ≤ 12.
      </Callout>
      <Callout kind="course" title="Unsigned, and leading zeros drop" cite="L17 p30; AY25/26 Q8">
        Both sides are read as unsigned numbers. Pins tied to 0 at the top do not change the value, so X = 00AD, Y = 00BC reads as AD &lt; BC.
      </Callout>
      {mode !== 'values' ? (
        <Callout kind="trap" title="No complemented literals" cite="T07 p2">
          Pins take the plain variables and the constants 0 and 1. A' on a pin needs an inverter, which a gate-free question does not allow.
        </Callout>
      ) : null}
      {mode === 'find' ? (
        <Callout kind="note" title="What one comparator can make">
          A threshold (ABCD &gt; 1011), or an equality or ordering of rearranged bits (ABCD = DCBA, B000 = C000, ABCD &lt; DDDD). A function that is neither cannot be made
          with one comparator.
        </Callout>
      ) : null}
    </div>
  )

  /* ---------- Compare two numbers ---------- */
  if (mode === 'values') {
    if (!trace)
      return (
        <Workspace title="Combinational and MSI" lectures="L17 p30-33" intro={intro} toolbar={toolbar}>
          {command}
          {options}
          {values && !values.ok ? <PinErrors errors={values.errors} /> : null}
        </Workspace>
      )
    const frame = trace.frames[i]
    const at = frame.bit ?? trace.bits.length
    const known = frame.decided
    type Row = CompareTrace['bits'][number]
    const reached = (k: number) => k <= at
    const cols: Column<Row>[] = [
      { key: 'i', header: 'Bit', cell: (r) => r.i, align: 'center', mono: true },
      { key: 'a', header: 'A', cell: (r) => r.a, align: 'center', mono: true },
      { key: 'b', header: 'B', cell: (r) => r.b, align: 'center', mono: true },
      { key: 'x', header: 'x_i', cell: (r, k) => (reached(k) ? <W e={r.why.x}>{r.x}</W> : '·'), align: 'center', mono: true },
      { key: 'gt', header: 'term of A>B', cell: (r, k) => (reached(k) ? <W e={r.why.gtTerm}>{r.gtTerm}</W> : '·'), align: 'center', mono: true },
      { key: 'lt', header: 'term of A<B', cell: (r, k) => (reached(k) ? <W e={r.why.ltTerm}>{r.ltTerm}</W> : '·'), align: 'center', mono: true },
    ]
    const dk = trace.decidingBit
    return (
      <Workspace
        title="Combinational and MSI"
        lectures="L17 p30-33"
        intro={intro}
        toolbar={toolbar}
        transport={
          <Transport
            stepper={stepper}
            label="Bit"
            marks={trace.frames.map((f, k) => (dk !== null && f.bit === dk ? 'path' : k === trace.frames.length - 1 ? 'data' : undefined))}
            describe={frame.label}
          />
        }
      >
        {command}
        {options}
        <div className="ms-stage">
          <Board
            title={`${width}-bit magnitude comparator`}
            step={frame.bit === null ? 'result' : `bit ${trace.bits[frame.bit].i}`}
            tools={<FocusToggle />}
            play={<PlayBar stepper={stepper} start="Compare from the MSB" next={i + 1 < trace.bits.length ? `bit ${trace.bits[i + 1].i}` : 'result'} />}
            foot={
              <Legend
                items={[
                  { signal: 'path', label: 'bit pair being compared' },
                  { signal: 'stall', label: 'switched off: a higher bit decided' },
                  { signal: 'hit', label: 'output that is 1' },
                ]}
              />
            }
          >
            <CmpBlock
              width={width}
              xLabels={trace.bits.map((t) => `A${t.i}`)}
              yLabels={trace.bits.map((t) => `B${t.i}`)}
              xVals={trace.bits.map((t) => t.a)}
              yVals={trace.bits.map((t) => t.b)}
              active={frame.bit}
              out={known ? trace.out : null}
              side={['A', 'B']}
              flowId={i}
            />
          </Board>
          <Story
            label="Each bit from the MSB"
            titles={trace.frames.map((f) => (f.bit === null ? 'Result' : `Bit ${trace.bits[f.bit].i}`))}
            index={i}
            onPick={stepper.set}
            body={
              <>
                <p className="mono">{frame.label}</p>
                <StepNote e={frame.why} />
                <p className="mono">
                  {CMP_OUTPUTS.map((o) => (
                    <span key={o} className="ms-out">
                      A{OUT_LABEL[o]}B = {known ? <W e={trace.why[o]}>{trace.out[o]}</W> : '?'}
                    </span>
                  ))}
                </p>
              </>
            }
          />
        </div>
        <Details
          tabs={[
            {
              value: 'cascade',
              label: 'Bit cascade from the MSB',
              body: <DataTable compact columns={cols} rows={trace.bits} rowSignal={(_, k) => (k === frame.bit ? 'path' : dk !== null && k > dk && k <= at ? 'stall' : undefined)} />,
            },
            {
              value: 'eqs',
              label: 'Equations',
              body: (
                <div className="ms-eqs mono">
                  {CMP_OUTPUTS.map((o) => (
                    <p key={o}>
                      <span className="ms-eq-name">(A{OUT_LABEL[o]}B)</span> = {trace.why[o].rule.split(' = ').slice(1).join(' = ').replace(': every bit equal', '')}
                    </p>
                  ))}
                  <p className="ms-muted">x_i = A_i∙B_i + A_i'∙B_i' is 1 when the two bits are equal (L17 p31).</p>
                </div>
              ),
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Wired to variables ---------- */
  if (mode === 'wire') {
    const row = wired?.rows[i]
    const n = vars.length
    type R = NonNullable<typeof wired>['rows'][number]
    const cols: Column<R>[] = [
      { key: 'r', header: 'Row', cell: (r) => r.row, align: 'right', mono: true },
      { key: 'in', header: vars.join(''), cell: (r) => r.row.toString(2).padStart(n, '0'), mono: true },
      { key: 'x', header: 'X', cell: (r) => r.x.toString(2).padStart(width, '0'), mono: true },
      { key: 'y', header: 'Y', cell: (r) => r.y.toString(2).padStart(width, '0'), mono: true },
      ...CMP_OUTPUTS.map((o) => ({ key: o, header: `X${OUT_LABEL[o]}Y`, cell: (r: R) => r.out[o], align: 'center' as const, mono: true })),
    ]
    const rowBits = (v: number) => Array.from({ length: width }, (_, j) => ((v >> (width - 1 - j)) & 1) as 0 | 1)
    const describe = row ? `${vars.join('')} = ${row.row.toString(2).padStart(n, '0')}: X = ${row.x}, Y = ${row.y}` : undefined
    return (
      <Workspace
        title="Combinational and MSI"
        lectures="L17 p30-33, T07 Q5"
        intro={intro}
        toolbar={toolbar}
        transport={wired && row ? <Transport stepper={stepper} label="Row" marks={wired.rows.map((r) => (r.out.gt ? 'hit' : undefined))} describe={describe} /> : undefined}
      >
        {command}
        {options}
        {circuit && !circuit.ok ? <PinErrors errors={circuit.errors} /> : null}
        {wired && row ? (
          <Board
            title="Wired comparator"
            step={`row ${row.row}`}
            note={describe}
            tools={<FocusToggle />}
            play={<PlayBar stepper={stepper} start="Step through the rows" next={`row ${row.row + 1}`} />}
            foot={
              <Legend
                items={[
                  { signal: 'hit', label: 'value 1' },
                  { signal: 'miss', label: 'pin hides an inverter or gate' },
                ]}
              />
            }
          >
            <CmpBlock width={width} xLabels={xs} yLabels={ys} xVals={rowBits(row.x)} yVals={rowBits(row.y)} active={null} out={row.out} side={['X', 'Y']} gated={wired.gated} flowId={i} />
          </Board>
        ) : null}
        {wired?.gated.length ? (
          <Callout kind="trap" title={`${plural(wired.gated.length, 'pin')} need${wired.gated.length === 1 ? 's' : ''} a gate`} cite="T07 p2">
            {wired.gated.join(', ')} {wired.gated.length === 1 ? 'is' : 'are'} driven by a complemented variable or an expression, so this is not a single comparator with no
            gates.
          </Callout>
        ) : null}
        <Details
          tabs={[
            {
              value: 'fns',
              label: 'Each output as a function',
              body: wired ? (
                <dl className="ms-facts">
                  {CMP_OUTPUTS.map((o) => (
                    <div key={o} className="ms-fact">
                      <dt>{wired.text[o]}</dt>
                      <dd className="mono ms-wrap">
                        <W e={wired.why[o]}>{sigmaOf(wired.fns[o])}</W>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null,
            },
            {
              value: 'tt',
              label: 'Truth table',
              body: wired ? (
                <div className="ms-tall">
                  <DataTable compact columns={cols} rows={wired.rows} rowSignal={(r) => (r.row === row?.row ? 'path' : undefined)} />
                </div>
              ) : null,
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Finder ---------- */
  const tooMany = fn && fn.vars.length > MAX_CMP_VARS
  const verdict = (s: { possible: boolean; complete: boolean; why: Explain }) => (
    <W e={s.why}>
      {s.possible ? <Chip signal="hit">possible</Chip> : s.complete ? <Chip signal="miss">not possible</Chip> : <Chip signal="dontcare">search stopped</Chip>}
    </W>
  )
  return (
    <Workspace title="Combinational and MSI" lectures="L17 p30-33, T07 Q5, AY24/25 Q7, AY25/26 Q8" intro={intro} toolbar={toolbar}>
      {command}
      {options}
      {tooMany ? (
        <Callout kind="course" title="Too many variables">
          The finder takes at most {MAX_CMP_VARS} variables.
        </Callout>
      ) : null}
      {search ? (
        <Board
          title={search.possible ? `Simplest wirings (${Math.min(search.solutions.length, 12)} of ${search.count.toLocaleString('en')}${search.complete ? '' : ' or more'})` : 'No single comparator'}
          step={verdict(search)}
        >
          {search.solutions.length ? (
            <ol className="ms-solutions">
              {search.solutions.map((s, k) => (
                <li key={k}>
                  <span className="mono ms-sol-text">{s.text}</span>
                  <span className="ms-muted mono">
                    X = {s.x.join('')}, Y = {s.y.join('')}, output X{CMP_SYMBOL[s.output]}Y
                  </span>
                  <Button onClick={() => wireIt(s)} title="Open this wiring in the wired view">
                    Wire it
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ms-status">
              <W e={search.why}>Every wiring of the {plural(search.sources.length, 'source')} was checked.</W>
            </p>
          )}
        </Board>
      ) : null}
      {pairs === true && fn && fn.vars.length > MAX_PAIR_VARS ? (
        <Callout kind="course" title="Two comparators: up to 4 variables">
          The two-comparator search takes at most {MAX_PAIR_VARS} variables.
        </Callout>
      ) : null}
      <Details
        tabs={[
          {
            value: 'pairs',
            label: 'Two comparators and one gate',
            body: pairSearch ? (
              <>
                <p className="ms-status">
                  {verdict(pairSearch)} <span className="ms-muted">{pairSearch.count.toLocaleString('en')} pairs</span>
                </p>
                {pairSearch.solutions.length ? (
                  <ol className="ms-solutions">
                    {pairSearch.solutions.map((s, k) => (
                      <li key={k}>
                        <span className="mono ms-sol-text">{s.text}</span>
                        <span className="ms-sol-actions">
                          <Button onClick={() => wireIt(s.first)}>Wire first</Button>
                          <Button onClick={() => wireIt(s.second)}>Wire second</Button>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            ) : null,
          },
          { value: 'rules', label: 'Rules and traps', body: rules },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Comparator block (T07 block: X3..X0, Y3..Y0, outputs X<Y, X=Y, X>Y) ---------- */

function CmpBlock({
  width,
  xLabels,
  yLabels,
  xVals,
  yVals,
  active,
  out,
  side,
  gated = [],
  flowId,
}: {
  width: number
  xLabels: string[]
  yLabels: string[]
  xVals: (0 | 1)[]
  yVals: (0 | 1)[]
  /** Pin pair being compared (0 = MSB), or null. */
  active: number | null
  out: Record<CmpOutput, 0 | 1> | null
  side: [string, string]
  gated?: string[]
  /** Restarts the light: the pin pair being compared, or the outputs that are 1. */
  flowId: number
}) {
  const P = 22
  const top = 24
  const L = 120
  const BX = 150
  const BW = 140
  const h = top + 2 * width * P + 16
  const bh = 2 * width * P + 8
  const outY = (k: number) => top + bh / 2 + (k - 1) * 30
  const VW = BX + BW + 130
  const flow =
    active !== null
      ? [seg(L, top + active * P, BX, top + active * P), seg(L, top + (width + active) * P, BX, top + (width + active) * P)]
      : (['lt', 'eq', 'gt'] as CmpOutput[]).flatMap((o, k) => (out?.[o] === 1 ? [seg(BX + BW, outY(k), BX + BW + 50, outY(k))] : []))
  const pin = (label: string, v: 0 | 1, y: number, name: string, on: boolean) => {
    const bad = gated.includes(name)
    return (
      <g key={name} className={`ms-net ${on ? 'is-now' : active === null ? 'is-ready' : 'is-off'}${bad ? ' is-bad' : ''}`}>
        <text x={L - 6} y={y + 4} textAnchor="end" className="ms-label-sm">
          {label}
        </text>
        <line x1={L} y1={y} x2={BX} y2={y} className="ms-wire" />
        <text x={L + 8} y={y - 4} className={`ms-val v-${v}`}>
          {v}
        </text>
        <text x={BX + 6} y={y + 4} className="ms-small">
          {name}
        </text>
      </g>
    )
  }
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${h}`} width={VW} height={h} role="img" aria-label="Magnitude comparator">
      <title>Magnitude comparator</title>
      <rect x={BX} y={top - 8} width={BW} height={bh} rx={3} className="ms-block" />
      <text x={BX + BW / 2} y={top + bh / 2 + 4} textAnchor="middle" className="ms-small">
        {width}-bit comparator
      </text>
      {xLabels.map((t, j) => pin(t, xVals[j], top + j * P, `${side[0]}${width - 1 - j}`, active === j))}
      {yLabels.map((t, j) => pin(t, yVals[j], top + (width + j) * P, `${side[1]}${width - 1 - j}`, active === j))}
      {(['lt', 'eq', 'gt'] as CmpOutput[]).map((o, k) => {
        const v = out?.[o]
        const y = outY(k)
        return (
          <g key={o} className={`ms-net ${v === undefined ? 'is-wait' : 'is-ready'}`}>
            <line x1={BX + BW} y1={y} x2={BX + BW + 50} y2={y} className="ms-wire" />
            <text x={BX + BW - 6} y={y + 4} textAnchor="end" className="ms-small">
              {side[0]}
              {OUT_LABEL[o]}
              {side[1]}
            </text>
            <text x={BX + BW + 56} y={y + 4} className={`ms-val v-${v === undefined ? 'x' : v}`}>
              {v === undefined ? '?' : v}
            </text>
          </g>
        )
      })}
      <Flow id={flowId} paths={flow} />
    </svg>
  )
}
