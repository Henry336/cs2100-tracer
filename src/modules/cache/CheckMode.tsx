import { useMemo, useState } from 'react'
import type { Trace } from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Board, CommandBar, Options, PrimaryPill } from '../../ui/board'
import { Button, Callout, Chip, Legend, Segmented } from '../../ui/kit'
import {
  CHECK_ACCESSES,
  CHECK_LINES,
  CHECK_WORDS,
  EMPTY_ENTRIES,
  SLIPS,
  cellKey,
  markAll,
  normEntries,
  parseAnswer,
  tableCheckable,
  type AccessMark,
  type Entries,
  type LabelView,
  type Marking,
} from './check'
import { accessText, plural, type TagFmt } from './common'

/** Right or wrong as an icon with a name, so colour is never the only sign. */
function Mark({ ok }: { ok: boolean }) {
  return (
    <svg className={`ca-ck-icon ${ok ? 'is-ok' : 'is-bad'}`} viewBox="0 0 12 12" role="img" aria-label={ok ? 'right' : 'wrong'}>
      <path d={ok ? 'M2 6.5l2.5 2.5L10 3.5' : 'M3 3l6 6M9 3l-6 6'} />
    </svg>
  )
}

export default function CheckMode({
  trace,
  lv,
  setLv,
  tf,
  setTf,
  byAddr,
  onJump,
}: {
  trace: Trace
  lv: LabelView
  setLv: (v: LabelView) => void
  tf: TagFmt
  setTf: (v: TagFmt) => void
  byAddr: boolean
  /** Show this access in the stepper. */
  onJump: (index: number) => void
}) {
  const [raw, setRaw] = useUrlState<unknown>('ck', EMPTY_ENTRIES)
  const entries = useMemo(() => normEntries(raw), [raw])
  // What was marked: the answers and settings at the last Check. Editing after that hides the marks until Check again.
  const snap = JSON.stringify([entries, lv, tf, byAddr])
  const [checked, setChecked] = useState<{ trace: Trace; snap: string } | null>(null)
  const fresh = checked !== null && checked.trace === trace && checked.snap === snap
  const marking = useMemo(() => (fresh ? markAll(trace, entries, { lv, tf, byAddr }) : null), [fresh, trace, entries, lv, tf, byAddr])
  const g = trace.geometry
  const n = trace.frames.length
  const perAccess = n <= CHECK_ACCESSES
  const table = tableCheckable(g)
  const given = useMemo(() => parseAnswer(entries.acc).length, [entries.acc])
  const set = (patch: Partial<Entries>) => setRaw({ ...entries, ...patch })

  return (
    <>
      <Board
        title="Check my answers"
        step={marking ? <Score m={marking} n={perAccess ? n : 0} /> : undefined}
        note={marking ? undefined : 'Work the trace on paper, type what you got, then press Check. Nothing is shown until you do.'}
        tools={
          <>
            <Segmented
              label="Miss labels"
              value={lv}
              options={[
                { value: 'r12', label: 'R12', title: 'Repeat misses are conflict in DM and SA, capacity in FA (R12 p23-25)' },
                { value: 'l23', label: 'L23 p28', title: 'Compare with an equal-size fully associative LRU cache (L23 p28)' },
              ]}
              onChange={setLv}
            />
            <Segmented
              label="Bare tags in"
              value={tf}
              options={[
                { value: 'dec', label: 'Dec' },
                { value: 'hex', label: 'Hex' },
                { value: 'bin', label: 'Bin' },
              ]}
              onChange={setTf}
            />
          </>
        }
        foot={
          <Legend
            items={[
              { signal: 'hit', label: 'right' },
              { signal: 'miss', label: 'wrong' },
            ]}
          />
        }
      >
        <div className="ca-ck">
          {perAccess ? (
            <section>
              <h3 className="ca-h">Each access, in order</h3>
              <CommandBar
                id="ca-ck-acc"
                label="Results"
                value={entries.acc}
                onChange={(acc) => set({ acc })}
                placeholder="M(cold) H M(cold) M(conflict) H"
                aside={`${given} of ${n}`}
              />
              {marking ? <AccessMarks trace={trace} marks={marking.accesses} onJump={onJump} /> : null}
            </section>
          ) : (
            <p className="ca-muted">
              The per-access check takes traces of up to {CHECK_ACCESSES} accesses; this one has {n}.
            </p>
          )}
          <section>
            <h3 className="ca-h">Cache after the last access</h3>
            {table ? (
              <AnswerTable trace={trace} cells={entries.cells} setCell={(k, v) => set({ cells: { ...entries.cells, [k]: v } })} marks={marking?.cells} />
            ) : (
              <p className="ca-muted">
                The table check takes caches of up to {CHECK_LINES} blocks with up to {CHECK_WORDS} words each; this one has {plural(g.blocks, 'block')} of{' '}
                {plural(g.wordsPerBlock, 'word')}.
              </p>
            )}
          </section>
          <div className="ca-ck-actions">
            <PrimaryPill onClick={() => setChecked({ trace, snap })}>Check</PrimaryPill>
            {checked && !fresh ? <span className="ca-muted">Changed since the last check.</span> : null}
            <Button
              onClick={() => {
                setRaw(EMPTY_ENTRIES)
                setChecked(null)
              }}
            >
              Clear my answers
            </Button>
          </div>
          {marking ? <Verdict trace={trace} m={marking} onJump={onJump} /> : null}
        </div>
      </Board>
      <Options summary="How to type answers">
        <ul className="ca-ck-help">
          <li>
            Results: H or M per access, a miss optionally with its type, like <span className="mono">M(cold) H M conflict</span>. Types follow the Miss labels choice.
          </li>
          <li>Valid: 1 or 0. A blank valid bit counts as 0, and tag and words of an empty line are not marked.</li>
          <li>
            Tags: <span className="mono">0x81</span>, <span className="mono">0b101</span>, or bare digits read in the Bare tags choice.
          </li>
          <li>
            Words: <span className="mono">M[24]</span>, <span className="mono">M[0x1020]</span> or a plain byte address <span className="mono">24</span>. A stored value by its
            name, like <span className="mono">X</span>; a store the trace gives no name can also be written by its address, as the AY23/24 S1 Q20 key does.
          </li>
          {g.ways > 1 ? <li>Ways are marked in the order the options pick: first free way, or Way 0 holds the lower address.</li> : null}
        </ul>
      </Options>
    </>
  )
}

