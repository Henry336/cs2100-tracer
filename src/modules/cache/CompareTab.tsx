import { memo, useMemo, type ReactNode } from 'react'
import { fmtBytes, isPow2, simulate, type Frame, type Trace } from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Panel, Segmented, Tabs, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { ResultChip, typeOf, type LabelView } from './SimulatorTab'
import { BoardPlay, CommandBar, ConfigBar, Errors, Setup, TracePresets, W, accessText, plural, type Input } from './common'
import { toConfig } from './presets'

const orgName = (w: number | 'full') => (w === 1 ? 'Direct mapped' : w === 'full' ? 'Fully associative' : `${w}-way`)

const WINDOW = 30

type DetailTab = 'table' | 'obs' | 'notes'

const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: 'table', label: 'Access by access' },
  { value: 'obs', label: 'L23 p28 observations' },
  { value: 'notes', label: 'Rules and traps' },
]

type RunList = { ways: number | 'full'; trace: Trace }[]

export default function CompareTab({ intro, input }: { intro: ReactNode; input: Input }) {
  const [view, setView] = useUrlState<LabelView>('lv', 'r12')
  const [rawDetail, setDetail] = useUrlState<DetailTab>('xt', 'table')
  const detail: DetailTab = DETAIL_TABS.some((t) => t.value === rawDetail) ? rawDetail : 'table'
  const lv: LabelView = view === 'l23' ? 'l23' : 'r12'
  const { cache, block } = input.cfg
  const blocks = isPow2(cache) && isPow2(block) && cache >= block ? cache / block : 1
  const orgs = useMemo(() => {
    const ways: (number | 'full')[] = [1]
    for (let w = 2; w <= 8 && w < blocks; w *= 2) ways.push(w)
    if (blocks > 1) ways.push('full')
    return ways
  }, [blocks])
  const runs = useMemo(() => {
    const out: RunList = []
    for (const ways of orgs) {
      const r = simulate(toConfig({ ...input.cfg, ways }), input.accesses)
      if (!r.ok) return { ok: false as const, errors: r.errors }
      out.push({ ways, trace: r.value })
    }
    return { ok: true as const, runs: out }
  }, [orgs, input.cfg, input.accesses])
  // Rule of thumb (L23 p16): direct mapped of size N against 2-way of size N/2, same blocks.
  const half = useMemo(() => {
    if (blocks < 4) return null
    const r = simulate(toConfig({ ...input.cfg, cache: cache / 2, ways: 2 }), input.accesses)
    return r.ok ? r.value.summary.misses : null
  }, [blocks, cache, input.cfg, input.accesses])
  const n = runs.ok ? runs.runs[0].trace.frames.length : 0
  const stepper = useStepper(n)
  const i = stepper.index
  const first = runs.ok ? runs.runs[0].trace.frames[i] : undefined

  return (
    <Workspace
      title="Cache"
      lectures="L23 p14-16, p28, p32-37, T11 Q1, R12 p26"
      intro={intro}
      toolbar={<TracePresets input={input} onPick={stepper.first} />}
      transport={runs.ok ? <Transport stepper={stepper} label="Access" describe={first ? accessText(first.access) : 'No accesses'} /> : undefined}
    >
      <div className="ca-command-wrap">
        <CommandBar input={input} ways={false} />
        <Setup input={input} rows={5} config={<ConfigBar cfg={input.cfg} setCfg={input.setCfg} core={false} ways={false} />} />
      </div>
      {!runs.ok ? (
        <Panel title="Cannot simulate">
          <Errors list={runs.errors} />
        </Panel>
      ) : (
        <>
          <div className="ca-board canvas">
            <div className="ca-board-bar">
              <p className="ca-board-title">
                {first ? (
                  <>
                    <span className="mono">{accessText(first.access)}</span>
                    <span className="ca-board-step">
                      Access {first.index + 1} of {n}
                    </span>
                  </>
                ) : (
                  'The trace has no accesses'
                )}
              </p>
              <Segmented
                label="Miss labels"
                value={lv}
                options={[
                  { value: 'r12', label: 'R12' },
                  { value: 'l23', label: 'L23 p28' },
                ]}
                onChange={setView}
              />
            </div>
            <p className="ca-board-sub ca-muted">Same cache and block size in every row (L23 p28).</p>
            <div className="ca-bars">
              {runs.runs.map((r) => (
                <Strip key={String(r.ways)} name={orgName(r.ways)} trace={r.trace} lv={lv} index={i} />
              ))}
            </div>
            <BoardPlay stepper={stepper} start="Run the trace on every cache" />
            <div className="ca-board-foot">
              <ul className="ca-key" aria-label="Strip key">
                <li>
                  <span className="ca-sw ca-b-hit" aria-hidden="true" /> hit
                </li>
                <li>
                  <span className="ca-sw ca-b-cold" aria-hidden="true" /> cold miss
                </li>
                <li>
                  <span className="ca-sw ca-b-conflict" aria-hidden="true" /> conflict miss
                </li>
                <li>
                  <span className="ca-sw ca-b-capacity" aria-hidden="true" /> capacity miss
                </li>
                <li>
                  <span className="ca-sw ca-b-now" aria-hidden="true" /> this access
                </li>
              </ul>
            </div>
          </div>
          <section className="ca-details" aria-label="Tables for this comparison">
            <Tabs label="Tables" value={detail} onChange={setDetail} tabs={DETAIL_TABS} />
            <div className="ca-detail-body">
              {detail === 'table' ? <Table runs={runs.runs} index={i} go={stepper.set} lv={lv} /> : null}
              {detail === 'obs' ? <Observations runs={runs.runs} /> : null}
              {detail === 'notes' ? <Rules runs={runs.runs} half={half === null ? null : { bytes: cache / 2, misses: half }} /> : null}
            </div>
          </section>
        </>
      )}
    </Workspace>
  )
}

