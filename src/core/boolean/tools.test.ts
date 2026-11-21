import { describe, expect, it } from 'vitest'
import { checkSteps, parseLawName } from './algebra'
import { twoLevelCircuit } from './circuit'
import { completeSet, exprNetwork, inverterUses, singleGates, singleGatesOf, type SetGate } from './gates'
import { dualOf, negationOf, printExpr } from './expr'
import { termToCube } from './cube'
import { termsOf } from './expr'
import { checkEquivalence, combine, functionFromExpr, parseFunction } from './func'
import { lintAnswer } from './lint'
import { minimize } from './minimize'
import { parseExpr, type Expr } from './parse'
import type { BoolFunction, Cube, Form } from './types'

function ok(src: string): Expr {
  const r = parseExpr(src)
  if (!r.ok) throw new Error(`${src}: ${r.errors[0].message}`)
  return r.expr
}
function fn(text: string): BoolFunction {
  const r = parseFunction(text)
  if (!r.ok) throw new Error(r.errors[0].message)
  return r.fn
}
const same = (a: string, b: string, vars?: string[]) => checkEquivalence(ok(a), ok(b), vars).equivalent
function cubes(text: string, vars: string[], form: Form): Cube[] {
  return termsOf(ok(text), form === 'sop' ? 'or' : 'and').map((t) => {
    const c = termToCube(t, vars, form)
    if (!c || !('cube' in c)) throw new Error(text)
    return c.cube
  })
}

describe('algebra fixtures (logic.md)', () => {
  it('T06 Q1(b): ΠM(5,9,13) over p,q,r,s = p\'∙q\' + r + s\' [official]', () => {
    const m = minimize(fn('G(p,q,r,s) = ΠM(5,9,13)'))
    expect(m.covers).toHaveLength(1)
    expect(same(m.summary.answer, "p'q' + r + s'")).toBe(true)
    expect(m.summary.terms).toBe(3)
  })
  it('AY25/26 Q12: (AB+C)(AC+B) = Σm(3,5,6,7) [official]', () => {
    expect(fn('F(A,B,C) = (A∙B + C)∙(A∙C + B)').on).toEqual([3, 5, 6, 7])
  })
  it("L15 p5-6: (x+y)(x+y')(x'+z) = xz; abc+abd+a'bc'+cd+bd' = b+cd [official]", () => {
    expect(same("(x+y)(x+y')(x'+z)", 'x∙z')).toBe(true)
    expect(same("abc + abd + a'bc' + cd + bd'", 'b + cd')).toBe(true)
  })
  it('T06 SE2 set operations [derived]', () => {
    const F = fn('F(A,B,C) = Σm(0,2,4,6,7)')
    const G = fn('G(A,B,C) = Σm(1,2,3,6)')
    expect(fn('F(A,B,C) = ΠM(1,3,5)').on).toEqual(F.on)
    expect(combine(F, G, 'or')!.fn.on).toEqual([0, 1, 2, 3, 4, 6, 7])
    expect(combine(F, G, 'and')!.fn.on).toEqual([2, 6])
    expect(combine(F, G, 'xor')!.fn.on).toEqual([0, 1, 3, 4, 7])
  })
  it('AY25/26 Q17a: H = F∙G [official]', () => {
    const F = fn('F(A,B,C,D) = Σm(0,1,3,4,5,7,9,13,14,15)')
    const G = fn('G(A,B,C,D) = ΠM(0,1,6,8,11,12)')
    expect(G.on).toEqual([2, 3, 4, 5, 7, 9, 10, 13, 14, 15])
    expect(combine(F, G, 'and')!.fn.on).toEqual([3, 4, 5, 7, 9, 13, 14, 15])
  })
  it("T06 Q1(a): (x + yz')(y'+y) + x'(yz' + y) = x + y [derived]", () => {
    expect(same("(x + y∙z')∙(y' + y) + x'∙(y∙z' + y)", 'x + y')).toBe(true)
  })
  it("L13 p14: x'y'z + x'yz + xy' = xy' + x'z [official]", () => {
    expect(same("x'∙y'∙z + x'∙y∙z + x∙y'", "x∙y' + x'∙z")).toBe(true)
    expect(functionFromExpr(ok("x∙y' + x'∙z"), ['x', 'y', 'z']).on).toEqual([1, 3, 4, 5])
  })
  it("R07 p51 Q2: x'(y+y'z)' = x'(y+z)', not x'(y+z); counterexample x=y=z=0 [official]", () => {
    expect(same("x'∙(y + y'∙z)'", "x'∙(y+z)'")).toBe(true)
    const e = checkEquivalence(ok("x'∙(y+z)'"), ok("x'∙(y+z)"))
    expect(e.equivalent).toBe(false)
    expect(e.counterexample).toMatchObject({ index: 0, assignment: { x: 0, y: 0, z: 0 }, left: 1, right: 0 })
  })
  it("L13 p15: (x∙y∙z')' = x'+y'+z [official]", () => {
    expect(same("(x∙y∙z')'", "x' + y' + z")).toBe(true)
  })
  it("L14 p9: ((A'∙B') + C)' = (A+B)∙C'; R08 p31: (ab)⊕(b+c) = a'b + b'c [official]", () => {
    expect(same("((A'∙B') + C)'", "(A+B)∙C'")).toBe(true)
    expect(same('(a∙b) ⊕ (b+c)', "a'∙b + b'∙c")).toBe(true)
  })
  it('AY23/24 S2 Q12: the 4-NAND circuit is XOR [official]', () => {
    expect(same("((A∙(A∙B)')'∙(B∙(A∙B)')')'", 'A⊕B')).toBe(true)
  })
  it("AY20/21 Q6: AB'(C + D' + E)'F + (C' + F')' + DF = (C + D)F [derived]", () => {
    expect(same("A∙B'∙(C + D' + E)'∙F + (C' + F')' + D∙F", '(C + D)∙F')).toBe(true)
  })
})

