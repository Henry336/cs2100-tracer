import { useId, type KeyboardEvent } from 'react'
import type { Bit, Sig, TimingTrace } from '../../core/sequential'
import { Flow } from '../../ui/board'

const TW = 32
const RH = 32
const LEFT = 54
const TOP = 22
const HI = 7
const LO = 25

export interface WaveRow {
  name: string
  kind: 'clock' | 'data' | 'async'
  values: Bit[]
}

/** Step path of a 0/1 waveform. */
function wavePath(values: Bit[], y0: number) {
  let d = ''
  values.forEach((v, t) => {
    const x0 = LEFT + t * TW
    const y = y0 + (v ? HI : LO)
    d += t === 0 ? `M${x0} ${y}` : ` V${y}`
    d += ` H${x0 + TW}`
  })
  return d
}

/**
 * Timing diagram (L19 p7-8, p14-25): clock, inputs, optional PRE and CLR, then Q and Q'. Q is drawn up to the
 * current tick only, so the trace builds up as you step. Click an input cell (or focus it and press Enter) to flip it.
 */
export function TimingDiagram({
  rows,
  trace,
  upto,
  onToggle,
  label,
}: {
  rows: WaveRow[]
  trace: TimingTrace
  upto: number
  onToggle: (name: string, t: number) => void
  label: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ticks = trace.ticks
  const width = LEFT + ticks * TW + 12
  const qTop = TOP + rows.length * RH + 6
  const height = qTop + 2 * RH + 8
  const frame = trace.frames[upto]
  const sampled = frame?.event === 'edge' ? frame.sampled : undefined
  const q = trace.q.slice(0, upto + 1)
  const qBar: Sig[] = q.map((v) => (v === 'X' ? 'X' : ((1 - v) as Bit)))
  const flow = (() => {
    const v = trace.q[upto]
    if (!frame || v === 'X' || v === undefined) return null
    const x0 = LEFT + upto * TW
    const y = qTop + (v ? HI : LO)
    const src = frame.event === 'preset' ? 'PRE' : frame.event === 'clear' ? 'CLR' : (frame.event === 'edge' || frame.event === 'transparent') && frame.sampled !== undefined ? rows.find((r) => r.kind === 'data')?.name : undefined
    const i = src ? rows.findIndex((r) => r.name === src) : -1
    return `${i >= 0 ? `M${x0} ${TOP + i * RH + RH / 2} V${y}` : `M${x0} ${y}`} H${x0 + TW}`
  })()
  const key = (name: string, t: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(name, t)
    }
  }
  const sigWave = (vals: Sig[], y0: number, name: string) => (
    <g className="tm-q">
      {vals.map((v, t) => {
        const x0 = LEFT + t * TW
        if (v === 'X') return <rect key={t} x={x0} y={y0 + HI} width={TW} height={LO - HI} className="tm-xband" fill={`url(#${uid}-x)`} />
        return null
      })}
      <path
        d={vals
          .map((v, t) => {
            const x0 = LEFT + t * TW
            if (v === 'X') return `M${x0 + TW} ${y0 + (LO + HI) / 2}`
            const y = y0 + (v ? HI : LO)
            const prev = vals[t - 1]
            return `${t === 0 || prev === 'X' ? `M${x0} ${y}` : `V${y}`} H${x0 + TW}`
          })
          .join(' ')}
        className="tm-wave tm-wave-q"
      />
      <text x={8} y={y0 + RH / 2 + 4} className="tm-name">
        {name}
      </text>
    </g>
  )
  return (
    <svg className="tm" viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ width: '100%', minWidth: width, maxWidth: width * 1.6, height: 'auto' }} role="group" aria-label={label}>
      <title>{label}</title>
      <defs>
        <pattern id={`${uid}-x`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="tm-hatch" />
        </pattern>
        <pattern id={`${uid}-o`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="7" className="tm-ohatch" />
        </pattern>
      </defs>
      {/* Tick axis */}
      {Array.from({ length: ticks }, (_, t) => (
        <text key={t} x={LEFT + t * TW + TW / 2} y={14} textAnchor="middle" className={`tm-tick${t === upto ? ' is-now' : ''}`}>
          {t}
        </text>
      ))}
      <rect x={LEFT + upto * TW} y={TOP - 4} width={TW} height={height - TOP} className="tm-now" />
      {/* Latch transparent windows and PRE/CLR overrides, behind Q. */}
      {trace.transparent.map((t) => (
        <rect key={`tr${t}`} x={LEFT + t * TW} y={qTop} width={TW} height={2 * RH} className="tm-transparent" />
      ))}
      {trace.overrides.map((t) => (
        <rect key={`ov${t}`} x={LEFT + t * TW} y={qTop} width={TW} height={2 * RH} fill={`url(#${uid}-o)`} className="tm-override" />
      ))}
      {Array.from({ length: ticks + 1 }, (_, t) => (
        <line key={`g${t}`} x1={LEFT + t * TW} y1={TOP} x2={LEFT + t * TW} y2={height - 4} className="tm-grid" />
      ))}
      {rows.map((r, i) => {
        const y0 = TOP + i * RH
        return (
          <g key={r.name} className={`tm-row tm-${r.kind}`}>
            <text x={8} y={y0 + RH / 2 + 4} className="tm-name">
              {r.name}
            </text>
            <path d={wavePath(r.values, y0)} className="tm-wave" />
            {sampled !== undefined && r.kind === 'data' ? <rect x={LEFT + sampled * TW + 2} y={y0 + 3} width={TW - 4} height={RH - 6} rx={3} className="tm-sample" /> : null}
            {r.values.map((v, t) => (
              <rect
                key={t}
                x={LEFT + t * TW}
                y={y0}
                width={TW}
                height={RH}
                className="tm-hit"
                role="button"
                tabIndex={0}
                aria-label={`${r.name} at tick ${t} is ${v}; press to flip`}
                onClick={() => onToggle(r.name, t)}
                onKeyDown={key(r.name, t)}
              />
            ))}
          </g>
        )
      })}
      {sigWave(q, qTop, 'Q')}
      {sigWave(qBar, qTop + RH, "Q'")}
      {/* Light for this tick: from the input the edge reads (or PRE, CLR) down the edge line into Q, then along Q. */}
      {flow ? <Flow id={upto} paths={[flow]} /> : null}
      {/* Triggering edges up to now. */}
      {trace.edges
        .filter((t) => t <= upto)
        .map((t) => (
          <g key={`e${t}`} className={`tm-edge${t === upto ? ' is-now' : ''}`}>
            <line x1={LEFT + t * TW} y1={TOP} x2={LEFT + t * TW} y2={height - 4} />
            {trace.spec.edge === 'neg' ? (
              <path d={`M${LEFT + t * TW - 4} ${TOP - 4} L${LEFT + t * TW} ${TOP + 2} L${LEFT + t * TW + 4} ${TOP - 4} z`} />
            ) : (
              <path d={`M${LEFT + t * TW - 4} ${TOP + 2} L${LEFT + t * TW} ${TOP - 4} L${LEFT + t * TW + 4} ${TOP + 2} z`} />
            )}
          </g>
        ))}
    </svg>
  )
}
