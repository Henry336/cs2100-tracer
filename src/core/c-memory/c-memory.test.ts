import { describe, expect, test } from 'vitest'
import { arrayAddress, endianBytes, PRESETS, structLayout, traceC, wordFromBytes, type CellView, type TraceFrame } from './index'

const vars = (f: TraceFrame) => [...f.stack.flatMap((s) => s.vars), ...f.globals, ...f.heap]
function cell(f: TraceFrame, name: string): CellView | undefined {
  const walk = (cs: CellView[]): CellView | undefined => {
    for (const c of cs) {
      if (c.name === name) return c
      const k = c.children && walk(c.children)
      if (k) return k
    }
  }
  // innermost frame first, so a callee's x wins over main's x
  return walk([...[...f.stack].reverse().flatMap((s) => s.vars), ...f.globals, ...f.heap])
}
const run = (code: string, cfg = {}) => traceC(code, cfg)
const main = (body: string, before = '') => `#include <stdio.h>\n${before}\nint main(void) {\n${body}\n  return 0;\n}\n`

describe('course presets', () => {
  for (const p of PRESETS) {
    test(`${p.id} ${p.source} [${p.status}]: ${p.title}`, () => {
      const t = run(p.code, p.config)
      if (p.expect.output !== undefined) expect(t.summary.output).toBe(p.expect.output)
      if (p.expect.errorKind) expect(t.summary.runtimeError?.kind).toBe(p.expect.errorKind)
      else expect(t.errors).toEqual([])
      expect(t.frames.length).toBeGreaterThan(1)
    })
  }
})

describe('pointers and pass by value', () => {
  test('CM02 T01 Q6 [official]: a, c and e take the values the answer key traces', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM02')!.code)
    const seq = (name: string) => t.frames.map((f) => cell(f, name)?.value).filter((v, i, a) => v !== undefined && v !== '?' && v !== a[i - 1])
    expect(seq('a')).toEqual(['3', '5', '35', '55'])
    expect(seq('c')).toEqual(['15'])
    expect(seq('e')).toEqual(['20', '0'])
    expect(t.frames.find((f) => f.line === 5)!.description).toBe('b now points to a')
    expect(t.frames.find((f) => f.line === 6)!.description).toBe('*b (that is, a) becomes 5')
  })

  test('CM10 AY23/24 S2 Q2 [official]: swapping local pointer copies has no effect on main', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM10')!.code)
    const returns = t.frames.filter((f) => f.kind === 'return' && f.stack.length > 1)
    expect(returns).toHaveLength(3)
    for (const r of returns) expect(r.description).toContain('Nothing outside mystery changed')
    expect(t.summary.output).toBe('100\n')
  })

  test('CM07 L04D p7-11 [official]: writing through *x changes main; the by-value swap does not', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM07')!.code)
    const [byValue, byAddress] = t.frames.filter((f) => f.kind === 'return' && f.stack.length > 1)
    expect(byValue.description).toContain('only worked on its own copies')
    expect(byAddress.description).toContain('Changed during the call: a, b')
    const write = t.frames.find((f) => f.description === '*x (that is, a) becomes 3')!
    const a = write.stack[0].vars.find((v) => v.name === 'a')!
    expect(a).toMatchObject({ value: '3', prev: '2', changed: true })
    // frames: labelled like the slides, the callee pops after its return step
    expect(byAddress.stack.map((s) => s.label)).toEqual(['In main():', 'In swapAddresses():'])
    expect(byAddress.stack[1].returning).toBe(true)
    expect(t.frames[t.frames.indexOf(byAddress) + 1].stack).toHaveLength(1)
    // pointer parameters draw arrows across the frame wall into main
    const call = t.frames.find((f) => f.kind === 'call' && f.description.startsWith('swapAddresses'))!
    expect(call.edges.map((e) => [e.fromName, e.toName, e.status])).toEqual([
      ['x', 'a', 'ok'],
      ['y', 'b', 'ok'],
    ])
    expect(call.whys.some((w) => w.cite === 'L04D p3')).toBe(true)
  })

  test('CM01 L04B p3-4 [official]: p2 and p3 alias c', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM01')!.code)
    const f = t.frames.find((x) => x.description === 'p3 now points to c')!
    expect(f.aliases).toEqual([{ toId: expect.any(String), toName: 'c', from: ['p2', 'p3'] }])
  })

  test('CM05 L04B p5 [official]: pointer steps scale by the pointee size, with the rule cited', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM05')!.code, { stackTop: 0xffbff0a8 })
    const dp = t.frames.find((f) => f.description.startsWith('dp now points to 0xffbff098'))!
    expect(dp.whys).toContainEqual({ rule: expect.stringContaining('sizeof(double) = k x 8'), working: 'dp++: 0xffbff090 + 1 x 8 = 0xffbff098', cite: 'L04B p5' })
    // the char sits at an odd address and the double is rounded down to a multiple of 8, as on the slide
    const d = cell(t.frames[5], 'd')!
    expect(d.addressHex).toBe('0xffbff090')
    expect(d.addressWhy.working).toBe('0xffbff09f - 8 = 0xffbff097, rounded down to a multiple of 8: 0xffbff090')
  })

  test('CM09 L04D p15 [official]: each later local is 4 bytes lower', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM09')!.code, { stackTop: 0xffbff790 })
    const f = t.frames.find((x) => x.kind === 'decl')!
    expect(f.stack[0].vars.map((v) => v.addressHex)).toEqual(['0xffbff78c', '0xffbff788', '0xffbff784'])
    expect(f.stack[0].vars[1].addressWhy.cite).toBe('L04D p15')
  })

  test('L04B p6 [official]: an uninitialised pointer is shown as ? and following it is a segfault', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM36')!.code)
    const last = t.frames[t.frames.length - 1]
    expect(cell(t.frames[1], 'n')).toMatchObject({ value: '?', initialised: false, kind: 'pointer', pointsTo: null })
    expect(last.kind).toBe('error')
    expect(last.error).toMatchObject({ line: 5, kind: 'segfault', cite: 'L04B p6' })
    expect(t.errors[0].message).toMatch(/^line 5: n has no value yet/)
  })

  test('L02A p22: reading an uninitialised int stops with a garbage message; globals start at 0', () => {
    const t = run(main('  int x;\n  printf("%d %d\\n", g, x);', 'int g;'))
    expect(t.summary.runtimeError).toMatchObject({ kind: 'uninit', cite: 'L02A p22', line: 5 })
    expect(t.frames[0].globals[0]).toMatchObject({ name: 'g', value: '0', addressHex: '0x10010000' })
  })

  test('R02 p37-40: malloc block is typed by the cast, and dangles after free', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM39')!.code)
    const decl = t.frames.find((f) => f.kind === 'decl')!
    expect(decl.heap[0]).toMatchObject({ name: 'heap block 1', type: 'int', addressHex: '0x10040000', value: '?' })
    expect(decl.edges[0]).toMatchObject({ fromName: 'ptr', toName: 'heap block 1', status: 'ok' })
    const freed = t.frames.find((f) => f.description.startsWith('heap block 1 is freed'))!
    expect(freed.heap[0].freed).toBe(true)
    expect(freed.edges.every((e) => e.status === 'dangling')).toBe(true)
  })
})

