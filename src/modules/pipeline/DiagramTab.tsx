// Tab 1: the cycle grid with stalls, flushes and forwarding, the reasons, totals and an answer check.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { regLabel, type InstrResult, type PipelineTrace } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, Legend, Panel, Segmented, TextField, Workspace } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'
import { Transport } from '../../ui/Transport'
import { EventList, Notes, OptionsPanel, ProgramPanel, W, describeFrame, frameMarks, lineMarks, plural, type ProgramState } from './common'
import { PipelineGrid, type StageNames } from './Grid'

export function useCycleStepper(trace: PipelineTrace) {
  const [stepQ, setStepQ] = useUrlState('step', 0)
  const stepper = useStepper(trace.frames.length, { initial: stepQ })
  const i = stepper.index
  useEffect(() => {
    if (i !== stepQ) setStepQ(i)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stepQ !== i) stepper.set(stepQ)
  }, [stepQ]) // eslint-disable-line react-hooks/exhaustive-deps
  return stepper
}

export function GridLegend({ forwarding = true }: { forwarding?: boolean }) {
  return (
    <Legend
      items={[
        { signal: 'path', label: 'current cycle' },
        { signal: 'stall', label: 'stall, labelled RAW, lw (load-use), br (branch operand) or sw' },
        { signal: 'flush', label: 'flushed (struck out)' },
        ...(forwarding ? [{ signal: 'forward' as const, label: 'forwarding' }] : []),
        { signal: 'data', label: 'register file read in the WB cycle (dashed)' },
      ]}
    />
  )
}

const mnem = (t: PipelineTrace, seq: number) => t.stream.items[seq - 1]?.instr.mnemonic ?? ''

/** One line per dependency and control wait, in exam words, each number explorable. */
export function Reasons({ trace, cycle }: { trace: PipelineTrace; cycle?: number }) {
  const rl = (r: number) => regLabel(r, trace.stream.regStyle)
  const byseq = new Map(trace.instructions.map((i) => [i.seq, i]))
  const listed = trace.instructions.filter((i) => i.operands.length || i.stalls.length || i.flushes.length)
  if (!listed.length) return <p className="pl-muted">No instruction reads a register written by an earlier one, and there are no branches: the pipeline never waits.</p>
  const active = (i: InstrResult) => cycle !== undefined && Object.values(i.stages).some((c) => c === cycle)
  return (
    <ol className="pl-reasons">
      {listed.map((i) => {
        const lines: ReactNode[] = []
        for (const o of i.operands) {
          const p = byseq.get(o.producer)
          const pn = p ? `${p.name} (${mnem(trace, p.seq)})` : `instruction ${o.producer}`
          const cost = o.stalls > 0
            ? plural(o.stalls, 'stall cycle')
            : o.isolated > 0
              ? `no extra stall (alone it costs ${o.isolated}; an earlier stall already covered it)`
              : 'no stall'
          lines.push(
            <li key={`o${o.register}`}>
              needs {rl(o.register)} from {pn}, {plural(o.distance, 'instruction')} back, in {o.need}: {o.why.rule}.{' '}
              <W e={o.why}>
                <strong>{cost}</strong>
              </W>
              {', value via '}
              <W e={o.forward.why}>{o.forward.path}</W>
              {o.forward.cycle ? ` in cycle ${o.forward.cycle}` : ''}.
            </li>,
          )
        }
        for (const s of i.stalls) {
          if (s.control === undefined) continue
          const b = byseq.get(s.control)
          lines.push(
            <li key={`c${s.control}${s.kind}`}>
              waits for {b ? `${b.name} (${mnem(trace, b.seq)})` : 'a branch'}: {s.why.rule}{' '}
              <W e={s.why}>
                <strong>{plural(s.cycles, 'cycle')}</strong>
              </W>
              {s.binding ? '' : ' (not the binding cause)'}.
            </li>,
          )
        }
        if (i.control) {
          lines.push(
            <li key="ctl">
              control rule: <W e={i.control}>{i.control.rule}</W>
              {i.flushes.length ? ` Flushes ${plural(i.flushes.length, 'fetch', 'fetches')}.` : ''}
            </li>,
          )
        }
        return (
          <li key={i.uid} className={active(i) ? 'pl-reason pl-reason-now' : 'pl-reason'}>
            <div className="pl-reason-head">
              <span className="mono pl-rname">{i.name}</span>
              <span className="mono">{i.text}</span>
              {i.slot ? <Chip signal="control">delay slot</Chip> : null}
              <span className="pl-delay">
                <W e={i.delayWhy}>{i.delay > 0 ? `+${i.delay}` : '+0'}</W>
              </span>
            </div>
            <ul className="pl-reason-lines">{lines}</ul>
          </li>
        )
      })}
    </ol>
  )
}

