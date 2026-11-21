import { useMemo, type ReactNode } from 'react'
import { simulate, type Frame, type Trace, type Traffic, type WriteHitPolicy, type WriteMissPolicy } from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Panel, Workspace } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { CacheTable, ConfigBar, Errors, TraceEditor, TracePresets, W, accessText, cumulative, cursorOf, fmtAddr, mem, plural, stateAfter, type Input, type TagFmt } from './common'
import { toConfig } from './presets'

const VARIANTS: { hit: WriteHitPolicy; miss: WriteMissPolicy; name: string }[] = [
  { hit: 'write-through', miss: 'allocate', name: 'Write-through, write allocate' },
  { hit: 'write-through', miss: 'around', name: 'Write-through, write around' },
  { hit: 'write-back', miss: 'allocate', name: 'Write-back, write allocate' },
  { hit: 'write-back', miss: 'around', name: 'Write-back, write around' },
]

interface Run {
  trace: Trace
  reads: Int32Array
  writes: Int32Array
  backs: Int32Array
}

const count = (kind: Traffic['kind']) => (f: Frame) => f.traffic.filter((t) => t.kind === kind).length

export default function WriteTab({ intro, input }: { intro: ReactNode; input: Input }) {
  const [tf] = useUrlState<TagFmt>('tf', 'dec')
  const runs = useMemo(() => {
    const out: Run[] = []
    for (const v of VARIANTS) {
      const r = simulate(toConfig({ ...input.cfg, hit: v.hit, miss: v.miss }), input.accesses)
      if (!r.ok) return { ok: false as const, errors: r.errors }
      const fr = r.value.frames
      out.push({ trace: r.value, reads: cumulative(fr, count('block-read')), writes: cumulative(fr, count('word-write')), backs: cumulative(fr, count('write-back')) })
    }
    return { ok: true as const, runs: out }
  }, [input.cfg, input.accesses])
  const n = runs.ok ? runs.runs[0].trace.frames.length : 0
  const stepper = useStepper(n)
  const i = stepper.index
  const first = runs.ok ? runs.runs[0].trace.frames[i] : undefined
  const marks = useMemo(() => (runs.ok ? runs.runs[0].trace.frames.map((f) => (f.access.kind === 'write' ? 'dirty' : undefined)) : []), [runs])
  const tagFmt: TagFmt = tf === 'hex' || tf === 'bin' ? tf : 'dec'

  return (
    <Workspace
      title="Cache"
      lectures="L22 p63-70, L23 p37, R12 p31-33"
      intro={intro}
      toolbar={<TracePresets input={input} onPick={stepper.first} />}
      transport={runs.ok ? <Transport stepper={stepper} label="Access" marks={marks} describe={first ? accessText(first.access) : 'No accesses'} /> : undefined}
      inspector={runs.ok ? <Totals runs={runs.runs} buffered={input.cfg.buf === true} /> : undefined}
    >
      <div className="ca-setup">
        <Panel title="Cache">
          <ConfigBar cfg={input.cfg} setCfg={input.setCfg} writePolicies={false} />
          <p className="ca-muted">Every pairing of a write hit policy and a write miss policy runs below. Stores need W in the trace.</p>
        </Panel>
        <Panel title="Trace">
          <TraceEditor input={input} rows={5} />
        </Panel>
      </div>
      {!runs.ok ? (
        <Panel title="Cannot simulate">
          <Errors list={runs.errors} />
        </Panel>
      ) : (
        <>
          <Legend
            items={[
              { signal: 'data', label: 'block read from memory' },
              { signal: 'dirty', label: 'write traffic, dirty bit, stale memory' },
              { signal: 'hit', label: 'hit' },
              { signal: 'miss', label: 'miss' },
              { signal: 'path', label: 'set looked up now' },
            ]}
          />
          <div className="ca-quad">
            {runs.runs.map((run, k) => (
              <VariantPanel key={k} name={VARIANTS[k].name} run={run} i={i} buffered={input.cfg.buf === true && VARIANTS[k].hit === 'write-through'} tf={tagFmt} />
            ))}
          </div>
        </>
      )}
    </Workspace>
  )
}

