// Past papers: every final and midterm question a tracer can load, grouped by paper,
// with one link that opens the right tracer with that question's preset filled in.
import { useMemo, useState } from 'react'
import { useUrlState } from '../../lib/url-state'
import { Board, CommandBar, Details } from '../../ui/board'
import { Chip, Legend, Select, Toggle, Workspace } from '../../ui/kit'
import { INDEX, TOPIC_LIST, type Erratum, type Question, type Topic } from './data'
import './papers.css'

type TopicPick = Topic | 'all'

const words = (q: Question) => [q.label, q.task, ...q.topics, ...q.links.map((l) => `${l.where} ${l.tool} ${l.preset}`)].join(' ').toLowerCase()

function matches(q: Question, find: string, topic: TopicPick, keyOnly: boolean): boolean {
  if (keyOnly && !q.key) return false
  if (topic !== 'all' && !q.topics.includes(topic)) return false
  const t = find.trim().toLowerCase()
  return !t || t.split(/\s+/).every((w) => words(q).includes(w))
}

const kindSignal = (k: Erratum['kind']) => (k === 'key slip' ? 'miss' : 'dontcare')

function ErrataNotes({ list }: { list: Erratum[] }) {
  return (
    <ul className="pp-errata">
      {list.map((e, i) => (
        <li key={i}>
          <Chip signal={kindSignal(e.kind)}>{e.kind}</Chip> {e.note} <span className="pp-src">({e.source})</span>
        </li>
      ))}
    </ul>
  )
}

function Links({ q }: { q: Question }) {
  const [first, ...rest] = q.links
  const pickNote = (exact: boolean) => (exact ? '' : ', pick it from the presets there')
  return (
    <div className="pp-links">
      <div className="pp-main-link">
        <a className="next-pill pp-open" href={first.href}>
          {`Open in ${first.where}`}
        </a>
        <span className="pp-preset">
          {first.tool}: {first.preset}
          {pickNote(first.exact)}
        </span>
      </div>
      {rest.length ? (
        <details className="pp-more">
          <summary>
            {rest.length} more preset{rest.length > 1 ? 's' : ''} for this question
          </summary>
          <ul>
            {rest.map((l) => (
              <li key={l.href}>
                <a href={l.href}>
                  {l.where}, {l.tool}: {l.preset}
                </a>
                {pickNote(l.exact)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export function Row({ q, exam, tried, onTried }: { q: Question; exam: boolean; tried: boolean; onTried: () => void }) {
  const open = !exam || tried
  return (
    <li className="pp-row">
      <div className="pp-head">
        <span className="pp-q">{q.label}</span>
        <span className="pp-topics">{q.topics.join(', ')}</span>
        {[...new Set(q.errata.map((e) => e.kind))].map((k) => (
          <Chip key={k} signal={kindSignal(k)}>
            {k}
          </Chip>
        ))}
      </div>
      <p className="pp-task">{q.task}</p>
      {open ? (
        <>
          <Links q={q} />
          {q.errata.length ? <ErrataNotes list={q.errata} /> : null}
        </>
      ) : (
        <button type="button" className="next-pill pp-tried" onClick={onTried}>
          I have tried it
        </button>
      )}
    </li>
  )
}

export default function PapersPage() {
  const [find, setFind] = useUrlState('q', '')
  const [rawTopic, setTopic] = useUrlState<TopicPick>('tp', 'all')
  const [keyOnly, setKeyOnly] = useUrlState('key', false)
  const [exam, setExam] = useUrlState('exam', false)
  // Not in the URL on purpose: a shared link should not arrive already unlocked.
  const [tried, setTried] = useState<Set<string>>(() => new Set())
  const topic: TopicPick = rawTopic === 'all' || TOPIC_LIST.includes(rawTopic) ? rawTopic : 'all'
  const findText = typeof find === 'string' ? find : ''

  const papers = useMemo(
    () => INDEX.papers.map((p) => ({ ...p, questions: p.questions.filter((q) => matches(q, findText, topic, keyOnly === true)) })).filter((p) => p.questions.length),
    [findText, topic, keyOnly],
  )
  const shown = papers.reduce((n, p) => n + p.questions.length, 0)
  const markTried = (id: string) => setTried((s) => new Set(s).add(id))
  const withErrata = INDEX.questions.filter((q) => q.errata.length)

  const intro = (
    <p>
      Every past final and midterm question a tracer can load. Open one to land in the tracer with that question already set up. Questions are paraphrased; work from your own copy of
      the paper.
    </p>
  )

  const tools = (
    <>
      <Select
        label="Topic"
        value={topic}
        onChange={setTopic}
        options={[{ value: 'all' as TopicPick, label: 'All topics' }, ...TOPIC_LIST.map((t) => ({ value: t as TopicPick, label: t }))]}
      />
      <Toggle label="Has official key" checked={keyOnly === true} onChange={setKeyOnly} hint="Only the four finals that come with an answer file" />
      <Toggle label="Exam mode" checked={exam === true} onChange={setExam} hint="Hide each link until you say you have tried the question" />
    </>
  )

  return (
    <Workspace title="Past papers" lectures="Finals AY15/16 to AY25/26, AY25/26 midterm" intro={intro}>
      <CommandBar id="pp-find" label="Find" value={findText} onChange={setFind} placeholder="Q19, stall, K-map, decoder" mono={false} aside={`${shown} of ${INDEX.questions.length}`} />
      <Board
        title="Questions"
        step={topic === 'all' ? 'All topics' : topic}
        note={exam === true ? 'Work the question on paper first, then press I have tried it to see the link.' : undefined}
        tools={tools}
        foot={
          <Legend
            items={[
              { signal: 'hit', label: 'official key' },
              { signal: 'miss', label: 'key slip' },
              { signal: 'dontcare', label: 'sources disagree' },
            ]}
          />
        }
      >
        {papers.length ? (
          <div className="pp-papers">
            {papers.map((p) => (
              <section key={p.id} className="pp-paper" aria-label={p.id}>
                <h2 className="pp-paper-title">
                  {p.id} {p.key ? <Chip signal="hit">official key</Chip> : <span className="pp-nokey">no key, presets are worked out</span>}
                </h2>
                <ul className="pp-list">
                  {p.questions.map((q) => (
                    <Row key={q.id} q={q} exam={exam === true} tried={tried.has(q.id)} onTried={() => markTried(q.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="pp-empty">No question matches. Clear the search or pick all topics.</p>
        )}
      </Board>
      <Details
        urlKey="pd"
        label="How to use and errata"
        tabs={[
          {
            value: 'how',
            label: 'How to use',
            body: (
              <ol className="pp-how">
                <li>Pick a topic or type a question number, a word or a tool name in Find.</li>
                <li>Try the question on paper first. Exam mode hides each link until you press I have tried it.</li>
                <li>Open the link: the tracer loads that question with its preset, so you can step through it and check each value.</li>
                <li>A few presets live inside a calculator. Those links open the right calculator, and the row names the preset to pick.</li>
                <li>Older papers have no answer file, so their presets are worked out. Errata notes say where an official key slips or where course sources disagree.</li>
              </ol>
            ),
          },
          {
            value: 'errata',
            label: 'Errata only',
            body: (
              <ul className="pp-list">
                {withErrata.map((q) => (
                  <li key={q.id} className="pp-row">
                    <div className="pp-head">
                      <span className="pp-q">{q.label}</span>
                      <span className="pp-topics">{q.topics.join(', ')}</span>
                    </div>
                    {exam !== true || tried.has(q.id) ? <ErrataNotes list={q.errata} /> : <p className="pp-task">Hidden in exam mode until you try this question.</p>}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
