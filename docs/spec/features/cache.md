# Feature sweep: cache

Raw research output. Priority 1 = high exam value or high confusion.

## Features (18)
### [1] Address Splitter and Field-Width Solver
- Module: Cache / Addressing
- Sources: L22 p22-23, p25-27, p29-30 (C:\Users\the student\OneDrive\Desktop\CS2100\Study Notes\materials\text\Lectures\L22 Cache I\Lecture 22 - Cache I.md); L23 p11-12, p17, p26-27 (C:\Users\the student\OneDrive\Desktop\CS2100\Study Notes\materials\text\Lectures\L23 Cache II\Lecture 23 - Cache II.md); R12 p7, p15, p17, p40-42, p47 (C:\Users\the student\OneDrive\Desktop\CS2100\Study Notes\materials\text\Recitations\R12 Cache\Recitation 12.md); T11 Q1; AY25/26 Q9, AY24/25 Q14, AY23/24 S1 Q15
- Inputs: Address width (default 32; allow 28 and 34 for R12 p41-42), word size in bytes (default 4; T11 uses 2), block size (bytes or words), cache size (bytes, words or blocks), associativity (1, 2, 4, ..., or FA). Optional address in dec, hex or binary. Inverse mode: give any consistent subset (for example tag bits + ways + block size + memory size) and solve the rest, as in R12 p41.
- Shows: A chain of steps: block = 2^N bytes, so offset = N; #blocks = cache/block; #sets = #blocks/ways, so index = M; tag = width - N - M. A coloured 32-bit ruler with bit ranges written the exam way, e.g. 31..13 | 12..4 | 3..0. For a given address: block number = addr >> N, index = block mod #sets, tag = block / #sets, byte offset, and word-in-block = offset / word size (the mux select Addr[3:2] in L22 p30). An associativity slider at fixed size animates one bit moving from index to tag at each doubling, until FA has no index.
- Aha: Index and tag are cut from the BLOCK number, not the byte address. Each doubling of associativity at the same size takes one index bit and gives it to the tag. FA is the limit: there is no index and the tag is the whole block number.
- Verify use: Answer tag-width MCQs instantly (AY25/26 Q9 = 20 bits, AY24/25 Q14 = 19 bits), bit-range MCQs (AY23/24 S1 Q15 = D), the R12 p40-42 quiz, and T11's unusual 2-byte words. A drill button generates random configs and checks the user's typed widths.
- Conventions: 2^N-byte blocks are aligned; bits [31:N] are the block number and [N-1:0] the offset (L22 p23). Index = block mod #cache blocks and tag = block / #cache blocks (L22 p25-26, 'Block Number (Not Address!)'). Tag = 32 - (N+M) (L22 p27). Set index = block mod #sets (L23 p11). FA tag = 32 - N (L23 p26). Byte-addressed; address width = log2(memory bytes) (R12 p40-42). LSB is bit position 0 (AY23/24 S1 Q15). Use the number of sets, not blocks, for the set index (L23 p11-12).

### [1] Cache Trace Stepper with Check-My-Answer
- Module: Cache / Tracing
- Sources: L22 p28, p31-52, p55-62; L23 p17-22, p32-34; R12 p8, p30; T11 Q1(a)(b); AY23/24 S1 Q20 key
- Inputs: Cache config (as in the Address Splitter) plus an access list: addresses in dec or hex with optional R/W prefix, and optional data labels (letters A..J as in L22 p55, or M[addr]). Replacement policy (LRU default). Free-way fill rule (lowest free block first, as L23 p18/p21). Display options: tag in dec, hex or binary, including 8-digit hex '0x00000081' as in AY23/24 S1.
- Shows: Each access follows the lecture's 4 sub-steps. Step 1: check the block at the index (or every way of the set). Step 2: test Valid, then compare tags, giving Hit or Miss with the reason. Step 3: load 2^N bytes from memory and set Tag and Valid, with the victim shown. Step 4: return the word at the offset. A running result string like 'M H M H M M H' and a live table (Index | Valid | Tag | Word0 | Word1, or Set | Block0 | Block1 for SA). Back/forward, jump-to-access, autoplay, and a final-contents view.
- Aha: The tag is what tells apart the many blocks that share one line. The whole block is fetched, so the neighbouring word hits next time (spatial locality, L22 p39). Repeating an address after it was evicted gives a miss even though 'it was in the cache before' (L22 p49).
- Verify use: In check mode the user types H/M and the miss type for each access, plus the final table (Tag value, Word 0, Word 1). The tool diffs cell by cell. Presets: L22 Exercise 2, the L22 read trace, the L23 2-way trace, the L23 p32-34 examples, T11 Q1, AY23/24 S1 Q20.
- Conventions: Hit = Valid AND tag match (L22 p28). Initial cache: all valid bits 0 (L22 p32). A read miss loads the block into cache, then into the register (L22 p52, p69). Table layout Index/Valid/Tag/Word0/Word1 (L22 p56). SA layout Set Index | Block 0 (Valid Tag W0 W1) | Block 1 (L23 p18). T11 asks for 'Index | Tag value | Word 0 | Word 1' with M[i], where i is a BYTE address (T11 Q1b). AY23/24 S1 Q20b wants Way 0 to hold the lower addresses, so offer a 'sort ways by address' display.

