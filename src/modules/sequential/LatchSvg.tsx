import type { Bit, LatchSettle, LatchType } from '../../core/sequential'

const GW = 56
const GH = 40

/** OR body (NOR when a bubble follows). Inputs on the left edge, output at x + GW. */
const orPath = (x: number, cy: number) => {
  const y = cy - GH / 2
  return `M${x} ${y} Q${x + 14} ${cy} ${x} ${y + GH} Q${x + GW * 0.62} ${y + GH} ${x + GW} ${cy} Q${x + GW * 0.62} ${y} ${x} ${y} Z`
}
/** AND body (NAND when a bubble follows). */
const andPath = (x: number, cy: number) => {
  const y = cy - GH / 2
  return `M${x} ${y} H${x + GW - GH / 2} A${GH / 2} ${GH / 2} 0 0 1 ${x + GW - GH / 2} ${y + GH} H${x} Z`
}

function Gate({ x, cy, kind, active }: { x: number; cy: number; kind: 'nor' | 'nand'; active?: boolean }) {
  return (
    <g className={`lt-gate${active ? ' is-active' : ''}`}>
      <path d={kind === 'nor' ? orPath(x, cy) : andPath(x, cy)} />
      <circle cx={x + GW + 4} cy={cy} r={4} />
      <text x={x + (kind === 'nor' ? 22 : 18)} y={cy + 4} className="lt-gname">
        {kind === 'nor' ? 'NOR' : 'NAND'}
      </text>
    </g>
  )
}

const val = (v: Bit | 'X') => String(v)

/**
 * Gate-level latch for one settling round (L19 p9-15). The two cross-coupled gates read the previous round's
 * outputs; outputs that changed in this round are marked. Gated latches add two front NAND gates.
 */
export function LatchSvg({ type, values, settle, round }: { type: LatchType; values: Record<string, Bit>; settle: LatchSettle; round: number }) {
  const gated = type === 'gated-sr' || type === 'gated-d'
  const kind = type === 'sr-nor' ? 'nor' : 'nand'
  const r = settle.rounds[Math.min(round, settle.rounds.length - 1)]
  const prev = settle.rounds[Math.max(0, Math.min(round, settle.rounds.length - 1) - 1)]
  const mx = gated ? 230 : 140
  const topY = 60
  const botY = 160
  const outX = mx + GW + 8
  const width = outX + 136
  // Inputs into the cross-coupled pair: NOR takes R on top and S below (L19 p9); NAND takes S' on top, R' below.
  const topIn = type === 'sr-nor' ? 'R' : gated ? "S'" : "S'"
  const botIn = type === 'sr-nor' ? 'S' : "R'"
  const topVal: Bit = type === 'sr-nor' ? settle.r : settle.s
  const botVal: Bit = type === 'sr-nor' ? settle.s : settle.r
  const changedQ = r.changed.includes('Q')
  const changedQb = r.changed.includes("Q'")
  const front = type === 'gated-d' ? ['D', "D'"] : ['S', 'R']
  const frontVals: Bit[] = type === 'gated-d' ? [values.D, (1 - values.D) as Bit] : [values.S, values.R]
  return (
    <svg className="lt" viewBox={`0 0 ${width} 220`} width={width} height={220} role="img" aria-label={`Latch gates, round ${r.round}: Q = ${r.q}, Q' = ${r.qBar}`}>
      <title>{`Latch gates, round ${r.round}`}</title>
      {gated ? (
        <g>
          {[topY, botY].map((cy, i) => (
            <g key={i}>
              <Gate x={80} cy={cy} kind="nand" />
              <line x1={20} y1={cy - 12} x2={80} y2={cy - 12} className="lt-wire" />
              <line x1={20} y1={cy + 12} x2={80} y2={cy + 12} className="lt-wire lt-en" />
              <text x={6} y={cy - 8} className="lt-label">
                {front[i]} = {frontVals[i]}
              </text>
              <text x={6} y={cy + 26} className="lt-label lt-en-label">
                EN = {values.EN}
              </text>
              <line x1={80 + GW + 8} y1={cy} x2={mx} y2={cy + (i === 0 ? -12 : 12)} className="lt-wire" />
              <text x={80 + GW + 12} y={cy + (i === 0 ? -6 : 22)} className="lt-label lt-mid">
                {i === 0 ? topIn : botIn} = {i === 0 ? topVal : botVal}
              </text>
            </g>
          ))}
        </g>
      ) : (
        <g>
          <line x1={20} y1={topY - 12} x2={mx} y2={topY - 12} className="lt-wire" />
          <text x={6} y={topY - 18} className="lt-label">
            {topIn} = {topVal}
          </text>
          <line x1={20} y1={botY + 12} x2={mx} y2={botY + 12} className="lt-wire" />
          <text x={6} y={botY + 30} className="lt-label">
            {botIn} = {botVal}
          </text>
        </g>
      )}
      <Gate x={mx} cy={topY} kind={kind} active={changedQ} />
      <Gate x={mx} cy={botY} kind={kind} active={changedQb} />
      {/* Outputs and the crossed feedback wires. */}
      <line x1={outX} y1={topY} x2={outX + 60} y2={topY} className={`lt-wire${changedQ ? ' is-active' : ''}`} />
      <line x1={outX} y1={botY} x2={outX + 60} y2={botY} className={`lt-wire${changedQb ? ' is-active' : ''}`} />
      <path d={`M${outX + 14} ${topY} V${topY + 26} L${mx - 14} ${botY - 30} V${botY - 12} H${mx}`} className="lt-wire lt-fb" />
      <path d={`M${outX + 14} ${botY} V${botY - 26} L${mx - 14} ${topY + 30} V${topY + 12} H${mx}`} className="lt-wire lt-fb" />
      <circle cx={outX + 14} cy={topY} r={2.5} className="lt-dot" />
      <circle cx={outX + 14} cy={botY} r={2.5} className="lt-dot" />
      <text x={outX + 64} y={topY + 4} className={`lt-out${changedQ ? ' is-active' : ''}`}>
        Q = {val(r.q)}
      </text>
      <text x={outX + 64} y={botY + 4} className={`lt-out${changedQb ? ' is-active' : ''}`}>
        Q' = {val(r.qBar)}
      </text>
      <text x={mx - 20} y={topY + 26} textAnchor="end" className="lt-label lt-fbval">
        reads Q' = {prev.qBar}
      </text>
      <text x={mx - 20} y={botY - 18} textAnchor="end" className="lt-label lt-fbval">
        reads Q = {prev.q}
      </text>
    </svg>
  )
}
