// Tab 4: the same code under each way of handling branches, side by side.
import { useMemo, type ReactNode } from 'react'
import { delaySlotCandidates, tracePipeline, type Explain, type PipelineOptions, type PipelineTrace } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Toggle, Workspace, type Column } from '../../ui/kit'
import { Board, Details } from '../../ui/board'
import { Notes, PresetPicker, Setup, W, plural, type ProgramState } from './common'
import { GridLegend } from './DiagramTab'
import { PipelineGrid } from './Grid'

interface Strategy {
  id: string
  label: string
  options: Partial<PipelineOptions>
  mechanism: Explain
  beyond?: boolean
}

const STRATEGIES: Strategy[] = [
  { id: 'mem', label: 'Branch decided in MEM, stall', options: { branchStage: 'MEM', prediction: 'none', delayedBranch: false }, mechanism: { rule: 'The base datapath sets PCSrc in MEM, so the next fetch waits 3 cycles after every branch', cite: 'L21 p30-32' } },
  { id: 'id', label: 'Early branch in ID, stall', options: { branchStage: 'ID', prediction: 'none', delayedBranch: false }, mechanism: { rule: 'A comparator and the target adder move to ID, so the wait drops to 1 cycle, plus operand stalls if the value comes from just before', cite: 'L21 p34-39' } },
  { id: 'pnt', label: 'Early branch, predict not taken', options: { branchStage: 'ID', prediction: 'not-taken', delayedBranch: false }, mechanism: { rule: 'Keep fetching PC+4. A not-taken branch costs nothing; a taken one flushes the wrong fetch', cite: 'L21 p40-42' } },
  { id: 'delay', label: 'Early branch, delayed branch', options: { branchStage: 'ID', prediction: 'none', delayedBranch: true }, mechanism: { rule: 'The instruction after the branch (the delay slot) always runs, which hides the 1-cycle wait', cite: 'L21 p46-48' } },
  { id: 'pt', label: 'Early branch, predict taken', beyond: true, options: { branchStage: 'ID', prediction: 'taken', delayedBranch: false }, mechanism: { rule: 'Beyond the lectures: fetch the target right after the branch. R11 Quiz Q7 uses it', cite: 'R11 p45' } },
]

