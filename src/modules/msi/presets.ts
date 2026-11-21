/** Course examples for every tab. Each names its source; "derived" means worked out here, not printed in a key. */
import type { BlockSpec, EnableKind, OutputGate, OutputPolarity, PairGate } from '../../core/msi'

export interface AdderPreset {
  name: string
  source: string
  mode: 'ha' | 'fa' | 'rc'
  n?: number
  x?: number
  y?: number
  cin?: 0 | 1
  /** Half adder XY or full adder XYZ as a bit mask. */
  mask?: number
}

export const ADDER_PRESETS: AdderPreset[] = [
  { name: 'Half adder, XY = 11', source: 'L17 p7', mode: 'ha', mask: 0b11 },
  { name: 'Full adder, XYZ = 011', source: 'L17 p9', mode: 'fa', mask: 0b011 },
  { name: 'Full adder, XYZ = 111', source: 'L17 p9', mode: 'fa', mask: 0b111 },
  { name: '1010 + 1111', source: 'L17 p20', mode: 'rc', n: 4, x: 0b1010, y: 0b1111, cin: 0 },
  { name: '1011 + 0011, carry rows', source: 'L17 p27', mode: 'rc', n: 4, x: 0b1011, y: 0b0011, cin: 0 },
  { name: 'BCD 0101 to Excess-3 (+0011)', source: 'L17 p22-23', mode: 'rc', n: 4, x: 0b0101, y: 0b0011, cin: 0 },
  { name: 'BCD 1001 to Excess-3 (+0011)', source: 'L17 p22-23', mode: 'rc', n: 4, x: 0b1001, y: 0b0011, cin: 0 },
  { name: '16-bit, carry through every stage', source: 'L17 p24, p38', mode: 'rc', n: 16, x: 0xffff, y: 1, cin: 0 },
]

export interface CmpPreset {
  name: string
  source: string
  mode: 'values' | 'wire' | 'find'
  width?: number
  a?: number
  b?: number
  vars?: string
  x?: string[]
  y?: string[]
  f?: string
  pairs?: boolean
  gates?: PairGate[]
}

