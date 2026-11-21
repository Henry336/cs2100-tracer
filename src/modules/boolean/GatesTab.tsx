import { useMemo, type ReactNode } from 'react'
import {
  exprNetwork,
  MAX_MIN_VARS,
  minimize,
  parseFunction,
  printExpr,
  singleGates,
  singleGatesOf,
  twoLevelCircuit,
  type CircuitKind,
  type Explain,
  type NetGateType,
  type Network,
} from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, DataTable, Legend, NumberField, Panel, Presets, Segmented, Select, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { bubbleAt, gatePath, layoutCircuit, simulate, type CircuitLayout, type DrawCircuit, type DrawGate } from './circuit-layout'
import { FnPresets, FunctionFields, IssueList, plural, W, type FnInput } from './common'
import { GATE_PRESETS } from './presets'
import { UniversalPanel } from './UniversalPanel'

const KINDS: { value: CircuitKind; label: string; title: string }[] = [
  { value: 'and-or', label: 'AND-OR', title: 'SOP as AND gates into an OR gate (L14 p13)' },
  { value: 'nand-nand', label: 'NAND-NAND', title: 'SOP with NAND gates only (L14 p14)' },
  { value: 'or-and', label: 'OR-AND', title: 'POS as OR gates into an AND gate (L14 p15)' },
  { value: 'nor-nor', label: 'NOR-NOR', title: 'POS with NOR gates only (L14 p16)' },
]

type Mode = 'cover' | 'expr'
type ShownGate = DrawGate & { why: Explain; realisedAs?: 'NAND' | 'NOR' }

/** A circuit to draw and count: the two-level circuit of a minimal cover, or the gate network of a typed expression. */
interface Shown extends DrawCircuit {
  gates: ShownGate[]
  expression: string
  counts: { gates: number; inverters: number; why: Explain }
  levels: { value: number; why: Explain }
  delay: { value: number; path: string[]; why: Explain }
}

/** Inputs of a network are the signals no gate makes: its variables, then any constants it uses. */
export function fromNetwork(net: Network, vars: string[], expression: string): Shown {
  const made = new Set(net.gates.map((g) => g.output))
  const used = new Set(net.gates.flatMap((g) => g.inputs).filter((s) => !made.has(s)))
  const constant = net.output === '0' || net.output === '1' ? (Number(net.output) as 0 | 1) : undefined
  if (!net.gates.length && constant === undefined) used.add(net.output)
  const inputs = [...vars.filter((v) => used.has(v) || used.has(`${v}'`)), ...['0', '1'].filter((k) => used.has(k))]
  return { ...net, inputs, expression, constant, gates: net.gates.map((g) => ({ ...g, inverter: g.type === 'NOT' })) }
}