/** The totals an exam asks for, each one explorable. */
export function Totals({ trace }: { trace: PipelineTrace }) {
  const t = trace.totals
  const nopsText = t.nops.length ? t.nops.map((n) => `${n.count} after ${n.after}`).join(', ') : 'none'
  return (
    <dl className="pl-facts">
      <div>
        <dt>Instructions executed (I)</dt>
        <dd className="mono">{t.instructions}</dd>
      </div>
      <div>
        <dt>Ideal cycles (I + 4)</dt>
        <dd className="mono">
          <W e={t.why.ideal}>{t.ideal}</W>
        </dd>
      </div>
      <div>
        <dt>Total cycles</dt>
        <dd className="mono pl-big">
          <W e={t.why.cycles}>{t.cycles}</W>
        </dd>
      </div>
      <div>
        <dt>Stall cycles (total minus ideal)</dt>
        <dd className="mono">
          <W e={t.why.stallCycles}>{t.stallCycles}</W>
        </dd>
      </div>
      <div>
        <dt>Data stall cycles / control</dt>
        <dd className="mono">
          {t.dataStallCycles} / {t.controlStallCycles}
        </dd>
      </div>
      <div>
        <dt>Instructions delayed (stall events)</dt>
        <dd className="mono">{t.stallEvents}</dd>
      </div>
      <div>
        <dt>Fetches flushed</dt>
        <dd className="mono">{t.flushed}</dd>
      </div>
      <div>
        <dt>Nops without hazard detection</dt>
        <dd className="mono">
          <W e={t.why.nops}>{nopsText}</W>
        </dd>
      </div>
    </dl>
  )
}

export function cycleHint(v: number, t: PipelineTrace): string {
  const x = t.totals
  if (v === x.ideal && x.stallCycles) return `${x.ideal} is the ideal count, I + 4. Each stall adds a cycle on top (L20 p32).`
  if (v === x.instructions) return 'One cycle per instruction is the single-cycle count. A 5-stage pipeline needs I + 4 plus stalls (L20 p32).'
  if (Math.abs(v - x.cycles) === 1) return 'Off by one. Count up to the WB of the last instruction, cycle 1 being the first fetch (AY23/24 S2 Q17).'
  const adj = t.instructions.filter((i) => i.operands.some((o) => o.distance === 1 && o.need === 'ID' && o.stalls === 2)).length
  if (!t.options.forwarding && adj && v === x.cycles + adj) return 'An adjacent RAW without forwarding costs 2 stalls, not 3: the register file is written in the first half of WB and read in the second half of ID (L21 p10-11, p22).'
  if (v === x.ideal + x.stallEvents && x.stallEvents !== x.stallCycles) return 'You added one cycle per delayed instruction. Some stalls last more than one cycle; the reasons list gives each length.'
  if (x.flushed && v === x.cycles - x.controlStallCycles) return 'That leaves out the control stalls. Count the cycles lost while the branch or jump resolves.'
  return 'Not the same. Step through the cycles and compare where each stall starts with the reasons list.'
}