### [1] Why Did You Miss? (Miss Classifier and 3C Ledger)
- Module: Cache / Miss types
- Sources: L22 p45, p49, p53; L23 p4, p23, p27-28; R12 p20-25, p38; AY23/24 S1 Q13; AY25/26 Q5 (R12 p46)
- Inputs: Any trace and config from the stepper. Toggle between 'Course label (R12 p21-25)' and '3C accounting (L23 p28)'.
- Shows: A decision tree for each miss. (1) Is this the first-ever access to this block? Then it is compulsory, even if the line held another valid block. (2) DM/SA: the block was evicted by another block of the same set, so it is a conflict miss. The empty lines elsewhere are highlighted to show the cache was not full. (3) FA: the block was evicted because the cache was full, so it is a capacity miss. The 3C ledger runs a shadow FA-LRU cache of the same size: capacity = FA total - FA cold, and conflict = total - cold - capacity. A stacked bar of cold/conflict/capacity per organisation.
- Aha: 'Valid but tag mismatch' can still be a cold miss. Conflict misses happen even when most of the cache is empty. Nothing you do to size or associativity changes the cold-miss count.
- Verify use: T11 (a), (c), (d) miss types. 'Which miss cannot happen in FA' (AY23/24 S1 Q13 = C, conflict). Options B and C of AY25/26 Q5 are false (DM has conflict misses, FA has cold misses).
- Conventions: Terms: compulsory = cold start = first reference; conflict = collision = interference; capacity (L22 p53). Per R12 p25, conflict applies to DM and SA, capacity to FA. R12 p23: 'Does not matter if cache is full or not!'. L23 p28: Total = cold + conflict + capacity; Capacity(FA) = Total(FA) - Cold(FA). L22 p45: valid with a tag mismatch on a first access = cold.

### [1] Same Trace, Four Caches (Organisation Comparator)
- Module: Cache / Associativity
- Sources: L23 p14-16, p28, p32-37; R12 p26, p35-38 (diagram-only); T11 Q1(c)(d); AY25/26 Q5
- Inputs: One trace. Total size and block size are held fixed while ways go 1, 2, 4, ..., FA (8-block layouts as in L23 p35). LRU.
- Shows: Synchronised steppers in parallel columns. Each access is one row showing H/M per organisation. A summary of misses by type. The L23 p28 observations (1-5) light up when the trace demonstrates them. A rule-of-thumb sandbox compares DM size N with 2-way size N/2 on generated workloads.
- Aha: More ways removes conflict misses only. Cold misses never move, and capacity misses (in the 3C sense) stay the same at a fixed size. Higher associativity does not always win: L23 p34 2-way = DM = 7 misses.
- Verify use: T11 Q1(c)(d) ask exactly this repeat with 2-way and FA. Checks L23 p32-34 results and AY25/26 Q5 (answer A, the rule of thumb).
- Conventions: Same total size and block size (L23 p28 'Identical block size'; T11 (c) 'same block and overall size'). DM = 1-way, FA = one set with all blocks (L23 p35). Framework (L23 p36-37): DM has no replacement choice; SA and FA use the policy. Rule of thumb: DM of size N is about 2-way of size N/2 (L23 p16, R12 p26).

### [1] Write Policy Lab: Write-Through/Buffer vs Write-Back/Dirty, Allocate vs Around
- Module: Cache / Writes
- Sources: L22 p63-70; L23 p37; R12 p31-33; AY16/17 Q6d-e (write-back cache); AY23/24 S1 Q20 key update; AY23/24 S2 Q18 wording; AY19/20 Q8 and AY20/21 Q15 ('cache used for lw only')
- Inputs: Config plus a trace of R/W ops with store values (e.g. 'W0 W4 W0 W4 R32 R0'). Write-hit policy: write-through, write-through + write buffer, or write-back. Write-miss policy: write allocate, or write around (no-allocate). Optional buffer depth, drain rate and memory latency for the animation (an extension, labelled as not from the slides).
- Shows: Animated CPU -> cache -> (write buffer) -> DRAM lanes. Each cache line shows V, D, Tag and words. A memory 'shadow' column turns stale words red when cache and memory disagree (L22 p65 'See any problem here?'). Counters: blocks fetched, single-word writes to memory, block write-backs, total words moved, and CPU write stalls (no buffer). The dirty bit flips to 1 on a write and fires a write-back at eviction only if it is 1. Under write-around the block never enters the cache, so the next read misses.
- Aha: Write-back turns many stores to one block into a single block write when it is evicted, and clean evictions cost nothing. Write-through keeps memory consistent but runs every store at memory speed, which is why the buffer exists. With write-around, repeated stores to the same block keep missing.
- Verify use: Decide whether a sw changes cache contents in final-state questions. With write-allocate the stores pull B's blocks in (AY23/24 S1 Q20: index 1 = tag 0x502, M[0xa048] M[0xa04c]). With stores ignored or no-allocate, index 1 = tag 0x81, M[0x1028] M[0x102c]. Use the dirty bit in storage-size questions.
- Conventions: L22 p66: write-through writes cache and memory; write-back writes the cache only and memory when the block is replaced. p67: the write buffer sits between cache and DRAM; the processor writes to cache + buffer and the memory controller drains it. p68: one dirty bit per block; a write sets it to 1; on replacement, write back only if it is 1. p69: write allocate loads the complete block and changes only the required word, and memory is updated per the write policy; write around does not load the block and writes memory only. p70: on a write hit the write policy applies; on a write miss the write-miss policy applies. L23 p37 calls it 'write no allocate'. The slides never fix a default pairing, so make the user pick both.

