# Feature sweep: datapath-pipeline

Raw research output. Priority 1 = high exam value or high confusion.

## Features (18)
### [1] Single-cycle datapath tracer (lit-up wires, live values, T04 table auto-fill)
- Module: L11 Datapath (+ L12 control signals)
- Sources: L11 p6-9, p18, p20-46, p48 (complete datapath); L12 p4-17, p30; R05 p5, p7-35, p38 (what each stage outputs), p36 (links an FYP MIPS datapath visualiser); T04 Q3 + Answers p2-3; R06 p43-44; Midterm AY25/26 Q20-25; AY21/22 S1 Q4; AY23/24 S2 Q8-11
- Inputs: One instruction from the supported subset (add, sub, and, or, slt, lw, sw, beq; addi and bne flagged as L11-p6 extras), typed as assembly or as an 8-hex-digit word. Editable register file, a small data-memory table and the PC. Step buttons Fetch / Decode / ALU / Memory / RegWrite, or run the whole clock cycle.
- Shows: The L11 p48 datapath as SVG. Fetch: PC goes to IM, and the PC+4 adder. Decode: opcode/rs/rt/rd/shamt/funct split with bit ranges; RR1 = Inst[25:21], RR2 = Inst[20:16]; the RegDst mux picks WR; sign-extend of Inst[15:0]. ALU: the ALUSrc mux, the 4-bit ALUcontrol, the result and isZero. For beq: shift-left-2, the target adder and PCSrc = Branch AND isZero. Memory: Address, Write Data = RD2, MemRead/MemWrite. RegWrite: the MemToReg mux into WD. Wires whose value is used are drawn in colour with their values. Wires that still carry a value that control blocks are grey-dashed and tagged 'computed but discarded' (e.g. sign-extend output on an R-type; WR and WD on beq). A side panel fills the T04 table (RR1, RR2, WR, WD, Opr1, Opr2, Address, Write Data, next PC) in T04 notation ($5 = number, [$5] = contents, Mem(X)), plus R05 p38's output-of-each-stage list.
- Aha: Every unit computes something every cycle, and the control signals only decide which result is kept. That is why the T04 key gives beq a WR ('$3 or $0') and a WD ('random value') even though nothing is written, and why data memory still receives an address on an add.
- Verify use: Enter T04 Q3 (a) beq $1,$3,12; (b) lw $24,0($15); (c) sub $25,$20,$5 and compare every cell with T04 Answers p3. Check Midterm AY25/26 Q20-24 positions for add $t4,$v0,$s1 ($t4=0x100, $v0=0x200, $s1=0x300). Check 'which datapath values are unused' MCQs (AY21/22 S1 Q4). Check the next-PC of R06 p44.
- Conventions: Fields: opcode 31:26, rs 25:21, rt 20:16, rd 15:11, shamt 10:6, funct 5:0 (L11 p20). RegDst 0 = Inst[20:16] (rt), 1 = Inst[15:11] (rd); the I-type destination is rt (L12 p10; L11 p25-26). ALUSrc 0 = Read data 2, 1 = SignExt(Inst[15:0]) (L12 p12). The immediate is always sign-extended, so andi/ori are NOT supported (L11 p6). MemToReg 1 = memory read data, 0 = ALU result; the mux inputs are drawn swapped (L12 p15; L11 p43). PCSrc = Branch AND isZero; 0 = PC+4, 1 = (PC+4) + SignExt(imm)<<2 (L12 p17; L11 p37). sw: the ALU uses the immediate for the address and RD2 goes to Write Data (L11 p42). The PC is read during the cycle and written at the rising edge (L11 p18). Only one of MemRead/MemWrite may be asserted (L11 p40). No sll/srl/j (L11 p6, p47).

### [1] Control unit explorer: opcode to every control signal (with PLA view and fill-in quiz)
- Module: L12 Control
- Sources: L12 p5, p9-19, p29-34; L20 p27; R06 p5-9, p24-27; T05 Q1, Q5 (no answer file); AY15/16 Q9a; AY25/26 S1 Q7; AY23/24 S2 Q9; AY21/22 S2 Q11
- Inputs: Opcode (binary/hex), an instruction, or a hex word. Quiz mode blanks the row: the student types RegDst..ALUop and ALUcontrol, then checks.
- Shows: The matching row of the L12 p34 truth table is highlighted. Each signal gets its 0/1 meaning (L12 p10-17), and the mux or unit it drives lights on a mini-datapath. Each X has a tooltip saying why it is a don't-care and which signals can never be X. The gate-level circuit (L12 p33: R-format/lw/sw/beq AND terms feeding OR outputs) shows which product term fired. A toggle switches to the L20 p27 stage-grouped (EX / M / WB) layout.
- Aha: All signals except ALUcontrol come from the opcode alone (L12 p18). An X means nothing downstream keeps that value, but signals that change state (RegWrite, MemWrite, Branch) can never be X.
- Verify use: Fill the T05 Q1 table for beq/lw/sub. T05 has no key, so the tool derives it from L12 p34 + p26. Answer AY25/26 Q7 (0x02898820 = add $s1,$s4,$t1, so ALUop = 10) and AY23/24 S2 Q9 option D ('opcode alone is sufficient for ALUControl' is false). Check the addi row for AY15/16 Q9a (RegDst 0, ALUSrc 1; derived).
- Conventions: Opcodes: R 0x00, lw 0x23, sw 0x2B, beq 0x04 (L12 p32). Main table, in the order RegDst ALUSrc MemToReg RegWrite MemRead MemWrite Branch ALUop: R 1 0 0 1 0 0 0 10; lw 0 1 1 1 1 0 0 00; sw X 1 X 0 0 1 0 00; beq X 0 X 0 0 0 1 01 (L12 p34 = L20 p27). PCSrc is not a control-unit output; it is Branch AND isZero (L12 p17). In the single-cycle view L12 p5 attributes RegDst/RegWrite to Decode, while the pipeline puts RegDst in EX and RegWrite in WB (L20 p27). Show both labels.

