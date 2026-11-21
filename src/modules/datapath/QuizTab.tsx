// Tab 4: fill in the control row yourself, then check it (T05 Q1 style; L12 p26, p34).
import { useState, type ReactNode } from 'react'
import {
  COURSE_SUBSET, MAIN_CONTROL, NEVER_X, SIGNAL_ORDER, T05_ORDER, aluControlTable, gradeControlRow,
  type Bit, type QuizVerdict, type SignalName,
} from '../../core/datapath'
import { bin } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, DataTable, Panel, Segmented, Select, TextField, Workspace, type Signal } from '../../ui/kit'
import { ExplainText } from './common'

type Order = 'L12' | 'T05'
type Cell = '' | '0' | '1' | 'X'

const VERDICT: Record<QuizVerdict, { signal: Signal; text: string }> = {
  right: { signal: 'hit', text: 'right' },
  accepted: { signal: 'dontcare', text: 'accepted, the table has X' },
  wrong: { signal: 'miss', text: 'wrong' },
  blank: { signal: 'miss', text: 'blank' },
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
  const ordered = [...signals.map((s) => cells.find((c) => c.signal === s)!), cells.at(-1)!]
  const set = (s: SignalName, v: Cell) => {
    setAnswer((a) => ({ ...a, [s]: v }))
    setChecked(false)
  }
  const reveal = () => {
    setAnswer(Object.fromEntries(SIGNAL_ORDER.map((s) => [s, String(row[s]) as Cell])))
    setAlu(aluControl)
    setChecked(true)
  }

  return (
    <>
      <Panel title={`Fill in the control row for ${ins.mnemonic}`} actions={<span className="dp-cite">T05 Q1</span>}>
        <p className="dp-does mono">
          opcode {bin(ins.opcode, 6)}
          {ins.funct !== undefined ? `, funct ${bin(ins.funct, 6)}` : ''}
        </p>
        <div className="dp-quiz">
          {signals.map((s) => (
            <Select<Cell>
              key={s}
              label={s}
              value={answer[s] ?? ''}
              onChange={(v) => set(s, v)}
              options={[{ value: '', label: '?' }, { value: '0', label: '0' }, { value: '1', label: '1' }, { value: 'X', label: 'X' }]}
            />
          ))}
          <TextField label="ALUcontrol (4 bits)" value={alu} onChange={(v) => { setAlu(v); setChecked(false) }} mono width="6em" placeholder="0000" />
        </div>
        <div className="dp-input-row">
          <Button variant="primary" onClick={() => setChecked(true)}>Check</Button>
          <Button onClick={reveal}>Show the answer</Button>
          <Button onClick={() => { setAnswer({}); setAlu(''); setChecked(false) }}>Clear</Button>
        </div>
      </Panel>
      {checked ? (
        <Panel title={`Marked: ${score} of ${cells.length}`}>
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
        </Panel>
      ) : null}
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
          <Segmented
            label="Column order"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'T05', label: 'T05 Q1', title: 'RegDst, RegWrite, ALUSrc, MemRead, MemWrite, MemToReg, Branch, ALUop' },
              { value: 'L12', label: 'L12 p34', title: 'The lecture table order' },
            ]}
          />
        </>
      }
    >
      <QuizBody key={COURSE_SUBSET[i].mnemonic} mnemonic={COURSE_SUBSET[i].mnemonic} order={order} />
    </Workspace>
  )
}
