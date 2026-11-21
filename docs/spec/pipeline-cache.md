# PIPELINE

## 1. Stages, register file, ideal count, diagrams
- **Stages (L20 p12):**
  - IF fetches the instruction. IM[PC] and PC+4 go into IF/ID, and PC+4 is written back to PC (L21 p29).
  - ID decodes and reads registers.
  - EX runs the ALU operation or computes the address.
  - MEM accesses data memory.
  - WB writes the result to a register.
- **Pipeline registers (L20 p16-22):**
  - IF/ID holds the instruction and PC+4.
  - ID/EX holds the two register values, the sign-extended immediate and PC+4.
  - EX/MEM holds the branch target (PC+4)+imm×4, the ALU result, isZero and ReadData2.
  - MEM/WB holds the ALU result and the memory data.
  - The write-register number travels with the instruction all the way to MEM/WB (p23).
  - Control signals are made in ID and move along as EX/M/WB groups (p25-29).
- **Register file (L21 p10-11, R11 p8):** the cycle is split. A register is written in the first half and read in the second half, so an instruction in WB and one in ID in the same cycle do not conflict.
- **No structural hazards:** instruction and data memories are separate (L21 p7-9).
- **Ideal cycles:** I + N − 1 (L20 p32; R11 p5). For the 5-stage pipeline the course writes "4 + I" (L21 p43).
- **Diagram notations:**
  - Graphical icons IM, Reg, ALU, DM, Reg against CC1, CC2, … (L21 p6, p11).
  - Tables with IF ID EX MEM WB (L21 exercises) or F D E M W (R11, Addendum, T10 extra).
  - Stall placement:
    - Without forwarding, blank cells go between F and D, and the next instruction's F lines up with the stalled instruction's D (L21 p22/p25, Addendum p4/p6).
    - With forwarding (load-use), the blank goes between D and E, and the next instruction has a blank between F and D (L21 p26, R11 p44, Addendum p8).
  - Flushed instructions are drawn three ways: bubble clouds (L21 p42), `*` (T10 extra p6/p12) or struck-through letters (R11 p46).

## 2. Timing (L20 p31-33)
| Design | Cycle time | Time for I instructions |
|---|---|---|
| Single-cycle | max over instructions of Σ stage times | I × CT |
| Multi-cycle | max stage time | I × avg CPI × CT |
| Pipelined | max stage time + T_d | (I + N − 1) × CT |

- **Ideal speedup = N.** This assumes equal stages, T_d = 0 and I ≫ N (p33).
- **Multi-cycle as AY23/24 S1 Q3 uses it:** each instruction takes one cycle per stage it uses. R-type/addi take 4, lw 5, sw 4, beq 3, j 2.

## 3. Data hazards
- **Only RAW stalls.** WAR and WAW "do not cause any pipeline hazards"; they matter only for out-of-order execution (L21 p14, R11 p9).
- **Without forwarding:** the consumer's ID must be at or after the producer's WB (split cycle).
  - Distance 1 → 2 stalls; distance 2 → 1 stall; distance 3 or more → 0 (L21 p22).
  - This applies to every reader, including sw data and branches (AY23/24 S2 Q17b, AY25/26 Q19).
- **With forwarding:** paths are EX/MEM→EX and MEM/WB→EX (L21 p18; R11 p13 "and is at EX while sub is at MEM; or is at EX while sub is at WB").
  - ALU→ALU needs 0 stalls.
  - lw followed immediately by a user needs exactly 1 stall (L21 p19-20).
  - No forwarding into MEM is taught (R11 p14 "only forwarding to EX stage").
- **Forwarding-unit rules (R11 p15-20, "Material not tested in Exam"):**
  - ForwardA/B = 10 from EX/MEM; 01 from MEM/WB.
  - Both require RegWrite and Rd ≠ 0. If both match, the EX hazard wins.
- **Hazard detection (T10 Q2 answers p14-17):** stall when ID/EX.MemRead and ID/EX.RegisterRt equals IF/ID.Rs or Rt. A NOP is inserted.
- **lw then sw:** sw is a normal EX consumer, so an ALU→sw dependency costs 0 stalls with forwarding and 2 without (AY25/26 Inst5→Inst6, AY23/24 S2 i13→i14). A lw→sw store-data case is never worked; see AMBIGUITIES.

## 4. Control hazards
| Resolution | No prediction | Predict not taken |
|---|---|---|
| MEM (base datapath, L21 p30-32) | +3 after every branch (next IF = branch MEM + 1) | +0 if not taken; +3 if taken (3 wrong-path instructions flushed; T10 extra b) |
| ID (early branch, L21 p34-36) | +1 after every branch | +0 if not taken; +1 if taken (1 flushed; L21 p41-42) |

