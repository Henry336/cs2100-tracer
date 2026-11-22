// Check mode for the pipeline diagram: type the delay and WB cycle of each instruction, then mark them before seeing the grid.
import { useEffect, useState } from 'react'
import type { PipelineTrace } from '../../core/pipeline'
import { Button, Chip, TextField, Toggle } from '../../ui/kit'
import { Board } from '../../ui/board'
import { W } from './common'

type Answers = { delay: string[]; wb: string[]; cycles: string; stalls: string }

const num = (s: string) => (/^\s*\+?\d+\s*$/.test(s) ? Number(s.replace('+', '')) : undefined)

/** Expected values per counted instruction: extra delay (+n) and the cycle of its WB. */
export function expected(t: PipelineTrace) {
  return t.instructions.map((x) => {
    // The causes that actually set this instruction's delay; with none, the plain WB rule.
    const causes = x.stalls.filter((c) => c.binding && c.cycles > 0).map((c) => c.why)
    return { delay: x.delay, wb: x.stages.WB, why: causes.length ? causes : [x.delayWhy] }
  })
}

export function markRow(ans: string, want: number): 'blank' | 'right' | 'wrong' {
  const v = num(ans)
  return v === undefined ? 'blank' : v === want ? 'right' : 'wrong'
}

/** A table-cell input; the column header names it, so its label is for screen readers only. */
function CellInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className="field-box">
      <input className="mono" aria-label={label} value={value} spellCheck={false} inputMode="numeric" style={{ width: '4em' }} onChange={(e) => onChange(e.target.value)} />
    </span>
  )
}

export default function CheckGrid({ trace, onReveal }: { trace: PipelineTrace; onReveal: () => void }) {
  const n = trace.instructions.length
  const empty = (): Answers => ({ delay: Array(n).fill(''), wb: Array(n).fill(''), cycles: '', stalls: '' })
  const [ans, setAns] = useState<Answers>(empty)
  const [checked, setChecked] = useState(false)
  const [askWb, setAskWb] = useState(true)
  const key = `${trace.instructions.map((x) => x.text).join('|')} ${JSON.stringify(trace.options)}`
  // New code or new options: start over.
  useEffect(() => {
    setAns(empty())
    setChecked(false)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const want = expected(trace)
  const edit = (f: (a: Answers) => Answers) => {
    setChecked(false)
    setAns((a) => f(a))
  }
  const setCell = (k: 'delay' | 'wb', i: number, v: string) => edit((a) => ({ ...a, [k]: a[k].map((x, j) => (j === i ? v : x)) }))
  const verdict = (m: 'blank' | 'right' | 'wrong', w: number) =>
    !checked || m === 'blank' ? null : m === 'right' ? <Chip signal="hit">Right</Chip> : <Chip signal="miss">Should be {w}</Chip>
  const rowMarks = want.map((w, i) => ({ d: markRow(ans.delay[i] ?? '', w.delay), b: askWb ? markRow(ans.wb[i] ?? '', w.wb) : ('blank' as const) }))
  const answered = rowMarks.filter((m) => m.d !== 'blank').length
  const right = rowMarks.filter((m) => m.d === 'right' && m.b !== 'wrong').length
  const cyc = markRow(ans.cycles, trace.totals.cycles)
  const st = markRow(ans.stalls, trace.totals.stallCycles)

  return (
    <Board
      className="pl-board"
      title="Check my answers"
      step={checked ? `${right} of ${answered} rows right` : undefined}
      note="Work out the diagram on paper, then fill in each instruction. +n is the extra delay: WB minus (previous WB + 1), so 0 means no stall before it."
      tools={<Toggle label="Also ask the WB cycle" checked={askWb} onChange={setAskWb} />}
    >
      {!trace.ok ? (
        <p className="pl-pad pl-err">Fix the code first.</p>
      ) : (
        <div className="pl-pad pl-checkgrid">
          <table className="dtable dtable-compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Instruction</th>
                <th>Extra delay +n</th>
                {askWb ? <th>WB in cycle</th> : null}
                {checked ? <th>Why</th> : null}
              </tr>
            </thead>
            <tbody>
              {trace.instructions.map((x, i) => {
                const m = rowMarks[i]
                const wrong = checked && (m.d === 'wrong' || m.b === 'wrong')
                return (
                  <tr key={x.uid} className={wrong ? 'row-miss' : undefined}>
                    <td className="mono">{x.name}</td>
                    <td className="mono">{x.text}</td>
                    <td>
                      <span className="pl-row">
                        <CellInput label={`Extra delay of ${x.name}`} value={ans.delay[i] ?? ''} onChange={(v) => setCell('delay', i, v)} />
                        {verdict(m.d, want[i].delay)}
                      </span>
                    </td>
                    {askWb ? (
                      <td>
                        <span className="pl-row">
                          <CellInput label={`WB cycle of ${x.name}`} value={ans.wb[i] ?? ''} onChange={(v) => setCell('wb', i, v)} />
                          {verdict(m.b, want[i].wb)}
                        </span>
                      </td>
                    ) : null}
                    {checked ? (
                      <td className="pl-muted">
                        {wrong
                          ? want[i].why.map((e, k) => (
                              <span key={k} className="pl-why-line">
                                <W e={e}>{e.rule}</W>
                                {e.working ? <span className="mono"> ({e.working})</span> : null}
                              </span>
                            ))
                          : null}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="pl-row">
            <TextField label="Total cycles" value={ans.cycles} onChange={(v) => edit((a) => ({ ...a, cycles: v }))} width="6em" />
            {verdict(cyc, trace.totals.cycles)}
            <TextField label="Stall cycles" value={ans.stalls} onChange={(v) => edit((a) => ({ ...a, stalls: v }))} width="6em" />
            {verdict(st, trace.totals.stallCycles)}
          </div>
          <div className="pl-row">
            <Button variant="primary" onClick={() => setChecked(true)}>
              Check
            </Button>
            <Button onClick={onReveal}>Show the diagram</Button>
            <Button onClick={() => edit(() => empty())}>Clear</Button>
          </div>
        </div>
      )}
    </Board>
  )
}
