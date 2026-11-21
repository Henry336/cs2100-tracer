import { bin, hex, type BranchOffsetExplain, type EncodingExplain, type Instr, type JumpTargetExplain } from '../../core/mips'
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
