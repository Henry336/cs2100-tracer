# CS2100 MIPS datapath / control / pipeline: course model spec

## 1. Instruction subset

**L11 p6 (single-cycle datapath):**
- Arithmetic/logical: add, sub, and, or, addi, andi, ori, slt
- Data transfer: lw, sw
- Branches: beq, bne
- Notes on the slide:
  - andi and ori are not supported, because the design always sign-extends the immediate.
  - sll and srl "can be done by multiplication (which can be done by add with loop)".
  - j "can be done by beq $zero, $zero, label if we ignore the difference related to 256MB blocks".
- p47: "Shifting and Jump are not supported".

**L12 p9 (subset the control unit implements; R06 p5 repeats it):**

| Instr | Opcode (hex) | Funct (hex) | Format |
|---|---|---|---|
| add | 0 | 20 | R (shamt 0) |
| sub | 0 | 22 | R |
| and | 0 | 24 | R |
| or | 0 | 25 | R |
| slt | 0 | 2A | R |
| lw | 23 | – | I |
| sw | 2B | – | I |
| beq | 4 | – | I |

Gaps between the two lists:
- **addi** is in the L11 datapath and is the R06 p42 timing example, but L12 has no control row for it and the L12 PLA does not decode opcode 8.
- **bne** has no control row.

## 2. Datapath components (L11 p12-48; final drawing L11 p48 = L12 p4 = R06 p2)

| Component | Inputs | Outputs | Widths / notes |
|---|---|---|---|
| PC | next PC (from PCSrc mux) | PC | 32. Read during the cycle, written at the next rising clock edge (p18) |
| Instruction Memory | Instruction Address | Instruction | 32 in, 32 out. `IM(addr){return Mem[addr]}` (p16) |
| Adder (PC+4) | PC, constant 4 | PC+4 | 32+32→32 (p17) |
| Register File | RR1, RR2, WR (5 bits each); WD (32); RegWrite | RD1, RD2 (32 each) | 32 regs × 32 bits; at most 2 reads + 1 write per instruction; `if(RegWrite) Reg[WR]=WD` (p23) |
| RegDst mux | in0 = Inst[20:16], in1 = Inst[15:11] | WR | 5-bit wide (p26) |
| Sign Extend | Inst[15:0] | 32-bit value | 16→32 (p28) |
| ALUSrc mux | in0 = RD2, in1 = SignExt | ALU input B | 32 (p28) |
| ALU | A = RD1, B = ALUSrc out; ALUcontrol (4) | ALU result (32), isZero (1) | p34. isZero = "(A op B) == 0?" |
| ALU Control | ALUop (2), funct Inst[5:0] (6) | ALUcontrol (4) | L12 p25 |
| Left Shift 2-bit | SignExt output | 32 | L11 p37 |
| Adder (branch target) | PC+4, shifted offset | target | 32 |
| PCSrc mux | in0 = PC+4, in1 = branch target | next PC | 32 |
| AND gate | Branch, isZero | PCSrc | L12 p16-17 |
| Data Memory | Address (32) = ALU result; Write Data (32) = RD2; MemRead; MemWrite | Read Data (32) | Only one of read/write asserted at a time; `if(MW) Mem[addr]=WD; else if(MR) return Mem[addr]` (p40) |
| MemToReg mux | **in1 = Read Data (top), in0 = ALU result (bottom)** | WD | 32. L12 p15: "IMPORTANT: The input of MUX is swapped in this case" |
| Main Control | Inst[31:26] (6) | RegDst, Branch, MemRead, MemToReg, ALUop(2), MemWrite, ALUSrc, RegWrite | L12 p7, p25, p30 |

**Instruction bits to ports** (field boxes at L11 p48 x 165-189: opcode y 183-243, rs 243-294, rt 294-345, rd 345-395, shamt 395-446, funct 446-507):
- Inst[31:26] → Control
- Inst[25:21] (rs) → RR1
- Inst[20:16] (rt) → RR2 **and** RegDst mux input 0 (junction at 227,311)
- Inst[15:11] (rd) → RegDst mux input 1
- Inst[15:0] → Sign Extend
- Inst[5:0] → ALU Control
- shamt is unused

