// Tab 5: single-cycle vs multi-cycle vs pipelined time (L20 p31-33), with a stage bar chart.
import { useMemo, type ReactNode } from 'react'
import { idealCycles, loopIdeal, timing, type DesignTime, type TimingResult } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Callout, DataTable, Legend, NumberField, Presets, Segmented, TextField, Workspace, type Column } from '../../ui/kit'
import { Board, Strip, W } from './common'
import { DEFAULT_LOOP, DEFAULT_TIMING, LOOP_PRESETS, TIMING_PRESETS, timingInput, type LoopSettings, type TimingSettings } from './presets'

const fmt = (x: number) => String(Math.round(x * 1e6) / 1e6)

function StageChart({ stages, td, unit }: { stages: number[]; td: number; unit: string }) {
  if (!stages.length) return <p className="pl-muted">Type stage times to see the chart.</p>
  const max = Math.max(...stages)
  const scale = 300 / (max + td || 1)
  const rh = 24
  const lw = 60
  const H = (stages.length + 1) * rh + 8
  const names = stages.length === 5 ? ['IF', 'ID', 'EX', 'MEM', 'WB'] : stages.map((_, i) => `T${i + 1}`)
  return (
    <div className="pl-dp-scroll">
      <svg className="pl-chart" viewBox={`0 0 ${lw + 300 + 260} ${H}`} width={lw + 560} role="img" aria-label={`Stage times ${stages.join(', ')} ${unit}; the slowest stage, ${max} ${unit}, sets the clock`}>
        {stages.map((v, i) => {
          const slow = v === max
          return (
            <g key={i} transform={`translate(0 ${i * rh + 4})`}>
              <text x={lw - 8} y={rh / 2 + 4} textAnchor="end" className="pl-chart-label">
                {names[i]}
              </text>
              <rect x={lw} y={3} width={v * scale} height={rh - 8} className={slow ? 'pl-bar pl-bar-slow' : 'pl-bar'} />
              {slow ? (td ? <rect x={lw + v * scale} y={3} width={td * scale} height={rh - 8} className="pl-bar pl-bar-td" /> : null) : (
                <rect x={lw + v * scale} y={3} width={(max + td - v) * scale} height={rh - 8} className="pl-bar-idle" />
              )}
              <text x={lw + (max + td) * scale + 6} y={rh / 2 + 4} className="pl-chart-value">
                {fmt(v)} {unit}
                {slow ? (td ? ` + Td ${fmt(td)}: sets the clock` : ': sets the clock') : ''}
              </text>
            </g>
          )
        })}
        <g transform={`translate(0 ${stages.length * rh + 4})`}>
          <line x1={lw + (max + td) * scale} x2={lw + (max + td) * scale} y1={-stages.length * rh} y2={rh / 2} className="pl-chart-clock" />
          <text x={lw} y={rh / 2 + 4} className="pl-chart-label pl-chart-left">
            Each stage gets a whole cycle; faster stages sit idle for the rest
          </text>
        </g>
      </svg>
    </div>
  )
}