describe('algebra step checker', () => {
  it('L13 p13 proof of absorption: every law named and every claim matches [official]', () => {
    const r = checkSteps(`X + X∙Y
= X∙1 + X∙Y   (by identity law)
= X∙(1 + Y)   (by distributivity)
= X∙1         (by one element law)
= X           (by identity law)`)
    expect(r.valid).toBe(true)
    expect(r.steps.slice(1).map((s) => s.laws)).toEqual([['identity'], ['distributive'], ['one-zero'], ['identity']])
    expect(r.steps.slice(1).every((s) => s.claimMatches)).toBe(true)
    expect(r.steps.map((s) => s.line)).toEqual([1, 2, 3, 4, 5])
  })
  it("L15 p5: (x+y)(x+y')(x'+z) to xz, 6 literals to 2", () => {
    const r = checkSteps(`(x+y)∙(x+y')∙(x'+z)
= (x + y∙y')∙(x'+z)
= (x + 0)∙(x'+z)
= x∙(x'+z)
= x∙x' + x∙z
= 0 + x∙z
= x∙z`)
    expect(r.valid).toBe(true)
    expect(r.steps.slice(1).map((s) => s.laws)).toEqual([['distributive'], ['complement'], ['identity'], ['distributive'], ['complement'], ['identity']])
    expect(r.why.working).toBe('6 literals to 2')
  })
  it('names absorption 2, consensus, DeMorgan, involution, idempotency, commutative', () => {
    const law = (a: string, b: string) => checkSteps([{ expr: a }, { expr: b }]).steps[1].laws
    expect(law("X + X'∙Y", 'X + Y')).toEqual(['absorption-2'])
    expect(law("X∙(X' + Y)", 'X∙Y')).toEqual(['absorption-2'])
    expect(law("x∙y + x'∙z + y∙z", "x∙y + x'∙z")).toEqual(['consensus'])
    expect(law("(x+y)∙(x'+z)∙(y+z)", "(x+y)∙(x'+z)")).toEqual(['consensus'])
    expect(law("(A + B)'", "A'∙B'")).toEqual(['demorgan'])
    expect(law("(A∙B∙C)'", "A' + B' + C'")).toEqual(['demorgan'])
    expect(law("(A')'", 'A')).toEqual(['involution'])
    expect(law('A + A', 'A')).toEqual(['idempotency'])
    expect(law('A + B', 'B + A')).toEqual(['commutative'])
    expect(law('A + (B + C)', '(A + B) + C')).toEqual(['associative'])
    // Three laws in one line (distributive, complement, identity): equal, but no single law is named.
    expect(law("A∙B + A∙B'", 'A')).toBeNull()
    expect(law("A∙B + A∙B'", "A∙(B + B')")).toEqual(['distributive'])
  })
  it("T06 SE1 trap: A∙B + A'∙B' = 1 is not X + X' = 1", () => {
    const r = checkSteps("A∙B + A'∙B'\n= 1 // complement")
    expect(r.valid).toBe(false)
    expect(r.steps[1].equivalent).toBe(false)
    expect(r.steps[1].counterexample!.assignment).toEqual({ A: 0, B: 1 })
    expect(r.steps[1].claimed).toBe('complement')
  })
  it('flags a wrong citation and reports parse errors by line', () => {
    const r = checkSteps('X + X∙Y\n= X // absorption 2\n= X +')
    expect(r.steps[1].laws).toEqual(['absorption-1'])
    expect(r.steps[1].claimMatches).toBe(false)
    expect(r.steps[2].errors[0].line).toBe(3)
    expect(r.valid).toBe(false)
  })
  it('law names', () => {
    expect(parseLawName("De Morgan's theorem")).toEqual(['demorgan'])
    expect(parseLawName('absorption')).toEqual(['absorption-1', 'absorption-2'])
    expect(parseLawName('Absorption 2')).toEqual(['absorption-2'])
    expect(parseLawName('zero element')).toEqual(['one-zero'])
    expect(parseLawName('inverse law')).toEqual(['complement'])
  })
})