**Wire fan-outs:**
- RD2 → ALUSrc in0 and Data Memory Write Data (junction 459,356)
- SignExt → ALUSrc in1 and Left Shift 2 (junction 447,404)
- ALU result → Data Memory Address and MemToReg in0 (junction 597,347)
- PC → IM address and the PC+4 adder
- PC+4 → PCSrc in0 and the branch adder (junction 447,104)

**Mux numbering (vector text positions on L11 p48 and L12 p4/p7; same overlays on the raster L12 p30):**
- PCSrc: 0 on top
- RegDst: 0 on top
- ALUSrc: 0 on top
- MemToReg: 1 on top

**L11 p48 layout, if you want to copy it** (point bboxes):

| Element | Bbox / position |
|---|---|
| IM | R(130,70,222,172); address in at right (220,162), instruction out at left (130,124) to a bus at x 128 |
| PC | R(242,74,278,134) |
| PC+4 adder | x 324-369, y 80-132 |
| RegFile | R(330,255,419,387); ports RR1 y 274, RR2 304, WR 338, WD 377, RD1 278, RD2 356; RegWrite enters bottom x 374 |
| RegDst mux | x 264-285, y 332-404; select at bottom |
| Sign Extend | ellipse x 325-415, y 441-482 |
| ALUSrc mux | x 477-498, y 345-417; select at top |
| ALU | x 525-585, y 263-391; ALUcontrol at top with "4"; isZero out (585,303); result out (585,347) |
| Left Shift 2 | ellipse x 388-499, y 141-183 |
| Branch adder | x 567-612, y 122-176 |
| PCSrc mux | x 645-665, y 93-165; output loops over the top (y 56) back into the PC |
| Data Memory | R(618,326,711,446); MemWrite at top, MemRead at bottom |
| MemToReg mux | x 747-767, y 399-471; output runs along the bottom (y 501) back to WD |

**Final datapath + control (L12 p30, also R06 p22).** This page is a raster image, read by OCR plus a pixel trace. It is the drawing above plus:
- A Control box (fed by "Inst [31:26]"). Its outputs, as traced:
  - Branch: goes to the AND gate
  - MemToReg: long wire right
  - MemWrite: down to the top of Data Memory
  - ALUSrc
  - MemRead: down and along the bottom
  - RegDst, ALUop and RegWrite: leave the bottom/left of the box
- An "ALU Control" box under the ALU, with inputs ALUop and "Inst [5:0]" and a 4-bit "ALUcontrol" output.
- An AND gate (Branch, isZero) producing PCSrc.
- This page also labels "Inst [20:16]" explicitly.
- The order of the Control output wires is approximate.

## 3. Control tables

**Signal meanings (L12 p10-17):**
- RegDst: 0 = Inst[20:16], 1 = Inst[15:11]
- RegWrite: 1 = write
- ALUSrc: 0 = RD2, 1 = SignExt(Inst[15:0])
- MemRead: 1 = read Mem[Address]
- MemWrite: 1 = Mem[Address] ← RD2
- MemToReg: 1 = memory data, 0 = ALU result
- PCSrc = Branch AND isZero: 0 → PC+4, 1 → SignExt(Inst[15:0])<<2 + (PC+4)

**Main control (L12 p31/p34; R06 p26-27; L20 p27):**

| | RegDst | ALUSrc | MemToReg | RegWrite | MemRead | MemWrite | Branch | ALUop1 | ALUop0 |
|---|---|---|---|---|---|---|---|---|---|
| R-type | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| lw | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| sw | X | 1 | X | 0 | 0 | 1 | 0 | 0 | 0 |
| beq | X | 0 | X | 0 | 0 | 0 | 1 | 0 | 1 |

Opcode inputs (L12 p32): R-type 000000, lw 100011 (23), sw 101011 (2B), beq 000100 (4).

**PLA (L12 p33-34).** I checked every dot and inversion bubble in the vector drawing:
- AND terms:
  - R-format = Op5'·Op4'·Op3'·Op2'·Op1'·Op0'
  - lw = Op5·Op4'·Op3'·Op2'·Op1·Op0
  - sw = Op5·Op4'·Op3·Op2'·Op1·Op0
  - beq = Op5'·Op4'·Op3'·Op2·Op1'·Op0'
- Outputs:
  - RegDst = R
  - ALUSrc = lw + sw
  - MemtoReg = lw
  - RegWrite = R + lw
  - MemRead = lw
  - MemWrite = sw
  - Branch = beq
  - ALUOp1 = R
  - ALUOp0 = beq

