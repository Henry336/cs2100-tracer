import { OP_BY_NAME, bin, hex, type BranchOffsetExplain, type EncodingExplain, type ExecFrame, type Instr, type JumpTargetExplain, type Program } from '../../core/mips'
import { Flow } from '../../ui/board'
import { W } from './common'

type Role = 'control' | 'data' | 'reg' | 'zero'

function roleOf(f: EncodingExplain['fields'][number]): Role {
  if (f.why.rule.startsWith('0:')) return 'zero'
  if (f.name === 'opcode' || f.name === 'funct') return 'control'
  if (f.name === 'immediate' || f.name === 'target' || f.name === 'shamt') return 'data'
  return 'reg'
}

function valueText(f: EncodingExplain['fields'][number]): string {
  if (f.name === 'rs' || f.name === 'rt' || f.name === 'rd') return `$${f.value}`
  if (f.name === 'target') return hex(f.value, 7)
  return String(f.value)
}

/** The 32 bits on one grid: fields with bit numbers, each bit, field values, then the 8 hex nibbles (L08 p12). */
export function FieldGrid({ ex }: { ex: EncodingExplain }) {
  const fieldAt = (bit: number) => ex.fields.find((f) => bit <= f.bits[0] && bit >= f.bits[1])!
  return (
    <div className="mp-fields" role="group" aria-label={`${ex.format}-format fields`}>
      {ex.fields.map((f) => {
        const [hi, lo] = f.bits
        const col = `${32 - hi} / span ${hi - lo + 1}`
        return (
          <div key={f.name} className={`mp-fhead mp-f-${roleOf(f)}`} style={{ gridColumn: col, gridRow: 1 }}>
            <span className="mp-fbits mono">
              <span>{hi}</span>
              {hi !== lo ? <span>{lo}</span> : null}
            </span>
            <span className="mp-fname">{f.name}</span>
          </div>
        )
      })}
      {ex.binary.split('').map((b, k) => {
        const bit = 31 - k
        const f = fieldAt(bit)
        return (
          <span key={k} className={`mp-bit mono mp-f-${roleOf(f)}${bit === f.bits[1] && bit > 0 ? ' mp-bit-edge' : ''}`} style={{ gridColumn: k + 1, gridRow: 2 }}>
            {b}
          </span>
        )
      })}
      {ex.fields.map((f) => (
        <div key={f.name} className="mp-fval mono" style={{ gridColumn: `${32 - f.bits[0]} / span ${f.bits[0] - f.bits[1] + 1}`, gridRow: 3 }}>
          <W e={f.why}>{valueText(f)}</W>
        </div>
      ))}
      {ex.nibbles.map((n, k) => (
        <div key={k} className="mp-nib" style={{ gridColumn: `${k * 4 + 1} / span 4`, gridRow: 4 }}>
          <span className="mono mp-nib-bits">{n}</span>
          <span className="mono mp-nib-hex">{parseInt(n, 2).toString(16).toUpperCase()}</span>
        </div>
      ))}
    </div>
  )
}

const SW = 64

