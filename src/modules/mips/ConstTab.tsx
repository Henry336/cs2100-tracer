import { useMemo, type ReactNode } from 'react'
import { bin, constantPlan, hex, parseNumber, regNumber } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Panel, Presets, TextField, Workspace } from '../../ui/kit'
import { Facts, W } from './common'

const PRESETS: { name: string; source: string; value: string }[] = [
  { name: '0xAAAAF0F0 (the slide example)', source: 'L06 p44', value: '0xAAAAF0F0' },
  { name: '0x12345678 (bit 15 of the low half is 0)', source: 'derived', value: '0x12345678' },
  { name: '0xFFFF (65535 for ori, -1 for addi)', source: 'L06 p41', value: '0xFFFF' },
  { name: '-1', source: 'derived', value: '-1' },
]

export default function ConstTab({ intro }: { intro: ReactNode }) {
  const [text, setText] = useUrlState('cv', '0xAAAAF0F0')
  const [reg, setReg] = useUrlState('cr', '$t0')
  const value = parseNumber(text)
  const ok = value !== undefined && value >= -(2 ** 31) && value <= 0xffffffff
  const badReg = regNumber(reg.trim()) === undefined
  const p = useMemo(() => (ok ? constantPlan(value, reg.trim() || '$t0') : null), [ok, value, reg])

  return (
    <Workspace
      title="MIPS"
      lectures="L06 p33, p41, p44-45"
      intro={intro}
      toolbar={<Presets presets={PRESETS} onPick={(v) => setText(v)} />}
      inspector={
        <div className="mp-callouts">
          <Callout kind="trap" title="0xFFFF is not always 65535" cite="L06 p41, p45">
            ori, andi and xori zero-extend (C16), so 0xFFFF is 65535. addi sign-extends (C16_2s), so the same 16 bits are -1.
          </Callout>
          <Callout kind="trap" title="There is no subi" cite="L06 p33">
            Subtract a constant with addi and a negative immediate.
          </Callout>
        </div>
      }
    >
      <Legend
        items={[
          { signal: 'hit', label: 'fits, or gives the same value' },
          { signal: 'miss', label: 'gives a wrong value' },
        ]}
      />
      <Panel title="Constant">
        <div className="mp-row">
          <TextField label="32-bit value (decimal or 0x hex)" value={text} onChange={setText} width="11em" />
          <TextField label="Register" value={reg} onChange={setReg} width="4.5em" />
        </div>
        {!ok ? <p className="mp-err">Type a number from -2147483648 to 0xFFFFFFFF.</p> : null}
        {badReg ? <p className="mp-err">Unknown register: {reg}</p> : null}
      </Panel>

      {p ? (
        <>
          <Panel title="Load it with lui and ori">
            <Facts
              items={[
                ['Bits', <W e={p.why.split}>{`${bin(p.upper, 16)} ${bin(p.lower, 16)}`}</W>],
                ['Upper half / lower half', <W e={p.why.split}>{`${hex(p.upper, 4)} / ${hex(p.lower, 4)}`}</W>],
              ]}
            />
            <pre className="mp-code mono">{p.lines.join('\n')}</pre>
            <p>
              <W e={p.why.lines}>Why these instructions</W>
            </p>
          </Panel>

          <Panel title="What lui then addi would give">
            <Facts
              items={[
                [
                  'Result',
                  <W e={p.addi.why}>
                    {hex(p.addi.result)} {p.addi.ok ? <Chip signal="hit">same value</Chip> : <Chip signal="miss">wrong</Chip>}
                  </W>,
                ],
              ]}
            />
          </Panel>

          <Panel title="Which immediate kinds hold it" flush>
            <DataTable
              compact
              rows={p.fits}
              rowSignal={(f) => (f.ok ? 'hit' : undefined)}
              columns={[
                { key: 'k', header: 'Kind', mono: true, cell: (f) => f.kind },
                { key: 'ok', header: 'Fits', cell: (f) => <W e={f.why}>{f.ok ? 'yes' : 'no'}</W> },
                { key: 'r', header: 'Rule', cell: (f) => f.why.rule },
              ]}
            />
          </Panel>
        </>
      ) : null}
    </Workspace>
  )
}