function SlotCandidates({ t }: { t: PipelineTrace }) {
  const branches = t.stream.program.instructions.map((ins, k) => ({ ins, k })).filter(({ ins }) => ['beq', 'bne'].includes(ins.mnemonic))
  if (!branches.length) return null
  return (
    <div className="pl-slots">
      <p className="pl-muted pl-gap">
        The trace runs the next instruction in the slot. A compiler would move an earlier instruction there instead, if the move keeps every RAW, WAR and WAW order and the branch does not use its result (L21 p46-48).
      </p>
      {branches.map(({ ins, k }) => {
        const c = delaySlotCandidates(t.stream, k)
        return (
          <div key={k} className="pl-slot">
            <p className="mono">
              {t.stream.names[k]} {t.stream.texts[k] || ins.text}
            </p>
            {c.length ? (
              <ul className="pl-list">
                {c.map((x) => (
                  <li key={x.index}>
                    <Chip signal={x.ok ? 'hit' : 'miss'}>{x.ok ? 'can move' : 'cannot move'}</Chip> <span className="mono">{x.name}</span> {t.stream.texts[x.index]}: {x.why}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pl-muted">Nothing before it in the same block: put a nop in the slot.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

type Detail = 'score' | 'slot' | 'run' | 'rules'

export default function BranchesTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const [withTaken, setWithTaken] = useUrlState('ptk', false)
  const [pick, setPick] = useUrlState('bs', STRATEGIES[0].id)
  const base = p.options
  const shown = STRATEGIES.filter((s) => !s.beyond || withTaken)
  const traces = useMemo(
    () => shown.map((s) => ({ s, t: tracePipeline(p.src, { ...base, ...s.options }, p.stream) })),
    [p.src, base, p.stream, withTaken], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const ok = traces.every((x) => x.t.ok)
  const best = Math.min(...traces.map((x) => x.t.totals.cycles))
  const cur = traces.find((x) => x.s.id === pick) ?? traces[0]
  const branches = p.trace.stream.items.filter((i) => i.cls === 'branch')
  const taken = branches.filter((i) => i.taken).length
  const hasBranch = p.trace.stream.program.instructions.some((ins) => ['beq', 'bne'].includes(ins.mnemonic))
  const cols: Column<(typeof traces)[number]>[] = [
    { key: 's', header: 'Strategy', cell: (x) => <W e={x.s.mechanism}>{x.s.label}</W> },
    { key: 'c', header: 'Total cycles', align: 'right', cell: (x) => <W e={x.t.totals.why.cycles}><strong>{x.t.totals.cycles}</strong></W> },
    { key: 'st', header: 'Stall cycles', align: 'right', cell: (x) => <W e={x.t.totals.why.stallCycles}>{x.t.totals.stallCycles}</W> },
    { key: 'ctl', header: 'Control / data', align: 'right', cell: (x) => `${x.t.totals.controlStallCycles} / ${x.t.totals.dataStallCycles}`, mono: true },
    { key: 'f', header: 'Flushed', align: 'right', cell: (x) => x.t.totals.flushed },
    { key: 'b', header: '', cell: (x) => (x.t.totals.cycles === best ? <span className="pl-best">fewest</span> : x.s.beyond ? <span className="pl-muted">beyond the course</span> : null) },
  ]
  const details: { value: Detail; label: string }[] = [
    { value: 'score', label: 'Scoreboard' },
    ...(hasBranch ? [{ value: 'slot' as const, label: 'Delay slot candidates' }] : []),
    { value: 'run', label: 'This run' },
    { value: 'rules', label: 'Course rules' },
  ]
  const detail = (tab: Detail): ReactNode =>
    tab === 'score' ? (
      ok ? (
        <>
          <DataTable columns={cols} rows={traces} compact />
          <p className="pl-muted pl-gap-top">Every row uses the same code, run settings and forwarding choice.</p>
        </>
      ) : (
        <p className="pl-err">Fix the code to compare strategies.</p>
      )
    ) : tab === 'slot' ? (
      ok ? <SlotCandidates t={traces.find((x) => x.s.id === 'delay')!.t} /> : null
    ) : tab === 'run' ? (
      <dl className="pl-facts">
        <div>
          <dt>Branches executed</dt>
          <dd className="mono">{branches.length}</dd>
        </div>
        <div>
          <dt>Taken / not taken</dt>
          <dd className="mono">
            {taken} / {branches.length - taken}
          </dd>
        </div>
        <div>
          <dt>Instructions (I), ideal I + 4</dt>
          <dd className="mono">
            {p.trace.totals.instructions}, <W e={p.trace.totals.why.ideal}>{p.trace.totals.ideal}</W>
          </dd>
        </div>
      </dl>
    ) : (
      <div className="pl-notes">
        <Callout kind="trap" title="No branch handling is not predict not taken" cite="L21 p31, p40-42; AY23/24 S1 Q5 key D">
          With no handling, wrong-path instructions would run and give wrong results. Predict not taken flushes them when the branch is taken.
        </Callout>
        <Callout kind="trap" title="The early branch needs its operands early" cite="L21 p37-39">
          After an ALU instruction right before the branch, add 1 stall (ALU to ID). After a lw right before it, add 2 (MEM to ID): 3 in total with no prediction, no better than deciding in MEM.
        </Callout>
        <Callout kind="course" title="Delay slot size" cite="L21 p46">
          The course uses one delay slot with the early branch. The slot runs whatever the outcome.
        </Callout>
        <Notes notes={p.trace.notes} />
      </div>
    )
  return (
    <Workspace title="Pipeline" lectures="L20 to L21, T10, R11" intro={intro} toolbar={<PresetPicker p={p} />}>
      <Setup p={p} only={['forwarding', 'jumpStage', 'storeData']} />
      <Board
        className="pl-board"
        label="One code, each way of handling branches"
        title="Branch handling"
        step={ok ? plural(cur.t.totals.cycles, 'cycle') : undefined}
        tools={<Toggle label="Add predict taken (beyond the course)" checked={withTaken} onChange={setWithTaken} />}
        foot={ok ? <GridLegend forwarding={cur.t.options.forwarding} /> : null}
      >
        {ok ? (
          <>
            <div className="pl-picks" role="group" aria-label="Pick a strategy">
              {traces.map(({ s, t }) => (
                <button key={s.id} type="button" className="pl-pick" aria-pressed={s.id === cur.s.id} onClick={() => setPick(s.id)}>
                  <span>{s.label}</span>
                  <span className="mono pl-pick-n">{t.totals.cycles}</span>
                  {t.totals.cycles === best ? <span className="pl-best">fewest</span> : null}
                </button>
              ))}
            </div>
            <p className="pl-board-note">
              {cur.s.mechanism.rule} ({cur.s.mechanism.cite}).
            </p>
            <PipelineGrid key={cur.s.id} trace={cur.t} label={`${cur.s.label} pipeline diagram`} />
          </>
        ) : (
          <p className="pl-pad pl-err">Fix the code to compare strategies.</p>
        )}
      </Board>
      <Details urlKey="pdb" label="Tables for this code" tabs={details.map((x) => ({ ...x, body: detail(x.value) }))} />
    </Workspace>
  )
}