### [1] Array / Loop Access Generator with Thrash Detector
- Module: Cache / Program traces
- Sources: Past Finals guide (C:\Users\the student\OneDrive\Desktop\CS2100\Study Notes\materials\guides\Past Finals.md) 2-3b; AY15/16 Q12, AY19/20 Q8, AY20/21 Q15, AY21/22 S1 Q16, AY21/22 S2 Q17, AY23/24 S1 Q20, AY23/24 S2 Q18d-g; Finals Notes 'Detecting Thrashing Patterns' (student sheet)
- Inputs: Arrays: name, base address, element size, length, or 'follows immediately after X'. Loop template: i from 0 to n-1 touching A[i], B[i], C[k], with an optional condition (e.g. (i&3)>>1 == 0) and an op type per access (lw/sw). A 'sw uses cache?' toggle. Optional 2D/unrolled address expressions (e.g. A+16i+4k, B+16k+4i).
- Shows: The generated address stream coloured by array. A mapping strip showing which line each array's i-th block lands on. Per-array hits, misses and hit rate as an exact fraction. A thrash warning when A[i] and B[i] share an index (base difference = multiple of cache bytes). An n slider to sweep array sizes (3200 / 3216 / 3210).
- Aha: Back-to-back arrays whose byte size is a multiple of the cache size collide on every access, giving a 0% hit rate. Grow them by one block and the rate jumps to 3/4.
- Verify use: Matches the AY23/24 S2 Q18(e)-(g) key ranges (248-250, 191-192, 190-192) and the AY23/24 S1 Q20 final tables. Gives derived checks for the no-key papers (AY15/16, AY19/20, AY20/21, AY21/22).
- Conventions: Address(A[i]) = base + i x element size. 'If the last element of A is at x, B starts at x+4' (AY20/21 Q15, AY23/24 S2 Q18). Whether sw uses the data cache varies by paper (lw only in AY19/20 and AY20/21; included in AY18/19 and AY23/24). Hit rates are given as fractions (AY15/16 Q12a).

### [1] Pipeline x Cache Miss Timer (word-at-a-time memory)
- Module: Cache / Performance
- Sources: R12 p44-48; AY24/25 Q20 and AY25/26 Q20 keys (C:\Users\the student\OneDrive\Desktop\CS2100\Study Notes\materials\text\Exam Prep\Past Finals\AY24-25 S1 Final - Answers.md, AY25-26 S1 Final - Answers.md); L22 p20; Past Finals guide 3b
- Inputs: Block size (bytes), word size, transfer time per word (cycles), 'restart counts in penalty (+1)' toggle, hit time, hit ratio, fraction of data-access instructions, instruction count, instruction type (lw/sw/beq/R-type), and cache size + associativity (shown, but they do not affect the result).
- Shows: A 5-stage strip IF ID EX MEM WB. On a miss, MEM stretches into the hit check + k word transfers (+ restart). Live formulas: penalty = (block/word) x per-word time (+1); lw hit = 5; lw miss = 4 + penalty when the penalty includes the restart (= 5 + transfer otherwise); cycles lost = instructions x data-access fraction x miss rate x penalty. A beq on a 'miss' takes 5 because it never touches data memory. The size and associativity sliders are greyed out because the penalty ignores them.
- Aha: The 32 MB / 16 MB cache size and '4-way' in these questions are red herrings. Only block size and memory transfer speed set the miss penalty. And whether the +1 sits in the penalty or in the 5 stages, the total lw time is the same.
- Verify use: Checks AY24/25 Q20 (40 or 41, 5, 45 or 46, 64 or 66, False) and AY25/26 Q20 (21, 5, 25, 5, False) step by step. A random-number generator makes clones of this template, which appeared in both recent Sem 1 finals.
- Conventions: Word = 4 bytes, so a 16-byte block = 4 transfers (R12 p44, p48). Miss penalty = time to replace the block + hit time (L22 p20). The +1 restart counts only if the question says so (AY25/26 wording); the AY24/25 key accepts 40 or 41. Lost cycles = #memory accesses x miss rate x miss penalty (R12 p45). Each stage takes 1 cycle, including MEM on a hit (AY25/26 Q20).

### [2] Instruction-Cache Loop Tracer
- Module: Cache / Program traces
- Sources: L23 p39 (separate I$ and D$); L22 p17 (locality differs for instructions and data); Past Finals guide 3b; AY23/24 S2 Q18a-c key; AY17/18 Q7e, AY18/19 Q6d-f, AY19/20 Q8g-i, AY20/21 Q15e-g, AY21/22 S1 Q16e-f, AY21/22 S2 Q17a-b
- Inputs: Address of I1, the instruction list (or a count), control flow (loop label, branch targets, a per-iteration condition pattern, iteration count, exit path), and the cache (typically 16 words, 2-way, LRU, 2- or 4-word blocks).
- Shows: The code listing with each instruction shaded by its block and set. The PC stream. A set-by-set animation. Misses in iteration 1, iteration 2 and steady state, plus total hits and misses.
- Aha: After warm-up, if the loop's blocks fit in their sets there are zero further misses. Shifting I1 by one word (0x...C50 vs 0x...C54) moves the block boundaries and can add a miss.
- Verify use: Checks AY23/24 S2 Q18 (b) = 10 misses and (c) = 5 misses. Gives derived answers for the older I-cache questions.
- Conventions: Instruction addresses step by 4. The mapping is the same as for a data cache, applied to PC values (Past Finals guide 3b). The papers say whether to count from I1 or only the loop. Init code before the loop can 'pollute' the cache.

### [2] Average Access Time / Required Hit-Rate Solver
- Module: Cache / Performance
- Sources: L22 p20-21; L23 p5, p38; AY16/17 Q6a-c
- Inputs: Any three of: hit rate, hit time, miss penalty (or raw memory time), average access time. Toggle 'memory time given without hit time' (adds the hit time, as L22 p21 does with 10 + 0.8).
- Shows: The equation with numbers substituted and solved line by line, in the style of p21. A hit-rate slider with a live AMAT curve. The identity h*t + (1-h)(t+M) = t + (1-h)*M shown side by side.
- Aha: The miss penalty already includes the hit time. You need 98% hits just to stay within 25% of the SRAM speed.
- Verify use: L22 p21 (h = 0.98). AY16/17 Q6a-c (derived: 5 ns, 85 ns, 2.5%).
- Conventions: Average Access Time = Hit rate x Hit time + (1 - Hit rate) x Miss penalty (L22 p21). Miss rate = 1 - hit rate. Miss penalty = time to replace the block + hit time, and hit time < miss penalty (L22 p20).