const countsOf = (t: Trace, lv: LabelView) =>
  lv === 'r12' ? t.summary.missTypes : { cold: t.summary.threeC.cold, conflict: t.summary.threeC.conflict, capacity: t.summary.threeC.capacity }

type Kind = 'hit' | 'cold' | 'conflict' | 'capacity'

/** One row per organisation: every access as a cell in trace order, so columns line up across caches. */
function Strip({ name, trace, lv, index }: { name: string; trace: Trace; lv: LabelView; index: number }) {
  const s = trace.summary
  const c = countsOf(trace, lv)
  const total = Math.max(1, s.accesses)
  const f = trace.frames[index] as Frame | undefined
  return (
    <div className="ca-bar-row">
      <div className="ca-bar-name">
        <span>{name}</span>
        {f ? <Outcome f={f} lv={lv} /> : null}
        <span className="mono ca-muted ca-bar-rate">
          <W e={s.hitRate.why}>{s.hitRate.text}</W> hits
        </span>
      </div>
      <div className="ca-bar" role="img" aria-label={`${name}: ${s.hits} hits, ${c.cold} cold, ${c.conflict} conflict, ${c.capacity} capacity misses`}>
        <StripCells frames={trace.frames} lv={lv} />
        <span className="ca-bar-future" style={{ left: `${(100 * (index + 1)) / total}%` }} />
        <span className="ca-bar-now" style={{ left: `${(100 * index) / total}%`, width: `max(3px, ${100 / total}%)` }} />
      </div>
      <p className="ca-bar-text mono">
        {s.misses} miss{s.misses === 1 ? '' : 'es'}: cold {c.cold}, conflict {c.conflict}, capacity {lv === 'l23' ? <W e={s.threeC.why}>{c.capacity}</W> : c.capacity}
      </p>
    </div>
  )
}

/** Runs of equal outcomes merged into one rect, so long loop traces stay light. Independent of the step. */
const StripCells = memo(function StripCells({ frames, lv }: { frames: Frame[]; lv: LabelView }) {
  const runs: { x: number; w: number; k: Kind }[] = []
  frames.forEach((f, x) => {
    const k: Kind = f.hit ? 'hit' : (typeOf(f, lv) ?? 'conflict')
    const last = runs[runs.length - 1]
    if (last && last.k === k) last.w++
    else runs.push({ x, w: 1, k })
  })
  const n = Math.max(1, frames.length)
  return (
    <svg className="ca-strip" viewBox={`0 0 ${n} 10`} preserveAspectRatio="none" aria-hidden="true">
      {runs.map((r) =>
        r.k === 'capacity' ? (
          <g key={r.x}>
            <rect x={r.x} y={0} width={r.w} height={10} className="ca-s-cold" />
            <rect x={r.x} y={0} width={r.w} height={5} className="ca-s-conflict" />
          </g>
        ) : (
          <rect key={r.x} x={r.x} y={0} width={r.w} height={10} className={`ca-s-${r.k}`} />
        ),
      )}
      {n <= 64 ? Array.from({ length: n - 1 }, (_, k) => <line key={k} x1={k + 1} x2={k + 1} y1={0} y2={10} className="ca-s-gap" />) : null}
    </svg>
  )
})

