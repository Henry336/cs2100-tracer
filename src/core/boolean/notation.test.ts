import { describe, expect, it } from 'vitest'
import { classify, countLiterals, printExpr, rowsOf } from './expr'
import { canonical, identifyTerm, parseFunction, termInfo, truthTable } from './func'
import { kmapLayout, neighbours } from './kmap'
import { parseExpr, type Expr } from './parse'

function ok(src: string): Expr {
  const r = parseExpr(src)
  if (!r.ok) throw new Error(`${src}: ${r.errors[0].message}`)
  return r.expr
}
const fitb = (src: string) => printExpr(ok(src), 'fitb')
const warnCodes = (src: string) => {
  const r = parseExpr(src)
  return r.warnings.map((w) => w.code)
}
const err = (src: string) => {
  const r = parseExpr(src)
  if (r.ok) throw new Error(`${src} parsed`)
  return r.errors[0]
}
const truth = (src: string, vars: string[]) => rowsOf(ok(src), vars).join('')

describe('parser: course notation', () => {
  it('precedence NOT > AND > OR (L13 p9) [official]', () => {
    expect(fitb('A∙B + C')).toBe('A.B+C')
    expect(fitb("X + Y'")).toBe("X+Y'")
    expect(fitb("P + Q'∙R")).toBe("P+Q'.R")
    expect(fitb("(P + Q)'∙R")).toBe("(P+Q)'.R")
    expect(fitb('A∙(B + C)')).toBe('A.(B+C)')
    expect(truth('A∙B + C', ['A', 'B', 'C'])).toBe('01010111')
    expect(truth('A∙(B + C)', ['A', 'B', 'C'])).toBe('00000111')
  })

  it('every AND symbol and juxtaposition', () => {
    for (const s of ['A.B', 'A∙B', 'A·B', 'A⋅B', 'AB', 'A B']) expect(fitb(s)).toBe('A.B')
    expect(fitb("A'B")).toBe("A'.B")
    expect(fitb('(A+B)(C+D)')).toBe('(A+B).(C+D)')
    expect(fitb('A(B+C)')).toBe('A.(B+C)')
    expect(fitb("(A+B)'C")).toBe("(A+B)'.C")
    expect(warnCodes('AB')).toEqual(['implicit-and'])
    expect(warnCodes('A.B')).toEqual([])
    expect(warnCodes('A*B')).toEqual(['symbol'])
  })

  it('overbar as NOT: combining overline, combining macron, precomposed', () => {
    expect(fitb('A̅')).toBe("A'")
    expect(fitb('Ā')).toBe("A'")
    expect(fitb('Ā')).toBe("A'")
    expect(fitb('āb')).toBe("a'.b")
    expect(fitb('(A+B)̅')).toBe("(A+B)'")
    expect(fitb('A̅B̅')).toBe("A'.B'")
    expect(fitb("A’ + B′")).toBe("A'+B'")
    expect(fitb("A''")).toBe("A''")
    expect(truth("A''", ['A'])).toBe('01')
  })

  it('XOR and XNOR (L14 p6)', () => {
    expect(truth('A⊕B', ['A', 'B'])).toBe('0110')
    expect(truth('A^B', ['A', 'B'])).toBe('0110')
    expect(truth('A⊙B', ['A', 'B'])).toBe('1001')
    expect(truth("(A⊕B)'", ['A', 'B'])).toBe('1001')
    expect(truth('A⊕B⊕C', ['A', 'B', 'C'])).toBe('01101001')
    expect(printExpr(ok('(A∙B)⊕C'))).toBe('(A∙B) ⊕ C')
    expect(warnCodes('A⊕B∙C')).toContain('xor-precedence')
    expect(warnCodes('A + B⊕C')).toContain('xor-precedence')
    expect(warnCodes('(A∙B)⊕C')).toEqual([])
  })

  it('constants and subscripted variables', () => {
    expect(truth('A + 1', ['A'])).toBe('11')
    expect(truth('A∙0', ['A'])).toBe('00')
    expect(truth('1', ['A'])).toBe('11')
    const r = parseExpr("X0∙X1' + A3B3'")
    expect(r.ok && r.vars).toEqual(['X0', 'X1', 'A3', 'B3'])
  })

  it('errors are structured with positions, never thrown', () => {
    expect(err('').code).toBe('empty')
    expect(err('A +').message).toContain("after '+'")
    expect(err('(A + B').at).toEqual([0, 1])
    expect(err('A + B)').message).toContain('no matching (')
    expect(err("'A").message).toContain('after the term')
    expect(err('A & B').message).toContain('for AND')
    expect(err('A | B').message).toContain('+ for OR')
    expect(err('~A').message).toContain("' after the term")
    expect(err('A ∙∙ B').message).toContain('missing a term')
    expect(err('2').message).toContain('0 and 1')
    expect(err('A + 10').at).toEqual([4, 6])
    expect(err('A = B').message).toContain('=')
    expect(err('é').code).toBe('char')
  })

  it('course printing', () => {
    expect(printExpr(ok("ab'+c"))).toBe("a∙b' + c")
    expect(printExpr(ok("(AB)'"))).toBe("(A∙B)'")
    expect(printExpr(ok('(A+B)C'))).toBe('(A + B)∙C')
  })
})