export const CMP_PRESETS: CmpPreset[] = [
  { name: '1010 against 1001', source: 'derived, L17 p30-31', mode: 'values', width: 4, a: 0b1010, b: 0b1001 },
  { name: 'Equal values 0110, 0110', source: 'derived, L17 p31', mode: 'values', width: 4, a: 0b0110, b: 0b0110 },
  { name: 'F = Σm(12-15): ABCD > 1011', source: 'T07 Q5', mode: 'find', width: 4, f: 'F(A,B,C,D) = Σm(12,13,14,15)' },
  { name: 'G = Σm(0,6,9,15): ABCD = DCBA', source: 'T07 Q5', mode: 'find', width: 4, f: 'G(A,B,C,D) = Σm(0,6,9,15)' },
  { name: 'H = Σm(0,1,6,7,8,9,14,15): B000 = C000', source: 'T07 Q5', mode: 'find', width: 4, f: 'H(A,B,C,D) = Σm(0,1,6,7,8,9,14,15)' },
  { name: 'Z = odd except 15: ABCD < DDDD', source: 'T07 Q5', mode: 'find', width: 4, f: 'Z(A,B,C,D) = Σm(1,3,5,7,9,11,13)' },
  { name: 'F1 = Σm(2,4,5,6,7,14): AD < BC', source: 'AY25/26 Q8', mode: 'find', width: 4, f: 'F1(A,B,C,D) = Σm(2,4,5,6,7,14)' },
  { name: 'F2 = Σm(2,4,6,8,9,11,13,15): not possible', source: 'AY25/26 Q8', mode: 'find', width: 4, f: 'F2(A,B,C,D) = Σm(2,4,6,8,9,11,13,15)' },
  { name: 'F3 = ΠM(0,2-15): ABC < D', source: 'AY25/26 Q8', mode: 'find', width: 4, f: 'F3(A,B,C,D) = ΠM(0,2-15)' },
  { name: 'F1 = Σm(0-8)', source: 'AY24/25 Q7, derived', mode: 'find', width: 4, f: 'F1(A,B,C,D) = Σm(0-8)' },
  { name: 'F2 = Σm(0,2,4,6,9,11,13,15)', source: 'AY24/25 Q7, derived', mode: 'find', width: 4, f: 'F2(A,B,C,D) = Σm(0,2,4,6,9,11,13,15)' },
  { name: 'F3 = Σm(0,15)', source: 'AY24/25 Q7, derived', mode: 'find', width: 4, f: 'F3(A,B,C,D) = Σm(0,15)' },
  { name: 'F1 = ABC', source: 'AY20/21 S2 Q11, derived', mode: 'find', width: 4, f: 'F1(A,B,C) = A∙B∙C' },
  { name: '2-bit comparator: Σm(1,4,5,6,7,13)', source: 'R09 p52', mode: 'find', width: 2, f: 'F(A,B,C,D) = Σm(1,4,5,6,7,13)' },
  { name: '3 ≤ ABCD ≤ 12: two comparators and AND', source: 'L17 p33', mode: 'find', width: 4, f: 'F(A,B,C,D) = Σm(3-12)', pairs: true, gates: ['AND'] },
  { name: 'Σm(5,6,9,10): two 2-bit comparators', source: 'AY15/16 Q8, derived', mode: 'find', width: 2, f: 'F(A,B,C,D) = Σm(5,6,9,10)', pairs: true },
  { name: 'G with two comparators and OR', source: 'AY21/22 S2 Q14c, derived', mode: 'find', width: 4, f: 'G(A,B,C,D) = Σm(0,4,6,8,9,10,12,13,14,15)', pairs: true, gates: ['OR'] },
  { name: 'Multiple of 17 on 8 bits: ABCD = EFGH', source: 'R09 p57', mode: 'wire', width: 4, vars: 'A,B,C,D,E,F,G,H', x: ['A', 'B', 'C', 'D'], y: ['E', 'F', 'G', 'H'] },
  { name: 'Palindrome: ABCD against DCBA', source: 'T07 Q5', mode: 'wire', width: 4, vars: 'A,B,C,D', x: ['A', 'B', 'C', 'D'], y: ['D', 'C', 'B', 'A'] },
  { name: 'ABCD against 0010 (range, first half)', source: 'L17 p33', mode: 'wire', width: 4, vars: 'A,B,C,D', x: ['A', 'B', 'C', 'D'], y: ['0', '0', '1', '0'] },
]

export interface DecPreset {
  name: string
  source: string
  mode: 'circuit' | 'find' | 'tree'
  k?: number
  enable?: EnableKind
  outputs?: OutputPolarity
  vars?: string
  selects?: string[]
  en?: string
  used?: number[]
  gate?: OutputGate
  /** Target function to check against (circuit) or to search for (find). */
  f?: string
  n?: number
  block?: number
  code?: number
}