### [1] ALU-control two-level decoder + 1-bit ALU slice builder
- Module: L12 Control (ALU)
- Sources: L11 p33-34; L12 p20-28; R06 p11-21; T05 Q6-Q7; AY24/25 S1 Q15; AY21/22 S2 Q4 (NAND); AY23/24 S2 Q11
- Inputs: ALUop (2 bits) + funct (6 bits), or a whole instruction. 'Raw ALU' mode: toggles for Ainvert, Binvert and Operation (2 bits) plus two operands.
- Shows: Level 1: opcode to ALUop (00 lw/sw, 01 beq, 10 R-type). Level 2: ALUop + funct to ALUcontrol. Each output bit is evaluated live from its expression: ctrl3 = 0; ctrl2 = ALUop0 + ALUop1·F1; ctrl1 = ALUop1' + F2'; ctrl0 = (F0+F3)·ALUop1. The funct bits that matter are highlighted, and F5/F4 are shown as irrelevant. A 1-bit ALU slice (L12 p21-22) shows how Ainvert/Binvert/Operation give AND, OR, add, sub, slt and NOR. 32-bit result and isZero are shown for the chosen operands.
- Aha: ALUcontrol is literally Ainvert|Binvert|Operation. sub is add with B inverted; NOR is AND of the inverted inputs. So a brand-new NAND needs no new hardware: A'+B' = 1101.
- Verify use: AY24/25 Q15: 0x0235C020 = add $t8,$s1,$s5, so ALUcontrol = 0010. AY21/22 S2 Q4: NAND = 1101 (derived; no key). AY23/24 S2 Q11: the ALU control unit has 8 input bits and 4 output bits. Students can also compare their T05 Q6/Q7 C code against the table.
- Conventions: Codes: 0000 AND, 0001 OR, 0010 add, 0110 sub, 0111 slt, 1100 NOR (L11 p34). Funct: add 100000, sub 100010, and 100100, or 100101, slt 101010 (L12 p26). The lecture derives only ctrl3 and ctrl2 (L12 p27-28); ctrl1 and ctrl0 come from R06 p20. The slt implementation is not shown (L12 p22).

### [1] Critical-path and cycle-time calculator
- Module: L12 Control (single-cycle performance)
- Sources: T05 Q2; R06 p40-42 (AY25/26 midterm Q28 worked); Midterm AY25/26 Q28 answer layout; L12 p35-36; L20 p31; AY23/24 S2 Q8
- Inputs: A component latency table. Preset A is ps from T05 Q2 / R06 p42; preset B is ns from L12 p36 / L20 p31; values are editable. Plus an instruction or instruction class (R-type, addi, lw, sw, beq).
- Shows: The datapath as a timing DAG, with each unit stamped with its arrival time. Parallel branches (PC+4 adder; sign-extend into the ALUSrc mux; Control into ALU-control; shift + branch adder; RegDst mux) are shown with their slack. The critical path is drawn bold. Each component is ticked 'on' or 'not on' the critical path, in the midterm Q28 answer format. Totals are per instruction, and cycle time = the slowest instruction.
- Aha: Series latencies add; parallel ones take the max. For addi, sign-extend + mux (50 ps) hides behind the 200 ps register read. For sub, Read data 2 passes THROUGH the ALUSrc mux, so its 30 ps does count. In a single-cycle design, every instruction pays lw's time.
- Verify use: addi = 400+200+120+30+200 = 950 ps (R06 p42). T05 Q2 has no key; derived values: sub ≈ 980 ps, lw ≈ 1300 ps, cycle time ≈ 1300 ps. L12 p36: ALU 6, lw 8, sw 7, beq 5 ns, so CT = 8 ns. AY23/24 S2 Q8: lw has a longer latency than sw.
- Conventions: Latencies in ps: Inst-Mem 400, Adder 100, MUX 30, ALU 120, Reg-File 200, Data-Mem 350, Control/ALU-control 100, Left-shift/Sign-extend/AND 20 (T05 Q2). The register file is counted for the read and again for the write. Data memory is excluded when unused. Control runs in parallel and is off the path for addi (R06 p42). Simplified model: memory 2 ns, ALU/adders 2 ns, register file 1 ns, other delays negligible (L12 p36). Critical path = longest start-to-finish path; series sum, parallel max (R06 p41; example 5+4+8+6 = 23).

### [1] Implementation timing comparator: single-cycle vs multi-cycle vs pipelined (with laundry warm-up)
- Module: L20 Pipelining I (performance) + L12 p35-38
- Sources: L20 p6-11 (laundry), p30-33, p34 (review question); L12 p36-38; R11 p5, p40; AY15/16 Q3, Q5; AY23/24 S1 Q1-4, Q11
- Inputs: Stage times T1..TN, number of instructions I, an average CPI or an instruction mix with stages used per class, pipeline-register overhead Td, and the clock frequency if given.
- Shows: Three aligned timelines in the style of L20 p30: single-cycle with the 'Waste' shaded, multi-cycle with variable CPI, and pipelined filling then streaming. Formulas are filled step by step: CTseq = max over instructions of the sum of Tk; Timeseq = I×CTseq; CTmulti = max Tk; Timemulti = I×avgCPI×CTmulti; CTpipe = max Tk + Td; cycles = I+N−1; Timepipe = (I+N−1)×CTpipe; speedup. An 'ideal' toggle (equal stages, Td = 0, I >> N) shows the speedup tending to N. The laundry animation has sliders for the slow dryer and for Brian's dependency.
- Aha: Pipelining shortens the whole workload, not one task. The slowest stage sets the beat. Multi-cycle can be SLOWER than single-cycle (920 vs 800 ns).
- Verify use: L20 p31-32 with 100 instructions: 800 ns, 920 ns (CPI 4.6, CT 2 ns), 260 ns (CT 2.5 ns, 104 cycles). L20 p34: 4 cycles = 40 ns at 100 MHz; 8 cycles = 16 ns at 500 MHz. AY15/16 Q5: stages 2/3/4/5/2 ns, 20 instructions → 320 vs 120 ns = 2.67. AY23/24 S1 Q1-4: 144 ns; 2.5 GHz; ≈105.2 ns; 34.2 ns. Laundry: 8 h, 3.5 h, 5.5 h, 4 h.
- Conventions: Formulas exactly as on L20 p31-33. Pipelined cycles = I + N − 1 (L20 p32; R11 p5). Remember the −1 and add Td when given (L20 guide trap). Single-cycle stage times: IM 2, Reg read 1, ALU 2, DM 2, Reg write 1 ns (L20 p31). Multi-cycle is not covered in detail (L12 p37), so the CPI is given or comes from a stated mix (AY23/24 S1 Q3 skips unused stages).

### [1] Pipelined datapath cycle viewer (pipeline-register contents and control groups)
- Module: L20 Pipelining I
- Sources: L20 p12-29 (p18-22 register contents, p23-24 write-register fix, p25-29 control); T10 Q1 + Answers p3-11; T10 Helper Datapaths p2; R11 p3-4
- Inputs: Up to about 5 instructions with start PC and register/memory values. Next/previous-cycle controls. Optional 'bug mode' that does not carry the write-register number.
- Shows: The L20 p29 pipelined datapath. Each instruction is coloured and its colour flows stage to stage. Per cycle, the panel shows the contents of each pipeline register. IF/ID: instruction, PC+4. ID/EX: RD1, RD2, sign-extended imm, PC+4, rt/rd numbers, and the EX/M/WB control bits. EX/MEM: branch target (PC+4)+imm×4, ALU result, isZero, RD2, write-reg number, M/WB bits. MEM/WB: ALU result, memory data, write-reg number, WB bits. Control bits visibly fall off as their stage uses them, and the PC value is shown each cycle. Bug mode writes the result into the register named by the instruction currently in ID, as on L20 p22-23.
- Aha: A pipeline register holds whatever the same instruction will need later. That is why the destination register number must travel down the pipe, and why there is no register after WB.
- Verify use: Replay T10 Q1 and match it with the answer slides: sub $1,$2,$3 = 0x00430822 at 0xFF8; lw $6,4($7) = 0x8CE60004 at 0xFFC; beq $4,$5,L2 = 0x1085FC3F at 0x1000 with target 0x100. Per-stage control values as on T10 Answers p6-10. Also covers the 'associate each signal with its stage' exercise on L20 p26.
- Conventions: Stages are IF, ID (decode + register read), EX, MEM, WB (L20 p12). Control is generated in ID and carried in EX/M/WB groups (L20 p27-28): RegDst, ALUSrc and ALUop in EX; MemRead, MemWrite and Branch in MEM; MemToReg and RegWrite in WB. The branch decision (PCSrc) is made in MEM (L21 p30). Results go into programmer-visible state (L20 p16).

