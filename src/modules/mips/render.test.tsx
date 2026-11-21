import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BranchCondTab from './BranchCondTab'
import EncodeTab from './EncodeTab'
import MipsPage from './MipsPage'
import OpcodeTab from './OpcodeTab'

// Smoke test: every tab renders its default state without throwing.
describe('MIPS page renders', () => {
  it('Run tab (page default), Encode, Branch conditions and Expanding opcode', () => {
    expect(renderToString(<MipsPage />)).toContain('Line counts')
    expect(renderToString(<EncodeTab intro={null} />)).toContain('Check your answer')
    expect(renderToString(<BranchCondTab intro={null} />)).toContain('slt $t0, $s1, $s2')
    expect(renderToString(<OpcodeTab intro={null} />)).toContain('Prefix tree')
  })
})
