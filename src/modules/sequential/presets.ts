/** Course examples for every tab. Each names its source; 'derived' means worked out here, with no answer key. */
import type { Bit, FFType, TableRow, TimingElement } from '../../core/sequential'

export type TimingPreset = {
  name: string
  source: string
  element: TimingElement
  edge?: 'pos' | 'neg'
  asyncLevel?: 'high' | 'low'
  async: boolean
  waves: Record<string, Bit[]>
}

const b = (s: string) => s.split('').map((c) => (c === '1' ? 1 : 0)) as Bit[]
const CLK12 = b('010101010101')

export const TIMING_PRESETS: TimingPreset[] = [
  { name: 'Positive-edge D flip-flop', source: 'L19 p16, p19 (derived)', element: 'D', edge: 'pos', async: false, waves: { CLK: CLK12, D: b('011010011100') } },
  { name: 'Gated D latch on the same waveforms', source: 'L19 p8, p14-15 (derived)', element: 'gated-d', async: false, waves: { CLK: CLK12, D: b('011010011100') } },
  { name: 'Negative-edge D flip-flop', source: 'L19 p17 (derived)', element: 'D', edge: 'neg', async: false, waves: { CLK: CLK12, D: b('011010011100') } },
  {
    name: 'J-K with J = K = 1 and active-low PRE, CLR',
    source: 'L19 p25 figure',
    element: 'JK',
    edge: 'pos',
    asyncLevel: 'low',
    async: true,
    waves: { CLK: b('0010101010101010101'), J: b('1111111111111111111'), K: b('1111111111111111111'), PRE: b('1000000111111111111'), CLR: b('1111111111111110000') },
  },
  { name: 'T flip-flop toggles on T = 1', source: 'L19 p23 (derived)', element: 'T', edge: 'pos', async: false, waves: { CLK: CLK12, T: b('111100001111') } },
  { name: 'S-R flip-flop with S = R = 1', source: 'L19 p18 (derived)', element: 'SR', edge: 'pos', async: false, waves: { CLK: CLK12, S: b('110000111100'), R: b('000011111100') } },
  { name: 'Gated S-R latch', source: 'L19 p13 (derived)', element: 'gated-sr', async: false, waves: { CLK: CLK12, S: b('011000000110'), R: b('000001100000') } },
]

export type AnalysisPreset = {
  name: string
  source: string
  mode: 'eq' | 'table'
  /** Equations (mode eq) or a compact state table (mode table). */
  text: string
  inputs?: string
  outputs?: string
  bits?: string
  used?: string
  start: number
  seq?: string
  clocks?: number
}

export const ANALYSIS_PRESETS: AnalysisPreset[] = [
  { name: 'Analysis example 1, D flip-flops', source: 'L19 p31-34', mode: 'eq', text: "A+ = A∙x + B∙x\nB+ = A'∙x\ny = (A+B)∙x'", start: 0, seq: '0110' },
  { name: 'Example 2, J-K flip-flops', source: 'L19 p38-40', mode: 'eq', text: "JA = B\nKA = B∙x'\nJB = x'\nKB = A⊕x", start: 0, seq: '0101' },
  { name: 'Example 3, J-K with JB = KB', source: 'L19 p41-43 (y read from the table)', mode: 'eq', text: "JA = B\nKA = B'\nJB = KB = (A⊕x)'\ny = A⊕B⊕x", start: 0, seq: '1100' },
  { name: 'T and D, output inside the state', source: 'T09 Q1', mode: 'eq', text: "p = A∙B + A'∙B'\nTA = A∙B'\nDB = A' + B", start: 0, clocks: 3 },
  { name: 'Named states, start A, x = 100010', source: 'T09 SE1', mode: 'table', text: 'A: C/0 A/1\nB: D/1 B/0\nC: B/1 D/0\nD: C/0 D/0', inputs: 'x', outputs: 'z', start: 0, seq: '100010' },
  { name: 'D and T next states', source: 'AY23/24 S1 Q18a', mode: 'eq', text: "DA = A + B'\nTB = A∙B'", start: 0, clocks: 4 },
  { name: 'J-K and D, used 2, 3, 5, 6, 7', source: 'AY24/25 Q16', mode: 'eq', text: 'JA = B\nKA = 1\nJB = A∙C\nKB = 0\nDC = A + B', used: '2,3,5,6,7', start: 4, clocks: 4 },
  { name: 'J-K, T and D counter 0 to 5', source: 'AY15/16 S1 Q7 (R10 p61-63)', mode: 'eq', text: "JA = B∙C\nKA = 0\nTB = A'∙C\nDC = A + C'", used: '0-5', start: 0, clocks: 7 },
  { name: 'Design example 3 equations, unused 0, 6, 7', source: 'L19 p55-58; R10 p42-43', mode: 'eq', text: "SA = B∙x\nRA = C∙x'\nSB = A'∙B'∙x\nRB = B∙C + B∙x\nSC = x'\nRC = x\ny = A∙x", used: '1-5', start: 6, seq: '01' },
  { name: 'S-R analysis quiz', source: 'R10 p55-57', mode: 'eq', text: "SA = B∙x'\nRA = B'∙x\nSB = B'∙x' + A∙B'\nRB = A'∙B + B∙x", start: 0, seq: '0001' },
  { name: 'Three J-K flip-flops', source: 'AY20/21 S2 Q12a (R10 p64-65)', mode: 'eq', text: "JA = A∙x\nKA = B\nJB = x'\nKB = C'\nJC = x'\nKC = 1", start: 0, seq: '0010' },
  { name: 'Two inputs, X0 is the MSB', source: 'AY25/26 Q16', mode: 'eq', text: "A+ = B∙X0'∙X1\nB+ = A'∙B'∙X0∙X1\nG = A", inputs: 'X0, X1', start: 0, seq: '01 11 01' },
  { name: 'Locker, xy = 11 cannot happen', source: 'T09 Q4', mode: 'table', text: '0: 0 2 1 X\n1: 1 3 2 X\n2: 2 3 3 X\n3: 3 3 3 X', inputs: 'x, y', bits: 'A, B', start: 0, seq: '10 01 10' },
  { name: 'Johnson counter (beyond the course)', source: 'AY23/24 S2 Q14', mode: 'eq', text: "DW = Z'\nDX = W\nDY = X\nDZ = Y", start: 1, clocks: 8 },
]

