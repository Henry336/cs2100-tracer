/** Course proofs re-checked line by line: every step must be equal to the one before and match the cited law. */
import { describe, expect, it } from 'vitest'
import { checkSteps, parseSteps } from './algebra'
import { parseFunction } from './func'
import { lintAnswer } from './lint'

const laws = (txt: string) => {
  const r = checkSteps(txt)
  expect(r.valid).toBe(true)
  for (const s of r.steps.slice(1)) expect(s.claimMatches, `line ${s.line}: ${s.text}`).toBe(true)
  return r.steps.slice(1).map((s) => s.laws)
}

describe('universal gate proofs (L14 p11-12) [official]', () => {
  it('NAND as NOT, AND, OR', () => {
    expect(laws("(x∙x)'\n= x' (by idempotency)")).toEqual([['idempotency']])
    expect(laws("((x∙y)'∙(x∙y)')'\n= ((x∙y)')' (by idempotency)\n= x∙y (by involution)")).toEqual([['idempotency'], ['involution']])
    expect(laws("((x∙x)'∙(y∙y)')'\n= (x'∙y')' (by idempotency)\n= (x')'+(y')' (by DeMorgan)\n= x+y (by involution)")).toEqual([
      ['idempotency'],
      ['demorgan'],
      ['involution'],
    ])
  })
  it('NOR as NOT, OR, AND', () => {
    expect(laws("(x+x)'\n= x' (by idempotency)")).toEqual([['idempotency']])
    expect(laws("((x+x)'+(y+y)')'\n= (x'+y')' (by idempotency)\n= (x')'∙(y')' (by DeMorgan)\n= x∙y (by involution)")).toEqual([
      ['idempotency'],
      ['demorgan'],
      ['involution'],
    ])
  })
  it("DeMorgan and involution in one line are both named: (A'+B)' = A∙B'", () => {
    expect(checkSteps("(A'+B)'\n= A∙B' (by DeMorgan)").steps[1]).toMatchObject({ laws: ['demorgan', 'involution'], claimMatches: true })
  })
})

describe('recitation and tutorial chains', () => {
  it("R07 p51-53: (a'+a)∙b∙c + a∙b'∙(c'+c) [official]", () => {
    expect(laws("(a'+a)∙b∙c + a∙b'∙(c'+c)\n= 1∙b∙c + a∙b'∙1 (by complement)\n= b∙c + a∙b' (by identity)")).toEqual([['complement'], ['identity']])
  })
  it("consensus (L13 p12) and A∙B + (A∙B)' = 1 (T06 SE1) [official]", () => {
    expect(laws("x∙y + x'∙z + y∙z\n= x∙y + x'∙z (by consensus)")).toEqual([['consensus']])
    expect(laws("A∙B + (A∙B)'\n= 1 (by complement)")).toEqual([['complement']])
  })
  it('T06 Q1(a) to x + y, one law per line [derived]', () => {
    expect(
      laws(`(x + y∙z')∙(y' + y) + x'∙(y∙z' + y)
= (x + y∙z')∙1 + x'∙(y∙z' + y) (by complement)
= x + y∙z' + x'∙(y∙z' + y) (by identity)
= x + y∙z' + x'∙y (by absorption 1)
= x + y∙z' + y (by absorption 2)
= x + y (by absorption 1)`),
    ).toEqual([['complement'], ['identity'], ['absorption-1'], ['absorption-2'], ['absorption-1']])
  })
})

/* ---------- Adversarial course-fidelity checks (verifier). Each test encodes what the cited page shows. ---------- */

describe('law tags written the way the course writes them', () => {
  // L15 p5-6 and R07 p29 put the law in plain brackets after the line; T06 Ans p1 uses square brackets.
  // Without "by" the tag is parsed as variables (d∙i∙s∙t...), so a correct slide proof is reported as not equal.
  it('parseSteps reads "(distributivity)" (L15 p5) and "[distributive]" (T06 Ans p1) as law tags', () => {
    expect(parseSteps("x∙(y+z)\n= x∙y + x∙z (distributivity)")[1]).toMatchObject({ expr: 'x∙y + x∙z', law: 'distributivity' })
    expect(parseSteps("x∙(y+z)\n= x∙y + x∙z [distributive]")[1]).toMatchObject({ expr: 'x∙y + x∙z', law: 'distributive' })
    expect(parseSteps("(c∙d)'\n= c' + d' (DeMorgan’s)")[1]).toMatchObject({ expr: "c' + d'", law: 'DeMorgan’s' })
  })
  it('T06 Ans p1 Q1(b) chain as printed, with [law] tags, is valid and every tag matches [official]', () => {
    expect(
      laws(`(p + q' + r + s')∙(p' + q + r + s')∙(p' + q' + r + s')
= ((p∙p') + (q' + r + s'))∙(p' + q + r + s') [distributive]
= (0 + (q' + r + s'))∙(p' + q + r + s') [complement]
= (q' + r + s')∙(p' + q + r + s') [identity]
= (q'∙(p' + q)) + (r + s') [distributive]
= p'∙q' + r + s' [absorption 2]`),
    ).toEqual([['distributive'], ['complement'], ['identity'], ['distributive'], ['absorption-2']])
  })
})