- **Early branch plus data dependency (forwarding on):**
  - ALU producer immediately before the branch → +1 stall through ALU→ID forwarding (L21 p38).
  - lw immediately before → +2 through MEM→ID forwarding. L21 p39 counts "3 total" = 2 data stalls + 1 branch delay; T10 Q3 shows "Two bubbles".
  - lw two instructions before → +1. This is derived from the rule; no source works it.
  - ALU producer two before → 0 (T10 extra c, after the swap).
- **Branch resolved in MEM:** the compare uses the ALU in EX, so normal EX forwarding applies (AY23/24 S2 c: slt→beq costs 0).
- **Predict taken (not in L21; L21 p40 says only not-taken is covered):** R11 Quiz Q7 fetches the target in the cycle after the branch's IF.
- **Delayed branch:** 1 slot with early branch. The slot instruction always executes; if nothing fits, use a nop (L21 p46-48).
- **j:** not in L20 or L21. T10 extra (p10) resolves it in MEM (+3). AY23/24 S2 Q17 resolves it in ID (+1). Make this a parameter.

## P0. Cycle model that reproduces every key
For each instruction in dynamic order, every stage time is at least the previous instruction's same stage + 1 and at least its own previous stage + 1. Then:
- **RAW without forwarding:** ID_c ≥ WB_p.
- **RAW with forwarding:** EX_c ≥ EX_p + 1 for an ALU producer, EX_c ≥ MEM_p + 1 for lw.
- **ID-resolved branch with forwarding:** apply the same bounds to ID_b instead of EX_c.
- **Branch:** IF_next ≥ R_b + 1, where R is ID or MEM. With no prediction this always applies; with predict-not-taken only when the branch is taken. Wrong-path instructions are not counted.
- **j:** IF_next ≥ (ID_j or MEM_j) + 1.
- **Totals:** total = WB of the last counted instruction; stalls = total − (I + 4).

## Diagram-only pages (pipeline)
- **L20:** p7-10, p13-14, p17, p24-26, p29-30.
- **L21:** p6-11, p16, p18-20, p22-26 (grids), p30-32, p35-39, p41-42, p44-45.
- **R11:** p11-12, p16, p18, p20, p22-23, p27-30, p33-34, p40-46 (quiz answers are in the images).
- **R11 Addendum:** p4 and p6-8 (grids).
- **T10 Answers:** p5-19 and p21-22.
- **T10 Additional:** p5-6, p9, p11-12.
- **AY23/24 S2 Answers:** p17 (the delay table is jumbled in the text).

# CACHE

## C0. Rules
- **Address split (L22 p23-27, L23 p11, p26):**
  - Offset N = log2(block bytes).
  - Index M = log2(number of blocks) for direct-mapped, log2(number of sets) for set-associative, and 0 for fully associative.
  - Tag = address bits − N − M.
  - Index and tag come from the block number: block = addr >> N, index = block mod sets, tag = block / sets.
  - Address width is 32 by default. R12 p41-42 derive it from memory size (16 GB → 34 bits, 256 MB → 28 bits).
- **Lookup:** hit = Valid AND tag match (L22 p28). Set-associative and FA caches compare all ways in parallel (L23 p13, p27).
- **Placement and replacement:**
  - On a miss, fill the lowest invalid way: Block 0 before Block 1 (L23 p18-21); FA slots fill in order (p33).
  - Otherwise evict by policy. LRU is the only worked policy, and hits update recency (L23 p29-30).
  - FIFO, RR and LFU are only named (L23 p31, R12 p29).
- **Miss types:**
  - The first access to a block is a cold miss, even if the line holds another valid block (L22 p45).
  - A repeat miss is a conflict miss in direct-mapped or set-associative caches (L22 p49 trace, R12 p23).
  - A repeat miss in a fully associative cache is a capacity miss (R12 p24-25).
  - Aggregate rule: capacity = FA total − FA cold (L23 p28).
- **Write policies:**
  - Write hit: write-through writes cache and memory, using a write buffer (L22 p66-67). Write-back writes cache only, sets the dirty bit, and writes memory on eviction only if dirty (p68).
  - Write miss: write-allocate loads the block, writes the word, then memory follows the write policy. Write-around (called "write no allocate" in L23 p37) writes memory only (L22 p69).
