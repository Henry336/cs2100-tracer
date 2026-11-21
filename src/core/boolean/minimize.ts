import { coverText, covers, literalCount, literalsOf, mintermsOf, termText } from './cube'
import { offOf } from './func'
import type { LoopPiece } from './kmap'
import type { BoolFunction, Cube, Explain, Form } from './types'

/** A K-map group: 1s for SOP, 0s for POS (where it is a group of F' and gives a sum term). */
export interface Group {
  cube: Cube
  /** Term in course notation: product term for SOP, sum term for POS. */
  term: string
  /** Term in fill-in-the-blank notation (alphabetical literals). */
  fitb: string
  /** For POS: the product term of F' that this group is, before DeMorgan. */
  complementTerm?: string
  /** Target cells (1s for SOP, 0s for POS) in the group. */
  cells: number[]
  /** Don't-cares in the group. */
  dontCares: number[]
  size: number
  literals: number
  /** How the term is read off the group. */
  why: Explain
  /** Filled by traceKMap: rectangles to draw. */
  pieces?: LoopPiece[]
}

export interface Prime extends Group {
  id: number
  essential: boolean
  /** Target cells that only this PI covers (what makes it essential). */
  reasons: number[]
  status: Explain
}

export interface Cover {
  /** Prime ids, EPIs first. */
  primes: number[]
  terms: number
  literals: number
  text: string
  fitb: string
  /** For POS: the SOP of F' this cover complements. */
  complementText?: string
  /** What the built circuit outputs on each don't-care row (T06 Q4(d): don't-cares are fixed once built). */
  dcValues: { cell: number; value: 0 | 1 }[]
}

export interface Count {
  value: number
  /** False when the count stopped at the search limit, so `value` is a lower bound. */
  exact?: boolean
  why: Explain
}

export interface Minimization {
  fn: BoolFunction
  form: Form
  /** 1s (SOP) or 0s (POS). */
  target: number[]
  primes: Prime[]
  /** Maximal groups made only of don't-cares. They are not PIs (L15 p49). */
  dcOnly: Group[]
  /** For each target cell, the PIs that cover it. */
  coveredBy: { cell: number; primes: number[] }[]
  essentials: number[]
  /** Target cells left after taking every EPI. */
  leftover: number[]
  /** Minimal covers (fewest terms, then fewest literals, L15 p12, p34), at most MAX_COVERS; summary.covers counts them all. */
  covers: Cover[]
  summary: {
    /** Every group of 1s (or 0s) with don't-cares, prime or not (R07 p37). */
    implicants: Count
    primes: Count
    essentials: Count
    covers: Count
    terms: number
    literals: number
    /** First minimal answer, course notation. */
    answer: string
    /** First minimal answer, fill-in-the-blank notation with EPIs first. */
    fitb: string
  }
}

/** Largest number of variables the exhaustive minimiser accepts. */
export const MAX_MIN_VARS = 8
/** Minimal covers built in full; the rest are only counted (a 5-variable map can have 59049). */
export const MAX_COVERS = 20
/** Search nodes per pass before the minimiser gives up on proving the result. */
const MAX_NODES = 1_000_000

const cellName = (form: Form) => (form === 'sop' ? 'm' : 'M')
const list = (xs: number[], p: string) => xs.map((x) => p + x).join(', ')

function groupOf(c: Cube, fn: BoolFunction, form: Form, targetSet: Set<number>): Group {
  const n = fn.vars.length
  const ms = mintermsOf(c, n)
  const cells = ms.filter((m) => targetSet.has(m))
  const dontCares = ms.filter((m) => !targetSet.has(m))
  const term = termText(c, fn.vars, form)
  const fixed = fn.vars.filter((_, i) => c.mask & (1 << (n - 1 - i)))
  const free = fn.vars.filter((_, i) => !(c.mask & (1 << (n - 1 - i))))
  const vals = fixed.map((v) => `${v}=${(c.bits >> (n - 1 - fn.vars.indexOf(v))) & 1}`).join(', ')
  const k = free.length
  const working =
    `${list(cells, cellName(form))}${dontCares.length ? ` with don't-cares ${dontCares.join(', ')}` : ''}: ` +
    (fixed.length ? `${vals} stay the same${k ? `, ${free.join(' and ')} change${k === 1 ? 's' : ''}` : ''}` : 'every variable changes') +
    `, so ${form === 'sop' ? term : `F' term ${termText(c, fn.vars, 'sop')}, sum term ${term}`} (${ms.length} cells, ${n} - ${k} = ${n - k} literals)`
  return {
    cube: c,
    term,
    fitb: termText(c, fn.vars, form, 'fitb'),
    complementTerm: form === 'pos' ? termText(c, fn.vars, 'sop') : undefined,
    cells,
    dontCares,
    size: ms.length,
    literals: literalCount(c),
    why: {
      rule:
        form === 'sop'
          ? 'A group of 2^k cells removes k variables; the variables that stay the same give the product term.'
          : 'Group the 0s as for F\'; the variables that stay the same give a product term of F\', and DeMorgan turns it into a sum term (each literal flips).',
      working,
      cite: form === 'sop' ? 'L15 p25, p30' : 'L15 p43-44; R07 p42',
    },
  }
}

