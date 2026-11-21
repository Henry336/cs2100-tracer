// Tab 4: fill in the control row yourself, then check it (T05 Q1 style; L12 p26, p34).
import { useState, type ReactNode } from 'react'
import {
  COURSE_SUBSET, MAIN_CONTROL, NEVER_X, SIGNAL_ORDER, T05_ORDER, aluControlTable, gradeControlRow,
  type Bit, type QuizVerdict, type SignalName,
} from '../../core/datapath'
import { bin } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Board, Details, Options, PrimaryPill } from '../../ui/board'
import { Button, Callout, Chip, DataTable, Legend, Segmented, Select, TextField, Workspace, type Signal } from '../../ui/kit'
import { ExplainText } from './common'

type Order = 'L12' | 'T05'
type Cell = '' | '0' | '1' | 'X'

const VERDICT: Record<QuizVerdict, { signal: Signal; text: string; short: string }> = {
  right: { signal: 'hit', text: 'right', short: 'right' },
  accepted: { signal: 'dontcare', text: 'accepted, the table has X', short: 'accepted' },
  wrong: { signal: 'miss', text: 'wrong', short: 'wrong' },
  blank: { signal: 'miss', text: 'blank', short: 'blank' },
}

/** The instruction being quizzed: its control row and ALUcontrol from the course tables. */
function keyFor(mnemonic: string) {
  const ins = COURSE_SUBSET.find((c) => c.mnemonic === mnemonic) ?? COURSE_SUBSET[0]
  const row = MAIN_CONTROL.find((m) => m.opcode === ins.opcode)!.row
  const aluControl = aluControlTable(`${row.ALUop1}${row.ALUop0}`, ins.funct ?? 0)!
  return { ins, row, aluControl }
}