- **Average access time:** hit rate × hit time + (1 − hit rate) × miss penalty, where miss penalty = time to replace the block + hit time (L22 p20-21).
- **Exam pipeline-plus-cache model (R12 p44-48):**
  - Miss penalty = (block bytes / 4) × time per word, plus 1 if a restart is included.
  - lw on a hit takes 5 cycles. lw on a miss takes 5 + words × t.
  - beq takes 5 cycles; it never accesses data memory.
  - Cycles lost = instructions × data fraction × miss rate × penalty.

## Diagram-only pages (cache)
- **L22:** p23, p25-26, p30, p32-51, p56-62.
- **L23:** p6, p13-16, p18-22, p30, p32-35.
- **R12:** p10-12, p26, p35. p46 is shown without its answer mark.
- **AY24/25 and AY25/26 MCQ letters** appear only in red in the PDFs.

# TEST FIXTURES

## Pipeline
| ID | Source | Input | Expected |
|---|---|---|---|
| P1 | L20 p34 | `add $t0,$s0,$s1; sub $t1,$s0,$s1; sll $t2,$s0,2; srl $t3,$s1,2` | single-cycle 4 cycles = 40 ns @100 MHz; pipeline 8 cycles = 16 ns @500 MHz |
| P2 | L20 p31-32 | stages 2,1,2,2,1 ns, 100 instructions, T_d 0.5, CPI 4.6 | 800 / 920 / 260 ns |
| P3 | R11 p5, p40 | 10 instr, 5 stages; 10 instr, 6 stages | 14; 15 |
| P4 | L21 p21-23 | `sub $2,$1,$3; and $12,$2,$5; or $13,$6,$2; add $14,$2,$2; sw $15,100($2)` | no fwd 11 (and +2); fwd 9 |
| P5 | L21 p24-26 | same with first instr `lw $2,20($3)` | no fwd 11; fwd 10 (and +1) |
| P6 | L21 p43-45 | `addi $s0,$zero,10 / Loop: addi $s0,$s0,-1 / bne $s0,$zero,Loop / sub $t0,$t1,$t2`; fwd, ID branch | 22 instr, ideal 26; no prediction 46; predict not taken 45 |
| P7 | R11 p44 | `lw $t2,0($t1); lw $t1,100($t6); sub $t6,$t1,$t2; add $t6,$t2,$t6; and $t3,$t6,$0; sw $t6,50($t1)` | no fwd 16 (C,D,E +2 each); fwd 11 (C +1) |
| P8 | R11 p45 | `lw $s2,0($s1); bne $s2,$s3,L1; sub $s0,$s4,$s5; L1: add $s0,$s0,$s3`; fwd, **predict taken**, ID, taken | 9 |
| P9 | R11 p46 | same code; fwd, predict not taken, MEM, taken | 11 (sub and add flushed; target F7) |
| P10 | AY24/25 Q19; key p17; Addendum p3-4 | `lw $s1,20($s2); lw $s2,40($s5); add $s5,$s2,$s1; addi $s5,$s1,0x23; sub $t1,$s5,$t2; sw $s5,50($s2); add $t5,$a0,$zero` | (a) 4 (2+2: Inst3, Inst5); (b) 15; (c) 12; (d) 1 nop after Inst2; (e) Inst5 = `sub $s5,$t1,$t2` → 12 |
| P11 | AY25/26 Q19; key p16; Addendum p5-8 | `add $s5,$s2,$s3; lw $s2,0($s4); and $t2,$s5,$s4; or $t1,$s2,$s3; and $s2,$s5,$t1; sw $s2,4($s4); lw $s3,4($s4); sub $s5,$t2,$t1; add $s0,$s4,$zero` | (a) 5 (Inst3 +1, Inst5 +2, Inst6 +2); (b) 18; (c) 13; (d) 0; (e) Inst8 = `sub $s5,$t2,$s3` → 14 |
| P12 | AY23/24 S2 Q17 (paper p9; key p16-17) | i1-i20 loop, first iteration; i=0 so both branches not taken; j at end | (a) 24; (b) +17 (i6 +1, i7 +2, i8 +3, i9 +2, i10 +2, i11 +3, i13 +2, i14 +2); (c) +7 (i8 +3, i11 +3, i13 +1); (d) +3 (i7, i10, i13 +1 each) |
| P13 | AY23/24 S1 Q16 | i1-i9 loop: 2 iterations, beq never taken, bne taken then not taken; count to i9's last WB | (b) 40; (c) 29; (d) 27 |
| P14 | AY23/24 S1 Q1-4 | 72 dynamic instructions | 144 ns; 2.5 GHz; 105.2 ns; (72+5−1) × 0.45 = 34.2 ns |
| P15 | T10 Q3 (answers p21-22) | `add $1,$2,$3; lw $1,0($1); beq $1,$0,L; add $3,$2,$1`; fwd, ID branch | beq ID at 6 (2 bubbles); not taken → add WB 10; taken → target IF 7, WB 11 |
| P16 | T10 extra; $s0 = 0xAFAFFAFA, $s1 = 0xFF | A-H loop as written | (a) 20; (b) 14; (c) swap A and B; (d) 2 + 4×18 + 9 = 83; (e) 2 + 4×12 + 6 = 56 (j in MEM) |
| P17 | AY24/25 Q13; AY25/26 Q2 | addi 0x10, step −2; addi 0x32, step −5 | 30 (B); 36 (A) |
| P18 | AY25/26 Q4; R11 p43 | WAW-only sequence; dependency checklist | E (WAW); WAR B→A, RAW F→D, RAW E→D, WAW D→C true |
| P19 | AY23/24 S1 Q12; Q5 | delay slot candidates; incorrect statement | D (I5); D |

