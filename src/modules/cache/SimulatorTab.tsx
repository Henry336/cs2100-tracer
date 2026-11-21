import { useMemo, type ReactNode } from 'react'
import { fmtBytes, type Frame, type MissType, type Trace } from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Panel, Segmented, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import {
  AddressBar,
  CacheTable,
  ConfigBar,
  Errors,
  TraceEditor,
  TracePresets,
  W,
  accessText,
  cumulative,
  cursorOf,
  fmtAddr,
  fmtTag,
  plural,
  stateAfter,
  useSim,
  type Input,
  type TagFmt,
} from './common'

export type LabelView = 'r12' | 'l23'

const TYPE_NAME: Record<MissType, string> = { cold: 'cold', conflict: 'conflict', capacity: 'capacity' }

export const typeOf = (f: Frame, view: LabelView): MissType | null => (view === 'r12' ? f.missType : f.missType3C)

export function TypeChip({ type }: { type: MissType | null }) {
  if (!type) return null
  return (
    <Chip signal="miss" title={`${TYPE_NAME[type]} miss`}>
      {TYPE_NAME[type]}
    </Chip>
  )
}

export function ResultChip({ f }: { f: Frame }) {
  return f.hit ? (
    <Chip signal="hit" title="Hit">
      H
    </Chip>
  ) : (
    <Chip signal="miss" title="Miss">
      M
    </Chip>
  )
}

/** Answer tokens: H or M, an M optionally followed by its type ("M(cold)", "M conflict"). */
export function parseAnswer(text: string): { r: 'H' | 'M'; type: MissType | null }[] {
  const out: { r: 'H' | 'M'; type: MissType | null }[] = []
  const re = /([hm])(?:[\s(:-]*(cold|compulsory|conflict|capacity)\)?)?/gi
  for (const m of text.matchAll(re)) {
    const t = m[2]?.toLowerCase()
    out.push({ r: m[1].toUpperCase() as 'H' | 'M', type: !t ? null : t === 'compulsory' ? 'cold' : (t as MissType) })
  }
  return out
}

const WINDOW = 40

export default function SimulatorTab({ intro, input }: { intro: ReactNode; input: Input }) {
  const sim = useSim(input)
  const [tf, setTf] = useUrlState<TagFmt>('tf', 'dec')
  const [byAddr, setByAddr] = useUrlState<boolean>('wa', false)
  const [view, setView] = useUrlState<LabelView>('lv', 'r12')
  const [rawAnswer, setAnswer] = useUrlState<unknown>('a', '')
  const answer = typeof rawAnswer === 'string' ? rawAnswer : ''
  const trace = sim.ok ? sim.value : null
  const frames = trace?.frames ?? []
  const stepper = useStepper(frames.length)
  const f = frames[stepper.index] as Frame | undefined

  const marks = useMemo(() => frames.map((x) => (x.hit ? 'hit' : 'miss')), [frames])
  const tagFmt: TagFmt = tf === 'hex' || tf === 'bin' ? tf : 'dec'
  const lv: LabelView = view === 'l23' ? 'l23' : 'r12'
  const sets = trace ? stateAfter(trace, f) : []
  const validLines = sets.reduce((n, s) => n + s.lines.filter((l) => l.valid).length, 0)

  const transport = trace ? (
    <Transport
      stepper={stepper}
      label="Access"
      marks={marks}
      describe={f ? `${accessText(f.access)}: ${f.hit ? 'hit' : `miss${typeOf(f, lv) ? `, ${typeOf(f, lv)}` : ''}`}` : 'No accesses'}
    />
  ) : undefined

  return (
    <Workspace
      title="Cache"
      lectures="L22 to L23, T11, R12"
      intro={intro}
      toolbar={<TracePresets input={input} onPick={stepper.first} />}
      transport={transport}
      inspector={trace ? <Inspector trace={trace} f={f} lv={lv} tf={tagFmt} index={stepper.index} validLines={validLines} /> : undefined}
    >
      <div className="ca-setup">
        <Panel title="Cache">
          <ConfigBar cfg={input.cfg} setCfg={input.setCfg} />
          {trace ? <Geo trace={trace} /> : null}
        </Panel>
        <Panel title="Trace">
          <TraceEditor input={input} />
        </Panel>
      </div>
      {!sim.ok ? (
        <Panel title="Cannot simulate">
          <Errors list={sim.errors} />
        </Panel>
      ) : null}
      {trace ? (
        <>
          <Panel
            title={f ? `Address of access ${f.index + 1}: ${fmtAddr(f.access.address)}` : 'Address fields'}
            actions={<span className="ca-muted mono">{trace.geometry.config.addressBits}-bit address</span>}
          >
            <AddressBar g={trace.geometry} split={f?.split} />
            {f ? (
              <p className="ca-line">
                Block number <W e={f.split.why.block}>{f.split.block}</W>, word in block <W e={f.split.why.word}>Word{f.split.wordInBlock}</W>.
              </p>
            ) : null}
          </Panel>
          <Panel
            flush
            title="Cache contents"
            actions={
              <div className="ca-actions">
                <Segmented
                  label="Tags in"
                  value={tagFmt}
                  options={[
                    { value: 'dec', label: 'Dec' },
                    { value: 'hex', label: 'Hex', title: '8-digit hex, as auto-graded papers want' },
                    { value: 'bin', label: 'Bin' },
                  ]}
                  onChange={setTf}
                />
                {trace.geometry.ways > 1 ? (
                  <Toggle label="Way 0 holds the lower address" checked={byAddr === true} onChange={setByAddr} hint="Display order asked for in AY23/24 S1 Q20(b)" />
                ) : null}
              </div>
            }
          >
            <CacheTable
              g={trace.geometry}
              sets={sets}
              cur={cursorOf(f)}
              tf={tagFmt}
              byAddr={byAddr === true}
              dirty={trace.geometry.config.writeHit === 'write-back'}
              caption={f ? `After access ${f.index + 1}.` : 'Before the first access.'}
            />
            <div className="ca-pad">
              <Legend
                items={[
                  { signal: 'path', label: 'set looked up now' },
                  { signal: 'data', label: 'word the offset selects' },
                  { signal: 'hit', label: 'hit, valid = 1' },
                  { signal: 'miss', label: 'miss, replaced block' },
                  { signal: 'dirty', label: 'dirty, newer than memory' },
                ]}
              />
            </div>
          </Panel>
          <Results trace={trace} index={stepper.index} go={stepper.set} lv={lv} setView={setView} tf={tagFmt} answer={answer} setAnswer={setAnswer} />
        </>
      ) : null}
    </Workspace>
  )
}