describe('answer linter', () => {
  const Q19 = fn('F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)')
  it('AY23/24 S2 Q19(d): EPIs first, exam syntax [official]', () => {
    const good = lintAnswer("B'.D+A'.B+B.D'", Q19, { epiFirst: true })
    expect(good.verdict).toBe('correct')
    expect(good.matchedCover).toBeDefined()
    expect(lintAnswer("A'.B+B'.D+B.D'", Q19, { epiFirst: true }).verdict).toBe('format')
    const noDots = lintAnswer("B'D+A'B+BD'", Q19, { epiFirst: true })
    expect(noDots.verdict).toBe('correct')
    expect(noDots.checks.find((c) => c.id === 'dots')?.status).toBe('warn')
    expect(lintAnswer("B'.D + A'.B + B.D'", Q19).verdict).toBe('format')
    expect(lintAnswer("B'∙D+A'∙B+B∙D'", Q19).verdict).toBe('format')
    expect(lintAnswer("B'∙D + A'∙B + B∙D'", Q19, { fitb: false }).verdict).toBe('correct')
  })
  it("alphabetical literals: Y'.Z+X accepted, X+Z.Y' not (AY23/24 S2 p12) [official]", () => {
    const f = fn("F(X,Y,Z) = X + Y'∙Z")
    expect(lintAnswer("Y'.Z+X", f).verdict).toBe('correct')
    const bad = lintAnswer("X+Z.Y'", f)
    expect(bad.verdict).toBe('format')
    expect(bad.checks.find((c) => c.id === 'order')?.message).toContain("Y'.Z")
  })
  it('equivalent but not minimal: the consensus term (R07 p36)', () => {
    const r = lintAnswer("A'.C+A.B+B.C", fn('F(A,B,C) = Σm(1,3,6,7)'))
    expect(r.verdict).toBe('not-minimal')
    expect(r.terms.every((t) => t.kind === 'prime')).toBe(true)
    const np = lintAnswer("A'.B'.C+A'.B.C+A.B", fn('F(A,B,C) = Σm(1,3,6,7)'))
    expect(np.terms[0].kind).toBe('implicant')
    expect(np.checks.some((c) => c.id === 'term' && c.message.includes("A'∙C"))).toBe(true)
  })
  it("a don't-care-only term (AY24/25 Q17a, B∙D) and a wrong answer", () => {
    const f = fn('F(A,B,C,D) = Σm(0,1,4,6,9,11) + d(5,7,13,15)')
    const dc = lintAnswer("A'.C'+A'.B+A.D+B.D", f)
    expect(dc.equivalent).toBe(true)
    expect(dc.terms[3].kind).toBe('dc-only')
    expect(dc.verdict).toBe('not-minimal')
    const wrong = lintAnswer("A'.C'+A.D", f)
    expect(wrong.verdict).toBe('wrong')
    expect(wrong.differing).toEqual([6])
    expect(lintAnswer("(A'+D).(A+B+C')", f, { form: 'pos' }).verdict).toBe('correct')
  })
  it('XOR is not SOP (T08 Q4); unknown and lowercase variables; constants', () => {
    const f = fn("F(A,B,C,D) = C∙D' + C'∙D")
    const x = lintAnswer('C⊕D', f, { fitb: false })
    expect(x.verdict).toBe('wrong')
    expect(x.checks.find((c) => c.id === 'form')?.status).toBe('fail')
    expect(lintAnswer("b'.d", Q19).verdict).toBe('invalid')
    expect(lintAnswer('A.+B', Q19).verdict).toBe('invalid')
    expect(lintAnswer('1', fn('F(A,B) = Σm(0,1,2,3)')).verdict).toBe('correct')
    expect(lintAnswer('0', fn('F(A,B) = Σm()')).verdict).toBe('correct')
    expect(lintAnswer('0', fn('F(A,B) = Σm()'), { form: 'pos' }).verdict).toBe('correct')
  })
})

