# Feature sweep: mips-isa

Raw research output. Priority 1 = high exam value or high confusion.

## Features (18)
### [1] MIPS Stepper (ISA-level simulator with C mirror and execution profile)
- Module: MIPS Stepper
- Sources: L06 p8-23 (walkthrough), p45-46; L07 p8-16, p19-38; T02 Q4; T03 D1, Q1-Q3; Lab 3 p3-8, Lab 4 p1-5, Lab 5 p1-6; AY23/24 S2 Q16, AY24/25 S1 Q18, AY21-22 S2 Q15, AY19-20 Q1, AY18-19 Q1
- Inputs: Paste MIPS code (labels, comments, .data/.word/.asciiz, the course subset plus li/la/move/blt/bgt/bge/ble/nop/ulw), initial register values (decimal or hex), base addresses or .data contents, optional text start address (default 0x00400000) and endianness toggle. Buttons: Step, Step back, Run to line, Run, Reset.
- Shows: Each step highlights the current line, shows PC and PC+4 and the effective address for loads and stores. The register that changed flashes with old and new value, in both decimal and hex. A one-line meaning appears in register-transfer notation (e.g. $t4 <- $t0 + $t3). Memory is a byte grid with a word view; a lw/sw outlines its 4 bytes. Branches show 'taken/not taken' plus the compared values. A side panel keeps per-line hit counts and branch-taken counts, total REAL instructions executed (a pseudo-instruction counts as its expansion), and the unique bytes read. Optional C mirror pane lights up the matching C line. Writes to $zero are shown being discarded. An unaligned lw/sw raises a visible error, as QtSpim does.
- Aha: 'Registers have no type' becomes visible: the same register is an address in lw and a value in add. Labels take no space. Walking an array adds 4 to the address, not 1. A do-while-shaped loop (branch at the bottom) always runs its body once. That is why L07 Ex3 executes only 6 instructions.
- Verify use: Final register and array values and 'how many instructions / how many times does bne branch' MCQs can be checked directly: L07 Ex3-5, T03 D1 (final arrays, 4 sw), T02 Q4, AY23/24 S2 Q16c-d, AY24/25 Q18a, AY21-22 S2 Q15a. An 'answer check' box compares the student's number with the run and explains the difference (e.g. counted a pseudo-instruction as 1).
- Conventions: Register numbers and names per L06 p25 / L08 p7. addi/slti/lw/sw/lb/sb/beq/bne sign-extend; andi/ori/xori zero-extend (L06 p41, p46; L08 p19). lui fills the upper 16 bits (L06 p44). Byte addressing, 4-byte words, consecutive words differ by 4 (L07 p7). lw/sw must be aligned; lb/sb can use any offset (L07 p11-12, p15); ulw/usw are pseudo-instructions (L07 p12). srl is a logical shift (L06 p35, p38). Only real instructions count for performance (L06 p8). syscall codes 1/4/5/10 in $v0, argument in $a0 (Lab 4 p1). jal sets $ra = Addr(jal)+4 in QtSpim (Lab 5 p3). Default text 0x00400000 (Lab 3 p4); default .data 0x10010000 (Lab 4 p4: arrayA at 0x10010000, count at 0x10010014). Procedures and stack are out of lecture scope (L07 p39), so jal/jr should be marked as lab-only.

### [1] Instruction Encoder / Decoder with field colouring
- Module: Encoding
- Sources: L08 p5-22, p33-34, p46-47 (green card); R04 p11-18, p38-41; T03 Q2; T04 Q3(i); AY23/24 S2 Q16e-g, AY24/25 Q18c-d, AY25/26 Q6-Q7, AY24/25 Q15; Midterm AY25/26 Q13
- Inputs: Either one assembly line (register names or numbers), or a 32-bit word in hex or binary. Optional: the instruction's address (needed to turn a label into a branch or jump field), and a toggle between $t0 and $8 style names.
- Shows: Six steps. (1) Look up the opcode/funct on a green-card table and decide the format (opcode 0 → R, 2 → J, else I). (2) Field table in decimal with remarks such as 'destination', 'first operand', 'not a shift → shamt 0'. (3) A 32-bit bar with colour per field (opcode, rs, rt, rd, shamt, funct, imm, target), widths 6/5/5/5/5/6 or 6/5/5/16 or 6/26. (4) The same bits regrouped into 8 nibbles with field colours still visible across nibble boundaries. (5) The hex word in 8 digits. (6) Decode mode runs the same pipeline backwards and also prints the sign-extended immediate in decimal. A 'Common mistake' toggle re-encodes with rs/rt swapped, the offset taken from PC instead of PC+4, or a byte offset, so the student can see which wrong answer they produced.
- Aha: Assembly order (rd, rs, rt) is not bit order (rs, rt, rd). The colour bar makes the swap obvious. For sll the source sits in rt and rs is 0. rd, shamt and funct merge into the I-format immediate (5+5+6 = 16). The 16-bit immediate is why constants and offsets are limited (L08 p4, p19).
- Verify use: Every past paper has 2-4 marks of 'encode X in hex' (Past Finals guide section 2). Students type their hex and get a field-by-field diff showing which field is wrong. It also matches the AY23/24 S2 Examplify answer format (8 hex digits, capitals, no 0x).
- Conventions: R: opcode 0, funct selects the operation, shamt 0 for non-shifts, rs 0 for shifts, shift source in rt (L08 p10, p13, p15). I: rt is the destination for addi/lw (L08 p18). ld/st $rt, C($rs) (L08 p33). In a branch the first register is rs (L08 p34). The immediate is signed except for andi/ori/xori (L08 p19, p34). lui: rs = 0, opcode 0xF (AY25/26 Q6 key). Convert to hex in 4-bit groups (L08 p12). A 16-bit immediate is 4 hex digits; negatives are 2s complement (L08 p21: -50 → 0xFFCE). Register table L08 p7. The course's green card is 'a pedagogical MIPS32-style subset, mostly MIPS I' (L08 p47).

