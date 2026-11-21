import { canonical, valuesOf } from './func'
import { kmapLayout, loopPieces, type Axes, type KMapLayout, type Orientation } from './kmap'
import { minimize, type Minimization } from './minimize'
import type { BoolFunction, CellValue, Explain, Form, Issue } from './types'

export type LoopRole = 'new' | 'pi' | 'epi' | 'chosen' | 'faded'

export interface KMapFrame {
  phase: 'fill' | 'prime' | 'not-prime' | 'count' | 'essential' | 'leftover' | 'cover' | 'answer'
  title: string
  why: Explain
  /** PIs to draw (index into `primes`) and how. */
  loops: { prime: number; role: LoopRole }[]
  /** A don't-care-only group to draw as "not a PI" (index into `dcOnly`). */
  ghost?: number
  /** Cells to highlight now. */
  focus: number[]
  /** Cells that make the current PI essential. */
  reasons: number[]
  /** Target cells already covered by the chosen PIs (draw greyed). */
  covered: number[]
  /** Index into `covers` for cover and answer frames. */
  cover?: number
}

export interface KMapTrace extends Minimization {
  layout: KMapLayout
  values: CellValue[]
  frames: KMapFrame[]
}

export interface TraceOptions {
  orientation?: Orientation | Axes
  form?: Form
}

