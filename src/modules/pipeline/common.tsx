// Shared state and panels for the pipeline tabs. All inputs live in the URL (useUrlState).
import { useMemo, type ReactNode } from 'react'
import { parseMemInit, parseRegInit, type AsmError } from '../../core/mips'
import { normalizeOptions, tracePipeline, type CycleFrame, type Explain, type PipelineOptions, type PipelineTrace, type StreamOptions } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Callout, CodeEditor, NumberField, Panel, Presets, Segmented, TextField, Toggle, Why } from '../../ui/kit'
import { DEFAULT_PRESET, PRESETS, type FlatPreset, type RunSettings } from './presets'

/** A value whose derivation is one engine Explain. */
export function W({ e, children }: { e: Explain; children: ReactNode }) {
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function errorMap(errors: AsmError[]): Record<number, string> {
  const out: Record<number, string> = {}
  for (const e of errors) if (e.line > 0) out[e.line - 1] = out[e.line - 1] ? `${out[e.line - 1]}; ${e.message}` : e.message
  return out
}

/** Run settings text to engine stream options, with a plain error per field. */
export function parseRun(r: RunSettings): { stream: StreamOptions; errors: Partial<Record<keyof RunSettings, string>> } {
  const errors: Partial<Record<keyof RunSettings, string>> = {}
  const regs = parseRegInit(r.regs ?? '')
  if (regs.errors.length) errors.regs = regs.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')
  const mem = parseMemInit(r.mem ?? '')
  if (mem.errors.length) errors.mem = mem.errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')
  const outcomes: boolean[] = []
  for (const tok of (r.outcomes ?? '').split(/[\s,]+/).filter(Boolean)) {
    const t = tok.toLowerCase()
    if (t === 't' || t === 'taken' || t === '1') outcomes.push(true)
    else if (t === 'n' || t === 'nt' || t === 'not' || t === '0') outcomes.push(false)
    else errors.outcomes = `${tok} is not T (taken) or N (not taken)`
  }
  const stop = (r.stop ?? '').trim()
  const occ = Math.max(1, Math.floor(r.occ || 1))
  const stream: StreamOptions = {
    regs: regs.regs,
    mem: mem.mem,
    ...(outcomes.length && !errors.outcomes ? { outcomes } : {}),
    ...(stop ? { stopAfter: { instr: /^\d+$/.test(stop) ? Number(stop) : stop, occurrence: occ } } : {}),
  }
  return { stream, errors }
}

export interface ProgramState {
  src: string
  setSrc: (s: string) => void
  opt: Partial<PipelineOptions>
  options: PipelineOptions
  setOption: <K extends keyof PipelineOptions>(k: K, v: PipelineOptions[K]) => void
  run: RunSettings
  setRun: (r: RunSettings) => void
  runErrors: Partial<Record<keyof RunSettings, string>>
  stream: StreamOptions
  trace: PipelineTrace
  preset: FlatPreset | undefined
  /** True while the code, options and run settings still equal the loaded preset. */
  presetIntact: boolean
  load: (p: FlatPreset) => void
}

const sameRun = (a: RunSettings, b: RunSettings) => a.regs === b.regs && a.mem === b.mem && a.outcomes === b.outcomes && a.stop === b.stop && (a.occ || 1) === (b.occ || 1)
const sameOpt = (a: Partial<PipelineOptions>, b: Partial<PipelineOptions>) => JSON.stringify(normalizeOptions(a)) === JSON.stringify(normalizeOptions(b))

export function useProgram(): ProgramState {
  const [src, setSrc] = useUrlState('src', DEFAULT_PRESET.code)
  const [opt, setOpt] = useUrlState<Partial<PipelineOptions>>('opt', DEFAULT_PRESET.options)
  const [run, setRunRaw] = useUrlState<RunSettings>('run', DEFAULT_PRESET.run)
  const [pre, setPre] = useUrlState('pre', DEFAULT_PRESET.key)
  const [, setStep] = useUrlState('step', 0)
  const options = useMemo(() => normalizeOptions(opt), [opt])
  const parsed = useMemo(() => parseRun(run), [run])
  const trace = useMemo(() => tracePipeline(src, options, parsed.stream), [src, options, parsed])
  const preset = PRESETS.find((p) => p.key === pre)
  const presetIntact = !!preset && preset.code === src && sameOpt(preset.options, opt) && sameRun(preset.run, run)
  return {
    src, setSrc, opt, options,
    setOption: (k, v) => setOpt((o) => ({ ...normalizeOptions(o), [k]: v })),
    run, setRun: setRunRaw, runErrors: parsed.errors, stream: parsed.stream, trace, preset, presetIntact,
    load: (p) => {
      setSrc(p.code)
      setOpt(p.options)
      setRunRaw(p.run)
      setPre(p.key)
      setStep(0)
    },
  }
}

/** Line marks for the editor: lines in flight this cycle (data), waiting (stall) or on a wrong path (flush). */
export function lineMarks(trace: PipelineTrace, frame: CycleFrame | undefined): Record<number, 'data' | 'stall' | 'flush'> {
  const marks: Record<number, 'data' | 'stall' | 'flush'> = {}
  if (!frame) return marks
  const byUid = new Map(trace.rows.map((r) => [r.uid, r]))
  const lineOf = (uid: string) => {
    const r = byUid.get(uid)
    const ins = r && r.index !== null ? trace.stream.program.instructions[r.index] : undefined
    return ins && ins.line > 0 ? { line: ins.line - 1, wrong: r!.wrongPath } : undefined
  }
  for (const uid of Object.values(frame.stages)) {
    const l = uid ? lineOf(uid) : undefined
    if (l) marks[l.line] = l.wrong ? 'flush' : 'data'
  }
  for (const w of frame.waiting) {
    const l = lineOf(w.uid)
    if (l && !l.wrong) marks[l.line] = 'stall'
  }
  return marks
}

/** Code editor, presets and run settings (initial values, branch outcomes, where to stop). */
export function ProgramPanel({ p, marks, title = 'Program' }: { p: ProgramState; marks?: Record<number, 'data' | 'stall' | 'flush'>; title?: string }) {
  const { run, setRun, runErrors } = p
  const set = (k: keyof RunSettings, v: string | number) => setRun({ ...run, [k]: v })
  const lines = p.src.split('\n').length
  return (
    <Panel
      title={title}
      actions={<Presets presets={PRESETS.map((x) => ({ name: x.name, source: x.cite, value: x }))} onPick={(v) => p.load(v)} />}
    >
      <div className="pl-program">
        <CodeEditor label="MIPS code (labels, # i3 or #inst A tags name the rows)" value={p.src} onChange={p.setSrc} rows={Math.min(14, Math.max(6, lines))} marks={marks} errors={errorMap(p.trace.errors)} />
        {p.preset ? (
          <p className="pl-muted">
            {p.presetIntact ? 'Loaded: ' : 'Edited since loading: '}
            {p.preset.name} ({p.preset.cite}){p.preset.official ? '' : ', derived (no key)'}
          </p>
        ) : null}
        <details className="pl-details">
          <summary>Run settings: registers, memory, branch outcomes, where to stop</summary>
          <div className="pl-run">
            <label className="field pl-area">
              <span className="control-label">Initial registers (one $t0 = 5 per line)</span>
              <textarea className="mono" rows={3} value={run.regs} spellCheck={false} onChange={(e) => set('regs', e.target.value)} />
              {runErrors.regs ? <span className="pl-err">{runErrors.regs}</span> : null}
            </label>
            <label className="field pl-area">
              <span className="control-label">Initial memory (address: word, word, ...)</span>
              <textarea className="mono" rows={3} value={run.mem} spellCheck={false} onChange={(e) => set('mem', e.target.value)} />
              {runErrors.mem ? <span className="pl-err">{runErrors.mem}</span> : null}
            </label>
            <div className="pl-row">
              <TextField label="Branch outcomes in order (T or N; empty runs the code)" value={run.outcomes} onChange={(v) => set('outcomes', v)} placeholder="T N T" />
              <TextField label="Stop after instruction" value={run.stop} onChange={(v) => set('stop', v)} placeholder="i20 or 4" width="7em" />
              <NumberField label="Its execution number" value={run.occ || 1} min={1} onChange={(v) => set('occ', v)} />
            </div>
            {runErrors.outcomes ? <span className="pl-err">{runErrors.outcomes}</span> : null}
            <p className="pl-muted">
              With outcomes given, the code is walked without values, so the pipeline registers show register names only. The count stops at the last stage of the stop instruction, as AY23/24 S2 Q17 asks.
            </p>
          </div>
        </details>
      </div>
    </Panel>
  )
}

/** The hazard-handling options. `only` limits which ones show (the branches tab sets its own). */
export function OptionsPanel({ p, only }: { p: ProgramState; only?: (keyof PipelineOptions)[] }) {
  const o = p.options
  const show = (k: keyof PipelineOptions) => !only || only.includes(k)
  const hasJump = p.trace.stream.items.some((i) => i.cls === 'jump')
  const hasStore = p.trace.stream.items.some((i) => i.cls === 'store')
  return (
    <Panel title="Hazard handling">
      <div className="pl-options">
        {show('forwarding') ? <Toggle label="Forwarding (L21 p18)" checked={o.forwarding} onChange={(v) => p.setOption('forwarding', v)} /> : null}
        {show('branchStage') ? (
          <Segmented
            label="Branch decided in"
            value={o.branchStage}
            onChange={(v) => p.setOption('branchStage', v)}
            options={[
              { value: 'MEM', label: 'MEM', title: 'Base datapath, 3-cycle delay (L21 p30-32)' },
              { value: 'ID', label: 'ID (early branch)', title: 'Comparator in ID, 1-cycle delay (L21 p34-36)' },
            ]}
          />
        ) : null}
        {show('prediction') ? (
          <Segmented
            label="Branch prediction"
            value={o.prediction}
            onChange={(v) => p.setOption('prediction', v)}
            options={[
              { value: 'none', label: 'None (stall)', title: 'Wait until the branch is decided' },
              { value: 'not-taken', label: 'Predict not taken', title: 'L21 p40-42' },
              { value: 'taken', label: 'Predict taken (beyond the course)', title: 'Beyond the lectures; used by R11 Quiz Q7' },
            ]}
          />
        ) : null}
        {show('delayedBranch') ? <Toggle label="Delayed branch, 1 slot (L21 p46)" checked={o.delayedBranch} onChange={(v) => p.setOption('delayedBranch', v)} /> : null}
        {show('jumpStage') ? (
          <Segmented
            label={`j resolves in${hasJump ? '' : ' (no j in this code)'}`}
            value={o.jumpStage}
            onChange={(v) => p.setOption('jumpStage', v)}
            options={[
              { value: 'ID', label: 'ID (AY23/24 S2 Q17)', title: 'AY23/24 S2 Q17' },
              { value: 'MEM', label: 'MEM (T10 Additional)', title: 'T10 Additional Question' },
            ]}
          />
        ) : null}
        {show('storeData') ? (
          <Segmented
            label={`lw then sw of the loaded value${!hasStore ? ' (no sw in this code)' : !o.forwarding ? ' (needs forwarding on)' : ''}`}
            value={o.storeData}
            onChange={(v) => p.setOption('storeData', v)}
            options={[
              { value: 'ex', label: 'Data needed in EX (R11 p14, 1 stall)', title: 'Forwarding to EX only, as R11 p14 teaches: 1 stall' },
              { value: 'mem', label: 'MEM/WB to MEM path (not taught, 0 stalls)', title: 'Not taught: 0 stalls' },
            ]}
          />
        ) : null}
      </div>
      {show('jumpStage') ? <p className="pl-muted">The two keys disagree on j: AY23/24 S2 Q17 resolves it in ID, the T10 Additional Question in MEM.</p> : null}
      {o.prediction === 'taken' && show('prediction') ? (
        <Callout kind="beyond" title="Beyond the course">
          Predict taken is not taught (L21 p40 covers only predict not taken). It is here because R11 Quiz Q7 uses it.
        </Callout>
      ) : null}
    </Panel>
  )
}

export function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <Callout kind="course" title="Assumptions for this trace">
      <ul className="pl-list">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </Callout>
  )
}

