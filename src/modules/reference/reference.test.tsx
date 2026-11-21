import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ReferencePage from './ReferencePage'

describe('reference page (reviewer F14: open-book tables)', () => {
  const html = renderToString(<ReferencePage />)
  it('has the tables the exam needs', () => {
    for (const text of ['0x1F', 'C16_2s', 'ALUop1·(F3 + F0)', 'Bits per line', 'bias', 'NaN', 'sizeof', 'PC + 8', 'no V output', 'Hide sources']) expect(html).toContain(text)
  })
  it('wraps every source so cheat-sheet mode can hide it', () => {
    expect(html).toContain('<span class="ref-cite">(L06 p45)</span>')
  })
})
