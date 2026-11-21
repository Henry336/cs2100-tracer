// Tab 1: one instruction through the L12 p30 datapath, stage by stage (L11 p7-46, L12 p4-34).
import { useMemo, useState, type ReactNode } from 'react'
import {
  PIPELINE_GROUP, SIGNAL_MEANINGS, SIGNAL_ORDER, SINGLE_CYCLE_STAGE, traceDatapath,
  type ControlRow, type DatapathResult, type DatapathTrace, type SupportInfo,
} from '../../core/datapath'
import { hex, parseMemInit, parseRegInit, regName } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Panel, Presets, Segmented, Select, TextField, Toggle, Workspace } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import {
  AluCodeTable, AluControlTable, AluopTable, DatapathLegend, ExplainText, MainControlTable, W, mainRowName, parseNum, useUrlStepper, type NumMode,
} from './common'
import { Diagram } from './Diagram'
import { WHOLE, blankModel, buildTraceModel, wireText } from './model'
import { DEFAULT_TRACE, TRACE_PRESETS, type Fault, type TracePreset } from './presets'

const FAULT_SIGNALS: (keyof ControlRow)[] = [...SIGNAL_ORDER, 'BranchNE']

const STEP_TITLES = ['Fetch', 'Decode', 'ALU', 'Memory', 'Register write', 'Whole cycle']

