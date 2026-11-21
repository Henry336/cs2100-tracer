# Feature catalogue (merged)

Merged from the seven sweeps in this folder. Priority 1 = build first.

## C Memory & Pointers

Show L02-L05 C as boxes in byte memory, arrows, frames, strips. C + number rep is ~4-10/100 in recent finals (1-2 MCQs; AY23/24 S1 had none), but array layout feeds MIPS and cache questions. L01 admin only; L03 conversions excluded by brief.

### [1] Memory Box-and-Arrow Tracer
Snippet or preset in a C subset: scalars, pointer decls incl. 'double a, *b;', int **pp and pointer arrays (tag exam-gap), & * = += -= *= ++ --, if/while/for, printf %d %f %c %p. Step/back/run-to-cursor/reset; toggles arrows-only, random base, pointer size 4 (default)/8. Shows name|address|value table (L04A p11) + boxes; pointer boxes own colour with arrow; written cell flashes, old values struck (L04B p4); '*p1 *= a' as two hops; '?' for uninitialised; red 'Segmentation fault' on bad deref (L04B p6); alias badge; pointer compare = address compare; console. Check mode: user types expected output, tool diffs and jumps to first wrong step. Sizes int/float 4, char 1, double 8 (L02A p24-26); 'double b = &a' illegal (L04A p15); no bool, relations print 1/0 (L02C p6-7).
- Aha: *p is the variable itself reached by an arrow. '*' in a declaration means 'is a pointer', in an expression 'follow the arrow'.
- Sources: L04A p5-15; L04B p3-6; R02 p9-12; T01 Q6; L02A p22-26; AY21/22 S1 Q2-3; AY25/26 Q10; Midterm AY25/26 Q11-12; guides/Past Finals 3b

### [1] Call-Stack Frames: pass-by-value vs pass-by-address
Up to ~3 functions, one recursive; step into/over/out; show-address toggle. Frames 'In main():'/'In swap():' (L04D p9-11); formals filled by animated COPY (L04D p3: 3.2 and 2.0); pointer params draw arrows across the frame wall; frame pops on return. Array arg = arrow, size copied separately (L05A p11); struct arg = full duplicate (L05D p6); recursion stacks frames over one shared array. Answers 'can f see this variable?' (L04D p5). Conventions: C passes by value only (L04D p3, p8); 'int arr[]' = 'int *arr', size in [] ignored (L05A p12-13); missing prototype -> assumed int then 'conflicting types' (L04C p10-11); later locals at lower addresses (L04D p15).
- Aha: A function only ever receives copies; swap(&a,&b) copies addresses. Swapping two pointer params inside the callee changes nothing (AY23/24 S2 Q2).
- Sources: L04D p3-15; L04C p6-11; R02 p16-17, p44; L05A p11-15; L05D p2-9; T01 Q5; AY23/24 S2 Q2; AY21/22 S1 Q2

### [1] Expression and Precedence Stepper
One expression + current values (typed or from the tracer). Parse tree banded by the L02C p9 precedence table with associativity; one click evaluates one node; post-inc shows 'pending' until statement end; short-circuited subtree greys 'not evaluated'; pointer nodes show address and pointee; integer truncation shown (10/4 = 2). Rewrites panel: *p++ = *(p++), p->m = (*p).m, a[i] = *(a+i), ?: as if/else. User enters expected value; first differing node highlighted. Integer results truncate (L02B p9); -10%4 = -2 (L02B p13); cascaded assignment right to left (L02B p3-8, R01 p17); ?: 'not covered in lecture' (T02 Ans p3) yet examined.
- Aha: Postfix ++/-- and [] . -> bind tighter than unary *, so *qq-- moves the pointer; && binds tighter than ||.
- Sources: L02B p7-13; L02C p9-18; R01 p17; L05D p10; AY25/26 Q10; Midterm AY25/26 Q9-11; AY24/25 Q8; Exam Prep/Finals Notes p1

### [1] Array Address Calculator and Linear Memory Strip
Element type or size S, dims D1..Dn, base A0 hex, index tuple (or click cell); row/column-major toggle; optional loop order to animate a traversal. Linked grid and 1D byte strip; Horner evaluation ((i1*D2+i2)*D3...)*S + A0 coloured per dimension; a[i] = *(a+i); array name drawn as locked arrow (L05A p9); traversal marks stride S vs D2*S (sets up cache); sizeof in declaring scope vs in a callee (decayed pointer). Formula A0 + S*(i1*D2*..*Dn + ... + in) (R02 p26 garbled; use R02 guide + Extras). Row/col-major only in R02 p25. Initialiser rules L05A p7. Also feeds MIPS lw/sw offsets and cache array bases (AY19/20 Q7).
- Aha: A 2D array is one long strip; the last index changes fastest, so a[r][c+1] is next door and a[r+1][c] is D2*S away.
- Sources: L05A p5-15; R02 p20-26; Exam Prep/Recitation and Tutorial Extras p6-7; AY19/20 Q7; Lab 2

### [1] Struct Builder: layout, copy, ->, arrays of structs, unions
Define struct/typedef with scalar, char/int array, pointer or nested members; run s2 = s1, pass by value/pointer, p->m, arrays of structs, return struct; union toggle. Group box with member sub-boxes (L05C p3, p12); assignment = member-by-member copy; pass by value clones the box (L05D p6); array members cloned but pointer member clones only its arrow (AY21/22 S2 Q3 twist); *p.name gives red parse error with precedence reason (L05D p10); union overlays members, size = largest (R02 p32). Optional 'real compiler padding' overlay, off by default, labelled non-examinable. Typedef semicolon required, a type gets no memory (L05C p4-5); struct assignment legal, array not (R02 p31).
- Aha: Structs behave like big ints (= and pass-by-value copy everything, arrays inside too); a pointer member is copied as an address, so copies share the pointee.
- Sources: L05C p2-15; L05D p2-11; R02 p28-35, p60-62; AY21/22 S2 Q3; AY17/18 S2 Q1a; AY23/24 S2 Q1; Midterm AY25/26 Q7

### [2] Declaration Decoder
Any declaration line ('int *p[100], **pp;', 'struct point *p[5];', 'char *argv[]'). Splits declarators, builds inside-out English reading ([] and () before *), draws matching memory boxes with sizeof under 32-bit assumption; 'instantiate' loads them into the tracer. Labelled exam-gap helper (pointer arrays and ** never taught).
- Aha: '*p[5]' is an array first, pointers second; '**' is a box whose arrow lands on another arrow.
- Sources: L04A p9, p14-15; L05A p5; AY23/24 S2 Q1; AY25/26 Q10; Midterm AY25/26 Q11-12; guides/Past Finals 3b

### [2] String / char-array Inspector
char str[N] filled by literal, braces or per-index; simulated stdin to scanf('%s') or fgets; run strlen, strcpy, strncpy, strcmp, printf %s, puts; ASCII toggle. Byte cells with index/address/glyph/code; NUL '\0' highlighted, unknown '?'; each function walks a cursor; no terminator -> runs into garbage (L05B p13); fgets keeps '\n' then strip step (L05B p6); scanf stops at whitespace (L05B p7); long strcpy spills red into the next variable (L05B p11); strcmp shows pairwise ASCII and sign; char str[] vs char *s literal, writing s[0] segfaults. fgets reads size-1 (L05B p5-6); puts adds newline; avoid gets; 100-char buffer needs char[101] (L05B p9).
- Aha: 'String' is a convention: chars then a '\0'. Every string function hunts for that zero, so strlen(s) = (address of first '\0') - s.
- Sources: L05B p2-13; R02 p22; L03B p3-5; AY21/22 S2 Q7; Midterm AY25/26 Q7; Lab 2 lab2c; Exam Prep/Finals Notes p1

### [2] Scope and Lifetime Lens
Snippet with globals, nested blocks, helpers, static locals; step and 'call again'. Nested coloured scope rectangles; on each use an arrow searches outward to the nearest declaration; shadowed variables dim; a called function resolves names where its text is written; lifetime strip for automatics; static locals in a static area keep values (counter demo); file-scope static gets a padlock. Lexical scoping, every {} opens a scope (L04D p16; R02 p4); static rules (L04D p18; R02 p43).
- Aha: C picks which x by where the code is written, not who called it, so foo() prints -1 while main's x is 30.
- Sources: L04D p4-5, p16-18; R02 p4, p42-43; L02A p27-29; R01 p16

### [2] Control-Flow Loop Tracer
Snippet with loops/switch/if plus optional stdin. Flowchart rail with lit node; condition values T/F (hover opens expression stepper); per-iteration watch rows form a trace table; break/continue draw jump arrows to innermost target; 'braces revealer' re-indents to what the compiler sees; switch arrow slides through cases to a break. User fills a trace table, tool marks wrong rows. break/continue innermost only (L02C p26-30); switch needs break, discrete type (L02C p4-5); /* */ only ANSI comment (L02A p17).
- Aha: C ignores indentation; a do-while body always runs once.
- Sources: L02C p3-7, p19-30; Midterm AY25/26 Q8-10; AY24/25 Q8; T01 Q5

### [2] Spot-the-Error / Legal-or-Not Flashcards
Card shows a snippet; user picks compiles / warning / compile error / runtime problem and a reason. Reveal gives slide verdict and one-click jump into the right tracer with the snippet loaded. Verdicts: 'f[5] = {...}' after declaration error, 'int e[2] = {1,2,3}' warning (L05A p7); 'dest = source' illegal (L05A p9); 'name = "x"' fails (L05B p11); 'double b = &a' illegal; printf('%f', *a) on a double error, printf('%f', b) on a pointer warning (L04A p14); 'int *n; *n = 123' segfault (L04B p6); missing prototype error (L04C p11); '32 = a', 'a + b = c' lvalue errors (L02B p7); pointers with %d warn, use %p (L04D p14-15).
- Aha: Most errors are type errors in disguise.
- Sources: L05A p7, p9; L05B p11, p13; L04A p14-15; L04B p6; L04C p11; L04D p5, p14; L05C p4; L05D p10; L02B p7; R02 p18, p36, p40; Midterm AY25/26 Q7-8

### [3] Same Bits, Different Type (reinterpret and union lens)
32-bit pattern (hex or clickable bits) or a typed int/float/char; union decl; 'i++' and '(float)i' buttons. One bit row with overlays: unsigned, 2s complement, 4 ASCII chars, IEEE single sign/exponent/fraction bands, all live. Split view: cast converts (bits change), union reinterprets (bits stay). Large-i round-toward-zero drop shows f(X)==f(X+1); 2147483647+1 wraps. IEEE as anatomy only, no conversion drills; denormals/specials belong to L09.
- Aha: Bits mean nothing until a type reads them; a cast converts, a union just changes the glasses.
- Sources: R01 p14, p22, p41-47; L03A p5-6; L03B p6, p24; L03D p5-8; R02 p32; Midterm AY25/26 Q6

### [3] Heap and Pointer-Bug Simulator
Preset bug scenarios with malloc(sizeof(T)), free, void * casts, NULL. Separate stack and heap; malloc carves a labelled block and returns a typed arrow; alloc_new_user builds struct C -> struct D (R02 p37); free greys the block and turns arrows red-dashed 'dangling'; writes through bad pointers land 'somewhere unknown'; alias list per block. Labelled 'Advanced topic' (R02 p37), low exam weight.
- Aha: Declaring a pointer gives an arrow with nowhere to land; free() leaves you pointing at a demolished house.
- Sources: R02 p12, p18, p36-37, p40; L04B p6; Exam Prep/Finals Notes p1

Callouts:
- Changing a parameter does not change the caller: swap(a,b) leaves a=2, b=3 (L04D p6-9; R02 p16)
- Swapping two pointer params inside a function swaps nothing in the caller; mystery() prints 100 (AY23/24 S2 Q2 key A)
- Arrays cannot be assigned and are passed as an address; structs can be assigned/returned and are passed by value (L05A p9, p14-15; L05C p12; L05D p5-7; R02 p31)
- Struct copy is not deep: an array member is copied, a pointer member copies only the address (AY21/22 S2 Q3)
- *p.name means *(p.name); use p->name (L05D p10)
- 'double a, *b;' and 'int *a, b;' declare one pointer only; 'double b = &a' is illegal (L04A p14-15)
- '*' differs in declaration vs expression (L04A p9, p12)
- p++ adds sizeof(pointee): +4 int/float, +1 char, +8 double; ap += 3 adds 12 (L04B p5; R02 p14)
- Declaring a pointer is not allocating: 'int *n; *n = 123;' segfaults (L04B p6; R02 p36)
- Using a pointer after free() is dangling (R02 p12, p40)
- Uninitialised locals hold garbage, not 0 (static/global zeroed per student cheat sheet) (L02A p22; Finals Notes p1)
- Forgetting room for '\0': strlen and %s run past the end ('Length = 8'); 100 chars need char[101] (L05B p9, p12-13; R02 p22)
- Strings are not assigned with '='; use strcpy and size the destination (L05B p11)
- fgets keeps '\n'; scanf('%s') stops at whitespace; puts adds a newline (L05B p5-7)
- Array size in a parameter is ignored; sizeof(arr) in the callee gives the pointer size (filled Lab 2 sheet wrongly says 'size of the first element') (L05A p11-13; Lab 2 Q10; Finals Notes p1)
- Initialiser lists only at declaration; missing values become 0 (L05A p7)
- Integer division drops the fraction: 10/4 = 2, 'float p = 10/4' = 2.0, 'int n = 9*0.5' = 4, 12/5 arrives as 2.0 (L02B p9, p12; L04D p3)
- C % takes the dividend's sign: -10 % 4 = -2, Python gives 2 (L02B p13)
- && binds tighter than ||: a>b || b>c && a==b is 1, parenthesised version 0 (L02C p10-17)
- Indentation lies: unbraced else covers one statement, AY24/25 Q8 prints '2 3'; ?: not lectured but examined (AY24/25 Q8; T02 Ans p3; Midterm Q8)
- Postfix binds tighter than unary *: '**q++ = 100' writes through old q then moves q; '*qq--' reads p[99] then steps back (L02C p9; Midterm Q11; AY25/26 Q10)
- break leaves only the innermost loop or switch (L02C p26-30)
- A called function does not see its caller's locals: foo() sees global x = -1 (L04D p5, p16-17; R02 p4)
- A typedef/struct definition allocates nothing; the closing semicolon is required (L05C p4-5, p7)
- Omitting the prototype: compiler assumes int then reports conflicting types (L04C p10-11)
- A void * must be cast before dereferencing (R02 p18)
- Slide typo: SwapCorrect declares a, b but uses var1, var2; logic is what matters (L04D p11; R02 p17)
- Pointers to pointers, arrays of pointers, pointer comparison and ?: are examined but never lectured: tag exam-gap (guides/Past Finals 3b; T02 Ans p3)
- Struct padding and sizeof(struct) are never taught; slide addresses show gaps (L04B p5) but do not teach them
- L04A p11 draws a_ptr at unaligned ffbff7ff with value 1234567890: illustrative only

Fixtures:
- Pointer trace: a=8,b=15,c=23; p1=&b; p2=&c; p3=p2; print; *p1*=a; while(*p2>0){*p2-=a;(*p1)++;} -> '15 23 23' | '123 -1 -1' | '8 123 -1' (c 23->15->7->-1, b 121->122->123) [L04B p3-4]
- T01 Q6 a=3,*b,c,*d,e,*f sequence -> a=55, c=15, e=0; *b=55, *d=55, *f=0 [T01 Ans p6]
- i=10,j=20; p=&i; *p=*p+2; p=&j; *p=i -> prints 10; i=12, j=12 [L04A p13]
- double a,*b; b=&a; *b=12.34 -> 12.340000 twice; printf('%f',b) warning; printf('%f',*a) error [L04A p14]
- ap=ffbff0a4(int), bp=ffbff0a0(float), cp=ffbff09f(char), dp=ffbff090(double), each ++ -> ffbff0a8 ffbff0a4 ffbff0a0 ffbff098; ap+=3 -> ffbff0b4 [L04B p5; R02 p14]
- g(a,b) a=2,b=3 with a=100+a, b=200+b -> main 2,3 / g before 2,3 / g after 102,203 / main after 2,3 [L04D p6]
- swap(a,b) vs swap(&a,&b), a=2,b=3 -> unchanged; a=3,b=2 [L04D p7-11; R02 p16-17]
- Example1/2 a=9,b=-2,c=5 -> by value f prints 1,10,16, main 9,-2,5; by pointer main 1,10,16 [L04D p12-13]
- Example4 %p of &a,&b,&c -> ffbff78c, ffbff788, ffbff784 (values vary) [L04D p15]
- sqrt_sum_square(3.2, 12/5) and (a, a+b) a=10.5,b=7.8 -> formals 3.2, 2.0 then 10.5, 18.3; results 3.77, 21.10 (computed) [L04D p3]
- mystery pointer swap, a=100,b=500,c=300,d=420 -> 100 (A) [AY23/24 S2 Q2 key]
- foo(int *i){(*i)++;} i=20 -> 21 (B, computed) [AY21/22 S1 Q2]
- i=100; *ptr+=1; printf *ptr, i -> '101 101' (A, computed) [AY21/22 S1 Q3]
- A[4]={1,2,3,4}; p[0]=&A[0]; p[1]=&A[2]; q=p; *q=&A[1]; **q++=100 -> '1 100 3 4' (C); *q = 0x1008 (B) with A at 0x1000 (computed) [Midterm AY25/26 Q11-12]
- A[i]=i, p[i]=&A[i], pp=&p[0], qq=&p[99]; while(++(*pp) <= *qq--){}; **pp -> 51 (C, computed) [AY25/26 Q10]
- a={1,3,2,5}, p=&a[1]; *(p-1)+*(p+1)-*(p+2) -> -2 [R02 p57]
- int a[3]; a, &a[0], &a[1] -> ffbff724 ffbff724 ffbff728 [L05A p8; R02 p20]
- a[3]={54,9,10}; b[]={1,2,3}; c[5]={17,3,10}; e[2]={1,2,3} -> b size 3; c=17,3,10,0,0; e excess warning [L05A p7]
- val[6]={44,9,17,-4,22}; sumArray(val,6) -> val[5]=0, Sum=88 [L05A p11]
- num[4]={3.1,5.9,-2.1,8.8} doubled, %.2f -> 6.20 11.80 -4.20 17.60 [L05A p15]
- chars {'C','h','a','r'} each ++ -> Dibs (computed) [L05B p2]
- int a[3][4], &a[2][1] -> A0 + 4*(2*4+1) = A0+36 [R02 p26]
- int C[4][3][2], C[2][1][0] -> 4*(2*3*2+1*2+0) = 56 bytes [Extras p7]
- ageArray[]={2,15,4,23}; sizeof/sizeof[0] -> 16/4 = 4; in a callee gives pointer size (lab-derived) [Lab 2 Q6, Q10]
- char str[10], input 'My book' -> scanf 'My'; fgets+puts 'My book' [L05B p7]
- fgets input 'eat' -> e a t '\n' '\0'; after strip strlen 3 [L05B p6]
- RemoveVowels 'How HAVE you been, James?' -> 'Hw HV y bn, Jms?' [L05B p8]
- 'apple' with no '\0' -> undefined, e.g. Length = 8 + garbage; with str[5]='\0' Length = 5 [L05B p13]
- name[10]; strcpy 'Matthew' then 'A very long name' -> M a t t h e w '\0' ? ?; second needs 17 bytes, overflows by 7 [L05B p11]
- Which equal strlen(s) -> A (index of first '\0') and D ((address of first '\0') - s) (computed) [AY21/22 S2 Q7]
- result2 = result1 ({123321, 93.5, 'A'}) -> result2 = {123321, 93.5, 'A'} [L05C p10, p12]
- player1 {'Brusco',23,'M'} by value then by pointer -> 'Brusco; 23; M' then 'Alexandra; 25; M' [L05D p5, p8]
- rec_t st[2]; process1(&st[1]); process2(st[0]) -> '11 A' then '33 f' (computed) [AY17/18 Q1a]
- '123 321' before, '123 654' after foo(data) -> D: struct {int x[1]; int *y;} (computed) [AY21/22 S2 Q3]
- struct point {double *x; double *y;}; struct point *p[5] -> B: array of 5 pointers to structs of two double pointers [AY23/24 S2 Q1 key]
- R02 quiz 2 (image) -> t1.x=5, t1.c='hello world', t2.x=4, t2.c='penguin'; t[0]=0,0,'yello', t[1]=1,2,'world', t[2]=3,5,'penguin' [R02 p60-62]
- 01000110 and 0xC0D00000 -> int 70 / char 'F'; int -1060110336 / float -6.5 [R01 p22, p43; L03D p8]
- (float)X == (float)(X+1) round-to-zero, options 0x25a2d87f, 0x0120101c, 0x0388922f, 0x00a66d41 -> B 0x0120101c (script-verified, no key) [Midterm AY25/26 Q6]
- 46/15/2; 19%7%3; int n=9*0.5; x=-23; p=+4*10 -> 1; 2; 4; -23; 40 [L02B p9-10]
- m=10/4; p=10/4; q=10/4.0; n=10/4.0; r=-10/4.0; aa=6,ff=15.8: (float)aa/4; (int)ff/aa; (float)(aa/4) -> 2; 2.0; 2.5; 2; -2; 1.5; 2; 1.0 [L02B p12]
- 10%4, -10%4 -> 2, -2 (Python 2, 2) [L02B p13]
- a=4,b=-2,c=0: x=(a>b||b>c&&a==b); y=((a>b||b>c)&&a==b); z=((a>b)&&!(b>c)) -> 1, 0, 1 [L02C p10-17]
- x = (y = 5) + 5 -> y=5, x=10 [R01 p17]
- for(i=0;i<10;i++) printf ++i -> '1 3 5 7 9' (A, computed) [Midterm Q9]
- i=5; do{printf i--;}while(--i && i>0) -> '5 3 1' (B, computed) [Midterm Q10]
- x=1; if(x>0?0:1) '1 ' else '2 '; '3 ' -> '2 3' (B, computed) [AY24/25 Q8]
- nested for i=1..3, j=1..5, break at j==3 -> per i: 'i,1' Ya 'i,2' Ya 'i,3' [L02C p28]
- Global x=-1 scoping example -> 10, 20, 10, 30, -1, 30 [L04D p17]
- Shadowed i -> 1, 2, 3, 2, 4 (computed) [R02 p4]
- int n = 2147483640; +10 -> -2147483646 [L03B p6, p24]
- readArray 3 9 2 7 -1, reverse, print -> numElements 4; '7 2 9 3 ' (constructed) [T01 Ans p4-5]

## MIPS (stepper, encoder/decoder, ISA, expanding opcode)

L06-L08 and L10: run MIPS line by line, encode/decode with coloured fields, branch and jump arithmetic, bit tricks, memory/endianness, ISA design. Encoding and MIPS-to-C are 2-6 marks in every paper (guides/Past Finals 2).

### [1] MIPS Stepper (C mirror, execution profile, trace export)
Paste code with labels, comments, .data/.word/.asciiz, course subset + li/la/move/blt/bgt/bge/ble/nop/ulw, syscall 1/4/5/10; initial regs dec/hex, .data, text start (default 0x00400000), endianness toggle. Step, back, run to line/iteration k, breakpoints, reset. Shows PC, PC+4, effective address, changed register old/new dec+hex, RTN one-liner, byte grid + word view (lw/sw outlines 4 bytes), branch taken/not with compared values and arrow, per-line hit and branch-taken counts, REAL instruction total (pseudo = expansion), unique bytes read, C mirror and loop-shape overlay (init/cond/body/update) for non-line-by-line C answers. $zero writes discarded visibly; unaligned lw/sw error as QtSpim. Exports dynamic trace to Pipeline and fetch/data streams to Cache. Paper-format outputs (comma lists no spaces, single values, printed output, possible counts). Conventions: sign- vs zero-extension (L06 p41, p46; L08 p19); words +4 (L07 p7); lw/sw aligned, lb/sb any (L07 p11-15); srl logical (L06 p35-38); real instructions only (L06 p8); syscall code in $v0, arg $a0 (Lab 4 p1); jal $ra = Addr(jal)+4 in QtSpim (Lab 5 p3); .data 0x10010000 (Lab 4 p4); jal/jr marked lab-only (L07 p39); addu/addiu/lbu/lh/sh/sltu non-lecture (T02 p1).
- Aha: Registers have no type: one register is an address in lw and a value in add. Bottom-tested loops run once (L07 Ex3 = 6 instructions). One program drives a paper's MIPS, pipeline and cache parts.
- Sources: L06 p8-23, p45-46; L07 p8-38; T02 Q4; T03 D1, Q1-3; Lab 3-5; AY23/24 S2 Q6, Q16a-d; AY24/25 Q18a-b; AY23/24 S1 Q1; AY21/22 S1 Q11, Q14; AY21/22 S2 Q8, Q15; AY20/21 Q4-5, Q14; AY19/20 Q1; AY18/19 Q1; AY17/18 Q5-6; AY16/17 Q3d; AY15/16 Q11

