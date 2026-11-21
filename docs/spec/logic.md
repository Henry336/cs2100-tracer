# CS2100 Logic Spec (L13–L19, T06–T09, R07–R10, past finals)

## 1. Notation

**Operators** (L13 p5–6, p9; T06 p2)
- Use `1`/`0`, `∙` for AND, `+` for OR, `'` for NOT. The overbar is also allowed.
- Always write `∙`. T06 p2: writing `AB` means a 2-bit value and "will receive zero mark".
- Precedence is NOT, then AND, then OR (L13 p9, which notes this differs from CS1231).
- XOR is `⊕`. XNOR is `(A⊕B)'`, also written `A ⊙ B` (L14 p6).
- `A ⊕ B` does not count as SOP. T08 Q4 says "C ⊕ D is not an SOP expression", and AY24/25 Q17b gives only 1 mark for it.
- Exam fill-in-the-blank syntax (AY23/24 S2 Q19d, Q20, Q21):
  - `'` for NOT, `.` for AND, `+` for OR; capital letters; no spaces.
  - Literals inside a term must be alphabetical. Any term order is accepted (`Y'.Z+X` is fine, `X+Z.Y'` is not).
  - The constants `0` and `1` count as SOP.
  - Minterm lists are written in increasing order with commas, e.g. `2,5,6`.
  - Q19d also says to write the EPIs first.

**Minterm and maxterm numbering** (L13 p19–21)
- The first variable listed in F(...) is the MSB. For F(x,y): m2 = x∙y', M2 = x'+y.
- m_i: a 0 bit becomes a complemented literal. M_i: a 0 bit becomes an uncomplemented literal. m_i' = M_i.
- L13 p21 quiz answers for F(A,B,C,D):
  - m3 = A'B'CD, m10 = AB'CD', m11 = AB'CD, ABCD' = m14, AB'C'D = m9
  - M3 = A+B+C'+D', M13 = A'+B'+C+D', M0 = A+B+C+D, A+B+C'+D = M2, A'+B+C+D' = M9

**Canonical forms** (L13 p22–25)
- Σm lists the rows where F = 1. ΠM lists the rows where F = 0.
- Ranges are allowed: `Σm(1,3–5)`.
- The two index sets are complements of each other: F2 = Σm(1,4,5,6,7) = ΠM(0,2,3).
- Sum-of-minterms is the canonical SOP; product-of-maxterms is the canonical POS.

**Don't-cares**
- Written X or d (L15 p45).
- Forms seen in the sources: `Σm(..) + d(..)` (L15), `ΠM(..) ∙ D(..)` or `∙ X(..)` (T06 Q2d, Q3; AY23/24 S2 Q19), and `Σx(..)` (AY24/25).

**SOP and POS definitions** (L13 p16–18)
- A literal is a variable or its complement. A product term is one literal or an AND of literals; a sum term is one literal or an OR of literals.
- `X' + Y + Z` and `X∙Y∙Z'` are both SOP and POS.
- `X∙(W'+Y∙Z)` and `W∙X'∙Y + V∙(X∙Z+W')` are neither (L13 p18; R07 p12).

**Literal counting** (L15 p4–6)
- Count every occurrence of a literal.
- (x+y)(x+y')(x'+z) has 6 literals; x∙z has 2.
- abc+abd+a'bc'+cd+bd' has 13; b+cd has 3.
- Minimise the number of terms first, then the number of literals (L15 p12, p34).

## 2. K-map conventions

**Gray order** is 00, 01, 11, 10 on each axis (L15 p16). Other adjacency-preserving layouts are allowed (L15 p13–16), and T06 Q3 tests one.