/** Instruction slots around a branch, counted in words from PC+4 (L08 p27-28). */
export function BranchRuler({ b }: { b: BranchOffsetExplain }) {
  const imm = b.imm
  const lo = Math.min(-1, imm) - 1
  const hi = Math.max(0, imm) + 1
  type Slot = { k: number } | { gap: number }
  let slots: Slot[]
  if (hi - lo <= 14) slots = Array.from({ length: hi - lo + 1 }, (_, j) => ({ k: lo + j }))
  else {
    // Keep the words near PC+4 and near the target, in address order, and fold the rest into a gap.
    const first = imm < 0 ? [imm - 1, imm, imm + 1] : [-2, -1, 0, 1]
    const second = imm < 0 ? [-2, -1, 0, 1] : [imm - 1, imm, imm + 1]
    slots = [...first.map((k) => ({ k })), { gap: second[0] - first[first.length - 1] - 1 }, ...second.map((k) => ({ k }))]
  }
  const x = (j: number) => 24 + j * SW
  const idx = (k: number) => slots.findIndex((s) => 'k' in s && s.k === k)
  const from = x(idx(0)) + (SW - 6) / 2
  const to = x(idx(imm)) + (SW - 6) / 2
  const width = x(slots.length) + 24
  const peak = 18
  return (
    <div className="mp-scroll">
      <svg className="mp-svg" width={width} height={138} viewBox={`0 0 ${width} 138`} role="img" aria-label={`Branch from ${hex(b.pc)} to ${hex(b.target)}: ${imm} instructions from PC+4`}>
        <defs>
          <marker id="mp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" className="mp-arrowhead" />
          </marker>
        </defs>
        {slots.map((s, j) => {
          if ('gap' in s) {
            return (
              <g key={j}>
                <text x={x(j) + (SW - 6) / 2} y={81} className="mp-t mp-t-mid">...</text>
                <text x={x(j) + (SW - 6) / 2} y={118} className="mp-t mp-t-small mp-t-mid">{s.gap} more</text>
              </g>
            )
          }
          const k = s.k
          const a = (b.pcPlus4 + 4 * k) >>> 0
          const cls = k === imm ? 'mp-box-target' : k === 0 ? 'mp-box-origin' : k === -1 ? 'mp-box-branch' : 'mp-box'
          const tag = k === imm ? 'target' : k === 0 ? 'PC+4' : k === -1 ? 'branch' : ''
          return (
            <g key={j}>
              <text x={x(j) + (SW - 6) / 2} y={56} className="mp-t mp-t-mid mono">{k > 0 ? `+${k}` : k}</text>
              <rect x={x(j)} y={62} width={SW - 6} height={30} rx={2} className={cls} />
              <text x={x(j) + (SW - 6) / 2} y={81} className="mp-t mp-t-small mp-t-mid">{tag}</text>
              <text x={x(j) + (SW - 6) / 2} y={108} className="mp-t mp-t-small mp-t-mid mono">{hex(a).slice(2)}</text>
            </g>
          )
        })}
        {imm === 0 ? null : (
          <>
            <path d={`M${from} 62 C${from} ${peak} ${to} ${peak} ${to} 60`} className="mp-arc" markerEnd="url(#mp-arrow)" />
            <Flow id={`${b.pc}-${imm}`} paths={[`M${from} 62 C${from} ${peak} ${to} ${peak} ${to} 60`]} />
            <text x={(from + to) / 2} y={peak + 12} className="mp-t mp-t-mid mp-t-path mono">imm = {imm}</text>
          </>
        )}
        <text x={24} y={132} className="mp-t mp-t-small">words from PC+4 above, addresses below</text>
      </svg>
    </div>
  )
}

const BW = 15
const X0 = 92

function BitRow({ y, bits, role, label, value }: { y: number; bits: string; role: (bit: number) => string; label: string; value: string }) {
  return (
    <g>
      <text x={0} y={y + 10} className="mp-t">{label}</text>
      <text x={0} y={y + 24} className="mp-t mp-t-small mono">{value}</text>
      {bits.split('').map((c, k) => (
        <g key={k}>
          <rect x={X0 + k * BW} y={y} width={BW} height={20} className={`mp-cell ${role(31 - k)}`} />
          <text x={X0 + k * BW + BW / 2} y={y + 14} className="mp-t mp-t-mid mono mp-t-bit">{c}</text>
        </g>
      ))}
    </g>
  )
}

