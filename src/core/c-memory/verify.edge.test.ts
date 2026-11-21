/**
 * Adversarial edge-case and robustness checks for the C memory tracer.
 * Each test encodes what the course slides (or gcc on Linux, which the course uses) do, with
 * the page cited. A failing test is an engine gap for the fixer; nothing here is exploratory.
 */
import { describe, expect, test } from 'vitest'
import { PRESETS, traceC } from './index'

const R = String.raw
const main = (body: string, before = '') =>
  `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n${before}\nint main(void) {\n${body}\n  return 0;\n}\n`

/** Best of three runs after one warm-up, so a slow first JIT pass does not decide the result. */
function bestMs(src: string): number {
  traceC(src)
  let best = Infinity
  for (let k = 0; k < 3; k++) {
    const t0 = performance.now()
    traceC(src)
    best = Math.min(best, performance.now() - t0)
  }
  return best
}

describe('parser and preprocessor edge cases', () => {
  // L02C p25 (Sum1To10_For.c) uses the comma operator in the for initialiser.
  test('L02C p25: for (sum = 0, i = 1; i <= 10; i++) runs and sums to 55', () => {
    const t = traceC(main(R`int sum, i;
  for (sum = 0, i = 1; i <= 10; i++) {
    sum = sum + i;
  }
  printf("%d\n", sum);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('55\n')
  })

  test('L02C p25 pattern: comma in both the init and the update of a for (i++, j--)', () => {
    const t = traceC(main(R`int i, j, n = 0;
  for (i = 0, j = 5; i < j; i++, j--) n++;
  printf("%d %d %d\n", n, i, j);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('3 3 2\n')
  })

  // R01 p18 "#define - Macro Replacement"; L02A p31 #define PI 3.142. A body that starts with '('
  // after a space is still an object-like macro: only NAME( with no space takes parameters.
  test('#define N (3+2) is an object-like macro (space before the parenthesis), so N * 2 = 10', () => {
    const t = traceC('#include <stdio.h>\n#define N (3+2)\nint main(void) { printf("%d\\n", N * 2); return 0; }\n')
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('10\n')
  })

  test('#define MAX (5) can size an array (L05A p6 style #define MAX 5, with parentheses)', () => {
    const t = traceC('#include <stdio.h>\n#define MAX (5)\nint main(void) { int a[MAX]; printf("%d\\n", (int)sizeof(a)); return 0; }\n')
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('20\n')
  })

  test('hex and octal character escapes are valid C: \\x41 and \\101 are both A', () => {
    const t = traceC(main(R`char a = '\x41', b = '\101';
  printf("%c%c\n", a, b);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('AA\n')
  })

  test('09 is not a valid octal literal: gcc rejects it (invalid digit "9" in octal constant)', () => {
    const t = traceC(main('int a = 09; printf("%d\\n", a);'))
    expect(t.ok).toBe(false)
    expect(t.summary.output).toBe('')
  })
})

describe('printf formatting matches gcc / glibc', () => {
  // glibc rounds an exact binary tie to even; JavaScript toFixed rounds it up.
  test('%.0f %.1f %.2f on exact ties round to even: 0.5 -> 0, 2.5 -> 2, 0.25 -> 0.2, 0.125 -> 0.12', () => {
    const t = traceC(main(R`printf("%.0f %.0f %.0f %.1f %.2f\n", 0.5, 1.5, 2.5, 0.25, 0.125);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('0 2 2 0.2 0.12\n')
  })

  test('the space flag puts a blank where a + sign would go: [% d] of 42 is [ 42]', () => {
    const t = traceC(main(R`printf("[% d][% d]\n", 42, -42);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('[ 42][-42]\n')
  })
})

describe('call stack layout (L04D p4: the activation record holds all the locals for the whole call)', () => {
  test('a callee frame sits below every caller local, including ones declared after the call', () => {
    const t = traceC('void g(void) { int z = 7; }\nint main(void) { int a = 1; g(); int b = 2; return 0; }\n')
    expect(t.errors).toEqual([])
    const zAddr = t.frames.flatMap((f) => f.stack.flatMap((s) => s.vars)).find((v) => v.name === 'z')!.address
    const bAddr = t.frames.flatMap((f) => f.stack.flatMap((s) => s.vars)).find((v) => v.name === 'b')!.address
    // b belongs to main's activation record, which exists during the call to g, so z cannot share its bytes
    expect(zAddr).not.toBe(bAddr)
    expect(zAddr).toBeLessThan(bAddr)
  })

  // R02 p12: a dangling pointer points at memory that is no longer available.
  test('R02 p12: a pointer to a returned local stays dangling even after the caller declares another local', () => {
    const t = traceC('#include <stdio.h>\nint *f(void) { int x = 5; return &x; }\nint main(void) { int *p = f(); int y = 2; printf("%d\\n", *p); return 0; }\n')
    expect(t.summary.output).toBe('')
    expect(t.summary.runtimeError?.kind).toBe('dangling')
    // before the read, the arrow from p must not be drawn as a valid arrow to y
    const before = t.frames.find((f) => f.stack[0]?.vars.some((v) => v.name === 'y'))!
    const edge = before.edges.find((e) => e.fromName === 'p')!
    expect(edge.toName).not.toBe('y')
    expect(edge.status).not.toBe('ok')
  })
})

describe('performance on exam-size inputs (must stay well under 100 ms)', () => {
  // AY25/26 S1 Final Q10: int A[100], int *p[100] and a 100-step fill loop.
  test('preset CM13 (AY25/26 S1 Final Q10) traces in under 100 ms', { timeout: 30000 }, () => {
    const code = PRESETS.find((p) => p.id === 'CM13')!.code
    expect(traceC(code).summary.output).toBe('51\n')
    expect(bestMs(code)).toBeLessThan(100)
  })

  test('a 10 x 10 int matrix filled by a nested loop traces in under 100 ms', { timeout: 30000 }, () => {
    const code = main(R`int m[10][10];
  int i, j, s = 0;
  for (i = 0; i < 10; i++)
    for (j = 0; j < 10; j++)
      m[i][j] = i * 10 + j;
  for (i = 0; i < 10; i++) s += m[i][i];
  printf("%d\n", s);`)
    expect(traceC(code).summary.output).toBe('495\n')
    expect(bestMs(code)).toBeLessThan(100)
  })
})