### [2] Replacement Policy Race (LRU / FIFO / Random / LFU)
- Module: Cache / Replacement
- Sources: L23 p29-31, p37; R12 p28-29; AY23/24 S1 Q20b, AY23/24 S2 Q18 (LRU given)
- Inputs: Set size (ways); a block-number sequence or a full address trace; policy LRU, FIFO, Random (seeded) or LFU (tie-break selectable).
- Shows: Per set: an LRU recency stack that also reorders on hits, a FIFO queue that does not, LFU counters, and a seeded dice roll for Random. The victim is highlighted, with hit counts side by side.
- Aha: LRU and FIFO differ only because a hit refreshes LRU's order. On the L23 p30 sequence LRU gets 3 hits and FIFO gets 2.
- Verify use: Check LRU order in exam traces, where LRU is always the stated policy. Reproduces L23 p30.
- Conventions: LRU: on a hit, record the block accessed; on a miss, evict the one unused for the longest time; the reason is temporal locality (L23 p29). LRU is hard to track with many choices; FIFO, RR and LFU are only named (L23 p31). DM has no choice (L23 p37).

### [2] Row- vs Column-Major Traversal Heatmap
- Module: Cache / Locality
- Sources: R02 p25-26 (row/column-major linearisation); Exam Prep 'Recitation and Tutorial Extras' p6-7; L22 p17; AY19/20 Q8f; AY23/24 S1 Q20 (transpose)
- Inputs: An R x C int matrix: base address, element size, storage order (row- or column-major), traversal (row-wise, column-wise, or transpose: read rows, write columns), and the cache config.
- Shows: A 2D grid of matrix cells, outlined by the block they share, with an animated traversal coloured hit/miss. A memory strip below shows the address jumps (stride). Live hit rate.
- Aha: Same data, same cache, only the loop order changes. An 8x8 int matrix with a 4-block x 16 B DM cache gets 75% hits row-wise and 0% column-wise, at any associativity. Make the cache hold the whole matrix and the gap vanishes. What matters is the address order the code produces: if the code walks the linear index, relabelling the image layout changes nothing (AY19/20 Q8f).
- Verify use: Reasoning for AY19/20 Q8f. Shows why the B stores in the AY23/24 S1 transpose (stride 16 B) almost never hit.
- Conventions: In row-major order, varying the last index fastest walks consecutive memory (Extras p7). Address formula for multi-dimensional arrays (R02 p26). Spatial locality definition (L22 p17).

### [2] Block-Size Trade-off Explorer
- Module: Cache / Performance
- Sources: L23 p5-6; L22 p22, p39; R12 p7, p44, p48
- Inputs: A workload (sequential scan, strided, random, small loop working set, or a pasted trace), a fixed cache size, a block-size sweep from 4 to 256 B, and a memory model (latency + per-word transfer).
- Shows: The three linked plots of L23 p5: miss penalty vs block size (rising), miss rate (U-shaped) and AMAT (U-shaped), with the current point marked. A cache grid shows fewer, bigger blocks as the size grows.
- Aha: Bigger blocks help through spatial locality until there are too few blocks for the working set. Then temporal locality suffers and the penalty keeps growing.
- Verify use: Conceptual MCQs. Note that the p6 numbers cannot be checked (the graph is lost in the text).
- Conventions: L23 p5 gives the trade-off list and the AMAT formula. The p6 curves cover cache sizes 8 KB, 16 KB, 64 KB and 256 KB, and block sizes 8-256 B. Block size is bigger than a word to exploit spatial locality (L22 p22).

### [2] Lookup Hardware View (comparators, valid AND, word mux)
- Module: Cache / Hardware
- Sources: L22 p28, p30; L23 p13, p25, p27; AY25/26 Q5 option D
- Inputs: A config (preset to the L22 p30, L23 p13 and L23 p27 examples).
- Shows: The address bus splits into tag, index and offset wires labelled with widths. The index selects a row or set. N comparators light up in parallel, AND with Valid to give Hit, and a word-select mux is driven by the offset bits. Comparator count: DM 1, N-way N, FA = #blocks.
- Aha: Associativity costs comparators and a wider select, so hit time does not drop as associativity rises.
- Verify use: Shows AY25/26 Q5 option D ('higher associativity always lowers hit time') is false. Helps read circuit-style questions.
- Conventions: L22 p30: 16 KB DM, tag 18, index 10, offset 4, mux on Addr[3:2]. L23 p13: 4-way 4 KB with 4-byte blocks, tag 22, index 8, 4x1 select. L23 p27: FA 4 KB/16 B, 28-bit tag, 256 parallel compares.

### [2] Locality Labeller (spatial vs temporal hits)
- Module: Cache / Locality
- Sources: L22 p16-18, p39; L23 p19, p22; R12 p4-5; AY23/24 S1 Q14
- Inputs: Any trace from the stepper.
- Shows: Each hit is badged Spatial (first touch of this word; the block was brought in by a neighbour) or Temporal (this exact address was touched earlier while the block stayed). A working-set window over time (L22 p18).
- Aha: One block fetch can produce both kinds of hit later, and a miss is never 'due to' locality.
- Verify use: AY23/24 S1 Q14 = B.
- Conventions: Definitions from L22 p17. The lectures label hits this way (L22 p39 'Spatial', L23 p19 'Spatial', L23 p22 'Temporal'), but the per-hit rule is not formally defined, so state the rule used.

### [2] Placement Explorer (where can block X go?) with library analogy
- Module: Cache / Concepts
- Sources: L22 p14-15, p24-26; L23 p8-10, p24-25, p35-37
- Inputs: Click a memory block number. Pick an 8-block cache as 1-, 2-, 4- or 8-way.
- Shows: Arrows from the memory block to every slot it is allowed in, the mod arithmetic, and tags shown in colour. An analogy panel: 26 desk spots by first letter (DM), 2 spots per letter (2-way), any spot (FA).
- Aha: DM, SA and FA are one spectrum, from 1-way through N-way to a single set.
- Verify use: 'Which set or block does A[0] / B[60] map to?' (AY18/19 Q6b, AY19/20 Q8b,d).
- Conventions: L23 p35: 8 blocks as 1-way (8 sets), 2-way (4 sets), 4-way (2 sets) and 8-way = FA. Placement and identification rules from L23 p36.