describe('arrays and structs', () => {
  test('R02 p26 [derived]: int a[3][4], &a[2][1] is A0 + 36', () => {
    const r = arrayAddress({ elemSize: 4, dims: [3, 4], index: [2, 1] })
    expect(r.ok && r.answer).toBe('A0 + 36')
    expect(r.ok && r.explain.working).toBe('A0 + 4 x (2 x 4 + 1) = A0 + 4 x 9 = A0 + 36')
    expect(r.ok && r.horner).toEqual(['start with i1 = 2', '2 x 4 + 1 = 9'])
    // the tracer's own cells agree
    const t = run(main('  int a[3][4];'))
    const a = cell(t.frames[1], 'a')!
    const el = cell(t.frames[1], 'a[2][1]')!
    expect(el.address - a.address).toBe(36)
    expect(el.addressWhy.cite).toBe('R02 p26')
    expect(cell(t.frames[1], 'a[2]')!.type).toBe('int [4]')
  })

  test('R02 p26 [derived]: int m[3][4][5] at 0x10010000, &m[2][1][3] = 0x100100C0', () => {
    const r = arrayAddress({ base: 0x10010000, elemSize: 4, dims: [3, 4, 5], index: [2, 1, 3] })
    expect(r.ok && r.addressHex).toBe('0x100100c0')
    expect(r.ok && r.explain.working).toBe('0x10010000 + 4 x (2 x 4 x 5 + 1 x 5 + 3) = 0x10010000 + 4 x 48 = 0x10010000 + 192 = 0x100100c0')
    expect(run(PRESETS.find((p) => p.id === 'CM40')!.code).summary.output).toBe('10010000\n100100c0\n')
  })

  test('Exam Prep Extras p7 [derived]: int C[4][3][2], C[2][1][0] is 56 bytes in', () => {
    const r = arrayAddress({ elemSize: 4, dims: [4, 3, 2], index: [2, 1, 0] })
    expect(r.ok && r.offsetBytes).toBe(56)
  })

  test('arrayAddress rejects bad input and offers column-major for comparison', () => {
    expect(arrayAddress({ elemSize: 4, dims: [3, 4], index: [3, 0] })).toMatchObject({ ok: false, error: expect.stringContaining('out of range') })
    expect(arrayAddress({ elemSize: 4, dims: [3, 4], index: [1] }).ok).toBe(false)
    const col = arrayAddress({ elemSize: 4, dims: [3, 4], index: [2, 1], order: 'column' })
    expect(col.ok && col.offsetBytes).toBe(4 * (2 + 1 * 3))
  })

  test('L05C p12 vs L05A p9: struct assignment copies, array assignment is an error', () => {
    const t = run(main('  struct pt s1 = {1, 2}, s2;\n  s2 = s1;\n  s1.x = 9;\n  printf("%d %d\\n", s2.x, s1.x);', 'struct pt { int x; int y; };'))
    expect(t.summary.output).toBe('1 9\n')
    expect(t.frames.find((f) => f.description.startsWith('s2 gets a copy'))!.whys[0].cite).toBe('L05C p12')
    const bad = run(main('  int a[3] = {1, 2, 3}, b[3];\n  b = a;'))
    expect(bad.summary.runtimeError).toMatchObject({ kind: 'type', cite: 'L05A p9', line: 5 })
  })

  test('struct layout has no padding and says so', () => {
    const r = structLayout([
      { name: 'stuNum', type: 'int', size: 4 },
      { name: 'score', type: 'float', size: 4 },
      { name: 'grade', type: 'char', size: 1 },
    ], 0x1000)
    expect(r.size).toBe(9)
    expect(r.members.map((m) => m.offset)).toEqual([0, 4, 8])
    expect(r.members[2].addressHex).toBe('0x00001008')
    expect(r.explain.rule).toContain('no padding')
    const t = run(PRESETS.find((p) => p.id === 'CM20')!.code)
    const r1 = cell(t.frames[1], 'result1')!
    expect(r1).toMatchObject({ size: 9, value: "{stuNum = 123321, score = 93.5, grade = 'A'}" })
    expect(r1.children!.map((c) => c.address - r1.address)).toEqual([0, 4, 8])
  })

  test('CM23 AY21/22 S2 Q3 [derived]: the copied pointer member still reaches main', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM23')!.code)
    const ret = t.frames.find((f) => f.kind === 'return' && f.stack.length > 1)!
    expect(ret.description).toContain('Changed during the call: z')
  })

  test('strings: char arrays show as text, missing room for the terminator is warned', () => {
    const t = run(main('  char s[6] = "apple";\n  char t[3] = "abc";'))
    expect(cell(t.frames[1], 's')!.value).toBe('"apple"')
    expect(cell(t.frames[2], 't')!.value).toBe("{'a', 'b', 'c'}")
    expect(t.summary.warnings[0].message).toContain("not the '\\0'")
  })
})

