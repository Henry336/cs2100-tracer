/**
 * Course examples for the Boolean module. Every preset names its source; "computed" marks answers
 * worked out here because the source has no key (docs/spec/features/boolean-kmap.md).
 */

import type { SetGate } from '../../core/boolean'

export type Orient = 'rows' | 'cols' | 'custom'

export interface FnPreset {
  name: string
  source: string
  f: string
  or?: Orient
  ax?: { rows: string; cols: string }
}

// The A,B,C,D examples of L15 p32-55 and R07 p32-47 put AB on the columns; the keys put it on the rows (docs/spec/logic.md).
export const FN_PRESETS: FnPreset[] = [
  { name: 'Minimal SOP, 6 PIs and 3 EPIs', source: 'L15 p39-41', f: 'F(A,B,C,D) = Σm(2,3,4,5,7,8,10,13,15)', or: 'cols' },
  { name: 'A PI that is not needed', source: 'L15 p42; AY25/26 Q17a', f: 'G(A,B,C,D) = Σm(3,4,5,7,9,13,14,15)', or: 'cols' },
  { name: 'Counting PIs and EPIs', source: 'L15 p37; R07 p39', f: 'F(A,B,C,D) = Σm(0,2,3,4,7,8,9,10,11,13,14)', or: 'cols' },
  { name: '3 variables, 3 PIs', source: 'L15 p37', f: 'F(a,b,c) = Σm(0,1,2,5)' },
  { name: 'Basic grouping', source: 'L15 p27-29', f: 'F(w,x,y,z) = Σm(4,5,10,11,14,15)' },
  { name: 'POS by grouping the 0s', source: 'L15 p43-44', f: 'F(A,B,C,D) = Σm(0,1,2,3,5,7,8,9,10,11)', or: 'cols' },
  { name: "Don't-cares, 3 variables", source: 'L15 p47', f: 'F(A,B,C) = Σm(3,5,6) + d(0,7)' },
  { name: "Groups of only don't-cares", source: 'L15 p49', f: 'F(K,L,M,N) = Σm(2,6,8) + d(3,7,11..15)' },
  { name: 'Expression to K-map', source: 'L15 p50-51', f: "F(A,B,C,D) = A∙B∙C + B'∙C∙D' + A∙D + B'∙C'∙D'", or: 'cols' },
  { name: 'Filling a map from an expression', source: 'L15 p33', f: "F(A,B,C,D) = A∙(C+D)'∙(B'+D') + C∙(B+C'+A'∙D)", or: 'cols' },
  { name: "Don't-cares, SOP and POS", source: 'L15 p52-55', f: 'F(A,B,C,D) = Σm(2,8,10,15) + d(0,1,3,7)', or: 'cols' },
  { name: 'Consensus term is redundant', source: 'R07 p36', f: 'F(A,B,C) = Σm(1,3,6,7)' },
  { name: '11 implicants, 2 PIs', source: 'R07 p37', f: 'F(A,B,C) = Σm(1,2,3,5,7)' },
  { name: 'Two minimal SOPs', source: 'R07 p9, p20 (computed)', f: "F(A,B,C) = A∙B + A'∙C + A'∙B'" },
  { name: 'F1', source: 'T06 SE3(a)', f: 'F1(A,B,C,D) = Σm(5,8,10,12,13,14)' },
  { name: 'F2 from ΠM', source: 'T06 SE3(b)', f: 'F2(W,X,Y,Z) = ΠM(0,1,2,8,9,10)' },
  { name: 'F3, two minimal SOPs', source: 'T06 SE3(c)', f: 'F3(K,L,M,N) = Σm(1,7,10,13,14) + d(0,5,8,15)' },
  { name: "F4 from ΠM with don't-cares", source: 'T06 Q2(d)', f: 'F4(A,B,C,D) = ΠM(4,8,9,11,12) ∙ D(2,3,6,7,10,14)' },
  { name: 'T on the A,C by B,D map', source: 'T06 Q3', f: 'T(A,B,C,D) = ΠM(3,7,8,10,12,13) ∙ X(6,11,14,15)', or: 'custom', ax: { rows: 'A,C', cols: 'B,D' } },
  { name: '5 PIs, 1 EPI, 3 answers', source: 'AY23/24 S2 Q19', f: 'F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)' },
  { name: 'P with no EPIs', source: 'AY23/24 S1 Q17(a)', f: 'P(W,X,Y,Z) = Σm(1,8,13) + d(0,2,5,9,10,15)' },
  { name: 'Q from ΠM', source: 'AY23/24 S1 Q17(b)', f: 'Q(W,X,Y,Z) = ΠM(5,7,8,10,13,15) ∙ d(0,2,3,4,9,14)' },
  { name: '6 PIs, 2 EPIs', source: 'AY24/25 Q3-4', f: 'F(A,B,C,D) = Σm(1,3,4,6,10,12) + x(2,5,7,13,14)' },
  { name: "B∙D is only don't-cares", source: 'AY24/25 Q17(a)', f: 'F(A,B,C,D) = Σm(0,1,4,6,9,11) + d(5,7,13,15)' },
  { name: 'Zero EPIs', source: 'AY21/22 S1 Q5 (computed)', f: 'F(A,B,C,D) = Σm(3,10,11,15) + x(1,2,4,7,9,12,14)' },
  { name: '5 PIs, all essential', source: 'AY21/22 S2 Q14(c); R08 p39', f: 'G(A,B,C,D) = Σm(0,4,6,8,9,10,12..15)' },
  { name: "G needs the don't-cares", source: 'L15 p47', f: 'G(A,B,C) = Σm(1,2,4) + d(0,7)' },
  { name: 'Simplification quiz', source: 'R07 p58-59', f: 'f(x,y,z) = Σm(0,1,2,3,4,7)' },
  { name: 'Count PIs and EPIs', source: 'AY20/21 Q1-2 (computed)', f: 'F(A,B,C,D) = Σm(0,1,2,7,15) + x(3,9,11,12,13)' },
  { name: 'Which is not an EPI', source: 'AY21/22 S2 Q5 (computed)', f: 'F(A,B,C,D) = Σm(1,3,6,8,9,11,15) + x(7,14)' },
  { name: '4 PIs, all essential', source: 'AY25/26 Q1 (map rebuilt from the key)', f: 'F(A,B,C,D) = Σm(0,1,2,6,8,10,12)' },
  { name: '5 variables, P', source: 'T07 SE3 (computed)', f: 'P(A,B,C,D,E) = Σm(9,17,18) + d(0,1,2,4,8,16)' },
  { name: '5 variables, Q', source: 'T07 SE3 (computed)', f: 'Q(A,B,C,D,E) = Σm(5,10,17,20,21) + d(0,1,2,4,8,16)' },
]

