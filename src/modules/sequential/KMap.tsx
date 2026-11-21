import { useId } from 'react'
import type { CellValue, KMapLayout, LoopPiece } from '../../core/boolean'

const C = 40
const LEFT = 58
const BAR = 16
const GAP = 30

/**
 * A small K-map for one flip-flop input or output. Cells show 1, 0 or X; after the commit step an X shows the
 * value the chosen equation gives it, d(1) or d(0) (T09 Ans p3). Loops are the terms of the chosen equation.
 */
export function KMap({
  layout,
  values,
  loops,
  committed,
  focus = [],
  label,
  step,
}: {
  layout: KMapLayout
  values: CellValue[]
  loops: { key: string; pieces: LoopPiece[]; term: string }[]
  committed?: Map<number, 0 | 1>
  focus?: number[]
  label: string
  /** Changes with the step, so the loops trace themselves in again. Leave it out for a still picture. */
  step?: number | string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const rows = layout.rowCodes.length
  const cols = layout.colCodes.length
  const two = layout.maps.length > 1
  const top = 46 + (two ? 20 : 0)
  const gridW = cols * C
  const gridH = rows * C
  const mapW = LEFT + gridW + 12 + layout.rowBars.length * BAR + 10
  const width = mapW * layout.maps.length + GAP * (layout.maps.length - 1)
  const height = top + gridH + 12 + layout.colBars.length * BAR + 6
  const ox = (map: number) => map * (mapW + GAP) + LEFT
  const fset = new Set(focus)
  /** Loop rectangle for one piece; open sides run past the grid edge to show the wrap. */
  const box = (gx: number, p: LoopPiece, li: number) => {
    const inset = 3 + (li % 3) * 2.5
    const ext = 14
    return {
      x0: gx + p.c0 * C + inset - (p.open.left ? ext : 0),
      x1: gx + (p.c1 + 1) * C - inset + (p.open.right ? ext : 0),
      y0: top + p.r0 * C + inset - (p.open.top ? ext : 0),
      y1: top + (p.r1 + 1) * C - inset + (p.open.bottom ? ext : 0),
    }
  }
  return (
    <svg className="seq-kmap" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        {layout.maps.map((_, map) => (
          <clipPath id={`${uid}-c${map}`} key={map}>
            <rect x={ox(map) - 1} y={top - 1} width={gridW + 2} height={gridH + 2} />
          </clipPath>
        ))}
      </defs>
      {layout.maps.map((m, map) => {
        const gx = ox(map)
        return (
          <g key={map}>
            {two ? (
              <text x={gx + gridW / 2} y={14} textAnchor="middle" className="km-var">
                {m.label}
              </text>
            ) : null}
            <line x1={gx - 42} y1={top - 38} x2={gx} y2={top} className="km-rule" />
            <text x={gx - 40} y={top - 3} className="km-var">
              {layout.rowVars.join('')}
            </text>
            <text x={gx - 2} y={top - 27} textAnchor="end" className="km-var">
              {layout.colVars.join('')}
            </text>
            {layout.colCodes.map((code, ci) => (
              <text key={ci} x={gx + ci * C + C / 2} y={top - 7} textAnchor="middle" className="km-code">
                {code}
              </text>
            ))}
            {layout.rowCodes.map((code, ri) => (
              <text key={ri} x={gx - 7} y={top + ri * C + C / 2 + 4} textAnchor="end" className="km-code">
                {code}
              </text>
            ))}
            {layout.rowBars.map((b, k) => {
              const x = gx + gridW + 12 + k * BAR
              const y0 = top + Math.min(...b.indices) * C + 5
              const y1 = top + (Math.max(...b.indices) + 1) * C - 5
              return (
                <g key={b.v}>
                  <line x1={x} y1={y0} x2={x} y2={y1} className="km-bar" />
                  <text x={x + 4} y={(y0 + y1) / 2 + 4} className="km-var">
                    {b.v}
                  </text>
                </g>
              )
            })}
            {layout.colBars.map((b, k) => {
              const y = top + gridH + 10 + k * BAR
              const x0 = gx + Math.min(...b.indices) * C + 5
              const x1 = gx + (Math.max(...b.indices) + 1) * C - 5
              return (
                <g key={b.v}>
                  <line x1={x0} y1={y} x2={x1} y2={y} className="km-bar" />
                  <text x={x1 + 4} y={y + 4} className="km-var">
                    {b.v}
                  </text>
                </g>
              )
            })}
            {layout.grid[map].map((row, ri) =>
              row.map((cell, ci) => {
                const x = gx + ci * C
                const y = top + ri * C
                const v = values[cell]
                const d = v === 'X' ? committed?.get(cell) : undefined
                return (
                  <g key={cell} className={`km-cell${v === 'X' ? ' is-x' : v === 1 ? ' is-1' : ''}${fset.has(cell) ? ' is-focus' : ''}`}>
                    <rect x={x} y={y} width={C} height={C} />
                    <text x={x + C / 2} y={y + C / 2 + (d === undefined ? 5 : 2)} textAnchor="middle" className="km-val">
                      {d === undefined ? String(v) : `d(${d})`}
                    </text>
                    <text x={x + 3} y={y + C - 4} className="km-idx">
                      {cell}
                    </text>
                  </g>
                )
              }),
            )}
            <g clipPath={`url(#${uid}-c${map})`}>
              {loops.map((lp, li) =>
                lp.pieces
                  .filter((p) => p.map === map)
                  .map((p, pi) => {
                    const { x0, x1, y0, y1 } = box(gx, p, li)
                    return <rect key={`${lp.key}-${pi}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={10} className={`km-loop km-loop-${li % 4}`} />
                  }),
              )}
              {/* Each loop traces itself in, then fades so the dash pattern that tells loops apart shows (sequential.css). */}
              {step !== undefined ? (
                <g className="flow-draw seq-km-draw" key={`d${step}`} aria-hidden="true">
                  {loops.flatMap((lp, li) =>
                    lp.pieces
                      .filter((p) => p.map === map)
                      .map((p, pi) => {
                        const { x0, x1, y0, y1 } = box(gx, p, li)
                        const r = Math.min(10, (x1 - x0) / 2, (y1 - y0) / 2)
                        const d = `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
                        return <path key={`${lp.key}-${pi}`} d={d} pathLength={1} style={{ animationDelay: `${li * 0.25}s, ${1.1 + li * 0.25}s` }} />
                      }),
                  )}
                </g>
              ) : null}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
