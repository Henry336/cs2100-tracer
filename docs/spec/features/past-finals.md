# Feature sweep: past-finals

Raw research output. Priority 1 = high exam value or high confusion.

## Features (21)
### [1] Pipeline timeline and stall counter (hazard tracer)
- Module: Pipelining (L20-L21)
- Sources: AY24/25 Q19 (Ans p10, p17); AY25/26 Q19 (Ans p16); AY23/24 S2 Q17 (Ans p9-10, per-instruction delay table p16-17); AY23/24 S1 Q16 (Ans p8-9); AY21/22 S1 Q15 (p12); AY21/22 S2 Q16 (p10); AY20/21 Q16 (p11); AY19/20 Q7 (p7-8); AY18/19 Q7 (p10-11); AY17/18 Q6 (p7); AY15/16 Q11c-d (p6); R11 Addendum p2-5 (works AY24/25 Q19 and AY25/26 Q19); L20 p32; L21 p21-26, p33-45
- Inputs: Paste MIPS with labels and '# I5'-style tags (kept as row names). Toggles: forwarding on/off; branch decided in MEM (stage 4) or ID (stage 2); branch handling = stall/no prediction, predict-not-taken, or delayed branch (1 slot); j target resolved in ID (default, as the papers state) or MEM (T10's assumption). Branch outcomes come from a linked MIPS trace (feature 3) or are set by hand per dynamic instance. Scope: first iteration only / full run / 'count until last stage of instruction X'. Answer mode: total cycles, additional cycles over ideal, number of stall cycles, or nop count and placement. Presets for every paper listed in Sources.
- Shows: A cycle-by-cycle IF/ID/EX/MEM/WB grid with bubbles coloured by cause (RAW data, load-use, control). Arrows run from the producing stage to the consuming stage: WB to ID without forwarding; EX/MEM to EX with forwarding; MEM to EX for lw; ALU to ID or MEM to ID for early branches. A right-hand delay column (+1/+2/+3 per instruction), shown for settings (b)/(c)/(d) side by side, matches the layout of the AY23/24 S2 key. Headline numbers: ideal = I+4 with I the dynamic count, then extra and total. Nop mode turns the remaining stalls into explicit nops. What-if mode edits one instruction (part (e) of the AY24/25 and AY25/26 template) and diffs the totals. Reorder mode tries moving one instruction and reports cycles saved (AY21/22 S1 Q15e, S2 Q16e, AY20/21 Q16e, AY18/19 Q7e).
- Aha: A distance-2 RAW still costs 1 cycle without forwarding, because the register file writes in the first half of the cycle and reads in the second. lw followed by its consumer still costs 1 cycle with forwarding. Early branching can backfire: an ALU result feeding the branch costs 1 stall and a lw feeding it costs 2 (L21 p37-39). Predict-not-taken only costs a cycle when the branch is taken. The last j's own stall is not counted when you count until j's last stage.
- Verify use: The student types the paper's code and picks the paper's settings. The tool returns the single integer the paper asks for, labelled as total or additional, since papers switch between them: AY25/26 (a) asks additional delay, (b) asks total; AY21/22 S2 writes the answer as '+20'. It also returns the per-instruction delay list, so the student can compare it with a hand-drawn chart.
- Conventions: 5 stages, 1 cycle each. Ideal = I + N - 1 = I + 4 (L20 p32; AY25/26 Ans p3). Without forwarding, a consumer's ID may share the producer's WB cycle: adjacent RAW = 2 stalls, distance 2 = 1 stall (AY25/26 Ans p16; AY23/24 S2 Ans p16 'students may miss the +1 for i6'). With forwarding: ALU to ALU = 0, load-use = 1 (AY24/25 Ans p17). Branch at MEM with no prediction: +3 after every branch; with forwarding, a branch fed by an ALU result adds nothing more (AY23/24 S2 Ans p17 columns b, c). Branch at ID with no prediction: +1 after every branch. Predict-not-taken: +1 only when taken (L21 p40, p44-45). Early-branch data stalls: ALU producer immediately before = +1, lw immediately before = +2 (L21 p37-39; confirmed by AY23/24 S1 Ans p9 40/29/27). j computing its target in ID = +1 for the next instruction (stated in the papers). Count to the WB of the named instruction. WAR/WAW never stall (L21 p14). Predict-taken (AY15/16 Q11d, AY19/20 Q7f), the hazard-detection unit and forwarding-unit signals (AY23/24 S1 Q19) are not taught (L21 p40; guides/Past Finals section 3a): show them only behind an 'off-syllabus' label.

### [1] Dependency lens: RAW / WAR / WAW / control / structural classifier
- Module: Pipelining (L21)
- Sources: AY25/26 Q4 (Ans p3); AY24/25 Q12 (Ans p5, p17); AY23/24 S1 Q5, Q12 (Ans p4, p6); L21 p12-14; R11 p8-9; guides/Past Finals section 4 (AY25/26 Q4 key conflict)
- Inputs: A 2-10 instruction snippet, or the program loaded in feature 1. Click any instruction pair, or scan the whole snippet.
- Shows: A register-use matrix (rows = instructions, columns = registers, W/R badges) and arcs between instructions. RAW arcs are solid red ('true dependency: stall or forward'); WAR and WAW arcs are dashed grey; control arcs run from a branch to the instructions after it. Structural hazards are shown as absent because instruction and data memories are split. Each WAR/WAW arc has an animation showing that in-order issue plus in-order WB means the later write always lands last and reads happen in ID before later WBs, so the program stays correct. Callout: 'L21: no hazard in this pipeline. AY25/26 key: answer E (WAW).'
- Aha: Dependencies and hazards are different things. Only RAW and control cause stalls in the course pipeline. WAR and WAW only matter with out-of-order execution (superscalar).
- Verify use: For the 'which hazard type' MCQ, the tool lists every dependency type present, which of them the lecture model counts as a hazard, and which letter the examiners keyed. For the 'three types of hazards' recall MCQ it gives Structural, Data, Control.
- Conventions: L21 p13: RAW is the true dependency. L21 p14 and R11 p9: WAR/WAW 'do not cause any pipeline hazards' in this in-order pipeline. Even so, the AY25/26 Q4 key answers E (WAW). An exam clarification changed that snippet's 2nd instruction to addi (Ans p3). AY24/25 Q12 key: A.

### [1] MIPS step tracer (registers, memory, dynamic trace, loop-to-C view)
- Module: MIPS (L06-L08)
- Sources: AY23/24 S2 Q6, Q16a-d (Ans p3-4, p7-8, p16); AY24/25 Q18a-b (Ans p9, p15); AY23/24 S1 Q1 (Ans p2-3 instruction-count table); AY21/22 S1 Q11, Q14a-b (p7, p10-11); AY21/22 S2 Q8, Q15a-b (p4, p8-9); AY20/21 Q4-5, Q14 (p3, p8-9); AY19/20 Q1 (p2); AY18/19 Q1a-c, e (p2); AY17/18 Q5b-c, Q6a (p6-7); AY16/17 Q3d (p3); AY15/16 Q11a-b (p6)
- Inputs: Code in paper style: .data/.word, la/li, and syscall print_int/exit as used in AY21/22 and AY24/25. Initial registers, array contents, breakpoints, step / run / run-to-iteration-k.
- Shows: Current instruction highlighted. A register panel that flashes changed registers (hex and decimal). An array view with element index and byte address. Branch taken/not-taken with an arrow to the target. Dynamic instruction count, both per instruction and in total (the AY23/24 S1 Ans p3 table). Iteration counter. A loop-shape overlay that maps init / condition / body / update onto a C for/while skeleton, for the 'not line-by-line' C translation parts. The dynamic trace exports to feature 1 (pipeline), and the fetch and data address streams export to feature 5 (cache).
- Aha: Bit tricks such as andi 3 then srl 1 equal (i%4)/2. The slt+beq idiom implements <. One program drives the MIPS, pipeline and cache questions of the same paper.
- Verify use: Outputs in paper format: final arrays as comma lists without spaces (AY23/24 S2 Q16d '10,12,18,20,555,666,777,888'), single values (k, $t2), printed output, and min/max or possible dynamic instruction counts (AY21/22 S2 Q8 MRQ, AY17/18 Q6a).
- Conventions: andi/ori/xori zero-extend; addi/slti sign-extend (L06; AY25/26 Ans p7). Writes to $zero are ignored (AY21/22 S2 Q10). lw must be word-aligned, lb need not be (AY21/22 S2 Q9). Recent MCQs write 'bne $s0, 0, Loop': read 0 as $zero (inventory AY23/24 S2-AY25/26 section 4.8). AY23/24 S1 Q12 writes slt with an immediate: treat it as slti. Endianness is never stated (AY18/19 Q1f): make it a toggle.

### [1] Instruction encoder/decoder with branch and jump address calculator
- Module: MIPS encoding (L08), linked to control (L12)
- Sources: AY23/24 S2 Q16e-h (Ans p8, p16); AY24/25 Q15, Q18c-f (Ans p6, p9-10, p16-17); AY25/26 Q6, Q7, Q14, Q15 (Ans p4, p7-8); AY21/22 S1 Q8, Q10, Q14c-e (p6, p11); AY21/22 S2 Q15c-d (p9); AY20/21 Q8, Q14d-f (p4, p9); AY19/20 Q1d-e, Q3 (p2); AY18/19 Q1d, Q3b, Q3e (p2-3); AY17/18 Q4a, Q5d-f (p5-6); AY16/17 Q3a-c (p3); AY15/16 Q10a (p5)
- Inputs: Encode mode: an assembly line plus its address, given either directly or as 'I1 is at X and this is instruction n' (e.g. I1 at 0x00400050, or j at 0x00400078), with labels resolved. Decode mode: an 8-hex-digit word, optionally with its PC.
- Shows: Colour-coded fields with widths (R: 6|5|5|5|5|6, I: 6|5|5|16, J: 6|26) and a register name-to-number lookup. For branches: PC, PC+4, target, offset = (target - (PC+4))/4 in decimal and as a 16-bit two's complement value. For j: target address with the top 4 and bottom 2 bits dropped, plus a check that the top 4 bits of PC+4 match (reachability). Decode mode gives the assembly, the instruction type, ALUop and ALUControl, and the effective branch target. A 'likely mistakes' row shows the wrong encodings the keys list: PC instead of PC+4 (0x1180000C) and rs/rt swapped in sw (0xAE890000).
- Aha: In I-type, rt is the destination for lw/addi/lui, but the stored data for sw. Branch offsets count instructions from PC+4. j is pseudo-direct. lui has rs = 0.
- Verify use: Produces the exact answer string. Examplify style: 8 hex digits, no 0x, capitals ('0110482A'; the key also accepts lowercase). Paper style: 0x0040 0048. For MCQs like 'which encoding is equivalent', every option is decoded and its effective target compared (AY25/26 Q15).
- Conventions: Opcode and funct values from the paper's MIPS reference sheet. shamt = 0 for slt (AY23/24 S2 p8). lui: opcode 0xF, rs = 0 (AY25/26 Ans p4). Offset is relative to PC+4 (AY24/25 Ans p16). j keeps the upper 4 bits of PC+4 (L08).

### [1] Cache simulator: direct-mapped / set-associative / fully associative with LRU
- Module: Cache (L22-L23)
- Sources: AY23/24 S1 Q14, Q20 (Ans p7, p15-18); AY23/24 S2 Q18 (Ans p10-11, p17-18); AY21/22 S1 Q16 (p13-14); AY21/22 S2 Q17 (p11-12); AY20/21 Q15 (p9-10); AY19/20 Q8 (p9); AY18/19 Q6 (p8-9); AY17/18 Q7 (p8); AY15/16 Q12 (p6); L22 p28-49; L23 p10-17, p28-34; R12
- Inputs: Geometry: total words or bytes, words per block, ways (1 / n / fully associative); 32-bit byte addresses, 4-byte words. Trace source: (a) a manual hex address list tagged R/W; (b) an array generator with base address, element count, stride, per-iteration access template (e.g. lw A[i], lw B[i], sw A[i]; B[2i]; descending index) and 'B follows A immediately'; (c) the data stream or instruction-fetch stream imported from feature 3, including the start address (e.g. 0x2B000FFC). Toggles: lw-only vs include sw, write-hit policy, write-miss policy. LRU only; FIFO and random appear greyed as non-exam (L23 p31).
- Shows: One row per access: the address in binary split into tag | index | offset (colour-coded), block number, set, hit/miss, and miss type (cold / conflict / capacity, with capacity found by a fully associative shadow cache as in L23 p28). Also per access: LRU stack per set, valid/dirty bits, and running per-array hit counts and fractions. Final contents table in 'M[0x1020]' notation with tags as 0x%08x. An array-layout strip shows where each array's blocks land: the distance between arrays mod cache size, and which element pairs clash (e.g. A[925] vs C[463]). A per-set occupancy view shows thrashing when 3 loop blocks share a 2-way set.
- Aha: Arrays whose separation is a multiple of the cache size thrash in a direct-mapped cache but coexist in a 2-way cache. A code start at ...FFC puts I1 alone in its own block. Bigger instruction blocks can cause more misses when three hot blocks compete for one 2-way set (computed for AY21/22 S2 Q17b).
- Verify use: Outputs in the exact formats: an (index, offset) pair as '7,4'; per-array hit counts; hit rates as fractions ('7/8'); total I-cache misses; the final cache grid with tags and M[...] words, way 0 holding the lower address.
- Conventions: offset = log2(block bytes); index = log2(#sets); tag = 32 - index - offset (R12 p47). When the way is ambiguous, the lower address goes in way 0 (AY23/24 S1 Ans p17). sw policy varies by paper: AY23/24 S1 never stated one, and its key assumed allocate but also accepted ignoring sw (Ans p17-18); AY21/22 S2, AY20/21 and AY19/20 say lw only; AY18/19 and AY17/18 include sw. Keys accept ranges where a few rare clashes exist (AY23/24 S2 Ans p17-18: 248-250, 191-192, 190-192).

### [1] Cache geometry and tag-bits calculator (MCQ speed tool)
- Module: Cache (L22-L23)
- Sources: AY24/25 Q14 (Ans p6, p17); AY25/26 Q9 (Ans p5; R12 p47); AY23/24 S1 Q15 (Ans p7); AY15/16 Q4 (p3); AY16/17 Q6d-e (p8); the (a) parts of AY18/19 Q6, AY19/20 Q8, AY20/21 Q15, AY21/22 S1 Q16, AY21/22 S2 Q17, AY23/24 S2 Q18
- Inputs: Cache size (B/KB/MB or words), block size (bytes or words), associativity, address width (default 32), write-back yes/no.
- Shows: The working chain from #blocks to #sets to bit counts. A 32-bit ruler marking the tag [31..x], set and offset ranges in the exact MCQ wording. Total SRAM = data + blocks x (tag + valid [+ dirty]), and tag bits per set.
- Aha: Raising associativity moves bits from the index into the tag. The offset counts bytes, not words.
- Verify use: Answers the tag-bits MCQ with R12 p47-style working: 19 for AY24/25, 20 for AY25/26, and the bit ranges 31-13 / 12-4 / 3-0 for AY23/24 S1.
- Conventions: Byte-addressed with 32-bit addresses; bit 0 = LSB (AY23/24 S1 Q15). Dirty bit only for write-back (L22 p68). A valid bit for every block (L22).

### [1] Cache performance and miss-penalty calculator (memory sends one word at a time)
- Module: Cache performance (L22 p20-21, L23 p5, R12 p44-48)
- Sources: AY24/25 Q20 (Ans p11, p17; R12 p44-45); AY25/26 Q20 (Ans p17; R12 p48); AY16/17 Q6a-c (p8); L22 p20-21
- Inputs: Block size, word size, cycles per word transfer, whether the +1 restart counts, hit time, hit rate, fraction of instructions that access data, instruction count, instruction type (lw/sw/beq/R).
- Shows: A timeline of words-per-block transfers x k cycles (+1 restart) adding up to the miss penalty. A 5-stage bar for the instruction whose MEM stage stretches on a miss. Results: lw hit = 5; lw miss = penalty + 4 (restart included) or penalty + 5; beq = 5 whatever the cache does; cycles lost = accesses x miss rate x penalty; AMAT = h x hit + (1-h) x penalty. Cards explain the True/False parts.
- Aha: The miss penalty is set by memory bandwidth, not by associativity or CPU speed. 'Cycles' and 'absolute time' are different quantities.
- Verify use: Plug in each paper's numbers to get 40/5/45/64 (41/46/66 accepted) for AY24/25 and 21/5/25/5/False for AY25/26.
- Conventions: Miss penalty = time to replace the block + hit time (L22 p20). AY24/25 accepts with-restart and without-restart variants (Ans p17); AY25/26 fixes 'restart included' (Ans p17). The AY25/26 (e) key reasons from search time, which is about hit time (guides/Past Finals section 4).

### [1] K-map PI/EPI explorer with exam-syntax output
- Module: Simplification (L15, T06, R07)
- Sources: AY25/26 Q1, Q17a (Ans p2, p11-12); AY24/25 Q3-4, Q17a (Ans p2-3, p8, p14); AY23/24 S2 Q19 (Ans p11, p19); AY23/24 S1 Q7, Q17a-b (Ans p4, p10-11); AY21/22 S1 Q5 (p3); AY21/22 S2 Q5, Q14c (p3, p7); AY20/21 Q1-2 (p2); AY25/26 Q17b BCD-to-7-segment (Ans p11-13)
- Inputs: Sigma m + d, Pi M . D (the T06 notation), a clickable K-map, or an expression. Variable names and order (A,B,C,D / W,X,Y,Z / P,Q,R,S); 2-5 variables. Combinations such as H = F.G from Sigma and Pi forms (AY25/26 Q17a). Don't cares for 10-15 in BCD designs.
- Shows: A Gray-coded K-map labelled as in the papers (AB rows, CD columns). Every PI drawn as a coloured loop; groups made only of don't cares appear greyed and labelled 'not a PI'. Each EPI marked with the minterm that makes it essential. PI and EPI counts. A list of every minimal SOP cover, with the count (e.g. 3). POS found by grouping the zeros. Step reveal: ones, then largest groups, then essentials, then cover the rest.
- Aha: The EPIs alone may not cover the function; a function can have 0 EPIs. A don't care is only used when it enlarges a group.
- Verify use: Answers 'how many PIs/EPIs' MCQs and the count of simplified SOPs. Emits the answer strings (literals alphabetical, ', . and +, EPIs first when asked) and hands them to feature 10 for checking.
- Conventions: A group of only don't cares is not a PI (AY23/24 S2 Ans p19 'CD is not a PI'; AY24/25 Ans p14 'B.D is not a PI'; T06). Literals alphabetical within each term (AY23/24 S2 p11; AY25/26 p11). AY23/24 S1 Q7(iv) is false: EPIs alone need not give the simplest SOP.

### [1] FITB answer linter and Boolean equivalence checker
- Module: Exam answer formats (logic and numeric fill-in-the-blank)
- Sources: AY23/24 S2 rules (Ans p7-8, p11-14); AY23/24 S1 rules (Ans p8, p10, p12, p14-15); AY25/26 Q17 note (p11); AY24/25 Q17 note (p8); AY21/22 and AY20/21 MRQ rules (AY21/22 S1 p5)
- Inputs: A question-type selector, the student's typed answer, and the target, which comes from another tool or a past-paper preset.
- Shows: A syntax check per rule: capital letters; ' for NOT, . for AND, + for OR; no spaces or extra punctuation; literals alphabetical inside each product; constants 0/1 allowed; no trailing full stop; EPIs first when the question requires it. Logical equivalence through a truth-table diff, with differing minterms highlighted. A minimality check (literal and term counts vs the minimum). Format validators: ascending minterm lists '2,5,6'; pairs 'index,offset'; 8 hex digits without 0x; binary strings of exact length, X for don't care with the correct number of X's; 'M[0x1020]' and '0x00000081'; a single decimal; a register number only ('8'); MUX selectors written S1 then S0 ('AC'); C statements without spaces or semicolons ('C[k]=A[i]+B[i]'); MRQ letter sets.
- Aha: A logically correct answer can still lose marks on format: 'X+Z.Y'' is rejected because the literals in Z.Y' are not in alphabetical order.
- Verify use: Paste an exam-style answer and get PASS/FAIL with the specific rule or minterm that fails.
- Conventions: AY23/24 S2 p12: 'Y'.Z+X' is accepted, 'X+Z.Y'' is not, and constants count as SOP. The AY23/24 S2 key prints Q19(d) strings without dots ('B'D+A'B+BD'', Ans p19): accept them with a warning. AY23/24 S1 Q19 needs binary strings of the correct length. MRQs are all-or-nothing.

### [1] MSI component lab: decoder, MUX, encoder / priority encoder, magnitude comparator, adders
- Module: Combinational / MSI (L17-L18)
- Sources: AY25/26 Q8, Q11, Q17b (Ans p4-6, p11-13); AY24/25 Q5-7, Q17b-c (Ans p3-4, p8, p14); AY23/24 S2 Q15, Q21 (Ans p6, p13-14, p20); AY23/24 S1 Q9-10, Q17c-e (Ans p5, p10-11); AY21/22 S1 Q13 (p9); AY21/22 S2 Q6, Q14 (p3, p7); AY20/21 Q11, Q13 (p5, p7); AY19/20 Q5-6 (p4-6); AY18/19 Q5 (p6-7); AY17/18 Q3 (p4); AY16/17 Q2 (p2); AY15/16 Q8 (p4); guides/Past Finals section 2
- Inputs: Pick a component and its options: decoder size, 1-enable or 0-enable, active-high or active-low outputs; MUX size; comparator width; HA / FA / 2-bit parallel adder; a custom function table (priority encoder, 4-to-2 encoder, Count-1, F-block). Wire each pin to a variable, a constant, or another block's output. Optional toggle: no complemented literals. Optionally add one output gate.
- Shows: A live truth table, minterm list and simplified SOP. Active-low outputs explained as maxterms. MUX planner: for a chosen selector pair, the residual input column (0, 1, X or X') with X' flagged as needing a gate. Search modes: 'which selector pair needs no gates'; 'which functions one comparator can implement', enumerating X<Y, X=Y, X>Y over wirings; 'which products one 2x4 decoder with enable can make'; 'can this be built with no gates' for code converters (AY24/25 Q5).
- Aha: Active-low outputs fed to an AND give a product of maxterms. A comparator can implement 'ABC < D' or 'A = D' purely by how it is wired. In BCD x 2^k circuits a code converter is just rewiring.
- Verify use: Checks Sigma m and SOP answers for circuit-trace questions, and screens MCQ options (i)/(ii)/(iii) automatically.
- Conventions: 'Constants 0 and 1 available, complemented literals not' (AY24/25 p8; AY25/26 p11). 'Once a variable is on a selector, do not use it on the inputs' (AY21/22 S1 p9; AY20/21 p7). Encoder and priority-encoder tables are given in the papers (AY23/24 S2 p14; AY24/25 p8). S1 is the selector MSB.

### [1] Sequential circuit workbench: analysis and design with mixed D/T/JK flip-flops
- Module: Sequential (L19, T09, R10)
- Sources: AY25/26 Q13, Q16 (Ans p7, p9-10); AY24/25 Q16 (Ans p7, p13); AY23/24 S2 Q14, Q20 (Ans p6, p12, p19); AY23/24 S1 Q18 (Ans p12-13); AY21/22 S1 Q12 (p8); AY21/22 S2 Q13 (p6); AY20/21 Q12 (p6); AY19/20 Q4 (p3); AY18/19 Q4 (p5); AY17/18 Q2 (p3); AY16/17 Q1 (p2); AY15/16 Q7 (p4)
- Inputs: Analysis mode: flip-flop type per bit and its input equations (with external input), or a state table. Design mode: a state diagram (drag states, label arrows with input values) or a state sequence, a flip-flop type per bit, and unused states marked as don't cares. State numbering = binary of ABC, MSB first, with an override for clarifications such as 'X0 is MSB'.
- Shows: The state table with present-state, next-state and FF-input columns filled from the excitation tables (JK: 0->0 = 0X, 0->1 = 1X, 1->0 = X1, 1->1 = X0). A K-map and simplified SOP for each FF input. The generated state diagram. Unused-state transitions recomputed from the simplified equations. A self-correcting verdict with the escape path drawn. A gate count that treats Q' as free (no inverters). A clock-step animation.
- Aha: The don't-care choices made during design decide where the unused states go. A JK with J and K tied together is a T flip-flop. A Johnson counter can be found just by tracing the flip-flops.
- Verify use: Gives JA, KA, JB, KB strings in FITB syntax, next state from an unused state, Yes/No self-correcting with the reason, minimum gate count, and state sequences for MCQs.
- Conventions: JK excitation table as in AY23/24 S2 Ans p19. Q' is available, so a B' term needs no inverter (AY23/24 S1 Ans p13). Self-correcting means every unused state eventually reaches a used state; the key gives 1 mark for the answer and 1 for the reason (AY24/25 Ans p13). Unused-state behaviour must come from your own simplified equations (AY18/19 Q4b, AY17/18 Q2b). Johnson and ring counters are not named in L19 (guides/Past Finals section 3a).

### [1] Datapath and control explorer: fault injection and new-instruction design
- Module: Datapath / Control (L11-L12)
- Sources: AY25/26 Q7, Q18 (Ans p4, p13-15); AY24/25 Q15 (Ans p6, p17); AY23/24 S2 Q8-11 (Ans p4-5); AY21/22 S1 Q4 (p3); AY21/22 S2 Q4, Q11 (p3, p5); AY20/21 Q8, Q10 (p4-5); AY19/20 Q3c (p2); AY18/19 Q3 (p3-4); AY17/18 Q4b-d (p5); AY16/17 Q5 (p7); AY15/16 Q9 (p4); L11 p6; L12 p16-27
- Inputs: An instruction (assembly or hex), register and memory values. Fault toggles: a signal stuck at 0 or 1, inverted MemToReg, an instruction bit stuck at 0. Design mode: add a row and column for bne, j, blt or bgt.
- Shows: An animated single-cycle datapath with active wires and mux choices lit. The control row (RegDst, ALUSrc, MemToReg, RegWrite, MemRead, MemWrite, Branch, ALUop) with X where it is a don't care. The ALUControl derivation: ALUop + funct gives 4 bits Ainvert|Binvert|Op. PCSrc = Branch AND Zero, extended to bne as (bne AND NOT Zero) OR (beq AND Zero). Faulty and correct results side by side. A list of unused ports (RR2/WD for lw, and so on).
- Aha: ALUControl needs funct, so the opcode alone is not enough. lw is the slowest instruction. An inverted MemToReg breaks lw and the R-types but not sw or beq.
- Verify use: Answers control-signal MCQs, gives ALUop/ALUControl for a hex word, the final register value under a fault (AY15/16 Q9b), and the new bne control row (AY25/26 Q18a).
- Conventions: ALUop: 00 lw/sw, 01 beq, 10 R-type (L12 p24-26; table in AY17/18 p5). ALUControl: and 0000, or 0001, add 0010, sub 0110, slt 0111, nor 1100 (L12 p20-22). The taught datapath subset excludes sll/srl/j/lui (L11 p6), yet AY23/24 S2 Q10's key relies on sll and lui not using RR1. No new ALUop may be introduced for bne (AY25/26 p13).

### [1] Loop iteration and ideal-cycle quick counter
- Module: Pipelining / MIPS (L20, L07)
- Sources: AY24/25 Q13 (Ans p6, p17); AY25/26 Q2 (Ans p2-3); AY23/24 S1 Q1, Q4 (Ans p2-3); AY20/21 Q5 (p3); L21 p43
- Inputs: Counter initial value (hex or decimal), step, loop body length, instructions before and after the loop, and the exit test.
- Shows: Iterations, dynamic instruction count I = pre + iterations x body + post, and ideal cycles = I + 4. Warns when the counter never reaches 0 (start not a multiple of the step).
- Aha: 0x32 is 50, not 32. The final pass through the loop still executes the branch.
- Verify use: Settles the recurring MCQ in a few seconds (30 and 36).
- Conventions: I + N - 1 with N = 5 (L20 p32).

### [1] Past-paper preset launcher with answer-key errata layer
- Module: Exam prep (all modules)
- Sources: guides/Past Finals sections 2 and 4; past-finals/*.md inventories (MCQ letters for AY24/25 and AY25/26 recovered from the red text on the PDFs)
- Inputs: Choose a paper and question, or a template such as 'pipeline (a)-(e)', 'tag-bits MCQ' or 'decoder + gate'.
- Shows: Opens the matching tool already loaded with the paper's numbers. The expected answer stays hidden until revealed. Errata badges appear where the key has problems (AY23/24 S1 'at a glance' errors, AY25/26 draft key, accepted ranges). Marks per part are shown for time planning.
- Aha: The AY24/25 and AY25/26 Sem 1 papers are near clones with different numbers.
- Verify use: One click from a question to a checked answer.
- Conventions: MCQ letters exist only as red text on the AY24/25 and AY25/26 PDFs (guides section 4). R11 Addendum calls AY25/26's pipeline question 'Q20'; in the paper it is Q19.

### [2] Write-policy visualizer: write-through vs write-back, crossed with write-allocate vs write-around
- Module: Cache (L22)
- Sources: L22 p66-70; AY23/24 S2 Q18 wording (Ans p10-11); AY23/24 S1 Q20 alternative keys (Ans p17-18); AY16/17 Q6e (p8); inventory AY23/24 S2-AY25/26 section 4.3
- Inputs: A short load/store trace, or one imported from feature 5. Choose any of the 2x2 policy combinations, plus an optional write buffer.
- Shows: Four synchronised panes, one per combination (WT+allocate, WT+around, WB+allocate, WB+around). Each shows cache blocks with dirty bits, main-memory cells updating live, counters for memory writes and block fetches, evictions that write back dirty blocks, and the write-buffer queue for write-through. Under write-back, memory words that are stale are highlighted.
- Aha: Write-back vs write-through decides what happens on a write HIT. Allocate vs around decides what happens on a write MISS. The dirty bit only matters at eviction.
- Verify use: Shows the final cache state under 'sw allocates' and under 'sw ignored', the two variants the AY23/24 S1 key accepted. Feeds the overhead-bit counts used in the SRAM-total question.
- Conventions: L22 p69: a read miss always loads the block; write-allocate loads the whole block and then writes the word; write-around writes memory only. L22 p70 summary diagram. AY23/24 S2 Q18 mixes the terms ('write-allocate cache using write-back policy for write misses'): the callout should explain both.

### [2] Performance calculator: single-cycle vs multi-cycle vs pipelined, CPI mix
- Module: Performance (L20)
- Sources: AY23/24 S1 Q1-4 (Ans p2-3); AY15/16 Q3, Q5 (p2-3); AY23/24 S2 Q8 (Ans p4); AY23/24 S1 Q11 (Ans p6); L20 p31-33
- Inputs: Stage latencies, which stages each instruction class uses, dynamic counts or an instruction-mix table, clock rate, pipeline register overhead Td.
- Shows: Single-cycle CT = longest instruction path; multi-cycle CT = max stage, and time = sum over instructions of stages used x CT; pipeline CT = max stage + Td, with (I + 4) cycles; weighted average CPI; speedup. Also a per-instruction latency bar chart (lw 8 ns vs sw 7 ns).
- Aha: Pipelining raises throughput, not single-instruction latency. Pipeline register overhead eats into the speedup.
- Verify use: Reproduces 144 ns, 2.5 GHz, 105.2 ns and 34.2 ns (AY23/24 S1), and 10.5 us and 2.67 (AY15/16).
- Conventions: L20 p31-32 formulas. Instructions skip unused stages in the AY23/24 S1 multi-cycle model, and j uses only fetch and decode (Ans p3).

### [2] Expanding-opcode planner
- Module: ISA (L10, R04)
- Sources: AY23/24 S2 Q7 (Ans p4); AY20/21 Q3 (p2); AY15/16 Q6 (p3); AY21/22 S2 Q12 (p5); AY16/17 Q4b-g (p6); AY17/18 Q4a (p5); L10 p30
- Inputs: Instruction length, then per class either the opcode width or the operand fields (register bits from the register count, address bits from memory size and addressing unit), constraints (at least one of each class, class C fixed at k), and the objective (maximise total, maximise class X, or minimise).
- Shows: A prefix tree of opcode space: how many patterns each class takes, how many escape prefixes are reserved, and the final counts. A step-by-step explanation in the style of AY23/24 S2 Ans p4.
- Aha: To maximise the total, give the short-opcode classes as few patterns as possible.
- Verify use: Answers the max/min-count MCQs and MRQs.
- Conventions: Full addresses with no truncation, byte addressing (AY23/24 S2 Q7). Only the idea is on the slides (L10 p30); the method is in R04 (guides/Past Finals section 3b).

### [2] C memory and pointer tracer
- Module: C (L02, L04, L05)
- Sources: AY25/26 Q10 (Ans p5; key gives no reasoning); AY24/25 Q8 (Ans p4); AY23/24 S2 Q1-2 (Ans p2); AY21/22 S1 Q2-3 (p2-3); AY21/22 S2 Q3, Q7 (p2, p4); AY17/18 Q1a (p2)
- Inputs: A short C snippet: pointers, int **pp, arrays of pointers, structs passed by value vs by pointer, ?:, if/else without braces, char arithmetic.
- Shows: Memory boxes with addresses and arrows, the stack frame of each call (copies vs aliases), step-by-step evaluation of compound expressions such as ++(*pp) <= *qq--, a parse of the declarator (struct point *p[5]), and the real block structure of brace-less if/else whatever the indentation.
- Aha: Swapping local pointer copies changes nothing in the caller. Pointer comparison compares addresses. Indentation does not create blocks.
- Verify use: Gives the exact printed output (e.g. '2 3', '51').
- Conventions: ?: is only in T02 (inventory section 3). Pointers to pointers are never taught: flag as a stretch (guides/Past Finals section 3b).

### [2] Gate-network simplifier and propagation delay
- Module: Boolean algebra / logic circuits (L13-L14)
- Sources: AY23/24 S2 Q12-13 (Ans p5-6); AY24/25 Q1-2 (Ans p2); AY25/26 Q12 (Ans p6-7); AY23/24 S1 Q6-8 (Ans p4-5); AY20/21 Q6 (p4); AY17/18 Q1c (p3)
- Inputs: A gate circuit built on a canvas or typed as nested gates, gate delays, and the available constants.
- Shows: A symbolic derivation with the law named at each step (De Morgan, absorption, ...), the equivalent single gate when there is one, a truth table, the longest path in levels times the gate delay, a complete-set checker (with and without constants), and which 2-input gates can act as inverters.
- Aha: 4 NANDs make an XOR. Delay counts levels, not gates.
- Verify use: Answers gate-identity and delay MCQs (XOR, 9 ns).
- Conventions: Fan-in delay given in the paper (AY17/18 Q1c-ii). Complemented literals unavailable unless stated.

### [2] Branch-delay-slot and scheduling helper
- Module: Pipelining control hazards (L21 p46-48)
- Sources: AY23/24 S1 Q12 (Ans p6); AY19/20 Q7e (p7); AY21/22 S1 Q15e, S2 Q16e (p12, p10); AY20/21 Q16e (p11); AY18/19 Q7e (p11)
- Inputs: Code around a branch.
- Shows: For each candidate instruction: whether it is control-independent, whether moving it breaks a RAW, WAR or WAW dependency with the branch operands or with code in between, and how many cycles moving it saves under the selected pipeline settings (linked to feature 1).
- Aha: A delay-slot instruction runs whatever the branch does, so it must be safe on both paths.
- Verify use: Checks 'which instruction can move into the slot' (key: I5) and 'which instruction to move and how many cycles that saves'.
- Conventions: One delay slot with early branching (L21 p46). Use a nop when nothing qualifies (L21 p48).

### [2] Instruction-sequence equivalence tester
- Module: MIPS logic ops and pseudo-instructions (L06-L07)
- Sources: AY24/25 Q11 (Ans p5); AY21/22 S2 Q10 (p5); AY20/21 Q9 (p5); AY18/19 Q1f (p2); AY19/20 Q3 (p2); AY15/16 Q2 (p2)
- Inputs: A target effect (pseudo-instruction, 'set $t2 to 0', 'no effect') and candidate instruction sequences.
- Shows: Runs each candidate on random register values and reports which registers and memory words change, side effects on registers other than $z, and a pass/fail per candidate.
- Aha: nor with $0 gives NOT. xori $t2,$t2,0 does not clear a register. srl $4,$4,0 is a real no-op.
- Verify use: Screens MCQ and MRQ options.
- Conventions: Immediates for logical ops are zero-extended (L06).

## Misconceptions and traps (surface as callouts)
- WAR and WAW are dependencies, not hazards, in the course's in-order 5-stage pipeline, yet the AY25/26 Q4 key answers 'Write After Write Data Hazard'. Show both the lecture view and the exam-key wording. (L21 p14; R11 p9; AY25/26 Ans p3; guides/Past Finals section 4)
- A group made only of don't cares is not a prime implicant. (AY23/24 S2 Ans p19 (CD not a PI); AY24/25 Ans p14 (B.D not a PI); T06)
- Branch offsets count from PC+4, not PC: using PC gives 0x1180000C instead of 0x1180000B. (AY24/25 Ans p16)
- In sw, rt is the register being stored and rs the base. Swapping them gives 0xAE890000 instead of 0xAD340000. (AY24/25 Ans p16)
- andi zero-extends its immediate: $t0=0xabcd0123 AND 51966 gives 0x22, not 0xabcd0022. (AY25/26 Ans p7; L06)
- lui is I-type with rs = 0 and rt as the destination. (AY25/26 Ans p4)
- Without forwarding, a dependency two instructions back still costs 1 stall. The key notes students miss the +1 for i6. (AY23/24 S2 Ans p16)
- The ideal pipeline formula I + N - 1 uses the DYNAMIC instruction count (loop iterations multiplied out), not the number of lines of code. (AY25/26 Ans p3; AY24/25 Ans p17; L20 p32)
- Even with forwarding, a load followed by its consumer stalls 1 cycle. (AY24/25 Ans p17; L21 p19-20)
- Early branching (decision in ID) needs extra stalls when the comparison register comes from the instruction just before: 1 after an ALU instruction, 2 after a lw (3 in total, so no improvement). (L21 p37-39; AY23/24 S1 Q5C (Ans p4))
- A pipeline that does not handle branch hazards at all is NOT the same as predict-not-taken: option D was the INCORRECT statement. (AY23/24 S1 Q5 (Ans p4, key D at p19))
- Stall wording is inconsistent between keys ('2 stalls each 2 cycles' vs '5 stalls each 1 cycle'). Always count delay cycles. (AY24/25 Ans p17; AY25/26 Ans p16)
- When counting 'until the last stage of i20', the stall after the final j is not counted. (AY23/24 S2 Ans p16-17)
- Miss penalty with word-at-a-time memory = words per block x transfer time (+1 if restart is included). A lw miss then takes penalty + 4 (restart counted) or penalty + 5. (AY25/26 Ans p17; AY24/25 Ans p17; R12 p44, p48)
- A data-cache miss does not slow beq, which never accesses data memory. (AY25/26 Ans p17)
- A faster CPU does not reduce the number of cycles lost to misses; only absolute time changes. (AY24/25 Ans p17)
- Higher associativity does not reduce the miss penalty, which L22 defines as block replacement time + hit time. (AY25/26 Q20e (Ans p17); L22 p20)
- Fully associative caches have no conflict misses but still have cold and capacity misses. (AY23/24 S1 Q13 key C (Ans p6, p19); AY25/26 Q5 (R12 p46); L23 p28)
- Rule of thumb: a direct-mapped cache of size N has about the miss rate of a 2-way cache of size N/2, not of a 4-way cache of size N/4. (R12 p26; L23 p16; AY25/26 Q5 key A)
- A hit on a neighbouring word of the same block is spatial locality; re-accessing the same word is temporal. (AY23/24 S1 Q14 key B (Ans p7))
- Write-back and write-through are write-HIT policies; write-allocate and write-around are write-MISS policies. AY23/24 S2 mixes the terms. (L22 p66-70; AY23/24 S2 Q18 (Ans p11))
- Check whether sw counts in a cache question: some papers say lw only, others include sw, and AY23/24 S1 accepted both readings. (AY21/22 S2 p12; AY20/21 p10; AY18/19 p9; AY23/24 S1 Ans p17-18)
- Pipelining raises throughput; it does not cut the latency of one instruction. (AY23/24 S1 Q11 key A (Ans p6))
- lw has a longer latency than sw because it also writes the register file. (AY23/24 S2 Q8 key C (Ans p4); L20 p31)
- Opcode alone cannot give ALUControl. The ALU control unit takes the 2-bit ALUop and the 6-bit funct and outputs 4 bits. (AY23/24 S2 Q9, Q11 (Ans p5))
- Swapping pointer parameters inside a function has no effect on the caller (pass by value). (AY23/24 S2 Q2 key A=100 (Ans p2))
- Indentation lies: without braces, else covers only the next statement, so the program prints '2 3'. (AY24/25 Q8 key B (Ans p4, inventory))
- The AY23/24 S1 'answers at a glance' page has two errors: Q17d is m(0,3,12,15), not m(0,15), and Q18b KB is x, not B.x. Gate count 1, not 2. (AY23/24 S1 Ans p11, p13 vs p19; guides/Past Finals section 4)
- Q' is available from the flip-flop, so a term like B'.x needs only one AND gate and no inverter. (AY23/24 S1 Ans p13)
- Tying J and K together makes a T flip-flop. (AY25/26 Q13 key A (Ans p7))
- Active-low decoder outputs are maxterms. AND-ing them gives a product of maxterms (F2 = B'+C). A NOR over some outputs gives 1 for the remaining minterms. (AY23/24 S2 Ans p20; AY25/26 Q11 (Ans p6))
- The EPIs alone do not always give the simplest SOP; some functions have 0 EPIs. (AY23/24 S1 Q7(iv), Q17a (Ans p4, p11))
- Self-correcting needs a reason: from unused states 4 -> 1 -> 0 -> 0 the circuit never returns. Marks: 1 for 'no' and 1 for the explanation. (AY24/25 Ans p13)
- Exponent bias for half precision is 2^(5-1) - 1 = 15, following the pattern of 127 and 1023. (AY24/25 Q9 key C; guides/Past Finals section 3b)
- Johnson counter (inverted feedback) vs ring counter: 1 -> 0 -> 8 -> 12 -> 14 -> 15 -> 7 -> 3 is Johnson; 1 -> 8 -> 4 -> 2 is ring. (AY23/24 S2 Q14 (Ans p6))
- In a 16-to-4 encoder, output Y (bit 1) is the OR of every input whose index has bit 1 set: D2+D3+D6+D7+D10+D11+D14+D15. (AY23/24 S2 Q15 (Ans p6))
- 'bne $s0, 0, Loop' in recent MCQs is not real MIPS; read it as $zero. 'slt $2,$2,124' should be slti. (inventory AY23/24 S2-AY25/26 section 4.8; AY23/24 S1 Q12 (Ans p6))
- Predict-taken, the hazard-detection unit (PCWrite, IF/IDWrite) and forwarding-mux selects appear in old papers but are not taught. (L21 p40; guides/Past Finals section 3a; AY23/24 S1 Q19 (Ans p14))

## Worked examples (presets and tests)
- **Ideal pipeline loop MCQ** (AY25/26 Q2 (Ans p2-3)): input `init 0x32 (=50), step -5, loop body 3 instr, 1 instr before, 1 after, N=5` -> expected `10 iterations, I=32, 36 cycles`
- **Ideal pipeline loop MCQ** (AY24/25 Q13 (Ans p6, p17)): input `init 0x10 (=16), step -2, body 3, pre 1, post 1` -> expected `8 iterations, I=26, 30 cycles`
- **Pipeline (a)-(e) template** (AY24/25 Ans p17; R11 Addendum p3): input `AY24/25 Q19 7-instr code (lw,lw,add,addi,sub,sw,add); (e) Inst5 -> sub $s5,$t1,$t2` -> expected `(a) 4 stall cycles; (b) 15; (c) 12; (d) 1 nop after Inst2; (e) 12`
- **Pipeline (a)-(e) template** (AY25/26 Ans p16): input `AY25/26 Q19 9-instr code (Inst9 = add); (e) Inst8 -> sub $s5,$t2,$s3` -> expected `(a) 5; (b) 18 (13+5); (c) 13; (d) 0 nops; (e) 14`
- **Pipeline additional cycles, first iteration** (AY23/24 S2 Ans p16-17): input `AY23/24 S2 i1-i20, i=0, j target in ID, count to WB of i20` -> expected `ideal 24; (b) no fwd + MEM: +17 [i6+1,i7+2,i8+3,i9+2,i10+2,i11+3,i13+2,i14+2]; (c) fwd + MEM: +7 [i8+3,i11+3,i13+1]; (d) fwd + ID + predict-not-taken: +3 [i7+1,i10+1,i13+1]`
- **Pipeline total cycles, 2 iterations** (AY23/24 S1 Ans p9, p19): input `AY23/24 S1 Q16 loop (16 dynamic instr, beq never taken, bne taken once), count to the final i9` -> expected `base register 8; no fwd + ID + no prediction 40; fwd + ID + no prediction 29; fwd + ID + predict-not-taken 27 (ideal 20)`
- **Branch prediction lecture example** (L21 p43-45): input `addi $s0,$zero,10; Loop: addi $s0,$s0,-1; bne $s0,$zero,Loop; sub; forwarding, branch in ID` -> expected `I=22, ideal 26; no prediction 46; predict-not-taken 45`
- **Pipeline (computed, no key)** (computed from the AY21/22 S1 p12 code using the conventions above; verify in the tool): input `AY21/22 S1 Q15 I1-I18, A[0]>B[0], j in ID` -> expected `(a) 21; (b) +15; (c) +8; (d) +4`
- **Pipeline (computed, no key)** (computed from the AY21/22 S2 p10 code; verify): input `AY21/22 S2 Q16 I1-I19, all A<B (swap path)` -> expected `(a) 23; (b) +16; (c) +7; (d) +3`
- **Pipeline (computed, no key)** (computed from the AY20/21 p11 code; verify): input `AY20/21 Q16 I1-I16, A[0] odd` -> expected `(a) 20; (b) no fwd + MEM +24; (c) no fwd + ID +20; (d) fwd + ID + predict-not-taken +4`
- **Single/multi/pipeline timing** (AY23/24 S1 Ans p2-3 (keys B, C, C, D)): input `AY23/24 S1: 72 dynamic instr; 500 MHz single-cycle; stages 0.1/0.2/0.2/0.4/0.2 ns; pipeline overhead 0.05 ns` -> expected `144 ns; 2.5 GHz; about 105 ns (105.2); about 34 ns (76 cycles x 0.45)`
- **Performance (computed)** (computed (no key) from AY15/16 p2-3): input `AY15/16 Q3: 5000 instr, 2 GHz, CPI 3/5/4/6 at 40/20/20/20%; Q5: stages 2,3,4,5,2 ns, 20 instr` -> expected `average CPI 4.2, 10.5 us; single-cycle 320 ns vs pipeline 24 x 5 = 120 ns, speedup 2.67`
- **Lecture timing** (L20 p31-32): input `100 instr; single-cycle CT 8 ns; multi-cycle CT 2 ns, CPI 4.6; pipeline CT 2 + 0.5 ns` -> expected `800 ns; 920 ns; pipeline 104 cycles x 2.5 = 260 ns (pipeline total computed)`
- **Tag bits MCQ** (AY24/25 Q14 (Ans p17)): input `4-way, 32 KB, 16 B blocks, 32-bit addresses` -> expected `offset 4, set 9, tag 19`
- **Tag bits MCQ** (AY25/26 Q9 (Ans p5; R12 p47)): input `8-way, 32 KB, 8 B blocks` -> expected `offset 3, set 9, tag 20`
- **Bit ranges MCQ** (AY23/24 S1 Q15 (Ans p7, p19)): input `4-way, 2048 blocks, 4-word blocks, 32-bit` -> expected `tag 31-13, set 12-4, offset 3-0 (option D)`
- **Cache geometry (computed)** (computed (no key), AY15/16 p3): input `AY15/16 Q4: 4-way, 8192 B, 4-word blocks` -> expected `set index 7, offset 4 (option D)`
- **Miss penalty word-at-a-time** (AY24/25 Q20 (Ans p17; R12 p44-45)): input `16 B blocks, 1 word per transfer, 10 cycles, hit 95%, 32% data accesses, 100 instr` -> expected `penalty 40 (41 accepted); lw hit 5; lw miss 45 (46); cycles lost 64 (66); 'faster CPU reduces lost cycles' False`
- **Miss penalty word-at-a-time** (AY25/26 Q20 (Ans p17; R12 p48)): input `16 B blocks, 5 cycles per word, restart included, hit 90%` -> expected `penalty 21; lw hit 5; lw miss 25; beq 5; 'more associativity reduces miss penalty' False`
- **AMAT** (L22 p21): input `cache 0.8 ns, DRAM 10 ns, target AMAT 1 ns` -> expected `hit rate 0.98`
- **Cache timing and SRAM (computed)** (computed (no key), AY16/17 p8; L22 p20): input `AY16/17 Q6: cache 5 ns, memory 80 ns; 10,000 accesses in 70 us; 4-way write-back 64 KB, 8-word blocks` -> expected `hit 5 ns; miss 85 ns; miss rate 0.025; tag 18 bits, 72 tag bits per set; SRAM 524288 + 2048 x (18+1+1) = 565248 bits`
- **Final cache contents, direct-mapped** (AY23/24 S1 Q20a (Ans p15-17)): input `4x4 transpose loop, A=0x1000, B=0xa010, DM 4 blocks x 2 words, lw and sw allocate` -> expected `idx0 0x00000081 M[0x1020] M[0x1024]; idx1 0x00000502 M[0xa048] M[0xa04c]; idx2 0x00000081 M[0x1030] M[0x1034]; idx3 0x00000081 M[0x1038] M[0x103c]. If sw is ignored: idx1 0x00000081 M[0x1028] M[0x102c]`
- **Final cache contents, 2-way LRU** (AY23/24 S1 Q20b (Ans p17-18)): input `same loop, 2 sets x 2 ways, 2-word blocks, lower address in way 0` -> expected `set0: W0 0x00000102 M[0x1020] M[0x1024], W1 0x00000103 M[0x1030] M[0x1034]; set1: W0 0x00000103 M[0x1038] M[0x103c], W1 0x00000a04 M[0xa048] M[0xa04c]`
- **Instruction cache 2-way LRU** (AY23/24 S2 Q18a-c (Ans p17-18)): input `16 words, i1 at 0x00400050, AY23/24 S2 loop, 1000 iterations` -> expected `2-word blocks: '2,3' and 10 misses; 4-word blocks: 5 misses`
- **Data cache, arrays back to back** (AY23/24 S2 Q18d-g (Ans p18)): input `DM 512 words, 4-word blocks, A=0xFFFF0000, B and C contiguous; lw A[i], lw B[i], sw C[k] on k of n` -> expected `'7,4'; n=1000: A hits 248 (250 accepted), B base 0xFFFF0FA0 idx 122, C 0xFFFF1F40 idx 116; n=768: A hits 191 (192), B hits 190 (192)`
- **Data and I-cache (computed)** (computed (no key), AY21/22 S1 p13-14; verify): input `AY21/22 S1 Q16: DM 512 words, 8-word blocks, A=0xCDEF0400, B after A; I-cache 2-way 16 words, I1 at 0x2B000FFC, 100 elements` -> expected `'6,5'; 1032 elements: A 7/8, B 7/8; 1028 elements: A 96/257, B 96/257; lowest A hit rate 0 when N is a multiple of 512; I-cache 4-word blocks: '1,4' and 6 misses; 2-word blocks: 10 misses`
- **Data and I-cache (computed)** (computed (no key), AY21/22 S2 p11-12; verify): input `AY21/22 S2 Q17: I-cache 2-way 16 words, I1 at 0x4488FFFC, 100 iterations; D-cache DM 1024 words, 16-word blocks, A=0xFFFF0000, lw only, B[2i]` -> expected `2-word blocks: '2,3' and 10 misses; 4-word blocks: 304 misses (3 loop blocks thrash in set 0); D-cache '6,6'; N=512: A 473 hits, B 441; N=1024: A 945, B 882`
- **Data and I-cache (computed)** (computed (no key), AY20/21 p9-10; verify): input `AY20/21 Q15: DM 128 words, 4-word blocks, A=0xFF000C00, lw only; I-cache 2-way 16 words, 2-word blocks, 100 elements` -> expected `'5,4'; 3200 elements: 0, 0; 3216: 3/4, 3/4; 3210: 2407/3210 each; I-cache '2,3'; I1 at 0x10000C50: 1396 hits (8 misses of 1404 fetches); I1 at 0x10000C54: 1395 hits`
- **Data and I-cache (computed)** (computed (no key), AY17/18 p8; verify): input `AY17/18 Q7: DM 128 words, 4-word blocks, A=0x10001000, B=0x1003F100, 1024 elements, loop over odd indices with lw, lw, sw; I-cache DM 16 words, 2-word blocks, Inst1 at 0x0040003c, Inst10 always taken` -> expected `'5,4'; A[1023] idx 31, B[1023] idx 15; accesses A 1024, B 512; hit rates A 3/4, B 1/2; I-cache 9 misses, 6138 hits`
- **Set mapping (computed)** (computed (no key), AY18/19 p9, AY19/20 p9; verify): input `AY18/19 Q6: 2-way 64 words, 4-word blocks, A=0x80, B=0x00100000, C=0x00108040; AY19/20 Q8: A=0x0040CCC0, B=0x2C0, DM/2-way 64 words, 4-word blocks, lw only` -> expected `AY18/19: set 3 bits, offset 4, A[0] set 0, B[60] set 7, C[1032] set 6. AY19/20: '4,4', A[0] block 12, B[60] block 11, DM hit rates 0 and 0; 2-way A[0] set 4, B[60] set 3, hit rates 3/4 and 3/4`
- **MIPS trace + encoding** (AY23/24 S2 Ans p16): input `AY23/24 S2 Q16: n=8, A={1..8}, B={9..16}, C={111,222,...,888}; i1 at 0x00400050` -> expected `box1 (i%4)/2; box2 C[k]=A[i]+B[i]; k=4; C=10,12,18,20,555,666,777,888; slt $t1,$t0,$s0 = 0110482A; bne $t1,$0,skip = 15200006; sw $t3,0($a3) = ACEB0000; j loop = 08100019`
- **MIPS trace + encoding** (AY24/25 Ans p15-16): input `AY24/25 Q18: A={123,-13,26,30,9}, B={44,765,200,999,123}; Inst16 at 0x00400078` -> expected `A={123,-39,26,90,27}; beq $t4,$0,exit = 0x1180000B; sw $s4,0($t1) = 0xAD340000; Inst4 at 0x00400048; j loop = 0x08100012`
- **Encoding/decoding MCQs** (AY25/26 Ans p4, p7-8; AY24/25 Ans p17): input `lui $s1,57007; 0x02898820; 0x0235C020; andi $t1,$t0,51966 with $t0=0xabcd0123; 0x12310003 at PC 0x1000` -> expected `0x3C11DEAF; add $s1,$s4,$t1 with ALUop 10; add $t8,$s1,$s5 with ALUControl 0010; $t1=0x00000022; beq $s1,$s1,3 with target 0x1010, so the equivalent is 0x08000404`
- **MIPS loop trace MCQ** (AY23/24 S2 Ans p3-4): input `AY23/24 S2 Q6 loop ($t0=64, xor clears)` -> expected `$t2 = 9`
- **Dynamic instruction count** (AY23/24 S1 Ans p2): input `AY23/24 S1 8-element loop, 3 elements < 5` -> expected `2 + 3x8 + 5x9 + 1 = 72 instructions`
- **MIPS trace + encoding (computed)** (computed (no key), AY21/22 S1 p10-11): input `AY21/22 S1 Q14: A={10,21,12,17,9,1,20,33}, B={7,3,20,15,2,18,35,11}; I1 at 0x2B000FFC` -> expected `prints 17; beq $t3,$0,end = 0x1160000B; lw $s1,0($t1) = 0x8D310000; j loop (loop = 0x2B001010) = 0x0AC00404`
- **Hand-assembly check (computed)** (computed (no key), AY21/22 S1 p6): input `AY21/22 S1 Q8 five encodings, code at 0x0` -> expected `wrong: C (andi $4,$3,1 should be 0x30640001) and D (bne should be 0x1480FFFD)`
- **MIPS trace + encoding (computed)** (computed (no key), AY21/22 S2 p8-9): input `AY21/22 S2 Q15: A={1,2,3,4,5}, B={5,3,4,5,3,8,2,5,9,4}; I19 at 0x00400084` -> expected `B={1,3,2,5,3,8,2,5,5,4}; slt $t4,$t0,$t3 = 0x010B602A; I5 at 0x0040004C; j loop = 0x08100013`
- **MIPS trace + encoding (computed)** (computed (no key), AY20/21 p8-9): input `AY20/21 Q14: A={10,21,12,17,9,1,20,33}, B={100,3,20,15,2,2,65,11}; I1 at 0x10000C50` -> expected `count 5; A={10,18,12,2,7,-1,20,22}; slt $t8,$t0,$s2 = 0x0112C02A; beq $t9,$0,skip = 0x13200005; j loop = 0x08000316`
- **MIPS MCQs (computed)** (computed (no key), AY20/21 p3, AY19/20 p2, AY18/19 p2): input `AY20/21 Q4-5 parity loop; AY19/20 Q1 $s0=0xBEBEC0C0; AY18/19 Q1 $s0=32 and $s0=43` -> expected `Q4 E, Q5 52 instructions; $s1=0x4A, max 0x78 at $s0=0xFFFFFFFF, srl $s0,$s0,4 = 0x00108102, bne $s0,$zero,L = 0x1600FFFC; $t0=26, $t1=31; 3 branches; $s0=0xFFFFFFFF gives 0,0; srl $s0,$s0,1 = 0x00108042`
- **MIPS trace + encoding (computed)** (computed (no key), AY17/18 p5-6, AY16/17 p3): input `AY17/18 Q5: A={11,9,31,2,9,1,6,10}, B={3,7,2,12,11,41,19,35}, first beq at 0x0040003c; AY16/17 Q3 j at 0xE0480030` -> expected `A={11,10,31,14,9,42,6,11}; sll $t8,$t8,2 = 0x0018C080; j A2 (0x00400070) = 0x0810001C; slt $t7,$t8,$zero = 0x0300782A; Q4a max 379; AY16/17: add $s2,$s0,$zero = 0x02009020, beq $t1,$zero,done = 0x11200007, j L1 = 0x08120002`
- **C tracing** (AY25/26 MCQ C (inventory); AY24/25 MCQ B (inventory); AY23/24 S2 Ans p2): input `AY25/26 Q10 (int *p[100], ++(*pp) <= *qq--); AY24/25 Q8 (x=1, ?: with brace-less else); AY23/24 S2 Q2 mystery swap` -> expected `51 (C); '2 3' (B); 100 (A)`
- **C tracing (computed)** (computed (no key), AY17/18 p2, AY21/22 S1 p2-3): input `AY17/18 Q1a rec_t st[2]={{11,{'A','B'}},{22,{'C','D'}}}; AY21/22 S1 Q2-3` -> expected `'11 A' then '33 f'; 'i = 21'; '101 101'`
- **K-map PI/EPI** (AY24/25 Q3-4 (Ans p2-3)): input `F = m(1,3,4,6,10,12) + d(2,5,7,13,14)` -> expected `6 PIs (B.C', C.D', A'.D, A'.B, A'.C, B.D'); 2 EPIs (C.D', A'.D)`
- **K-map SOP/POS** (AY24/25 Q17a (Ans p14)): input `F = m(0,1,4,6,9,11) + d(5,7,13,15)` -> expected `4 PIs, 3 EPIs; SOP A'.C'+A'.B+A.D; POS (A'+D).(A+B+C')`
- **K-map from grid** (AY25/26 Ans p2 (minterms reconstructed from the text grid)): input `AY25/26 Q1 map read with rows AB, columns CD: F = m(0,1,2,6,8,10,12)` -> expected `4 EPIs: B'.D', A'.B'.C', A.C'.D', A'.C.D'`
- **K-map of F.G** (AY25/26 Q17a (Ans p12)): input `F = m(0,1,3,4,5,7,9,13,14,15), G = M(0,1,6,8,11,12)` -> expected `H = m(3,4,5,7,9,13,14,15); 5 PIs, 4 EPIs; SOP A'.B.C'+A'.C.D+A.B.C+A.C'.D; POS (A'+B+C').(A'+C+D).(A+B+C).(A+C'+D)`
- **K-map maxterm form** (AY23/24 S2 Q19 (Ans p19)): input `F = M(0,2,8,10,13) . D(3,7,11,12,15), i.e. m(1,4,5,6,9,14)` -> expected `5 PIs (A'D, B'D, A'B, BD', BC); 1 EPI (B'D); 3 simplified SOPs; e.g. B'D+A'B+BD'`
- **K-map counts** (AY23/24 S1 Q17a-b (Ans p11, p19)): input `P = m(1,8,13) + d(0,2,5,9,10,15); Q = M(5,7,8,10,13,15) . D(0,2,3,4,9,14)` -> expected `P: 4 PIs, 0 EPIs; Q: 4 PIs, 2 EPIs (X'Z, XZ')`
- **K-map counts (computed)** (computed (no key), AY20/21 p2, AY21/22 S1 p3, AY21/22 S2 p3, p7): input `AY20/21 F = m(0,1,2,7,15) + d(3,9,11,12,13); AY21/22 S1 F = m(3,10,11,15) + d(1,2,4,7,9,12,14); AY21/22 S2 F = m(1,3,6,8,9,11,15) + d(7,14); G = m(0,4,6,8,9,10,12,13,14,15)` -> expected `4 PIs / 2 EPIs; 0 EPIs; CD is not an EPI (option A); G: 5 PIs, 5 EPIs, A.B+A.C'+A.D'+B.D'+C'.D'`
- **Canonical form** (AY25/26 Q12 (Ans p6-7)): input `(A.B+C).(A.C+B)` -> expected `m(3,5,6,7)`
- **BCD to 7-segment, don't cares 10-15** (AY25/26 Q17b (Ans p12-13)): input `segment table in the paper, inputs PQRS` -> expected `A = m(0,2,3,5,6,7,8,9); E = m(0,2,6,8); B = Q'+R'.S'+R.S; G = P+Q'.R+Q.R'+Q.S' (or R.S'); F = M(1,2,3,7)`
- **MSI circuits FITB** (AY23/24 S2 Ans p20): input `AY23/24 S2 Q21: F1 = m(0,2,3,5,6,7) on a 4:1 MUX; decoder + AND; comparator + NAND + OR; HA + MUX; HA + 4-to-2 encoder` -> expected `AC; B'+C; 10,11,14,15; 5,7,9,11,12,14; C+D`
- **MSI circuits** (AY23/24 S1 Ans p5, p11): input `AY23/24 S1 Q9-10, Q17c-e` -> expected `Q9 A; Q10 B (F1: selectors AB, inputs 0,C,1,C; F3: selectors AC, inputs 1,0,B,0); NAND; R = 0,3,12,15; S = 2,7,10,15`
- **MSI circuits** (AY24/25 Ans p3-4, p14; MCQ letters from inventory): input `AY24/25 Q5-7, Q17b-c` -> expected `Q5 C; Q6 A (F=A+B+C); Q7 D (ABCD<9, A=D, ABC=BCD); G by AB: 00 -> 0, 01 -> C'.D+C.D', 10 -> D, 11 -> 1; H2=A+B, H1=A+B'.C, H0=1`
- **MSI MCQs** (AY25/26 Ans p4-6): input `AY25/26 Q8 comparator options; Q11 3x8 decoder with NOR on D1, D3, D6` -> expected `D ((i) AD<BC, (iii) ABC<D); F = m(0,2,4,5,7)`
- **Sequential from a state table** (AY25/26 Ans p10): input `AY25/26 Q16 table (X0 = MSB)` -> expected `A+ = B.X0'.X1; B+ = A'.B'.X0.X1; G = A; labels A1 X=1, A2 No, A3 X!=3, A4 X!=1`
- **Sequential analysis + T redesign** (AY24/25 Q16 (Ans p13)): input `JA=B, KA=1, JB=A.C, KB=0, DC=A+B; used states 2,3,5,6,7` -> expected `2->7, 3->7, 5->3, 6->3, 7->3; unused 0->0, 1->0, 4->1; not self-correcting; TA=1, TB=B', TC=C'`
- **JK design** (AY23/24 S2 Ans p19): input `AY23/24 S2 Q20: 1-(0)->2, 1-(1)->3, 2-(0)->2, 2-(1)->3, 3-(0)->2, 3-(1)->3` -> expected `JA=1, KA=0, JB=C, KB=A'+C'; 1 gate; from state 0: C=0 -> 2, C=1 -> 3`
- **Sequential analysis + JK design** (AY23/24 S1 Ans p13): input `AY23/24 S1 Q18: DA=A+B', TB=A.B'; design 0-(0)->0, 0-(1)->2, 1-(0)->1, 1-(1)->0, 2-(0,1)->2` -> expected `0->2, 1->1, 2->3, 3->3; JA=B'.x, KA=0, JB=0, KB=x; 1 gate; from state 3: x=0 -> 3, x=1 -> 2; self-correcting Yes`
- **Counter trace** (AY23/24 S2 Q14 (Ans p6)): input `4 D flip-flops, last Q' fed back to the first, start 0001` -> expected `1 -> 0 -> 8 -> 12 -> 14 -> 15 -> 7 -> 3 -> 1`
- **Expanding opcode** (AY23/24 S2 Q7 (Ans p4)): input `16-bit instr, 512-byte address space, 12 registers, classes A (2 regs), B (reg + full address), C fixed at 2` -> expected `226`
- **Expanding opcode (computed)** (computed (no key), AY20/21 p2, AY15/16 p3): input `AY20/21 Q3: opcodes 3/5/7 bits, maximise the total; AY15/16 Q6: 4/6/8 bits, maximise type C` -> expected `110 (option C); 236 (option C)`
- **Gate network** (AY23/24 S2 Q12-13 (Ans p5-6)): input `4-NAND circuit, 3 ns per gate` -> expected `XOR; 9 ns`
- **ALU control (computed)** (computed from L12 p20-22 for AY21/22 S2 Q4): input `new NAND instruction on the L12 ALU` -> expected `1101 (Ainvert=1, Binvert=1, OR)`

## Gaps or ambiguities
- The 8 older papers (AY15/16 to AY21/22 S2) have no answer keys. Every fixture marked 'computed' was derived by hand under the conventions above and must be confirmed with the built simulator before it ships as a test.
- MCQ letters for AY24/25 and AY25/26 exist only as red text on the PDFs. The letters used here come from the inventory (rendered pages), not from the text extract.
- Diagram-heavy pages lose detail in the text extract. Circuit wiring (AY23/24 S2 Q12, Q14, Q21b-e; AY24/25 Q6, Q16, Q17b-c; AY25/26 Q11, Q18c; AY23/24 S1 Q8, Q17c-e, Q18a, Q19; AY21/22 S1 Q13; AY21/22 S2 Q13-14; AY20/21 Q12-13; AY19/20 Q5-6; AY18/19 Q3, Q5e; AY17/18 Q3a) and state diagrams (AY21/22 S1 Q12, AY19/20 Q4a, AY18/19 Q4 order, AY17/18 Q2 order, AY16/17 Q3d arrays) need the PDFs to build presets. The AY25/26 Q1 K-map was reconstructed from the text grid assuming AB rows and CD columns; it matches the key's 4 EPIs.
- The pipeline tool needs settings the papers vary: j resolved in ID (papers) vs MEM (T10); branch stage; whether the answer is total or additional; 'first iteration' vs full run. AY17/18 Q6c-d says 'one iteration from Inst1 to Inst17' although Inst1-3 sit outside the loop (ambiguous).
- Cache write policy for sw is often unstated. AY23/24 S1 Q20 accepted two answers. AY23/24 S2 Q18 uses mixed terms. The simulator needs explicit toggles and a warning banner.
- AY24/25 Q20(d): the key also accepts a 'total' of 95 or 96 cycles. 96 = 32 accesses x (0.95 x 1 + 0.05 x 41); with penalty 40 the same formula gives 94.4, so '95' looks like a rounding slip. Explain this rather than encode it.
- The AY23/24 S2 Q19(d) key strings have no AND dots ('B'D+A'B+BD''), yet the question requires dots. Either the dots were lost in extraction or the key is inconsistent. The linter should accept both, with a warning.
- AY23/24 S1 Q16(a): the worked answer says 'Register $8' and the glance page says '8'; the format asks for the number only.
- AY18/19 Q2 mixes 'truncate' and 'nearest' for -0.3: truncation gives 0xBE999999 and round-to-nearest 0xBE99999A (computed). IEEE 754 and base conversion are excluded from the build per the brief, even though one IEEE MCQ appears in every recent paper (AY23/24 S2 Q5 -6.78125, AY25/26 Q3 0x3fd22800, AY24/25 Q9 bias 15). A non-interactive reference card could cover them.
- Off-syllabus items appear in old papers: hazard-detection unit signals (AY23/24 S1 Q19 key: 0,0,1,1,10,1,1,00111,01010,01010), predict-taken (AY15/16 Q11d, AY19/20 Q7f), j in the pipeline (AY18/19 Q7a), Logisim Splitter (AY15/16 Q1). Mark them non-examinable; don't build tools for them.
- The AY25/26 key is watermarked 'Draft'. Q20(e) reasoning is shaky, and Q12's derivation has typos.
- In AY16/17 Q5, BLT reuses opcode 0x08, which is addi's real opcode. A datapath tool should warn about the clash when such presets are loaded.
- AY19/20 Q8f (column-major storage with the MIPS code unchanged) likely leaves the hit rates unchanged, because the code still walks addresses sequentially. This is unverified; the preset should show both readings.
- MIPS tracer presets need support for .data/.word/la/li/syscall (exit, print_int), which recent papers use and explain in comments but which are taught only in labs.
