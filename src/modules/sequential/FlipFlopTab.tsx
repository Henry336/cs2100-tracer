import { useMemo, type ReactNode } from 'react'
import {
  EXCITATION,
  FF_INPUTS,
  FLIP_FLOPS,
  LATCHES,
  convertFlipFlop,
  settleLatch,
  simulateTiming,
  type Bit,
  type FFType,
  type LatchType,
  type Sig,
  type TimingElement,
  type TimingFrame,
} from '../../core/sequential'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Legend, Presets, Segmented, Toggle, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { BitToggle, Bitv, Board, Fold, Issues, Narrate, PlayBar, Scroll, Story, TabStrip, W, bool, int, pick, plural } from './common'
import { LatchSvg } from './LatchSvg'
import { TIMING_PRESETS } from './presets'
import { TimingDiagram, type WaveRow } from './TimingDiagram'
import { MatchView, TablesView } from './TrainerViews'

type View = 'timing' | 'tables' | 'match' | 'latch' | 'convert'
const ELEMENTS: TimingElement[] = ['D', 'T', 'JK', 'SR', 'gated-d', 'gated-sr']
const FF_TYPES: FFType[] = ['D', 'T', 'JK', 'SR']
const LATCH_TYPES: LatchType[] = ['sr-nor', 'sr-nand', 'gated-sr', 'gated-d']
const FF_LABEL: Record<FFType, string> = { D: 'D', T: 'T', JK: 'J-K', SR: 'S-R' }
const ELEMENT_LABEL: Record<TimingElement, string> = { D: 'D', T: 'T', JK: 'J-K', SR: 'S-R', 'gated-d': 'gated D latch', 'gated-sr': 'gated S-R latch' }
const DATA_NAMES = ['D', 'T', 'J', 'K', 'S', 'R']

