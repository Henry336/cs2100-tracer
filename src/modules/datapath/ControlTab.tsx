// Tab 2: the control unit as the PLA of L12 p33-34, and the ALU control gates of R06 p20 / L12 p28.
import type { ReactNode } from 'react'
import {
  ALU_CODES, ALU_CONTROL_GATES_CITE, MAIN_CONTROL, PLA_CITE, PLA_OUTPUTS, PLA_TERMS, SIGNAL_ORDER,
  aluControlGates, aluControlTable, aluOpOf, aluRaw, plaEval,
} from '../../core/datapath'
import { bin, hex } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, DataTable, Legend, Panel, Segmented, TextField, Workspace } from '../../ui/kit'
import { AluControlTable, AluopTable, MainControlTable, W, bitCell, mainRowName, parseNum, type TableOrder } from './common'
import type { TraceInputs } from './TraceTab'

const QUICK = [
  { name: 'R-type', op: 0x00 }, { name: 'lw', op: 0x23 }, { name: 'sw', op: 0x2b }, { name: 'beq', op: 0x04 }, { name: 'addi', op: 0x08 }, { name: 'bne', op: 0x05 },
]

/** One toggle button per bit, most significant first. */
function BitButtons({ label, names, value, width, onChange, dim }: { label: string; names: string[]; value: number; width: number; onChange: (v: number) => void; dim?: (k: number) => boolean }) {
  return (
    <div className="dp-bits" role="group" aria-label={label}>
      <span className="control-label">{label}</span>
      <div className="dp-bits-row">
        {names.map((n, i) => {
          const k = width - 1 - i
          const on = (value >> k) & 1
          return (
            <button key={n} type="button" className={`dp-bit${on ? ' on' : ''}${dim?.(k) ? ' dim' : ''}`} aria-pressed={!!on} aria-label={`${n} = ${on}`} onClick={() => onChange(value ^ (1 << k))}>
              <span className="dp-bit-n">{n}</span>
              <span className="dp-bit-v mono">{on}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The PLA: 12 literal lines, 4 AND terms, 9 OR outputs, with every 1 lit. */
function PlaSvg({ opcode }: { opcode: number }) {
  const r = plaEval(opcode)
  const lit = (k: number, comp: boolean) => (((opcode >> k) & 1) ^ (comp ? 1 : 0)) === 1
  const litX = (i: number, comp: boolean) => 110 + i * 52 + (comp ? 24 : 0)
  const rowY = (j: number) => 130 + j * 56
  const outX = (j: number) => 520 + j * 30
  const bottom = rowY(3) + 34
  return (
    <svg className="dp-pla" viewBox="0 0 820 470" role="img" aria-label={`PLA for opcode ${r.opcodeBin}: ${r.fired ? `${r.fired} term fires` : 'no term fires'}`}>
      <text x={20} y={30} className="dp-t-port">Opcode bits</text>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const k = 5 - i
        return (
          <g key={k}>
            <text x={litX(i, false) + 12} y={30} className="dp-t-unit" textAnchor="middle">Op{k}</text>
            <text x={litX(i, false) + 12} y={48} className="dp-t-val t-past" textAnchor="middle">{(opcode >> k) & 1}</text>
            {[false, true].map((c) => (
              <g key={String(c)}>
                <path d={`M${litX(i, c)} 84V${bottom}`} className={`dp-pl${lit(k, c) ? ' on' : ''}`} />
                <text x={litX(i, c)} y={78} className="dp-t-port" textAnchor="middle">{c ? `Op${k}'` : `Op${k}`}</text>
              </g>
            ))}
            <path d={`M${litX(i, false)} 84H${litX(i, true)}`} className="dp-pl-join" />
          </g>
        )
      })}
      {PLA_TERMS.map((t, j) => {
        const on = r.terms[j].value === 1
        const y = rowY(j)
        return (
          <g key={t.term}>
            <path d={`M100 ${y}H440`} className={`dp-pl${on ? ' on' : ''}`} />
            {[...t.bits].map((b, i) => (
              <circle key={i} cx={litX(i, b === '0')} cy={y} r={4} className={`dp-pl-dot${lit(5 - i, b === '0') ? ' on' : ''}`} />
            ))}
            <path d={`M440 ${y - 14}H452A14 14 0 0 1 452 ${y + 14}H440Z`} className={`dp-pl-gate${on ? ' on' : ''}`} />
            <text x={448} y={y - 20} className="dp-t-port" textAnchor="middle">{t.term}</text>
            <path d={`M466 ${y}H${outX(8) + 16}`} className={`dp-pl${on ? ' on' : ''}`} />
            <text x={472} y={y - 4} className="dp-t-val t-past">{on ? 1 : 0}</text>
          </g>
        )
      })}
      {PLA_OUTPUTS.map((o, j) => {
        const v = r.outputs[o.signal]
        const x = outX(j)
        return (
          <g key={o.signal}>
            <path d={`M${x} ${rowY(0) - 20}V${bottom + 12}`} className={`dp-pl${v ? ' on' : ''}`} />
            {o.terms.map((tm) => {
              const j2 = PLA_TERMS.findIndex((t) => t.term === tm)
              return <circle key={tm} cx={x} cy={rowY(j2)} r={4} className={`dp-pl-dot${r.terms[j2].value ? ' on' : ''}`} />
            })}
            <path d={`M${x - 10} ${bottom + 12}Q${x} ${bottom + 18} ${x + 10} ${bottom + 12}Q${x + 8} ${bottom + 30} ${x} ${bottom + 40}Q${x - 8} ${bottom + 30} ${x - 10} ${bottom + 12}Z`} className={`dp-pl-gate${v ? ' on' : ''}`} />
            <text x={x} y={bottom + 56} className="dp-t-val t-past" textAnchor="middle">{v}</text>
            <text x={x + 4} y={bottom + 66} className="dp-t-port" transform={`rotate(-90 ${x + 4} ${bottom + 66})`} textAnchor="end">{o.signal}</text>
          </g>
        )
      })}
      <text x={20} y={rowY(0) + 4} className="dp-t-port">AND plane</text>
      <text x={outX(0) - 12} y={rowY(0) - 26} className="dp-t-port">OR plane</text>
    </svg>
  )
}

function Section({ title, children, cite }: { title: string; children: ReactNode; cite?: string }) {
  return (
    <Panel title={title} actions={cite ? <span className="dp-cite">{cite}</span> : undefined}>
      {children}
    </Panel>
  )
}

export default function ControlTab({ intro, x }: { intro: ReactNode; x: TraceInputs }) {
  const [op, setOp] = useUrlState('op', 0x23)
  const [aop, setAop] = useUrlState('aop', 2)
  const [fn, setFn] = useUrlState('fn', 0x20)
  const pla = plaEval(op)
  const ins = x.result.instr
  const tableRow = MAIN_CONTROL.find((m) => m.opcode === op)
  const rowName = mainRowName(op, QUICK.find((q) => q.op === op)?.name ?? '')
  const a1 = ((aop >> 1) & 1) as 0 | 1
  const a0 = (aop & 1) as 0 | 1
  const gates = aluControlGates(a1, a0, fn)
  const aluopStr = `${a1}${a0}`
  const fromTable = aluControlTable(aluopStr, fn)
  const opName = aluOpOf(gates.code)
  const code = ALU_CODES.find((c) => c.code === gates.code)
  const [order, setOrder] = useUrlState<TableOrder>('corder', 'L12')
  const [rawCode, setRawCode] = useUrlState('alu', 0b0110)
  const [ra, setRa] = useUrlState('aa', '12')
  const [rb, setRb] = useUrlState('ab', '5')

  const useTraced = () => {
    if (!ins) return
    setOp(ins.opcode)
    const r = x.result.ok ? x.result.control.row : null
    if (r && r.ALUop1 !== 'X' && r.ALUop0 !== 'X') setAop((r.ALUop1 << 1) | r.ALUop0)
    setFn(ins.funct)
  }

  return (
    <Workspace
      title="Datapath and control"
      lectures="L12 p18-34, R06 p5-27, T05 Q1, Q6-7"
      intro={intro}
      toolbar={ins ? <Button onClick={useTraced} title="Copy opcode, ALUop and funct from the instruction on the tracer tab">Use {ins.text}</Button> : undefined}
    >
      <div className="dp-top">
        <Section title="Opcode in" cite="L12 p32">
          <BitButtons label="Inst[31:26]" names={['Op5', 'Op4', 'Op3', 'Op2', 'Op1', 'Op0']} value={op} width={6} onChange={setOp} />
          <div className="dp-quick" role="group" aria-label="Opcode examples">
            {QUICK.map((q) => (
              <button key={q.name} type="button" className={`btn${q.op === op ? ' dp-quick-on' : ''}`} onClick={() => setOp(q.op)}>
                {q.name} <span className="mono">{bin(q.op, 6)}</span>
              </button>
            ))}
          </div>
          <p className="dp-does">
            <W e={pla.why}>{pla.fired ? `The ${pla.fired} term fires` : 'No AND term fires'}</W>. {tableRow ? `The L12 p34 row for ${tableRow.name} is lit below.` : 'This opcode has no row in L12 p34.'}
          </p>
        </Section>
        <Section title="ALU control in" cite="L12 p25">
          <BitButtons label="ALUop (from the main control)" names={['ALUop1', 'ALUop0']} value={aop} width={2} onChange={setAop} />
          <BitButtons label="Funct, Inst[5:0]" names={['F5', 'F4', 'F3', 'F2', 'F1', 'F0']} value={fn} width={6} onChange={setFn} dim={(k) => k >= 4} />
          <p className="dp-hint">F5 and F4 are greyed: no gate reads them (L12 p27).</p>
        </Section>
      </div>

      <Panel title={`PLA for opcode ${pla.opcodeBin}`} actions={<span className="dp-cite">{PLA_CITE}</span>} flush>
        <div className="dp-scroll">
          <PlaSvg opcode={op} />
        </div>
        <div className="dp-diagram-foot">
          <Legend items={[{ signal: 'hit', label: 'line carrying 1' }, { signal: 'control', label: 'connection (dot) or gate' }]} />
          <p className="dp-hint">A dot on an AND row means that literal is an input of the term. An output is the OR of the terms it has a dot for.</p>
        </div>
      </Panel>

      <div className="dp-grid">
        <Panel title="PLA outputs against the table">
          <DataTable
            compact
            columns={[
              { key: 's', header: 'Signal', cell: (s) => s },
              { key: 't', header: 'Terms', cell: (s) => PLA_OUTPUTS.find((o) => o.signal === s)!.terms.join(' + ') },
              { key: 'p', header: 'PLA', mono: true, align: 'center', cell: (s) => pla.outputs[s] },
              { key: 'r', header: 'L12 p34 row', mono: true, align: 'center', cell: (s) => (tableRow ? bitCell(tableRow.row[s]) : 'none') },
            ]}
            rows={SIGNAL_ORDER}
            rowSignal={(s) => (pla.outputs[s] ? 'hit' : undefined)}
            caption="Where the table has X the PLA outputs 0, which is one valid choice (L12 p33-34)"
          />
          <DataTable
            compact
            columns={[
              { key: 't', header: 'AND term', cell: (t) => t.term },
              { key: 'e', header: 'Expression', cell: (t) => t.expr, mono: true },
              { key: 'v', header: 'Value', mono: true, align: 'center', cell: (t) => <W e={{ rule: `Each literal must be 1 for the ${t.term} term`, working: t.working, cite: PLA_CITE }}>{t.value}</W> },
            ]}
            rows={pla.terms}
            rowSignal={(t) => (t.value ? 'path' : undefined)}
          />
        </Panel>
        <Panel
          title="Main control table"
          actions={
            <Segmented
              label="Columns"
              value={order}
              onChange={setOrder}
              options={[
                { value: 'L12', label: 'L12 p34', title: 'Single-cycle column order' },
                { value: 'L20', label: 'By stage (L20 p27)', title: 'Grouped by the pipeline stage that uses each signal' },
              ]}
            />
          }
        >
          <MainControlTable active={rowName} order={order} />
        </Panel>
        <Panel title="ALU control gates" actions={<span className="dp-cite">{ALU_CONTROL_GATES_CITE}</span>}>
          <DataTable
            compact
            columns={[
              { key: 'b', header: 'Bit', cell: (b) => `ALUcontrol${b.bit}` },
              { key: 'e', header: 'Expression', mono: true, cell: (b) => b.expr },
              { key: 'w', header: 'Working', mono: true, cell: (b) => b.working },
              { key: 'v', header: 'Value', mono: true, align: 'center', cell: (b) => b.value },
            ]}
            rows={gates.bits}
            rowSignal={(b) => (b.value ? 'hit' : undefined)}
          />
          <p className="dp-does">
            ALUcontrol ={' '}
            <W e={gates.why}>
              <span className="mono">{gates.code}</span>
            </W>{' '}
            {opName ? (
              <>
                ({opName}: Ainvert {code!.ainvert}, Binvert {code!.binvert}, Operation {code!.operation})
              </>
            ) : (
              <>which is not an ALU operation (L11 p34)</>
            )}
            . The L12 p26 table gives {fromTable ? <span className="mono">{fromTable}</span> : 'no row for this input'}
            {fromTable && fromTable !== gates.code ? ', so the gates differ from the table here' : ''}.
          </p>
          <AluopTable aluop={aluopStr} />
          <AluControlTable aluop={aluopStr} funct={fn} />
        </Panel>
        <RawAlu code={rawCode} setCode={setRawCode} a={ra} setA={setRa} b={rb} setB={setRb} fromGates={gates.code} />
        <Panel title="Traps and conventions">
          <Callout kind="trap" cite="L12 p18, p23; AY23/24 S2 Q9">
            For R-type the opcode alone does not fix ALUcontrol: ALUop 10 hands the choice to funct. Every other signal comes from the opcode alone.
          </Callout>
          <Callout kind="trap" cite="L12 p33, AY15/16 Q9a">
            The L12 PLA has no term for addi (001000) or bne (000101): every output is 0, so as drawn the control unit cannot run them.
          </Callout>
          <Callout kind="trap" cite="R06 p20, L11 p34">
            ALUcontrol3 is always 0, so the ALU control unit can never ask for NOR (1100), even though the ALU has it.
          </Callout>
          <Callout kind="course" cite="L12 p22, p27">
            The 4 ALUcontrol bits are Ainvert, Binvert and Operation[1:0]. L12 p27 shrinks the table with X entries: beq is ALUop X1, R-type 1X, and F5 F4 are X.
          </Callout>
        </Panel>
      </div>
    </Workspace>
  )
}

/** The ALU driven by Ainvert, Binvert and Operation directly, on two 32-bit operands (L12 p21-22). */
function RawAlu({ code, setCode, a, setA, b, setB, fromGates }: { code: number; setCode: (v: number) => void; a: string; setA: (v: string) => void; b: string; setB: (v: string) => void; fromGates: string }) {
  const av = parseNum(a)
  const bv = parseNum(b)
  const bits = bin(code & 15, 4)
  const r = av !== null && bv !== null ? aluRaw(+bits[0] as 0 | 1, +bits[1] as 0 | 1, bits.slice(2) as '00', av, bv) : null
  return (
    <Panel title="ALU from its four control bits" actions={<span className="dp-cite">L12 p21-22</span>}>
      <BitButtons label="ALUcontrol bits" names={['Ainvert', 'Binvert', 'Operation1', 'Operation0']} value={code & 15} width={4} onChange={setCode} />
      <div className="dp-input-row">
        <TextField label="A" value={a} onChange={setA} mono width="9em" />
        <TextField label="B" value={b} onChange={setB} mono width="9em" />
        <Button onClick={() => setCode(parseInt(fromGates, 2))} title="Copy the ALUcontrol the gates above produce">
          Use ALUcontrol {fromGates}
        </Button>
      </div>
      {av === null || bv === null ? <p className="dp-err">{av === null ? 'A' : 'B'} is not a number (try 12, -5 or 0x1F).</p> : null}
      {r ? (
        <>
          <p className="dp-does">
            {r.code} computes <strong>{r.name}</strong>
            {r.named ? '' : ' (not one of the L11 p34 codes)'}.
          </p>
          <p className="dp-does mono">
            Result ={' '}
            <W e={r.why}>{r.result === null ? 'not defined' : `${hex(r.result)} (${r.result | 0})`}</W>
            {r.isZero === null ? null : <>, isZero = {r.isZero}</>}
          </p>
        </>
      ) : null}
      <p className="dp-hint">
        Ainvert and Binvert flip every bit of A and B before the gates; Operation picks AND, OR, the adder or slt. Binvert is also the carry into bit 0, so 0110 gives A + B' + 1, which is A - B in two's complement. The slt wiring itself is not shown in the course.
      </p>
    </Panel>
  )
}
