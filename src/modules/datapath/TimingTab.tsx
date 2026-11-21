// Tab 3: critical path and cycle time of the single-cycle datapath (R06 p40-42, T05 Q2, L12 p36).
import { useMemo, useState, type ReactNode } from 'react'
import {
  DELAY_LABELS, LATENCY_PRESETS, criticalPath, cycleTime, stageTable,
  type DelayKey, type Delays, type TimingClass, type UnitId,
} from '../../core/datapath'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, NumberField, Panel, Presets, Segmented, Toggle, Workspace } from '../../ui/kit'
import { ExplainText, W } from './common'
import { Diagram } from './Diagram'
import { NODE_UNIT, buildTimingModel } from './model'

type SetId = 'r06' | 'l12'

const CLASSES: { value: TimingClass; label: string; title: string }[] = [
  { value: 'R', label: 'R-type', title: 'add, sub, and, or, slt' },
  { value: 'addi', label: 'addi', title: 'derived control row' },
  { value: 'lw', label: 'lw', title: 'lw' },
  { value: 'sw', label: 'sw', title: 'sw' },
  { value: 'beq', label: 'beq', title: 'beq' },
  { value: 'bne', label: 'bne', title: 'row from the AY25/26 key' },
]

const PRESETS: { name: string; source: string; value: { set: SetId; cls: TimingClass } }[] = [
  { name: 'addi with component delays, 950 ps', source: 'R06 p42', value: { set: 'r06', cls: 'addi' } },
  { name: 'sub with component delays', source: 'T05 Q2, derived, no key', value: { set: 'r06', cls: 'R' } },
  { name: 'lw with component delays', source: 'T05 Q2, derived, no key', value: { set: 'r06', cls: 'lw' } },
  { name: 'lw in the simple ns model, 8 ns', source: 'L12 p36', value: { set: 'l12', cls: 'lw' } },
  { name: 'beq in the simple ns model, 5 ns', source: 'L12 p36', value: { set: 'l12', cls: 'beq' } },
]

const KEYS = Object.keys(DELAY_LABELS) as DelayKey[]