export function stallHint(v: number, t: PipelineTrace): string {
  const x = t.totals
  if (v === x.stallEvents) return `${x.stallEvents} is the number of delayed instructions (stall events). Count stall cycles instead: total ${x.cycles} minus ideal ${x.ideal} (AY24/25 Q19 key counts 2 stalls of 2 cycles as 4).`
  if (x.controlStallCycles && v === x.dataStallCycles) return 'That counts the data stalls only. Branches and jumps add control stall cycles too.'
  if (x.dataStallCycles && v === x.controlStallCycles) return 'That counts the control stalls only. Add the data stalls.'
  return `Stall cycles = total cycles minus the ideal I + 4. Check each stall in the reasons list.`
}

/** The student types their answers; Check compares them with the trace. */
export function AnswerCheck({ trace }: { trace: PipelineTrace }) {
  const [ans, setAns] = useUrlState('ans', { cycles: '', stalls: '' })
  const [checked, setChecked] = useState(false)
  const set = (k: 'cycles' | 'stalls', v: string) => {
    setChecked(false)
    setAns({ ...ans, [k]: v })
  }
  const parse = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : undefined)
  const c = parse(ans.cycles)
  const s = parse(ans.stalls)
  const x = trace.totals
  const verdict = (v: number | undefined, want: number, hint: (v: number) => string) =>
    v === undefined ? null : v === want ? <Chip signal="hit">Correct</Chip> : (
      <span className="pl-verdict">
        <Chip signal="miss">Not {v}</Chip> {hint(v)}
      </span>
    )
  return (
    <div className="pl-check">
      <p className="pl-muted">Work it out on paper first, then type your numbers. Nothing is checked until you press Check.</p>
      <div className="pl-row">
        <TextField label="Total cycles" value={ans.cycles} onChange={(v) => set('cycles', v)} width="6em" />
        <TextField label="Stall cycles" value={ans.stalls} onChange={(v) => set('stalls', v)} width="6em" />
        <Button variant="primary" onClick={() => setChecked(true)} disabled={c === undefined && s === undefined}>
          Check
        </Button>
      </div>
      {checked ? (
        <div className="pl-check-out" role="status">
          {c !== undefined ? <p>Total cycles: {verdict(c, x.cycles, (v) => cycleHint(v, trace))}</p> : null}
          {s !== undefined ? <p>Stall cycles: {verdict(s, x.stallCycles, (v) => stallHint(v, trace))}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

/** When the loaded preset is unchanged, its answer key beside the computed values. */
export function KeyCheck({ p }: { p: ProgramState }) {
  const pr = p.preset
  if (!pr || !p.presetIntact) return null
  const e = pr.expect
  const t = p.trace
  const items: [string, string, boolean][] = []
  if (e.cycles !== undefined) items.push(['Total cycles', String(e.cycles), e.cycles === t.totals.cycles])
  if (e.stallCycles !== undefined) items.push(['Stall cycles', String(e.stallCycles), e.stallCycles === t.totals.stallCycles])
  if (e.delays) {
    const got = Object.fromEntries(t.instructions.filter((i) => i.delay > 0).map((i) => [i.name, i.delay]))
    const same = JSON.stringify(Object.entries(e.delays).sort()) === JSON.stringify(Object.entries(got).sort())
    items.push(['Extra delay per instruction', Object.entries(e.delays).map(([k, v]) => `${k} +${v}`).join(', ') || 'none', same])
  }
  if (e.nops) items.push(['Nops', e.nops.map((n) => `${n.count} after ${n.after}`).join(', ') || 'none', JSON.stringify(e.nops) === JSON.stringify(t.totals.nops)])
  if (e.flushed) items.push(['Flushed', e.flushed.join(', '), e.flushed.every((n) => t.rows.some((r) => r.wrongPath && r.name === n))])
  if (!items.length && !pr.note) return null
  return (
    <details className="pl-details">
      <summary>{pr.official ? 'Answer key' : 'Worked values (derived, no key)'}: {pr.cite}</summary>
      {items.length ? (
        <ul className="pl-list">
          {items.map(([k, v, ok]) => (
            <li key={k}>
              {k}: <span className="mono">{v}</span> <Chip signal={ok ? 'hit' : 'miss'}>{ok ? 'trace agrees' : 'trace differs'}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
      {pr.note ? <p className="pl-muted">{pr.note}</p> : null}
    </details>
  )
}

export function Traps({ trace }: { trace: PipelineTrace }) {
  const o = trace.options
  const loads = trace.stream.items.some((i) => i.cls === 'load')
  return (
    <>
      {!o.forwarding ? (
        <Callout kind="trap" title="2 stalls, not 3" cite="L21 p10-11, p22">
          Without forwarding, an adjacent RAW costs 2 stall cycles: the reader's ID can share the writer's WB cycle. Distance 2 costs 1, distance 3 costs none.
        </Callout>
      ) : loads ? (
        <Callout kind="trap" title="Forwarding does not remove load-use" cite="L21 p19-20">
          A lw result exists only after MEM, so the next instruction that uses it still waits 1 cycle.
        </Callout>
      ) : null}
      {o.branchStage === 'ID' ? (
        <Callout kind="trap" title="The early branch is not always 1 cycle" cite="L21 p37-39; T10 Q3">
          The comparator in ID needs its operands early: +1 after an ALU instruction right before it, +2 after a lw right before it.
        </Callout>
      ) : null}
      <Callout kind="course" title="How the course counts" cite="L20 p32; AY23/24 S2 Q17">
        Cycles run from the first fetch to the WB of the last counted instruction. Ideal = I + 4 for 5 stages.
      </Callout>
    </>
  )
}

export default function DiagramTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const t = p.trace
  const stepper = useCycleStepper(t)
  const frame = t.frames[stepper.index]
  const [names, setNames] = useUrlState<StageNames>('names', 'long')
  const marks = useMemo(() => frameMarks(t.frames), [t.frames])
  return (
    <Workspace
      title="Pipeline"
      lectures="L20 to L21, T10, R11"
      intro={intro}
      inspector={
        <>
          <Panel title="Totals in exam terms">
            <Totals trace={t} />
            <KeyCheck p={p} />
          </Panel>
          <Panel title="Check my answer">
            <AnswerCheck trace={t} />
          </Panel>
          <Notes notes={t.notes} />
          <Traps trace={t} />
        </>
      }
      transport={<Transport stepper={stepper} label="Cycle" marks={marks} describe={describeFrame(t, frame)} />}
    >
      <ProgramPanel p={p} marks={lineMarks(t, frame)} />
      <OptionsPanel p={p} />
      <Panel
        title="Pipeline diagram"
        actions={
          <Segmented
            label="Stage names"
            value={names}
            onChange={setNames}
            options={[
              { value: 'long', label: 'IF ID EX' },
              { value: 'short', label: 'F D E' },
              { value: 'units', label: 'IM Reg ALU', title: 'The unit each stage uses, as drawn in L21 p6 and p18' },
            ]}
          />
        }
        flush
      >
        <div className="pl-pad">
          <GridLegend forwarding={t.options.forwarding} />
        </div>
        {t.ok ? <PipelineGrid trace={t} cycle={frame?.cycle} onPick={(c) => stepper.set(c - 1)} names={names} /> : <p className="pl-pad pl-err">Fix the code to see the diagram.</p>}
      </Panel>
      <Panel title={frame ? `Cycle ${frame.cycle}: what happens` : 'Cycle'}>
        <EventList frame={frame} />
      </Panel>
      <Panel title="Why each instruction waits">
        <p className="pl-muted pl-gap">
          The +n after each instruction is its extra delay: WB minus (previous WB + 1), the way the AY23/24 S2 Q17 key counts. Click any underlined value for the rule and the slide.
        </p>
        <Reasons trace={t} cycle={frame?.cycle} />
      </Panel>
    </Workspace>
  )
}
