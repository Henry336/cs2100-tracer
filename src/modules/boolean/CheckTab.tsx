import { useMemo, type ReactNode } from 'react'
import {
  classify,
  lintAnswer,
  loopPieces,
  MAX_MIN_VARS,
  minimize,
  termsOf,
  termToCube,
  valuesOf,
  type Form,
  type LintCheck,
  type LintResult,
  type TermReport,
} from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Presets, Segmented, TextField, Toggle, Workspace, type Column, type Signal } from '../../ui/kit'
import { Board, CommandBar, Details, Options } from '../../ui/board'
import { FnCommand, IssueList, MapControls, VarsField, W, type FnInput } from './common'
import { KMapSvg, type LoopDraw } from './KMapSvg'
import { ANSWER_PRESETS } from './presets'

const VERDICT: Record<LintResult['verdict'], { text: string; signal: Signal }> = {
  correct: { text: 'correct and minimal', signal: 'hit' },
  format: { text: 'right function, exam format wrong', signal: 'stall' },
  'not-minimal': { text: 'equal, but not minimal', signal: 'stall' },
  wrong: { text: 'not the same function', signal: 'miss' },
  invalid: { text: 'cannot read the answer', signal: 'miss' },
}

const STATUS: Record<LintCheck['status'], { text: string; signal: Signal }> = {
  pass: { text: 'pass', signal: 'hit' },
  fail: { text: 'fail', signal: 'miss' },
  warn: { text: 'note', signal: 'stall' },
}

type CountKey = 'primes' | 'essentials' | 'covers'
const COUNTS: { key: CountKey; label: string }[] = [
  { key: 'primes', label: 'PIs' },
  { key: 'essentials', label: 'EPIs' },
  { key: 'covers', label: 'minimal answers' },
]

const KIND: Record<TermReport['kind'], string> = {
  prime: 'PI',
  implicant: 'implicant, not a PI',
  'dc-only': "only don't-cares",
  wrong: 'covers a cell it must not',
  never: 'always 0 (SOP) or 1 (POS)',
  constant: 'constant',
}

