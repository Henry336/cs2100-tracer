// The pipeline diagram: rows are dynamic instructions, columns are cycles (L21 p6 notation).
import { useEffect, useId, useMemo, useRef } from 'react'
import { STAGES, type Forward, type InstrResult, type PipelineTrace, type Row, type Stage, type StallKind } from '../../core/pipeline'

export type StageNames = 'long' | 'short' | 'units'
const SHORT: Record<Stage, string> = { IF: 'F', ID: 'D', EX: 'E', MEM: 'M', WB: 'W' }
/** The unit each stage uses, as the L21 hazard slides draw it. */
const UNITS: Record<Stage, string> = { IF: 'IM', ID: 'Reg', EX: 'ALU', MEM: 'DM', WB: 'Reg' }

/** Short label in a stall cell and the full cause, so the cause is not carried by colour alone. */
const CAUSE: Record<StallKind, [string, string]> = {
  raw: ['RAW', 'RAW data hazard'],
  'load-use': ['lw', 'load-use: the lw value exists only after MEM'],
  'branch-operand': ['br', 'branch operand not ready for the early branch'],
  'store-data': ['sw', 'store data not ready'],
  branch: ['ctl', 'branch not decided yet'],
  jump: ['j', 'jump target not known yet'],
}

/** The cause that holds back `held` for this instruction, if the engine names one. */
function causeOf(ins: InstrResult | undefined, held: Stage | undefined): StallKind | undefined {
  if (!ins || !held) return undefined
  return (ins.stalls.find((s) => s.binding && s.stage === held) ?? ins.stalls.find((s) => s.stage === held))?.kind
}

type Cell =
  | { kind: 'stage'; stage: Stage }
  | { kind: 'stall'; after: Stage }
  | { kind: 'empty' }

/** Per row, what each cycle holds: a stage, a stall (waiting between two stages) or nothing. */
function rowCells(r: Row, total: number): Cell[] {
  const cells: Cell[] = Array.from({ length: total + 1 }, () => ({ kind: 'empty' }))
  let prev: Stage | undefined
  for (const s of STAGES) {
    const c = r.stages[s]
    if (c === undefined) continue
    if (prev !== undefined) {
      const from = r.stages[prev]!
      for (let k = from + 1; k < c && k <= total; k++) cells[k] = { kind: 'stall', after: prev }
    }
    if (c <= total) cells[c] = { kind: 'stage', stage: s }
    prev = s
  }
  return cells
}

