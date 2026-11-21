import { useMemo, type ReactNode } from 'react'
import { parseFunction } from '../../core/boolean'
import {
  BLOCK_SIZE,
  blockFromSpec,
  blockPins,
  mismatchRows,
  netlist,
  pinCount,
  sigmaOf,
  type BlockKind,
  type BlockSpec,
  type CellValue,
  type GateOp,
} from '../../core/msi'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, NumberField, Panel, Presets, Segmented, Select, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { Board, Details, Flow, FocusToggle, Options, pick, PinErrors, PlayBar, plural, seg, splitVars, str, W } from './common'
import { WB_PRESETS } from './presets'

const KINDS: { value: BlockKind; label: string }[] = [
  { value: 'ha', label: 'half adder' },
  { value: 'fa', label: 'full adder' },
  { value: 'adder', label: 'parallel adder' },
  { value: 'comparator', label: 'magnitude comparator' },
  { value: 'decoder', label: 'decoder' },
  { value: 'mux', label: 'multiplexer' },
  { value: 'quadmux', label: 'quad 2:1 mux' },
  { value: 'demux', label: 'demultiplexer' },
  { value: 'encoder', label: 'encoder' },
  { value: 'count1', label: 'Count-1' },
  { value: 'count0', label: 'Count-0' },
  { value: 'gate', label: 'logic gate' },
]
const KIND_IDS = KINDS.map((k) => k.value)
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<BlockKind, string>
const OPS: GateOp[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'NOT']
const PORT_LABEL: Record<string, string> = { lt: 'X<Y', eq: 'X=Y', gt: 'X>Y' }
const MAX_BLOCKS = 12
/** Every row is listed and stepped, so keep the table to 256 rows. */
const MAX_VARS = 8

const strs = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : '')) : [])

/** Blocks come from the URL: keep only well-formed fields. */
function cleanBlocks(raw: unknown): BlockSpec[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_BLOCKS).flatMap((b): BlockSpec[] => {
    if (!b || typeof b !== 'object') return []
    const o = b as Record<string, unknown>
    const kind = pick(o.kind, KIND_IDS, 'gate')
    const out: Record<string, string> = {}
    if (o.out && typeof o.out === 'object') for (const [k, v] of Object.entries(o.out as Record<string, unknown>)) if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    return [
      {
        id: str(o.id, ''),
        kind,
        size: typeof o.size === 'number' && Number.isFinite(o.size) ? Math.trunc(o.size) : BLOCK_SIZE[kind].def,
        op: pick(o.op, OPS, 'AND'),
        enable: pick(o.enable, ['none', 'one', 'zero'] as const, 'none'),
        outputs: pick(o.outputs, ['high', 'low'] as const, 'high'),
        priority: o.priority === true,
        valid: o.valid !== false,
        pins: strs(o.pins),
        out,
      },
    ]
  })
}

const DEFAULT = WB_PRESETS[0]

