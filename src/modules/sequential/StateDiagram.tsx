import { useId } from 'react'
import type { StateGraph } from '../../core/sequential'

export interface EdgeRef {
  from: number
  to: number
}

const R_NODE = 24
const PAD = 70

/** Positions on a circle, state 0 at the top and the rest clockwise (the course draws small machines this way). */
export function circleLayout(n: number, order: number[] = Array.from({ length: n }, (_, i) => i)) {
  const ring = Math.max(84, (n * (2 * R_NODE + 44)) / (2 * Math.PI))
  const size = 2 * (ring + R_NODE + PAD)
  const c = size / 2
  const pos = Array.from({ length: n }, (_, id) => {
    if (n === 1) return { x: c, y: c }
    const a = (2 * Math.PI * order.indexOf(id)) / n - Math.PI / 2
    return { x: c + ring * Math.cos(a), y: c + ring * Math.sin(a) }
  })
  return { size, c, pos }
}

/**
 * Ring order. Up to 8 states keep numeric order, as the course draws them. Larger machines (a 4-bit counter) follow
 * their arrows instead, so each cycle runs around the ring rather than across it.
 */
function ringOrder(graph: StateGraph): number[] {
  const ids = graph.nodes.map((nd) => nd.id)
  if (ids.length <= 8) return ids
  const seen = new Set<number>()
  const order: number[] = []
  for (const start of ids) {
    let s: number | undefined = start
    while (s !== undefined && !seen.has(s)) {
      seen.add(s)
      order.push(s)
      const from: number = s
      s = graph.edges.filter((e) => e.from === from && e.to !== from).map((e) => e.to).find((t) => !seen.has(t))
    }
  }
  return order
}

const rot = (x: number, y: number, a: number) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) })

/**
 * State diagram: one circle per state, arrows labelled input/output (L19 p33). Unused states are dashed and
 * hatched; `current` is the state the circuit is in now. With `focus`, arrows that the current step does not use
 * are hidden; without it they are drawn quietly. Nodes never move, so the picture stays recognisable.
 */
