import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EXCITATION, type Bit, type FFType } from '../../core/sequential'
import { MatchView, TablesView, collapse, ffGraph, fullCharacteristic } from './TrainerViews'

const TYPES: FFType[] = ['D', 'T', 'JK', 'SR']

describe('flip-flop table trainer', () => {
  it('merging the characteristic rows of each move gives the L19 p45 excitation table', () => {
    for (const t of TYPES) {
      const rows = fullCharacteristic(t)
      for (const q of [0, 1] as Bit[]) for (const n of [0, 1] as Bit[]) expect(collapse(rows, q, n).inputs, `${t} ${q}->${n}`).toEqual(EXCITATION[t][q][n])
    }
  })

  it('S-R with S = R = 1 never counts as a way to make a move', () => {
    const rows = fullCharacteristic('SR')
    expect(collapse(rows, 0, 1).rows.map((r) => r.inputs)).toEqual([[1, 0]])
  })

  it('T09 SE2 diagrams carry the excitation labels', () => {
    expect(ffGraph('SR').edges.map((e) => e.label)).toEqual(['0X', '10', '01', 'X0'])
    expect(ffGraph('JK').edges.map((e) => e.label)).toEqual(['0X', '1X', 'X1', 'X0'])
    expect(ffGraph('T').edges.map((e) => e.label)).toEqual(['0', '1', '1', '0'])
  })

  it('both views render', () => {
    expect(renderToString(<TablesView intro={null} switcher={null} />)).toContain('Merging the rows')
    const quiz = renderToString(<MatchView intro={null} switcher={null} />)
    expect(quiz).toContain('Diagram (d)')
    expect(quiz).not.toContain(String.fromCharCode(0x2014))
  })
})
