/**
 * Course-fidelity checks for the C memory tracer. Each test encodes what the CS2100 slides
 * (or gcc, which the course uses) do, with the page cited. Failing tests are engine gaps.
 */
import { describe, expect, test } from 'vitest'
import { traceC } from './index'

const R = String.raw
const main = (body: string, before = '') => `#include <stdio.h>\n#include <string.h>\n${before}\nint main(void) {\n${body}\n  return 0;\n}\n`

describe('course fidelity', () => {
  // L04C p11: without a prototype the compiler assumes an int return, then reports
  // "conflicting types" when it meets the double definition later. The program does not compile.
  test('L04C p11: calling a double function before its prototype is a conflicting-types error', () => {
    const t = traceC(R`#include <stdio.h>
int main(void) {
  double rim_area;
  rim_area = circle_area(2.0) - circle_area(1.0);
  printf("%f\n", rim_area);
  return 0;
}
double circle_area(double diameter) {
  return diameter * diameter;
}
`)
    expect(t.ok).toBe(false)
    expect(t.errors.map((e) => e.message).join(' ')).toMatch(/conflicting types/)
  })

  test('L02C p4-5: switch runs on into the next case until a break', () => {
    const t = traceC(main(R`int x = 2;
  switch (x) {
    case 1: printf("one\n");
    case 2: printf("two\n");
    case 3: printf("three\n");
      break;
    default: printf("other\n");
  }`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('two\nthree\n')
  })

  test('L02C p25: Sum1To10_For.c uses a comma in the for header and sums to 55', () => {
    const t = traceC(main(R`int sum, i;
  for (sum = 0, i = 1; i <= 10; i++) {
    sum = sum + i;
  }
  printf("%d\n", sum);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('55\n')
  })

  test('L04D p4, p18; R02 p43: a static local keeps its value between calls', () => {
    const t = traceC(R`#include <stdio.h>
int counter(void) {
  static int i = 0;
  i++;
  return i;
}
int main(void) {
  counter();
  counter();
  printf("%d\n", counter());
  return 0;
}
`)
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('3\n')
  })

  // slide code is missing a ')' on both printf lines; fixed here
  test('L04D p3: sqrt_sum_square(3.2, 12/5) and (a, a+b) with pow and sqrt from math.h', () => {
    const t = traceC(R`#include <stdio.h>
#include <math.h>
double sqrt_sum_square(double x, double y) {
  double sum_square;
  sum_square = pow(x,2) + pow(y,2);
  return sqrt(sum_square);
}
int main(void) {
  double a = 10.5, b = 7.8;
  printf("%.2f\n", sqrt_sum_square(3.2, 12/5));
  printf("%.2f\n", sqrt_sum_square(a, a+b));
  return 0;
}
`)
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('3.77\n21.10\n')
  })

  test('L05B p10: strcmp is negative, 0 or positive by ASCII order', () => {
    const t = traceC(main(R`printf("%d %d %d\n", strcmp("abc", "abd") < 0, strcmp("abc", "abc") == 0, strcmp("b", "a") > 0);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('1 1 1\n')
  })

  test('L05B p7: puts prints the string and adds a newline', () => {
    const t = traceC(main(R`char str[10] = "My book";
  puts(str);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('My book\n')
  })

  // R02 p32: union fields share storage, size = the largest member. R01 p43: 0xC0D00000 is float -6.5.
  // struct SF size 9 follows the tracer's own no-padding assumption (L05C p3).
  test('R02 p32: a union overlays its members; writing f = -6.5 reads back as i = 0xc0d00000', () => {
    const t = traceC(R`#include <stdio.h>
union IF {
  int i;
  float f;
  char c;
};
struct SF {
  int i;
  float f;
  char c;
};
int main(void) {
  union IF u_if;
  u_if.f = -6.5;
  printf("%d %d %x\n", sizeof(union IF), sizeof(struct SF), u_if.i);
  return 0;
}
`)
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('4 9 c0d00000\n')
  })

  test('R02 p35: enum constants count up from the last given value (LOW = 3, MEDIUM 4, HIGH 5)', () => {
    const t = traceC(R`#include <stdio.h>
enum Heat {
  LOW = 3,
  MEDIUM,
  HIGH
};
int main(void) {
  printf("%d %d %d\n", LOW, MEDIUM, HIGH);
  return 0;
}
`)
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('3 4 5\n')
  })

  // gcc/glibc rounds an exact tie to even under the default rounding mode; JS toFixed rounds it up
  test('printf %.Nf rounds exact ties to even as gcc does (0.125 -> 0.12, 2.5 -> 2)', () => {
    const t = traceC(main(R`printf("%.2f %.0f %.0f %.1f\n", 0.125, 2.5, 0.5, 0.25);`))
    expect(t.errors).toEqual([])
    expect(t.summary.output).toBe('0.12 2 0 0.2\n')
  })
})
