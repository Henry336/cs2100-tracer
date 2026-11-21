/**
 * Course examples as runnable programs. Code is written for the tracer (not pasted from slides);
 * expected values come from the source named in `source`.
 * status: 'official' = the slide or answer key gives the result; 'derived' = worked out, no key.
 */
import type { CMemConfig } from './types'

export type Preset = {
  id: string
  title: string
  source: string
  status: 'official' | 'derived'
  code: string
  config?: Partial<CMemConfig>
  /** Exact stdout, or the runtime error kind the run must stop with. */
  expect: { output?: string; errorKind?: string }
}

export const PRESETS: Preset[] = [
  {
    id: 'CM01',
    title: 'Three pointers, one loop',
    source: 'L04B p3-4',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a = 8, b = 15, c = 23;
  int *p1, *p2, *p3;
  p1 = &b;
  p2 = &c;
  p3 = p2;
  printf("1: %d %d %d\\n", *p1, *p2, *p3);
  *p1 *= a;
  while (*p2 > 0) {
    *p2 -= a;
    (*p1)++;
  }
  printf("2: %d %d %d\\n", *p1, *p2, *p3);
  printf("3: %d %d %d\\n", a, b, c);
  return 0;
}
`,
    expect: { output: '1: 15 23 23\n2: 123 -1 -1\n3: 8 123 -1\n' },
  },
  {
    id: 'CM02',
    title: 'Pointer trace',
    source: 'T01 Q6 (Answers p6)',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a = 3, *b, c, *d, e, *f;
  b = &a;
  *b = 5;
  c = *b * 3;
  d = b;
  e = *b + c;
  *d = c + e;
  f = &e;
  a = *f + *b;
  *f = *d - *b;
  printf("a = %d, c = %d, e = %d\\n", a, c, e);
  printf("*b = %d, *d = %d, *f = %d\\n", *b, *d, *f);
  return 0;
}
`,
    expect: { output: 'a = 55, c = 15, e = 0\n*b = 55, *d = 55, *f = 0\n' },
  },
  {
    id: 'CM03',
    title: 'Moving a pointer between variables',
    source: 'L04A p13',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int i = 10, j = 20;
  int *p;
  p = &i;
  printf("value of i is %d\\n", *p);
  *p = *p + 2;
  p = &j;
  *p = i;
  printf("i = %d, j = %d\\n", i, j);
  return 0;
}
`,
    expect: { output: 'value of i is 10\ni = 12, j = 12\n' },
  },
  {
    id: 'CM04',
    title: 'Pointer to double',
    source: 'L04A p14-15',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  double a, *b;
  b = &a;
  *b = 12.34;
  printf("%f\\n", a);
  printf("%f\\n", *b);
  return 0;
}
`,
    expect: { output: '12.340000\n12.340000\n' },
  },
  {
    id: 'CM05',
    title: 'Incrementing pointers',
    source: 'L04B p5',
    status: 'official',
    // stack top chosen so the tracer's placement rule lands on the slide's own addresses
    config: { stackTop: 0xffbff0a8 },
    code: `#include <stdio.h>

int main(void) {
  int a; float b; char c; double d;
  int *ap; float *bp; char *cp; double *dp;
  ap = &a; bp = &b; cp = &c; dp = &d;
  printf("%p %p %p %p\\n", ap, bp, cp, dp);
  ap++; bp++; cp++; dp++;
  printf("%p %p %p %p\\n", ap, bp, cp, dp);
  ap += 3;
  printf("%p\\n", ap);
  return 0;
}
`,
    expect: { output: 'ffbff0a4 ffbff0a0 ffbff09f ffbff090\nffbff0a8 ffbff0a4 ffbff0a0 ffbff098\nffbff0b4\n' },
  },
  {
    id: 'CM06',
    title: 'Pass by value',
    source: 'L04D p6',
    status: 'official',
    code: `#include <stdio.h>
void g(int, int);

int main(void) {
  int a = 2, b = 3;
  printf("In main, before: a=%d, b=%d\\n", a, b);
  g(a, b);
  printf("In main, after : a=%d, b=%d\\n", a, b);
  return 0;
}

void g(int a, int b) {
  printf("In g, before: a=%d, b=%d\\n", a, b);
  a = 100 + a;
  b = 200 + b;
  printf("In g, after : a=%d, b=%d\\n", a, b);
}
`,
    expect: { output: 'In main, before: a=2, b=3\nIn g, before: a=2, b=3\nIn g, after : a=102, b=203\nIn main, after : a=2, b=3\n' },
  },
  {
    id: 'CM07',
    title: 'Swap by value, then by address',
    source: 'L04D p7-11; R02 p16-17',
    status: 'official',
    code: `#include <stdio.h>
void swapValues(int, int);
void swapAddresses(int *, int *);

int main(void) {
  int a = 2, b = 3;
  swapValues(a, b);
  printf("a = %d, b = %d\\n", a, b);
  swapAddresses(&a, &b);
  printf("a = %d, b = %d\\n", a, b);
  return 0;
}

void swapValues(int x, int y) {
  int temp = x;
  x = y;
  y = temp;
}

void swapAddresses(int *x, int *y) {
  int temp = *x;
  *x = *y;
  *y = temp;
}
`,
    expect: { output: 'a = 2, b = 3\na = 3, b = 2\n' },
  },
  {
    id: 'CM08',
    title: 'Same function, values vs addresses',
    source: 'L04D p12-13',
    status: 'official',
    code: `#include <stdio.h>
void byValue(int, int, int);
void byAddress(int *, int *, int *);

int main(void) {
  int a = 9, b = -2, c = 5;
  byValue(a, b, c);
  printf("a = %d, b = %d, c = %d\\n", a, b, c);
  byAddress(&a, &b, &c);
  printf("a = %d, b = %d, c = %d\\n", a, b, c);
  return 0;
}

void byValue(int x, int y, int z) {
  x = 3 + y;
  y = 10 * x;
  z = x + y + z;
  printf("x = %d, y = %d, z = %d\\n", x, y, z);
}

void byAddress(int *x, int *y, int *z) {
  *x = 3 + *y;
  *y = 10 * *x;
  *z = *x + *y + *z;
  printf("*x = %d, *y = %d, *z = %d\\n", *x, *y, *z);
}
`,
    expect: { output: 'x = 1, y = 10, z = 16\na = 9, b = -2, c = 5\n*x = 1, *y = 10, *z = 16\na = 1, b = 10, c = 16\n' },
  },
  {
    id: 'CM09',
    title: 'Later locals sit lower',
    source: 'L04D p15',
    status: 'official',
    config: { stackTop: 0xffbff790 },
    code: `#include <stdio.h>
void f(int *, int *, int *);

int main(void) {
  int a = 9, b = -2, c = 5;
  f(&a, &b, &c);
  printf("a = %d, b = %d, c = %d\\n", a, b, c);
  return 0;
}

void f(int *x, int *y, int *z) {
  *x = 3 + *y;
  *y = 10 * *x;
  *z = *x + *y + *z;
  printf("x = %p, y = %p, z = %p\\n", x, y, z);
}
`,
    expect: { output: 'x = ffbff78c, y = ffbff788, z = ffbff784\na = 1, b = 10, c = 16\n' },
  },
  {
    id: 'CM10',
    title: 'Swapping pointer copies changes nothing',
    source: 'AY23/24 S2 Final Q2 (key: A)',
    status: 'official',
    code: `#include <stdio.h>

void mystery(int *a, int *b) {
  int *c = b;
  b = a;
  a = c;
}

int main(void) {
  int a = 100, b = 500, c = 300, d = 420;
  mystery(&a, &b);
  if (a < c)
    mystery(&c, &a);
  mystery(&a, &d);
  printf("%d\\n", a);
  return 0;
}
`,
    expect: { output: '100\n' },
  },
  {
    id: 'CM11',
    title: 'Incrementing through a pointer',
    source: 'AY21/22 S1 Final Q2 and Q3',
    status: 'derived',
    code: `#include <stdio.h>

void foo(int *i) {
  (*i)++;
}

int main(void) {
  int i = 20;
  int *ptr;
  foo(&i);
  printf("i = %d\\n", i);
  i = 100;
  ptr = &i;
  *ptr += 1;
  printf("%d %d\\n", *ptr, i);
  return 0;
}
`,
    expect: { output: 'i = 21\n101 101\n' },
  },
  {
    id: 'CM12',
    title: 'Pointer to pointer, postfix ++ first',
    source: 'Midterm AY25/26 Q11-Q12',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int A[4] = {1, 2, 3, 4};
  int *p[2], **q;
  p[0] = &A[0];
  p[1] = &A[2];
  q = p;
  *q = &A[1];
  **q++ = 100;
  printf("%d %d %d %d\\n", A[0], A[1], A[2], A[3]);
  return 0;
}
`,
    expect: { output: '1 100 3 4\n' },
  },
  {
    id: 'CM13',
    title: 'Two pointers walking towards each other',
    source: 'AY25/26 S1 Final Q10',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int A[100];
  int *p[100];
  int **pp, **qq;
  int i;
  for (i = 0; i < 100; i++) {
    A[i] = i;
    p[i] = &A[i];
  }
  pp = &p[0];
  qq = &p[99];
  while (++(*pp) <= *qq--) {
  }
  printf("%d\\n", **pp);
  return 0;
}
`,
    expect: { output: '51\n' },
  },
  {
    id: 'CM14',
    title: 'Offsets from a pointer into an array',
    source: 'R02 p57',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a[] = {1, 3, 2, 5};
  int *p = &a[1];
  printf("%d\\n", *(p - 1) + *(p + 1) - *(p + 2));
  return 0;
}
`,
    expect: { output: '-2\n' },
  },
  {
    id: 'CM15',
    title: 'Array name is the address of element 0',
    source: 'L05A p8; R02 p20',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a[3];
  printf("%p\\n", a);
  printf("%p\\n", &a[0]);
  printf("%p\\n", &a[1]);
  return 0;
}
`,
    expect: { output: 'ffbff7f4\nffbff7f4\nffbff7f8\n' },
  },
  {
    id: 'CM16',
    title: 'Array initialisers',
    source: 'L05A p7',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a[3] = {54, 9, 10};
  int b[] = {1, 2, 3};
  int c[5] = {17, 3, 10};
  int e[2] = {1, 2, 3};
  int i;
  printf("%d %d %d\\n", a[0], a[1], a[2]);
  printf("b has %d elements\\n", sizeof(b) / sizeof(b[0]));
  for (i = 0; i < 5; i++)
    printf("%d ", c[i]);
  printf("\\n%d %d\\n", e[0], e[1]);
  return 0;
}
`,
    expect: { output: '54 9 10\nb has 3 elements\n17 3 10 0 0 \n1 2\n' },
  },
  {
    id: 'CM17',
    title: 'Array parameter: sum',
    source: 'L05A p11',
    status: 'derived',
    code: `#include <stdio.h>
