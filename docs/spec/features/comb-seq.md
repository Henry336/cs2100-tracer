# Feature sweep: comb-seq

Raw research output. Priority 1 = high exam value or high confusion.

## Features (19)
### [1] Block Circuit Workbench (MSI and adder netlist simulator with answer checker)
- Module: Combinational + MSI (L17-L18)
- Sources: L17 p4, p17-24, p29, p33; L18 p12-14, p23-24, p48-56; T07 p2 (conventions), T07 Q1-Q5 + Ans p1-6; T08 Q3-Q5 + Ans p2-5; R08 p34-42; R09 p51-59; AY23-24 S2 Ans p20 (Q21); AY23-24 S1 Ans p11 (Q17c-e)
- Inputs: Drag and drop blocks: HA, FA, 2-bit and 4-bit parallel adder (Cin/Cout), 2-bit and 4-bit magnitude comparator, 2x4/3x8 decoder (1-enable or 0-enable, active-high or active-low outputs), 4:1/8:1 MUX, quad 2:1 MUX (E', S), 1:4 DEMUX, 4-to-2/8-to-3 encoder and priority encoder, Count-1/Count-0 (T08 Q3), plus gates. Wire them to literals A-E and the constants 0/1. Optional target: Σm/ΠM with d(...), a truth table, or an arithmetic spec such as (ABCD+1)/2 or 51A+20(B%2).
- Shows: Pick any input row and the values animate through every block, with each wire labelled by its value and its expression. Also shown: the full truth table, Σm/ΠM, the simplified SOP/POS (reusing the K-map engine), a per-row diff against the target with failing rows in red, and counts of devices, gates and inverters. A 'per-row of selector' table mode (as in T08 Q4) gives the restricted SOP for each AB value.
- Aha: MSI blocks are just functions. Rewiring bits is free arithmetic (a shift is ×2, as in T07 SE1 and Q2a). A constant on an adder input turns it into '+3' (BCD→Excess-3). A comparator can test equality of rearranged bits.
- Verify use: Wire up your exam or tutorial answer to see whether it matches the spec on all 16/32 rows. Covers T07 Q1 (V = count of 1s > 1), T07 Q2/Q4, T08 Q3-Q5, and the 'what is F(A,B,C,D)' trace questions in AY23/24 S1 Q17 and AY23/24 S2 Q21.
- Conventions: Complemented literals are NOT available unless stated. Constants 0 and 1 are always available and count as degenerate SOP/POS (T07 p2, R08 p34, R09 p51); the checker flags any implicit inverter. Enforce the 'only these devices, fewest of them' restriction (T07 Q1). Answer formatting: ' for NOT, . for AND, + for OR, literals alphabetical within a term (AY23-24 S2 p12-13, AY25-26 p11). XOR is not an SOP, so expand C⊕D to C'·D + C·D' (T08 Ans p4). S1 is the MSB on selects (L18 p38). In the lab, 0 is GND and 1 is Vcc (L17 p23).

### [1] Magnitude Comparator Studio + 'single comparator, no gates' function finder
- Module: Combinational (L17)
- Sources: L17 p30-33; R08 p20-22, p39; T07 Q5 + Ans p6; T07 Q1 Ans p1; AY25-26 S1 Ans p4-5 (Q8); AY24-25 S1 Ans p4 (Q7); R09 p52 (AY16/17 Q2a), p57 (AY18/19 Q5c); AY23-24 S1 Ans p11 (Q17d); AY23-24 S2 Ans p20 (Q21c); past-finals inventory (AY15/16 Q8 uses 2-bit comparators + one gate)
- Inputs: Mode 1: enter two 4-bit unsigned values. Mode 2: wire X3..X0 and Y3..Y0 to {A,B,C,D,0,1}. Mode 3: enter a target F = Σm(...) / ΠM(...) and choose a 2-bit or 4-bit comparator, optionally allowing 2 comparators plus one gate.
- Shows: A bit cascade from the MSB. For each bit it computes xi = Ai·Bi + Ai'·Bi', and the A>B and A<B sums light up term by term (A3·B3' + x3·A2·B2' + ...) until the first differing bit decides (L17 p31). The finder brute-forces every wiring (6^8 per output, using 16-bit truth-table masks) and lists all solutions, e.g. 'X=ABCD, Y=1011, X>Y' for Σm(12-15), or proves none exists. It groups the solution families: threshold, equality of permuted bits (palindrome ABCD=DCBA, rotation ABCD=BCDA), bit equality (B000 vs C000), and 'D-broadcast' (Y=DDDD).
- Aha: One comparator can only make a threshold or an 'equality/ordering of rearranged bits' function. That is why a Σm list that fits no such pattern (AY25/26 Q8 F2) is impossible.
- Verify use: This MCQ template ('which can be implemented with a single 4-bit comparator') was in AY24/25 Q7 and AY25/26 Q8. The mode also covers T07 Q5, the range checks (3 ≤ ABCD ≤ 12 with 2 comparators + AND) and the multiple-of-17 detector.
- Conventions: Unsigned comparison. Outputs are X<Y, X=Y, X>Y (T07 p4 block). No gates and no complemented literals. There may be multiple valid answers (T07 Ans p6). The 2-bit comparator variant has X1X0, Y1Y0 (R09 p52).

### [1] Decoder Lab: enable type, output polarity, implement/read functions, product-term finder
- Module: MSI (L18)
- Sources: L18 p5-24; R09 p10-19, p53, p56, p58; T08 SE1-SE3, Q2 + Ans p1; AY25-26 S1 Ans p6 (Q11); AY24-25 S1 p3 (Q6, diagram); AY23-24 S2 Ans p20 (Q21b); AY23-24 S1 p5 (Q9); AY17/18 Q3c, AY16/17 Q2b, AY19/20 Q5a via R09
- Inputs: Decoder size (2x4, 3x8, 4x16). Enable: none, 1-enable E, or 0-enable E'. Outputs: active-high or active-low. Wiring of S-lines and E to literals, constants or a gate output such as A⊕D. Choose which outputs feed which gate (OR/NOR/AND/NAND). Or enter a target Σm for implement mode.
- Shows: Live view: the selected output line lights (or dips, for active-low), and the truth table includes the disabled row (E=0, d d, all outputs inactive). Implement mode shows the 4 equivalent builds side by side (active-high+OR of 1-minterms, active-low+NAND, active-high+NOR of 0-minterms, active-low+AND) with fan-in. Read mode derives F step by step: an active-low output is the complement of a minterm, so an AND of active-low outputs gives a product of maxterms. The product finder enumerates every (E,S1,S0) wiring and output index and lists all reachable product terms with no gates.
- Aha: Every output is one minterm ANDed with the enable. A 1-enable input can only add an uncomplemented literal, which is why A'·B'·C' is unreachable without an inverter while A'·B·C' is reachable (E=B). An active-low output of a 0-enable decoder is an OR (AY19/20 Q5a: N = A+B+C).
- Verify use: Recurring MCQ: active-low decoder + gate → F (AY23/24 S2 Q21b, AY24/25 Q6, AY25/26 Q11). Also 'which product can one decoder make' (AY23/24 S1 Q9, AY21/22 S2 Q6), T08 SE1-SE3 and T08 Q2.
- Conventions: Selects S1 (or S2) are the MSB, and output index = binary value of the selects. 0-enable is written E' or Ē (L18 p16). Negated outputs = active-low (L18 p20; R09 p19). Standard 74138: active-low outputs, several enables (L18 p21-22, diagram-only). No complemented literals unless stated.

### [1] MUX Function Implementer with gate-free selector search
- Module: MSI (L18)
- Sources: L18 p37-56; R09 p33-48, p55; T08 Q1 + Ans p1; AY23-24 S2 Ans p20 (Q21a); AY23-24 S1 p5 (Q10 working); AY21-22 S1 p9 (Q13c rule); AY18/19 Q5d, AY20/21 Q13a-b (inventory)
- Inputs: F as Σm or ΠM, with d(...)/D(...). MUX size: 2^n:1, 2^(n-1):1, or 4:1 for 4 variables. Selector variables and their order (S1 = MSB), or 'auto'.
- Shows: The truth table regrouped by selector value (L18 p54). Within each group, F is compared with the reserved variable to give a data input of 0, 1, v or v'. Don't-cares are resolved in favour of constants (T08: 0 rather than Z'). Any v' is flagged red ('needs an inverter: complemented literals not available'). An animated Y = I0·m0 + I1·m1 + ... (L18 p39). Auto mode lists every selector assignment that needs no gates, e.g. F1 = Σm(0,2,3,5,6,7) → selectors A,C with data 1,B,B,1.
- Aha: A MUX is a minterm generator whose data lines choose which minterms survive. Reserving one variable halves the mux, and the choice of selector variables decides whether you need an inverter.
- Verify use: T08 Q1 (both selector choices), AY23/24 S2 Q21a, AY23/24 S1 Q10 'which can a single 4:1 MUX do', and the 8:1 G = ΠM(1,2,6,8,9,11,13) question from AY17/18 Q3b (data 1,B,0,1,B,0,1,B).
- Conventions: S1 is the MSB (L18 p38). A constant is simpler than a literal (T08 Ans p1). Once a variable is on a selector line it must not be used on the data inputs (AY21-22 S1 p9). No complemented literals. The 74151A has an enable/strobe and complementary output (function table is an image, L18 p46-47, so check the PDF).

### [1] Sequential Circuit Analyzer (circuit equations → state table → state diagram → simulation)
- Module: Sequential (L19)
- Sources: L19 p28-43; T09 SE1, Q1 + Ans p1; R10 p26-28, p54-58, p64-66; AY24-25 S1 Ans p13 (Q16a); AY23-24 S1 Ans p13 (Q18a); AY23-24 S2 Ans p6 (Q14); AY19-20 Q4b; AY25-26 S1 Ans p9-10 (Q16)
- Inputs: m flip-flops, each D, T, JK or SR, named A, B, C...; input variables (x, or X0X1 with an MSB note); the flip-flop input equations (e.g. JA=B, KA=B·x', JB=x', KB=A⊕x); Mealy or Moore output equations; optional start state and input sequence (e.g. x=100010).
- Shows: The state table is built one row at a time (present | input | FF inputs | next | output). Each next-state bit is computed through that flip-flop's characteristic table, with the rule shown ('J=1,K=1 → toggle'). Also shown: the compact table (L19 p32), an auto-laid state diagram with a/b labels, badges for sinks, self-loops and unreachable states, and a clocked timeline of the state and output sequence for the given inputs.
- Aha: A sequential circuit is just combinational logic feeding flip-flops. The next state is the characteristic table applied to the gate outputs, one clock at a time.
- Verify use: T09 Q1 (state after 3 clocks and outputs, sinks), T09 SE1 sequence tracing, Johnson-counter MCQ (AY23/24 S2 Q14), D+T next-state fill-ins (AY23/24 S1 Q18a), completing a state diagram (AY24/25 Q16a).
- Conventions: A(t)/A+ notation (L19 p28). The state table has 2^(m+n) rows (p30). Arrow labels are input/output (p33); Moore output uses '/p' (T09 p2). Two-letter input names: JA = J of flip-flop A (p36). State numbers are the decimal value of AB..., MSB first. Q' is the complement, not the next state (R10 p20).

### [1] Sequential Design Wizard (mixed D/T/JK/SR, unused states, fewest gates)
- Module: Sequential (L19)
- Sources: L19 p44-58; T09 Q2-Q4 + Ans p2-5; R10 p30-39, p61-63; AY23-24 S2 Ans p19 (Q20); AY23-24 S1 Ans p13 (Q18b); AY24-25 S1 Ans p13 (Q16c); past-finals inventories (one 12-14 mark sequential question every paper)
- Inputs: A state diagram (click to add arcs labelled input/output), a state sequence (e.g. 1→3→5→7→9→11→13→15→2→4→6→1), or a state table. Number of state bits, flip-flop type per bit (e.g. D for A, T for B and C, JK for D), and the set of used states. Optionally, your own candidate equations.
- Shows: The L19 p46 procedure as a checklist. The excitation table is filled per row, with the lookup for each flip-flop animated (0→1 for JK = 1X). Unused states become X. One K-map per flip-flop input, with groupings, then the simplified SOP. A 'commit' step rewrites each X as d(1)/d(0) from the chosen equations (T09 Ans p3) and derives the unused-state transitions. Gate count assumes Q' is free. 'Check my equations' accepts non-SOP forms such as B⊕x and verifies every used transition.
- Aha: Don't-cares shrink the equations but secretly decide where unused states go. 'Fewest gates' is not the same as 'simplest SOP' (T09 Q2: KA=KB=1 plus one XOR and one XNOR).
- Verify use: Check JA/KA/TB/DC answers, the minimum gate count, the next state of an unused state on each input, and self-correcting verdicts in T09 Q2-Q4, AY23/24 S2 Q20, AY23/24 S1 Q18b and AY15/16 Q7.
- Conventions: Excitation tables as in L19 p45. Characteristic tables are for analysis, excitation tables for design (p44). K-map layout uses AB on the rows and Cx etc. on the columns (L19 p50, p56). Inverters are not needed because Q' is available (AY23-24 S1 Ans p13). The token inputs x and y are separate lines, not a 2-bit number (T09 Ans p5). For SR, warn if any state/input makes S=R=1.

### [1] Self-Correcting / Lockout Checker
- Module: Sequential (L19, R10)
- Sources: R10 p40-43; T09 Q2-Q3 + Ans p3-4; AY24-25 S1 Ans p13 (Q16b); R10 p63 (AY15/16 Q7); AY23-24 S1 Ans p13 (Q18b viii); AY23-24 S2 Ans p19 (Q20f-g)
- Inputs: Final flip-flop equations (from the wizard or typed in), the list of valid states and the input variables.
- Shows: The full 2^m state graph with unused states hatched. Each unused state's path is animated for every input value until it reaches a valid state or enters an invalid-only loop. Then a verdict (Yes/No) plus an auto-written one-line justification, e.g. 'No: 4→1→0→0 never reaches a used state'.
- Aha: A design that 'works' for the valid states can still lock up after a glitch. The don't-cares you used became real arrows.
- Verify use: Exam parts require an explanation ('Mark will not be awarded if no explanation', AY24/25 Q16b); the generated sentence models that answer.
- Conventions: Definition: the circuit is self-correcting if every unused state reaches a valid state in a finite number of transitions (T09 p3, R10 p40). The keys accept 'there is an arrow out to a used state' (T09 Ans p3), even when another input keeps the circuit in the unused state (AY23/24 S1 Q18: 3→3 on x=0, 3→2 on x=1 is marked 'Yes'). Show both a strict view and the course view.

### [1] Flip-flop Table Trainer: characteristic ↔ excitation ↔ conversion
- Module: Sequential (L19)
- Sources: L19 p11, p15, p18-23, p27, p44-45; R10 p25, p30; T09 SE2 (p1); AY25-26 S1 Ans p7 (Q13); AY21-22 S1 p8 (Q12b custom 'F flip-flop', diagram lost)
- Inputs: A flip-flop type (SR, D, JK, T) or a custom 2-state flip-flop diagram with input labels. Quiz mode presents unlabelled state diagrams (as in T09 SE2) to match to their flip-flop types.
- Shows: The characteristic table and equation (Q+ = S + R'·Q, D, J·Q' + K'·Q, T⊕Q). For each transition Q→Q+, the rows that cause it are highlighted and collapse into one excitation row with X. Conversion mode derives the input for a T flip-flop (T = Q⊕Q+) or a D flip-flop (D = Q+) plus gates for any custom flip-flop.
- Aha: The X in the JK excitation table exists because two different commands give the same move (0→1 by Set 1,0 or Toggle 1,1). T answers 'does it change?' and D answers 'where does it go?'.
- Verify use: Recall MCQs (JK with J and K tied is a T flip-flop), the T09 SE2 matching, and custom flip-flop design (AY21/22 S1 Q12b).
- Conventions: Excitation table values are exactly as in L19 p45. SR with S=R=1 is invalid/unpredictable (p27). In the JK table J and K are listed together (p45).

### [2] Ripple-Carry Adder Stepper + block-level adder presets
- Module: Combinational (L17)
- Sources: L17 p6-12, p17-29; R08 p11-18, p36; T07 Q1-Q2 + Ans p1-3; R09 p4-7
- Inputs: Width n (1-16), X, Y, Cin, and a toggle to show each FA as 2 HAs + OR. Presets: BCD→Excess-3 (+0011), 16-bit from four 4-bit adders, 6-person voting (2 FAs + 4-bit adder), (ABCD+1)/2, X+5y, and the T07 Q1 popcount.
- Shows: Column addition with a carry row, as on L17 p20/p27. Each FA's Xi⊕Yi, Si and Ci+1 is computed in turn, the carry ripples bit by bit, and a 5-bit result is produced. The comparison panel shows why a full truth table needs 2^9 = 512 rows (p19).
- Aha: FA = two half adders + OR, and an n-bit adder is just FAs chained by their carries. Arithmetic tricks (adding a constant, shifting by rewiring) replace K-maps.
- Verify use: T07 Q2a (EFGH=(ABCD+1)/2), T07 Q1, AY20/21 Q13d (X+5y), and BCD→Excess-3.
- Conventions: Ci+1 = Xi·Yi + (Xi⊕Yi)·Ci and Si = Xi⊕Yi⊕Ci (L17 p20). The lecture numbers bits 1..4 (C1 = carry-in, C5 = carry-out) while tutorials use X3..X0, so the app should show both. Cout can be left unused (p23).

### [2] Propagation Delay & Critical Path Calculator
- Module: Combinational (L17)
- Sources: L17 p34-38; R08 p24-28, p32 (quiz with 1-5 ns gates, diagram lost); L14 (delay intro)
- Inputs: A full adder, an n-bit ripple adder, or a custom gate DAG with per-gate delays and input arrival times.
- Shows: Every gate output is stamped with max(input times) + its delay, one gate at a time. The critical path is highlighted. For ripple adders a table of Si and Ci+1 is given, with the carry arriving at mt (p37).
- Aha: The carry chain dominates. The sum of bit i waits for the carry, so delay grows linearly with n.
- Verify use: Delay MCQs and checks of the formulas Sn = ((n-1)·2+2)t and Cn+1 = ((n-1)·2+3)t.
- Conventions: All inputs are stable at time 0. Each gate, including XOR, costs t. The FA is drawn as 2 HAs + OR (L17 p35); other drawings give different numbers (guide trap).

### [2] Code-Converter Circuit Designer (don't-cares + gate-free wiring detector)
- Module: Combinational (L17)
- Sources: L17 p13-16, p22-23; R08 p7-9; T07 SE1, SE2, Q2b, Q3, Q4 + Ans p3-5; Tutorial 7 Answer Q4 p2-7; AY24-25 S1 Ans p3 (Q5 options); R08 p37 (AY21/22 S1 Q13a)
- Inputs: Pick input and output code tables (BCD 8421, Excess-3, 84-2-1, 2421, 4221, Gray, excess-11 base-4 digit) or type a custom table; allowed parts (gates, half adders, one 4-bit adder, A1H device).
- Shows: A truth table with invalid codes auto-marked X (6 don't-cares for 4-bit decimal codes), K-maps per output bit, and the simplified SOP. A detector checks whether each output bit is just a wire or constant (e.g. excess-3 → excess-11 = 1A2A1A0), XOR of adjacent bits (Gray via half adders) or input + constant (adder). For multi-digit BCD (51A + 20(B%2)) it shows the 5A table and its wire pattern.
- Aha: Many 'converters' need no gates because the mapping is a bit permutation, a constant or a fixed offset. Spotting that beats K-maps.
- Verify use: T07 SE1/SE2/Q2b/Q3/Q4, AY24/25 Q5 'which converters need no gates', and AY21/22 S1 Q13a (three half adders = binary→Gray).
- Conventions: Scope boundary: this is a circuit-design tool, not a number-base converter (number-system tools are explicitly not wanted). Decimal codes are valid only for 0-9 (T07 Ans p4; R08 p7). No complemented literals.

### [2] Encoder & Priority Encoder Explorer
- Module: MSI (L18)
- Sources: L18 p26-33; R09 p23-29; T08 Q5 + Ans p5; AY23-24 S2 Ans p6 (Q15); AY23-24 S1 Ans p11 (Q17c); AY23-24 S2 Ans p20 (Q21e)
- Inputs: Toggle D0..D(2^n-1) for a 4-to-2, 8-to-3 or 16-to-4 encoder; choose plain or priority (which input is highest); reverse mode wires encoder inputs to literals or constants.
- Shows: The OR equations light up (z = D1+D3+D5+D7 ...). With a plain encoder and two inputs high, it shows the misleading code (D1+D2 gives 11, which looks like D3). The priority encoder shows the winner and V. The compact table's X rows expand into the full 16 rows (L18 p33), with K-maps for f, g and V. Reverse mode derives H2, H1, H0.
- Aha: An encoder output bit is the OR of every input whose index has that bit set. In a compact priority table, X means 'a higher-priority line already decided'.
- Verify use: T08 Q5 (H2=A+B, H1=A+B'·C, H0=1), AY23/24 S2 Q15 (Y of a 16-to-4 encoder), and the L18 p33 exercise.
- Conventions: A plain encoder assumes exactly one input is high (L18 p26, p30). In the L18 priority encoder D3 is highest and all-zero is invalid with V=0 (p32). The exam's 8-to-3 table has F7 highest (T08 p4).

### [2] Decoder Expansion Builder
- Module: MSI (L18)
- Sources: L18 p17-20, p25 (reducing decoders reading); R09 p16-18; T08 Q2 + Ans p1; Finals Notes cheatsheet p10-11 (count formula, third-party, matches R09 p18)
- Inputs: Target n-to-2^n decoder, building block k-to-2^k with enable, an input code, and an option to add a composite ENABLE.
- Shows: A tree: the MSBs drive the enables (w to the upper decoder, w' through an inverter to the lower, L18 p17), and the active path lights for the code. Shows the count (2^n−1)/(2^k−1) when k divides n, e.g. five 2x4 for a 4x16 (R09 p18).
- Aha: The MSBs pick which small decoder is on and the LSBs pick the line inside it. This is the same idea that later selects memory chips.
- Verify use: Questions on how many decoders a build needs, and T08 Q2's 'fewest decoders + one gate'.
- Conventions: Blocks are 1-enable. Inverter on the MSB for the two-decoder build (L18 p17, p19).

### [2] Latch Simulator (gate-level, round-by-round)
- Module: Sequential (L19)
- Sources: L19 p9-15; R10 p6-10, p20
- Inputs: Latch type (NOR S-R active-high, NAND S'-R' active-low, gated S-R, gated D); toggles for S, R, EN, D; initial Q.
- Shows: Each round of gate re-evaluation, repeated until stable (R10's tip: trace 3 rounds), with the feedback wires coloured. Shows S=R=1 giving Q=Q'=0 (invalid) and the indeterminate result when both are released together. Characteristic table and Q+ = S + R'·Q with S·R = 0.
- Aha: The cross-coupled feedback is the memory. 'No change' (S=R=0) is the latch remembering.
- Verify use: Latch trace questions and the active-high vs active-low command tables.
- Conventions: Active-high NOR latch: S=R=1 is invalid. Active-low NAND latch: S=R=0 is invalid and S=R=1 means no change (L19 p12, R10 p8). The gated latch changes only while EN=1 (p13). The D latch removes the invalid state (p14).

### [2] Timing-Diagram Lab: latch vs edge-triggered flip-flop
- Module: Sequential (L19)
- Sources: L19 p7-8, p14-25
- Inputs: Clickable waveforms for CLK/EN, D/J/K/T/S/R and PRE/CLR; element choice: gated D latch, positive-edge FF, negative-edge FF, JK with active-low PRE/CLR.
- Shows: The Q waveform with the sampling edges marked, a shaded transparent window for the latch, the asynchronous override regions, and toggling when J=K=1 (L19 p25).
- Aha: A latch follows D for the whole EN-high window, glitches included. A flip-flop only looks at the clock edge.
- Verify use: Checks hand-drawn timing traces and the latch vs flip-flop definition questions.
- Conventions: The '>' symbol marks a clock input; a bubble means negative edge (L19 p17). PRE/CLR are drawn active-low on p25 although p24 says 'PRE=HIGH sets', so let the user pick the active level. Parallel data transfer happens on the negative-going edge (p20).

### [2] Counter & Shift-Register Sequencer (Johnson, ring, up/down, custom)
- Module: Sequential (L19, exam extension)
- Sources: L19 p20 (parallel transfer); AY23-24 S2 Ans p6 (Q14); AY19-20 S2 Q4b (p3); T08 Q3 Table 1 (p2); T09 Q2-Q3 + Ans p2-4
- Inputs: Presets: 4-bit Johnson (Q' of last → D of first), ring (Q of last → D of first), mod-3 up/down (T09 Q2), or a custom sequence; start state; async CLR.
- Shows: Bits shifting each clock, the visited sequence in decimal, disjoint cycles from other start states, and minimal state-decoding expressions (e.g. State(1) = A·B').
- Aha: A Johnson counter has 2n states and a ring counter n. Each Johnson state can be recognised from just 2 bits. The T08 Q3 code table is exactly the Johnson sequence.
- Verify use: AY23/24 S2 Q14 MCQ and AY19/20 Q4b (list states, State(1), State(2)).
- Conventions: Counters and registers are not taught by name; frame this as D-FF analysis. Exam states are written in decimal of WXYZ or ABCD.

### [2] Combinational Analysis Tracer ('What is this circuit?')
- Module: Combinational (L17)
- Sources: L17 p4, p25-26; R08 p31 (quiz 2 Q1), p37-39
- Inputs: A circuit as named intermediate points (e.g. w = a·b, x = b + c, F = w⊕x) or a small schematic.
- Shows: The L17 p4 four-step analysis: label points, derive each intermediate function, fill the truth table column by column, then simplify. A recogniser names the result (half adder, full adder, Gray converter, parity, equality, adder-subtractor) and shows the simplification steps with the laws used (e.g. the consensus theorem in R08 p31).
- Aha: Different-looking gate networks (the 4 half-adder forms, L17 p25) compute the same function.
- Verify use: R08 quizzes, AY21/22 S1 Q13a, AY21/22 S2 Q14(b).
- Conventions: Write ∙ explicitly; 'AB' means a 2-bit value in this course (T06 p2 via the Tutorials guide).

### [3] MUX Tree & DEMUX Visualizer
- Module: MSI (L18)
- Sources: L18 p34-45; R09 p32-37
- Inputs: Build 8:1 from two 4:1 + 2:1 or from four 2:1 + 4:1, or 16:1 from five 4:1; a select value; DEMUX data D and select lines.
- Shows: The active path for the select value (e.g. 110 selects I6, 101 selects I5), with selector-bit placement highlighted. Shows a DEMUX and a decoder with E = D side by side producing identical outputs.
- Aha: Where you put the select bits matters, and a DEMUX is literally a decoder with the data on the enable.
- Verify use: Mux-tree MCQs and the quad 2:1 chip behaviour (E'=1 gives all 0s).
- Conventions: S2 (MSB) goes to the last stage in the p42 build and to the first stage in p44. The quad 2:1 has E' active-low (p41).

### [3] Memory Array Builder
- Module: Memory (L19 section 7)
- Sources: L19 p59-69; R09 p49; R10 p45-49
- Inputs: Total memory (words × bits), chip size (e.g. 1K×8, 512K×8), an address to look up, and Memory Enable plus R/W.
- Shows: The chip grid (rows for depth, columns for width), the address split (top bits → decoder → CS, low bits → every chip), the selected chip and internal address for the given address, and the R/W operation table.
- Aha: The L18 decoder becomes the chip-select logic. Widening memory means chips side by side, deepening it means a decoder.
- Verify use: Capacity, address-bit and chip-count checks.
- Conventions: KB = 2^10 (p59). k address lines give 2^k words (p61-63). Memory Enable=0 means no operation, R/W=0 write, R/W=1 read (p64). SRAM uses flip-flops; DRAM uses capacitors and needs refresh (p65).

## Misconceptions and traps (surface as callouts)
- Complemented literals are NOT available unless stated; constants 0 and 1 are always available and count as SOP/POS. Using A' implicitly costs an inverter. (T07 p2; T07 Ans p1; R08 p34; R09 p51; AY24-25 S1 p8)
- C⊕D is not an SOP expression; when an SOP is asked, write C'·D + C·D'. (T08 Ans p4)
- Common exam mistake (T08 Q4): writing A'BC'D + A'BCD' in a table row where AB is already fixed by the selectors; the entry should be the restricted expression C'·D + C·D'. (T08 p4; T08 Ans p4)
- When a MUX data input could be 0 or Z' because of a don't-care, choose the constant: a constant is simpler than a literal. (T08 Ans p1)
- Once a variable is used on a selector line, do not reuse it on the MUX data inputs. (AY21-22 S1 Questions p9 (Q13c))
- Selector order: S1 (or S2) is the MSB; data-line index = binary value of the selects. Mapping minterms with the wrong order is a classic slip. (L18 p38; L18 guide traps)
- The 74138 has active-low (negated) outputs, so implement F with NAND (1-minterms) or AND (0-minterms), not OR. (L18 p21-24; R09 p19)
- With a 1-enable decoder and no inverters, the enable can only contribute an uncomplemented literal, so a product with no uncomplemented literal (e.g. A'·B'·C') cannot be made. (L18 p15 (F0 = E·X'·Y'); AY23-24 S1 p5 Q9 (derived))
- A plain encoder assumes exactly one input is high; with several highs it outputs the OR of their codes. Priority encoders resolve this, and all-zero input is invalid (V=0). (L18 p26, p30, p32)
- Decimal codes (BCD, Excess-3, 2421, 4221...) are valid only for 0-9, so 4-bit converters have 6 don't-cares. (T07 Ans p4; R08 p7)
- Do not use gate-level (truth-table) design for a 4-bit adder: 9 inputs gives 512 rows. Use block-level cascading. (L17 p19)
- Delay results (S=2t, C=3t per FA) depend on the FA being drawn as 2 half adders + OR; another drawing gives different numbers. (L17 p35; L17 guide traps)
- Active-high (NOR) S-R latch: S=R=1 is invalid because Q and Q' both become 0. For the active-low (NAND) latch, S=R=0 is invalid and S=R=1 is no change. (L19 p9-12; R10 p8, p20 Q1)
- Q' is the complement of Q, not the next state. Q(t)=Q and Q(t+1)=Q+. (R10 p20 Q2)
- Latches are level/pulse-triggered and flip-flops are edge-triggered; don't mix them in definitions. (L19 p8; L19 guide traps)
- Characteristic tables are for analysis (circuit → state table) and excitation tables are for design (state table → FF inputs). (L19 p44; R10 p23)
- 'JA' means the J input of flip-flop A (input letter first, then flip-flop name). (L19 p36)
- State-diagram arrow label a/b means input/output; a state table for m flip-flops and n inputs has 2^(m+n) rows. (L19 p30, p33)
- When tracing a latch or flip-flop circuit, iterate the gates for 3 rounds until values settle. (R10 p6)
- 'Fewest logic gates' is not the same as 'simplest SOP': XOR/XNOR forms with KA=KB=1 beat the SOP in T09 Q2. (T09 p3; T09 Ans p3)
- Inverters are not needed for state variables, because each flip-flop's Q' output gives the complement for free. (AY23-24 S1 Ans p13 (Q18b v))
- In the locker FSM, x and y are separate token lines (xy=10 is P$1, 01 is P$2), not a 2-bit amount. Writing 'dd' on an arc is wrong because it would include 11. (T09 Ans p5)
- Self-correcting is defined in R10, not L19. To check it, commit your don't-cares to the values your final equations give, then trace every unused state. The keys accept a single arc out to a used state as enough. (R10 p40-43; T09 Ans p3; AY23-24 S1 Ans p13)
- Not self-correcting example: an unused-state chain such as 4→1→0→0 never re-enters the used set. You must explain why, or you get no mark. (AY24-25 S1 Ans p13 (Q16b))
- PRE/CLR are asynchronous and override the clock; check the bubble (active-low) before assuming HIGH sets. (L19 p24-25)
- Answer-key erratum: AY23/24 S1 'answers at a glance' disagrees with the worked answer; Q18b should be KB = x. (Past Finals guide section 4; AY23-24 S1 Ans p13)
- Formatting answers: literals in each product term go in alphabetical order, using ' . +; constants 0/1 count as SOP. (AY23-24 S2 Ans p12-13; AY25-26 S1 p11)

## Worked examples (presets and tests)
- **Full adder** (L17 p9; L18 p13): input `XYZ = 011; XYZ = 111` -> expected `C=1,S=0; C=1,S=1 (C = Σm(3,5,6,7), S = Σm(1,2,4,7))`
- **4-bit parallel adder** (L17 p20): input `X=1010, Y=1111, Cin=0` -> expected `C5=1, S=1001 (25)`
- **4-bit parallel adder** (L17 p27): input `A=1011, B=0011, C1=0` -> expected `carry-in row C4..C1 = 0110, S = 1110, carry-out row C5..C2 = 0011`
- **Ripple delay** (L17 p35-38): input `4-bit ripple adder, all inputs at 0, gate delay t` -> expected `S1=2t, C2=3t, S2=4t, C3=5t, S3=6t, C4=7t, S4=8t, C5=9t; 16-bit: S16=32t, C17=33t`
- **BCD to Excess-3** (L17 p14-16): input `BCD 0101; BCD 1001` -> expected `1000; 1100 (W=A+B·C+B·D, X=B'·C+B'·D+B·C'·D', Y=C·D+C'·D', Z=D')`
- **Comparator range** (L17 p33): input `F=1 iff 3 ≤ ABCD ≤ 12` -> expected `Comp1: ABCD > 0010; Comp2: ABCD < 1101; AND → F=Σm(3..12)`
- **Single comparator functions** (T07 Ans p6): input `F=Σm(12-15); G=Σm(0,6,9,15); H=Σm(0,1,6,7,8,9,14,15); Z=Σm(1,3,5,7,9,11,13)` -> expected `F: X=ABCD,Y=1011,X>Y; G: X=ABCD,Y=DCBA,X=Y; H: X=B000,Y=C000,X=Y; Z: X=ABCD,Y=DDDD (or DABC), X<Y`
- **Single comparator MCQ** (AY25-26 S1 Ans p5 (Q8)): input `F1=Σm(2,4,5,6,7,14); F2=Σm(2,4,6,8,9,11,13,15); F3=ΠM(0,2-15)` -> expected `F1: AD < BC; F2: not possible; F3: ABC < D; answer D`
- **Single comparator MCQ** (AY24-25 S1 p4 (Q7); MCQ answer in red not extracted): input `F1=Σm(0..8); F2=Σm(0,2,4,6,9,11,13,15); F3=Σm(0,15)` -> expected `All possible (computed, verify in PDF): ABCD<1001; 000A=000D; ABCD=BCDA`
- **2-bit comparator** (R09 p52 (AY16/17 Q2a)): input `F = Σm(1,4,5,6,7,13)` -> expected `F = (AC < BD)`
- **Multiple-of-17 detector** (R09 p57 (AY18/19 Q5c)): input `8-bit ABCDEFGH = 00110011; 00110100` -> expected `1 (51 = 17·3); 0. Rule: ABCD = EFGH on one 4-bit comparator`
- **(ABCD+1)/2 with one adder** (T07 p3; T07 Ans p3; R09 p5-6): input `ABCD = 0110; 1101; 1111` -> expected `EFGH = 0011; 0111; 1000`
- **4221→8421 via A1H** (T07 Ans p3; R09 p7): input `PQRS = 1001; 1111; 0110; 1100` -> expected `WXYZ = 0101; 1001; 0100; 0110 (A1H inputs 0,P,Q,R → WXY; Z = S)`
- **51A + 20(B%2) in BCD** (T07 p4; Tutorial 7 Answer Q4 p4-7): input `A=0010, B=0111` -> expected `0001 0010 0010 (122); wiring F11..F8=0A3A2A1, F7..F4=0A0B0A0, F3..F0=A3A2A1A0`
- **Binary to Gray (half adders)** (T07 p1 (SE2)): input `10110` -> expected `11101 (P=A, Q=A⊕B, R=B⊕C, S=C⊕D, T=D⊕E; 4 half-adder Sum outputs, computed)`
- **Three half adders** (R08 p37 (AY21/22 S1 Q13a)): input `4-bit ABCD → EFGH` -> expected `E=Σm(8-15), F=Σm(4-11), G=Σm(2,3,4,5,10,11,12,13), H=Σm(1,2,5,6,9,10,13,14)`
- **Excess-3 to excess-11 (base-4 digit)** (AY24-25 S1 Ans p3; T07 Q3 (unanswered)): input `A3A2A1A0 = 0101 (digit 2)` -> expected `1101 (F3=1, F2F1F0=A2A1A0, no gates)`
- **Decoder four ways** (L18 p23-24): input `f(Q,X,P) = Σm(0,1,4,6,7) = ΠM(2,3,5)` -> expected `active-high+OR(0,1,4,6,7); active-low+NAND(0,1,4,6,7); active-high+NOR(2,3,5); active-low+AND(2,3,5)`
- **3x8 decoder + NOR** (AY25-26 S1 Ans p6 (Q11)): input `NOR of outputs D1, D3, D6` -> expected `F = Σm(0,2,4,5,7)`
- **0-enable active-low 2x4 + AND** (AY23-24 S2 Ans p20): input `AY23/24 S2 Q21b circuit (outputs 1 and 3 used)` -> expected `F2 = B' + C`
- **0-enable active-low decoder** (R09 p58 (AY19/20 Q5a)): input `N = A + B + C` -> expected `E'=C, S1=A, S0=B, take output 0`
- **1-enable 2x4 decoder, no gates** (R09 p56 (AY17/18 Q3c)): input `H = Σm(12,13)` -> expected `E=A, S1=B, S0=C, output 2 (A·B·C')`
- **Decoder + XOR** (R09 p53 (AY16/17 Q2b)): input `G = Σm(2,11)` -> expected `EN=C, S1=A⊕D, S0=B, output 0 → C·(A⊕D)'·B'`
- **Decoder product finder** (AY23-24 S1 p5 (Q9)): input `One 2x4 1-enable decoder, no gates: A·B·C, A'·B·C', A'·B'·C'` -> expected `yes, yes, no (computed)`
- **8:1 and 4:1 MUX** (T08 Ans p1): input `F(X,Y,Z) = ΠM(1,5,6)·D(4)` -> expected `8:1: 1,0,1,1,d,0,0,1; 4:1 sel XY: Z',1,0,Z; 4:1 sel YZ: 1,0,X',1 (last computed)`
- **4:1 MUX reserved variable** (L18 p52-55): input `F(A,B,C)=Σm(0,1,3,6)` -> expected `sel AB: 1, C, 0, C'; sel BC (A on data): A', A', A, A'`
- **4:1 MUX selector choice** (AY23-24 S2 Ans p20 (Q21a)): input `F1(A,B,C)=Σm(0,2,3,5,6,7)` -> expected `selectors AC; data 1,B,B,1`
- **4:1 MUX MCQ** (AY23-24 S1 Ans p5 (Q10)): input `F1=Σm(3,4,5,7); F2=Σm(0); F3=Σm(0,2,6)` -> expected `F1: sel AB data 0,C,1,C; F3: sel AC data 1,0,B,0; F2 impossible`
- **8:1 MUX no gates** (R09 p55 (AY17/18 Q3b)): input `G = ΠM(1,2,6,8,9,11,13)` -> expected `sel ACD, data 1,B,0,1,B,0,1,B`
- **74151A with 4 variables** (L18 p56): input `f = Σm(0,1,2,3,4,9,13,14,15), sel x1x2x3` -> expected `data 1,1,x4',0,x4,0,x4,1 (computed)`
- **8:1 from smaller muxes** (L18 p43-44): input `S2S1S0 = 110 (two 4:1 + 2:1); 101 (four 2:1 + 4:1)` -> expected `I6; I5`
- **Priority encoder 4-to-2** (L18 p32-33): input `D0..D3 = 1010; 0000` -> expected `fg=10, V=1; V=0. f=D2+D3, g=D3+D1·D2', V=D0+D1+D2+D3 (computed)`
- **Priority encoder (exam)** (T08 Ans p5): input `T08 Q5 circuit` -> expected `H2 = A + B, H1 = A + B'·C, H0 = 1`
- **16-to-4 encoder** (AY23-24 S2 Ans p6 (Q15)): input `output Y (bit 1)` -> expected `Y = D2+D3+D6+D7+D10+D11+D14+D15`
- **Adder + MUX** (T08 Ans p4): input `T08 Q4 circuit, G per AB` -> expected `AB=00: 0; 01: C'·D + C·D'; 10: D; 11: 1`
- **Mixed MSI traces** (AY23-24 S1 Ans p11): input `AY23/24 S1 Q17c, d, e` -> expected `NAND; R=Σm(0,3,12,15); S=Σm(2,7,10,15)`
- **Mixed MSI traces** (AY23-24 S2 Ans p20): input `AY23/24 S2 Q21c, d, e` -> expected `F3=Σm(10,11,14,15); F4=Σm(5,7,9,11,12,14); F5=C+D`
- **Decoder expansion** (R09 p18; L18 p17): input `4x16 from 2x4 with enable` -> expected `5 decoders ((16-1)/(4-1)); 3x8 = two 2x4 + 1 inverter`
- **S-R latch trace** (L19 p10-11): input `start Q=1; S=0,R=1; then S=R=0; then S=R=1` -> expected `Q=0,Q'=1; stays 0/1; Q=Q'=0 (invalid)`
- **Excitation tables** (L19 p45): input `Q→Q+ = 0→0, 0→1, 1→0, 1→1` -> expected `JK: 0X,1X,X1,X0; SR: 0X,10,01,X0; D: 0,1,0,1; T: 0,1,1,0`
- **Analysis, D flip-flops (Fig 1)** (L19 p31-34): input `A+=A·x+B·x, B+=A'·x, y=(A+B)·x'` -> expected `x=0: all states → 00, y=0,1,1,1 for 00,01,10,11; x=1: 00→01, 01→11, 10→10, 11→10, y=0`
- **Analysis, JK (Fig 2)** (L19 p38-40): input `JA=B, KA=B·x', JB=x', KB=A⊕x` -> expected `ABx 000→01, 001→00, 010→11, 011→10, 100→11, 101→10, 110→00, 111→11`
- **Analysis, JK (Fig 3)** (L19 p41-43 (y read from table)): input `JA=B, KA=B', JB=KB=(A⊕x)'` -> expected `ABx 000→01,001→00,010→10,011→11,100→00,101→01,110→11,111→10; y=1 on rows 001,010,100,111`
- **Design with JK** (L19 p47-51): input `L19 Design Ex 1 state diagram` -> expected `JA=B·x', KA=B·x, JB=x, KB=(A⊕x)'`
- **Design with D** (L19 p52-54): input `L19 Design Ex 2 state table` -> expected `DA=A·B'+B·x' (Σm(2,4,5,6)), DB=A'·x+B'·x+A·B·x' (Σm(1,3,5,6)), y=B'·x`
- **Design with SR + unused states** (L19 p55-58; R10 p42-43): input `L19 Design Ex 3 (unused 0,6,7)` -> expected `SA=B·x, RA=C·x', SB=A'·B'·x, RB=B·C+B·x, SC=x', RC=x, y=A·x; 0→1/2, 6→7/4, 7→1/4 (x=0/1, computed); self-correcting`
- **T+D analysis** (T09 Ans p1): input `p=A·B+A'·B', TA=A·B', DB=A'+B; start 0, 3 clocks` -> expected `0→1, 1→1, 2→0, 3→3; ends in state 1, outputs 1,0,0; sinks: 1 and 3`
- **JK design, fewest gates** (T09 Ans p2-3): input `T09 Q2 (x=0: 0→1→2→0; x=1: 0→2→1→0)` -> expected `JA=B⊕x, KA=1, JB=(A⊕x)', KB=1; unused 3→0 on x=0,1; self-correcting`
- **Mixed D/T/JK design** (T09 Ans p4): input `T09 Q3: 1→3→5→7→9→11→13→15→2→4→6→1` -> expected `DA=A·B'+A·C'+A'·B·C·D, TB=C, TC=A'+B'+C', JD=B·C, KD=A·B·C; unused 0→2, 8→10→12→14→3 (computed); self-correcting`
- **Locker FSM with D** (T09 Ans p5): input `T09 Q4 (x=P$1, y=P$2, saturate at 3)` -> expected `DA=A+y+B·x; DB=B·x'+B'·x+A·y+A·x (or +A·B)`
- **Mealy trace** (T09 p1): input `T09 SE1 table, start A, x=100010` -> expected `states A,A,C,B,D,D,C; z=1,0,1,1,0,0 (computed, no key)`
- **Analysis + self-correct + T redesign** (AY24-25 S1 Ans p13): input `JA=B, KA=1, JB=A·C, KB=0, DC=A+B; used 2,3,5,6,7` -> expected `2→7, 3→7, 5→3, 6→3, 7→3; unused 4→1→0→0, not self-correcting; T redesign TA=1, TB=B', TC=C'`
- **JK design 3 states** (AY23-24 S2 Ans p19): input `AY23/24 S2 Q20 (states 1,2,3, input C)` -> expected `JA=1, KA=0, JB=C, KB=A'+C'; 1 gate; state 0 → 2 (C=0), 3 (C=1)`
- **D+T next states and JK design** (AY23-24 S1 Ans p13): input `AY23/24 S1 Q18` -> expected `(a) 0→2, 1→1, 2→3, 3→3; (b) JA=B'·x, KA=0, JB=0, KB=x; 1 gate; state 3: x=0→3, x=1→2; self-correcting Yes`
- **Mixed JK/T/D** (R10 p61-63 (AY15/16 Q7)): input `0→1→2→3→4→5→5` -> expected `JA=B·C, KA=0, TB=A'·C, DC=A+C'; unused 6→7, 7→7; not self-correcting`
- **Redesign with D** (R10 p66): input `AY20/21 Q12b` -> expected `DF = F'·x' + F·G, DG = G'·x'`
- **State table to SOP** (AY25-26 S1 Ans p10): input `AY25/26 Q16 table (X0 MSB)` -> expected `A+ = B·X0'·X1, B+ = A'·B'·X0·X1, G = A`
- **Johnson counter** (AY23-24 S2 Ans p6 (Q14)): input `WXYZ start 0001, Q' of last fed back` -> expected `1→0→8→12→14→15→7→3→1`
- **Johnson counter decode** (AY19-20 S2 p3 (Q4b)): input `4 D FFs, start 0000` -> expected `0000→1000→1100→1110→1111→0111→0011→0001→0000 (8 states); State(0)=A'·D' (given), State(1)=A·B', State(2)=B·C' (computed)`
- **Memory array** (L19 p68): input `4K×8 from four 1K×8; address 2500` -> expected `12 address bits; A11A10 → 2x4 decoder; chip 2 (2048-3071), internal address 452 (computed)`
- **Memory array** (L19 p69): input `2M×32 from 512K×8` -> expected `16 chips (4 rows × 4 wide), 21-bit address, A20A19 → 2x4 decoder, 19-bit chip address`
- **JK recall** (AY25-26 S1 Ans p7 (Q13)): input `J and K tied together` -> expected `T flip-flop`
- **Analysis quiz** (R08 p31): input `F = (a·b) ⊕ (b + c)` -> expected `F = a'·b + b'·c`

## Gaps or ambiguities
- The scope names 'counters' and 'registers', but neither is taught by name. L19, T09 and R10 contain no 'counter' or 'shift register'; there is only parallel data transfer with D FFs (L19 p20). Exams still use them: the Johnson counter in AY23/24 S2 Q14 and a Johnson-style 4-D-FF circuit with CLR in AY19/20 Q4b. Present them as plain D-FF analysis.
- Self-correcting is defined only in R10 p40-43 (and T09 p3), not in L19. The course view is ambiguous: keys say 'Yes' if an arc leads out of an unused state, even when another input keeps the circuit there (AY23/24 S1 Q18 state 3). The app should show both a strict and a course verdict.
- Many circuit diagrams are lost in the text extracts: T08 SE1-SE3, T08 Q2 answer wiring, T08 Q4 adder wiring, the T08 Q5 encoder wiring (the key H2=A+B, H1=A+B'·C, H0=1 fits F7=A, F5=B, F3=C, F1=1, which is my inference), the L17 p29 voting values, R08 quiz 2 gate delays (p32), R10 quizzes (p51-58), AY24/25 Q6 decoder wiring, and the custom F flip-flop in AY21/22 S1 Q12b. Check the PDFs before turning these into presets.
- The T09 Q3 state order is unreadable in the text (only the set of numbers survives). I rebuilt the cycle 1→3→5→7→9→11→13→15→2→4→6→1 and the unused transitions (0→2, 8→10→12→14→3) by evaluating the key's equations; confirm against the PDF diagram.
- MCQ answers for AY24/25 and AY25/26 are only in red in the PDFs. AY24/25 Q7 (all three comparator functions possible) and AY23/24 S1 Q9 (option A) are my computations, not the key.
- The L19 Fig 3 output y is not stated as an equation. From the state table, y = 1 on rows 001, 010, 100, 111 (y = A⊕B⊕x), but the circuit diagram is image-only (p41).
- The 74138 and 74151A function tables and pinouts (L18 p21-22, p46-47, p50) are images. Enable polarities and the W output need checking in the PDF before the app models these chips exactly.
- The simplified f, g, V for the L18 p33 priority encoder are left as an exercise. f=D2+D3, g=D3+D1·D2', V=D0+D1+D2+D3 are computed, not printed in the source.
- T07 Q3 and all SE questions in T07, T08 and T09 have no answers in the folder. Values given for T07 SE1/SE2 and T09 SE1 are computed. The AY24/25 S1 key (p3) covers a converter equivalent to T07 Q3.
- Memory arrays (L19 p59-69) never appeared as a question in the past-finals inventories, so they rank low. Lab files cover only Weeks 3-8, with no logic-trainer lab text for L17-L19.
- The decoder-count formula (2^n−1)/(2^k−1) comes from a third-party student cheatsheet ('Finals Notes'), not course slides. It agrees with R09 p18 (five 2x4 decoders for a 4x16).