describe('two-level circuits', () => {
  const V5 = ['A', 'B', 'C', 'D', 'E']
  const sop = cubes("AB + C'D + E", V5, 'sop')
  const pos = cubes("(A+B)(C'+D)E", V5, 'pos')
  it("F = AB + C'D + E: AND-OR and NAND-NAND (L14 p13-14, R07 p14)", () => {
    const ao = twoLevelCircuit(sop, V5, 'and-or')
    expect(ao.counts.byType).toEqual({ NOT: 1, AND: 2, OR: 1 })
    expect(ao.counts.gates).toBe(4)
    expect(ao.levels.value).toBe(2)
    expect(ao.delay.value).toBe(3)
    expect(ao.delay.path).toEqual(['C', "C'", "C'∙D", 'F'])
    const nn = twoLevelCircuit(sop, V5, 'nand-nand')
    expect(nn.counts.byType).toEqual({ NOT: 2, NAND: 3 })
    expect(nn.gates.find((g) => g.output === 'F')!.inputs).toEqual(["(A∙B)'", "(C'∙D)'", "E'"])
    expect(nn.gates.filter((g) => g.inverter).every((g) => g.realisedAs === 'NAND')).toBe(true)
    expect(nn.levels.value).toBe(2)
    expect(nn.expression).toBe("((A∙B)'∙(C'∙D)'∙E')'")
  })
  it("G = (A+B)(C'+D)E: OR-AND and NOR-NOR (L14 p15-16)", () => {
    const oa = twoLevelCircuit(pos, V5, 'or-and')
    expect(oa.counts.byType).toEqual({ NOT: 1, OR: 2, AND: 1 })
    const nr = twoLevelCircuit(pos, V5, 'nor-nor')
    expect(nr.counts.byType).toEqual({ NOT: 2, NOR: 3 })
    expect(nr.levels.value).toBe(2)
  })
  it('complemented literals available; inverter delay setting', () => {
    expect(twoLevelCircuit(sop, V5, 'and-or', { complementsAvailable: true }).counts.gates).toBe(3)
    expect(twoLevelCircuit(sop, V5, 'and-or', { complementsAvailable: true }).delay.value).toBe(2)
    expect(twoLevelCircuit(sop, V5, 'and-or', { inverterDelay: 0 }).delay.value).toBe(2)
    // AY23/24 S1 Q18(v): B'∙x with B' from the flip-flop's Q' needs one AND gate.
    expect(twoLevelCircuit(cubes("B'x", ['B', 'x'], 'sop'), ['B', 'x'], 'and-or', { complementsAvailable: true }).counts.gates).toBe(1)
  })
  it('single term, single literal and constants', () => {
    const ab = cubes('A∙B', ['A', 'B'], 'sop')
    const one = twoLevelCircuit(ab, ['A', 'B'], 'nand-nand')
    expect(one.counts.byType).toEqual({ NAND: 1, NOT: 1 })
    expect(one.levels.value).toBe(1)
    expect(twoLevelCircuit(cubes("A'", ['A', 'B'], 'sop'), ['A', 'B'], 'and-or').counts.byType).toEqual({ NOT: 1 })
    const c1 = twoLevelCircuit([{ mask: 0, bits: 0 }], ['A', 'B'], 'and-or')
    expect(c1.constant).toBe(1)
    expect(twoLevelCircuit([], ['A', 'B'], 'and-or').constant).toBe(0)
    expect(twoLevelCircuit([], ['A', 'B'], 'or-and').constant).toBe(1)
  })
  it('from a minimal cover: L15 p50-51 SOP on NAND-NAND', () => {
    const f = fn("F(A,B,C,D) = A∙B∙C + B'∙C∙D' + A∙D + B'∙C'∙D'")
    const m = minimize(f)
    const c = twoLevelCircuit(m.covers[0].primes.map((id) => m.primes[id].cube), f.vars, 'nand-nand')
    expect(c.counts.byType).toEqual({ NOT: 2, NAND: 4 })
    expect(c.delay.value).toBe(3)
  })
})

