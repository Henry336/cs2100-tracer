import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Step-through state shared by every tracer. `count` is the number of steps (frames);
 * the current frame index runs 0..count-1.
 */
export interface Stepper {
  index: number
  count: number
  playing: boolean
  set: (i: number) => void
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
  toggle: () => void
}

/** Playback speeds, slowest to fastest; one setting shared by every tracer and kept between visits. */
export const SPEEDS = [0.5, 0.75, 1, 1.5, 2]
const SPEED_KEY = 'cs2100-speed'
const listeners = new Set<() => void>()
let speed = readSpeed()

function readSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY))
    return SPEEDS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

export function setSpeed(v: number) {
  if (!SPEEDS.includes(v)) return
  speed = v
  try {
    localStorage.setItem(SPEED_KEY, String(v))
  } catch {
    /* storage blocked: the speed holds for this visit */
  }
  listeners.forEach((l) => l())
}

/** One notch slower (-1) or faster (+1), stopping at the ends of the list. */
export function stepSpeed(dir: -1 | 1) {
  const i = SPEEDS.indexOf(speed) + dir
  if (i >= 0 && i < SPEEDS.length) setSpeed(SPEEDS[i])
}

export function useSpeed(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => speed,
    () => 1,
  )
}

export function useStepper(count: number, opts: { intervalMs?: number; initial?: number } = {}): Stepper {
  const { intervalMs = 900, initial = 0 } = opts
  const [index, setIndex] = useState(initial)
  const [playing, setPlaying] = useState(false)
  const rate = useSpeed()
  const clamp = useCallback((i: number) => Math.max(0, Math.min(Math.max(count - 1, 0), i)), [count])

  // Keep the index valid when the trace length changes.
  useEffect(() => {
    setIndex((i) => clamp(i))
  }, [clamp])

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      setIndex((i) => {
        if (i >= count - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, intervalMs / rate)
    return () => window.clearInterval(t)
  }, [playing, count, intervalMs, rate])

  return {
    index,
    count,
    playing,
    set: (i) => setIndex(clamp(i)),
    next: () => setIndex((i) => clamp(i + 1)),
    prev: () => setIndex((i) => clamp(i - 1)),
    first: () => setIndex(0),
    last: () => setIndex(clamp(count - 1)),
    toggle: () => {
      if (!playing && index >= count - 1) setIndex(0)
      setPlaying((p) => !p)
    },
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Global keyboard: ←/→ step, Home/End jump, Space play/pause. Ignored while typing. */
export function useStepperKeys(s: Stepper) {
  const ref = useRef(s)
  ref.current = s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const st = ref.current
      if (e.key === 'ArrowRight') st.next()
      else if (e.key === 'ArrowLeft') st.prev()
      else if (e.key === 'Home') st.first()
      else if (e.key === 'End') st.last()
      else if (e.key === ' ') st.toggle()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