const fmtT = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(2).replace(/0+$/, '')}t`

export default function GatesTab({ intro, input }: { intro: ReactNode; input: FnInput }) {
  const [rawMode, setMode] = useUrlState<Mode>('gm', 'cover')
  const [rawGx, setGx] = useUrlState<unknown>('gx', GATE_PRESETS[0].gx)
  const [rawKind, setKind] = useUrlState<CircuitKind>('ck', 'and-or')
  const [rawCover, setCover] = useUrlState<number>('cv', 0)
  const [cmp, setCmp] = useUrlState<boolean>('cmp', false)
  const [gd, setGd] = useUrlState<number>('gd', 1)
  const [idl, setIdl] = useUrlState<number>('idl', 1)
  const [fi, setFi] = useUrlState<boolean>('fi', false)
  const [focus, setFocus] = useUrlState<boolean>('fo', false)
  const [simOn, setSimOn] = useUrlState<boolean>('sim', false)
  const [row, setRow] = useUrlState<number>('row', 0)
  const mode: Mode = rawMode === 'expr' ? 'expr' : 'cover'
  const gx = typeof rawGx === 'string' ? rawGx : ''
  const kind: CircuitKind = KINDS.some((k) => k.value === rawKind) ? rawKind : 'and-or'
  const form = kind === 'and-or' || kind === 'nand-nand' ? 'sop' : 'pos'
  const gateDelay = Number.isFinite(gd) && gd >= 0 ? gd : 1
  const invDelay = Number.isFinite(idl) && idl >= 0 ? idl : 1

  const { fn } = input
  const gparse = useMemo(() => parseFunction(gx), [gx])
  const gexpr = gparse.ok ? gparse.expr : undefined
  const active = mode === 'expr' ? (gparse.ok ? gparse.fn : null) : fn
  const vars = useMemo(() => active?.vars ?? [], [active])
  const n = vars.length
  const name = active?.name ?? 'F'

  const min = useMemo(() => (mode === 'cover' && fn && fn.vars.length <= MAX_MIN_VARS ? minimize(fn, form) : null), [mode, fn, form])
  const coverIx = min ? Math.min(Math.max(0, Math.trunc(Number(rawCover) || 0)), min.covers.length - 1) : 0
  const cover = min?.covers[coverIx]
  const circuit = useMemo<Shown | null>(() => {
    if (mode === 'expr') {
      if (!gexpr || !active) return null
      const delays: Partial<Record<NetGateType, number>> = { AND: gateDelay, OR: gateDelay, NAND: gateDelay, NOR: gateDelay, XOR: gateDelay, XNOR: gateDelay, NOT: invDelay }
      return fromNetwork(exprNetwork(gexpr, { complementsAvailable: cmp === true, delays, fanInDelay: fi === true }), active.vars, printExpr(gexpr))
    }
    if (!fn || !min || !cover) return null
    return twoLevelCircuit(
      cover.primes.map((id) => min.primes[id].cube),
      fn.vars,
      kind,
      { complementsAvailable: cmp === true, gateDelay, inverterDelay: invDelay, name: fn.name },
    )
  }, [mode, gexpr, active, fn, min, cover, kind, cmp, gateDelay, invDelay, fi])
  const single = useMemo(
    () => (mode === 'expr' ? (gexpr && active ? singleGatesOf(gexpr, active.vars) : null) : fn && fn.vars.length <= MAX_MIN_VARS ? singleGates(fn) : null),
    [mode, gexpr, active, fn],
  )
  const lay = useMemo(() => (circuit ? layoutCircuit(circuit, name) : null), [circuit, name])
  const times = useMemo(() => (circuit ? [...new Set([0, ...circuit.gates.map((g) => g.arrival)])].sort((a, b) => a - b) : [0]), [circuit])
  const stepper = useStepper(times.length)
  const now = times[stepper.index] ?? 0
  const simRow = simOn === true && n > 0 ? Math.min(Math.max(0, Math.trunc(Number(row) || 0)), (1 << n) - 1) : null
  const values = useMemo(() => (circuit && simRow !== null ? simulate(circuit, simRow, vars) : null), [circuit, simRow, vars])

  const transport =
    circuit && circuit.gates.length ? (
      <Transport
        stepper={stepper}
        label="Time"
        marks={times.map((t) => (t === circuit.delay.value ? 'path' : undefined))}
        describe={`t = ${fmtT(now)}: ${circuit.gates.filter((g) => g.arrival === now).map((g) => g.output).join(', ') || 'inputs arrive'}`}
      />
    ) : undefined

  const gateCols: Column<ShownGate>[] = [
    { key: 'id', header: 'Gate', cell: (g) => g.id, mono: true },
    { key: 't', header: 'Type', cell: (g) => (g.realisedAs ? `${g.type} (${g.realisedAs}, inputs tied)` : g.type) },
    { key: 'in', header: 'Inputs', cell: (g) => g.inputs.join(', '), mono: true },
    { key: 'o', header: 'Output', cell: (g) => g.output, mono: true },
    { key: 'l', header: 'Level', cell: (g) => (g.type === 'NOT' && g.level === 0 ? 'none' : g.level), align: 'right' },
    { key: 'a', header: 'Stable at', cell: (g) => <W e={g.why}>{fmtT(g.arrival)}</W>, align: 'right' },
  ]
  const onPath = new Set(circuit?.delay.path ?? [])
  const title =
    mode === 'expr'
      ? `Circuit of ${name} = ${circuit?.expression ?? ''}`
      : `${KINDS.find((k) => k.value === kind)!.label} circuit of ${name} = ${cover?.text ?? ''}`

  const toolbar =
    mode === 'expr' ? (
      <Presets
        presets={GATE_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
        onPick={(p) => {
          setGx(p.gx)
          setGd(p.gd ?? 1)
          setFi(p.fi === true)
          stepper.first()
        }}
      />
    ) : (
      <FnPresets input={input} onPick={stepper.first} />
    )

  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L14, L17 p34, R07 p14, R08 p24-28"
      intro={intro}
      toolbar={toolbar}
      transport={transport}
      inspector={
        circuit ? (
          <>
            <Panel title="Counts">
              <dl className="bo-facts">
                <dt>Gates</dt>
                <dd>
                  <W e={circuit.counts.why}>{plural(circuit.counts.gates, 'gate')}</W>
                  {circuit.counts.inverters ? <span className="bo-muted">, {plural(circuit.counts.inverters, 'inverter')} among them</span> : null}
                </dd>
                <dt>Levels</dt>
                <dd>
                  <W e={circuit.levels.why}>{circuit.levels.value}</W>
                </dd>
                <dt>Delay</dt>
                <dd>
                  <W e={circuit.delay.why}>{fmtT(circuit.delay.value)}</W>
                </dd>
                <dt>Expression</dt>
                <dd className="mono bo-wrap">
                  {name} = {circuit.expression}
                </dd>
                {single ? (
                  <>
                    <dt>One gate</dt>
                    <dd className="mono bo-wrap">
                      <W e={single.why}>{single.matches.length ? single.matches.map((m) => (m.gate === 'CONST' || m.gate === 'WIRE' ? m.text : `${m.gate}: ${m.text}`)).join('; ') : 'no single gate does it'}</W>
                    </dd>
                  </>
                ) : null}
              </dl>
            </Panel>
            {circuit.gates.length ? (
              <Panel flush title="Gates">
                <DataTable compact columns={gateCols} rows={circuit.gates} rowSignal={(g) => (g.arrival === now ? 'path' : undefined)} />
              </Panel>
            ) : null}
          </>
        ) : undefined
      }
    >
      <Panel title="Circuit">
        <div className="bo-row">
          <Segmented
            label="Draw"
            value={mode}
            onChange={(m) => {
              setMode(m)
              stepper.first()
            }}
            options={[
              { value: 'cover', label: 'a minimal cover', title: 'Minimise the shared function, then build it as a 2-level circuit (L14 p13-16)' },
              { value: 'expr', label: 'an expression as typed', title: 'One gate per operator, as when you analyse a circuit (L14 p7-9)' },
            ]}
          />
        </div>
        {mode === 'expr' ? (
          <>
            <div className="bo-row">
              <div className="bo-grow">
                <TextField label="Expression" value={gx} onChange={setGx} placeholder="F(A,B,C) = ((A'∙B') + C)'" />
              </div>
            </div>
            {!gparse.ok ? <IssueList text={gx} issues={gparse.errors} /> : null}
            <IssueList text={gx} issues={gparse.warnings} kind="warning" />
            {gparse.ok && !gexpr ? <p className="bo-status bo-bad">Type an expression here. A Σm or ΠM list is drawn from a minimal cover instead.</p> : null}
          </>
        ) : (
          <>
            <FunctionFields input={input} />
            <div className="bo-row">
              <Segmented label="Circuit" value={kind} onChange={setKind} options={KINDS} />
              {min && min.covers.length > 1 ? (
                <Select
                  label={`Minimal ${form === 'sop' ? 'SOP' : 'POS'} (${min.summary.covers.value}${min.summary.covers.exact === false ? '+' : ''})`}
                  value={String(coverIx)}
                  onChange={(v) => setCover(Number(v))}
                  options={min.covers.map((c, i) => ({ value: String(i), label: c.text }))}
                />
              ) : null}
            </div>
          </>
        )}
        <div className="bo-row bo-toggles">
          <Toggle label="Complemented inputs available" checked={cmp === true} onChange={setCmp} hint="Off by default: the course gives only the plain inputs unless a question says so (T06 p2)" />
          <NumberField label="Gate delay" value={gateDelay} onChange={setGd} min={0} step={0.5} suffix="t" />
          <NumberField label="Inverter delay" value={invDelay} onChange={setIdl} min={0} step={0.5} suffix="t" />
          {mode === 'expr' ? (
            <Toggle label="Delay grows with fan-in (n inputs take n times the delay)" checked={fi === true} onChange={setFi} hint="AY17/18 Q1c(ii)" />
          ) : null}
        </div>
        <div className="bo-row bo-toggles">
          <Toggle label="Show only what is stable at this time" checked={focus === true} onChange={setFocus} hint="Hides gates and wires whose value has not settled yet" />
          <Toggle label="Simulate an input row" checked={simOn === true} onChange={setSimOn} />
          {simOn === true && n > 0 ? <NumberField label={`Row (${vars.join('')})`} value={simRow ?? 0} onChange={setRow} min={0} max={(1 << n) - 1} /> : null}
          {simRow !== null && circuit ? (
            <span className="mono bo-muted">
              {vars.map((v, i) => `${v}=${(simRow >> (n - 1 - i)) & 1}`).join(' ')}, {name} = {values?.get(circuit.output) ?? circuit.constant ?? ''}
            </span>
          ) : null}
        </div>
      </Panel>

      {mode === 'cover' && fn && fn.vars.length > MAX_MIN_VARS ? (
        <Callout kind="course" title="Too many variables">
          The minimiser takes at most {MAX_MIN_VARS} variables.
        </Callout>
      ) : null}

      {circuit && lay ? (
        <>
          <Panel flush title={title} actions={<span className="bo-muted mono">t = {fmtT(now)}</span>}>
            <div className="bo-scroll">
              <CircuitSvg c={circuit} lay={lay} now={now} focus={focus === true} path={onPath} values={values} />
            </div>
            <div className="bo-pad">
              <Legend
                items={[
                  { signal: 'path', label: 'slowest path, sets the delay' },
                  { signal: 'data', label: 'stable at this time' },
                  { signal: 'stall', label: 'not settled yet (dashed)' },
                  ...(values ? [{ signal: 'hit' as const, label: 'signal is 1 on this row' }] : []),
                ]}
              />
            </div>
          </Panel>
          {circuit.gates.length ? (
            <Panel flush title="Delay timeline">
              <div className="bo-scroll">
                <Timeline c={circuit} now={now} path={onPath} />
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}

      <UniversalPanel />

      <div className="bo-callouts">
        <Callout kind="course" title="Complemented inputs are not free" cite="T06 p2; T07 p2; R08 p34">
          Unless a question says so, only A, B, C and so on are given, so each A' needs an inverter. Constants 0 and 1 are always available.
        </Callout>
        <Callout kind="trap" title="Inverters are gates, but not a level" cite="R07 p14">
          Count inverters when a question asks for the number of gates. An inverter on an input does not add a level, so AND-OR stays 2-level.
        </Callout>
        {mode === 'cover' && (kind === 'nand-nand' || kind === 'nor-nor') ? (
          <Callout kind="trap" title="A lone literal enters complemented" cite="L14 p14, p16">
            In A∙B + C'∙D + E built from NANDs, E goes into the output NAND as E'. The same holds for a single literal in a NOR-NOR POS circuit.
          </Callout>
        ) : null}
        {mode === 'expr' ? (
          <Callout kind="course" title="One gate per operator" cite="L14 p7-9; AY23/24 S2 Q12">
            A NOT over an AND or OR is drawn as one NAND or NOR, and a sub-expression used twice is one gate with two wires out. Check the One gate line: four NANDs can be a
            single XOR.
          </Callout>
        ) : null}
        <Callout kind="course" title="How the delay is worked out">
          Every gate takes the delay you set, and a signal is stable at the latest input time plus that delay (L17 p34; R08 p24). No course source fixes the inverter
          delay, so it has its own field.
        </Callout>
      </div>
    </Workspace>
  )
}

export function CircuitSvg({
  c,
  lay,
  now,
  focus,
  path,
  values,
}: {
  c: DrawCircuit
  lay: CircuitLayout
  now: number
  focus: boolean
  path: Set<string>
  values: Map<string, 0 | 1> | null
}) {
  const time = new Map<string, number>(c.gates.map((g) => [g.output, g.arrival]))
  const at = (s: string) => time.get(s) ?? 0
  const cls = (s: string, to?: string) => {
    const ready = at(s) <= now
    const onPath = path.has(s) && (to === undefined || path.has(to) || to === lay.output.label)
    return `${ready ? (onPath ? 'is-path' : 'is-ready') : 'is-wait'}${!ready && focus ? ' is-hidden' : ''}`
  }
  const val = (s: string) => values?.get(s)
  return (
    <svg className="bo-circuit" viewBox={`0 0 ${lay.width} ${lay.height}`} width={lay.width} height={lay.height} role="img" aria-label="Gate circuit">
      <title>Gate circuit</title>
      {lay.rails.map((r) => (
        <g key={r.signal} className={`bo-net ${cls(r.signal)}`}>
          <text x={r.x} y={12} textAnchor="middle" className="bo-c-label">
            {r.signal}
          </text>
          {r.inverter && r.fromX !== undefined ? (
            <>
              <polyline points={`${r.fromX},22 ${r.x},22 ${r.x},28`} className="bo-wire" />
              <path d={`M${r.x - 7},28 L${r.x + 7},28 L${r.x},41 Z`} className="bo-gate" />
              <circle cx={r.x} cy={44.5} r={3.5} className="bo-gate" />
            </>
          ) : null}
          <line x1={r.x} y1={r.y0} x2={r.x} y2={r.y1} className="bo-wire" />
          {val(r.signal) !== undefined ? (
            <text x={r.x + 4} y={r.y0 + 12} className={`bo-c-val v-${val(r.signal)}`}>
              {val(r.signal)}
            </text>
          ) : null}
        </g>
      ))}
      {lay.wires.map((w, i) => (
        <g key={i} className={`bo-net ${cls(w.from, w.to)}`}>
          <polyline points={w.points.map((p) => p.join(',')).join(' ')} className="bo-wire" />
          {w.dot ? <circle cx={w.dot[0]} cy={w.dot[1]} r={2.6} className="bo-dot" /> : null}
        </g>
      ))}
      {[...new Map(lay.gates.map((pg) => [pg.col, pg])).values()].map((pg) => (
        <text key={`lv${pg.col}`} x={pg.x} y={30} className="bo-c-time">
          {pg.gate.type === 'NOT' ? 'inverter' : `level ${pg.gate.level}`}
        </text>
      ))}
      {lay.gates.map((pg) => {
        const g = pg.gate
        const b = bubbleAt(g.type, pg.x, pg.y, pg.h)
        const v = val(g.output)
        return (
          <g key={g.id} className={`bo-net ${cls(g.output)}`}>
            <path d={gatePath(g.type, pg.x, pg.y, pg.h)} className="bo-gate" />
            {b ? <circle cx={b.cx} cy={b.cy} r={4} className="bo-gate" /> : null}
            <text x={pg.x + 4} y={pg.y + pg.h / 2 + 4} className="bo-c-type">
              {g.type === 'NOT' ? '' : g.type}
            </text>
            <text x={pg.out.x + 3} y={pg.out.y - 5} className="bo-c-out">
              {g.output === lay.output.from ? '' : g.output}
            </text>
            <text x={pg.x} y={pg.y - 4} className="bo-c-time">
              {g.id}, {fmtT(g.arrival)}
            </text>
            {v !== undefined ? (
              <text x={pg.out.x + 3} y={pg.out.y + 13} className={`bo-c-val v-${v}`}>
                {v}
              </text>
            ) : null}
          </g>
        )
      })}
      <text x={lay.output.x + 4} y={lay.output.y + 4} className="bo-c-label">
        {lay.output.label}
      </text>
    </svg>
  )
}

function Timeline({ c, now, path }: { c: DrawCircuit; now: number; path: Set<string> }) {
  const time = new Map<string, number>(c.gates.map((g) => [g.output, g.arrival]))
  const rows = [...c.gates].sort((a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id))
  const total = Math.max(...c.gates.map((g) => g.arrival), 1)
  const L = 170
  const W = 420
  const RH = 20
  const x = (t: number) => L + (t / total) * W
  const h = rows.length * RH + 34
  const ticks = Array.from({ length: Math.floor(total) + 1 }, (_, i) => i)
  return (
    <svg className="bo-timeline" viewBox={`0 0 ${L + W + 30} ${h}`} width={L + W + 30} height={h} role="img" aria-label="When each gate output settles">
      <title>When each gate output settles</title>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={6} x2={x(t)} y2={h - 18} className="bo-tl-grid" />
          <text x={x(t)} y={h - 4} textAnchor="middle" className="bo-c-time">
            {fmtT(t)}
          </text>
        </g>
      ))}
      {rows.map((g, i) => {
        // A gate starts switching when its last input settles (R08 p24).
        const start = Math.max(0, ...g.inputs.map((s) => time.get(s) ?? 0))
        const y = 8 + i * RH
        const cl = path.has(g.output) ? 'is-path' : g.arrival <= now ? 'is-ready' : 'is-wait'
        return (
          <g key={g.id} className={`bo-net ${cl}`}>
            <text x={L - 8} y={y + 12} textAnchor="end" className="bo-c-out">
              {g.id} {g.type} {g.output.length > 14 ? `${g.output.slice(0, 13)}…` : g.output}
            </text>
            <rect x={x(start)} y={y + 3} width={Math.max(2, x(g.arrival) - x(start))} height={RH - 8} rx={2} className="bo-tl-bar" />
          </g>
        )
      })}
      <line x1={x(now)} y1={2} x2={x(now)} y2={h - 18} className="bo-tl-now" />
    </svg>
  )
}
