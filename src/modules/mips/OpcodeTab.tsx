import { useMemo, type ReactNode } from 'react'
import { expandingOpcode, type ExpandingOpcodeInput, type ExpandingOpcodeResult } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Board, Details, Flow, Options } from '../../ui/board'
import { Button, Callout, Legend, Presets, Segmented, TextField, Workspace } from '../../ui/kit'
import { Steps, W } from './common'
import { OPCODE_PRESETS, blankClass, type OpClassText, type OpcodeText } from './presets'

const toNum = (s: string) => (s.trim() === '' ? undefined : Number(s.trim()))
const fmt = (n: number) => n.toLocaleString('en-US')

function toInput(t: OpcodeText): ExpandingOpcodeInput {
  return {
    length: Number(t.length),
    registers: toNum(t.registers),
    memoryBytes: toNum(t.memoryBytes),
    objective: t.objective,
    classes: t.classes.map((c, i) => ({
      name: c.name.trim() || `type ${i + 1}`,
      opcodeBits: toNum(c.opcodeBits),
      length: toNum(c.length),
      regs: toNum(c.regs),
      addresses: toNum(c.addresses),
      otherBits: toNum(c.otherBits),
      fixed: toNum(c.fixed),
      min: toNum(c.min),
    })),
  }
}

const FIELDS: [keyof OpClassText, string][] = [
  ['name', 'Name'],
  ['regs', 'Register operands'],
  ['addresses', 'Address operands'],
  ['otherBits', 'Other operand bits'],
  ['opcodeBits', 'Opcode bits, if given'],
  ['length', 'Length, if different'],
  ['fixed', 'Exactly'],
  ['min', 'At least'],
]

const BAR_W = 600
const BAR_H = 26
const GAP = 58

/** Proportional widths with a visible minimum, rescaled to fill the bar. */
function widths(ns: number[]): number[] {
  const total = ns.reduce((a, b) => a + b, 0) || 1
  const w = ns.map((n) => (n > 0 ? Math.max(4, (n / total) * BAR_W) : 0))
  const k = BAR_W / (w.reduce((a, b) => a + b, 0) || 1)
  return w.map((x) => x * k)
}

type Seg = { label: string; n: number; cls: string }

function Bar({ y, segs, title, note }: { y: number; segs: Seg[]; title: string; note?: string }) {
  const ws = widths(segs.map((s) => s.n))
  let x = 8
  return (
    <g>
      <text x={8} y={y - 7} className="mp-t">{title}</text>
      {note ? <text x={8 + BAR_W} y={y - 7} className="mp-t mp-t-small mp-t-end">{note}</text> : null}
      {segs.map((s, k) => {
        const x0 = x
        x += ws[k]
        if (!ws[k]) return null
        const text = `${s.label} ${fmt(s.n)}`
        return (
          <g key={k}>
            <rect x={x0} y={y} width={ws[k]} height={BAR_H} className={s.cls}>
              <title>{text}</title>
            </rect>
            {ws[k] > text.length * 6.6 + 10 ? <text x={x0 + ws[k] / 2} y={y + 17} className="mp-t mp-t-mid mono">{text}</text> : null}
          </g>
        )
      })}
    </g>
  )
}

