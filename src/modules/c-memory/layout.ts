/**
 * Pure geometry for the memory diagram: stack frames in the left column, globals, heap and
 * literals in the right column, every pointer arrow routed through the gutter between them.
 * The right column is mirrored (value box next to the gutter) so arrows never cross text.
 */
import type { CellView, PointerEdge, TraceFrame, VarView } from '../../core/c-memory'

export const COL_W = 400
const PAD = 10
const NAME_W = 112
const ADDR_W = 84
const GROUP_HEAD = 28
const ROW_H = 32
const BOX_H = 24
const HEAD_H = 24
const IDX_H = 13
const CELL_H = 24
const CHAN = 10
const GROUP_GAP = 14
const INDENT = 12
const MAX_LANES = 10
const VAL_CH = 7.2 // px per character, 12px mono

export type Col = 0 | 1
export type Box = { x: number; y: number; w: number; h: number }
/** h: approach horizontally from the gutter; b: approach from the channel under a strip cell. */
type Anchor = { x: number; y: number; side: 'h' | 'b'; ch: number }

export type GroupItem = { kind: 'group'; key: string; col: Col; x: number; y: number; w: number; h: number; label: string; note?: string; active: boolean; empty?: string }
export type RowItem = {
  kind: 'row'
  key: string
  col: Col
  cell: CellView
  y: number
  name: string
  type: string
  nameX: number
  addrX: number
  box: Box
  freed?: boolean
  staticIn?: string
}
export type HeadItem = { kind: 'head'; key: string; col: Col; cell: CellView; y: number; name: string; type: string; summary?: string; nameX: number; addrX: number; summaryX: number }
export type StripCell = { cell: CellView; label: string; box: Box }
export type StripItem = { kind: 'strip'; key: string; col: Col; y: number; addrHex: string; addrX: number; cells: StripCell[] }
export type Item = GroupItem | RowItem | HeadItem | StripItem
export type EdgeItem = { key: string; edge: PointerEdge; d: string; ok: boolean; stub: boolean; start: { x: number; y: number }; end: { x: number; y: number } }

export type DiagramLayout = { width: number; height: number; items: Item[]; edges: EdgeItem[]; twoCols: boolean; gutterX: number; gutterW: number }

const leafKind = (c: CellView) => c.kind === 'scalar' || c.kind === 'pointer'
/** Chars inside aggregates show as 'a', not 'a' (97). */
export const shortValue = (c: CellView) => (c.value.startsWith("'") ? c.value.replace(/ \(-?\d+\)$/, '') : c.value)

export function fit(text: string, width: number, ch = VAL_CH): string {
  const n = Math.max(1, Math.floor(width / ch))
  return text.length <= n ? text : `${text.slice(0, Math.max(1, n - 1))}…`
}