### [1] Pipeline timing chart and hazard simulator (core 'verify my cycle count' tool)
- Module: L21 Pipelining II
- Sources: L21 p5-48; T10 Q2-Q3 + Answers p13-22; T10 Additional Question p3-12; R11 p5-46; R11 Addendum p3-8; AY23/24 S1 Q16; AY23/24 S2 Q17 (per-instruction delay key); AY24/25 S1 Q19; AY25/26 S1 Q19
- Inputs: MIPS code (subset + addi/andi/srl/slt/slti/bne/j as they appear in questions), or a preset. Toggles: forwarding on/off; branch decided in MEM or in ID; branch handling (stall / predict-not-taken / delayed branch / predict-taken as a marked extension); stage where j resolves (ID or MEM, a per-question assumption); branch outcomes from register values or set by hand; stop at 'last stage of instruction X'.
- Shows: A cycle-by-cycle grid in both notations, F D E M W and IM Reg ALU DM Reg, with the register file split-shaded. Bubbles show as stalls, wrong-path instructions as crossed-out (flushed), and forwarding paths as arrows labelled EX/MEM→EX, MEM/WB→EX, ALU→ID or MEM→ID. Each stall has a reason chip such as 'RAW on $t1 from lw (load-use)' or 'branch resolves in MEM'. Totals: total cycles, ideal = I+4, extra cycles, stall events vs stall cycles, nops needed and where. There is also an AY23/24-S2-style table of the extra delay per instruction under each setting, side by side.
- Aha: Each stall is the gap between when a value is produced and when it is needed. Without forwarding, the reader's ID may share a cycle with the writer's WB, so the penalty is 2 cycles, not 3. A lw result exists only after MEM, so forwarding still leaves exactly 1 bubble.
- Verify use: L21 Ex1 = 11/9 and Ex2 = 11/10. Addendum AY24/25 Q19 (a)-(e) = 4 stall cycles, 15, 12, 1 nop after Inst2, 12. AY25/26 Q19 = 5, 18, 13, 0, 14. R11 quiz Q6 = 16/11, Q8 = 11. T10 Additional (a) 20, (b) 14, (d) 83, (e) 56. AY23/24 S1 Q16 (b) 40, (c) 29, (d) 27. AY23/24 S2 Q17: ideal 24; extra 17/7/3.
- Conventions: 5 stages of 1 cycle each; cycles = I + 4 + stalls, counted to the last stage of the final instruction (L20 p32; AY23/24 S2 Q17 wording). Register file writes in the first half-cycle and reads in the second (L21 p11), so without forwarding the reader's ID must be at or after the writer's WB: an adjacent RAW costs 2, distance 2 costs 1 (L21 p22). Forwarding covers ALU to ALU with no stall; an adjacent load-use costs 1 (L21 p18-20). Branch decided in MEM: 3-cycle delay (L21 p30-32). Early branch in ID: 1 cycle (p36), +1 if the operand comes from the previous ALU instruction (p38), 3 in total if from the previous lw (p39). Predict-not-taken flushes on a taken branch (p40-42). Delay slot = 1 with the early branch (p46). Forwarding-unit details are 'not tested in exam' (R11 p14).

### [1] RAW / WAR / WAW dependency classifier with a 'why no stall here' proof and an out-of-order what-if
- Module: L21 Pipelining II (dependencies)
- Sources: L21 p12-14, p19 (lw ... slt $1 = WAR example), p27; R11 p9 ('WAR and WAW do not cause pipeline stalls here'); AY25/26 S1 Q4 (key: WAW); Addendum AY24/25 Q19(e); R11 quiz Q6; L21 p47 (delay-slot example containing a WAR pair)
- Inputs: A code snippet, or a preset. Option to pick one instruction pair. 'Out-of-order mode': drag an instruction's WB earlier or later, or give one instruction a long latency (a beyond-course illustration).
- Shows: A dependency graph: arrows between instruction pairs coloured RAW (red, true dependency), WAR (amber) and WAW (violet), each labelled with its register. For each RAW: the distance in instructions and the stall with or without forwarding, linked to feature 9. For each WAR/WAW: an animated timing proof in the 5-stage in-order pipe, where every read happens in ID (stage 2) and every write in WB (stage 5) in program order. So a later instruction's write can never overtake an earlier read (WAR) or an earlier write (WAW), even with stalls. Out-of-order mode lets the user break that order and watch a register end with the wrong final value, which is why superscalar CPUs care. A 'constraints' panel shows that WAR/WAW still forbid swapping those two instructions when reordering.
- Aha: WAR and WAW are only name clashes. In-order issue with a single WB stage makes them harmless for stalls, but they still constrain reordering: you cannot swap two writers of $s5.
- Verify use: AY25/26 Q4: the snippet's only dependency is WAW on $t2; the key answers E ('WAW hazard') even though it causes no stall. AY24/25 Q19: Inst2 → Inst3 is WAR on $s5, Inst3 → Inst4 is WAW on $s5. The (e) variant (Inst5 = sub $s5,$t1,$t2) adds another WAW and still takes 12 cycles. R11 Q6: B → C WAR on $t6, C → D WAW on $t6. L21 p19-20: lw $2,20($1) ... slt $1,$6,$7 is a WAR on $1 with only the load-use bubble.
- Conventions: RAW = a later instruction reads the destination of an earlier one; this is the true data dependency (L21 p13). WAR and WAW 'do not cause any pipeline hazards' and matter only for out-of-order execution such as superscalar (L21 p14; R11 p9). The slides give no further mechanics, so the proof and the out-of-order demo must be labelled beyond-slides. Exam MCQs may still call a WAW dependency a 'WAW hazard' (AY25/26 Q4 key).