export type DesignPreset = {
  name: string
  source: string
  bits: string
  inputs: string
  outputs: string
  types: FFType[]
  rows: TableRow[]
  prefer?: 'sop' | 'fewest-gates'
  overrides?: string
}

const chain = (states: number[]): TableRow[] => {
  const next = new Map<number, number>()
  for (let i = 0; i + 1 < states.length; i++) next.set(states[i], states[i + 1])
  return [...new Set(states)].sort((x, y) => x - y).map((s) => ({ state: s, next: [next.get(s) ?? null] }))
}

export const DESIGN_PRESETS: DesignPreset[] = [
  { name: 'Design example 1, J-K', source: 'L19 p47-51', bits: 'A, B', inputs: 'x', outputs: '', types: ['JK', 'JK'], rows: [{ state: 0, next: [0, 1] }, { state: 1, next: [2, 1] }, { state: 2, next: [2, 3] }, { state: 3, next: [3, 0] }] },
  {
    name: 'Design example 2, D with output y',
    source: 'L19 p52-54',
    bits: 'A, B',
    inputs: 'x',
    outputs: 'y',
    types: ['D', 'D'],
    rows: [
      { state: 0, next: [0, 1], out: [[0], [1]] },
      { state: 1, next: [2, 1], out: [[0], [0]] },
      { state: 2, next: [2, 3], out: [[0], [1]] },
      { state: 3, next: [3, 0], out: [[0], [0]] },
    ],
  },
  {
    name: 'Design example 3, S-R, unused 0, 6, 7',
    source: 'L19 p55-58; R10 p42-43',
    bits: 'A, B, C',
    inputs: 'x',
    outputs: 'y',
    types: ['SR', 'SR', 'SR'],
    rows: [
      { state: 1, next: [1, 2], out: [[0], [0]] },
      { state: 2, next: [3, 4], out: [[0], [0]] },
      { state: 3, next: [1, 4], out: [[0], [0]] },
      { state: 4, next: [5, 4], out: [[0], [1]] },
      { state: 5, next: [1, 4], out: [[0], [1]] },
    ],
  },
  { name: 'Mod-3 counter, J-K, fewest gates', source: 'T09 Q2', bits: 'A, B', inputs: 'x', outputs: '', types: ['JK', 'JK'], rows: [{ state: 0, next: [1, 2] }, { state: 1, next: [2, 0] }, { state: 2, next: [0, 1] }], prefer: 'fewest-gates' },
  { name: 'Mixed D, T, T, J-K on a sequence', source: 'T09 Q3 (AY18/19)', bits: 'A, B, C, D', inputs: '', outputs: '', types: ['D', 'T', 'T', 'JK'], rows: chain([1, 3, 5, 7, 9, 11, 13, 15, 2, 4, 6, 1]) },
  {
    name: 'Locker with D, xy = 11 cannot happen',
    source: 'T09 Q4',
    bits: 'A, B',
    inputs: 'x, y',
    outputs: '',
    types: ['D', 'D'],
    rows: [
      { state: 0, next: [0, 2, 1, null] },
      { state: 1, next: [1, 3, 2, null] },
      { state: 2, next: [2, 3, 3, null] },
      { state: 3, next: [3, 3, 3, null] },
    ],
  },
  { name: 'J-K, states 1 to 3, input C', source: 'AY23/24 S2 Q20', bits: 'A, B', inputs: 'C', outputs: '', types: ['JK', 'JK'], rows: [{ state: 1, next: [2, 2] }, { state: 2, next: [2, 3] }, { state: 3, next: [2, 3] }], prefer: 'fewest-gates' },
  { name: 'J-K, state 3 unused', source: 'AY23/24 S1 Q18b', bits: 'A, B', inputs: 'x', outputs: '', types: ['JK', 'JK'], rows: [{ state: 0, next: [0, 2] }, { state: 1, next: [1, 0] }, { state: 2, next: [2, 2] }] },
  { name: 'T redesign, no gates', source: 'AY24/25 Q16c', bits: 'A, B, C', inputs: '', outputs: '', types: ['T', 'T', 'T'], rows: [2, 3, 5, 6, 7].map((s) => ({ state: s, next: [s === 2 || s === 3 ? 7 : 3] })) },
  { name: 'J-K, T, D counter 0 to 5', source: 'AY15/16 S1 Q7 (R10 p61-63)', bits: 'A, B, C', inputs: '', outputs: '', types: ['JK', 'T', 'D'], rows: chain([0, 1, 2, 3, 4, 5, 5]) },
  {
    name: 'T design with output y',
    source: 'R10 p51-53',
    bits: 'A, B',
    inputs: 'x',
    outputs: 'y',
    types: ['T', 'T'],
    rows: [
      { state: 0, next: [3, 0], out: [[1], [0]] },
      { state: 1, next: [2, 1], out: [[0], [0]] },
      { state: 2, next: [0, 3], out: [[1], [0]] },
      { state: 3, next: [1, 2], out: [[0], [1]] },
    ],
  },
  { name: 'D redesign without state 4', source: 'AY20/21 S2 Q12b (R10 p66)', bits: 'F, G', inputs: 'x', outputs: '', types: ['D', 'D'], rows: [{ state: 0, next: [3, 0] }, { state: 1, next: [2, 0] }, { state: 2, next: [1, 0] }, { state: 3, next: [2, 2] }] },
  {
    name: 'D, inputs X0 X1, output G',
    source: 'AY25/26 Q16',
    bits: 'A, B',
    inputs: 'X0, X1',
    outputs: 'G',
    types: ['D', 'D'],
    rows: [0, 1, 2, 3].map((s) => ({ state: s, next: [0, s === 1 || s === 3 ? 2 : 0, 0, s === 0 ? 1 : 0], out: [0, 1, 2, 3].map(() => [s >> 1 ? 1 : 0] as Bit[]) })),
  },
]