describe('course proofs whose steps the checker must name', () => {
  // L15 p5 line 1 expands (x+y)(x+y') in one step and the slide calls it distributivity. The checker returns
  // laws = null ("not one or two L13 laws") so the official proof cannot be self-marked.
  it('L15 p5 verbatim: (x+y)(x+y\') expanded in one line is "distributivity" [official]', () => {
    expect(
      laws(`(x+y)∙(x+y')∙(x'+z)
= (x∙x + x∙y' + x∙y + y∙y')∙(x'+z) (by distributivity)
= (x + x∙y' + x∙y + y∙y')∙(x'+z) (by idempotency)
= (x + x∙(y'+y) + y∙y')∙(x'+z) (by distributivity)
= (x + x∙(1) + 0)∙(x'+z) (by complement)
= (x + x)∙(x'+z) (by identity)
= x∙(x'+z) (by idempotency)
= x∙x' + x∙z (by distributivity)
= 0 + x∙z (by complement)
= x∙z (by identity)`),
    ).toHaveLength(9)
  })
  // L15 p6 = R07 p29: abd + bd' = ab + bd' is cited as absorption 2 (the slide's side note: b(ad + d') = b(a + d')),
  // and a'bc' + ab = bc' + ab likewise. The checker names neither (laws = null).
  it("L15 p6 / R07 p29 verbatim: every cited law matches, including absorption 2 under a common factor [official]", () => {
    expect(
      laws(`a∙b∙c + a∙b∙d + a'∙b∙c' + c∙d + b∙d'
= a∙b∙c + a∙b + a'∙b∙c' + c∙d + b∙d' (by absorption 2)
= a∙b∙c + a∙b + b∙c' + c∙d + b∙d' (by absorption 2)
= a∙b + b∙c' + c∙d + b∙d' (by absorption 1)
= a∙b + c∙d + b∙(c'+d') (by distributivity)
= a∙b + c∙d + b∙(c∙d)' (by DeMorgan's)
= a∙b + c∙d + b (by absorption 2)
= b + c∙d (by absorption 1)`),
    ).toHaveLength(7)
  })
})

describe('answer linter: course marking rules', () => {
  const F4 = (() => {
    const r = parseFunction('F4(A,B,C,D) = ΠM(4,8,9,11,12) ∙ D(2,3,6,7,10,14)')
    if (!r.ok) throw new Error('bad fixture')
    return r.fn
  })()
  // T06 Ans p1: "Writing xy when it should be x∙y will receive zero mark." In course (non-FITB) mode a
  // dot-less answer must not be graded correct; today it is a warning and the verdict is 'correct'.
  it("T06 Ans p1: A'B' + BD (no ∙) is not a correct tutorial answer [official]", () => {
    const r = lintAnswer("A'B' + BD", F4, { fitb: false })
    expect(r.verdict).not.toBe('correct')
    expect(r.checks.find((c) => c.id === 'dots')?.status).toBe('fail')
    expect(lintAnswer("A'∙B' + B∙D", F4, { fitb: false }).verdict).toBe('correct')
  })
  // AY23/24 S2 Q19(d): "Do not enter any space or punctuations other than quote, dot, or plus."
  // Brackets in an SOP fill-in-the-blank answer break that rule; today the verdict is 'correct'.
  it("AY23/24 S2 Q19(d): brackets are not allowed in an SOP fill-in-the-blank answer [official]", () => {
    const q19 = parseFunction('F(A,B,C,D) = ΠM(0,2,8,10,13) ∙ X(3,7,11,12,15)')
    if (!q19.ok) throw new Error('bad fixture')
    expect(lintAnswer("B'.D+A'.B+B.D'", q19.fn, { epiFirst: true }).verdict).toBe('correct')
    expect(lintAnswer("(B'.D)+A'.B+B.D'", q19.fn, { epiFirst: true }).verdict).toBe('format')
  })
})
