import { useId, type KeyboardEvent } from 'react'
import type { CellValue, KMapLayout, LoopPiece } from '../../core/boolean'

/**
 * How a loop is drawn. `new`/`epi` use --sig-path (the PI being added now, the EPIs); `pi` is a plain PI;
 * `chosen` is a PI in the cover being shown; `faded` a PI left out; `ghost` a don't-care-only group (not a PI);
 * `wrong` a typed term that covers a cell it must not; `nonprime` a typed term that is not a PI.
 */
export type LoopStyle = 'new' | 'pi' | 'epi' | 'chosen' | 'faded' | 'ghost' | 'wrong' | 'nonprime'

export interface LoopDraw {
  key: string
  pieces: LoopPiece[]
  style: LoopStyle
  label?: string
}

const C = 46
const LEFT = 64
const BAR = 18
const GAP = 36

export interface KMapSvgProps {
  layout: KMapLayout
  values: CellValue[]
  loops: LoopDraw[]
  /** Cells to highlight as the current step. */
  focus?: number[]
  /** Cells that make a PI essential (ringed). */
  reasons?: number[]
  /** Target cells already covered (drawn quiet). */
  covered?: number[]
  /** Cells where a typed answer is wrong. */
  bad?: number[]
  showIndex?: boolean
  onCell?: (m: number) => void
  label: string
}

export function KMapSvg({ layout, values, loops, focus = [], reasons = [], covered = [], bad = [], showIndex = true, onCell, label }: KMapSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rows = layout.rowCodes.length
  const cols = layout.colCodes.length
  const two = layout.maps.length > 1
  const top = 50 + (two ? 22 : 0)
  const gridW = cols * C
  const gridH = rows * C
  const mapW = LEFT + gridW + 14 + layout.rowBars.length * BAR + 12
  const width = mapW * layout.maps.length + (two ? GAP : 0) * (layout.maps.length - 1)
  const height = top + gridH + 14 + layout.colBars.length * BAR + 6
  const fset = new Set(focus)
  const rset = new Set(reasons)
  const cset = new Set(covered)
  const bset = new Set(bad)
  const ox = (map: number) => map * (mapW + GAP) + LEFT

  return (
    <svg
      className="bo-kmap"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={onCell ? 'group' : 'img'}
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <pattern id={`${uid}-x`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="bo-hatch" />
        </pattern>
        {layout.maps.map((_, map) => (
          <clipPath id={`${uid}-clip${map}`} key={map}>
            <rect x={ox(map)} y={top} width={gridW} height={gridH} />
          </clipPath>
        ))}
      </defs>
      {layout.maps.map((m, map) => {
        const gx = ox(map)
        return (
          <g key={map}>
            {two ? (
              <text x={gx + gridW / 2} y={16} className="bo-k-map" textAnchor="middle">
                {m.label}
              </text>
            ) : null}
            {/* Corner: row variables below the diagonal, column variables above it. */}
            <line x1={gx - 46} y1={top - 42} x2={gx} y2={top} className="bo-k-rule" />
            <text x={gx - 44} y={top - 4} className="bo-k-var">
              {layout.rowVars.join('')}
            </text>
            <text x={gx - 2} y={top - 30} className="bo-k-var" textAnchor="end">
              {layout.colVars.join('')}
            </text>
            {layout.colCodes.map((code, c) => (
              <text key={c} x={gx + c * C + C / 2} y={top - 8} className="bo-k-code" textAnchor="middle">
                {code}
              </text>
            ))}
            {layout.rowCodes.map((code, r) => (
              <text key={r} x={gx - 8} y={top + r * C + C / 2 + 4} className="bo-k-code" textAnchor="end">
                {code}
              </text>
            ))}
            {layout.rowBars.map((b, k) => {
              const x = gx + gridW + 14 + k * BAR
              const y0 = top + Math.min(...b.indices) * C + 6
              const y1 = top + (Math.max(...b.indices) + 1) * C - 6
              return (
                <g key={b.v}>
                  <line x1={x} y1={y0} x2={x} y2={y1} className="bo-k-bar" />
                  <text x={x + 4} y={(y0 + y1) / 2 + 4} className="bo-k-var">
                    {b.v}
                  </text>
                </g>
              )
            })}
            {layout.colBars.map((b, k) => {
              const y = top + gridH + 12 + k * BAR
              const x0 = gx + Math.min(...b.indices) * C + 6
              const x1 = gx + (Math.max(...b.indices) + 1) * C - 6
              return (
                <g key={b.v}>
                  <line x1={x0} y1={y} x2={x1} y2={y} className="bo-k-bar" />
                  <text x={x1 + 4} y={y + 4} className="bo-k-var">
                    {b.v}
                  </text>
                </g>
              )
            })}
            {layout.grid[map].map((row, r) =>
              row.map((cell, c) => {
                const x = gx + c * C
                const y = top + r * C
                const v = values[cell]
                const cls = ['bo-cell', fset.has(cell) ? 'is-focus' : '', cset.has(cell) ? 'is-covered' : '', bset.has(cell) ? 'is-bad' : '', onCell ? 'is-edit' : '']
                  .filter(Boolean)
                  .join(' ')
                const act = onCell
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `m${cell} is ${v}; press to change`,
                      onClick: () => onCell(cell),
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onCell(cell)
                        }
                      },
                    }
                  : {}
                return (
                  <g key={cell} className={cls} {...act}>
                    <rect x={x} y={y} width={C} height={C} className="bo-cell-bg" />
                    {v === 'X' ? <rect x={x + 1} y={y + 1} width={C - 2} height={C - 2} fill={`url(#${uid}-x)`} className="bo-cell-x" /> : null}
                    {showIndex ? (
                      <text x={x + 4} y={y + 12} className="bo-k-index">
                        {cell}
                      </text>
                    ) : null}
                    <text x={x + C / 2} y={y + C / 2 + 6} textAnchor="middle" className={`bo-k-val v-${v === 'X' ? 'x' : v}`}>
                      {v}
                    </text>
                    {rset.has(cell) ? <circle cx={x + C / 2} cy={y + C / 2 + 1} r={14} className="bo-reason" /> : null}
                  </g>
                )
              }),
            )}
            <rect x={gx} y={top} width={gridW} height={gridH} className="bo-k-frame" />
          </g>
        )
      })}
      {loops.map((l, k) => {
        const inset = 5 + (k % 4) * 3
        return (
          <g key={l.key} className={`bo-loop loop-${l.style}`}>
            {l.pieces.map((p, i) => {
              const gx = ox(p.map)
              let x0 = gx + p.c0 * C + inset
              let x1 = gx + (p.c1 + 1) * C - inset
              let y0 = top + p.r0 * C + inset
              let y1 = top + (p.r1 + 1) * C - inset
              if (p.open.left) x0 -= C
              if (p.open.right) x1 += C
              if (p.open.top) y0 -= C
              if (p.open.bottom) y1 += C
              return (
                <rect
                  key={i}
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={y1 - y0}
                  rx={13}
                  clipPath={`url(#${uid}-clip${p.map})`}
                  className="bo-loop-shape"
                />
              )
            })}
            {l.label && l.pieces[0] ? (
              <text
                x={Math.min(ox(l.pieces[0].map) + (l.pieces[0].c1 + 1) * C - inset - 3, ox(l.pieces[0].map) + cols * C - 3)}
                y={Math.min(top + (l.pieces[0].r1 + 1) * C - inset - 3, top + gridH - 3)}
                textAnchor="end"
                className="bo-loop-label"
              >
                {l.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
