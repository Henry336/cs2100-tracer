import { useMemo, type ReactNode } from 'react'
import { canonical, MAX_MIN_VARS, minimize, parseFunction } from '../../core/boolean'
import {
  activeEnable,
  decode,
  decoderBuilds,
  decoderCircuit,
  decoderName,
  decoderTree,
  findDecoderWirings,
  mismatchRows,
  MAX_REACH_VARS,
  outputFormula,
  reachableFunctions,
  selectNames,
  type DecoderSpec,
  type DecoderTree,
  type EnableKind,
  type OutputGate,
  type OutputPolarity,
} from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, NumberField, Presets, Segmented, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitRow, BitToggle, bitOf, Board, bubble, Details, Flow, FnField, FocusToggle, gatePath, int, Options, pick, PinErrors, pins, PlayBar, plural, polyD, pts, seg, splitVars, str, useFn, W } from './common'
import { DEC_PRESETS } from './presets'

type Mode = 'live' | 'circuit' | 'find' | 'tree'
const GATES: OutputGate[] = ['none', 'OR', 'NOR', 'AND', 'NAND']

export default function DecoderTab({ intro }: { intro: ReactNode }) {
  const [rawMode, setMode] = useUrlState<Mode>('dmo', 'live')
  const [rawK, setK] = useUrlState<number>('dk', 2)
  const [rawEn, setEn] = useUrlState<EnableKind>('de', 'one')
  const [rawPol, setPol] = useUrlState<OutputPolarity>('dp', 'high')
  const [rawS, setS] = useUrlState<number>('ds', 2)
  const [rawE, setE] = useUrlState<number>('dE', 1)
  const [rawVars, setVars] = useUrlState<string>('dv', 'Q,X,P')
  const [rawSel, setSel] = useUrlState<string[]>('dsl', ['Q', 'X', 'P'])
  const [rawEnPin, setEnPin] = useUrlState<string>('den', '')
  const [rawUsed, setUsed] = useUrlState<number[]>('du', [0, 1, 4, 6, 7])
  const [rawGate, setGate] = useUrlState<OutputGate>('dg', 'OR')
  const [rawTarget, setTarget] = useUrlState<string>('dt', '')
  const [consts, setConsts] = useUrlState<boolean>('dkc', true)
  const [rawN, setN] = useUrlState<number>('dn', 3)
  const [rawB, setB] = useUrlState<number>('db', 2)
  const [rawCode, setCode] = useUrlState<number>('dc', 5)
  const fs = useFn('df', "F(A,B,C) = A'∙B∙C'")

  const mode = pick(rawMode, ['live', 'circuit', 'find', 'tree'] as const, 'live')
  const k = int(rawK, 1, 4, 2)
  const spec: DecoderSpec = { k, enable: pick(rawEn, ['none', 'one', 'zero'] as const, 'one'), outputs: pick(rawPol, ['high', 'low'] as const, 'high') }
  const size = 1 << k
  const sel = int(rawS, 0, size - 1, 0)
  const eBit = int(rawE, 0, 1, 1) as 0 | 1
  const varsText = str(rawVars, 'A,B,C')
  const vars = useMemo(() => splitVars(varsText), [varsText])
  const selects = pins(rawSel, k, (j) => vars[j] ?? '0')
  const enPin = str(rawEnPin, '')
  const used = [...new Set(Array.isArray(rawUsed) ? rawUsed.filter((o): o is number => Number.isInteger(o) && o >= 0 && o < size) : [])].sort((a, b) => a - b)
  const gate = pick(rawGate, GATES, 'OR')
  const targetText = str(rawTarget, '')
  const selKey = selects.join('|')
  const usedKey = used.join(',')

  const circuit = useMemo(
    () =>
      mode === 'circuit'
        ? decoderCircuit(spec, { selects: selKey.split('|'), enable: enPin.trim() || undefined }, vars, { outputs: usedKey ? usedKey.split(',').map(Number) : [], gate })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, spec.k, spec.enable, spec.outputs, selKey, enPin, vars, usedKey, gate],
  )
  const wired = circuit?.ok ? circuit.circuit : null
  const target = useMemo(() => {
    if (!targetText.trim()) return null
    const p = parseFunction(targetText, { vars })
    return p.ok ? p.fn : null
  }, [targetText, vars])
  const simplest = useMemo(() => (wired && wired.vars.length <= MAX_MIN_VARS ? minimize(wired.f, 'sop').summary.answer : null), [wired])
  const canon = useMemo(() => (wired ? canonical(wired.f) : null), [wired])
  const bfn = target ?? wired?.f ?? null
  const builds = useMemo(() => (bfn && bfn.vars.length >= 1 && bfn.vars.length <= 4 ? decoderBuilds(bfn) : []), [bfn])
  const fn = fs.fn
  const search = useMemo(() => (mode === 'find' && fn ? findDecoderWirings(fn, spec, { constants: consts !== false, limit: 24 }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, fn, spec.k, spec.enable, spec.outputs, consts])
  const reach = useMemo(() => {
    if (mode !== 'find' || !fn || fn.vars.length > MAX_REACH_VARS) return null
    const r = reachableFunctions(fn.vars, spec, { constants: consts !== false })
    return { ...r, rows: r.items.map((it) => ({ ...it, sop: minimize(it.fn, 'sop').summary.answer, hit: it.fn.on.join() === fn.on.join() })) }
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, fn, spec.k, spec.enable, spec.outputs, consts])
  const n = int(rawN, 2, 6, 3)
  const blk = Math.min(int(rawB, 1, 4, 2), n - 1)
  const code = int(rawCode, 0, (1 << n) - 1, 0)
  const tree = useMemo(() => (mode === 'tree' ? decoderTree(n, blk, code) : null), [mode, n, blk, code])

  const steps = wired ? wired.rows.length : 1
  const stepper = useStepper(steps)
  const ri = Math.min(stepper.index, steps - 1)

  const toolbar = (
    <Presets
      presets={DEC_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setMode(p.mode)
        if (p.k) setK(p.k)
        if (p.enable) setEn(p.enable)
        if (p.outputs) setPol(p.outputs)
        if (p.vars) setVars(p.vars)
        if (p.selects) setSel(p.selects)
        if (p.mode === 'circuit') {
          setEnPin(p.en ?? '')
          setUsed(p.used ?? [0])
          setGate(p.gate ?? 'none')
          setTarget(p.f ?? '')
        }
        if (p.mode === 'find' && p.f) fs.setText(p.f)
        if (p.n) setN(p.n)
        if (p.block) setB(p.block)
        if (p.code !== undefined) setCode(p.code)
        stepper.first()
      }}
    />
  )

  const sizePick =
    mode === 'tree' ? null : (
      <Segmented
        label="Size"
        value={k}
        onChange={(v) => {
          setK(v)
          setS(0)
        }}
        options={[1, 2, 3, 4].map((v) => ({ value: v, label: `${v}x${1 << v}` }))}
      />
    )

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
          { value: 'live', label: 'toggle inputs', title: 'One evaluation: selects and enable (L18 p13-16)' },
          { value: 'circuit', label: 'decoder and gate', title: 'Wire the pins, tick outputs into a gate, read F (L18 p23-24)' },
          { value: 'find', label: 'find a wiring', title: 'Products one decoder makes with no gates (AY23/24 S1 Q9)' },
          { value: 'tree', label: 'larger decoders', title: 'Build an n x 2^n decoder from smaller ones (L18 p17-19)' },
        ]}
      />
      {sizePick}
      {mode === 'live' ? (
        <>
          <BitRow label={`Selects = ${sel}`} names={selectNames(k)} value={sel} onChange={setS} />
          {spec.enable !== 'none' ? (
            <div className="ms-bitrow">
              <span className="control-label">Enable</span>
              <div className="ms-bits">
                <BitToggle label="E" value={eBit} onChange={setE} title={spec.enable === 'zero' ? 'Active when E = 0' : 'Active when E = 1'} />
              </div>
            </div>
          ) : null}
        </>
      ) : mode === 'circuit' ? (
        <>
          <div className="ms-row">
            <TextField label="Input variables, first is the MSB" value={varsText} onChange={setVars} width="11em" />
            {selects.map((s, j) => (
              <TextField key={j} label={selectNames(k)[j]} value={s} width="4.6em" onChange={(v) => setSel(selects.map((q, i) => (i === j ? v : q)))} />
            ))}
            {spec.enable !== 'none' ? <TextField label="E" value={enPin} placeholder={String(activeEnable(spec))} width="4.6em" onChange={setEnPin} /> : null}
          </div>
          <div className="ms-bitrow">
            <span className="control-label">Outputs into the gate</span>
            <div className="ms-bits">
              {Array.from({ length: size }, (_, o) => (
                <button
                  key={o}
                  type="button"
                  className={`ms-tick${used.includes(o) ? ' is-on' : ''}`}
                  aria-pressed={used.includes(o)}
                  onClick={() => setUsed(used.includes(o) ? used.filter((x) => x !== o) : [...used, o])}
                >
                  Y{o}
                </button>
              ))}
            </div>
          </div>
          <Segmented label="Gate" value={gate} onChange={setGate} options={GATES.map((g) => ({ value: g, label: g === 'none' ? 'no gate' : g }))} />
        </>
      ) : mode === 'find' ? (
        <div className="ms-grow">
          <FnField state={fs} label="Product to make: Σm(..) or an expression" />
        </div>
      ) : (
        <>
          <NumberField label="Target n (an n x 2^n decoder)" value={n} min={2} max={6} onChange={(v) => setN(Math.trunc(v))} />
          <Segmented label="Building block" value={blk} onChange={setB} options={[1, 2, 3, 4].filter((v) => v < n).map((v) => ({ value: v, label: `${v}x${1 << v}` }))} />
          <BitRow label={`Code = ${code}`} names={Array.from({ length: n }, (_, j) => `A${n - 1 - j}`)} value={code} onChange={setCode} />
        </>
      )}
    </div>
  )

  const options =
    mode === 'tree' ? null : (
      <Options summary={mode === 'circuit' ? 'Enable, output polarity and a target' : mode === 'find' ? 'Enable, output polarity and constants' : 'Enable and output polarity'}>
        <div className="ms-row">
          <Segmented
            label="Enable"
            value={spec.enable}
            onChange={setEn}
            options={[
              { value: 'none', label: 'none' },
              { value: 'one', label: '1-enable E', title: 'Active when E = 1 (L18 p15)' },
              { value: 'zero', label: "0-enable E'", title: 'Active when E = 0, drawn with a bubble (L18 p16)' },
            ]}
          />
          <Segmented
            label="Outputs"
            value={spec.outputs}
            onChange={setPol}
            options={[
              { value: 'high', label: 'active-high', title: 'Output i = m_i (L18 p12-13)' },
              { value: 'low', label: 'active-low', title: "Output i = m_i' (L18 p20; R09 p19)" },
            ]}
          />
          {mode === 'find' ? <Toggle label="Constants 0 and 1 on pins" checked={consts !== false} onChange={setConsts} hint="Allowed by default (T07 p2)" /> : null}
        </div>
        {mode === 'circuit' ? (
          <div className="ms-row">
            <div className="ms-grow">
              <TextField label="Target to check: Σm(..), ΠM(..) or an expression" value={targetText} onChange={setTarget} placeholder="Σm(0,1,4,6,7)" />
            </div>
          </div>
        ) : null}
      </Options>
    )

  const rules = (
    <div className="ms-callouts">
      <Callout kind="course" title="S on top is the MSB" cite="L18 p13, p38">
        The output index is the binary value of the selects, S{k - 1} first. Put the first variable on S{k - 1}.
      </Callout>
      {spec.outputs === 'low' ? (
        <Callout kind="trap" title="Active-low outputs are maxterms" cite="L18 p20-24; R09 p19">
          Each output is m_i' = M_i, and every output is 1 when the decoder is disabled. Use NAND on the 1-minterms or AND on the 0-minterms, not OR. The 74138 is
          active-low.
        </Callout>
      ) : null}
      {spec.enable === 'one' && spec.outputs === 'high' && mode === 'find' ? (
        <Callout kind="trap" title="The enable only adds a plain literal" cite="L18 p15; AY23/24 S1 Q9">
          A 1-enable output is E∙m_i. With no inverter, E brings in only an uncomplemented variable. So A'∙B∙C' works (E = B) and A'∙B'∙C' does not.
        </Callout>
      ) : null}
      {spec.enable === 'zero' ? (
        <Callout kind="course" title="0-enable" cite="L18 p16; R09 p58">
          Written E' or drawn with a bubble: the decoder works when E = 0. With active-low outputs, output i = E + M_i.
        </Callout>
      ) : null}
    </div>
  )

  const legend = (
    <Legend
      items={[
        { signal: 'path', label: 'active output' },
        { signal: 'control', label: 'enable' },
        { signal: 'hit', label: 'value 1' },
        ...(mode === 'circuit' ? [{ signal: 'data' as const, label: 'output feeding the gate' }] : []),
      ]}
    />
  )

  /* ---------- Toggle inputs ---------- */
  if (mode === 'live') {
    const r = decode(spec, sel, eBit)
    if (!r.ok)
      return (
        <Workspace title="Combinational and MSI" lectures="L18 p5-24" intro={intro} toolbar={toolbar}>
          {command}
          {options}
          <PinErrors errors={r.errors} />
        </Workspace>
      )
    type Row = { e: 0 | 1 | 'X'; s: number | null }
    const rows: Row[] = [
      ...(spec.enable !== 'none' ? [{ e: (1 - activeEnable(spec)) as 0 | 1, s: null }] : []),
      ...Array.from({ length: size }, (_, s) => ({ e: spec.enable === 'none' ? ('X' as const) : activeEnable(spec), s })),
    ]
    const rowOut = (row: Row) => (row.s === null ? decode(spec, 0, row.e as 0 | 1) : decode(spec, row.s, row.e === 'X' ? 1 : row.e))
    const cols: Column<Row>[] = [
      ...(spec.enable !== 'none' ? [{ key: 'e', header: 'E', cell: (row: Row) => row.e, align: 'center' as const, mono: true }] : []),
      ...selectNames(k).map((nm, j) => ({ key: nm, header: nm, cell: (row: Row) => (row.s === null ? 'X' : bitOf(row.s, k - 1 - j)), align: 'center' as const, mono: true })),
      ...Array.from({ length: size }, (_, o) => ({
        key: `y${o}`,
        header: `Y${o}`,
        cell: (row: Row) => {
          const d = rowOut(row)
          return d.ok ? d.outputs[o] : ''
        },
        align: 'center' as const,
        mono: true,
      })),
    ]
    const isCur = (row: Row) => (r.enabled ? row.s === sel : row.s === null)
    return (
      <Workspace title="Combinational and MSI" lectures="L18 p5-24, R09 p10-19" intro={intro} toolbar={toolbar}>
        {command}
        {options}
        <Board title={decoderName(spec)} step={<W e={r.why}>{r.enabled ? `output ${r.index} active` : 'disabled'}</W>} tools={<FocusToggle />} foot={legend}>
          <DecBlock
            spec={spec}
            selLabels={selectNames(k)}
            selVals={selectNames(k).map((_, j) => bitOf(sel, k - 1 - j))}
            eLabel="E"
            eVal={eBit}
            outputs={r.outputs}
            active={r.enabled ? r.index : null}
            flowId={`${sel}${eBit}`}
          />
        </Board>
        <Details
          tabs={[
            {
              value: 'formulas',
              label: 'Output formulas',
              body: (
                <DataTable
                  compact
                  columns={[
                    { key: 'o', header: 'Output', cell: (o: number) => `Y${o}`, mono: true },
                    { key: 'f', header: 'Formula', cell: (o: number) => <W e={outputFormula(spec, o).why}>{outputFormula(spec, o).text}</W>, mono: true },
                    { key: 'v', header: 'Value', cell: (o: number) => r.outputs[o], align: 'center', mono: true },
                  ]}
                  rows={Array.from({ length: size }, (_, o) => o)}
                  rowSignal={(o) => (r.enabled && o === r.index ? 'path' : undefined)}
                />
              ),
            },
            {
              value: 'tt',
              label: 'Truth table',
              body: (
                <>
                  <DataTable compact columns={cols} rows={rows} rowSignal={(row) => (isCur(row) ? 'path' : undefined)} />
                  {spec.enable !== 'none' ? <p className="ms-muted">The first row is the disabled decoder: the selects are X and every output is inactive.</p> : null}
                </>
              ),
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Decoder and gate ---------- */
  if (mode === 'circuit') {
    const row = wired?.rows[ri]
    const nv = vars.length
    const mis = wired && target && target.vars.join() === wired.vars.join() ? mismatchRows(wired.f, target) : null
    type R = NonNullable<typeof wired>['rows'][number]
    const cols: Column<R>[] = [
      { key: 'r', header: vars.join(''), cell: (r) => r.row.toString(2).padStart(nv, '0'), mono: true },
      ...(spec.enable !== 'none' ? [{ key: 'e', header: 'E', cell: (r: R) => r.e, align: 'center' as const, mono: true }] : []),
      { key: 's', header: selectNames(k).join(''), cell: (r) => (r.enabled ? r.select.toString(2).padStart(k, '0') : 'off'), mono: true },
      ...used.map((o) => ({ key: `y${o}`, header: `Y${o}`, cell: (r: R) => r.outputs[o], align: 'center' as const, mono: true })),
      { key: 'f', header: 'F', cell: (r) => r.f, align: 'center', mono: true },
    ]
    const describe = row ? `${vars.join('')} = ${row.row.toString(2).padStart(nv, '0')}: ${row.enabled ? `output ${row.select} active` : 'decoder disabled'}, F = ${row.f}` : undefined
    const targetChip = !targetText.trim() ? null : !target ? (
      <Chip signal="miss">cannot read the target</Chip>
    ) : !mis ? (
      <Chip signal="dontcare">target uses other variables</Chip>
    ) : mis.length ? (
      <>
        <Chip signal="miss">differs</Chip> <span className="mono">on rows {mis.join(', ')}</span>
      </>
    ) : (
      <Chip signal="hit">matches on every row</Chip>
    )
    return (
      <Workspace
        title="Combinational and MSI"
        lectures="L18 p23-24, R09 p53-58"
        intro={intro}
        toolbar={toolbar}
        transport={wired && row ? <Transport stepper={stepper} label="Row" marks={wired.rows.map((r) => (r.f ? 'hit' : undefined))} describe={describe} /> : undefined}
      >
        {command}
        {options}
        {circuit && !circuit.ok ? <PinErrors errors={circuit.errors} /> : null}
        {wired && row ? (
          <Board
            title={`${decoderName(spec)}${gate === 'none' ? '' : `, ${gate} gate`}`}
            step={`row ${row.row}`}
            note={
              <>
                {describe}
                {targetChip ? <> {targetChip}</> : null}
              </>
            }
            tools={<FocusToggle />}
            play={<PlayBar stepper={stepper} start="Step through the rows" next={`row ${row.row + 1}`} />}
            foot={legend}
          >
            <DecBlock
              spec={spec}
              selLabels={selects}
              selVals={selectNames(k).map((_, j) => bitOf(row.select, k - 1 - j))}
              eLabel={enPin.trim() || String(activeEnable(spec))}
              eVal={row.e}
              outputs={row.outputs}
              active={row.enabled ? row.select : null}
              used={used}
              gate={gate}
              f={row.f}
              gated={wired.gated}
              flowId={ri}
            />
          </Board>
        ) : null}
        {wired?.gated.length ? (
          <Callout kind="trap" title={`${plural(wired.gated.length, 'pin')} hide${wired.gated.length === 1 ? 's' : ''} a gate`} cite="T07 p2; R09 p53">
            {wired.gated.join(', ')} {wired.gated.length === 1 ? 'is' : 'are'} driven by a complemented variable or an expression.
          </Callout>
        ) : null}
        <Details
          tabs={[
            {
              value: 'readback',
              label: 'F read back',
              body: wired ? (
                <dl className="ms-facts">
                  <dt>Σm</dt>
                  <dd className="mono ms-wrap">
                    <W e={wired.why.f}>{canon?.sigma}</W>
                  </dd>
                  <dt>ΠM</dt>
                  <dd className="mono ms-wrap">
                    <W e={canon?.why.pi}>{canon?.pi}</W>
                  </dd>
                  {simplest ? (
                    <>
                      <dt>Simplest SOP</dt>
                      <dd className="mono ms-wrap">F = {simplest}</dd>
                    </>
                  ) : null}
                  {targetChip ? (
                    <>
                      <dt>Target</dt>
                      <dd>{targetChip}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null,
            },
            {
              value: 'rows',
              label: 'Rows',
              body: wired ? (
                <div className="ms-tall">
                  <DataTable compact columns={cols} rows={wired.rows} rowSignal={(r) => (r.row === row?.row ? 'path' : undefined)} />
                </div>
              ) : null,
            },
            {
              value: 'used',
              label: 'Outputs used',
              body: wired ? (
                <DataTable
                  compact
                  columns={[
                    { key: 'o', header: 'Output', cell: (o: number) => `Y${o}`, mono: true },
                    { key: 'f', header: 'Formula', cell: (o: number) => outputFormula(spec, o).text, mono: true },
                    { key: 's', header: 'As a function of the inputs', cell: (o: number) => <W e={wired.why.outputs[o]}>{canonical(wired.outputFns[o]).sigma}</W>, mono: true },
                  ]}
                  rows={used}
                />
              ) : null,
            },
            {
              value: 'builds',
              label: 'Four ways to build it',
              body: builds.length ? (
                <>
                  <p className="ms-caption">
                    {target ? target.name : 'F'} on one {bfn?.vars.length}x{1 << (bfn?.vars.length ?? 0)} decoder
                  </p>
                  <DataTable
                    compact
                    columns={[
                      { key: 'l', header: 'Build', cell: (b: (typeof builds)[number]) => b.label },
                      { key: 'w', header: 'Gate inputs', cell: (b) => <W e={b.why}>{b.why.working}</W>, mono: true },
                      { key: 'n', header: 'Fan-in', cell: (b) => b.fanIn, align: 'right' },
                      {
                        key: 'u',
                        header: '',
                        cell: (b) => (
                          <Button
                            onClick={() => {
                              setK(b.spec.k)
                              setEn('none')
                              setPol(b.spec.outputs)
                              if (bfn) {
                                setVars(bfn.vars.join(','))
                                setSel(bfn.vars)
                              }
                              setUsed(b.use.outputs)
                              setGate(b.use.gate)
                              stepper.first()
                            }}
                          >
                            Use
                          </Button>
                        ),
                      },
                    ]}
                    rows={builds}
                  />
                  <p className="ms-muted">The variables go on the selects in order, so output i is minterm m_i (L18 p23-24). Fewer gate inputs is cheaper.</p>
                </>
              ) : null,
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Finder ---------- */
  if (mode === 'find') {
    return (
      <Workspace title="Combinational and MSI" lectures="L18 p15-16, R09 p56-58, AY23/24 S1 Q9" intro={intro} toolbar={toolbar}>
        {command}
        {options}
        {search ? (
          <Board
            title={search.solutions.length ? `Wirings that give F on one output of one ${decoderName(spec)}` : `No wiring of one ${decoderName(spec)}`}
            step={<W e={search.why}>{search.possible ? <Chip signal="hit">possible</Chip> : <Chip signal="miss">not possible</Chip>}</W>}
          >
            {search.solutions.length ? (
              <ol className="ms-solutions">
                {search.solutions.map((s, j) => (
                  <li key={j}>
                    <span className="mono ms-sol-text">{s.text}</span>
                    <Button
                      onClick={() => {
                        if (!fn) return
                        setMode('circuit')
                        setVars(fn.vars.join(','))
                        setSel(s.selects)
                        setEnPin(s.enable ?? '')
                        setUsed([s.output])
                        setGate('none')
                        setTarget(fs.text)
                        stepper.first()
                      }}
                    >
                      Open
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ms-status">
                <W e={search.why}>{search.why.rule}</W>
              </p>
            )}
          </Board>
        ) : null}
        <Details
          tabs={[
            {
              value: 'reach',
              label: 'Every function one output can give',
              body:
                reach && fn ? (
                  <>
                    <p className="ms-caption">
                      Over {fn.vars.join(', ')}: <W e={reach.why}>{plural(reach.rows.length, 'different function')}</W>. Anything not listed needs a gate or an inverter.
                    </p>
                    <div className="ms-tall">
                      <DataTable
                        compact
                        columns={[
                          { key: 'f', header: 'Output', cell: (r: (typeof reach.rows)[number]) => (r.hit ? <>{r.sop} <Chip signal="hit">your F</Chip></> : r.sop), mono: true },
                          { key: 'm', header: 'Σm', cell: (r) => canonical(r.fn).sigma, mono: true },
                          { key: 'w', header: 'One wiring', cell: (r) => r.wiring.text, mono: true },
                          { key: 'c', header: 'Wirings', cell: (r) => r.count, align: 'right' },
                        ]}
                        rows={reach.rows}
                        rowSignal={(r) => (r.hit ? 'hit' : undefined)}
                      />
                    </div>
                  </>
                ) : null,
            },
            { value: 'rules', label: 'Rules and traps', body: rules },
          ]}
        />
      </Workspace>
    )
  }

  /* ---------- Larger decoders ---------- */
  const tr = tree?.ok ? tree.tree : null
  return (
    <Workspace title="Combinational and MSI" lectures="L18 p17-19, R09 p16-18" intro={intro} toolbar={toolbar}>
      {command}
      {tree && !tree.ok ? <PinErrors errors={tree.errors} /> : null}
      {tr ? (
        <Board
          title={`${n}x${1 << n} decoder from ${blk}x${1 << blk} decoders`}
          step={<W e={tr.why.path}>output D{tr.code}</W>}
          tools={<FocusToggle />}
          foot={
            <Legend
              items={[
                { signal: 'path', label: 'enabled on the path to the code' },
                { signal: 'control', label: 'enable wiring' },
                { signal: 'stall', label: 'disabled' },
              ]}
            />
          }
        >
          <TreeSvg tree={tr} />
        </Board>
      ) : null}
      <Details
        tabs={[
          {
            value: 'count',
            label: 'Count and path',
            body: tr ? (
              <dl className="ms-facts">
                <dt>Blocks</dt>
                <dd>
                  <W e={tr.why.count}>
                    {plural(tr.decoders, 'decoder')}
                    {tr.inverters ? ` and ${plural(tr.inverters, 'inverter')}` : ''}
                  </W>
                </dd>
                <dt>Active path</dt>
                <dd>
                  <W e={tr.why.path}>output D{tr.code}</W>
                </dd>
              </dl>
            ) : null,
          },
          {
            value: 'rules',
            label: 'Rules and traps',
            body: (
              <div className="ms-callouts">
                <Callout kind="course" title="MSBs choose the decoder, LSBs choose the line" cite="L18 p17">
                  The high bits drive the enables, so only one small decoder is on. The low bits go to every decoder and pick the line inside it.
                </Callout>
                <Callout kind="beyond" title="The count formula is from student notes, not the slides">
                  (2^n - 1)/(2^k - 1) decoders when k divides n. It agrees with R09 p18 (five 2x4 for a 4x16).
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Decoder block, optionally feeding one gate ---------- */

function DecBlock({
  spec,
  selLabels,
  selVals,
  eLabel,
  eVal,
  outputs,
  active,
  used,
  gate = 'none',
  f,
  gated = [],
  flowId,
}: {
  spec: DecoderSpec
  selLabels: string[]
  selVals: (0 | 1)[]
  eLabel: string
  eVal: 0 | 1
  outputs: (0 | 1)[]
  active: number | null
  used?: number[]
  gate?: OutputGate
  f?: 0 | 1
  gated?: string[]
  /** Restarts the light along the active output (and through the gate). */
  flowId: string | number
}) {
  const k = spec.k
  const m = 1 << k
  const P = 22
  const top = 34
  const L = 110
  const BX = 130
  const BW = 120
  const bh = Math.max(m * P, k * P + 30) + 8
  const low = spec.outputs === 'low'
  const oy = (o: number) => top + (bh - m * P) / 2 + o * P + P / 2 - 4
  const sy = (j: number) => top + (bh - k * P) / 2 + j * P + P / 2 - 4
  const OX = BX + BW + (low ? 8 : 0)
  const GX = BX + BW + 150
  const us = used ?? []
  const gh = Math.max(40, us.length * 14 + 12)
  const gy = top + bh / 2 - gh / 2 - 4
  const shape = gate === 'none' ? null : gate
  const VW = (used ? GX + 130 : BX + BW + 110) + 10
  const H = top + bh + (spec.enable === 'none' ? 20 : 64)
  const names = selectNames(k)
  const eX = BX + BW / 2
  const ey = top + bh - 8
  const ai = active === null ? -1 : us.indexOf(active)
  const flow =
    active === null
      ? []
      : [
          seg(OX, oy(active), OX + 40, oy(active)),
          ...(ai >= 0 && shape ? [polyD([[OX + 40, oy(active)], [GX - 30 - ai * 4, oy(active)], [GX - 30 - ai * 4, gy + (gh / (us.length + 1)) * (ai + 1)], [GX + 2, gy + (gh / (us.length + 1)) * (ai + 1)]])] : []),
          ...(ai >= 0 && !shape ? [seg(OX + 40, oy(active), GX + 60, oy(active))] : []),
          ...(shape && f === 1 ? [seg(GX + 56, gy + gh / 2, GX + 90, gy + gh / 2)] : []),
        ]
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label="Decoder">
      <title>Decoder</title>
      <rect x={BX} y={top - 8} width={BW} height={bh} rx={3} className="ms-block" />
      <text x={BX} y={top - 14} className="ms-small">
        {k}x{m} decoder
      </text>
      {selLabels.map((t, j) => {
        const y = sy(j)
        const bad = gated.includes(names[j])
        return (
          <g key={j} className={`ms-net is-ready${bad ? ' is-bad' : ''}`}>
            <text x={L - 6} y={y + 4} textAnchor="end" className="ms-label-sm">
              {t}
            </text>
            <line x1={L} y1={y} x2={BX} y2={y} className="ms-wire" />
            <text x={L + 4} y={y - 4} className={`ms-val v-${selVals[j]}`}>
              {selVals[j]}
            </text>
            <text x={BX + 6} y={y + 4} className="ms-small">
              {names[j]}
            </text>
          </g>
        )
      })}
      {spec.enable !== 'none' ? (
        <g className={`ms-net is-ctl${gated.includes('E') ? ' is-bad' : ''}`}>
          <line x1={eX} y1={ey + (spec.enable === 'zero' ? 8 : 0)} x2={eX} y2={ey + 34} className="ms-wire" />
          {spec.enable === 'zero' ? <circle cx={eX} cy={ey + 4} r={4} className="ms-gate" /> : null}
          <text x={eX} y={ey - 6} textAnchor="middle" className="ms-small">
            {spec.enable === 'zero' ? "E'" : 'E'}
          </text>
          <text x={eX} y={ey + 48} textAnchor="middle" className="ms-label-sm">
            {eLabel} <tspan className={`ms-val v-${eVal}`}>{eVal}</tspan>
          </text>
        </g>
      ) : null}
      {outputs.map((v, o) => {
        const y = oy(o)
        const on = active === o
        const feeds = us.includes(o)
        const cls = on ? 'is-now' : feeds ? 'is-ready' : 'is-off'
        const gi = us.indexOf(o)
        const iy = gy + (gh / (us.length + 1)) * (gi + 1)
        return (
          <g key={o} className={`ms-net ${cls}`}>
            <text x={BX + BW - 6} y={y + 4} textAnchor="end" className="ms-small">
              Y{o}
            </text>
            {low ? <circle cx={BX + BW + 4} cy={y} r={4} className="ms-gate" /> : null}
            <line x1={OX} y1={y} x2={OX + 40} y2={y} className="ms-wire" />
            {feeds && shape ? <polyline points={pts([[OX + 40, y], [GX - 30 - gi * 4, y], [GX - 30 - gi * 4, iy], [GX + 2, iy]])} className="ms-wire" /> : null}
            {feeds && !shape ? <line x1={OX + 40} y1={y} x2={GX + 60} y2={y} className="ms-wire" /> : null}
            <text x={OX + 6} y={y - 4} className={`ms-val v-${v}`}>
              {v}
            </text>
          </g>
        )
      })}
      {shape ? (
        <g className="ms-net is-ready">
          <path d={gatePath(shape, GX, gy, 56, gh)} className="ms-gate" />
          {bubble(shape, GX, gy, 56, gh) ? <circle cx={GX + 52} cy={gy + gh / 2} r={4} className="ms-gate" /> : null}
          <text x={GX + 10} y={gy + gh / 2 + 4} className="ms-small">
            {shape}
          </text>
          <line x1={GX + 56} y1={gy + gh / 2} x2={GX + 90} y2={gy + gh / 2} className="ms-wire" />
          <text x={GX + 94} y={gy + gh / 2 + 4} className="ms-label">
            F <tspan className={`ms-val v-${f ?? 'x'}`}>{f ?? ''}</tspan>
          </text>
        </g>
      ) : used && us.length === 1 ? (
        <text x={GX + 64} y={oy(us[0]) + 4} className="ms-label">
          F <tspan className={`ms-val v-${f ?? 'x'}`}>{f ?? ''}</tspan>
        </text>
      ) : null}
      <Flow id={flowId} paths={flow} />
    </svg>
  )
}

/* ---------- Decoder tree (L18 p17-19) ---------- */

function TreeSvg({ tree }: { tree: DecoderTree }) {
  const levels = Math.max(...tree.nodes.map((x) => x.level)) + 1
  const leaves = tree.nodes.filter((x) => x.level === levels - 1)
  const NW = 150
  const NH = 46
  const GX = 90
  const RH = 58
  const ys = new Map<number, number>()
  leaves.forEach((x, i) => ys.set(x.id, 12 + i * RH))
  for (let l = levels - 2; l >= 0; l--) {
    for (const x of tree.nodes.filter((q) => q.level === l)) {
      const kids = tree.nodes.filter((c) => c.level === l + 1 && (c.enable.from === 'node' ? c.enable.id === x.id : x.kind === 'inverter'))
      const kys = kids.map((c) => ys.get(c.id) ?? 0)
      ys.set(x.id, kys.length ? (Math.min(...kys) + Math.max(...kys)) / 2 : 12)
    }
  }
  const xOf = (l: number) => 12 + l * (NW + GX)
  const VW = xOf(levels - 1) + NW + 16
  const H = 12 + leaves.length * RH
  const onPath = new Set(tree.path)
  const edge = (x: DecoderTree['nodes'][number]): [number, number][] => {
    const parent = x.enable.from === 'node' ? tree.nodes[x.enable.id] : tree.nodes[0]
    const py = (ys.get(parent.id) ?? 0) + NH / 2
    const cy = (ys.get(x.id) ?? 0) + NH / 2
    const px = xOf(parent.level) + NW
    return [[px, py], [px + GX / 2, py], [px + GX / 2, cy], [xOf(x.level), cy]]
  }
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label="Decoder tree">
      <title>Larger decoder built from smaller ones</title>
      {tree.nodes
        .filter((x) => x.level > 0)
        .map((x) => {
          const pts4 = edge(x)
          const [px, cy] = [pts4[0][0], pts4[3][1]]
          const label = x.enable.from === 'node' ? `out ${x.enable.output}` : x.enable.from === 'bit' ? x.enable.text : 'E'
          const on = onPath.has(x.id)
          return (
            <g key={`e${x.id}`} className={`ms-net ${on ? 'is-now' : 'is-ctl is-off'}`}>
              <polyline points={pts(pts4)} className="ms-wire" />
              <text x={px + GX / 2 + 4} y={cy - 5} className="ms-small">
                {label}
              </text>
            </g>
          )
        })}
      {tree.nodes.map((x) => {
        const y = ys.get(x.id) ?? 0
        const on = onPath.has(x.id)
        const outs = x.outputs.length ? `D${x.outputs[0]}..D${x.outputs[x.outputs.length - 1]}` : x.kind === 'inverter' ? `${x.inputs[0]}' and ${x.inputs[0]}` : `${1 << tree.k} enables`
        return (
          <g key={x.id} className={`ms-net ${on ? 'is-now' : 'is-off'}`}>
            <rect x={xOf(x.level)} y={y} width={NW} height={NH} rx={3} className="ms-block" />
            <text x={xOf(x.level) + 8} y={y + 18} className="ms-label-sm">
              {x.kind === 'inverter' ? 'inverter stage' : `${tree.k}x${1 << tree.k} on ${x.inputs.join('')}`}
              {x.tiedLow ? `, ${x.tiedLow} tied 0` : ''}
            </text>
            <text x={xOf(x.level) + 8} y={y + 36} className="ms-small">
              {outs}
            </text>
          </g>
        )
      })}
      <Flow id={tree.code} paths={tree.nodes.filter((x) => x.level > 0 && onPath.has(x.id)).map((x) => polyD(edge(x)))} />
    </svg>
  )
}