**Layouts**
- **2 variables** (L15 p13–14): several layouts are allowed, for example a on rows with m0 m1 / m2 m3.
- **3 variables** (L15 p16–17): a on rows, bc on columns. Row 0 is m0 m1 m3 m2; row 1 is m4 m5 m7 m6. m0 is adjacent to m2 and m4 to m6. Each cell has n neighbours.
- **4 variables**: two orientations both appear in the course.
  - (a) First pair on rows, second pair on columns (L15 p19–31 with wx/yz; R07 p31; every tutorial answer and every exam key: T06 p2–3, AY23/24 S2 p19, AY24/25 p2, AY25/26 p2 and p12). Row 00 is m0 m1 m3 m2, row 01 is m4 m5 m7 m6, row 11 is m12 m13 m15 m14, row 10 is m8 m9 m11 m10.
  - Edge-label style: A beside rows 3–4, B beside rows 2–3, C over columns 3–4, D under columns 2–3.
  - (b) **The A,B,C,D examples in L15 p32–55 and R07 p32–47 put AB on the columns and CD on the rows.** I checked this against the cell values on L15 p33, p37, p39, p42, p43 and R07 p43. Cell (row CD, column AB) holds m(4∙AB + CD).
  - Corners wrap (m0, m2, m8, m10 form one group). Each cell has 4 neighbours (L15 p20).
- **5 variables** (L15 p21–22): two 4-variable maps drawn side by side, left = v' (m0–m15) and right = v (m16–m31). Each map has wx on rows and yz on columns; v is the MSB. Matching cells in the two maps are adjacent ("one on TOP of the other"). They are **not mirrored**; mirroring is only used for 6 variables (L15 p23–24).

**Grouping** (L15 p25–31)
- Group sizes are powers of 2. A group of 2^n cells removes n variables.
- Make groups as large as possible and use as few groups as possible.

**Definitions**
- **Implicant**: "a product term that could be used to cover minterms of the function" (L15 p34; R07 p37). Σm(1,2,3,5,7) has 11 implicants.
- **Prime implicant (PI)**: "a product term obtained by combining the maximum possible number of minterms from adjacent squares … the biggest grouping possible" (L15 p35).
- **Essential prime implicant (EPI)**: "a prime implicant that includes at least one minterm that is not covered by any other prime implicant" (L15 p36).
- **A group made only of don't-cares is not a PI.** Examples: L15 p49 (K∙L, M∙N), T06 F4 (A'∙C), AY23/24 S2 (C∙D), AY24/25 Q17 (B∙D).

**Minimal SOP algorithm** (L15 p38)
1. Circle all PIs.
2. Take all EPIs.
3. Add the fewest remaining PIs that cover the leftover 1s.

An answer of only EPIs is not always enough. AY23/24 S1 Q7(iv) is false for that reason.

**Minimal POS** (L15 p43–44; R07 p42)
1. Find the minimal SOP of F' by grouping the 0s.
2. Complement it with DeMorgan's law.

**Don't-cares** (L15 p46, p53)
- Treat each one as 1 or 0, whichever gives the simpler result.
- You never need to cover a don't-care (L15 p53: "Do we need A'B'? No").
- After the circuit is built, a don't-care input gets a fixed output. T06 Q4d: input 0000 gives XYZ = 001.

**"How many simplified SOP expressions"** (AY23/24 S2 Q19c)
- Count the distinct minimal covers (fewest terms, then fewest literals). Term order does not matter.
- Q19 has 3. The key lists 6 strings only because it shows two term orders for each.

## 3. Gates