function Table({ runs, index, go, lv }: { runs: RunList; index: number; go: (i: number) => void; lv: LabelView }) {
  const frames = runs[0].trace.frames
  const start = frames.length <= WINDOW ? 0 : Math.max(0, Math.min(frames.length - WINDOW, index - WINDOW / 2))
  const rows = frames.slice(start, start + WINDOW).map((f) => f.index)
  const columns: Column<number>[] = [
    {
      key: 'n',
      header: '#',
      align: 'right',
      cell: (k) => (
        <button type="button" className="ca-jump mono" onClick={() => go(k)} aria-label={`Go to access ${k + 1}`}>
          {k + 1}
        </button>
      ),
    },
    { key: 'a', header: 'Access', mono: true, cell: (k) => accessText(frames[k].access) },
    ...runs.map((r) => ({
      key: String(r.ways),
      header: orgName(r.ways),
      cell: (k: number) => <Outcome f={r.trace.frames[k]} lv={lv} />,
    })),
  ]
  return (
    <>
      <DataTable compact columns={columns} rows={rows} rowSignal={(k) => (k === index ? 'path' : undefined)} />
      {frames.length > WINDOW ? (
        <p className="ca-muted">
          Accesses {start + 1} to {start + rows.length} of {frames.length}; the table follows the current step.
        </p>
      ) : null}
    </>
  )
}

function Outcome({ f, lv }: { f: Frame; lv: LabelView }) {
  const t = typeOf(f, lv)
  return (
    <span className="ca-outcome">
      <ResultChip f={f} />
      {t ? <span className="ca-muted">{t}</span> : null}
      {f.victim ? <span className="ca-muted mono">out {f.victim.block}</span> : null}
    </span>
  )
}

function Observations({ runs }: { runs: RunList }) {
  // The L23 p28 observations are about the 3C accounting, so they use those counts whatever the label toggle says.
  const c = runs.map((r) => r.trace.summary.threeC)
  const fa = runs.find((r) => r.ways === 'full')
  const obs: { n: number; ok: boolean; text: string; why: string }[] = [
    { n: 1, ok: c.every((x) => x.cold === c[0].cold), text: `Cold misses stay at ${c[0].cold} whatever the associativity.`, why: '' },
    {
      n: 2,
      ok: c.every((x, k) => k === 0 || x.conflict <= c[k - 1].conflict),
      text: 'Conflict misses go down as the ways go up.',
      why: ' This is a trend, and some traces break it.',
    },
    ...(fa ? [{ n: 3, ok: fa.trace.summary.threeC.conflict === 0, text: 'The fully associative cache has no conflict misses.', why: '' }] : []),
    {
      n: 4,
      ok: c.every((x) => x.capacity === c[0].capacity),
      text: 'Capacity misses stay the same at this size.',
      why: ' A smaller set kept a block that the fully associative LRU cache dropped.',
    },
  ]
  const missFalls = runs.every((r, k) => k === 0 || r.trace.summary.misses <= runs[k - 1].trace.summary.misses)
  return (
    <>
      <ul className="ca-checks">
        {obs.map((o) => (
          <li key={o.n}>
            <Chip signal={o.ok ? 'hit' : 'miss'}>{o.ok ? 'holds' : 'not here'}</Chip> {o.n}. {o.text}
            {o.ok ? '' : o.why}
          </li>
        ))}
        <li>5. Capacity misses fall as the cache grows. Change the cache size to see it.</li>
        <li>
          <Chip signal={missFalls ? 'hit' : 'miss'}>{missFalls ? 'holds' : 'not here'}</Chip> Total misses never rise with more ways
          {missFalls ? '.' : '. More ways do not always help (L23 p34).'}
        </li>
      </ul>
      <p className="ca-muted">Counted in the L23 p28 view, whichever labels the strips use.</p>
    </>
  )
}

function Rules({ runs, half }: { runs: RunList; half: { bytes: number; misses: number } | null }) {
  return (
    <div className="ca-callouts">
      <Callout kind="course" title="Rule of thumb" cite="L23 p16; R12 p26; AY25/26 Q5">
        A direct mapped cache of size N has about the same miss rate as a 2-way set associative cache of size N/2. It does not extend to 4-way of size N/4.
        {half ? (
          <>
            {' '}
            On this trace: direct mapped {fmtBytes(half.bytes * 2)}, {plural(runs[0].trace.summary.misses, 'miss', 'misses')}; 2-way {fmtBytes(half.bytes)},{' '}
            {plural(half.misses, 'miss', 'misses')}.
          </>
        ) : null}
      </Callout>
      <Callout kind="trap" title="More ways is not always better" cite="L23 p32-34">
        On the L23 p32-34 trace, 2-way gives 7 misses, the same as direct mapped.
      </Callout>
      <Callout kind="trap" title="More ways cost hit time" cite="L23 p13, p25; AY25/26 Q5 option D">
        Every way's tag is compared in parallel, so higher associativity does not lower the hit time.
      </Callout>
      <Callout kind="course" title="Two ways to name a repeat miss" cite="R12 p23-25; L23 p28">
        R12: a repeat miss is conflict in DM and set associative caches, capacity in FA. L23 p28: capacity if an equal-size FA LRU cache also misses, otherwise conflict. No key says which a paper wants, so the app defaults to R12.
      </Callout>
    </div>
  )
}
