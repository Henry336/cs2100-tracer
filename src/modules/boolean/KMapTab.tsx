import { useMemo, type ReactNode } from 'react'
import { canonical, MAX_MIN_VARS, minimize, traceKMap, type KMapFrame, type KMapTrace, type Minimization } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Panel, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper, type Stepper } from '../../ui/stepper'
import { cycleCell, FnPresets, FunctionFields, MapControls, plural, W, type FnInput } from './common'
import { KMapSvg, type LoopDraw } from './KMapSvg'

const STAGES: { label: string; phases: KMapFrame['phase'][] }[] = [
  { label: 'Fill the map', phases: ['fill'] },
  { label: '1. All PIs', phases: ['prime', 'not-prime'] },
  { label: '2. EPIs', phases: ['count', 'essential'] },
  { label: '3. Cover the rest', phases: ['leftover', 'cover'] },
  { label: '4. Result', phases: ['answer'] },
]

export function frameLoops(trace: KMapTrace, f: KMapFrame): LoopDraw[] {
  const loops: LoopDraw[] = f.loops.map((l) => ({
    key: `p${l.prime}`,
    pieces: trace.primes[l.prime].pieces ?? [],
    style: l.role,
    label: l.role === 'faded' ? undefined : `P${l.prime + 1}`,
  }))
  if (f.ghost !== undefined) loops.push({ key: 'ghost', pieces: trace.dcOnly[f.ghost].pieces ?? [], style: 'ghost' })
  return loops
}

export default function KMapTab({ intro, input }: { intro: ReactNode; input: FnInput }) {
  const [edit, setEdit] = useUrlState<boolean>('edit', false)
  const [idx, setIdx] = useUrlState<boolean>('idx', true)
  const { fn, layout, form, orientation } = input
  const n = fn?.vars.length ?? 0
  const traced = useMemo(() => (fn && layout ? traceKMap(fn, { orientation, form }) : null), [fn, layout, orientation, form])
  const trace = traced?.ok ? traced.trace : null
  // The trace already holds one form's minimisation; only the other form is computed again.
  const both = useMemo(
    () => (fn && trace && n <= MAX_MIN_VARS ? { sop: form === 'sop' ? trace : minimize(fn, 'sop'), pos: form === 'pos' ? trace : minimize(fn, 'pos') } : null),
    [fn, trace, n, form],
  )
  const frames = useMemo(() => trace?.frames ?? [], [trace])
  const stepper = useStepper(frames.length)
  const f = frames[stepper.index] as KMapFrame | undefined
  const marks = useMemo(() => frames.map((x) => (x.phase === 'essential' && x.loops.some((l) => l.role === 'epi') ? 'path' : x.phase === 'answer' ? 'hit' : undefined)), [frames])

  const transport = trace ? <Transport stepper={stepper} label="Step" marks={marks} describe={f?.title} /> : undefined

  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L13 to L16, T06, R07"
      intro={intro}
      toolbar={<FnPresets input={input} onPick={stepper.first} />}
      transport={transport}
      inspector={trace ? <Inspector trace={trace} f={f} stepper={stepper} /> : undefined}
    >
      <Panel title="Function">
        <FunctionFields input={input} />
        <MapControls input={input} />
        <div className="bo-row bo-toggles">
          <Toggle label="Edit by clicking cells (0, 1, X)" checked={edit === true} onChange={setEdit} hint="Each click cycles the cell and rewrites the function as Σm(..) + d(..)" />
          <Toggle label="Show cell numbers" checked={idx !== false} onChange={setIdx} />
        </div>
      </Panel>

      {fn && (n < 2 || n > 5) ? (
        <Callout kind="course" title="K-maps here take 2 to 5 variables" cite="L15 p13-24">
          This function has {plural(n, 'variable')}. The truth table, answer checker and algebra tabs still work. The lecture shows a 6-variable map (L15 p23-24) but no question uses one.
        </Callout>
      ) : null}
      {traced && !traced.ok ? (
        <Callout kind="trap" title="Cannot draw this map">
          {traced.errors.map((e) => e.message).join('; ')}
        </Callout>
      ) : null}

      {trace && f && fn ? (
        <>
          <Panel
            flush
            title={`K-map of ${fn.name}, grouping the ${form === 'sop' ? '1s' : '0s'}`}
            actions={<span className="bo-muted mono">{trace.layout.why.working}</span>}
          >
            <Stages f={f} frames={frames} stepper={stepper} />
            <div className="bo-frame-note">
              <p className="bo-frame-title">{f.title}</p>
              <p>{f.why.rule}</p>
              {f.why.working ? <p className="mono bo-working">{f.why.working}</p> : null}
              {f.why.cite ? <p className="bo-cite">{f.why.cite}</p> : null}
            </div>
            <div className="bo-scroll">
              <KMapSvg
                layout={trace.layout}
                values={trace.values}
                loops={frameLoops(trace, f)}
                focus={f.focus}
                reasons={f.reasons}
                covered={f.phase === 'leftover' ? f.covered : undefined}
                showIndex={idx !== false}
                onCell={edit === true ? (m) => input.setText(cycleCell(fn, m)) : undefined}
                label={`K-map of ${fn.name}: ${f.title}`}
              />
            </div>
            <div className="bo-pad">
              <Legend
                items={[
                  { signal: 'hit', label: '1 (minterm)' },
                  { signal: 'dontcare', label: "X, don't care" },
                  { signal: 'path', label: 'this step: new PI, EPI, ringed cell only one PI covers' },
                ]}
              />
              <p className="bo-muted">
                Solid grey loops are PIs, thick dark loops are the PIs chosen for the cover, dashed loops are left out. A loop cut at the edge wraps
                around to the other side.
              </p>
            </div>
          </Panel>
          <Traps trace={trace} input={input} />
          {both ? <Results both={both} form={form} /> : null}
        </>
      ) : null}
    </Workspace>
  )
}