/** Loop ideal-cycle counter from quick fields (L20 p32; AY24/25 Q13; AY25/26 Q2). */
function LoopCounter() {
  const [l, setL] = useUrlState<LoopSettings>('loop', DEFAULT_LOOP)
  const set = <K extends keyof LoopSettings>(k: K, v: LoopSettings[K]) => setL({ ...l, [k]: v })
  const init = Number(l.init.trim())
  const bad = !l.init.trim() || !Number.isInteger(init)
  const r = useMemo(() => (bad ? undefined : loopIdeal({ init, step: l.step, exit: l.exit, body: l.body, before: l.before, after: l.after, stages: l.n })), [bad, init, l])
  return (
    <div className="pl-loop">
      <div className="pl-row">
        <Presets presets={LOOP_PRESETS.map((x) => ({ name: `${x.name} (${x.expect})`, source: x.source, value: x.value }))} onPick={(v) => setL(v)} />
      </div>
      <p className="pl-muted pl-gap">For a loop that updates a counter, then tests it with bne against an exit value. Registers start at 0 unless set (AY25/26 Q2).</p>
      <div className="pl-row">
        <TextField label="Counter starts at (0x for hex)" value={l.init} onChange={(v) => set('init', v)} width="6em" />
        <NumberField label="Step per iteration" value={l.step} onChange={(v) => set('step', v)} />
        <NumberField label="Exit when counter equals" value={l.exit} onChange={(v) => set('exit', v)} />
        <NumberField label="Body length (with update and branch)" value={l.body} min={1} onChange={(v) => set('body', v)} />
        <NumberField label="Instructions before" value={l.before} min={0} onChange={(v) => set('before', v)} />
        <NumberField label="Instructions after" value={l.after} min={0} onChange={(v) => set('after', v)} />
        <NumberField label="Stages N" value={l.n} min={1} onChange={(v) => set('n', v)} />
      </div>
      {bad ? <p className="pl-err">{l.init || 'An empty start'} is not a whole number. Write it as 50 or 0x32.</p> : null}
      {r ? (
        r.iterations === undefined ? (
          <Callout kind="trap" title="The counter never hits the exit value" cite={r.why.iterations.cite}>
            {r.why.iterations.rule}.
          </Callout>
        ) : (
          <dl className="pl-facts">
            <div>
              <dt>Iterations</dt>
              <dd className="mono">
                <W e={r.why.iterations}>{r.iterations}</W>
              </dd>
            </div>
            <div>
              <dt>Instructions executed (I)</dt>
              <dd className="mono">
                <W e={r.why.instructions!}>{r.instructions}</W>
              </dd>
            </div>
            <div>
              <dt>Ideal cycles, I + N - 1</dt>
              <dd className="mono pl-big">
                <W e={r.why.cycles!}>{r.cycles}</W>
              </dd>
            </div>
          </dl>
        )
      ) : null}
      <Callout kind="trap" title="Hex and pseudo-instructions" cite="AY24/25 Q13; AY25/26 Q2">
        0x32 is 50, not 32. A line like bne $s0, 0, Loop is a pseudo-instruction, but the keys count it as one instruction. To check against a full trace, load P17a or P17b on the Pipeline diagram tab.
      </Callout>
    </div>
  )
}

function TimeBars({ r, unit }: { r: TimingResult; unit: string }) {
  const rows = (
    [
      ['Single-cycle', r.single],
      ['Multi-cycle', r.multi],
      ['Pipelined', r.pipelined],
    ] as [string, DesignTime | undefined][]
  ).filter((x): x is [string, DesignTime] => !!x[1])
  if (!rows.length) return null
  const max = Math.max(...rows.map(([, d]) => d.time))
  const best = Math.min(...rows.map(([, d]) => d.time))
  const lw = 100
  const rh = 26
  return (
    <svg className="pl-chart" viewBox={`0 0 ${lw + 420} ${rows.length * rh + 8}`} width={lw + 420} role="img" aria-label={rows.map(([n, d]) => `${n} ${fmt(d.time)} ${unit}`).join(', ')}>
      {rows.map(([n, d], i) => (
        <g key={n} transform={`translate(0 ${i * rh + 4})`}>
          <text x={lw - 8} y={rh / 2 + 4} textAnchor="end" className="pl-chart-label">
            {n}
          </text>
          <rect x={lw} y={3} width={(d.time / max) * 300} height={rh - 8} className={d.time === best ? 'pl-bar pl-bar-slow' : 'pl-bar'} />
          <text x={lw + (d.time / max) * 300 + 6} y={rh / 2 + 4} className="pl-chart-value">
            {fmt(d.time)} {unit}
          </text>
        </g>
      ))}
    </svg>
  )
}

type Detail = 'results' | 'loop' | 'rules'

const DETAILS: { value: Detail; label: string }[] = [
  { value: 'results', label: 'Results' },
  { value: 'loop', label: 'Loop ideal-cycle counter' },
  { value: 'rules', label: 'Course rules' },
]

