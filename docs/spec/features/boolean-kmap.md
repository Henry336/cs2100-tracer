# Feature sweep: boolean-kmap

Raw research output. Priority 1 = high exam value or high confusion.

## Features (23)
### [1] K-map Studio: step-through minimal SOP solver
- Module: L15 Simplification (K-maps)
- Sources: L15 p12-31, p34-42, p45-55; R07 p31-47; T06 SE3, Q2, Q3; every recent final (Past Finals guide s2: 'K-map: #PIs, #EPIs, SOP, POS | every paper')
- Inputs: 2-5 variables with custom names (A-D, W-Z, K-N, P-S, a-c). Function given as Σm(..)+d(..), ΠM(..)·D(..), a truth table, or an expression. Or click cells to cycle 0/1/X.
- Shows: Step 1: fill the map. Each cell shows its m-index faintly. Step 2: draw every PI as a coloured loop, one at a time. Wrap-around and four-corner loops are drawn as split loops. Each loop gets a derivation: which variables stay constant gives the product term, and literals = n - log2(group size). Step 3: count the PIs covering each 1-cell. A 1 covered by exactly one PI glows as that PI's 'reason cell', and the PI is marked EPI. Step 4: grey out the 1s covered by EPIs, show the leftover 1s, and enumerate the minimum PI subsets. Lists every alternative minimal SOP and how many there are. The final answer is printed in course notation.
- Aha: A PI is a group that cannot grow. An EPI is a PI that some 1 depends on. A large PI can still be redundant (B∙D on L15 p42). Wrap-around groups are as real as interior ones.
- Verify use: Paste a tutorial or exam function and compare #PIs, #EPIs, number of minimal SOPs (AY23/24 S2 Q19c asks exactly this) and the expression itself, e.g. T06 Q2-Q3, AY24/25 Q3-4, Q17a, AY25/26 Q17a.
- Conventions: 4-var layout: rows AB, cols CD, both in 00 01 11 10. Row 00 is m0 m1 m3 m2, row 01 is m4 m5 m7 m6, row 11 is m12 m13 m15 m14, row 10 is m8 m9 m11 m10 (L15 p19). 3-var: row a, cols bc (L15 p16). The first variable is the MSB of the index (L13 p21). Groups have 1/2/4/8.. cells, are rectangles and may wrap; 2^k cells eliminate k variables (L15 p25, p30-31). A group of only X's is not a PI (L15 p49, T06 Ans p2, p5). X's need not be covered (L15 p53, R07 p46). Algorithm: all PIs, then all EPIs, then the minimum remaining PIs (L15 p38). Always write ∙ (L13 p6, T06 p2). FITB format: literals alphabetical within each term, EPIs first, ' for NOT (AY23/24 S2 Q19d; AY24/25 and AY25/26 Q17 headers).

### [1] Umbrella view / PI cover chart (why a PI is essential)
- Module: L15 (with L16 underpinning)
- Sources: R07 p35-41 ('Umbrellas' demo p36); L15 p34-37; L16 p7-8, p12-13; T06 Ans p5 (PI chart for T)
- Inputs: Same function as the K-map Studio, or click 'explain EPIs' from it.
- Shows: A chart with PIs as rows and minterms as columns; don't-care columns are greyed and kept separate, as in T06 Ans p5. A dot marks each PI that covers a minterm. Columns with a single dot light up and their row becomes an EPI. Then the reduced chart appears once the EPIs and the minterms they cover are removed. A linked K-map shows each PI as an 'umbrella' over its 1s; hovering a 1 lights every umbrella over it. Also includes an implicant ladder: all implicants, then PIs, then EPIs (R07 p37: 11 implicants, 2 PIs for Σm(1,2,3,5,7)).
- Aha: Essential is a property of a column (a minterm), not of the group's size. The consensus term B∙C in A'∙C + A∙B + B∙C is the redundant umbrella (R07 p36).
- Verify use: Settles 'how many EPIs' MCQs (AY20/21 Q2, AY21/22 S1 Q5, AY21/22 S2 Q5 'which is not an EPI', AY25/26 Q1).
- Conventions: Only true minterm columns decide essentiality, not don't-care columns (T06 Ans p5: 'Look under the minterms columns'). Q-M is non-examinable (L16 p1), so label the chart as the mechanism under K-maps (T06 p2 recommends it for EPIs).

### [1] K-map answer checker and FITB linter
- Module: L15 / L13 notation
- Sources: T06 p2 and T06 Ans p1 (zero marks for xy instead of x∙y); AY23/24 S2 Q19d format rules; AY24/25 Q17, AY25/26 Q17 ('literals ... in alphabetical order'); L15 p34-38
- Inputs: Function plus the student's claimed #PIs, #EPIs, number of minimal SOPs, and SOP/POS text.
- Shows: Checks equivalence on the care set and lists the rows that differ. Says whether each term is an implicant, whether it is prime, and whether the whole expression is minimal (terms and literals vs the optimum). Reports which PI/EPI counts are wrong and the missed or extra PIs. Lint: a missing ∙ ('AB' reads as a 2-bit value), literals out of alphabetical order, EPIs not first, a term covering only X's, a POS that is not a product of sum terms.
- Aha: An equivalent expression can still be marked wrong if it is not minimal or breaks the notation.
- Verify use: Directly marks your answer to any K-map part of T06 Q2-Q3 or past-paper Q17/Q19 before you check the key.
- Conventions: Write ∙ always (L13 p6, R07 p7). Constants 0/1 count as valid SOP/POS (T06 p2). Alphabetical literals and EPIs first (AY23/24 S2 Q19d).