describe('functions: Σm, ΠM, don\'t-cares', () => {
  const fn = (s: string) => {
    const r = parseFunction(s)
    if (!r.ok) throw new Error(r.errors[0].message)
    return r
  }
  it('Σm with ranges and d (L13 p23, L15 p45)', () => {
    const r = fn('F(A,B,C,D) = Σm(1,3-5) + d(0,2)')
    expect(r.fn).toMatchObject({ name: 'F', vars: ['A', 'B', 'C', 'D'], on: [1, 3, 4, 5], dc: [0, 2] })
    expect(fn('F(K,L,M,N) = Σm(2,6,8) + d(3,7,11..15)').fn.dc).toEqual([3, 7, 11, 12, 13, 14, 15])
    expect(fn('F(A,B,C) = Σm(1, 3–5)').fn.on).toEqual([1, 3, 4, 5])
  })
  it('ΠM with D(..) and X(..) removes don\'t-cares from the minterms (T06 Q3(b))', () => {
    const r = fn('T(A,B,C,D) = ΠM(3,7,8,10,12,13) ∙ X(6,11,14,15)')
    expect(r.fn.on).toEqual([0, 1, 2, 4, 5, 9])
    expect(r.fn.dc).toEqual([6, 11, 14, 15])
    expect(r.source).toBe('maxterms')
    expect(fn('F4(A,B,C,D) = ΠM(4,8,9,11,12)∙D(2,3,6,7,10,14)').fn.on).toEqual([0, 1, 5, 13, 15])
  })
  it('ASCII and past-paper spellings (T06 SE2, AY24/25)', () => {
    expect(fn('F(A,B,C) = Sum-m(0, 2, 4, 6, 7)').fn.on).toEqual([0, 2, 4, 6, 7])
    expect(fn('F(A,B,C) = Prod-M(2, 3, 5)').fn.on).toEqual([0, 1, 4, 6, 7])
    expect(fn('F(A,B,C,D) = Σm(1,3,4,6,10,12) + Σx(2,5,7,13,14)').fn.dc).toEqual([2, 5, 7, 13, 14])
    expect(fn('F(A,B,C,D) = ∑m(1) + x(2)').fn.on).toEqual([1])
    expect(fn('G(A,B,C,D) = M(0,1,6,8,11,12)').fn.on).toEqual([2, 3, 4, 5, 7, 9, 10, 13, 14, 15])
  })
  it('no header: infers variables and warns', () => {
    const r = fn('m(1,3,4,6,10,12) + d(2,5,7,13,14)')
    expect(r.fn.vars).toEqual(['A', 'B', 'C', 'D'])
    expect(r.warnings[0].code).toBe('vars-assumed')
    expect(parseFunction('Σm(1,3)', { vars: ['x', 'y', 'z'] }).ok).toBe(true)
  })
  it('expression form (first variable is the MSB)', () => {
    const r = fn("F(A,B,C) = A∙B + A'∙C + A'∙B'")
    expect(r.fn.on).toEqual([0, 1, 3, 6, 7])
    expect(fn('A + C∙B').fn.vars).toEqual(['A', 'B', 'C'])
  })
  it('errors', () => {
    const e = (s: string) => {
      const r = parseFunction(s)
      if (r.ok) throw new Error('parsed')
      return r.errors[0]
    }
    expect(e('F(A,B) = Σm(1,4)').code).toBe('range')
    expect(e('F(A,B,C) = Σm(1,2) + d(2)').code).toBe('overlap')
    expect(e('F(A,B,C) = Σm(1) + ΠM(2)').message).toContain('one')
    expect(e('F(A,B,C) = Σm(5-3)').message).toContain('backwards')
    expect(e('F(A,B) = A∙C').code).toBe('unknown-var')
    expect(e('F(A,A) = A').message).toContain('twice')
  })
})

