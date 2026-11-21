import { describe, expect, test } from 'vitest'
import { traceC } from './index'

const main = (body: string, before = '') => `#include <stdio.h>\n${before}\nint main(void) {\n${body}\n  return 0;\n}\n`
const probes: [string, string][] = [
  ['NULL', main('int *p = NULL; if (p == NULL) printf("null\\n");')],
  ['empty', ''],
  ['spaces', '   \n  '],
  ['only main', 'int main(){}'],
  ['deep parens', main(`int x = ${'('.repeat(4000)}1${')'.repeat(4000)};`)],
  ['deep unary', main(`int x = ${'-'.repeat(1).padEnd(1)}${'- '.repeat(6000)}1;`)],
  ['octal', main('int a = 010; printf("%d\\n", a);')],
  ['hex big', main('int a = 0xFFFFFFFF; printf("%d %x\\n", a, a);')],
  ['int min', main('int a = -2147483648; printf("%d\\n", a);')],
  ['char overflow', main("char c = 127; c++; printf(\"%d\\n\", c);")],
  ['char 200', main('char c = 200; printf("%d\\n", c);')],
  ['float %f', main('float f = 0.1; printf("%f %.2f\\n", f, f);')],
  ['double div', main('double d = 7 / 2; printf("%f\\n", d);')],
  ['mixed', main('double d = 7 / 2.0; printf("%.1f\\n", d);')],
  ['neg mod', main('printf("%d %d\\n", -10 % 4, 10 % -4);')],
  ['neg div', main('printf("%d\\n", -7 / 2);')],
  ['and b', main('int b = 1; int a[3] = {1,2,3}; int *p = a; while (p < &a[3] && b) { p++; } printf("ok\\n");')],
  ['ptr cast int', main('int a; int *p = &a; printf("%d\\n", (int)p);')],
  ['label odd', main('int x = 5;; ; {} printf("%d\\n", x);')],
  ['inc on literal', main('int a = 5++;')],
  ['assign to literal', main('5 = 3;')],
  ['unterminated str', main('printf("abc);')],
  ['unterminated block', 'int main() { int a = 1;'],
  ['missing semi', main('int a = 1\n int b = 2;')],
  ['char lit empty', main("char c = '';")],
  ['two char lit', main("char c = 'ab';")],
  ['x escape', main("char c = '\\x41';")],
  ['comma op', main('int a, b; a = 1, b = 2;')],
  ['for no body', main('int i; for (i = 0; i < 3; i++); printf("%d\\n", i);')],
  ['for decl', main('for (int i = 0; i < 3; i++) printf("%d", i);')],
  ['nested shadow', main('int x = 1; { int x = 2; printf("%d", x); } printf("%d\\n", x);')],
  ['sizeof arr', main('int a[10]; printf("%d %d\\n", (int)sizeof(a), (int)(sizeof(a)/sizeof(a[0])));')],
  ['sizeof expr', main('int a[10]; printf("%d\\n", sizeof a);')],
  ['sizeof ptr param', 'void f(int a[]) { printf("%d\\n", sizeof(a)); }\nint main() { int x[10]; f(x); return 0; }'],
  ['string len', main('char s[] = "hello"; printf("%d %d\\n", strlen(s), sizeof(s));')],
  ['string empty', main('char s[] = ""; printf("[%s] %d\\n", s, strlen(s));')],
  ['char arr partial', main('char s[10] = "hi"; printf("%s %d\\n", s, s[5]);')],
  ['int arr zero', main('int a[5] = {0}; printf("%d\\n", a[4]);')],
  ['int arr partial', main('int a[5] = {1,2}; printf("%d\\n", a[4]);')],
  ['uninit arr elem', main('int a[5]; printf("%d\\n", a[0]);')],
  ['global arr', 'int g[3];\nint main() { printf("%d\\n", g[2]); return 0; }'],
  ['2d init', main('int m[2][3] = {{1,2,3},{4,5,6}}; printf("%d\\n", m[1][2]);')],
  ['2d flat init', main('int m[2][3] = {1,2,3,4,5,6}; printf("%d\\n", m[1][0]);')],
  ['ptr arith neg idx', main('int a[3] = {1,2,3}; int *p = &a[2]; printf("%d\\n", p[-2]);')],
  ['ptr diff', main('int a[5]; int *p = &a[4], *q = &a[1]; printf("%d\\n", p - q);')],
  ['while 0', main('while (0) printf("x");')],
  ['do once', main('int i = 0; do { i++; } while (0); printf("%d\\n", i);')],
  ['ternary', main('int x = 5; printf("%d\\n", x > 0 ? 0 : 1);')],
  ['nested ternary', main('int x = 0; printf("%d\\n", x > 0 ? 1 : x < 0 ? -1 : 0);')],
  ['shift', main('printf("%d %d\\n", 1 << 4, -16 >> 2);')],
  ['bitwise', main('int a = 5, b = 22; printf("%d %d %d %d\\n", a & b, a | b, a ^ b, ~a);')],
  ['char bitwise', main('char a = 5, b = 22; printf("%d\\n", ~a);')],
  ['logical', main('int a = 0; int b = (a != 0) && (10 / a > 1); printf("%d\\n", b);')],
  ['relational print', main('printf("%d %d\\n", 3 > 2, 3 < 2);')],
  ['overflow', main('int n = 2147483640; int i; for (i = 0; i < 10; i++) n++; printf("%d\\n", n);')],
  ['float trunc', main('int n = 9 * 0.5; printf("%d\\n", n);')],
  ['neg float trunc', main('int n = -2.7; printf("%d\\n", n);')],
  ['assign chain', main('int a, b, c; a = b = c = 7; printf("%d %d %d\\n", a, b, c);')],
  ['compound', main('int a = 10; a -= 3; a *= 2; a /= 4; a %= 3; a <<= 2; a |= 1; printf("%d\\n", a);')],
  ['char arith', main("char c = 'a' - 'A' + 'B'; printf(\"%c\\n\", c);")],
  ['printf pct', main('printf("100%%\\n");')],
  ['printf width', main('printf("[%5d][%-5d][%05d][%+d]\\n", 42, 42, 42, 42);')],
  ['printf neg zero pad', main('printf("[%05d]\\n", -42);')],
  ['printf e', main('printf("%e\\n", 12345.678);')],
  ['printf c int', main('printf("%c%c\\n", 72, 105);')],
  ['printf u', main('printf("%u\\n", -1);')],
  ['printf x neg', main('printf("%x %X %#x\\n", -1, 255, 255);')],
  ['printf s width', main('printf("[%5s][%-5s][%.2s]\\n", "ab", "ab", "abcd");')],
  ['printf too few', main('printf("%d %d\\n", 1);')],
  ['printf lf', main('double d = 3.14159; printf("%lf %.3lf\\n", d, d);')],
  ['printf space flag', main('printf("[% d]\\n", 42);')],
  ['printf f big', main('printf("%f\\n", 1e21);')],
  ['printf inf', main('double z = 0; printf("%f\\n", 1.0 / z);')],
  ['struct basic', 'struct point { int x; int y; };\nint main() { struct point p = {1, 2}; struct point q; q = p; q.x = 9; printf("%d %d %d\\n", p.x, q.x, q.y); return 0; }'],
  ['typedef struct', 'typedef struct { int x; char c; } pt_t;\nint main() { pt_t a = {3, \'z\'}; pt_t *p = &a; p->x++; printf("%d %c %d\\n", a.x, (*p).c, sizeof(pt_t)); return 0; }'],
  ['struct w/ array copy', 'typedef struct { char name[8]; int age; } p_t;\nint main() { p_t a = {"bob", 20}; p_t b = a; b.name[0] = \'B\'; printf("%s %s\\n", a.name, b.name); return 0; }'],
  ['struct uninit read', 'struct s { int x; };\nint main() { struct s a; struct s b = a; return 0; }'],
  ['linked list', '#include <stdlib.h>\ntypedef struct node { int v; struct node *next; } node_t;\nint main() { node_t *h = NULL; int i; for (i = 0; i < 3; i++) { node_t *n = (node_t *)malloc(sizeof(node_t)); n->v = i; n->next = h; h = n; } while (h != NULL) { printf("%d ", h->v); h = h->next; } printf("\\n"); return 0; }'],
  ['malloc 0', main('int *p = malloc(0);')],
  ['malloc neg', main('int *p = malloc(-4);')],
  ['malloc arr', main('int *p = (int *)malloc(3 * sizeof(int)); p[0] = 1; p[2] = 3; printf("%d\\n", p[2]); free(p);')],
  ['malloc oob', main('int *p = (int *)malloc(3 * sizeof(int)); p[3] = 1;')],
  ['double free', main('int *p = (int *)malloc(4); free(p); free(p);')],
  ['use after free', main('int *p = (int *)malloc(4); *p = 1; free(p); printf("%d\\n", *p);')],
  ['dangling local', 'int *f() { int x = 5; return &x; }\nint main() { int *p = f(); printf("%d\\n", *p); return 0; }'],
  ['recursion fact', 'int fact(int n) { if (n <= 1) return 1; return n * fact(n - 1); }\nint main() { printf("%d\\n", fact(10)); return 0; }'],
  ['recursion deep 100', 'int sum(int n) { if (n == 0) return 0; return n + sum(n - 1); }\nint main() { printf("%d\\n", sum(100)); return 0; }'],
  ['infinite recursion', 'int f(int n) { return f(n + 1); }\nint main() { f(0); return 0; }'],
  ['proto then def', 'int f(int);\nint main() { printf("%d\\n", f(3)); return 0; }\nint f(int x) { return x * 2; }'],
  ['unnamed proto param', 'void swap(int *, int *);\nint main() { int a = 1, b = 2; swap(&a, &b); printf("%d %d\\n", a, b); return 0; }\nvoid swap(int *x, int *y) { int t = *x; *x = *y; *y = t; }'],
  ['define', '#define N 5\nint main() { int a[N]; int i; for (i = 0; i < N; i++) a[i] = i * i; printf("%d\\n", a[N-1]); return 0; }'],
  ['define chain', '#define N 5\n#define M N\nint main() { printf("%d\\n", M); return 0; }'],
  ['define str', '#define MSG "hi"\nint main() { printf("%s\\n", MSG); return 0; }'],
  ['char ptr literal', main('char *s = "hello"; printf("%c %s\\n", s[1], s + 2);')],
  ['literal write', main('char *s = "hello"; s[0] = \'H\';')],
  ['strcpy ok', main('char a[6]; strcpy(a, "hello"); printf("%s\\n", a);')],
  ['strcpy overflow', main('char a[5]; strcpy(a, "hello");')],
  ['no terminator', main("char s[3] = {'a','b','c'}; printf(\"%d\\n\", strlen(s));")],
  ['ptr to ptr', main('int a = 1; int *p = &a; int **pp = &p; **pp = 5; printf("%d\\n", a);')],
  ['arr of ptr', main('int a = 1, b = 2; int *p[2] = {&a, &b}; *p[1] = 9; printf("%d\\n", b);')],
  ['ptr to arr', main('int m[2][3] = {{1,2,3},{4,5,6}}; int (*r)[3] = m; printf("%d\\n", r[1][1]);')],
  ['star p plus plus', main('int a[3] = {10,20,30}; int *p = a; printf("%d ", *p++); printf("%d ", (*p)++); printf("%d ", ++*p); printf("%d %d\\n", a[1], *p);')],
  ['break nested', main('int i, j, c = 0; for (i = 0; i < 3; i++) { for (j = 0; j < 3; j++) { if (j == 1) break; c++; } } printf("%d\\n", c);')],
  ['continue', main('int i, s = 0; for (i = 0; i < 5; i++) { if (i % 2) continue; s += i; } printf("%d\\n", s);')],
  ['break outside', main('break;')],
  ['return in loop', 'int f() { int i; for (i = 0; ; i++) if (i == 3) return i; }\nint main() { printf("%d\\n", f()); return 0; }'],
  ['for empty all', main('int i = 0; for (;;) { if (++i > 3) break; } printf("%d\\n", i);')],
  ['if else chain', main('int x = 5; if (x < 0) printf("neg"); else if (x == 0) printf("zero"); else printf("pos"); printf("\\n");')],
  ['dangling else', main('int a = 1, b = 0; if (a) if (b) printf("x"); else printf("y"); printf("\\n");')],
  ['switch', main('int x = 1; switch (x) { case 1: break; }')],
  ['unsigned', main('unsigned int x = 5;')],
  ['long', main('long x = 5;')],
  ['div zero', main('int z = 0; int x = 5 / z;')],
  ['mod zero', main('int z = 0; int x = 5 % z;')],
  ['float div zero', main('float z = 0; float x = 5 / z; printf("%f\\n", x);')],
  ['no main', 'int f() { return 1; }'],
  ['two main', 'int main() { return 0; }\nint main() { return 1; }'],
  ['redeclare', main('int a = 1; int a = 2;')],
  ['undeclared', main('x = 5;')],
  ['call undefined', main('foo();')],
  ['scanf', main('int x; scanf("%d", &x);')],
  ['wrong argc', 'int f(int a) { return a; }\nint main() { f(1, 2); return 0; }'],
  ['void var', main('void x;')],
  ['arr size 0', main('int a[0];')],
  ['arr size neg', main('int a[-1];')],
  ['arr size var', main('int n = 3; int a[n];')],
  ['huge arr', main('int a[100000]; a[0] = 1; printf("%d\\n", a[0]);')],
  ['huge arr 2', main('int a[1000000];')],
  ['char signed print', main("char c = -1; printf(\"%d %c\\n\", c, 'A');")],
  ['char from int', main('char c = 65 + 256; printf("%c %d\\n", c, c);')],
  ['float precision', main('float f = 16777217; printf("%.1f\\n", f);')],
  ['float int', main('float f = 3; int i = f / 2; printf("%d %f\\n", i, f / 2);')],
  ['int to float print', main('int i = 7; printf("%f\\n", (float)i / 2);')],
  ['double compare', main('double a = 0.1 + 0.2; printf("%d\\n", a == 0.3);')],
  ['char compare', main("char c = 'b'; if (c >= 'a' && c <= 'z') c = c - 32; printf(\"%c\\n\", c);")],
  ['char array loop', main('char s[] = "Hello"; int i; for (i = 0; s[i] != \'\\0\'; i++) if (s[i] == \'l\') s[i] = \'L\'; printf("%s\\n", s);')],
  ['cast void', main('int a = 1; (void)a;')],
  ['unary plus', main('int x = +4 * 10; printf("%d\\n", x);')],
  ['negative literal arr idx', main('int a[3]; a[-1] = 0;')],
  ['const', main('const int x = 5; printf("%d\\n", x);')],
  ['const assign', main('const int x = 5; x = 6; printf("%d\\n", x);')],
  ['label', main('x: ;')],
  ['goto', main('goto end; end: ;')],
  ['nested comment', main('/* a /* b */ int x = 1; printf("%d\\n", x);')],
  ['line comment end', main('int x = 1; // trailing')],
  ['CRLF', '#include <stdio.h>\r\nint main() {\r\n  int x = 3;\r\n  printf("%d\\n", x);\r\n  return 0;\r\n}\r\n'],
  ['tabs', '\tint main()\t{\tint x\t=\t1;\treturn x;\t}'],
  ['utf8 in string', main('printf("caf\u00e9\\n");')],
  ['emoji ident', main('int \u00e9 = 1;')],
  ['main return value', 'int main() { return 5; }'],
  ['main no return', 'int main() { int x = 1; }'],
  ['void main', 'void main() { printf("hi\\n"); }'],
  ['main with args', 'int main(int argc, char *argv[]) { return 0; }'],
  ['postfix in expr', main('int i = 5; int j = i++ + i++; printf("%d\\n", j);')],
  ['incdec ptr', main('int a[3] = {1,2,3}; int *p = a; p++; p += 1; printf("%d\\n", *p); p--; printf("%d\\n", *p);')],
  ['array name ++', main('int a[3]; a++;')],
  ['address of literal', main('int *p = &5;')],
  ['deref int', main('int x = 5; *x = 3;')],
  ['star p dot', 'typedef struct { char name[4]; } s_t;\nint main() { s_t s = {"ab"}; s_t *p = &s; printf("%c\\n", *p.name); return 0; }'],
  ['arrow on struct', 'typedef struct { int x; } s_t;\nint main() { s_t s = {1}; printf("%d\\n", s->x); return 0; }'],
  ['struct in struct', 'typedef struct { int x, y; } pt;\ntypedef struct { pt a, b; } line;\nint main() { line l = {{1,2},{3,4}}; printf("%d %d\\n", l.b.x, sizeof(line)); return 0; }'],
  ['struct array', 'typedef struct { int v; char c; } r_t;\nint main() { r_t a[2] = {{1,\'a\'},{2,\'b\'}}; a[1].v += 10; printf("%d %c\\n", a[1].v, a[0].c); return 0; }'],
  ['struct param byval', 'typedef struct { int v; } r_t;\nvoid f(r_t r) { r.v = 99; }\nint main() { r_t a = {1}; f(a); printf("%d\\n", a.v); return 0; }'],
  ['struct return', 'typedef struct { int v; } r_t;\nr_t mk(int x) { r_t r; r.v = x; return r; }\nint main() { r_t a = mk(4); printf("%d\\n", a.v); return 0; }'],
  ['self ref struct incomplete', 'struct n { struct n x; };\nint main() { return 0; }'],
  ['big loop', main('int i, s = 0; for (i = 0; i < 1000; i++) s += i; printf("%d\\n", s);')],
  ['empty printf', main('printf("");')],
  ['printf no args', main('printf();')],
  ['printf var fmt', main('char f[] = "%d\\n"; printf(f, 3);')],
  ['strlen ptr mid', main('char s[] = "hello"; printf("%d\\n", strlen(s + 2));')],
  ['char ptr walk', main('char s[] = "abc"; char *p = s; int n = 0; while (*p) { n++; p++; } printf("%d\\n", n);')],
  ['ptr compare null', main('int *p = 0; if (!p) printf("null\\n");')],
  ['ptr from int nonzero', main('int *p = 5;')],
  ['int from ptr', main('int a; int b = &a;')],
  ['char* to int*', main('char c[4]; int *p = c;')],
  ['void ptr', main('int a = 3; void *v = &a; int *p = v; printf("%d\\n", *p);')],
  ['void ptr deref', main('int a = 3; void *v = &a; printf("%d\\n", *v);')],
  ['sizeof types', main('printf("%d %d %d %d %d\\n", sizeof(char), sizeof(int), sizeof(float), sizeof(double), sizeof(int *));')],
  ['sizeof struct ptr', 'typedef struct { int a; double b; char c; } s_t;\nint main() { s_t *p; printf("%d %d\\n", sizeof(s_t), sizeof(*p)); return 0; }'],
  ['global init expr', 'int a = 3;\nint b = a + 1;\nint main() { printf("%d\\n", b); return 0; }'],
  ['global ptr', 'int a = 3;\nint *p = &a;\nint main() { *p = 4; printf("%d\\n", a); return 0; }'],
  ['global shadow', 'int x = 1;\nvoid f() { x++; }\nint main() { int x = 10; f(); printf("%d\\n", x); return 0; }'],
  ['func before decl call', 'int main() { printf("%d\\n", g(2)); return 0; }\nint g(int x) { return x + 1; }'],
  ['char param', 'char up(char c) { return c - 32; }\nint main() { printf("%c\\n", up(\'a\')); return 0; }'],
  ['float param', 'float half(float x) { return x / 2; }\nint main() { printf("%.2f\\n", half(5)); return 0; }'],
  ['double ret int', 'int f() { return 3.9; }\nint main() { printf("%d\\n", f()); return 0; }'],
  ['array param modify', 'void dbl(int a[], int n) { int i; for (i = 0; i < n; i++) a[i] *= 2; }\nint main() { int x[3] = {1,2,3}; dbl(x, 3); printf("%d %d %d\\n", x[0], x[1], x[2]); return 0; }'],
  ['2d param', 'int s(int m[][3], int r) { int i, j, t = 0; for (i = 0; i < r; i++) for (j = 0; j < 3; j++) t += m[i][j]; return t; }\nint main() { int m[2][3] = {{1,2,3},{4,5,6}}; printf("%d\\n", s(m, 2)); return 0; }'],
  ['index commutative', main('int a[3] = {1,2,3}; printf("%d\\n", 2[a]);')],
  ['char index', main("int a[3] = {1,2,3}; char i = 1; printf(\"%d\\n\", a[i]);")],
  ['float index', main('int a[3]; float f = 1; a[f] = 1;')],
  ['increment char literal', main("char s[] = \"abc\"; s[0]++; printf(\"%s\\n\", s);")],
  ['pre/post', main('int i = 5; printf("%d ", i++); printf("%d ", ++i); printf("%d\\n", i);')],
  ['midterm q9', main('for (int i = 0; i < 10; i++) printf("%d ", ++i);')],
  ['midterm q10', main('int i = 5; do { printf("%d ", i--); } while (--i && i > 0);')],
]