### [3] Cache Storage-Bit Calculator
- Module: Cache / Addressing
- Sources: L22 p28 (tag and valid overhead), p68 (dirty bit); AY16/17 Q6d-e; Finals Notes (student sheet) 'Number of Bits in Cache'
- Inputs: Config, write policy (adds D), optional LRU bits.
- Shows: A per-line bit layout V | D | Tag | data, stacked x #lines, with totals in bits and bytes and tag bits per set.
- Aha: The overhead per line is small but scales with the number of lines, and write-back adds one dirty bit per line.
- Verify use: AY16/17 Q6d-e (derived; no key).
- Conventions: 'Usable cache' means data only (AY16/17 Q6e wording). Overheads are the tag and valid bit (L22 p28), plus the dirty bit for write-back (L22 p68).

### [3] Memory Hierarchy and Memory Wall
- Module: Cache / Concepts
- Sources: L22 p4, p8-13, p19
- Inputs: A CPU clock slider and a DRAM latency slider.
- Shows: Registers, SRAM, DRAM and disk with capacity, latency and cost (L22 p11). Latencies scaled to human time. Cycles per DRAM access (1 GHz + 50 ns = 50 cycles).
- Aha: Why caches exist: the 'big and fast' illusion.
- Verify use: Conceptual MCQs.
- Conventions: L22 p9: SRAM 6 transistors, 0.5-5 ns; DRAM 1 transistor, 50-70 ns. p19: cache is hardware-managed; virtual memory is out of scope (CS2106).

### [3] Multilevel Cache Explorer
- Module: Cache / Performance
- Sources: L23 p38-41 (marked 'Exploration'); Finals Notes multilevel CPI formula (student sheet, not slides)
- Inputs: L1/L2/L3 configs (defaults from L23 p39), hit rates and times.
- Shows: The address split at each level. The access path with hit/miss per level. An effective access time.
- Aha: L1 is small to keep the hit time short; L2/L3 are big to cut misses.
- Verify use: Low exam value. The per-level field splits can be checked.
- Conventions: L23 p39 samples: L1 32 KB, 32 B blocks, 4-way; L2 256 KB, 128 B, 8-way; L3 4 MB, 256 B, DM. Separate I$/D$ with a unified L2.