**ALUop (L12 p24):** lw/sw 00, beq 01, R-type 10.

**ALU control (L12 p26):**

| Instr | ALUop | Funct | ALU action | ALUcontrol |
|---|---|---|---|---|
| lw / sw | 00 | xxxxxx | add | 0010 |
| beq | 01 | xxxxxx | subtract | 0110 |
| add | 10 | 100000 | add | 0010 |
| sub | 10 | 100010 | subtract | 0110 |
| and | 10 | 100100 | AND | 0000 |
| or | 10 | 100101 | OR | 0001 |
| slt | 10 | 101010 | slt | 0111 |

- L12 p27 overlays X's that simplify beq to ALUop X1, R-type to 1X, and F5/F4 to X.
- **ALU codes (L11 p34):** 0000 AND, 0001 OR, 0010 add, 0110 subtract, 0111 slt, 1100 NOR.
- L12 p22: the 4 bits are Ainvert, Binvert, Operation[1:0]. For example subtract = 0 1 10 and NOR = 1 1 00.

**ALU control gates.** L12 p28 drawing traced; the full expressions are written out in R06 p20:
- ALUcontrol3 = 0
- ALUcontrol2 = ALUOp0 + ALUOp1·F1
- ALUcontrol1 = ALUOp1' + F2'
- ALUcontrol0 = ALUOp1·(F3 + F0)

Only F3..F0 are used.

## 4. The five stages (L11 p7-46)

L11 p9 merges decode with operand fetch and splits execute into ALU and Memory:

1. **Fetch** (p11-18): PC, Instruction Memory, PC+4 adder.
2. **Decode** (p19-31): Register File read, RegDst mux, Sign Extend, ALUSrc mux. The p31 summary outputs Operand 1 and Operand 2.
3. **ALU** (p32-37): ALU with ALUcontrol and isZero, Left Shift 2-bit, branch adder, PCSrc mux.
   - beq compares with the ALU's isZero and computes the target in parallel (p36).
4. **Memory** (p38-43): Data Memory (MemRead/MemWrite). The MemToReg mux is added here (p43). Non-memory instructions pass the ALU result through.
5. **Register Write** (p44-46): no new element; the result is routed to WD. The WR number comes from Decode. Stores and branches are idle in this stage.

**Per-instruction steps (p8-9):**
- add: rs + rt → rd
- lw: MemAddr = rs + ofst; read memory; write to rt
- beq: Taken = (rs == rt); Target = (PC+4) + ofst×4

**Signal-to-stage table (L12 p5):**
- RegDst: Decode
- RegWrite: Decode **and** RegWrite
- ALUSrc: ALU
- ALUcontrol: ALU
- MemRead/MemWrite: Memory
- MemToReg: RegWrite
- PCSrc: Memory/RegWrite

## 5. Pipelined datapath (L20)

- **Stages (p12-13):** IF, ID (decode + register read), EX (execute / address calculation), MEM, WB.
- **Pipeline registers (p16-17):** IF/ID, ID/EX, EX/MEM, MEM/WB. There is none after WB; results go to the PC, register file and memory.

**Contents of each register (p18-22, plus the p23-24 fix):**

| Register | Carries |
|---|---|
| IF/ID | instruction, PC+4 |
| ID/EX | RD1, RD2, 32-bit sign-extended immediate, PC+4, Instruction[20-16] and [15-11] (p29), control fields WB / M / EX |
| EX/MEM | branch target (PC+4)+(imm×4), ALU result, Zero, RD2 (for sw), write-register number, control fields WB / M |
| MEM/WB | memory read data, ALU result, write-register number, control field WB |

- **Write register path.** p22 notes the bug: the WR number was taken from IF/ID. The fix (p23-24, p29): the number travels with the instruction, i.e. RegDst mux output (504,474) → EX/MEM y 474 → MEM/WB y 474 → back to "Write register" (y 354).

**Control grouped by stage (p27):**

| | RegDst | ALUSrc | ALUop1 | ALUop0 | MemRead | MemWrite | Branch | MemToReg | RegWrite |
|---|---|---|---|---|---|---|---|---|---|
| Stage | EX | EX | EX | EX | MEM | MEM | MEM | WB | WB |
| R-type | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| lw | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 1 | 1 |
| sw | X | 1 | 0 | 0 | 0 | 1 | 0 | X | 0 |
| beq | X | 0 | 0 | 1 | 0 | 0 | 1 | X | 0 |