### [1] Branch strategy lab: stall at MEM vs early branch vs predict-not-taken vs delayed branch
- Module: L21 Pipelining II (control hazards)
- Sources: L21 p27-48 (Ex3 p43-45); R11 p21-38, quiz Q7-Q8 p45-46; T10 Q3 + Answers p21-22; T10 Additional (a)-(e); AY23/24 S1 Q5, Q16; AY23/24 S2 Q17; AY19/20 Q7f
- Inputs: Code with branches (or presets: L21 Ex3 loop, T10 Q3, T10 Additional, R11 Q7/Q8). Strategy selector; branch outcome per dynamic instance.
- Shows: The same program rendered under each strategy in stacked mini-grids. Each shows penalty cycles, which fetched instructions get flushed, and the extra stalls when the branch operand is produced right before it (ALU→ID +1; lw→ID +2, so 3 in total). A running scoreboard gives total cycles per strategy, and an explanation chip names the mechanism, e.g. 'decision in MEM: too late' (L21 p30).
- Aha: Early branching saves 2 cycles but makes the branch hungry for operands earlier. After a lw it ends up at 3 stall cycles, no better than before. Prediction only pays off when the guess is right.
- Verify use: L21 Ex3: ideal 26, no prediction 46, predict-not-taken 45. R11 Q7 (predict-taken extension) 9 and Q8 11. T10 Q3: 2 bubbles between lw and beq. T10 Additional (a) 20 vs (b) 14. AY23/24 S1 Q5: 'no branch handling = predict not taken' is the INCORRECT statement (key D).
- Conventions: Decision in MEM → 3-cycle delay (L21 p32). Early branch: comparison in ID with a separate comparator, not the ALU, and the target adder moved to ID (L21 p34-35); 1-cycle delay (p36). Predict-not-taken is the only scheme taught (L21 p40); predict-taken appears in R11 Q7 and old papers, so tag it as an extension. A delayed-branch slot always executes (p46-48). j handling is set per question: MEM in T10 Additional, ID in AY23/24 S2 Q17.

### [1] Loop ideal-cycle counter (dynamic instruction count → I + N − 1)
- Module: L20 Pipelining I
- Sources: AY24/25 S1 Q13 (key 30), AY25/26 S1 Q2 (key 36), L21 p43 (ideal 26), R11 p5 (14) and p40 (15 = 10+6−1), AY23/24 S2 Q17a (24), AY23/24 S1 Q1 (72 dynamic instructions)
- Inputs: Loop code, or quick fields: counter init, step, body length, instructions before and after the loop, number of stages N.
- Shows: Iteration count derived from the bne/beq condition, dynamic count I = before + iterations × body + after, then I + N − 1. Warns when the counter never hits the exit value (init not a multiple of the step) and when bne-with-immediate is a pseudo-instruction.
- Aha: 'Ideal' means hazards are ignored, so only the dynamic instruction count matters. The loop body is counted once per iteration, not once in the source.
- Verify use: 0x10 with step −2: 8 iterations, I = 1+24+1 = 26, 30 cycles. 0x32 with step −5: 10 iterations, I = 32, 36 cycles. L21 Ex3: I = 22, ideal 26.
- Conventions: Ideal cycles = I + N − 1 (L20 p32); 'assume all register values initialised to 0' (AY25/26 Q2).

### [1] Past-paper pipeline template runner, (a)-(e) format
- Module: L21 Pipelining II (exam practice)
- Sources: AY24/25 S1 Q19 + key; AY25/26 S1 Q19 + key; R11 Addendum p3-8 (both worked); R11 p47-49; Past Finals guide §2 (template recurs); AY18/19-AY21/22 pipeline templates (ideal / no-fwd at MEM / fwd at ID / predict-not-taken / reorder)
- Inputs: Pick a paper preset or paste code. Then answer (a) stall cycles without forwarding, (b) total without forwarding, (c) total with forwarding, (d) number of nops and where, (e) total after the stated one-instruction change.
- Shows: The student's answer vs the computed answer for each part, with the grid from feature 9 and the reason for each stall. Stall events and stall cycles are reported separately, matching each key's wording. Nop placement is printed as code.
- Aha: Every year it's the same 5 questions on different code. Once you can read one grid, you can answer all five.
- Verify use: AY24/25: 4, 15, 12, '1 nop after Inst2', 12. AY25/26: 5, 18, 13, 0, 14.
- Conventions: Same timing rules as feature 9. Keys count stalls differently: AY24/25 says '2 stalls of 2 cycles', AY25/26 says '5 stalls of 1 cycle'.

### [2] Datapath fault injector / what-if (stuck-at and inverted signals)
- Module: L11-L12
- Sources: AY15/16 S1 Q9b; AY17/18 S2 Q4b-c; AY20/21 S2 Q10; AY16/17 S2 Q5a; L11 p40; L12 p10-17
- Inputs: Force a control signal or an instruction bit to stuck-0, stuck-1 or inverted. Choose an instruction and the register/memory contents.
- Shows: Correct and faulty runs side by side on the feature-1 datapath, with the first diverging wire flashing. Diff of the final register, memory and PC. A list of the supported instructions that the fault breaks; for example, inverted MemToReg breaks lw and every R-type but not sw or beq.
- Aha: A control signal only matters for instructions whose result passes through the unit it controls. The X entries in the control table are exactly the instructions a fault on that signal cannot hurt.
- Verify use: AY15/16 Q9b: addi $s1,$t1,12 with $t1 = 8 gives ALU result 20. MemtoReg stuck at 1 gives $s1 = Mem[20] = 62 (no key; show the MemRead = 0 caveat). AY17/18 Q4c: ALUSrc stuck at 0 with lw $t1,0($t0), $t0 = 12, $t1 = 34 makes the address 46 instead of 12. AY20/21 Q10 MRQ.
- Conventions: Signal semantics as in features 1-2. L11 p40 models data memory as returning data only when MemRead = 1, so show both readings when a fault depends on that.

### [2] Extend-the-ISA designer (new branch, ALU op or jump: control row, new column, PCSrc gates)
- Module: L12 Control
- Sources: AY25/26 S1 Q18 (bne, with key); AY16/17 S2 Q5b-c (BLT/BGT, PCSrc); AY17/18 S2 Q4d (bne ALUop); AY18/19 S2 Q3 (j, ALUop = 11); AY21/22 S2 Q4 (NAND); L11 p6, p36; L12 p17
- Inputs: Pick a new instruction (bne, blt, NAND, j...). Fill in its control-table row and any new control column, and add gates to the PCSrc logic.
- Shows: A validator that re-runs every existing instruction through the modified control and datapath and flags any that break. For bne it shows PCSrc = beq·Zero + bne·Zero' with the ALU doing a subtract (ALUop 01). For NAND it shows the ALUcontrol bits.
- Aha: bne needs no new ALU behaviour, only the inverted isZero. This answers the 'how?' on L11 p36.
- Verify use: AY25/26 Q18(a): bne row = RegDst X, ALUSrc 0, MemToReg X, RegWrite 0, MemRead 0, MemWrite 0, beq 0, bne 1, ALUop 01; the new bne column is 0 for R/lw/sw/beq (the row is an image; derived from key text (b) and (d)). Key (d): AND bne with the complemented Zero, then OR with the beq path.
- Conventions: No new ALUop may be introduced; existing instructions must not change; the ALU outputs only its result and Zero (AY25/26 Q18 constraints).

