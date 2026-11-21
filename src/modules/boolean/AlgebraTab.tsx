import { useMemo, type ReactNode } from 'react'
import { checkSteps, LAWS, type Law, type StepCheck } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Panel, Presets, Workspace, type Column } from '../../ui/kit'
import { IssueList, W } from './common'
import { STEPS_PRESETS } from './presets'

const lawNames = (ls: Law[]) => ls.map((l) => LAWS[l].name).join(' + ')

export default function AlgebraTab({ intro }: { intro: ReactNode }) {
  const [raw, setText] = useUrlState<unknown>('st', STEPS_PRESETS[1].text)
  const text = typeof raw === 'string' ? raw : ''
  const res = useMemo(() => checkSteps(text), [text])

  // Map each step back to its 0-based editor line for the gutter.
  const errors: Record<number, string> = {}
  for (const s of res.steps) {
    if (s.errors.length) errors[s.line - 1] = s.errors[0].message
    else if (s.equivalent === false) errors[s.line - 1] = 'not equal to the line before'
    else if (s.claimMatches === false) errors[s.line - 1] = `equal, but not by ${s.claimed}`
  }

  const cols: Column<StepCheck>[] = [
    { key: 'l', header: 'Line', cell: (s) => s.line, mono: true, align: 'right' },
    { key: 'e', header: 'Expression', cell: (s) => s.expr ?? s.text, mono: true },
    { key: 'n', header: 'Lits', cell: (s) => s.literals ?? '', align: 'right' },
    {
      key: 'ok',
      header: 'Equal to the line before',
      cell: (s, i) =>
        s.errors.length ? (
          <Chip signal="miss">cannot read</Chip>
        ) : i === 0 || s.equivalent === undefined ? (
          <span className="bo-muted">start</span>
        ) : s.equivalent ? (
          <W e={{ rule: 'Both lines agree on every row of the truth table.', cite: 'L13 p7-8, p14' }}>
            <Chip signal="hit">equal</Chip>
          </W>
        ) : (
          <W e={s.why}>
            <Chip signal="miss">
              not equal at{' '}
              {s.counterexample
                ? Object.entries(s.counterexample.assignment)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' ')
                : '?'}
            </Chip>
          </W>
        ),
    },
    {
      key: 'law',
      header: 'Law that does it',
      cell: (s) =>
        s.laws === undefined ? (
          ''
        ) : s.laws === null ? (
          <W e={s.why}>
            <span className="bo-muted">more than two laws</span>
          </W>
        ) : s.laws.length === 0 ? (
          <span className="bo-muted">same expression</span>
        ) : (
          <W e={s.why}>{lawNames(s.laws)}</W>
        ),
    },
    {
      key: 'c',
      header: 'You wrote',
      cell: (s) =>
        s.claimed ? (
          <span>
            {s.claimed}{' '}
            {s.claimMatches === true ? <Chip signal="hit">matches</Chip> : s.claimMatches === false ? <Chip signal="miss">different law</Chip> : null}
          </span>
        ) : (
          ''
        ),
    },
  ]

  const lawRows = Object.entries(LAWS) as [Law, (typeof LAWS)[Law]][]

  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L13, L15 p4-6, T06 Q1, R07"
      intro={intro}
      toolbar={<Presets presets={STEPS_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p.text }))} onPick={(t) => setText(t)} />}
      inspector={
        <Panel flush title="Laws and theorems">
          <DataTable
            compact
            columns={[
              { key: 'n', header: 'Law', cell: (r: [Law, (typeof LAWS)[Law]]) => r[1].name },
              { key: 'f', header: 'Forms', cell: (r: [Law, (typeof LAWS)[Law]]) => <span className="bo-wrap">{r[1].forms}</span>, mono: true },
              { key: 'c', header: 'Slide', cell: (r: [Law, (typeof LAWS)[Law]]) => r[1].cite },
            ]}
            rows={lawRows}
          />
        </Panel>
      }
    >
      <Panel title="Your steps">
        <CodeEditor label="One expression per line. Add the law in brackets at the end, or after //." value={text} onChange={setText} rows={8} errors={errors} />
        <p className="bo-verdict">
          {res.steps.length < 2 ? (
            <span className="bo-muted">Write at least two lines.</span>
          ) : res.valid ? (
            <>
              <Chip signal="hit">every step holds</Chip>{' '}
              <W e={res.why}>{res.why.working}</W>
            </>
          ) : (
            <>
              <Chip signal="miss">a step does not hold</Chip> <span className="bo-muted">see the marked lines</span>
            </>
          )}
        </p>
        {res.steps.flatMap((s) => s.warnings).length ? <IssueList text="" issues={res.steps.flatMap((s) => s.warnings)} kind="warning" /> : null}
      </Panel>
      <Panel flush title="Step by step">
        <DataTable columns={cols} rows={res.steps} rowSignal={(s) => (s.errors.length || s.equivalent === false ? 'miss' : undefined)} />
      </Panel>
      <div className="bo-callouts">
        <Callout kind="trap" title="Check what X is before you use X + X' = 1" cite="T06 SE1">
          A∙B + A'∙B' is not 1: the complement of A∙B is A' + B'. Try the preset to see the counterexample row.
        </Callout>
        <Callout kind="course" title="One or two laws per line" cite="L13 p13; L15 p5-6">
          The slides name the law used on each line. A line this checker cannot explain with one or two laws is still marked equal if it is, but split it so each step
          names its law.
        </Callout>
        <Callout kind="beyond" title="How the checker decides">
          Equality is tested on every row of the truth table. The law names come from trying each L13 law once or twice on the line before. That search is a tool,
          not a method the course teaches.
        </Callout>
      </div>
    </Workspace>
  )
}
