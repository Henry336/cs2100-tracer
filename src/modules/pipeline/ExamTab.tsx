// Tab: the past-paper (a)-(e) template (AY24/25 Q19, AY25/26 Q19): answer all five parts, then compare.
import { useMemo, useState, type ReactNode } from 'react'
import { PIPELINE_PRESETS, tracePipeline, type Explain, type PipelineTrace } from '../../core/pipeline'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Select, TextField, Workspace, type Column } from '../../ui/kit'
import { Board, Notes, PresetPicker, Setup, Strip, W, plural, type ProgramState } from './common'
import { GridLegend, Reasons, cycleHint, stallHint } from './DiagramTab'
import { PipelineGrid } from './Grid'

type Part = 'a' | 'b' | 'c' | 'd' | 'e'
const PARTS: { k: Part; q: string }[] = [
  { k: 'a', q: 'Stall cycles without forwarding' },
  { k: 'b', q: 'Total cycles without forwarding' },
  { k: 'c', q: 'Total cycles with forwarding' },
  { k: 'd', q: 'Nops needed with forwarding (no hazard detection)' },
  { k: 'e', q: 'Total cycles with forwarding after the change' },
]

/** Split a source line into label, instruction and trailing comment (the comment keeps the row tag). */
const LINE = /^(\s*(?:[A-Za-z_][\w.]*:\s*)?)([^#]*?)(\s*#.*)?$/

/** Replace the instruction on a 1-based line, keeping its label and tag comment. */
export function replaceInstruction(src: string, line: number, text: string): string {
  const lines = src.split('\n')
  const m = LINE.exec(lines[line - 1] ?? '')
  if (!m || !text.trim()) return src
  lines[line - 1] = `${m[1]}${text.trim()}${m[3] ?? ''}`
  return lines.join('\n')
}

/** The single line where two sources differ, if exactly one does. */
export function changedLine(a: string, b: string): { line: number; text: string } | undefined {
  const x = a.split('\n')
  const y = b.split('\n')
  if (x.length !== y.length) return undefined
  const diff = x.map((l, i) => (l === y[i] ? -1 : i)).filter((i) => i >= 0)
  if (diff.length !== 1) return undefined
  const m = LINE.exec(y[diff[0]])
  return m ? { line: diff[0] + 1, text: m[2].trim() } : undefined
}

/** The paper's key, when the loaded preset is one of the (a)-(e) papers and the code is still the paper's. */
function paperKey(p: ProgramState) {
  const pre = p.preset ? PIPELINE_PRESETS.find((x) => x.id === p.preset!.id) : undefined
  const part = (k: Part) => pre?.parts.find((x) => x.label.startsWith(`(${k})`))
  if (!pre || !part('d')?.expect.nops) return undefined
  const base = pre.source.replace(/^\n/, '')
  const e = part('e')
  return {
    cite: pre.cite,
    intact: p.src === base,
    change: e?.source ? changedLine(base, e.source.replace(/^\n/, '')) : undefined,
    key: {
      a: part('a')?.expect.stallCycles,
      b: part('b')?.expect.cycles,
      c: part('c')?.expect.cycles,
      d: part('d')?.expect.nops?.reduce((s, n) => s + n.count, 0),
      e: e?.expect.cycles,
    } as Record<Part, number | undefined>,
  }
}

const nopCount = (t: PipelineTrace) => t.totals.nops.reduce((s, n) => s + n.count, 0)

/** The program with the nops written in, the way the papers want part (d). */
export function nopListing(src: string, t: PipelineTrace): string {
  const after = new Map(t.totals.nops.map((n) => [n.after, n.count]))
  const byLine = new Map<number, string>()
  t.stream.program.instructions.forEach((ins, k) => byLine.set(ins.line, t.stream.names[k]))
  return src
    .split('\n')
    .flatMap((l, i) => {
      const n = after.get(byLine.get(i + 1) ?? '') ?? 0
      const pad = /^\s+/.exec(l)?.[0] ?? '    '
      return [l, ...Array.from({ length: n }, () => `${pad}nop`)]
    })
    .join('\n')
}

type Detail = 'grids' | 'nops' | 'delay' | 'rules'

const DETAILS: { value: Detail; label: string }[] = [
  { value: 'grids', label: 'Grids' },
  { value: 'nops', label: '(d) Code with nops' },
  { value: 'delay', label: 'Extra delay per instruction' },
  { value: 'rules', label: 'Course rules' },
]

export default function ExamTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const [ans, setAns] = useUrlState<Record<Part, string>>('exa', { a: '', b: '', c: '', d: '', e: '' })
  const [chg, setChg] = useUrlState('chg', { line: 0, text: '' })
  const [grid, setGrid] = useUrlState('egs', 0)
  const [shown, setShown] = useState(false)
  const paper = paperKey(p)
  const base = p.options
  const changedSrc = chg.line > 0 && chg.text.trim() ? replaceInstruction(p.src, chg.line, chg.text) : undefined
  const hasBranch = p.trace.stream.items.some((i) => i.cls === 'branch')

  const t = useMemo(() => {
    const run = (src: string, fwd: boolean, extra = {}) => tracePipeline(src, { ...base, forwarding: fwd, ...extra }, p.stream)
    return {
      nf: run(p.src, false),
      f: run(p.src, true),
      e: changedSrc ? run(changedSrc, true) : undefined,
      // The AY23/24 S2 key's third column: forwarding, early branch, predict not taken.
      early: hasBranch ? run(p.src, true, { branchStage: 'ID', prediction: 'not-taken' }) : undefined,
    }
  }, [p.src, base, p.stream, changedSrc, hasBranch])

  const computed: Record<Part, { value?: number; why?: Explain; trace?: PipelineTrace }> = {
    a: { value: t.nf.totals.stallCycles, why: t.nf.totals.why.stallCycles, trace: t.nf },
    b: { value: t.nf.totals.cycles, why: t.nf.totals.why.cycles, trace: t.nf },
    c: { value: t.f.totals.cycles, why: t.f.totals.why.cycles, trace: t.f },
    d: { value: nopCount(t.f), why: t.f.totals.why.nops, trace: t.f },
    e: t.e?.ok ? { value: t.e.totals.cycles, why: t.e.totals.why.cycles, trace: t.e } : {},
  }

  const num = (s: string) => (/^\s*\+?\d+\s*$/.test(s) ? Number(s.replace('+', '')) : undefined)
  const hint = (k: Part, v: number): string => {
    const c = computed[k]
    if (!c.trace) return ''
    if (k === 'a') return stallHint(v, c.trace)
    if (k === 'd') return v === t.f.totals.stallCycles && v !== c.value ? 'That counts every stall cycle. Nops replace only the data stalls left with forwarding.' : 'One nop per data stall cycle left with forwarding: usually one after each lw whose value is used by the next instruction (L21 p19-20).'
    return cycleHint(v, c.trace)
  }
  const lines = useMemo(() => {
    const seen = new Set<number>()
    return p.trace.stream.program.instructions.flatMap((ins, k) => {
      if (ins.line <= 0 || seen.has(ins.line)) return []
      seen.add(ins.line)
      return [{ value: String(ins.line), label: `${p.trace.stream.names[k]}: ${p.trace.stream.texts[k] || ins.text}` }]
    })
  }, [p.trace])

  type Row = (typeof PARTS)[number]
  const cols: Column<Row>[] = [
    { key: 'p', header: 'Part', cell: (r) => `(${r.k})`, mono: true },
    { key: 'q', header: 'Question', cell: (r) => r.q },
    { key: 'y', header: 'Yours', align: 'right', mono: true, cell: (r) => ans[r.k] || '-' },
    {
      key: 'c',
      header: 'Computed',
      align: 'right',
      cell: (r) => {
        const c = computed[r.k]
        return c.value === undefined || !c.why ? <span className="pl-muted">{r.k === 'e' ? 'set a change' : '-'}</span> : <W e={c.why}><strong>{c.value}</strong></W>
      },
    },
    ...(paper?.intact
      ? [{ key: 'k', header: 'Key', align: 'right' as const, mono: true, cell: (r: Row) => (paper.key[r.k] === undefined ? '-' : String(paper.key[r.k])) }]
      : []),
    {
      key: 'v',
      header: 'Verdict',
      cell: (r) => {
        const v = num(ans[r.k])
        const c = computed[r.k].value
        if (v === undefined || c === undefined) return null
        return v === c ? <Chip signal="hit">correct</Chip> : (
          <span className="pl-verdict">
            <Chip signal="miss">not {v}</Chip> {hint(r.k, v)}
          </span>
        )
      },
    },
  ]

  // Per-instruction delay, settings side by side (AY23/24 S2 key layout).
  const settings: { label: string; tr: PipelineTrace }[] = [
    { label: 'No forwarding', tr: t.nf },
    { label: 'Forwarding', tr: t.f },
    ...(t.early ? [{ label: 'Forwarding, early branch, predict not taken', tr: t.early }] : []),
    ...(t.e?.ok ? [{ label: '(e) after the change, forwarding', tr: t.e }] : []),
  ]
  const delayCols: Column<number>[] = [
    { key: 'n', header: 'Instruction', mono: true, cell: (i) => `${t.f.instructions[i].name} ${t.f.instructions[i].text}` },
    ...settings.map((s, k) => ({
      key: `s${k}`,
      header: s.label,
      align: 'right' as const,
      mono: true,
      cell: (i: number) => {
        const x = s.tr.instructions[i]
        if (!x || x.name !== t.f.instructions[i].name) return '-'
        return <W e={x.delayWhy}>{x.delay ? `+${x.delay}` : '0'}</W>
      },
    })),
  ]
  const ok = t.nf.ok && t.f.ok
  const g = settings[Math.min(grid, settings.length - 1)]
  const later = <p className="pl-muted">Shown after you check your answers.</p>

  return (
    <Workspace title="Pipeline" lectures="AY24/25 Q19, AY25/26 Q19, R11 Addendum" intro={intro} toolbar={<PresetPicker p={p} />}>
      <Setup p={p} only={['branchStage', 'prediction', 'delayedBranch', 'jumpStage', 'storeData']} />
      <Board label="The five exam parts" title="Your answers" step={shown ? 'Checked' : undefined}>
        <div className="pl-exam">
          <p className="pl-board-note">Work each part on paper first.</p>
          <div className="pl-exam-fields">
            {PARTS.map((x) => (
              <TextField key={x.k} label={`(${x.k}) ${x.q}`} value={ans[x.k]} onChange={(v) => setAns({ ...ans, [x.k]: v })} width="5em" />
            ))}
          </div>
          <details className="pl-details">
            <summary>
              (e) The one-instruction change:{' '}
              <span className="mono">{changedSrc ? `line ${chg.line}, ${chg.text.trim()}` : 'none set'}</span>
            </summary>
            <div className="pl-row">
              <Select label="Instruction to change" value={String(chg.line)} options={[{ value: '0', label: 'none' }, ...lines]} onChange={(v) => setChg({ ...chg, line: Number(v) })} />
              <TextField label="New instruction" value={chg.text} onChange={(v) => setChg({ ...chg, text: v })} placeholder="sub $s5, $t1, $t2" width="14em" />
              {paper?.change && paper.intact ? (
                <Button onClick={() => setChg(paper.change!)}>Use the paper's change ({paper.cite.split(';')[0]})</Button>
              ) : null}
            </div>
            {!changedSrc ? <p className="pl-muted">The label and the row tag stay.</p> : null}
          </details>
          {t.e && !t.e.ok ? <p className="pl-err">The changed line does not assemble: {t.e.errors.map((e) => e.message).join('; ')}</p> : null}
          {!ok ? <p className="pl-err">Fix the code to run the template.</p> : null}
        </div>
        <div className="pl-board-play">
          <button type="button" className="pl-play" onClick={() => setShown(true)} disabled={!ok}>
            Check my answers
          </button>
          {shown ? (
            <button type="button" className="pl-next" onClick={() => setShown(false)}>
              Hide answers
            </button>
          ) : null}
        </div>
        {ok && shown ? (
          <div className="pl-exam-results">
            <DataTable columns={cols} rows={PARTS} compact />
            <p className="pl-board-note">
              Ideal is I + 4 = <W e={t.f.totals.why.ideal}>{t.f.totals.ideal}</W> for {plural(t.f.totals.instructions, 'instruction')}. Without forwarding, {plural(t.nf.totals.stallEvents, 'instruction')} wait, for {plural(t.nf.totals.stallCycles, 'stall cycle')} in all.
              {paper && !paper.intact ? ` The code differs from ${paper.cite}, so the key is hidden.` : ''}
            </p>
          </div>
        ) : null}
      </Board>
      <Strip urlKey="pde" label="Worked material" tabs={DETAILS}>
        {(cur) =>
          cur === 'rules' ? (
            <div className="pl-notes">
              <Callout kind="trap" title="Stall cycles, not stall events" cite="AY24/25 Q19 key; AY25/26 Q19 key">
                AY24/25 words its answer as 2 stalls of 2 cycles; AY25/26 as 5 stalls of 1 cycle. Both mean stall cycles, so give the cycle count.
              </Callout>
              <Callout kind="course" title="Same five questions every year" cite="R11 Addendum p3-8">
                Read one grid without forwarding and one with it, and you have (a) to (d). Part (e) changes one instruction, which can add or remove a dependency.
              </Callout>
              <Notes notes={t.f.notes} />
            </div>
          ) : !ok || !shown ? (
            later
          ) : cur === 'nops' ? (
            <>
              <pre className="pl-code mono">{nopListing(p.src, t.f)}</pre>
              <p className="pl-muted">
                <W e={t.f.totals.why.nops}>{nopCount(t.f) ? plural(nopCount(t.f), 'nop') : 'No nops'}</W> with forwarding and no hazard detection unit.
              </p>
            </>
          ) : cur === 'delay' ? (
            <>
              <DataTable columns={delayCols} rows={t.f.instructions.map((_, i) => i)} compact />
              <p className="pl-muted pl-gap-top">Each +n is WB minus (previous WB + 1), as in the AY23/24 S2 Q17 key.</p>
            </>
          ) : (
            <div className="pl-exam-grid">
              <div className="pl-row">
                <Select label="Setting" value={String(settings.indexOf(g))} options={settings.map((s, k) => ({ value: String(k), label: `${s.label}: ${plural(s.tr.totals.cycles, 'cycle')}` }))} onChange={(v) => setGrid(Number(v))} />
              </div>
              <GridLegend forwarding />
              <PipelineGrid trace={g.tr} compact label={`${g.label} pipeline diagram`} />
              <details className="pl-details pl-gap-top">
                <summary>Why each instruction waits</summary>
                <Reasons trace={g.tr} />
              </details>
            </div>
          )
        }
      </Strip>
    </Workspace>
  )
}