### [2] Forwarding lens: values in flight vs register file, with forwarding-unit rule tracer
- Module: L21 Pipelining II (forwarding)
- Sources: L21 p15-18; R11 p11-20 (rules, EX-over-MEM precedence, 'not tested in exam'); T10 Q2 + Answers p13-19; T10 Helper Datapaths p3
- Inputs: A short code sequence with initial register values; a cycle slider.
- Shows: Rows like L21 p16-18: 'Value of $2 in the register file', 'Value of EX/MEM', 'Value of MEM/WB' per cycle; arrows from the pipeline register holding the fresh value to the consumer's ALU input. An expandable rule panel evaluates each cycle: EX/MEM.RegisterRd = ID/EX.RegisterRs or Rt; MEM/WB.RegisterRd = ID/EX.RegisterRs or Rt; RegWrite = 1; Rd ≠ $0; EX hazard wins if both match. Also the load-use detector condition, which T10 Answers p16 shows as HAZARD = 1 followed by a NOP.
- Aha: The value already exists one or two cycles before it reaches the register file. Forwarding just takes it from the pipeline register. When two producers match, the newer one (EX/MEM) must win.
- Verify use: L21 p16-18: $2 goes from 10 to −20; EX/MEM holds −20 in CC4 and MEM/WB in CC5; add/sw read the register file normally. T10 Q2: add $1 → lw rs (EX hazard), a load-use stall (1 nop), MEM/WB → both operands of add $1,$1,$1, then EX/MEM → add $3,$2,$1; derived total 9 cycles. R11 p19 precedence example: add $1,$1,$2 / add $1,$1,$3 / add $1,$1,$4.
- Conventions: Forward only to EX in the R11 treatment (R11 p14). Do not forward when RegWrite = 0 or Rd = $0 (R11 p15). The rule-level detail is marked 'Material not tested in Exam' (R11 p14-20). AY23/24 S1 Q19's hazard-unit signals (PCWrite, IF/IDWrite, mux selects) look out of syllabus (Past Finals guide).

### [2] Delay-slot filler and instruction-reordering sandbox
- Module: L21 Pipelining II
- Sources: L21 p46-48; R11 p36-38; AY23/24 S1 Q12 (key D); T10 Additional (c) p7-9; AY18/19 Q7e, AY19/20 Q16e and AY21/22 S1/S2 Q15e/16e (reorder to cut stalls, no keys)
- Inputs: Code; drag an instruction into the branch-delay slot or to a new position.
- Shows: A legality check that lists any RAW, WAR or WAW dependency the move would violate, and whether the moved instruction affects the branch condition or runs on only one path. If legal, the cycle count is recomputed and the saved cycles are shown, with a before/after grid.
- Aha: This is where WAR and WAW finally matter. They cost no stalls, but they decide which moves are legal. A good compiler hides the load-use bubble or fills the slot for free.
- Verify use: L21 p47: 'or $8,$9,$10' moves into the slot after beq $1,$4 (it reads $10 before xor writes it, so the WAR order is kept). AY23/24 S1 Q12: I5 add $3,$3,$4 can go in the slot (I6 cannot, because bne needs $5). T10 Additional (c): swapping A and B removes the bne stall with early branching.
- Conventions: Branch-delay slot = 1 with the early branch (L21 p46). The moved instruction runs whatever the outcome and must keep the program correct; use a nop if nothing fits (p47-48).

### [2] Structural hazards and split-cycle register file demo
- Module: L21 Pipelining II
- Sources: L21 p5-11; R11 p7-8; AY23/24 S2 Q8 (option D), Q12; AY24/25 Q12
- Inputs: Toggle 'single memory' vs 'separate I/D memory'; toggle 'register file split cycle' on/off; a 4-instruction sequence.
- Shows: Load's MEM and Inst3's IF colliding in CC4 → a 1-cycle bubble (L21 p7-8) or no conflict with split memories (p9). Inst0's WB and Inst3's ID sharing the register file in one cycle, resolved by write-first-half / read-second-half (p10-11). Turning split-cycle off shows the no-forwarding RAW penalty grow from 2 to 3 cycles.
- Aha: The '2 stalls, not 3' rule for no-forwarding RAW comes from the register file's half-cycle trick, not from forwarding.
- Verify use: AY23/24 S2 Q8 (D false: instructions and data are in separate memories); the 'three hazard types' MCQs (AY23/24 S2 Q12, AY24/25 Q12).
- Conventions: Three hazard types: structural, data, control (L21 p5). Graphical notation: horizontal = stages, vertical = instructions (L21 p6).

### [2] Control-signal-by-stage and hazard-facts flashcards / quick quiz
- Module: L12 + L20 + L21 revision
- Sources: L12 p34; L20 p26-27; L21 p5, p14, p20, p32, p36-39, p46; AY23/24 S1 Q5, Q11; AY23/24 S2 Q8-Q11; AY21/22 S2 Q11
- Inputs: Spaced-repetition deck plus generated questions (instruction → signal; signal → stage; scenario → penalty).
- Shows: Instant feedback with the page cite and a 'show me' link that opens the relevant tracer preset.
- Aha: Each fact is tied to the cycle grid or wire it describes.
- Verify use: MCQ practice in the styles of AY23/24 S2 Q8-11 and AY23/24 S1 Q5/Q11.
- Conventions: Use the exact course tables and wording (L12 p34, L20 p27).

### [3] Component 'as a function' / C-model view
- Module: L11 Datapath / T05
- Sources: L11 p16, p17, p23, p27, p33, p40 ('As a Function' boxes); T05 Q3-Q7
- Inputs: Click any datapath element.
- Shows: Its pseudo-code or C model (IM, adder, RegRead/RegWrite, Mux, ALU with isZero, DataMem), with the current inputs substituted in and the outputs computed.
- Aha: Each box in the datapath is just a small function of its inputs.
- Verify use: Compare against your own T05 Q3-Q7 code (T05 has no key).
- Conventions: T05 uses C beyond the lectures (macros, made-up uint<N>_t types). Mark it as for understanding, not exam prep (Tutorials guide).

