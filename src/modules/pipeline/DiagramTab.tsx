// Tab 1: the cycle grid with stalls, flushes and forwarding, the reasons, totals and an answer check.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { STAGES, regLabel, type CycleFrame, type InstrResult, type PipelineTrace, type Stage, type StallKind } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, Legend, Segmented, TextField, Toggle, Workspace } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'
import { Transport } from '../../ui/Transport'
import { Board, Details, PlayBar, Stage as Layout } from '../../ui/board'
import { EventList, Notes, PresetPicker, Setup, W, describeFrame, frameMarks, lineMarks, plural, type ProgramState } from './common'
import { PipelineGrid, type StageNames } from './Grid'
import CheckGrid from './CheckGrid'

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
export function Reasons({ trace, cycle, only }: { trace: PipelineTrace; cycle?: number; only?: Set<string> }) {
  const rl = (r: number) => regLabel(r, trace.stream.regStyle)
  const byseq = new Map(trace.instructions.map((i) => [i.seq, i]))
  const listed = trace.instructions.filter((i) => (i.operands.length || i.stalls.length || i.flushes.length) && (!only || only.has(i.uid)))
  if (!listed.length) return only ? null : <p className="pl-muted">No dependencies and no branches, so nothing waits.</p>
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
              ? `no extra stall (alone it costs ${o.isolated}; an earlier stall covers it)`
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
          <W e={t.why.split}>
            {t.dataStallCycles} / {t.controlStallCycles}
          </W>
        </dd>
      </div>
      <div>
        <dt>Instructions delayed (stall events)</dt>
        <dd className="mono">
          <W e={t.why.stallEvents}>{t.stallEvents}</W>
        </dd>
      </div>
      <div>
        <dt>Fetches flushed</dt>
        <dd className="mono">
          <W e={t.why.flushed}>{t.flushed}</W>
        </dd>
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
  if (Math.abs(v - x.cycles) === 1) return "Off by one. Cycle 1 is the first fetch, and the count ends at the last instruction's WB (AY23/24 S2 Q17)."
  const adj = t.instructions.filter((i) => i.operands.some((o) => o.distance === 1 && o.need === 'ID' && o.stalls === 2)).length
  if (!t.options.forwarding && adj && v === x.cycles + adj) return 'An adjacent RAW without forwarding costs 2 stalls. The register file is written in the first half of WB and read in the second half of ID (L21 p10-11, p22).'
  if (v === x.ideal + x.stallEvents && x.stallEvents !== x.stallCycles) return 'You counted one cycle per delayed instruction. Some stalls last longer; the reasons list gives each length.'
  if (x.flushed && v === x.cycles - x.controlStallCycles) return 'That leaves out the control stalls. Count the cycles lost while the branch or jump resolves.'
  return 'Compare where each stall starts in the grid with the reasons list.'
}