function QuizBody({ mnemonic, order }: { mnemonic: string; order: Order }) {
  const { ins, row, aluControl } = keyFor(mnemonic)
  const [answer, setAnswer] = useState<Partial<Record<SignalName, Cell>>>({})
  const [alu, setAlu] = useState('')
  const [checked, setChecked] = useState(false)
  const given = Object.fromEntries(Object.entries(answer).filter(([, v]) => v !== '').map(([k, v]) => [k, v === 'X' ? 'X' : (Number(v) as 0 | 1)])) as Partial<Record<SignalName, Bit>>
  const cells = gradeControlRow(row, aluControl, given, alu)
  const score = cells.filter((c) => c.verdict === 'right' || c.verdict === 'accepted').length
  // T05 Q1 asks for ALUop as one 2-bit column; the quiz keeps its two bits as separate cells in both orders.
  const signals: SignalName[] = order === 'T05' ? T05_ORDER.flatMap<SignalName>((s) => (s === 'ALUop' ? (['ALUop1', 'ALUop0'] as const) : s === 'ALUcontrol' ? [] : [s])) : SIGNAL_ORDER
  const aluCell = cells.at(-1)!
  const ordered = [...signals.map((s) => cells.find((c) => c.signal === s)!), aluCell]
  const set = (s: SignalName, v: Cell) => {
    setAnswer((a) => ({ ...a, [s]: v }))
    setChecked(false)
  }
  const reveal = () => {
    setAnswer(Object.fromEntries(SIGNAL_ORDER.map((s) => [s, String(row[s]) as Cell])))
    setAlu(aluControl)
    setChecked(true)
  }
  // Marks appear only after checking, so nothing on the page gives the answer away first.
  const mark = (v: QuizVerdict) => (checked ? <Chip signal={VERDICT[v].signal}>{VERDICT[v].short}</Chip> : null)

  return (
    <>
      <Board
        title={`Fill in the control row for ${ins.mnemonic}`}
        step={checked ? `${score} of ${cells.length}` : undefined}
        note={
          <span className="mono">
            opcode {bin(ins.opcode, 6)}
            {ins.funct !== undefined ? `, funct ${bin(ins.funct, 6)}` : ''}
          </span>
        }
        tools={<span className="dp-cite">T05 Q1</span>}
        play={
          <div className="board-play">
            <PrimaryPill onClick={() => setChecked(true)}>Check my answers</PrimaryPill>
            <button type="button" className="next-pill" onClick={reveal}>
              Show the answer
            </button>
            <button type="button" className="next-pill" onClick={() => { setAnswer({}); setAlu(''); setChecked(false) }}>
              Clear
            </button>
          </div>
        }
        foot={checked ? <Legend items={[{ signal: 'hit', label: 'right' }, { signal: 'dontcare', label: 'accepted, the table has X' }, { signal: 'miss', label: 'wrong or blank' }]} /> : undefined}
      >
        <div className="dp-quiz">
          {signals.map((s) => (
            <div key={s} className="dp-quiz-cell">
              <Select<Cell>
                label={s}
                value={answer[s] ?? ''}
                onChange={(v) => set(s, v)}
                options={[{ value: '', label: '?' }, { value: '0', label: '0' }, { value: '1', label: '1' }, { value: 'X', label: 'X' }]}
              />
              {mark(cells.find((c) => c.signal === s)!.verdict)}
            </div>
          ))}
          <div className="dp-quiz-cell dp-quiz-wide">
            <TextField label="ALUcontrol (4 bits)" value={alu} onChange={(v) => { setAlu(v); setChecked(false) }} mono width="6em" placeholder="0000" />
            {mark(aluCell.verdict)}
          </div>
        </div>
      </Board>
      <Details
        urlKey="qdt"
        label="Marking"
        tabs={[
          {
            value: 'marks',
            label: `Marked: ${score} of ${cells.length}`,
            body: checked ? (
              <div className="dp-stack">
                <DataTable
                  compact
                  columns={[
                    { key: 's', header: 'Signal', cell: (c) => c.signal },
                    { key: 'g', header: 'Yours', mono: true, align: 'center', cell: (c) => c.given || '?' },
                    { key: 'k', header: 'Table', mono: true, align: 'center', cell: (c) => c.key },
                    { key: 'v', header: 'Mark', cell: (c) => <Chip signal={VERDICT[c.verdict].signal}>{VERDICT[c.verdict].text}</Chip> },
                    { key: 'w', header: 'Why', cell: (c) => <ExplainText e={c.why} /> },
                  ]}
                  rows={ordered}
                  caption="Main control from L12 p34, ALUcontrol from L12 p26"
                />
                <Callout kind="trap" cite="L12 p34, L11 p40">
                  {NEVER_X.join(', ')} are never X: a wrong value would write a register or memory, change the next PC, or read and write memory together.
                </Callout>
              </div>
            ) : null,
          },
        ]}
      />
    </>
  )
}

export default function QuizTab({ intro }: { intro: ReactNode }) {
  const [mnemonic, setMnemonic] = useUrlState('qi', 'beq')
  const [order, setOrder] = useUrlState<Order>('qorder', 'T05')
  const i = Math.max(0, COURSE_SUBSET.findIndex((c) => c.mnemonic === mnemonic))
  return (
    <Workspace
      title="Datapath and control"
      lectures="L12 p24-34, T05 Q1"
      intro={intro}
      toolbar={
        <>
          <Select label="Instruction" value={COURSE_SUBSET[i].mnemonic} onChange={setMnemonic} options={COURSE_SUBSET.map((c) => ({ value: c.mnemonic, label: c.mnemonic }))} />
          <Button onClick={() => setMnemonic(COURSE_SUBSET[(i + 1) % COURSE_SUBSET.length].mnemonic)}>Next instruction</Button>
        </>
      }
    >
      <Options summary="Column order">
        <Segmented
          label="Column order"
          value={order}
          onChange={setOrder}
          options={[
            { value: 'T05', label: 'T05 Q1', title: 'RegDst, RegWrite, ALUSrc, MemRead, MemWrite, MemToReg, Branch, ALUop' },
            { value: 'L12', label: 'L12 p34', title: 'The lecture table order' },
          ]}
        />
      </Options>
      <QuizBody key={COURSE_SUBSET[i].mnemonic} mnemonic={COURSE_SUBSET[i].mnemonic} order={order} />
    </Workspace>
  )
}
