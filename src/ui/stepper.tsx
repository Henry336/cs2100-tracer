import { useCallback, useEffect, useRef, useState } from 'react'

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

export function useStepper(count: number, opts: { intervalMs?: number; initial?: number } = {}): Stepper {
  const { intervalMs = 900, initial = 0 } = opts
  const [index, setIndex] = useState(initial)
  const [playing, setPlaying] = useState(false)
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
    }, intervalMs)
    return () => window.clearInterval(t)
  }, [playing, count, intervalMs])

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