int sumArray(int [], int);

int main(void) {
  int val[6] = {44, 9, 17, -4, 22};
  printf("Sum = %d\\n", sumArray(val, 6));
  return 0;
}

int sumArray(int arr[], int size) {
  int i, total = 0;
  for (i = 0; i < size; i++)
    total += arr[i];
  return total;
}
`,
    expect: { output: 'Sum = 88\n' },
  },
  {
    id: 'CM18',
    title: "The callee changes the caller's array",
    source: 'L05A p15',
    status: 'official',
    code: `#include <stdio.h>
void modifyArray(float [], int);

int main(void) {
  float num[4] = {3.1, 5.9, -2.1, 8.8};
  int i;
  modifyArray(num, 4);
  for (i = 0; i < 4; i++)
    printf("%.2f ", num[i]);
  printf("\\n");
  return 0;
}

void modifyArray(float arr[], int size) {
  int i;
  for (i = 0; i < size; i++)
    arr[i] *= 2;
}
`,
    expect: { output: '6.20 11.80 -4.20 17.60 \n' },
  },
  {
    id: 'CM19',
    title: 'Char array changed by a function',
    source: 'L05B p2',
    status: 'derived',
    code: `#include <stdio.h>

void shift(char arr[], int size) {
  int i;
  for (i = 0; i < size; i++)
    arr[i]++;
}