- **Complete sets** (L14 p10–12): {AND, OR, NOT}, {NAND}, {NOR}.
- AY24/25 Q2 (key E): {OR, NOT}, {XOR, AND}, {NOR, AND} and {NAND} are all complete. {XOR, AND} only works because the constant 1 is always available (T06 p2).
- **2-input gates that can act as an inverter** (AY24/25 Q1, key D): XOR (a⊕1), XNOR (a⊙0), NOR (a NOR a).
- **NAND and NOR identities** (L14 p5): NAND = negative-OR and NOR = negative-AND (bubbled alternative symbols). Symbol sets: distinctive shapes, or IEEE boxes labelled `&`, `≥1`, `=1`, `1` (L14 p3).
- **2-level circuits**
  - SOP → AND-OR → NAND-NAND (L14 p13–14). A single-literal term enters the output NAND complemented (E becomes E').
  - POS → OR-AND → NOR-NOR (L14 p15–16).
  - **Inverters are not counted as a level, but they do count as gates** (R07 p14).
- **Default assumptions** (T06 p2): complemented literals are NOT available, and the constants 0 and 1 are.
- **Flip-flop Q' outputs are free**: AY23/24 S1 Q18(v) needs no inverter because B' comes from flip-flop B's Q' output.
- **Delay** (L17 p34): output time = max(input times) + t.
  - Full adder: S at 2t, C at 3t (p35).
  - n-bit ripple-carry adder: S_n = ((n−1)∙2+2)t and C_{n+1} = ((n−1)∙2+3)t, so the 4-bit adder gives S4 = 8t and C5 = 9t (p38).
  - AY23/24 S2 Q13: an XOR made of 4 NANDs is 3 levels deep, so at 3 ns per gate the delay is 9 ns (key C).
- **Positive/negative logic** is not taught as a topic. Only the negative-OR/AND symbols and active-high/low signals appear.

## 4. Combinational (L17)

- **Half adder**: C = X∙Y, S = X⊕Y (L15 p7–8; L17 p6–7).
- **Full adder** (p9–12): C = XY + XZ + YZ = XY + (X⊕Y)Z, and S = X⊕Y⊕Z, where Z is the carry-in. It is built from 2 half adders and an OR gate.
- **4-bit parallel (ripple-carry) adder** (p18–21): inputs X4..X1, Y4..Y1 and C1; outputs S4..S1 and C5. Bits are numbered from 1 here, while the tutorials number them from 0.
- **16-bit adder**: four 4-bit adders chained through C5, C9, C13 to C17 (p24).
- **BCD → Excess-3** (p16): W = A+BC+BD, X = B'C+B'D+BC'D', Y = CD+C'D', Z = D'. It can also be built as BCD + 0011 on a 4-bit adder (p22–23).
- **Magnitude comparator** (p30–33): unsigned A vs B, with outputs A<B, A=B, A>B.
  - x_i = A_iB_i + A_i'B_i'
  - (A=B) = x3x2x1x0
  - (A>B) = A3B3' + x3A2B2' + x3x2A1B1' + x3x2x1A0B0'
  - (A<B) is the same with the primes swapped.
  - **There are no cascade inputs.** "Cascading" means combining comparator outputs with gates, e.g. 3 ≤ ABCD ≤ 12 is (ABCD > 0010) AND (ABCD < 1101) (p33).
  - Tutorials draw the block as X3..X0 / Y3..Y0 with outputs X<Y, X=Y, X>Y.
- **6-person voting system**: 2 full adders plus a 4-bit adder (p29).

## 5. MSI (L18)

**Decoder** (p5–24)
- n inputs, up to 2^n outputs; output i is minterm m_i. S2 is the MSB, and the first variable goes to S2 (p13).
- **Enable**: a 1-enable decoder is active when E = 1, and all outputs are 0 when disabled (p15). A 0-enable is written E' or Ē, or drawn with a bubble (p16).
- **Active-low outputs** (R09 p19): output i = m_i' while enabled; all outputs are 1 when disabled.
- **0-enable with active-low outputs**: Y_i = E + (m_i)', i.e. E + M_i (R09 p58).
- **Four ways to build f = Σm(0,1,4,6,7) = ΠM(2,3,5)** (p23–24):
  - active-high outputs into OR(m0, m1, m4, m6, m7)
  - active-low outputs into NAND of those five
  - active-high outputs into NOR(m2, m3, m5)
  - active-low outputs into AND(m2', m3', m5')
- **Larger decoders** (p17–19; R09 p18):
  - 3×8 from two 2×4 decoders: w' drives the low decoder's E, w the high one's.
  - 4×16 from two 3×8 decoders.
  - 4×16 from five 2×4 decoders.
- The 74138 is active-low (p21–22, image only, not verified).

**Encoder** (p26–31)
- Assumes exactly one input is high.
- 4-to-2: D0 = F1+F3, D1 = F2+F3.
- 8-to-3: z = D1+D3+D5+D7, y = D2+D3+D6+D7, x = D4+D5+D6+D7.

**Priority encoder** (p32–33)
- The highest index wins (D3 in the 4-to-2 version).
- All-zero input gives f,g = X and V = 0. The valid bit V is 1 otherwise.
- The compact table uses X for "any value".
- [derived] f = D2+D3, g = D3 + D1∙D2', V = D0+D1+D2+D3.
- The T08 Q5 / AY24/25 8-to-3 version has **no V**, and an all-zero input gives XXX.

**Demultiplexer** (p35–36): Y_i = D∙m_i(S1,S0). It is identical to a decoder with D on the enable.

**Multiplexer** (p37–56)
- 2^n data inputs and n selects, with S1 as the MSB: Y = I0∙S1'S0' + I1∙S1'S0 + I2∙S1S0' + I3∙S1S0 = Σ I_i∙m_i.
- Quad 2:1 mux: E' = 1 gives all 0s; S = 0 selects A, S = 1 selects B (p41).
- 8:1 from two 4:1 muxes (S1 S0) feeding a 2:1 on S2 (p42), or from four 2:1 muxes on S0 feeding a 4:1 on S2 S1 (p44). The 16:1 is built from five 4:1 muxes.
- **n-variable function on a 2^n:1 mux**: variables go on the selects, 1/0 on the data lines (p48–49).
- **n-variable function on a 2^(n−1):1 mux** (p51–55):
  1. Reserve one variable, the LSB in the example.
  2. Put the other variables on the selects in order (A→S1, B→S0).
  3. Each data input is 0, 1, v or v'.
- When a don't-care allows it, prefer a constant over a literal (T08 Q1).
- Because complemented literals are not available, the choice of select variables matters (AY23/24 S1 Q10; AY23/24 S2 Q21a).

## 6. Sequential (L19)

**Latches and triggering**
- Latches are pulse/level-triggered; flip-flops are edge-triggered on the positive (0→1) or negative edge. `>` marks the clock input, and a bubble on it means negative edge (p8, p16–17). The bubble on Q' is only a labelling convention (R10 p21).
- **SR latch, active-high (NOR)** (p9–11): 00 = no change, 01 = reset, 10 = set, 11 = invalid (Q = Q' = 0). Q+ = S + R'Q, with S∙R = 0.
- **SR latch, active-low (NAND)** (p12, marked skippable): S = R = 0 is invalid and S = R = 1 means no change.
- **Gated SR latch** has an EN input (p13).
- **Gated D latch**: with EN = 1, Q+ = D; with EN = 0, no change (p14–15).

**Characteristic tables** (p18–23, p27)

| Flip-flop | Behaviour | Equation |
|---|---|---|
| SR | 00 = Q, 01 = 0, 10 = 1, 11 = ? | |
| JK | 00 = Q, 01 = 0, 10 = 1, 11 = Q' | Q+ = J∙Q' + K'∙Q |
| T | 0 = Q, 1 = Q' (J = K = T) | Q+ = T∙Q' + T'∙Q |
| D | Q+ = D | |

**Excitation tables** (p45)

| Q→Q+ | J K | S R | D | T |
|---|---|---|---|---|
| 0→0 | 0 X | 0 X | 0 | 0 |
| 0→1 | 1 X | 1 0 | 1 | 1 |
| 1→0 | X 1 | 0 1 | 0 | 1 |
| 1→1 | X 0 | X 0 | 1 | 0 |

Characteristic tables are used for analysis and excitation tables for design (p44).

**Asynchronous inputs** (p24–25)
- PRE = HIGH sets Q = 1 at once; CLR = HIGH clears Q = 0. Both LOW means normal operation.
- The p25 figure shows a JK with **active-low** PRE and CLR.

**State tables and diagrams** (p28–34)
- A and A+ denote present and next state.
- A full state table has 2^(m+n) rows, ordered in binary on (state bits, inputs), with present state and inputs on the left and next state and outputs on the right.
- A compact table has one row per state and one column per input value.
- State diagrams: one circle per state, arrows labelled `input/output`; m flip-flops give up to 2^m states.
- Flip-flop inputs are named like `JA` (input J of flip-flop A) (p36).
- The terms **Mealy and Moore are never used.** Outputs that depend only on the state appear as `/p` inside the state (T09 Q1) or in a separate output table (AY25/26 Q16).

**Design procedure** (p46)
1. Start from the state diagram or table.
2. Reduce states, then assign them.
3. Choose the flip-flop type.
4. Build the excitation table and use K-maps.
5. Draw the circuit.

**Unused states and self-correction**
- Unused states become don't-cares (p55–57). After committing to the equations, replace each d with its actual value (T09 Q2).
- **Self-correcting** (T09 Q2; R10 p40–43): if the circuit ever enters an unused state, it "is able to transit to a valid state after a finite number of transitions". The course reads this as *there exists* such a path: AY23/24 S1 Q18(viii) answers "Yes" even though state 3 loops on itself when x = 0.
- **Sink** (T09 Q1): a state that, once entered, is never left.

**Not taught**
- Counters, shift registers and registers are not taught; only parallel data transfer with D flip-flops (p20).
- Johnson and ring counters appear only in AY23/24 S2 Q14.

## 7. Ambiguities and differences between sources

1. The 4-variable K-map orientation differs between the L15/R07 ABCD slides (AB on columns) and the tutorial and exam keys (AB on rows). Make the orientation a setting.
2. The rule says always write `∙`, yet the slides and answer keys often leave it out ("AD + AC + B'D'").
3. **L15 p55 gives only one minimal POS, but there are two.** F' = BC'+BD'+B'D or B'D+BD'+C'D, so F = (B'+C)(B'+D)(B+D') or (B+D')(B'+D)(C+D').
4. The AY23/24 S1 key contradicts itself. The worked answers say Q17d = Σm(0,3,12,15), Q18 KB = x and 1 gate. The summary page says Σm(0,15), KB = B∙x and 2 gates. The guides (guides/Past Finals.md §4) take the worked answers as correct.
5. AY23/24 S2 Q20e accepts "NAND or OR" for KB = A'+C'. The OR version needs C', which is a complemented *external* input and is not available by default.
6. Async inputs: L19 p24 describes them as active-high, but the p25 figure shows them active-low.
7. Priority encoder: L18 has a V output and X outputs on all-zero input; the T08 / AY24/25 version has no V.
8. AY25/26 Q16 clarification: "X0 is MSB while X1 is LSB".
9. No source says whether inverters add propagation delay.
10. AY24/25 and AY25/26 MCQ answers are only printed in red. I recovered them by reading text colour.

---

## TEST FIXTURES

**K-maps**

| Function | PIs | EPIs | #min SOP | Expected minimal answer |
|---|---|---|---|---|
| L15 p37: Σm(0,1,2,5) in a,b,c | 3 | 2 | 1 | a'c' + b'c |
| L15 p37 / R07 p39: Σm(0,2,3,4,7,8,9,10,11,13,14) | 7 | 4 (A'C'D', A'CD, AC'D, ACD') | 3 | EPIs + any 2 of {B'D', B'C, AB'} |
| L15 p39–41: Σm(2,3,4,5,7,8,10,13,15) | 6 | 3 | 1 | BD + A'BC' + AB'D' + A'B'C |
| L15 p42 G = AY25/26 H: Σm(3,4,5,7,9,13,14,15) | 5 | 4 (BD not an EPI) | 1 | A'BC' + ACD... see note* |
| L15 p43: Σm(0,1,2,3,5,7,8,9,10,11) | — | — | — | POS (A'+B')(B'+D), from F' = AB + BD' |
| L15 p50–51: ABC + B'CD' + AD + B'C'D' | 4 | 3 | 1 | SOP AD + AC + B'D'; POS (A+B')(A+D')(B'+C+D) |
| L15 p53: Σm(2,8,10,15) + d(0,1,3,7) | 3 (A'B', BCD, B'D') | 2 | 1 | B'D' + BCD |
| L15 p47: Σm(3,5,6) + d(0,7) | — | — | — | AC + AB + BC |
| L15 p47: Σm(1,2,4) + d(0,7) | — | — | — | B'C' + A'B' + A'C' |
| L15 p49: F(K,L,M,N) = Σm(2,6,8) + d(3,7,11..15) | 3 (K'M, LM, KM'N') | 2 | 1 | K'M + KM'N' |
| R07 p36: Σm(1,3,6,7) | 3 | 2 | 1 | A'C + AB (BC removed by consensus) |
| T06 F1: Σm(5,8,10,12,13,14) | 3 | 2 | 1 | AD' + BC'D |
| T06 F2: ΠM(0,1,2,8,9,10) | 2 | 2 | 1 | X + YZ |
| T06 F3: Σm(1,7,10,13,14) + d(0,5,8,15) | 6 | 1 (LN) | 2 | LN + KMN' + K'L'M' or LN + KMN' + K'M'N |
| T06 F4: ΠM(4,8,9,11,12)∙D(2,3,6,7,10,14) | 4 | 2 | 1 | SOP A'B' + BD; POS (A'+B)(B'+D) |
| T06 Q3 T: Σm(0,1,2,4,5,9) + X(6,11,14,15) | 4 | 2 (A'D', A'C') | 2 | +B'C'D or +AB'D; POS (A'+D)(C'+D')(A'+B') |
| AY23/24 S2 Q19: ΠM(0,2,8,10,13)∙X(3,7,11,12,15) | 5 | 1 (B'D) | 3 | B'D + {A'B+BD', A'B+BC, A'D+BD'} |
| AY23/24 S1 Q17a: Σm(1,8,13) + d(0,2,5,9,10,15) | 4 | 0 | — | — |
| AY23/24 S1 Q17b: ΠM(5,7,8,10,13,15)∙d(0,2,3,4,9,14) | 4 | 2 | — | — |
| AY24/25 Q3/Q4: Σm(1,3,4,6,10,12) + x(2,5,7,13,14) | 6 | 2 | — | MCQ keys D and E |
| AY24/25 Q17a: Σm(0,1,4,6,9,11) + d(5,7,13,15) | 4 | 3 | 1 | SOP A'C' + A'B + AD; POS (A'+D)(A+B+C') |
| AY25/26 Q1: Σm(0,1,2,6,8,10,12) | 4 | 4 | — | — |
| AY25/26 Q17a H | 5 | 4 | — | POS (A'+B+C')(A'+C+D)(A+B+C)(A+C'+D) |
| AY21/22 S2 Q14c: Σm(0,4,6,8,9,10,12..15) | 5 | 5 | 1 | AB + C'D' + AC' + BD' + AD' (R08 p39) |
| [derived] AY20/21 S2 Q1–2: Σm(0,1,2,7,15) + x(3,9,11,12,13) | 4 | 2 | — | A'B' + CD |
| [derived] AY21/22 S1 Q5: Σm(3,10,11,15) + x(1,2,4,7,9,12,14) | 4 | 0 | 4 | — |
| [derived] AY21/22 S2 Q5: Σm(1,3,6,8,9,11,15) + x(7,14) | — | — | — | CD is the non-EPI |
| [derived] T07 SE3 (5 variables) | — | — | — | P = A'C'D' + B'C'D' + B'C'E'; Q = A'C'E' + B'D'; input 00100 gives PQ = 01 |

\*Correction to the row above: the minimal SOP for L15 p42 G / AY25/26 H is A'BC' + A'CD + ABC + AC'D.

**Algebra**
- ΠM(5,9,13) over (p,q,r,s) = p'q' + r + s' (T06 Q1b).
- (AB+C)(AC+B) = Σm(3,5,6,7) (AY25/26 Q12, key C).
- (x+y)(x+y')(x'+z) = xz.
- abc + abd + a'bc' + cd + bd' = b + cd.
- [derived] T06 SE2: F = Σm(0,2,4,6,7) and G = Σm(1,2,3,6) give F = ΠM(1,3,5), F+G = Σm(0,1,2,3,4,6,7), F∙G = Σm(2,6), F⊕G = Σm(0,1,3,4,7).

**Gates and combinational**
- AY23/24 S2 Q12: the 4-NAND circuit is XOR; Q13 delay = 9 ns.
- AY23/24 S1 Q6: divisible by 4 → NOR(G,H). Q8: B∙(A+C), one AND and one OR (key D).
- T07 Q5 comparator-only functions:
  - Σm(12–15) = ABCD > 1011
  - Σm(0,6,9,15) = (ABCD = DCBA)
  - Σm(0,1,6,7,8,9,14,15) = (B000 = C000)
  - Σm(odd except 15) = ABCD < DDDD
- AY24/25 Q7 (key D): ABCD < 9, A = D, and ABC = BCD all work. AY25/26 Q8 (key D): AD < BC and ABC < D.

**MSI**
- 2×4 decoder, 0-enable with active-low outputs, S1 = A, S0 = C, E = B, F = output 0 → F = A+B+C (AY24/25 Q6, key A).
- Same decoder type, E = C, S1 = A, S0 = B, AND of outputs 1 and 3 → (C+A+B')(C+A'+B') = B'+C (AY23/24 S2 Q21b).
- 3×8 decoder with active-high outputs, NOR of D1, D3, D6 → Σm(0,2,4,5,7) (AY25/26 Q11, key B).
- Single 1-enable 2×4 decoder: ABC and A'BC' are possible, A'B'C' is not (AY23/24 S1 Q9, key A).
- 4:1 mux for F(X,Y,Z) = ΠM(1,5,6)∙D(4) with selects XY → data inputs Z', 1, 0, Z (T08 Q1). [derived] With selects YZ → 1, 0, X', 1.
- Σm(0,1,3,6) with selects AB → 1, C, 0, C' (L18 p52–54).
- AY23/24 S1 Q10 (key B):
  - Σm(3,4,5,7) with selects AB → 0, C, 1, C.
  - Σm(0,2,6) with selects AC → 1, 0, B, 0.
  - Σm(0) is impossible without an inverter.
- AY23/24 S2 Q21a: F1 = Σm(0,2,3,5,6,7) → selects AC (or CA), data 1, B, B, 1.
- T08 Q2: K = Σm(8,11) = XNOR(Y,Z) driving E, with S1 = W, S0 = X, K = output 2.
- T08 Q4 / AY24/25 Q17b: G rows for AB = 00, 01, 10, 11 are 0, C'D + CD', D, 1.
- T08 Q5 / AY24/25 Q17c: H2 = A+B, H1 = A+B'C, H0 = 1. [derived] Wiring: F7 = A, F5 = B, F3 = C, F1 = 1.
- 16-to-4 encoder: Y = D2+D3+D6+D7+D10+D11+D14+D15 (AY23/24 S2 Q15, key D).

**Sequential**
- L19 Analysis Example 1: A+ = Ax + Bx, B+ = A'x, y = (A+B)x'.

  | State AB | x=0: next / y | x=1: next / y |
  |---|---|---|
  | 00 | 00 / 0 | 01 / 0 |
  | 01 | 00 / 1 | 11 / 0 |
  | 10 | 00 / 1 | 10 / 0 |
  | 11 | 00 / 1 | 10 / 0 |

- L19 Example 2: JA = B, KA = Bx', JB = x', KB = A⊕x. Next states for ABx = 000..111: 01, 00, 11, 10, 11, 10, 00, 11.
- L19 Example 3: JA = B, KA = B', JB = KB = (A⊕x)'. Next states: 01, 00, 10, 11, 00, 01, 11, 10; y = A⊕B⊕x.
- L19 Design Example 1 (JK): transitions 00 → 00/01, 01 → 10/01, 10 → 10/11, 11 → 11/00. Result: JA = Bx', KA = Bx, JB = x, KB = (A⊕x)'.
- L19 Design Example 2 (D): DA = Σm(2,4,5,6) = AB' + Bx'; DB = Σm(1,3,5,6) = A'x + B'x + ABx'; y = Σm(1,5) = B'x.
- L19 Example 3 (SR) [derived from the equations]: unused states go 0 → 1 or 2, 6 → 7 or 4, 7 → 1 or 4, so it is self-correcting (R10 p42–43).
- T09 Q1: p = AB + A'B', TA = AB', DB = A'+B. Transitions 0→1, 1→1, 2→0, 3→3. Starting from 0, after 3 clocks the state is 1 with output 100. Sinks: states 1 and 3.
- T09 Q2: JA = B⊕x, KA = 1, JB = A⊙x, KB = 1 (2 gates). Unused state 3 goes to 0 on x = 0 or 1, so it is self-correcting.
- T09 Q3 (AY18/19):
  - DA = AB' + AC' + A'BCD, TB = C, TC = A'+B'+C', JD = BC, KD = ABC.
  - [derived] Cycle 1→3→5→7→9→11→13→15→2→4→6→1.
  - [derived] Unused states: 0→2 and 8→10→12→14→3. Self-correcting.
- T09 Q4: DA = A + y + Bx; DB = Bx' + B'x + Ay + Ax (or + AB).
- AY23/24 S1 Q18a: next states of 0..3 are 2, 1, 3, 3.
- AY23/24 S1 Q18b: JA = B'x, KA = 0, JB = 0, KB = x. From state 3: x=0 → 3, x=1 → 2. Self-correcting: Yes.
- AY23/24 S2 Q20: JA = 1, KA = 0, JB = C, KB = A'+C' (1 gate). From state 0: C=0 → 2, C=1 → 3.
- AY23/24 S2 Q14: the 4-D circuit is a Johnson counter: 1→0→8→12→14→15→7→3→1. The ring counter would be 1→8→4→2.
- AY24/25 Q16: JA = B, KA = 1, JB = AC, KB = 0, DC = A+B. Transitions 2→7, 3→7, 5→3, 6→3, 7→3, 4→1, 1→0, 0→0. Not self-correcting. T-flip-flop redesign: TA = 1, TB = B', TC = C' (0 gates).
- AY25/26 Q16: A+ = B∙X0'∙X1, B+ = A'B'X0X1, G = A. Q13: a JK with J and K tied together is a T flip-flop.
- AY15/16 S1 Q7: JA = BC, KA = 0, TB = A'C, DC = A+C'. Sequence 0→1→2→3→4→5→5; 6→7→7. Not self-correcting (R10 p61–63).
- [derived] T09 SE1, starting at A with input 100010: output 101100, states A, C, B, D, D, C.

---

I didn't cover the 6-variable map (out of the 2–5 variable scope), the 74138/74151A pages (scanned images; the 74138 pin details here are general knowledge, not checked against the slide), the L16 Quine-McCluskey content, or AY23/24 S2 Q21c–e, whose answers depend on circuit diagrams I could not read. The biggest risk for the app is the two K-map orientations in section 2: a fixed layout will silently put minterms in the wrong cells for either the lecture examples or the exam keys.