import { useMemo, type ReactNode } from 'react'
import { mintermText, muxImplement, muxSearch, muxTree, selectNames, type DataInput, type MuxPlan, type MuxTree } from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, Presets, Segmented, TextField, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitRow, Board, Details, Flow, FnField, FocusToggle, gatePath, int, pick, PinErrors, PlayBar, plural, polyD, pts, seg, splitVars, StepNote, Story, str, useFn, W } from './common'
import { MUX_PRESETS, TREE_PRESETS } from './presets'

type Mode = 'impl' | 'tree'
/** Selector search tries every ordered choice; beyond this many variables it gets slow. */
const MAX_SEARCH_VARS = 5

const kindSignal = (d: DataInput) => (d.needsInverter || d.needsGate ? 'bad' : d.kind === 'dontcare' ? 'x' : 'ok')

export default function MuxTab({ intro }: { intro: ReactNode }) {
  const [rawMode, setMode] = useUrlState<Mode>('xmo', 'impl')
  const fs = useFn('xf', 'F(A,B,C) = Σm(0,1,3,6)')
  const [rawSel, setSel] = useUrlState<string>('xs', 'A,B')
  const [rawN, setN] = useUrlState<number>('xn', 3)
  const [rawLv, setLv] = useUrlState<string>('xl', '2,1')
  const [rawV, setV] = useUrlState<number>('xv', 0b110)

  const mode = pick(rawMode, ['impl', 'tree'] as const, 'impl')
  const selText = str(rawSel, 'A,B')
  const selects = useMemo(() => splitVars(selText), [selText])
  const fn = fs.fn
  const built = useMemo(() => (mode === 'impl' && fn ? muxImplement(fn, selects) : null), [mode, fn, selects])
  const plan = built?.ok ? built.plan : null
  const k = selects.length
  const search = useMemo(
    () => (mode === 'impl' && fn && fn.vars.length <= MAX_SEARCH_VARS && k >= 1 && k <= fn.vars.length ? muxSearch(fn, k) : null),
    [mode, fn, k],
  )
  const tn = int(rawN, 2, 5, 3)
  const levels = splitVars(str(rawLv, '2,1').replace(/[^0-9,\s]/g, '')).map(Number)
  const tv = int(rawV, 0, (1 << tn) - 1, 0)
  const tree = useMemo(() => (mode === 'tree' ? muxTree(tn, levels, tv) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, tn, levels.join(','), tv])

  const steps = plan ? plan.groups.length + 1 : 1
  const stepper = useStepper(steps)
  const step = Math.min(stepper.index, steps - 1)

  const toolbar =
    mode === 'impl' ? (
      <Presets
        presets={MUX_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
        onPick={(p) => {
          fs.setText(p.f)
          setSel(p.selects)
          stepper.first()
        }}
      />
    ) : (
      <Presets
        presets={TREE_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
        onPick={(p) => {
          setN(p.n)
          setLv(p.levels.join(','))
          setV(p.select)
        }}
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
          { value: 'impl', label: 'implement a function', title: 'Selects and data inputs from the truth table (L18 p48-56)' },
          { value: 'tree', label: 'larger muxes', title: 'A big mux from stages of small ones (L18 p42-45)' },
        ]}
      />
      {mode === 'impl' ? (
        <>
          <div className="ms-grow">
            <FnField state={fs} />
          </div>
          <div className="ms-row">
            <TextField label="Select variables, S on top first" value={selText} onChange={setSel} width="9em" />
            {fn
              ? fn.vars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`ms-tick${selects.includes(v) ? ' is-on' : ''}`}
                    aria-pressed={selects.includes(v)}
                    onClick={() => {
                      setSel((selects.includes(v) ? selects.filter((s) => s !== v) : [...selects, v]).join(','))
                      stepper.first()
                    }}
                  >
                    {v}
                  </button>
                ))
              : null}
            {search && search.plans.length ? (
              <Button
                onClick={() => {
                  setSel(search.plans[0].selects.join(','))
                  stepper.first()
                }}
                title="Pick the select order that needs the fewest inverters and gates"
              >
                Best assignment
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Segmented label="Mux size" value={tn} onChange={(v) => setN(v)} options={[2, 3, 4, 5].map((v) => ({ value: v, label: `${1 << v}:1` }))} />
          <TextField label="Select bits per stage, data side first" value={str(rawLv, '2,1')} onChange={setLv} width="8em" />
          <BitRow label={`Select = ${tv}`} names={selectNames(tn)} value={tv} onChange={setV} />
        </>
      )}
    </div>
  )

  if (mode === 'tree') {
    const tr = tree?.ok ? tree.tree : null
    return (
      <Workspace title="Combinational and MSI" lectures="L18 p42-45" intro={intro} toolbar={toolbar}>
        {command}
        {tree && !tree.ok ? <PinErrors errors={tree.errors} /> : null}
        {tr ? (
          <Board
            title={`${1 << tn}:1 mux from smaller muxes`}
            step={<W e={tr.why.path}>Y = I{tr.output}</W>}
            tools={<FocusToggle />}
            foot={
              <Legend
                items={[
                  { signal: 'path', label: 'path from the selected input to Y' },
                  { signal: 'control', label: 'select bits of each stage' },
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
              value: 'build',
              label: 'Build and path',
              body: tr ? (
                <dl className="ms-facts">
                  <dt>Blocks</dt>
                  <dd>
                    <W e={tr.why.build}>{tr.why.build.working}</W>
                  </dd>
                  <dt>Output</dt>
                  <dd className="mono">
                    <W e={tr.why.path}>Y = I{tr.output}</W>
                  </dd>
                </dl>
              ) : null,
            },
            {
              value: 'rules',
              label: 'Rules and traps',
              body: (
                <div className="ms-callouts">
                  <Callout kind="course" title="Where the select bits go" cite="L18 p42-44">
                    The first stage takes the low select bits and the last stage takes the MSB. Two 4:1 then a 2:1 puts S1 S0 first and S2 last (p42); four 2:1 then a 4:1
                    puts S0 first and S2 S1 last (p44).
                  </Callout>
                </div>
              ),
            },
          ]}
        />
      </Workspace>
    )
  }

  const g = plan && step < plan.groups.length ? plan.groups[step] : null
  const describe = plan ? (g ? `${g.label}: I${g.index} = ${g.data.text}` : `all data inputs: ${plan.text}`) : 'no plan'
  const bad = plan ? plan.data.map((d, i) => (d.needsInverter || d.needsGate ? i : -1)).filter((i) => i >= 0) : []
  const planCols: Column<MuxPlan>[] = [
    { key: 's', header: 'Selects', cell: (p) => p.selects.join(''), mono: true },
    { key: 'd', header: 'Data inputs', cell: (p) => p.text, mono: true },
    { key: 'c', header: 'Cost', cell: (p) => (p.noGates ? <Chip signal="hit">no gates</Chip> : `${plural(p.inverters, 'inverter')}, ${plural(p.gates, 'gate')}`) },
    {
      key: 'u',
      header: '',
      cell: (p) => (
        <Button
          onClick={() => {
            setSel(p.selects.join(','))
            stepper.first()
          }}
        >
          Use
        </Button>
      ),
    },
  ]

  return (
    <Workspace
      title="Combinational and MSI"
      lectures="L18 p37-56, T08 Q1"
      intro={intro}
      toolbar={toolbar}
      transport={
        plan ? (
          <Transport
            stepper={stepper}
            label="Data input"
            marks={[...plan.data.map((d) => (d.needsInverter || d.needsGate ? 'miss' : undefined)), 'data']}
            describe={describe}
          />
        ) : undefined
      }
    >
      {command}
      {built && !built.ok ? <PinErrors errors={built.errors} /> : null}
      {plan ? (
        <div className="ms-stage">
          <Board
            title={`${1 << k}:1 multiplexer, selects ${plan.selects.map((s, j) => `S${k - 1 - j} = ${s}`).join(', ')}`}
            step={g ? `I${g.index} = ${g.data.text}` : 'all data inputs'}
            tools={<FocusToggle />}
            play={<PlayBar stepper={stepper} start="Work out each data input" next={step + 1 < plan.groups.length ? `I${step + 1}` : 'all data inputs'} />}
            foot={
              <>
                <p className="mono ms-wrap ms-yeq">
                  {plan.fn.name} ={' '}
                  {plan.data.map((d, i) => (
                    <span key={i} className={i === step ? 'ms-term is-now' : 'ms-term'}>
                      {i ? ' + ' : ''}
                      {d.text === '1' ? mintermText(i, plan.selects) : d.kind === 'expression' ? `(${d.text})∙${mintermText(i, plan.selects)}` : `${d.text}∙${mintermText(i, plan.selects)}`}
                    </span>
                  ))}
                </p>
                <Legend
                  items={[
                    { signal: 'path', label: 'data input worked out at this step' },
                    { signal: 'control', label: 'select lines' },
                    { signal: 'miss', label: 'needs an inverter or gate' },
                    { signal: 'dontcare', label: "X, don't care" },
                  ]}
                />
              </>
            }
          >
            <div className="ms-board-pics">
              <div>
                <p className="ms-caption">Truth table split by the selects</p>
                <SplitTable plan={plan} step={step} />
              </div>
              <MuxBlock plan={plan} step={step} />
            </div>
          </Board>
          <Story
            label="Each data input"
            titles={[...plan.groups.map((q) => `${q.label} gives I${q.index}`), 'All data inputs']}
            index={step}
            onPick={stepper.set}
            body={
              g ? (
                <>
                  <p className="mono">
                    I{g.index} = {g.data.text}
                  </p>
                  <StepNote e={g.data.why} />
                </>
              ) : (
                <>
                  <p className="mono ms-wrap">{plan.text}</p>
                  <StepNote e={plan.why} />
                  <p>
                    {plan.noGates ? (
                      <Chip signal="hit">no inverter, no gate</Chip>
                    ) : (
                      <>
                        <Chip signal="miss">needs parts</Chip> {plural(plan.inverters, 'inverter')}, {plural(plan.gates, 'other gate')}
                      </>
                    )}
                  </p>
                </>
              )
            }
          />
        </div>
      ) : null}
      {bad.length && plan ? (
        <Callout kind="trap" title={`${plural(bad.length, 'data input')} need${bad.length === 1 ? 's' : ''} an inverter or gate`} cite="T06 p2; AY23/24 S1 Q10">
          {bad.map((i) => `I${i} = ${plan.data[i].text}`).join(', ')}. Try another select order (Best assignment), or count the inverter.
        </Callout>
      ) : null}
      <Details
        tabs={[
          {
            value: 'orders',
            label: `Every select order with ${plural(k, 'select')}`,
            body:
              plan && search ? (
                <>
                  <p className="ms-caption">
                    <W e={search.why}>{search.noGates.length ? `${plural(search.noGates.length, 'order')} need no gates.` : 'Every order needs an inverter or a gate.'}</W>
                  </p>
                  <div className="ms-tall">
                    <DataTable compact columns={planCols} rows={search.plans} rowSignal={(p) => (p.selects.join() === plan.selects.join() ? 'path' : undefined)} />
                  </div>
                </>
              ) : plan && fn && fn.vars.length > MAX_SEARCH_VARS ? (
                <p className="ms-status">The select-order search takes up to {MAX_SEARCH_VARS} variables.</p>
              ) : null,
          },
          {
            value: 'rules',
            label: 'Rules and traps',
            body: (
              <div className="ms-callouts">
                <Callout kind="course" title="Reserve one variable" cite="L18 p51-55">
                  An n-variable function fits a 2^(n-1):1 mux: put n - 1 variables on the selects, S on top first, and each data input becomes 0, 1, v or v'.
                </Callout>
                <Callout kind="trap" title="A constant beats a literal" cite="T08 Ans p1">
                  When a don't-care lets a data input be 0 or Z', pick 0. A constant needs no wire from a variable and no inverter.
                </Callout>
                <Callout kind="trap" title="A select variable stays off the data inputs" cite="AY21/22 S1 Q13c">
                  The selects already fix its value in each group.
                </Callout>
                <Callout kind="trap" title="Write the data input for its group only" cite="T08 Q4; T08 Ans p4">
                  In a group where AB is fixed, write the restricted expression C'∙D + C∙D', not A'BC'D + A'BCD'. XOR is not an SOP, so expand C⊕D when an SOP is asked.
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Truth table regrouped by select value (L18 p54) ---------- */

function SplitTable({ plan, step }: { plan: MuxPlan; step: number }) {
  const res = plan.residual
  const m = res.length
  const resRows = Array.from({ length: 1 << m }, (_, r) => r)
  const colCls = (i: number) => (i === step ? 'is-now' : i > step ? 'is-later' : undefined)
  return (
    <div className="table-wrap">
      <table className="ms-split mono">
        <thead>
          <tr>
            <th scope="col">{plan.selects.join('')}</th>
            {plan.groups.map((g) => (
              <th key={g.index} scope="col" className={colCls(g.index)}>
                {g.label.split(' = ')[1]}
              </th>
            ))}
          </tr>
          <tr>
            <th scope="col">input</th>
            {plan.groups.map((g) => (
              <th key={g.index} scope="col" className={colCls(g.index)}>
                I{g.index}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resRows.map((r) => (
            <tr key={r}>
              <th scope="row">{m ? `${res.join('')} = ${r.toString(2).padStart(m, '0')}` : 'F'}</th>
              {plan.groups.map((g) => {
                const v = g.rows[r].value
                return (
                  <td key={g.index} className={colCls(g.index)} title={`row ${g.rows[r].row}`}>
                    <span className={`ms-v v-${v === 'X' ? 'x' : v}`}>{v}</span>
                    <span className="ms-rowno">m{g.rows[r].row}</span>
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="ms-split-data">
            <th scope="row">data input</th>
            {plan.groups.map((g) => (
              <td key={g.index} className={colCls(g.index)}>
                {g.index <= step ? <span className={`ms-din is-${kindSignal(g.data)}`}>{g.data.text}</span> : '·'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* ---------- Mux block with data inputs, selects below ---------- */

function MuxBlock({ plan, step }: { plan: MuxPlan; step: number }) {
  const k = plan.selects.length
  const N = 1 << k
  const P = 24
  const top = 20
  const L = 150
  const BX = L + 40
  const BW = 80
  const bh = N * P + 16
  const VW = BX + BW + 120
  const H = top + bh + 24 + k * 20 + 10
  const iy = (i: number) => top + 8 + i * P + P / 2
  const names = selectNames(k)
  const done = (i: number) => i <= step || step >= plan.groups.length
  // Light on the data input worked out at this step; on the last step, on Y.
  const cur = plan.data[step]
  const flow = !cur
    ? [seg(BX + BW, top + bh / 2, BX + BW + 50, top + bh / 2)]
    : [seg(cur.needsInverter && cur.kind === 'complement' ? L + 1 : cur.needsGate ? L : L - 30, iy(step), BX, iy(step))]
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label="Multiplexer">
      <title>Multiplexer</title>
      <path d={`M${BX},${top} L${BX + BW},${top + 20} L${BX + BW},${top + bh - 20} L${BX},${top + bh} Z`} className="ms-block" />
      <text x={BX + BW / 2} y={top + bh / 2 + 4} textAnchor="middle" className="ms-small">
        {N}:1 mux
      </text>
      {plan.data.map((d, i) => {
        const y = iy(i)
        const shown = done(i)
        const sig = kindSignal(d)
        const cls = i === step ? 'is-now' : shown ? (sig === 'bad' ? 'is-ready is-bad' : sig === 'x' ? 'is-wait' : 'is-ready') : 'is-off'
        return (
          <g key={i} className={`ms-net ${cls}`}>
            <text x={L - 34} y={y + 4} textAnchor="end" className="ms-label-sm">
              {shown ? d.text : '?'}
            </text>
            {shown && d.needsInverter && d.kind === 'complement' ? (
              <>
                <line x1={L - 30} y1={y} x2={L - 20} y2={y} className="ms-wire" />
                <path d={gatePath('NOT', L - 20, y - 7, 22, 14)} className="ms-gate" />
                <circle cx={L - 2} cy={y} r={3} className="ms-gate" />
                <line x1={L + 1} y1={y} x2={BX} y2={y} className="ms-wire" />
              </>
            ) : shown && d.needsGate ? (
              <>
                <rect x={L - 30} y={y - 8} width={30} height={16} rx={2} className="ms-gate" />
                <text x={L - 15} y={y + 4} textAnchor="middle" className="ms-small">
                  gate
                </text>
                <line x1={L} y1={y} x2={BX} y2={y} className="ms-wire" />
              </>
            ) : (
              <line x1={L - 30} y1={y} x2={BX} y2={y} className="ms-wire" />
            )}
            <text x={BX + 6} y={y + 4} className="ms-small">
              I{i}
            </text>
          </g>
        )
      })}
      {plan.selects.map((s, j) => {
        const x = BX + 14 + j * ((BW - 28) / Math.max(1, k - 1 || 1))
        const yb = top + bh - (20 * (x - BX)) / BW
        return (
          <g key={s} className="ms-net is-ctl">
            <line x1={x} y1={yb} x2={x} y2={top + bh + 14 + j * 20} className="ms-wire" />
            <text x={x + 4} y={top + bh + 26 + j * 20} className="ms-label-sm">
              {names[j]} = {s}
            </text>
          </g>
        )
      })}
      <g className="ms-net is-ready">
        <line x1={BX + BW} y1={top + bh / 2} x2={BX + BW + 50} y2={top + bh / 2} className="ms-wire" />
        <text x={BX + BW + 56} y={top + bh / 2 + 4} className="ms-label">
          {plan.fn.name}
        </text>
      </g>
      <Flow id={step} paths={flow} />
    </svg>
  )
}

/* ---------- Mux tree (L18 p42-45) ---------- */

function TreeSvg({ tree }: { tree: MuxTree }) {
  const P = 18
  const NW = 86
  const GX = 80
  const stages = tree.levels.length
  const stage0 = tree.nodes.filter((x) => x.level === 0)
  const h0 = (sz: number) => sz * P + 14
  const ys = new Map<number, number>()
  stage0.forEach((x, i) => ys.set(x.id, 10 + i * (h0(x.size) + 14)))
  for (let l = 1; l < stages; l++) {
    const prev = tree.nodes.filter((x) => x.level === l - 1)
    for (const x of tree.nodes.filter((q) => q.level === l)) {
      const kids = prev.slice(x.index * x.size, x.index * x.size + x.size)
      const mids = kids.map((c) => (ys.get(c.id) ?? 0) + h0(c.size) / 2)
      ys.set(x.id, (Math.min(...mids) + Math.max(...mids)) / 2 - h0(x.size) / 2)
    }
  }
  const xOf = (l: number) => 50 + l * (NW + GX)
  const H = Math.max(...stage0.map((x) => (ys.get(x.id) ?? 0) + h0(x.size))) + 30
  const VW = xOf(stages - 1) + NW + 70
  /** Input i of a mux: a stub from the data input, or a wire from the mux one stage back. */
  const wireIn = (x: MuxTree['nodes'][number], i: number): [number, number][] => {
    const bx = xOf(x.level)
    const iy = (ys.get(x.id) ?? 0) + 7 + i * P + P / 2
    if (x.level === 0) return [[bx - 26, iy], [bx, iy]]
    const c = tree.nodes.filter((q) => q.level === x.level - 1)[x.index * x.size + i]
    const cy = (ys.get(c.id) ?? 0) + h0(c.size) / 2
    const cx = xOf(c.level) + NW
    return [[cx, cy], [cx + GX / 2, cy], [cx + GX / 2, iy], [bx, iy]]
  }
  const last = tree.nodes[tree.nodes.length - 1]
  const outY = (ys.get(last.id) ?? 0) + h0(last.size) / 2
  const outX = xOf(last.level) + NW
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label="Multiplexer tree">
      <title>Larger multiplexer from smaller ones</title>
      {tree.nodes.map((x) => {
        const y = ys.get(x.id) ?? 0
        const bx = xOf(x.level)
        return (
          <g key={x.id}>
            {Array.from({ length: x.size }, (_, i) => {
              const iy = y + 7 + i * P + P / 2
              const on = x.active && i === x.chosen
              if (x.level === 0)
                return (
                  <g key={i} className={`ms-net ${on ? 'is-now' : 'is-off'}`}>
                    <polyline points={pts(wireIn(x, i))} className="ms-wire" />
                    <text x={bx - 30} y={iy + 4} textAnchor="end" className="ms-small">
                      I{x.index * x.size + i}
                    </text>
                  </g>
                )
              return (
                <g key={i} className={`ms-net ${on ? 'is-now' : 'is-off'}`}>
                  <polyline points={pts(wireIn(x, i))} className="ms-wire" />
                </g>
              )
            })}
            <g className={`ms-net ${x.active ? 'is-now' : 'is-off'}`}>
              <rect x={bx} y={y} width={NW} height={h0(x.size)} rx={3} className="ms-block" />
              <text x={bx + NW / 2} y={y + h0(x.size) / 2 - 2} textAnchor="middle" className="ms-small">
                {x.size}:1
              </text>
              <text x={bx + NW / 2} y={y + h0(x.size) / 2 + 12} textAnchor="middle" className="ms-ctl-text">
                {x.selects.join(' ')}
              </text>
            </g>
          </g>
        )
      })}
      <g className="ms-net is-now">
        <line x1={outX} y1={outY} x2={outX + 40} y2={outY} className="ms-wire" />
        <text x={outX + 44} y={outY + 4} className="ms-label">
          Y = I{tree.output}
        </text>
      </g>
      <Flow id={tree.output} paths={[...tree.nodes.filter((x) => x.active).map((x) => polyD(wireIn(x, x.chosen))), seg(outX, outY, outX + 40, outY)]} />
    </svg>
  )
}