/** Each opcode width as a bar; the codes left as prefixes fan out into the whole next bar (R04 p45). */
function OpcodeSpace({ r }: { r: ExpandingOpcodeResult }) {
  const levels = r.levels
  const wmax = levels[levels.length - 1].opcodeBits
  const y = (k: number) => 28 + k * (BAR_H + GAP)
  const budgetY = y(levels.length) + 12
  const height = budgetY + BAR_H + 24
  // Light runs from the prefixes each width leaves over into the next, wider bar (R04 p45).
  const fans: string[] = []
  levels.forEach((L, k) => {
    if (!levels[k + 1] || L.passedDown <= 0) return
    const segs = [...L.taken.map((t) => t.count), L.passedDown]
    const ws = widths(segs)
    const mid = 8 + BAR_W - ws[ws.length - 1] / 2
    fans.push(`M${mid} ${y(k) + BAR_H} C${mid} ${y(k) + BAR_H + GAP / 2} ${8 + BAR_W / 2} ${y(k + 1) - GAP / 2} ${8 + BAR_W / 2} ${y(k + 1)}`)
  })
  return (
    <div className="mp-scroll">
      <svg className="mp-svg" width={BAR_W + 16} height={height} viewBox={`0 0 ${BAR_W + 16} ${height}`} role="img" aria-label="Opcode space split by opcode width">
        <defs>
          <pattern id="mp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="mp-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="mp-hatch-line" />
          </pattern>
        </defs>
        {levels.map((L, k) => {
          const last = k === levels.length - 1
          const segs: Seg[] = [
            ...L.taken.map((t) => ({ label: t.name, n: t.count, cls: 'mp-seg-control' })),
            { label: last ? 'unused' : 'prefixes', n: L.passedDown, cls: last ? 'mp-seg-unused' : 'mp-seg-prefix' },
          ]
          const ws = widths(segs.map((s) => s.n))
          const px1 = 8 + BAR_W
          const px0 = px1 - ws[ws.length - 1]
          const next = levels[k + 1]
          return (
            <g key={k}>
              {next && L.passedDown > 0 ? (
                <polygon points={`${px0},${y(k) + BAR_H} ${px1},${y(k) + BAR_H} ${8 + BAR_W},${y(k + 1)} 8,${y(k + 1)}`} className="mp-fan" />
              ) : null}
              <Bar
                y={y(k)}
                segs={segs}
                title={`${L.opcodeBits}-bit opcodes: ${fmt(L.available)} codes`}
                note={next ? `${fmt(L.passedDown)} prefix${L.passedDown === 1 ? '' : 'es'} x 2^${next.opcodeBits - L.opcodeBits}` : undefined}
              />
            </g>
          )
        })}
        <Flow id={fans.join()} paths={fans} />
        <Bar
          y={budgetY}
          title={`Check: share of all 2^${wmax} = ${fmt(2 ** wmax)} patterns`}
          segs={[
            ...r.classes.map((c) => ({ label: c.name, n: c.count * 2 ** (wmax - c.opcodeBits), cls: 'mp-seg-control' })),
            { label: 'unused', n: r.unused, cls: 'mp-seg-unused' },
          ]}
        />
      </svg>
    </div>
  )
}

