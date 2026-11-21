import type { KeyboardEvent } from 'react'
import type { UnitId } from '../../core/datapath'
import { Flow } from '../../ui/board'
import { BUS_PATH, CONTROL_LABELS, JUNCTIONS, LABELS, MUXES, MUX_W, UNIT_GEOM, UNIT_ORDER, VIEW, WIRE_PATH, type MuxId } from './geometry'

/**
 * now: used and happening in the current step. path: on the critical path (timing view).
 * past: used, set in an earlier stage. disc: computed but thrown away. x: don't care.
 * future: not reached yet (or not needed). hidden: left out by focus mode.
 */
export type Tone = 'now' | 'path' | 'past' | 'disc' | 'x' | 'future' | 'hidden'

const RANK: Record<Tone, number> = { hidden: -1, future: 0, x: 1, disc: 2, past: 3, path: 4, now: 5 }
const best = (tones: Tone[]): Tone => tones.reduce<Tone>((a, b) => (RANK[b] > RANK[a] ? b : a), 'hidden')

export interface DiagramModel {
  wires: Record<string, { tone: Tone; control: boolean; text?: string; title: string }>
  units: Record<UnitId, { tone: Tone; badge?: string; title: string }>
  /** Input each mux passes; 'X' when its select is a don't care. */
  mux: Partial<Record<MuxId, 0 | 1 | 'X'>>
  /** Draw the BranchNE wire and the extra PCSrc gates (AY25/26 Ans p15). */
  bne: boolean
}

function activate(e: KeyboardEvent, f: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    f()
  }
}