export interface AnswerPreset {
  name: string
  source: string
  f: string
  ans: string
  af: 'sop' | 'pos' | 'any'
  fitb: boolean
  epi?: boolean
}

export const ANSWER_PRESETS: AnswerPreset[] = [
  { name: 'Fill-in-the-blank, EPI first', source: 'AY23/24 S2 Q19(d)', f: 'F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)', ans: "B'.D+A'.B+B.D'", af: 'sop', fitb: true, epi: true },
  { name: 'Literals out of order', source: 'AY23/24 S2 Q19(d)', f: 'F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)', ans: "D.B'+B.A'+B.D'", af: 'sop', fitb: true, epi: true },
  { name: "A term of only don't-cares", source: 'AY24/25 Q17(a)', f: 'F(A,B,C,D) = Σm(0,1,4,6,9,11) + d(5,7,13,15)', ans: "A'∙C' + A'∙B + A∙D + B∙D", af: 'sop', fitb: false },
  { name: 'A term that is not a PI', source: 'L15 p39-41', f: 'F(A,B,C,D) = Σm(2,3,4,5,7,8,10,13,15)', ans: "B∙D + A'∙B∙C' + A∙B'∙C'∙D' + A∙B'∙C∙D' + A'∙B'∙C", af: 'sop', fitb: false },
  { name: 'Missing AND dots', source: 'T06 SE3(a); T06 Ans p1', f: 'F1(A,B,C,D) = Σm(5,8,10,12,13,14)', ans: "AD' + BC'D", af: 'sop', fitb: false },
  { name: 'EPIs alone do not cover', source: 'L15 p38; AY23/24 S1 Q7(iv)', f: 'F(A,B,C,D) = Σm(2,3,4,5,7,8,10,13,15)', ans: "B∙D + A'∙B∙C' + A∙B'∙D'", af: 'sop', fitb: false },
  { name: 'XOR is not SOP', source: 'L15 p8; R07 p30', f: 'S(X,Y) = Σm(1,2)', ans: 'X ⊕ Y', af: 'sop', fitb: false },
  { name: 'POS answer', source: 'L15 p43-44', f: 'F(A,B,C,D) = Σm(0,1,2,3,5,7,8,9,10,11)', ans: "(A'+B')∙(B'+D)", af: 'pos', fitb: false },
]

export interface FormsPreset {
  name: string
  source: string
  ex: string
  eq: string
}

export const FORMS_PRESETS: FormsPreset[] = [
  { name: 'Set operations on F and G', source: 'T06 SE2 (computed)', ex: 'F(A,B,C) = Σm(0,2,4,6,7)', eq: 'Σm(1,2,3,6)' },
  { name: 'H = F∙G', source: 'AY25/26 Q17a', ex: 'F(A,B,C,D) = Σm(0,1,3,4,5,7,9,13,14,15)', eq: 'ΠM(0,1,6,8,11,12)' },
  { name: 'Proof by truth table', source: 'L13 p14', ex: "F3(x,y,z) = x'∙y'∙z + x'∙y∙z + x∙y'", eq: "x∙y' + x'∙z" },
  { name: 'Not the same function', source: 'R07 p51', ex: "F(x,y,z) = x'∙(y + y'∙z)'", eq: "x'∙(y + z)" },
  { name: 'Complement is not term by term', source: 'T06 SE1', ex: "F(A,B) = A∙B + A'∙B'", eq: '1' },
  { name: 'Canonical SOP', source: 'AY25/26 Q12', ex: 'F(A,B,C) = (A∙B + C)∙(A∙C + B)', eq: '' },
  { name: 'XOR of two terms', source: 'R08 p31', ex: 'F(a,b,c) = (a∙b) ⊕ (b + c)', eq: "a'∙b + b'∙c" },
  { name: 'Six-variable simplification', source: 'AY20/21 Q6 (computed)', ex: "G(A,B,C,D,E,F) = A∙B'∙(C + D' + E)'∙F + (C' + F')' + D∙F", eq: '(C + D)∙F' },
  { name: 'Neither SOP nor POS', source: 'L13 p18', ex: "F(V,W,X,Y,Z) = W∙X'∙Y + V∙(X∙Z + W')", eq: '' },
  { name: 'Complement of a product', source: 'L13 p15', ex: "F1(x,y,z) = x∙y∙z'", eq: "(x' + y' + z)'" },
]

