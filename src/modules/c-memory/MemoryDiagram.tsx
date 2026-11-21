import { useId, useMemo, type KeyboardEvent } from 'react'
import type { CellView, TraceFrame } from '../../core/c-memory'
import { Flow } from '../../ui/board'
import { fit, layoutFrame, shortValue, touched, type Box, type Item } from './layout'

/** Same cell, or one holds the other (an element of an array, a member of a struct). */
const related = (a: string, b: string) => a === b || b.startsWith(`${a}[`) || b.startsWith(`${a}.`) || a.startsWith(`${b}[`) || a.startsWith(`${b}.`)
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The line follows this pointer: *p, *(p + 1), p->m or p[i]. */
const derefs = (line: string, name: string) => new RegExp(`\\*\\s*\\(?\\s*${esc(name)}\\b|\\b${esc(name)}\\s*(->|\\[)`).test(line)

/**
 * Boxes and arrows for one trace frame. Click or press Enter on a box to inspect it.
 * `focus` hides every box this step did not change (positions stay put) and keeps only the arrows that touch a changed box.
 */
export function MemoryDiagram({
  frame,
  showAddr,
  selected,
  onSelect,
  focus = false,
  line = '',
}: {
  frame: TraceFrame
  /** Source text of the step's line, to tell which arrow a write went through. */
  line?: string
  showAddr: boolean
  selected: string | null
  onSelect: (id: string) => void
  focus?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const L = useMemo(() => layoutFrame(frame, showAddr), [frame, showAddr])
  const aliasCount = useMemo(() => new Map(frame.aliases.map((a) => [a.toId, a.from.length])), [frame])
  const bad = useMemo(() => new Set(frame.edges.filter((e) => e.status !== 'ok').map((e) => e.from)), [frame])
  const changed = useMemo(
    () => L.items.flatMap((it) => (it.kind === 'row' ? [it.cell] : it.kind === 'strip' ? it.cells.map((c) => c.cell) : [])).filter((c) => c.changed).map((c) => c.id),
    [L],
  )
  const edges = useMemo(() => {
    if (!focus) return L.edges
    return L.edges.filter((e) => changed.some((id) => related(id, e.edge.from) || (e.edge.toId !== null && related(id, e.edge.toId))))
  }, [L, focus, changed])
  // Light runs along an arrow this step set, or one the step wrote through (*p = ...).
  const lit = useMemo(
    () =>
      edges.filter(
        (e) => e.ok && (changed.some((id) => related(id, e.edge.from)) || (e.edge.toId !== null && changed.some((id) => related(id, e.edge.toId!)) && derefs(line, e.edge.fromName))),
      ),
    [edges, changed, line],
  )

  const cellProps = (c: CellView, label: string) => ({
    className: `cm-cell${selected === c.id ? ' cm-sel' : ''}`,
    tabIndex: 0,
    role: 'button',
    'aria-pressed': selected === c.id,
    'aria-label': `${label}, ${c.type}${showAddr ? `, at ${c.addressHex}` : ''}, value ${c.value}${c.changed ? ', changed this step' : ''}`,
    onClick: () => onSelect(c.id),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(c.id)
      }
    },
  })

  const valueBox = (c: CellView, box: Box, text: string, opts: { freed?: boolean; align: 'middle' | 'start' }) => {
    const cls = [
      'cm-box',
      c.kind === 'pointer' ? 'cm-ptr' : '',
      !c.initialised ? 'cm-garbage' : '',
      c.changed ? 'cm-changed' : '',
      opts.freed ? 'cm-freed' : '',
    ].join(' ')
    const tx = opts.align === 'middle' ? box.x + box.w / 2 : box.x + 8
    return (
      <>
        <rect className={cls} x={box.x} y={box.y} width={box.w} height={box.h} rx={2} />
        {c.changed ? <rect key={`${c.id}:${frame.index}`} className="cm-flash" x={box.x} y={box.y} width={box.w} height={box.h} rx={2} /> : null}
        <text className={`cm-val${!c.initialised ? ' cm-val-garbage' : ''}${bad.has(c.id) ? ' cm-val-bad' : ''}`} x={tx} y={box.y + box.h / 2 + 4} textAnchor={opts.align}>
          {text}
        </text>
      </>
    )
  }

  const drawItem = (it: Item) => {
    switch (it.kind) {
      case 'group':
        return (
          <g key={`g-${it.key}`} className={`cm-group${it.active ? ' cm-active' : ''}`}>
            <rect className="cm-frame" x={it.x + 0.5} y={it.y + 0.5} width={it.w - 1} height={it.h - 1} rx={3} />
            <rect className="cm-frame-head" x={it.x + 1} y={it.y + 1} width={it.w - 2} height={22} />
            {it.active ? <rect className="cm-frame-bar" x={it.x} y={it.y} width={3} height={it.h} /> : null}
            <text className="cm-frame-label" x={it.x + 10} y={it.y + 16}>
              {it.label}
            </text>
            {it.note ? (
              <text className="cm-frame-note" x={it.x + it.w - 10} y={it.y + 16} textAnchor="end">
                {it.active ? `running, ${it.note}` : it.note}
              </text>
            ) : it.active ? (
              <text className="cm-frame-note" x={it.x + it.w - 10} y={it.y + 16} textAnchor="end">
                running
              </text>
            ) : null}
            {it.empty ? (
              <text className="cm-type" x={it.x + 10} y={it.y + 42}>
                {it.empty}
              </text>
            ) : null}
          </g>
        )
      case 'row': {
        const c = it.cell
        if (focus && !c.changed) return null
        const n = aliasCount.get(c.id)
        const label = it.staticIn ? `${it.name} (static in ${it.staticIn})` : it.name
        const prev = c.prev !== undefined && c.kind !== 'pointer' ? c.prev : undefined
        const valueText = fit(c.value + (bad.has(c.id) ? ' (bad)' : '') + (it.freed ? ' (freed)' : ''), it.box.w - (prev ? 60 : 12) - (n ? 70 : 0))
        const nameW = it.col === 0 ? it.box.x - it.nameX - 6 : it.addrX - it.nameX - (showAddr ? 76 : 0)
        return (
          <g key={`r-${it.key}`} {...cellProps(c, label)}>
            <title>{`${c.name}: ${c.value}`}</title>
            {showAddr ? (
              <text className="cm-addr" x={it.addrX} y={it.y + 20} textAnchor="end">
                {c.addressHex}
              </text>
            ) : null}
            <text className="cm-name" x={it.nameX} y={it.y + 14}>
              {fit(label, nameW, 7.2)}
            </text>
            <text className="cm-type" x={it.nameX} y={it.y + 27}>
              {fit(it.type, nameW, 6)}
            </text>
            {valueBox(c, it.box, valueText, { freed: it.freed, align: prev ? 'start' : 'middle' })}
            {prev ? (
              <text className="cm-prev" x={it.box.x + it.box.w - (n ? 76 : 8)} y={it.box.y + it.box.h / 2 + 4} textAnchor="end">
                was <tspan className="cm-prev-val">{fit(prev, 40)}</tspan>
              </text>
            ) : null}
            {n ? (
              <text className="cm-alias" x={it.box.x + it.box.w - 6} y={it.box.y + it.box.h / 2 + 4} textAnchor="end">
                {n} pointers
              </text>
            ) : null}
          </g>
        )
      }
      case 'head': {
        const c = it.cell
        if (focus && !touched(c)) return null
        return (
          <g key={`h-${it.key}`} {...cellProps(c, it.name)}>
            <title>{`${c.name}: ${c.value}`}</title>
            {showAddr ? (
              <text className="cm-addr" x={it.addrX} y={it.y + 16} textAnchor="end">
                {c.addressHex}
              </text>
            ) : null}
            <text className={`cm-name${c.changed ? ' cm-name-changed' : ''}`} x={it.nameX} y={it.y + 16}>
              {it.name}
              <tspan className="cm-type" dx={8}>
                {it.type}
              </tspan>
            </text>
            {it.summary ? (
              <text className="cm-summary" x={it.summaryX} y={it.y + 16} textAnchor="end">
                {fit(it.summary, 150)}
              </text>
            ) : null}
          </g>
        )
      }
      case 'strip': {
        const cells = focus ? it.cells.filter((c) => c.cell.changed) : it.cells
        if (cells.length === 0) return null
        return (
          <g key={`s-${it.key}`}>
            {showAddr ? (
              <text className="cm-addr" x={it.addrX} y={it.y + 13 + 16} textAnchor="end">
                {it.addrHex}
              </text>
            ) : null}
            {cells.map(({ cell, label, box }) => (
              <g key={cell.id} {...cellProps(cell, cell.name)}>
                <title>{`${cell.name} at ${cell.addressHex}: ${cell.value}`}</title>
                <text className="cm-idx" x={box.x + box.w / 2} y={box.y - 3} textAnchor="middle">
                  {label}
                </text>
                {valueBox(cell, box, fit(shortValue(cell), box.w - 6), { align: 'middle' })}
              </g>
            ))}
          </g>
        )
      }
    }
  }

  return (
    <div className="cm-diagram">
      <svg
        className="cm-svg"
        viewBox={`-2 -2 ${L.width + 4} ${L.height + 4}`}
        width={L.width + 4}
        height={L.height + 4}
        role="group"
        aria-label={`Memory at step ${frame.index + 1}: ${frame.stack.length} stack frame${frame.stack.length === 1 ? '' : 's'}, ${frame.edges.length} pointer${frame.edges.length === 1 ? '' : 's'}`}
      >
        <defs>
          <marker id={`${uid}-ok`} viewBox="0 0 8 8" refX={7.5} refY={4} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className="cm-head-ok" />
          </marker>
          <marker id={`${uid}-bad`} viewBox="0 0 8 8" refX={7.5} refY={4} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className="cm-head-bad" />
          </marker>
        </defs>
        {L.items.map(drawItem)}
        <g className="cm-edges" aria-hidden="true">
          {edges.map((e) => {
            const hot = selected !== null && (e.edge.from === selected || e.edge.toId === selected)
            return (
              <g key={e.key}>
                <path className={`cm-edge${e.ok ? '' : ' cm-edge-bad'}${hot ? ' cm-edge-hot' : ''}`} d={e.d} markerEnd={e.stub ? undefined : `url(#${uid}-${e.ok ? 'ok' : 'bad'})`} />
                <circle className={e.ok ? 'cm-dot' : 'cm-dot cm-dot-bad'} cx={e.start.x} cy={e.start.y} r={2.6} />
                {e.stub ? (
                  <path className="cm-cross" d={`M${e.end.x - 4},${e.end.y - 4} l8,8 m0,-8 l-8,8`} />
                ) : null}
              </g>
            )
          })}
        </g>
        <Flow id={frame.index} paths={lit.map((e) => e.d)} />
      </svg>
    </div>
  )
}