function Geo({ trace }: { trace: Trace }) {
  const g = trace.geometry
  return (
    <p className="ca-geo">
      <span>
        <W e={g.why.blocks}>{plural(g.blocks, 'block')}</W> of {fmtBytes(g.config.blockBytes)}
      </span>
      <span>
        <W e={g.why.sets}>{plural(g.sets, 'set')}</W>
      </span>
      <span>
        offset <W e={g.why.offset}>{g.offsetBits}</W>
      </span>
      <span>
        index <W e={g.why.index}>{g.indexBits}</W>
      </span>
      <span>
        tag <W e={g.why.tag}>{g.tagBits}</W>
      </span>
      <span>
        <W e={g.why.wordsPerBlock}>{plural(g.wordsPerBlock, 'word')}</W> per block
      </span>
    </p>
  )
}

/* ---------- Results and check my answer ---------- */

function Results({
  trace,
  index,
  go,
  lv,
  setView,
  tf,
  answer,
  setAnswer,
}: {
  trace: Trace
  index: number
  go: (i: number) => void
  lv: LabelView
  setView: (v: LabelView) => void
  tf: TagFmt
  answer: string
  setAnswer: (v: string) => void
}) {
  const frames = trace.frames
  const g = trace.geometry
  const typed = useMemo(() => parseAnswer(answer), [answer])
  const checked = typed.length > 0
  const right = (f: Frame) => {
    const t = typed[f.index]
    if (!t) return undefined
    return t.r === f.result && (t.type === null || t.type === typeOf(f, lv))
  }
  // Results re-renders on every step; the score only changes with the answer, trace or labels.
  const score = useMemo(() => (checked ? frames.filter((x) => right(x)).length : 0), [typed, frames, lv]) // eslint-disable-line react-hooks/exhaustive-deps
  const start = frames.length <= WINDOW ? 0 : Math.max(0, Math.min(frames.length - WINDOW, index - WINDOW / 2))
  const rows = frames.slice(start, start + WINDOW)

  const columns: Column<Frame>[] = [
    {
      key: 'n',
      header: '#',
      align: 'right',
      cell: (x) => (
        <button type="button" className="ca-jump mono" onClick={() => go(x.index)} aria-label={`Go to access ${x.index + 1}`}>
          {x.index + 1}
        </button>
      ),
    },
    { key: 'a', header: 'Access', mono: true, cell: (x) => accessText(x.access) },
    { key: 'addr', header: 'Address', mono: true, align: 'right', cell: (x) => fmtAddr(x.access.address) },
    { key: 'blk', header: 'Block', mono: true, align: 'right', cell: (x) => x.split.block },
    { key: 'tag', header: 'Tag', mono: true, align: 'right', cell: (x) => fmtTag(x.split.tag.value, g.tagBits, tf) },
    { key: 'set', header: g.mapping === 'direct' ? 'Index' : 'Set', mono: true, align: 'right', cell: (x) => x.set },
    { key: 'r', header: 'Result', align: 'center', cell: (x) => <ResultChip f={x} /> },
    { key: 't', header: 'Miss type', cell: (x) => <TypeChip type={typeOf(x, lv)} /> },
  ]
  if (checked) {
    columns.push({
      key: 'you',
      header: 'Yours',
      cell: (x) => {
        const t = typed[x.index]
        const ok = right(x)
        if (!t) return <span className="ca-muted">-</span>
        return (
          <Chip signal={ok ? 'hit' : 'miss'} title={ok ? 'Right' : 'Wrong'}>
            {t.r}
            {t.type ? ` ${t.type}` : ''} {ok ? 'right' : 'wrong'}
          </Chip>
        )
      },
    })
  }

  return (
    <Panel
      flush
      title="Every access"
      actions={
        <Segmented
          label="Miss labels"
          value={lv}
          options={[
            { value: 'r12', label: 'R12 labels', title: 'Repeat misses are conflict in DM and SA, capacity in FA (R12 p23-25)' },
            { value: 'l23', label: 'L23 p28 view', title: 'Compare with an equal-size fully associative LRU cache (L23 p28)' },
          ]}
          onChange={setView}
        />
      }
    >
      <div className="ca-pad ca-check">
        <TextField label="Check my answer" value={answer} onChange={setAnswer} placeholder="M H M H M M H, or M(cold) H M(conflict)" width="100%" />
        {checked ? (
          <p className="ca-score" aria-live="polite">
            <Chip signal={score === frames.length && typed.length === frames.length ? 'hit' : 'miss'}>
              {score} of {frames.length} right
            </Chip>
            {typed.length !== frames.length ? <span className="ca-muted"> You gave {plural(typed.length, 'result')}; the trace has {frames.length}.</span> : null}
          </p>
        ) : (
          <p className="ca-muted">Type H or M per access, with the miss type if you like. Types are checked against the labels chosen above.</p>
        )}
      </div>
      <DataTable compact columns={columns} rows={rows} rowSignal={(x) => (x.index === index ? 'path' : undefined)} />
      <p className="ca-pad ca-muted">
        {frames.length > WINDOW ? `Accesses ${start + 1} to ${start + rows.length} of ${frames.length}; the table follows the current step. ` : ''}
        Result string:{' '}
        <span className="mono">{frames.length <= 200 ? trace.summary.resultString : `${trace.summary.resultString.slice(0, 400)} ...`}</span>
      </p>
    </Panel>
  )
}

