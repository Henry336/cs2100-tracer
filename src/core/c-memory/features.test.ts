/** Course features added after the verifier round: switch, comma, static, union, enum, stdin, string and math functions. */
import { describe, expect, test } from 'vitest'
import { traceC, type CellView, type TraceFrame } from './index'

const R = String.raw
const main = (body: string, before = '') => `#include <stdio.h>\n#include <string.h>\n${before}\nint main(void) {\n${body}\n  return 0;\n}\n`
const out = (src: string, cfg = {}) => {
  const t = traceC(src, cfg)
  expect(t.errors).toEqual([])
  return t.summary.output
}
function cell(f: TraceFrame, name: string): CellView | undefined {
  const walk = (cs: CellView[]): CellView | undefined => {
    for (const c of cs) {
      if (c.name === name) return c
      const k = c.children && walk(c.children)
      if (k) return k
    }
  }
  return walk([...[...f.stack].reverse().flatMap((s) => s.vars), ...f.globals, ...f.heap])
}

describe('switch (L02C p4-5)', () => {
  test('default, no match without default, and break inside a loop only leaves the switch', () => {
    expect(out(main(R`int x = 9;
  switch (x) { case 1: printf("one\n"); break; default: printf("other\n"); }
  switch (x) { case 1: printf("one\n"); }
  printf("end\n");`))).toBe('other\nend\n')
    expect(out(main(R`int i;
  for (i = 0; i < 4; i++) {
    switch (i % 2) {
      case 0: continue;
      case 1: printf("%d ", i); break;
    }
    printf("after ");
  }
  printf("\n");`))).toBe('1 after 3 after \n')
  })

  test('the frames explain the jump and the fall-through', () => {
    const t = traceC(main(R`int x = 1;
  switch (x) {
    case 1: x = 10;
    case 2: x = 20;
  }`))
    expect(t.frames.find((f) => f.kind === 'cond')!.description).toBe('x is 1, so the switch jumps to case 1 (line 7)')
    expect(t.frames.find((f) => f.line === 8)!.whys).toContainEqual(expect.objectContaining({ rule: expect.stringContaining('no break before case 2, so execution falls through'), cite: 'L02C p4-5' }))
  })

  test('compile errors: duplicate case values, case outside a switch, a double switch value', () => {
    expect(traceC(main('int x = 1; switch (x) { case 1: case 1: break; }')).errors[0].message).toMatch(/duplicate case value 1/)
    expect(traceC(main('case 1: ;')).errors[0].message).toMatch(/case is only valid directly inside a switch/)
    expect(traceC(main('double d = 1; switch (d) { case 1: break; }')).summary.runtimeError?.kind).toBe('type')
  })
})

describe('comma operator (L02C p25)', () => {
  test('gives the right value and a postfix ++ on its left is a statement of its own', () => {
    expect(out(main(R`int a, x;
  x = (a = 1, a + 2);
  printf("%d %d\n", a, x);`))).toBe('1 3\n')
    const t = traceC(main('int i, j;\n  for (i = 0, j = 3; i < j; i++, j--) ;'))
    expect(t.frames.some((f) => f.description.includes('itself gives the old value'))).toBe(false)
  })
})

describe('static locals (L04D p18; R02 p43)', () => {
  test('live with the globals, keep their value, and are not part of the frame', () => {
    const src = 'int counter(void) {\n  static int i;\n  i++;\n  return i;\n}\nint main(void) {\n  counter();\n  counter();\n  return 0;\n}\n'
    const t = traceC(src)
    expect(t.errors).toEqual([])
    const last = t.frames.at(-1)!
    expect(last.globals.find((g) => g.name === 'i')).toMatchObject({ staticIn: 'counter', value: '2', addressHex: '0x10010000' })
    const inCall = t.frames.filter((f) => f.stack.length === 2)
    expect(inCall.every((f) => f.stack[1].vars.every((v) => v.name !== 'i'))).toBe(true)
    expect(t.frames.some((f) => f.description.includes('keeps its value, 1, from the last call'))).toBe(true)
  })
})

