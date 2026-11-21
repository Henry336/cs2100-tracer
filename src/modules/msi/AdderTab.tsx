import { useMemo, type ReactNode } from 'react'
import { fullAdder, fullAdderTiming, halfAdder, rippleAdd, type AdderTrace, type Explain } from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Callout, DataTable, Legend, NumberField, Presets, Segmented, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitRow, BitToggle, bitOf, Board, bubble, Details, Flow, gatePath, int, netClass, Options, pick, PlayBar, polyD, pts, seg, W, type NetState, type Shape } from './common'
import { ADDER_PRESETS } from './presets'

type Mode = 'ha' | 'fa' | 'rc'
type Numbering = 'lec' | 'tut'

const T = (n: number) => (n === 0 ? '0' : n === 1 ? 't' : `${n}t`)
const stateAt = (time: number, t: number): NetState => (time === t ? 'now' : time < t ? 'ready' : 'wait')

export default function AdderTab({ intro }: { intro: ReactNode }) {
  const [rawMode, setMode] = useUrlState<Mode>('am', 'rc')
  const [rawN, setN] = useUrlState<number>('an', 4)
  const [rawX, setX] = useUrlState<number>('ax', 10)
  const [rawY, setY] = useUrlState<number>('ay', 15)
  const [rawC, setC] = useUrlState<number>('ac', 0)
  const [rawH, setH] = useUrlState<number>('ah', 3)
  const [rawF, setF] = useUrlState<number>('af', 3)
  const [rawNb, setNb] = useUrlState<Numbering>('anb', 'lec')
  const [focus, setFocus] = useUrlState<boolean>('afo', false)
  const mode = pick(rawMode, ['ha', 'fa', 'rc'] as const, 'rc')
  const n = int(rawN, 1, 16, 4)
  const max = 2 ** n - 1
  const x = int(rawX, 0, max, 0)
  const y = int(rawY, 0, max, 0)
  const cin = int(rawC, 0, 1, 0) as 0 | 1
  const hm = int(rawH, 0, 3, 3)
  const fm = int(rawF, 0, 7, 3)
  const nb = pick(rawNb, ['lec', 'tut'] as const, 'lec')
  const fo = focus === true

  const ripple = useMemo(() => (mode === 'rc' ? rippleAdd({ width: n, x, y, cin }) : null), [mode, n, x, y, cin])
  const trace = ripple?.ok ? ripple.trace : null
  const steps = mode === 'ha' ? 2 : mode === 'fa' ? 4 : trace ? trace.delay.cout + 1 : 1
  const stepper = useStepper(steps)
  const t = Math.min(stepper.index, steps - 1)

  const name = (kind: 'X' | 'Y' | 'S' | 'C', k: number) => `${kind}${nb === 'lec' ? k + 1 : k}`
  const describe =
    mode === 'rc' && trace
      ? t === 0
        ? 'all inputs stable'
        : (() => {
            const now = trace.stages.flatMap((s, k) => [
              ...(s.timing.s === t ? [`${name('S', k)} = ${s.fa.s}`] : []),
              ...(s.timing.cout === t ? [`${name('C', k + 1)} = ${s.fa.c}`] : []),
            ])
            return now.length ? `${now.join(' and ')} settle` : 'X⊕Y and X∙Y settle in every stage'
          })()
      : mode === 'fa'
        ? ['inputs stable', 'X⊕Y and X∙Y settle', 'S and (X⊕Y)∙Z settle', 'C settles'][t]
        : ['inputs stable', 'S and C settle'][t]

  const toolbar = (
    <Presets
      presets={ADDER_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setMode(p.mode)
        if (p.n !== undefined) setN(p.n)
        if (p.x !== undefined) setX(p.x)
        if (p.y !== undefined) setY(p.y)
        if (p.cin !== undefined) setC(p.cin)
        if (p.mask !== undefined) (p.mode === 'ha' ? setH : setF)(p.mask)
        stepper.last()
      }}
    />
  )

  const circuitPick = (
    <Segmented
      label="Circuit"
      value={mode}
      onChange={(m) => {
        setMode(m)
        stepper.first()
      }}
      options={[
        { value: 'ha', label: 'half adder', title: 'L17 p6-7' },
        { value: 'fa', label: 'full adder', title: 'Two half adders and an OR gate (L17 p9-12)' },
        { value: 'rc', label: 'ripple-carry adder', title: 'Full adders chained by their carries (L17 p18-21)' },
      ]}
    />
  )

  const command = (
    <div className="ms-command">
      {circuitPick}
      {mode === 'ha' ? (
        <BitRow label="Inputs X, Y" names={['X', 'Y']} value={hm} onChange={setH} />
      ) : mode === 'fa' ? (
        <BitRow label="Inputs X, Y and carry-in Z" names={['X', 'Y', 'Z']} value={fm} onChange={setF} />
      ) : (
        <>
          <BitRow label={`X = ${x}`} names={Array.from({ length: n }, (_, j) => name('X', n - 1 - j))} value={x} onChange={setX} />
          <BitRow label={`Y = ${y}`} names={Array.from({ length: n }, (_, j) => name('Y', n - 1 - j))} value={y} onChange={setY} />
          <div className="ms-bitrow">
            <span className="control-label">Carry-in</span>
            <div className="ms-bits">
              <BitToggle label={nb === 'lec' ? 'C1' : 'Cin'} value={cin} onChange={setC} />
            </div>
          </div>
        </>
      )}
    </div>
  )

  const options =
    mode === 'rc' ? (
      <Options summary="Width and bit names">
        <div className="ms-row">
          <NumberField label="Width" value={n} onChange={(v) => setN(Math.min(16, Math.max(1, Math.trunc(v))))} min={1} max={16} suffix="bits" />
          <Segmented
            label="Bit names"
            value={nb}
            onChange={setNb}
            options={[
              { value: 'lec', label: 'lecture, 1 = LSB', title: 'X4..X1, C1 in, C5 out (L17 p20)' },
              { value: 'tut', label: 'tutorial, 0 = LSB', title: 'X3..X0 (T07)' },
            ]}
          />
        </div>
      </Options>
    ) : null

  const settled = <Toggle label="Show only what has settled" checked={fo} onChange={setFocus} hint="Hides every wire and gate whose value is not stable yet at this step" />
  const play = <PlayBar stepper={stepper} start="Step through the gate delays" next={`t = ${T(t + 1)}`} />

  const legend = (
    <Legend
      items={[
        { signal: 'path', label: 'settles at this step' },
        { signal: 'data', label: 'settled' },
        { signal: 'stall', label: 'not settled yet (dashed)' },
        { signal: 'hit', label: 'value 1' },
      ]}
    />
  )

  if (mode !== 'rc') {
    const half = mode === 'ha'
    const [hx, hy] = [bitOf(hm, 1), bitOf(hm, 0)]
    const [fx, fy, fz] = [bitOf(fm, 2), bitOf(fm, 1), bitOf(fm, 0)]
    const ha = halfAdder(hx, hy)
    const fa = fullAdder(fx, fy, fz)
    const tm = fullAdderTiming(0)
    const rows = Array.from({ length: half ? 4 : 8 }, (_, r) => r)
    const vars = half ? ['X', 'Y'] : ['X', 'Y', 'Z']
    const cur = half ? hm : fm
    const out = (r: number) => (half ? halfAdder(bitOf(r, 1), bitOf(r, 0)) : fullAdder(bitOf(r, 2), bitOf(r, 1), bitOf(r, 0)))
    const cols: Column<number>[] = [
      ...vars.map((v, j) => ({ key: v, header: v, cell: (r: number) => bitOf(r, vars.length - 1 - j), align: 'center' as const, mono: true })),
      { key: 'c', header: 'C', cell: (r) => out(r).c, align: 'center', mono: true },
      { key: 's', header: 'S', cell: (r) => out(r).s, align: 'center', mono: true },
    ]
    const cOn = rows.filter((r) => out(r).c)
    const sOn = rows.filter((r) => out(r).s)
    const why = half ? ha.why : fa.why
    const res = half ? ha : fa
    return (
      <Workspace
        title="Combinational and MSI"
        lectures="L17 p6-12, p34-35"
        intro={intro}
        toolbar={toolbar}
        transport={<Transport stepper={stepper} label="Gate delay" marks={Array.from({ length: steps }, (_, i) => (i === steps - 1 ? 'path' : undefined))} describe={`t = ${T(t)}: ${describe}`} />}
      >
        {command}
        <Board title={half ? 'Half adder: S = X⊕Y, C = X∙Y' : 'Full adder: two half adders and an OR gate'} step={`t = ${T(t)}`} note={describe} tools={settled} play={play} foot={legend}>
          <FaGates half={half} x={half ? hx : fx} y={half ? hy : fy} z={fz} t={t} focus={fo} />
        </Board>
        <Details
          tabs={[
            {
              value: 'out',
              label: 'Outputs',
              body: (
                <dl className="ms-facts">
                  <dt>Sum S</dt>
                  <dd>
                    <W e={why.s}>
                      <span className="mono">S = {res.s}</span>
                    </W>
                    <span className="ms-muted"> stable at {half ? 't' : <W e={tm.why.s}>{T(tm.s)}</W>}</span>
                  </dd>
                  <dt>Carry C</dt>
                  <dd>
                    <W e={why.c}>
                      <span className="mono">C = {res.c}</span>
                    </W>
                    <span className="ms-muted"> stable at {half ? 't' : <W e={tm.why.cout}>{T(tm.cout)}</W>}</span>
                  </dd>
                  <dt>As minterms</dt>
                  <dd className="mono">
                    C = Σm({cOn.join(',')}), S = Σm({sOn.join(',')})
                  </dd>
                </dl>
              ),
            },
            { value: 'tt', label: 'Truth table', body: <DataTable compact columns={cols} rows={rows} rowSignal={(r) => (r === cur ? 'path' : undefined)} /> },
            {
              value: 'rules',
              label: 'Rules and traps',
              body: (
                <div className="ms-callouts">
                  <Callout kind="course" title="Every gate costs one delay t" cite="L17 p34-35">
                    A gate output is stable at the latest input time plus t, and XOR counts as one gate. The full adder is drawn as two half adders and an OR gate, so S is
                    stable at 2t and C at 3t.
                  </Callout>
                  <Callout kind="trap" title="The delay depends on the drawing" cite="L17 p35">
                    The 2t and 3t only hold for the two half adders plus OR drawing. A full adder built as the SOP C = XY + XZ + YZ has different gate delays.
                  </Callout>
                </div>
              ),
            },
          ]}
        />
      </Workspace>
    )
  }

  if (!trace)
    return (
      <Workspace title="Combinational and MSI" lectures="L17 p18-38" intro={intro} toolbar={toolbar}>
        {command}
        {options}
      </Workspace>
    )

  const stageCols: Column<AdderTrace['stages'][number]>[] = [
    { key: 'fa', header: 'Stage', cell: (s) => `FA ${nb === 'lec' ? s.i : s.bit}` },
    { key: 'x', header: 'X', cell: (s) => s.fa.x, align: 'center', mono: true },
    { key: 'y', header: 'Y', cell: (s) => s.fa.y, align: 'center', mono: true },
    { key: 'ci', header: 'Carry in', cell: (s) => (s.timing.cin <= t ? s.fa.z : '?'), align: 'center', mono: true },
    {
      key: 's',
      header: 'Sum (stable at)',
      cell: (s) => (
        <W e={s.timing.why.s}>
          {s.timing.s <= t ? s.fa.s : '?'} ({T(s.timing.s)})
        </W>
      ),
      align: 'right',
      mono: true,
    },
    {
      key: 'co',
      header: 'Carry out (stable at)',
      cell: (s) => (
        <W e={s.timing.why.cout}>
          {s.timing.cout <= t ? s.fa.c : '?'} ({T(s.timing.cout)})
        </W>
      ),
      align: 'right',
      mono: true,
    },
  ]
  const last = trace.stages[n - 1]
  const outName = nb === 'lec' ? `C${n + 1}` : 'Cout'

  return (
    <Workspace
      title="Combinational and MSI"
      lectures="L17 p18-24, p34-38"
      intro={intro}
      toolbar={toolbar}
      transport={
        <Transport
          stepper={stepper}
          label="Gate delay"
          marks={Array.from({ length: steps }, (_, i) => (trace.stages.some((s) => s.timing.cout === i) ? 'data' : undefined))}
          describe={`t = ${T(t)}: ${describe}`}
        />
      }
    >
      {command}
      {options}
      <Board title={`${n}-bit ripple-carry adder`} step={`t = ${T(t)}`} note={describe} tools={settled} play={play} foot={legend}>
        <RippleSvg trace={trace} t={t} focus={fo} name={name} cinName={nb === 'lec' ? 'C1' : 'Cin'} outName={outName} />
      </Board>
      <Details
        tabs={[
          { value: 'cols', label: 'Column addition', body: <ColumnSum trace={trace} t={t} name={name} /> },
          {
            value: 'stages',
            label: 'Stages',
            body: <DataTable compact columns={stageCols} rows={trace.stages} rowSignal={(s) => (s.timing.s === t || s.timing.cout === t ? 'path' : undefined)} />,
          },
          {
            value: 'delay',
            label: 'Result and delay',
            body: (
              <dl className="ms-facts">
                <dt>Sum</dt>
                <dd>
                  <W e={trace.why.total}>
                    <span className="mono">{last.timing.cout <= t ? `${trace.cout} ${trace.columns.sum} = ${trace.total}` : 'not settled yet'}</span>
                  </W>
                </dd>
                <dt>{nb === 'lec' ? `S${n}` : `S${n - 1}`} stable at</dt>
                <dd>
                  <W e={trace.delay.why}>{T(trace.delay.s)}</W>
                </dd>
                <dt>{outName} stable at</dt>
                <dd>
                  <W e={trace.delay.why}>{T(trace.delay.cout)}</W>
                </dd>
                <dt>Truth table</dt>
                <dd>
                  {2 * n + 1} inputs, so {(2 ** (2 * n + 1)).toLocaleString('en')} rows. Cascade full adders instead.
                </dd>
              </dl>
            ),
          },
          {
            value: 'rules',
            label: 'Rules and traps',
            body: (
              <div className="ms-callouts">
                <Callout kind="course" title="Two numberings" cite="L17 p20; T07">
                  The lecture numbers the bits from 1 (X4..X1, carry-in C1, carry-out C5). The tutorials number them from 0 (X3..X0). Switch under Width and bit names.
                </Callout>
                <Callout kind="course" title="The carry ripples" cite="L17 p36-38">
                  Each stage waits for the carry from the stage below, 2t more per stage. For n bits, Sn is stable at ((n-1)∙2+2)t and Cn+1 at ((n-1)∙2+3)t.
                </Callout>
                <Callout kind="trap" title="Not from a truth table" cite="L17 p19">
                  A 4-bit adder has 9 inputs, so a truth table needs 512 rows. Build it from blocks: full adders, or 4-bit adders chained through their carries (L17 p24).
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Gate-level half adder / full adder (L17 p7, p12) ---------- */

interface Net {
  id: string
  lines: [number, number][][]
  time: number
  value: 0 | 1
  at: [number, number]
  label?: string
}

function FaGates({ half, x, y, z, t, focus }: { half: boolean; x: 0 | 1; y: 0 | 1; z: 0 | 1; t: number; focus: boolean }) {
  const ha1 = halfAdder(x, y)
  const ha2 = halfAdder(ha1.s, z)
  const c = (ha1.c | ha2.c) as 0 | 1
  const GW = 50
  const GH = 40
  const outX = half ? 330 : 480
  const nets: Net[] = [
    { id: 'X', lines: [[[34, 40], [110, 40]], [[70, 40], [70, 100], [110, 100]]], time: 0, value: x, at: [38, 34] },
    { id: 'Y', lines: [[[34, 70], [86, 70], [86, 60], [110, 60]], [[86, 70], [86, 120], [110, 120]]], time: 0, value: y, at: [38, 64] },
  ]
  if (half) {
    nets.push(
      { id: 'S', lines: [[[160, 50], [outX, 50]]], time: 1, value: ha1.s, at: [200, 44], label: 'S' },
      { id: 'C', lines: [[[160, 110], [outX, 110]]], time: 1, value: ha1.c, at: [200, 104], label: 'C' },
    )
  } else {
    nets.push(
      { id: 'Z', lines: [[[34, 172], [226, 172], [250, 172]], [[226, 172], [226, 60], [250, 60]]], time: 0, value: z, at: [38, 166] },
      { id: 'P', lines: [[[160, 50], [200, 50], [200, 40], [250, 40]], [[200, 50], [200, 152], [250, 152]]], time: 1, value: ha1.s, at: [163, 64], label: 'X⊕Y' },
      { id: 'G', lines: [[[160, 110], [340, 110], [340, 115], [360, 115]]], time: 1, value: ha1.c, at: [166, 104], label: 'X∙Y' },
      { id: 'Q', lines: [[[300, 162], [340, 162], [340, 135], [360, 135]]], time: 2, value: ha2.c, at: [304, 180], label: '(X⊕Y)∙Z' },
      { id: 'S', lines: [[[300, 50], [outX, 50]]], time: 2, value: ha2.s, at: [312, 44], label: 'S' },
      { id: 'C', lines: [[[410, 125], [outX, 125]]], time: 3, value: c, at: [418, 119], label: 'C' },
    )
  }
  const gates: { shape: Shape; x: number; y: number; time: number; name: string }[] = [
    { shape: 'XOR', x: 110, y: 30, time: 1, name: 'XOR' },
    { shape: 'AND', x: 110, y: 90, time: 1, name: 'AND' },
    ...(half
      ? []
      : ([
          { shape: 'XOR', x: 250, y: 30, time: 2, name: 'XOR' },
          { shape: 'AND', x: 250, y: 142, time: 2, name: 'AND' },
          { shape: 'OR', x: 360, y: 105, time: 3, name: 'OR' },
        ] as const)),
  ]
  const VW = outX + 40
  const H = half ? 150 : 205
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW * 1.3} height={H * 1.3} role="img" aria-label={half ? 'Half adder gates' : 'Full adder gates'}>
      <title>{half ? 'Half adder' : 'Full adder from two half adders and an OR gate'}</title>
      <rect x={96} y={18} width={78} height={124} className="ms-group" />
      <text x={100} y={154} className="ms-small">
        half adder{half ? '' : ' 1'}
      </text>
      {!half ? (
        <>
          <rect x={236} y={18} width={78} height={180} className="ms-group" />
          <text x={240} y={196} className="ms-small" dy={-4}>
            half adder 2
          </text>
        </>
      ) : null}
      {nets.map((nt) => {
        const s = stateAt(nt.time, t)
        return (
          <g key={nt.id} className={netClass(s, focus)}>
            {nt.lines.map((l, i) => (
              <polyline key={i} points={pts(l)} className="ms-wire" />
            ))}
            {nt.lines.length > 1 ? <circle cx={nt.lines[1][0][0]} cy={nt.lines[1][0][1]} r={2.6} className="ms-dot" /> : null}
            <text x={nt.at[0]} y={nt.at[1]} className={`ms-val v-${s === 'wait' ? 'x' : nt.value}`}>
              {nt.label && nt.time > 0 && nt.id !== 'S' && nt.id !== 'C' ? `${nt.label} ` : ''}
              {s === 'wait' ? '?' : nt.value}
            </text>
          </g>
        )
      })}
      <Flow id={t} paths={nets.filter((nt) => nt.time === t).flatMap((nt) => nt.lines.map(polyD))} />
      {['X', 'Y', ...(half ? [] : ['Z'])].map((v, i) => (
        <text key={v} x={8} y={[44, 74, 176][i]} className="ms-label">
          {v}
        </text>
      ))}
      {gates.map((g, i) => {
        const s = stateAt(g.time, t)
        const b = bubble(g.shape, g.x, g.y, GW, GH)
        return (
          <g key={i} className={netClass(s, focus)}>
            <path d={gatePath(g.shape, g.x, g.y, GW, GH)} className="ms-gate" />
            {b ? <circle cx={b.cx} cy={b.cy} r={4} className="ms-gate" /> : null}
            <text x={g.x + 8} y={g.y + GH / 2 + 4} className="ms-small">
              {g.name}
            </text>
            <text x={g.x} y={g.y - 4} className="ms-small">
              {T(g.time)}
            </text>
          </g>
        )
      })}
      <text x={outX + 6} y={54} className="ms-label">
        S
      </text>
      <text x={outX + 6} y={(half ? 110 : 125) + 4} className="ms-label">
        C
      </text>
    </svg>
  )
}

/* ---------- Block-level ripple-carry adder (L17 p20) ---------- */

function RippleSvg({
  trace,
  t,
  focus,
  name,
  cinName,
  outName,
}: {
  trace: AdderTrace
  t: number
  focus: boolean
  name: (kind: 'X' | 'Y' | 'S' | 'C', k: number) => string
  cinName: string
  outName: string
}) {
  const n = trace.width
  const BW = 96
  const BH = 64
  const GAP = 52
  const L = 74
  const TOP = 44
  const CY = TOP + 32
  const x0 = (k: number) => L + (n - 1 - k) * (BW + GAP)
  const VW = L + n * BW + (n - 1) * GAP + 70
  const H = TOP + BH + 62
  const val = (s: NetState, v: 0 | 1) => (s === 'wait' ? '?' : String(v))
  const vcls = (s: NetState, v: 0 | 1) => `ms-val v-${s === 'wait' ? 'x' : v}`
  // The wires that settle at this step: the inputs at t = 0, then each carry as it ripples and each sum.
  const flow = trace.stages.flatMap((st, k) => {
    const bx = x0(k)
    return [
      ...(t === 0 ? [seg(bx + 30, 20, bx + 30, TOP), seg(bx + 66, 20, bx + 66, TOP)] : []),
      ...(st.timing.cin === t ? [seg(k === 0 ? bx + BW + 40 : x0(k - 1), CY, bx + BW, CY)] : []),
      ...(st.timing.s === t ? [seg(bx + BW / 2, TOP + BH, bx + BW / 2, TOP + BH + 26)] : []),
      ...(k === n - 1 && st.timing.cout === t ? [seg(bx, CY, bx - 40, CY)] : []),
    ]
  })
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label={`${n}-bit ripple-carry adder`}>
      <title>{`${n}-bit ripple-carry adder at t = ${T(t)}`}</title>
      {trace.stages.map((st, k) => {
        const bx = x0(k)
        const sIn = stateAt(0, t)
        const sCin = stateAt(st.timing.cin, t)
        const sS = stateAt(st.timing.s, t)
        const sC = stateAt(st.timing.cout, t)
        const block: NetState = sS === 'now' || sC === 'now' ? 'now' : sC === 'ready' ? 'ready' : t >= st.timing.ha1 ? 'ready' : 'wait'
        return (
          <g key={k}>
            {(['X', 'Y'] as const).map((v, j) => {
              const px = bx + (j ? 66 : 30)
              const bit = j ? st.fa.y : st.fa.x
              return (
                <g key={v} className={netClass(sIn, false)}>
                  <line x1={px} y1={20} x2={px} y2={TOP} className="ms-wire" />
                  <text x={px} y={14} textAnchor="middle" className="ms-label-sm">
                    {name(v, k)} <tspan className={vcls(sIn, bit)}>{bit}</tspan>
                  </text>
                </g>
              )
            })}
            {/* Carry into this stage: from the stage to the right, or the external carry-in. */}
            <g className={netClass(sCin, focus)}>
              <line x1={k === 0 ? bx + BW + 40 : x0(k - 1)} y1={CY} x2={bx + BW} y2={CY} className="ms-wire" />
              <text x={bx + BW + GAP / 2} y={CY - 6} textAnchor="middle" className={vcls(sCin, st.fa.z)}>
                {val(sCin, st.fa.z)}
              </text>
              <text x={bx + BW + GAP / 2} y={CY + 16} textAnchor="middle" className="ms-small">
                {k === 0 ? cinName : name('C', k)}
              </text>
            </g>
            <g className={netClass(block, focus)}>
              <rect x={bx} y={TOP} width={BW} height={BH} rx={3} className="ms-block" />
              <text x={bx + BW / 2} y={TOP + 26} textAnchor="middle" className="ms-label">
                FA {name('X', k).slice(1)}
              </text>
              <text x={bx + BW / 2} y={TOP + 44} textAnchor="middle" className="ms-small">
                S {T(st.timing.s)}, C {T(st.timing.cout)}
              </text>
            </g>
            <g className={netClass(sS, focus)}>
              <line x1={bx + BW / 2} y1={TOP + BH} x2={bx + BW / 2} y2={TOP + BH + 26} className="ms-wire" />
              <text x={bx + BW / 2} y={TOP + BH + 42} textAnchor="middle" className="ms-label-sm">
                {name('S', k)} <tspan className={vcls(sS, st.fa.s)}>{val(sS, st.fa.s)}</tspan>
              </text>
            </g>
            {k === n - 1 ? (
              <g className={netClass(sC, focus)}>
                <line x1={bx} y1={CY} x2={bx - 40} y2={CY} className="ms-wire" />
                <text x={bx - 44} y={CY + 4} textAnchor="end" className={vcls(sC, st.fa.c)}>
                  {val(sC, st.fa.c)}
                </text>
                <text x={bx - 20} y={CY + 16} textAnchor="middle" className="ms-small">
                  {outName}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
      <Flow id={t} paths={flow} />
    </svg>
  )
}

/* ---------- Column addition with the carry row (L17 p27) ---------- */

function ColumnSum({ trace, t, name }: { trace: AdderTrace; t: number; name: (kind: 'X' | 'Y' | 'S' | 'C', k: number) => string }) {
  const n = trace.width
  const ks = Array.from({ length: n }, (_, j) => n - 1 - j)
  const st = (k: number) => trace.stages[k]
  const last = st(n - 1)
  const cell = (key: string | number, ready: boolean, now: boolean, v: number | string, why?: Explain) => (
    <td key={key} className={now ? 'is-now' : ready ? undefined : 'is-wait'}>{ready ? why ? <W e={why}>{v}</W> : v : '·'}</td>
  )
  return (
    <div className="table-wrap">
      <table className="ms-cols mono">
        <thead>
          <tr>
            <th />
            <th>carry out</th>
            {ks.map((k) => (
              <th key={k}>{name('S', k).slice(1)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Carry in</th>
            <td />
            {ks.map((k) => cell(k, st(k).timing.cin <= t, st(k).timing.cin === t && t > 0, st(k).fa.z))}
          </tr>
          <tr>
            <th>X</th>
            <td />
            {ks.map((k) => cell(k, true, false, st(k).fa.x))}
          </tr>
          <tr>
            <th>Y</th>
            <td />
            {ks.map((k) => cell(k, true, false, st(k).fa.y))}
          </tr>
          <tr className="ms-cols-sum">
            <th>Sum</th>
            {cell('co', last.timing.cout <= t, last.timing.cout === t, trace.cout, last.fa.why.c)}
            {ks.map((k) => cell(k, st(k).timing.s <= t, st(k).timing.s === t, st(k).fa.s, st(k).fa.why.s))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