export function StateDiagram({
  graph,
  current,
  next,
  active,
  path = [],
  focus,
  label,
  step,
}: {
  graph: StateGraph
  current?: number | null
  next?: number | null
  active?: EdgeRef | null
  path?: EdgeRef[]
  focus?: boolean
  label: string
  /** Changes with the step, so the light on the active arrows restarts. Leave it out for a still picture. */
  step?: number | string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const n = graph.nodes.length
  const { size, c, pos } = circleLayout(n, ringOrder(graph))
  const hasStep = !!active || path.length > 0
  const isOn = (e: EdgeRef, list: EdgeRef[]) => list.some((p) => p.from === e.from && p.to === e.to)
  // One drawn arrow per (from, to); several input/output labels join with commas.
  const merged = new Map<string, { from: number; to: number; labels: string[]; fromUnused: boolean }>()
  for (const e of graph.edges) {
    const k = `${e.from}>${e.to}`
    const m = merged.get(k) ?? { from: e.from, to: e.to, labels: [], fromUnused: e.fromUnused }
    if (e.label) m.labels.push(e.label)
    merged.set(k, m)
  }
  const edges = [...merged.values()]
  const pairs = new Set(edges.map((e) => `${e.from}>${e.to}`))

  const drawn = edges.map((e) => {
    const isActive = !!active && active.from === e.from && active.to === e.to
    const onPath = isOn(e, path)
    const cls = ['sd-edge', isActive || onPath ? 'is-active' : hasStep ? 'is-quiet' : '', e.fromUnused ? 'is-from-unused' : ''].filter(Boolean).join(' ')
    const hidden = focus && hasStep && !isActive && !onPath
    const text = e.labels.join(', ')
    const marker = `url(#${uid}-${isActive || onPath ? 'a' : 'n'})`
    if (e.from === e.to) {
      const p = pos[e.from]
      let ux = p.x - c
      let uy = p.y - c
      const len = Math.hypot(ux, uy)
      if (len < 1) {
        ux = 0
        uy = -1
      } else {
        ux /= len
        uy /= len
      }
      const s = rot(ux, uy, -0.5)
      const t = rot(ux, uy, 0.5)
      const c1 = rot(ux, uy, -0.75)
      const c2 = rot(ux, uy, 0.75)
      const far = R_NODE + 40
      const d = `M${p.x + s.x * R_NODE} ${p.y + s.y * R_NODE} C${p.x + c1.x * far} ${p.y + c1.y * far} ${p.x + c2.x * far} ${p.y + c2.y * far} ${p.x + t.x * (R_NODE + 2)} ${p.y + t.y * (R_NODE + 2)}`
      return { key: `${e.from}>${e.to}`, cls, hidden, lit: isActive || onPath, d, marker, text, lx: p.x + ux * (R_NODE + 40), ly: p.y + uy * (R_NODE + 40) + 4, at: undefined as ((u: number) => { x: number; y: number }) | undefined }
    }
    const a = pos[e.from]
    const b = pos[e.to]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    // Bend when the reverse arrow exists, or when the straight line would cross another circle.
    const crosses = pos.some((q, i) => {
      if (i === e.from || i === e.to) return false
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (len * len)))
      return Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y) < R_NODE + 6
    })
    const bend = pairs.has(`${e.to}>${e.from}`) ? 20 : crosses ? 34 : 0
    const mx = (a.x + b.x) / 2 + nx * bend * 2
    const my = (a.y + b.y) / 2 + ny * bend * 2
    const toward = (p: { x: number; y: number }, r: number) => {
      const vx = mx - p.x
      const vy = my - p.y
      const l = Math.hypot(vx, vy) || 1
      return { x: p.x + (vx / l) * r, y: p.y + (vy / l) * r }
    }
    const s = toward(a, R_NODE)
    const t = toward(b, R_NODE + 2)
    const at = (u: number) => ({
      x: (1 - u) * (1 - u) * s.x + 2 * u * (1 - u) * mx + u * u * t.x + nx * 11,
      y: (1 - u) * (1 - u) * s.y + 2 * u * (1 - u) * my + u * u * t.y + ny * 11 + 4,
    })
    return { key: `${e.from}>${e.to}`, cls, hidden, lit: isActive || onPath, d: `M${s.x} ${s.y} Q${mx} ${my} ${t.x} ${t.y}`, marker, text, lx: at(0.5).x, ly: at(0.5).y, at }
  })
  // Slide each label along its arrow until it clears the circles and the labels already placed.
  const boxes: { x: number; y: number; w: number }[] = []
  const clear = (x: number, y: number, w: number) =>
    !boxes.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 2 && Math.abs(b.y - y) < 13) && !pos.some((q) => Math.abs(q.x - x) < R_NODE + w / 2 && Math.abs(q.y - (y - 4)) < R_NODE + 5)
  for (const e of drawn) {
    if (!e.text || e.hidden) continue
    const w = e.text.length * 6.4 + 4
    if (e.at) {
      const spot = [0.5, 0.36, 0.64, 0.25, 0.75].map((u) => e.at!(u)).find((q) => clear(q.x, q.y, w))
      if (spot) {
        e.lx = spot.x
        e.ly = spot.y
      }
    }
    boxes.push({ x: e.lx, y: e.ly, w })
  }

  return (
    <svg className="sd" viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ width: '100%', minWidth: size, maxWidth: size * 1.35, height: 'auto' }} role="img" aria-label={label}>
      <title>{label}</title>
      <defs>
        <pattern id={`${uid}-h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="sd-hatch" />
        </pattern>
        <marker id={`${uid}-n`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 z" className="sd-head" />
        </marker>
        <marker id={`${uid}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0 0 L10 5 L0 10 z" className="sd-head is-active" />
        </marker>
      </defs>
      {drawn.map((e) =>
        e.hidden ? null : (
          <g key={e.key} className={e.cls}>
            <path d={e.d} markerEnd={e.marker} />
            {e.text ? (
              <text x={e.lx} y={e.ly} textAnchor="middle" className="sd-label">
                {e.text}
              </text>
            ) : null}
          </g>
        ),
      )}
      {/* Light along the arrows this step takes: each draws in from its source state, then packets follow it. */}
      {step !== undefined && drawn.some((e) => e.lit && !e.hidden) ? (
        <>
          <g className="flow-draw" key={`d${step}`} aria-hidden="true">
            {drawn.filter((e) => e.lit && !e.hidden).map((e) => (
              <path key={e.key} d={e.d} pathLength={1} />
            ))}
          </g>
          <g className="flow-packets" key={`p${step}`} aria-hidden="true">
            {drawn.filter((e) => e.lit && !e.hidden).map((e, i) => (
              <path key={e.key} d={e.d} pathLength={1} style={{ animationDelay: `${0.7 + (i % 5) * 0.18}s` }} />
            ))}
          </g>
        </>
      ) : null}
      {graph.nodes.map((node) => {
        const p = pos[node.id]
        const now = current === node.id
        const isNext = next === node.id && !now
        const cls = ['sd-node', node.used ? '' : 'is-unused', now ? 'is-now' : '', isNext ? 'is-next' : ''].filter(Boolean).join(' ')
        // Badges sit below the circle, or above it when a self-loop hangs below.
        const below = !(node.selfLoop && p.y - c > Math.abs(p.x - c) * 0.6)
        const by = below ? p.y + R_NODE + 13 : p.y - R_NODE - 6
        const badges = [now ? 'now' : '', node.used ? '' : 'unused', node.sink ? 'sink' : '', node.unreachable && node.used ? 'unreachable' : ''].filter(Boolean)
        return (
          <g key={node.id} className={cls}>
            <circle cx={p.x} cy={p.y} r={R_NODE} className="sd-disc" />
            {!node.used ? <circle cx={p.x} cy={p.y} r={R_NODE} fill={`url(#${uid}-h)`} className="sd-hatchfill" /> : null}
            <text x={p.x} y={p.y + (node.binary || node.output ? -2 : 5)} textAnchor="middle" className="sd-name">
              {node.label}
              {node.output !== undefined ? `/${node.output}` : ''}
            </text>
            {node.binary ? (
              <text x={p.x} y={p.y + 13} textAnchor="middle" className="sd-bin">
                {node.binary}
              </text>
            ) : null}
            {badges.length ? (
              <text x={p.x} y={by} textAnchor="middle" className={`sd-badge${now ? ' is-now' : ''}`}>
                {badges.join(', ')}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
