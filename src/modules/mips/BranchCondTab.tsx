import { useMemo, type ReactNode } from 'react'
import { INEQUALITIES, inequalityBranch, regNumber, type Cond, type InequalityInput } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, NumberField, Panel, Presets, Segmented, Select, TextField, Workspace } from '../../ui/kit'
import { Facts, Steps, W } from './common'

const START: InequalityInput = { cond: '<', branchWhen: true, a: '$s1', b: '$s2', label: 'L', tmp: '$t0', aValue: 3, bValue: 5 }

const PRESETS: { name: string; source: string; value: InequalityInput }[] = [
  { name: 'blt $s1, $s2, L', source: 'L07 p29', value: START },
  { name: 'bge $t4, $t3, skip with $t5', source: 'T03 D1(e)', value: { cond: '>=', branchWhen: true, a: '$t4', b: '$t3', label: 'skip', tmp: '$t5', aValue: 7, bValue: 2 } },
  { name: 'if (i < j) body: skip when false', source: 'L07 p22, p30', value: { cond: '<', branchWhen: false, a: '$s3', b: '$s4', label: 'Exit', tmp: '$t0', aValue: 4, bValue: 4 } },
  { name: 'Loop exit: for (i = 0; i < 40; i++)', source: 'L07 p33', value: { cond: '<', branchWhen: false, a: '$t1', b: '$t2', label: 'end', tmp: '$at', aValue: 40, bValue: 40 } },
]

const CONDS: { value: Cond; label: string }[] = [
  { value: '<', label: 'a < b' },
  { value: '>', label: 'a > b' },
  { value: '<=', label: 'a <= b' },
  { value: '>=', label: 'a >= b' },
]

export default function BranchCondTab({ intro }: { intro: ReactNode }) {
  const [raw, setS] = useUrlState<InequalityInput>('bc', START)
  // A shared link may carry an old or hand-edited shape: fill gaps from the default.
  const { s, r } = useMemo(() => {
    const s: InequalityInput = { ...START, ...raw, cond: CONDS.some((c) => c.value === raw.cond) ? raw.cond : START.cond }
    return { s, r: inequalityBranch(s) }
  }, [raw])
  const set = <K extends keyof InequalityInput>(k: K) => (v: InequalityInput[K]) => setS((p) => ({ ...p, [k]: v }))
  const bad = [s.a, s.b, s.tmp].filter((x) => regNumber(x.trim()) === undefined)

  return (
    <Workspace
      title="MIPS"
      lectures="L07 p22-30, T03 D1, T04 Q2"
      intro={intro}
      toolbar={<Presets presets={PRESETS} onPick={(v) => setS(v)} />}
      inspector={
        <>
          <Panel title="Working">
            <Steps steps={r.steps} label="Branch condition working" />
          </Panel>
          <div className="mp-callouts">
            <Callout kind="trap" title="There is no real blt" cite="L07 p28-29">
              blt, bgt, ble and bge are pseudo-instructions. The assembler turns each into slt plus beq or bne, so each counts as 2 instructions.
            </Callout>
            <Callout kind="trap" title="An if branches on the opposite test" cite="L07 p22">
              The branch jumps over the body, so it tests the condition that makes the body not run.
            </Callout>
            <Callout kind="course" title="Write the real pair in exams" cite="Lab 3 p7, T02 p1">
              Pseudo-instructions are usually not allowed in tests, so answers use slt with beq or bne.
            </Callout>
          </div>
        </>
      }
    >
      <Legend
        items={[
          { signal: 'path', label: 'the row this condition uses' },
          { signal: 'hit', label: 'branch taken' },
        ]}
      />
      <Panel title="Condition">
        <div className="mp-row">
          <Select label="Condition" value={s.cond} onChange={set('cond')} options={CONDS} />
          <Segmented
            label="Branch when it"
            value={s.branchWhen ? 'holds' : 'fails'}
            onChange={(v) => set('branchWhen')(v === 'holds')}
            options={[{ value: 'holds', label: 'Holds' }, { value: 'fails', label: 'Fails (skip the body)' }]}
          />
        </div>
        <div className="mp-row">
          <TextField label="Register a" value={s.a} onChange={set('a')} width="4.5em" />
          <TextField label="Register b" value={s.b} onChange={set('b')} width="4.5em" />
          <TextField label="slt result in" value={s.tmp} onChange={set('tmp')} width="4.5em" />
          <TextField label="Label" value={s.label} onChange={set('label')} width="5em" />
          <NumberField label="Value of a" value={s.aValue} onChange={set('aValue')} width="5em" />
          <NumberField label="Value of b" value={s.bValue} onChange={set('bValue')} width="5em" />
        </div>
        {bad.length ? <p className="mp-err">Unknown register: {bad.join(', ')}</p> : null}
      </Panel>

      <Panel title="MIPS">
        <pre className="mp-code mono">{r.lines.join('\n')}</pre>
        <Facts
          items={[
            ['Same as', <>{r.pseudoText} <span className="mp-muted">(pseudo-instruction)</span></>],
            [`${s.tmp} after slt`, <W e={r.steps[1]}>{r.slt}</W>],
            ['Branch', <W e={r.steps[2]}>{r.taken ? <Chip signal="hit">taken</Chip> : 'not taken'}</W>],
          ]}
        />
      </Panel>

      <Panel title="All four from one slt" flush>
        <DataTable
          compact
          rows={INEQUALITIES}
          rowSignal={(row) => (row === r.row ? 'path' : undefined)}
          columns={[
            { key: 'c', header: 'Branch when', mono: true, cell: (row) => `a ${row.cond} b` },
            { key: 'p', header: 'Pseudo', mono: true, cell: (row) => row.pseudo },
            { key: 's', header: 'slt', mono: true, cell: (row) => (row.sltOrder === 'ab' ? 'slt $at, a, b' : 'slt $at, b, a') },
            { key: 'b', header: 'Then', mono: true, cell: (row) => `${row.branch} $at, $zero, L` },
            { key: 'now', header: '', cell: (row) => (row === r.row ? 'this one' : '') },
          ]}
        />
      </Panel>
    </Workspace>
  )
}