function Stages({ f, frames, stepper }: { f: KMapFrame; frames: KMapFrame[]; stepper: Stepper }) {
  return (
    <ol className="bo-stages" aria-label="Stages of the K-map method">
      {STAGES.map((s) => {
        const first = frames.findIndex((x) => s.phases.includes(x.phase))
        const on = s.phases.includes(f.phase)
        return (
          <li key={s.label}>
            <button type="button" className={`bo-stage${on ? ' is-on' : ''}`} aria-current={on ? 'step' : undefined} disabled={first < 0} onClick={() => stepper.set(first)}>
              {s.label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Traps({ trace, input }: { trace: KMapTrace; input: FnInput }) {
  const unused = trace.primes.filter((p) => !p.essential && !trace.covers.some((c) => c.primes.includes(p.id)))
  const dcFate = trace.covers[0]?.dcValues ?? []
  return (
    <div className="bo-callouts">
      {trace.dcOnly.length ? (
        <Callout kind="trap" title="A group of only don't-cares is not a PI" cite="L15 p49; T06 Q2(d); AY23/24 S2 Q19; AY24/25 Q17(a)">
          {trace.dcOnly.map((g) => g.term).join(', ')} {trace.dcOnly.length === 1 ? 'covers' : 'cover'} no {trace.form === 'sop' ? 'minterm' : 'maxterm'}, so{' '}
          {trace.dcOnly.length === 1 ? 'it is' : 'they are'} not counted as PIs.
        </Callout>
      ) : null}
      {trace.target.length && !trace.essentials.length ? (
        <Callout kind="trap" title="There are no EPIs" cite="AY23/24 S1 Q17(a); AY21/22 S1 Q5">
          Every cell is covered by at least two PIs, so every answer is a choice. Count {trace.summary.covers.value} minimal covers.
        </Callout>
      ) : trace.leftover.length ? (
        <Callout kind="trap" title="EPIs alone do not cover the map" cite="L15 p38; AY23/24 S1 Q7(iv)">
          After the {plural(trace.essentials.length, 'EPI')}, {trace.leftover.map((m) => (trace.form === 'sop' ? 'm' : 'M') + m).join(', ')} still need a PI.
        </Callout>
      ) : null}
      {unused.length ? (
        <Callout kind="trap" title="A PI can still be unnecessary" cite="L15 p42; R07 p41">
          {unused.map((p) => p.term).join(', ')} {unused.length === 1 ? 'is a PI but is' : 'are PIs but are'} in no minimal cover: the other PIs already cover
          {unused.length === 1 ? ' its' : ' their'} cells.
        </Callout>
      ) : null}
      {dcFate.length ? (
        <Callout kind="trap" title="Don't-cares are fixed once the circuit is built" cite="T06 Q4(d)">
          The first answer outputs {dcFate.map((d) => `${d.value} on m${d.cell}`).join(', ')}.
        </Callout>
      ) : null}
      {trace.layout.n === 5 ? (
        <Callout kind="course" title="Five variables: two 4-variable maps" cite="L15 p21-22">
          The left map has {input.fn?.vars[0]} = 0 and the right map {input.fn?.vars[0]} = 1. Cells in the same place on the two maps are neighbours, so a group can sit
          on both.
        </Callout>
      ) : null}
      <Callout kind="course" title="Slides and keys draw the map differently" cite="L15 p19, p33; R07 p31, p43; T06 Q3">
        The tutorial and exam keys put the first variables on the rows; the A,B,C,D examples in L15 p32-55 put them on the columns; T06 Q3 mixes them. The cell
        numbers follow the variable order either way, so read the labels before you copy a map.
      </Callout>
    </div>
  )
}

function Results({ both, form }: { both: { sop: Minimization; pos: Minimization }; form: 'sop' | 'pos' }) {
  const c = canonical(both.sop.fn)
  const cur = form === 'sop' ? both.sop : both.pos
  const s = cur.summary
  const name = both.sop.fn.name
  const dc = both.sop.fn.dc
  const answers = [
    ...both.sop.covers.slice(0, 4).map((cv, i) => ({ key: `s${i}`, head: `SOP ${i + 1}`, title: cv.text, cv })),
    ...both.pos.covers.slice(0, 4).map((cv, i) => ({ key: `p${i}`, head: `POS ${i + 1}`, title: cv.text, cv })),
  ]
  const dcFate = dc.length
    ? {
        rows: dc,
        cols: [
          { key: 'm', header: 'Row', cell: (m: number) => `m${m}`, mono: true },
          ...answers.map((a) => ({
            key: a.key,
            header: <span title={a.title}>{a.head}</span>,
            align: 'center' as const,
            mono: true,
            cell: (m: number) => a.cv.dcValues.find((d) => d.cell === m)?.value ?? '',
          })),
        ] as Column<number>[],
      }
    : null
  return (
    <Panel title="Result">
      <dl className="bo-facts">
        <dt>Minimal SOP</dt>
        <dd>
          <span className="mono">
            {name} = <W e={both.sop.summary.covers.why}>{both.sop.summary.answer}</W>
          </span>
          {both.sop.summary.covers.value > 1 ? <span className="bo-muted"> one of {both.sop.summary.covers.value}{both.sop.summary.covers.exact === false ? '+' : ''}</span> : null}
        </dd>
        <dt>Minimal POS</dt>
        <dd>
          <span className="mono">
            {name} = <W e={both.pos.summary.covers.why}>{both.pos.summary.answer}</W>
          </span>
          {both.pos.summary.covers.value > 1 ? <span className="bo-muted"> one of {both.pos.summary.covers.value}{both.pos.summary.covers.exact === false ? '+' : ''}</span> : null}
        </dd>
        <dt>Fill in the blank</dt>
        <dd className="mono">
          {both.sop.summary.fitb}
          <span className="bo-muted"> SOP, EPIs first</span>
          <br />
          {both.pos.summary.fitb}
          <span className="bo-muted"> POS</span>
        </dd>
        <dt>Canonical</dt>
        <dd className="mono">
          <W e={c.why.sigma}>{c.sigma}</W>
          <br />
          <W e={c.why.pi}>{c.pi}</W>
        </dd>
        {dcFate ? (
          <>
            <dt>What the X rows output</dt>
            <dd>
              <DataTable compact columns={dcFate.cols} rows={dcFate.rows} />
            </dd>
          </>
        ) : null}
        <dt>Counts ({form === 'sop' ? 'grouping 1s' : 'grouping 0s'})</dt>
        <dd>
          <W e={s.implicants.why}>{plural(s.implicants.value, 'implicant')}</W>, <W e={s.primes.why}>{plural(s.primes.value, 'PI')}</W>,{' '}
          <W e={s.essentials.why}>{plural(s.essentials.value, 'EPI')}</W>,{' '}
          <W e={s.covers.why}>
            {s.covers.exact === false ? 'at least ' : ''}
            {plural(s.covers.value, 'minimal answer')}
          </W>
          , {plural(s.terms, 'term')} and {plural(s.literals, 'literal')}
        </dd>
      </dl>
    </Panel>
  )
}

function Inspector({ trace, f, stepper }: { trace: KMapTrace; f?: KMapFrame; stepper: Stepper }) {
  const p = trace.form === 'sop' ? 'm' : 'M'
  const active = new Set(f?.loops.filter((l) => l.role === 'new' || l.role === 'epi' || l.role === 'chosen').map((l) => l.prime))
  const piCols: Column<KMapTrace['primes'][number]>[] = [
    { key: 'id', header: 'PI', cell: (q) => `P${q.id + 1}`, mono: true },
    ...(trace.form === 'pos'
      ? [{ key: 'comp', header: `In ${trace.fn.name}'`, cell: (q: KMapTrace['primes'][number]) => q.complementTerm ?? '', mono: true }]
      : []),
    { key: 'term', header: trace.form === 'pos' ? 'DeMorgan' : 'Term', cell: (q) => <W e={q.why}>{q.term}</W>, mono: true },
    { key: 'cells', header: 'Covers', cell: (q) => q.cells.join(',') + (q.dontCares.length ? ` X${q.dontCares.join(',')}` : ''), mono: true },
    { key: 'lit', header: 'Lits', cell: (q) => q.literals, align: 'right' },
    {
      key: 'st',
      header: 'Status',
      cell: (q) => (
        <W e={q.status}>
          {q.essential ? (
            <Chip signal="path">EPI via {q.reasons.map((r) => p + r).join(',')}</Chip>
          ) : (
            <span className="bo-muted">PI</span>
          )}
        </W>
      ),
    },
  ]
  const chartCols: Column<KMapTrace['primes'][number]>[] = [
    { key: 'id', header: 'PI', cell: (q) => `P${q.id + 1}`, mono: true },
    ...trace.target.map((m) => {
      const by = trace.coveredBy.find((x) => x.cell === m)?.primes ?? []
      return {
        key: `c${m}`,
        header: <span className={by.length === 1 ? 'bo-only' : undefined}>{p + m}</span>,
        align: 'center' as const,
        cell: (q: KMapTrace['primes'][number]) => (q.cells.includes(m) ? <span className={by.length === 1 ? 'bo-only' : undefined}>{by.length === 1 ? '◉' : '●'}</span> : ''),
      }
    }),
    ...trace.fn.dc.map((m) => ({
      key: `d${m}`,
      header: <span className="bo-dccol">X{m}</span>,
      align: 'center' as const,
      cell: (q: KMapTrace['primes'][number]) => (q.dontCares.includes(m) ? <span className="bo-dccol">○</span> : ''),
    })),
  ]
  // After the EPIs: the PIs left and the cells they still have to cover (R07 p40; T06 Ans p5).
  const rest = trace.primes.filter((q) => !q.essential && q.cells.some((m) => trace.leftover.includes(m)))
  const restCols: Column<KMapTrace['primes'][number]>[] = [
    { key: 'id', header: 'PI', cell: (q) => `P${q.id + 1}`, mono: true },
    { key: 'term', header: 'Term', cell: (q) => q.term, mono: true },
    ...trace.leftover.map((m) => ({
      key: `c${m}`,
      header: p + m,
      align: 'center' as const,
      cell: (q: KMapTrace['primes'][number]) => (q.cells.includes(m) ? '●' : ''),
    })),
  ]
  const jump = (i: number) => {
    const at = trace.frames.findIndex((x) => (x.phase === 'cover' || x.phase === 'answer') && x.cover === i)
    if (at >= 0) stepper.set(at)
  }
  return (
    <>
      <Panel flush title={`Prime implicants (${trace.primes.length})`}>
        {trace.primes.length ? (
          <DataTable compact columns={piCols} rows={trace.primes} rowSignal={(q) => (active.has(q.id) ? 'path' : undefined)} />
        ) : (
          <p className="bo-pad bo-muted">No {trace.form === 'sop' ? '1s' : '0s'} to group.</p>
        )}
      </Panel>
      {trace.primes.length ? (
        <Panel flush title="Cover chart">
          <DataTable compact columns={chartCols} rows={trace.primes} rowSignal={(q) => (active.has(q.id) ? 'path' : undefined)} />
          <p className="bo-pad bo-muted">
            ◉ marks a cell with exactly one PI over it; that PI is essential (L15 p36; R07 p36). Only the {trace.form === 'sop' ? 'minterm' : 'maxterm'} columns
            decide this; the greyed X columns never make a PI essential (T06 Ans p5).
          </p>
        </Panel>
      ) : null}
      {trace.leftover.length ? (
        <Panel flush title="Left after the EPIs">
          <DataTable compact columns={restCols} rows={rest} />
          <p className="bo-pad bo-muted">
            Pick the fewest of these PIs that cover every column, then the fewest literals (L15 p38).
          </p>
        </Panel>
      ) : null}
      <Panel
        title={
          <W e={trace.summary.covers.why}>
            {trace.summary.covers.exact === false ? 'At least ' : ''}
            {plural(trace.summary.covers.value, 'minimal answer')}
          </W>
        }
      >
        <ol className="bo-covers">
          {trace.covers.map((c, i) => (
            <li key={i} className={f?.cover === i ? 'is-on' : undefined}>
              <button type="button" className="bo-linkbtn mono" onClick={() => jump(i)}>
                {c.text}
              </button>
              <span className="bo-muted">
                {' '}
                {plural(c.terms, 'term')}, {plural(c.literals, 'literal')}
              </span>
              <span className="mono bo-fitb">{c.fitb}</span>
              {c.complementText ? <span className="mono bo-muted">{trace.fn.name}' = {c.complementText}</span> : null}
              {c.dcValues.length ? <span className="bo-muted">X become {c.dcValues.map((d) => `m${d.cell}=${d.value}`).join(', ')}</span> : null}
            </li>
          ))}
        </ol>
        {trace.summary.covers.value > trace.covers.length ? <p className="bo-muted">Only the first {trace.covers.length} are listed.</p> : null}
      </Panel>
    </>
  )
}