## Cache
| ID | Source | Input | Expected |
|---|---|---|---|
| C1 | L22 p29; p54 | 16 KB direct-mapped, 16 B blocks; 32 B direct-mapped, 8 B blocks | offset/index/tag = 4/10/18; 3/2/27 |
| C2 | L22 p31-51 | 16 KB direct-mapped; reads 0x14, 0x1C, 0x34, 0x8018, 0x10 | cold M, H (spatial), cold M, cold M (valid, tag mismatch), conflict M; final idx1 tag0, idx3 tag0 |
| C3 | L22 p63-65 | store to 0x18 after C2 | write hit; Word2 becomes X; memory inconsistent |
| C4 | L22 p55-62 | 4, 0, 8, 12, 36, 0, 4 (C1 second config) | M H M H M M H; final idx0 tag0 [A,B], idx1 tag0 [C,D] |
| C5 | L22 p21 | hit 0.8 ns, DRAM 10 ns, target 1 ns | h = 0.98 |
| C6 | L23 p12; p17; p27 | 4 KB 4-way 4 B; 2-way with four 8 B blocks; FA 4 KB 16 B | 2/8/22; 3/1/28; tag 28 + offset 4 |
| C7 | L23 p14-15 (= R12 p26) | blocks 0 4 0 4 0 4 0 4, 4-block cache | direct-mapped 2 cold + 6 conflict; 2-way 2 cold + 6 hits |
| C8 | L23 p17-22 | 4, 0, 8, 36, 0, 2-way | M H M M H; set0 {tag0 M[0],M[4]; tag2 M[32],M[36]}, set1 {tag0 M[8],M[12]} |
| C9 | L23 p30 | 4-way LRU, blocks 0 4 8 12 4 16 12 0 4 | last 5: H, M (evict 0), H, M (evict 8), H; final LRU→MRU 16, 12, 0, 4 |
| C10 | L23 p32-34 | four 8 B blocks; 4, 8, 36, 48, 68, 0, 32 | direct-mapped: 7 M; final idx0 tag1 M[32],M[36], idx1 tag0, idx2 tag1 M[48],M[52]. FA LRU: 6 M + 32 hit; tags 8, 0, 4, 6. 2-way LRU: 7 M; set0 {tag0, tag2}, set1 {tag0} |
| C11 | T11 (**no key; computed**) | 16-bit words, direct-mapped 16 × 4 B blocks; 4, 92, 7, 146, 30, 95, 176, 93, 145, 264, 6 | direct-mapped: M c, M c, H, M c, M c, M conflict, M c, H, H, M c, H; final idx1 t0 M[4],M[6]; idx2 t4 M[264],M[266]; idx4 t2 M[144],M[146]; idx7 t1 M[92],M[94]; idx12 t2 M[176],M[178]. 2-way and FA: M M H M M H M H H M H (6 cold); 2-way set4 {t4, t5}, set7 {t2 M[92], t0 M[28]} |
| C12 | R12 p40-42 | three quiz configurations | 5/10/17, 0x12345678 → tag 00010010001101000, idx 1010110011, off 11000; 2^12 sets, 64 MB; offset 8, tag 20 |
| C13 | MCQs | AY24/25 Q14; AY25/26 Q9; AY23/24 S1 Q15; AY25/26 Q5; AY23/24 S1 Q13, Q14 | 19; 20; D; A; C; B |
| C14 | AY24/25 Q20 | 16 B blocks, 10 cycles/word, 95 %, 32 % data, 100 instructions | 40 (41 ok); 5; 45 (46 ok); 64 (66; "total" 95/96); False |
| C15 | AY25/26 Q20 | 16 B blocks, 5 cycles/word, restart included | 21; 5; 25; beq 5; False |
| C16 | AY23/24 S2 Q18 | I-cache 2-way LRU 16 words, i1 at 0x00400050; D-cache direct-mapped 512 words, 4-word blocks | (a) 2,3; (b) 10; (c) 5; (d) 7,4; (e) 248 (key 248-250); (f) 191 (191-192); (g) 190 (190-192) |
| C17 | AY23/24 S1 Q20 | 4×4 transpose loop; A = 0x1000, B = 0xa010; sw allocates | (a) idx0 0x81 M[0x1020]/[0x1024]; idx1 0x502 M[0xa048]/[0xa04c]; idx2 0x81 [0x1030]; idx3 0x81 [0x1038]. (b) set0 0x102 [0x1020] \| 0x103 [0x1030]; set1 0x103 [0x1038] \| 0xa04 [0xa048]. Alternative key if sw is ignored: 0x81 [0x1028] in (a), 0x102 [0x1028] in (b) |