- p28: control signals are generated in ID and propagated along until used.

**Differences from single-cycle (L20 p25/p29 wiring):**
- The RegDst mux sits in EX: mux at (490-503, 452-496), 0 = [20-16], 1 = [15-11].
- ALU control's 6-bit funct comes from the low bits of the sign-extended immediate in ID/EX.
- Branch AND Zero is evaluated in MEM from EX/MEM. The target comes back to the PC mux from EX/MEM.
- The PC mux is drawn left of the PC: 0 = PC+4 on top, 1 = target.
- MemtoReg mux in WB: 1 = Read data on top, 0 = ALU result.
- Label changes: "Zero" for isZero, "Registers", "Shift left 2", "MemtoReg", "ALUOp".

**p29 layout:**

| Element | Position |
|---|---|
| IF/ID | x 295-310 |
| ID/EX | x 453-468, with WB/M/EX boxes at y 156-227 |
| EX/MEM | x 602-617 |
| MEM/WB | x 747-762 |
| Control ellipse | about (400-435, 160-222), fed at y 191 |
| AND gate | (640-664, 282-306) |

## 6. Timing

**L12 p36** (also L20 p31-32). Memory 2 ns, ALU/adders 2 ns, register file 1 ns, other delays negligible:

| Instr | Inst mem | Reg read | ALU | Data mem | Reg write | Total |
|---|---|---|---|---|---|---|
| ALU (e.g. add) | 2 | 1 | 2 | – | 1 | 6 ns |
| lw | 2 | 1 | 2 | 2 | 1 | 8 ns |
| sw | 2 | 1 | 2 | 2 | – | 7 ns |
| beq | 2 | 1 | 2 | – | – | 5 ns |

- Cycle time is 8 ns, so 100 instructions take 800 ns.
- Multicycle: 2 ns cycle, CPI 4.6, 920 ns.
- Pipelined: 2 + 0.5 = 2.5 ns cycle, (100+5−1)×2.5 = 260 ns.

**R06 p41-42 / T05 Q2 component table (ps):** Inst-Mem 400, Adder 100, MUX 30, ALU 120, Reg-File 200, Data-Mem 350, Control/ALU-control 100, shift/sign-extend/AND 20.
- Method: delays in series add; parallel paths take the max.
- addi = 400 + 200 + 120 + 30 (MemToReg mux) + 200 = **950 ps**.
- Sign-extend + ALUSrc mux (50) runs in parallel with the 200 ps register read.
- Data memory is not used, and the RegDst/WR path is not needed at that point.
- T05 has no answer file. My figures using the same method:
  - sub = 400+200+30+120+30+200 = 980 ps
  - lw = 400+200+120+350+30+200 = 1300 ps
  - so the cycle time would be ≥ 1300 ps

## 7. T04 Q3 (T04 Answers p3)

These are the fixtures FX1-FX3 in the TEST FIXTURES section.

## 8. Encoding and the course instruction list (L06-L08)

**Formats (L08 p9-36):**
- R: op6 rs5 rt5 rd5 shamt5 funct6. Opcode is 0; shifts put rs = 0 and the source in rt.
- I: op6 rs5 rt5 imm16. rt is the destination; branches use `branch $rs, $rt` (p34).
- J: op6 target26.

**Immediates:** signed (sign-extended) except andi/ori/xori, which are zero-extended (L08 p19, L06 p46).

**Branch (p28):**
- Not taken: PC = PC+4.
- Taken: PC = (PC+4) + imm×4.
- So imm = (target − (PC+4))/4, signed 16-bit.

**Jump (p37-39):**
- PC = {PC+4[31:28], target26, 00}
- The target field is address bits 27..2. Range is limited to the 256 MB block (p40).

**Register numbers (L08 p7):**

| Number | Name |
|---|---|
| 0 | $zero |
| 1 | $at |
| 2-3 | $v0-$v1 |
| 4-7 | $a0-$a3 |
| 8-15 | $t0-$t7 |
| 16-23 | $s0-$s7 |
| 24-25 | $t8-$t9 |
| 26-27 | $k0-$k1 |
| 28 | $gp |
| 29 | $sp |
| 30 | $fp |
| 31 | $ra |