export interface StepsPreset {
  name: string
  source: string
  text: string
}

export const STEPS_PRESETS: StepsPreset[] = [
  {
    name: 'Proof of absorption',
    source: 'L13 p13',
    text: 'X + X∙Y\n= X∙1 + X∙Y  (by identity)\n= X∙(1 + Y)  (by distributivity)\n= X∙1  (by one element)\n= X  (by identity)',
  },
  {
    name: 'Six literals to two',
    source: 'L15 p5',
    text: "(x+y)∙(x+y')∙(x'+z)\n= (x + y∙y')∙(x'+z)  (distributivity)\n= (x + 0)∙(x'+z)  (complement)\n= x∙(x'+z)  (identity)\n= x∙x' + x∙z  (distributivity)\n= 0 + x∙z  (complement)\n= x∙z  (identity)",
  },
  {
    name: 'Thirteen literals to three',
    source: 'L15 p6; R07 p29 (steps computed)',
    text: "a∙b∙c + a∙b∙d + a'∙b∙c' + c∙d + b∙d'\n= a∙b∙c + a∙b + a'∙b∙c' + c∙d + b∙d'\n= a∙b + a'∙b∙c' + c∙d + b∙d'\n= a∙b + b∙c' + c∙d + b∙d'\n= b + c∙d",
  },
  { name: 'The X + X′ trap', source: 'T06 SE1', text: "A∙B + A'∙B'\n= 1  (complement)" },
  { name: 'Wrong law cited', source: 'L13 p12', text: "X + X'∙Y\n= X + Y  (absorption 1)" },
  {
    name: 'Simplify F',
    source: 'T06 Q1(a) (computed)',
    text: "(x + y∙z')∙(y' + y) + x'∙(y∙z' + y)\n= (x + y∙z')∙1 + x'∙(y∙z' + y)\n= x + y∙z' + x'∙(y∙z' + y)\n= x + y∙z' + x'∙y\n= x + y∙z' + y\n= x + y",
  },
]

export interface GatePreset {
  name: string
  source: string
  gx: string
  gd?: number
  fi?: boolean
}

/** Circuits drawn straight from an expression (Gates tab, expression mode). */
export const GATE_PRESETS: GatePreset[] = [
  { name: 'Four NANDs make one XOR, 9 ns', source: 'AY23/24 S2 Q12-13', gx: "Y(A,B) = ((A∙(A∙B)')'∙(B∙(A∙B)')')'", gd: 3 },
  { name: 'Analyse a circuit', source: 'L14 p9', gx: "F4(A,B,C) = ((A'∙B') + C)'" },
  { name: 'XOR of two terms', source: 'R08 p31', gx: 'F(a,b,c) = (a∙b) ⊕ (b + c)' },
  { name: 'Full adder sum, 2t', source: 'R08 p25', gx: 'S(X,Y,Z) = (X ⊕ Y) ⊕ Z' },
  { name: 'Full adder carry, 3t', source: 'R08 p25', gx: 'C(X,Y,Z) = X∙Y + (X ⊕ Y)∙Z' },
  { name: 'NAND of fan-in 3 takes 3t', source: 'AY17/18 Q1c(ii)', gx: "F(A,B,C) = (A∙B∙C)'", fi: true },
]

export interface SetPreset {
  name: string
  source: string
  set: SetGate[]
}

/** Gate sets to test for completeness (L14 p10-12; AY24/25 Q2: all four are complete). */
export const SET_PRESETS: SetPreset[] = [
  { name: '{AND, OR, NOT}', source: 'L14 p10', set: ['AND', 'OR', 'NOT'] },
  { name: '{NAND}', source: 'L14 p11; AY24/25 Q2', set: ['NAND'] },
  { name: '{NOR}', source: 'L14 p12', set: ['NOR'] },
  { name: '{OR, NOT}', source: 'AY24/25 Q2', set: ['OR', 'NOT'] },
  { name: '{XOR, AND}', source: 'AY24/25 Q2', set: ['XOR', 'AND'] },
  { name: '{NOR, AND}', source: 'AY24/25 Q2', set: ['NOR', 'AND'] },
  { name: '{AND, OR}', source: 'computed', set: ['AND', 'OR'] },
]