describe('bytes and endianness', () => {
  test("a variable's bytes follow the chosen endianness", () => {
    const code = main('  int x = 0x12345678;')
    expect(cell(run(code).frames[1], 'x')).toMatchObject({ value: '305419896' })
    expect((vars(run(code).frames[1])[0] as { bytes: number[] }).bytes).toEqual([0x12, 0x34, 0x56, 0x78])
    expect((vars(run(code, { endian: 'little' }).frames[1])[0] as { bytes: number[] }).bytes).toEqual([0x78, 0x56, 0x34, 0x12])
  })

  test('L10 p17 [official]: 0xDEADBEEF is DE AD BE EF big-endian and EF BE AD DE little-endian', () => {
    expect(endianBytes(0xdeadbeef, 'big', 4, 0).map((b) => b.hex)).toEqual(['de', 'ad', 'be', 'ef'])
    expect(endianBytes(0xdeadbeef, 'little').map((b) => b.hex)).toEqual(['ef', 'be', 'ad', 'de'])
    expect(endianBytes(0xdeadbeef, 'big')[0]).toMatchObject({ bits: '31-24', significance: 'most significant byte' })
  })

  test('AY21/22 S1 Q7 [derived]: bytes 43 61 74 73 read as Cats either way, but different ints', () => {
    const bytes = [0x43, 0x61, 0x74, 0x73]
    expect(wordFromBytes(bytes, 'big')).toMatchObject({ unsigned: 1130460275, chars: 'Cats' })
    expect(wordFromBytes(bytes, 'little')).toMatchObject({ unsigned: 1937006915, chars: 'Cats' })
  })

  test('pointer size 8 changes sizeof a pointer and pointer cells', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM35')!.code, { pointerSize: 8 })
    expect(t.summary.output).toBe('4\n8\n')
    const p = run(main('  int a = 1;\n  int *p = &a;'), { pointerSize: 8 })
    expect(cell(p.frames[2], 'p')).toMatchObject({ size: 8, value: '0xffbff7fc' })
  })
})