export default function TimingTab({ intro }: { intro: ReactNode }) {
  const [s, setS] = useUrlState<TimingSettings>('tm', DEFAULT_TIMING)
  const set = <K extends keyof TimingSettings>(k: K, v: TimingSettings[K]) => setS({ ...s, [k]: v })
  const { input, errors } = useMemo(() => timingInput(s), [s])
  const r = useMemo(() => timing(input), [input])
  const ideal = idealCycles(input.instructions, input.stages)
  const u = s.unit || 'ns'
  const rows = (
    [
      ['Single-cycle', r.single],
      ['Multi-cycle', r.multi],
      ['Pipelined (ideal)', r.pipelined],
    ] as [string, DesignTime | undefined][]
  ).filter((x): x is [string, DesignTime] => !!x[1])
  const cols: Column<[string, DesignTime]>[] = [
    { key: 'n', header: 'Design', cell: ([n]) => n },
    { key: 'ct', header: `Cycle time (${u})`, align: 'right', cell: ([, d]) => <W e={d.why.cycleTime}>{fmt(d.cycleTime)}</W> },
    { key: 'c', header: 'Cycles', align: 'right', cell: ([, d]) => <W e={d.why.cycles}>{fmt(d.cycles)}</W> },
    { key: 't', header: `Time (${u})`, align: 'right', cell: ([, d]) => <W e={d.why.time}><strong>{fmt(d.time)}</strong></W> },
  ]
  const stageTimes = input.stageTimes ?? []
  const mixKeys: [keyof TimingSettings['mix'], string][] = [
    ['alu', 'R-type, addi (4)'],
    ['load', 'lw (5)'],
    ['store', 'sw (4)'],
    ['branch', 'beq, bne (3)'],
    ['jump', 'j (2)'],
  ]
  const fastest = rows.length ? rows.reduce((a, b) => (b[1].time < a[1].time ? b : a)) : undefined
  return (
    <Workspace
      title="Pipeline"
      lectures="L20 p30-34, L12 p35-38"
      intro={intro}
      toolbar={<Presets presets={TIMING_PRESETS.map((x) => ({ name: `${x.name} (${x.expect})`, source: x.source, value: x.value }))} onPick={(v) => setS(v)} />}
    >
      <div className="pl-command">
        <div className="pl-row pl-command-row">
          <NumberField label="Instructions executed (I)" value={s.instructions} min={0} onChange={(v) => set('instructions', v)} />
          <TextField label={`Stage times T1..TN (${u})`} value={s.stages} onChange={(v) => set('stages', v)} placeholder="2, 1, 2, 2, 1" width="12em" />
          <NumberField label={`Pipeline register delay Td (${u})`} value={s.td} min={0} step={0.05} onChange={(v) => set('td', v)} />
        </div>
        {errors.length ? <p className="pl-err">{errors.join('; ')}</p> : null}
        <details className="pl-machine">
          <summary>
            More inputs
            <span className="pl-machine-note">
              multi-cycle from {s.mode === 'cpi' ? `CPI ${s.cpi}` : 'the instruction mix'}, unit {u}
            </span>
          </summary>
          <div className="pl-machine-body">
            <div className="pl-row">
              {stageTimes.length ? null : <NumberField label="Stages N" value={s.n} min={1} onChange={(v) => set('n', v)} />}
              <TextField label="Time unit" value={s.unit} onChange={(v) => set('unit', v)} width="4em" />
              <TextField label={`Single-cycle cycle time, if given (${u})`} value={s.single} onChange={(v) => set('single', v)} placeholder="sum of stages" width="9em" />
              <TextField label={`Pipelined cycle time, if given (${u})`} value={s.pipe} onChange={(v) => set('pipe', v)} placeholder="max stage + Td" width="9em" />
            </div>
            <div className="pl-row">
              <Segmented
                label="Multi-cycle cycles from"
                value={s.mode}
                onChange={(v) => set('mode', v)}
                options={[
                  { value: 'cpi', label: 'Average CPI' },
                  { value: 'mix', label: 'Instruction mix' },
                ]}
              />
              {s.mode === 'cpi' ? (
                <NumberField label="Average CPI" value={s.cpi} min={1} step={0.1} onChange={(v) => set('cpi', v)} />
              ) : (
                mixKeys.map(([k, label]) => <NumberField key={k} label={`${label}`} value={s.mix[k]} min={0} onChange={(v) => setS({ ...s, mix: { ...s.mix, [k]: v } })} width="5em" />)
              )}
            </div>
            {s.mode === 'mix' ? <p className="pl-muted">Numbers in brackets are the stages each class uses when unused stages are skipped (AY23/24 S1 Q3 key).</p> : null}
          </div>
        </details>
      </div>
      <Board
        label="Stage times and total time"
        title="Total time for the workload"
        step={fastest ? `Fastest: ${fastest[0].replace(' (ideal)', '').toLowerCase()}` : undefined}
        foot={
          <Legend
            items={[
              { signal: 'data', label: 'stage time (solid: the slowest)' },
              { signal: 'stall', label: 'idle part of the cycle' },
            ]}
          />
        }
      >
        <div className="pl-timing">
          <div className="pl-dp-scroll">
            {rows.length ? <TimeBars r={r} unit={u} /> : <p className="pl-board-note">Give stage times or cycle times to compare designs.</p>}
          </div>
          <p className="pl-board-note">Single-cycle: I x (sum of stages). Multi-cycle: cycles x slowest stage. Pipelined: (I + N - 1) x (slowest stage + Td).</p>
          <p className="pl-board-sub">Stage times: the slowest one sets the clock</p>
          <StageChart stages={stageTimes} td={input.td ?? 0} unit={u} />
        </div>
      </Board>
      <Strip urlKey="pdm" label="Timing tables" tabs={DETAILS}>
        {(cur) =>
          cur === 'results' ? (
            <>
              {rows.length ? <DataTable columns={cols} rows={rows} compact /> : <p className="pl-muted">Give stage times or cycle times to compare designs.</p>}
              <dl className="pl-facts pl-gap-top">
                <div>
                  <dt>Pipelined cycles, I + N - 1</dt>
                  <dd className="mono">
                    <W e={ideal.why}>{ideal.cycles}</W>
                  </dd>
                </div>
                {r.multiClockGHz !== undefined && u === 'ns' ? (
                  <div>
                    <dt>Multi-cycle clock rate</dt>
                    <dd className="mono">
                      <W e={{ rule: 'Clock rate = 1 / cycle time; the cycle time is the slowest stage', working: `1 / ${fmt(Math.max(...stageTimes))} ns = ${fmt(r.multiClockGHz)} GHz`, cite: 'L20 p31; AY23/24 S1 Q2' }}>{fmt(r.multiClockGHz)} GHz</W>
                    </dd>
                  </div>
                ) : null}
                {r.speedup ? (
                  <div>
                    <dt>Speedup, single-cycle over pipelined</dt>
                    <dd className="mono">
                      <W e={r.speedup.why}>{fmt(r.speedup.value)}</W>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </>
          ) : cur === 'loop' ? (
            <LoopCounter />
          ) : (
            <div className="pl-notes">
              <Callout kind="trap" title="Remember the minus 1 and Td" cite="L20 p32">
                Pipelined cycles are I + N - 1, and the pipelined cycle time is the slowest stage plus the pipeline register delay Td.
              </Callout>
              <Callout kind="trap" title="Multi-cycle is not automatically faster" cite="L20 p31">
                In the lecture example it takes 920 ns against 800 ns for single-cycle.
              </Callout>
              <Callout kind="course" title="Throughput, not latency" cite="L20 p11; AY23/24 S1 Q11">
                Pipelining finishes the workload sooner; one instruction still takes N cycles. Speedup tends to N only with equal stages, Td = 0 and I much larger than N (L20 p33).
              </Callout>
              <Callout kind="course" title="Multi-cycle CPI" cite="L12 p37; AY23/24 S1 Q3">
                Multi-cycle is not covered in detail, so the CPI is given, or comes from a mix where each class skips the stages it does not use.
              </Callout>
            </div>
          )
        }
      </Strip>
    </Workspace>
  )
}