/** What happens in one cycle, in plain sentences from the engine. */
export function EventList({ frame }: { frame: CycleFrame | undefined }) {
  if (!frame) return <p className="pl-muted">No cycles to show.</p>
  if (!frame.events.length) return <p className="pl-muted">Nothing special: every instruction moves on one stage.</p>
  return (
    <ul className="pl-events">
      {frame.events.map((e, i) => (
        <li key={i} className={eventClass(e)}>
          {e}
        </li>
      ))}
    </ul>
  )
}

function eventClass(e: string): string {
  if (/flush/i.test(e)) return 'pl-ev pl-ev-flush'
  if (/bubble|stays in|idle|HAZARD/i.test(e)) return 'pl-ev pl-ev-stall'
  if (/->|forward/i.test(e)) return 'pl-ev pl-ev-forward'
  if (/writes/.test(e)) return 'pl-ev pl-ev-data'
  return 'pl-ev'
}

/** Transport marks: flush beats stall beats forward. */
export function frameMarks(frames: CycleFrame[]): (string | undefined)[] {
  return frames.map((f) => {
    if (f.events.some((e) => /flush/i.test(e))) return 'flush'
    if (f.waiting.length || f.events.some((e) => /bubble/.test(e))) return 'stall'
    if (f.forwards.some((x) => x.from !== 'register file')) return 'forward'
    return undefined
  })
}

/** Short text for the transport bar. */
export function describeFrame(trace: PipelineTrace, f: CycleFrame | undefined): string {
  if (!f) return ''
  const name = (uid: string | null) => (uid ? (trace.rows.find((r) => r.uid === uid)?.name ?? '') : '')
  const flush = f.events.find((e) => /flush/i.test(e))
  if (flush) return flush
  if (f.waiting.length) return `${[...new Set(f.waiting.map((w) => name(w.uid)))].join(', ')} waiting`
  const fw = f.forwards.find((x) => x.from !== 'register file')
  if (fw) return fw.path
  return f.stages.WB ? `${name(f.stages.WB)} in WB` : `${name(f.stages.IF)} fetched`
}