function VariantPanel({ name, run, i, buffered, tf }: { name: string; run: Run; i: number; buffered: boolean; tf: TagFmt }) {
  const t = run.trace
  const f = t.frames[i] as Frame | undefined
  const g = t.geometry
  const sets = stateAfter(t, f)
  const stale = sets.flatMap((s) => s.lines.flatMap((l) => (l.valid ? l.words.filter((w) => w.memoryStale) : [])))
  const at = (a: Int32Array) => (f ? a[i] : 0)
  const last = (a: Int32Array) => (a.length ? a[a.length - 1] : 0)
  const moved = (at(run.reads) + at(run.backs)) * g.wordsPerBlock + at(run.writes)
  return (
    <Panel
      title={name}
      actions={f ? f.hit ? <Chip signal="hit">Hit</Chip> : <Chip signal="miss">Miss{f.allocated ? '' : ', not loaded'}</Chip> : null}
    >
      <Bus f={f} buffered={buffered} wordsPerBlock={g.wordsPerBlock} />
      <dl className="ca-stats">
        <div>
          <dt>Block reads</dt>
          <dd className="mono">
            {at(run.reads)}
            <span className="ca-of"> / {last(run.reads)}</span>
          </dd>
        </div>
        <div>
          <dt>Word writes</dt>
          <dd className="mono ca-dirty-text">
            {at(run.writes)}
            <span className="ca-of"> / {last(run.writes)}</span>
          </dd>
        </div>
        <div>
          <dt>Write-backs</dt>
          <dd className="mono ca-dirty-text">
            {at(run.backs)}
            <span className="ca-of"> / {last(run.backs)}</span>
          </dd>
        </div>
        <div>
          <dt>Words moved</dt>
          <dd className="mono">
            <W e={t.summary.traffic.why}>{moved}</W>
            <span className="ca-of"> / {t.summary.traffic.wordsMoved}</span>
          </dd>
        </div>
      </dl>
      <CacheTable g={g} sets={sets} cur={cursorOf(f)} tf={tf} byAddr={false} dirty={g.config.writeHit === 'write-back'} />
      <p className="ca-line">
        {stale.length ? (
          <>
            <span className="ca-dirty-text">Memory is out of date at </span>
            <span className="mono">{stale.map((w) => `${mem(w.address)} (cache ${w.data})`).join(', ')}</span>.
          </>
        ) : (
          <span className="ca-muted">Memory matches every cached word.</span>
        )}
      </p>
    </Panel>
  )
}

/** Cache to memory bus for one step. Writes travel on the top lane, block reads on the bottom lane. */
function Bus({ f, buffered, wordsPerBlock }: { f: Frame | undefined; buffered: boolean; wordsPerBlock: number }) {
  const up = f?.traffic.find((x) => x.kind !== 'block-read')
  const down = f?.traffic.find((x) => x.kind === 'block-read')
  const upText = !up ? '' : up.kind === 'write-back' ? `write back block ${up.block}, ${plural(wordsPerBlock, 'word')}` : `word ${fmtAddr(up.address)} = ${up.data}`
  const downText = down && down.kind === 'block-read' ? `read block ${down.block}, ${plural(wordsPerBlock, 'word')}` : ''
  const dist = buffered && up?.kind === 'word-write' ? 72 : 132
  const label = [upText && `Write: ${upText}`, downText && `Read: ${downText}`].filter(Boolean).join('. ') || 'No memory traffic on this step'
  return (
    <svg className="ca-bus" viewBox="0 0 320 76" role="img" aria-label={label}>
      <rect className="ca-bus-box" x="2" y="10" width="82" height="48" rx="3" />
      <text className="ca-bus-name" x="43" y="38" textAnchor="middle">
        Cache
      </text>
      <rect className="ca-bus-box" x="236" y="10" width="82" height="48" rx="3" />
      <text className="ca-bus-name" x="277" y="38" textAnchor="middle">
        Memory
      </text>
      <line className={`ca-lane${up ? ' ca-lane-on-w' : ''}`} x1="84" y1="22" x2="236" y2="22" />
      <line className={`ca-lane${down ? ' ca-lane-on-r' : ''}`} x1="84" y1="46" x2="236" y2="46" />
      {buffered ? (
        <g>
          <rect className="ca-bus-box ca-bus-buf" x="176" y="13" width="50" height="18" rx="2" />
          <text className="ca-bus-tiny" x="201" y="25" textAnchor="middle">
            buffer
          </text>
        </g>
      ) : null}
      {up ? (
        <rect key={`u${f?.index}`} className="ca-packet ca-packet-w" x="86" y="17" width="18" height="10" rx="2" style={{ ['--d' as string]: `${dist}px` }} />
      ) : null}
      {down ? <rect key={`d${f?.index}`} className="ca-packet ca-packet-r" x="216" y="41" width="18" height="10" rx="2" style={{ ['--d' as string]: '-130px' }} /> : null}
      <text className={`ca-bus-tiny${up ? ' ca-bus-w' : ''}`} x="160" y="9" textAnchor="middle">
        {up ? upText : 'no write'}
      </text>
      <text className={`ca-bus-tiny${down ? ' ca-bus-r' : ''}`} x="160" y="68" textAnchor="middle">
        {down ? downText : 'no block read'}
      </text>
    </svg>
  )
}

