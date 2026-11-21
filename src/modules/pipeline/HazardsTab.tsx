// Tab 3: RAW / WAR / WAW classifier, with a timeline of when each instruction reads and writes.
import type { ReactNode } from 'react'
import { regLabel, STAGES, type Dependency, type InstrResult, type PipelineTrace, type Stage } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, DataTable, Legend, NumberField, Workspace, type Column } from '../../ui/kit'
import { Board, Notes, PresetPicker, Setup, Strip, W, plural, type ProgramState } from './common'

const KIND_TEXT: Record<Dependency['kind'], string> = {
  RAW: 'Read after write: a true dependency',
  WAR: 'Write after read: a name clash',
  WAW: 'Write after write: a name clash',
}

/** When the reader takes the value: ID from the register file, or the stage it is forwarded into. */
function readCycle(reader: InstrResult, reg: number): { cycle: number; stage: Stage; how: string } {
  const op = reader.operands.find((o) => o.register === reg)
  if (op && op.forward.from !== 'register file') return { cycle: op.forward.cycle, stage: op.forward.to, how: op.forward.path }
  return { cycle: reader.stages.ID, stage: 'ID', how: 'register file, second half of ID' }
}

function Timeline({ t, d, shift }: { t: PipelineTrace; d: Dependency; shift: number }) {
  const by = new Map(t.instructions.map((i) => [i.seq, i]))
  const a = by.get(d.from)
  const b = by.get(d.to)
  if (!a || !b) return null
  const rl = regLabel(d.register, t.stream.regStyle)
  const first = a.stages.IF
  const last = Math.max(a.stages.WB, b.stages.WB)
  const cols = last - first + 1
  const cw = 40
  const lw = 160
  const rh = 30
  const x = (c: number) => lw + (c - first) * cw
  // Marks: who reads and who writes the register, and in which cycle.
  const marks: { row: 0 | 1; cycle: number; text: string; ghost?: boolean }[] = []
  if (d.kind === 'RAW') {
    marks.push({ row: 0, cycle: a.stages.WB, text: `writes ${rl}` })
    const r = readCycle(b, d.register)
    marks.push({ row: 1, cycle: r.cycle, text: `uses ${rl}` })
  } else if (d.kind === 'WAR') {
    marks.push({ row: 0, cycle: a.stages.ID, text: `reads ${rl}` })
    marks.push({ row: 1, cycle: b.stages.WB, text: `writes ${rl}` })
    if (shift) marks.push({ row: 1, cycle: b.stages.WB - shift, text: 'what-if write', ghost: true })
  } else {
    marks.push({ row: 0, cycle: a.stages.WB, text: `writes ${rl}` })
    marks.push({ row: 1, cycle: b.stages.WB, text: `writes ${rl}` })
    if (shift) marks.push({ row: 1, cycle: b.stages.WB - shift, text: 'what-if write', ghost: true })
  }
  const W = lw + cols * cw + 60
  const H = 2 * rh + 58
  return (
    <div className="pl-dp-scroll">
      <svg className="pl-tl" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${d.kind} timeline: ${marks.map((m) => `${m.row ? b.name : a.name} ${m.text} in cycle ${m.cycle}`).join('; ')}`}>
        {Array.from({ length: cols }, (_, k) => (
          <text key={k} x={x(first + k) + cw / 2} y={14} textAnchor="middle" className="pl-tl-head">
            {first + k}
          </text>
        ))}
        {[a, b].map((ins, row) => (
          <g key={ins.uid} transform={`translate(0 ${22 + row * (rh + 14)})`}>
            <text x={4} y={rh / 2 + 4} className="pl-tl-name">
              {ins.name} {ins.text.length > 17 ? `${ins.text.slice(0, 16)}...` : ins.text}
            </text>
            {STAGES.map((s, k) => {
              const c = ins.stages[s]
              const prev = k ? ins.stages[STAGES[k - 1]] : undefined
              return (
                <g key={s}>
                  {prev !== undefined
                    ? Array.from({ length: Math.max(0, c - prev - 1) }, (_, j) => <rect key={j} x={x(prev + 1 + j) + 1} y={1} width={cw - 2} height={rh - 2} className="pl-tl-stall" />)
                    : null}
                  <rect x={x(c) + 1} y={1} width={cw - 2} height={rh - 2} className="pl-tl-cell" />
                  <text x={x(c) + cw / 2} y={rh / 2 + 4} textAnchor="middle" className="pl-tl-stage">
                    {s}
                  </text>
                </g>
              )
            })}
            {marks
              .filter((m) => m.row === row)
              .map((m, k) => (
                <g key={k}>
                  <rect x={x(m.cycle) + 1} y={1} width={cw - 2} height={rh - 2} className={m.ghost ? 'pl-tl-ghost' : 'pl-tl-mark'} />
                  <text x={x(m.cycle) + cw / 2} y={rh + 11} textAnchor="middle" className={m.ghost ? 'pl-tl-ghosttext' : 'pl-tl-marktext'}>
                    {m.text}
                  </text>
                </g>
              ))}
          </g>
        ))}
        {/* The read and write cells draw themselves in when a dependency is picked. */}
        <g className="flow-draw" key={`${d.kind}${d.from}-${d.to}-${d.register}`} aria-hidden="true">
          {marks
            .filter((m) => !m.ghost)
            .map((m, k) => {
              const y = 22 + m.row * (rh + 14) + 1
              return <path key={k} d={`M${x(m.cycle) + 1} ${y}h${cw - 2}v${rh - 2}h${2 - cw}Z`} pathLength={1} className="pl-flow-data" />
            })}
        </g>
      </svg>
    </div>
  )
}

function Verdict({ t, d, shift }: { t: PipelineTrace; d: Dependency; shift: number }) {
  const by = new Map(t.instructions.map((i) => [i.seq, i]))
  const a = by.get(d.from)!
  const b = by.get(d.to)!
  const rl = regLabel(d.register, t.stream.regStyle)
  if (d.kind === 'RAW') {
    const r = readCycle(b, d.register)
    return (
      <p>
        {b.name} needs {rl} in {r.stage} (cycle {r.cycle}, via {r.how}). {d.stalls ? `${a.name}'s value is not ready that early` : `${a.name}'s value is ready by then`}, so{' '}
        <W e={d.why}>
          <strong>{d.stalls ? plural(d.stalls, 'stall cycle') : 'no stall'}</strong>
        </W>
        . Only RAW can stall: the reader genuinely needs a value that does not exist yet.
      </p>
    )
  }
  const moved = b.stages.WB - shift
  if (d.kind === 'WAR') {
    const broken = moved <= a.stages.ID
    return (
      <>
        <p>
          {a.name} reads {rl} in ID, cycle {a.stages.ID} (stage 2). {b.name} writes it in WB, cycle {b.stages.WB} (stage 5). In this pipeline every read is in stage 2 and every write in stage 5, in program order, so the write can never come first:{' '}
          <W e={d.why}>
            <strong>no stall</strong>
          </W>
          .
        </p>
        {shift ? (
          <p className={broken ? 'pl-bad' : ''}>
            What-if: with the write in cycle {moved}, {broken ? `${a.name} would read the new value of ${rl}, which is wrong.` : `${a.name} still reads first, so the result is still right.`}
          </p>
        ) : null}
      </>
    )
  }
  const broken = moved < a.stages.WB
  return (
    <>
      <p>
        Both write {rl} in WB: {a.name} in cycle {a.stages.WB}, {b.name} in cycle {b.stages.WB}. WB happens in program order, so {b.name}'s value is the one that stays:{' '}
        <W e={d.why}>
          <strong>no stall</strong>
        </W>
        .
      </p>
      {shift ? (
        <p className={broken ? 'pl-bad' : ''}>
          What-if: with {b.name}'s write in cycle {moved}, {broken ? `${a.name} would write last and leave the wrong value in ${rl}.` : `${b.name} still writes last, so the final value is still right.`}
        </p>
      ) : null}
    </>
  )
}

type Detail = 'deps' | 'counts' | 'rules'

const DETAILS: { value: Detail; label: string }[] = [
  { value: 'deps', label: 'All dependencies' },
  { value: 'counts', label: 'Counts' },
  { value: 'rules', label: 'Course rules' },
]

export default function HazardsTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const t = p.trace
  const [sel, setSel] = useUrlState('dep', 0)
  const [shift, setShift] = useUrlState('wif', 0)
  const deps = t.dependencies
  const by = new Map(t.instructions.map((i) => [i.seq, i]))
  const name = (seq: number) => by.get(seq)?.name ?? String(seq)
  const d = deps[Math.min(sel, deps.length - 1)]
  // The what-if write may move back at most to the first instruction's fetch.
  const maxShift = d ? Math.max(0, (by.get(d.to)?.stages.WB ?? 0) - (by.get(d.from)?.stages.IF ?? 0)) : 0
  const wif = d && d.kind !== 'RAW' ? Math.min(shift, maxShift) : 0
  const rl = (r: number) => regLabel(r, t.stream.regStyle)
  const count = (k: Dependency['kind']) => deps.filter((x) => x.kind === k).length
  const cols: Column<Dependency>[] = [
    { key: 'k', header: 'Kind', cell: (x) => <span className={`pl-kind pl-kind-${x.kind.toLowerCase()}`}>{x.kind}</span> },
    { key: 'p', header: 'Pair', cell: (x) => `${name(x.from)} to ${name(x.to)}`, mono: true },
    { key: 'r', header: 'Register', cell: (x) => rl(x.register), mono: true },
    { key: 'd', header: 'Distance', cell: (x) => x.distance, align: 'right' },
    {
      key: 's',
      header: 'Stalls',
      align: 'right',
      cell: (x) => (
        <W e={x.why}>{x.stalls}</W>
      ),
    },
    {
      key: 'v',
      header: 'View',
      cell: (x, i) => (
        <button type="button" className="pl-linkbtn" aria-pressed={x === d} onClick={() => setSel(i)}>
          {x === d ? 'Showing' : 'Show'}
        </button>
      ),
    },
  ]
  return (
    <Workspace title="Pipeline" lectures="L20 to L21, T10, R11" intro={intro} toolbar={<PresetPicker p={p} />}>
      <Setup p={p} />
      <Board
        label="Dependency timeline"
        title={d ? `${name(d.from)} to ${name(d.to)}` : 'Dependencies'}
        step={d ? `${d.kind} on ${rl(d.register)}` : undefined}
        foot={
          d ? (
            <Legend
              items={[
                { signal: 'data', label: 'the cycle the register is read or written' },
                { signal: 'stall', label: 'stall' },
                ...(wif ? [{ signal: 'dontcare' as const, label: 'what-if write (beyond the course)' }] : []),
              ]}
            />
          ) : null
        }
      >
        {!t.ok ? (
          <p className="pl-pad pl-err">Fix the code to classify its dependencies.</p>
        ) : !deps.length ? (
          <p className="pl-board-note">No two instructions share a register, so there are no dependencies.</p>
        ) : (
          <>
            <div className="pl-picks" role="group" aria-label="Pick a dependency">
              {deps.map((x, i) => (
                <button key={i} type="button" className="pl-pick" aria-pressed={x === d} onClick={() => setSel(i)}>
                  <span className={`pl-kind pl-kind-${x.kind.toLowerCase()}`}>{x.kind}</span>
                  <span className="mono">
                    {name(x.from)} to {name(x.to)}, {rl(x.register)}
                  </span>
                </button>
              ))}
            </div>
            {d ? (
              <>
                <p className="pl-board-note">{KIND_TEXT[d.kind]}.</p>
                <Timeline t={t} d={d} shift={wif} />
                <div className="pl-verdict-text">
                  <Verdict t={t} d={d} shift={wif} />
                </div>
                {d.examNote ? <p className="pl-board-note">{d.examNote}</p> : null}
                {d.kind !== 'RAW' ? (
                  <div className="pl-board-extra">
                    <Callout kind="beyond" title="What if instructions could finish out of order" cite={d.beyond?.cite}>
                      <p>{d.beyond?.rule}</p>
                      <div className="pl-row">
                        <NumberField label={`Let ${name(d.to)} write this many cycles earlier`} value={wif} min={0} max={maxShift} onChange={(v) => setShift(Math.max(0, Math.min(maxShift, Math.round(v))))} suffix="cycles" />
                        <Button onClick={() => setShift(0)} disabled={!wif}>
                          Back to in order
                        </Button>
                      </div>
                    </Callout>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </Board>
      <Strip urlKey="pdh" label="Tables for this code" tabs={DETAILS}>
        {(cur) =>
          cur === 'deps' ? (
            deps.length ? (
              <DataTable columns={cols} rows={deps} rowSignal={(x) => (x === d ? 'path' : undefined)} compact caption="Each register against its nearest earlier writer" />
            ) : (
              <p className="pl-muted">No dependencies.</p>
            )
          ) : cur === 'counts' ? (
            <dl className="pl-facts">
              <div>
                <dt>RAW (can stall)</dt>
                <dd className="mono">{count('RAW')}</dd>
              </div>
              <div>
                <dt>WAR (never stalls here)</dt>
                <dd className="mono">{count('WAR')}</dd>
              </div>
              <div>
                <dt>WAW (never stalls here)</dt>
                <dd className="mono">{count('WAW')}</dd>
              </div>
              <div>
                <dt>Stall cycles in this trace</dt>
                <dd className="mono">
                  <W e={t.totals.why.stallCycles}>{t.totals.stallCycles}</W>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="pl-notes">
              <Callout kind="course" title="Only RAW stalls this pipeline" cite="L21 p13-14; R11 p9">
                RAW is the true data dependency. WAR and WAW do not cause hazards in the 5-stage in-order pipeline; they matter only for out-of-order execution.
              </Callout>
              <Callout kind="course" title="The other two hazard types" cite="L21 p5, p7-11, p27">
                Structural: none here, because instruction and data memory are separate and the register file writes in the first half of a cycle and reads in the second. Control: {plural(t.stream.items.filter((i) => i.cls === 'branch' || i.cls === 'jump').length, 'branch or jump', 'branches or jumps')} executed; the Branches tab shows what each one costs.
              </Callout>
              <Callout kind="trap" title="Exam MCQs still say WAW hazard" cite="AY25/26 Q4 key">
                A snippet whose only dependency is WAW on $t2 is answered (E) WAW hazard, though it costs no stall.
              </Callout>
              <Callout kind="trap" title="WAR and WAW still limit reordering" cite="L21 p47; AY23/24 S1 Q12">
                They cost no stall, but you cannot swap the two instructions, for example when filling a delay slot.
              </Callout>
              <Notes notes={t.notes} />
            </div>
          )
        }
      </Strip>
    </Workspace>
  )
}