/* ---------- Inspector ---------- */

function Inspector({ trace, f, lv, tf, index, validLines }: { trace: Trace; f: Frame | undefined; lv: LabelView; tf: TagFmt; index: number; validLines: number }) {
  const g = trace.geometry
  const s = trace.summary
  const tallies = useMemo(() => {
    const fr = trace.frames
    return {
      cold: cumulative(fr, (x) => +(typeOf(x, lv) === 'cold')),
      conflict: cumulative(fr, (x) => +(typeOf(x, lv) === 'conflict')),
      capacity: cumulative(fr, (x) => +(typeOf(x, lv) === 'capacity')),
      reads: cumulative(fr, (x) => x.traffic.filter((t) => t.kind === 'block-read').length),
      writes: cumulative(fr, (x) => x.traffic.filter((t) => t.kind === 'word-write').length),
      backs: cumulative(fr, (x) => x.traffic.filter((t) => t.kind === 'write-back').length),
    }
  }, [trace, lv])
  const at = (a: Int32Array) => (f ? a[index] : 0)
  const hits = f ? f.running.hits : 0
  const misses = f ? f.running.misses : 0
  const done = hits + misses
  const before = f ? f.compares : []
  const notFull = f && !f.hit && f.missType === 'conflict' && validLines < g.blocks
  const coldValid = f && !f.hit && f.missType === 'cold' && before.some((c) => c.valid)
  return (
    <>
      {f ? <AccessPanel trace={trace} f={f} lv={lv} tf={tf} /> : null}
      <Panel title={f ? `Tallies after access ${f.index + 1}` : 'Tallies'}>
        <dl className="ca-facts">
          <div>
            <dt>Hits</dt>
            <dd className="mono">
              {hits} of {done}
            </dd>
          </div>
          <div>
            <dt>Misses</dt>
            <dd className="mono">
              {misses}: cold {at(tallies.cold)}, conflict {at(tallies.conflict)}, capacity {at(tallies.capacity)}
            </dd>
          </div>
          <div>
            <dt>Memory traffic</dt>
            <dd className="mono">
              {plural(at(tallies.reads), 'block read')}, {plural(at(tallies.writes), 'word write')}, {plural(at(tallies.backs), 'write-back')}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Whole trace">
        <dl className="ca-facts">
          <div>
            <dt>Hit rate</dt>
            <dd className="mono">
              <W e={s.hitRate.why}>
                {s.hitRate.text}
                {s.hitRate.reduced !== s.hitRate.text ? ` = ${s.hitRate.reduced}` : ''}
              </W>
            </dd>
          </div>
          <div>
            <dt>R12 labels</dt>
            <dd className="mono">
              cold {s.missTypes.cold}, conflict {s.missTypes.conflict}, capacity {s.missTypes.capacity}
            </dd>
          </div>
          <div>
            <dt>L23 p28 view</dt>
            <dd className="mono">
              <W e={s.threeC.why}>
                cold {s.threeC.cold}, conflict {s.threeC.conflict}, capacity {s.threeC.capacity}
              </W>
            </dd>
          </div>
          <div>
            <dt>Words moved</dt>
            <dd className="mono">
              <W e={s.traffic.why}>{s.traffic.wordsMoved}</W>
            </dd>
          </div>
          {s.groups.map((gr) => (
            <div key={gr.name}>
              <dt>{gr.name === 'fetch' ? 'Fetches' : `Array ${gr.name}`}</dt>
              <dd className="mono">
                {gr.hits} hits of {gr.accesses}
                {gr.accesses ? ` (${gr.reduced})` : ''}
              </dd>
            </div>
          ))}
        </dl>
        {trace.notes.length ? (
          <div className="ca-callouts">
            {trace.notes.map((n, i) => (
              <Callout key={i} kind={n.startsWith('Only LRU') ? 'beyond' : 'note'}>
                {n}
              </Callout>
            ))}
          </div>
        ) : null}
      </Panel>
      <div className="ca-callouts">
        {coldValid ? (
          <Callout kind="trap" title="Valid, but still a cold miss" cite="L22 p45">
            The line is valid and holds another block, but this block was never in the cache. A first access is always a cold miss.
          </Callout>
        ) : null}
        {notFull ? (
          <Callout kind="trap" title="Conflict misses do not need a full cache" cite="R12 p23">
            Other lines may be empty. The block lost its place to another block of the same {g.mapping === 'direct' ? 'index' : 'set'}.
          </Callout>
        ) : null}
        <Callout kind="trap" title="Cut the fields from the block number" cite="L22 p25-26">
          Index = block number mod sets and tag = block number / sets, where block number = address {'>>'} offset bits. Not the byte address.
        </Callout>
        {g.mapping !== 'direct' && g.config.replacement === 'lru' ? (
          <Callout kind="trap" title="Hits refresh LRU too" cite="L23 p29-30">
            Every use, hit or miss, makes a block the most recently used.
          </Callout>
        ) : null}
        <Callout kind="course" title="Two ways to name a repeat miss" cite="R12 p23-25; L23 p28">
          R12 calls every repeat miss conflict in DM and set associative caches, and capacity in fully associative ones. The L23 p28 view asks whether an equal-size fully associative LRU cache would also miss. No key settles which one a paper wants; the app defaults to R12.
        </Callout>
        {g.config.wordBytes !== 4 ? (
          <Callout kind="course" title={`${g.config.wordBytes}-byte words`} cite="T11 Q1">
            Words are {g.config.wordBytes} bytes here, so a block's words are {g.config.wordBytes} addresses apart.
          </Callout>
        ) : null}
      </div>
    </>
  )
}