int main(void) {
  char chars[4] = {'C', 'h', 'a', 'r'};
  int i;
  shift(chars, 4);
  for (i = 0; i < 4; i++)
    printf("%c", chars[i]);
  printf("\\n");
  return 0;
}
`,
    expect: { output: 'Dibs\n' },
  },
  {
    id: 'CM20',
    title: 'Struct assignment copies every member',
    source: 'L05C p10, p12',
    status: 'official',
    code: `#include <stdio.h>

struct result {
  int stuNum;
  float score;
  char grade;
};

int main(void) {
  struct result result1 = {123321, 93.5, 'A'};
  struct result result2 = {456654, 62.0, 'D'};
  result2 = result1;
  printf("%d %.1f %c\\n", result2.stuNum, result2.score, result2.grade);
  return 0;
}
`,
    expect: { output: '123321 93.5 A\n' },
  },
  {
    id: 'CM21',
    title: 'Struct by value vs by address',
    source: 'L05D p5, p8',
    status: 'official',
    code: `#include <stdio.h>
#include <string.h>

typedef struct {
  char name[12];
  int age;
  char gender;
} player_t;

void changeCopy(player_t p) {
  strcpy(p.name, "Alexandra");
  p.age = 25;
}

void changeOriginal(player_t *p) {
  strcpy(p->name, "Alexandra");
  p->age = 25;
}