## Misconceptions and traps (surface as callouts)
- WAR and WAW dependencies do NOT stall the 5-stage in-order pipeline; only RAW does. They matter only with out-of-order execution. Callout: exam MCQs may still name a WAW pair a 'WAW hazard'; the AY25/26 Q4 key answers E for a snippet whose only dependency is WAW on $t2. (L21 p14; R11 p9; AY25/26 S1 Q4 key; Past Finals guide §4)
- Without forwarding, an adjacent RAW costs 2 stall cycles, not 3. Because of the split-cycle register file, the reader's ID can share a cycle with the writer's WB. Distance 2 costs 1 stall; distance 3 costs none. (L21 p10-11, p22; L21 guide 'Key facts')
- Forwarding does not remove the load-use hazard. A lw followed immediately by a consumer still needs exactly 1 bubble. (L21 p19-20; AY24/25 Q19 key (c))
- The early branch is not always 1 cycle. Add +1 when the operand comes from the immediately preceding ALU instruction (ALU→ID forwarding), and 3 in total when it comes from an immediately preceding lw ('no improvement'). (L21 p37-39; R11 p28-30; T10 Answers p21-22; AY23/24 S1 Q5 option C)
- 'Not handling branch hazards at all' is NOT the same as predict-not-taken. With no handling, wrong-path instructions execute (wrong results); predict-not-taken flushes them. (L21 p31 vs p40-42; AY23/24 S1 Q5 key D)
- The branch is decided in the MEM stage of the basic pipeline (3-cycle penalty). The comparison happens in EX, but PCSrc acts in MEM. A student cheat sheet says the outcome is 'not known till EX'. (L21 p30-32; Lab Tutor Cheatsheet p3 (wording))
- Pipelining improves throughput, not the latency of a single instruction. (L20 p11; AY23/24 S1 Q11 key A)
- Single-cycle cycle time is the slowest instruction's total (lw), not the sum over all instructions or stages. The pipelined cycle count is I + N − 1 (don't drop the −1), and the cycle time is max stage + Td. (L20 p31-32; L20 guide traps)
- Multi-cycle is not automatically faster. In the lecture example it is slower than single-cycle (920 vs 800 ns). Ideal speedup = N holds only with equal stages, Td = 0 and I >> N. (L20 p31-33)
- For I-type instructions the destination is rt (Inst[20:16]), which is why the RegDst mux exists. (L11 p25-26; L12 p10)
- The MemToReg mux is drawn with its inputs swapped: 1 selects memory data, 0 selects the ALU result. (L12 p15; L11 p43)
- PCSrc is not a control-unit output. It is Branch AND isZero. (L12 p16-17; R06 p7)
- RegDst and MemToReg are X for sw/beq, but RegWrite (and MemWrite for beq) must still be 0. Signals that change state can never be don't-care. MemRead for sw must be 0, since only one of MemRead/MemWrite may be asserted. (L12 guide traps; L12 p34; L11 p40; AY21/22 S2 Q11 (option E))
- For beq the WR field still receives a register number ($3 or $0) and WD carries a junk value. Nothing is written because RegWrite = 0. Every unit still computes; muxes and enables decide what is kept. (T04 Answers p3)
- For sw the ALU's second operand is the immediate (the address), while Read data 2 goes to the memory's Write Data. lw also sends [rt] to Write Data, unused. (L11 p42; T04 Answers p3 (lw row: Write Data = [$24]))
- This datapath always sign-extends, so andi/ori are not supported. A student cheat sheet claims logical immediates 'route their zero-extended value'; that is not part of the course datapath. (L11 p6; Finals Notes (cs2100-finals-main) p6 (contradicting))
- The opcode alone is not enough for ALUcontrol; R-types need the funct field (two-level decoding via ALUop). Every other signal is opcode-only. (L12 p18, p23-26; AY23/24 S2 Q9 (D false))
- Critical path: parallel branches are not added. In addi, sign-extend + ALUSrc mux (50 ps) and Control (100 ps) hide behind the 200 ps register read. For R-type, though, Read data 2 passes through the ALUSrc mux in series. A student-made 'Extras' checkpoint says sub needs no MUX; that is questionable. (R06 p41-42; Recitation and Tutorial Extras p13-14 (checkpoint 1))
- In the pipeline, the write-register number must travel with the instruction to MEM/WB. Otherwise WB writes into the register named by the instruction now in ID. There is no pipeline register after WB. (L20 p16, p22-24)
- A delay-slot instruction always executes. It must not affect the branch condition and must keep program correctness (insert a nop if none fits). (L21 p46-48; AY23/24 S1 Q12 key D)
- Stall counting differs between keys. AY24/25 counts '2 stalls, each 2 cycles = 4'; AY25/26 counts '5 stalls of 1 cycle'. Always state the stall cycles. (AY24/25 S1 Q19 key (a); AY25/26 S1 Q19 key (a))
- Key wording slip: AY24/25 Q19(c) says '$s5 in Inst3 can be forwarded to Inst4', but Inst4 (addi $s5,$s1,0x23) never reads $s5; Inst3→Inst4 is WAW. The removed stall is Inst4→Inst5 (sub reads $s5). The cycle counts in the key are right. (AY24/25 S1 Q19 key (c))
- Predict-taken is not taught in the lecture ('we only cover the simplest'), yet R11 quiz Q7 uses a 'branch-taken prediction strategy' (9 cycles), and old papers ask about it. So the Past Finals guide's 'probably removed' needs a caveat. (L21 p40; R11 p45; Past Finals guide §3a)
- Possible typo in the T10 Answers: with beq in ID, the slide shows 'ALUOp = 2'. The control table gives beq ALUop = 01 (= 1). Check the PDF. (T10 Answers p8 vs L20 p27)
- Stage attribution differs. The single-cycle table puts RegDst and RegWrite under Decode; the pipeline groups RegDst in EX and RegWrite/MemToReg in WB. (L12 p5 vs L20 p27)
- Forwarding-unit equations and hazard-detection signals are marked 'not tested in exam', but T10 Q2 asks which rule fired. (R11 p14-20; T10 Q2; Past Finals guide §3a (AY23/24 S1 Q19))