const square = (n: number): Bit[] => Array.from({ length: n }, (_, t) => (t % 2) as Bit)
const DEFAULT_WAVES: Record<string, Bit[]> = {
  CLK: square(12),
  D: [0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0],
  T: [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1],
  J: [1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  K: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
  S: [1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  R: [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
  PRE: Array(12).fill(0),
  CLR: Array(12).fill(0),
}

const isLatch = (e: TimingElement) => e === 'gated-d' || e === 'gated-sr'
/** Flip-flop whose tables describe this element (a gated latch acts like D or S-R while EN = 1). */
const tableType = (e: TimingElement): FFType => (e === 'gated-d' ? 'D' : e === 'gated-sr' ? 'SR' : e)
const dataNames = (e: TimingElement) => (e === 'gated-d' ? ['D'] : e === 'gated-sr' ? ['S', 'R'] : FF_INPUTS[e])

/** Clean waveforms from the URL: every signal present, all the same length as the clock. */
function normWaves(raw: unknown, inactive: Bit): Record<string, Bit[]> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const clk = Array.isArray(src.CLK) ? (src.CLK as unknown[]) : DEFAULT_WAVES.CLK
  const n = Math.max(2, Math.min(32, clk.length))
  const out: Record<string, Bit[]> = {}
  for (const name of ['CLK', ...DATA_NAMES, 'PRE', 'CLR']) {
    const w = Array.isArray(src[name]) ? (src[name] as unknown[]) : (DEFAULT_WAVES[name] as unknown[])
    const fill: Bit = name === 'PRE' || name === 'CLR' ? inactive : 0
    out[name] = Array.from({ length: n }, (_, t) => (w[t] === 1 ? 1 : w[t] === 0 ? 0 : fill))
  }
  return out
}

const EVENT_TEXT: Record<TimingFrame['event'], string> = {
  start: 'start',
  edge: 'triggering edge',
  transparent: 'transparent (EN = 1)',
  hold: 'hold',
  preset: 'PRE sets Q',
  clear: 'CLR clears Q',
  'async-conflict': 'PRE and CLR together',
}

export default function FlipFlopTab({ intro }: { intro: ReactNode }) {
  const [rawView, setView] = useUrlState<View>('fv', 'timing')
  const view = pick(rawView, ['timing', 'tables', 'match', 'latch', 'convert'] as const, 'timing')
  if (view === 'tables') return <TablesView intro={intro} switcher={<ViewSwitch value="tables" onChange={setView} />} />
  if (view === 'match') return <MatchView intro={intro} switcher={<ViewSwitch value="match" onChange={setView} />} />
  return view === 'timing' ? <TimingView intro={intro} setView={setView} /> : view === 'latch' ? <LatchView intro={intro} setView={setView} /> : <ConvertView intro={intro} setView={setView} />
}

function ViewSwitch({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <Segmented
      label="Show"
      value={value}
      onChange={onChange}
      options={[
        { value: 'timing', label: 'timing diagram', title: 'Clock, inputs and Q, tick by tick (L19 p7-25)' },
        { value: 'tables', label: 'tables', title: 'Characteristic rows merging into excitation rows (L19 p27, p44-45)' },
        { value: 'match', label: 'match the diagrams', title: 'Name the flip-flop of each two-state diagram (T09 SE2)' },
        { value: 'latch', label: 'latch gates', title: 'Settle a latch gate by gate (L19 p9-15; R10 p6)' },
        { value: 'convert', label: 'conversion', title: 'Make one flip-flop behave like another (beyond the course)' },
      ]}
    />
  )
}

/* ---------- Timing diagram ---------- */

function TimingView({ intro, setView }: { intro: ReactNode; setView: (v: View) => void }) {
  const [rawEl, setEl] = useUrlState<TimingElement>('fe', 'D')
  const [rawEdge, setEdge] = useUrlState<'pos' | 'neg'>('fed', 'pos')
  const [rawLevel, setLevel] = useUrlState<'high' | 'low'>('fal', 'high')
  const [rawAsync, setAsync] = useUrlState<boolean>('fas', false)
  const [rawQ0, setQ0] = useUrlState<Sig>('fq', 0)
  const [rawSample, setSample] = useUrlState<'before' | 'after'>('fsm', 'before')
  const [rawWaves, setWaves] = useUrlState<Record<string, Bit[]>>('fw', DEFAULT_WAVES)
  const [tab, setTab] = useUrlState<string>('ftab', 'char')

  const element = pick(rawEl, ELEMENTS, 'D')
  const latch = isLatch(element)
  const edge = pick(rawEdge, ['pos', 'neg'] as const, 'pos')
  const level = pick(rawLevel, ['high', 'low'] as const, 'high')
  const asyncOn = bool(rawAsync, false)
  const q0: Sig = rawQ0 === 1 || rawQ0 === 'X' ? rawQ0 : 0
  const sample = pick(rawSample, ['before', 'after'] as const, 'before')
  const inactive: Bit = level === 'high' ? 0 : 1
  const waves = useMemo(() => normWaves(rawWaves, inactive), [rawWaves, inactive])
  const ticks = waves.CLK.length
  const names = dataNames(element)
  const clockName = latch ? 'EN' : 'CLK'

  const result = useMemo(() => {
    const w: Record<string, Bit[]> = { [clockName]: waves.CLK }
    for (const n of names) w[n] = waves[n]
    if (asyncOn) {
      w.PRE = waves.PRE
      w.CLR = waves.CLR
    }
    return simulateTiming({ element, edge, asyncLevel: level, q0, sample, waves: w })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waves, element, edge, level, q0, sample, asyncOn])
  const trace = result.ok ? result.trace : null
  const stepper = useStepper(trace ? trace.frames.length : 0)
  const t = Math.min(stepper.index, Math.max(0, ticks - 1))
  const frame = trace?.frames[t]

  const flip = (name: string, k: number) => {
    const key = name === 'EN' ? 'CLK' : name
    setWaves({ ...waves, [key]: waves[key].map((v, i) => (i === k ? ((1 - v) as Bit) : v)) })
  }
  const resize = (n: number) => {
    const next: Record<string, Bit[]> = {}
    for (const [k, w] of Object.entries(waves)) next[k] = Array.from({ length: n }, (_, i) => (i < w.length ? w[i] : k === 'CLK' ? ((i % 2) as Bit) : k === 'PRE' || k === 'CLR' ? inactive : w[w.length - 1]))
    setWaves(next)
  }

  const rows: WaveRow[] = [
    { name: clockName, kind: 'clock', values: waves.CLK },
    ...names.map((n): WaveRow => ({ name: n, kind: 'data', values: waves[n] })),
    ...(asyncOn ? (['PRE', 'CLR'] as const).map((n): WaveRow => ({ name: n, kind: 'async', values: waves[n] })) : []),
  ]

  const type = tableType(element)
  const info = FLIP_FLOPS[type]
  const acted = frame && (frame.event === 'edge' || frame.event === 'transparent') && frame.sampled !== undefined
  const sampledInputs = acted ? names.map((n) => waves[n][frame.sampled!]) : null
  const before: Sig | undefined = trace ? (t === 0 ? q0 : trace.q[t - 1]) : undefined
  const after: Sig | undefined = trace?.q[t]

  const toolbar = (
    <Presets
      presets={TIMING_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
      onPick={(p) => {
        setEl(p.element)
        if (p.edge) setEdge(p.edge)
        setLevel(p.asyncLevel ?? 'high')
        setAsync(p.async)
        setQ0(0)
        const n = p.waves.CLK.length
        const inact: Bit = (p.asyncLevel ?? 'high') === 'high' ? 0 : 1
        const w: Record<string, Bit[]> = {}
        for (const k of ['CLK', ...DATA_NAMES, 'PRE', 'CLR']) w[k] = p.waves[k] ?? Array.from({ length: n }, (): Bit => (k === 'PRE' || k === 'CLR' ? inact : 0))
        setWaves(w)
        stepper.first()
      }}
    />
  )

  const charCols: Column<(typeof info.characteristic)[number]>[] = [
    ...FF_INPUTS[type].map((l, k) => ({ key: l, header: l, align: 'center' as const, mono: true, cell: (r: (typeof info.characteristic)[number]) => r.inputs[k] })),
    { key: 'q', header: 'Q+', align: 'center', mono: true, cell: (r) => (r.next === '?' ? '?' : String(r.next)) },
    { key: 'c', header: 'Action', cell: (r) => r.comment },
  ]
  const exRows = ([[0, 0], [0, 1], [1, 0], [1, 1]] as [Bit, Bit][]).map(([q, n]) => ({ q, n, ins: EXCITATION[type][q][n] }))
  const exCols: Column<(typeof exRows)[number]>[] = [
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (r) => r.q },
    { key: 'n', header: 'Q+', align: 'center', mono: true, cell: (r) => r.n },
    ...FF_INPUTS[type].map((l, k) => ({ key: l, header: l, align: 'center' as const, mono: true, cell: (r: (typeof exRows)[number]) => <Bitv v={r.ins[k]} /> })),
  ]

  const logRows = trace ? trace.frames.slice(0, t + 1) : []
  const logCols: Column<TimingFrame>[] = [
    { key: 't', header: 'Tick', align: 'right', mono: true, cell: (f) => f.t },
    { key: 'clk', header: clockName, align: 'center', mono: true, cell: (f) => waves.CLK[f.t] },
    ...names.map((n) => ({ key: n, header: n, align: 'center' as const, mono: true, cell: (f: TimingFrame) => waves[n][f.t] })),
    ...(asyncOn ? (['PRE', 'CLR'] as const).map((n) => ({ key: n, header: n, align: 'center' as const, mono: true, cell: (f: TimingFrame) => waves[n][f.t] })) : []),
    { key: 'ev', header: 'What happens', cell: (f) => EVENT_TEXT[f.event] + (f.sampled !== undefined && f.event === 'edge' ? `, reads tick ${f.sampled}` : '') },
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (f) => <Bitv v={f.q} e={f.why} /> },
  ]

  const marks = trace?.frames.map((f) => (f.q === 'X' ? 'dontcare' : f.event === 'edge' || f.event === 'transparent' || f.event === 'preset' || f.event === 'clear' ? 'control' : undefined))
  const title = `Timing diagram, ${latch ? ELEMENT_LABEL[element] : `${edge === 'pos' ? 'positive' : 'negative'}-edge ${FLIP_FLOPS[type].name}`}`

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      toolbar={toolbar}
      transport={
        trace ? (
          <Transport
            stepper={stepper}
            label="tick"
            marks={marks}
            describe={frame ? `${EVENT_TEXT[frame.event]}, Q = ${String(frame.q)}` : undefined}
          />
        ) : undefined
      }
    >
      <div className="seq-command">
        <ViewSwitch value="timing" onChange={setView} />
        <Segmented
          label="Type"
          value={element}
          onChange={(v) => {
            setEl(v)
            stepper.first()
          }}
          options={ELEMENTS.map((e) => ({ value: e, label: ELEMENT_LABEL[e], title: isLatch(e) ? 'Level-triggered (L19 p13-15)' : `${FLIP_FLOPS[e as FFType].name} (${FLIP_FLOPS[e as FFType].cite})` }))}
        />
      </div>
      <Fold summary="Clock edge, start value, PRE and CLR, length">
        <div className="seq-row">
          {!latch ? (
            <Segmented
              label="Clock edge"
              value={edge}
              onChange={setEdge}
              options={[
                { value: 'pos', label: 'positive', title: '0 to 1 (L19 p16)' },
                { value: 'neg', label: 'negative', title: '1 to 0, a bubble on the clock pin (L19 p17)' },
              ]}
            />
          ) : null}
          <Segmented label="Q at tick 0" value={q0} onChange={setQ0} options={[{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 'X', label: 'X', title: 'Unknown at power-up' }]} />
        </div>
        <div className="seq-row seq-toggles">
          <Toggle label="PRE and CLR" checked={asyncOn} onChange={setAsync} hint="Asynchronous preset and clear (L19 p24-25)" />
          {asyncOn ? (
            <Segmented
              label="PRE, CLR active"
              value={level}
              onChange={(v) => {
                if (v !== level) setWaves({ ...waves, PRE: waves.PRE.map((x) => (1 - x) as Bit), CLR: waves.CLR.map((x) => (1 - x) as Bit) })
                setLevel(v)
              }}
              options={[
                { value: 'high', label: 'high', title: 'L19 p24 text' },
                { value: 'low', label: 'low', title: 'L19 p25 figure (bubbles)' },
              ]}
            />
          ) : null}
          {!latch ? (
            <Segmented
              label="An edge reads the inputs"
              value={sample}
              onChange={setSample}
              options={[
                { value: 'before', label: 'just before it', title: 'The values held while the edge arrives (default)' },
                { value: 'after', label: 'just after it', title: 'The values in the tick the edge starts' },
              ]}
            />
          ) : null}
        </div>
        <div className="seq-row">
          <Button onClick={() => resize(Math.min(32, ticks + 2))} disabled={ticks >= 32}>
            Add 2 ticks
          </Button>
          <Button onClick={() => resize(Math.max(2, ticks - 2))} disabled={ticks <= 2}>
            Remove 2 ticks
          </Button>
          <Button onClick={() => setWaves({ ...waves, CLK: square(ticks) })}>Square {clockName}</Button>
          <span className="seq-muted">{plural(ticks, 'tick')}</span>
        </div>
      </Fold>

      <div className="seq-stage">
        <Board
          title={title}
          step={trace ? `Tick ${t}` : undefined}
          play={trace ? <PlayBar stepper={stepper} label="Clock it through" next={`Next: tick ${t + 1}`} /> : null}
          foot={
            <Legend
              items={[
                { signal: 'path', label: 'this tick' },
                { signal: 'control', label: latch ? 'clock, transparent window' : 'clock, triggering edge' },
                { signal: 'data', label: 'inputs the edge reads' },
                { signal: 'dontcare', label: asyncOn ? 'Q unknown (X); hatched: PRE or CLR overrides the clock' : 'Q unknown (X)' },
              ]}
            />
          }
        >
          {result.ok && trace ? (
            <Scroll label="Timing diagram">
              <TimingDiagram rows={rows} trace={trace} upto={t} onToggle={flip} label={`Timing diagram up to tick ${t}`} />
            </Scroll>
          ) : (
            <Issues issues={result.ok ? [] : result.errors} />
          )}
        </Board>
        {frame ? (
          <Story tip="Click a cell of any input row to flip it.">
            <Narrate
              e={frame.why}
              head={
                <>
                  <Chip signal={frame.q === 'X' ? 'dontcare' : 'path'}>Q = {String(frame.q)}</Chip> <span>{EVENT_TEXT[frame.event]}</span>
                </>
              }
            />
          </Story>
        ) : null}
      </div>

      <TabStrip
        label="Tables for this flip-flop"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: 'char',
            label: 'Characteristic table',
            body: (
              <DataTable
                compact
                columns={charCols}
                rows={info.characteristic}
                rowSignal={(r) => (sampledInputs && r.inputs.every((v, k) => v === sampledInputs[k]) ? 'path' : undefined)}
                caption={<W e={{ rule: 'The characteristic table gives Q+ from the inputs and Q. Use it for analysis.', working: info.equation, cite: `${info.cite}; L19 p44` }}>{`${info.name}: ${info.equation}`}</W>}
              />
            ),
          },
          {
            value: 'excite',
            label: 'Excitation table',
            body: (
              <DataTable
                compact
                columns={exCols}
                rows={exRows}
                rowSignal={(r) => (acted && before === r.q && after === r.n ? 'path' : undefined)}
                caption={<W e={{ rule: 'The excitation table gives the inputs that move Q to Q+. Use it for design.', working: 'X: either value works', cite: 'L19 p44-45' }}>{`${info.name}: inputs needed for each move`}</W>}
              />
            ),
          },
          { value: 'log', label: 'Tick by tick', body: <DataTable compact columns={logCols} rows={logRows} rowSignal={(_, i) => (i === logRows.length - 1 ? 'path' : undefined)} /> },
          {
            value: 'notes',
            label: 'Course notes',
            body: (
              <div className="seq-notes">
                <Callout kind="trap" title="Latch or flip-flop" cite="L19 p8, p14-16">
                  A gated latch follows its input while EN = 1, glitches included. An edge-triggered flip-flop reads its inputs only at the clock edge. Compare the two D presets.
                </Callout>
                {!latch ? (
                  <Callout kind="course" title="Reading the symbol" cite="L19 p17">
                    The &gt; mark on the clock pin means edge-triggered; a bubble in front of it means the negative (1 to 0) edge.
                  </Callout>
                ) : null}
                {asyncOn ? (
                  <Callout kind="course" title="Active level of PRE and CLR" cite="L19 p24-25">
                    L19 p24 calls PRE and CLR active-high. The p25 figure draws them active-low, with bubbles. Check for a bubble before you assume HIGH sets. Both act at once, whatever the clock.
                  </Callout>
                ) : null}
                {type === 'SR' ? (
                  <Callout kind="trap" title="S = R = 1" cite="L19 p18, p27">
                    S = R = 1 is not allowed. The next state is unpredictable, drawn as a hatched X.
                  </Callout>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Latch gates ---------- */

function LatchView({ intro, setView }: { intro: ReactNode; setView: (v: View) => void }) {
  const [rawType, setType] = useUrlState<LatchType>('flt', 'sr-nor')
  const [rawVals, setVals] = useUrlState<Record<string, Bit>>('fli', {})
  const [rawQ, setQ] = useUrlState<Bit>('flq', 1)
  const [rawSame, setSame] = useUrlState<boolean>('flx', false)
  const [tab, setTab] = useUrlState<string>('fltab', 'cmd')
  const type = pick(rawType, LATCH_TYPES, 'sr-nor')
  const info = LATCHES[type]
  const q = int(rawQ, 0, 1, 1) as Bit
  const same = bool(rawSame, false)
  const src = rawVals && typeof rawVals === 'object' ? rawVals : {}
  // Defaults are the no-change command: 0s for the NOR latch, 1s for the active-low NAND latch.
  const values: Record<string, Bit> = Object.fromEntries(info.inputs.map((n) => [n, src[n] === 1 ? 1 : src[n] === 0 ? 0 : type === 'sr-nand' ? 1 : n === 'EN' ? 1 : 0]))
  const settle = useMemo(() => settleLatch(type, values, q, same ? q : ((1 - q) as Bit)), [type, JSON.stringify(values), q, same]) // eslint-disable-line react-hooks/exhaustive-deps
  const stepper = useStepper(settle.rounds.length)
  const k = Math.min(stepper.index, settle.rounds.length - 1)
  const round = settle.rounds[k]
  const last = k === settle.rounds.length - 1
  const cmd = info.commands.find((c) => c.inputs.every((v, i) => v === values[info.inputs[i]]))

  const cmdCols: Column<(typeof info.commands)[number]>[] = [
    ...info.inputs.map((n, i) => ({ key: n, header: n, align: 'center' as const, mono: true, cell: (c: (typeof info.commands)[number]) => c.inputs[i] })),
    { key: 'q', header: 'Q+', align: 'center', mono: true, cell: (c) => (c.next === '?' ? '?' : String(c.next)) },
    { key: 'c', header: 'Action', cell: (c) => c.comment },
  ]
  const roundCols: Column<(typeof settle.rounds)[number]>[] = [
    { key: 'r', header: 'Round', align: 'right', mono: true, cell: (r) => r.round },
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (r) => r.q },
    { key: 'qb', header: "Q'", align: 'center', mono: true, cell: (r) => r.qBar },
    { key: 'c', header: 'Changed', cell: (r) => (r.round === 0 ? 'starting values' : r.changed.join(' and ')) },
  ]

  const roundTitle = (i: number) => {
    const r = settle.rounds[i]
    return r.round === 0 ? 'Starting values' : `Round ${r.round}: ${r.changed.length ? `${r.changed.join(' and ')} changed` : 'nothing changes'}`
  }
  const verdict = (
    <p>
      {settle.stable ? <Chip signal={settle.invalid ? 'miss' : 'hit'}>{settle.invalid ? 'settles, but invalid' : 'settles'}</Chip> : <Chip signal="dontcare">never settles</Chip>}{' '}
      <W e={settle.why}>
        Q = {String(settle.q)}, Q' = {String(settle.qBar)}
      </W>
    </p>
  )

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      transport={<Transport stepper={stepper} label="round" marks={settle.rounds.map((r) => (r.changed.length ? 'path' : undefined))} describe={k === 0 ? 'starting values' : `${round.changed.join(' and ')} changed`} />}
    >
      <div className="seq-command">
        <ViewSwitch value="latch" onChange={setView} />
        <Segmented
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v)
            setVals({})
            stepper.first()
          }}
          options={LATCH_TYPES.map((v) => ({ value: v, label: { 'sr-nor': 'S-R (NOR)', 'sr-nand': "S'-R' (NAND)", 'gated-sr': 'gated S-R', 'gated-d': 'gated D' }[v], title: LATCHES[v].cite }))}
        />
        <div className="seq-bitrow" role="group" aria-label="Inputs">
          <span className="control-label">Inputs</span>
          <div className="seq-bits">
            {info.inputs.map((n) => (
              <BitToggle
                key={n}
                label={n}
                value={values[n]}
                onChange={(v) => {
                  setVals({ ...values, [n]: v })
                  stepper.first()
                }}
              />
            ))}
          </div>
        </div>
        <div className="seq-bitrow" role="group" aria-label="Before">
          <span className="control-label">Before</span>
          <div className="seq-bits">
            <BitToggle label="Q" value={q} onChange={(v) => setQ(v)} />
          </div>
        </div>
      </div>
      <Fold summary="Options">
        <Toggle label="Q' starts equal to Q" checked={same} onChange={setSame} hint="As after S = R = 1 on the NOR latch, then both inputs released together" />
      </Fold>

      <div className="seq-stage">
        <Board
          title={info.name}
          step={`Round ${round.round}${last ? (settle.stable ? ', stable' : ', still changing') : ''}`}
          play={<PlayBar stepper={stepper} label="Settle the gates" next={`Next: round ${round.round + 1}`} />}
          foot={<Legend items={[{ signal: 'path', label: 'changed this round' }, { signal: 'data', label: 'feedback' }, { signal: 'control', label: 'enable' }]} />}
        >
          <Scroll label="Latch gate diagram">
            <LatchSvg type={type} values={values} settle={settle} round={k} />
          </Scroll>
        </Board>
        <Story items={settle.rounds.map((_, i) => ({ title: roundTitle(i), state: i === k ? 'now' : i < k ? 'past' : 'next', onPick: () => stepper.set(i) }))}>
          <p>
            Q = {String(round.q)}, Q' = {String(round.qBar)}
          </p>
          {last ? verdict : null}
        </Story>
      </div>

      <TabStrip
        label="Tables for this latch"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'cmd', label: 'Command table', body: <DataTable compact columns={cmdCols} rows={info.commands} rowSignal={(c) => (c === cmd ? 'path' : undefined)} caption={info.equation ? <W e={{ rule: info.name, working: info.equation, cite: info.cite }}>{info.equation}</W> : info.cite} /> },
          { value: 'rounds', label: 'Rounds', body: <DataTable compact columns={roundCols} rows={settle.rounds.slice(0, k + 1)} rowSignal={(_, i) => (i === k ? 'path' : undefined)} /> },
          {
            value: 'notes',
            label: 'Course notes',
            body: (
              <div className="seq-notes">
                <Callout kind="course" title="Trace a few rounds" cite="R10 p6">
                  Evaluate both gates from the previous round's outputs. Repeat until nothing changes, about three rounds for these latches.
                </Callout>
                <Callout kind="trap" title="Active-high or active-low" cite="L19 p9-12; R10 p8">
                  NOR latch: S = R = 1 is invalid (Q = Q' = 0) and S = R = 0 is no change. NAND latch: S' = R' = 0 is invalid (Q = Q' = 1) and S' = R' = 1 is no change.
                </Callout>
                {type === 'gated-d' ? (
                  <Callout kind="course" title="Why a D latch" cite="L19 p14">
                    The gated D latch feeds D and D' into the two front gates, so the invalid S = R = 1 command cannot happen.
                  </Callout>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}

/* ---------- Conversion ---------- */

function ConvertView({ intro, setView }: { intro: ReactNode; setView: (v: View) => void }) {
  const [rawHave, setHave] = useUrlState<FFType>('fch', 'T')
  const [rawWant, setWant] = useUrlState<FFType>('fcw', 'JK')
  const [tab, setTab] = useUrlState<string>('fctab', 'eq')
  const have = pick(rawHave, FF_TYPES, 'T')
  const want = pick(rawWant, FF_TYPES, 'JK')
  const conv = useMemo(() => convertFlipFlop(have, want), [have, want])
  const stepper = useStepper(conv.rows.length)
  const k = Math.min(stepper.index, conv.rows.length - 1)
  const row = conv.rows[k]
  const wantIn = FF_INPUTS[want]
  const haveIn = FF_INPUTS[have]
  type R = (typeof conv.rows)[number]
  const cols: Column<R>[] = [
    ...wantIn.map((l, i) => ({ key: `w${l}`, header: l, align: 'center' as const, mono: true, cell: (r: R) => r.inputs[i] })),
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (r) => r.q },
    // Rows after the current one stay blank, so the table fills in as you step.
    { key: 'n', header: 'Q+', align: 'center', mono: true, cell: (r) => (conv.rows.indexOf(r) > k ? '' : <Bitv v={r.next} e={r.why} />) },
    ...haveIn.map((l, i) => ({ key: `h${l}`, header: `${l} (yours)`, align: 'center' as const, mono: true, cell: (r: R) => (conv.rows.indexOf(r) > k ? '' : <Bitv v={r.have[i]} e={r.why} />) })),
  ]
  const rowText = (r: R) => `${wantIn.map((l, i) => `${l} = ${r.inputs[i]}`).join(', ')}, Q = ${r.q}`
  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      transport={<Transport stepper={stepper} label="row" describe={rowText(row)} />}
    >
      <div className="seq-command">
        <ViewSwitch value="convert" onChange={setView} />
        <Segmented label="Flip-flop you have" value={have} onChange={setHave} options={FF_TYPES.map((v) => ({ value: v, label: FF_LABEL[v] }))} />
        <Segmented label="Behaviour you want" value={want} onChange={setWant} options={FF_TYPES.map((v) => ({ value: v, label: FF_LABEL[v] }))} />
      </div>

      <div className="seq-stage">
        <Board title={`Drive a ${FLIP_FLOPS[have].name} so it acts as a ${FLIP_FLOPS[want].name}`} step={`Row ${k}`} play={<PlayBar stepper={stepper} label="Fill in the rows" next={`Next: row ${k + 1}`} />}>
          <DataTable compact columns={cols} rows={conv.rows} rowSignal={(_, i) => (i === k ? 'path' : undefined)} />
        </Board>
        <Story>
          <Narrate e={row.why} head={<span className="mono">{rowText(row)}</span>} />
        </Story>
      </div>

      <TabStrip
        label="Result and notes"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: 'eq',
            label: 'Equations',
            body: (
              <>
                <ul className="seq-eqs">
                  {conv.equations.map((e) => (
                    <li key={e.label} className="mono">
                      {e.label} = <W e={e.why}>{e.text}</W>
                    </li>
                  ))}
                </ul>
                <p className="seq-muted">Variables: {conv.vars.join(', ')}. Q is the present output of the flip-flop you have.</p>
              </>
            ),
          },
          {
            value: 'notes',
            label: 'Course notes',
            body: (
              <div className="seq-notes">
                <Callout kind="beyond" title="Not a slide topic">
                  This is the design procedure of L19 p46 with one flip-flop. The wanted characteristic table gives Q+. The excitation table of the flip-flop you have gives its inputs.
                </Callout>
                {have === 'JK' && want === 'T' ? (
                  <Callout kind="course" title="J and K tied together" cite="AY25/26 Q13">
                    A J-K flip-flop with J and K joined is a T flip-flop: J = K = T.
                  </Callout>
                ) : null}
                <Callout kind="trap" title="Which table" cite="L19 p44; R10 p23">
                  Characteristic tables are for analysis: inputs give Q+. Excitation tables are for design: Q and Q+ give the inputs.
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