int main(void) {
  player_t player1 = {"Brusco", 23, 'M'};
  changeCopy(player1);
  printf("player1: name = %s; age = %d; gender = %c\\n", player1.name, player1.age, player1.gender);
  changeOriginal(&player1);
  printf("player1: name = %s; age = %d; gender = %c\\n", player1.name, player1.age, player1.gender);
  return 0;
}
`,
    expect: { output: 'player1: name = Brusco; age = 23; gender = M\nplayer1: name = Alexandra; age = 25; gender = M\n' },
  },
  {
    id: 'CM22',
    title: 'Array of structs and char arithmetic',
    source: 'AY17/18 S2 Final Q1a',
    status: 'derived',
    code: `#include <stdio.h>

typedef struct {
  int val;
  char ch[2];
} rec_t;

void process1(rec_t *r) {
  r->val = 33;
  r->ch[0] += ('a' - 'A') + 1;
  r->ch[1] += ('a' - 'A') + 2;
}

void process2(rec_t r) {
  r.val = 44;
  r.ch[0] = 'Z';
}

int main(void) {
  rec_t st[2] = {{11, {'A', 'B'}}, {22, {'C', 'D'}}};
  process1(&st[1]);
  process2(st[0]);
  printf("%d %c\\n", st[0].val, st[0].ch[0]);
  printf("%d %c\\n", st[1].val, st[1].ch[1]);
  return 0;
}
`,
    expect: { output: '11 A\n33 f\n' },
  },
  {
    id: 'CM23',
    title: 'Struct copy: array member vs pointer member',
    source: 'AY21/22 S2 Final Q3',
    status: 'derived',
    code: `#include <stdio.h>

typedef struct {
  int x[1];
  int *y;
} data_t;

void foo(data_t data) {
  data.x[0] = 456;
  data.y[0] = 654;
}

