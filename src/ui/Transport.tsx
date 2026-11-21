import type { ReactNode } from 'react'
import { useStepperKeys, type Stepper } from './stepper'

/**
 * The bottom transport bar: step controls plus a tick timeline, like a logic analyzer.
 * `marks` lets a module colour individual ticks (e.g. hit/miss, stall) with a signal class.
 */
export function Transport({
  stepper,
  label,
  marks,
  describe,
}: {
  stepper: Stepper
  /** What one step is, e.g. "cycle", "access", "instruction". */
  label: string
  /** Optional signal class per step: 'path' | 'data' | 'control' | 'forward' | 'stall' | 'flush' | 'hit' | 'miss' | 'dirty'. */
  marks?: (string | undefined)[]
  /** Short text for the current step, shown beside the counter. */
  describe?: ReactNode
}) {
  useStepperKeys(stepper)
  const { index, count, playing } = stepper
  const empty = count === 0
  return (
    <div className="transport" role="group" aria-label="Step controls">
      <div className="transport-buttons">
        <button type="button" className="tbtn" onClick={stepper.first} disabled={empty || index === 0} aria-label="First step" title="First (Home)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M13 3 6 8l7 5z" /></svg>
        </button>
        <button type="button" className="tbtn" onClick={stepper.prev} disabled={empty || index === 0} aria-label="Previous step" title="Back (←)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3 4 8l7 5z" /></svg>
        </button>
        <button type="button" className="tbtn tbtn-play" onClick={stepper.toggle} disabled={empty} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3l9 5-9 5z" /></svg>
          )}
        </button>
        <button type="button" className="tbtn" onClick={stepper.next} disabled={empty || index >= count - 1} aria-label="Next step" title="Step (→)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l7 5-7 5z" /></svg>
        </button>
        <button type="button" className="tbtn" onClick={stepper.last} disabled={empty || index >= count - 1} aria-label="Last step" title="Last (End)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 3v10M3 3l7 5-7 5z" /></svg>
        </button>
      </div>
      <div className="transport-counter">
        <span className="mono">
          {label} {empty ? 0 : index + 1}
          <span className="transport-of"> / {count}</span>
        </span>
        {describe ? <span className="transport-describe">{describe}</span> : null}
      </div>
      <div className="timeline">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className={`tick${i === index ? ' tick-now' : ''}${i < index ? ' tick-past' : ''}${marks?.[i] ? ` tick-${marks[i]}` : ''}`}
            onClick={() => stepper.set(i)}
            aria-label={`${label} ${i + 1}`}
          />
        ))}
        {count > 1 ? (
          <input
            className="timeline-range"
            type="range"
            min={0}
            max={count - 1}
            step={1}
            value={index}
            aria-label={`Scrub ${label}`}
            onChange={(e) => stepper.set(e.target.valueAsNumber)}
          />
        ) : null}
      </div>
    </div>
  )
}