## Worked examples (presets and tests)
- **Datapath table + encoding (beq)** (T04 Q3(a), Answers p3): input `beq $1,$3,12` -> expected `hex 0x1023000C; RR1 $1, RR2 $3, WR $3 or $0, WD [$1]-[$3] or random, Opr1 [$1], Opr2 [$3], Address [$1]-[$3], Write Data [$3]; next PC = PC+4 or PC+4+48`
- **Datapath table + encoding (lw)** (T04 Q3(b), Answers p3): input `lw $24,0($15)` -> expected `hex 0x8DF80000; RR1 $15, RR2 $24, WR $24, WD Mem([$15]+0), Opr1 [$15], Opr2 0, Address [$15]+0, Write Data [$24]; next PC = PC+4`
- **Datapath table + encoding (sub)** (T04 Q3(c), Answers p3): input `sub $25,$20,$5` -> expected `hex 0x0285C822; RR1 $20, RR2 $5, WR $25, WD [$20]-[$5], Opr1 [$20], Opr2 [$5], Address [$20]-[$5], Write Data [$5]; next PC = PC+4`
- **Control signals (T05 Q1, derived; no key)** (T05 Q1; derived from L12 p26, p34): input `beq / lw / sub` -> expected `Order RegDst RegWrite ALUSrc MemRead MemWrite MemToReg Branch ALUop ALUcontrol. beq: X 0 0 0 0 X 1 01 0110. lw: 0 1 1 1 0 1 0 00 0010. sub: 1 1 0 0 0 0 0 10 0110`
- **addi control (derived)** (AY15/16 Q9a; derived from L11 p25-28, L12 p24): input `addi` -> expected `RegDst 0, ALUSrc 1, MemToReg 0, RegWrite 1, MemRead 0, MemWrite 0, Branch 0, ALUop 00 (add)`
- **ALUop from hex** (AY25/26 S1 Q7 key): input `0x02898820` -> expected `add $s1,$s4,$t1 → ALUop 10`
- **ALUcontrol from hex** (AY24/25 S1 Q15 key): input `0x0235C020` -> expected `add $t8,$s1,$s5 → ALUcontrol 0010`
- **ALUcontrol bit expressions** (R06 p20 expressions; L12 p26): input `ALUop 10, funct 100100 (and)` -> expected `ctrl3 0, ctrl2 = 0+1·0 = 0, ctrl1 = 0+0 = 0, ctrl0 = (0+0)·1 = 0 → 0000`
- **New NAND op (derived)** (AY21/22 S2 Q4 (options); L12 p22): input `NAND $rd,$rs,$rt` -> expected `Ainvert 1, Binvert 1, Operation 01 (OR) → ALUcontrol 1101`
- **bne control row (derived from key text)** (AY25/26 S1 Q18 key (b),(d)): input `add bne; rename Branch → beq` -> expected `bne: RegDst X, ALUSrc 0, MemToReg X, RegWrite 0, MemRead 0, MemWrite 0, beq 0, bne 1, ALUop 01; bne column = 0 for R/lw/sw/beq; PCSrc = beq·Zero + bne·Zero'`
- **Next PC, always-taken branch** (R06 p43-44 (AY24/25 midterm Q28)): input `0x10000103 at PC 0x491` -> expected `beq $0,$0,0x0103; next PC = 0x495 + 0x40C = 0x8A1`
- **Datapath values for an R-type (derived)** (Midterm AY25/26 Q20-25 (diagram positions not in text)): input `add $t4,$v0,$s1 with $t4=0x100, $v0=0x200, $s1=0x300` -> expected `hex 0x00516020; RR1 2, RR2 17, WR 12; sign-extend output 0x00006020; RD1 0x200, RD2 0x300, ALU 0x500; control RegDst 1, RegWrite 1, ALUSrc 0, MemRead 0, MemWrite 0, MemtoReg 0 (option B)`
- **Critical path addi** (R06 p42; AY25/26 midterm Q28): input `Latencies (ps): IM 400, Adder 100, MUX 30, ALU 120, RF 200, DM 350, Control 100, SE/shift/AND 20` -> expected `400+200+120+30+200 = 950 ps; sign-extend+MUX (50) and Control are off the path; DM unused`
- **Critical path sub / lw (derived; no key)** (T05 Q2 (no answer file); method R06 p41-42): input `Same table as T05 Q2` -> expected `sub = 400+200+30+120+30+200 = 980 ps; lw = 400+200+120+350+30+200 = 1300 ps; cycle time ≥ 1300 ps`
- **Critical path graph** (R06 p41): input `R06 p41 graph` -> expected `5+4+8+6 = 23`
- **Single-cycle instruction times** (L12 p36; L20 p31): input `Memory 2 ns, ALU/adder 2 ns, RF 1 ns` -> expected `ALU 6, lw 8, sw 7, beq 5 ns; CT 8 ns`
- **Three implementations** (L20 p31-32): input `100 instructions; stages 2,1,2,2,1 ns; CPI 4.6; Td 0.5 ns` -> expected `Single 800 ns; multi 100×4.6×2 = 920 ns; pipelined (100+5−1)×2.5 = 260 ns`
- **Review question** (L20 p34): input `add, sub, sll, srl; 100 MHz single-cycle; 500 MHz 5-stage` -> expected `4 cycles = 40 ns; 4+4 = 8 cycles = 16 ns`
- **Max speedup** (AY15/16 S1 Q5): input `Stages 2,3,4,5,2 ns; 20 instructions` -> expected `Single 16×20 = 320 ns; pipelined 24×5 = 120 ns; speedup 2.67 (derived; no key)`
- **Single vs multi vs pipeline** (AY23/24 S1 Q1-Q4 key): input `8-element loop, 3 elements < 5 (72 dynamic instr); 500 MHz single; stages 0.1/0.2/0.2/0.4/0.2 ns; Td 0.05` -> expected `144 ns; 2.5 GHz; ≈105.2 ns multi-cycle with stage skipping; (72+4)×0.45 = 34.2 ns`
- **Laundry** (L20 p7-10): input `4 loads, 4 × 30-min stages` -> expected `Sequential 8 h; pipelined 3.5 h; dryer 60 min → 5.5 h; Brian dependency → 4 h`
- **Ideal loop cycles** (AY24/25 S1 Q13 key): input `addi $s0,$0,0x10; Loop: addi -2; sub; bne; add` -> expected `8 iterations; I = 26; 30 cycles`
- **Ideal loop cycles** (AY25/26 S1 Q2 key): input `addi $s0,$0,0x32; Loop: addi -5; sub; bne; add` -> expected `10 iterations; I = 32; 36 cycles`
- **I + N − 1 variants** (R11 p5; R11 p40): input `10 instructions on 5 stages; 10 instructions on 6 stages` -> expected `14 cycles; 15 cycles`
- **RAW exercise 1** (L21 p21-23): input `sub $2,$1,$3; and $12,$2,$5; or $13,$6,$2; add $14,$2,$2; sw $15,100($2)` -> expected `11 cycles without forwarding, 9 with forwarding`
- **RAW exercise 2** (L21 p24-26): input `lw $2,20($3); and; or; add; sw (as Ex1)` -> expected `11 without forwarding, 10 with forwarding (1 bubble)`
- **Forwarding value trace** (L21 p16-18): input `$2 = 10 initially; sub $2,$1,$3 gives −20` -> expected `Register $2: 10,10,10,10,10/−20,−20...; EX/MEM −20 in CC4; MEM/WB −20 in CC5`
- **Load-use with WAR inside** (L21 p19-20): input `lw $2,20($1); and $4,$2,$5; or $8,$2,$6; add $9,$4,$2; slt $1,$6,$7` -> expected `1 bubble with forwarding → 10 cycles (derived); WAR on $1 (lw→slt) costs nothing`
- **Branch prediction exercise** (L21 p43-45): input `addi $s0,$0,10; Loop: addi $s0,$s0,-1; bne $s0,$0,Loop; sub; forwarding, ID decision` -> expected `I = 22, ideal 26; no prediction 46; predict-not-taken 45`
- **Pipelined datapath trace** (T10 Q1; Answers p5-10): input `sub $1,$2,$3 @0xFF8; lw $6,4($7) @0xFFC; beq $4,$5,L2 @0x1000, L2 = 0x100` -> expected `0x00430822, 0x8CE60004, 0x1085FC3F (imm −961); target 0x1004 − 0xF04 = 0x100`
- **Forwarding rules trace** (T10 Q2; Answers p13-19): input `add $1,$2,$3; lw $1,0($1); add $1,$1,$1; add $3,$2,$1` -> expected `EX→lw rs; load-use hazard → 1 nop; MEM/WB→both operands of add $1,$1,$1; EX/MEM→rt of add $3; 9 cycles (derived); hex 0x00430820, 0x8C210000, 0x00210820, 0x00411820`
- **lw then early branch** (T10 Q3; Answers p21-22): input `add $1,$2,$3; lw $1,0($1); beq $1,$0,L; add $3,$2,$1 (forwarding, ID resolution)` -> expected `2 bubbles between lw and beq; not taken ≈10 cycles, taken ≈11 (derived; answer grids are images)`
- **Control strategies on a loop** (T10 Additional Question p5-12): input `T10 Additional: $s0 = 0xAFAFFAFA, $s1 = 0xFF` -> expected `(a) 20; (b) 14; (c) swap A and B; (d) 2+4×18+9 = 83; (e) 2+4×12+6 = 56 (j resolves in MEM)`
- **Exam pipeline template** (AY24/25 S1 Q19 key; R11 Addendum p3-4): input `AY24/25 Q19 code (Inst1-Inst7)` -> expected `(a) 4 stall cycles (2+2); (b) 15; (c) 12; (d) 1 nop after Inst2; (e) 12`
- **Exam pipeline template** (AY25/26 S1 Q19 key; R11 Addendum p5-8): input `AY25/26 Q19 code (Inst1-Inst9)` -> expected `(a) 5 stall cycles (1+2+2); (b) 18; (c) 13; (d) 0; (e) 14`
- **Recitation quiz** (R11 p44): input `lw $t2; lw $t1,100($t6); sub $t6,$t1,$t2; add $t6,$t2,$t6; and $t3,$t6,$0; sw $t6,50($t1)` -> expected `16 cycles without forwarding, 11 with forwarding`
- **Recitation quiz (branch)** (R11 p45-46): input `lw $s2,0($s1); bne $s2,$s3,L1; sub; L1: add (taken)` -> expected `Predict-taken, ID decision: 9 cycles. Predict-not-taken, MEM decision: 11 cycles`
- **Branch settings on a loop** (AY23/24 S1 Q16 key): input `AY23/24 S1 Q16 loop (array of non-zero elements, 2 iterations)` -> expected `Base register $8; (b) no fwd + ID: 40; (c) fwd + ID: 29; (d) + predict-not-taken: 27`
- **Per-instruction delay accounting** (AY23/24 S2 Q17 key): input `AY23/24 S2 Q17 i1-i20, first iteration, j resolves in ID` -> expected `Ideal 24; extra cycles (b) no fwd + MEM 17; (c) fwd + MEM 7; (d) fwd + ID + predict-not-taken 3`
- **Dependency classification** (AY25/26 S1 Q4 key; L21 p14): input `addi $s0,$0,0x500; addi $s1,$t0,-2; addi $t2,$t1,0x10; add $t2,$s2,$s3` -> expected `WAW on $t2 (key E); no stall`
- **Delay slot** (AY23/24 S1 Q12 key): input `AY23/24 S1 Q12 code` -> expected `I5 (add $3,$3,$4), option D`
- **Fault injection (no key)** (AY15/16 S1 Q9b): input `addi $s1,$t1,12, $t1 = 8, MemtoReg stuck at 1; Mem: 0:57, 4:−43, 8:100, 12:3, 16:98, 20:62, 24:−31` -> expected `ALU 20 → $s1 = 62 (assuming memory outputs Mem[20])`