int main(void) {
  int z = 321;
  data_t data;
  data.x[0] = 123;
  data.y = &z;
  printf("%d %d\\n", data.x[0], *data.y);
  foo(data);
  printf("%d %d\\n", data.x[0], *data.y);
  return 0;
}
`,
    expect: { output: '123 321\n123 654\n' },
  },
  {
    id: 'CM24',
    title: 'Integer division, casts and %',
    source: 'L02B p9-13',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int m = 10 / 4;
  float p = 10 / 4;
  float q = 10 / 4.0;
  int n = 10 / 4.0;
  int r = -10 / 4.0;
  int h = 9 * 0.5;
  int aa = 6;
  float ff = 15.8;
  printf("%d %.1f %.1f %d %d %d\\n", m, p, q, n, r, h);
  printf("%.1f %d %.1f\\n", (float)aa / 4, (int)ff / aa, (float)(aa / 4));
  printf("%d %d %d %d\\n", 46 / 15 / 2, 19 % 7 % 3, 10 % 4, -10 % 4);
  return 0;
}
`,
    expect: { output: '2 2.0 2.5 2 -2 4\n1.5 2 1.0\n1 2 2 -2\n' },
  },
  {
    id: 'CM25',
    title: '&& binds tighter than ||',
    source: 'L02C p10-17',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int a = 4, b = -2, c = 0;
  int x, y, z;
  x = (a > b || b > c && a == b);
  y = ((a > b || b > c) && a == b);
  z = ((a > b) && !(b > c));
  printf("x=%d, y=%d, z=%d\\n", x, y, z);
  return 0;
}
`,
    expect: { output: 'x=1, y=0, z=1\n' },
  },
  {
    id: 'CM26',
    title: 'An assignment is an expression',
    source: 'R01 p17',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int x, y;
  x = (y = 5) + 5;
  printf("x = %d, y = %d\\n", x, y);
  return 0;
}
`,
    expect: { output: 'x = 10, y = 5\n' },
  },
  {
    id: 'CM27',
    title: '++i inside a for loop',
    source: 'Midterm AY25/26 Q9',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  for (int i = 0; i < 10; i++)
    printf("%d ", ++i);
  return 0;
}
`,
    expect: { output: '1 3 5 7 9 ' },
  },
  {
    id: 'CM28',
    title: 'do-while with i-- and --i',
    source: 'Midterm AY25/26 Q10',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int i = 5;
  do {
    printf("%d ", i--);
  } while (--i && i > 0);
  return 0;
}
`,
    expect: { output: '5 3 1 ' },
  },
  {
    id: 'CM29',
    title: 'Ternary and misleading indentation',
    source: 'AY24/25 S1 Final Q8',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int x = 1;
  if (x > 0 ? 0 : 1)
    printf("1 ");
  else
    printf("2 ");
    printf("3 ");
  return 0;
}
`,
    expect: { output: '2 3 ' },
  },
  {
    id: 'CM30',
    title: 'break leaves only the inner loop',
    source: 'L02C p28',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int i, j;
  for (i = 1; i <= 3; i++) {
    for (j = 1; j <= 5; j++) {
      printf("%d, %d\\n", i, j);
      if (j == 3)
        break;
      printf("Ya\\n");
    }
  }
  return 0;
}
`,
    expect: { output: [1, 2, 3].map((i) => `${i}, 1\nYa\n${i}, 2\nYa\n${i}, 3\n`).join('') },
  },
  {
    id: 'CM31',
    title: 'Lexical scoping',
    source: 'L04D p17',
    status: 'official',
    code: `#include <stdio.h>
void foo(void);
int x = -1;

int main(void) {
  int x = 10;
  printf("1. x = %d\\n", x);
  {
    int x = 20;
    printf("2. x = %d\\n", x);
  }
  printf("3. x = %d\\n", x);
  x = 30;
  printf("4. x = %d\\n", x);
  foo();
  printf("6. x = %d\\n", x);
  return 0;
}

void foo(void) {
  printf("5. x = %d\\n", x);
}
`,
    expect: { output: '1. x = 10\n2. x = 20\n3. x = 10\n4. x = 30\n5. x = -1\n6. x = 30\n' },
  },
  {
    id: 'CM32',
    title: 'Shadowing in nested blocks',
    source: 'R02 p4',
    status: 'derived',
    code: `#include <stdio.h>
int i = 1;

int main(void) {
  printf("%d\\n", i);
  int i = 2;
  printf("%d\\n", i);
  {
    int i = 3;
    printf("%d\\n", i);
  }
  printf("%d\\n", i);
  {
    int i = 4;
    printf("%d\\n", i);
  }
  return 0;
}
`,
    expect: { output: '1\n2\n3\n2\n4\n' },
  },
  {
    id: 'CM33',
    title: 'Reverse an array recursively',
    source: 'T01 Q5 (Answers p4-5)',
    status: 'derived',
    code: `#include <stdio.h>

void reverseArrayRec(int arr[], int left, int right) {
  int temp;
  if (left < right) {
    temp = arr[left];
    arr[left] = arr[right];
    arr[right] = temp;
    reverseArrayRec(arr, left + 1, right - 1);
  }
}

int main(void) {
  int a[4] = {3, 9, 2, 7};
  int i;
  reverseArrayRec(a, 0, 3);
  for (i = 0; i < 4; i++)
    printf("%d ", a[i]);
  printf("\\n");
  return 0;
}
`,
    expect: { output: '7 2 9 3 \n' },
  },
  {
    id: 'CM34',
    title: 'int overflow wraps around',
    source: 'L03B p6, p24',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int i, n = 2147483640;
  for (i = 1; i <= 10; i++)
    n = n + 1;
  printf("n = %d\\n", n);
  return 0;
}
`,
    expect: { output: 'n = -2147483646\n' },
  },
  {
    id: 'CM35',
    title: 'sizeof an array vs an array parameter',
    source: 'Lab 2 Q6, Q10; L05A p12-13',
    status: 'derived',
    code: `#include <stdio.h>