describe('gate networks from expressions', () => {
  it('AY23/24 S2 Q12-13: 4 NANDs make XOR, 3 levels, 9 ns at 3 ns per gate [official]', () => {
    const e = ok("((A∙(A∙B)')'∙(B∙(A∙B)')')'")
    const n = exprNetwork(e, { delays: { NAND: 3 } })
    expect(n.counts.byType).toEqual({ NAND: 4 })
    expect(n.levels.value).toBe(3)
    expect(n.delay.value).toBe(9)
    expect(singleGatesOf(e, ['A', 'B']).matches.map((m) => m.gate)).toEqual(['XOR'])
  })
  it('L17 p35: full adder S = 2t, C = 3t [official]', () => {
    expect(exprNetwork(ok('(X⊕Y)⊕Z')).delay.value).toBe(2)
    expect(exprNetwork(ok('X∙Y + (X⊕Y)∙Z')).delay.value).toBe(3)
  })
  it('L17 p38: 4-bit ripple-carry adder S4 = 8t, C5 = 9t [official]', () => {
    let c = 'C1'
    const s: string[] = []
    for (let i = 1; i <= 4; i++) {
      s.push(`(X${i}⊕Y${i})⊕(${c})`)
      c = `X${i}∙Y${i} + (X${i}⊕Y${i})∙(${c})`
    }
    expect(s.map((x) => exprNetwork(ok(x)).delay.value)).toEqual([2, 4, 6, 8])
    expect(exprNetwork(ok(c)).delay.value).toBe(9)
  })
  it('AY23/24 S1 Q8: B∙(A+C) is one AND and one OR [official]', () => {
    expect(exprNetwork(ok('B∙(A + C)')).counts.byType).toEqual({ AND: 1, OR: 1 })
  })
  it('input inverters are gates but not levels (R07 p14); complemented inputs; fan-in delay', () => {
    const n = exprNetwork(ok("A'∙B + C"))
    expect(n.counts).toMatchObject({ gates: 3, inverters: 1 })
    expect(n.levels.value).toBe(2)
    expect(n.delay.value).toBe(3)
    expect(exprNetwork(ok("A'∙B + C"), { complementsAvailable: true }).counts.gates).toBe(2)
    expect(exprNetwork(ok('(A∙B∙C)\''), { fanInDelay: true }).delay.value).toBe(3)
    // An inverter after a gate is a level.
    expect(exprNetwork(ok("((A∙B)')'")).levels.value).toBe(2)
  })
  it('L14 p9: circuit analysis ((A\'∙B\') + C)\' = (A+B)∙C\' [official]', () => {
    const n = exprNetwork(ok("((A'∙B') + C)'"))
    expect(n.counts.byType).toEqual({ NOT: 2, AND: 1, NOR: 1 })
  })
})