describe('errors and limits', () => {
  test('parse errors carry line numbers and plain messages', () => {
    expect(run(main('  int x = 5\n  x++;')).errors[0].message).toBe("line 4: expected ';' but found 'x'")
    expect(run(main('  goto end;')).errors[0].message).toMatch(/^line 4: goto is not supported/)
    expect(run(main('  unsigned int u;')).errors[0].message).toMatch(/^line 4: unsigned types are not supported/)
    expect(run('int f(void) { return 1; }').errors[0].message).toContain('needs a main function')
    expect(run(main('  int a[];')).errors[0].message).toBe('line 4: array a needs a size or an initialiser')
    expect(run(main('  char c = \'ab\';')).ok).toBe(false)
  })

  test('runtime type errors follow the slides', () => {
    expect(run(main('  double a, b = &a;')).summary.runtimeError).toMatchObject({ cite: 'L04A p15', line: 4 })
    expect(run(main('  y = 1;')).summary.runtimeError?.message).toBe('line 4: y is not declared here. C looks up names in the enclosing blocks and the globals only')
    expect(run(main('  int x = 1 / 0;')).summary.runtimeError?.kind).toBe('div0')
    expect(run(main('  scanf("%d", 0);'), { stdin: '5' }).summary.runtimeError?.kind).toBe('segfault')
    // '.' binds tighter than '*', so *q.age is *(q.age) (L05D p10)
    const dot = run(main('  struct p a = {3};\n  struct p *q = &a;\n  printf("%d", *q.age);', 'struct p { int age; };'))
    expect(dot.summary.runtimeError).toMatchObject({ cite: 'L05D p10', message: expect.stringContaining('use ->') })
    expect(run(main('  char *s = "hi";\n  s[0] = \'H\';')).summary.runtimeError?.kind).toBe('readonly')
  })

  test('indexing past either end of an array stops and names what it would hit', () => {
    const hi = run(main('  int a[3] = {1, 2, 3};\n  int b = 9;\n  a[3] = 5;'))
    expect(hi.summary.runtimeError?.message).toBe(
      'line 6: a[3] is outside a (valid indices 0 to 2). C does not check array bounds: this write would land on memory that belongs to no variable',
    )
    const lo = run(main('  int a[3] = {1, 2, 3};\n  int b = 9;\n  a[-1] = 5;'))
    expect(lo.summary.runtimeError?.message).toContain('would land on b')
    // taking the address one past the end is fine
    expect(run(main('  int a[3];\n  int *end = &a[3];')).ok).toBe(true)
  })

  test('recursion, struct return values and 2D array parameters', () => {
    expect(run(main('  printf("%d\\n", fact(5));', 'int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}')).summary.output).toBe('120\n')
    const s = run(main('  pt_t q = make(3, 4);\n  printf("%d %d\\n", q.x, q.y);', 'typedef struct { int x, y; } pt_t;\npt_t make(int a, int b) {\n  pt_t p;\n  p.x = a;\n  p.y = b;\n  return p;\n}'))
    expect(s.summary.output).toBe('3 4\n')
    const m = run(main('  int m[2][3] = {{1, 2, 3}, {4, 5, 6}};\n  printf("%d\\n", get(m, 1, 2));', 'int get(int m[][3], int r, int c) {\n  return m[r][c];\n}'))
    expect(m.summary.output).toBe('6\n')
    expect(m.frames.find((f) => f.kind === 'call' && f.stack.length > 1)!.stack[1].vars[0].type).toBe('int (*)[3]')
  })

  test('smart quotes and en dashes pasted from slides are read as ASCII', () => {
    const [lq, rq, en] = [0x201c, 0x201d, 0x2013].map((c) => String.fromCharCode(c))
    const t = run(main(`  int len = 5;\n  printf(${lq}%d\\n${rq}, len ${en} 1);`))
    expect(t.summary.output).toBe('4\n')
  })

  test('an endless loop stops at the step limit', () => {
    const t = run(main('  int i = 0;\n  while (1) i++;'), { maxSteps: 50 })
    expect(t.summary.runtimeError?.kind).toBe('limit')
    expect(t.frames).toHaveLength(51)
  })

  test('missing prototype is warned (L04C p10-11)', () => {
    // only an int function gets away with a warning; another return type does not compile (verify.course.test.ts)
    const t = run('#include <stdio.h>\nint main(void) {\n  f();\n  return 0;\n}\nint f(void) { return 0; }\n')
    expect(t.summary.warnings[0].message).toContain('add a prototype')
  })

  test('frames are plain JSON', () => {
    const t = run(PRESETS.find((p) => p.id === 'CM21')!.code)
    expect(JSON.parse(JSON.stringify(t.frames))).toEqual(t.frames)
  })
})