int sizeInside(int arr[]) {
  return sizeof(arr);
}

int main(void) {
  int ageArray[] = {2, 15, 4, 23};
  printf("%d\\n", sizeof(ageArray) / sizeof(ageArray[0]));
  printf("%d\\n", sizeInside(ageArray));
  return 0;
}
`,
    expect: { output: '4\n4\n' },
  },
  {
    id: 'CM36',
    title: 'Writing through a pointer that points nowhere',
    source: 'L04B p6',
    status: 'official',
    code: `#include <stdio.h>

int main(void) {
  int *n;
  *n = 123;
  printf("%d\\n", *n);
  return 0;
}
`,
    expect: { errorKind: 'segfault' },
  },
  {
    id: 'CM37',
    title: 'String with no terminator',
    source: 'L05B p13',
    status: 'official',
    code: `#include <stdio.h>
#include <string.h>

int main(void) {
  char str[10];
  str[0] = 'a';
  str[1] = 'p';
  str[2] = 'p';
  str[3] = 'l';
  str[4] = 'e';
  printf("Length = %d\\n", strlen(str));
  return 0;
}
`,
    expect: { errorKind: 'uninit' },
  },
  {
    id: 'CM38',
    title: 'strcpy into a fixed buffer',
    source: 'L05B p11',
    status: 'official',
    code: `#include <stdio.h>
#include <string.h>

int main(void) {
  char name[10];
  strcpy(name, "Matthew");
  printf("%s\\n", name);
  strcpy(name, "A very long name");
  return 0;
}
`,
    expect: { output: 'Matthew\n', errorKind: 'bounds' },
  },
  {
    id: 'CM39',
    title: 'Using memory after free',
    source: 'R02 p37, p40',
    status: 'official',
    code: `#include <stdio.h>
#include <stdlib.h>

void func(int *ptr) {
  free(ptr);
}

int main(void) {
  int *ptr = (int *)malloc(sizeof(int));
  *ptr = 1;
  func(ptr);
  *ptr = 2;
  return 0;
}
`,
    expect: { errorKind: 'dangling' },
  },
  {
    id: 'CM40',
    title: 'Row-major address of a 3D element',
    source: 'R02 p26',
    status: 'derived',
    code: `#include <stdio.h>
int m[3][4][5];