function Score({ m, n }: { m: Marking; n: number }) {
  const total = n + m.cellTotal
  const right = (n ? m.accessRight : 0) + m.cellRight
  return <span className={right === total ? 'ca-step-hit' : 'ca-step-miss'}>{`${right} of ${total} right`}</span>
}

function AccessMarks({ trace, marks, onJump }: { trace: Trace; marks: AccessMark[]; onJump: (i: number) => void }) {
  return (
    <ol className="ca-ck-marks" aria-label="Your result for each access">
      {marks.map((m) => (
        <li key={m.index}>
          <button
            type="button"
            className="ca-ck-mark"
            onClick={() => onJump(m.index)}
            aria-label={`Access ${m.index + 1}, ${accessText(trace.frames[m.index].access)}: ${m.ok ? 'right' : 'wrong'}. Show it in the simulator.`}
          >
            <Chip signal={m.ok ? 'hit' : 'miss'}>
              <Mark ok={m.ok} /> {m.index + 1}. {m.given ? `${m.given.r}${m.given.type ? ` ${m.given.type}` : ''}` : 'not given'}
            </Chip>
          </button>
        </li>
      ))}
    </ol>
  )
}

function Verdict({ trace, m, onJump }: { trace: Trace; m: Marking; onJump: (i: number) => void }) {
  const tooMany = m.extra > 0
  const wrongCells = m.cellTotal - m.cellRight
  const perAccess = trace.frames.length <= CHECK_ACCESSES
  return (
    <div className="ca-ck-verdict" aria-live="polite">
      {perAccess && m.firstWrong !== null ? (
        <p>
          First wrong access: <span className="mono">{m.firstWrong + 1}. {accessText(trace.frames[m.firstWrong].access)}</span>.{' '}
          <Button onClick={() => onJump(m.firstWrong!)}>Show access {m.firstWrong + 1} in the simulator</Button>
        </p>
      ) : perAccess ? (
        <p>Every access is right.</p>
      ) : null}
      {tooMany ? <p className="ca-muted">You gave {plural(m.extra, 'result')} more than the trace has; the extra ones are not marked.</p> : null}
      {m.cellTotal ? <p>{wrongCells ? `${plural(wrongCells, 'table cell')} wrong.` : 'Every table cell is right.'}</p> : null}
      {m.slips.length ? (
        <div className="ca-callouts">
          {m.slips.map((s) => (
            <Callout key={s} kind="trap" title={SLIPS[s].title} cite={SLIPS[s].cite}>
              {SLIPS[s].text}
            </Callout>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AnswerTable({
  trace,
  cells,
  setCell,
  marks,
}: {
  trace: Trace
  cells: Record<string, string>
  setCell: (k: string, v: string) => void
  marks?: Record<string, boolean>
}) {
  const g = trace.geometry
  const assoc = g.ways > 1
  const setName = g.mapping === 'direct' ? 'Index' : 'Set'
  const unit = g.mapping === 'full' ? 'Slot' : 'Way'
  const words = Array.from({ length: g.wordsPerBlock }, (_, w) => w)
  const input = (s: number, p: number, field: string, label: string, size: number) => {
    const k = cellKey(s, p, field)
    const mk = marks?.[k]
    return (
      <td key={k} className={`ca-ck-cell${mk === undefined ? '' : mk ? ' is-ok' : ' is-bad'}`}>
        <input
          className="ca-ck-in mono"
          value={cells[k] ?? ''}
          onChange={(e) => setCell(k, e.target.value)}
          size={size}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${setName} ${s}${assoc ? `, ${unit.toLowerCase()} ${p}` : ''}, ${label}`}
        />
        {mk === undefined ? null : <Mark ok={mk} />}
      </td>
    )
  }
  return (
    <div className="table-wrap">
      <table className="dtable dtable-compact ca-cache ca-ck-table">
        <thead>
          <tr>
            <th>{setName}</th>
            {assoc ? <th>{unit}</th> : null}
            <th title="Valid bit">V</th>
            <th>Tag</th>
            {words.map((w) => (
              <th key={w}>Word{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: g.sets * g.ways }, (_, i) => {
            const s = Math.floor(i / g.ways)
            const p = i % g.ways
            return (
              <tr key={i} className={assoc && p === 0 && s > 0 ? 'ca-ck-newset' : undefined}>
                <td className="mono">{p === 0 ? s : ''}</td>
                {assoc ? <td className="mono">{p}</td> : null}
                {input(s, p, 'v', 'valid bit', 1)}
                {input(s, p, 't', 'tag', 10)}
                {words.map((w) => input(s, p, `w${w}`, `word ${w}`, 9))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
