import { useMemo, type ReactNode } from 'react'
import { EXCITATION, FF_INPUTS, FLIP_FLOPS, excite, ffNext, type Bit, type FFType, type Sig, type StateGraph } from '../../core/sequential'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Segmented, Select, Workspace, type Column } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { useStepper } from '../../ui/stepper'
import { Bitv, Board, PlayBar, Scroll, Story, TabStrip, W, pick } from './common'
import { StateDiagram } from './StateDiagram'

const FF_TYPES: FFType[] = ['D', 'T', 'JK', 'SR']
const FF_LABEL: Record<FFType, string> = { D: 'D', T: 'T', JK: 'J-K', SR: 'S-R' }
const MOVES: [Bit, Bit][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]

/** One row of the characteristic table written out with Q, so every (inputs, Q) pair has its own Q+. */
interface FullRow {
  inputs: Bit[]
  q: Bit
  next: Sig
  why: { rule: string; working?: string; cite?: string }
  comment: string
}

export function fullCharacteristic(type: FFType): FullRow[] {
  const k = FF_INPUTS[type].length
  const rows: FullRow[] = []
  for (let v = 0; v < 1 << k; v++) {
    const inputs = Array.from({ length: k }, (_, i) => ((v >> (k - 1 - i)) & 1) as Bit)
    for (const q of [0, 1] as Bit[]) {
      const r = ffNext(type, inputs, q)
      rows.push({ inputs, q, next: r.next, why: r.why, comment: r.comment })
    }
  }
  return rows
}

/** Merge the rows that make one move Q to Q+: an input that differs between them becomes X. */
export function collapse(rows: FullRow[], q: Bit, n: Bit): { rows: FullRow[]; inputs: Sig[] } {
  const hit = rows.filter((r) => r.q === q && r.next === n)
  const k = hit[0]?.inputs.length ?? 0
  const inputs = Array.from({ length: k }, (_, i): Sig => (hit.every((r) => r.inputs[i] === hit[0].inputs[i]) ? hit[0].inputs[i] : 'X'))
  return { rows: hit, inputs }
}

/* ---------- Characteristic to excitation ---------- */