int main(void) {
  printf("%p\\n", m);
  printf("%p\\n", &m[2][1][3]);
  return 0;
}
`,
    expect: { output: '10010000\n100100c0\n' },
  },
  {
    id: 'CM41',
    title: 'Sum 1 to 10 with a comma in the for header',
    source: 'L02C p25 (Sum1To10_For.c)',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int sum, i;
  for (sum = 0, i = 1; i <= 10; i++) {
    sum = sum + i;
  }
  printf("%d\\n", sum);
  return 0;
}
`,
    expect: { output: '55\n' },
  },
  {
    id: 'CM42',
    title: 'switch falls through until a break',
    source: 'L02C p4-5',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  char myChar = 'B';
  switch (myChar) {
    case 'A':
    case 'B':
    case 'C':
      printf("A to C\\n");
    case 'D':
      printf("no break, so D runs too\\n");
      break;
    case 69 ... 70:
      printf("E or F (GCC range)\\n");
      break;
    default:
      printf("something else\\n");
  }
  return 0;
}
`,
    expect: { output: 'A to C\nno break, so D runs too\n' },
  },
  {
    id: 'CM43',
    title: 'A static local keeps its value between calls',
    source: 'L04D p18; R02 p43',
    status: 'derived',
    code: `#include <stdio.h>

int counter(void) {
  static int i;
  int j = 0;
  i++;
  j++;
  printf("i = %d, j = %d\\n", i, j);
  return i;
}

int main(void) {
  counter();
  counter();
  counter();
  return 0;
}
`,
    expect: { output: 'i = 1, j = 1\ni = 2, j = 1\ni = 3, j = 1\n' },
  },
  {
    id: 'CM44',
    title: 'Pass by value through expressions (pow and sqrt)',
    source: 'L04D p3',
    status: 'derived',
    code: `#include <stdio.h>
#include <math.h>

double sqrt_sum_square(double x, double y) {
  double sum_square;
  sum_square = pow(x, 2) + pow(y, 2);
  return sqrt(sum_square);
}

int main(void) {
  double a = 10.5, b = 7.8;
  printf("%.2f\\n", sqrt_sum_square(3.2, 12 / 5));
  printf("%.2f\\n", sqrt_sum_square(a, a + b));
  return 0;
}
`,
    expect: { output: '3.77\n21.10\n' },
  },
  {
    id: 'CM45',
    title: 'MileToKm reads a float with scanf',
    source: 'L02A p12 (MileToKm.c, sample run)',
    status: 'official',
    config: { stdin: '10.5\n' },
    code: `#include <stdio.h>
#define KMS_PER_MILE 1.609

int main(void) {
  float miles, kms;
  printf("Enter distance in miles: ");
  scanf("%f", &miles);
  kms = KMS_PER_MILE * miles;
  printf("That equals %9.2f km.\\n", kms);
  return 0;
}
`,
    expect: { output: 'Enter distance in miles: That equals     16.89 km.\n' },
  },
  {
    id: 'CM46',
    title: 'scanf %s stops at a space',
    source: 'L05B p7 (StringIO1.c)',
    status: 'official',
    config: { stdin: 'My book\n' },
    code: `#include <stdio.h>
#define LENGTH 10

int main(void) {
  char str[LENGTH];
  printf("Enter string (at most %d characters): ", LENGTH - 1);
  scanf("%s", str);
  printf("str = %s\\n", str);
  return 0;
}
`,
    expect: { output: 'Enter string (at most 9 characters): str = My\n' },
  },
  {
    id: 'CM47',
    title: 'fgets keeps the newline, puts adds one',
    source: 'L05B p6-7 (StringIO2.c)',
    status: 'official',
    config: { stdin: 'My book\n' },
    code: `#include <stdio.h>
#define LENGTH 10

