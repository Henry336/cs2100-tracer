import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Transport } from './Transport'
import { SPEEDS, setSpeed } from './stepper'

const stepper = { index: 0, count: 3, playing: false, set() {}, next() {}, prev() {}, first() {}, last() {}, toggle() {} }

describe('playback speed', () => {
  it('runs from half speed to double', () => {
    expect(SPEEDS[0]).toBe(0.5)
    expect(SPEEDS[SPEEDS.length - 1]).toBe(2)
  })
  it('shows the speed with slower and faster buttons', () => {
    const html = renderToString(<Transport stepper={stepper} label="stage" />)
    expect(html).toContain('1×')
    expect(html).toContain('aria-label="Slower"')
    expect(html).toContain('aria-label="Faster"')
  })
  it('ignores speeds outside the list', () => {
    expect(() => setSpeed(5)).not.toThrow()
  })
})