function AccessPanel({ trace, f, lv, tf }: { trace: Trace; f: Frame; lv: LabelView; tf: TagFmt }) {
  const g = trace.geometry
  const sp = f.split
  const why = f.why
  const type = typeOf(f, lv)
  const typeWhy = lv === 'r12' ? why.missType : (why.missType3C ?? why.missType)
  const unit = g.mapping === 'full' ? 'slot' : 'way'
  const isWrite = f.access.kind === 'write'
  const outcome = f.hit
    ? !isWrite
      ? `return Word${sp.wordInBlock}`
      : g.config.writeHit === 'write-back'
        ? `write Word${sp.wordInBlock}, set dirty`
        : 'write the cache and memory'
    : !f.allocated
      ? 'write memory only'
      : isWrite
        ? `load block ${sp.block}, then write Word${sp.wordInBlock}`
        : `load block ${sp.block}, then return Word${sp.wordInBlock}`
  return (
    <Panel title={`Access ${f.index + 1}: ${isWrite ? 'store to' : 'load from'} ${fmtAddr(f.access.address)}`}>
      <p className="ca-verdict">
        {f.hit ? (
          <Chip signal="hit">Hit</Chip>
        ) : (
          <Chip signal="miss">Miss</Chip>
        )}
        <TypeChip type={type} />
        {f.locality ? (
          <W e={why.locality}>
            <Chip signal="hit">{f.locality} locality</Chip>
          </W>
        ) : null}
        {f.access.label ? <span className="mono ca-muted">{f.access.label}</span> : null}
      </p>
      <ol className="ca-steps">
        <li>
          <span className="ca-step-name">Split the address.</span> Block <W e={sp.why.block}>{sp.block}</W>
          {g.mapping === 'full' ? ', no index' : <>, {g.mapping === 'direct' ? 'index' : 'set'} <W e={sp.why.set}>{sp.set}</W></>}, tag{' '}
          <W e={sp.why.tag}>{fmtTag(sp.tag.value, g.tagBits, tf)}</W>, offset <W e={sp.why.offset}>{sp.offset.value}</W>.
        </li>
        <li>
          <span className="ca-step-name">Check the tags.</span> <W e={why.lookup}>{f.hit ? `${unit} ${f.way} matches` : 'no valid tag matches'}</W>
          {f.compares.length <= 8 ? (
            <ul className="ca-compares">
              {f.compares.map((c) => (
                <li key={c.way} className="mono">
                  {g.ways > 1 ? `${unit} ${c.way}: ` : ''}
                  {c.valid ? `valid 1, tag ${fmtTag(c.tag, g.tagBits, tf)} ${c.match ? 'matches' : 'differs'}` : 'valid 0'}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li>
          <span className="ca-step-name">{f.hit ? 'Use the word.' : 'Handle the miss.'}</span> <W e={why.outcome}>{outcome}</W>.
          {why.placement ? (
            <>
              {' '}
              <W e={why.placement}>{f.victim ? `Evict block ${f.victim.block}${f.victim.dirty ? ' (dirty)' : ''}` : `Use ${unit} ${f.way}`}</W>.
            </>
          ) : null}
          {f.traffic.length ? (
            <ul className="ca-compares">
              {f.traffic.map((t, i) => (
                <li key={i}>
                  <W e={t.why}>
                    {t.kind === 'block-read'
                      ? `read block ${t.block} from memory (${plural(t.words, 'word')})`
                      : t.kind === 'write-back'
                        ? `write block ${t.block} back (${plural(t.words, 'word')})`
                        : `write ${t.data} to memory word ${fmtAddr(t.address)}${t.viaBuffer ? ' via the write buffer' : ''}`}
                  </W>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        {!f.hit ? (
          <li>
            <span className="ca-step-name">Name the miss.</span>{' '}
            <W e={typeWhy}>{type ? `${type} miss` : 'miss'}</W>
            {f.missType !== f.missType3C ? (
              <span className="ca-muted">
                {' '}
                ({lv === 'r12' ? 'L23 p28 view' : 'R12 label'}: {lv === 'r12' ? f.missType3C : f.missType})
              </span>
            ) : null}
            .
          </li>
        ) : null}
      </ol>
      {g.ways > 1 ? (
        <p className="ca-line">
          {g.config.replacement === 'lru' ? 'LRU to MRU' : 'Oldest to newest'} in this set: <span className="mono">{f.orderBefore.join(', ') || 'empty'}</span> then{' '}
          <span className="mono">{f.orderAfter.join(', ') || 'empty'}</span> (block numbers).
        </p>
      ) : null}
    </Panel>
  )
}