int main(void) {
  char str[LENGTH];
  printf("Enter string (at most %d characters): ", LENGTH - 1);
  fgets(str, LENGTH, stdin);
  printf("str = ");
  puts(str);
  return 0;
}
`,
    // the slide shows "str = My book"; the blank line after it is the kept '\n' plus the one puts adds
    expect: { output: 'Enter string (at most 9 characters): str = My book\n\n' },
  },
  {
    id: 'CM48',
    title: 'Remove vowels (fgets, newline strip, switch, toupper)',
    source: 'L05B p8-9 (RemoveVowels.c, sample run)',
    status: 'official',
    config: { stdin: 'How HAVE you been, James?\n' },
    code: `#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main(void) {
  int i, len, count = 0;
  char str[101], newstr[101];
  printf("Enter a string (at most 100 characters): ");
  fgets(str, 101, stdin);
  len = strlen(str);
  if (str[len - 1] == '\\n')
    str[len - 1] = '\\0';
  len = strlen(str);
  for (i = 0; i < len; i++) {
    switch (toupper(str[i])) {
      case 'A': case 'E':
      case 'I': case 'O': case 'U': break;
      default: newstr[count++] = str[i];
    }
  }
  newstr[count] = '\\0';
  printf("New string: %s\\n", newstr);
  return 0;
}
`,
    expect: { output: 'Enter a string (at most 100 characters): New string: Hw HV y bn, Jms?\n' },
  },
  {
    id: 'CM49',
    title: 'readArray stops at a negative number',
    source: 'T01 Q5 (Answers p5)',
    status: 'derived',
    config: { stdin: '3 9 2 7 -1\n' },
    code: `#include <stdio.h>
#define MAX 10

int readArray(int arr[], int limit) {
  int i, input;
  printf("Enter up to %d integers, terminating with a negative integer.\\n", limit);
  i = 0;
  scanf("%d", &input);
  while (input >= 0) {
    arr[i] = input;
    i++;
    scanf("%d", &input);
  }
  return i;
}

int main(void) {
  int array[MAX], numElements, i;
  numElements = readArray(array, MAX);
  for (i = 0; i < numElements; i++)
    printf("%d ", array[i]);
  printf("\\n");
  return 0;
}
`,
    expect: { output: 'Enter up to 10 integers, terminating with a negative integer.\n3 9 2 7 \n' },
  },
  {
    id: 'CM50',
    title: 'strcmp compares by ASCII code',
    source: 'L05B p10',
    status: 'derived',
    code: `#include <stdio.h>
#include <string.h>

int main(void) {
  char a[] = "apple", b[] = "apply";
  printf("%d %d %d\\n", strcmp(a, b) < 0, strcmp(b, a) > 0, strcmp(a, "apple") == 0);
  printf("%d\\n", strncmp(a, b, 4));
  return 0;
}
`,
    expect: { output: '1 1 1\n0\n' },
  },
  {
    id: 'CM51',
    title: 'A union overlays its members',
    source: 'R02 p32; R01 p43',
    status: 'derived',
    code: `#include <stdio.h>

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
  struct SF u_sf;
  u_if.f = -6.5;
  u_sf.f = -6.5;
  printf("%d %d\\n", sizeof(u_if), sizeof(u_sf));
  printf("%x\\n", u_if.i);
  return 0;
}
`,
    expect: { output: '4 9\nc0d00000\n' },
  },
  {
    id: 'CM52',
    title: 'enum constants count up',
    source: 'R02 p35',
    status: 'official',
    code: `#include <stdio.h>

enum Heat {
  LOW = 3,
  MEDIUM,
  HIGH
};

int main(void) {
  enum Heat h = MEDIUM;
  printf("%d %d %d\\n", LOW, h, HIGH);
  return 0;
}
`,
    expect: { output: '3 4 5\n' },
  },
  {
    id: 'CM53',
    title: '2D array walk: a[2][1] is element 9 of the strip',
    source: 'R02 p26 (A0 + 4 x (2 x 4 + 1) = A0 + 36)',
    status: 'derived',
    code: `#include <stdio.h>

int main(void) {
  int a[3][4];
  int r, c;
  int *p;
  for (r = 0; r < 3; r++)
    for (c = 0; c < 4; c++)
      a[r][c] = 10 * r + c;
  p = &a[0][0];
  printf("%d %d\\n", a[2][1], *(p + 9));
  return 0;
}
`,
    expect: { output: '21 21\n' },
  },
]