describe('minterms, maxterms, canonical forms', () => {
  const V = ['A', 'B', 'C', 'D']
  it('L13 p21 quiz [official]', () => {
    expect(termInfo(3, V).minterm).toBe("A'∙B'∙C∙D")
    expect(termInfo(10, V).minterm).toBe("A∙B'∙C∙D'")
    expect(termInfo(11, V).minterm).toBe("A∙B'∙C∙D")
    expect(termInfo(3, V).maxterm).toBe("A+B+C'+D'")
    expect(termInfo(13, V).maxterm).toBe("A'+B'+C+D'")
    expect(termInfo(0, V).maxterm).toBe('A+B+C+D')
    const id = (s: string) => {
      const r = identifyTerm(s, V)
      return r.ok ? `${r.kind === 'minterm' ? 'm' : 'M'}${r.index}` : r.errors[0].message
    }
    expect(id("A∙B∙C∙D'")).toBe('m14')
    expect(id("A∙B'∙C'∙D")).toBe('m9')
    expect(id("A+B+C'+D")).toBe('M2')
    expect(id("A'+B+C+D'")).toBe('M9')
    expect(id("A∙B'∙C")).toContain('missing D')
  })
  it('two variables: m2 = x∙y\', M2 = x\'+y (L13 p20) [official]', () => {
    expect(termInfo(2, ['x', 'y'])).toMatchObject({ minterm: "x∙y'", maxterm: "x'+y", bits: '10' })
  })
  it('L13 p23-25: F2 and F3 [official]', () => {
    const c2 = canonical({ name: 'F2', vars: ['x', 'y', 'z'], on: [1, 4, 5, 6, 7], dc: [] })
    expect(c2.pi).toBe('ΠM(0, 2, 3)')
    expect(c2.fitbMaxterms).toBe('0,2,3')
    const c3 = canonical({ name: 'F3', vars: ['x', 'y', 'z'], on: [1, 3, 4, 5], dc: [] })
    expect(c3.maxterms).toEqual([0, 2, 6, 7])
    const f1 = parseFunction("F1(x,y,z) = x∙y∙z'")
    expect(f1.ok && f1.fn.on).toEqual([6])
  })
  it('R07 p51-53 canonical forms [official]', () => {
    const a = parseFunction("F(a,b,c) = (a'+a)∙b∙c + a∙b'∙(c'+c)")
    if (!a.ok) throw new Error('parse')
    expect(canonical(a.fn).sumOfMinterms).toBe("a'∙b∙c + a∙b'∙c' + a∙b'∙c + a∙b∙c")
    const b = parseFunction("F(x,y,z) = (x+y'+z'∙z)∙(x'∙x+y+z)")
    if (!b.ok) throw new Error('parse')
    expect(canonical(b.fn).maxterms).toEqual([0, 2, 3, 4])
  })
  it('truth table columns, one per sub-expression (L13 p7-8)', () => {
    const t = truthTable(ok("x'∙(y + z)"), ['x', 'y', 'z'])
    expect(t.columns.map((c) => c.label)).toEqual(['x', 'y', 'z', "x'", 'y + z', "x'∙(y + z)"])
    expect(t.rows.map((r) => r.values[5]).join('')).toBe('01110000')
  })
})

