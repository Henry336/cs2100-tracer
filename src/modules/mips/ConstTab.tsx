import { useMemo, type ReactNode } from 'react'
import { bin, constantPlan, hex, parseNumber, regNumber } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Board, Details } from '../../ui/board'
import { Callout, Chip, DataTable, Legend, Presets, Segmented, Workspace } from '../../ui/kit'
import { Facts, W } from './common'
import { ConstPicture } from './diagrams'

const PRESETS: { name: string; source: string; value: string }[] = [
  { name: '0xAAAAF0F0 (the slide example)', source: 'L06 p44', value: '0xAAAAF0F0' },
  { name: '0x12345678 (bit 15 of the low half is 0)', source: 'derived', value: '0x12345678' },
  { name: '0xFFFF (65535 for ori, -1 for addi)', source: 'L06 p41', value: '0xFFFF' },
  { name: '-1', source: 'derived', value: '-1' },
]

export default function ConstTab({ intro }: { intro: ReactNode }) {
  const [text, setText] = useUrlState('cv', '0xAAAAF0F0')
  const [reg, setReg] = useUrlState('cr', '$t0')
  const [second, setSecond] = useUrlState<'ori' | 'addi'>('csec', 'ori')
  const value = parseNumber(text)
  const ok = value !== undefined && value >= -(2 ** 31) && value <= 0xffffffff
  const badReg = regNumber(reg.trim()) === undefined
  const r = reg.trim() || '$t0'
  const p = useMemo(() => (ok ? constantPlan(value, r) : null), [ok, value, r])

  return (
    <Workspace title="MIPS" lectures="L06 p33, p41, p44-45" intro={intro} toolbar={<Presets presets={PRESETS} onPick={(v) => setText(v)} />}>
      <div className="mp-command">
        {/* Two inputs in one bar, so the shared classes without the one-input CommandBar. */}
        <div className="command-bar glow-input">
          <label className="command-label" htmlFor="mp-cv">
            Load
          </label>
          <input id="mp-cv" className="command-input mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="0xAAAAF0F0" spellCheck={false} autoComplete="off" />
          <label className="command-label" htmlFor="mp-cr">
            into
          </label>
          <input id="mp-cr" className="command-input mp-command-short mono" value={reg} onChange={(e) => setReg(e.target.value)} spellCheck={false} autoComplete="off" />
        </div>
        {!ok ? <p className="mp-err">Type a number from -2147483648 to 0xFFFFFFFF.</p> : null}
        {badReg ? <p className="mp-err">Unknown register: {reg}</p> : null}
      </div>

      {p ? (
        <>
          <Board
            title={<code className="mp-board-code mono">{p.lines.join('\n')}</code>}
            tools={
              <Segmented
                label="Fill the lower half with"
                value={second}
                onChange={setSecond}
                options={[
                  { value: 'ori', label: 'ori', title: 'Zero-extends, the safe choice (L06 p44)' },
                  { value: 'addi', label: 'addi', title: 'Sign-extends (L06 p41)' },
                ]}
              />
            }
            foot={
              <Legend
                items={[
                  { signal: 'path', label: 'upper half' },
                  { signal: 'data', label: 'lower half' },
                  { signal: 'miss', label: 'bit that came out wrong' },
                ]}
              />
            }
          >
            <ConstPicture value={p.value} upper={p.upper} lower={p.lower} reg={r} second={second} result={second === 'ori' ? p.value : p.addi.result} />
          </Board>

          <Details
            urlKey="cdt"
            label="Working for this constant"
            tabs={[
              {
                value: 'load',
                label: 'Working',
                body: (
                  <Facts
                    items={[
                      ['Bits', <W e={p.why.split}>{`${bin(p.upper, 16)} ${bin(p.lower, 16)}`}</W>],
                      ['Upper half / lower half', <W e={p.why.split}>{`${hex(p.upper, 4)} / ${hex(p.lower, 4)}`}</W>],
                      ['Instructions', <W e={p.why.lines}>{p.lines.join('; ')}</W>],
                      [
                        'lui then addi gives',
                        <W e={p.addi.why}>
                          {hex(p.addi.result)} {p.addi.ok ? <Chip signal="hit">same value</Chip> : <Chip signal="miss">wrong</Chip>}
                        </W>,
                      ],
                    ]}
                  />
                ),
              },
              {
                value: 'fits',
                label: 'Which immediate kinds hold it',
                body: (
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
                ),
              },
              {
                value: 'traps',
                label: 'Watch out',
                body: (
                  <div className="mp-callouts">
                    <Callout kind="trap" title="0xFFFF is not always 65535" cite="L06 p41, p45">
                      ori, andi and xori zero-extend (C16), so 0xFFFF is 65535. addi sign-extends (C16_2s), so the same 16 bits are -1.
                    </Callout>
                    <Callout kind="trap" title="There is no subi" cite="L06 p33">
                      Subtract a constant with addi and a negative immediate.
                    </Callout>
                  </div>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </Workspace>
  )
}