export default function WorkbenchTab({ intro }: { intro: ReactNode }) {
  const [rawVars, setVars] = useUrlState<string>('wv', DEFAULT.vars)
  const [rawBlocks, setBlocks] = useUrlState<unknown>('wb', DEFAULT.blocks)
  const [rawTarget, setTarget] = useUrlState<string>('wt', DEFAULT.target ?? '')
  const [rawCheck, setCheck] = useUrlState<string>('wc', DEFAULT.check ?? '')
  const [rawAdd, setAdd] = useUrlState<BlockKind>('wa', 'gate')

  const varsText = str(rawVars, DEFAULT.vars)
  const vars = useMemo(() => splitVars(varsText), [varsText])
  const blocks = useMemo(() => cleanBlocks(rawBlocks), [rawBlocks])
  const targetText = str(rawTarget, '')
  const addKind = pick(rawAdd, KIND_IDS, 'gate')

  const result = useMemo(
    () => (vars.length > MAX_VARS ? null : netlist(blocks.map(blockFromSpec), vars)),
    [blocks, vars],
  )
  const net = result?.ok ? result.net : null
  const names = useMemo(() => (net ? Object.keys(net.signals) : []), [net])
  const check = names.includes(str(rawCheck, '')) ? str(rawCheck, '') : (names[names.length - 1] ?? '')
  const target = useMemo(() => {
    if (!targetText.trim() || !vars.length) return null
    const p = parseFunction(targetText, { vars })
    return p.ok ? p.fn : null
  }, [targetText, vars])
  const sig = net && check ? net.signals[check] : null
  const mis = useMemo(() => (sig && target ? mismatchRows(sig, target) : null), [sig, target])
  const misSet = useMemo(() => new Set(mis ?? []), [mis])

  /** Where each named signal comes from: block id and output index. */
  const source = useMemo(() => {
    const m = new Map<string, { id: string; port: number }>()
    if (net)
      blocks.forEach((b, bi) => {
        for (const [port, name] of Object.entries(b.out ?? {})) m.set(name, { id: b.id, port: net.blocks[bi].ports.indexOf(port) })
      })
    return m
  }, [net, blocks])

  const steps = net ? net.rows.length : 1
  const stepper = useStepper(steps)
  const ri = Math.min(stepper.index, steps - 1)
  const row = net?.rows[ri]
  const valueOf = (r: number, name: string): CellValue | undefined => {
    const s = source.get(name)
    return s && net ? net.rows[r].ports[s.id]?.[s.port] : undefined
  }

  const update = (i: number, patch: Partial<BlockSpec>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= blocks.length) return
    const next = blocks.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }
  const addBlock = () => {
    const used = new Set(blocks.map((b) => b.id))
    let n = 1
    while (used.has(`B${n}`)) n++
    const size = BLOCK_SIZE[addKind].def
    const spec: BlockSpec = { id: `B${n}`, kind: addKind, size, op: 'AND', enable: 'none', outputs: 'high', priority: false, valid: true, pins: [], out: {} }
    setBlocks([...blocks, { ...spec, pins: Array(pinCount(spec)).fill('0') }])
  }

  const toolbar = (
    <Presets
      presets={WB_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setVars(p.vars)
        setBlocks(p.blocks)
        setTarget(p.target ?? '')
        setCheck(p.check ?? '')
        stepper.first()
      }}
    />
  )

  const describe = net && row ? `${vars.join('')} = ${row.row.toString(2).padStart(vars.length, '0')}${check ? `: ${check} = ${valueOf(row.row, check)}` : ''}` : undefined

  const tableCols: Column<number>[] = net
    ? [
        { key: 'in', header: vars.join(''), cell: (r) => r.toString(2).padStart(vars.length, '0'), mono: true },
        ...names.map((nm) => ({ key: `s-${nm}`, header: nm, cell: (r: number) => valueOf(r, nm), align: 'center' as const, mono: true })),
        ...(target && sig ? [{ key: 't', header: `target ${check}`, cell: (r: number) => (target.dc.includes(r) ? 'X' : target.on.includes(r) ? 1 : 0), align: 'center' as const, mono: true }] : []),
      ]
    : []

  const checkStatus = !targetText.trim() ? null : !target ? (
    <>
      <Chip signal="miss">cannot read the target</Chip> it must use only {vars.join(', ')}
    </>
  ) : !sig ? (
    'Name an output to check it.'
  ) : mis && mis.length ? (
    <>
      <Chip signal="miss">differs</Chip> {check} is wrong on {plural(mis.length, 'row')}: <span className="mono">{mis.join(', ')}</span>
    </>
  ) : (
    <>
      <Chip signal="hit">matches</Chip> {check} agrees with the target on every row that is not a don't-care
    </>
  )

  return (
    <Workspace
      title="Combinational and MSI"
      lectures="L17 p17-33, L18 p12-56, T07 Q1-5, T08 Q3-5"
      intro={intro}
      toolbar={toolbar}
      transport={
        net && row ? (
          <Transport
            stepper={stepper}
            label="Row"
            marks={net.rows.map((r) => (misSet.has(r.row) ? 'miss' : check && valueOf(r.row, check) === 1 ? 'hit' : undefined))}
            describe={describe}
          />
        ) : undefined
      }
    >
      <div className="ms-command">
        <TextField label="Input variables, first is the MSB" value={varsText} onChange={setVars} width="12em" />
        <Select label="New block" value={addKind} onChange={setAdd} options={KINDS} />
        <Button onClick={addBlock} disabled={blocks.length >= MAX_BLOCKS} title={`Up to ${MAX_BLOCKS} blocks`}>
          Add block
        </Button>
      </div>
      {vars.length > MAX_VARS ? <PinErrors errors={[{ pin: 'vars', message: `use at most ${MAX_VARS} input variables` }]} /> : null}
      {result && !result.ok ? <PinErrors errors={result.errors} /> : null}
      <Options summary={`Edit the ${plural(blocks.length, 'block')}`}>
        <p className="ms-status">
          Blocks run top to bottom. A pin takes a variable, 0 (GND), 1 (Vcc) or a signal named by an earlier block. Name an output to use it later.
        </p>
        {blocks.map((b, i) => (
          <BlockEditor
            key={i}
            spec={b}
            index={i}
            count={blocks.length}
            onChange={(patch) => update(i, patch)}
            onMove={(d) => move(i, d)}
            onRemove={() => setBlocks(blocks.filter((_, j) => j !== i))}
          />
        ))}
      </Options>

      {net && row ? (
        <Board
          title={`Every block on row ${row.row}`}
          step={check ? `${check} = ${valueOf(row.row, check) ?? ''}` : undefined}
          note={
            <>
              {describe}
              {checkStatus ? <> {checkStatus}</> : null}
            </>
          }
          tools={<FocusToggle />}
          play={<PlayBar stepper={stepper} start="Step through the rows" next={`row ${row.row + 1}`} />}
          foot={
            <Legend
              items={[
                { signal: 'data', label: 'wire in use' },
                { signal: 'path', label: 'the signal being checked' },
                { signal: 'hit', label: 'value 1' },
                { signal: 'miss', label: 'pin hides an inverter or gate' },
                { signal: 'dontcare', label: "X, a don't-care" },
              ]}
            />
          }
        >
          <div className="ms-wb-cards">
            {blocks.map((b, bi) => (
              <BlockSvg
                key={b.id || bi}
                spec={b}
                pins={net.blocks[bi].pins}
                pinText={net.blocks[bi].pinText}
                ports={net.blocks[bi].ports}
                pinVals={row.pins[b.id] ?? []}
                portVals={row.ports[b.id] ?? []}
                implicit={net.implicit}
                check={check}
                flowId={ri}
              />
            ))}
          </div>
        </Board>
      ) : null}

      {net?.implicit.length ? (
        <Callout kind="trap" title={`${plural(net.implicit.length, 'pin')} hide${net.implicit.length === 1 ? 's' : ''} a gate`} cite="T07 p2; R09 p51">
          {net.implicit.join('; ')}. A complemented literal or an expression on a pin costs an inverter or a gate. Questions that say "no gates" do not allow it.
        </Callout>
      ) : null}

      <Details
        tabs={[
          {
            value: 'check',
            label: 'Check against a target',
            body: net ? (
              <>
                <div className="ms-row">
                  <div className="ms-grow">
                    <TextField label="Target: Σm(..) + d(..), ΠM(..) or an expression" value={targetText} onChange={setTarget} placeholder="F(A,B,C,D) = Σm(3-12)" />
                  </div>
                  {names.length ? <Select label="Signal" value={check} onChange={setCheck} options={names.map((nm) => ({ value: nm, label: nm }))} /> : null}
                </div>
                <p className="ms-status">{checkStatus ?? 'No target: the table just lists every signal.'}</p>
              </>
            ) : null,
          },
          {
            value: 'tt',
            label: 'Truth table',
            body: net ? (
              <>
                <div className="ms-tall">
                  <DataTable compact columns={tableCols} rows={net.rows.map((r) => r.row)} rowSignal={(r) => (r === row?.row ? 'path' : misSet.has(r) ? 'miss' : undefined)} />
                </div>
                {mis && mis.length ? <p className="ms-muted">Rows where {check} and the target differ are marked as errors.</p> : null}
              </>
            ) : null,
          },
          {
            value: 'signals',
            label: 'Signals',
            body: net ? (
              names.length ? (
                <dl className="ms-facts">
                  {names.map((nm) => {
                    const f = net.signals[nm]
                    return (
                      <div key={nm} className="ms-fact">
                        <dt>{nm}</dt>
                        <dd className="mono ms-wrap">
                          <W e={net.why[nm]}>
                            {sigmaOf(f)}
                            {f.dc.length ? ` + d(${f.dc.join(',')})` : ''}
                          </W>
                          {net.why[nm].working?.includes('simplified: ') ? <span className="ms-muted"> = {net.why[nm].working?.split('simplified: ')[1]}</span> : null}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              ) : (
                <p className="ms-status">Name a block output (for example S1 or F) to see it as a function.</p>
              )
            ) : null,
          },
          {
            value: 'parts',
            label: 'Parts',
            body: net ? (
              <dl className="ms-facts">
                <dt>Devices</dt>
                <dd>
                  {Object.entries(net.devices)
                    .map(([k, n]) => `${n} ${KIND_LABEL[k as BlockKind]}`)
                    .join(', ') || 'none'}
                </dd>
                <dt>Gates</dt>
                <dd>{Object.entries(net.gates).map(([k, n]) => `${n} ${k === 'NOT' ? (n === 1 ? 'inverter' : 'inverters') : k}`).join(', ') || 'none'}</dd>
                <dt>Hidden in pins</dt>
                <dd>{net.implicit.length ? <span className="mono ms-wrap">{net.implicit.join('; ')}</span> : 'none: every pin is a variable, a constant or a signal'}</dd>
              </dl>
            ) : null,
          },
          {
            value: 'rules',
            label: 'Rules and traps',
            body: (
              <div className="ms-callouts">
                <Callout kind="course" title="Only the plain literals and the constants" cite="T07 p2; L17 p23">
                  Unless a question says otherwise, pins take A, B, C, ... and the constants 0 (GND) and 1 (Vcc). A' needs an inverter. Use only the devices the question
                  lists, and as few as possible.
                </Callout>
                <Callout kind="course" title="Blocks are just functions" cite="L17 p22-23; T07 Q2">
                  Rewiring is free arithmetic: a constant on an adder input adds it (+0011 turns BCD into Excess-3), and shifting the wires one place divides by 2.
                </Callout>
                <Callout kind="note" title="X from an encoder">
                  A plain encoder with no input or several inputs high gives X (L18 p29), and so does a priority encoder with no input high. An X stays X unless a later gate
                  makes the value certain, for example an AND with a 0.
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- One block's settings and pins ---------- */

function BlockEditor({
  spec,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  spec: BlockSpec
  index: number
  count: number
  onChange: (patch: Partial<BlockSpec>) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const shape = blockPins(spec)
  const range = BLOCK_SIZE[spec.kind]
  const n = pinCount(spec)
  const texts = Array.from({ length: n }, (_, i) => spec.pins[i] ?? '0')
  const resize = (patch: Partial<BlockSpec>) => {
    const next = { ...spec, ...patch }
    onChange({ ...patch, pins: Array.from({ length: pinCount(next) }, (_, i) => spec.pins[i] ?? '0') })
  }
  const sizeShown = range.max > range.min && !(spec.kind === 'gate' && spec.op === 'NOT')
  return (
    <Panel
      title={`${index + 1}. ${spec.id || 'unnamed'}: ${KIND_LABEL[spec.kind]}`}
      actions={
        <span className="ms-sol-actions">
          <Button onClick={() => onMove(-1)} disabled={index === 0} title={`Move ${spec.id} up`}>
            Up
          </Button>
          <Button onClick={() => onMove(1)} disabled={index === count - 1} title={`Move ${spec.id} down`}>
            Down
          </Button>
          <Button onClick={onRemove} title={`Remove ${spec.id}`}>Remove</Button>
        </span>
      }
    >
      <div className="ms-row">
        <TextField label="Block name" value={spec.id} onChange={(v) => onChange({ id: v.trim() })} width="5.5em" />
        <Select
          label="Kind"
          value={spec.kind}
          onChange={(kind) => {
            const def = BLOCK_SIZE[kind].def
            const next: BlockSpec = { ...spec, kind, size: def, out: {} }
            onChange({ kind, size: def, out: {}, pins: Array(pinCount(next)).fill('0') })
          }}
          options={KINDS}
        />
        {spec.kind === 'gate' ? <Select label="Gate" value={spec.op ?? 'AND'} onChange={(op) => resize({ op })} options={OPS.map((o) => ({ value: o, label: o }))} /> : null}
        {sizeShown ? (
          <NumberField
            label={range.unit.charAt(0).toUpperCase() + range.unit.slice(1)}
            value={spec.size}
            min={spec.kind === 'gate' ? 2 : range.min}
            max={range.max}
            onChange={(v) => resize({ size: Math.min(range.max, Math.max(spec.kind === 'gate' ? 2 : range.min, Math.trunc(v))) })}
          />
        ) : null}
        {spec.kind === 'decoder' ? (
          <>
            <Segmented
              label="Enable"
              value={spec.enable ?? 'none'}
              onChange={(enable) => resize({ enable })}
              options={[
                { value: 'none', label: 'none' },
                { value: 'one', label: 'E', title: '1-enable (L18 p15)' },
                { value: 'zero', label: "E'", title: '0-enable (L18 p16)' },
              ]}
            />
            <Segmented
              label="Outputs"
              value={spec.outputs ?? 'high'}
              onChange={(outputs) => onChange({ outputs })}
              options={[
                { value: 'high', label: 'active-high' },
                { value: 'low', label: 'active-low', title: 'Output i = M_i (L18 p20)' },
              ]}
            />
          </>
        ) : null}
        {spec.kind === 'encoder' ? (
          <div className="ms-toggles ms-row">
            <Toggle label="Priority" checked={spec.priority === true} onChange={(priority) => onChange({ priority })} hint="The highest-index input that is 1 wins (L18 p32)" />
            {spec.priority ? <Toggle label="Valid bit V" checked={spec.valid !== false} onChange={(valid) => onChange({ valid })} /> : null}
          </div>
        ) : null}
      </div>
      {typeof shape === 'string' ? (
        <PinErrors errors={[{ pin: spec.id, message: shape }]} />
      ) : (
        <>
          <div className="ms-row">
            {shape.pins.map((p, i) => (
              <TextField key={`${p}-${i}`} label={p} value={texts[i]} width="4.6em" onChange={(v) => onChange({ pins: texts.map((t, j) => (j === i ? v : t)) })} />
            ))}
          </div>
          <div className="ms-row">
            {shape.ports.map((p) => (
              <TextField
                key={p}
                label={`${PORT_LABEL[p] ?? p} name`}
                value={spec.out?.[p] ?? ''}
                placeholder="unused"
                width="5em"
                onChange={(v) => {
                  const out = { ...(spec.out ?? {}) }
                  if (v.trim()) out[p] = v.trim()
                  else delete out[p]
                  onChange({ out })
                }}
              />
            ))}
          </div>
          <p className="ms-muted">{shape.cite}</p>
        </>
      )}
    </Panel>
  )
}

/* ---------- One block on the current row: pins left, named outputs right ---------- */

function BlockSvg({
  spec,
  pins,
  pinText,
  ports,
  pinVals,
  portVals,
  implicit,
  check,
  flowId,
}: {
  spec: BlockSpec
  pins: string[]
  pinText: string[]
  ports: string[]
  pinVals: CellValue[]
  portVals: CellValue[]
  implicit: string[]
  check: string
  /** Restarts the light on the output being checked. */
  flowId: number
}) {
  const P = 20
  const L = 78
  const BX = L + 34
  const BW = 104
  const rows = Math.max(pins.length, ports.length, 2)
  const bh = rows * P + 12
  const top = 26
  const VW = BX + BW + 110
  const H = top + bh + 8
  const py = (i: number, total: number) => top + 6 + (bh - 12 - total * P) / 2 + i * P + P / 2
  const v = (x: CellValue | undefined) => (x === undefined ? 'x' : x === 'X' ? 'x' : x)
  const clip = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s)
  const flow = ports.flatMap((p, i) => (check && spec.out?.[p] === check ? [seg(BX + BW, py(i, ports.length), BX + BW + 40, py(i, ports.length))] : []))
  return (
    <svg className="ms-svg" viewBox={`0 0 ${VW} ${H}`} width={VW} height={H} role="img" aria-label={`${spec.id}, ${KIND_LABEL[spec.kind]}`}>
      <title>{`${spec.id}: ${KIND_LABEL[spec.kind]}`}</title>
      <text x={BX} y={14} className="ms-label-sm">
        {spec.id} {spec.kind === 'gate' ? spec.op : KIND_LABEL[spec.kind]}
      </text>
      <rect x={BX} y={top} width={BW} height={bh} rx={3} className="ms-block" />
      {pins.map((p, i) => {
        const y = py(i, pins.length)
        const bad = implicit.some((s) => s.startsWith(`${spec.id}.${p} =`))
        return (
          <g key={`${p}-${i}`} className={`ms-net is-ready${bad ? ' is-bad' : ''}`}>
            <text x={L - 4} y={y + 4} textAnchor="end" className="ms-label-sm">
              {clip(pinText[i] ?? '')}
            </text>
            <line x1={L} y1={y} x2={BX} y2={y} className="ms-wire" />
            <text x={L + 6} y={y - 3} className={`ms-val v-${v(pinVals[i])}`}>
              {pinVals[i] ?? ''}
            </text>
            <text x={BX + 5} y={y + 4} className="ms-small">
              {p}
            </text>
          </g>
        )
      })}
      {ports.map((p, i) => {
        const y = py(i, ports.length)
        const name = spec.out?.[p]
        const cls = !name ? 'is-off' : name === check ? 'is-now' : 'is-ready'
        return (
          <g key={p} className={`ms-net ${cls}`}>
            <text x={BX + BW - 5} y={y + 4} textAnchor="end" className="ms-small">
              {PORT_LABEL[p] ?? p}
            </text>
            <line x1={BX + BW} y1={y} x2={BX + BW + 40} y2={y} className="ms-wire" />
            <text x={BX + BW + 8} y={y - 3} className={`ms-val v-${v(portVals[i])}`}>
              {portVals[i] ?? ''}
            </text>
            <text x={BX + BW + 44} y={y + 4} className="ms-label-sm">
              {name ?? ''}
            </text>
          </g>
        )
      })}
      <Flow id={flowId} paths={flow} />
    </svg>
  )
}