export function layoutFrame(f: TraceFrame, showAddr: boolean): DiagramLayout {
  const aw = showAddr ? ADDR_W : 0
  const boxW = COL_W - 2 * PAD - aw - NAME_W
  const right: { label: string; vars: VarView[] }[] = [
    { label: 'Globals and static locals', vars: f.globals },
    { label: 'Heap (malloc)', vars: f.heap },
    { label: 'String literals (read only)', vars: f.literals },
  ].filter((s) => s.vars.length > 0)
  const twoCols = right.length > 0
  const nEdges = Math.min(MAX_LANES, f.edges.length)
  const gutterW = Math.max(40, 16 + 6 * nEdges)
  const X = [0, COL_W + gutterW] as const
  const items: Item[] = []
  const anchors = new Map<string, Anchor>()

  /** x of a part of a column, measured from the gutter side for column 1. */
  const geo = (col: Col, indent: number) =>
    col === 0
      ? {
          addrX: X[0] + PAD + aw - 8,
          nameX: X[0] + PAD + aw + indent,
          boxX: X[0] + COL_W - PAD - boxW,
          stripX0: X[0] + PAD + aw + indent,
          stripX1: X[0] + COL_W - PAD,
          edgeX: X[0] + COL_W - PAD,
        }
      : {
          addrX: X[1] + COL_W - PAD,
          nameX: X[1] + PAD + boxW + 10 + indent,
          boxX: X[1] + PAD,
          stripX0: X[1] + PAD,
          stripX1: X[1] + COL_W - PAD - aw - indent,
          edgeX: X[1] + PAD,
        }

  const place = (cell: CellView, col: Col, depth: number, y: number, label: string, extra: { freed?: boolean; staticIn?: string }): number => {
    const indent = Math.min(depth, 3) * INDENT
    const g = geo(col, indent)
    if (leafKind(cell)) {
      const box = { x: g.boxX, y: y + (ROW_H - BOX_H) / 2, w: boxW, h: BOX_H }
      items.push({ kind: 'row', key: cell.id, col, cell, y, name: label, type: cell.type, nameX: g.nameX, addrX: g.addrX, box, ...extra })
      anchors.set(cell.id, { x: col === 0 ? box.x + box.w : box.x, y: box.y + box.h / 2, side: 'h', ch: 0 })
      return y + ROW_H
    }
    const kids = cell.children ?? []
    const isString = cell.kind === 'array' && cell.value.startsWith('"')
    items.push({
      kind: 'head',
      key: cell.id,
      col,
      cell,
      y,
      name: label,
      type: cell.type,
      ...(isString && cell.value !== label ? { summary: cell.value } : {}),
      // in the right column a header starts next to the gutter, where its arrows arrive
      nameX: col === 0 ? g.nameX : X[1] + PAD + 6 + indent,
      addrX: g.addrX,
      summaryX: col === 0 ? g.boxX + boxW : X[1] + COL_W - PAD - aw - 8,
    })
    anchors.set(cell.id, { x: g.edgeX, y: y + HEAD_H / 2, side: 'h', ch: 0 })
    y += HEAD_H
    if (cell.kind === 'array' && kids.length > 0 && kids.every(leafKind)) {
      // a strip of cells, like the slides draw arrays (L05A p8)
      const sg = geo(col, indent + INDENT)
      const longest = Math.max(...kids.map((k) => shortValue(k).length))
      const cw = Math.min(150, Math.max(30, 12 + VAL_CH * longest, 8 + 6 * `[${kids.length - 1}]`.length))
      const per = Math.max(1, Math.floor((sg.stripX1 - sg.stripX0 + 2) / (cw + 2)))
      for (let s = 0; s < kids.length; s += per) {
        const line = kids.slice(s, s + per)
        const cy = y + IDX_H
        const cells = line.map((k, j) => ({ cell: k, label: `[${s + j}]`, box: { x: sg.stripX0 + j * (cw + 2), y: cy, w: cw, h: CELL_H } }))
        items.push({ kind: 'strip', key: `${cell.id}@${s}`, col, y, addrHex: line[0].addressHex, addrX: g.addrX, cells })
        for (const c of cells) anchors.set(c.cell.id, { x: c.box.x + c.box.w / 2, y: c.box.y + c.box.h, side: 'b', ch: c.box.y + c.box.h + CHAN / 2 })
        y += IDX_H + CELL_H + CHAN
      }
      return y
    }
    for (const k of kids) y = place(k, col, depth + 1, y, k.name.startsWith(cell.name) ? k.name.slice(cell.name.length) : k.name, {})
    return y
  }

  const group = (col: Col, y: number, key: string, label: string, vars: VarView[], active: boolean, note?: string): number => {
    const start = y
    const idx = items.length
    y += GROUP_HEAD
    if (vars.length === 0) y += 22
    for (const v of vars)
      y = place(v, col, 0, y, v.name, { ...(v.freed ? { freed: true } : {}), ...(v.staticIn ? { staticIn: v.staticIn } : {}) })
    y += 8
    items.splice(idx, 0, { kind: 'group', key, col, x: X[col], y: start, w: COL_W, h: y - start, label, ...(note ? { note } : {}), active, ...(vars.length === 0 ? { empty: 'no locals' } : {}) })
    return y + GROUP_GAP
  }

  let y0 = 0
  if (f.stack.length === 0) y0 = group(0, y0, 'nostack', 'No function is running', [], false)
  for (const fr of f.stack) {
    const note = fr.returning ? 'returning, frame about to go' : fr.callLine ? `called at line ${fr.callLine}` : undefined
    y0 = group(0, y0, `f${fr.id}`, fr.label, fr.vars, fr.active, note)
  }
  let y1 = 0
  for (const s of right) y1 = group(1, y1, s.label, s.label, s.vars, false)

  const gutterX = COL_W
  const find = (id: string | null): Anchor | undefined => {
    let k = id
    while (k) {
      const a = anchors.get(k)
      if (a) return a
      const m = /(\[\d+\]|\.\w+)$/.exec(k)
      if (!m) return undefined
      k = k.slice(0, -m[0].length)
    }
    return undefined
  }

  type Pending = { e: PointerEdge; s: Anchor; t?: Anchor }
  const pending: Pending[] = []
  for (const e of f.edges) {
    const s = anchors.get(e.from)
    if (!s) continue
    pending.push({ e, s, t: e.toId ? find(e.toId) : undefined })
  }
  // short spans take the lanes nearest the boxes, so arrows nest instead of crossing
  pending.sort((a, b) => Math.abs(a.s.y - (a.t?.y ?? a.s.y)) - Math.abs(b.s.y - (b.t?.y ?? b.s.y)))
  const edges: EdgeItem[] = pending.map(({ e, s, t }, i) => {
    const lane = i % MAX_LANES
    const gx = gutterX + 8 + lane * 6
    const off = ((lane % 3) - 1) * 3
    let d = `M${s.x},${s.y}`
    d += s.side === 'b' ? ` V${s.ch + off} H${gx}` : ` H${gx}`
    if (!t) {
      const ey = (s.side === 'b' ? s.ch + off : s.y) + 14
      return { key: `${e.from}-${i}`, edge: e, d: `${d} V${ey}`, ok: false, stub: true, start: { x: s.x, y: s.y }, end: { x: gx, y: ey } }
    }
    d += t.side === 'b' ? ` V${t.ch + off} H${t.x} V${t.y}` : ` V${t.y} H${t.x}`
    return { key: `${e.from}-${i}`, edge: e, d, ok: e.status === 'ok', stub: false, start: { x: s.x, y: s.y }, end: { x: t.x, y: t.y } }
  })

  const height = Math.max(y0, y1, 60)
  return { width: twoCols ? X[1] + COL_W : COL_W + gutterW, height, items, edges, twoCols, gutterX, gutterW }
}

/** A cell counts as touched when it or anything inside it changed this step. */
export const touched = (c: CellView): boolean => c.changed || (c.children ?? []).some(touched)

/** Every leaf cell of a variable (scalars and pointers), in address order. */
export function leaves(c: CellView): CellView[] {
  return leafKind(c) ? [c] : (c.children ?? []).flatMap(leaves)
}

/** Find a cell by id anywhere in a frame, with the top-level variable that holds it. */
export function findCell(f: TraceFrame, id: string): { cell: CellView; top: VarView; where: string } | undefined {
  const tops: { v: VarView; where: string }[] = [
    ...f.stack.flatMap((s) => s.vars.map((v) => ({ v, where: s.label.replace(/:$/, '') }))),
    ...f.globals.map((v) => ({ v, where: v.staticIn ? `static in ${v.staticIn}()` : 'global' })),
    ...f.heap.map((v) => ({ v, where: 'heap' })),
    ...f.literals.map((v) => ({ v, where: 'string literal' })),
  ]
  const walk = (c: CellView): CellView | undefined => (c.id === id ? c : c.children?.map(walk).find(Boolean))
  for (const { v, where } of tops) {
    const hit = walk(v)
    if (hit) return { cell: hit, top: v, where }
  }
  return undefined
}