export default function OpcodeTab({ intro }: { intro: ReactNode }) {
  const [rawT, setT] = useUrlState<OpcodeText>('xo', OPCODE_PRESETS[1].value)
  const t = Array.isArray(rawT.classes) ? rawT : OPCODE_PRESETS[1].value // guard against a malformed shared link
  const r = useMemo(() => expandingOpcode(toInput(t)), [t])
  const setClass = (i: number, key: keyof OpClassText, v: string) =>
    setT((p) => ({ ...p, classes: p.classes.map((c, k) => (k === i ? { ...c, [key]: v } : c)) }))
  const nextName = String.fromCharCode(65 + (t.classes.length % 26))
  const goal = t.objective === 'max' ? 'Maximum' : 'Minimum'

  return (
    <Workspace title="MIPS" lectures="L10 p27-30, R04 p45" intro={intro} toolbar={<Presets presets={OPCODE_PRESETS} onPick={(v) => setT(v)} />}>
      <div className="mp-command">
        <div className="mp-row">
          <TextField label="Instruction bits" value={t.length} onChange={(v) => setT((p) => ({ ...p, length: v }))} width="5em" />
          <TextField label="Registers" value={t.registers} onChange={(v) => setT((p) => ({ ...p, registers: v }))} width="5em" />
          <TextField label="Memory bytes" value={t.memoryBytes} onChange={(v) => setT((p) => ({ ...p, memoryBytes: v }))} width="7em" />
          <Segmented label="Find the" value={t.objective} onChange={(v) => setT((p) => ({ ...p, objective: v }))} options={[{ value: 'max', label: 'Maximum' }, { value: 'min', label: 'Minimum' }]} />
        </div>
        <Options summary={`Instruction types: ${t.classes.map((c, i) => c.name.trim() || `type ${i + 1}`).join(', ')}`}>
          <div className="mp-classes">
            {t.classes.map((c, i) => (
              <fieldset key={i} className="mp-class">
                <legend>Type {i + 1}</legend>
                {FIELDS.map(([key, label]) => (
                  <TextField key={key} label={label} value={c[key]} onChange={(v) => setClass(i, key, v)} width={key === 'name' ? '4em' : '4.5em'} />
                ))}
                <Button onClick={() => setT((p) => ({ ...p, classes: p.classes.filter((_, k) => k !== i) }))} disabled={t.classes.length < 2} title="Remove this type">
                  Remove
                </Button>
              </fieldset>
            ))}
          </div>
          <div>
            <Button onClick={() => setT((p) => ({ ...p, classes: [...p.classes, blankClass(nextName)] }))} disabled={t.classes.length >= 8}>
              Add a type
            </Button>
          </div>
        </Options>
      </div>

      <Board
        title={r.error ? 'No answer yet' : `${goal} total`}
        step={r.error ? undefined : <span className="mono"><W e={r.steps[r.steps.length - 1]}>{fmt(r.total)}</W></span>}
        foot={
          <Legend
            items={[
              { signal: 'control', label: 'opcodes given to a type' },
              { signal: 'dontcare', label: 'patterns left unused' },
            ]}
          />
        }
      >
        {r.error ? <p className="mp-err">{r.error}</p> : <OpcodeSpace r={r} />}
      </Board>

      <Details
        urlKey="odt"
        label="Tables and working"
        tabs={[
          {
            value: 'result',
            label: 'Result',
            body: (
              r.error ? (
                <p className="mp-err">{r.error}</p>
              ) : (
                <table className="dtable mp-fit">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="mp-r">Operand bits</th>
                      <th className="mp-r">Opcode bits</th>
                      <th className="mp-r">Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.classes.map((c, k) => (
                      <tr key={k}>
                        <td>{c.name}</td>
                        <td className="mono mp-r">{c.operandBits}</td>
                        <td className="mono mp-r"><W e={c.why}>{c.opcodeBits}</W></td>
                        <td className="mono mp-r"><W e={c.countWhy}>{fmt(c.count)}</W></td>
                      </tr>
                    ))}
                    <tr className="mp-total">
                      <td>{goal} total</td>
                      <td />
                      <td />
                      <td className="mono mp-r">
                        <W e={r.steps[r.steps.length - 1]}>{fmt(r.total)}</W>
                      </td>
                    </tr>
                  </tbody>
                </table>
              )
            ),
          },
          {
            value: 'tree',
            label: 'Prefix tree',
            body: (
              r.error ? (
                <p className="mp-err">{r.error}</p>
              ) : (
                <table className="dtable mp-fit mp-levels">
                  <caption>Shortest opcode first</caption>
                  <thead>
                    <tr>
                      <th className="mp-r">Opcode bits</th>
                      <th className="mp-r">Codes</th>
                      <th>Taken</th>
                      <th className="mp-r">Left over</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.levels.map((L, k) => (
                      <tr key={k}>
                        <td className="mono mp-r">{L.opcodeBits}</td>
                        <td className="mono mp-r"><W e={L.why}>{fmt(L.available)}</W></td>
                        <td className="mono">{L.taken.map((x) => `${x.name} ${fmt(x.count)}`).join(', ')}</td>
                        <td className="mono mp-r">{fmt(L.passedDown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ),
          },
          { value: 'work', label: 'Working', body: r.error ? <p className="mp-err">{r.error}</p> : <Steps steps={r.steps} label="Expanding opcode working" /> },
          {
            value: 'traps',
            label: 'Watch out',
            body: (
              <div className="mp-callouts">
                <Callout kind="course" title="Maximum and minimum" cite="R04 p45">
                  For the maximum, give every shorter-opcode type its minimum (usually 1) and let the longest-opcode type take what is left. For the minimum, give the shorter types every code except the prefixes the next width needs.
                </Callout>
                <Callout kind="trap" title="The conditions are part of the question" cite="L10 p30, AY20-21 Q3">
                  At least one of each type sets the minimum counts. Fully utilised means no pattern may be left unused.
                </Callout>
                <Callout kind="trap" title="Register fields round up" cite="AY23/24 S2 Q7">
                  12 registers need ceil(log2 12) = 4 bits. A 512-byte memory needs log2 512 = 9 address bits.
                </Callout>
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
