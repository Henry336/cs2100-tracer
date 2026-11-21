import { covers } from './cube'
import type { Cube, Explain } from './types'

/**
 * `rows`: the first variables go on the rows (L15 p19-31 wx/yz, R07 p31, every tutorial and exam key).
 * `cols`: the first variables go on the columns (the A,B,C,D examples in L15 p32-55 and R07 p32-47).
 */
export type Orientation = 'rows' | 'cols'

/** Any variables on any axis, e.g. T06 Q3: A,C on the rows and B,D on the columns. For 5 variables the one left over picks the map. */
export interface Axes {
  rows: string[]
  cols: string[]
}

export interface AxisBar {
  /** Variable named beside/over this axis. */
  v: string
  /** Row or column indices where the variable is 1 (where the bracket goes). */
  indices: number[]
}

export interface KMapLayout {
  n: number
  vars: string[]
  orientation: Orientation | 'custom'
  /** One map, or two for 5 variables: left = first variable 0, right = first variable 1 (L15 p22). */
  maps: { label: string }[]
  rowVars: string[]
  colVars: string[]
  /** Gray order on each axis: 00, 01, 11, 10 (L15 p16). */
  rowCodes: string[]
  colCodes: string[]
  /** grid[map][row][col] = minterm index. */
  grid: number[][][]
  /** Cell of each minterm. */
  where: { map: number; row: number; col: number }[]
  rowBars: AxisBar[]
  colBars: AxisBar[]
  why: Explain
}

const GRAY: Record<number, string[]> = { 0: [''], 1: ['0', '1'], 2: ['00', '01', '11', '10'] }

/** Layout for 2 to 5 variables. Returns null outside that range or for axes that do not split the variables. */
export function kmapLayout(vars: string[], orientation: Orientation | Axes = 'rows'): KMapLayout | null {
  const n = vars.length
  if (n < 2 || n > 5) return null
  let mapVars: string[]
  let rowVars: string[]
  let colVars: string[]
  if (typeof orientation === 'string') {
    mapVars = n === 5 ? vars.slice(0, 1) : []
    const rest = vars.slice(mapVars.length)
    const half = rest.length >> 1
    rowVars = orientation === 'rows' ? rest.slice(0, half) : rest.slice(half)
    colVars = orientation === 'rows' ? rest.slice(half) : rest.slice(0, half)
  } else {
    ;({ rows: rowVars, cols: colVars } = orientation)
    const used = [...rowVars, ...colVars]
    mapVars = vars.filter((v) => !used.includes(v))
    const sizeOk = (a: string[]) => a.length >= 1 && a.length <= 2
    if (!sizeOk(rowVars) || !sizeOk(colVars) || new Set(used).size !== used.length || used.some((v) => !vars.includes(v)) || mapVars.length !== (n === 5 ? 1 : 0))
      return null
  }
  const rowCodes = GRAY[rowVars.length]
  const colCodes = GRAY[colVars.length]
  const mapCount = 1 << mapVars.length
  // The cell index always uses the variable order (first variable = MSB), whatever axis a variable sits on.
  const bitsOf = (axis: string[], code: string) => axis.reduce((m, v, k) => (code[k] === '1' ? m | (1 << (n - 1 - vars.indexOf(v))) : m), 0)
  const where: KMapLayout['where'] = []
  const grid = Array.from({ length: mapCount }, (_, map) =>
    rowCodes.map((rc, row) =>
      colCodes.map((cc, col) => {
        const m = bitsOf(mapVars, String(map)) | bitsOf(rowVars, rc) | bitsOf(colVars, cc)
        where[m] = { map, row, col }
        return m
      }),
    ),
  )
  const bars = (axis: string[], codes: string[]): AxisBar[] =>
    axis.map((v, k) => ({ v, indices: codes.flatMap((c, i) => (c[k] === '1' ? [i] : [])) }))
  const fv = mapVars[0]
  const custom = typeof orientation !== 'string'
  return {
    n,
    vars,
    orientation: custom ? 'custom' : orientation,
    maps: mapCount === 2 ? [{ label: `${fv}'` }, { label: fv }] : [{ label: '' }],
    rowVars,
    colVars,
    rowCodes,
    colCodes,
    grid,
    where,
    rowBars: bars(rowVars, rowCodes),
    colBars: bars(colVars, colCodes),
    why: {
      rule:
        'Rows and columns run in Gray order (00, 01, 11, 10) so neighbouring cells differ in one variable; the first variable is the MSB of the cell index.' +
        (n === 5 ? ' Five variables use two 4-variable maps, one for each value of the first variable; matching cells are adjacent and the maps are not mirrored.' : ''),
      working: custom
        ? `${rowVars.join(',')} on the rows, ${colVars.join(',')} on the columns`
        : orientation === 'rows'
          ? `${rowVars.join('')} on the rows, ${colVars.join('')} on the columns (as in the tutorial and exam keys)`
          : `${colVars.join('')} on the columns, ${rowVars.join('')} on the rows (as in the L15 p32-55 A,B,C,D examples)`,
      cite: custom ? 'T06 Q3; L15 p19' : n === 5 ? 'L15 p21-22' : n === 4 ? (orientation === 'rows' ? 'L15 p19; R07 p31' : 'L15 p33; R07 p43') : n === 3 ? 'L15 p16-17' : 'L15 p13-14',
    },
  }
}

/** The n neighbours of a cell, each differing in one named variable (L15 p17, p20-21). */
export function neighbours(m: number, vars: string[]): { m: number; v: string }[] {
  const n = vars.length
  return vars.map((v, i) => ({ m: m ^ (1 << (n - 1 - i)), v }))
}

/** A rectangle of cells to draw one loop. A group that wraps an edge becomes two or four pieces. */
export interface LoopPiece {
  map: number
  r0: number
  r1: number
  c0: number
  c1: number
  /** Sides where the loop continues across the wrap-around edge (draw them open). */
  open: { top: boolean; bottom: boolean; left: boolean; right: boolean }
}

/** Split a set of indices on a cyclic axis into runs; returns [start, end, openStart, openEnd]. */
function runs(idx: number[], len: number): [number, number, boolean, boolean][] {
  if (idx.length === len) return [[0, len - 1, false, false]]
  const out: [number, number, boolean, boolean][] = []
  for (const i of idx) {
    const last = out[out.length - 1]
    if (last && last[1] === i - 1) last[1] = i
    else out.push([i, i, false, false])
  }
  if (out.length === 2 && out[0][0] === 0 && out[1][1] === len - 1) {
    out[0][2] = true
    out[1][3] = true
  }
  return out
}

/** Pieces to draw for a group (cube) on a layout. */
export function loopPieces(c: Cube, layout: KMapLayout): LoopPiece[] {
  const pieces: LoopPiece[] = []
  layout.grid.forEach((rowsOfMap, map) => {
    const rows = rowsOfMap.flatMap((r, i) => (r.some((m) => covers(c, m)) ? [i] : []))
    if (!rows.length) return
    const cols = rowsOfMap[rows[0]].flatMap((m, j) => (covers(c, m) ? [j] : []))
    for (const [r0, r1, top, bottom] of runs(rows, layout.rowCodes.length))
      for (const [c0, c1, left, right] of runs(cols, layout.colCodes.length)) pieces.push({ map, r0, r1, c0, c1, open: { top, bottom, left, right } })
  })
  return pieces
}