describe('union and enum (R02 p32, p35)', () => {
  test('union members share one address; the union is as big as its largest member', () => {
    const t = traceC('union IF { int i; float f; char c; };\nint main(void) {\n  union IF u;\n  u.i = 0x41000000;\n  return 0;\n}\n')
    const u = t.frames.at(-2)!.stack[0].vars[0]
    expect(u.type).toBe('union IF')
    expect(u.size).toBe(4)
    expect(u.sizeWhy.cite).toBe('R02 p32')
    expect(u.children!.map((c) => c.addressHex)).toEqual([u.addressHex, u.addressHex, u.addressHex])
    expect(u.children!.map((c) => c.value)).toEqual(['1090519040', '8.0', "'A' (65)"])
  })

  test('enum constants work in case labels and array sizes; an enum variable is an int', () => {
    expect(out(main(R`enum Heat h = HIGH;
  int a[HIGH];
  switch (h) { case HIGH: printf("%d %d\n", h, (int)sizeof(a) / 4); break; }`, 'enum Heat { LOW, MEDIUM, HIGH };'))).toBe('2 2\n')
  })
})

describe('lexer details', () => {
  test('010 is octal 8; #if 0 switches code off; #ifdef and #else follow the macros', () => {
    expect(out(main(R`printf("%d %d\n", 010, 0);`))).toBe('8 0\n')
    expect(out(main(R`#if 0
  printf("off\n");
#else
  printf("on\n");
#endif
#ifdef N
  printf("N\n");
#endif`, '#define N 1'))).toBe('on\nN\n')
    expect(traceC(main('#endif')).errors[0].message).toMatch(/#endif without a matching #if/)
  })
})

describe('keyboard input (L05B p5-7)', () => {
  test('scanf returns how many values it read, and -1 (EOF) once the input is used up', () => {
    expect(out(main(R`int a, b, n;
  n = scanf("%d %d", &a, &b);
  printf("%d %d %d\n", n, a, b);
  printf("%d\n", scanf("%d", &a));`), { stdin: '4 -7\n' })).toBe('2 4 -7\n-1\n')
    expect(out(main(R`int a = 0;
  printf("%d %d\n", scanf("%d", &a), a);`), { stdin: 'abc' })).toBe('0 0\n')
  })

  test('%c reads one character, %lf a double, getchar the next character', () => {
    expect(out(main(R`char c; double d; int g;
  scanf("%c %lf", &c, &d);
  g = getchar();
  printf("%c %.2f %d\n", c, d, g);`), { stdin: 'x 2.5\n' })).toBe('x 2.50 10\n')
  })

  test('%f into a double is warned and leaves half of the double unset', () => {
    const t = traceC(main(R`double d;
  scanf("%f", &d);
  printf("%f\n", d);`), { stdin: '1.5' })
    expect(t.summary.warnings[0].message).toMatch(/use %lf for a double/)
    expect(t.summary.runtimeError?.kind).toBe('uninit')
  })

  test('scanf %s past the end of the array is a buffer overflow; fgets reads at most size - 1 characters', () => {
    expect(traceC(main(R`char s[4];
  scanf("%s", s);`), { stdin: 'toolong' }).summary.runtimeError?.kind).toBe('bounds')
    const t = traceC(main(R`char s[10];
  fgets(s, 4, stdin);
  printf("[%s]\n", s);`), { stdin: 'abcdef\n' })
    expect(t.summary.output).toBe('[abc]\n')
    expect(t.frames.find((f) => f.line === 6)!.whys[0]).toMatchObject({ cite: 'L05B p5-6' })
  })

  test('getchar until EOF counts every character, the newline included', () => {
    expect(out(main(R`int c, n = 0;
  while ((c = getchar()) != EOF) n++;
  printf("%d\n", n);`), { stdin: 'ab\nc' })).toBe('4\n')
  })

  test('with no input, fgets returns NULL', () => {
    expect(out(main(R`char s[4];
  if (fgets(s, 4, stdin) == NULL) printf("none\n");`))).toBe('none\n')
  })
})

describe('string, ctype and math functions', () => {
  test('strncpy pads with 0 or adds no terminator; strcat appends', () => {
    expect(out(main(R`char a[8] = "xxxxxxx", b[8];
  strncpy(a, "hi", 4);
  printf("%s %d\n", a, a[5]);
  strcpy(b, "ab");
  strcat(b, "cd");
  printf("%s %d\n", b, (int)strlen(b));`))).toBe('hi 120\nabcd 4\n')
    const t = traceC(main(R`char a[2];
  strncpy(a, "hello", 2);
  printf("%s\n", a);`))
    expect(t.summary.runtimeError?.kind).toBe('bounds')
  })

  test('strcmp explains the first differing characters', () => {
    const t = traceC(main(R`int r = strcmp("abc", "abd");`))
    const why = t.frames.flatMap((f) => f.whys).find((w) => w.cite === 'L05B p10')!
    expect(why.working).toBe("first difference at index 2: 'c' (99) - 'd' (100) = -1")
  })

  test('toupper, isdigit, abs, fabs, pow, putchar', () => {
    expect(out(main(R`putchar(toupper('q'));
  printf(" %d %d %d %.1f %.0f\n", isdigit('7'), isdigit('x'), abs(-3), fabs(-2.5), pow(2, 10));`))).toBe('Q 1 0 3 2.5 1024\n')
  })
})

describe('printf formats', () => {
  test('%p follows the slides by default and gcc on request', () => {
    const src = main(R`int a; int *n = 0;
  printf("%p %p\n", &a, n);`)
    expect(out(src)).toBe('ffbff7fc 0\n')
    expect(out(src, { pointerFormat: 'gcc' })).toBe('0xffbff7fc (nil)\n')
  })

  test('ties round to even, other values as before; flags + and space', () => {
    expect(out(main(R`printf("%.1f %.1f %.2f %.0f %.3f\n", 0.35, -0.25, 1.005, -2.5, 2.0005);`))).toBe('0.3 -0.2 1.00 -2 2.001\n')
    expect(out(main(R`printf("[%+d][% 5d][%05d][% f]\n", 5, 7, -3, 1.5);`))).toBe('[+5][    7][-0003][ 1.500000]\n')
  })
})

describe('implicit declarations (L04C p11)', () => {
  test('a void function called before its definition does not compile; a prototype fixes it', () => {
    const late = 'int main(void) {\n  f();\n  return 0;\n}\nvoid f(void) {}\n'
    const t = traceC('#include <stdio.h>\n' + late)
    expect(t.ok).toBe(false)
    expect(t.errors[0].message).toMatch(/^line 6: conflicting types for f/)
    expect(traceC('#include <stdio.h>\nvoid f(void);\n' + late).errors).toEqual([])
  })
})

describe('frames after the caching rewrite', () => {
  test('changed and prev are set only on the step that changes a cell', () => {
    const t = traceC(main('  int a = 1, b = 2;\n  a = 5;\n  b = 6;'))
    const fa = t.frames.find((f) => f.line === 6)!
    const fb = t.frames.find((f) => f.line === 7)!
    expect([cell(fa, 'a')!.changed, cell(fa, 'a')!.prev, cell(fa, 'b')!.changed]).toEqual([true, '1', false])
    expect([cell(fb, 'a')!.changed, cell(fb, 'a')!.prev, cell(fb, 'b')!.changed]).toEqual([false, undefined, true])
  })

  test('an arrow turns dangling when its target frame is popped, and array cells update one by one', () => {
    const t = traceC('int *g;\nvoid f(void) {\n  int x = 1;\n  g = &x;\n}\nint main(void) {\n  f();\n  return 0;\n}\n')
    const during = t.frames.find((f) => f.line === 4)!
    expect(during.edges[0]).toMatchObject({ fromName: 'g', toName: 'x', status: 'ok' })
    expect(t.frames.at(-1)!.edges[0]).toMatchObject({ fromName: 'g', status: 'dangling' })
    const a = traceC(main('  int a[3] = {1, 2, 3};\n  a[1] = 7;'))
    const arr = a.frames.at(-2)!.stack[0].vars[0]
    expect(arr.value).toBe('{1, 7, 3}')
    expect(arr.children!.map((c) => c.changed)).toEqual([false, true, false])
  })
})