export const DEC_PRESETS: DecPreset[] = [
  {
    name: 'f = Σm(0,1,4,6,7): active-high outputs into OR',
    source: 'L18 p23',
    mode: 'circuit',
    k: 3,
    enable: 'none',
    outputs: 'high',
    vars: 'Q,X,P',
    selects: ['Q', 'X', 'P'],
    used: [0, 1, 4, 6, 7],
    gate: 'OR',
    f: 'f(Q,X,P) = Σm(0,1,4,6,7)',
  },
  {
    name: 'Same f: active-low outputs into AND of the 0s',
    source: 'L18 p24',
    mode: 'circuit',
    k: 3,
    enable: 'none',
    outputs: 'low',
    vars: 'Q,X,P',
    selects: ['Q', 'X', 'P'],
    used: [2, 3, 5],
    gate: 'AND',
    f: 'f(Q,X,P) = Σm(0,1,4,6,7)',
  },
  { name: '3x8, NOR of D1, D3, D6', source: 'AY25/26 Q11', mode: 'circuit', k: 3, enable: 'none', outputs: 'high', vars: 'A,B,C', selects: ['A', 'B', 'C'], used: [1, 3, 6], gate: 'NOR' },
  { name: '0-enable active-low, E = B, output 0', source: 'AY24/25 Q6, wiring derived', mode: 'circuit', k: 2, enable: 'zero', outputs: 'low', vars: 'A,B,C', selects: ['A', 'C'], en: 'B', used: [0], gate: 'none', f: 'F(A,B,C) = A+B+C' },
  { name: '0-enable active-low, AND of outputs 1 and 3', source: 'AY23/24 S2 Q21b', mode: 'circuit', k: 2, enable: 'zero', outputs: 'low', vars: 'A,B,C', selects: ['A', 'B'], en: 'C', used: [1, 3], gate: 'AND' },
  { name: 'N = A+B+C on one decoder', source: 'R09 p58', mode: 'circuit', k: 2, enable: 'zero', outputs: 'low', vars: 'A,B,C', selects: ['A', 'B'], en: 'C', used: [0], gate: 'none', f: 'N(A,B,C) = A+B+C' },
  { name: 'H = Σm(12,13): E = A, output 2', source: 'R09 p56', mode: 'circuit', k: 2, enable: 'one', outputs: 'high', vars: 'A,B,C,D', selects: ['B', 'C'], en: 'A', used: [2], gate: 'none', f: 'H(A,B,C,D) = Σm(12,13)' },
  { name: 'G = Σm(2,11): S1 = A⊕D', source: 'R09 p53', mode: 'circuit', k: 2, enable: 'one', outputs: 'high', vars: 'A,B,C,D', selects: ['A⊕D', 'B'], en: 'C', used: [0], gate: 'none', f: 'G(A,B,C,D) = Σm(2,11)' },
  { name: 'K = Σm(8,11): E = Y⊙Z, output 2', source: 'T08 Q2, wiring derived', mode: 'circuit', k: 2, enable: 'one', outputs: 'high', vars: 'W,X,Y,Z', selects: ['W', 'X'], en: 'Y⊙Z', used: [2], gate: 'none', f: 'K(W,X,Y,Z) = Σm(8,11)' },
  { name: "One 1-enable 2x4: A∙B∙C", source: 'AY23/24 S1 Q9', mode: 'find', k: 2, enable: 'one', outputs: 'high', f: 'F(A,B,C) = A∙B∙C' },
  { name: "One 1-enable 2x4: A'∙B∙C'", source: 'AY23/24 S1 Q9', mode: 'find', k: 2, enable: 'one', outputs: 'high', f: "F(A,B,C) = A'∙B∙C'" },
  { name: "One 1-enable 2x4: A'∙B'∙C' (impossible)", source: 'AY23/24 S1 Q9', mode: 'find', k: 2, enable: 'one', outputs: 'high', f: "F(A,B,C) = A'∙B'∙C'" },
  { name: 'Find H = Σm(12,13)', source: 'R09 p56', mode: 'find', k: 2, enable: 'one', outputs: 'high', f: 'H(A,B,C,D) = Σm(12,13)' },
  { name: 'Find N = A+B+C', source: 'R09 p58', mode: 'find', k: 2, enable: 'zero', outputs: 'low', f: 'N(A,B,C) = A+B+C' },
  { name: '3x8 from two 2x4 and an inverter', source: 'L18 p17', mode: 'tree', n: 3, block: 2, code: 5 },
  { name: '4x16 from two 3x8', source: 'L18 p18', mode: 'tree', n: 4, block: 3, code: 9 },
  { name: '4x16 from five 2x4', source: 'L18 p19; R09 p18', mode: 'tree', n: 4, block: 2, code: 9 },
]

export interface EncPreset {
  name: string
  source: string
  mode: 'live' | 'wired'
  m: number
  priority: boolean
  valid?: boolean
  d?: number
  vars?: string
  pins?: string[]
  order?: 'high-first' | 'low-first'
}