# AMBIGUITIES
1. **What "number of stalls" means.** The AY24/25 key says "2 stalls… each 2 cycles = 4". The AY25/26 key says "5 stalls, each 1 cycle". The Addendum writes them as "2 + 2" and "1 + 2 + 2". Report stall cycles.
2. **T10 Q3 behaves like predict-not-taken.** The question only says "resolution at ID", but the diagram fetches the next add in cycle 4 and lets it continue, giving 10 cycles. The no-prediction rule (L21 p36/p44, AY23/24 S1 c) would give 11.
3. **j has no lecture rule.** It resolves in MEM in T10 extra and in ID in AY23/24 S2 Q17.
4. **Predict-taken is used but not taught.** R11 Quiz Q7 and AY23/24 S1 Q5 option B use it; L21 p40 covers only not-taken.
5. **WAW.** L21 p14 and R11 p9 say WAR/WAW cause no hazards, but the AY25/26 Q4 key ("Draft") answers E, a WAW hazard. Classify dependencies, but stall only on RAW.
6. **lw then sw storing the loaded value.** No source works it. The course's EX-only forwarding implies 1 stall; make it configurable.
7. **lw → early branch.** L21 p39 says "3 total" (2 data stalls + 1 branch delay); T10 Q3 says "two bubbles". Count them separately. L21 p41-42's "known in cycle 3" means resolved at the end of ID and the correct instruction fetched in cycle 3.
8. **Forwarding rules.** R11 marks them "not tested", yet T10 Q2 uses them. R11 p20 prints "EX/MEM.RegisterRd ≠ ID/EX.RegisterRs" inside `not(...)`; the intent is "=", meaning the EX hazard takes precedence.
9. **Miss penalty and the restart cycle.** AY24/25 accepts 40 or 41, and 45 or 46. AY25/26 uses 21 and 25, with 4 non-MEM stages. The formula lw miss = 5 + words × t reproduces both papers' main answers. AY24/25's "95/96" alternative is my inference: 32 × (0.95 + 0.05 × 40).
10. **Miss-type frameworks disagree.** R12 p23-25 puts conflict misses in direct-mapped/set-associative only and capacity misses in FA only. L23 p28 says capacity misses are the same for any associativity at the same size. The two give different labels for L23 p32's 6th access (0), which FA LRU also misses. Use R12 for per-access labels and L23 for totals.
11. **Write-miss default.** AY23/24 S1 Q20 assumes sw allocates but also accepts ignoring sw. "Write around" (L22) and "write no allocate" (L23 p37, R12 p37) are the same policy.
12. **Key errors.** The AY23/24 S2 Q18(c) key gives a 3-bit offset and set 0 for 16 B blocks; it should be 4 bits and set 1, but the count of 5 is unchanged. The (e)/(g) keys name the clashing C element one index higher than my simulation (C[463] vs C[462]), but it is the same block. The Addendum calls AY25/26's question "Q20"; the paper numbers it Q19.
13. **T11 has no answer file.** The C11 values are computed only. T11 states no replacement policy, but no eviction happens, so it does not matter.

I didn't check old papers without keys (AY15/16-AY21/22) or the lab material, and didn't view every trace frame image; the L22 Load #1-3 frames and part of Exercise 2 are skipped, though the text and final states agree. The C11 and lw→sw fixtures come from my own reasoning, not an official key; treat them as provisional.