describe('SOP/POS classification and literal counting', () => {
  const V = ['V', 'W', 'X', 'Y', 'Z']
  const c = (s: string) => {
    const k = classify(ok(s), V)
    return `${k.sop.yes ? 'S' : '-'}${k.pos.yes ? 'P' : '-'}`
  }
  it('L13 p18 quiz [derived from L13 p16-17 definitions]', () => {
    expect(c("X'∙Y + X∙Y' + X∙Y∙Z")).toBe('S-')
    expect(c("(X+Y')∙(X'+Y)∙(X'+Z')")).toBe('-P')
    expect(c("X' + Y + Z")).toBe('SP')
    expect(c("X∙(W'+Y∙Z)")).toBe('--')
    expect(c("X∙Y∙Z'")).toBe('SP')
    expect(c("W∙X'∙Y + V∙(X∙Z+W')")).toBe('--')
  })
  it('constants count as SOP and POS (T06 p2); XOR is not SOP (T08 Q4)', () => {
    expect(c('1')).toBe('SP')
    expect(c('0')).toBe('SP')
    const k = classify(ok('X⊕Y'), V)
    expect(k.sop.yes).toBe(false)
    expect(k.sop.why.working).toContain('T08 Q4')
    expect(c("(X∙Y)'")).toBe('--')
  })
  it('POS is not always canonical POS (AY23/24 S1 Q7(iii))', () => {
    const k = classify(ok("(A+B)∙(A'+C)"), ['A', 'B', 'C'])
    expect(k.pos.yes).toBe(true)
    expect(k.canonicalPos.yes).toBe(false)
    expect(classify(ok("(A+B'+C)∙(A'+B+C)"), ['A', 'B', 'C']).canonicalPos.yes).toBe(true)
  })
  it('literal counts (L15 p4-6) [official]', () => {
    expect(countLiterals(ok("(x+y)(x+y')(x'+z)"))).toBe(6)
    expect(countLiterals(ok('x∙z'))).toBe(2)
    expect(countLiterals(ok("abc+abd+a'bc'+cd+bd'"))).toBe(13)
    expect(countLiterals(ok('b+cd'))).toBe(3)
  })
})

describe('K-map layouts', () => {
  it('4 variables, rows orientation (L15 p19) [official]', () => {
    const l = kmapLayout(['A', 'B', 'C', 'D'], 'rows')!
    expect(l.grid[0]).toEqual([
      [0, 1, 3, 2],
      [4, 5, 7, 6],
      [12, 13, 15, 14],
      [8, 9, 11, 10],
    ])
    expect(l.rowBars).toEqual([
      { v: 'A', indices: [2, 3] },
      { v: 'B', indices: [1, 2] },
    ])
    expect(l.colBars).toEqual([
      { v: 'C', indices: [2, 3] },
      { v: 'D', indices: [1, 2] },
    ])
  })
  it('4 variables, AB on the columns (L15 p33, R07 p43): cell (row CD, col AB) = m(4AB + CD) [official]', () => {
    const l = kmapLayout(['A', 'B', 'C', 'D'], 'cols')!
    expect(l.colVars).toEqual(['A', 'B'])
    expect(l.grid[0][0]).toEqual([0, 4, 12, 8])
    expect(l.grid[0][3]).toEqual([2, 6, 14, 10])
    expect(l.where[13]).toEqual({ map: 0, row: 1, col: 2 })
  })
  it('3 variables (L15 p16-17) and 2 variables (L15 p13) [official]', () => {
    expect(kmapLayout(['a', 'b', 'c'])!.grid[0]).toEqual([
      [0, 1, 3, 2],
      [4, 5, 7, 6],
    ])
    expect(kmapLayout(['a', 'b'])!.grid[0]).toEqual([
      [0, 1],
      [2, 3],
    ])
  })
  it("5 variables: v' map m0-m15 and v map m16-m31, not mirrored (L15 p22) [official]", () => {
    const l = kmapLayout(['v', 'w', 'x', 'y', 'z'])!
    expect(l.maps.map((m) => m.label)).toEqual(["v'", 'v'])
    expect(l.grid[0][2]).toEqual([12, 13, 15, 14])
    expect(l.grid[1][2]).toEqual([28, 29, 31, 30])
    expect(l.where[21]).toEqual({ map: 1, row: 1, col: 1 })
    expect(neighbours(5, l.vars).map((x) => x.m)).toEqual([21, 13, 1, 7, 4])
  })
  it('neighbours: m0 has m1, m2, m4, m8; m14 has m6, m10, m12, m15 (R07 p31) [official]', () => {
    const V = ['A', 'B', 'C', 'D']
    expect(neighbours(0, V).map((x) => x.m).sort((a, b) => a - b)).toEqual([1, 2, 4, 8])
    expect(neighbours(14, V).map((x) => x.m).sort((a, b) => a - b)).toEqual([6, 10, 12, 15])
    expect(kmapLayout(['A'])).toBeNull()
  })
})