export const ENC_PRESETS: EncPreset[] = [
  { name: '4-to-2, D2 high', source: 'L18 p27', mode: 'live', m: 4, priority: false, d: 0b0100 },
  { name: '4-to-2, D1 and D2 high: looks like D3', source: 'L18 p26, p30', mode: 'live', m: 4, priority: false, d: 0b0110 },
  { name: '8-to-3, D5 high', source: 'L18 p31', mode: 'live', m: 8, priority: false, d: 1 << 5 },
  { name: '16-to-4, D10 high', source: 'AY23/24 S2 Q15', mode: 'live', m: 16, priority: false, d: 1 << 10 },
  { name: 'Priority 4-to-2, D0..D3 = 1010', source: 'L18 p32-33', mode: 'live', m: 4, priority: true, valid: true, d: 0b0101, order: 'low-first' },
  { name: 'Priority 4-to-2, no input high', source: 'L18 p32', mode: 'live', m: 4, priority: true, valid: true, d: 0, order: 'low-first' },
  { name: 'Priority 8-to-3 with no V', source: 'T08 Q5', mode: 'live', m: 8, priority: true, valid: false, d: 0b00101010 },
  { name: 'H2, H1, H0 from a wired priority encoder', source: 'T08 Q5; AY24/25 Q17c, wiring derived', mode: 'wired', m: 8, priority: true, valid: false, vars: 'A,B,C', pins: ['0', '1', '0', 'C', '0', 'B', '0', 'A'] },
  { name: 'Two half adders into a 4-to-2 encoder', source: 'AY23/24 S2 Q21e', mode: 'wired', m: 4, priority: false, vars: 'A,B,C,D', pins: ['A∙B', 'A⊕B', 'C∙D', 'C⊕D'] },
]

export interface MuxPreset {
  name: string
  source: string
  f: string
  selects: string
}

export const MUX_PRESETS: MuxPreset[] = [
  { name: 'Σm(0,1,3,6), selects AB', source: 'L18 p52-54', f: 'F(A,B,C) = Σm(0,1,3,6)', selects: 'A,B' },
  { name: 'Σm(0,1,3,6), selects BC', source: 'L18 p55', f: 'F(A,B,C) = Σm(0,1,3,6)', selects: 'B,C' },
  { name: 'ΠM(1,5,6)∙D(4) on an 8:1', source: 'T08 Q1', f: 'F(X,Y,Z) = ΠM(1,5,6)∙D(4)', selects: 'X,Y,Z' },
  { name: 'ΠM(1,5,6)∙D(4), selects XY', source: 'T08 Q1', f: 'F(X,Y,Z) = ΠM(1,5,6)∙D(4)', selects: 'X,Y' },
  { name: 'ΠM(1,5,6)∙D(4), selects YZ', source: 'T08 Q1, derived', f: 'F(X,Y,Z) = ΠM(1,5,6)∙D(4)', selects: 'Y,Z' },
  { name: 'F1 = Σm(3,4,5,7), selects AB', source: 'AY23/24 S1 Q10', f: 'F1(A,B,C) = Σm(3,4,5,7)', selects: 'A,B' },
  { name: 'F2 = Σm(0): impossible without an inverter', source: 'AY23/24 S1 Q10', f: 'F2(A,B,C) = Σm(0)', selects: 'A,B' },
  { name: 'F3 = Σm(0,2,6), selects AC', source: 'AY23/24 S1 Q10', f: 'F3(A,B,C) = Σm(0,2,6)', selects: 'A,C' },
  { name: 'F1 = Σm(0,2,3,5,6,7): pick the selects', source: 'AY23/24 S2 Q21a', f: 'F1(A,B,C) = Σm(0,2,3,5,6,7)', selects: 'A,B' },
  { name: 'G = ΠM(1,2,6,8,9,11,13) on an 8:1, selects ACD', source: 'R09 p55', f: 'G(A,B,C,D) = ΠM(1,2,6,8,9,11,13)', selects: 'A,C,D' },
  { name: '74151A: 4 variables on an 8:1', source: 'L18 p56, derived', f: 'f(x1,x2,x3,x4) = Σm(0,1,2,3,4,9,13,14,15)', selects: 'x1,x2,x3' },
  { name: "G per AB: 0, C'D + CD', D, 1", source: 'T08 Q4; AY24/25 Q17b', f: "G(A,B,C,D) = A'∙B∙(C⊕D) + A∙B'∙D + A∙B", selects: 'A,B' },
  { name: 'Σm(4,6,7,9,11,12,14,15) on a 4:1', source: 'AY20/21 S2 Q13b, derived', f: 'F(A,B,C,D) = Σm(4,6,7,9,11,12,14,15)', selects: 'B,D' },
  { name: 'R = Σm(0,2,3,4,6,7,12,14) on a 4:1', source: 'AY18/19 S2 Q5d, derived', f: 'R(A,B,C,D) = Σm(0,2,3,4,6,7,12,14)', selects: 'A,D' },
]