export default function TimingTab({ intro }: { intro: ReactNode }) {
  const [set, setSet] = useUrlState<SetId>('dset', 'r06')
  const [custom, setCustom] = useUrlState<Partial<Record<DelayKey, number>> | null>('dl', null)
  const [cls, setCls] = useUrlState<TimingClass>('tc', 'addi')
  const [sel, setSel] = useState<string | null>(null)
  const base = LATENCY_PRESETS.find((p) => p.id === set) ?? LATENCY_PRESETS[0]
  const delays: Delays = { unit: base.delays.unit, values: { ...base.delays.values, ...custom } }
  const dkey = JSON.stringify(delays)
  const r = useMemo(() => criticalPath(cls, delays), [cls, dkey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [cyc, st] = useMemo(() => [cycleTime(delays, ['R', 'lw', 'sw', 'beq']), stageTable(delays)] as const, [dkey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [focus, setFocus] = useUrlState('tfocus', false)
  const model = useMemo(() => buildTimingModel(r, cls === 'addi' || cls === 'lw', focus), [r, cls, focus])
  const u = delays.unit
  const selNodes = sel ? r.nodes.filter((n) => NODE_UNIT[n.id] === sel) : []

  return (
    <Workspace
      title="Datapath and control"
      lectures="L12 p35-36, R06 p40-42, T05 Q2"
      intro={intro}
      toolbar={
        <>
          <Presets
            presets={PRESETS}
            onPick={(v) => {
              setSet(v.set)
              setCustom(null)
              setCls(v.cls)
            }}
          />
          <Segmented label="Instruction" value={cls} onChange={setCls} options={CLASSES} />
        </>
      }
    >
      <div className="dp-top">
        <Panel
          title="Component delays"
          actions={
            <Button onClick={() => setCustom(null)} disabled={!custom}>
              Reset
            </Button>
          }
        >
          <Segmented
            label="Delay set"
            value={set}
            onChange={(v) => {
              setSet(v)
              setCustom(null)
            }}
            options={LATENCY_PRESETS.map((p) => ({ value: p.id, label: p.id === 'r06' ? 'Components in ps (T05 Q2)' : 'Simple model in ns (L12 p36)', title: p.title }))}
          />
          <div className="dp-delays">
            {KEYS.map((k) => (
              <NumberField key={k} label={DELAY_LABELS[k]} value={delays.values[k]} min={0} suffix={u} onChange={(v) => setCustom({ ...custom, [k]: v })} />
            ))}
          </div>
          <p className="dp-hint">{base.title}. A blank or negative delay counts as 0.</p>
        </Panel>
        <Panel title={`Critical path of ${CLASSES.find((c) => c.value === cls)!.label}`}>
          <p className="dp-total">
            <W e={r.why}>
              <span className="mono">
                {r.total} {u}
              </span>
            </W>
          </p>
          <ol className="dp-chain" aria-label="Critical path">
            {r.path.map((id) => {
              const n = r.nodes.find((x) => x.id === id)!
              return (
                <li key={id}>
                  <Chip signal="path">{n.label}</Chip> <span className="mono">{n.delay}</span>
                </li>
              )
            })}
          </ol>
          <ExplainText e={r.why} />
          {r.ties.length ? (
            <Callout kind="note" title="An equally long path">
              {r.ties.map((t) => `${t.label} ends at ${t.finish} ${u} with no slack`).join('; ')}. Either path gives the same total.
            </Callout>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Path on the datapath"
        actions={
          <>
            <Toggle label="Show only what this instruction uses" checked={focus} onChange={setFocus} hint="Hides the units and wires this instruction class does not need" />
            <span className="dp-cite">R06 p42</span>
          </>
        }
        flush
      >
        <div className="dp-scroll">
          <Diagram model={model} selected={sel} onSelect={(id) => setSel((s) => (s === id ? null : id))} label={`Critical path for ${cls}: ${r.path.join(', ')}`} />
        </div>
        <div className="dp-diagram-foot">
          <ul className="legend" aria-label="Line styles">
            <li><span className="swatch swatch-path" aria-hidden="true" />critical path</li>
            <li><span className="dp-sw dp-sw-past" aria-hidden="true" />needed, off the path</li>
            <li><span className="dp-sw dp-sw-future" aria-hidden="true" />not needed</li>
          </ul>
          <p className="dp-hint">Times are in {u}. Click a unit to see its slack.</p>
          {sel ? (
            <p className="dp-hint">
              {selNodes.length
                ? selNodes.map((n) => `${n.label}: starts ${n.start}, takes ${n.delay}, ends ${n.finish} ${u}, slack ${n.slack}${n.onPath ? ', on the critical path' : ''}`).join('. ')
                : `${model.units[sel as UnitId]?.title ?? model.wires[sel]?.title ?? sel}`}
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="dp-grid">
        <Panel title="Every unit this instruction waits for">
          <DataTable
            compact
            columns={[
              { key: 'l', header: 'Unit', cell: (n) => n.label },
              { key: 'd', header: `Delay`, cell: (n) => n.delay, mono: true, align: 'right' },
              { key: 's', header: 'Starts', cell: (n) => n.start, mono: true, align: 'right' },
              { key: 'f', header: 'Ends', cell: (n) => n.finish, mono: true, align: 'right' },
              { key: 'k', header: 'Slack', cell: (n) => n.slack, mono: true, align: 'right' },
              { key: 'p', header: 'On path', cell: (n) => (n.onPath ? 'yes' : 'no') },
              { key: 'i', header: 'Waits for', cell: (n) => n.inputs.map((x) => `${x.id} (${x.finish})`).join(', ') },
            ]}
            rows={r.nodes}
            rowSignal={(n) => (n.onPath ? 'path' : undefined)}
            caption={`Start = latest input finish; end = start + delay (${u})`}
          />
          {r.notNeeded.length ? (
            <ul className="dp-traps">
              {r.notNeeded.map((n) => (
                <li key={n.id}>
                  <strong>{n.label}</strong> not needed{n.reason ? `: ${n.reason}` : ''}.
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel title="Cycle time">
          <DataTable
            compact
            columns={[
              { key: 'c', header: 'Instruction', cell: (x) => (x.cls === 'R' ? 'R-type' : x.cls) },
              { key: 't', header: `Critical path (${u})`, cell: (x) => x.total, mono: true, align: 'right' },
            ]}
            rows={cyc.rows}
            rowSignal={(x) => (x.cls === cyc.slowest ? 'path' : undefined)}
          />
          <p className="dp-does">
            Cycle time = <W e={cyc.why}><span className="mono">{cyc.cycle} {u}</span></W>, set by {cyc.slowest === 'R' ? 'R-type' : cyc.slowest}.
          </p>
          <DataTable
            compact
            columns={[
              { key: 'c', header: 'Instr', cell: (x) => (x.cls === 'R' ? 'ALU' : x.cls) },
              { key: 'a', header: 'Inst mem', cell: (x) => x.cells.instMem ?? '', mono: true, align: 'right' },
              { key: 'b', header: 'Reg read', cell: (x) => x.cells.regRead ?? '', mono: true, align: 'right' },
              { key: 'd', header: 'ALU', cell: (x) => x.cells.alu ?? '', mono: true, align: 'right' },
              { key: 'e', header: 'Data mem', cell: (x) => x.cells.dataMem ?? '', mono: true, align: 'right' },
              { key: 'f', header: 'Reg write', cell: (x) => x.cells.regWrite ?? '', mono: true, align: 'right' },
              { key: 't', header: 'Total', cell: (x) => <W e={{ rule: 'Sum of the stages this instruction uses', working: x.working, cite: 'L12 p36' }}>{x.total}</W>, mono: true, align: 'right' },
            ]}
            rows={st.rows}
            rowSignal={(x) => (x.total === st.cycle ? 'path' : undefined)}
            caption={`The L12 p36 stage table: only memories, the register file and the ALU count (${u})`}
          />
        </Panel>
        <Panel title="Traps and conventions">
          <Callout kind="trap" cite="R06 p42">
            Count the register file twice: once to read, once to write. Leave out data memory when the instruction does not use it.
          </Callout>
          <Callout kind="trap" cite="R06 p42">
            For addi, sign extend and the ALUSrc mux (20 + 30 = 50 ps) run in parallel with the 200 ps register read, so they are not on the path. For an R-type, RD2 goes through the ALUSrc mux, so that 30 ps does count.
          </Callout>
          <Callout kind="course" cite="R06 p41">
            Delays in series add; delays in parallel take the max. The critical path is the longest path from start to finish.
          </Callout>
          <Callout kind="course" cite="L12 p36">
            The single-cycle clock must fit the slowest instruction, so every instruction pays lw's time.
          </Callout>
        </Panel>
      </div>
    </Workspace>
  )
}
