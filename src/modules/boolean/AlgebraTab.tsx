import { useEffect, useMemo, type ReactNode } from 'react'
import { checkSteps, LAWS, type Law, type StepCheck } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Presets, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { Board, Details, Flow, PlayBar } from '../../ui/board'
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
  const steps = res.steps
  const stepper = useStepper(steps.length, { intervalMs: 1400 })
  // Every edit shows the whole chain checked; Play then walks it from the first line.
  useEffect(() => stepper.last(), [text]) // eslint-disable-line react-hooks/exhaustive-deps
  const k = Math.min(stepper.index, Math.max(steps.length - 1, 0))
  const [okCol, lawCol, claimCol] = [cols[3], cols[4], cols[5]]

  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L13, L15 p4-6, T06 Q1, R07"
      intro={intro}
      toolbar={<Presets presets={STEPS_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p.text }))} onPick={(t) => setText(t)} />}
      transport={steps.length > 1 ? <Transport stepper={stepper} label="Line" describe={steps[k] ? `Line ${steps[k].line}: ${steps[k].expr ?? steps[k].text}` : undefined} /> : undefined}
    >
      <div className="bo-command">
        <CodeEditor label="Your steps, one expression per line (law in brackets or after //)" value={text} onChange={setText} rows={5} errors={errors} />
        {steps.flatMap((s) => s.warnings).length ? <IssueList text="" issues={steps.flatMap((s) => s.warnings)} kind="warning" /> : null}
      </div>

      <Board
        title="Your steps"
        step={steps[k] ? `Line ${steps[k].line}` : undefined}
        tools={
          <p>
              {steps.length < 2 ? (
                <span className="bo-muted">Write at least two lines.</span>
              ) : res.valid ? (
                <>
                  <Chip signal="hit">every step holds</Chip> <W e={res.why}>{res.why.working}</W>
                </>
              ) : (
                <>
                  <Chip signal="miss">a step does not hold</Chip> <span className="bo-muted">see the marked lines</span>
                </>
              )}
          </p>
        }
        play={<PlayBar stepper={stepper} start="Check each step" next={steps[k + 1] ? `line ${steps[k + 1].line}` : undefined} />}
      >
        <ol className="bo-chain" aria-label="Your steps, each checked against the line before">
          {steps.map((s, i) => {
            const bad = s.errors.length > 0 || s.equivalent === false
            return (
              <li key={i} className={i === k ? 'is-now' : i < k ? 'is-past' : 'is-next'}>
                {i > 0 ? (
                  <div className="bo-link">
                    <svg viewBox="0 0 16 34" width="16" height="34" aria-hidden="true">
                      <path d="M8 2V30M4 26l4 4 4-4" className={`bo-link-arrow${bad ? ' is-bad' : ''}`} />
                      {i === k ? <Flow id={k} paths={['M8 2V30']} tone={bad ? 'miss' : undefined} /> : null}
                    </svg>
                    <span className="bo-link-law">{lawCol.cell(s, i) || <span className="bo-muted">{s.errors.length ? 'cannot read' : ''}</span>}</span>
                  </div>
                ) : null}
                <button type="button" className={`bo-chain-line mono${bad ? ' is-bad' : ''}`} onClick={() => stepper.set(i)} aria-current={i === k ? 'step' : undefined}>
                  <span className="bo-chain-n">{s.line}</span>
                  {s.expr ?? s.text}
                </button>
                {i === k ? (
                  <div className="story-body">
                    <p>
                      {okCol.cell(s, i)}
                      {s.literals !== undefined ? <span className="bo-muted"> {s.literals} literals</span> : null}
                    </p>
                    {s.errors.length ? <p className="bo-bad">{s.errors[0].message}</p> : null}
                    {s.claimed ? <p>You wrote {claimCol.cell(s, i)}</p> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      </Board>

      <Details
        urlKey="lt"
        label="Tables for your steps"
        tabs={[
          { value: 'table', label: 'Step by step', body: <DataTable compact columns={cols} rows={steps} rowSignal={(s) => (s.errors.length || s.equivalent === false ? 'miss' : undefined)} /> },
          { value: 'laws', label: 'Laws and theorems', body: (
            <DataTable
              compact
              columns={[
                { key: 'n', header: 'Law', cell: (r: [Law, (typeof LAWS)[Law]]) => r[1].name },
                { key: 'f', header: 'Forms', cell: (r: [Law, (typeof LAWS)[Law]]) => <span className="bo-wrap">{r[1].forms}</span>, mono: true },
                { key: 'c', header: 'Slide', cell: (r: [Law, (typeof LAWS)[Law]]) => r[1].cite },
              ]}
              rows={lawRows}
            />
          ) },
          { value: 'notes', label: 'Traps and conventions', body: (
            <div className="bo-callouts">
              <Callout kind="trap" title="Check what X is before you use X + X' = 1" cite="T06 SE1">
                A∙B + A'∙B' is not 1. The complement of A∙B is A' + B'.
              </Callout>
              <Callout kind="course" title="One or two laws per line" cite="L13 p13; L15 p5-6">
                The slides name the law on each line. A line that needs more than two laws is still marked equal, but split it so each step names its law.
              </Callout>
              <Callout kind="beyond" title="How the checker decides">
                Equality is tested on every row of the truth table. The law names come from trying each L13 law once or twice on the line before. The course does not teach
                this search.
              </Callout>
            </div>
          ) },
        ]}
      />
    </Workspace>
  )
}