### [1] Instruction Encoder / Decoder with field colouring
Encode one line (names or numbers; address given directly or as 'I1 at X, this is instruction n') or decode an 8-hex/binary word with optional PC. Six steps: green-card opcode/funct lookup and format (0 R, 2 J, else I); decimal field table with remarks; 32-bit bar coloured per field (6/5/5/5/5/6, 6/5/5/16, 6/26); regrouped nibbles keeping colours; hex; decode reverse incl. sign-extended immediate, ALUop/ALUControl and effective branch target. 'Likely mistakes' re-encodes with rs/rt swapped, offset from PC, byte offset (0x1180000C, 0xAE890000). MCQ mode decodes every option and compares targets (AY25/26 Q15). Field-by-field diff of the student's hex; outputs Examplify (8 hex caps, no 0x) or paper (0x) form. Rules: R shamt 0 for non-shifts, rs 0 for shifts (L08 p10-15); I rt is destination for addi/lw (L08 p18); first branch register is rs (L08 p34); lui opcode 0xF, rs 0 (AY25/26 key); 16-bit immediate = 4 hex digits (L08 p21). Opcode table from the official green card, not text (L08 p47).
- Aha: Assembly order (rd, rs, rt) is not bit order (rs, rt, rd); the colour bar makes the swap obvious. rd+shamt+funct become the I-format immediate.
- Sources: L08 p5-22, p33-34, p46-47; R04 p11-18, p38-41; T03 Q2; T04 Q3; AY23/24 S2 Q16e-h; AY24/25 Q15, Q18c-f; AY25/26 Q6-7, Q14-15; AY21/22 S1 Q8, Q10, Q14c-e; AY21/22 S2 Q15c-d; AY20/21 Q8, Q14d-f; AY19/20 Q1d-e, Q3; AY18/19 Q1d, Q3b, Q3e; AY17/18 Q4a, Q5d-f; AY16/17 Q3a-c; AY15/16 Q10a; Midterm AY25/26 Q13

### [1] Branch offset visualizer (PC-relative ruler)
Listing with addresses from a start or any known instruction; pick beq/bne; reverse mode from hex + PC. Address column (rlt addr, L08 p29), labels between rows with no address; markers PC, PC+4, target; arc counts instructions from PC+4; imm = (target - (PC+4))/4 in decimal, 16-bit hex and full encoding. Reverse: sign-extend, <<2, add to PC+4. Range gauge +-2^15 instructions. Not taken PC+4; taken (PC+4)+imm*4 (L08 p28); immediate in words (L08 p27); count only instructions (T03 Q3b).
- Aha: The immediate counts instructions from the one after the branch; two branches to one label differ, two j's encode the same (T03 Q3d).
- Sources: L08 p23-32, p45-46; R04 p19-24; T03 D1(d), Q3(b); T04 Q3; AY23/24 S2 Q16f; AY24/25 Q18c; Midterm AY25/26 Q14; R06 p43-44

### [1] Jump target visualizer (pseudo-direct, 256 MB blocks)
Address of the j plus target (encode) or j word (decode); 'equivalent instruction' mode asks whether beq/bne/j can replace a given branch at that PC. Target drawn as [PC+4 top 4 bits][26-bit field = bits 27..2][00]; encode drops 00, prepends 000010; decode reverses; memory as 16 blocks of 256 MB with reachability check; edge case j at 0x?FFFFFFC whose PC+4 is in the next block. New PC = {PC+4[31:28], target26, 00} (L08 p37-39); jr to cross blocks (L08 p38, p40).
- Aha: j uses PC and ignores displacement; branches use displacement and ignore PC's high bits (L08 p46). The 4 PC bits never touch the opcode.
- Sources: L08 p35-41, p45-46; R04 p25-28; T03 Q2, Q3(c)-(d); AY23/24 S2 Q16h; AY24/25 Q18e-f; AY21/22 S2 Q15d; Midterm AY25/26 Q16; AY25/26 Q15

### [1] C <-> MIPS pattern translator
Pick a construct (if, if-else, while, for, do-while, && short circuit, array by index, array by pointer) or paste course-subset C with a variable->register map; reverse mode MIPS->C. Three linked columns: C, 'if (...) goto' rewrite (L07 p25-26), MIPS, colour-matched; direct vs inverted-condition toggle with instruction counts (L07 p22); array access as sll, add base, lw (L07 p33); pointer version keeps end = base+4n (L07 p34); && as two exit branches (T03 Q1); decompile beq...Exit to if (i != j) (L07 p24). Student C is run against the MIPS on random arrays; mismatches flagged. char arrays use lb, no x4.
- Aha: Every loop is a conditional branch plus a jump; inverting the test saves the j. Pointer version is cheaper (40 non-zero words: 325 vs 245).
- Sources: L06 p26-32; L07 p10-34; T02 Q3; T03 Q1, Q3; AY23/24 S2 Q16a-b; AY24/25 Q18b; AY21/22 S1 Q6; AY21/22 S2 Q15b

### [1] Inequality branch builder (slt + beq/bne)
Pick a<b, a>b, a<=b, a>=b and branch-when-true/false, or paste an slt/beq pair to name it. Step 1 slt operand order; step 2 bne $at,$zero branches on true, beq on false. Draggable number line shows $at and taken/not; shows pseudo name and its $at expansion; 'loop exit' mode checks 5 candidate groups. blt = slt+bne (L07 p28-29); expansions use $at (T04 Q2a); pseudo usually not allowed in exams (Lab 3 p7; T02 p1).
- Aha: slt is the only comparison needed: swap operands for >, swap bne/beq to negate.
- Sources: L07 p28-30, p33; R03 p42; T03 D1(e); T04 Q2(a)-(c); AY21/22 S1 Q11; AY15/16 Q2

### [1] Bit Lab: masks, shifts, C bitwise ops, minimal sequences
Register value, width 8-bit byte_t or 32-bit; click bits to set/clear/invert/copy (from b into a, inverted, shifted) or type and/andi/or/ori/xor/xori/nor/sll/srl/lui steps; C operator buttons | & ^ ~ << >> with printByte view. Source/mask/result rows with bit numbers 31..0 and nibble bars, hex per step; generates the shortest sequence (lui+ori when any mask bit >= 16) and the C one-liners (b |= m; a = (a & ~m) | (b & m)); explains why andi alone cannot clear high bits; 'register as data' preset extracts opcode (srl 26) and rs (sll 6; srl 27). Bit 31 MSB on the left (T02 Ans p4); NOT via nor with $zero or xor all 1s, no nori (L06 p42-43); shift 0-31 (L06 p45); bitwise is tutorial exploration, not lecture (T02 Ans p3); T02 Q2 wants binary immediates.
- Aha: OR 1 sets, AND 0 clears, XOR 1 flips; each bit column is its own gate. 16-bit logical immediates only reach bits 0-15. x % 2^k = andi with 2^k - 1 (Lab 4).
- Sources: L06 p35-44; T02 Q1-Q2, D2 (Ans p3-5); Lab 4 p4; Midterm AY25/26 Q15, Q17; AY25/26 Q14; AY24/25 Q11; AY19/20 Q3(a)-(b); Exam Prep/Combined Selection

### [1] Immediate extension and 32-bit constant visualizer
16-bit immediate (dec/hex/bin) + instruction (addi, slti, lw, sw, beq, andi, ori, xori, lui) or a 32-bit constant. Animated 16->32 expansion: sign extension copies bit 15, zero extension fills 0, lui shifts up; range check C16_2s [-32768, 32767], C16 [0x0000, 0xFFFF], C5 [0, 31]; constant split into lui + ori with a lui+addi failure demo when bit 15 of the low half is 1; li expanded to ori or lui+ori. No subi (L06 p33); low half via ori (L06 p44).
- Aha: 0xFFFF is 65535 in ori but -1 in addi: that explains li, lui+addi corruption, and why 'andi $z,$x,-1' is not identity.
- Sources: L06 p33, p41, p44-46; L08 p19, p33-34; T02 D2(b)-(d); T04 Q2(d); T01 Q1; AY21/22 S1 Q10A; Midterm AY25/26 Q17(ii)

