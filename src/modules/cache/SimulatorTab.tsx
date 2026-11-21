import { useMemo, useRef, type ReactNode } from 'react'
import { fmtBytes, type Frame, type MissType, type Trace } from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Board, Details, PlayBar, Stage, Story } from '../../ui/board'
import { Callout, Chip, DataTable, Legend, Panel, Segmented, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { parseAnswer, typeOf, type LabelView } from './check'
import CheckMode from './CheckMode'
import {
  AddressBar,
  BoardWires,
  CacheTable,
  CacheBar,
  ConfigBar,
  Errors,
  Setup,
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

export { parseAnswer, typeOf, type LabelView }

const TYPE_NAME: Record<MissType, string> = { cold: 'cold', conflict: 'conflict', capacity: 'capacity' }

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

const WINDOW = 40

export default function SimulatorTab({ intro, input }: { intro: ReactNode; input: Input }) {
  const sim = useSim(input)
  const [tf, setTf] = useUrlState<TagFmt>('tf', 'dec')
  const [byAddr, setByAddr] = useUrlState<boolean>('wa', false)
  const [view, setView] = useUrlState<LabelView>('lv', 'r12')
  const [rawMode, setMode] = useUrlState<'run' | 'check'>('cm', 'run')
  const checking = rawMode === 'check'
  const trace = sim.ok ? sim.value : null
  const frames = trace?.frames ?? []
  const stepper = useStepper(frames.length)
  const f = frames[stepper.index] as Frame | undefined
  const board = useRef<HTMLDivElement>(null)

  const marks = useMemo(() => frames.map((x) => (x.hit ? 'hit' : 'miss')), [frames])
  const tagFmt: TagFmt = tf === 'hex' || tf === 'bin' ? tf : 'dec'
  const lv: LabelView = view === 'l23' ? 'l23' : 'r12'
  const sets = trace ? stateAfter(trace, f) : []
  const type = f ? typeOf(f, lv) : null

  const transport = trace ? (
    <Transport
      stepper={stepper}
      label="Access"
      marks={marks}
      describe={f ? `${accessText(f.access)}: ${f.hit ? 'hit' : `miss${type ? `, ${type}` : ''}`}` : 'No accesses'}
    />
  ) : undefined

  return (
    <Workspace title="Cache" lectures="L22 to L23, T11, R12" intro={intro} toolbar={<TracePresets input={input} onPick={stepper.first} />} transport={checking ? undefined : transport}>
      <div className="ca-inputs">
        <CacheBar input={input} />
        <Segmented
          label="Mode"
          value={checking ? 'check' : 'run'}
          options={[
            { value: 'run', label: 'Step through it' },
            { value: 'check', label: 'Check my answers', title: 'Type your results and final table, then mark them' },
          ]}
          onChange={setMode}
        />
        <Setup
          input={input}
          config={
            <>
              <ConfigBar cfg={input.cfg} setCfg={input.setCfg} core={false} />
              {trace && trace.geometry.ways > 1 ? (
                <Toggle label="Way 0 holds the lower address" checked={byAddr === true} onChange={setByAddr} hint="Order used in AY23/24 S1 Q20(b)" />
              ) : null}
              {trace ? <Geo trace={trace} /> : null}
            </>
          }
        />
      </div>
      {!sim.ok ? (
        <Panel title="Cannot simulate">
          <Errors list={sim.errors} />
        </Panel>
      ) : null}
      {trace && checking ? (
        <CheckMode
          trace={trace}
          lv={lv}
          setLv={setView}
          tf={tagFmt}
          setTf={setTf}
          byAddr={byAddr === true && trace.geometry.ways > 1}
          onJump={(i) => {
            setMode('run')
            stepper.set(i)
          }}
        />
      ) : trace ? (
        <>
          <Stage>
            <Board
              title={f ? <span className="mono">{accessText(f.access)}</span> : 'The trace has no accesses'}
              step={f ? <span className={f.hit ? 'ca-step-hit' : 'ca-step-miss'}>{f.hit ? 'Hit' : `Miss${type ? `, ${type}` : ''}`}</span> : undefined}
              tools={
                <>
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
                  <Segmented
                    label="Miss labels"
                    value={lv}
                    options={[
                      { value: 'r12', label: 'R12', title: 'Repeat misses are conflict in DM and SA, capacity in FA (R12 p23-25)' },
                      { value: 'l23', label: 'L23 p28', title: 'Compare with an equal-size fully associative LRU cache (L23 p28)' },
                    ]}
                    onChange={setView}
                  />
                </>
              }
              play={<PlayBar stepper={stepper} start="Run this trace" next={(k) => accessText(frames[k].access)} />}
              foot={
                <Legend
                  items={[
                    { signal: 'path', label: 'set looked up now' },
                    { signal: 'data', label: 'word the offset selects, block read' },
                    { signal: 'hit', label: 'hit, valid = 1' },
                    { signal: 'miss', label: 'miss, replaced block' },
                    { signal: 'dirty', label: 'dirty, write to memory' },
                  ]}
                />
              }
            >
              {/* The wires are measured against this box, so it holds every anchor and the wire layer. */}
              <div className="ca-wire-area" ref={board}>
                <div className="ca-top">
                  <div className="ca-top-addr">
                    <AddressBar g={trace.geometry} split={f?.split} compact />
                  </div>
                  <MemoryPill f={f} />
                </div>
                <CacheTable
                  g={trace.geometry}
                  sets={sets}
                  cur={cursorOf(f)}
                  tf={tagFmt}
                  byAddr={byAddr === true}
                  dirty={trace.geometry.config.writeHit === 'write-back'}
                  caption={f ? `Cache contents after access ${f.index + 1}.` : 'Cache contents before the first access.'}
                />
                <BoardWires
                  board={board}
                  step={stepper.index}
                  layout={`${tagFmt} ${byAddr === true} ${sets.length}`}
                  read={!!f && f.traffic.some((t) => t.kind === 'block-read')}
                  write={!!f && f.traffic.some((t) => t.kind !== 'block-read')}
                />
              </div>
            </Board>
            {f ? <AccessList trace={trace} index={stepper.index} go={stepper.set} lv={lv} tf={tagFmt} /> : null}
          </Stage>

          <Details
            urlKey="st"
            label="Tables for this trace"
            tabs={[
              { value: 'access', label: 'Every access', body: <Results trace={trace} index={stepper.index} go={stepper.set} lv={lv} tf={tagFmt} /> },
              { value: 'totals', label: 'Tallies', body: <Tallies trace={trace} f={f} lv={lv} index={stepper.index} /> },
              { value: 'notes', label: 'Rules and traps', body: <Notes trace={trace} /> },
            ]}
          />
        </>
      ) : null}
    </Workspace>
  )
}

/** Memory, the far end of the wires: what moved between it and the cache on this access. */
function MemoryPill({ f }: { f: Frame | undefined }) {
  const read = f?.traffic.find((t) => t.kind === 'block-read')
  const write = f?.traffic.find((t) => t.kind !== 'block-read')
  return (
    <div className="ca-mem" data-wire="mem">
      <span className="ca-mem-name">Memory</span>
      {read ? <span className="ca-mem-r">sends block {read.block}</span> : null}
      {write ? <span className="ca-mem-w">{write.kind === 'write-back' ? `gets block ${write.block} back` : `gets word ${fmtAddr(write.address)}`}</span> : null}
      {!read && !write ? <span className="ca-muted">no traffic</span> : null}
    </div>
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

/* ---------- The story: nearby accesses in order, only the current one narrated ---------- */

function AccessList({ trace, index, go, lv, tf }: { trace: Trace; index: number; go: (i: number) => void; lv: LabelView; tf: TagFmt }) {
  const frames = trace.frames
  const from = Math.max(0, Math.min(index - 2, frames.length - 5))
  const shown = frames.slice(from, from + 5)
  return (
    <Story
      label="What happens at each access"
      titles={shown.map((x) => (
        <span className="mono">
          {x.index + 1}. {accessText(x.access)}
        </span>
      ))}
      index={index - from}
      onPick={(k) => go(from + k)}
      // Later results stay hidden so the student can predict them.
      aside={(k) => (from + k <= index ? <ResultChip f={shown[k]} /> : null)}
      body={
        <>
          <AccessStory trace={trace} f={frames[index]} lv={lv} tf={tf} />
          {frames.length > 5 ? (
            <p className="ca-muted">
              Access {index + 1} of {frames.length}
            </p>
          ) : null}
        </>
      }
    />
  )
}

function AccessStory({ trace, f, lv, tf }: { trace: Trace; f: Frame; lv: LabelView; tf: TagFmt }) {
  const g = trace.geometry
  const sp = f.split
  const why = f.why
  const type = typeOf(f, lv)
  const typeWhy = lv === 'r12' ? why.missType : (why.missType3C ?? why.missType)
  const unit = g.mapping === 'full' ? 'slot' : 'way'
  const isWrite = f.access.kind === 'write'
  const validLines = stateAfter(trace, f).reduce((n, s) => n + s.lines.filter((l) => l.valid).length, 0)
  const notFull = !f.hit && f.missType === 'conflict' && validLines < g.blocks
  const coldValid = !f.hit && f.missType === 'cold' && f.compares.some((c) => c.valid)
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
    <>
      <p className="ca-verdict">
        {f.hit ? <Chip signal="hit">Hit</Chip> : <Chip signal="miss">Miss</Chip>}
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
          <W e={sp.why.tag}>{fmtTag(sp.tag.value, g.tagBits, tf)}</W>, offset <W e={sp.why.offset}>{sp.offset.value}</W>, word in block{' '}
          <W e={sp.why.word}>Word{sp.wordInBlock}</W>.
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
            <span className="ca-step-name">Name the miss.</span> <W e={typeWhy}>{type ? `${type} miss` : 'miss'}</W>
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
      {coldValid ? (
        <Callout kind="trap" title="Valid, but still a cold miss" cite="L22 p45">
          The line holds another block, but this one was never in the cache. A first access is always cold.
        </Callout>
      ) : null}
      {notFull ? (
        <Callout kind="trap" title="Conflict misses do not need a full cache" cite="R12 p23">
          Other lines may be empty. The block lost its place to another block of the same {g.mapping === 'direct' ? 'index' : 'set'}.
        </Callout>
      ) : null}
    </>
  )
}

/* ---------- Every access, and check my answer ---------- */

function Results({
  trace,
  index,
  go,
  lv,
  tf,
}: {
  trace: Trace
  index: number
  go: (i: number) => void
  lv: LabelView
  tf: TagFmt
}) {
  const frames = trace.frames
  const g = trace.geometry
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

  return (
    <div className="ca-results">
      <DataTable compact columns={columns} rows={rows} rowSignal={(x) => (x.index === index ? 'path' : undefined)} />
      <p className="ca-muted">
        {frames.length > WINDOW ? `Accesses ${start + 1} to ${start + rows.length} of ${frames.length}; the table follows the current step. ` : ''}
        Result string:{' '}
        <span className="mono">{frames.length <= 200 ? trace.summary.resultString : `${trace.summary.resultString.slice(0, 400)} ...`}</span>
      </p>
    </div>
  )
}

/* ---------- Tallies ---------- */

function Tallies({ trace, f, lv, index }: { trace: Trace; f: Frame | undefined; lv: LabelView; index: number }) {
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
  return (
    <div className="ca-cols">
      <section>
        <h3 className="ca-h">{f ? `After access ${f.index + 1}` : 'So far'}</h3>
        <dl className="ca-facts">
          <div>
            <dt>Hits</dt>
            <dd className="mono">
              {hits} of {hits + misses}
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
      </section>
      <section>
        <h3 className="ca-h">Whole trace</h3>
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
      </section>
    </div>
  )
}

/* ---------- Traps and conventions ---------- */

function Notes({ trace }: { trace: Trace }) {
  const g = trace.geometry
  return (
    <div className="ca-callouts">
      <Callout kind="trap" title="Cut the fields from the block number" cite="L22 p25-26">
        Block number = address {'>>'} offset bits. Index = block number mod sets, tag = block number / sets.
      </Callout>
      {g.mapping !== 'direct' && g.config.replacement === 'lru' ? (
        <Callout kind="trap" title="Hits refresh LRU too" cite="L23 p29-30">
          Every use, hit or miss, makes a block the most recently used.
        </Callout>
      ) : null}
      <Callout kind="course" title="Two ways to name a repeat miss" cite="R12 p23-25; L23 p28">
        R12: a repeat miss is conflict in DM and set associative caches, capacity in FA. L23 p28: capacity if an equal-size FA LRU cache also misses, otherwise conflict. No key says which a paper wants, so the app defaults to R12.
      </Callout>
      {g.config.wordBytes !== 4 ? (
        <Callout kind="course" title={`${g.config.wordBytes}-byte words`} cite="T11 Q1">
          Words are {g.config.wordBytes} bytes here, so a block's words are {g.config.wordBytes} addresses apart.
        </Callout>
      ) : null}
    </div>
  )
}