/** New PC = {PC+4[31:28], target field, 00}: the opcode bits are dropped, not replaced (L08 p37-39). */
export function JumpSplice({ jx, instr }: { jx: JumpTargetExplain; instr: Instr }) {
  const cx = (bit: number) => X0 + (31 - bit) * BW
  const yA = 22
  const yB = 104
  const yC = 186
  const width = X0 + 32 * BW + 8
  return (
    <div className="mp-scroll">
      <svg className="mp-svg" width={width} height={232} viewBox={`0 0 ${width} 232`} role="img" aria-label={`Jump target ${hex(jx.target)} built from PC+4 bits 31 to 28, the 26-bit target field and 00`}>
        <polygon points={`${cx(31)},${yA + 20} ${cx(28) + BW},${yA + 20} ${cx(28) + BW},${yB} ${cx(31)},${yB}`} className="mp-flow-path" />
        <polygon points={`${cx(25)},${yC} ${cx(0) + BW},${yC} ${cx(2) + BW},${yB + 20} ${cx(27)},${yB + 20}`} className="mp-flow-data" />
        <Flow id={`${jx.pcPlus4}-${jx.target}`} paths={[`M${cx(29)} ${yA + 20} V${yB}`]} />
        <Flow id={`${jx.pcPlus4}-${jx.target}`} paths={[`M${cx(13) + BW / 2} ${yC} L${cx(15) + BW / 2} ${yB + 20}`]} tone="data" />
        <BitRow y={yA} bits={bin(jx.pcPlus4, 32)} label="PC+4" value={hex(jx.pcPlus4)} role={(b) => (b >= 28 ? 'mp-cell-path' : 'mp-cell-off')} />
        <BitRow y={yB} bits={bin(jx.target, 32)} label="New PC" value={hex(jx.target)} role={(b) => (b >= 28 ? 'mp-cell-path' : b >= 2 ? 'mp-cell-data' : 'mp-cell-zero')} />
        <BitRow y={yC} bits={bin(instr.word, 32)} label={`${instr.mnemonic} word`} value={hex(instr.word)} role={(b) => (b >= 26 ? 'mp-cell-control' : 'mp-cell-data')} />
        <text x={cx(31)} y={yA - 6} className="mp-t mp-t-small">PC+4[31:28]</text>
        <text x={cx(0) + BW} y={yB - 6} className="mp-t mp-t-small mp-t-end">00 appended</text>
        <text x={cx(31)} y={yC + 34} className="mp-t mp-t-small">opcode, dropped</text>
        <text x={cx(25)} y={yC + 34} className="mp-t mp-t-small">target field, bits 25-0, shifted left 2</text>
      </svg>
    </div>
  )
}

const RH = 24
const GUT = 58
const PW = 540

/**
 * The program as the machine sees it: one row per real instruction at its address.
 * An arrow in the gutter shows where the PC goes next: PC+4, a taken branch or a jump (L08 p28, p39).
 */
export function ProgramFlow({ program, f, step }: { program: Program; f?: ExecFrame; step: number }) {
  const ins = program.instructions
  const rowOf = (a: number) => {
    const r = ins.findIndex((x) => x.address === a)
    return r < 0 ? ins.length : r
  }
  const y = (r: number) => 12 + r * RH + RH / 2
  const height = 12 + (ins.length + 1) * RH + 10
  const arc = (a: number, b: number) => {
    if (a === b) return `M${GUT} ${y(a) - 5} C${GUT - 30} ${y(a) - 22} ${GUT - 30} ${y(a) + 22} ${GUT} ${y(a) + 5}`
    const bulge = Math.min(GUT - 8, 12 + Math.abs(b - a) * 4)
    return `M${GUT} ${y(a)} C${GUT - bulge} ${y(a)} ${GUT - bulge} ${y(b)} ${GUT - 2} ${y(b)}`
  }
  const cur = f ? rowOf(f.pc) : -1
  const nxt = f ? rowOf(f.nextPc) : -1
  const kind = f ? OP_BY_NAME[f.instr.mnemonic]?.kind : undefined
  const offTarget = f && kind === 'branch' && !f.taken && f.instr.targetAddress !== undefined ? rowOf(f.instr.targetAddress) : -1
  const why =
    !f ? '' : kind === 'branch' ? (f.taken ? 'branch taken' : 'not taken: PC+4') : kind === 'jump' ? 'jump' : kind === 'jr' ? 'jr: PC = rs' : 'PC+4'
  return (
    <div className="mp-scroll">
      <svg
        className="mp-svg mp-prog-svg"
        width={PW}
        height={height}
        viewBox={`0 0 ${PW} ${height}`}
        role="img"
        aria-label={f ? `Program, at ${hex(f.pc)}: ${f.instr.text}; next PC ${hex(f.nextPc)} (${why})` : 'Program listing'}
      >
        <defs>
          <marker id="mp-run-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" className="mp-arrowhead" />
          </marker>
        </defs>
        {ins.map((x, r) => (
          <g key={r}>
            <rect
              x={GUT}
              y={12 + r * RH + 2}
              width={PW - GUT - 4}
              height={RH - 4}
              rx={4}
              className={r === cur ? 'mp-line-now' : r === nxt ? 'mp-line-next' : 'mp-line'}
            />
            <text x={GUT + 8} y={y(r) + 4} className="mp-t mp-t-small mono">{hex(x.address).slice(2)}</text>
            {x.label ? <text x={GUT + 72} y={y(r) + 4} className="mp-t mono">{x.label}:</text> : null}
            <text x={GUT + 140} y={y(r) + 4} className={`mp-t mono${r === cur ? ' mp-t-now' : ''}`}>{x.text}</text>
            {r === cur ? (
              <text x={PW - 12} y={y(r) + 4} className="mp-t mp-t-small mp-t-end mp-t-path">next: {why}</text>
            ) : x.pseudoOf ? (
              <text x={PW - 12} y={y(r) + 4} className="mp-t mp-t-small mp-t-end">from {x.pseudoOf.split(/\s/)[0]}</text>
            ) : null}
          </g>
        ))}
        <rect x={GUT} y={12 + ins.length * RH + 2} width={PW - GUT - 4} height={RH - 4} rx={4} className={nxt === ins.length ? 'mp-line-next' : 'mp-line-end'} />
        <text x={GUT + 140} y={y(ins.length) + 4} className="mp-t mp-t-small">end of program</text>
        {offTarget >= 0 ? <path d={arc(cur, offTarget)} className="mp-arc-off" /> : null}
        {f ? (
          <>
            <path d={arc(cur, nxt)} className="mp-arc" markerEnd="url(#mp-run-arrow)" />
            <Flow id={step} paths={[arc(cur, nxt)]} />
          </>
        ) : null}
      </svg>
    </div>
  )
}