export interface TreePreset {
  name: string
  source: string
  n: number
  levels: number[]
  select: number
}

export const TREE_PRESETS: TreePreset[] = [
  { name: '8:1 from two 4:1 and a 2:1, select 110', source: 'L18 p42-43', n: 3, levels: [2, 1], select: 0b110 },
  { name: '8:1 from four 2:1 and a 4:1, select 101', source: 'L18 p44', n: 3, levels: [1, 2], select: 0b101 },
  { name: '16:1 from five 4:1', source: 'L18 p45', n: 4, levels: [2, 2], select: 0b1011 },
]

export interface WbPreset {
  name: string
  source: string
  vars: string
  blocks: BlockSpec[]
  /** Target for one named signal, checked row by row. */
  target?: string
  check?: string
}

export const WB_PRESETS: WbPreset[] = [
  {
    name: 'Two half adders into a 4-to-2 encoder: P = C + D',
    source: 'AY23/24 S2 Q21e',
    vars: 'A,B,C,D',
    blocks: [
      { id: 'HA1', kind: 'ha', size: 1, pins: ['A', 'B'], out: { C: 'K1', S: 'S1' } },
      { id: 'HA2', kind: 'ha', size: 1, pins: ['C', 'D'], out: { C: 'K2', S: 'S2' } },
      { id: 'ENC', kind: 'encoder', size: 4, pins: ['K1', 'S1', 'K2', 'S2'], out: { Y1: 'P', Y0: 'Q' } },
    ],
    target: 'P(A,B,C,D) = C+D',
    check: 'P',
  },
  {
    name: "Priority encoder wired to A, B, C: H1 = A + B'∙C",
    source: 'T08 Q5; AY24/25 Q17c, wiring derived',
    vars: 'A,B,C',
    blocks: [
      { id: 'PE', kind: 'encoder', size: 8, priority: true, valid: false, pins: ['0', '1', '0', 'C', '0', 'B', '0', 'A'], out: { Y2: 'H2', Y1: 'H1', Y0: 'H0' } },
    ],
    target: "H1(A,B,C) = A + B'∙C",
    check: 'H1',
  },
  {
    name: 'BCD to Excess-3 with one 4-bit adder (+0011)',
    source: 'L17 p22-23',
    vars: 'A,B,C,D',
    blocks: [{ id: 'ADD', kind: 'adder', size: 4, pins: ['A', 'B', 'C', 'D', '0', '0', '1', '1', '0'], out: { S3: 'W', S2: 'X', S1: 'Y', S0: 'Z' } }],
    target: 'W(A,B,C,D) = Σm(5,6,7,8,9) + d(10-15)',
    check: 'W',
  },
  {
    name: '(ABCD+1)/2 with one adder: 0ABC + 000D',
    source: 'T07 Q2a',
    vars: 'A,B,C,D',
    blocks: [{ id: 'ADD', kind: 'adder', size: 4, pins: ['0', 'A', 'B', 'C', '0', '0', '0', 'D', '0'], out: { S3: 'E', S2: 'F', S1: 'G', S0: 'H' } }],
    target: 'F(A,B,C,D) = Σm(7-14)',
    check: 'F',
  },
  {
    name: '3 ≤ ABCD ≤ 12: two comparators and an AND',
    source: 'L17 p33',
    vars: 'A,B,C,D',
    blocks: [
      { id: 'CMP1', kind: 'comparator', size: 4, pins: ['A', 'B', 'C', 'D', '0', '0', '1', '0'], out: { gt: 'P' } },
      { id: 'CMP2', kind: 'comparator', size: 4, pins: ['A', 'B', 'C', 'D', '1', '1', '0', '1'], out: { lt: 'Q' } },
      { id: 'G1', kind: 'gate', op: 'AND', size: 2, pins: ['P', 'Q'], out: { Y: 'F' } },
    ],
    target: 'F(A,B,C,D) = Σm(3-12)',
    check: 'F',
  },
  {
    name: 'Count-1 and Count-0 of ABCD',
    source: 'T08 Q3',
    vars: 'A,B,C,D',
    blocks: [
      { id: 'N1', kind: 'count1', size: 4, pins: ['A', 'B', 'C', 'D'], out: { C2: 'P2', C1: 'P1', C0: 'P0' } },
      { id: 'N0', kind: 'count0', size: 4, pins: ['A', 'B', 'C', 'D'], out: { C2: 'Z2', C1: 'Z1', C0: 'Z0' } },
    ],
    target: 'P2(A,B,C,D) = Σm(15)',
    check: 'P2',
  },
  {
    name: 'Two full adders chained by the carry: AB + CD',
    source: 'L17 p27, derived',
    vars: 'A,B,C,D',
    blocks: [
      { id: 'FA0', kind: 'fa', size: 1, pins: ['B', 'D', '0'], out: { S: 'S0', C: 'C1' } },
      { id: 'FA1', kind: 'fa', size: 1, pins: ['A', 'C', 'C1'], out: { S: 'S1', C: 'C2' } },
    ],
    target: 'C2(A,B,C,D) = Σm(7,10,11,13,14,15)',
    check: 'C2',
  },
  {
    name: '3x8 decoder from two 2x4 decoders and an inverter',
    source: 'L18 p17',
    vars: 'A,B,C',
    blocks: [
      { id: 'INV', kind: 'gate', op: 'NOT', size: 1, pins: ['A'], out: { Y: 'N' } },
      { id: 'LOW', kind: 'decoder', size: 2, enable: 'one', outputs: 'high', pins: ['B', 'C', 'N'], out: { Y0: 'D0', Y1: 'D1', Y2: 'D2', Y3: 'D3' } },
      { id: 'HIGH', kind: 'decoder', size: 2, enable: 'one', outputs: 'high', pins: ['B', 'C', 'A'], out: { Y0: 'D4', Y1: 'D5', Y2: 'D6', Y3: 'D7' } },
    ],
    target: 'D5(A,B,C) = Σm(5)',
    check: 'D5',
  },
  {
    name: '3x8 decoder, NOR of D1, D3, D6',
    source: 'AY25/26 Q11',
    vars: 'A,B,C',
    blocks: [
      { id: 'DEC', kind: 'decoder', size: 3, enable: 'none', outputs: 'high', pins: ['A', 'B', 'C'], out: { Y1: 'D1', Y3: 'D3', Y6: 'D6' } },
      { id: 'G1', kind: 'gate', op: 'NOR', size: 3, pins: ['D1', 'D3', 'D6'], out: { Y: 'F' } },
    ],
    target: 'F(A,B,C) = Σm(0,2,4,5,7)',
    check: 'F',
  },
  {
    name: "0-enable active-low 2x4 into an AND: F2 = B' + C",
    source: 'AY23/24 S2 Q21b',
    vars: 'A,B,C',
    blocks: [
      { id: 'DEC', kind: 'decoder', size: 2, enable: 'zero', outputs: 'low', pins: ['A', 'B', 'C'], out: { Y1: 'P', Y3: 'Q' } },
      { id: 'G1', kind: 'gate', op: 'AND', size: 2, pins: ['P', 'Q'], out: { Y: 'F2' } },
    ],
    target: "F2(A,B,C) = B' + C",
    check: 'F2',
  },
]
