import { useState, type CSSProperties, type ReactNode } from 'react'
import { useStepperKeys, type Stepper } from './stepper'

const SEEN_KEY = 'cs2100-played'

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

/**
 * The player at the bottom of every tracer: a large Play button with a progress ring,
 * step controls, the current step in words, and a scrubbable timeline.
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
  const atEnd = count > 1 && index >= count - 1
  const [seen, setSeen] = useState(readSeen)
  const markSeen = () => {
    if (seen) return
    setSeen(true)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage blocked: the hint shows again next visit */
    }
  }
  const play = () => {
    markSeen()
    // At the end, Play starts again from the first step.
    if (!playing && atEnd) stepper.first()
    stepper.toggle()
  }
  const step = (f: () => void) => () => {
    markSeen()
    f()
  }
  const unit = label.charAt(0).toUpperCase() + label.slice(1)
  const p = count > 1 ? index / (count - 1) : 0
  return (
    <div className="transport" role="group" aria-label="Step controls">
      <div className="transport-buttons">
        <button type="button" className="tbtn" onClick={step(stepper.first)} disabled={empty || index === 0} aria-label="First step" title="First (Home)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M13 3 6 8l7 5z" /></svg>
        </button>
        <button type="button" className="tbtn" onClick={step(stepper.prev)} disabled={empty || index === 0} aria-label="Previous step" title="Back (←)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3 4 8l7 5z" /></svg>
        </button>
        <button
          type="button"
          className={`tbtn-play${seen ? '' : ' is-new'}`}
          data-playing={playing}
          style={{ '--p': p } as CSSProperties}
          onClick={play}
          disabled={empty}
          aria-label={playing ? 'Pause' : atEnd ? 'Replay from the start' : 'Play'}
          title="Play / pause (Space)"
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8l9 5.2-9 5.2z" /></svg>
          )}
          <span className="tbtn-play-label">{playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</span>
        </button>
        <button type="button" className="tbtn" onClick={step(stepper.next)} disabled={empty || index >= count - 1} aria-label="Next step" title="Step (→)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l7 5-7 5z" /></svg>
        </button>
        <button type="button" className="tbtn" onClick={step(stepper.last)} disabled={empty || index >= count - 1} aria-label="Last step" title="Last (End)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 3v10M3 3l7 5-7 5z" /></svg>
        </button>
        {!seen && !empty ? (
          <span className="transport-hint" role="note">
            Press Play to watch it run, or step with <kbd>←</kbd> <kbd>→</kbd>
          </span>
        ) : null}
      </div>
      <div className="transport-counter">
        <span className="mono">
          {unit} {empty ? 0 : index + 1}
          <span className="transport-of"> of {count}</span>
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
            onClick={step(() => stepper.set(i))}
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
            onChange={(e) => {
              markSeen()
              stepper.set(e.target.valueAsNumber)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