const CX0 = 16

function Bits({ y, value, label, role }: { y: number; value: number; label: string; role: (bit: number, c: string) => string }) {
  const bits = bin(value >>> 0, 32)
  return (
    <g>
      <text x={CX0} y={y - 7} className="mp-t mono">{label}</text>
      <text x={CX0 + 32 * BW} y={y - 7} className="mp-t mono mp-t-end">{hex(value >>> 0)}</text>
      {bits.split('').map((c, k) => (
        <g key={k}>
          <rect x={CX0 + k * BW} y={y} width={BW} height={20} className={`mp-cell ${role(31 - k, c)}`} />
          <text x={CX0 + k * BW + BW / 2} y={y + 14} className="mp-t mp-t-mid mono mp-t-bit">{c}</text>
        </g>
      ))}
    </g>
  )
}

/**
 * lui puts the upper half in place and clears the lower half; the second instruction fills the lower half.
 * ori zero-extends, so the upper half survives; addi sign-extends, so bit 15 = 1 changes it (L06 p41, p44).
 */
export function ConstPicture({ value, upper, lower, reg, second, result }: { value: number; upper: number; lower: number; reg: string; second: 'ori' | 'addi'; result: number }) {
  const cxb = (bit: number) => CX0 + (31 - bit) * BW
  const yA = 26
  const yB = 92
  const yC = 158
  const width = CX0 * 2 + 32 * BW
  const v = value >>> 0
  const imm = second === 'ori' ? hex(lower, 4) : String(lower >= 0x8000 ? lower - 0x10000 : lower)
  const vb = bin(v, 32)
  const paths = [
    `M${cxb(24)} ${yA + 20} V${yB}`,
    `M${cxb(24)} ${yB + 20} V${yC}`,
    `M${cxb(7)} ${yA + 20} V${yA + 34} H${width - 6} V${yC + 10} H${cxb(0) + BW}`,
  ]
  return (
    <div className="mp-scroll">
      <svg className="mp-svg" width={width} height={196} viewBox={`0 0 ${width} 196`} role="img" aria-label={`${hex(v)} loaded with lui then ${second}: result ${hex(result >>> 0)}`}>
        <path d={paths[0]} className="mp-wire" />
        <path d={paths[1]} className="mp-wire" />
        <path d={paths[2]} className="mp-wire mp-wire-data" />
        <Flow id={`${v}-${second}`} paths={paths.slice(0, 2)} />
        <Flow id={`${v}-${second}`} paths={paths.slice(2)} tone="data" />
        <Bits y={yA} value={v} label="Value" role={(b) => (b >= 16 ? 'mp-cell-path' : 'mp-cell-data')} />
        <Bits y={yB} value={upper * 0x10000} label={`lui ${reg}, ${hex(upper, 4)}`} role={(b) => (b >= 16 ? 'mp-cell-path' : 'mp-cell-zero')} />
        <Bits
          y={yC}
          value={result}
          label={`${second} ${reg}, ${reg}, ${imm}`}
          role={(b, c) => (c !== vb[31 - b] ? 'mp-cell-miss' : b >= 16 ? 'mp-cell-path' : 'mp-cell-data')}
        />
        <text x={CX0} y={yC + 34} className="mp-t mp-t-small">
          {second === 'ori' ? 'ori zero-extends: the upper half is kept' : result >>> 0 === v ? 'addi sign-extends, but bit 15 is 0, so nothing changes' : 'addi sign-extends bit 15 = 1, so it adds a negative number: red bits are wrong'}
        </text>
      </svg>
    </div>
  )
}