export type CheckPreset = { name: string; source: string; eq: string; table: string; used?: string }

export const CHECK_PRESETS: CheckPreset[] = [
  { name: 'Mod-3 counter, answer key', source: 'T09 Q2 Ans p3', eq: 'JA = B ⊕ x\nKA = 1\nJB = A ⊙ x\nKB = 1', table: '0: 1 2\n1: 2 0\n2: 0 1' },
  { name: 'Mod-3 counter with a slip in JB', source: 'T09 Q2 (derived)', eq: 'JA = B ⊕ x\nKA = 1\nJB = A ⊕ x\nKB = 1', table: '0: 1 2\n1: 2 0\n2: 0 1' },
  { name: 'Design example 1, J-K', source: 'L19 p50-51', eq: "JA = B∙x'\nKA = B∙x\nJB = x\nKB = (A⊕x)'", table: '0: 0 1\n1: 2 1\n2: 2 3\n3: 3 0' },
  { name: 'Design example 3, S-R with y', source: 'L19 p56-58', eq: "SA = B∙x\nRA = C∙x'\nSB = A'∙B'∙x\nRB = B∙C + B∙x\nSC = x'\nRC = x\ny = A∙x", table: '1: 1/0 2/0\n2: 3/0 4/0\n3: 1/0 4/0\n4: 5/0 4/1\n5: 1/0 4/1' },
  { name: 'J-K, state 3 unused', source: 'AY23/24 S1 Q18b', eq: "JA = B'∙x\nKA = 0\nJB = 0\nKB = x", table: '0: 0 2\n1: 1 0\n2: 2 2' },
  { name: 'D redesign without state 4', source: 'AY20/21 S2 Q12b (R10 p66)', eq: "DF = F'∙x' + F∙G\nDG = G'∙x'", table: '0: 3 0\n1: 2 0\n2: 1 0\n3: 2 2' },
  { name: 'Mixed D, T, T, J-K', source: 'T09 Q3 Ans p4', eq: "DA = A∙B' + A∙C' + A'∙B∙C∙D\nTB = C\nTC = A' + B' + C'\nJD = B∙C\nKD = A∙B∙C", table: '1: 3\n3: 5\n5: 7\n7: 9\n9: 11\n11: 13\n13: 15\n15: 2\n2: 4\n4: 6\n6: 1' },
]
