import { describe, expect, it } from 'vitest'
import { exprTreesByLine } from './exprtree'

const SRC = `int main(void) {
  int a[2] = {1, 2};
  int *p = a;
  int x = *p++;
  int b = 1, c = 0;
  int y = x > b || b > c && x == b;
  p->m;
  return 0;
}`

describe('expression grouping (L02C p9)', () => {
  it('*p++ is *(p++): postfix ++ binds tighter than unary *', () => {
    const t = exprTreesByLine(`int main(void) {\n  int a[2] = {1, 2};\n  int *p = a;\n  int x = *p++;\n  return 0;\n}`).get(4)!
    expect(t).toHaveLength(1)
    expect(t[0].op).toBe('*')
    expect(t[0].row?.level).toBe(2)
    expect(t[0].kids[0].op).toBe('expr++')
    expect(t[0].kids[0].row?.level).toBe(1)
  })

  it('&& binds tighter than ||', () => {
    const lines = exprTreesByLine(SRC.replace('  p->m;\n', ''))
    const t = lines.get(6)![0]
    expect(t.op).toBe('||')
    expect(t.kids[1].op).toBe('&&')
    expect(t.kids[1].kids[0].op).toBe('>')
  })

  it('plain names and constants are not listed; a program that does not parse gives nothing', () => {
    const lines = exprTreesByLine(`int main(void) {\n  int a = 5;\n  a = 6;\n  return 0;\n}`)
    expect(lines.get(2)).toBeUndefined()
    expect(lines.get(3)![0].op).toBe('=')
    expect(exprTreesByLine('int main( {').size).toBe(0)
  })

  it('a[i] and p->m carry their rewrites', () => {
    const lines = exprTreesByLine(`struct s { int m; };\nint main(void) {\n  struct s v;\n  struct s *q = &v;\n  int a[3];\n  a[1] = q->m;\n  return 0;\n}`)
    const t = lines.get(6)![0]
    expect(t.kids[0].note).toBe('a[1] is *(a + 1)')
    expect(t.kids[1].note).toBe('q->m is (*q).m')
  })
})