describe('single gates, complete sets, inverters', () => {
  it('AY23/24 S1 Q6: an 8-bit number divisible by 4 is NOR(G,H) [official]', () => {
    const V = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const f: BoolFunction = { name: 'F', vars: V, on: Array.from({ length: 256 }, (_, m) => m).filter((m) => m % 4 === 0), dc: [] }
    expect(singleGates(f).matches.map((m) => `${m.gate} ${m.inputs.join(',')}`)).toEqual(['NOR G,H'])
  })
  it('AY24/25 Q2: {OR,NOT}, {XOR,AND}, {NOR,AND}, {NAND} are all complete (key E) [official]', () => {
    for (const s of [['OR', 'NOT'], ['XOR', 'AND'], ['NOR', 'AND'], ['NAND']] as SetGate[][]) expect(completeSet(s).complete).toBe(true)
    expect(completeSet(['XOR', 'AND']).not).toBe('XOR(a, 1)')
    // Without the constant 1, XOR and AND keep 0 at 0 and cannot invert (T06 p2 makes constants available).
    expect(completeSet(['XOR', 'AND'], { constants: false }).complete).toBe(false)
    expect(completeSet(['AND', 'OR']).complete).toBe(false)
    expect(completeSet(['NOR']).complete).toBe(true)
  })
  it('AY24/25 Q1: XOR, XNOR and NOR can act as inverters, OR cannot (key D) [official]', () => {
    expect(inverterUses('OR').ways).toEqual([])
    expect(inverterUses('XOR').ways).toEqual(['XOR(a, 1)'])
    expect(inverterUses('XNOR').ways).toEqual(['XNOR(a, 0)'])
    expect(inverterUses('NOR').ways).toEqual(['NOR(a, a)', 'NOR(a, 0)'])
    expect(inverterUses('NAND').ways).toEqual(['NAND(a, a)', 'NAND(a, 1)'])
  })
})

describe('duality and negation (L13 p11, p15) [official]', () => {
  it('dual keeps literals, negation flips them', () => {
    expect(printExpr(dualOf(ok('a + (b∙c)')))).toBe('a∙(b + c)')
    expect(printExpr(dualOf(ok('x + 1')))).toBe('x∙0')
    expect(printExpr(negationOf(ok("x∙y∙z'")))).toBe("x' + y' + z")
    expect(same("(x∙y∙z')'", printExpr(negationOf(ok("x∙y∙z'"))))).toBe(true)
    expect(same("((A+B')∙C⊕D)'", printExpr(negationOf(ok("(A+B')∙C⊕D"))))).toBe(true)
  })
})