/** All tracer inputs, each in the URL so a trace can be shared. */
export function useTraceInputs() {
  const [src, setSrc] = useUrlState('src', DEFAULT_TRACE.src)
  const [pc, setPc] = useUrlState('pc', DEFAULT_TRACE.pc)
  const [regs, setRegs] = useUrlState('regs', DEFAULT_TRACE.regs)
  const [mem, setMem] = useUrlState('mem', DEFAULT_TRACE.mem)
  const [mux, setMux] = useUrlState<'L11' | 'L12'>('mux', 'L11')
  const [fault, setFault] = useUrlState<Fault>('fault', null)
  const r = parseRegInit(regs)
  const m = parseMemInit(mem)
  const pcVal = parseNum(pc)
  const result: DatapathResult = useMemo(
    () => traceDatapath({ source: src, pc: pcVal ?? undefined, regs: r.regs, mem: m.mem, muxStage: mux, faults: fault ? { [fault.s]: fault.v } : undefined }),
    [src, pcVal, regs, mem, mux, fault], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const load = (p: Pick<TracePreset, 'src' | 'pc' | 'regs' | 'mem' | 'fault'>) => {
    setSrc(p.src)
    setPc(p.pc)
    setRegs(p.regs)
    setMem(p.mem)
    setFault(p.fault)
  }
  return { src, setSrc, pc, setPc, pcError: pcVal === null ? 'not a number' : pcVal % 4 ? `${hex(pcVal)} is not a multiple of 4; instructions are word aligned (L07 p15)` : null, regs, setRegs, regErrors: r.errors, mem, setMem, memErrors: m.errors, mux, setMux, fault, setFault, result, load }
}

export type TraceInputs = ReturnType<typeof useTraceInputs>

const lineErrors = (errs: { line: number; message: string }[]) => Object.fromEntries(errs.map((e) => [Math.max(0, e.line - 1), e.message]))

function InputPanel({ x }: { x: TraceInputs }) {
  const t = x.result.ok ? x.result : null
  const ins = x.result.instr
  const reads = t ? [...new Set([t.ports.RR1.used ? t.instr.rs : -1, t.ports.RR2.used ? t.instr.rt : -1])].filter((n) => n > 0) : []
  return (
    <Panel title="Instruction and machine state">
      <div className="dp-inputs">
        <div className="dp-input-row">
          <TextField label="Instruction (assembly or hex word)" value={x.src} onChange={x.setSrc} placeholder="add $t2, $t0, $t1" width="20em" />
          <TextField label="PC" value={x.pc} onChange={x.setPc} width="8.5em" />
        </div>
        {!x.result.ok && !x.result.support ? (
          <ul className="code-errors">
            {x.result.errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        ) : null}
        {x.pcError ? <p className="dp-err">PC: {x.pcError}</p> : null}
        {ins ? (
          <p className="dp-decoded mono">
            {hex(ins.word)} = {ins.text}
          </p>
        ) : null}
        <div className="dp-input-row">
          <CodeEditor label="Registers (one $reg = value per line)" value={x.regs} onChange={x.setRegs} rows={3} errors={lineErrors(x.regErrors)} />
          <CodeEditor label="Memory words (address: word, word)" value={x.mem} onChange={x.setMem} rows={3} errors={lineErrors(x.memErrors)} />
        </div>
        {t ? (
          <p className="dp-hint">
            {reads.length ? `This instruction reads ${reads.map((n) => `$${n} (${regName(n)})`).join(' and ')}. ` : ''}
            {t.control.row.MemRead === 1 || t.control.row.MemWrite === 1 ? `It accesses memory at ${t.ports.dmAddress.text}. ` : ''}
            Registers not listed hold 0.
          </p>
        ) : null}
        <div className="dp-input-row">
          <Segmented
            label="ALUSrc mux drawn in"
            value={x.mux}
            onChange={x.setMux}
            options={[
              { value: 'L11', label: 'Decode (L11 p31)', title: 'L11 p31 puts the RegDst and ALUSrc muxes in the decode stage' },
              { value: 'L12', label: 'ALU stage (L12 p5)', title: 'L12 p5 lists ALUSrc as an ALU-stage signal' },
            ]}
          />
          <Select
            label="Stuck-at fault (what if)"
            value={x.fault ? x.fault.s : 'none'}
            onChange={(s) => x.setFault(s === 'none' ? null : { s: s as keyof ControlRow, v: x.fault?.v ?? 1 })}
            options={[{ value: 'none', label: 'No fault' }, ...FAULT_SIGNALS.map((s) => ({ value: s, label: `${s} stuck` }))]}
          />
          {x.fault ? (
            <Segmented label="Stuck at" value={x.fault.v} onChange={(v) => x.setFault({ s: x.fault!.s, v })} options={[{ value: 0, label: '0' }, { value: 1, label: '1' }]} />
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

function SupportCallouts({ support, ok }: { support: SupportInfo; ok: boolean }) {
  if (support.level === 'course') return null
  if (support.level === 'derived') {
    return (
      <>
        {support.notes.map((n, i) => (
          <Callout key={i} kind={i === 0 ? 'course' : support.notInCourseDatapath ? 'beyond' : 'course'} title={i === 0 ? 'Outside the L12 control table' : support.notInCourseDatapath ? 'Extra hardware, beyond the course datapath' : 'Derived control row'} cite={n.cite}>
            {n.rule}.
          </Callout>
        ))}
      </>
    )
  }
  return (
    <Callout kind="beyond" title="Not in the course datapath" cite={support.notes.map((n) => n.cite).join('; ')}>
      <p>{support.notes.map((n) => n.rule).join('. ')}.</p>
      {support.missing.length ? (
        <>
          <p>What the L11 p48 hardware would need:</p>
          <ul>
            {support.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}
      {support.fieldUse ? <p>Register fields: {support.fieldUse.why.rule} ({support.fieldUse.why.cite}).</p> : null}
      {!ok ? <p>The diagram below is drawn without values because there is no control row to run it.</p> : null}
    </Callout>
  )
}

function StagePanel({ t, k, num }: { t: DatapathTrace; k: number; num: NumMode }) {
  if (k === WHOLE) {
    const c = t.commit
    return (
      <Panel title="Whole cycle: what the clock edge writes" actions={<span className="dp-cite">L11 p18, p23, p40</span>}>
        <ul className="dp-commit">
          <li>
            <span className="dp-commit-k">PC</span> <W e={c.pc.why}><span className="mono">{num === 'dec' ? String(c.pc.value | 0) : hex(c.pc.value)}</span></W>
          </li>
          <li>
            <span className="dp-commit-k">Register</span>{' '}
            {c.reg ? (
              <W e={c.reg.why}>
                <span className="mono">
                  ${c.reg.number} ({regName(c.reg.number)}) = {num === 'dec' ? String(c.reg.value | 0) : hex(c.reg.value)}
                </span>
              </W>
            ) : (
              <span className="dp-none">no register changes</span>
            )}
          </li>
          <li>
            <span className="dp-commit-k">Memory</span>{' '}
            {c.mem ? (
              <W e={c.mem.why}>
                <span className="mono">
                  Mem({hex(c.mem.address)}) = {num === 'dec' ? String(c.mem.value | 0) : hex(c.mem.value)}
                </span>
              </W>
            ) : (
              <span className="dp-none">memory unchanged</span>
            )}
          </li>
        </ul>
        {c.notes.map((n) => (
          <p key={n} className="dp-hint">
            {n}
          </p>
        ))}
        <p className="dp-hint">Every unit computed a value this cycle. The dashed wires carry values that a mux or an enable threw away (T04 Answers p3).</p>
      </Panel>
    )
  }
  const f = t.frames[k]
  return (
    <Panel title={`Stage ${k + 1} of 5: ${f.title}`} actions={<span className="dp-cite">{f.cite}</span>}>
      {f.idle ? (
        <p className="dp-idle">
          <Chip signal="stall">idle</Chip> This instruction does nothing useful in this stage.
        </p>
      ) : null}
      <p className="dp-does">{f.does}</p>
      {f.signals.length ? (
        <div className="dp-signals" aria-label="Control signals acting in this stage">
          {f.signals.map((s) => (
            <span key={s.name} className="dp-sig" title={s.meaning}>
              <Chip signal={s.value === 'X' ? 'dontcare' : 'control'}>
                {s.name} = {s.value}
              </Chip>
              <span className="dp-sig-m">{s.meaning}</span>
            </span>
          ))}
        </div>
      ) : null}
      <dl className="dp-outputs">
        {f.outputs.map((o) => (
          <div key={o.label}>
            <dt>{o.label}</dt>
            <dd className="mono">
              <W e={o.why}>{o.text}</W>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function SelectedPanel({ t, sel, num, onClear }: { t: DatapathTrace; sel: string; num: NumMode; onClear: () => void }) {
  const w = t.wires.find((x) => x.id === sel)
  const u = t.units.find((x) => x.id === sel)
  let body: ReactNode = null
  if (w) {
    body = (
      <>
        <p>
          <strong>{w.label}</strong> to {w.port} ({w.bits} bit{w.bits > 1 ? 's' : ''}, set in the {STEP_TITLES[['fetch', 'decode', 'alu', 'memory', 'regwrite'].indexOf(w.stage)].toLowerCase()} stage):{' '}
          <span className="mono">{wireText(w, num)}</span>{' '}
          <Chip signal={w.status === 'used' ? 'path' : w.status === 'dontcare' ? 'dontcare' : 'stall'}>{w.status === 'used' ? 'used' : w.status === 'dontcare' ? "don't care" : 'computed but discarded'}</Chip>
        </p>
        <ExplainText e={w.why} />
      </>
    )
  } else if (u) {
    const ins = t.wires.filter((x) => x.to === u.id)
    const outs = t.wires.filter((x) => x.from === u.id)
    const list = (ws: typeof ins) => ws.map((x) => `${x.label} = ${wireText(x, num)}`).join(', ')
    body = (
      <>
        <p>
          <strong>{u.label}</strong> <Chip signal={u.active ? 'path' : 'stall'}>{u.active ? 'result kept' : 'result discarded'}</Chip>
        </p>
        <p className="dp-explain">{u.why}.</p>
        {ins.length ? <p className="dp-hint">In: <span className="mono">{list(ins)}</span></p> : null}
        {outs.length ? <p className="dp-hint">Out: <span className="mono">{list(outs)}</span></p> : null}
      </>
    )
  }
  if (!body) return null
  return (
    <Panel title="Selected part" actions={<button type="button" className="btn" onClick={onClear}>Clear</button>}>
      <div className="dp-selected">{body}</div>
    </Panel>
  )
}

function T04Table({ t, num }: { t: DatapathTrace; num: NumMode }) {
  const isReg = (p: string) => p === 'RR1' || p === 'RR2' || p === 'WR'
  return (
    <DataTable
      compact
      columns={[
        { key: 'l', header: 'Item', cell: (r) => r.label },
        { key: 's', header: 'T04 notation', cell: (r) => <W e={t.ports[r.port].why}>{t.ports[r.port].symbolic}</W>, mono: true },
        {
          key: 'v',
          header: 'Value',
          mono: true,
          cell: (r) => {
            const p = t.ports[r.port]
            return p.value === null || isReg(r.port) || num === 'hex' ? p.text : String(p.value | 0)
          },
        },
        { key: 'u', header: 'Kept', cell: (r) => (t.ports[r.port].used ? 'yes' : <span className="dp-none">discarded</span>) },
      ]}
      rows={t.t04}
      caption="T04 Q3 table: $5 is a register number, [$5] its contents, Mem(X) a memory word (T04 Answers p3)"
    />
  )
}

function SignalsTable({ t }: { t: DatapathTrace }) {
  const r = t.control.row
  const names = [...SIGNAL_ORDER, ...(r.BranchNE !== undefined ? (['BranchNE'] as const) : [])]
  return (
    <DataTable
      compact
      columns={[
        { key: 'n', header: 'Signal', cell: (s) => s },
        {
          key: 'v',
          header: 'Value',
          align: 'center',
          mono: true,
          cell: (s) => {
            const e = t.control.signalWhy[s]
            const v = String(r[s])
            const faulted = t.control.faults.some((f) => f.signal === s)
            return (
              <>
                {e ? <W e={e}>{v}</W> : v}
                {faulted ? <> <Chip signal="miss">stuck</Chip></> : null}
              </>
            )
          },
        },
        { key: 'm', header: 'Meaning', cell: (s) => (r[s] === 'X' ? "don't care" : s === 'ALUop1' || s === 'ALUop0' ? `ALUop = ${t.control.aluop}` : r[s] === 1 ? SIGNAL_MEANINGS[s].one : SIGNAL_MEANINGS[s].zero) },
        { key: 'st', header: 'Acts in (L12 p5)', cell: (s) => SINGLE_CYCLE_STAGE[s] },
        { key: 'pg', header: 'Pipeline (L20 p27)', align: 'center', cell: (s) => (s === 'BranchNE' ? <span className="dp-none">not in L20</span> : PIPELINE_GROUP[s]) },
      ]}
      rows={names}
      rowSignal={(s) => (r[s] === 'X' ? undefined : r[s] === 1 ? 'control' : undefined)}
      caption={<W e={t.control.source}>Where this row comes from</W>}
    />
  )
}

function FieldsTable({ t }: { t: DatapathTrace }) {
  return (
    <DataTable
      compact
      columns={[
        { key: 'n', header: 'Field', cell: (f) => f.name },
        { key: 'b', header: 'Bits', cell: (f) => `${f.hi}:${f.lo}`, mono: true },
        { key: 'x', header: 'Binary', cell: (f) => f.bin, mono: true },
        { key: 'v', header: 'Value', cell: (f) => f.value, mono: true, align: 'right' },
        { key: 'f', header: 'Feeds', cell: (f) => f.feeds },
      ]}
      rows={t.fields}
      caption={`${t.instr.format}-format fields of ${hex(t.instr.word)} (L11 p20, p48)`}
    />
  )
}

function WireTable({ t, num, onPick }: { t: DatapathTrace; num: NumMode; onPick: (id: string) => void }) {
  return (
    <DataTable
      compact
      columns={[
        { key: 'w', header: 'Wire', cell: (w) => <button type="button" className="dp-linkbtn" onClick={() => onPick(w.id)}>{w.label} to {w.port}</button> },
        { key: 'v', header: 'Value', mono: true, cell: (w) => <W e={w.why}>{wireText(w, num)}</W> },
        { key: 's', header: 'Status', cell: (w) => (w.status === 'used' ? 'used' : w.status === 'dontcare' ? 'X' : 'discarded') },
        { key: 'g', header: 'Stage', cell: (w) => STEP_TITLES[['fetch', 'decode', 'alu', 'memory', 'regwrite'].indexOf(w.stage)] },
      ]}
      rows={t.wires}
      rowSignal={(w) => (w.status === 'used' ? undefined : 'stall')}
      caption="Every wire this cycle. Discarded rows are greyed (T04 Answers p3)"
    />
  )
}

export default function TraceTab({ intro, x }: { intro: ReactNode; x: TraceInputs }) {
  const [num, setNum] = useUrlState<NumMode>('num', 'hex')
  const [focus, setFocus] = useUrlState('focus', false)
  const [sel, setSel] = useState<string | null>(null)
  const res = x.result
  const t = res.ok ? res : null
  const stepper = useUrlStepper(t ? WHOLE + 1 : 0, 'step', WHOLE)
  const k = stepper.index
  const model = useMemo(() => (t ? buildTraceModel(t, k, focus, num) : blankModel()), [t, k, focus, num])
  const support = res.support
  const row = t ? mainRowName(t.instr.opcode, t.instr.mnemonic) : null
  const marks = t ? [...t.frames.map((f) => (f.idle ? 'stall' : 'path')), 'dirty'] : []
  const describe = t ? (k === WHOLE ? 'whole cycle, clock edge' : `${t.frames[k].title}${t.frames[k].idle ? ' (idle)' : ''}`) : undefined

  return (
    <Workspace
      title="Datapath and control"
      lectures="L11 to L12, T04 to T05, R05 to R06"
      intro={intro}
      toolbar={
        <>
          <Presets
            presets={TRACE_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
            onPick={(p) => {
              x.load(p)
              stepper.set(WHOLE)
              setSel(null)
            }}
          />
        </>
      }
      transport={t ? <Transport stepper={stepper} label="step" marks={marks} describe={describe} /> : undefined}
    >
      <div className="dp-top">
        <InputPanel x={x} />
        {t ? <StagePanel t={t} k={k} num={num} /> : null}
      </div>
      {support ? <SupportCallouts support={support} ok={res.ok} /> : null}
      {t && t.control.faults.length ? (
        <Callout kind="trap" title="Hardware fault in effect" cite="AY15/16 Q9b, AY17/18 Q4c">
          {t.control.faults.map((f) => `${f.signal} is stuck at ${f.forced}; the control table gives ${f.table ?? 'no such signal'}.`).join(' ')} Compare with the fault turned off to see which wires change.
        </Callout>
      ) : null}

      <Panel
        title={t ? `${t.instr.text} at ${hex(t.pc)}: ${STEP_TITLES[k].toLowerCase()}` : 'Single-cycle datapath with control (L12 p30)'}
        actions={
          <div className="dp-diagram-actions">
            <Segmented label="Numbers" value={num} onChange={setNum} options={[{ value: 'hex', label: 'Hex' }, { value: 'dec', label: 'Decimal' }]} />
            <Toggle label="Show only what this instruction uses" checked={focus} onChange={setFocus} hint="Hide every unit and wire whose value is thrown away, and anything after the current stage" />
          </div>
        }
        flush
      >
        <div className="dp-scroll">
          <Diagram model={model} selected={sel} onSelect={(id) => setSel((s) => (s === id ? null : id))} label={t ? `Datapath for ${t.instr.text}, ${STEP_TITLES[k]}` : 'Datapath without values'} />
        </div>
        <div className="dp-diagram-foot">
          <DatapathLegend />
          <p className="dp-hint">Click or Tab to any wire or unit to see how its value is worked out. MemToReg has input 1 on top (L12 p15). Drawing after L11 p48 and L12 p30.</p>
        </div>
      </Panel>
      {t && sel ? <SelectedPanel t={t} sel={sel} num={num} onClear={() => setSel(null)} /> : null}

      {t ? (
        <div className="dp-grid">
          <Panel title="T04 Q3 table">
            <T04Table t={t} num={num} />
          </Panel>
          <Panel title="Control signals">
            <SignalsTable t={t} />
            <p className="dp-hint">
              PCSrc = <W e={t.control.pcSrcWhy}>{t.control.pcSrc}</W>, ALUcontrol = <span className="mono">{t.control.aluControl}</span> ({t.control.aluAction})
            </p>
          </Panel>
          <Panel title="Main control table">
            <MainControlTable active={row} />
          </Panel>
          <Panel title="ALU control, two levels">
            <AluopTable aluop={t.control.aluop} />
            <AluControlTable aluop={t.control.aluop} funct={t.instr.funct} instr={t.instr.mnemonic} />
            <AluCodeTable code={t.control.aluControl} />
          </Panel>
          <Panel title="Instruction fields">
            <FieldsTable t={t} />
          </Panel>
          <Panel title="Traps for this instruction">
            <Callout kind="trap">
              <ul className="dp-traps">
                {t.traps.map((tr) => (
                  <li key={tr.rule}>
                    {tr.rule}. <span className="dp-cite">{tr.cite}</span>
                  </li>
                ))}
              </ul>
            </Callout>
            <Callout kind="course" title="Course conventions">
              <ul className="dp-traps">
                <li>RegDst 0 picks rt, 1 picks rd; ALUSrc 0 picks RD2, 1 picks the sign-extended immediate (L12 p10, p12).</li>
                <li>The MemToReg mux is drawn with 1 (memory data) on top (L12 p15).</li>
                <li>Where the ALUSrc mux sits differs: L11 p31 puts it in decode, L12 p5 in the ALU stage. Switch it above.</li>
                <li>Stages differ between lectures: L12 p5 puts RegDst and RegWrite in decode, while the pipeline uses RegDst in EX and RegWrite in WB (L20 p27). The control signals table shows both.</li>
              </ul>
            </Callout>
          </Panel>
          <Panel title="All wire values" className="dp-span">
            <WireTable t={t} num={num} onPick={setSel} />
          </Panel>
        </div>
      ) : null}
    </Workspace>
  )
}