export function PipelineGrid({
  trace,
  cycle,
  onPick,
  names = 'long',
  compact = false,
  label = 'Pipeline diagram',
}: {
  trace: PipelineTrace
  /** Current cycle (1-based); 0 hides the cursor. */
  cycle?: number
  onPick?: (cycle: number) => void
  names?: StageNames
  compact?: boolean
  label?: string
}) {
  const cw = compact ? 22 : 40
  const rh = compact ? 18 : 26
  const total = trace.totals.cycles
  const rows = trace.rows
  const scroll = useRef<HTMLDivElement>(null)
  const uidRow = useMemo(() => new Map(rows.map((r, i) => [r.uid, i])), [rows])
  const cells = useMemo(() => rows.map((r) => rowCells(r, total)), [rows, total])
  const slots = useMemo(() => new Set(trace.instructions.filter((i) => i.slot).map((i) => i.uid)), [trace.instructions])
  const byUid = useMemo(() => new Map(trace.instructions.map((i) => [i.uid, i])), [trace.instructions])
  const markId = `pl-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  // Every forward drawn once (the engine lists a both-inputs forward twice).
  const forwards = useMemo(() => {
    const seen = new Set<string>()
    const out: Forward[] = []
    for (const f of trace.frames) for (const x of f.forwards) {
      const key = `${x.producer}-${x.consumer}-${x.register}-${x.from}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(x)
      }
    }
    return out
  }, [trace.frames])

  // Cells that send or receive a forwarded value get the forward outline.
  const fwdCells = useMemo(() => {
    const s = new Set<string>()
    for (const f of forwards) {
      if (f.from === 'register file') continue
      const p = uidRow.get(`c${f.producer}`)
      const q = uidRow.get(`c${f.consumer}`)
      if (p !== undefined) s.add(`${p}:${f.cycle - 1}`)
      if (q !== undefined) s.add(`${q}:${f.cycle}`)
    }
    return s
  }, [forwards, uidRow])

  // Keep the current column in view while stepping.
  useEffect(() => {
    const el = scroll.current
    if (!el || !cycle || compact) return
    const lw = el.querySelector<HTMLElement>('.pl-rowhead')?.offsetWidth ?? 0
    const x = lw + (cycle - 1) * cw
    if (x < el.scrollLeft + lw || x + cw > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, x - lw - cw * 2)
  }, [cycle, cw, compact])

  if (!rows.length) return <p className="pl-muted">No instructions to draw.</p>

  const W = total * cw
  const H = rows.length * rh
  const stageText = (s: Stage) => (compact || names === 'short' ? SHORT[s] : names === 'units' ? UNITS[s] : s)

  return (
    <div className={`pl-grid-scroll${compact ? ' pl-compact' : ''}`} ref={scroll}>
      <div className="pl-grid" role="table" aria-label={label} style={{ ['--pl-cw' as string]: `${cw}px`, ['--pl-rh' as string]: `${rh}px` }}>
        <div role="rowgroup">
        <div className="pl-grow pl-ghead" role="row">
          <div className="pl-rowhead pl-corner" role="columnheader">
            {compact ? 'Instr' : 'Instruction'}
          </div>
          {Array.from({ length: total }, (_, k) => {
            const c = k + 1
            const now = c === cycle
            return (
              <div key={c} role="columnheader" className={`pl-colhead${now ? ' pl-now' : ''}`}>
                {onPick ? (
                  <button type="button" className="pl-colbtn" onClick={() => onPick(c)} aria-label={`Go to cycle ${c}`} aria-current={now ? 'step' : undefined}>
                    {c}
                  </button>
                ) : (
                  c
                )}
              </div>
            )
          })}
        </div>
        </div>
        <div className="pl-gbody" role="rowgroup">
          {rows.map((r, ri) => {
            const flushed = r.wrongPath
            return (
              <div key={r.uid} role="row" className={`pl-grow${flushed ? ' pl-flushed' : ''}`}>
                <div role="rowheader" className="pl-rowhead" title={`${r.name} ${r.text}`}>
                  <span className="pl-rname mono">{r.name}</span>
                  {compact ? null : <span className="pl-rtext mono">{r.text}</span>}
                  {flushed && !compact ? <span className="pl-tag pl-tag-flush">{r.outside ? 'outside, flushed' : 'flushed'}</span> : null}
                  {slots.has(r.uid) && !compact ? <span className="pl-tag">slot</span> : null}
                </div>
                {cells[ri].slice(1).map((cell, k) => {
                  const c = k + 1
                  const now = c === cycle ? ' pl-now' : ''
                  if (cell.kind === 'empty') return <div key={c} role="cell" className={`pl-cell${now}`} />
                  if (cell.kind === 'stall') {
                    const kind = causeOf(byUid.get(r.uid), STAGES[STAGES.indexOf(cell.after) + 1])
                    const why = kind ? `, ${CAUSE[kind][1]}` : ''
                    return (
                      <div key={c} role="cell" className={`pl-cell pl-stall${now}`} title={`${r.name} waits after ${cell.after} in cycle ${c}${why}`}>
                        {compact || !kind ? null : <span className="pl-cause" aria-hidden="true">{CAUSE[kind][0]}</span>}
                        <span className="pl-sr">stall{why}</span>
                      </div>
                    )
                  }
                  const fwd = fwdCells.has(`${ri}:${c}`) ? ' pl-fwdcell' : ''
                  const squashed = flushed && r.flushedAt === c ? ' pl-squash' : ''
                  return (
                    <div key={c} role="cell" className={`pl-cell pl-stage${now}${fwd}${squashed}`} title={`${r.name} ${cell.stage} in cycle ${c}${squashed ? ', flushed at the end of this cycle' : ''}`}>
                      {stageText(cell.stage)}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <svg className="pl-overlay" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <defs>
              <marker id={markId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 8 4 0 8z" className="pl-arrowhead" />
              </marker>
            </defs>
            {forwards.map((f, i) => {
              const p = uidRow.get(`c${f.producer}`)
              const q = uidRow.get(`c${f.consumer}`)
              if (p === undefined || q === undefined) return null
              const live = f.cycle === cycle ? ' pl-live' : ''
              if (f.from === 'register file') {
                // Split-cycle read: WB and ID share the cycle (L21 p10-11).
                const x = (f.cycle - 1) * cw + 4
                return <line key={i} x1={x} y1={p * rh + rh / 2} x2={x} y2={q * rh + rh / 2} className={`pl-split${live}`} />
              }
              // Down from the producer's stage one cycle before the use (its output latch), then right into the consumer's stage (L21 p18).
              const xs = (f.cycle - 2) * cw + cw / 2
              const ys = p * rh + rh - 2
              const xe = (f.cycle - 1) * cw + 3
              const ye = q * rh + 7 // above the stage text
              const r = Math.max(0, Math.min(6, (ye - ys) / 2))
              return <path key={i} d={`M${xs} ${ys}V${ye - r}Q${xs} ${ye} ${xs + r} ${ye}H${xe}`} className={`pl-fwd${live}`} markerEnd={`url(#${markId})`} />
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