export function Diagram({
  model,
  selected,
  onSelect,
  label,
  step,
  flow = ['now'],
}: {
  model: DiagramModel
  selected?: string | null
  onSelect?: (id: string) => void
  label: string
  /** Changes when the step (or the path shown) changes, so the light animations restart. */
  step?: number | string
  /** Which wire tones get travelling light. */
  flow?: Tone[]
}) {
  const wireIds = Object.keys(WIRE_PATH).filter((id) => model.wires[id] && model.wires[id].tone !== 'hidden' && (id !== 'c-branchne' || model.bne))
  const order = [...wireIds].sort((a, b) => RANK[model.wires[a].tone] - RANK[model.wires[b].tone])
  const flowing = step === undefined ? [] : order.filter((id) => flow.includes(model.wires[id].tone))
  const tone = (id: string): Tone => (wireIds.includes(id) ? model.wires[id].tone : 'hidden')
  const busTone = tone('inst-op')
  const pick = (id: string) => onSelect?.(id)

  return (
    <svg className="dp-svg" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="group" aria-label={label}>
      {/* Wires, least active first so active ones paint on top of shared trunks. */}
      <g className="dp-wires">
        {busTone !== 'hidden' ? <path d={BUS_PATH} className={`dp-w t-${busTone}`} /> : null}
        {order.map((id) => {
          const w = model.wires[id]
          return <path key={id} d={WIRE_PATH[id]} className={`dp-w t-${w.tone}${w.control ? ' ctl' : ''}${selected === id ? ' sel' : ''}`} />
        })}
        {JUNCTIONS.map((j, i) => {
          const t = best(j.wires.map(tone))
          return t === 'hidden' ? null : <circle key={i} cx={j.x} cy={j.y} r={3} className={`dp-dot t-${t}`} />
        })}
        {busTone !== 'hidden' ? <text x={60} y={420} className="dp-t-field" transform="rotate(-90 60 420)" textAnchor="middle">Instruction [31:0]</text> : null}
        {tone('four') !== 'hidden' ? <text x={326} y={144} className="dp-t-port" textAnchor="end">4</text> : null}
      </g>

      {/* Light along the wires that carry a value in this step: each draws in from its source, then packets keep flowing (decorative). */}
      {step !== undefined ? (
        <>
          <Flow id={step} paths={flowing.filter((id) => !model.wires[id].control).map((id) => WIRE_PATH[id])} />
          <Flow id={step} paths={flowing.filter((id) => model.wires[id].control).map((id) => WIRE_PATH[id])} tone="ctl" />
        </>
      ) : null}

      {/* Units */}
      <g className="dp-units">
        {UNIT_ORDER.map((id) => {
          const u = model.units[id]
          if (!u || u.tone === 'hidden') return null
          const g = UNIT_GEOM[id]
          const cls = `dp-u t-${u.tone}${g.control ? ' ctl' : ''}${selected === id ? ' sel' : ''}`
          if (id === 'and' && model.bne) {
            return (
              <g key={id} className={cls}>
                <rect x={812} y={204} width={44} height={62} rx={4} />
                <text x={834} y={232} className="dp-t-port" textAnchor="middle">PCSrc</text>
                <text x={834} y={244} className="dp-t-port" textAnchor="middle">logic</text>
              </g>
            )
          }
          const s = g.shape
          return (
            <g key={id} className={cls}>
              {s.kind === 'rect' ? <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={3} /> : null}
              {s.kind === 'ellipse' ? <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} /> : null}
              {s.kind === 'poly' ? <polygon points={s.points} /> : null}
              {s.kind === 'path' ? <path d={s.d} /> : null}
              {s.kind === 'mux' ? <MuxShape id={s.mux} pass={model.mux[s.mux]} /> : null}
              {g.text.lines.map((line, k) => (
                <text key={k} x={g.text.x} y={g.text.y + k * 14} className={g.text.small ? 'dp-t-port dp-t-name' : 'dp-t-unit'} textAnchor={g.text.anchor ?? 'middle'}>
                  {line}
                </text>
              ))}
              {g.ports?.map((p) => (
                <text key={p.text} x={p.x} y={p.y} className="dp-t-port" textAnchor={p.anchor ?? 'start'}>
                  {p.text}
                </text>
              ))}
            </g>
          )
        })}
      </g>

      {/* Value labels */}
      <g className="dp-labels">
        {LABELS.map((l) => {
          const ids = l.wires.filter((id) => wireIds.includes(id))
          const t = best(ids.map(tone))
          const text = ids.map((id) => model.wires[id].text).find((x) => x !== undefined)
          if (t === 'hidden') return null
          return (
            <g key={l.id}>
              {l.name ? <text x={l.name.x} y={l.y} className="dp-t-field">{l.name.text}</text> : null}
              {text !== undefined && t !== 'future' ? (
                <text x={l.x} y={l.y} className={`dp-t-val t-${t}`} textAnchor={l.anchor}>
                  {text}
                </text>
              ) : null}
            </g>
          )
        })}
        {CONTROL_LABELS.map((c) => {
          const t = tone(c.wire)
          if (t === 'hidden') return null
          const v = model.wires[c.wire].text
          return (
            <text key={c.wire} x={c.x} y={c.y} className={`dp-t-ctl t-${t}`} textAnchor={c.anchor}>
              {v !== undefined && t !== 'future' ? `${c.name} = ${v}` : c.name}
            </text>
          )
        })}
        {UNIT_ORDER.map((id) => {
          const u = model.units[id]
          if (!u?.badge || u.tone === 'hidden') return null
          const g = UNIT_GEOM[id]
          const b = g.badge ?? { x: g.box.x + g.box.w / 2, y: g.box.y - 6 }
          return (
            <text key={id} x={b.x} y={b.y} className={`dp-badge t-${u.tone}`} textAnchor={b.anchor ?? 'middle'}>
              {u.badge}
            </text>
          )
        })}
      </g>

      {/* Click and keyboard targets */}
      {onSelect ? (
        <g className="dp-hits">
          {wireIds.map((id) => (
            <path
              key={id}
              d={WIRE_PATH[id]}
              className="dp-hit-w"
              tabIndex={0}
              role="button"
              aria-label={model.wires[id].title}
              aria-pressed={selected === id}
              onClick={() => pick(id)}
              onKeyDown={(e) => activate(e, () => pick(id))}
            >
              <title>{model.wires[id].title}</title>
            </path>
          ))}
          {UNIT_ORDER.map((id) => {
            const u = model.units[id]
            if (!u || u.tone === 'hidden') return null
            const b = UNIT_GEOM[id].box
            return (
              <rect
                key={id}
                x={b.x - 3}
                y={b.y - 3}
                width={b.w + 6}
                height={b.h + 6}
                rx={4}
                className="dp-hit-u"
                tabIndex={0}
                role="button"
                aria-label={u.title}
                aria-pressed={selected === id}
                onClick={() => pick(id)}
                onKeyDown={(e) => activate(e, () => pick(id))}
              >
                <title>{u.title}</title>
              </rect>
            )
          })}
        </g>
      ) : null}
    </svg>
  )
}

/** A mux with its input numbers and a line showing which input passes. */
function MuxShape({ id, pass }: { id: MuxId; pass: 0 | 1 | 'X' | undefined }) {
  const m = MUXES[id]
  const cx = m.x + MUX_W / 2
  return (
    <>
      <rect x={m.x} y={m.y} width={MUX_W} height={m.h} rx={MUX_W / 2} />
      {([0, 1] as const).map((n) => (
        <text key={n} x={m.x + 4} y={m.inputs[n] + 3.5} className={`dp-t-mux${pass === n ? ' on' : ''}`}>
          {n}
        </text>
      ))}
      {pass === 0 || pass === 1 ? (
        <path d={`M${m.x + 11} ${m.inputs[pass]}L${m.x + MUX_W} ${m.out}`} className="dp-pass" />
      ) : pass === 'X' ? (
        <text x={cx + 4} y={m.out + 4} className="dp-t-mux x" textAnchor="middle">
          X
        </text>
      ) : null}
    </>
  )
}