### [1] POS via the F' map (group the 0s, then DeMorgan)
- Module: L15
- Sources: L15 p43-44, p54-55; R07 p42-43, p47; T06 SE4, Q2(d), Q3(g); AY24/25 Q17a(iii), AY25/26 Q17a(iii)
- Inputs: Any function, including don't-cares.
- Shows: Animates swapping 1s and 0s to get the map of F'. X's stay X. Solves F' with the same PI/EPI stepper, then shows the DeMorgan steps term by term: (B∙D')' becomes (B'+D). Lists all alternative POS answers. Option to read the POS directly off the 0-groups, with maxterm literal polarity explained.
- Aha: POS is just SOP of the complement, flipped back. Each 0-group gives a sum term whose literals are complemented relative to the cell bits.
- Verify use: Check T06 SE4 (no key), T06 Q3(g) = (A'+D)(C'+D')(A'+B'), and the past-paper POS parts.
- Conventions: X's are unchanged on the F' map (R07 p47, L15 p55). The algorithm is three steps: SOP of F', complement, result is POS (R07 p42). Sum terms go in parentheses; ∙ between them is optional, as the slides omit it in POS (L15 p44).

### [1] Don't-care fate inspector (what the built circuit really outputs)
- Module: L15
- Sources: T06 Q4(d) (key: input 0000 gives XYZ = 001); T07 SE3 (input 00100); L15 p45-49; R07 p44-45
- Inputs: A function with a d-set, and the chosen minimal SOP or POS (taken from the Studio).
- Shows: Each X cell is recoloured with the value the chosen cover gives it: 1 if inside a chosen SOP group, else 0 (or the POS equivalent). Lists the outputs for every 'impossible' input, and shows that SOP and POS realisations, or alternative minimal covers, can give different values.
- Aha: Don't-cares are only free at design time. Once the circuit exists, an 'invalid' input produces a definite and possibly surprising output.
- Verify use: Answers 'what is the output if the circuit is fed 0000 / 00100' questions (T06 Q4d, T07 SE3).
- Conventions: X/d/D all mean don't-care (L15 p45-46; T06 SE3). Use X only where it helps (L15 p46).

### [1] Canonical forms and set-operation converter
- Module: L13 Boolean Algebra
- Sources: L13 p14-15, p19-25; R07 p15-20; T06 SE2, Q1(b), Q2(d), Q3(b); AY25/26 Q12, Q17a (H = F∙G); AY23/24 S2 Q19 (ΠM∙X notation)
- Inputs: Σm / ΠM / truth table / expression, each optionally with d / D / X. Up to two functions F and G.
- Shows: A truth table with highlighted rows, plus the Σm list, ΠM list (complement index set), F', F+G (union), F∙G (intersection) and F⊕G (symmetric difference), each also shown as overlaid K-maps. Converts ΠM(..)∙D(..) to Σm(..) + d(..), removing don't-care indices from both lists. Shows why: F2' = m0 + m2 + m3, so F2 = m0'∙m2'∙m3' = M0∙M2∙M3 (L13 p25).
- Aha: Σm and ΠM are the same truth table read from the 1s or the 0s, and m_i' = M_i.
- Verify use: T06 SE2 (no key), T06 Q3(b), the first step of every 'ΠM(..)∙D(..)' K-map question, and AY25/26 Q17a (G to Σm, then H = F∙G).
- Conventions: Σm lists rows where F = 1; ΠM lists rows where F = 0 (L13 p23-24). Ranges like Σm(1,4-7) are allowed (L13 p23). Sum-m/Prod-M ASCII forms are accepted (T06 SE2 note). The don't-care symbol is d, D or X (T06 SE3).

### [1] Truth-table equivalence prover and counterexample finder
- Module: L13
- Sources: L13 p7-8 (proof by truth table), p14 (F3 = F4); R07 p51 Quiz Q2 (counterexample x=y=z=0); AY20/21 Q6; AY25/26 Q12
- Inputs: Two expressions, or an expression vs a Σm list.
- Shows: Builds the truth table column by column, one column per subexpression as in L13 p7-8. LHS and RHS columns sit side by side. The first mismatching row is highlighted as a counterexample, with the evaluation traced through the parse tree.
- Aha: One row is enough to disprove an identity, while proving one needs all 2^n rows (or algebra).
- Verify use: Checks any algebra or MCQ 'which is equivalent' answer.
- Conventions: Precedence: NOT, then AND, then OR (L13 p9). Inputs are listed in binary order (L13 p7).

### [1] Algebraic simplification step checker with law tags
- Module: L13 / L15
- Sources: L13 p10-13; L15 p4-6 (6 to 2 and 13 to 3 literal examples); T06 Q1 ('Indicate the law/theorem used at every step'), T06 Ans p1; R07 p29, p51-53; R08 p31; AY25/26 Q12 key derivation
- Inputs: A chain of expressions. Each step cites a law from a dropdown: identity, complement, commutative, associative, distributive (both forms), idempotency, one/zero element, involution, absorption 1, absorption 2, DeMorgan, consensus.
- Shows: For each step: equivalence by truth table, whether the cited law's pattern actually matches the rewrite (with the matched sub-terms highlighted), and the literal count after the step. An invalid step is flagged with a counterexample. Hint mode suggests applicable laws (absorption 2 and consensus first).
- Aha: Most textbook reductions are absorption 2 or consensus in disguise. The T06 SE1 mistake, using X + X' = 1 on A∙B + A'∙B', is caught as a pattern mismatch.
- Verify use: Self-mark T06 Q1(a), which has no key, and Q1(b), whose key is p'∙q' + r + s'. Also the R07 quizzes and R08 p31.
- Conventions: Law names and forms as on L13 p10, p12 and R07 p8. The distributive law has an OR-over-AND form, A+(B∙C) = (A+B)∙(A+C) (L13 p10). Aim to minimise literals, then terms; L15 p4 notes the two can conflict.

### [1] Circuit sketcher and live simulator (expression to circuit, circuit to expression)
- Module: L14 Logic Circuits
- Sources: L14 p3-9; R07 p3-7, p55; T06 Q3(h), T06 Ans p4; AY23/24 S2 Q12; AY23/24 S1 Q8; AY17/18 Q1c(i)
- Inputs: An expression (auto-draws a circuit) or a drag-and-drop circuit. Toggles: complemented literals available (default off), max fan-in (e.g. 2-input only), symbol set.
- Shows: A tidy auto-layout with straight wires and solid dots at forks. Each wire is labelled with its sub-expression, reproducing the L14 p9 analysis ((A'∙B')+C)' = (A+B)∙C'. Inputs can be toggled with 0/1 colouring flowing through the wires. Also shows the truth table, gate count (inverters included), level count (inverters excluded), and a 'this equals a single gate' detector.
- Aha: An analysed circuit is just its expression tree. A tangle of 4 NANDs can be a single XOR (AY23/24 S2 Q12).
- Verify use: Check 'which single gate' and 'smallest equivalent circuit' MCQs, and T06 Q3(h) gate counts.
- Conventions: Every input must be connected (L14 p7). A solid circle marks wires that join (L14 p8). Neat straight lines, thick dots for forks (T06 Ans p4). Complemented literals are not available by default; constants 0/1 are (T06 p2, T07 p2, R08 p34). Inverters are not a 'level' but do count as gates (R07 p14). Fan-in = number of inputs (L14 p7).

### [1] Universal-gate converter (NAND/NOR, bubble pushing, completeness)
- Module: L14
- Sources: L14 p5 (NAND = negative-OR, NOR = negative-AND), p10-16; R07 p5, p14, p22; T06 Q3(h); AY23/24 S1 Q7(ii); AY24/25 Q1, Q2
- Inputs: An SOP or POS expression, or an AND/OR/NOT circuit. A gate set to test for completeness.
- Shows: Animated conversion: AND-OR, then add bubble pairs, then NAND-NAND; OR-AND to NOR-NOR in the same way. A lone literal E feeds the output gate as E'. Complemented inputs come from NAND or NOR inverters when literals are unavailable. Shows NOT/AND/OR built from NANDs (1, 2 and 3 gates) and from NORs (NOT 1, OR 2, AND 3) with the algebra from L14 p11-12. A completeness checker (assuming constants 0/1) shows that {XOR, AND} is complete because a XOR 1 = a'. An inverter checker covers XOR with 1, XNOR with 0, NOR with a tied or 0 input, and NAND with a tied input.
- Aha: NAND-NAND is the AND-OR circuit with bubbles added in pairs. Universality falls out of DeMorgan plus involution.
- Verify use: AY24/25 Q1 = D, Q2 = E, AY23/24 S1 Q7 = B; T06 Q3(h) NAND-only circuit.
- Conventions: Two-level counting convention (R07 p14). Constants 0/1 available (T06 p2). XNOR = (A⊕B)' (L14 p6).

### [1] Propagation-delay timeline and critical path
- Module: L14 (reading) / R08 circuit delays
- Sources: L14 p17 (DLD 4.5 reading); L17 p34-38; R08 p24-28; R07 p56 Quiz Q2; R08 p32 Quiz Q2-Q3; AY17/18 Q1c(ii) (NAND fan-in n has delay n∙t); AY23/24 S2 Q13
- Inputs: A circuit (from the simulator), plus per-gate delays: uniform t, per gate type, or fan-in dependent (n∙t). Input arrival times default to 0.
- Shows: Each gate output gets the label max(input stable times) + gate delay, computed level by level. The critical path is highlighted, with a Gantt-style timeline. A ripple-carry adder mode has an n slider showing S_i and C_i+1 times against the formulas.
- Aha: Delay is set by the latest-arriving input, not by the gate count. Ripple carry grows by 2t per bit.
- Verify use: AY23/24 S2 Q13 (9 ns), AY17/18 Q1c(ii), R08 full-adder and 4-bit adder numbers.
- Conventions: Output stable at max(t1..tn) + t (R08 p24). In the full adder with all gates delay t, S = 2t and C = 3t (R08 p25). n-bit ripple adder: Sn = ((n-1)∙2+2)t, Cn+1 = ((n-1)∙2+3)t, max delay ((n-1)∙2+3)t (R08 p28).

### [1] Single magnitude-comparator function finder
- Module: T07 / R08 (combinational blocks)
- Sources: T07 Q5, T07 Ans p6; R08 p20-22, p39; AY24/25 Q7; AY25/26 Q8; AY21/22 S2 Q14c(iii); AY15/16 Q8 and AY16/17 Q2a (2-bit comparator variants); Past Finals guide s2 (recurring MCQ)
- Inputs: A 4-variable function as Σm or ΠM. Device: 4-bit or 2-bit comparator. Allowed sources: {A,B,C,D,0,1}.
- Shows: Exhaustive search over wirings into X3..X0 and Y3..Y0 (1296 distinct 4-bit input vectors per side, about 1.7M pairs, under a second in JS) and the output choice X<Y, X=Y or X>Y. Returns one or all solutions, each verified on the truth table, or 'impossible' with proof by exhaustion. Pattern hints: equal bit groups use X=Y, thresholds use a constant with X<Y, and appending 1 on X and 0 on Y turns ≥ into >.
- Aha: Any 'equality of two bit-groups' or 'threshold' function is free. Only 1656 of the 65536 4-var functions are reachable with one 4-bit comparator.
- Verify use: Settles the recurring 'which can be built with one comparator, no gates' MCQ (AY24/25 Q7 = D, AY25/26 Q8 = D) and T07 Q5.
- Conventions: No extra gates; constants allowed, complemented literals not (T07 p2). Comparator ports X3..X0, Y3..Y0 with outputs X<Y, X=Y, X>Y (T07 p4).

### [2] Grouping sandbox (draw your own loop)
- Module: L15
- Sources: L15 p25-31 (valid/invalid groupings), p35-36; R07 p33-34, p37
- Inputs: Drag over cells to propose a group.
- Shows: Live checks: is the size a power of 2, is it a rectangle allowing wrap and corners, does it avoid 0 cells, does it contain at least one 1. Reports whether it is an implicant and whether it is prime (can it double in any direction?). Shows the resulting product term with the eliminated variables struck out, and the algebra behind it (e.g. m10 + m14 = A∙(B'+B)∙C∙D' = A∙C∙D', R07 p32).
- Aha: Grouping is repeated use of A + A' = 1 (the unifying theorem, L15 p25), so a group of 3 or an L-shape cannot simplify.
- Verify use: Self-check your hand groupings before trusting a count.
- Conventions: Sizes 1, 2, 4, 8, 16. 'Group as many cells as possible; select as few groups as possible' (L15 p26). Fill every cell with 0/1/X in practice (R07 p34 note).

### [2] Adjacency and custom-layout explorer
- Module: L15
- Sources: L15 p9-11 (Gray order), p13-14 (alternative 2-var layouts/labels), p16 ('Other arrangements ... may also be used'), p17, p20; R07 p31-32; T06 Q3(a) (non-standard layout)
- Inputs: n, the variables on rows and columns, and their order (any permutation, or reversed labels as in L15 p14).
- Shows: The m-index of every cell for that layout. Hovering a cell lights its n neighbours, including wrap-around neighbours, with the differing literal named. A quiz mode asks you to place m1-m15 in a given layout (T06 Q3a). Explains why columns run 00 01 11 10.
- Aha: Adjacency means 'differs in exactly one bit'. The grid is only a drawing aid, so any layout that keeps that property works.
- Verify use: Check T06 Q3(a) placements, and the neighbour facts: m0 has m1, m2, m4, m8; m14 has m6, m15, m10, m12 (R07 p31).
- Conventions: Each n-variable cell has n neighbours (L15 p17). 4-var maps have 2 wrap-arounds (L15 p20). Gray ordering is used only as K-map ordering, since number-conversion tools are out of scope.

### [2] 5-variable stacked map
- Module: L15
- Sources: L15 p21-22; T07 SE3 ('tests ... 5-variable K-maps'); R07 p61 / R08 p34 past-paper lists
- Inputs: A 5-variable function (Σm/d over m0-m31).
- Shows: Two 4-variable maps side by side: v' (m0-m15) and v (m16-m31). An overlay/flip animation stacks one map on the other, so corresponding cells visibly become adjacent. A group spanning both maps is drawn as a linked pair of loops, and its term drops v.
- Aha: A 5-var map is a 4-var map with a second floor. Matching cells on the two floors are neighbours.
- Verify use: T07 SE3 (P, Q with don't-cares) has no key; the tool is the only check.
- Conventions: Each cell has 5 neighbours (L15 p21). Left map = first variable 0 (L15 p22 labels v' and v).

### [2] Minterm/maxterm term-index translator and drill
- Module: L13
- Sources: L13 p19-21 (quiz), R07 p15-16; L13 guide trap 'maxterm polarity reversed'
- Inputs: A term (e.g. A∙B'∙C∙D' or A'+B+C+D') or an index with n.
- Shows: The bit pattern under each variable, then the polarity rule. For a minterm, a 0 bit gives a primed literal. For a maxterm, a 0 bit gives a plain literal. Also the truth-table row where the term is 1 (minterm) or 0 (maxterm). Flashcards use the L13 p21 quiz.
- Aha: M_i is 0 on exactly one row (row i). Its literals are 'whatever makes each literal 0' there.
- Verify use: Drill for MCQs and for converting answers into Σm/ΠM lists.
- Conventions: With F(A,B,C,D), A is the MSB, so A'∙B'∙C∙D = m3 and A+B+C'+D' = M3 (L13 p21).

### [2] SOP / POS / canonical classifier
- Module: L13
- Sources: L13 p16-18 (quiz), R07 p10-13 (poll), AY23/24 S1 Q7(iii)
- Inputs: Any expression.
- Shows: A parse tree with each node tagged as literal, product term, sum term or other. Verdict on SOP, POS, canonical SOP and canonical POS, highlighting the subexpression that breaks each form (e.g. (W'+Y∙Z) inside a product).
- Aha: A single literal, or a single product of literals, is both SOP and POS. Being POS does not make an expression product-of-maxterms.
- Verify use: Checks the L13 p18 and R07 p12 quizzes and the true/false statements in MCQs.
- Conventions: Definitions on L13 p16-17. Constants 0/1 are degenerate SOP and POS (T06 p2).

### [2] Laws, duality and complement playground
- Module: L13
- Sources: L13 p10-13, p11 (duality, 'Do not confuse duality with negation!'), p15 (complement function); R07 p8
- Inputs: Pick a law, or type an equation or a function.
- Shows: The dual (swap ∙ and +, swap 0 and 1, literals unchanged) next to the complement (DeMorgan plus flipping every literal). A truth-table check shows the dual identity also holds while the complement is a different function. A cell-highlight view shows each law on a small K-map.
- Aha: Duality gives a free theorem ('two for the price of one'). Negation gives a different function.
- Verify use: Quick check of dual forms quoted in proofs, e.g. citing X∙(X+Y) = X from X + X∙Y = X (L13 p13).
- Conventions: L13 p11 examples: dual of a+(b∙c)=(a+b)∙(a+c) is a∙(b+c)=(a∙b)+(a∙c); dual of x+1=1 is x∙0=0.

### [2] Precedence and parse-tree viewer
- Module: L13
- Sources: L13 p6, p9; R07 p4, p7
- Inputs: An expression as typed.
- Shows: The fully parenthesised form and an expression tree. Warns on implicit AND (juxtaposition such as AB) and on CS1231-style precedence assumptions.
- Aha: A∙B + C is unambiguous here because AND binds tighter than OR.
- Verify use: Catches misread questions before solving.
- Conventions: NOT, then AND, then OR, which differs from CS1231 (L13 p9). Write ∙ (L13 p6).

### [2] Gate-free rewiring visualizer (shifts and constants)
- Module: T07
- Sources: T07 SE1, Q3, Q4 and 'Tutorial 7 - Answer Q4' p2-7; AY24/25 Q5; R08 p16-17
- Inputs: A mapping such as k∙x + c, a BCD-digit formula like 51A + 20(B%2), or a code offset (excess-3 to excess-11).
- Shows: Bit lanes drawn as wires. Multiplying by 2^k slides wires along, and constant bits are tied to 0 (GND) or 1 (Vcc). The 5A/50A/51A build-up of the T07 Q4 animation is reproduced. When a mapping would need a carry between occupied bits, the clash is highlighted to show a gate or adder is needed.
- Aha: Shifting is free in hardware; you just move the wires.
- Verify use: T07 SE1 (no key), T07 Q3 (no key, but AY24/25 Q5(iii) gives F = 1A2A1A0), T07 Q4, AY24/25 Q5 (answer C).
- Conventions: Inputs 0/1 are GND/Vcc in the lab (R08 p17). BCD digits are valid only for 0-9 (R08 p7).

### [2] Multi-output design workbench (spec to truth table to K-maps to circuit)
- Module: L15 / R08 gate-level design
- Sources: R08 p6-9 (BCD to excess-3); AY25/26 Q17b (BCD to 7-segment, table given); T06 Q4 (X, Y, Z comparator outputs); T07 SE3; L15 p45 (FG sum example)
- Inputs: A word spec chosen from presets, or a truth table with several outputs and don't-care rows.
- Shows: Each output's K-map side by side with its PI/EPI solution. Highlights product terms shared across outputs, then draws the combined circuit with gate count.
- Aha: Invalid codes (10-15 for BCD) become don't-cares that shrink every output at once.
- Verify use: R08 p9 equations, AY25/26 Q17b(i)-(v), T06 Q4(c).
- Conventions: Fill all cells in practice (R08 p9 note). Don't-cares 10-15 for 4-bit decimal codes (T07 Ans p4 note).

### [3] Quine-McCluskey tabulator (optional, non-examinable)
- Module: L16 Quine-McCluskey
- Sources: L16 p1-13; T06 p1-2 and T06 Ans p5; R07 p48
- Inputs: Any function with don't-cares.
- Shows: Minterms grouped by number of 1s, then pairwise combination into dash codes (e.g. 2,3: 001-), with ticks. The unticked entries are the PIs, with all-X ones dropped. Then the PI chart and reduced PI chart, synchronised with the K-map loops.
- Aha: K-map loops are this table drawn as geometry. 'Single-dot column' is the formal EPI test.
- Verify use: Cross-check of EPI decisions. Never needed in past papers (Past Finals guide s3).
- Conventions: Must be labelled 'non-examinable' (L16 p1). A PI that contains only don't-cares is dropped (L16 p11, T06 Ans p5).

### [3] PLA / ROM mapper
- Module: L14
- Sources: L14 p19-23; R07 p23-25; L14 p21 and R07 p24 (MIPS control unit as PLA)
- Inputs: Several SOP outputs, or the MIPS control truth table preset.
- Shows: AND plane (product terms) and OR plane (outputs) with burned connections, and a count of shared product terms. A ROM view shows the fully decoded 2^n rows. A demo shows a PLA running out of product terms.
- Aha: A PLA is literally a 2-level SOP circuit with programmable wires. A ROM can store any mapping because it decodes every minterm.
- Verify use: Concept check only; no past-paper question found.
- Conventions: AND gates are product terms, OR gates are outputs (L14 p19). The ROM is fully decoded (L14 p23).

## Misconceptions and traps (surface as callouts)
- A∙B + A'∙B' = 1 is wrongly 'derived' from X + X' = 1. The second term must be the complement of the first: (A∙B)' = A'+B', not A'∙B'. A∙B + (A∙B)' = 1 is correct. (T06 SE1(a)(b))
- Omitting the ∙ operator: writing AB instead of A∙B reads as a 2-bit value. 'Marks will be deducted', and the answer key says 'will receive zero mark'. (L13 p6; T06 p2; T06 Ans p1; R07 p7)
- AND has higher precedence than OR in CS2100, unlike CS1231/CS1231S. (L13 p9; R07 p4)
- Duality is not negation. The dual swaps ∙/+ and 0/1 but keeps the literals as they are. (L13 p11)
- Maxterm literal polarity is the reverse of the minterm's. M2 on (x,y) is x'+y, while m2 = x∙y'. (L13 p20; guides/L13 traps)
- A single literal (or constant) is both SOP and POS. Expressions like X∙(W'+Y∙Z) and W∙X'∙Y + V∙(X∙Z+W') are neither. (L13 p17-18; R07 p11-13; T06 p2)
- Not every POS is a product of maxterms (canonical POS needs every variable in every sum term). (AY23/24 S1 Q7(iii) (false; answer B))
- Complemented literals are NOT available unless stated, so you need inverters (or NAND/NOR inverters) for x'. Constants 0 and 1 are always available. This applies to all later tutorials and the final. (T06 p2; T07 p2; R08 p34; AY24/25 Q17, AY25/26 Q17 headers)
- Inverters do not form a 'level' in 2-level circuits, but they are still gates. Count them when asked for the number of gates. (R07 p14)
- In SOP to 2-level NAND conversion, a lone literal term (E in A∙B + C'∙D + E) must enter the output NAND complemented (E'). The same applies to POS to NOR. (L14 p14, p16; guides/L14 traps)
- Every input must be connected in a working circuit. Junctions need a solid dot. (L14 p7-8; T06 Ans p4)
- Group sizes must be powers of two and rectangular, possibly wrapping. The four corners of a 4-var map form one group (m0, m2, m8, m10). (L15 p25, p31; guides/L15 traps)
- A PI can still be redundant. On L15 p42, B∙D is a PI but every other PI is essential and B∙D is not needed. (L15 p42; R07 p41)
- A group consisting only of don't-cares is not a PI: K∙L and M∙N on L15 p49, A'∙C in T06 Q2(d), C∙D in AY23/24 S2 Q19, B∙D in AY24/25 Q17a. (L15 p49; T06 Ans p2, p5; AY23/24 S2 Ans p19; AY24/25 Ans p14)
- You do not need extra terms to cover leftover X's. A'∙B' is not needed in Σm(2,8,10,15)+d(0,1,3,7). (L15 p53; R07 p46)
- Students are weak at identifying EPIs. An EPI must cover a true minterm (not a don't-care) that no other PI covers. (T06 p1-2; T06 Ans p1, p5)
- Taking only the EPIs does not always give the simplest SOP. Uncovered minterms may need non-essential PIs (step 3), and there can be zero EPIs (AY23/24 S1 Q17a, AY21/22 S1 Q5). (L15 p38; AY23/24 S1 Q7(iv) (false); AY23/24 S1 Ans Q17a)
- Don't-cares are fixed once the circuit is built. The T06 Q4 circuit fed the 'impossible' 0000 outputs XYZ = 001, not the 'true' comparison results. (T06 Q4(d), T06 Ans p6)
- When converting ΠM(..)∙D(..) to Σm, the don't-care indices must be left out of the minterm list: T = Σm(0,1,2,4,5,9) + X(6,11,14,15). (T06 Q3(b), T06 Ans p3)
- There can be several minimal answers, and questions ask for all of them (or how many). The slides sometimes show only one. (T06 SE3 ('List out all alternative answers'); AY23/24 S2 Q19(c); L15 p55 (an alternative POS exists, see worked examples))
- Minimising literals and minimising terms can conflict; the lecture focuses on reducing literals. (L15 p4)
- x'∙(y+z)' and x'∙(y+z) are different functions (counterexample x=y=z=0). (R07 p51 Quiz Q2)
- {XOR, AND} is a complete set because constant 1 is available (a XOR 1 = a'), and {OR, NOT} is complete via DeMorgan. All four sets in AY24/25 Q2 are complete (answer E). OR cannot act as an inverter, but XOR, XNOR and NOR can (AY24/25 Q1 = D). (AY24/25 Ans p2; past-finals inventory (red MCQ letters))
- The correct count may not be an option. AY24/25 Q4 has 2 EPIs, which is not among A-D, so the answer is E. (AY24/25 Ans p2-3; past-finals inventory note 5)
- Inverter-only shorthand in diagrams: unfilled K-map cells in slides are 0s for illustration only. In practice every cell must be filled. (R07 p34; R08 p9)
- The half adder's S is simplified to X⊕Y, which is no longer SOP form. (L15 p8; R07 p30)
- The third-party Finals Notes cheat sheet has errors. Its maxterm table writes M0 = X.Y (should be x+y), and it states Σm(1,4,5,6) = ΠM(0,2,3); the lecture has Σm(1,4,5,6,7) = ΠM(0,2,3). (Exam Prep/Finals Notes p7 vs L13 p20, p25)
- The AY23/24 S1 'answers at a glance' page contradicts the worked answer for Q17d. R = Σm(0,3,12,15) is correct (also R08 p42). (guides/Past Finals s4; R08 p42)

## Worked examples (presets and tests)
- **K-map min SOP** (L15 p39-41; R07 p40; L16 p4-8): input `F(A,B,C,D)=Σm(2,3,4,5,7,8,10,13,15)` -> expected `6 PIs, 3 EPIs (B∙D, A'∙B∙C', A∙B'∙D'); F = B∙D + A'∙B∙C' + A∙B'∙D' + A'∙B'∙C (unique)`
- **K-map PI/EPI** (L15 p42; R07 p41; same function as AY25/26 Q17a H (key)): input `G(A,B,C,D)=Σm(3,4,5,7,9,13,14,15)` -> expected `5 PIs (B∙D, A'∙B∙C', A∙C'∙D, A∙B∙C, A'∙C∙D), 4 EPIs (all but B∙D); G = A'∙B∙C' + A∙C'∙D + A∙B∙C + A'∙C∙D; POS (A'+B+C')(A'+C+D)(A+B+C)(A+C'+D)`
- **K-map PI/EPI count** (L15 p37; R07 p39 (counts); minterms reconstructed from the PI list; alternatives computed): input `F(A,B,C,D)=Σm(0,2,3,4,7,8,9,10,11,13,14)` -> expected `7 PIs (B'∙D', B'∙C, A∙B', A'∙C'∙D', A∙C'∙D, A'∙C∙D, A∙C∙D'), 4 EPIs (A'∙C'∙D', A∙C'∙D, A'∙C∙D, A∙C∙D'); 3 alternative minimal SOPs of 6 terms`
- **K-map POS** (L15 p43-44; R07 p43 (SOP computed)): input `F(A,B,C,D)=Σm(0,1,2,3,5,7,8,9,10,11)` -> expected `F' = A∙B + B∙D'; F = (A'+B')∙(B'+D); min SOP F = B' + A'∙D`
- **Don't-cares 3-var** (L15 p46-47; R07 p45): input `F(A,B,C)=Σm(3,5,6)+d(0,7); G(A,B,C)=Σm(1,2,4)+d(0,7)` -> expected `F = A∙C + A∙B + B∙C; G = B'∙C' + A'∙B' + A'∙C' (without don't-cares G needs 4 three-literal terms)`
- **Don't-cares from half-adder inputs** (L15 p48-49 (minterms read from the p49 table)): input `F(K,L,M,N)=Σm(2,6,8)+d(3,7,11,12,13,14,15)` -> expected `PIs K'∙M, L∙M, K∙M'∙N' (K∙L, M∙N all-X so not PIs); EPIs K'∙M, K∙M'∙N'; F = K'∙M + K∙M'∙N'`
- **Expression to K-map to SOP/POS** (L15 p50-51, p54): input `F(A,B,C,D)=A∙B∙C + B'∙C∙D' + A∙D + B'∙C'∙D' (= Σm(0,2,8,9,10,11,13,14,15))` -> expected `PIs A∙D, A∙C, A∙B', B'∙D'; SOP F = A∙D + A∙C + B'∙D'; F' = A'∙B + A'∙D + B∙C'∙D'; POS F = (A+B')(A+D')(B'+C+D)`
- **Don't-cares SOP and POS** (L15 p52-55; R07 p46-47; alternative computed): input `F(A,B,C,D)=Σm(2,8,10,15)+d(0,1,3,7)` -> expected `SOP B'∙D' + B∙C∙D; POS (B'+C)(B'+D)(B+D'); alternative POS also minimal: (B+D')(B'+D)(C+D')`
- **Basic grouping** (L15 p27-29): input `F(w,x,y,z)=Σm(4,5,10,11,14,15)` -> expected `F = w'∙x∙y' + w∙y`
- **Filling a K-map from an expression** (L15 p33 (minimal SOP computed)): input `F = A∙(C+D)'∙(B'+D') + C∙(B+C'+A'∙D)` -> expected `= A∙B'∙C'∙D' + A∙C'∙D' + B∙C + A'∙C∙D = Σm(3,6,7,8,12,14,15); minimal SOP A'∙C∙D + A∙C'∙D' + B∙C`
- **3-var quick review** (L15 p18 (minimal form computed)): input `Map with 1s at m0, m2, m5; and A(x,y,z)=x∙y + y∙z' + x'∙y'∙z` -> expected `Σm(0,2,5) = a'∙b'∙c' + a'∙b∙c' + a∙b'∙c (min a'∙c' + a∙b'∙c); A = Σm(1,2,6,7)`
- **T06 SE3(a)** (T06 Ans p1 (SOP); POS computed): input `F1(A,B,C,D)=Σm(5,8,10,12,13,14)` -> expected `3 PIs, 2 EPIs; F1 = A∙D' + B∙C'∙D; POS (SE4) F1 = (A+D)(B+D')(C'+D')`
- **T06 SE3(b)** (T06 Ans p1 (SOP); POS computed): input `F2(W,X,Y,Z)=ΠM(0,1,2,8,9,10)` -> expected `2 PIs, 2 EPIs; F2 = X + Y∙Z; POS F2 = (X+Y)(X+Z)`
- **T06 SE3(c)** (T06 Ans p1 (SOP); POS computed (no key)): input `F3(K,L,M,N)=Σm(1,7,10,13,14)+d(0,5,8,15)` -> expected `6 PIs, 1 EPI (L∙N); F3 = L∙N + K∙M∙N' + K'∙L'∙M' or L∙N + K∙M∙N' + K'∙M'∙N; POS (SE4) has 3 alternatives: (K+N)(K'+L+M)(L+M'+N')(M+N); (K+N)(K'+L+N')(L+M'+N')(M+N); (K+L+M')(K+N)(K'+L+N')(M+N)`
- **T06 Q2(d)** (T06 Ans p2): input `F4(A,B,C,D)=ΠM(4,8,9,11,12)∙D(2,3,6,7,10,14)` -> expected `Σm(0,1,5,13,15)+d(2,3,6,7,10,14); 4 PIs (A'∙B', A'∙D, B∙D, B∙C), 2 EPIs (A'∙B', B∙D); SOP A'∙B' + B∙D; F4' = A∙B' + B∙D'; POS (A'+B)(B'+D)`
- **T06 Q3** (T06 Ans p3, p5): input `T(A,B,C,D)=ΠM(3,7,8,10,12,13)∙X(6,11,14,15)` -> expected `T = Σm(0,1,2,4,5,9)+X(6,11,14,15); 4 PIs (A'∙D', A'∙C', A∙B'∙D, B'∙C'∙D); 2 EPIs (A'∙D', A'∙C'); SOP A'∙D' + A'∙C' + B'∙C'∙D or A'∙D' + A'∙C' + A∙B'∙D; T' = A∙D' + C∙D + A∙B; POS (A'+D)(C'+D')(A'+B')`
- **T06 Q4 comparator functions with 0000 as don't-care** (T06 Ans p6 (Y's comparison symbol lost in text; ≤ is the reading consistent with the key, checked by computation)): input `X = (KL = MN), Y = (KL ≤ MN), Z = (KLM < LMN), d(0)` -> expected `X = K'∙L∙M'∙N + K∙L'∙M∙N' + K∙L∙M∙N; Y = M∙N + K'∙N + K'∙M + L'∙M (5 PIs, 4 EPIs; K'∙L' unused); Z = K'; input 0000 gives XYZ = 001`
- **T06 Q1 algebra** (T06 Ans p1 (b); (a) computed): input `(a) F(x,y,z)=(x + y∙z')∙(y'+y) + x'∙(y∙z' + y); (b) G(p,q,r,s)=ΠM(5,9,13)` -> expected `(a) F = x + y (computed; no key); (b) G = p'∙q' + r + s'`
- **T06 SE2 set operations** (T06 SE2 (computed; no key)): input `F(A,B,C)=Σm(0,2,4,6,7), G(A,B,C)=Σm(1,2,3,6)` -> expected `F = ΠM(1,3,5); G = ΠM(0,4,5,7); F+G = Σm(0,1,2,3,4,6,7); F∙G = Σm(2,6); F⊕G = Σm(0,1,3,4,7)`
- **Canonical forms** (L13 p23-25; R07 p17-19): input `Truth table of L13 p23: F1, F2, F3` -> expected `F1 = x∙y∙z' = m6; F2 = Σm(1,4,5,6,7) = ΠM(0,2,3); F3 = Σm(1,3,4,5) = ΠM(0,2,6,7)`
- **Minterm/maxterm notation (4 vars A,B,C,D)** (L13 p21; R07 p16): input `A'∙B'∙C∙D; m10; m11; A∙B∙C∙D'; A∙B'∙C'∙D; A+B+C'+D'; M13; M0; A+B+C'+D; A'+B+C+D'` -> expected `m3; A∙B'∙C∙D'; A∙B'∙C∙D; m14; m9; M3; A'+B'+C+D'; A+B+C+D; M2; M9`
- **SOP/POS classification** (L13 p18 quiz (answers derived from L13 p16-17 definitions; tick marks lost in text)): input `(1) X'∙Y + X∙Y' + X∙Y∙Z (2) (X+Y')∙(X'+Y)∙(X'+Z') (3) X'+Y+Z (4) X∙(W'+Y∙Z) (5) X∙Y∙Z' (6) W∙X'∙Y + V∙(X∙Z+W')` -> expected `(1) SOP only (2) POS only (3) both (4) neither (5) both (6) neither`
- **Complement function** (L13 p15): input `F1 = x∙y∙z'` -> expected `F1' = x'+y'+z`
- **Truth-table proof** (L13 p14): input `F3 = x'∙y'∙z + x'∙y∙z + x∙y'; F4 = x∙y' + x'∙z` -> expected `Equal (both Σm(1,3,4,5))`
- **Algebraic simplification** (L15 p5-6; R07 p29): input `(x+y)∙(x+y')∙(x'+z); and a∙b∙c + a∙b∙d + a'∙b∙c' + c∙d + b∙d'` -> expected `x∙z (6 to 2 literals); b + c∙d (13 to 3 literals)`
- **Canonical SOP MCQ** (AY25/26 Q12 key): input `F(A,B,C) = (A∙B + C)∙(A∙C + B)` -> expected `Σm(3,5,6,7) (option C)`
- **Simplification MCQ** (AY20/21 Q6 (computed; no key)): input `A∙B'∙(C + D' + E)'∙F + (C' + F')' + D∙F` -> expected `(C + D)∙F (option D)`
- **Recitation quizzes** (R07 p51-53): input `x'∙(y + y'∙z)'; canonical SOP of (a'+a)∙b∙c + a∙b'∙(c'+c); canonical POS of (x+y'+z'∙z)∙(x'∙x+y+z)` -> expected `x'∙(y+z)' (not equal to x'∙(y+z)); a'∙b∙c + a∙b∙c + a∙b'∙c' + a∙b'∙c; (x+y'+z')(x+y'+z)(x'+y+z)(x+y+z)`
- **Umbrellas / consensus** (R07 p36): input `F(A,B,C) = A'∙C + A∙B + B∙C (= Σm(1,3,6,7))` -> expected `3 PIs, 2 EPIs; F = A'∙C + A∙B (B∙C redundant by consensus)`
- **Implicants vs PIs** (R07 p3, p27, p37): input `F(A,B,C)=Σm(1,2,3,5,7)` -> expected `11 implicants; 2 PIs (C, A'∙B); F = C + A'∙B`
- **Multiple forms** (R07 p9, p20 (second SOP computed)): input `F(A,B,C) = A∙B + A'∙C + A'∙B'` -> expected `Σm(0,1,3,6,7) = ΠM(2,4,5) = (A+B'+C)∙(A'+B); two minimal SOPs: A'∙B' + A'∙C + A∙B or A'∙B' + A∙B + B∙C`
- **Simplification quiz** (R07 p58-59 (SOP computed)): input `f(x,y,z)=Σm(0,1,2,3,4,7)` -> expected `f' = x∙y'∙z + x∙y∙z'; f = (x'+y+z')∙(x'+y'+z); min SOP x' + y'∙z' + y∙z`
- **Circuit analysis** (L14 p9; R08 p31): input `Circuit F4 = ((A'∙B') + C)'; R08 quiz F = (a∙b) ⊕ (b+c)` -> expected `F4 = (A+B)∙C'; F = a'∙b + b'∙c`
- **4-NAND circuit** (AY23/24 S2 Q12-13 key): input `Y = ((A∙(A∙B)')'∙(B∙(A∙B)')')', NAND delay 3 ns` -> expected `Y = A⊕B (XOR, option C); delay 9 ns (option C)`
- **Universal gates** (L14 p11-12): input `Build NOT/AND/OR from NAND only and from NOR only` -> expected `NAND: NOT 1, AND 2, OR 3 gates; NOR: NOT 1, OR 2, AND 3 gates`
- **Gate MCQs** (AY24/25 Ans p2; past-finals inventory MCQ letters): input `AY24/25 Q1 (2-input gates usable as inverter: OR, XOR, XNOR, NOR); Q2 (complete sets {OR,NOT}, {XOR,AND}, {NOR,AND}, {NAND})` -> expected `Q1 = D (XOR with 1, XNOR with 0, NOR tied); Q2 = E (all four complete)`
- **Gate MCQs** (AY23/24 S1 Ans p4-5 and answers at a glance): input `AY23/24 S1 Q6 (8-bit ABCDEFGH divisible by 4, single 2-input gate); Q7 (four statements); Q8 (smallest equivalent circuit)` -> expected `Q6 = D (NOR of G,H); Q7 = B (only 'NOR from NANDs' true); Q8 = D (1 AND + 1 OR)`
- **Propagation delay** (R08 p25-28; L17 p35-38): input `Full adder, every gate delay t, inputs at 0; 4-bit ripple-carry adder` -> expected `S = 2t, C = 3t; S1=2t, C2=3t, S2=4t, C3=5t, S3=6t, C4=7t, S4=8t, C5=9t; general Sn = ((n-1)∙2+2)t, Cn+1 = ((n-1)∙2+3)t`
- **Past-paper K-map** (AY23/24 S2 Q19 key): input `F(A,B,C,D)=ΠM(0,2,8,10,13)∙X(3,7,11,12,15)` -> expected `Σm(1,4,5,6,9,14); 5 PIs (A'∙D, B'∙D, A'∙B, B∙D', B∙C), 1 EPI (B'∙D); 3 minimal SOPs: B'∙D+A'∙B+B∙D', B'∙D+A'∙B+B∙C, B'∙D+B∙D'+A'∙D`
- **Past-paper K-map** (AY23/24 S1 Q17(a)(b) key; R08 p40-41; SOPs computed): input `P(W,X,Y,Z)=Σm(1,8,13)+d(0,2,5,9,10,15); Q(W,X,Y,Z)=ΠM(5,7,8,10,13,15)∙d(0,2,3,4,9,14)` -> expected `P: 4 PIs (Y'∙Z, X'∙Y', X'∙Z', W∙X∙Z), 0 EPI, min SOP X'∙Y'+Y'∙Z or X'∙Z'+Y'∙Z; Q: Σm(1,6,11,12), 4 PIs (W'∙X', W'∙Z', X'∙Z, X∙Z'), 2 EPIs (X'∙Z, X∙Z'), Q = X'∙Z + X∙Z'`
- **Past-paper K-map** (AY24/25 Q3-4 key; SOPs computed): input `F(A,B,C,D)=Σm(1,3,4,6,10,12)+x(2,5,7,13,14)` -> expected `6 PIs (B∙C', C∙D', A'∙D, A'∙B, A'∙C, B∙D'), 2 EPIs (C∙D', A'∙D); MCQ Q3 = D, Q4 = E; min SOP A'∙D + C∙D' + B∙D' or A'∙D + C∙D' + B∙C'`
- **Past-paper K-map** (AY24/25 Q17a key): input `F(A,B,C,D)=Σm(0,1,4,6,9,11)+d(5,7,13,15)` -> expected `4 PIs (A'∙C', C'∙D, A'∙B, A∙D; B∙D all-X not a PI), 3 EPIs; SOP A'∙C' + A'∙B + A∙D; F' = A∙D' + A'∙B'∙C; POS (A'+D)∙(A+B+C')`
- **Past-paper H = F∙G** (AY25/26 Q17a key): input `F=Σm(0,1,3,4,5,7,9,13,14,15), G=ΠM(0,1,6,8,11,12), H = F∙G` -> expected `G = Σm(2,3,4,5,7,9,10,13,14,15); H = Σm(3,4,5,7,9,13,14,15); 5 PIs, 4 EPIs; SOP A'∙B∙C' + A'∙C∙D + A∙B∙C + A∙C'∙D; POS (A'+B+C')(A'+C+D)(A+B+C)(A+C'+D)`
- **Past-paper EPI MCQ** (AY25/26 Q1 key; minterms reconstructed from the listed EPIs, assuming no don't-cares): input `AY25/26 Q1 K-map (diagram); reconstructed F = Σm(0,1,2,6,8,10,12)` -> expected `4 PIs, all EPIs: B'∙D', A'∙B'∙C', A∙C'∙D', A'∙C∙D' (answer D)`
- **Past-paper K-map MCQs (no key)** (Computed (papers have no keys)): input `AY20/21 Q1-2: F=Σm(0,1,2,7,15)+x(3,9,11,12,13); AY21/22 S1 Q5: F=Σm(3,10,11,15)+x(1,2,4,7,9,12,14); AY21/22 S2 Q5: F=Σm(1,3,6,8,9,11,15)+x(7,14)` -> expected `AY20/21: 4 PIs (A'∙B', B'∙D, C∙D, A∙D) = B, 2 EPIs (A'∙B', C∙D) = C, F = A'∙B' + C∙D; AY21/22 S1: 0 EPIs = A (4 PIs, 4 alternative SOPs); AY21/22 S2: C∙D is not an EPI = A (EPIs B∙C, B'∙D, A∙B'∙C'; F = A∙B'∙C' + B'∙D + B∙C)`
- **Past-paper K-map** (AY21/22 S2 Q14(c), R08 p39; single-comparator wiring computed): input `G(A,B,C,D)=Σm(0,4,6,8,9,10,12,13,14,15)` -> expected `5 PIs, 5 EPIs; G = A∙B + C'∙D' + A∙C' + B∙D' + A∙D'; G = (AB ≥ DC); a single 4-bit comparator also works: X=A,A,B,1 vs Y=A,D,C,0 with X>Y`
- **Single-comparator implementations** (T07 Ans p6): input `T07 Q5: F=Σm(12-15), G=Σm(0,6,9,15), H=Σm(0,1,6,7,8,9,14,15), Z=Σm(1,3,5,7,9,11,13)` -> expected `F: X=ABCD > Y=1011; G: ABCD = DCBA; H: B000 = C000 (B=C); Z: ABCD < DDDD (or ABCD < DABC)`
- **Comparator MCQs** (AY24/25 inventory MCQ letters; AY25/26 Ans p5; impossibility confirmed by exhaustive search): input `AY24/25 Q7: Σm(0..8), Σm(0,2,4,6,9,11,13,15), Σm(0,15); AY25/26 Q8: Σm(2,4,5,6,7,14), Σm(2,4,6,8,9,11,13,15), ΠM(all except 1)` -> expected `AY24/25: all three possible = D (e.g. ABCD < 1001; A = D; equal rotations); AY25/26: (i) AD < BC, (ii) impossible, (iii) ABC < D, answer D`
- **BCD to excess-3** (R08 p8-9): input `ABCD BCD in, WXYZ = ABCD + 3, d(10-15)` -> expected `W = A + B∙C + B∙D; X = B'∙C + B'∙D + B∙C'∙D'; Y = C∙D + C'∙D'; Z = D'`
- **BCD to 7-segment** (AY25/26 Q17b key (Draft)): input `PQRS BCD, segments A-G, d(10-15)` -> expected `A = Σm(0,2,3,5,6,7,8,9); E = Σm(0,2,6,8); B = Q' + R'∙S' + R∙S; G = P + Q'∙R + Q∙R' + Q∙S' (or ... + R∙S'); F = ΠM(1,2,3,7)`
- **5-var with don't-cares** (T07 SE3 (computed; no key)): input `ABCDE to PQ = number of 0s between the two closest 1s; invalid inputs d(0,1,2,4,8,16)` -> expected `P = Σm(9,17,18)+d, P = A'∙C'∙D' + B'∙C'∙D' + B'∙C'∙E'; Q = Σm(5,10,17,20,21)+d, Q = A'∙C'∙E' + B'∙D'; input 00100 gives PQ = 01`
- **Gate-free circuits** (T07 SE1 (computed), AY24/25 Q5(iii) key, T07 Answer Q4 p2-7): input `T07 SE1: 4x+2 for 3-bit ABC; T07 Q3: base-4 digit, excess-3 to excess-11; T07 Q4: BCD of 51A + 20(B%2)` -> expected `VWXYZ = A,B,C,1,0; F3F2F1F0 = 1,A2,A1,A0; F11..F0 = 0,A3,A2,A1 | 0,A0,B0,A0 | A3,A2,A1,A0 (A=2, B=7 gives 0001 0010 0010 = 122)`
- **Adder block design** (T07 Q2(a), T07 Ans p3): input `EFGH = (ABCD + 1)/2 with one 4-bit adder` -> expected `EFGH = 0ABC + 000D (e.g. 0110 gives 0011; 1101 gives 0111)`
- **6-var stretch (outside 2-5 scope)** (L15 p24 (computed; no answer on slide)): input `Σm(6,8,14,18,23,25,27,29,41,45,57,61) over a,b,c,d,e,f` -> expected `7 terms, all EPIs: a'∙b'∙c∙d'∙e'∙f' + a'∙b'∙d∙e∙f' + a'∙b∙c'∙d'∙e∙f' + a'∙b∙c'∙d∙e∙f + a'∙b∙c∙d'∙f + a∙c∙e'∙f + b∙c∙e'∙f`

## Gaps or ambiguities
- Diagram-heavy pages lose detail in text. Gate drawings on L14 p3-6, p13-16 and p20-22 are lost. The valid/invalid grouping examples on L15 p31 and R07 p34 are lost. The L15 p37 / R07 p39 3-variable map (3 PIs, 2 EPIs) cannot be reconstructed; the 4-variable one was rebuilt from the R07 p39 PI list. The T06 Q3 non-standard layout picture is also lost, so the minterm placement for Q3(a) needs the PDF.
- Further lost diagrams: the T06 Ans p4 AND-OR and NAND circuits, R07 p55-56 and R08 p30-32 quiz circuits (delay values 1/2/2/3 ns and an '8ns' answer survive, but not the topology), and the AY17/18 Q1c and AY23/24 S1 Q8 circuits. The AY25/26 Q1 K-map was reconstructed as Σm(0,1,2,6,8,10,12) from the key's EPI list, assuming no don't-cares.
- T06 Q4 'Y = 1 if KL ? MN' lost its comparison symbol. ≤ is the only reading consistent with the key Y = M∙N + K'∙N + K'∙M + L'∙M (checked by computation).
- Several answers above are computed, not keyed: T06 Q1(a), SE2, SE4; T07 SE1, SE3; AY20/21 Q1-2 and Q6; AY21/22 S1 Q5; AY21/22 S2 Q5. Also the extra alternatives for L15 p55 and R07 p9. The app should label these as 'computed'.
- Inverter delay is not stated explicitly in the in-scope sources. R08 uses 'each gate has delay t'. AY17/18 makes NAND delay depend on fan-in (n∙t). The tool needs configurable per-gate delays. tPHL, tPLH and tPD appear only in third-party Finals Notes (DLD 4.5 reading, L14 p17), not on the slides.
- Tie-break for 'simplest': L15 p4 says literals and terms may conflict and focuses on literals, while L15 p12 and p34 ask for fewest terms and literals. My checks minimise terms first, then literals; no course example distinguishes the two.
- The 6-variable K-map (L15 p23-24) is in the lecture but outside the 2-5 variable scope. Treat it as optional.
- Gray code (L15 p9-11, T07 SE2 binary-to-Gray with half adders) is borderline with the 'no number-system conversion tools' request. Suggest showing Gray order only inside the K-map adjacency explorer.
- T07 and R08 content (magnitude comparator, parallel adders, BCD codes, circuit delays) overlaps L17-L18. Coordinate with whoever owns L17-L18 to avoid building the comparator finder and delay timeline twice.
- Quine-McCluskey is non-examinable (L16 p1), and no past paper relies on it (Past Finals guide s3). T06 recommends it only for understanding EPIs, so it is priority 3 and should be labelled.
- PLA/ROM (L14 p19-23): no past-paper question found in the inventories; examinability unclear.
- MCQ letters for AY24/25 and AY25/26 are only in red in the PDFs. I used the letters recorded in materials/past-finals inventory (AY24/25: 1D 2E 3D 4E 7D). The AY25/26 key is marked Draft.
- Logic-trainer chip facts: R07 p21 lists 74LS04/08/32/00/02, and L14 p18 shows the 74LS00 quad NAND pinout. Gates per chip for the others are not stated in the text, so do not build a chip-count tool on assumptions.