**Instructions taught:**
- L06 p45/48: add, addi, sub, sll, srl, and, andi, or, ori, nor, xor, xori.
- L06 p44: lui.
- L07: lw, sw, lb, sb (p11; lh/sh only mentioned), beq, bne, j (p18-21), slt, slti (p28).
- L08 p8 (COD summary table, OCR'd): adds jr ("goto $ra") and jal, given as **"$ra = PC + 4"**. The official green card (`Cheatsheets\MIPS Green Card (official).pdf`) says "R[31]=PC+8". jr is "look up if interested" (L08 p38), and L07 p39 puts procedures out of scope.

**Opcodes/functs (hex):**
- From the slides and green card:
  - add 0/20, sub 0/22, and 0/24, or 0/25, nor 0/27, slt 0/2A, sll 0/00, srl 0/02, jr 0/08
  - addi 08, slti 0A, andi 0C, ori 0D, lui 0F, lw 23, sw 2B, beq 04, bne 05, j 02, jal 03
- From standard MIPS, not on the course card (which only has lbu 24): xor 0/26, xori 0E, lb 20, sb 28.

**Pseudo-instructions:**
- move → add $rd,$rs,$zero (L06 p34)
- blt → slt $t0,$s1,$s2; bne $t0,$zero,L (L07 p29)
- ulw/usw (L07 p12)
- T04 Q2:
  - bgt → slt $at,$r2,$r1; bne $at,$zero,L
  - bge → slt $at,$r1,$r2; beq $at,$zero,L
  - ble → slt $at,$r2,$r1; beq $at,$zero,L
  - li → ori $r,$zero,imm if it fits in 16 bits, else lui + ori
  - nop → sll $zero,$zero,0 = 0x00000000
- 32-bit constant: lui $t0,0xAAAA; ori $t0,$t0,0xF0F0 (L06 p44)

## 9. Expanding opcode (L10 p30)

- L10 p30 states only the idea: "Work with the most constrained instruction types first"; "The opcode has variable lengths for different instructions"; MIPS funct is an example.
- The only worked counting is R04 p45: Type-A has a 4-bit opcode, Type-B an 8-bit opcode.
  - **Max** = 1 + (2^8 − 2^4) = **241**
  - **Min** (all opcode space used) = 15 + 2^4 = **31**
- Rule:
  - For max, give each short-opcode type 1 instruction and spend the rest on the longest type.
  - For min, fill the short types up to 2^k − 1 and keep one prefix per expansion.

---

## TEST FIXTURES

**FX1. beq $1,$3,12 → 0x1023000C**
- Fields: op 4, rs 1, rt 3, imm 0x000C.
- Register file: RR1 = $1, RR2 = $3, WR = "$3 or $0" (Inst[15:11] = 00000), WD = "[$1]−[$3] or random value".
- ALU: Opr1 = [$1], Opr2 = [$3]. Data memory: Address = [$1]−[$3], Write Data = [$3].
- SignExt = 0x0000000C; <<2 = 0x30.
- Next PC = PC+4 if not taken, PC+4+48 if [$1] = [$3].
- Control (L12 table, T05 Q1): RegDst X, ALUSrc 0, MemToReg X, RegWrite 0, MemRead 0, MemWrite 0, Branch 1, ALUop 01, ALUcontrol 0110.

**FX2. lw $24,0($15) → 0x8DF80000**
- Register file: RR1 $15, RR2 $24, WR $24, WD = Mem([$15]+0).
- ALU: Opr1 [$15], Opr2 0. Data memory: Address [$15]+0, Write Data [$24].
- Next PC = PC+4.
- Control: 0 1 1 1 1 0 0, ALUop 00, ALUcontrol 0010.

**FX3. sub $25,$20,$5 → 0x0285C822**
- Fields: rd 25, funct 0x22.
- Register file: RR1 $20, RR2 $5, WR $25, WD = [$20]−[$5].
- ALU: Opr1 [$20], Opr2 [$5]. Data memory: Address [$20]−[$5], Write Data [$5].
- Next PC = PC+4.
- SignExt(0xC822) = 0xFFFFC822 (unused).
- Control: 1 0 0 1 0 0 0, ALUop 10, ALUcontrol 0110.

**FX4. R06 p43-44 (AY24/25 S1 Q28)**
- 0x10000103 = beq $0,$0,0x0103; PC = 0x491.
- RR1 $0, WR $0, Opr1 [$0] (= 0), WD = [$0]−[$0] or MEM(...) (random).
- Taken; next PC = 0x491 + 4 + 0x103×4 = **0x8A1**.

**FX5. R05 Q8 (p45-48)**
- beq $9,$0,End = **0x11200004** at PC 0x1080, with $9 = 0.
- MemRead 0, MemWrite 0; next PC = **0x1094** (End follows the four instructions at 0x1084-0x1090).

**FX6. AY25/26 midterm Q20-25**
- add $t4,$v0,$s1 = add $12,$2,$17 = **0x00516020**.
- Registers: $t4 = 0x100, $v0 = 0x200, $s1 = 0x300.
- Wire values: RR1 2, RR2 17, WR 12, SignExt(Inst[15:0]) = 0x00006020 (option B), RD1 0x200, RD2 0x300, ALU result 0x500.
- Q25 = option B (R-type row).
- Which circled marker sits on which wire was not checked.

**FX7. Slide encodings**

| Instruction | Hex | Source |
|---|---|---|
| add $8,$9,$10 | 0x012A4020 | L08 p12, L11 p24 |
| sll $8,$9,4 | 0x00094100 | L08 p13 |
| add $10,$7,$5 | 0x00E55020 | L08 p14 |
| addi $21,$22,-50 | 0x22D5FFCE (SignExt 0xFFFFFFCE) | L08 p21, L11 p25 |
| lw $21,-50($22) | 0x8ED5FFCE | L11 p29, computed |
| sw $21,-50($22) | 0xAED5FFCE | L11 p42, computed |
| beq $9,$0,3 | 0x11200003 | L08 p31, L11 p30 |
| lw $9,12($8) | 0x8D09000C | L08 p22 |
| j Loop (Loop at 8) | 0x08000002 | L08 p41 |
| beq $0,$0,Loop (second branch) | imm −4 | L08 p32 |

**FX8. T03 Q2 program (base 0x00400028)**

| Address | Word | Instruction |
|---|---|---|
| 0x00400028 | 0x20110000 | addi $s1,$zero,0 |
| 0x0040002C | 0x00084042 | loop: srl $t0,$t0,1 |
| 0x00400030 | 0x11000002 | beq $t0,$zero,exit (exit = 0x0040003C) |
| 0x00400034 | 0x22310001 | addi $s1,$s1,1 |
| 0x00400038 | 0x0810000B | j loop (target 0x0040002C) |

- T03 Q3(c): j loopEnd with loopEnd = 0xFFFFFF44 → 0x0BFFFFD1.

**FX9. Timing**
- L12 p36: 6 / 8 / 7 / 5 ns; cycle time 8 ns.
- R06 p42: addi = 950 ps.
- Derived, not official: sub 980 ps, lw 1300 ps.

**FX10. Expanding opcode (R04 p45)**
- Max 241, min 31.

---

**Ambiguities**
1. bne and andi/ori are listed in L11 p6 but have no control; addi has no L12 row. The derived addi row would be RegDst 0, ALUSrc 1, MemToReg 0, RegWrite 1, MemRead 0, MemWrite 0, Branch 0, ALUop 00, and the given PLA would not produce it.
2. L12 p9 labels bits 20:16 as "rd" for lw/sw/beq. That is a slide typo for rt.
3. Stage placement differs between sources:
   - L11 p31 draws the RegDst and ALUSrc muxes in Decode.
   - L12 p5 puts ALUSrc in the ALU stage.
   - L20 puts both in EX.
4. The ALU has NOR (1100), but the ALU control can never output it (ALUcontrol3 = 0).
5. L11 p41-42 show beq field values under the lw/sw captions (copy-paste on the slide).
6. Zero-flag naming varies: isZero? (L11), is0? (L12 p4/p7), Zero (L20).
7. jal saves PC+4 in L08 p8 and PC+8 on the green card.
8. R06 p43 prints the word as 0x100000103 (9 digits), and PC 0x491 is not word-aligned.

---

I did not render PNG files (read-only session), so the raster slides L12 p19/p30 and the green card were read by OCR. Control-wire ordering on p30 and the midterm marker positions are approximate or unchecked. The sub/lw latencies are my own working, since T05 has no answer key. L21 hazards and pipeline register bit widths were not covered; the slides do not give widths.