export function TablesView({ intro, switcher }: { intro: ReactNode; switcher: ReactNode }) {
  const [rawType, setType] = useUrlState<FFType>('ftt', 'JK')
  const [tab, setTab] = useUrlState<string>('fttab', 'excite')
  const type = pick(rawType, FF_TYPES, 'JK')
  const info = FLIP_FLOPS[type]
  const letters = FF_INPUTS[type]
  const rows = useMemo(() => fullCharacteristic(type), [type])
  const stepper = useStepper(MOVES.length)
  const k = Math.min(stepper.index, MOVES.length - 1)
  const [q, n] = MOVES[k]
  const merged = collapse(rows, q, n)
  const ex = excite(type, q, n)
  const moveText = (a: Bit, b: Bit) => `${a} to ${b}`

  const fullCols: Column<FullRow>[] = [
    ...letters.map((l, i) => ({ key: l, header: l, align: 'center' as const, mono: true, cell: (r: FullRow) => r.inputs[i] })),
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (r) => r.q },
    { key: 'n', header: 'Q+', align: 'center', mono: true, cell: (r) => <Bitv v={r.next} e={r.why} /> },
    { key: 'c', header: 'Action', cell: (r) => r.comment },
    { key: 'm', header: 'Move', cell: (r) => (r.next === 'X' ? 'unpredictable' : r.q === q && r.next === n ? <strong>{moveText(r.q, r.next as Bit)}</strong> : moveText(r.q, r.next as Bit)) },
  ]
  type ExRow = { q: Bit; n: Bit }
  const exCols: Column<ExRow>[] = [
    { key: 'q', header: 'Q', align: 'center', mono: true, cell: (r) => r.q },
    { key: 'n', header: 'Q+', align: 'center', mono: true, cell: (r) => r.n },
    ...letters.map((l, i) => ({ key: l, header: l, align: 'center' as const, mono: true, cell: (r: ExRow) => <Bitv v={EXCITATION[type][r.q][r.n][i]} e={excite(type, r.q, r.n).why} /> })),
  ]

  return (
    <Workspace
      title="Sequential circuits"
      lectures="L19, T09, R10"
      intro={intro}
      transport={<Transport stepper={stepper} label="move" describe={`Q ${moveText(q, n)}: ${letters.map((l, i) => `${l} = ${merged.inputs[i]}`).join(', ')}`} />}
    >
      <div className="seq-command">
        {switcher}
        <Segmented
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v)
            stepper.first()
          }}
          options={FF_TYPES.map((t) => ({ value: t, label: FF_LABEL[t], title: `${FLIP_FLOPS[t].name} (${FLIP_FLOPS[t].cite})` }))}
        />
      </div>

      <div className="seq-stage">
        <Board
          title={`${info.name}, characteristic to excitation`}
          step={`Move ${moveText(q, n)}`}
          play={<PlayBar stepper={stepper} label="Merge the rows" next={`Next: ${moveText(...MOVES[Math.min(k + 1, MOVES.length - 1)])}`} />}
          foot={<Legend items={[{ signal: 'path', label: 'rows that make this move' }, { signal: 'dontcare', label: 'X: either value' }]} />}
        >
          <div className="seq-cols">
            <DataTable
              compact
              columns={fullCols}
              rows={rows}
              rowSignal={(r) => (r.q === q && r.next === n ? 'path' : undefined)}
              caption={<W e={{ rule: 'The characteristic table gives Q+ from the inputs and Q.', working: info.equation, cite: `${info.cite}; L19 p44` }}>{`Characteristic table with Q: ${info.equation}`}</W>}
            />
            <DataTable
              compact
              columns={[
                { key: 'w', header: 'Row', cell: (r: { label: string; inputs: Sig[] }) => r.label },
                ...letters.map((l, i) => ({ key: l, header: l, align: 'center' as const, mono: true, cell: (r: { label: string; inputs: Sig[] }) => <Bitv v={r.inputs[i]} /> })),
              ]}
              rows={[...merged.rows.map((r) => ({ label: `${r.comment} row`, inputs: r.inputs as Sig[] })), { label: 'Excitation row', inputs: merged.inputs }]}
              rowSignal={(_, i) => (i === merged.rows.length ? 'path' : undefined)}
              caption={`Merging the rows for ${moveText(q, n)}`}
            />
          </div>
        </Board>
        <Story items={MOVES.map(([a, b], i) => ({ title: `Q ${moveText(a, b)}`, state: i === k ? 'now' : i < k ? 'past' : 'next', onPick: () => stepper.set(i) }))}>
          <div className="seq-explain">
            <p>
              {merged.rows.length === 1 ? 'Only one row' : `${merged.rows.length} rows`} of the characteristic table move Q from {q} to {n}.
              {merged.inputs.includes('X') ? ' An input that differs between them is free, so it becomes X.' : ' Every input is fixed.'}
            </p>
            <p className="mono seq-working">{ex.why.working}</p>
            <p className="seq-cite">{ex.why.cite}</p>
          </div>
        </Story>
      </div>

      <TabStrip
        label="Tables and notes"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            value: 'excite',
            label: 'Excitation table',
            body: (
              <DataTable
                compact
                columns={exCols}
                rows={MOVES.map(([a, b]) => ({ q: a, n: b }))}
                rowSignal={(r) => (r.q === q && r.n === n ? 'path' : undefined)}
                caption={<W e={{ rule: 'The excitation table gives the inputs that move Q to Q+. Use it for design.', working: 'X: either value works', cite: 'L19 p44-45' }}>{`${info.name}: inputs needed for each move`}</W>}
              />
            ),
          },
          {
            value: 'notes',
            label: 'Course notes',
            body: (
              <div className="seq-notes">
                <Callout kind="trap" title="Which table" cite="L19 p44; R10 p23">
                  Characteristic tables are for analysis (inputs and Q give Q+). Excitation tables are for design (Q and Q+ give the inputs).
                </Callout>
                {type === 'JK' ? (
                  <Callout kind="course" title="Why J-K has two X entries per row" cite="L19 p45">
                    Each move can be made by two commands, for example 0 to 1 by set (1, 0) or toggle (1, 1), so one input is always free.
                  </Callout>
                ) : null}
                {type === 'SR' ? (
                  <Callout kind="trap" title="S = R = 1" cite="L19 p18, p27">
                    S = R = 1 is not allowed, so it never appears as a way to make a move. That is why 0 to 1 needs exactly S = 1, R = 0.
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

/* ---------- Match the state diagrams (T09 SE2) ---------- */

/** The excitation table drawn as a two-state diagram: each arrow carries the inputs that make that move. */
export function ffGraph(type: FFType): StateGraph {
  const label = (q: Bit, n: Bit) => EXCITATION[type][q][n].map(String).join('')
  return {
    nodes: [0, 1].map((id) => ({ id, label: String(id), binary: '', used: true, sink: false, selfLoop: true, unreachable: false })),
    edges: MOVES.map(([a, b]) => ({ from: a, to: b, combos: [], label: label(a, b), fromUnused: false })),
    stateOutputs: false,
    layout: [],
    why: { rule: 'The excitation table as a state diagram.', cite: 'L19 p45; T09 SE2' },
  }
}

const PERMS: FFType[][] = (() => {
  const out: FFType[][] = []
  const go = (rest: FFType[], acc: FFType[]) => (rest.length ? rest.forEach((t, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, t])) : out.push(acc))
  go(FF_TYPES, [])
  return out
})()

const CLUE: Record<FFType, string> = {
  D: 'One input, and the label always equals the state the arrow goes to: D = Q+.',
  T: 'One input, and the label is 1 exactly on the arrows that change the state: T = 1 toggles.',
  JK: 'Two inputs, and 0 to 1 reads 1X: set (1, 0) and toggle (1, 1) both work.',
  SR: 'Two inputs, and 0 to 1 reads 10: only set works, because S = R = 1 is not allowed.',
}

export function MatchView({ intro, switcher }: { intro: ReactNode; switcher: ReactNode }) {
  const [rawOrder, setOrder] = useUrlState<number>('fqo', 9)
  const [rawAns, setAns] = useUrlState<string[]>('fqa', [])
  const [rawChecked, setChecked] = useUrlState<boolean>('fqc', false)
  const idx = Number.isInteger(rawOrder) ? Math.abs(rawOrder) % PERMS.length : 9
  const order = PERMS[idx]
  const answers = order.map((_, i) => pick(Array.isArray(rawAns) ? rawAns[i] : '', ['', ...FF_TYPES] as const, ''))
  const checked = rawChecked === true
  const right = order.filter((t, i) => answers[i] === t).length
  const graphs = useMemo(() => order.map(ffGraph), [order])
  const letter = (i: number) => String.fromCharCode(97 + i)
  const missing = answers.some((a) => !a)

  return (
    <Workspace title="Sequential circuits" lectures="L19, T09, R10" intro={intro}>
      <div className="seq-command">{switcher}</div>

      <Board
        title="Which flip-flop is each diagram?"
        step={checked ? <Chip signal={right === 4 ? 'hit' : 'miss'}>{right} of 4 right</Chip> : undefined}
        play={
          <div className="seq-board-play">
            <button type="button" className="seq-play" onClick={() => setChecked(true)} disabled={missing} title={missing ? 'Pick a flip-flop for every diagram first' : undefined}>
              Check my answers
            </button>
            <button
              type="button"
              className="seq-next"
              onClick={() => {
                setOrder((idx + 1 + Math.floor(Math.random() * (PERMS.length - 1))) % PERMS.length)
                setAns([])
                setChecked(false)
              }}
            >
              New order
            </button>
          </div>
        }
        foot={<span className="seq-muted">J-K, D, S-R and T, each used once (T09 SE2).</span>}
      >
        <div className="seq-quiz">
          {order.map((t, i) => (
            <div key={`${i}${t}`} className="seq-quiz-card">
              <Scroll label={`Diagram (${letter(i)})`}>
                <StateDiagram graph={graphs[i]} label={`Diagram (${letter(i)}): a two-state flip-flop diagram with labelled arrows`} />
              </Scroll>
              <div className="seq-row">
                <Select
                  label={`Diagram (${letter(i)}) is`}
                  value={answers[i]}
                  onChange={(v) => {
                    setAns(answers.map((a, j) => (j === i ? v : a)))
                    setChecked(false)
                  }}
                  options={[{ value: '', label: 'Choose a flip-flop' }, ...FF_TYPES.map((x) => ({ value: x, label: `${FF_LABEL[x]} flip-flop` }))]}
                />
                {checked ? (
                  <W e={{ rule: CLUE[t], working: `This is the ${FLIP_FLOPS[t].name}.`, cite: 'L19 p45; T09 SE2' }}>
                    <Chip signal={answers[i] === t ? 'hit' : 'miss'}>{answers[i] === t ? 'right' : 'not this one'}</Chip>
                  </W>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Board>

      <Callout kind="course" title="Reading these diagrams" cite="L19 p45; T09 SE2">
        Each diagram has the two states of one flip-flop, Q = 0 and Q = 1. An arrow label lists the inputs that make that move, X for don't care, in excitation table order.
      </Callout>
    </Workspace>
  )
}