export function stallHint(v: number, t: PipelineTrace): string {
  const x = t.totals
  if (v === x.stallEvents) return `${x.stallEvents} is the number of delayed instructions (stall events). Count stall cycles: total ${x.cycles} minus ideal ${x.ideal} (the AY24/25 Q19 key counts 2 stalls of 2 cycles as 4).`
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
      <p className="pl-muted">Work it out on paper first.</p>
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

type View = 'actual' | 'ideal' | 'compare'

/** The same instruction stream with no stalls or flushes: instruction k is fetched in cycle k (L20 p32). */
export function idealTrace(t: PipelineTrace): PipelineTrace {
  const at = (k: number) => Object.fromEntries(STAGES.map((s, j) => [s, k + 1 + j])) as Record<Stage, number>
  return {
    ...t,
    rows: t.rows.filter((r) => !r.wrongPath).map((r, k) => ({ ...r, stages: at(k), flushedAt: undefined })),
    instructions: t.instructions.map((i, k) => ({ ...i, stages: at(k), stalls: [], delay: 0 })),
    frames: [],
    totals: { ...t.totals, cycles: t.totals.ideal },
  }
}

const CAUSE_TEXT: Record<StallKind, string> = {
  raw: 'RAW data hazard',
  'load-use': 'load-use (lw value ready only after MEM)',
  'branch-operand': 'branch operand not ready for the early branch',
  'store-data': 'store data not ready',
  branch: 'waiting for a branch to be decided',
  jump: 'waiting for a jump target',
}

/** Ideal versus actual, with the gap split by cause. */
export function IdealCompare({ trace }: { trace: PipelineTrace }) {
  const x = trace.totals
  const other = x.stallCycles - x.dataStallCycles - x.controlStallCycles
  const delayed = trace.instructions.filter((i) => i.delay > 0)
  return (
    <div className="pl-pad">
      <dl className="pl-facts">
        <div>
          <dt>Ideal, no stalls or flushes (I + 4)</dt>
          <dd className="mono">
            <W e={x.why.ideal}>{x.ideal}</W>
          </dd>
        </div>
        <div>
          <dt>+ data stall cycles</dt>
          <dd className="mono">{x.dataStallCycles}</dd>
        </div>
        <div>
          <dt>+ control stall cycles{x.flushed ? `, ${plural(x.flushed, 'fetch', 'fetches')} flushed` : ''}</dt>
          <dd className="mono">{x.controlStallCycles}</dd>
        </div>
        {other ? (
          <div>
            <dt>+ other</dt>
            <dd className="mono">{other}</dd>
          </div>
        ) : null}
        <div>
          <dt>= actual total</dt>
          <dd className="mono pl-big">
            <W e={x.why.cycles}>{x.cycles}</W>
          </dd>
        </div>
      </dl>
      {delayed.length ? (
        <ul className="pl-list">
          {delayed.map((i) => {
            const kind = (i.stalls.find((s) => s.binding) ?? i.stalls[0])?.kind
            return (
              <li key={i.uid}>
                <span className="mono">
                  {i.name} {i.text}
                </span>
                : <W e={i.delayWhy}>+{i.delay}</W>
                {kind ? `, ${CAUSE_TEXT[kind]}` : ''}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="pl-muted">Nothing waits, so actual equals ideal.</p>
      )}
    </div>
  )
}

/** The step story beside the board: only the current cycle, in the engine's words. */
export function CycleStory({ t, frame, children }: { t: PipelineTrace; frame: CycleFrame | undefined; children?: ReactNode }) {
  if (!frame) return null
  const waiting = new Set(frame.waiting.map((w) => w.uid))
  return (
    <aside className="story pl-story" aria-label="What happens this cycle">
      <p className="pl-story-head">
        <span className="pl-story-cycle">Cycle {frame.cycle}</span>
        <span className="pl-story-of">of {t.frames.length}</span>
      </p>
      <div className="story-body" key={frame.cycle}>
        <EventList frame={frame} />
        {waiting.size ? (
          <div className="pl-story-why">
            <p className="pl-story-sub">Why it waits</p>
            <Reasons trace={t} cycle={frame.cycle} only={waiting} />
          </div>
        ) : null}
        {children}
      </div>
    </aside>
  )
}

export default function DiagramTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const t = p.trace
  const stepper = useCycleStepper(t)
  const frame = t.frames[stepper.index]
  const [names, setNames] = useUrlState<StageNames>('names', 'long')
  const [view, setView] = useUrlState<View>('view', 'actual')
  const [mode, setMode] = useUrlState<'run' | 'check'>('pm', 'run')
  const checking = mode === 'check'
  const ideal = useMemo(() => idealTrace(t), [t])
  const idealCycle = frame && frame.cycle <= t.totals.ideal ? frame.cycle : undefined
  const marks = useMemo(() => frameMarks(t.frames), [t.frames])
  const stageNames = (
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
  )
  return (
    <Workspace
      title="Pipeline"
      lectures="L20 to L21, T10, R11"
      intro={intro}
      toolbar={<PresetPicker p={p} />}
      transport={checking ? undefined : <Transport stepper={stepper} label="Cycle" marks={marks} describe={describeFrame(t, frame)} />}
    >
      <Setup p={p} marks={lineMarks(t, frame)} extra={stageNames} />
      <Segmented
        label="Mode"
        value={checking ? 'check' : 'run'}
        options={[
          { value: 'run', label: 'Step through it' },
          { value: 'check', label: 'Check my answers', title: 'Type the delay and WB cycle, then mark them before seeing the diagram' },
        ]}
        onChange={setMode}
      />
      {checking ? (
        <CheckGrid trace={t} onReveal={() => setMode('run')} />
      ) : (
      <Layout>
        <Board
          className="pl-board"
          title="Pipeline diagram"
          step={frame && view !== 'ideal' ? `Cycle ${frame.cycle}` : view === 'ideal' ? 'Ideal' : undefined}
          note={
            t.ok && view === 'ideal'
              ? `${t.totals.instructions} instructions with no stalls or flushes take ${t.totals.ideal} cycles (I + 4, L20 p32); the actual run takes ${t.totals.cycles}.`
              : undefined
          }
          tools={
            <>
              <Segmented
                label="Show"
                value={view}
                onChange={setView}
                options={[
                  { value: 'actual', label: 'Actual' },
                  { value: 'ideal', label: 'Ideal', title: 'The same instructions with no stalls or flushes: I + 4 cycles' },
                  { value: 'compare', label: 'Compare', title: 'Ideal and actual together, with the difference split by cause' },
                ]}
              />
              <Toggle label="Forwarding" checked={t.options.forwarding} onChange={(v) => p.setOption('forwarding', v)} hint="L21 p18. The other hazard options are under Code and options." />
            </>
          }
          play={t.ok ? <PlayBar stepper={stepper} start="Step through the cycles" next={(i) => `cycle ${t.frames[i]?.cycle ?? i + 1}`} /> : null}
          foot={view === 'ideal' ? null : <GridLegend forwarding={t.options.forwarding} />}
        >
          {!t.ok ? (
            <p className="pl-pad pl-err">Fix the code to see the diagram.</p>
          ) : view === 'ideal' ? (
            <PipelineGrid trace={ideal} cycle={idealCycle} names={names} label="Ideal pipeline diagram" />
          ) : (
            <>
              {view === 'compare' ? <h3 className="pl-subhead">Actual: {t.totals.cycles} cycles</h3> : null}
              <PipelineGrid trace={t} cycle={frame?.cycle} onPick={(c) => stepper.set(c - 1)} names={names} />
              {view === 'compare' ? (
                <>
                  <h3 className="pl-subhead">Ideal: {t.totals.ideal} cycles, no stalls or flushes</h3>
                  <PipelineGrid trace={ideal} cycle={idealCycle} names={names} label="Ideal pipeline diagram" />
                  <h3 className="pl-subhead">Ideal to actual: +{t.totals.stallCycles}, by cause</h3>
                  <IdealCompare trace={t} />
                </>
              ) : null}
            </>
          )}
        </Board>
        {t.ok ? (
          <CycleStory t={t} frame={frame}>
            <p className="pl-tip">Click a cycle number in the grid to jump there.</p>
          </CycleStory>
        ) : null}
      </Layout>
      )}
      <Details
        urlKey="pdt"
        label="Tables for this trace"
        tabs={[
          {
            value: 'totals',
            label: 'Totals in exam terms',
            body: (
              <>
                <Totals trace={t} />
                <KeyCheck p={p} />
              </>
            ),
          },
          {
            value: 'why',
            label: 'Why each instruction waits',
            body: (
              <>
                <p className="pl-muted pl-gap">
                  Each +n is the extra delay: WB minus (previous WB + 1), as the AY23/24 S2 Q17 key counts.
                </p>
                <Reasons trace={t} cycle={frame?.cycle} />
              </>
            ),
          },
          {
            value: 'rules',
            label: 'Traps and conventions',
            body: (
              <div className="pl-notes">
                <Notes notes={t.notes} />
                <Traps trace={t} />
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