/** slt sets the temporary to 1 or 0, then beq or bne against $zero decides the branch (L07 p28-30). */
export function BranchFlow({ a, b, lines, tmp, slt, swap, taken, label }: { a: string; b: string; lines: [string, string]; tmp: string; slt: number; swap: boolean; taken: boolean; label: string }) {
  const width = 700
  const pA = 'M132 40 C160 40 160 64 190 64'
  const pB = 'M132 116 C160 116 160 88 190 88'
  const pAx = 'M132 40 C164 40 160 88 190 88'
  const pBx = 'M132 116 C164 116 160 64 190 64'
  const pT = 'M370 76 H410'
  const pYes = 'M590 66 C606 66 600 34 622 34'
  const pNo = 'M590 86 C606 86 600 118 622 118'
  const ins = swap ? [pAx, pBx] : [pA, pB]
  return (
    <div className="mp-scroll">
      <svg className="mp-svg" width={width} height={156} viewBox={`0 0 ${width} 156`} role="img" aria-label={`${lines[0]} gives ${tmp} = ${slt}; ${lines[1]} is ${taken ? 'taken' : 'not taken'}`}>
        {ins.map((d) => <path key={d} d={d} className="mp-wire mp-wire-data" />)}
        <path d={pT} className="mp-wire mp-wire-data" />
        <path d={pYes} className={taken ? 'mp-wire mp-wire-path' : 'mp-wire mp-wire-off'} />
        <path d={pNo} className={taken ? 'mp-wire mp-wire-off' : 'mp-wire mp-wire-path'} />
        <Flow id={`${lines.join()}-${slt}`} paths={[...ins, pT]} tone="data" />
        <Flow id={`${lines.join()}-${slt}`} paths={[taken ? pYes : pNo]} />
        <rect x={8} y={22} width={124} height={36} rx={4} className="mp-box" />
        <text x={70} y={45} className="mp-t mp-t-mid mono">a: {a}</text>
        <rect x={8} y={98} width={124} height={36} rx={4} className="mp-box" />
        <text x={70} y={121} className="mp-t mp-t-mid mono">b: {b}</text>
        <rect x={190} y={48} width={180} height={56} rx={6} className="mp-box-step" />
        <text x={280} y={70} className="mp-t mp-t-mid mono">{lines[0]}</text>
        <text x={280} y={92} className="mp-t mp-t-mid mono mp-t-path">{tmp} = {slt}</text>
        <rect x={410} y={48} width={180} height={56} rx={6} className="mp-box-step" />
        <text x={500} y={70} className="mp-t mp-t-mid mono">{lines[1]}</text>
        <text x={500} y={92} className="mp-t mp-t-mid mp-t-path">{taken ? 'taken' : 'not taken'}</text>
        <rect x={622} y={20} width={70} height={28} rx={4} className={taken ? 'mp-box-target' : 'mp-box'} />
        <text x={657} y={38} className="mp-t mp-t-mid mono">{label}</text>
        <rect x={622} y={104} width={70} height={28} rx={4} className={taken ? 'mp-box' : 'mp-box-target'} />
        <text x={657} y={122} className="mp-t mp-t-mid">next line</text>
        {swap ? <text x={161} y={150} className="mp-t mp-t-small mp-t-mid">swapped</text> : null}
      </svg>
    </div>
  )
}