## Gaps or ambiguities
- WAR/WAW get one slide (L21 p14) and one line (R11 p9): names only, no worked example, no mechanism. Any definitions, the timing proof and the out-of-order demo must be labelled beyond the slides. Use course code that happens to contain WAR/WAW pairs (L21 p19, AY24/25 Q19, R11 Q6) as proof that cycle counts do not change.
- Diagram-heavy pages lose detail in text: L11 p12-48 (all datapaths), L12 p7, p19, p21-22, p30, p33-34; L20 p13, p17, p24-29; every L21 timing grid (p6-11, p16-20, p22-26, p31-45); T10 Answers p5-22 (active lines and grids); R05 exercises p39-48 (fragments only: 0x11200004 = beq $9,$0,4; addu $8,$24,$5); R06 quiz p30-38; R11 quiz p40-43; Midterm Q20-24 diagram positions; AY25/26 Q18 control-table image. The L12 p27 / R06 p20 truth-table extraction has a stray X.
- lw followed by a sw that stores the loaded register (MEM→MEM forwarding) is never addressed in the lectures. A student cheat sheet lists MEM→MEM and EX/MEM→MEM paths. The course model treats every operand as needed at the start of EX (1 stall). Offer a labelled toggle.
- j in the pipeline is not taught. Questions state their own assumption (T10 Additional: target in MEM; AY23/24 S2 Q17: in ID). Make it a parameter.
- Predict-taken: L21 p40 covers only not-taken, yet R11 quiz Q7 uses predict-taken (9 cycles: the target is fetched while the branch is still stalled in ID, since the target does not depend on registers). Treat it as an extension mode and say how the target timing is assumed.
- T10 Q3: the text suggests the add after beq is fetched during the stall and squashed if the branch is taken (predict-not-taken behaviour). That gives about 10 cycles not-taken and 11 taken, but the grids are images. Verify in the PDF.
- Not stated in L21: early branch with a lw two instructions ahead (derived: 1 stall with MEM→ID forwarding) and with an ALU instruction two ahead (0 stalls, as T10 Additional (c) implies).
- T05 has no answer file. The Q1 control values and Q2 latencies (sub 980 ps, lw 1300 ps) are derived and should be marked 'derived, unkeyed'.
- AY15/16 Q9b (MemtoReg stuck at 1) depends on whether data memory outputs data when MemRead = 0. L11 p40's function returns data only if MemRead. No key.
- 'No control hazard mechanism' is modelled as stall-until-resolved in T10 Additional, while AY23/24 S1 Q5 treats 'not handling branch hazards at all' as wrong execution. The app needs explicit definitions for 'stall', 'no handling' and 'predict-not-taken'.
- Keys use inconsistent stall-count wording (stall events vs cycles). The AY24/25 Q19(c) key wording mislabels which pair forwards. The AY25/26 key is marked 'Draft'. The R11 Addendum calls AY25/26's pipeline question Q20; the paper calls it Q19.
- Multi-cycle CPI from an instruction mix is never derived in lecture (L20 p31 gives 4.6). AY23/24 S1 Q3 and AY15/16 Q3 need it (AY15/16's class table is an image).
- Hazard-detection-unit signals and forwarding-mux select codes (AY23/24 S1 Q19) appear in no current material. R11 p14-20 rules are 'not tested'. Keep them in an optional expert panel.
- Pseudo-instructions in pipeline questions (e.g. 'bne $s0, 0, Loop' with an immediate) are counted as one instruction in the keys (AY24/25 Q13, AY25/26 Q2), though the assembler would expand them. Surface this as a note.
- Cross-scope hook: the cache-in-pipeline questions (AY24/25 Q20, AY25/26 Q20: lw hit = 5 cycles, miss = miss penalty + 4) belong to L22-L23, but could reuse this pipeline grid to show a MEM-stage stall.
- A slide oddity: the L11 p41-42 text shows beq's bit pattern beside lw/sw (extraction overlap). L21 p43 text shows '1 + 102 + 1 = 22', which means 1 + (10×2) + 1 = 22.