export default function CheckTab({ intro, input }: { intro: ReactNode; input: FnInput }) {
  const [rawAns, setAns] = useUrlState<unknown>('ans', '')
  const [rawAf, setAf] = useUrlState<Form | 'any'>('af', 'sop')
  const [fitb, setFitb] = useUrlState<boolean>('fitb', false)
  const [epi, setEpi] = useUrlState<boolean>('epi', false)
  const [reveal, setReveal] = useUrlState<boolean>('rv', false)
  const [cnt, setCnt] = useUrlState<Partial<Record<CountKey, string>>>('cnt', {})
  const ans = typeof rawAns === 'string' ? rawAns : ''
  const af: Form | 'any' = rawAf === 'pos' || rawAf === 'any' ? rawAf : 'sop'
  const { fn, layout } = input
  const lint = useMemo(() => (fn && ans.trim() ? lintAnswer(ans, fn, { form: af, fitb: fitb === true, epiFirst: epi === true }) : null), [fn, ans, af, fitb, epi])

  // Grouping the 1s or the 0s: the expected form, or what the typed answer is when either is allowed.
  const form: Form = af !== 'any' ? af : lint?.expr && fn && !classify(lint.expr, fn.vars).sop.yes ? 'pos' : 'sop'
  const min = useMemo(() => (fn && fn.vars.length <= MAX_MIN_VARS ? minimize(fn, form) : null), [fn, form])

  // The answer's terms drawn on the map, to see which PIs it uses.
  const drawn = useMemo(() => {
    if (!fn || !layout || !lint?.expr) return null
    const terms = lint.expr.kind === 'const' ? [] : termsOf(lint.expr, form === 'sop' ? 'or' : 'and')
    const loops: LoopDraw[] = []
    terms.forEach((t, i) => {
      const tc = termToCube(t, fn.vars, form)
      if (!tc || !('cube' in tc)) return
      const rep = lint.terms[i]
      const style = rep?.kind === 'prime' ? (rep.prime !== undefined && min?.primes[rep.prime].essential ? 'epi' : 'chosen') : rep?.kind === 'wrong' ? 'wrong' : rep?.kind === 'dc-only' ? 'ghost' : 'nonprime'
      loops.push({ key: `t${i}`, pieces: loopPieces(tc.cube, layout), style, label: `T${i + 1}` })
    })
    return { loops }
  }, [fn, layout, lint, form, min])

  // Claimed counts (the MCQ parts of every K-map question, e.g. AY23/24 S2 Q19(c)).
  const claims = min
    ? COUNTS.map((k) => {
        const raw = cnt?.[k.key]
        const typed = typeof raw === 'string' ? raw.trim() : ''
        const c = min.summary[k.key]
        return { ...k, typed, count: c, ok: typed === '' ? undefined : Number(typed) === c.value && c.exact !== false }
      })
    : []

  const checkCols: Column<LintCheck>[] = [
    { key: 's', header: 'Result', cell: (c) => <Chip signal={STATUS[c.status].signal}>{STATUS[c.status].text}</Chip> },
    { key: 'id', header: 'Check', cell: (c) => c.id },
    { key: 'm', header: 'Detail', cell: (c) => <span className="bo-wrap">{c.why ? <W e={c.why}>{c.message}</W> : c.message}</span> },
  ]
  const termCols: Column<TermReport>[] = [
    { key: 'n', header: 'Term', cell: (_, i) => `T${i + 1}`, mono: true },
    { key: 't', header: 'Typed', cell: (t) => t.text, mono: true },
    {
      key: 'k',
      header: 'What it is',
      cell: (t) => {
        const p = t.prime !== undefined ? min?.primes[t.prime] : undefined
        if (t.kind === 'prime' && p) return <W e={p.status}>{p.essential ? <Chip signal="path">EPI</Chip> : <span>PI, not essential</span>}</W>
        return <span className={t.kind === 'wrong' || t.kind === 'dc-only' || t.kind === 'never' ? 'bo-bad' : undefined}>{KIND[t.kind]}</span>
      },
    },
  ]
  const missedEpis = min && lint?.expr ? min.essentials.filter((id) => !lint.terms.some((t) => t.prime === id)) : []

  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L15 to L16, T06, past papers"
      intro={intro}
      toolbar={
        <Presets
          presets={ANSWER_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
          onPick={(p) => {
            input.setText(p.f)
            input.setOrient('rows')
            setAns(p.ans)
            setAf(p.af)
            setFitb(p.fitb)
            setEpi(p.epi === true)
          }}
        />
      }
    >
      <div className="bo-command">
        <FnCommand input={input} />
        <CommandBar id="bo-answer" label={`Your answer, ${fn?.name ?? 'F'} =`} value={ans} onChange={setAns} placeholder={af === 'pos' ? "(A+B')∙(C+D)" : "A'∙B + C∙D'"} />
        {lint && lint.checks.some((c) => c.at && c.status === 'fail') ? (
          <IssueList text={ans} issues={lint.checks.filter((c) => c.at && c.status === 'fail').map((c) => ({ code: c.id, message: c.message, at: c.at! }))} />
        ) : null}
        <Options summary="Answer format, variables and map layout">
          <div className="bo-row">
            <Segmented
              label="Expected form"
              value={af}
              onChange={setAf}
              options={[
                { value: 'sop', label: 'SOP' },
                { value: 'pos', label: 'POS' },
                { value: 'any', label: 'either' },
              ]}
            />
            <Toggle label="Exam fill-in-the-blank rules" checked={fitb === true} onChange={setFitb} hint="Only ' . + and brackets, no spaces, literals in alphabetical order (AY23/24 S2 Q19(d))" />
            <Toggle label="EPIs must come first" checked={epi === true} onChange={setEpi} hint="AY23/24 S2 Q19(d)" />
          </div>
          <div className="bo-row">
            <VarsField input={input} />
          </div>
          <MapControls input={input} showForm={false} />
        </Options>
      </div>

      {fn && layout ? (
        <Board
          title={<span className="mono">K-map of {fn.name}</span>}
          step={lint ? VERDICT[lint.verdict].text : 'Type an answer to check it'}
          tools={
            lint ? (
              <>
                <Chip signal={VERDICT[lint.verdict].signal}>{lint.verdict.replace('-', ' ')}</Chip>
                {lint.expr ? <span className="bo-muted">{lint.literals} literals</span> : null}
              </>
            ) : null
          }
          foot={
            <>
              {missedEpis.length > 0 && min ? (
                <p className="bo-status">
                  EPIs your answer does not use: <span className="mono">{missedEpis.map((id) => min.primes[id].term).join(', ')}</span>
                </p>
              ) : null}
              <Legend
                items={[
                  { signal: 'hit', label: '1' },
                  { signal: 'dontcare', label: "X, don't care" },
                  { signal: 'path', label: 'term that is an EPI' },
                  { signal: 'miss', label: 'wrong cell or wrong term' },
                ]}
              />
              <details className="bo-foot-more">
                <summary>Reading the loops</summary>
                <p>Thick dark loops are PIs that are not essential. Dashed loops are terms that are not PIs or cover only don't-cares.</p>
              </details>
            </>
          }
        >
          <KMapSvg
            layout={layout}
            values={valuesOf(fn)}
            loops={drawn?.loops ?? []}
            bad={lint?.differing}
            label={lint?.expr ? `K-map of ${fn.name} with the terms of your answer` : `K-map of ${fn.name}`}
          />
        </Board>
      ) : null}

      <Details
        urlKey="ct"
        label="Checks for your answer"
        tabs={[
          { value: 'checks', label: 'Checks', body: lint ? <DataTable compact columns={checkCols} rows={lint.checks} rowSignal={(c) => (c.status === 'fail' ? 'miss' : undefined)} /> : null },
          { value: 'terms', label: 'Your terms', body: lint?.terms.length ? <DataTable compact columns={termCols} rows={lint.terms} /> : null },
          {
            value: 'counts',
            label: 'Your counts',
            body: min ? (
              <div className="bo-counts">
                <p className="bo-tab-head">{`Grouping the ${form === 'sop' ? '1s' : '0s'}`}</p>
                <div className="bo-row">
                  {claims.map((k) => (
                    <TextField key={k.key} label={`Number of ${k.label}`} value={k.typed} onChange={(v) => setCnt({ ...cnt, [k.key]: v })} width="4em" />
                  ))}
                </div>
                {claims.some((k) => k.ok !== undefined) ? (
                  <ul className="bo-claims">
                    {claims.map((k) =>
                      k.ok === undefined ? null : (
                        <li key={k.key}>
                          {k.ok ? <Chip signal="hit">right</Chip> : <Chip signal="miss">wrong</Chip>} {k.typed} {k.label}
                          {reveal === true ? (
                            <span className="bo-muted">
                              {' '}
                              (<W e={k.count.why}>{k.count.exact === false ? `at least ${k.count.value}` : k.count.value}</W>)
                            </span>
                          ) : null}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="bo-muted">Count on your own map first. The answers stay hidden until you show them.</p>
                )}
                <div className="bo-row">
                  <Toggle label="Show a minimal answer and the counts" checked={reveal === true} onChange={setReveal} />
                  {reveal === true ? (
                    <span className="mono">
                      {fitb === true ? min.summary.fitb : min.summary.answer}{' '}
                      <span className="bo-muted">
                        ({min.summary.terms} terms, {min.summary.literals} literals)
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null,
          },
          {
            value: 'notes',
            label: 'Traps and conventions',
            body: (
              <div className="bo-callouts">
                <Callout kind="trap" title="Write the AND dot" cite="L13 p6; T06 p2; T06 Ans p1">
                  AB reads as a 2-bit value. Tutorials give zero marks for it, so write A∙B. Fill-in-the-blank answers use a full stop: A.B.
                </Callout>
                <Callout kind="trap" title="Every term should be a PI" cite="L15 p35, p38">
                  A minimal answer uses only PIs and every EPI. A term inside a bigger group, or one of only don't-cares, makes the answer longer.
                </Callout>
                <Callout kind="course" title="Fill-in-the-blank format" cite="AY23/24 S2 Q19(d)">
                  No spaces, only letters, ' . and +, and the literals inside each term in alphabetical order. Terms may be in any order unless EPIs are asked for first.
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