### [1] Expanding-opcode planner
Instruction length(s), register count, address space and addressing unit, per-class operand lists or opcode widths; constraints (at least one per class, space fully used, fixed-count class); objective max total / max one class / min. Derives each opcode width = length - operand bits (register field ceil(log2 #regs); 512 B -> 9-bit address); prefix tree or stacked bar of 2^n patterns; leftover codes expand by 2^(next - this); max gives short classes 1, min gives all-but-one; also budget equation sum count_i*2^(L-w_i) = 2^L, warns when the two methods disagree. Step-by-step text in the style of AY23/24 S2 Ans p4. Method from R04 p45; slides give only the idea (L10 p30).
- Aha: A short opcode is expensive because each value eats a whole block of patterns; max and min push opposite ways. MIPS funct is the same idea (opcode 0 -> 64 R-types).
- Sources: L10 p24-30; R04 p45; Extras p11-12, p17-18; Finals Notes p4-5; AY15/16 Q6; AY16/17 Q4b-g; AY17/18 Q4a; AY20/21 Q3; AY21/22 S2 Q12; AY23/24 S2 Q7; Midterm AY25/26 Q19, Q27

### [1] Memory, byte addressing and alignment visualizer
Base register value + offset + access type (lw/sw/lb/sb/ulw) or an int/char array decl with base and index. Byte grid with word boxes on 4-byte boundaries, aligned/misaligned tag by last hex digit; EA = base + offset addition; A[i] = base + 4i as sll then add; ulw highlights its 4 bytes and builds a unique-bytes set; misaligned lw/sw error; k-bit address = 2^k bytes, 2^30 words.
- Aha: Next word is +4, a string walk +1. L07 Ex5's 13 unique bytes are 10 overlapping 4-byte windows.
- Sources: L07 p4-16, p37-38; R03 p30-38, p43; L10 p16; T03 Q1; Lab 3 p7-8; AY21/22 S2 Q9

### [2] Endianness and Byte-Order Viewer
32-bit word hex or 4 bytes + start address; endianness toggle; read as int, unsigned, char[4], float bits, lb at offset k, lh; 'send to other-endian machine'. Word split Byte 3..0 (bits 31-24..7-0, R02 p8) beside cells x..x+3; toggling animates bytes into slots; char[4] reads in address order and never changes, int changes, both shown with decimals; send mode byte-swaps and shows the 1-bit count unchanged; QtSpim data-tab view explains reversed 'Hello' (inference from L10 p18). Mode always visible: big for exam reasoning, little for QtSpim mode.
- Aha: Endianness only reorders the bytes of a multi-byte value; chars, bits in a byte and separate words do not move.
- Sources: R02 p6-8; L10 p17-18; R04 p36; Finals Notes p4; Lab 3 p6-7; AY21/22 S1 Q7; AY18/19 Q1f; Midterm AY25/26 Q18

### [2] Pseudo-instruction expander and real-vs-pseudo checker
Pseudo (move, li, la, blt, bgt, bge, ble, nop, ulw, or exam-invented nand, sllv, lhw) or a whole program. Expansion with $at highlighted; size-dependent li (ori vs lui+ori) and la (lui alone if low half 0); QtSpim text-segment view [address][hex][native][; source]; shows later addresses shifting and which branch/jump fields change; nop = all-zero word. move -> add $rd,$rs,$zero (L06 p8, p34); li $v0,10 -> ori $2,$0,10 (Lab 3 p4); $at reserved (L08 p7).
- Aha: A pseudo-instruction is MIPS-to-MIPS translation; expansions change code size and QtSpim addresses (Lab 5 jal at 0x0040000C: la as one lui, inference).
- Sources: L06 p8, p34; L07 p12, p29; T02 p1, D2; T04 Q2; Lab 3 p4-7; Lab 5 p2-3; AY15/16 Q2; Midterm AY25/26 Q15, Q26; AY18/19 Q1f

### [2] Instruction validity linter
One instruction line, optional comment of intended effect. Checks operand order vs comment, mnemonic existence (no subi; slt with immediate should be slti), immediate range per kind, register where an immediate is written (bne $s0,0,L), lw/sw alignment when base known; proposes course fix (addi $t2,$t1,-3; lui then or; sll $t5,$t2,1). Syntax op dest, src1, src2; # comment (L06 p26-27); shift 33 = shift 1 per T02 D2e answer.
- Aha: Invalid instructions fail because of the 32-bit format: 16 immediate bits, 5 shamt bits, 5 register bits.
- Sources: T02 D2(a)-(e); L06 p27-29, p33, p45-46; L07 p15; L08 p9; AY23/24 S1 Q12; AY24/25 Q13; AY25/26 Q2

### [2] Execution-count and loop-formula analyzer
Loop or program + data or symbolic iteration count; 'possible totals' mode lets data-dependent branches vary. Per-line counts grouped as setup + iterations x body + exit check, algebraic form (2 + 4x10 + 1 = 43), branch taken counts, 'k-th instruction executed', reachable totals when an inner branch can go either way. Real instructions only (L06 p8); L07 p35 tip: decompile first or trace.
- Aha: Counts follow a formula once drawn as setup, body, exit; the exit check costs one extra branch.
- Sources: L07 p27, p35-38; R03 p67; AY21/22 S2 Q8; AY15/16 Q11b; AY18/19 Q1b; AY20/21 Q5

### [2] Instruction-sequence equivalence tester
Target effect (pseudo-instruction, 'set $t2 to 0', 'no effect') + candidate sequences. Runs each on random register values; reports registers/memory changed and side effects; pass/fail per candidate. Logical immediates zero-extended (L06).
- Aha: nor with $0 is NOT; xori $t2,$t2,0 does not clear; srl $4,$4,0 is a real no-op.
- Sources: AY24/25 Q11; AY21/22 S2 Q10; AY20/21 Q9; AY18/19 Q1f; AY19/20 Q3; AY15/16 Q2; Midterm AY25/26 Q15, Q17

### [3] Storage-architecture animator
Expression such as C = A + B or x[i] = x[i] + 5 with memory values. Four synced panes: stack, accumulator, load-store, memory-memory; each tracks instruction count, memory accesses, implicit operands. Code sequences exactly as L10 p9; examples per class L10 p8.
- Aha: A stack Add names no operands; load-store needs more but simpler instructions, hence RISC (L10 p14).
- Sources: L10 p4, p7-14; AY16/17 Q4a

### [3] Addressing-mode explorer
Mode (register, immediate, displacement, register indirect, indexed, direct, memory indirect, auto-inc/dec, scaled, PC-relative, pseudo-direct), registers/memory, fields. Animated EA computation with reads in order and side effects; MIPS badge on modes MIPS has. Table L10 p20.
- Aha: L10's 3 MIPS modes and L08's 5 do not conflict: PC-relative and pseudo-direct locate branch/jump targets.
- Sources: L08 p43-46; L10 p19-20; Finals Notes p4

### [3] Shift-and-add constant multiplier
Expression with small constant multipliers over mapped registers (d = 6a + 3(b - 2c)) or x*k. Factoring step (3(2(a-c)+b)), constants as powers of 2, resulting sll/add/sub with count; verified by stepper on random inputs. No multiply in this subset; sll fills 0 (L06 p37-38).
- Aha: x2^n is one sll; factoring first minimises instructions.
- Sources: L06 p38; T02 Q3; Midterm AY25/26 Q3; Extras p9

Callouts:
- Assembly writes rd first but bits are rs, rt, rd; AY24/25 key lists 0xAE890000 (swap) for sw $s4,0($t1) (L08 p12; AY24/25 Q18d; Midterm Q13 distractor 0x8c6fff9c)
- sll/srl: source in rt, rs = 0, amount in shamt (L08 p13, p15)
- In beq/bne the first register is rs (L08 p34)
- Branch offset counts from PC+4; 0x1180000C is the 'from PC' mistake; backward branches too (L08 p28, p30; AY24/25 Q18c; AY21/22 S1 Q10C)
- Branch immediate is in words, not bytes; -3428 is 4x too big (L08 p27; Midterm Q16 option D)
- Labels take no address; count only instructions (L07 p19; T03 Q3b note)
- j field = target bits 27..2; top 4 bits from PC+4 (not PC), never replacing the opcode (L08 p37-40)
- Two j's to one label encode identically, two branches do not (T03 Q3d)
- andi/ori/xori zero-extend, addi/slti/lw/sw/beq sign-extend: andi $t1,$t0,51966 gives 0x22 (L06 p41, p46; L08 p19; AY25/26 Q14; AY21/22 S1 Q10A)
- Lower half of a 32-bit constant goes in with ori after lui, not addi (L06 p44, p46)
- No subi: use addi with a negative constant (L06 p33; T02 D2c)
- No 32-bit immediates (ori with 0xAC120000 invalid); shamt 0-31 (T02 D2d-e; L08 p9, p19)
- Next word is +4; lw/sw base+offset multiple of 4; lb/sb any offset (L07 p11, p15; R03 p43)
- A base register holds an address, not A[0]'s value (L07 p14)
- slt+bne branches when true, slt+beq when false; swap operands for > (L07 p28-30; R03 p42; T04 Q2)
- Inverting the condition gives shorter code; beq...Exit around a block = if (i != j) (L07 p22, p24)
- Bottom-tested loop runs its body once: L07 Ex3 executes 6 instructions (L07 p35)
- Only real instructions count: bge counts as 2 (L06 p8; T04 Q2; L07 p33)
- srl is logical; C >> on signed ints is arithmetic in GCC/Clang (L06 p35, p38)
- No NOT instruction: nor with $zero or xor with all 1s; xori exists, nori does not (L06 p42-43)
- C '&' vs '&&'; 'if (x & 1 == 0)' parses as x & (1 == 0) (Extras p8)
- && compiles to two exit branches; char arrays use lb, no x4 (T03 Q1)
- Endianness reorders bytes of a multi-byte value only; strings/byte arrays unaffected; MIPS endianness is implementation-specific (slides list MIPS (SGI) big-endian, online interpreter and QtSpim little-endian, R02 p8 'our MIPS' big) (L10 p17-18; R02 p8; Finals Notes p4)
- L10's '3 addressing modes' vs L08's 5: extra two are for branch/jump targets (L10 p19; L08 p43-46)
- Expanding opcode: max gives short types 1 and the longest type the rest; min gives short types all but one; 'at least one each' and 'fully utilised' matter (R04 p45; AY20/21 Q3; L10 p30)
- nop = sll $zero,$zero,0 = 0x00000000; writes to $0 (bne $0,$0,L) are also no-ops (T04 Q2e; AY21/22 S2 Q10)
- beq $s1,$s1,L is always taken; a j is equivalent only if the absolute target matches (AY25/26 Q15)
- jal: QtSpim and lecture give $ra = Addr(jal)+4, green card says PC+8 (Lab 5 p3; L08 guide)
- Pseudo-instructions usually not allowed in exams; li/la only (Lab 3 p7; T02 p1)

Fixtures:
- add $8,$9,$10 -> 0|9|10|8|0|32 = 0x012A4020 [L08 p11-12; R04 p12-13]
- sll $8,$9,4 -> 0|0|9|8|4|0 = 0x00094100 [L08 p13]
- add $10,$7,$5 -> 0x00E55020 [L08 p14]
- addi $21,$22,-50 -> 8|22|21|-50 = 0x22D5FFCE [L08 p20-21; R04 p16-17]
- lw $9,12($8) -> 35|8|9|12 = 0x8D09000C [L08 p22; R04 p18]
- beq $9,$0,End at rel 0, End at 16 -> imm 3, 0x11200003 [L08 p29-31]
- beq $0,$0,Loop at 12, Loop at 0 -> imm -4, 0x1000FFFC [L08 p32; R04 p24]
- j Loop at 20, Loop at 8 -> field 2, 0x08000002 [L08 p41]
- addi $9,$10,-32 -> 0x2149FFE0 [R04 p38]
- beq $s0,$s1, 4 instr below PC+4 -> 0x12110004 [R04 p39]
- 0x8D8BFF1D -> lw $11,-227($12) [R04 p40]
- 0x001289C2 -> srl $17,$18,7 [R04 p41]
- T03 decode from 0x00400028: 0x20110000, 0x00084042, 0x11000002, 0x22310001, 0x0810000B -> addi $17,$0,0; srl $8,$8,1; beq $8,$0,+2; addi $17,$17,1; j 0x0040002C [T03 Q2]
- T03 binary search: bne $t9,$zero,end; I1 at 0xFFFFFF00, loopEnd 18th -> bne imm 16; loopEnd 0xFFFFFF44; j = 0x0BFFFFD1 both [T03 Q3b-d]
- T03 D1 A={7,4,1,6,0,5,9,0}, B={3,4,5,2,1,0,0,9} -> A={3,4,1,2,0,5,9,0}, B={7,4,5,6,1,0,0,9}; 4 sw; bne imm -9 [T03 D1b-d]
- AY23/24 S2 Q16 n=8, A={1..8}, B={9..16}, C={111..888}, i1 at 0x00400050 -> box1 (i%4)/2; box2 C[k]=A[i]+B[i]; k=4; C=10,12,18,20,555,666,777,888; 0110482A; 15200006; ACEB0000; j loop 08100019 [AY23/24 S2 Ans p16]
- AY24/25 Q18 A={123,-13,26,30,9}, B={44,765,200,999,123}, Inst16 at 0x00400078 -> A={123,-39,26,90,27}; 0x1180000B; 0xAD340000; Inst4 0x00400048; j 0x08100012 [AY24/25 Ans p15-16]
- lui $s1,57007 -> 0x3C11DEAF [AY25/26 Q6]
- andi $t1,$t0,51966 with $t0=0xABCD0123 -> 0x00000022 [AY25/26 Q14]
- 0x12310003 at 0x1000 -> beq $17,$17,3, target 0x1010; equivalent j 0x08000404 [AY25/26 Q15]
- 0x10000103 at PC 0x491 -> beq $0,$0,259; next PC 0x495+0x40C = 0x8A1 [R06 p43-44]
- lw $v1,-100($t7) -> 0x8DE3FF9C (D, computed) [Midterm Q13]
- 0x12C3FBAD at 0x5204 -> beq $22,$3,-1107, target 0x40BC (C, computed) [Midterm Q14]
- 0x080000AD at 0x1014 -> target 0x2B4; beq imm -857 (A, computed) [Midterm Q16]
- AY21/22 S1 Q8 given 0x20030000, 0x20630001, 0x30830001, 0x1480FFFE, 0x08000002 -> wrong C (0x30640001) and D (0x1480FFFD) (computed) [AY21/22 S1 Q8]
- AY21/22 S2 Q15 A={1,2,3,4,5}, B={5,3,4,5,3,8,2,5,9,4}, I19 at 0x00400084 -> B={1,3,2,5,3,8,2,5,5,4}; slt 0x010B602A; I5 0x0040004C; j 0x08100013 (computed) [AY21/22 S2 Q15]
- AY21/22 S1 Q14 A={10,21,12,17,9,1,20,33}, B={7,3,20,15,2,18,35,11}, I1 at 0x2B000FFC -> prints 17; beq $t3,$0,end 0x1160000B; lw $s1,0($t1) 0x8D310000; j loop 0x0AC00404 (computed) [AY21/22 S1 p10-11]
- AY20/21 Q14 A={10,21,12,17,9,1,20,33}, B={100,3,20,15,2,2,65,11}, I1 at 0x10000C50 -> count 5; A={10,18,12,2,7,-1,20,22}; 0x0112C02A; 0x13200005; 0x08000316 (computed) [AY20/21 p8-9]
- AY20/21 Q4-5 parity loop -> Q4 E; Q5 52 instructions (computed) [AY20/21 p3]
- AY19/20 Q1 $s0=0xBEBEC0C0 -> $s1=0x4A; max 0x78 at 0xFFFFFFFF; srl $s0,$s0,4 = 0x00108102; bne = 0x1600FFFC (computed) [AY19/20 Q1]
- AY18/19 Q1 $s0=32; 43 -> $t0=26, $t1=31; 3 branches; 0,0 needs 0xFFFFFFFF; srl $s0,$s0,1 = 0x00108042 (computed) [AY18/19 Q1]
- AY17/18 Q5 A={11,9,31,2,9,1,6,10}, B={3,7,2,12,11,41,19,35}, first beq at 0x0040003c -> A={11,10,31,14,9,42,6,11}; sll $t8,$t8,2 0x0018C080; j A2 0x0810001C; slt $t7,$t8,$zero 0x0300782A (computed) [AY17/18 p5-6]
- AY16/17 Q3 j at 0xE0480030 -> add $s2,$s0,$zero 0x02009020; beq $t1,$zero,done 0x11200007; j L1 0x08120002 (computed) [AY16/17 p3]
- AY18/19 Q3b j word 0x0800C840 at 0x2100FFFC -> correct target 0x20032100 (computed) [AY18/19 Q3b]
- AY23/24 S2 Q6 loop ($t0=64, xor clears) -> $t2 = 9 [AY23/24 S2 Ans p3-4]
- AY23/24 S1 8-element loop, 3 elements < 5 -> 2 + 3x8 + 5x9 + 1 = 72 instructions [AY23/24 S1 Ans p2]
- L07 Ex3/Ex4/Ex5 -> 6 instr, $t2=20; 15 instr, $t1=6; bne 10 executed, 9 taken, 42 instr, 13 unique bytes [L07 p35-38]
- for(i=0;i<10;i++) a=a+5 -> 2 + 4x10 + 1 = 43 [L07 p27; R03 p67]
- 40-word all non-zero array, bge = 2 -> index version 325, pointer version 245 (+1 each per zero) (computed) [L07 p33-34]
- $s0=8000: lw $t0,4($s0); sw $t0,12($s0); swap k=3 base 2000 -> 8004; 8012; $2=12 then 2012, loads 2012, 2016 [L07 p8-9, p16]
- A[7] = h + A[10], base $s3 -> lw 40($s3), sw 28($s3) [L07 p10]
- AY21/22 S2 Q8 loop, options 9/14/15/43/63 -> possible 9, 15, 43, 63; 14 impossible (computed) [AY21/22 S2 Q8]
- AY21/22 S1 Q11 loop-closing slt groups -> B and E (computed) [AY21/22 S1 Q11]
- T02 Q4 parity loop $s0=31; 0x0AAAAAAA -> 0x8000001F; 0x0AAAAAAA [T02 Q4]
- T02 Q1 byte_t a=5, b=22 -> a|b 23, a&b 4, a^b 19, ~a 250, a<<1 10, b>>1 11 (computed) [T02 Ans p3]
- T02 Q2 set bits 2,8,9,14,16; copy b bits 1,3,7 to a; c bits 2,4,8 = NOT b bits 1,3,7 -> lui 0x0001 + ori 0x4304 (mask 0x00014304) + or; andi 0x008A, clear mask 0xFFFFFF75; xori 0x8A, andi 0x8A, sll 1, clear mask 0xFFFFFEEB [T02 Ans p4-5]
- sll $t2,$s0,4 with 0xB8000009; and 0x632F0D59 & 0x00003C00; andi/ori 0xFFF with 0x09C35D9C -> 0x80000090; 0x00000C00; 0x00000D9C; 0x09C35FFF [L06 p37, p39-41]
- load 0xAAAAF0F0 -> lui $t0,0xAAAA; ori $t0,$t0,0xF0F0 [L06 p44]
- d = 6a + 3(b - 2c) -> 5 instructions (sub, sll 1, add, sll 2, sub) [T02 Q3d]
- Midterm Q17 options vs exactly 0x00009200 -> none works, E (computed, no key) [Midterm Q17]
- 0xDEADBEEF at 0 -> big DE AD BE EF; little EF BE AD DE [L10 p17]
- Bytes 0x43 0x61 0x74 0x73 at 0x3E8 -> chars 'Cats' in address order either way; big-endian int 1130460275 (option C's 1130460273 false), little-endian 1937006915 (D true); A/B ambiguous (computed) [AY21/22 S1 Q7]
- Words 0x752d6298, 0x1ab8407a, 0xb3fdf0cb, big-endian sent to little-endian, odd parity -> popcounts 15, 13, 21, all accepted, D (computed) [Midterm Q18]
- Lab 3/5 QtSpim (lab-derived): addi $t1,$zero,97 -> 0x20090061 at 0x00400024; H 0x48, e 0x65, l 0x6C, o 0x6F; lb $t0,4($a0); addi -32 -> HelloHellO; jal at 0x0040000C -> PC 0x00400028, $ra 0x00400010 [Lab 3 p5-9; Lab 5 p2-3]
- Lab 4 (lab-derived): X=32, X=8 masks; arrayA {11,0,31,22,9,17,6,9}, X=2 -> andi 0x1F, 0x7 (X-1 via addi -1); count 3; arrayA 0x10010000, count 0x10010014 [Lab 4 p4-5]
- 8-bit instr, Type-A 4-bit, Type-B 8-bit opcode -> max 241, min 31 [R04 p45]
- 16-bit, 512 B space, 12 regs; A 2 regs, B reg+address, C none with exactly 2 -> opcodes 8/3/16; max 226 [AY23/24 S2 Q7 key]
- 3/5/7-bit opcodes, at least one each -> max 110 (C, computed) [AY20/21 Q3]
- 4/6/8-bit opcodes -> max type C 236 (C, computed) [AY15/16 Q6]
- 64 regs; A 16-bit 2 regs, B 32-bit 3 regs + 6-bit shamt, C 32-bit 2 regs + 14-bit imm -> opcodes 4/8/6; max 238, min 22 (computed) [Midterm Q27]
- A 6-bit, B 8-bit, C 11-bit; A 6-bit vs B 11-bit -> min 74, max 2010; max 2017, min 95 [Finals Notes p4-5]
- 24-bit; P 4x4, Q 3x4, R 2x5, S 1x6 operand bits -> max 261,043 [Extras p17-18]
- Zephyr 32-bit operand bits A 0, B 3, C 16, D 19, E 6, F 22 -> max 4,290,183,101; min 2075 (computed) [AY16/17 Q4c-d]
- AY16/17 Q4a / AY21/22 S1 Q10E funct expansion -> 5 R-opcodes give 5x64 + 59 = 379; 63 + 64 = 127 (computed, ambiguous) [AY16/17 Q4a; AY21/22 S1 Q10E]
- C = A + B -> stack 4, accumulator 3, load-store 4, memory-memory 1 instructions [L10 p9]
- 70% of time halved, 30% slowed by 50% -> 0.35t + 0.45t = 0.8t [L10 p23]

## Datapath & Control (single-cycle, lit paths, control tables, critical path)

L11-L12: one instruction lighting the single-cycle datapath, control signals from opcode, ALU control, critical path, faults and ISA extensions.

### [1] Single-cycle datapath tracer with T04 table auto-fill
One instruction (add, sub, and, or, slt, lw, sw, beq; addi, bne as L11 p6 extras) as assembly or hex; editable registers, data memory, PC. Steps Fetch / Decode / ALU / Memory / RegWrite or a whole cycle on the L11 p48 SVG. Decode splits fields with bit ranges (RR1 = Inst[25:21], RR2 = Inst[20:16]), RegDst mux, sign-extend; ALUSrc mux, ALUcontrol, result and isZero; beq shift-2, target adder, PCSrc = Branch AND isZero; memory Address, Write Data = RD2; MemToReg into WD. Used wires coloured with values; 'computed but discarded' wires grey-dashed (sign-extend on R-type; WR/WD on beq). Side panel fills RR1, RR2, WR, WD, Opr1, Opr2, Address, Write Data, next PC in T04 notation ($5, [$5], Mem(X)), each cell coloured by the feeding instruction field; list of unused ports (RR1 unused for sll/lui, AY23/24 S2 Q10); R05 p38 output-per-stage list. Conventions: L11 p20 field positions; RegDst 0 = rt (L12 p10); ALUSrc 1 = SignExt (L12 p12); always sign-extends, so andi/ori unsupported (L11 p6); MemToReg 1 = memory, mux drawn swapped (L12 p15; L11 p43); PC written on rising edge (L11 p18); only one of MemRead/MemWrite (L11 p40); no sll/srl/j (L11 p6, p47).
- Aha: Every unit computes every cycle; control only decides what is kept. Field positions shared by R and I format (L08 p16) let one datapath read both.
- Sources: L11 p6-9, p18-48; L12 p4-17, p30; R05 p5-38 (p36 FYP visualiser link); T04 Q3 (Ans p2-3); R06 p43-44; Midterm AY25/26 Q20-25; AY21/22 S1 Q4; AY23/24 S2 Q8-11; L08 p10, p16, p18

### [1] Control unit explorer (opcode -> signals, PLA view, fill-in quiz)
Opcode, instruction or hex; quiz mode blanks the row for the student to fill. Highlights the L12 p34 row; each signal's 0/1 meaning (L12 p10-17) lights its mux on a mini-datapath; tooltip per X saying why and which signals can never be X; gate-level circuit (L12 p33) shows the fired product term; toggle to the L20 p27 EX/M/WB grouping. Opcodes R 0x00, lw 0x23, sw 0x2B, beq 0x04 (L12 p32). Rows (RegDst ALUSrc MemToReg RegWrite MemRead MemWrite Branch ALUop): R 1 0 0 1 0 0 0 10; lw 0 1 1 1 1 0 0 00; sw X 1 X 0 0 1 0 00; beq X 0 X 0 0 0 1 01. PCSrc not a control output (L12 p17). Shows both stage labels (L12 p5 vs L20 p27).
- Aha: All signals except ALUcontrol come from the opcode alone; state-changing signals (RegWrite, MemWrite, Branch) can never be X.
- Sources: L12 p5, p9-19, p29-34; L20 p27; R06 p5-9, p24-27; T05 Q1, Q5; AY15/16 Q9a; AY25/26 Q7; AY23/24 S2 Q9; AY21/22 S2 Q11; AY17/18 p5 (ALUop table)

### [1] ALU-control two-level decoder + 1-bit ALU slice
ALUop + funct or a whole instruction; raw mode toggles Ainvert, Binvert, Operation with two operands. Level 1 opcode -> ALUop (00 lw/sw, 01 beq, 10 R); level 2 ALUop + funct -> ALUcontrol with live bit expressions ctrl3 = 0; ctrl2 = ALUop0 + ALUop1.F1; ctrl1 = ALUop1' + F2'; ctrl0 = (F0+F3).ALUop1 (relevant funct bits lit, F5/F4 irrelevant); 1-bit slice (L12 p21-22) shows AND, OR, add, sub, slt, NOR; 32-bit result and isZero. Codes 0000 AND, 0001 OR, 0010 add, 0110 sub, 0111 slt, 1100 NOR (L11 p34); funct add 100000, sub 100010, and 100100, or 100101, slt 101010 (L12 p26). Lecture derives only ctrl3/ctrl2 (L12 p27-28), ctrl1/ctrl0 from R06 p20; slt internals not shown (L12 p22).
- Aha: ALUcontrol is literally Ainvert|Binvert|Operation, so NAND needs no new hardware: 1101.
- Sources: L11 p33-34; L12 p20-28; R06 p11-21; T05 Q6-7; AY24/25 Q15; AY21/22 S2 Q4; AY23/24 S2 Q11

### [1] Critical-path and cycle-time calculator
Latency table (preset A ps from T05 Q2 / R06 p42: IM 400, adder 100, MUX 30, ALU 120, RF 200, DM 350, Control/ALU-control 100, shift/sign-extend/AND 20; preset B L12 p36 ns: memory 2, ALU/adders 2, RF 1); editable; instruction or class. Datapath as timing DAG, each unit stamped with arrival time, parallel branches with slack, critical path bold, each component ticked on/off path in the midterm Q28 answer format, totals per instruction, cycle time = slowest. RF counted for read and write; DM excluded when unused; series sum, parallel max (R06 p41).
- Aha: For addi, sign-extend + mux (50 ps) hides behind the 200 ps register read, but for sub, RD2 passes through the ALUSrc mux in series. Every instruction pays lw's time.
- Sources: T05 Q2; R06 p40-42; Midterm AY25/26 Q28; L12 p35-36; L20 p31; AY23/24 S2 Q8

### [2] Datapath fault injector / what-if
Force a control signal stuck-0, stuck-1 or inverted, or an instruction bit stuck; choose instruction and register/memory contents. Correct and faulty runs side by side, first diverging wire flashes, diff of registers, memory, PC; list of supported instructions the fault breaks. L11 p40 memory returns data only if MemRead: show both readings when a fault depends on it.
- Aha: A signal matters only for instructions whose result passes through its unit; X entries are exactly the instructions a fault cannot hurt (inverted MemToReg breaks lw and R-types, not sw or beq).
- Sources: AY15/16 Q9b; AY17/18 Q4b-c; AY20/21 Q10; AY19/20 Q3c; AY18/19 Q3; AY16/17 Q5a; L11 p40; L12 p10-17

### [2] Extend-the-ISA designer
Pick a new instruction (bne, blt, bgt, NAND, j); fill its control row and new columns; add gates to PCSrc. Validator re-runs every existing instruction through the modified design and flags breakage. bne: PCSrc = beq.Zero + bne.Zero', ALU subtracts (ALUop 01); j may need ALUop 11 (AY18/19 Q3). Constraints: no new ALUop, existing instructions unchanged, ALU outputs only result and Zero (AY25/26 Q18).
- Aha: bne needs only the inverted isZero, answering the 'how?' on L11 p36.
- Sources: AY25/26 Q18; AY16/17 Q5b-c; AY17/18 Q4d; AY18/19 Q3; AY21/22 S2 Q4; L11 p6, p36; L12 p17

### [2] Control-signal-by-stage and hazard-facts flashcards
Spaced-repetition deck plus generated questions (instruction -> signal, signal -> stage, scenario -> penalty), instant feedback with page cite and a 'show me' link opening the tracer preset. Exact course tables and wording (L12 p34, L20 p27).
- Aha: Each fact is tied to the grid or wire it describes.
- Sources: L12 p34; L20 p26-27; L21 p5, p14, p20, p32, p36-39, p46; AY23/24 S1 Q5, Q11; AY23/24 S2 Q8-11; AY21/22 S2 Q11

### [3] Component 'as a function' C-model view
Click any element to see its pseudo-code/C model (IM, adder, RegRead/Write, Mux, ALU with isZero, DataMem) with current inputs substituted. T05 uses C beyond lectures (macros, uint<N>_t): mark as understanding, not exam prep.
- Aha: Each box is a small function of its inputs.
- Sources: L11 p16-17, p23, p27, p33, p40; T05 Q3-7

Callouts:
- I-type destination is rt (Inst[20:16]), hence the RegDst mux (L11 p25-26; L12 p10)
- MemToReg mux inputs are drawn swapped: 1 = memory, 0 = ALU (L12 p15; L11 p43)
- PCSrc is Branch AND isZero, not a control output (L12 p16-17; R06 p7)
- RegDst/MemToReg are X for sw/beq but RegWrite (and MemWrite for beq) must be 0; MemRead for sw must be 0 (L12 p34; L11 p40; AY21/22 S2 Q11E)
- beq still routes $3 or $0 to WR and junk to WD; nothing written because RegWrite = 0 (T04 Ans p3)
- sw: ALU operand 2 is the immediate, RD2 goes to Write Data; lw also sends [rt] to Write Data, unused (L11 p42; T04 Ans p3)
- Course datapath always sign-extends: andi/ori not supported; a student cheat sheet wrongly says logical immediates route zero-extended (L11 p6; Finals Notes p6)
- Opcode alone is not enough for ALUcontrol; ALU control unit has 8 inputs, 4 outputs (L12 p18, p23-26; AY23/24 S2 Q9, Q11)
- Critical path: parallel branches are not added, but RD2 passes through the ALUSrc mux for R-types; the Extras checkpoint saying sub needs no MUX is questionable (R06 p41-42; Extras p13-14)
- Stage attribution differs: L12 p5 puts RegDst/RegWrite in Decode, the pipeline groups RegDst in EX and RegWrite/MemToReg in WB (L12 p5 vs L20 p27)
- lw has a longer latency than sw because it also writes the register file (AY23/24 S2 Q8 key C; L20 p31)
- Taught subset excludes sll/srl/j/lui (L11 p6), yet AY23/24 S2 Q10 key relies on sll and lui not using RR1
- AY16/17 Q5 gives BLT opcode 0x08, which is addi's real opcode: warn on that preset

Fixtures:
- beq $1,$3,12 -> 0x1023000C; RR1 $1, RR2 $3, WR $3 or $0, WD [$1]-[$3] or random, Opr1 [$1], Opr2 [$3], Address [$1]-[$3], Write Data [$3]; next PC PC+4 or PC+4+48 [T04 Q3a, Ans p3]
- lw $24,0($15) -> 0x8DF80000; RR1 $15, RR2 $24, WR $24, WD Mem([$15]+0), Opr1 [$15], Opr2 0, Address [$15]+0, Write Data [$24]; next PC+4 [T04 Q3b]
- sub $25,$20,$5 -> 0x0285C822; RR1 $20, RR2 $5, WR $25, WD [$20]-[$5], Opr1 [$20], Opr2 [$5], Address [$20]-[$5], Write Data [$5]; PC+4 [T04 Q3c]
- T05 Q1 (order RegDst RegWrite ALUSrc MemRead MemWrite MemToReg Branch ALUop ALUcontrol) -> beq X 0 0 0 0 X 1 01 0110; lw 0 1 1 1 0 1 0 00 0010; sub 1 1 0 0 0 0 0 10 0110 (derived, no key) [T05 Q1; L12 p26, p34]
- addi control -> RegDst 0, ALUSrc 1, MemToReg 0, RegWrite 1, MemRead 0, MemWrite 0, Branch 0, ALUop 00 (derived) [AY15/16 Q9a]
- 0x02898820 -> add $s1,$s4,$t1 (add $17,$20,$9); ALUop 10 [AY25/26 Q7 key]
- 0x0235C020 -> add $t8,$s1,$s5; ALUcontrol 0010 [AY24/25 Q15 key]
- ALUop 10, funct 100100 -> ctrl3 0, ctrl2 0, ctrl1 0, ctrl0 0 = 0000 [R06 p20; L12 p26]
- NAND $rd,$rs,$rt -> Ainvert 1, Binvert 1, Operation 01 = 1101 (derived) [AY21/22 S2 Q4]
- Add bne, rename Branch to beq -> bne row RegDst X, ALUSrc 0, MemToReg X, RegWrite 0, MemRead 0, MemWrite 0, beq 0, bne 1, ALUop 01; bne column 0 elsewhere; PCSrc = beq.Zero + bne.Zero' [AY25/26 Q18 key b, d]
- add $t4,$v0,$s1 with $t4=0x100, $v0=0x200, $s1=0x300 -> 0x00516020; RR1 2, RR2 17, WR 12; sign-extend 0x00006020; RD1 0x200, RD2 0x300, ALU 0x500; RegDst 1, RegWrite 1, ALUSrc 0, MemRead 0, MemWrite 0, MemtoReg 0 (B) (computed) [Midterm Q20-25]
- addi critical path, T05 latencies -> 400+200+120+30+200 = 950 ps; SE+MUX and Control off path [R06 p42; Midterm Q28]
- sub / lw critical path -> 980 ps / 1300 ps; cycle >= 1300 ps (derived, no key) [T05 Q2]
- R06 p41 graph -> 5+4+8+6 = 23 [R06 p41]
- Memory 2, ALU/adder 2, RF 1 ns -> ALU 6, lw 8, sw 7, beq 5 ns; CT 8 ns [L12 p36; L20 p31]
- addi $s1,$t1,12, $t1=8, MemtoReg stuck 1, Mem 0:57, 4:-43, 8:100, 12:3, 16:98, 20:62, 24:-31 -> ALU 20, $s1 = 62 if memory outputs Mem[20] (no key) [AY15/16 Q9b]
- ALUSrc stuck 0, lw $t1,0($t0), $t0=12, $t1=34 -> address 46 instead of 12 [AY17/18 Q4c]
- R05 exercise fragments -> 0x11200004 = beq $9,$0,4; addu $8,$24,$5 (rest image-only) [R05 p39-48]

## Pipeline (pipelined datapath, hazards RAW/WAR/WAW, forwarding, branches, timing)

L20-L21 plus R11: cycle grids that count stalls the way the keys do, why only RAW and control stall, forwarding, branch strategies, timing comparisons. The (a)-(e) pipeline template recurs every paper.

### [1] Pipelined datapath cycle viewer
Up to ~5 instructions with PC and values; next/prev cycle; bug mode drops the write-register number. L20 p29 datapath, each instruction coloured stage to stage; per-cycle contents of IF/ID (instruction, PC+4), ID/EX (RD1, RD2, imm, PC+4, rt/rd, EX/M/WB bits), EX/MEM (target, ALU result, isZero, RD2, write reg, M/WB), MEM/WB (ALU, mem data, write reg, WB); control bits fall off as used; bug mode writes into the register named by the instruction in ID (L20 p22-23). Control in ID, grouped EX (RegDst, ALUSrc, ALUop), MEM (MemRead, MemWrite, Branch), WB (MemToReg, RegWrite) (L20 p27-28); PCSrc in MEM (L21 p30).
- Aha: A pipeline register holds whatever the same instruction needs later; the destination number must travel, and nothing follows WB.
- Sources: L20 p12-29; T10 Q1 (Ans p3-11); T10 Helper Datapaths p2; R11 p3-4

### [1] Pipeline timing chart and hazard simulator
MIPS (subset + addi/andi/srl/slt/slti/bne/j), '# I5' tags kept as row names, or presets for every paper. Toggles: forwarding; branch decided in MEM or ID; handling stall / predict-not-taken / delayed (1 slot) / predict-taken (extension); j resolves in ID (papers) or MEM (T10); outcomes from the linked MIPS stepper or by hand; scope first iteration / full run / until last stage of instruction X; answer as total, additional, stall cycles, or nop count and placement. Grid in F D E M W and IM Reg ALU DM Reg notation, register file split-shaded; bubbles coloured by cause (RAW, load-use, control) with reason chips; flushed instructions crossed out; forwarding arrows EX/MEM->EX, MEM/WB->EX, ALU->ID, MEM->ID; per-instruction delay column for settings (b)/(c)/(d) side by side (AY23/24 S2 key layout); ideal = I+4, extra, total, stall events vs cycles. What-if edits one instruction (part e); reorder mode reports cycles saved. Rules: register file write-first-half, read-second-half, so without forwarding adjacent RAW = 2 stalls, distance 2 = 1 (L21 p11, p22); forwarding ALU->ALU 0, load-use 1 (L21 p18-20); branch at MEM +3 (L21 p30-32); ID +1 (p36), +1 more if operand from previous ALU instr (p38), 3 total after lw (p39); predict-not-taken +1 only when taken (p40-45); delay slot 1 with early branch (p46); WAR/WAW never stall (p14); count to WB of the named instruction. Forwarding-unit details 'not tested' (R11 p14); predict-taken, hazard unit and forwarding-mux selects behind 'off-syllabus' label.
- Aha: Each stall is the gap between when a value is produced and when it is needed. Without forwarding it is 2, not 3, thanks to the split-cycle register file; lw still costs 1 with forwarding.
- Sources: L20 p32; L21 p5-48; T10 Q2-3 + Additional Question p3-12; R11 p5-49; R11 Addendum p2-8; AY24/25 Q19; AY25/26 Q19; AY23/24 S2 Q17; AY23/24 S1 Q16; AY21/22 S1 Q15; AY21/22 S2 Q16; AY20/21 Q16; AY19/20 Q7; AY18/19 Q7; AY17/18 Q6; AY15/16 Q11c-d

### [1] Dependency lens: RAW / WAR / WAW / control / structural
Snippet or the loaded program; click a pair or scan all. Register-use matrix with W/R badges and arcs: RAW solid red (true dependency, stall or forward, with distance and penalty with/without forwarding linked to the simulator), WAR amber dashed, WAW violet dashed, control arcs from branches; structural shown absent (split memories). Each WAR/WAW arc has an animated proof: reads in ID (stage 2), writes in WB (stage 5), in program order, so a later write cannot overtake. Out-of-order mode (beyond-course, labelled) lets the user drag a WB earlier or give one instruction long latency and watch a register end wrong. Constraints panel: WAR/WAW still forbid swapping those two instructions. Callout pairs lecture view with exam key wording.
- Aha: WAR and WAW are name clashes: harmless for stalls in-order, but they still constrain reordering.
- Sources: L21 p12-14, p19, p27, p47; R11 p8-9; AY25/26 Q4; AY24/25 Q12, Q19(e); AY23/24 S1 Q5, Q12; R11 quiz Q6; guides/Past Finals 4

### [1] Branch strategy lab
Code with branches or presets (L21 Ex3, T10 Q3, T10 Additional, R11 Q7/Q8); strategy selector; outcome per dynamic instance. Same program as stacked mini-grids per strategy: penalty cycles, flushed fetches, extra stalls when the branch operand is just produced (ALU->ID +1; lw->ID +2); running scoreboard and mechanism chips ('decision in MEM: too late'). Early branch: comparator and target adder moved to ID (L21 p34-35); predict-not-taken is the only scheme taught (p40), predict-taken tagged extension (R11 Q7); delay slot always executes (p46-48).
- Aha: Early branching saves 2 cycles but makes the branch hungry for operands; after a lw it is back to 3.
- Sources: L21 p27-48; R11 p21-38, p45-46; T10 Q3 (Ans p21-22); T10 Additional (a)-(e); AY23/24 S1 Q5, Q16; AY23/24 S2 Q17; AY19/20 Q7f

### [1] Loop ideal-cycle counter
Loop code or quick fields: counter init (hex/dec), step, body length, instructions before/after, exit test, N stages. Iterations from the branch condition, I = pre + iterations x body + post, ideal = I + N - 1; warns when the counter never hits the exit value and that 'bne $s0, 0' is a pseudo-instruction the keys count as one. 'Assume registers initialised to 0' (AY25/26 Q2).
- Aha: 'Ideal' ignores hazards, so only the dynamic count matters; 0x32 is 50, not 32.
- Sources: L20 p32; L21 p43; R11 p5, p40; AY24/25 Q13; AY25/26 Q2; AY23/24 S2 Q17a; AY23/24 S1 Q1, Q4; AY20/21 Q5

### [1] Implementation timing comparator (single vs multi vs pipelined, CPI mix, laundry)
Stage times T1..TN, instruction count or mix with stages used per class, average CPI, Td, clock. Three aligned timelines (L20 p30 style) with single-cycle waste shaded; formulas filled step by step: CTseq = max instr sum; Timeseq = I x CTseq; CTmulti = max Tk; Timemulti = I x CPI x CTmulti (or sum of stages used, j only fetch+decode as AY23/24 S1); CTpipe = max Tk + Td; cycles I+N-1; speedup; ideal toggle shows speedup -> N; weighted CPI; per-instruction latency bars (lw 8 vs sw 7). Laundry warm-up with slow-dryer and dependency sliders. Multi-cycle not covered in detail (L12 p37).
- Aha: Pipelining shortens the workload, not one task; the slowest stage sets the beat; multi-cycle can be slower than single-cycle.
- Sources: L20 p6-11, p30-34; L12 p35-38; R11 p5, p40; AY15/16 Q3, Q5; AY23/24 S1 Q1-4, Q11; AY23/24 S2 Q8

### [1] Past-paper pipeline (a)-(e) template runner
Paper preset or pasted code; student answers (a) stall cycles without forwarding, (b) total without, (c) total with, (d) nops and where, (e) total after the stated one-instruction change. Per part: student vs computed with the grid and stall reasons; stall events and stall cycles reported separately to match each key's wording; nop placement printed as code.
- Aha: Same five questions on different code every year; read one grid, answer all five.
- Sources: AY24/25 Q19 + key; AY25/26 Q19 + key; R11 Addendum p3-8; R11 p47-49; guides/Past Finals 2; AY18/19-AY21/22 templates

### [2] Forwarding lens with forwarding-unit rule tracer
Short sequence with values; cycle slider. Rows 'value of $2 in the register file / EX/MEM / MEM/WB' per cycle (L21 p16-18) with arrows from the fresh value to the consumer's ALU input. Expandable panel evaluates EX/MEM.Rd = ID/EX.Rs/Rt, MEM/WB.Rd = ID/EX.Rs/Rt, RegWrite = 1, Rd != $0, EX hazard wins; load-use detector HAZARD = 1 then NOP (T10 Ans p16). Forward to EX only (R11 p14); rule detail 'not tested in exam' (R11 p14-20).
- Aha: The value exists 1-2 cycles before the register file has it; when two producers match, the newer one wins.
- Sources: L21 p15-18; R11 p11-20; T10 Q2 (Ans p13-19); T10 Helper Datapaths p3

### [2] Delay-slot filler and reordering sandbox
Drag an instruction into the delay slot or a new position. Legality check lists any RAW, WAR, WAW violated, whether it affects the branch condition or runs on only one path; if legal, recomputes cycles with a before/after grid; per candidate shows control independence and cycles saved under the chosen settings. Nop if nothing fits (L21 p48).
- Aha: Here WAR and WAW finally matter: no stalls, but they decide which moves are legal.
- Sources: L21 p46-48; R11 p36-38; AY23/24 S1 Q12; T10 Additional (c) p7-9; AY18/19 Q7e; AY19/20 Q7e; AY20/21 Q16e; AY21/22 S1 Q15e; AY21/22 S2 Q16e

### [2] Structural hazards and split-cycle register file demo
Toggles single vs separate I/D memory and split-cycle register file on/off; 4-instruction sequence. Load MEM vs Inst3 IF collide in CC4 -> 1 bubble (L21 p7-8) or none with split memories (p9); WB and ID sharing the register file resolved by half-cycles (p10-11); turning split-cycle off grows no-forwarding RAW from 2 to 3. Three hazard types structural, data, control (L21 p5).
- Aha: The '2 stalls, not 3' rule comes from the register file half-cycle trick, not forwarding.
- Sources: L21 p5-11; R11 p7-8; AY23/24 S2 Q8D, Q12; AY24/25 Q12

Callouts:
- WAR and WAW do not stall the in-order 5-stage pipe; only RAW does; they matter for out-of-order. Exam keys may still call WAW a 'WAW hazard': AY25/26 Q4 key E (L21 p14; R11 p9; AY25/26 Q4)
- Without forwarding: adjacent RAW 2 stalls, distance 2 one, distance 3 none (L21 p10-11, p22); the AY23/24 S2 key notes students miss the +1 for i6
- Forwarding does not remove load-use: 1 bubble (L21 p19-20; AY24/25 Q19c)
- Early branch is not always 1 cycle: +1 after an ALU producer, 3 total after lw (L21 p37-39; R11 p28-30; T10 Ans p21-22; AY23/24 S1 Q5C)
- 'No branch handling' is not predict-not-taken: wrong-path instructions execute vs get flushed (L21 p31 vs p40-42; AY23/24 S1 Q5 key D)
- Branch decided in MEM in the basic pipe (comparison in EX, PCSrc acts in MEM); a student cheat sheet says 'not known till EX' (L21 p30-32; Lab Tutor Cheatsheet p3)
- Pipelining improves throughput, not one instruction's latency (L20 p11; AY23/24 S1 Q11 key A)
- Single-cycle CT = slowest instruction; pipelined cycles = I + N - 1 (keep the -1), CT = max stage + Td (L20 p31-32)
- Multi-cycle is not automatically faster (920 vs 800 ns); speedup N needs equal stages, Td = 0, I >> N (L20 p31-33)
- Ideal I + N - 1 uses the dynamic count, loop iterations multiplied out (AY25/26 Ans p3; AY24/25 Ans p17)
- Write-register number must travel to MEM/WB; no register after WB (L20 p16, p22-24)
- Delay-slot instruction always executes; must not affect the branch; else nop (L21 p46-48; AY23/24 S1 Q12 key D)
- Stall wording differs by key: AY24/25 '2 stalls of 2 cycles', AY25/26 '5 stalls of 1 cycle'; always state cycles
- Counting 'until the last stage of i20' excludes the stall after the final j (AY23/24 S2 Ans p16-17)
- Predict-taken is not taught ('we only cover the simplest') yet R11 Q7 uses it (9 cycles) (L21 p40; R11 p45)
- Forwarding-unit equations and hazard-detection signals are 'not tested', but T10 Q2 asks which rule fired; AY23/24 S1 Q19 signals look off-syllabus (R11 p14-20; guides/Past Finals 3a)
- Pseudo 'bne $s0, 0, Loop' is counted as one instruction in the keys (AY24/25 Q13; AY25/26 Q2)

Fixtures:
- 100 instr; stages 2,1,2,2,1 ns; CPI 4.6; Td 0.5 -> single 800 ns; multi 920 ns; pipelined (100+5-1) x 2.5 = 260 ns [L20 p31-32]
- add, sub, sll, srl; 100 MHz single; 500 MHz 5-stage -> 40 ns; 8 cycles = 16 ns [L20 p34]
- Stages 2,3,4,5,2 ns; 20 instr -> 320 ns vs 120 ns; speedup 2.67 (derived) [AY15/16 Q5]
- 5000 instr, 2 GHz, CPI 3/5/4/6 at 40/20/20/20% -> CPI 4.2, 10.5 us (computed) [AY15/16 Q3]
- 72 dynamic instr; 500 MHz single; stages 0.1/0.2/0.2/0.4/0.2 ns; Td 0.05 -> 144 ns (B); 2.5 GHz (C); ~105.2 ns multi with skipping (C); (72+4) x 0.45 = 34.2 ns (D) [AY23/24 S1 Q1-4 key]
- Laundry 4 loads x 4 x 30 min -> sequential 8 h; pipelined 3.5 h; 60-min dryer 5.5 h; Brian dependency 4 h [L20 p7-10]
- addi $s0,$0,0x10; Loop: addi -2; sub; bne; add -> 8 iterations, I = 26, 30 cycles [AY24/25 Q13 key]
- addi $s0,$0,0x32; Loop: addi -5; sub; bne; add -> 10 iterations, I = 32, 36 cycles [AY25/26 Q2 key]
- 10 instr on 5 stages; on 6 stages -> 14; 15 cycles [R11 p5, p40]
- sub $2; and $12,$2; or $13,$6,$2; add $14,$2,$2; sw $15,100($2) -> 11 without forwarding, 9 with [L21 p21-23]
- Same with lw $2,20($3) first -> 11 without, 10 with (1 bubble) [L21 p24-26]
- $2 = 10, sub gives -20 -> EX/MEM -20 in CC4, MEM/WB -20 in CC5, register file -20 from CC5 [L21 p16-18]
- lw $2,20($1); and; or; add; slt $1,$6,$7 -> 1 bubble, 10 cycles (derived); WAR on $1 costs nothing [L21 p19-20]
- addi $s0,$0,10; Loop: addi -1; bne; sub, forwarding, ID -> I = 22, ideal 26; no prediction 46; predict-not-taken 45 [L21 p43-45]
- sub $1,$2,$3 @0xFF8; lw $6,4($7) @0xFFC; beq $4,$5,L2 @0x1000, L2 = 0x100 -> 0x00430822, 0x8CE60004, 0x1085FC3F (imm -961); target 0x1004 - 0xF04 = 0x100 [T10 Q1; Ans p5-10]
- add $1,$2,$3; lw $1,0($1); add $1,$1,$1; add $3,$2,$1 -> EX hazard into lw rs; load-use 1 nop; MEM/WB to both operands; EX/MEM to rt of add $3; 9 cycles (derived); hex 0x00430820, 0x8C210000, 0x00210820, 0x00411820 [T10 Q2; Ans p13-19]
- add; lw $1,0($1); beq $1,$0,L; add (forwarding, ID) -> 2 bubbles between lw and beq; ~10 not taken, ~11 taken (derived; grids are images) [T10 Q3]
- T10 Additional $s0=0xAFAFFAFA, $s1=0xFF -> (a) 20; (b) 14; (c) swap A and B; (d) 2+4x18+9 = 83; (e) 2+4x12+6 = 56 (j in MEM) [T10 Additional p5-12]
- AY24/25 Q19 Inst1-7 -> (a) 4 stall cycles (2+2); (b) 15; (c) 12; (d) 1 nop after Inst2; (e) Inst5 -> sub $s5,$t1,$t2: 12. Dependencies Inst2->Inst3 WAR $s5, Inst3->Inst4 WAW $s5, (e) adds WAW [AY24/25 key; R11 Addendum p3-4]
- AY25/26 Q19 Inst1-9 -> (a) 5 (1+2+2); (b) 18; (c) 13; (d) 0; (e) Inst8 -> sub $s5,$t2,$s3: 14 [AY25/26 key; R11 Addendum p5-8]
- R11 Q6 lw $t2; lw $t1,100($t6); sub $t6; add $t6; and $t3; sw $t6 -> 16 without forwarding, 11 with; B->C WAR $t6, C->D WAW $t6 [R11 p44]
- lw $s2,0($s1); bne $s2,$s3,L1; sub; L1: add (taken) -> predict-taken + ID 9; predict-not-taken + MEM 11 [R11 p45-46]
- AY23/24 S1 Q16 loop, 2 iterations -> base register 8; (b) 40; (c) 29; (d) 27 (ideal 20) [AY23/24 S1 key]
- AY23/24 S2 Q17 i1-i20, first iteration, j in ID -> ideal 24; (b) +17 [i6+1, i7+2, i8+3, i9+2, i10+2, i11+3, i13+2, i14+2]; (c) +7 [i8+3, i11+3, i13+1]; (d) +3 [i7+1, i10+1, i13+1] [AY23/24 S2 Ans p16-17]
- addi $s0,$0,0x500; addi $s1,$t0,-2; addi $t2,$t1,0x10; add $t2,$s2,$s3 -> WAW on $t2, key E, no stall [AY25/26 Q4]
- AY23/24 S1 Q12 delay slot -> I5 add $3,$3,$4 (D); I6 cannot (bne needs $5) [AY23/24 S1 key]
- L21 p47 delay slot -> or $8,$9,$10 moves after beq $1,$4 (WAR order kept) [L21 p47]
- AY21/22 S1 Q15 I1-I18, A[0]>B[0], j in ID -> (a) 21; (b) +15; (c) +8; (d) +4 (computed) [AY21/22 S1 p12]
- AY21/22 S2 Q16 I1-I19, all A<B -> (a) 23; (b) +16; (c) +7; (d) +3 (computed) [AY21/22 S2 p10]
- AY20/21 Q16 I1-I16, A[0] odd -> (a) 20; (b) no fwd + MEM +24; (c) no fwd + ID +20; (d) fwd + ID + PNT +4 (computed) [AY20/21 p11]
- Hazard-type MCQs -> three types structural, data, control; AY24/25 Q12 key A [L21 p5; AY23/24 S2 Q12; AY24/25 Q12]

## Cache (DM/SA/FA, replacement, write policies, miss types, locality, AMAT/miss penalty)

L22-L23, R12, T11: address splits, trace stepping with check mode, miss classification, write-policy traffic, array thrashing, I-cache loops, pipeline miss timing. Every paper has a cache trace and a tag-bits MCQ.

### [1] Address splitter, field-width solver and storage-bit panel
Address width (default 32; 28 and 34 for R12), word size (default 4; T11 uses 2), block size, cache size (B/words/blocks), ways (1..FA), write-back toggle; optional address. Inverse mode solves the rest from any consistent subset (R12 p41). Chain: offset = log2 block bytes; #blocks; #sets = blocks/ways; index; tag = width - offset - index; 32-bit ruler in exam wording (31..13 | 12..4 | 3..0); for an address: block number = addr >> N, index = block mod #sets, tag = block / #sets, byte offset, word-in-block (mux select Addr[3:2], L22 p30). Associativity slider moves one bit index -> tag per doubling to FA. Storage panel: per-line V | D | Tag | data, totals, tag bits per set. Drill generates random configs. Bit 0 = LSB (AY23/24 S1 Q15).
- Aha: Index and tag are cut from the block number, not the byte address; each doubling of ways hands one index bit to the tag.
- Sources: L22 p22-30, p68; L23 p11-12, p17, p26-27; R12 p7, p15, p17, p40-42, p47; T11 Q1; AY25/26 Q9; AY24/25 Q14; AY23/24 S1 Q15; AY15/16 Q4; AY16/17 Q6d-e; Finals Notes (bits in cache)

### [1] Cache trace stepper with check-my-answer
Config + accesses (dec/hex, optional R/W, data labels like L22 p55 letters or M[addr]), from a manual list, the array generator, or the MIPS stepper's streams; LRU default; free-way fill lowest-first (L23 p18, p21); tag display dec/hex/bin incl. 0x%08x. Each access in four sub-steps (check index/set, Valid then tag compare, load 2^N bytes with victim, return word); per access the binary address split, block, set, H/M, miss type, LRU stack, V/D bits; running 'M H M H...' string; live table Index | Valid | Tag | Word0 | Word1 (SA: Set | Block0 | Block1); back/forward, jump, autoplay, final view; 'sort ways by address' so Way 0 holds lower addresses (AY23/24 S1 Q20b). Check mode: user types H/M + miss type per access and the final table; diff per cell. T11 asks 'Index | Tag value | Word 0 | Word 1' with M[i], i a byte address.
- Aha: The tag tells apart the blocks sharing a line; the whole block comes in, so the neighbour hits next; repeating an evicted address misses.
- Sources: L22 p28, p31-62; L23 p17-22, p32-34; R12 p8, p30; T11 Q1(a)(b); AY23/24 S1 Q20; past-finals cache inventories

### [1] Why did you miss? (miss classifier and 3C ledger)
Any trace; toggle 'course label (R12 p21-25)' vs '3C accounting (L23 p28)'. Decision tree per miss: first-ever access = compulsory even if the line held another valid block; DM/SA evicted by same-set block = conflict (empty lines elsewhere highlighted); FA evicted because full = capacity. 3C ledger runs a shadow FA-LRU of equal size: capacity = FA total - FA cold, conflict = rest. Stacked cold/conflict/capacity bars per organisation. Terms: compulsory = cold, conflict = collision = interference (L22 p53).
- Aha: Valid-but-tag-mismatch can still be cold; conflict misses happen with an empty cache; nothing changes the cold count.
- Sources: L22 p45, p49, p53; L23 p4, p23, p27-28; R12 p20-25, p38; AY23/24 S1 Q13; AY25/26 Q5 (R12 p46)

### [1] Same trace, four caches (organisation comparator)
One trace; total and block size fixed while ways go 1, 2, 4, FA (8-block layouts as L23 p35); LRU. Synced columns with H/M per organisation per access; misses by type; L23 p28 observations 1-5 light up when demonstrated; sandbox for the rule of thumb DM size N ~ 2-way size N/2 on generated workloads.
- Aha: More ways remove conflict misses only; at L23 p34 2-way = DM = 7 misses.
- Sources: L23 p14-16, p28, p32-37; R12 p26, p35-38; T11 Q1(c)(d); AY25/26 Q5

### [1] Write policy lab (WT/buffer vs WB/dirty, allocate vs around)
Config + R/W trace with store values; write-hit policy (write-through, WT + buffer, write-back); write-miss policy (allocate, around/no-allocate); optional buffer depth, drain rate, latency (extension, labelled). Four synced panes for the 2x2 combinations, or one pane with animated CPU -> cache -> buffer -> DRAM lanes; lines show V, D, Tag, words; memory shadow column turns stale words red (L22 p65); counters: block fetches, word writes, block write-backs, words moved, CPU write stalls; dirty bit set on write, write-back only if 1; write-around means the next read misses. Shows final state under 'sw allocates' and 'sw ignored' (both accepted in AY23/24 S1). Make the user pick both policies; slides fix no pairing.
- Aha: Write-back turns many stores to one block into one block write at eviction; write-through runs every store at memory speed, hence the buffer.
- Sources: L22 p63-70; L23 p37; R12 p31-33; AY16/17 Q6d-e; AY23/24 S1 Q20 key; AY23/24 S2 Q18; AY19/20 Q8; AY20/21 Q15

### [1] Array / loop access generator with thrash detector
Arrays (name, base or 'follows X', element size, length); loop template touching A[i], B[i], C[k], B[2i], descending index, optional condition ((i&3)>>1 == 0), op per access; 'sw uses cache?' toggle; 2D/unrolled expressions (A+16i+4k). Coloured address stream; mapping strip of each array's blocks; distance between arrays mod cache size and clashing pairs (A[925] vs C[463]); per-array hits, misses, exact-fraction hit rate; thrash warning when bases differ by a multiple of cache bytes; n slider (3200/3216/3210); per-set occupancy shows 3 hot blocks in a 2-way set. Address(A[i]) = base + i x size; 'B starts right after A'. Keys accept small ranges.
- Aha: Back-to-back arrays whose size is a multiple of the cache collide every time (0%); grow by one block and it jumps to 3/4.
- Sources: guides/Past Finals 2-3b; AY15/16 Q12; AY17/18 Q7; AY18/19 Q6; AY19/20 Q8; AY20/21 Q15; AY21/22 S1 Q16; AY21/22 S2 Q17; AY23/24 S1 Q20; AY23/24 S2 Q18d-g; Finals Notes thrashing

### [1] Pipeline x cache miss timer (word-at-a-time memory)
Block size, word size, cycles per word, '+1 restart in penalty' toggle, hit time, hit ratio, data-access fraction, instruction count, instruction type, plus cache size/ways shown but greyed. IF ID EX MEM WB strip with MEM stretching on a miss; formulas penalty = words x per-word (+1); lw hit 5; lw miss 4 + penalty (restart included) or 5 + transfer; lost cycles = instr x data fraction x miss rate x penalty; AMAT; beq stays 5. True/False cards for 'faster CPU' and 'more associativity'. Random clone generator for this template.
- Aha: Cache size and '4-way' are red herrings: only block size and transfer speed set the penalty.
- Sources: R12 p44-48; AY24/25 Q20; AY25/26 Q20; L22 p20; guides/Past Finals 3b

### [2] Instruction-cache loop tracer
I1 address, instruction list or count, loop label, branch targets, per-iteration condition pattern, iteration count, exit path; cache typically 16 words, 2-way LRU, 2- or 4-word blocks. Listing shaded by block and set; PC stream; set animation; misses in iteration 1, 2, steady state; totals. Paper assumptions configurable (count from I1 or loop only; init code pollutes).
- Aha: After warm-up, a loop that fits its sets has zero misses; shifting I1 one word moves block boundaries.
- Sources: L23 p39; L22 p17; guides/Past Finals 3b; AY23/24 S2 Q18a-c; AY17/18 Q7e; AY18/19 Q6d-f; AY19/20 Q8g-i; AY20/21 Q15e-g; AY21/22 S1 Q16e-f; AY21/22 S2 Q17a-b

### [2] Average access time / required hit-rate solver
Any three of hit rate, hit time, miss penalty (or raw memory time), AMAT; toggle 'memory time given without hit time' (10 + 0.8). Equation solved line by line (L22 p21 style); hit-rate slider with live AMAT curve; identity h.t + (1-h)(t+M) = t + (1-h)M side by side. Penalty includes hit time (L22 p20).
- Aha: 98% hits just to stay within 25% of SRAM speed.
- Sources: L22 p20-21; L23 p5, p38; AY16/17 Q6a-c

### [2] Replacement policy race (LRU / FIFO / Random / LFU)
Set size, block sequence or trace, policy (Random seeded, LFU tie-break selectable). Per set: LRU recency stack that reorders on hits, FIFO queue that does not, LFU counters, dice for Random; victim highlighted; hit counts side by side. Only LRU is examined; others named only (L23 p31); DM has no choice (L23 p37).
- Aha: LRU and FIFO differ only because a hit refreshes LRU (L23 p30: 3 vs 2 hits).
- Sources: L23 p29-31, p37; R12 p28-29; AY23/24 S1 Q20b; AY23/24 S2 Q18

### [2] Row- vs column-major traversal heatmap
R x C int matrix, base, element size, storage order, traversal (row, column, transpose read-rows/write-columns), cache config. Grid outlined by shared blocks, animated hit/miss colouring, memory strip with stride jumps, live hit rate. Linked to the C array calculator.
- Aha: Only the loop order changes: 75% vs 0% for an 8x8 int matrix; what matters is the address order the code produces (AY19/20 Q8f).
- Sources: R02 p25-26; Extras p6-7; L22 p17; AY19/20 Q8f; AY23/24 S1 Q20

### [2] Block-size trade-off explorer
Workload (sequential, strided, random, small loop, pasted trace), fixed cache size, block sweep 4-256 B, memory model. Three linked plots per L23 p5 (penalty rising, miss rate and AMAT U-shaped) with current point; grid of fewer bigger blocks. L23 p6 curve numbers are lost in text.
- Aha: Bigger blocks help via spatial locality until too few blocks hurt temporal locality.
- Sources: L23 p5-6; L22 p22, p39; R12 p7, p44, p48

### [2] Lookup hardware view
Presets L22 p30, L23 p13, L23 p27. Address bus split into labelled tag/index/offset wires; index selects row/set; N comparators light in parallel, AND with Valid -> Hit; word-select mux on offset bits; comparator count DM 1, N-way N, FA #blocks.
- Aha: Associativity costs comparators, so hit time does not drop (AY25/26 Q5D false).
- Sources: L22 p28, p30; L23 p13, p25, p27; AY25/26 Q5

### [2] Locality labeller
Any trace; each hit badged Spatial (first touch, block brought by a neighbour) or Temporal (same address seen while resident); working-set window (L22 p18). States the rule used, since slides label hits (L22 p39, L23 p19, p22) without defining it.
- Aha: One fetch can produce both kinds of hit later; a miss is never 'due to' locality.
- Sources: L22 p16-18, p39; L23 p19, p22; R12 p4-5; AY23/24 S1 Q14

### [2] Placement explorer with library analogy
Click a memory block; 8-block cache as 1/2/4/8-way. Arrows to every allowed slot with the mod arithmetic and coloured tags; analogy panel: 26 desk spots by first letter (DM), 2 per letter (2-way), any spot (FA). Rules L23 p35-36.
- Aha: DM, SA, FA are one spectrum from 1-way to one set.
- Sources: L22 p14-15, p24-26; L23 p8-10, p24-25, p35-37; AY18/19 Q6b; AY19/20 Q8b, d

### [3] Memory hierarchy and memory wall
CPU clock and DRAM latency sliders; registers, SRAM, DRAM, disk with capacity/latency/cost (L22 p11) scaled to human time; cycles per DRAM access (1 GHz + 50 ns = 50). SRAM 6 transistors 0.5-5 ns, DRAM 1 transistor 50-70 ns (L22 p9); virtual memory out of scope (L22 p19).
- Aha: Caches give the 'big and fast' illusion.
- Sources: L22 p4, p8-13, p19

### [3] Multilevel cache explorer
L1/L2/L3 configs (defaults L23 p39), hit rates and times; per-level address split, hit/miss path, effective access time. Marked 'Exploration'; multilevel CPI formula only in a student sheet.
- Aha: L1 small for hit time; L2/L3 big to cut misses.
- Sources: L23 p38-41; Finals Notes

Callouts:
- Index/tag come from the block number (address >> offset), not the byte address (L22 p25-26; R12 p10-11)
- A first access is always cold, even if the line holds another valid block (L22 p45)
- Conflict misses do not need a full cache (R12 p23)
- N-way set index uses log2(#sets), not #blocks (L23 p11-12)
- FA has no index (tag = block number) and no conflict misses, but has cold and capacity misses (L23 p26-28; AY23/24 S1 Q13 C; AY25/26 Q5C)
- 'DM has no conflict misses' is false (L22 p53; AY25/26 Q5B)
- 'Higher associativity always lowers hit time' is false (L23 p13, p25; AY25/26 Q5D)
- Rule of thumb is DM size N ~ 2-way size N/2, not 4-way N/4 (L23 p16; R12 p26; AY25/26 Q5 key A)
- LRU order updates on hits too (L23 p29-30)
- More associativity does not always mean fewer misses: L23 p34 2-way = DM = 7 (L23 p34)
- Miss penalty includes the hit time: 10.8, not 10 (L22 p20-21)
- Word-at-a-time penalty = (block bytes / 4) transfers; +1 restart only if stated (AY25/26 21; AY24/25 accepts 40 or 41) (R12 p44, p48)
- Cache size, associativity and CPU speed do not change the miss penalty or lost cycles (R12 p44, p48; AY24/25 Q20e; AY25/26 Q20e)
- beq never touches data memory: 5 cycles on a 'miss' (R12 p48; AY25/26 Q20d)
- T11 uses 16-bit words: a 2-word block is 4 bytes, words M[4], M[6] (T11 Q1)
- Write-through/write-back are write-hit policies; allocate/around are write-miss policies; AY23/24 S2 Q18 mixes them (L22 p66-70; L23 p37)
- Write-back writes only dirty blocks (L22 p68)
- Write-through without a buffer runs every store at memory speed (L22 p67)
- Check whether sw counts: lw-only in AY19/20, AY20/21, AY21/22 S2; included in AY18/19, AY17/18, AY23/24; AY23/24 S1 accepted both
- Bigger blocks are not always better (L23 p5-6)
- Cold misses cannot be reduced by size or ways: R12 answers 'Nothing' (L23 p28; R12 p22)
- SA tag = block / #sets (36 -> block 4 -> tag 2 with 2 sets); FA tag = block number (L23 p21, p33-34)
- Answer format: 8-digit hex tags and M[0x....]; when ambiguous Way 0 holds lower addresses (AY23/24 S1 Q20)
- A hit on a neighbouring word is spatial, same word temporal (AY23/24 S1 Q14 key B)
- Virtual memory is out of scope (L22 p19)

Fixtures:
- 0.8 ns cache, 10 ns DRAM, target 1 ns -> penalty 10.8; h = 0.98 [L22 p21]
- 32-bit, 16 KB DM, 16 B blocks -> offset 4, index 10, tag 18; 1024 blocks [L22 p29-30]
- 32 B DM, 8 B blocks -> offset 3, block number 29 bits, 4 blocks, index 2, tag 27 [L22 p54]
- DM 4 x 8 B; loads 4,0,8,12,36,0,4 -> M H M H M M H; cold,-,cold,-,cold,conflict,-; idx0 tag0 M[0],M[4]; idx1 tag0 M[8],M[12]; 36 = tag 1 idx 0 [L22 p55-62]
- 16 KB DM, 16 B; 20, 28, 52, 32792, 16 (from bit strings) -> M(cold) H M(cold) M(cold, tag mismatch) M(conflict); idx1 tag0, idx3 tag0 [L22 p31-51]
- Store X to 24 after that trace -> hit; Word2 of idx1 = X; cache and memory inconsistent [L22 p63-66]
- 4 KB 4-way 4 B blocks -> 1024 blocks, 256 sets, offset 2, index 8, tag 22 [L23 p12-13]
- Blocks 0 4 0 4 0 4 0 4, 4-block cache -> DM 2 cold + 6 conflict; 2-way 2 cold + 6 hits [L23 p14-15]
- 2-way, four 8 B blocks; 4,0,8,36,0 -> M H M M H; 36 to set 0 block 1 tag 2; set0 [tag0 M[0]M[4]], [tag2 M[32]M[36]]; set1 [tag0 M[8]M[12]] [L23 p17-22]
- FA 4 KB 16 B -> offset 4, tag 28, 256 entries [L23 p27]
- 4-way set, blocks 0 4 8 12 4 16 12 0 4, LRU -> M M M M H M H M H: 6 misses 3 hits [L23 p30]
- Same with FIFO -> M M M M H M H M M: 7 misses 2 hits (derived) [L23 p30-31]
- Four 8 B blocks; 4,8,36,48,68,0,32 -> DM 7 misses (idx0 tag1 M[32]M[36], idx1 tag0 M[8]M[12], idx2 tag1 M[48]M[52]); FA-LRU 6 misses + 1 hit (tags 8, 0, 4, 6); 2-way 7 misses; cold 5, 3C capacity 1 [L23 p32-34, p28]
- 4 GB, 32 KB DM, 32 B; 0x12345678 -> offset 5, index 10, tag 17; tag 0x2468, index 691, offset 24 [R12 p40]
- 4-way, 4 KB blocks, 16 GB, tag 10 -> 34-bit address, offset 12, index 12, 4096 sets, 64 MB [R12 p41]
- FA, 256 MB, 16 KB, 256 B -> 28-bit, offset 8, tag 20 [R12 p42]
- 8-way 32 KB 8 B -> offset 3, 512 sets, index 9, tag 20 (D) [AY25/26 Q9; R12 p47]
- 4-way 32 KB 16 B -> offset 4, index 9, tag 19 (C) [AY24/25 Q14]
- 4-way, 2048 blocks, 4-word blocks -> tag 31-13, set 12-4, offset 3-0 (D) [AY23/24 S1 Q15]
- 4-way 8192 B 4-word blocks -> set 7, offset 4 (D, computed) [AY15/16 Q4]
- 16 B blocks: 0x804ab0 M, ab4 H, ab8 H, ab0 H -> (2),(3) spatial, (4) temporal (B) [AY23/24 S1 Q14]
- Miss type impossible in FA -> conflict (C) [AY23/24 S1 Q13]; AY25/26 Q5 -> A; B, C, D false [AY25/26 Q5]
- 16 B blocks, 10 cycles/word, hit 1, 95%, 32% data, 100 instr -> penalty 40 (41); lw hit 5; miss 45 (46); lost 64 (66); total 95/96 accepted; (e) False [AY24/25 Q20; R12 p44-45]
- 16 B, 5 cycles/word, restart counted, 90% -> penalty 21; lw hit 5; miss 25; beq 5; (e) False [AY25/26 Q20; R12 p48]
- T11 DM 16-bit words, 4 B blocks, 16 blocks; 4,92,7,146,30,95,176,93,145,264,6 -> M M H M M M M H H M H: 7 misses (6 cold, 1 conflict); idx1 tag0 M[4]M[6]; idx2 tag4 M[264]M[266]; idx4 tag2 M[144]M[146]; idx7 tag1 M[92]M[94]; idx12 tag2 M[176]M[178] (simulated, no key) [T11 Q1a-b]
- T11 2-way, 8 sets -> M M H M M H M H H M H: 6 cold, 5 hits; no evictions (simulated) [T11 Q1c]
- T11 FA 16 blocks -> 6 cold, 5 hits, 0 capacity; tags 1, 23, 36, 7, 44, 66 (simulated) [T11 Q1d]
- 4x4 transpose, A=0x1000, B=0xa010, DM 4 x 2 words, lw+sw -> idx0 0x00000081 M[0x1020]M[0x1024]; idx1 0x00000502 M[0xa048]M[0xa04c]; idx2 0x00000081 M[0x1030]M[0x1034]; idx3 0x00000081 M[0x1038]M[0x103c]; sw-ignored idx1 0x00000081 M[0x1028]M[0x102c]; 6/32 hits (lw-only 8/16) [AY23/24 S1 Q20a]
- Same, 2-way 2 sets -> set0 W0 0x00000102 M[0x1020]M[0x1024], W1 0x00000103 M[0x1030]M[0x1034]; set1 W0 0x00000103 M[0x1038]M[0x103c], W1 0x00000a04 M[0xa048]M[0xa04c] [AY23/24 S1 Q20b]
- 2-way LRU I$ 16 words, I1 0x00400050, 1000 iter -> 2-word blocks '2,3', 10 misses; 4-word blocks 5 misses (key says offset 3 and set 0, wrong; 4 and set 1) [AY23/24 S2 Q18a-c]
- DM 512 words, 4-word blocks, A=0xFFFF0000, B, C contiguous -> '7,4'; n=1000 A hits 248 (250 ok), B base 0xFFFF0FA0 idx 122, C 0xFFFF1F40 idx 116; n=768 A 191 (192), B 190 (192) [AY23/24 S2 Q18d-g]
- DM 128 words, 4-word blocks, lw only, A=0xFF000C00 -> '5,4'; n=3200: 0, 0; 3216: 3/4, 3/4; 3210: 2407/3210 each; I-cache '2,3'; I1 at 0x10000C50: 1396 hits of 1404; at 0x10000C54: 1395 (computed) [AY20/21 Q15]
- 64-word, 4-word blocks, A=0x0040CCC0, B=0x2C0 -> '4,4'; A[0] block 12, B[60] block 11; DM 0 and 0; 2-way A[0] set 4, B[60] set 3, 3/4 and 3/4; column-major same (computed) [AY19/20 Q8]
- DM 8 x 4 words; A=0x80, B=0xFFFF0040, C=0x12345688; 32 iter -> 5/12 (40/96); final 0: C[30..33], 1-3: B[20..31], 4-7: A[16..31] (simulated) [AY15/16 Q12]
- Cache 5 ns, memory 80 ns, 10,000 accesses in 70 us; 4-way WB 64 KB 8-word blocks -> hit 5, miss 85 ns, miss rate 2.5%; offset 5, 512 sets, index 9, tag 18, 72 tag bits per set; 2048 x (256+18+1+1) = 565,248 bits (derived) [AY16/17 Q6]
- AY21/22 S1 Q16 DM 512 words, 8-word blocks, A=0xCDEF0400 -> '6,5'; 1032: 7/8, 7/8; 1028: 96/257 each; A rate 0 when N multiple of 512; I-cache 4-word '1,4', 6 misses; 2-word 10 (computed)
- AY21/22 S2 Q17 I$ I1 0x4488FFFC; D$ DM 1024 words, 16-word blocks, A=0xFFFF0000, B[2i] -> 2-word '2,3', 10 misses; 4-word 304 (3 blocks thrash set 0); D '6,6'; N=512 A 473, B 441; N=1024 A 945, B 882 (computed)
- AY17/18 Q7 DM 128 words, 4-word blocks, A=0x10001000, B=0x1003F100 -> '5,4'; A[1023] idx 31, B[1023] idx 15; A 1024 accesses, B 512; 3/4 and 1/2; I-cache 9 misses, 6138 hits (computed)
- AY18/19 Q6 2-way 64 words, 4-word blocks, A=0x80, B=0x00100000, C=0x00108040 -> set 3 bits, offset 4; A[0] set 0, B[60] set 7, C[1032] set 6 (computed)
- DM 4 x 8 B; W0 W4 W0 W4 R32 R0 -> WT+alloc M H H H M M, 3 reads, 4 word writes; WB+alloc same, 0 word writes, 1 write-back; +around all 6 miss, 2 reads, 4 word writes (constructed)
- DM 4 x 8 B; W4 R0 W8 W12 R36 W0 R4 -> WT+alloc M H M H M M H, 4 reads, 4 writes; WB+alloc 1 write-back (block 0 at R36), blocks 0, 1 dirty at end; +around all miss, 3 reads, 4 writes (constructed)
- 8x8 int row-major, 4 x 16 B -> row-wise 48/64; column-wise 0/64 for DM, 2-way, FA; 16-block cache column-wise 48/64 (constructed)
- L1 32 KB 32 B 4-way; L2 256 KB 128 B 8-way; L3 4 MB 256 B DM -> L1 5/8/19; L2 7/8/17; L3 8/14/10 (offset/index/tag, derived) [L23 p39]

## Logic: Boolean & K-maps

L13-L16, T06, R07: canonical forms, laws, K-map PI/EPI with all minimal covers, POS, don't cares, gate circuits and universal gates. K-map PI/EPI/SOP/POS appears in every paper.

### [1] K-map Studio: step-through minimal SOP solver
2-5 variables with custom names; Σm + d, ΠM . D, truth table, expression, or click cells 0/1/X. Step 1 fill (faint m-index); step 2 each PI as a coloured loop with wrap/corner split loops and term derivation (literals = n - log2 size); step 3 count PIs per 1-cell, 'reason cell' glow marks EPIs; DC-only groups greyed 'not a PI'; step 4 grey EPI-covered 1s, enumerate minimum PI subsets; all alternative minimal SOPs with count, in course notation. Layout rows AB, cols CD in 00 01 11 10; row 00 = m0 m1 m3 m2 (L15 p19); 3-var row a, cols bc (L15 p16); first variable is MSB (L13 p21). Algorithm all PIs, EPIs, minimum rest (L15 p38). FITB output: alphabetical literals, EPIs first, ' . +.
- Aha: A PI cannot grow; an EPI is a PI some 1 depends on; a big PI can still be redundant (L15 p42).
- Sources: L15 p12-55; R07 p31-47; T06 SE3, Q2-3; AY25/26 Q1, Q17a; AY24/25 Q3-4, Q17a; AY23/24 S2 Q19; AY23/24 S1 Q7, Q17a-b; AY21/22 S1 Q5; AY21/22 S2 Q5, Q14c; AY20/21 Q1-2

### [1] Umbrella view / PI cover chart
Same function or 'explain EPIs'. PI rows x minterm columns (don't-care columns greyed separately, T06 Ans p5); single-dot columns light and their row becomes EPI; reduced chart after removing EPIs; linked K-map shows each PI as an umbrella, hovering a 1 lights all umbrellas over it; implicant ladder all implicants -> PIs -> EPIs (R07 p37: 11 implicants, 2 PIs). Q-M is non-examinable: label as mechanism.
- Aha: Essential is a property of a minterm column; consensus term B.C is the redundant umbrella (R07 p36).
- Sources: R07 p35-41; L15 p34-37; L16 p7-8, p12-13; T06 Ans p5

### [1] K-map answer checker
Function + claimed #PIs, #EPIs, number of minimal SOPs, SOP/POS text. Equivalence on the care set with differing rows; per term implicant? prime?; minimality (terms, literals vs optimum); wrong counts with missed/extra PIs; syntax via the shared FITB linter (missing ., literal order, EPIs first, DC-only term, POS shape). Constants 0/1 valid (T06 p2).
- Aha: An equivalent expression can still lose marks if not minimal or badly written.
- Sources: T06 p2, Ans p1; AY23/24 S2 Q19d; AY24/25 Q17; AY25/26 Q17; L15 p34-38

### [1] POS via the F' map
Any function incl. don't cares. Animates swapping 1s and 0s (X stays X), solves F' with the same stepper, DeMorgan per term ((B.D')' = B'+D), all alternative POS; option to read POS directly off 0-groups with polarity explained. Sum terms in parentheses (L15 p44).
- Aha: POS is SOP of the complement flipped back.
- Sources: L15 p43-44, p54-55; R07 p42-43, p47; T06 SE4, Q2d, Q3g; AY24/25 Q17a(iii); AY25/26 Q17a(iii)

### [1] Don't-care fate inspector
Function with d-set and the chosen SOP/POS. Recolours each X with the value the chosen cover gives it; lists outputs for 'impossible' inputs; shows SOP vs POS or alternative covers can differ. X/d/D all mean don't care (L15 p45-46; T06 SE3).
- Aha: Don't cares are free only at design time; the built circuit outputs something definite.
- Sources: T06 Q4d; T07 SE3; L15 p45-49; R07 p44-45

### [1] Truth-table equivalence prover and counterexample finder
Two expressions or expression vs Σm. Column-per-subexpression truth table (L13 p7-8), LHS/RHS side by side, first mismatch row highlighted as counterexample with evaluation traced. NOT > AND > OR (L13 p9).
- Aha: One row disproves; proving needs all 2^n rows or algebra.
- Sources: L13 p7-8, p14; R07 p51; AY20/21 Q6; AY25/26 Q12

### [1] Algebraic simplification step checker with law tags
Chain of expressions, each step citing a law (identity, complement, commutative, associative, both distributive forms, idempotency, one/zero, involution, absorption 1 and 2, DeMorgan, consensus). Per step: truth-table equivalence, does the law's pattern actually match (sub-terms highlighted), literal count; invalid step flagged with counterexample; hint mode suggests absorption 2 / consensus first. Minimise literals, then terms (L15 p4).
- Aha: Most textbook reductions are absorption 2 or consensus in disguise; the T06 SE1 X + X' = 1 misuse is caught as a pattern mismatch.
- Sources: L13 p10-13; L15 p4-6; T06 Q1 (Ans p1); R07 p29, p51-53; R08 p31; AY25/26 Q12

### [1] Canonical forms and set-operation converter
Σm / ΠM / truth table / expression with d/D/X; up to two functions F, G. Truth table with highlighted rows, Σm, ΠM (complement set), F', F+G, F.G, F⊕G, overlaid K-maps; ΠM(..).D(..) -> Σm(..) + d(..) removing DC indices from both lists; shows m_i' = M_i (L13 p25). Ranges like Σm(1,4-7) allowed (L13 p23); ASCII Sum-m/Prod-M accepted (T06 SE2).
- Aha: Σm and ΠM are the same truth table read from the 1s or the 0s.
- Sources: L13 p14-15, p19-25; R07 p15-20; T06 SE2, Q1b, Q2d, Q3b; AY25/26 Q12, Q17a; AY23/24 S2 Q19

### [1] Circuit sketcher, simulator and gate-network simplifier
Expression (auto-drawn) or drag-and-drop/nested-gate circuit; toggles complemented literals (default off), max fan-in, symbol set, constants. Auto-layout with straight wires and fork dots; each wire labelled with its sub-expression (L14 p9 analysis); toggle inputs with 0/1 flowing; truth table; gate count (inverters included) and levels (inverters excluded); symbolic derivation naming each law; 'equals a single gate' detector (4 NANDs = XOR). Every input connected (L14 p7); solid dot for joins (L14 p8); fan-in = inputs.
- Aha: An analysed circuit is its expression tree.
- Sources: L14 p3-9; R07 p3-7, p14, p55; T06 Q3h (Ans p4); AY23/24 S2 Q12; AY23/24 S1 Q6-8; AY24/25 Q1-2; AY25/26 Q12; AY20/21 Q6; AY17/18 Q1c(i)

### [1] Universal-gate converter
SOP/POS or AND/OR/NOT circuit; gate set to test. Animated AND-OR -> add bubble pairs -> NAND-NAND, OR-AND -> NOR-NOR; lone literal enters the output gate complemented; NOT/AND/OR from NANDs (1, 2, 3 gates) and NORs (1, 3, 2) with L14 p11-12 algebra; completeness checker (constants 0/1 assumed): {XOR, AND} complete via a XOR 1 = a'; inverter checker (XOR with 1, XNOR with 0, NOR tied or with 0, NAND tied). NAND = negative-OR, NOR = negative-AND (L14 p5); XNOR = (A⊕B)' (L14 p6).
- Aha: NAND-NAND is AND-OR with bubbles added in pairs.
- Sources: L14 p5, p10-16; R07 p5, p14, p22; T06 Q3h; AY23/24 S1 Q7(ii); AY24/25 Q1-2

### [2] Grouping sandbox
Drag a proposed group; live checks power-of-2 size, rectangle with wrap/corners, no 0 cells, at least one 1; implicant? prime (can it double)?; term with eliminated variables struck and the algebra (m10 + m14 = A.(B'+B).C.D' = A.C.D', R07 p32). Sizes 1-16; group large, few groups (L15 p26).
- Aha: Grouping is repeated A + A' = 1, so a group of 3 cannot simplify.
- Sources: L15 p25-31, p35-36; R07 p33-34, p37

### [2] Adjacency and custom-layout explorer
n, variables on rows/cols and order (any permutation or reversed labels, L15 p14). m-index of every cell; hover lights n neighbours incl. wrap with the differing literal named; quiz places m1-m15 in a given layout (T06 Q3a); explains 00 01 11 10. Gray order shown only as K-map ordering (no conversion tool).
- Aha: Adjacent means one bit different; the grid is only a drawing aid.
- Sources: L15 p9-17, p20; R07 p31-32; T06 Q3a

### [2] 5-variable stacked map
Σm/d over m0-m31. Two 4-var maps (v' = m0-15, v = m16-31) with an overlay/flip animation; cross-map groups as linked loops dropping v. Each cell 5 neighbours (L15 p21).
- Aha: A 5-var map is a 4-var map with a second floor.
- Sources: L15 p21-24; T07 SE3; R07 p61; R08 p34

### [2] Minterm/maxterm translator and drill
Term or index with n. Bit pattern, polarity rule (minterm 0 bit -> primed; maxterm 0 bit -> plain), the row where it is 1 (minterm) or 0 (maxterm); flashcards from the L13 p21 quiz.
- Aha: M_i is 0 on exactly row i; its literals are whatever makes each literal 0 there.
- Sources: L13 p19-21; R07 p15-16

### [2] SOP / POS / canonical classifier
Any expression. Parse tree tagged literal / product / sum / other; verdict on SOP, POS, canonical SOP, canonical POS, with the breaking subexpression highlighted. Definitions L13 p16-17; constants degenerate SOP/POS (T06 p2).
- Aha: A single literal or product is both SOP and POS; POS is not automatically product of maxterms.
- Sources: L13 p16-18; R07 p10-13; AY23/24 S1 Q7(iii)

### [2] Laws, duality and complement playground
Pick a law or type an equation/function. Dual (swap . and +, 0 and 1, literals kept) beside complement (DeMorgan + flip literals); truth-table check that the dual holds and the complement differs; each law on a small K-map. Examples L13 p11.
- Aha: Duality gives a free theorem; negation gives a different function.
- Sources: L13 p10-13, p15; R07 p8

### [2] Precedence and parse-tree viewer
Expression as typed; fully parenthesised form and tree; warns on implicit AND (AB) and CS1231-style precedence. NOT, AND, OR (L13 p9).
- Aha: A.B + C is unambiguous because AND binds tighter.
- Sources: L13 p6, p9; R07 p4, p7

### [3] Quine-McCluskey tabulator (non-examinable)
Any function with don't cares. Minterms grouped by count of 1s, pairwise combination into dash codes with ticks, unticked = PIs (all-X dropped), PI chart and reduced chart synced to K-map loops. Labelled non-examinable (L16 p1); no past paper relies on it.
- Aha: K-map loops are this table drawn as geometry.
- Sources: L16 p1-13; T06 p1-2, Ans p5; R07 p48

### [3] PLA / ROM mapper
Several SOP outputs or the MIPS control truth-table preset. AND plane, OR plane with burned connections, shared product-term count; ROM view fully decoded; demo of running out of product terms. No past-paper question found.
- Aha: A PLA is a programmable 2-level SOP; a ROM decodes every minterm.
- Sources: L14 p19-23; R07 p23-25

Callouts:
- A.B + A'.B' = 1 is wrong; the second term must be (A.B)' = A'+B' (T06 SE1)
- Omitting '.': AB reads as a 2-bit value; key says zero marks (L13 p6; T06 p2, Ans p1; R07 p7)
- AND binds tighter than OR in CS2100, unlike CS1231 (L13 p9; R07 p4)
- Duality is not negation (L13 p11)
- Maxterm polarity is reversed: M2 on (x,y) = x+y', m2 = x.y' (L13 p20)
- A single literal or constant is both SOP and POS; X.(W'+Y.Z) and W.X'.Y + V.(X.Z+W') are neither (L13 p17-18; R07 p11-13; T06 p2)
- Not every POS is a product of maxterms (AY23/24 S1 Q7iii false)
- Inverters are not a level but are gates (R07 p14)
- SOP -> NAND: a lone literal enters the output NAND complemented (L14 p14, p16)
- Every input connected; junctions need a dot (L14 p7-8; T06 Ans p4)
- Groups are power-of-2 rectangles, may wrap; four corners m0, m2, m8, m10 form one group (L15 p25, p31)
- A PI can be redundant: B.D on L15 p42 (L15 p42; R07 p41)
- A group of only don't cares is not a PI: K.L, M.N (L15 p49), A'.C (T06 Q2d), C.D (AY23/24 S2 Q19), B.D (AY24/25 Q17a)
- Leftover X's need no covering (L15 p53; R07 p46)
- An EPI must cover a true minterm no other PI covers; students are weak at this (T06 p1-2, Ans p1, p5)
- EPIs alone may not give the simplest SOP; zero EPIs is possible (L15 p38; AY23/24 S1 Q7iv, Q17a; AY21/22 S1 Q5)
- Don't cares are fixed once built: T06 Q4 fed 0000 outputs XYZ = 001 (T06 Q4d)
- ΠM(..).D(..) -> Σm must drop the DC indices: T = Σm(0,1,2,4,5,9) + X(6,11,14,15) (T06 Q3b)
- Several minimal answers may exist and questions ask for all or how many (T06 SE3; AY23/24 S2 Q19c; L15 p55)
- Minimising literals and terms can conflict; lecture focuses on literals (L15 p4)
- x'.(y+z)' and x'.(y+z) differ (x=y=z=0) (R07 p51)
- {XOR, AND} complete with constant 1; {OR, NOT} complete; all four AY24/25 Q2 sets complete (E); OR cannot invert, XOR/XNOR/NOR can (Q1 D) (AY24/25 Ans p2)
- The right count may not be an option: AY24/25 Q4 has 2 EPIs, answer E
- Unfilled K-map cells in slides are 0s for illustration; fill every cell in practice (R07 p34; R08 p9)

Fixtures:
- Σm(2,3,4,5,7,8,10,13,15) -> 6 PIs, 3 EPIs (B.D, A'.B.C', A.B'.D'); F = B.D + A'.B.C' + A.B'.D' + A'.B'.C (unique) [L15 p39-41; R07 p40; L16 p4-8]
- Σm(3,4,5,7,9,13,14,15) -> 5 PIs, 4 EPIs; A'.B.C' + A.C'.D + A.B.C + A'.C.D; POS (A'+B+C')(A'+C+D)(A+B+C)(A+C'+D) [L15 p42; R07 p41; = AY25/26 Q17a H]
- AY25/26 Q17a F=Σm(0,1,3,4,5,7,9,13,14,15), G=ΠM(0,1,6,8,11,12), H=F.G -> G=Σm(2,3,4,5,7,9,10,13,14,15); H=Σm(3,4,5,7,9,13,14,15) as above [AY25/26 key]
- Σm(0,2,3,4,7,8,9,10,11,13,14) -> 7 PIs, 4 EPIs (A'.C'.D', A.C'.D, A'.C.D, A.C.D'); 3 minimal SOPs of 6 terms (reconstructed) [L15 p37; R07 p39]
- Σm(0,1,2,3,5,7,8,9,10,11) -> F' = A.B + B.D'; F = (A'+B')(B'+D); SOP B' + A'.D [L15 p43-44; R07 p43]
- F=Σm(3,5,6)+d(0,7); G=Σm(1,2,4)+d(0,7) -> F = A.C + A.B + B.C; G = B'.C' + A'.B' + A'.C' [L15 p46-47; R07 p45]
- F(K,L,M,N)=Σm(2,6,8)+d(3,7,11,12,13,14,15) -> PIs K'.M, L.M, K.M'.N'; EPIs K'.M, K.M'.N'; F = K'.M + K.M'.N' [L15 p48-49]
- A.B.C + B'.C.D' + A.D + B'.C'.D' = Σm(0,2,8,9,10,11,13,14,15) -> SOP A.D + A.C + B'.D'; F' = A'.B + A'.D + B.C'.D'; POS (A+B')(A+D')(B'+C+D) [L15 p50-51, p54]
- Σm(2,8,10,15)+d(0,1,3,7) -> SOP B'.D' + B.C.D; POS (B'+C)(B'+D)(B+D'); alt POS (B+D')(B'+D)(C+D') [L15 p52-55; R07 p46-47]
- Σm(4,5,10,11,14,15) -> w'.x.y' + w.y [L15 p27-29]
- A.(C+D)'.(B'+D') + C.(B+C'+A'.D) -> Σm(3,6,7,8,12,14,15); A'.C.D + A.C'.D' + B.C (computed) [L15 p33]
- Map 1s at m0, m2, m5; A = x.y + y.z' + x'.y'.z -> a'.c' + a.b'.c; A = Σm(1,2,6,7) [L15 p18]
- T06 SE3a Σm(5,8,10,12,13,14) -> 3 PIs, 2 EPIs; A.D' + B.C'.D; POS (A+D)(B+D')(C'+D') (POS computed) [T06 Ans p1]
- T06 SE3b ΠM(0,1,2,8,9,10) -> 2 PIs, 2 EPIs; X + Y.Z; POS (X+Y)(X+Z) [T06 Ans p1]
- T06 SE3c Σm(1,7,10,13,14)+d(0,5,8,15) -> 6 PIs, 1 EPI (L.N); L.N + K.M.N' + K'.L'.M' or L.N + K.M.N' + K'.M'.N; 3 POS alternatives (computed) [T06 Ans p1]
- T06 Q2d ΠM(4,8,9,11,12).D(2,3,6,7,10,14) -> Σm(0,1,5,13,15)+d(..); 4 PIs, 2 EPIs; SOP A'.B' + B.D; POS (A'+B)(B'+D) [T06 Ans p2]
- T06 Q3 ΠM(3,7,8,10,12,13).X(6,11,14,15) -> 4 PIs, 2 EPIs; A'.D' + A'.C' + B'.C'.D or + A.B'.D; T' = A.D' + C.D + A.B; POS (A'+D)(C'+D')(A'+B') [T06 Ans p3, p5]
- T06 Q4 X=(KL=MN), Y=(KL<=MN), Z=(KLM<LMN), d(0) -> X = K'.L.M'.N + K.L'.M.N' + K.L.M.N; Y = M.N + K'.N + K'.M + L'.M (5 PIs, 4 EPIs); Z = K'; 0000 -> XYZ = 001 [T06 Ans p6]
- T06 Q1 (a) (x + y.z').(y'+y) + x'.(y.z' + y); (b) ΠM(5,9,13) -> x + y (computed); p'.q' + r + s' [T06 Ans p1]
- T06 SE2 F=Σm(0,2,4,6,7), G=Σm(1,2,3,6) -> F = ΠM(1,3,5); G = ΠM(0,4,5,7); F+G = Σm(0,1,2,3,4,6,7); F.G = Σm(2,6); F⊕G = Σm(0,1,3,4,7) (computed)
- L13 p23 table -> F1 = m6; F2 = Σm(1,4,5,6,7) = ΠM(0,2,3); F3 = Σm(1,3,4,5) = ΠM(0,2,6,7) [L13 p23-25]
- A'.B'.C.D; m10; m11; A.B.C.D'; A.B'.C'.D; A+B+C'+D'; M13; M0; A+B+C'+D; A'+B+C+D' -> m3; A.B'.C.D'; A.B'.C.D; m14; m9; M3; A'+B'+C+D'; A+B+C+D; M2; M9 [L13 p21; R07 p16]
- L13 p18 quiz (1)-(6) -> SOP only; POS only; both; neither; both; neither (derived) [L13 p18]
- F1 = x.y.z' -> F1' = x'+y'+z [L13 p15]
- F3 = x'.y'.z + x'.y.z + x.y'; F4 = x.y' + x'.z -> equal, Σm(1,3,4,5) [L13 p14]
- (x+y)(x+y')(x'+z); a.b.c + a.b.d + a'.b.c' + c.d + b.d' -> x.z; b + c.d [L15 p5-6; R07 p29]
- (A.B + C).(A.C + B) -> Σm(3,5,6,7) (C) [AY25/26 Q12]
- A.B'.(C + D' + E)'.F + (C' + F')' + D.F -> (C + D).F (D, computed) [AY20/21 Q6]
- x'.(y + y'.z)'; (a'+a).b.c + a.b'.(c'+c); (x+y'+z'.z).(x'.x+y+z) -> x'.(y+z)'; a'.b.c + a.b.c + a.b'.c' + a.b'.c; (x+y'+z')(x+y'+z)(x'+y+z)(x+y+z) [R07 p51-53]
- A'.C + A.B + B.C (= Σm(1,3,6,7)) -> 3 PIs, 2 EPIs; A'.C + A.B [R07 p36]
- Σm(1,2,3,5,7) -> 11 implicants; 2 PIs (C, A'.B); C + A'.B [R07 p3, p27, p37]
- A.B + A'.C + A'.B' -> Σm(0,1,3,6,7) = ΠM(2,4,5) = (A+B'+C)(A'+B); SOPs A'.B' + A'.C + A.B or A'.B' + A.B + B.C [R07 p9, p20]
- f=Σm(0,1,2,3,4,7) -> f' = x.y'.z + x.y.z'; f = (x'+y+z')(x'+y'+z); SOP x' + y'.z' + y.z [R07 p58-59]
- Circuit ((A'.B') + C)'; F = (a.b) ⊕ (b+c) -> (A+B).C'; a'.b + b'.c [L14 p9; R08 p31]
- 4-NAND circuit, 3 ns per NAND -> XOR (C); 9 ns (C) [AY23/24 S2 Q12-13]
- NAND-only and NOR-only basics -> NAND NOT 1, AND 2, OR 3; NOR NOT 1, OR 2, AND 3 [L14 p11-12]
- AY24/25 Q1 inverters; Q2 complete sets -> D; E [AY24/25 Ans p2]
- AY23/24 S1 Q6 divisible by 4 with one gate; Q7; Q8 -> D (NOR of G,H); B; D (1 AND + 1 OR) [AY23/24 S1 Ans p4-5]
- AY23/24 S2 Q19 ΠM(0,2,8,10,13).X(3,7,11,12,15) -> Σm(1,4,5,6,9,14); 5 PIs, 1 EPI (B'.D); 3 SOPs B'.D+A'.B+B.D', B'.D+A'.B+B.C, B'.D+B.D'+A'.D [AY23/24 S2 key]
- AY23/24 S1 Q17 P=Σm(1,8,13)+d(0,2,5,9,10,15); Q=ΠM(5,7,8,10,13,15).d(0,2,3,4,9,14) -> P 4 PIs, 0 EPIs, X'.Y'+Y'.Z or X'.Z'+Y'.Z; Q Σm(1,6,11,12), 4 PIs, 2 EPIs, X'.Z + X.Z' [AY23/24 S1 key; R08 p40-41]
- AY24/25 Q3-4 Σm(1,3,4,6,10,12)+x(2,5,7,13,14) -> 6 PIs (B.C', C.D', A'.D, A'.B, A'.C, B.D'), 2 EPIs; D, E; SOP A'.D + C.D' + B.D' or + B.C' [AY24/25 key]
- AY24/25 Q17a Σm(0,1,4,6,9,11)+d(5,7,13,15) -> 4 PIs, 3 EPIs; A'.C' + A'.B + A.D; POS (A'+D)(A+B+C') [AY24/25 key]
- AY25/26 Q1 map read as Σm(0,1,2,6,8,10,12) -> 4 PIs all EPIs: B'.D', A'.B'.C', A.C'.D', A'.C.D' (D) (reconstructed) [AY25/26 key]
- AY20/21 Q1-2 Σm(0,1,2,7,15)+x(3,9,11,12,13) -> 4 PIs (B), 2 EPIs (C), A'.B' + C.D (computed)
- AY21/22 S1 Q5 Σm(3,10,11,15)+x(1,2,4,7,9,12,14) -> 0 EPIs (A), 4 PIs, 4 alternatives (computed)
- AY21/22 S2 Q5 Σm(1,3,6,8,9,11,15)+x(7,14) -> C.D not an EPI (A); A.B'.C' + B'.D + B.C (computed)
- AY21/22 S2 Q14c G=Σm(0,4,6,8,9,10,12,13,14,15) -> 5 PIs, 5 EPIs; A.B + C'.D' + A.C' + B.D' + A.D'; G = (AB >= DC); one comparator X=A,A,B,1 vs Y=A,D,C,0 with X>Y (wiring computed) [R08 p39]
- T07 SE3 5-var PQ = zeros between the two closest 1s, d(0,1,2,4,8,16) -> P = Σm(9,17,18)+d = A'.C'.D' + B'.C'.D' + B'.C'.E'; Q = Σm(5,10,17,20,21)+d = A'.C'.E' + B'.D'; 00100 -> PQ = 01 (computed)
- 6-var Σm(6,8,14,18,23,25,27,29,41,45,57,61) -> 7 EPI terms (computed) [L15 p24]

## Logic: Combinational & MSI

L17-L18, T07-T08, R08-R09: adders, comparators, decoders, MUXes, encoders, code converters, delays. Recurring MCQs: single comparator, active-low decoder + gate, MUX selector choice.

### [1] Block circuit workbench / MSI component lab
Drag blocks (HA, FA, 2/4-bit adder, 2/4-bit comparator, 2x4/3x8 decoder with 1- or 0-enable and active-high/low outputs, 4:1/8:1 MUX, quad 2:1 (E', S), 1:4 DEMUX, 4-to-2/8-to-3 and priority encoder, Count-1/Count-0, F-block, custom function table) plus gates; wire to literals A-E, constants, other outputs. Optional target Σm/ΠM + d, table, or arithmetic spec. Pick a row and values animate through blocks with wires labelled by value and expression; full truth table, Σm/ΠM, simplified SOP/POS (K-map engine), per-row diff against target, device/gate/inverter counts; T08 Q4 per-selector-row mode. Enforces 'only these devices, fewest' (T07 Q1); flags implicit inverters; S1 MSB; 0 = GND, 1 = Vcc (L17 p23).
- Aha: MSI blocks are just functions; rewiring is free arithmetic and a constant on an adder makes '+3'.
- Sources: L17 p4, p17-24, p29, p33; L18 p12-14, p23-24, p48-56; T07 p2, Q1-5; T08 Q3-5; R08 p34-42; R09 p51-59; AY23/24 S2 Q21; AY23/24 S1 Q9-10, Q17c-e; AY24/25 Q5-7, Q17b-c; AY25/26 Q8, Q11; AY21/22 S1 Q13; AY21/22 S2 Q6, Q14; AY20/21 Q11, Q13; AY19/20 Q5-6; AY18/19 Q5; AY17/18 Q3; AY16/17 Q2; AY15/16 Q8

### [1] Magnitude comparator studio + single-comparator function finder
Mode 1: two 4-bit values, bit cascade from MSB with xi = Ai.Bi + Ai'.Bi' and A>B / A<B sums lit term by term (L17 p31). Mode 2: wire X3..X0, Y3..Y0 to {A,B,C,D,0,1}. Mode 3: target F as Σm/ΠM, 2- or 4-bit device, optional 2 comparators + one gate; brute-force all wirings x {X<Y, X=Y, X>Y} (6^8 per side, 16-bit masks, under a second) listing all solutions or proving none; groups families (threshold, permuted-bit equality like ABCD=DCBA, B000 vs C000, D-broadcast Y=DDDD); hints (append 1 on X, 0 on Y to turn >= into >). Unsigned; no gates, no complemented literals (T07 p2, p4). Only 1656 of 65536 4-var functions reachable.
- Aha: One comparator only makes thresholds or equality/ordering of rearranged bits, so AY25/26 Q8 F2 is impossible.
- Sources: L17 p30-33; R08 p20-22, p39; T07 Q1, Q5 (Ans p1, p6); AY25/26 Q8; AY24/25 Q7; R09 p52, p57; AY23/24 S1 Q17d; AY23/24 S2 Q21c; AY21/22 S2 Q14c(iii); AY15/16 Q8; AY16/17 Q2a

### [1] Decoder lab (enable type, polarity, implement/read, product finder)
Size 2x4/3x8/4x16; enable none / E / E'; outputs active-high/low; wire selects and E to literals, constants or a gate (A⊕D); choose outputs into OR/NOR/AND/NAND; or a target Σm. Live view with disabled row; implement mode shows 4 builds (high+OR of 1s, low+NAND, high+NOR of 0s, low+AND) with fan-in; read mode derives F (active-low output = complemented minterm, AND of them = product of maxterms); product finder enumerates every (E,S1,S0) wiring and lists reachable products with no gates. S1 MSB; 0-enable written E' (L18 p16); 74138 active-low, multiple enables (L18 p21-22, image).
- Aha: Each output is a minterm AND the enable; a 1-enable can only add an uncomplemented literal, so A'.B'.C' is unreachable without an inverter.
- Sources: L18 p5-24; R09 p10-19, p53, p56, p58; T08 SE1-3, Q2; AY25/26 Q11; AY24/25 Q6; AY23/24 S2 Q21b; AY23/24 S1 Q9; AY21/22 S2 Q6; AY17/18 Q3c; AY16/17 Q2b; AY19/20 Q5a

### [1] MUX function implementer with gate-free selector search
F as Σm/ΠM with d/D; MUX 2^n:1, 2^(n-1):1, or 4:1 for 4 vars; selectors and order (S1 MSB) or auto. Truth table regrouped by selector value (L18 p54); per group F vs the reserved variable gives 0, 1, v, v'; don't cares resolved toward constants (T08); v' flagged red (needs inverter); animated Y = I0.m0 + I1.m1 + ...; auto lists every selector pair needing no gates. A selector variable must not be reused on data inputs (AY21/22 S1 p9); 74151A has strobe and complementary output (table image, L18 p46-47).
- Aha: A MUX is a minterm generator whose data lines choose survivors; selector choice decides whether an inverter is needed.
- Sources: L18 p37-56; R09 p33-48, p55; T08 Q1 (Ans p1); AY23/24 S2 Q21a; AY23/24 S1 Q10; AY21/22 S1 Q13c; AY18/19 Q5d; AY20/21 Q13a-b; AY17/18 Q3b

### [1] Propagation delay and critical-path calculator
Full adder, n-bit ripple adder, or any gate DAG from the circuit sketcher; delays uniform t, per type, or fan-in n.t; input arrival times (default 0). Each output stamped max(inputs) + delay level by level; critical path highlighted; Gantt timeline; ripple mode with n slider and table of Si, Ci+1 vs formulas. FA drawn as 2 HAs + OR (L17 p35); other drawings give other numbers.
- Aha: Delay is set by the latest input, not gate count; ripple carry grows 2t per bit.
- Sources: L14 p17; L17 p34-38; R07 p56; R08 p24-28, p32; AY17/18 Q1c(ii); AY23/24 S2 Q13

### [2] Ripple-carry adder stepper + block-level adder presets
Width 1-16, X, Y, Cin; FA as 2 HAs + OR toggle. Presets BCD -> Excess-3 (+0011), 16-bit from four 4-bit adders, 6-person voting (2 FAs + 4-bit adder), (ABCD+1)/2, X+5y, T07 Q1 popcount. Column addition with carry row (L17 p20, p27), each FA's Xi⊕Yi, Si, Ci+1 in turn; 5-bit result; panel on why a 9-input truth table needs 512 rows (p19). Ci+1 = Xi.Yi + (Xi⊕Yi).Ci (L17 p20); lecture numbers bits 1..4 (C1 in, C5 out) vs tutorials X3..X0: show both.
- Aha: FA = two HAs + OR; arithmetic tricks replace K-maps.
- Sources: L17 p6-12, p17-29; R08 p11-18, p36; T07 Q1-2 (Ans p1-3); R09 p4-7; AY20/21 Q13d

### [2] Multi-output and code-converter designer
Pick code tables (BCD 8421, Excess-3, 84-2-1, 2421, 4221, Gray, excess-11 base-4 digit), a word spec preset, or a multi-output truth table; allowed parts (gates, HAs, one 4-bit adder, A1H). Invalid codes auto-marked X (6 for decimal codes); one K-map per output side by side with PI/EPI solution; shared product terms highlighted; combined circuit with gate count. Scope: circuit design, not a number-base converter.
- Aha: Invalid codes become don't cares that shrink every output at once.
- Sources: L17 p13-16, p22-23; R08 p6-9; T07 SE2, Q2b; T06 Q4; T07 SE3; L15 p45; AY25/26 Q17b; R08 p37 (AY21/22 S1 Q13a)

### [2] Gate-free rewiring visualizer
Mapping such as k.x + c, BCD formula 51A + 20(B%2), code offset (excess-3 -> excess-11). Bit lanes as wires: x2^k slides wires, constants tied to GND/Vcc; reproduces the T07 Q4 5A/50A/51A build-up; detector per output bit: wire, constant, XOR of adjacent bits (Gray via HAs) or input + constant (adder); highlights the clash when a carry would be needed.
- Aha: Shifting is free in hardware; many converters need no gates.
- Sources: T07 SE1, Q3, Q4 + 'Tutorial 7 - Answer Q4' p2-7; AY24/25 Q5; R08 p16-17

### [2] Encoder and priority encoder explorer
Toggle D0..D(2^n-1) for 4-to-2, 8-to-3, 16-to-4; plain or priority with chosen highest; reverse mode wires inputs to literals/constants. OR equations light; plain encoder with two highs shows the misleading code (D1+D2 -> 11); priority shows winner and V; compact X rows expand into 16 rows with K-maps for f, g, V; reverse derives H2, H1, H0. Plain assumes one high (L18 p26, p30); L18 priority D3 highest, all-zero V=0 (p32); exam 8-to-3 has F7 highest (T08 p4).
- Aha: An encoder bit is the OR of every input whose index has that bit set.
- Sources: L18 p26-33; R09 p23-29; T08 Q5; AY23/24 S2 Q15, Q21e; AY23/24 S1 Q17c

### [2] Decoder expansion builder
Target n-to-2^n, block k-to-2^k with enable, input code, composite ENABLE option. Tree with MSBs driving enables (w to upper, w' through inverter to lower, L18 p17), active path lit; count (2^n-1)/(2^k-1) when k divides n (formula from a student sheet, matches R09 p18).
- Aha: MSBs pick the decoder, LSBs the line: same idea as memory chip select.
- Sources: L18 p17-20, p25; R09 p16-18; T08 Q2; Finals Notes p10-11

### [2] Combinational analysis tracer
Circuit as named points (w = a.b, x = b + c, F = w⊕x) or schematic. L17 p4 steps: label, derive, fill truth table column by column, simplify with laws named (consensus in R08 p31); recogniser names HA, FA, Gray converter, parity, equality, adder-subtractor.
- Aha: Different-looking networks (4 HA forms, L17 p25) compute the same function.
- Sources: L17 p4, p25-26; R08 p31, p37-39

### [3] MUX tree and DEMUX visualizer
Build 8:1 from two 4:1 + 2:1 or four 2:1 + 4:1, 16:1 from five 4:1; select value lights path; DEMUX vs decoder with E = D side by side; quad 2:1 with E' = 1 gives all 0s. S2 goes to the last stage in p42, first stage in p44.
- Aha: Select-bit placement matters; a DEMUX is a decoder with data on the enable.
- Sources: L18 p34-45; R09 p32-37

Callouts:
- Complemented literals are NOT available unless stated; constants 0/1 always are and count as SOP/POS; an implicit A' costs an inverter (T06 p2; T07 p2, Ans p1; R08 p34; R09 p51; AY24/25 p8; AY25/26 p11)
- XOR is not SOP: half adder S = X⊕Y (L15 p8; R07 p30); write C⊕D as C'.D + C.D' when SOP is asked (T08 Ans p4)
- T08 Q4 common mistake: writing A'BC'D + A'BCD' in a row where AB is fixed; entry is C'.D + C.D' (T08 p4, Ans p4)
- Choose a constant over Z' for a MUX input when a don't care allows (T08 Ans p1)
- A selector variable must not be reused on MUX data inputs (AY21/22 S1 p9)
- S1 (or S2) is the selector MSB; wrong order maps the wrong minterms (L18 p38)
- 74138 outputs are active-low: use NAND (1s) or AND (0s), not OR; AND of active-low outputs = product of maxterms (F2 = B'+C), NOR over some outputs gives 1 for the rest (L18 p21-24; R09 p19; AY23/24 S2 Ans p20; AY25/26 Q11)
- 1-enable decoder without inverters can only add an uncomplemented literal (L18 p15; AY23/24 S1 Q9)
- Plain encoder assumes one high input; priority encoders resolve, all-zero gives V=0 (L18 p26, p30, p32)
- 16-to-4 encoder Y (bit 1) = D2+D3+D6+D7+D10+D11+D14+D15 (AY23/24 S2 Q15)
- Decimal codes valid only 0-9: 6 don't cares (T07 Ans p4; R08 p7)
- Don't design a 4-bit adder by truth table: 512 rows (L17 p19)
- Delay S = 2t, C = 3t per FA depends on the 2 HA + OR drawing (L17 p35)

Fixtures:
- Full adder XYZ = 011; 111 -> C=1,S=0; C=1,S=1 (C = Σm(3,5,6,7), S = Σm(1,2,4,7)) [L17 p9; L18 p13]
- X=1010, Y=1111, Cin=0 -> C5=1, S=1001 (25) [L17 p20]
- A=1011, B=0011, C1=0 -> carry-in row 0110, S = 1110, carry-out row 0011 [L17 p27]
- Full adder all gates t; 4-bit ripple -> S=2t, C=3t; S1=2t, C2=3t, S2=4t, C3=5t, S3=6t, C4=7t, S4=8t, C5=9t; 16-bit S16=32t, C17=33t; Sn = ((n-1)2+2)t, Cn+1 = ((n-1)2+3)t [L17 p35-38; R08 p25-28]
- BCD -> Excess-3: 0101; 1001 -> 1000; 1100; W = A + B.C + B.D, X = B'.C + B'.D + B.C'.D', Y = C.D + C'.D', Z = D' [L17 p14-16; R08 p8-9]
- F=1 iff 3 <= ABCD <= 12 -> Comp1 ABCD > 0010, Comp2 ABCD < 1101, AND [L17 p33]
- T07 Q5 F=Σm(12-15), G=Σm(0,6,9,15), H=Σm(0,1,6,7,8,9,14,15), Z=Σm(1,3,5,7,9,11,13) -> ABCD > 1011; ABCD = DCBA; B000 = C000; ABCD < DDDD (or < DABC) [T07 Ans p6]
- AY25/26 Q8 F1=Σm(2,4,5,6,7,14), F2=Σm(2,4,6,8,9,11,13,15), F3=ΠM(0,2-15) -> AD < BC; impossible (exhaustive search); ABC < D; D [AY25/26 Ans p5]
- AY24/25 Q7 Σm(0..8), Σm(0,2,4,6,9,11,13,15), Σm(0,15) -> all possible (D): ABCD < 1001; A = D; ABCD = BCDA [inventory letter; computed]
- 2-bit comparator F = Σm(1,4,5,6,7,13) -> (AC < BD) [R09 p52]
- 8-bit 00110011; 00110100 multiple of 17 -> 1; 0 (rule ABCD = EFGH) [R09 p57]
- (ABCD+1)/2 with one adder: 0110; 1101; 1111 -> EFGH = 0ABC + 000D: 0011; 0111; 1000 [T07 Q2a, Ans p3; R09 p5-6]
- 4221 -> 8421 via A1H: 1001; 1111; 0110; 1100 -> 0101; 1001; 0100; 0110 (A1H inputs 0,P,Q,R; Z = S) [T07 Ans p3; R09 p7]
- 51A + 20(B%2), A=0010, B=0111 -> 0001 0010 0010 (122); F11..F8 = 0A3A2A1, F7..F4 = 0A0B0A0, F3..F0 = A3A2A1A0 [T07 Q4 answer p4-7]
- T07 SE1 4x+2 for 3-bit ABC -> VWXYZ = A,B,C,1,0 (computed)
- Binary 10110 -> Gray 11101 via 4 HA sums (computed) [T07 SE2]
- Three half adders ABCD -> E=Σm(8-15), F=Σm(4-11), G=Σm(2,3,4,5,10,11,12,13), H=Σm(1,2,5,6,9,10,13,14) [R08 p37]
- Excess-3 -> excess-11 base-4 digit, 0101 (digit 2) -> 1101: F3=1, F2F1F0 = A2A1A0, no gates (C) [AY24/25 Q5; T07 Q3]
- f(Q,X,P) = Σm(0,1,4,6,7) = ΠM(2,3,5) -> high+OR(0,1,4,6,7); low+NAND(0,1,4,6,7); high+NOR(2,3,5); low+AND(2,3,5) [L18 p23-24]
- 3x8 decoder, NOR of D1, D3, D6 -> F = Σm(0,2,4,5,7) [AY25/26 Q11]
- AY23/24 S2 Q21b 0-enable active-low 2x4 + AND -> F2 = B' + C [AY23/24 S2 Ans p20]
- AY24/25 Q6 decoder circuit -> A, F = A + B + C [inventory]
- N = A + B + C with a 0-enable active-low decoder -> E'=C, S1=A, S0=B, output 0 [R09 p58]
- 1-enable 2x4, no gates, H = Σm(12,13) -> E=A, S1=B, S0=C, output 2 [R09 p56]
- G = Σm(2,11) with decoder + XOR -> EN=C, S1=A⊕D, S0=B, output 0 [R09 p53]
- One 1-enable 2x4: A.B.C, A'.B.C', A'.B'.C' -> yes, yes, no (A, computed) [AY23/24 S1 Q9]
- F(X,Y,Z) = ΠM(1,5,6).D(4) -> 8:1 1,0,1,1,d,0,0,1; 4:1 sel XY Z',1,0,Z; sel YZ 1,0,X',1 [T08 Ans p1]
- F(A,B,C)=Σm(0,1,3,6) -> sel AB 1, C, 0, C'; sel BC A', A', A, A' [L18 p52-55]
- F1=Σm(0,2,3,5,6,7) -> selectors AC, data 1,B,B,1 [AY23/24 S2 Q21a]
- F1=Σm(3,4,5,7), F2=Σm(0), F3=Σm(0,2,6) on one 4:1 -> F1 sel AB 0,C,1,C; F3 sel AC 1,0,B,0; F2 impossible (B) [AY23/24 S1 Q10]
- G = ΠM(1,2,6,8,9,11,13) on 8:1 -> sel ACD, data 1,B,0,1,B,0,1,B [R09 p55]
- 74151A f = Σm(0,1,2,3,4,9,13,14,15), sel x1x2x3 -> 1,1,x4',0,x4,0,x4,1 (computed) [L18 p56]
- 8:1 from 4:1s+2:1 with 110; from 2:1s+4:1 with 101 -> I6; I5 [L18 p43-44]
- 4-to-2 priority encoder 1010; 0000 -> fg=10, V=1; V=0; f = D2+D3, g = D3 + D1.D2', V = D0+D1+D2+D3 (computed) [L18 p32-33]
- T08 Q5 priority encoder circuit -> H2 = A + B, H1 = A + B'.C, H0 = 1 [T08 Ans p5]
- T08 Q4 adder + MUX, G per AB -> 00: 0; 01: C'.D + C.D'; 10: D; 11: 1 [T08 Ans p4]
- AY24/25 Q17b-c -> G per AB as above; H2 = A+B, H1 = A+B'.C, H0 = 1 [AY24/25 Ans p14]
- AY23/24 S1 Q17c, d, e -> NAND; R = Σm(0,3,12,15); S = Σm(2,7,10,15) [AY23/24 S1 Ans p11]
- AY23/24 S2 Q21c, d, e -> F3 = Σm(10,11,14,15); F4 = Σm(5,7,9,11,12,14); F5 = C + D [AY23/24 S2 Ans p20]
- 4x16 from 2x4 with enable; 3x8 -> 5 decoders; two 2x4 + 1 inverter [R09 p18; L18 p17]
- BCD -> 7-segment PQRS, d(10-15) -> A = Σm(0,2,3,5,6,7,8,9); E = Σm(0,2,6,8); B = Q' + R'.S' + R.S; G = P + Q'.R + Q.R' + Q.S' (or R.S'); F = ΠM(1,2,3,7) [AY25/26 Q17b key, Draft]

## Logic: Sequential

L19, T09, R10: latches, flip-flops, analysis to state tables, design with mixed D/T/JK/SR, self-correcting checks, counters, memory arrays. One 12-14 mark sequential question every paper.

### [1] Sequential circuit analyzer
m flip-flops (D, T, JK, SR) named A, B, C; inputs (x, or X0X1 with MSB note); FF input equations; Mealy/Moore outputs; or a state table; optional start state and input sequence. State table built row by row (present | input | FF inputs | next | output) with each next bit computed via the characteristic table and the rule shown; compact table (L19 p32); auto-laid state diagram with a/b labels, badges for sinks, self-loops, unreachable states; clocked timeline. A(t)/A+ notation (L19 p28); 2^(m+n) rows (p30); input/output arc labels, Moore '/p' (T09 p2); JA = J of A (p36); state = decimal of AB.., MSB first, overridable.
- Aha: A sequential circuit is combinational logic feeding flip-flops, one clock at a time.
- Sources: L19 p28-43; T09 SE1, Q1; R10 p26-28, p54-58, p64-66; AY24/25 Q16a; AY23/24 S1 Q18a; AY23/24 S2 Q14; AY25/26 Q16; AY19/20 Q4b

### [1] Sequential design wizard
State diagram (click arcs input/output), state sequence (1->3->5->...), or state table; bit count, FF type per bit, used states. L19 p46 checklist: excitation table filled per row with animated lookup (0->1 for JK = 1X); unused states X; one K-map per FF input with groups and SOP; 'commit' rewrites each X as the value the equations give (T09 Ans p3) and derives unused transitions; gate count with Q' free; 'check my equations' accepts non-SOP forms (B⊕x) and verifies every used transition; SR warns on S=R=1. K-map layout AB rows, Cx columns (L19 p50, p56); x and y token inputs are separate lines (T09 Ans p5).
- Aha: Don't cares shrink equations but decide where unused states go; fewest gates is not simplest SOP (T09 Q2).
- Sources: L19 p44-58; T09 Q2-4 (Ans p2-5); R10 p30-39, p61-63; AY23/24 S2 Q20; AY23/24 S1 Q18b; AY24/25 Q16c; AY21/22 S1 Q12; AY21/22 S2 Q13; AY20/21 Q12; AY18/19 Q4; AY17/18 Q2; AY16/17 Q1; AY15/16 Q7

### [1] Self-correcting / lockout checker
Final equations, valid states, inputs. Full 2^m graph with unused states hatched; each unused state's path animated per input until it reaches a valid state or loops; Yes/No verdict plus an auto one-line justification ('No: 4->1->0->0 never reaches a used state'). Strict view vs course view (keys accept one arc out, AY23/24 S1 Q18 state 3).
- Aha: A design that works on valid states can lock up after a glitch; your don't cares became real arrows.
- Sources: R10 p40-43, p63; T09 Q2-3 (Ans p3-4); AY24/25 Q16b; AY23/24 S1 Q18b(viii); AY23/24 S2 Q20f-g

### [1] Flip-flop table trainer
Type SR/D/JK/T or a custom 2-state flip-flop diagram; quiz matches unlabelled diagrams to types (T09 SE2). Characteristic table and equation (Q+ = S + R'.Q, D, J.Q' + K'.Q, T⊕Q); rows causing each Q->Q+ collapse into one excitation row with X; conversion derives T = Q⊕Q+, D = Q+, or inputs for a custom flip-flop. SR S=R=1 invalid (p27); excitation values exactly L19 p45.
- Aha: JK's X exists because two commands give the same move; T asks 'does it change?', D 'where does it go?'.
- Sources: L19 p11, p15, p18-23, p27, p44-45; R10 p25, p30; T09 SE2; AY25/26 Q13; AY21/22 S1 Q12b

### [2] Latch simulator (gate-level, round by round)
NOR S-R, NAND S'-R', gated S-R, gated D; toggles S, R, EN, D, initial Q. Each re-evaluation round until stable (trace 3 rounds, R10 p6) with feedback wires coloured; S=R=1 gives Q=Q'=0, releasing both together is indeterminate; table and Q+ = S + R'.Q with S.R = 0. Active-low NAND: S=R=0 invalid, 1,1 no change (L19 p12; R10 p8); gated changes only while EN=1 (p13); D latch removes the invalid state (p14).
- Aha: Cross-coupled feedback is the memory; 'no change' is the latch remembering.
- Sources: L19 p9-15; R10 p6-10, p20

### [2] Timing-diagram lab: latch vs edge-triggered
Clickable CLK/EN, D/J/K/T/S/R, PRE/CLR waveforms; element gated D latch, +edge FF, -edge FF, JK with PRE/CLR. Q waveform, sampling edges, shaded transparent window for the latch, async override regions, toggling at J=K=1 (L19 p25). '>' clock, bubble negative edge (p17); PRE/CLR active level selectable (p24 text vs p25 bubbles); parallel transfer on negative edge (p20).
- Aha: A latch follows D for the whole EN window; a flip-flop looks only at the edge.
- Sources: L19 p7-8, p14-25

### [2] Counter and shift-register sequencer
Presets 4-bit Johnson (last Q' -> first D), ring (last Q -> first D), mod-3 up/down (T09 Q2), custom; start state; async CLR. Bits shifting per clock, sequence in decimal, disjoint cycles from other starts, minimal state-decoding expressions (State(1) = A.B'). Not taught by name: frame as D-FF analysis; states in decimal of WXYZ/ABCD.
- Aha: Johnson has 2n states, ring n; each Johnson state is recognisable from 2 bits; T08 Q3's code table is the Johnson sequence.
- Sources: L19 p20; AY23/24 S2 Q14; AY19/20 Q4b; T08 Q3; T09 Q2-3

### [3] Memory array builder
Total words x bits, chip size, an address, Memory Enable and R/W. Chip grid (depth rows, width columns), address split (top bits -> decoder -> CS, low bits to every chip), selected chip and internal address, R/W table. KB = 2^10 (p59); k lines -> 2^k words; ME=0 no op, R/W=0 write, 1 read (p64); SRAM flip-flops, DRAM capacitors with refresh (p65). Never in past finals.
- Aha: The L18 decoder becomes chip select: wider = side by side, deeper = decoder.
- Sources: L19 p59-69; R09 p49; R10 p45-49

Callouts:
- Active-high NOR latch: S=R=1 invalid (Q=Q'=0); active-low NAND: S=R=0 invalid, 1,1 no change (L19 p9-12; R10 p8, p20)
- Q' is the complement, not the next state; Q(t+1) = Q+ (R10 p20)
- Latches are level-triggered, flip-flops edge-triggered (L19 p8)
- Characteristic tables for analysis, excitation tables for design (L19 p44; R10 p23)
- 'JA' = J input of flip-flop A (L19 p36)
- Arc label a/b = input/output; 2^(m+n) table rows (L19 p30, p33)
- Trace latch/FF circuits for 3 rounds until values settle (R10 p6)
- Fewest gates is not simplest SOP: KA=KB=1 + one XOR + one XNOR in T09 Q2 (T09 p3, Ans p3)
- Q' is free from the flip-flop, so B'.x needs one AND, no inverter (AY23/24 S1 Ans p13)
- Locker FSM x and y are separate lines (xy=10 P$1, 01 P$2); 'dd' on an arc wrongly includes 11 (T09 Ans p5)
- Self-correcting is defined in R10, not L19; commit don't cares to your equations, then trace every unused state; keys accept one arc out (R10 p40-43; T09 Ans p3; AY23/24 S1 Ans p13)
- Not self-correcting needs a reason: 4->1->0->0 never re-enters; 1 mark answer, 1 mark reason (AY24/25 Q16b)
- PRE/CLR are asynchronous and override the clock; check the bubble (L19 p24-25)
- J and K tied together = T flip-flop (AY25/26 Q13 key A)
- Johnson (inverted feedback) 1->0->8->12->14->15->7->3 vs ring 1->8->4->2 (AY23/24 S2 Q14)
- Unused-state behaviour must come from your own simplified equations (AY18/19 Q4b; AY17/18 Q2b)

Fixtures:
- S-R latch from Q=1: S=0,R=1; then 0,0; then 1,1 -> Q=0,Q'=1; stays; Q=Q'=0 invalid [L19 p10-11]
- Excitation Q->Q+ 0->0, 0->1, 1->0, 1->1 -> JK 0X,1X,X1,X0; SR 0X,10,01,X0; D 0,1,0,1; T 0,1,1,0 [L19 p45]
- Fig 1 D FFs A+ = A.x + B.x, B+ = A'.x, y = (A+B).x' -> x=0 all -> 00, y = 0,1,1,1; x=1: 00->01, 01->11, 10->10, 11->10, y=0 [L19 p31-34]
- Fig 2 JA=B, KA=B.x', JB=x', KB=A⊕x -> ABx 000->01, 001->00, 010->11, 011->10, 100->11, 101->10, 110->00, 111->11 [L19 p38-40]
- Fig 3 JA=B, KA=B', JB=KB=(A⊕x)' -> 000->01, 001->00, 010->10, 011->11, 100->00, 101->01, 110->11, 111->10; y=1 on 001, 010, 100, 111 (y read from table) [L19 p41-43]
- L19 Design Ex 1 (JK) -> JA = B.x', KA = B.x, JB = x, KB = (A⊕x)' [L19 p47-51]
- L19 Design Ex 2 (D) -> DA = A.B' + B.x' (Σm(2,4,5,6)); DB = A'.x + B'.x + A.B.x' (Σm(1,3,5,6)); y = B'.x [L19 p52-54]
- L19 Design Ex 3 (SR, unused 0,6,7) -> SA = B.x, RA = C.x', SB = A'.B'.x, RB = B.C + B.x, SC = x', RC = x, y = A.x; 0->1/2, 6->7/4, 7->1/4 (computed); self-correcting [L19 p55-58; R10 p42-43]
- T09 Q1 p = A.B + A'.B', TA = A.B', DB = A' + B; start 0, 3 clocks -> 0->1, 1->1, 2->0, 3->3; ends 1, outputs 1,0,0; sinks 1 and 3 [T09 Ans p1]
- T09 Q2 (x=0: 0->1->2->0; x=1: 0->2->1->0) -> JA = B⊕x, KA = 1, JB = (A⊕x)', KB = 1; 3->0 on both; self-correcting [T09 Ans p2-3]
- T09 Q3 1->3->5->7->9->11->13->15->2->4->6->1 (order reconstructed) -> DA = A.B' + A.C' + A'.B.C.D, TB = C, TC = A' + B' + C', JD = B.C, KD = A.B.C; unused 0->2, 8->10->12->14->3 (computed); self-correcting [T09 Ans p4]
- T09 Q4 locker (x=P$1, y=P$2, saturate 3) -> DA = A + y + B.x; DB = B.x' + B'.x + A.y + A.x (or + A.B) [T09 Ans p5]
- T09 SE1 table, start A, x=100010 -> states A,A,C,B,D,D,C; z = 1,0,1,1,0,0 (computed) [T09 p1]
- AY24/25 Q16 JA=B, KA=1, JB=A.C, KB=0, DC=A+B; used 2,3,5,6,7 -> 2->7, 3->7, 5->3, 6->3, 7->3; unused 0->0, 1->0, 4->1; not self-correcting; TA=1, TB=B', TC=C' [AY24/25 Ans p13]
- AY23/24 S2 Q20 states 1,2,3 input C -> JA=1, KA=0, JB=C, KB=A'+C'; 1 gate; state 0 -> 2 (C=0), 3 (C=1) [AY23/24 S2 Ans p19]
- AY23/24 S1 Q18 DA = A + B', TB = A.B'; JK design -> (a) 0->2, 1->1, 2->3, 3->3; (b) JA = B'.x, KA = 0, JB = 0, KB = x; 1 gate; state 3: x=0 -> 3, x=1 -> 2; self-correcting Yes [AY23/24 S1 Ans p13]
- AY15/16 Q7 0->1->2->3->4->5->5 mixed JK/T/D -> JA = B.C, KA = 0, TB = A'.C, DC = A + C'; 6->7, 7->7; not self-correcting [R10 p61-63]
- AY20/21 Q12b redesign with D -> DF = F'.x' + F.G, DG = G'.x' [R10 p66]
- AY25/26 Q16 table (X0 MSB) -> A+ = B.X0'.X1; B+ = A'.B'.X0.X1; G = A; labels A1 X=1, A2 No, A3 X!=3, A4 X!=1 [AY25/26 Ans p10]
- 4 D FFs, last Q' fed back, start 0001 -> 1->0->8->12->14->15->7->3->1 [AY23/24 S2 Q14]
- AY19/20 Q4b 4 D FFs from 0000 -> 0000->1000->1100->1110->1111->0111->0011->0001->0000; State(0) = A'.D' (given), State(1) = A.B', State(2) = B.C' (computed) [AY19/20 p3]
- 4K x 8 from four 1K x 8, address 2500 -> 12 bits; A11A10 -> 2x4 decoder; chip 2 (2048-3071), internal 452 (computed) [L19 p68]
- 2M x 32 from 512K x 8 -> 16 chips (4 x 4), 21-bit address, A20A19 -> 2x4 decoder, 19-bit chip address [L19 p69]
- J and K tied -> T flip-flop (A) [AY25/26 Q13]

## Reference tables

One searchable, printable place for the course tables every tool relies on, with cheat-sheet print mode (no citations, numeric register numbers first) and a list of conventions where sources disagree.

### [2] Course reference cards
Searchable cards, each linking to the tool that uses it: registers $0-$31 numeric first then alias, binary, hex, use (L06 p25; L08 p7); opcode/funct from the official green card in Cheatsheets/ (L08 p47-50 is image-only); formats and field widths (L08); immediate kinds C5, C16, C16_2s (L06 p45); C precedence and sizeof (L02C p9; L02A p24-26); ASCII basics ('A' = 65, 'a'-'A' = 32); control table, ALUop and ALU codes, funct codes (L12 p26, p32, p34; L11 p34); Boolean laws (L13 p10-12); K-map index layouts (L15 p16, p19); characteristic and excitation tables (L19 p45); stall rules (L21); cache formulas (L22-L23; R12 p47); MSI function tables where text-recoverable. Print mode follows the student's cheat-sheet rules: no citations, clear tables, numeric register numbers before aliases. Reuse Cheatsheets/MIPS Conversion Reference v4 content.
- Aha: Every tool reads from the same tables, so a fix lands everywhere.
- Sources: L02C p9; L06 p25, p45; L08 p7, p47-50; L11 p34; L12 p26, p32, p34; L13 p10-12; L15 p16, p19; L19 p45; L21; R12 p47; Cheatsheets/MIPS Conversion Reference v4

### [2] Conventions and known-conflicts card
Table of each conflict, the default the app uses, and the toggle: endianness (R02 p8 vs L10 p17-18); jal PC+4 vs PC+8 (Lab 5 p3 vs green card); QtSpim text start 0x00400000 vs 0x00400024 (Lab 3 p5 vs Lab 5); pointer size 4 vs 8 (midterm Q12 vs lab machines); j resolution stage (papers ID, T10 MEM); +1 restart; sw in data cache; miss-type labels (R12 vs L23 p28); self-correcting strict vs course; stage attribution (L12 p5 vs L20 p27); 'simplest' tie-break; predict-taken extension.
- Aha: Most 'wrong' answers are a different convention, not a different concept.
- Sources: R02 p8; L10 p17-18; Lab 3 p5; Lab 5 p3; Midterm AY25/26 Q12; T10 Additional; AY23/24 S2 Q17; R12 p21-25; L23 p28; R10 p40-43; L12 p5; L20 p27; L15 p4, p12, p34; R11 Q7

### [3] IEEE 754 anatomy and special-values card (non-interactive)
Static card: sign/exponent/fraction layout for single, double and half; bias 127 / 1023 / 2^(k-1)-1; implicit leading 1; smallest normal 2^-126, smallest denormal 2^-149; specials; rounding modes. No conversion drills (excluded by the brief), though one IEEE MCQ appears in each recent paper (AY23/24 S2 Q5, AY25/26 Q3, AY24/25 Q9).
- Aha: Bias follows one pattern: 2^(k-1) - 1 for a k-bit exponent.
- Sources: L03D p5-8; L09; R01 p41-47; R04 p32; AY23/24 S2 Q5; AY25/26 Q3; AY24/25 Q9; AY18/19 Q2; CODEX_CONTEXT section 6

Callouts:
- Student cheat sheets are not official: Finals Notes writes M0 = X.Y (should be x+y) and Σm(1,4,5,6) = ΠM(0,2,3) (lecture has Σm(1,4,5,6,7)) (Finals Notes p7 vs L13 p20, p25)
- Templates.pdf has errors: 'sll $rd,$rt,$rt' should use shamt; its hex lookup stops at D (CODEX_CONTEXT section 5)
- R04 p32 and L09 p11 say round toward -inf picks the value 'nearest to positive infinity': slide typo, it is nearer -inf (R04 p32; L09 guide)
- Lab Tutor Cheatsheet says branch outcome 'not known till EX'; course model decides in MEM (Lab Tutor Cheatsheet p3; L21 p30-32)
- Decoder-count formula (2^n-1)/(2^k-1) comes from a student sheet; it agrees with R09 p18 (Finals Notes p10-11)

Fixtures:
- Half-precision exponent bias -> 2^(5-1) - 1 = 15 (C) [AY24/25 Q9]
- -0.3 in single -> truncation 0xBE999999; round-to-nearest 0xBE99999A (computed; paper mixes the two) [AY18/19 Q2]
- 0xC0D00000 as float -> -6.5 [R01 p43; L03D p8]
- Opcodes -> R 0x00, j 0x02, beq 0x04, addi 0x08, lui 0x0F, lw 0x23, sw 0x2B [L12 p32; L08 p41; AY25/26 Q6]
- ALU codes -> AND 0000, OR 0001, add 0010, sub 0110, slt 0111, NOR 1100 [L11 p34]
- nop -> sll $zero,$zero,0 = 0x00000000 [T04 Q2e]

## Past-paper answer checker presets

One click from a past-paper question to the right tool preloaded, with exam-format answer checking and an errata layer for known key problems. AY24/25 and AY25/26 Sem 1 are near clones with new numbers.

### [1] Past-paper preset launcher with errata layer
Choose paper + question or a template ('pipeline (a)-(e)', 'tag-bits MCQ', 'decoder + gate', 'K-map PI/EPI', 'MIPS trace + encode', 'cache final state', 'sequential design'). Opens the matching tool with the paper's numbers; expected answer hidden until the student commits; source badge keyed / computed-not-keyed / derived; errata badges where the key has problems; marks per part for time planning; recurring-template map from guides/Past Finals 2. MCQ letters for AY24/25 and AY25/26 come from rendered red text (inventory), not text extract.
- Aha: Same templates every year with new numbers.
- Sources: guides/Past Finals 2, 4; past-finals/*.md inventories; R11 Addendum; all AY15/16-AY25/26 papers and keys; Midterm AY25/26

### [1] FITB answer linter and format validator
Question-type selector, typed answer, target from a tool or preset. Boolean rules: capitals; ' NOT, . AND, + OR; no spaces; literals alphabetical in each product; constants 0/1 allowed; no trailing full stop; EPIs first when required; truth-table equivalence with differing minterms; minimality vs optimum. Format validators: ascending minterm lists '2,5,6'; 'index,offset' pairs; 8 hex digits without 0x (Examplify) or 0x-prefixed (paper); exact-length binary strings with X; 'M[0x1020]' and '0x00000081'; single decimal; register number only ('8'); MUX selectors S1 then S0 ('AC'); C statements without spaces or semicolon ('C[k]=A[i]+B[i]'); comma lists without spaces; MRQ letter sets (all-or-nothing). PASS/FAIL with the rule or minterm that fails; accepts dot-less AY23/24 S2 Q19d key strings with a warning.
- Aha: A logically right answer can still fail on format: 'X+Z.Y'' is rejected.
- Sources: AY23/24 S2 Ans p7-8, p11-14; AY23/24 S1 Ans p8, p10, p12, p14-15; AY24/25 Q17 note p8; AY25/26 Q17 note p11; AY21/22 S1 p5 (MRQ rules)

Callouts:
- AY23/24 S1 'answers at a glance' errors: Q17d is m(0,3,12,15) not m(0,15); Q18b KB is x not B.x, gate count 1 not 2 (AY23/24 S1 Ans p11, p13 vs p19; R08 p42)
- AY25/26 key is marked Draft; Q20(e) reason ('search time goes up') is about hit time, not penalty; Q12 derivation has typos
- AY24/25 Q19(c) key says '$s5 in Inst3 forwarded to Inst4', but Inst4 never reads $s5; the removed stall is Inst4->Inst5; counts are right
- AY24/25 Q20(d) accepts 95 or 96 total; 96 = 32 x (0.95 + 0.05 x 41), 95 looks like a rounding slip: explain, don't encode
- AY23/24 S2 Q18(c) key says offset 3 bits and set 0 for 4-word blocks; correct is 4 bits and set 1; 5 misses unaffected
- AY23/24 S2 Q19(d) key strings lack AND dots ('B'D+A'B+BD'') though the question requires them
- AY23/24 S1 Q16(a) worked answer 'Register $8' vs glance '8'; format asks for the number
- Paper/key typos: T03 Q3(c) 0xFFFFFFFF44 should be 0xFFFFFF44; AY24/25 Q18c 'exit = 0x1011' means 11; AY23/24 S1 Q12 'slt $2,$2,124' should be slti; AY24/25 Q13 and AY25/26 Q2 'bne $s0, 0, Loop' read as $zero; R06's AY24/25 Q28 PC 0x491 is unaligned and prints 0x100000103 with an extra 0
- T10 Answers p8 shows 'ALUOp = 2' for beq in ID; control table gives 01 (check the PDF)
- R11 Addendum calls AY25/26's pipeline question Q20; the paper calls it Q19
- No keys for AY15/16-AY21/22 S2 or the AY25/26 midterm; AY25/26 Q10 key says only 'compile and run it'
- Stall wording differs by key (stall events vs cycles); always report cycles
- Formatting: literals alphabetical in each product using ' . +; constants 0/1 count as SOP (AY23/24 S2 Ans p12-13; AY25/26 p11)

Fixtures:
- 'Y'.Z+X' -> accepted; 'X+Z.Y'' -> rejected (literal order) [AY23/24 S2 p12]
- Examplify hex for slt $t1,$t0,$s0 -> '0110482A' (lowercase also accepted) [AY23/24 S2 p8, p16]
- Array answer format -> '10,12,18,20,555,666,777,888' [AY23/24 S2 Q16d]
- C statement format -> 'C[k]=A[i]+B[i]' [AY23/24 S2 Q16b]
- Index,offset pair -> '7,4' [AY23/24 S2 Q18d]
- Cache table format -> tag '0x00000081', word 'M[0x1020]' [AY23/24 S1 Q20]
- MUX selector format -> 'AC' [AY23/24 S2 Q21a]
- Register-number format -> '8' [AY23/24 S1 Q16a]

## Cross-cutting
- Uniform step / back / run-to / reset controls with keyboard shortcuts on every tracer (C, MIPS, datapath, pipeline, cache, sequential); every run is deterministic and replayable
- Predict-then-check mode everywhere: the student commits an answer (or confidence 1-5) before reveal; the tool diffs to the first wrong step, cell or node and classifies the error (conceptual, calculation, syntax, careless reading); no answer shown while still attempting
- Fresh transfer question after a mistake: each template (address split, encoding, branch offset, K-map, pipeline (a)-(e), pipeline x cache, comparator MCQ, decoder + gate) can regenerate with new numbers
- Shareable URL state: config + input encoded in the URL hash so a setup opens identically elsewhere; localStorage only for per-viewer conveniences (last tab, weak-spot log for the 50/30/20 recent/weak/cumulative mix), wrapped in try/catch
- Presets from lectures, tutorials, recitations and past papers, each with a badge: keyed, computed-not-keyed, derived, constructed, lab-derived, beyond-slides, exam-gap, non-examinable, off-syllabus
- Citation chip (Lxx pN) on every rule and convention, hideable for cheat-sheet/print mode
- Exam-syntax output: copy-in-exam-format button (Examplify 8 hex caps no 0x, paper 0x, ' . + with alphabetical literals, ascending Σm lists, M[0x...], 0x%08x tags, comma lists without spaces); all answers pass through the shared FITB linter
- Global assumptions bar shown as chips on every tool where they matter, never chosen silently: endianness, pointer size 4/8, word size, address width, register naming ($t0 vs $8), complemented literals unavailable / constants available (default), sw uses data cache, j resolve stage, branch stage, +1 restart, miss-type labelling
- Linked engines: MIPS stepper exports dynamic trace to the pipeline simulator and fetch/data streams to the cache simulator; C array calculator feeds cache array bases; one K-map engine serves Boolean, MSI and sequential design; one control table serves datapath, pipeline and flashcards; one encoder serves MIPS, datapath and pipeline
- Teach-only-what-was-taught: beyond-slides material (WAR/WAW out-of-order demo, write-buffer timing, struct padding, predict-taken, FIFO/LFU/Random, forwarding-unit equations, multilevel caches, Q-M) behind a labelled toggle
- One semantic colour system across modules: instruction fields (opcode, rs, rt, rd, shamt, funct, imm, target) identical in encoder, datapath and pipeline; tag/index/offset identical in splitter and stepper; RAW red, WAR amber, WAW violet; hit/miss; pointer boxes; colour-blind safe with shape/label redundancy; light and dark themes; avoid templated card-grid look
- Diagram fidelity: rebuild diagram-only slide content by rendering the PDF pages (python3 + fitz), not from text extracts, before building presets or copying a diagram style
- Shared flashcard engine (spaced repetition) for C spot-the-error, control signals by stage, hazard facts, FF tables and minterm/maxterm drill; every card links to a preloaded tracer
- Minimum-survival mode: a three-question review drawn from weak spots when time is short
- Robust input parsing: map smart quotes and en dashes to ASCII in pasted slide code; accept register names or numbers; dec/hex/binary everywhere; ranges like Σm(1,4-7)
- Academic integrity: no presets or check modes for Assignment 1/2 or marked-lab questions; lab-derived values shown only as reference unless the student confirms those labs are closed
- Plain wording: small concrete example first, short 'aha' line per tool, no filler copy; works at phone width with keyboard navigation and ARIA labels

## Open questions
- Endianness default: R02 p8 says 'our MIPS' is big-endian, L10 p17 says implementation-specific, L10 p18 says the online interpreter is little-endian, and AY18/19 Q1f never states it. Proposed: big for exam mode, little for QtSpim mode, always visible
- Miss classification: R12 p21-25 labels repeat DM/SA misses as conflict, while L23 p28 3C accounting makes some of them capacity (L23 p32-34 address 0). Which label is the default, and is the other shown alongside?
- Self-correcting: keys accept a single arc out of an unused state even when another input keeps it there (AY23/24 S1 Q18 state 3). Default to the course view with a strict view toggle?
- Branch handling definitions: T10 Additional models 'no mechanism' as stall-until-resolved, AY23/24 S1 Q5 treats 'no handling' as wrong-path execution. Also j resolution (ID in papers, MEM in T10) and predict-taken target timing (R11 Q7)
- lw followed by a sw storing the loaded register: course model treats every operand as needed at EX start (1 stall); a student sheet lists MEM->MEM forwarding. Offer a labelled toggle or not?
- Early-branch cases not stated in L21: lw two instructions ahead (derived 1 stall) and ALU two ahead (0 stalls, implied by T10 Additional c). Adopt the derived values?
- Miss penalty +1 restart: AY24/25 accepts 40 or 41, AY25/26 includes it (21). Default off unless the question says so?
- Does sw use the data cache by default (varies by paper; AY23/24 S1 accepted both)? And which write-policy pairing is the default when a question is silent?
- Free-way placement: lectures fill the first invalid way, AY23/24 S1 Q20b displays Way 0 as the lower address. Default display?
- Spatial vs temporal labelling of individual hits is used on slides but never defined; adopt 'same address while resident = temporal, else spatial'?
- T11 addresses 7, 95, 93, 145 are odd on a 16-bit-word machine; treat as plain byte addresses (current choice) or flag?
- Instruction-cache counting assumptions (count from I1 or loop only, init code, exit path) vary by paper; per-preset settings needed
- Pointer size default 4 (slides, midterm Q12) vs 8 (current lab machines)
- jal return address: Addr(jal)+4 (QtSpim, Lab 5 p3, lecture) vs PC+8 (green card). QtSpim start address 0x00400000 vs 0x00400024 depends on simulator settings
- Expanding opcode: prefix-tree and budget-equation methods can disagree; the student's midterm Q20 dispute (key 198 vs 142) cannot be checked because that question is not in the folder
- 'Simplest' tie-break: L15 p4 focuses on literals, L15 p12/p34 ask fewest terms and literals; current checks minimise terms then literals
- Gate delay model: inverter delay never stated; R08 uses uniform t, AY17/18 uses fan-in n.t; tPHL/tPLH only in a student sheet
- Stage attribution of RegDst/RegWrite (L12 p5 Decode vs L20 p27 EX/WB): which label leads in the control explorer?
- AY15/16 Q9b (MemtoReg stuck at 1) depends on whether memory outputs data when MemRead = 0 (L11 p40 says only if MemRead). Show both?
- AY21/22 S1 Q7 options A/B ('Cats' if big/little endian) are ambiguous with no key; show both readings
- AY25/26 Q4: L21 p14 says WAW is not a hazard here, the key answers E (WAW hazard). Present both, but which does the quiz mark correct?
- Scope edges: Gray code only inside K-map ordering (brief excludes number conversion)? IEEE only as a static card? Build L09 rounding/specials explainer at all? Build Q-M, PLA/ROM, memory arrays, multilevel caches (no past-paper use)?
- Counters and shift registers are not taught by name but appear in AY23/24 S2 Q14 and AY19/20 Q4b; framing as D-FF analysis is assumed
- Multi-cycle CPI from an instruction mix is never derived in lecture (L20 p31 gives 4.6) but AY23/24 S1 Q3 and AY15/16 Q3 need it; skip-unused-stages model assumed
- Forwarding-unit rules and hazard-detection signals are 'not tested' (R11 p14-20) yet T10 Q2 asks which rule fired and AY23/24 S1 Q19 uses PCWrite/IF/IDWrite: expert panel only?
- Non-lecture instructions (addu, addiu, lbu, lh, sh, sltu, syscall, .data/.word) appear in recent papers and labs; support them marked non-lecture, as assumed?
- Computed-not-keyed fixtures must be confirmed by the built simulators before shipping as tests, especially Midterm Q17 (E) and Q18 (D), the T09 Q3 state order, the AY25/26 Q1 K-map reconstruction, the T08 Q5 wiring inference, the T05 critical-path values and all AY15/16-AY21/22 answers
- Pages to render from PDFs before presets: L11 p12-48, L12 p7/p19-22/p30/p33-34, L20 p13-29, all L21 timing grids, T10 Answers p5-22, R05 p39-48, R06 p30-38, R11 p40-43, L22 p30-62, L23 p6/p13-35, R12 p12/p35-37, L14 p3-22, L15 p31/p37, T06 Q3 layout, T08 SE1-3/Q2/Q4/Q5, L18 p21-22/p46-47/p50, L19 p41, R02 p8/p25/p44/p46-62, R03 p46-70, R04 p42-47, L08 p8/p47-50, midterm Q20-24, AY25/26 Q18 table and the listed exam circuit diagrams
- Lab-derived values (Lab 2, 3, 4, 5) come from marked labs, and the Lab 2 file is a filled report sheet with personal details at the top: confirm whether they may appear as presets or reference only
- Build order: per the system clock it is Saturday 2026-11-21 and the final is Wednesday 2026-11-25, 17:00-19:00. Which P1 subset ships first? Suggested: pipeline simulator + template runner, cache stepper + address splitter + pipeline x cache timer, K-map Studio, MIPS encoder/stepper, sequential design wizard, MSI comparator/decoder/MUX tools, FITB linter

## Completeness critic: missing topics
- **Floating-point range, precision, rounding modes, loss of associativity, special values, and the small AI formats (FP4 E2M1, FP8 E4M3/E5M2, FP16, BF16, FP32, FP64). The catalogue only has a static IEEE card plus the (float)X == (float)(X+1) overlay.** (L09 p6-8 (range, precision; 'precision is relative, dependent on the exponent' p7), p9-11 (X/Y neighbours, 4 rounding modes, tie goes to the neighbour with LSB 0), p12 (associativity destroyed), p14 (special-value table), p16 (format table); R01 p44-47; R04 p30-33; T04 Q1 + Ans p1; Midterm AY25/26 Q6; AY24/25 Q9; AY25/26 Q3. guides/Past Finals 2 lists 'IEEE 754, one MCQ, every recent paper'.): Priority 2. 'Float number-line lab'. The user picks a format from the L09 p16 presets. The tool draws every representable value for FP4/FP8, or a zoomable window for FP16/BF16/FP32, with bands for +-0, denormal, normal, +-inf and NaN (L09 p14). Gaps visibly double at each exponent step. The user drops in a decimal value and sees the two neighbours X and Y, plus the value each of the 4 rounding modes picks (L09 p9-11). A second panel computes (A+B)+C vs A+(B+C), rounding after every operation (L09 p12, R01 p45). Bits appear only as anatomy, with no encode/decode drill, to respect the brief. Fixtures (all computed, no key): T04 Q1a 2^16 fits BF16 but not FP16, whose largest exponent is 15 (Ans p1); T04 Q1b 16,777,217 (Ans p1); AY25/26 Q3 0x3f245000 (0.641845703125) + 1.0 = 0x3fd22800, option C; AY24/25 Q9 bias 15. This tension with the brief should be decided by the student.
- **2s/1s-complement addition and subtraction, overflow detection, 1s-complement end-around carry, excess-K, and 'why it works' (modular wheel). These are arithmetic, not conversions. The catalogue only shows 2147483647+1 wrapping.** (L03C p3-16 (p4 rule: overflow iff carry-in and carry-out of the MSB differ; p5 examples; p13-14 end-around carry; p15-16 excess); R01 p28-36 (p35 'Finite cyclic group algebra!' with -3+6, 3+2, -3+2, -3-1); R04 p3-5 (the two complement definitions); T01 Q1-2; Midterm AY25/26 Q3): Priority 3. 'Integer wheel and overflow lab' (n = 4 default). A circular dial of bit patterns is labelled unsigned / 2s / 1s / excess-8 at once. An addition moves a pointer round the wheel, and crossing the 0111/1000 seam flashes OVERFLOW. Column addition shows Cin and Cout of the MSB with the L03C p4 rule. A 1s-complement mode animates the end-around carry, and subtraction is shown as A + (-B). This could share the ripple-adder stepper with a V = C4 xor C3 flag. Fixtures: 0101+0110 = 1011, overflow (5+6 shows -5); 1001+1101 = 0110 after discarding the carry, overflow (-7 + -3 shows 6) (L03C p5); 0011+0100 = 0111; 1110+1010 = 1000, no overflow; 0110+1101 = 0011; 0100+1001 = 1101 (L03C p6-9). The brief may also exclude this.
- **C preprocessor and program structure: macro substitution, conditional compilation, #define vs const, declaration vs definition (extern).** (L02A p17, p27-31 (p31 'What the compiler sees' PI -> 3.142; p30 #if defined(DEBUG), gcc -DDEBUG/-UDEBUG); R01 p16, p18 (#if 0 hack), p19; R02 p42 (#define X 20 vs int i = 20 vs const)): Priority 3. Add a 'What the compiler sees' toggle to the C tracer, next to the catalogue's braces revealer. It shows the source after #define substitution and removes #if 0 or undefined-DEBUG blocks. #define X 20 gets no memory box, while const int i = 20 gets a read-only box. An extern declaration shows no box, but a definition does. Fixture: L02A p31 areaCircle = PI * radius * radius -> 3.142 * radius * radius.
- **printf/scanf format specifiers beyond %d %f %c %p %s: %lf for scanf of double, %e, field width and precision.** (L02A p17 (%9.2f), p33-34 (table: %f is printf for float or double; scanf needs %f for float, %lf for double; %5d, %8.3f; scanf takes no width/precision)): Priority 3. Extend the tracer console and Spot-the-Error cards. Padded output appears in cells with visible spaces. A callout reads 'scanf("%f", &d) with double d is wrong; use %lf'. Fixture (computed): MileToKm with input 10.5 gives kms 16.8945, printed as 'That equals     16.89 km.' (width 9 = 4 spaces + 16.89) (L02A p17, p20).
- **enum, plus struct initialisation and pointer-member edge cases not in the catalogue.** (R02 p35 (enum Heat {LOW=3, MEDIUM, HIGH}: defaults 4, 5); R02 p29 (struct C card1 = {888888, {31,12,2020}} with a pointer member vs = {888888, &date1}); R02 p30 (tptr->another_struct->i); R02 p38 (function pointers, 'may be too advanced')): Priority 3. The Declaration Decoder handles enum: it shows the constant values (0,1,2 by default; 3,4,5 for LOW=3) and no memory box. New Struct Builder presets: R02 p29 as a legal-or-not card (brace-initialising a pointer member is invalid; &date1 is right), and the chained -> from R02 p30 drawn as two arrows. Function pointers get at most a static card.
- **Turning compound arithmetic expressions into MIPS with temporary registers. The translator's construct list has no plain expression.** (L06 p30-32 (at most two source operands per instruction; $t0-$t7 for intermediate results); T02 Q3): Priority 3. Add an 'expression' construct to the C <-> MIPS translator. It shows the expression tree, one add/sub per operator node writing a $t register, and the count = number of binary operators. Fixtures: a = b + c - d gives add $t0,$s1,$s2; sub $s0,$t0,$s3 (2 instructions); f = (g+h)-(i+j) gives 3 using $t0, $t1; z = a+b+c+d gives 3 (add $s4,$s0,$s1; add $s4,$s4,$s2; add $s4,$s4,$s3); z = (a-b)+c gives 2 (L06 p30-32).
- **Branching far away: rewriting an out-of-range beq/bne with j, or jr across 256 MB blocks.** (L08 p42 ('Branching Far Way' challenge), L08 p38, p40; AY16/17 Q4e (furthest forward distance for BEQ/BNE/BLT/BGT, in instructions)): Priority 3. Add-on to the branch offset visualizer. When the target is beyond the 16-bit range, it rewrites 'beq $s0,$s1,L1' as 'bne $s0,$s1,skip; j L1; skip:' and shows both encodings. If L1 is outside the current 256 MB block, it falls back to la/jr. The range readout states the furthest forward target as 2^15 - 1 = 32767 instructions after PC+4 (computed).
- **Amdahl's law / 'make the common case fast'. The catalogue has a fixture (0.8t) but no feature hosts it.** (L10 p23 (instruction frequency table; first 4 operations 50% faster, rest 50% slower: T = 0.35t + 0.45t = 0.80t)): Priority 3. A small panel in the Implementation timing comparator. Inputs: fraction improved, its speed-up and the slow-down of the rest. It shows the new time as a stacked bar, with the L10 p23 numbers as the preset. The slide names Amdahl's law but gives no formula, so label any general formula as beyond-slides.
- **6-variable K-maps. The catalogue has a 6-variable fixture but only a 5-variable stacked-map feature.** (L15 p23-24 (larger K-maps)): Priority 3. Extend the 5-variable stacked map to four 4x4 floors (m0-m63), with cross-floor groups drawn as linked loops. Fixture already in the catalogue: L15 p24 Σm(6,8,14,18,23,25,27,29,41,45,57,61) -> 7 EPI terms (computed).
- **Multiple issue / superscalar as the slide hook for when WAR/WAW matter. the student explicitly asked for more on WAR/WAW. The catalogue's out-of-order mode cites no slide for it.** (L21 p14 (WAR/WAW 'do not cause any pipeline hazards... affect the processor only when instructions are executed out of program order, i.e. in Modern SuperScalar Processor'); L21 p49-50 (static vs dynamic multiple issue, 2-wide superscalar, 'For reading only')): Priority 3, labelled reading-only. A '2-wide issue' toggle in the Dependency lens and pipeline grid. Instructions pair up per cycle (L21 p50). A RAW pair cannot issue together. With out-of-order completion switched on, a WAW pair leaves the wrong final value and a WAR pair makes the reader get the new value. It sits next to the in-order proof (reads in ID, writes in WB), so the user sees why the 5-stage pipe is immune. Cite L21 p14 on the toggle.
- **Recitation quiz items not used as presets anywhere in the catalogue (the topics are covered, the presets are missing).** (R09 p60-62 (MSI quiz: Q1 truth table with B.A'.C'.D = m5, B.A.C.D' = m14, B.A.C.D = m15; Q2 G(A,B,C) with BC-selector MUX columns); R10 p51-53 (Sequential Quiz 1: T-FF and JK-FF design from an augmented state table, 'most simplified' choice); R06 p29-38 (control quiz, diagram-only)): Priority 3. Add these as presets for the decoder/MUX lab, the sequential design wizard and the control explorer. All are diagram-heavy, so render the PDF pages before taking any values: the text extract loses the cells.

## Completeness critic: doubtful claims
- Datapath conventions: 'Taught subset excludes sll/srl/j/lui (L11 p6)'. L11 p6 excludes only sll, srl and j. It never mentions lui. It also lists andi/ori in the subset while noting they are unsupported because the datapath always sign-extends. Cite lui's exclusion elsewhere or drop it from the L11 p6 cite.
- MIPS stepper: 'jal/jr marked lab-only (L07 p39)'. L07 p39 lists only 'System calls (covered in labs)'. 'Support for procedures' appears under 'Things we are not going to cover', so jal is in Lab 5 only. jr is mentioned in lecture (L08 p38, p40) for far jumps, so it is not lab-only.
- MIPS callout 'slides list MIPS (SGI) big-endian, online interpreter and QtSpim little-endian': L10 p17 gives 'MIPS (Silicon Graphics)' as big-endian and says MIPS endianness is implementation-specific. L10 p18 says only 'The online MIPS interpreter uses little-endian'. QtSpim is not named on any slide or in the Lab 3 text. The feature spec labels it an inference, but the callout states it as a slide fact.
- Linter 'shift 33 = shift 1 per T02 D2e answer': T02 Ans p2 does say this. As arithmetic it is false, because a 33-bit left shift of a 32-bit value gives 0. It only holds if the amount is truncated to the 5-bit shamt (33 mod 32 = 1). Quote the key's fix, sll $t5,$t2,1, but explain the truncation instead of teaching the equivalence as fact.
- Pipeline rule 'predict-not-taken +1 only when taken (p40-45)': the 1-cycle misprediction cost assumes the branch is decided in ID ('known in cycle 3' L21 p41-42; 'Decision making moved to ID' L21 p43). With the basic MEM decision, a misprediction flushes 3 cycles. The catalogue's own R11 fixture (PNT + MEM = 11) already models this, but the stated rule should be tied to the branch stage.
- Control callout 'PCSrc is Branch AND isZero, not a control output (L12 p16-17)': L12 p5 lists PCSrc among the 'Identified Control Signals' (stage Memory/RegWrite). Better wording: PCSrc is a control signal, but the main control unit does not output it; the control unit outputs Branch.
- Stage attribution 'L12 p5 puts RegDst/RegWrite in Decode': in the extracted L12 p5 table, RegWrite's stage reads 'Decode/Operand Fetch' and also 'RegWrite', so it may span both. MemToReg is in RegWrite and PCSrc in Memory/RegWrite. Render L12 p5 before writing the conflict card.
- Locality labeller 'slides label hits (L22 p39, L23 p19, p22) without defining it': L22 p17 does define temporal and spatial locality. Only the rule for labelling an individual hit is undefined. Reword the open question.
- Forwarding 'Forward to EX only (R11 p14)': p14 says 'For now, we consider only forwarding to EX stage', but the p16 and p18 titles read 'EX Hazard (EX -> ID)' and 'MEM Hazard (MEM -> ID)'. These probably name pipeline-register pairs. Render to confirm before any panel uses 'ID' wording. All of R11 p14-20 is marked 'not tested in Exam'.
- Completeness caveat: SLIDE_TITLES.md covers only lectures and recitations (INDEX line 7), not tutorials or labs. Tutorial and lab coverage was spot-checked (T04 Q1, T10 Ans p6-8, T11, Labs 0-5), not page-by-page. Spot checks confirmed the catalogue's T10 Ans p8 'ALUOp = 2 for beq' erratum (p6 sub = 2 and p7 lw = 0 are correct), and the T11 DM/2-way/FA traces recompute exactly.
- Verified consistent (no change needed): L21 p10-11, p30, p32, p36-39 stall and early-branch counts; L21 p43-45 (26/46/45); L22 p31-51 addresses 20, 28, 52, 32792, 16; L22 p63-65 store to 24; L23 p12, p16-22, p28, p30, p32-34; L10 p9 storage-architecture counts; L04B p5 and L04D p15/p17 fixtures; L07 p33-38 (325/245, Ex3-Ex5); L15 p37/p39-42 PI/EPI counts; all spot-checked encodings (0x1023000C, 0x8DF80000, 0x0285C822, 0x22D5FFCE, 0x3C11DEAF, 0x12C3FBAD -> 0x40BC, 0x080000AD -> -857, 0x0BFFFFD1).