/** Step-by-step K-map solution for 2 to 5 variables (L15 p38 algorithm; POS by grouping 0s, L15 p43-44). */
export function traceKMap(fn: BoolFunction, opts: TraceOptions = {}): { ok: true; trace: KMapTrace } | { ok: false; errors: Issue[] } {
  const form = opts.form ?? 'sop'
  const layout = kmapLayout(fn.vars, opts.orientation ?? 'rows')
  if (!layout)
    return {
      ok: false,
      errors: [
        fn.vars.length < 2 || fn.vars.length > 5
          ? { code: 'vars', message: 'K-maps here take 2 to 5 variables', at: [0, 0], cite: 'L15 p13-22' }
          : { code: 'axes', message: 'put one or two variables on each axis and use every variable once (5 variables: leave one for the two maps)', at: [0, 0] },
      ],
    }
  const min = minimize(fn, form)
  for (const g of [...min.primes, ...min.dcOnly]) g.pieces = loopPieces(g.cube, layout)

  const ones = form === 'sop' ? '1s' : '0s'
  const one = form === 'sop' ? '1' : '0'
  const p = form === 'sop' ? 'm' : 'M'
  const { primes, essentials, covers } = min
  const all = (role: LoopRole) => primes.map((_, prime) => ({ prime, role }))
  const frames: KMapFrame[] = []
  const frame = (f: Partial<KMapFrame> & Pick<KMapFrame, 'phase' | 'title' | 'why'>) =>
    frames.push({ loops: [], focus: [], reasons: [], covered: [], ...f })
  const c = canonical(fn)

  frame({
    phase: 'fill',
    title: 'Fill the map',
    why: {
      rule: `Put 1 in each minterm's cell, X in each don't-care cell and 0 everywhere else.${form === 'pos' ? ' For POS, the 0s are what gets grouped.' : ''}`,
      working: `${fn.name} = ${c.sigma} = ${c.pi}`,
      cite: layout.why.cite,
    },
    focus: min.target,
  })

  if (!min.target.length) {
    frame({
      phase: 'answer',
      title: `${fn.name} = ${min.summary.answer}`,
      why: { rule: `There are no ${ones} to group, so the answer is the constant ${form === 'sop' ? 0 : 1}.`, cite: 'T06 p2' },
      cover: 0,
    })
    return { ok: true, trace: { ...min, layout, values: valuesOf(fn), frames } }
  }

  primes.forEach((q, i) =>
    frame({
      phase: 'prime',
      title: `PI ${i + 1} of ${primes.length}: ${q.term}`,
      why: q.why,
      loops: primes.slice(0, i + 1).map((_, prime) => ({ prime, role: prime === i ? 'new' : 'pi' })),
      focus: [...q.cells, ...q.dontCares],
    }),
  )
  min.dcOnly.forEach((g, i) =>
    frame({
      phase: 'not-prime',
      title: `${g.term} is not a PI`,
      why: { rule: 'A group made only of don\'t-cares is not a PI: it covers no minterm.', working: `${g.term} covers only don't-cares ${g.dontCares.join(', ')}`, cite: 'L15 p49; AY23/24 S2 Q19' },
      loops: all('pi'),
      ghost: i,
      focus: g.dontCares,
    }),
  )
  frame({
    phase: 'count',
    title: `Count the PIs over each ${one}`,
    why: {
      rule: `A ${one} with exactly one PI over it makes that PI essential.`,
      working: min.coveredBy.map((x) => `${p}${x.cell}: ${x.primes.length}`).join(', '),
      cite: 'L15 p36; R07 p36',
    },
    loops: all('pi'),
    focus: min.coveredBy.filter((x) => x.primes.length === 1).map((x) => x.cell),
  })
  if (essentials.length)
    essentials.forEach((id, k) =>
      frame({
        phase: 'essential',
        title: `EPI ${k + 1} of ${essentials.length}: ${primes[id].term}`,
        why: primes[id].status,
        loops: primes.map((_, prime) => ({ prime, role: essentials.slice(0, k + 1).includes(prime) ? 'epi' : 'pi' })),
        focus: primes[id].cells,
        reasons: primes[id].reasons,
      }),
    )
  else frame({ phase: 'essential', title: 'No EPIs', why: min.summary.essentials.why, loops: all('pi') })

  const epiCells = essentials.flatMap((id) => primes[id].cells)
  frame({
    phase: 'leftover',
    title: min.leftover.length ? `${min.leftover.length} cell${min.leftover.length === 1 ? '' : 's'} left after the EPIs` : `The EPIs cover every ${one}`,
    why: {
      rule: `Take all EPIs first. Any ${one} they miss needs other PIs, so EPIs alone are not always the answer.`,
      working: min.leftover.length ? `left: ${min.leftover.map((m) => p + m).join(', ')}` : 'nothing left to cover',
      cite: 'L15 p38; AY23/24 S1 Q7(iv)',
    },
    loops: primes.map((q, prime) => ({ prime, role: q.essential ? 'epi' : 'faded' })),
    focus: min.leftover,
    covered: [...new Set(epiCells)],
  })
  if (min.leftover.length)
    covers.forEach((cv, i) =>
      frame({
        phase: 'cover',
        title: `Minimal cover ${i + 1} of ${min.summary.covers.exact === false ? 'at least ' : ''}${min.summary.covers.value}: ${cv.text}`,
        why: {
          rule: 'Add the fewest PIs that cover what is left; among those, the fewest literals.',
          working: `${cv.terms} terms, ${cv.literals} literals${min.summary.covers.value > covers.length ? `; only the first ${covers.length} covers are shown` : ''}`,
          cite: 'L15 p38',
        },
        loops: primes.map((_, prime) => ({ prime, role: cv.primes.includes(prime) ? 'chosen' : 'faded' })),
        focus: min.leftover,
        covered: min.target,
        cover: i,
      }),
    )
  const first = covers[0]
  frame({
    phase: 'answer',
    title: `${fn.name} = ${first.text}`,
    why:
      form === 'sop'
        ? min.summary.covers.why
        : {
            rule: "POS: the minimal SOP of F' from the 0 groups, complemented with DeMorgan's law.",
            working: `${fn.name}' = ${first.complementText}, so ${fn.name} = ${first.text}${min.summary.covers.value > 1 ? ` (${min.summary.covers.value} minimal answers)` : ''}`,
            cite: 'L15 p43-44; R07 p42',
          },
    loops: primes.map((_, prime) => ({ prime, role: first.primes.includes(prime) ? 'chosen' : 'faded' })),
    covered: min.target,
    cover: 0,
  })
  return { ok: true, trace: { ...min, layout, values: valuesOf(fn), frames } }
}