function Totals({ runs, buffered }: { runs: Run[]; buffered: boolean }) {
  const rows = runs.map((r, k) => ({ name: VARIANTS[k].name, s: r.trace.summary }))
  return (
    <>
      <Panel flush title="Whole trace">
        <DataTable
          compact
          rows={rows}
          columns={[
            { key: 'n', header: 'Policies', cell: (r) => r.name },
            { key: 'm', header: 'Misses', align: 'right', mono: true, cell: (r) => r.s.misses },
            { key: 'r', header: 'Block reads', align: 'right', mono: true, cell: (r) => r.s.traffic.blockReads },
            { key: 'w', header: 'Word writes', align: 'right', mono: true, cell: (r) => r.s.traffic.wordWrites },
            { key: 'b', header: 'Write-backs', align: 'right', mono: true, cell: (r) => r.s.traffic.writeBacks },
            { key: 't', header: 'Words moved', align: 'right', mono: true, cell: (r) => r.s.traffic.wordsMoved },
            { key: 'd', header: 'Dirty at end', align: 'right', mono: true, cell: (r) => r.s.dirtyAtEnd },
          ]}
        />
        {buffered ? <p className="ca-pad ca-muted">With the write buffer, each word write goes into the buffer and the memory controller writes it to memory (L22 p67).</p> : null}
      </Panel>
      <div className="ca-callouts">
        <Callout kind="course" title="Hit policy and miss policy are separate choices" cite="L22 p66-70; L23 p37">
          On a write hit the write policy applies: write-through writes the cache and memory, write-back writes the cache only. On a write miss the write miss policy applies: write allocate loads the block first, write around (write no allocate) writes memory only. The slides fix no pairing.
        </Callout>
        <Callout kind="course" title="When a dirty block goes back to memory" cite="L22 p68">
          Each block has one dirty bit. A write sets it to 1. Only when the block is replaced, and only if its dirty bit is 1, is the whole block written back. A clean eviction costs nothing.
        </Callout>
        <Callout kind="trap" title="Write-back does not write every evicted block" cite="L22 p68">
          Blocks that were only read leave the cache without any memory write.
        </Callout>
        <Callout kind="trap" title="Write-through is not free" cite="L22 p67">
          Without a buffer every store runs at memory speed. The write buffer lets the processor carry on while the memory controller drains it.
        </Callout>
        <Callout kind="trap" title="Read the paper's wording" cite="AY23/24 S2 Q18">
          That paper says "write-back policy for write misses", mixing the two names. Decide which choice is the hit policy and which is the miss policy before you trace.
        </Callout>
        <Callout kind="beyond" title="Traffic counts are the app's own">
          The course treats write policies in words only. The counters, the buffer drawing and the rule that dirty blocks left at the end are not written back are this app's model.
        </Callout>
      </div>
    </>
  )
}