## Misconceptions and traps (surface as callouts)
- Computing index/tag from the byte address instead of the block number (address >> offset bits). (L22 p25-26 ('Block Number (Not Address!)'); R12 p10-11)
- Calling a first access a conflict miss because the line already holds another valid block. A first access is always cold. (L22 p45 ('Valid but Tags mismatch [Cold miss]'); L22 guide Traps)
- Thinking conflict misses need a full cache. They happen even when other lines are empty. (R12 p23 ('Does not matter if cache is full or not!'))
- Using log2(#blocks) instead of log2(#sets) for the set index of an N-way cache. (L23 p11-12; L23 guide Traps; Finals Notes T/I/O sheet)
- Giving a fully associative cache an index field, or thinking it has no misses. FA has no index (tag = block number) and no conflict misses, but it still has cold and capacity misses. (L23 p26-28; AY23/24 S1 Q13 (answer C); AY25/26 Q5 option C)
- 'Direct-mapped caches have no conflict misses': false. Conflict misses are DM/SA only. (L22 p53; AY25/26 Q5 option B)
- 'Higher associativity always lowers hit time': false. More tags are compared in parallel. (L23 p13, p25; AY25/26 Q5 option D)
- Rule of thumb misread as DM size N = 4-way size N/4. It is DM size N about equal to 2-way size N/2. (L23 p16; R12 p26; AY25/26 Q5 options A vs E)
- Updating the LRU order only on misses. Hits refresh recency too. (L23 p29-30; L23 guide Traps)
- Assuming more associativity always gives fewer misses. On L23 p32-34, 2-way gives 7 misses, the same as DM. (L23 p34; L23 guide Traps)
- Forgetting that the miss penalty includes the hit time (using 10 instead of 10.8 in L22 p21). (L22 p20-21)
- Word-at-a-time miss penalty: counting one transfer per block instead of (block bytes / 4) transfers, and mishandling the +1 restart. AY25/26 counts it (21); AY24/25 accepts 40 or 41. (R12 p44, p48; AY24/25 and AY25/26 Q20 keys)
- Letting cache size or associativity change the miss penalty, or thinking a faster CPU cuts the lost cycles. Both are false in the keys. (R12 p44, p48; AY24/25 Q20(e); AY25/26 Q20(e))
- Charging a data-cache miss to beq. beq never uses data memory, so it is 5 cycles. (R12 p48; AY25/26 Q20(d))
- Assuming 4-byte words. T11 uses 16-bit words, so a 2-word block is 4 bytes (offset 2 bits) and the words are M[4], M[6], not M[4], M[8]. (T11 Q1; Tutorials T06-T11 guide)
- Mixing write-hit and write-miss policy names. Write-through/write-back is what happens on a hit; write-allocate/write-around is what happens on a miss. AY23/24 S2 Q18 itself writes 'write-back policy for write misses'. (L22 p66-70; L23 p37; AY23/24 S2 inventory note 3)
- Thinking write-back writes every evicted block to memory. It writes only blocks with dirty bit = 1. (L22 p68)
- Thinking write-through is free. Without a write buffer every store runs at main-memory speed. (L22 p67)
- Ignoring sw in final-state questions when the policy is write-allocate. Stores bring blocks in (the AY23/24 S1 key also accepts the sw-ignored table). Older papers say 'lw only', so read the question. (AY23/24 S1 Q20 key 'Update'; AY19/20 Q8; AY20/21 Q15)
- Assuming bigger blocks are always better. The penalty grows, and too few blocks raises the miss rate. (L23 p5-6)
- Thinking cold misses can be reduced with a bigger or more associative cache. R12 asks what you can do about them and answers 'Nothing'. (L23 p28 obs 1; R12 p22)
- Reusing DM tags in an SA table. In 2-way, tag = block / #sets (address 36 gives block 4, tag 2 with 2 sets). In FA, tag = block number (tags 0, 1, 4, 6, 8 on L23 p33). (L23 p21, p33-34)
- Answer format: auto-graded papers want 8-digit hex tags and M[0x....]. When free ways are ambiguous, Way 0 must hold the lower addresses. (AY23/24 S1 Q20(a)(b))
- Treating virtual memory as cache material. It is out of scope. (L22 p19)

## Worked examples (presets and tests)
- **AMAT / required hit rate** (L22 p21): input `hit time 0.8 ns, DRAM 10 ns, target average 1 ns` -> expected `miss penalty 10.8 ns; 1 = 0.8h + 10.8(1-h) gives h = 0.98`
- **Address split DM** (L22 p29-30): input `32-bit, 16 KB DM, 16 B blocks` -> expected `offset 4, index 10, tag 18; 1024 blocks; block number 28 bits`
- **Address split DM** (L22 p54): input `32-bit, 32 B DM, 8 B blocks` -> expected `offset 3, block number 29, 4 blocks, index 2, tag 27`
- **DM trace** (L22 p55-62): input `DM 4 blocks x 8 B; loads 4,0,8,12,36,0,4` -> expected `M H M H M M H; types cold,-,cold,-,cold,conflict,-; final idx0 V1 tag0 M[0],M[4]; idx1 V1 tag0 M[8],M[12]; idx2-3 invalid; address 36 = tag 1 idx 0`
- **DM trace (lecture walk-through)** (L22 p31-51): input `16 KB DM, 16 B blocks; loads 20, 28, 52, 32792, 16 (decimal from the p31 bit strings)` -> expected `M(cold) H M(cold) M(cold, valid but tag mismatch) M(conflict); final idx1 tag0, idx3 tag0`
- **Write hit** (L22 p63-66): input `after the trace above, store X to address 24 (tag0 idx1 offset 8)` -> expected `hit; Word2 of idx1 becomes X; cache and memory now inconsistent`
- **Address split 4-way** (L23 p12-13): input `32-bit, 4 KB, 4-way, 4 B blocks` -> expected `1024 blocks, 256 sets, offset 2, set index 8, tag 22`
- **Associativity advantage** (L23 p14-15): input `block numbers 0 4 0 4 0 4 0 4; 4-block cache` -> expected `DM: 2 cold + 6 conflict (0 hits); 2-way (2 sets): 2 cold + 6 hits`
- **2-way trace** (L23 p17-22): input `2-way, four 8 B blocks (2 sets); loads 4,0,8,36,0` -> expected `M H M M H; offset 3, set 1, tag 28; 36 to set 0 block 1 tag 2; final set0 [tag0 M[0]M[4]], [tag2 M[32]M[36]]; set1 [tag0 M[8]M[12]]`
- **Address split FA** (L23 p27): input `32-bit FA, 4 KB, 16 B blocks` -> expected `offset 4, tag 28, 256 entries, no index`
- **LRU 4-way** (L23 p30): input `one 4-way set; blocks 0 4 8 12 4 16 12 0 4` -> expected `M M M M H M(evict 0) H M(evict 8) H: 6 misses, 3 hits`
- **FIFO contrast (derived)** (derived from L23 p30-31 by simulation): input `same as above with FIFO` -> expected `M M M M H M(evict 0) H M(evict 4) M(evict 8): 7 misses, 2 hits`
- **Organisation comparison** (L23 p32-34, p28): input `four 8 B blocks; loads 4,8,36,48,68,0,32` -> expected `DM 7 misses (final idx0 tag1 M[32]M[36], idx1 tag0 M[8]M[12], idx2 tag1 M[48]M[52], idx3 empty); FA-LRU 6 misses + 1 hit (slots tag8 M[64], tag0 M[0], tag4 M[32], tag6 M[48]); 2-way LRU 7 misses (set0 tag0 M[0], tag2 M[32]; set1 tag0 M[8]); cold = 5, 3C capacity = 6-5 = 1`
- **R12 quiz DM** (R12 p40): input `4 GB memory, 32 KB DM, 32 B blocks; address 0x12345678` -> expected `offset 5, block number 27, 1024 blocks, index 10, tag 17; tag 0b00010010001101000 (0x2468), index 0b1010110011 (691), offset 0b11000 (24)`
- **R12 quiz inverse** (R12 p41): input `4-way, 4 KB blocks, 16 GB memory, tag 10 bits` -> expected `34-bit address, offset 12, set index 12, 4096 sets, cache 64 MB`
- **R12 quiz FA** (R12 p42): input `FA, 256 MB memory, 16 KB cache, 256 B blocks` -> expected `28-bit address, offset 8, tag 20`
- **Tag width MCQ** (AY25/26 Q9; R12 p47): input `8-way, 32 KB, 8 B blocks, 32-bit` -> expected `offset 3, 4096 blocks, 512 sets, index 9, tag 20 (D)`
- **Tag width MCQ** (AY24/25 Q14 key): input `4-way, 32 KB, 16 B blocks, 32-bit` -> expected `offset 4, 2048 blocks, 512 sets, index 9, tag 19 (C)`
- **Bit-range MCQ** (AY23/24 S1 Q15 (answers at a glance)): input `4-way, 2048 blocks, 4-word (16 B) blocks, 32-bit` -> expected `tag 31-13, set 12-4, offset 3-0 (D)`
- **Locality MCQ** (AY23/24 S1 Q14): input `16 B blocks; 0x804ab0 M, 0x804ab4 H, 0x804ab8 H, 0x804ab0 H` -> expected `(2) and (3) spatial, (4) temporal; answer B`
- **Pipeline x cache** (R12 p44-45; AY24/25 Q20 key): input `16 B blocks, 1 word/transfer, 10 cycles/word, hit 1 cycle, 95% hits, 32% data accesses, 100 instructions` -> expected `penalty 40 (41 accepted); lw hit 5; lw miss 45 (46); lost 0.32x100x0.05x40 = 64 (66); total 95/96 also accepted; (e) False`
- **Pipeline x cache** (R12 p48; AY25/26 Q20 key): input `16 B blocks, 1 word/transfer, 5 cycles/word, restart counted, 90% hits` -> expected `penalty 4x5+1 = 21; lw hit 5; lw miss 4+21 = 25; beq 5; (e) False`
- **T11 Q1(a)(b) DM (derived, no key in folder)** (T11 Q1; simulated): input `16-bit words, 2-word (4 B) blocks, 16-block DM; offset 2, index 4, tag 26; addresses 4,92,7,146,30,95,176,93,145,264,6` -> expected `M(cold) M(cold) H M(cold) M(cold) M(conflict) M(cold) H H M(cold) H = 7 misses (6 cold, 1 conflict), 4 hits; final idx1 tag0 M[4] M[6]; idx2 tag4 M[264] M[266]; idx4 tag2 M[144] M[146]; idx7 tag1 M[92] M[94]; idx12 tag2 M[176] M[178]; others empty`
- **T11 Q1(c) 2-way (derived)** (T11 Q1(c); simulated): input `same, 2-way, 8 sets (set index 3, tag 27)` -> expected `M M H M M H M H H M H = 6 misses (all cold), 5 hits; final set1 tag0 M[4]M[6]; set2 tag8 M[264]M[266]; set4 tag4 M[144]M[146] + tag5 M[176]M[178]; set7 tag2 M[92]M[94] + tag0 M[28]M[30]; no evictions, so the replacement policy is irrelevant`
- **T11 Q1(d) FA (derived)** (T11 Q1(d); simulated): input `same, FA 16 blocks (tag 30)` -> expected `M M H M M H M H H M H = 6 cold misses, 5 hits, 0 capacity; tags (block numbers) 1, 23, 36, 7, 44, 66 hold M[4]/M[6], M[92]/M[94], M[144]/M[146], M[28]/M[30], M[176]/M[178], M[264]/M[266]; 10 entries empty`
- **Transpose loop final state (keyed)** (AY23/24 S1 Q20(a) key; verified by simulation): input `4x4 int transpose, A = 0x1000, B = 0xa010, lw+sw; DM 4 blocks x 2 words` -> expected `idx0 0x00000081 M[0x1020] M[0x1024]; idx1 0x00000502 M[0xa048] M[0xa04c]; idx2 0x00000081 M[0x1030] M[0x1034]; idx3 0x00000081 M[0x1038] M[0x103c]; sw-ignored alternative idx1 0x00000081 M[0x1028] M[0x102c]; simulated 6 hits / 32 accesses (lw-only 8/16)`
- **Transpose loop 2-way LRU (keyed)** (AY23/24 S1 Q20(b) key; verified): input `same, 2-way, 2 sets` -> expected `set0 W0 0x00000102 M[0x1020] M[0x1024], W1 0x00000103 M[0x1030] M[0x1034]; set1 W0 0x00000103 M[0x1038] M[0x103c], W1 0x00000a04 M[0xa048] M[0xa04c]; sw-ignored alt set1 0x102 M[0x1028] / 0x103 M[0x1038]`
- **I-cache loop (keyed)** (AY23/24 S2 Q18(a)-(c) key; verified): input `2-way LRU I$, 16 words, I1 at 0x00400050, AY23/24 S2 Q18 code, 1000 elements` -> expected `2-word blocks: 4 sets, set index 2, offset 3, 10 misses (I1 in set 2); 4-word blocks: 2 sets, set index 1, offset 4, 5 misses (I1 in set 1)`
- **Back-to-back arrays (keyed)** (AY23/24 S2 Q18(d)-(g) key; verified): input `DM 512 words, 4-word blocks, A = 0xFFFF0000, B and C follow, lw A, lw B, sw C when (i&3)>>1 == 0, write-allocate` -> expected `index 7, offset 4; n=1000: A hits 248 (key 248-250); n=768: A 191 (key 191-192), B 190 (key 190-192)`
- **Array thrash (derived, no key)** (AY20/21 Q15(a)-(d); simulated): input `DM 128 words, 4-word blocks, lw only, A = 0xFF000C00, B right after A` -> expected `index 5, offset 4; n=3200: A 0, B 0; n=3216: 3/4, 3/4; n=3210: 2407/3210 each`
- **Shared index (derived, no key)** (AY19/20 Q8(a)-(f); simulated): input `64-word cache, 4-word blocks, A = 0x0040CCC0, B = 0x000002C0, lw A[i], lw B[i]` -> expected `DM: offset 4, index 4, A[0] block 12, B[60] block 11, hit rates 0 and 0; 2-way LRU: A[0] set 4, B[60] set 3, hit rates 3/4 and 3/4; column-major storage with unchanged code gives the same rates`
- **Three arrays (derived, no key)** (AY15/16 Q12; simulated): input `DM 8 blocks x 4 words; A = 0x80, B = 0xFFFF0040, C = 0x12345688; 32 iterations of A[i], B[i], C[i]` -> expected `hit rate 5/12 (40/96); final blocks 0: C[30..33], 1: B[20..23], 2: B[24..27], 3: B[28..31], 4: A[16..19], 5: A[20..23], 6: A[24..27], 7: A[28..31]`
- **AMAT and storage (derived, no key)** (AY16/17 Q6; derived under L22 p20-21 conventions): input `cache 5 ns, memory 80 ns, 10,000 accesses in 70 us; 4-way write-back 64 KB, 8-word blocks` -> expected `hit 5 ns; miss 85 ns; miss rate 2.5%; offset 5, 2048 blocks, 512 sets, index 9, tag 18, 72 tag bits per set; total with V+D = 2048 x (256+18+1+1) = 565,248 bits`
- **Write policy traffic (constructed)** (constructed under L22 p66-69; simulated): input `DM 4 blocks x 8 B; W0 W4 W0 W4 R32 R0` -> expected `WT+allocate: M H H H M M, 3 block reads, 4 word writes. WB+allocate: M H H H M(write-back block 0) M, 3 block reads, 0 word writes, 1 block write-back. WT or WB + around: all 6 miss, 2 block reads, 4 word writes`
- **Write policy traffic (constructed)** (constructed; simulated): input `DM 4 x 8 B; W4 R0 W8 W12 R36 W0 R4` -> expected `WT+alloc: M H M H M M H, 4 reads, 4 word writes. WB+alloc: same H/M, 4 reads, 1 write-back (block 0 at R36), blocks 0 and 1 dirty at end. +around: all miss, 3 reads, 4 word writes`
- **Row vs column (constructed)** (constructed; simulated): input `8x8 int, row-major at 0; cache 4 blocks x 16 B` -> expected `row-wise 48/64 hits; column-wise 0/64 for DM, 2-way and FA; with a 16-block x 16 B cache, column-wise 48/64`
- **Multilevel splits (derived)** (L23 p39; derived): input `L1 32 KB 32 B 4-way; L2 256 KB 128 B 8-way; L3 4 MB 256 B DM` -> expected `L1 offset 5, index 8, tag 19; L2 offset 7, index 8, tag 17; L3 offset 8, index 14, tag 10`

## Gaps or ambiguities
- T11 answers are not in the folder (INDEX.md 'Not in the folder'). The T11 expected outputs above come from my own simulation under L22/L23 conventions, not an official key.
- Miss classification can be read two ways. R12 p24-25 labels capacity misses as an FA thing, so a repeat miss in DM/SA is 'conflict'. L23 p28 uses 3C accounting (capacity = FA total - FA cold; capacity is the same at every associativity), so some DM repeat misses are 'capacity'. Example: in L23 p32-34 the DM miss on address 0 is capacity in 3C terms but conflict under the R12 label. No key settles which one an exam wants. The app should show both and default to the R12 label.
- T11 addresses 7, 95, 93 and 145 are odd on a 16-bit-word machine, so they are not word-aligned. The tutorial does not say how to treat them. I treated them as plain byte addresses (145 is in block 36, bytes 144-147).
- T11 (c)/(d) give no replacement policy. With this trace no eviction happens in 2-way or FA, so the policy does not matter.
- Write policies are purely conceptual in the course (L22 p63-70). There is no worked write-traffic count, no write-buffer size or full-buffer stall rule, no default pairing (WB+allocate / WT+around), and nothing on flushing dirty blocks at program end. Traffic counters and buffer timing are app extensions and must be labelled that way.
- The +1 restart convention is inconsistent: AY24/25 key penalty 40 (41 accepted), lw miss 45 = 40 + 5; AY25/26 key penalty 21 (includes restart), lw miss 25 = 21 + 4. The AY24/25 '(d) total 95 (or 96)' option has no derivation (96 = 32 x (1 + 0.05 x 40)).
- The AY25/26 Q20(e) key reason ('search time goes up') is about hit time. Under L22 p20 the miss penalty does not depend on associativity (Past Finals inventory note 11).
- AY23/24 S2 Q18(c) key slip: it says 'Byte offset: 3 bits' and 'set index 0' for 4-word blocks. Correct is offset 4 bits and I1 in set 1. The final answer of 5 misses is unaffected (checked by simulation).
- AY23/24 S2 Q18 says 'write-allocate cache using write-back policy for write misses', which mixes the L22 terms. The key accepts ranges because of a few A/B/C conflicts.
- AY24/25 and AY25/26 MCQ answers are in red and lost in the text. The AY25/26 Q5 answer (A, the rule of thumb) comes from the inventory note, not from extracted key text.
- Diagram-only pages where text extraction lost detail: L22 p30 (circuit), p32-51 and p56-62 (cache tables); L23 p6 (miss-rate vs block-size graph, numbers lost), p13 and p27 (circuits), p14-22, p30, p32-35 (tables); R12 p12 and p35-37 ('Same size (8 blocks) different configurations', text entirely lost). The guides say the L22/L23 results were checked against slide images, but the R12 p35-37 content is unknown.
- L22 p31 gives the trace addresses only as bit strings. The decimals 20, 28, 52, 32792, 16 are derived.
- Only LRU is ever examined. FIFO, Random and LFU are only named (L23 p31), with no tie-breaking rule for LFU and no seed convention for Random.
- Free-way placement: the lectures fill the first invalid block (L23 p18, p21). AY23/24 S1 Q20b instead asks for a display where Way 0 holds the lower addresses. The app needs both views.
- Whether sw uses the data cache depends on the paper ('lw only' in AY19/20 and AY20/21; included in AY18/19 and AY23/24). The AY23/24 S1 key accepted both.
- Instruction-cache counting is never worked in L22/L23/T11/R12 (only L23 p39 mentions separate I$/D$). Exam assumptions (exit path, whether init code counts) must be configurable. My answers for the no-key I-cache papers would depend on those assumptions.
- Multilevel caches are 'Exploration' only (L23 p38-41). The multilevel CPI and stall formulas exist only in the student Finals Notes cheat sheet, not on the slides.
- Spatial vs temporal labelling of individual hits is used on slides (L22 p39, L23 p19, p22) but never formally defined. The app's rule (same address seen before while resident = temporal, else spatial) is my inference.
- The course has no pipeline diagram with cache stalls. R12 and the papers only count single-instruction cycles and total lost cycles, so a freeze/stall model for following instructions would be an extension.
- Out of scope for this report: L21 hazards (WAR/WAW) belong to another research scope. The only cache-pipeline link in the materials is the MEM-stage miss timing (R12 p44-48).