/**
 * Prime implicants, essentials and every minimal cover. For `pos` the 0s are grouped (PIs of F') and each
 * group gives a sum term (L15 p43-44). Exhaustive, so `fn.vars.length` must be at most MAX_MIN_VARS.
 */
export function minimize(fn: BoolFunction, form: Form = 'sop'): Minimization {
  const n = fn.vars.length
  if (n > MAX_MIN_VARS) throw new RangeError(`minimize supports at most ${MAX_MIN_VARS} variables`)
  const target = form === 'sop' ? fn.on : offOf(fn)
  const targetSet = new Set(target)
  const allowed = new Uint8Array(1 << n)
  for (const m of [...target, ...fn.dc]) allowed[m] = 1
  const p = cellName(form)

  // Every cube inside target + don't-cares, then the maximal ones.
  const key = (c: Cube) => (c.mask << n) | c.bits
  const inside = new Set<number>()
  const cubes: Cube[] = []
  for (let mask = 0; mask < 1 << n; mask++)
    for (let bits = mask; ; bits = (bits - 1) & mask) {
      const c = { mask, bits }
      if (mintermsOf(c, n).every((m) => allowed[m])) {
        inside.add(key(c))
        cubes.push(c)
      }
      if (bits === 0) break
    }
  const maximal = cubes.filter((c) => {
    for (let b = 1; b < 1 << n; b <<= 1) if (c.mask & b && inside.has(key({ mask: c.mask & ~b, bits: c.bits & ~b }))) return false
    return true
  })
  const groups = maximal.map((c) => groupOf(c, fn, form, targetSet))
  const primeGroups = groups.filter((g) => g.cells.length).sort((a, b) => a.literals - b.literals || a.cells[0] - b.cells[0])
  const dcOnly = groups.filter((g) => !g.cells.length)
  const implicantCount = cubes.filter((c) => mintermsOf(c, n).some((m) => targetSet.has(m))).length

  const coveredBy = target.map((cell) => ({ cell, primes: primeGroups.flatMap((g, i) => (covers(g.cube, cell) ? [i] : [])) }))
  const primes: Prime[] = primeGroups.map((g, id) => {
    const reasons = coveredBy.filter((c) => c.primes.length === 1 && c.primes[0] === id).map((c) => c.cell)
    const others = g.cells.map((cell) => {
      const alt = coveredBy.find((c) => c.cell === cell)!.primes.filter((q) => q !== id)
      return `${p}${cell} by ${primeGroups[alt[0]]?.term}`
    })
    return {
      ...g,
      id,
      essential: reasons.length > 0,
      reasons,
      status: reasons.length
        ? {
            rule: 'An EPI covers at least one minterm that no other PI covers.',
            working: `${list(reasons, p)} ${reasons.length > 1 ? 'are' : 'is'} covered only by ${g.term}`,
            cite: 'L15 p36',
          }
        : {
            rule: 'A PI is essential only if some minterm has no other PI over it. Don\'t-cares do not count.',
            working: `every one of its ${form === 'sop' ? '1s' : '0s'} is also covered by another PI: ${others.join('; ')}`,
            cite: 'L15 p36; T06 Ans p5',
          },
    }
  })
  const essentials = primes.filter((q) => q.essential).map((q) => q.id)
  const doneByEpi = new Set(essentials.flatMap((id) => primes[id].cells))
  const leftover = target.filter((m) => !doneByEpi.has(m))

  // Branch on the leftover cell with fewest candidates. Excluding earlier candidates in later branches
  // splits the covers into disjoint sets, so each cover is found once. Pass 1 finds the lowest cost,
  // pass 2 counts every cover at that cost but keeps only the first MAX_COVERS.
  const COST = 1 << 10
  const epiCost = essentials.reduce((s, id) => s + COST + primes[id].literals, 0)
  const cands = new Map(coveredBy.map((c) => [c.cell, c.primes.filter((q) => !primes[q].essential)]))
  const excluded = new Uint16Array(primes.length)
  const used = new Float64Array(primes.length)
  const chosen: number[] = []
  let best = Infinity
  let count = 0
  let nodes = 0
  let stamps = 0
  const found: number[][] = []
  const search = (left: number[], cost: number, counting: boolean) => {
    if (counting ? cost > best : cost >= best) return
    if (!left.length) {
      if (!counting) best = cost
      else if (count++ < MAX_COVERS) found.push([...chosen])
      return
    }
    if (++nodes > MAX_NODES) return
    // Lower bound: cells that share no candidate PI each need a PI of their own.
    let pickCell = -1
    let pickSize = Infinity
    let need = 0
    const stamp = ++stamps
    for (const m of left) {
      let size = 0
      let free = true
      for (const q of cands.get(m)!)
        if (!excluded[q]) {
          size++
          if (used[q] === stamp) free = false
        }
      if (size < pickSize) {
        pickSize = size
        pickCell = m
      }
      if (free) {
        need++
        for (const q of cands.get(m)!) used[q] = stamp
      }
    }
    if (counting ? cost + need * COST > best : cost + need * COST >= best) return
    const pick = cands.get(pickCell)!.filter((q) => !excluded[q])
    for (const q of pick) {
      chosen.push(q)
      search(
        left.filter((m) => !covers(primes[q].cube, m)),
        cost + COST + primes[q].literals,
        counting,
      )
      chosen.pop()
      excluded[q]++
    }
    for (const q of pick) excluded[q]--
  }
  search(leftover, epiCost, false)
  // shortcut: past MAX_NODES the first pass keeps the best cover found so far, which may not be minimal; only reached well past exam size.
  const minimal = nodes <= MAX_NODES
  nodes = 0
  search(leftover, epiCost, true)
  const exact = minimal && nodes <= MAX_NODES

  const cubesOf = (ids: number[]) => ids.map((id) => primes[id].cube)
  // Print terms in variable order, as the keys do (T06 Q1(b): p'∙q' + r + s'); the fill-in-the-blank text keeps EPIs first.
  const order = primes.map((q) => literalsOf(q.cube, fn.vars, form).flatMap((l) => [fn.vars.indexOf(l.v), l.neg ? 1 : 0]))
  const byTerm = (x: number, y: number) => {
    const [a, b] = [order[x], order[y]]
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
    return a.length - b.length
  }
  const coverList: Cover[] = found.map((extra) => {
    const ids = [...essentials, ...extra.sort((a, b) => a - b)]
    const printed = [...ids].sort(byTerm)
    const epiFirst = [...[...essentials].sort(byTerm), ...[...extra].sort(byTerm)]
    return {
      primes: ids,
      terms: ids.length,
      literals: ids.reduce((s, id) => s + primes[id].literals, 0),
      text: coverText(cubesOf(printed), fn.vars, form),
      fitb: coverText(cubesOf(epiFirst), fn.vars, form, 'fitb'),
      complementText: form === 'pos' ? coverText(cubesOf(printed), fn.vars, 'sop') : undefined,
      // SOP: 1 inside a chosen group. POS: a chosen group of 0s makes its sum term 0.
      dcValues: fn.dc.map((cell) => {
        const inside = ids.some((id) => covers(primes[id].cube, cell))
        return { cell, value: (inside === (form === 'sop') ? 1 : 0) as 0 | 1 }
      }),
    }
  })
  coverList.sort((a, b) => a.primes.join() < b.primes.join() ? -1 : 1)
  const first = coverList[0]
  const what = form === 'sop' ? 'SOP' : 'POS'
  const ones = form === 'sop' ? '1s' : '0s'
  const piList = primes.map((q) => q.term).join(', ')

  return {
    fn,
    form,
    target,
    primes,
    dcOnly,
    coveredBy,
    essentials,
    leftover,
    covers: coverList,
    summary: {
      implicants: {
        value: implicantCount,
        why: {
          rule: `An implicant is any valid group of ${ones}, don't-cares allowed, with at least one ${ones.slice(0, -1)}.`,
          working: `${implicantCount} implicants, of which ${primes.length} are prime`,
          cite: 'L15 p34; R07 p37',
        },
      },
      primes: {
        value: primes.length,
        why: {
          rule: `A PI is a group of ${ones} (with don't-cares if they help) that cannot be made any bigger. A group made only of don't-cares is not a PI.`,
          working:
            `${primes.length} PI${primes.length === 1 ? '' : 's'}${primes.length ? `: ${piList}` : ''}` +
            (dcOnly.length ? `. Not PIs (only don't-cares): ${dcOnly.map((g) => g.term).join(', ')}` : ''),
          cite: form === 'sop' ? 'L15 p35, p49' : 'L15 p35, p43',
        },
      },
      essentials: {
        value: essentials.length,
        why: {
          rule: 'An EPI is a PI that covers at least one minterm no other PI covers.',
          working: essentials.length
            ? essentials.map((id) => `${primes[id].term} (${list(primes[id].reasons, p)})`).join(', ')
            : target.length
              ? `0 EPIs: every ${ones.slice(0, -1)} is covered by at least two PIs`
              : `there are no ${ones} to cover`,
          cite: 'L15 p36',
        },
      },
      covers: {
        value: count,
        exact,
        why: {
          rule: `Take every EPI, then the fewest other PIs that cover the ${ones} left: fewest terms, then fewest literals. ${what}s that differ only in term order count once.`,
          working:
            (minimal ? '' : 'search limit reached, so these may not be minimal: ') +
            `${exact || !minimal ? '' : 'at least '}${count} minimal ${what}${count === 1 ? '' : 's'}, each ${first.terms} term${first.terms === 1 ? '' : 's'} and ${first.literals} literal${first.literals === 1 ? '' : 's'}` +
            (count > coverList.length ? ` (the first ${coverList.length} are listed)` : ''),
          cite: 'L15 p38; AY23/24 S2 Q19(c)',
        },
      },
      terms: first.terms,
      literals: first.literals,
      answer: first.text,
      fitb: first.fitb,
    },
  }
}