### [1] Branch offset visualizer (PC-relative ruler)
- Module: Branch & Jump
- Sources: L08 p23-32, p45-46; R04 p19-24; T03 D1(d), Q3(b); T04 Q3; AY23/24 S2 Q16f, AY24/25 Q18c; Midterm AY25/26 Q14; R06 p43-44 (AY24/25 Q28)
- Inputs: A code listing (addresses taken from a given start, or from any one known instruction's address), and a chosen beq/bne line. Reverse mode: hex word plus PC.
- Shows: An address column ('rlt addr' style 0, 4, 8, … as on L08 p29) beside the code; labels sit between rows and use no address. Markers: PC (the branch), PC+4 (the next instruction), and the target. An arc counts instructions one by one from PC+4 to the target and prints imm = (target − (PC+4))/4. The value is also shown as 16-bit 2s complement hex and as the full encoding. Reverse mode sign-extends the immediate, multiplies by 4 (shown as << 2), adds it to PC+4, and prints the target. A range gauge shows ±2^15 instructions (±2^17 bytes) around PC+4.
- Aha: The immediate counts the instructions skipped, measured from the instruction after the branch, because the hardware has already computed PC+4 (L08 p28). A backward loop branch is negative. Two branches to the same label get different immediates, while two j's to that label encode identically (T03 Q3d).
- Verify use: Checks branch-encoding marks and next-PC MCQs: L08 p31 (imm 3), p32 (imm −4), T03 D1(d) (−9), T03 Q3(b) (16), AY23/24 S2 Q16f, AY24/25 Q18c (0x1180000B; the key itself lists 0x1180000C as the 'from PC' mistake), Midterm Q14 (0x40BC), R06 AY24/25 Q28 (0x8A1).
- Conventions: Not taken: PC = PC+4. Taken: PC = (PC+4) + imm×4 (L08 p28). The immediate is in words (L08 p27). Labels are not instructions (L07 p19; T03 Q3b note 'count only the instructions'). Instruction addresses are word-aligned (L08 p23).

### [1] Jump target visualizer (pseudo-direct addressing and 256 MB blocks)
- Module: Branch & Jump
- Sources: L08 p35-41, p45-46; R04 p25-28; T03 Q2, Q3(c)-(d); AY23/24 S2 Q16h, AY24/25 Q18e-f, AY21-22 S2 Q15d; Midterm AY25/26 Q16; AY25/26 Q15
- Inputs: The address of the j and either a target label/address (encode) or a j word (decode). An optional 'equivalent instruction' mode asks whether a beq/bne/j can replace a given branch or jump at that PC.
- Shows: The 32-bit target address is drawn as three coloured slices: [top 4 bits taken from PC+4] [26-bit field = address bits 27..2] [00]. Encode: drop the two zero bits, keep 26, prepend opcode 000010, regroup into hex. Decode: take the 26 bits, append 00, prepend PC+4[31:28]. Memory is drawn as 16 blocks of 256 MB (0x00000000, 0x10000000, …) with the current block shaded. It highlights the edge case where a j at the last word of a block (0x?FFFFFFC) has PC+4 in the next block. The equivalence mode shows the beq immediate that reaches the same target (e.g. j 0x2B4 at 0x1014 equals beq $v0,$v0,−857).
- Aha: j ignores displacement and uses PC; branches ignore PC's high bits and count displacement (L08 p46). Two jumps to the same label encode identically. The 4 PC bits are spliced into the address and never touch the opcode.
- Verify use: Checks j-encoding marks (every paper), 'address of Inst4 given Inst16' sub-parts, and MCQs about equivalent encodings or j range (AY25/26 Q15 → 0x08000404; Midterm Q16 → A). Also shows the T03 Q3(c) slide-text typo (0xFFFFFFFF44 should be 0xFFFFFF44).
- Conventions: New PC = {PC+4[31:28], target26, 00} (L08 p37-39). Range is the current 256 MB block; jr is for crossing it (L08 p38, p40). j is J-format, opcode 2 (L08 p41). The L08 p41 worked example: Loop at 8 → field 2.

### [1] C ↔ MIPS pattern translator (goto rewrite, side by side)
- Module: C-to-MIPS
- Sources: L06 p26-32; L07 p10, p13, p16, p18-34; T02 Q3; T03 Q1, Q3; AY23/24 S2 Q16a-b, AY24/25 Q18b, AY21-22 S1 Q6, AY21-22 S2 Q15b
- Inputs: Pick a construct (if, if-else, while, for, do-while, && short-circuit, array-by-index, array-by-pointer) or paste a short C snippet in the course subset. Give a variable → register mapping and the array base registers. Reverse mode: paste MIPS and get C.
- Shows: Three linked columns: original C, the 'if (...) goto' rewrite (L07 p25-26), and MIPS. Each C clause and its MIPS lines share a colour. A toggle shows the direct translation against the inverted-condition one with the instruction count of each (L07 p22). Array access expands into its steps: index×4 via sll, add to base, lw (L07 p33). The pointer version keeps an end address of base+4n (L07 p34). && compiles to two separate exit branches (T03 Q1). Decompile mode turns beq…Exit around a block back into if (i != j) (L07 p24).
- Aha: Every loop is just a conditional branch plus a jump. Inverting the test saves the extra j. Running both array versions on the same data in the stepper shows the pointer version does fewer real instructions (computed: 40 non-zero words → 325 vs 245, counting bge as slt+beq).
- Verify use: MIPS→C sub-questions (2-6 marks every paper): AY23/24 S2 Q16a-b ((i%4)/2 and C[k]=A[i]+B[i]), AY24/25 Q18b. Students write their C, the tool runs both versions on random arrays, and it flags any mismatch.
- Conventions: Variable mapping notation (L06 p28). Temporaries in $t registers (L06 p30). sub operand order matters (L06 p29). In MIPS, branch/jump down = selection and up = repetition (L07 p19). C ints are 4 bytes and chars 1 byte, so char arrays use lb with no ×4 (T03 Q1; L07 p11). Exam questions ask for a 'non-line-by-line' C translation (AY24/25 Q18b).

### [1] Inequality branch builder (slt + beq/bne)
- Module: C-to-MIPS
- Sources: L07 p28-30, p33; R03 p42; T03 D1(e); T04 Q2(a)-(c); AY21-22 S1 Q11; AY15-16 Q2
- Inputs: Choose a condition (a<b, a>b, a<=b, a>=b) and whether you want to branch when it is true or false. Or paste an slt/beq/bne pair and have the tool name it.
- Shows: A 2-step derivation. (1) Which slt operand order makes $at = 1 (a<b: slt a,b; a>b: slt b,a). (2) bne $at,$zero branches when the slt was true; beq $at,$zero branches when it was false (≥ or ≤). A live number line with two draggable values shows $at and whether the branch is taken. The pseudo-instruction name (blt/bgt/bge/ble) and its real expansion using $at are displayed. A 'loop exit' variant shows which of 5 candidate instruction groups correctly close a loop.
- Aha: slt is the only comparison you need. Swapping operands gives >. Switching bne to beq negates the condition, so all four inequalities come from one instruction (L07 p30).
- Verify use: T03 D1(e) (slt $t5,$t4,$t3; beq … = bge $t4,$t3,skip), T04 Q2 expansions, AY21-22 S1 Q11-style MRQs ('which groups close the loop'), and decompiling slt/beq pairs in MIPS→C questions.
- Conventions: No real blt in MIPS (L07 p28). blt = slt + bne, as on L07 p29 (slide uses $t0). The assembler's expansions use $at (T04 Q2a). Pseudo-instructions are 'usually not allowed in test/exam' (Lab 3 p7). T02 p1 says only li and la are used.

### [1] Bit Lab: masks, shifts and minimal instruction sequences
- Module: Bit Lab
- Sources: L06 p35-44; T02 Q1-Q2, D2; Lab 4 p4; Midterm AY25/26 Q15, Q17; AY25/26 Q14; AY24/25 Q11; AY19-20 Q3(a)-(b)
- Inputs: A 32-bit register value. Click bits to choose a target (set / clear / invert / copy bits i,j,k from register b into a / copy inverted and shifted). Or type a sequence of and/andi/or/ori/xor/xori/nor/sll/srl/lui and step through it.
- Shows: Two or three 32-bit rows (source, mask, result) with bit numbers 31..0 and nibble separators. Each step shows the mask, the result, and the hex value. For a target pattern the tool generates the shortest sequence. It uses lui+ori when the mask needs any bit at or above 16 (or has the high bits set to 1 for a clear mask). It explains why andi alone cannot clear high bits and why or with $t0 does not clear the other bits. The 'register as data' preset extracts opcode (srl 26) and rs (sll 6; srl 27) from an instruction word held in a register.
- Aha: OR with 1 sets, AND with 0 clears, XOR with 1 flips. 16-bit logical immediates only reach bits 0-15, so anything wider needs lui. andi $t1,$t0,51966 gives 0x22, not 0xABCD0022, because the upper half of the immediate is zero. x % 2^k is andi with 2^k − 1 (Lab 4).
- Verify use: T02 Q2(a)-(c) (exact masks 0x4304 with lui 1, 0x008A, 0xFFFFFF75, 0xFFFFFEEB), Midterm Q17 (runs each option and shows which leave exactly 0x00009200), AY25/26 Q14, AY24/25 Q11 (nand options), Midterm Q15 (which instruction cannot implement move), Lab 4 masks.
- Conventions: Bit 31 is the MSB on the left (T02 Q2 note). Logical immediates are zero-extended (L06 p41, p46). No NOT: use nor $t0,$t0,$zero, or xor with all 1s (L06 p42-43). There is xori but no nori (L06 p43). sll/srl fill with 0 (L06 p37-38). Shift amount 0-31 (L06 p45). T02 Q2 asks for bitwise immediates written in binary (T02 p4).

### [1] Immediate extension and 32-bit constant visualizer (sign vs zero, lui/ori)
- Module: Bit Lab
- Sources: L06 p33, p41, p44-46; L08 p19, p33-34; T02 D2(b)-(d); T04 Q2(d); T01 Q1; AY21-22 S1 Q10A; Midterm AY25/26 Q17(ii)
- Inputs: A 16-bit immediate (decimal, hex or binary) and an instruction (addi, slti, lw, sw, beq, andi, ori, xori, lui), or a 32-bit constant to load.
- Shows: The 16-bit field is expanded to 32 bits in an animation. Sign extension copies bit 15 into bits 16-31 (shown in the sign-bit colour). Zero extension fills them with 0s. lui shifts the value into bits 31-16. A range check shows whether the value fits C16_2s [−32768, 32767], C16 [0x0000, 0xFFFF] or C5 [0, 31]. For a 32-bit constant: the split into upper and lower halves, lui then ori, and a side-by-side failure demo of lui then addi when bit 15 of the lower half is 1. li is expanded into ori (fits in 16 bits) or lui+ori.
- Aha: 0xFFFF in ori means 65535, but the same bits in addi mean −1. That one fact explains why li uses ori, why lui+addi corrupts the upper half, and why 'andi $z,$x,-1' is not the identity.
- Verify use: 'Valid or not, and fix it' questions (T02 D2), immediate-range MCQs (Midterm Q17 option ii: 0x9200 is out of addi's range), AY21-22 S1 Q10A ('the processor sign-extends constants for bitwise operations' is false), and checking lui/ori pairs in T02 Q2.
- Conventions: C16_2s is sign-extended; C16 is a raw pattern, not sign-extended (L06 p45-46). No subi: use addi with a negative constant (L06 p33). The 16-bit immediate is a 2s complement signed integer except for bitwise operations (L08 p19). The lower half goes in with ori, not addi (L06 p44). Sign extension preserves value (T01 Q1).

### [1] Expanding-opcode space visualizer and calculator
- Module: ISA Design
- Sources: L10 p24-30; R04 p45; Recitation and Tutorial Extras p11-12, p17-18; Finals Notes p4-5; AY15-16 Q6; AY16-17 Q4b-d; AY20-21 Q3; AY21-22 S2 Q12; AY23/24 S2 Q7; Midterm AY25/26 Q19, Q27
- Inputs: Total instruction length (or mixed lengths per class), number of registers, address-space size, and per-class operand lists (registers, constants, addresses, shamt), or the opcode widths directly. Constraints: at least one per class, opcode space fully used, a class with a fixed count (e.g. 'only 2 instructions'). Objective: max or min total, or max of one class.
- Shows: Each class's opcode width is derived as instruction length minus operand bits, and the classes are sorted shortest opcode first. A prefix tree (or a stacked bar of the 2^n pattern space) shows the allocation level by level. Take k codes of the shortest opcode for class 1. Each code left over expands by 2^(next width − this width) into codes for the next class, and so on down the levels. Max: give each short-opcode class its minimum (1) and let the longest class absorb the rest. Min: give each short class all but one code and pass a single prefix down. It also shows the equivalent 'budget equation' Σ count_i·2^(L−w_i) = 2^L and warns when the two methods disagree (e.g. when equal opcode widths or a fixed-count class make the prefix assignment matter).
- Aha: A short opcode is 'expensive' because each value uses up a whole block of patterns. That is why max and min push in opposite directions. MIPS funct is the same idea: opcode 0 expands into 64 R-type instructions (L10 p30).
- Verify use: Past papers repeatedly ask for exact max/min counts; the lecture only states the idea (Past Finals guide 3b). Presets: R04 p45 (241/31), AY20-21 Q3 (110), AY15-16 Q6 (236), AY23/24 S2 Q7 (226, with C fixed at 2), Midterm Q27, Zephyr AY16-17 Q4c-d. the student's open midterm Q20 dispute (key 198 vs shared-prefix 142) can be checked against both methods.
- Conventions: 'Work with the most constrained instruction types first'; the opcode has variable lengths (L10 p30). The R04 p45 method: Max: set aside one opcode for the short type; Min: set aside 15 (all but one). Questions state 'each type must have at least one instruction' and 'encoding space completely utilized' (AY20-21 Q3, AY15-16 Q6). Register field width is ceil(log2(#registers)) (12 registers → 4 bits, AY23/24 S2 Q7). Byte-addressed memory of 512 B gives a 9-bit address. The drawback of an aggressive scheme is complex decode logic (Midterm Q19, option A, no key).

### [1] Memory, byte addressing and alignment visualizer
- Module: Memory
- Sources: L07 p4-16, p37-38; R03 p30-38, p43; L10 p16; T03 Q1; Lab 3 p7-8; AY21-22 S2 Q9
- Inputs: A base register value, an offset and an access type (lw/sw/lb/sb/ulw), or an array declaration (int or char, base address, index).
- Shows: A byte grid with addresses. Words are boxed on 4-byte boundaries, and each address is tagged aligned or misaligned by its last hex digit (0/4/8/C). Effective address = base + offset is shown as an addition. A[i] → base + 4i is drawn as sll i,2 then add. For ulw, the 4 bytes it reads are highlighted, and repeated ulw's build a 'unique bytes read' set. lb/sb at any offset is accepted; a misaligned lw/sw produces an error. Address space: k-bit address → 2^k bytes, and MIPS has 2^30 words.
- Aha: The next word is +4, not +1. A string walk uses +1 because chars are bytes. The L07 Ex5 answer of 13 unique bytes appears directly as 10 overlapping 4-byte windows from base+1 to base+13.
- Verify use: Alignment MRQs (AY21-22 S2 Q9: for lb, D and E are the true statements, computed), L07 Ex5 iv (13), Lab 3 sb/lb offsets (lb $t0,4($a0)), and offset sub-questions such as A[7] = h + A[10] → 40($s3), 28($s3).
- Conventions: Byte addressing (L07 p4). A word is aligned if its address is a multiple of 4 (L07 p6; R03 p43). The sum of base and offset must be a multiple of 4 for lw/sw (L07 p15). The base register holds an address (L07 p14). lb/sb offsets need not be multiples of 4 (L07 p11). ulw/usw are pseudo-instructions made of lb/sb plus other operations (L07 p12).

### [2] Endianness visualizer
- Module: Memory
- Sources: L10 p17-18; R02 p8; R04 p36; Finals Notes p4; Lab 3 p6-7; AY21-22 S1 Q7; AY18-19 Q1f; Midterm AY25/26 Q18
- Inputs: A 32-bit word in hex (or 4 bytes with a start address), an endianness toggle, and an optional 'read as' choice (int, ASCII string, lb at offset k, lh).
- Shows: The same 4 bytes laid out at addresses a..a+3 under big-endian (MSB at the lowest address) and little-endian (LSB at the lowest), side by side, with arrows from each byte of the word to its cell. Reading the bytes as an int gives a different value under each order. Reading them as a string gives the same characters under both. lb at offset k returns different bytes. The QtSpim data-tab view (little-endian words) shows why 'Hello' appears reversed inside each word (an inference from L10 p18).
- Aha: Endianness only matters when a multi-byte value is split into bytes or reassembled from them. Byte arrays and strings are unaffected, and byte reordering does not change a word's count of 1 bits (Midterm Q18).
- Verify use: AY21-22 S1 Q7 (Cats: A, B, D true; C's 1130460273 is off, the big-endian value is 1130460275; computed, no key). L10 p17's 0xDEADBEEF example. Lab 3 'where is Hello stored'. Any lh/lb-from-word question (AY18-19 Q1f) can be run with the stated or assumed endianness.
- Conventions: Big-endian: MSB at the lowest address (IBM 360/370, 68000, MIPS (SGI), SPARC). Little-endian: x86, VAX, Alpha (L10 p17). MIPS endianness is implementation-specific (L10 p17 note). The online interpreter is little-endian (L10 p18). R02 p8 calls 'our MIPS' big-endian. The app must make the mode explicit and default sensibly (big for exam reasoning, little for QtSpim mode).

### [2] Pseudo-instruction expander and real-vs-pseudo checker
- Module: Pseudo-instructions
- Sources: L06 p8, p34; L07 p12, p29; T02 p1, D2; T04 Q2; Lab 3 p4-7; Lab 5 p2-3; AY15-16 Q2; Midterm AY25/26 Q15, Q26; AY18-19 Q1f
- Inputs: A pseudo-instruction (move, li, la, blt, bgt, bge, ble, nop, ulw, or an exam-invented one such as nand, sllv, lhw) with operands, or a whole program.
- Shows: The expansion into real instructions, with $at highlighted as the assembler temporary. Size-dependent choices are shown: li → ori if the value fits 16 bits, else lui+ori; la → lui alone if the low half is 0, else lui+ori. A QtSpim-style text segment view: [address] [hex] [native code] [; source line]. Lines with no source are the extra instructions an expansion produced. Every later address shifts when an expansion grows, and the tool shows which branch and jump fields change as a result. nop is shown as the all-zero word.
- Aha: A pseudo-instruction is a MIPS-to-MIPS translation. Performance counts only real instructions. Because expansions can change the size of the code, an instruction's address in QtSpim may differ from a naive count. In Lab 5, jal sits at 0x0040000C because la str1 assembled to a single lui; this reading is an inference.
- Verify use: T04 Q2(a)-(e) answers. 'Which is a pseudo-instruction' MCQs (AY15-16 Q2: bgt). Midterm Q15 (which implementation of move fails: andi 0xff). Instruction-count questions where the code uses bge (L07 p33 counts 2 real instructions per bge). Lab 3/5 address readings.
- Conventions: move → add $rd,$rs,$zero (L06 p8, p34). blt = slt+bne (L07 p29). li $v0,10 → ori $2,$0,10 (Lab 3 p4). nop = sll $zero,$zero,0 = 32 zero bits (T04 Q2e). $at ($1) is reserved for the assembler (L08 p7). In exams, li/la only (T02 p1); pseudo-instructions are 'usually not allowed in test/exam' (Lab 3 p7).

### [2] Instruction validity linter ('Is this a legal MIPS instruction?')
- Module: Encoding
- Sources: T02 D2(a)-(e); L06 p27-29, p33, p45-46; L07 p15; L08 p9; Past Finals guide section 4 (AY23/24 S1 Q12 slt with immediate); AY23-24 S2 to AY25-26 inventory note 8 (bne $s0, 0, Loop)
- Inputs: One instruction line, optionally with a comment stating its intended effect.
- Shows: Checks with a short reason for each: operand order against the comment (destination first), whether the mnemonic exists (subi does not; slt with an immediate should be slti), immediate range per kind (C16_2s, C16, C5), a register operand where an immediate is written (bne $s0,0,L), and that a lw/sw constant offset keeps alignment when the base is known. It proposes the course-standard fix (e.g. addi $t2,$t1,-3; lui $t0,0xAC12 then or; sll $t5,$t2,1).
- Aha: Most 'invalid' instructions fail because of the 32-bit format: 16 immediate bits, 5 shamt bits, 5 register bits. The rules stop looking arbitrary once linked to the field widths (L08 p4, p9).
- Verify use: T02 D2 answers line by line. It also catches the known typos in exam papers and keys before a student trusts them.
- Conventions: Syntax is op dest, src1, src2 (L06 p27). # starts a comment (L06 p26). C5 is 0..31, C16_2s is −2^15..2^15−1, C16 is a 16-bit pattern (L06 p45). Shifting 33 is equivalent to shifting 1 (T02 D2e answer).

### [2] Instruction → datapath field-routing table
- Module: Datapath bridge
- Sources: T04 Q3(ii); T04 guide trap; L08 p10, p18; AY23/24 S2 Q10; R06 p43-44
- Inputs: One encoded or assembly instruction (R, lw, sw, beq, addi), register contents, and PC.
- Shows: The T04 table filled in: RR1, RR2, WR, WD, ALU Opr1/Opr2, Data-memory Address and Write Data, and the next PC. Each cell is coloured like the instruction field that feeds it (rs → RR1, rt → RR2, rd or rt → WR). For beq it shows that WR still receives rt (or $0) but RegWrite is 0, so WD is junk. For lw, WD = Mem([rs]+imm). Branch next PC = PC+4 or PC+4+imm×4.
- Aha: The field positions chosen in L08 (rs and rt in the same place in R and I format, L08 p16) are exactly what lets one datapath read both formats without a decoder in the way.
- Verify use: T04 Q3(a)-(c) tables. AY23/24 S2 Q10 (for some instructions RR1 is unused, e.g. sll and lui). The beq decode-and-trace question R06 AY24/25 Q28.
- Conventions: Notation from T04 Q3: $5 is a register number, [$5] its contents, Mem(X) the memory at X. rt is the destination for I-format (L08 p18).

### [2] Execution-count and loop-formula analyzer
- Module: MIPS Stepper
- Sources: L07 p27, p35-38; R03 p67; AY21-22 S2 Q8; AY15-16 Q11b; AY18-19 Q1b; AY20-21 Q5
- Inputs: A loop (or any program) plus input data, or a symbolic iteration count. A 'possible totals' mode lets data-dependent branches vary.
- Shows: Per-line execution counts grouped into setup + iterations × body + exit-check. The algebraic form is written out (e.g. 2 + 4×10 + 1 = 43 for L07 p27, which matches the expression on R03 p67). It also says which branch was taken how many times and which instruction is the k-th executed. In 'possible totals' mode it enumerates the reachable instruction counts when an inner branch can go either way (6 or 7 instructions per iteration, last iteration fixed).
- Aha: Instruction counts follow a simple formula once the loop is drawn as setup, body and exit. Checking the exit condition costs one extra pass through the branch.
- Verify use: Instruction-count MCQs: L07 Ex3 (6), Ex4 (15), Ex5 (10 executions / 9 taken / 42). AY21-22 S2 Q8 (9, 15, 43, 63 possible; 14 not; computed). AY18-19 Q1b (3 branches for $s0=43). 'Which is the 7th instruction executed' (AY15-16 Q11b).
- Conventions: Count real instructions only (L06 p8). The L07 p35 tip: decompile to C first, or trace.

### [3] Storage-architecture animator (stack / accumulator / load-store / memory-memory)
- Module: ISA Design
- Sources: L10 p4, p7-14; AY16-17 Q4a (Zephyr stack ISA)
- Inputs: An expression such as C = A + B, or a short statement such as x[i] = x[i] + 5, and the memory values of the variables.
- Shows: Four synchronised panes run the same computation. Stack: push and pop on a visible stack. Accumulator: one special register. Load-store: R1..R3 plus memory. Memory-memory: a single Add C,A,B. Each pane tracks instruction count, memory accesses, and which operands are implicit.
- Aha: 'Implicit vs explicit operands' becomes concrete: a stack Add names no operands at all. Load-store needs more instructions, but they are simple and fast, which is why RISC machines such as MIPS use it (L10 p14).
- Verify use: Concept MCQs on storage architectures. Checking hand-written stack code for a Zephyr-style question by running it.
- Conventions: The four code sequences for C = A + B exactly as on L10 p9. Examples: IBM 701 and PDP-8 are accumulator machines; 68000 and 80386 are register-memory; MIPS and Alpha are load-store; VAX is memory-memory (L10 p8).

### [3] Addressing-mode explorer
- Module: ISA Design
- Sources: L08 p43-46; L10 p19-20; Finals Notes p4
- Inputs: A mode (register, immediate, displacement/base, register indirect, indexed, direct, memory indirect, auto-increment, auto-decrement, scaled, PC-relative, pseudo-direct), register and memory contents, and the operand fields.
- Shows: Animated computation of the effective address: which registers and memory words are read, in what order, the operand fetched, and the register side effects (auto-inc/dec). A MIPS badge marks the modes MIPS actually has.
- Aha: L10 says MIPS has 3 addressing modes (register, immediate, displacement) while L08 lists 5. The extra two, PC-relative and pseudo-direct, locate branch and jump targets rather than data operands.
- Verify use: MCQs on which mode an instruction uses (beq is PC-relative, j pseudo-direct, lw base) and on mode semantics such as R1 ← R1 + Mem[Mem[R3]].
- Conventions: The mode table on L10 p20 (e.g. scaled: Mem[100+R2+R3*d]). L08 p46: 'beq, bne: ignore PC, count displacement; j: use PC, ignore displacement'.

### [3] Shift-and-add constant multiplier / fewest-instruction rewriter
- Module: Bit Lab
- Sources: L06 p38; T02 Q3; Midterm AY25/26 Q3; Recitation and Tutorial Extras p9
- Inputs: An arithmetic expression over mapped registers with small constant multipliers (e.g. d = 6a + 3(b − 2c)), or a constant k for x×k.
- Shows: An algebraic factoring step (6a + 3b − 6c = 3(2(a − c) + b)), the decomposition of each constant into powers of 2 (3 = 4 − 1 or 2 + 1), and the resulting sll/add/sub sequence with an instruction count. The stepper verifies the result on random inputs.
- Aha: Multiplying by 2^n is one sll. Factoring the expression first is what minimises instruction count; shortening each term separately does not.
- Verify use: T02 Q3(d) (5 instructions). Midterm Q3 (which ×5 sequence fails: each candidate is run on random inputs). L06 p38 (a*8 → sll 3).
- Conventions: No multiply instruction is used in the course subset for this purpose. sll fills with 0s (L06 p37-38). Use $t registers for temporaries (L06 p30).

## Misconceptions and traps (surface as callouts)
- Assembly writes rd first, but bits are ordered rs, rt, rd. Putting the destination in the rs slot is the most common encoding error. The AY24/25 key lists 0xAE890000 (rs/rt swapped) as the likely mistake for sw $s4,0($t1). (L08 p12 'Note the ordering of the 3 registers'; AY24/25 S1 Final Answers Q18d; Midterm AY25/26 Q13 distractor 0x8c6fff9c)
- In sll/srl the source register goes in rt and rs is 0; shamt holds the amount. (L08 p13 'Note the placement of the source register', p15)
- In beq/bne the first register written is rs, not rt. (L08 p34 'The first register is NOT rt but is rs instead!')
- The branch offset counts from PC+4 (the next instruction), not from the branch itself. The AY24/25 key flags 0x1180000C as the 'from PC' mistake. AY21-22 S1 Q10C tests the false idea that backward branches count from the branch. (L08 p28, p30; AY24/25 S1 Answers Q18c; AY21-22 S1 Q10)
- The branch immediate is in words (instructions), not bytes. A byte offset such as −3428 is 4× too large. (L08 p27; Midterm AY25/26 Q16 option D)
- Labels are not instructions and take no address. Count only instructions when computing offsets. (L07 p19; T03 Q3(b) answer note)
- The j field stores target bits 27..2 (address >> 2). The top 4 bits come from PC+4, not PC, and do not replace the opcode. A j at the last word of a 256 MB block therefore jumps into the next block. (L08 p37-40; L08 guide 'Branch and jump rules')
- Two j's to the same label encode identically; two branches to the same label do not. (T03 Q3(d))
- andi/ori/xori zero-extend their immediate; addi/slti/lw/sw/beq sign-extend. So ori with 0xFFFF does not give −1, and andi $t1,$t0,51966 gives 0x22. (L06 p41, p46; L08 p19; AY25/26 S1 Answers Q14; AY21-22 S1 Q10A)
- Load the lower half of a 32-bit constant with ori after lui, not addi. addi sign-extends and corrupts the upper half when bit 15 is 1. (L06 p44, p46; L06 guide Traps)
- MIPS has no subi; use addi with a negative constant. (L06 p33; T02 D2(c))
- A 32-bit constant cannot go in an immediate field (ori $t3,$t4,0xAC120000 is invalid), and shamt must be 0-31 (sll by 33 is invalid). (T02 D2(d)-(e); L08 p9, p19)
- The next word's address is +4, not +1. lw/sw base+offset must be a multiple of 4; lb/sb can use any offset. (L07 p11, p15; R03 p43)
- A register has no type. A base register holds an address, not A[0]'s value. (L07 p14; L07 guide Traps)
- slt + bne branches when the comparison is true; slt + beq branches when it is false (≥/≤). Swap slt operands for >. (L07 p28-30; R03 p42 'Mindful with slt-beq/bne pair'; T04 Q2)
- Inverting the condition gives shorter code. When decompiling, beq … Exit around a block means if (i != j). (L07 p22, p24)
- A loop whose branch is at the bottom always runs its body once. In L07 Ex3, beq falls through on the first pass, so only 6 instructions execute. (L07 p35; L07 guide Exercise answers)
- Only real instructions count for performance. A pseudo-instruction such as bge counts as its 2-instruction expansion. (L06 p8; T04 Q2)
- srl is a logical shift (fills with 0). C's >> on signed values is arithmetic in GCC/Clang, so they differ for negative numbers. (L06 p35 footnote, p38)
- MIPS has no NOT instruction: use nor $t0,$t0,$zero, or xor with all 1s. There is xori but no nori. (L06 p42-43)
- In C, '&' and '&&' are different, and 'if (x & 1 == 0)' parses as x & (1 == 0). (Recitation and Tutorial Extras p8 (T02 Q1 context))
- && in C compiles to two separate exit branches (short circuit). For char arrays use lb with no ×4. (T03 Q1 note and answers)
- MIPS endianness is implementation-specific. Slides list MIPS (SGI) as big-endian, but the online interpreter and QtSpim are little-endian. Strings and byte arrays are unaffected by endianness. (L10 p17-18; R02 p8; Finals Notes p4)
- 'MIPS has 3 addressing modes' (L10) and the 5 modes listed in L08 do not conflict. L08 adds PC-relative and pseudo-direct, which locate branch and jump targets. (L10 p19; L08 p43-46)
- Expanding opcode: for MAX give the short-opcode types the minimum (usually 1) and the longest type the rest. For MIN give short types all but one code and pass one prefix down. 'At least one per type' and 'fully utilized' are part of the question. (R04 p45; AY20-21 Q3 wording; L10 p30)
- In the datapath, beq still routes rt (or $0) to WR, but RegWrite = 0, so WD is junk. (T04 Q3(ii) answer; Tutorials guide T04 Trap)
- nop is sll $zero,$zero,0, which encodes as 0x00000000. bne $0,$0,L and other writes to $0 also act as no-ops. (T04 Q2(e); AY21-22 S2 Q10)
- beq $s1,$s1,L is always taken, but a bne or a beq on two different registers only reaches the same target on some inputs. A j is equivalent only if the absolute target address matches. (AY25/26 S1 Answers Q15)
- jal: QtSpim and the lecture cheat sheet give $ra = Addr(jal)+4; the green card says PC+8. (Lab 5 p3; L08 guide Traps)
- Key and paper typos to flag. T03 Q3(c) prints 0xFFFFFFFF44 (should be 0xFFFFFF44). AY24/25 Q18c writes 'exit = 0x1011' (means 11; the encoding 0x1180000B is right). AY23/24 S1 Q12 'slt $2,$2,124' should be slti. AY24/25 Q13 and AY25/26 Q2 write 'bne $s0, 0, Loop' (treat as $zero). R06's AY24/25 Q28 PC 0x491 is unaligned and the paper prints 0x100000103 with an extra 0. (Tutorials guide T03; AY24/25 S1 Answers p16; Past Finals guide section 4; AY23-24 S2 to AY25-26 inventory note 8; Recitations guide R06)
- R04 p32 (like L09 p11) says round toward −∞ picks the value 'nearest to positive infinity'. That is a slide typo: it picks the value nearer −∞. (R04 p32; L09 guide Traps)
- AY16-17 Q5 gives BLT opcode 0x08, which is addi's real opcode. That clashes if the datapath must still support addi. (AY15-16 to AY17-18 inventory notes)

## Worked examples (presets and tests)
- **R-format encode** (L08 p11-12; R04 p12-13): input `add $8,$9,$10` -> expected `fields 0|9|10|8|0|32 → 0x012A4020`
- **R-format shift encode** (L08 p13): input `sll $8,$9,4` -> expected `fields 0|0|9|8|4|0 → 0x00094100`
- **R-format encode** (L08 p14): input `add $10,$7,$5` -> expected `0x00E55020`
- **I-format negative immediate** (L08 p20-21; R04 p16-17): input `addi $21,$22,-50` -> expected `fields 8|22|21|-50 → 0x22D5FFCE`
- **I-format load** (L08 p22; R04 p18): input `lw $9,12($8)` -> expected `fields 35|8|9|12 → 0x8D09000C`
- **Branch offset forward** (L08 p29-31): input `beq $9,$0,End at rel addr 0; End at rel addr 16` -> expected `imm 3 → 0x11200003`
- **Branch offset backward** (L08 p32; R04 p24): input `beq $0,$0,Loop at rel addr 12; Loop at rel addr 0` -> expected `imm -4 → 0x1000FFFC`
- **Jump encode** (L08 p41): input `j Loop at addr 20; Loop at addr 8` -> expected `target field 2 → 0x08000002`
- **R04 quiz encode** (R04 p38): input `addi $9,$10,-32` -> expected `0x2149FFE0`
- **R04 quiz branch** (R04 p39): input `beq $s0,$s1, target 4 instructions below PC+4` -> expected `0x12110004`
- **R04 quiz decode** (R04 p40): input `0x8D8BFF1D` -> expected `lw $11,-227($12)`
- **R04 quiz decode** (R04 p41): input `0x001289C2` -> expected `srl $17,$18,7`
- **T04 encode** (T04 Q3): input `beq $1,$3,12; lw $24,0($15); sub $25,$20,$5` -> expected `0x1023000C (next PC = PC+4 or PC+4+48); 0x8DF80000; 0x0285C822`
- **T03 coffee-spill decode** (T03 Q2 answers): input `first instr at 0x00400028: 0x20110000, 0x00084042, 0x11000002, 0x22310001, 0x0810000B` -> expected `addi $17,$0,0; srl $8,$8,1; beq $8,$0,+2; addi $17,$17,1; j 0x0040002C`
- **T03 binary search offsets** (T03 Q3(b)-(d)): input `bne $t9,$zero,end (2nd instr); j loopEnd with first instr at 0xFFFFFF00, loopEnd = 18th instr` -> expected `bne imm 16; loopEnd = 0xFFFFFF44; j = 0x0BFFFFD1 (both j loopEnd identical)`
- **T03 D1 trace** (T03 D1(b)-(d)): input `A={7,4,1,6,0,5,9,0}, B={3,4,5,2,1,0,0,9}` -> expected `A={3,4,1,2,0,5,9,0}, B={7,4,5,6,1,0,0,9}; 4 sw; bne imm -9`
- **AY23/24 S2 Q16 full** (AY23/24 S2 Final Answers p16): input `n=8, A={1..8}, B={9..16}, C={111,222,...,888}; i1 at 0x00400050` -> expected `k=4; C={10,12,18,20,555,666,777,888}; slt $t1,$t0,$s0=0x0110482A; bne $t1,$0,skip=0x15200006; sw $t3,0($a3)=0xACEB0000; j loop (0x00400064)=0x08100019`
- **AY24/25 Q18 full** (AY24/25 S1 Final Answers p15-16): input `A={123,-13,26,30,9}, B={44,765,200,999,123}; Inst16 at 0x00400078` -> expected `A={123,-39,26,90,27}; beq $t4,$0,exit=0x1180000B; sw $s4,0($t1)=0xAD340000; Inst4 at 0x00400048; j loop=0x08100012`
- **lui encode** (AY25/26 S1 Answers Q6): input `lui $s1,57007` -> expected `0x3C11DEAF`
- **Decode R-type** (AY25/26 S1 Answers Q7): input `0x02898820` -> expected `add $17,$20,$9 (add $s1,$s4,$t1); ALUop 10`
- **andi zero-extension** (AY25/26 S1 Answers Q14): input `$t0=0xABCD0123; andi $t1,$t0,51966` -> expected `$t1=0x00000022`
- **Branch/jump equivalence** (AY25/26 S1 Answers Q15): input `0x12310003 at PC 0x1000` -> expected `beq $17,$17,3 → target 0x1010; equivalent j = 0x08000404`
- **Decode + next PC** (R06 p43-44 (AY24/25 Q28)): input `0x10000103 at PC 0x491` -> expected `beq $0,$0,259 → next PC 0x8A1`
- **Midterm encode (computed, no key)** (Midterm AY25/26 Q13): input `lw $v1,-100($t7)` -> expected `0x8DE3FF9C (option D)`
- **Midterm branch target (computed, no key)** (Midterm AY25/26 Q14): input `0x12C3FBAD at PC 0x5204` -> expected `beq $22,$3,-1107 → 0x40BC (option C)`
- **Midterm j → beq (computed, no key)** (Midterm AY25/26 Q16): input `0x080000AD at PC 0x1014` -> expected `target 0x2B4; beq imm -857 (option A)`
- **Hand-assembly checker (computed, no key)** (AY21-22 S1 Q8): input `code at 0x0: addi $3,$0,0 / addi $5,$0,0 / loop: addi $3,$3,1 / andi $4,$3,1 / bne $4,$0,loop / addi $5,$5,1 / j loop; given 0x20030000, 0x20630001, 0x30830001, 0x1480FFFE, 0x08000002` -> expected `wrong: instr 4 (should be 0x30640001) and instr 5 (should be 0x1480FFFD) → C, D`
- **AY21-22 S2 Q15 (computed, no key)** (AY21-22 S2 Final Q15): input `A={1,2,3,4,5}, B={5,3,4,5,3,8,2,5,9,4}; I19 at 0x00400084` -> expected `B={1,3,2,5,3,8,2,5,5,4}; slt $t4,$t0,$t3=0x010B602A; I5 at 0x0040004C; j loop=0x08100013`
- **AY19-20 Q1 (computed, no key)** (AY19-20 S2 Final Q1): input `$s0=0xBEBEC0C0 hex-digit-sum loop` -> expected `$s1=0x4A; max $s1=0x78 with $s0=0xFFFFFFFF; srl $s0,$s0,4=0x00108102; bne $s0,$zero,L=0x1600FFFC`
- **AY18-19 Q1 (computed, no key)** (AY18-19 S2 Final Q1): input `$s0=32; $s0=43` -> expected `$s0=32 → $t0=26, $t1=31; $s0=43 → 3 branches taken; $t0=$t1=0 needs $s0=0xFFFFFFFF; srl $s0,$s0,1=0x00108042`
- **L07 loop traces** (L07 p35-38): input `Ex3, Ex4, Ex5 code as on slides` -> expected `Ex3: 6 instr, $t2=20; Ex4: 15 instr, $t1=6; Ex5: bne executed 10, taken 9, 42 instr, 13 unique bytes`
- **For-loop instruction count** (L07 p27 (matches R03 p67 expression)): input `for(i=0;i<10;i++) a=a+5 as on slide` -> expected `2 + 4×10 + 1 = 43`
- **Array loop index vs pointer (computed)** (L07 p33-34): input `40-word array, all non-zero, bge counted as 2 real instr` -> expected `version 1: 325 instr; version 2: 245 instr (+1 each per zero element)`
- **Memory address** (L07 p8-9, p16): input `$s0=8000: lw $t0,4($s0); sw $t0,12($s0); swap k=3, base 2000` -> expected `8004; 8012; $2=12 then 2012, loads 2012 and 2016`
- **Array offsets** (L07 p10): input `A[7] = h + A[10], base $s3` -> expected `lw offset 40, sw offset 28`
- **Parity loop** (T02 Q4): input `$s0=31; $s0=0x0AAAAAAA` -> expected `0x8000001F; 0x0AAAAAAA`
- **Bit masks** (T02 Q2): input `set bits 2,8,9,14,16 of $s1; copy bits 1,3,7 of b into a; c bits 2,4,8 = NOT b bits 1,3,7` -> expected `lui 0x0001 + ori 0x4304 + or; andi 0x008A, clear mask 0xFFFFFF75; xori 0x8A, andi 0x8A, sll 1, clear mask 0xFFFFFEEB`
- **Logic ops on slides** (L06 p37, p39-41): input `sll $t2,$s0,4 with $s0=0xB8000009; and with $t1=0x632F0D59,$t2=0x00003C00; andi 0xFFF and ori 0xFFF with $t1=0x09C35D9C` -> expected `0x80000090; 0x00000C00; 0x00000D9C; 0x09C35FFF`
- **32-bit constant** (L06 p44): input `load 0xAAAAF0F0` -> expected `lui $t0,0xAAAA; ori $t0,$t0,0xF0F0`
- **Fewest instructions** (T02 Q3(d)): input `d = 6a + 3(b - 2c)` -> expected `5 instructions (sub, sll 1, add, sll 2, sub)`
- **Endianness** (L10 p17): input `0xDEADBEEF at address 0` -> expected `big: DE AD BE EF; little: EF BE AD DE`
- **Endianness MRQ (computed, no key)** (AY21-22 S1 Q7): input `bytes 0x43,0x61,0x74,0x73 at 0x3E8` -> expected `string 'Cats' under both; big-endian int 1130460275; little-endian int 1937006915 → A, B, D true`
- **Lab QtSpim values** (Lab 3 p5-9; Lab 5 p2-3): input `addi $t1,$zero,97; 'Hello' at 0x10000100; jal sayHi` -> expected `0x20090061 at 0x00400024; H 0x48, e 0x65, l 0x6C, o 0x6F, lb $t0,4($a0), addi -32 → output HelloHellO; jal at 0x0040000C → PC 0x00400028, $ra 0x00400010`
- **Lab 4 masks and addresses** (Lab 4 p4-5): input `X=32, X=8; arrayA {11,0,31,22,9,17,6,9}, X=2` -> expected `andi masks 0x1F, 0x7 (mask = X-1 via addi -1); count 3; arrayA 0x10010000, count 0x10010014`
- **Expanding opcode (keyed)** (R04 p45): input `8-bit instr; Type-A 4-bit opcode, Type-B 8-bit` -> expected `max 241, min 31`
- **Expanding opcode (keyed)** (AY23/24 S2 Answers Q7): input `16-bit instr, 512-byte space, 12 regs; A=2 regs, B=1 reg+address, C=no operands with exactly 2 instr` -> expected `opcodes A 8, B 3, C 16 bits; max total 226`
- **Expanding opcode (computed)** (AY20-21 Q3): input `types with 3/5/7-bit opcodes, at least one each, fully used` -> expected `max 110 (option C)`
- **Expanding opcode (computed)** (AY15-16 Q6): input `types A/B/C with 4/6/8-bit opcodes, at least one each` -> expected `max type-C 236 (option C)`
- **Expanding opcode (computed, no key)** (Midterm AY25/26 Q27): input `64 regs; A 16-bit with 2 regs, B 32-bit with 3 regs + 6-bit shamt, C 32-bit with 2 regs + 14-bit imm` -> expected `opcodes 4/8/6 bits; max 238, min 22`
- **Expanding opcode (student notes)** (Finals Notes p4-5): input `A 6-bit, B 8-bit, C 11-bit opcodes; and A 6-bit vs B 11-bit` -> expected `min 74, max 2010; max 2017, min 95`
- **Expanding opcode (extras)** (Recitation and Tutorial Extras p17-18): input `24-bit instr; P 4x4, Q 3x4, R 2x5, S 1x6 operand bits` -> expected `max 261,043`
- **Expanding opcode Zephyr (computed, no key)** (AY16-17 Q4c-d): input `32-bit; operand bits A 0, B 3, C 16, D 19, E 6, F 22` -> expected `max 4,290,183,101 (= 2^32 - 2^22 - 2^19 - 2^16 - 2^6 - 2^3 + 5); min 2075`
- **Storage architectures** (L10 p9): input `C = A + B` -> expected `stack 4 instr, accumulator 3, load-store 4, memory-memory 1`
- **Amdahl example** (L10 p23): input `70% of time halved, 30% slowed by 50%` -> expected `0.35t + 0.45t = 0.8t`
- **Correct j target (computed)** (AY18-19 Q3b setup): input `j word 0x0800C840 at 0x2100FFFC` -> expected `target 0x20032100 (on a correct datapath)`
- **Instruction-count possibilities (computed, no key)** (AY21-22 S2 Q8): input `lb/andi/beq/sll loop, any memory; options 9, 14, 15, 43, 63` -> expected `possible: 9, 15, 43, 63 (14 impossible)`
- **Loop-closing slt groups (computed, no key)** (AY21-22 S1 Q11): input `array-sum loop, i in $3, length in $13, options A-E` -> expected `B and E`

## Gaps or ambiguities
- These quiz-answer pages are images and lost in the text extract: R03 quiz solutions p46-70 (only fragments such as '2 + (4*10) + 1 = 43' survive), and R04 p42-44 and p46-47. Several R03/R04 quiz presets cannot be reconstructed without opening the PDFs.
- The green card (L08 p47-50) and the 'Summary of key MIPS instructions' (L08 p8) are images. The app's opcode/funct table must come from the official card in Cheatsheets/, not from text.
- L07 p23 and p31 flowcharts, L08 p9/p17/p36 format boxes, L08 p43-45 addressing-mode pictures, L10 p10-13 storage animations and L10 p17 endianness boxes are diagrams. The text carries the numbers but not the layout.
- The T02 Q4 parity-loop code is scrambled in the answer-file extraction. Its order was rebuilt from Recitation and Tutorial Extras p9; confirm against the PDF.
- L06 p33 text reads 'a = a + 4; add $s0, $s0, 4'. This is probably an extraction artifact of 'addi' (or a slide typo); check the PDF before using it as an example.
- Endianness default conflicts: L10 p17 lists MIPS as big-endian (implementation-specific), L10 p18 says the online interpreter is little-endian, and R02 p8 says 'our MIPS' is big-endian. AY18-19 Q1f depends on endianness and never states it. The app needs an explicit, visible toggle.
- jal return address: Lab 5 p3 and the lecture cheat sheet give Addr(jal)+4; the green card gives PC+8. Procedures are out of lecture scope (L07 p39) but used in Lab 5.
- QtSpim start address: Lab 3 p5 says user code starts at 0x00400024 after system-inserted lines, while Lab 5's answers (jal at 0x0040000C) imply code at 0x00400000. It depends on simulator settings (Lab 3 p2-3). My reading of Lab 5's addresses, that la assembled to a single lui, is an inference.
- Expanding-opcode method ambiguity: the student's open midterm Q20 flag (key 198 vs shared-prefix 142) cannot be checked because that question is not in the folder. The AY25/26 midterm file in the folder has a different Q20. The tool should show both the prefix-tree and budget-equation methods and flag disagreement.
- No answer keys exist for the AY25/26 midterm, the AY21-22 papers or the AY15-21 papers. Worked examples marked 'computed, no key' are my own derivations. The MCQ letters for AY24/25 and AY25/26 are in red and lost in the text.
- Midterm AY25/26 Q17 and Q18 have no key. My computation gives none of (i)-(iv) producing exactly 0x00009200 (so E), and all three Q18 words have odd popcount (so D). Both need confirmation.
- AY21-22 S1 Q10E ('up to 127 instructions') depends on whether funct expansion of opcode 0 counts (63 + 64 = 127); no key. AY16-17 Q4a uses the same idea (5 R-opcodes → 5×64 + 59 = 379, computed).
- Instruction subset: addu, addiu, lbu, lh, sh, sltu appear on godbolt and the green card but are 'not covered' (T02 p1). The stepper should support them but mark them non-lecture. syscall and .data/.word are lab-only but appear, explained, in recent papers.
- L08 p40 (top/bottom of a 256 MB block) and L08 p42 (branching too far) are forum exercises with no official answer. The app's answers (0xX0000000..0xXFFFFFFC; bne-inverted + j) should be labelled as derived.
- L09 (range, precision, GRS rounding, special values) is in L06-L10 but is number representation. Number-conversion tools were explicitly excluded, so no feature was proposed. A non-conversion rounding/special-value explainer could be reconsidered if wanted.
- Exam answer-format conventions vary by paper: Examplify FITB wants 8 hex digits, capitals, no 0x (AY23/24 S2 Q16e), while paper exams accept 0x-prefixed hex. A copy-in-exam-format button would help.