const run = (src: string) => traceC(src)
const probe = (name: string) => probes.find(([n]) => n === name)![1]

describe('edge inputs', () => {
  test('no input crashes the tracer or leaks an internal error', { timeout: 30000 }, () => {
    for (const [name, src] of probes) {
      const r = run(src)
      const msgs = r.errors.map((e) => e.message).join(' | ')
      expect(msgs, name).not.toMatch(/internal tracer error/)
      expect(() => JSON.stringify(r.frames), name).not.toThrow()
    }
  })

  test('very deep nesting gives a plain message instead of a stack overflow', () => {
    const r = run(probe('deep parens'))
    expect(r.ok).toBe(false)
    expect(r.errors[0].message).toMatch(/nested too deeply/)
  })

  test('huge arrays are refused up front instead of filling memory with frames', () => {
    const r = run(probe('huge arr'))
    expect(r.summary.runtimeError?.kind).toBe('unsupported')
    expect(r.errors[0].message).toMatch(/at most 1024/)
    expect(run(main('int a[100]; char s[1024];')).errors).toEqual([])
  })

  test('main(int argc, char *argv[]) runs with stand-in values', () => {
    expect(run(probe('main with args')).errors).toEqual([])
  })

  test('NULL is the null pointer constant (R02 p12)', () => {
    const r = run(main('int *p = NULL; if (p == NULL) printf("null\\n");'))
    expect(r.errors).toEqual([])
    expect(r.summary.output).toBe('null\n')
    expect(run(main('int x = NULL;')).summary.runtimeError?.kind).toBe('type')
  })

  test('a linked list built with malloc and NULL walks back in reverse', () => {
    const r = run(probe('linked list'))
    expect(r.errors).toEqual([])
    expect(r.summary.output).toBe('2 1 0 \n')
    expect(r.frames.at(-1)!.heap.length).toBe(3)
  })

  test('&a[3] (one past the end) is a legal address to compare against', () => {
    const r = run(main('int b = 1; int a[3] = {1,2,3}; int *p = a; while (p < &a[3] && b) { p++; } printf("ok\\n");'))
    expect(r.errors).toEqual([])
    expect(r.summary.output).toBe('ok\n')
    // reading a[3] is still an overrun
    expect(run(main('int b = 1; int a[3] = {1,2,3}; int x = a[3];')).summary.runtimeError?.kind).toBe('bounds')
  })

  test('recursion 100 deep works; endless recursion stops with a limit and keeps the stack', () => {
    expect(run(probe('recursion deep 100')).summary.output).toBe('5050\n')
    const r = run(probe('infinite recursion'))
    expect(r.summary.runtimeError?.kind).toBe('limit')
    expect(r.frames.at(-1)!.stack.length).toBe(128)
  })

  test('a runtime error inside a block keeps the block variables in the error frame', () => {
    const r = run(main('int a = 1; { int b = 2; int *q = 0; *q = b; }'))
    expect(r.summary.runtimeError?.kind).toBe('segfault')
    expect(r.frames.at(-1)!.stack[0].vars.map((v) => v.name)).toEqual(['a', 'b', 'q'])
  })

  test('a flat initialiser fills a 2D array row by row (brace elision)', () => {
    const r = run(main('int m[2][2] = {1, 2, 3, 4}; printf("%d %d\\n", m[0][1], m[1][0]);'))
    expect(r.errors).toEqual([])
    expect(r.summary.warnings).toEqual([])
    expect(r.summary.output).toBe('2 3\n')
    const s = run('typedef struct { int v; char c[3]; } r_t;\nint main() { r_t a[2] = {1, "ab", 2, "cd"}; printf("%d %s\\n", a[1].v, a[1].c); return 0; }')
    expect(s.summary.output).toBe('2 cd\n')
  })

  test('printf prints inf and large %f values the way C does', () => {
    expect(run(main('double z = 0; double d = 1.0 / z; printf("%f %f\\n", d, -d);')).summary.output).toBe('inf -inf\n')
    expect(run(main('double big = 1000000.0 * 1000000.0 * 1000000.0 * 1000.0; printf("%.1f\\n", big);')).summary.output).toBe(
      '1000000000000000000000.0\n',
    )
  })
})
