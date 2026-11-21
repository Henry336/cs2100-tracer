/** Compare the output a student predicted with the run, and find the step where they part. */

export type PredictionCheck =
  | { match: true }
  | { match: false; line: number; want: string; got: string; step: number }

const lines = (s: string) => {
  const ls = s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd())
  while (ls.length && ls[ls.length - 1] === '') ls.pop()
  return ls
}

/**
 * `outputs` is the console after each step. Trailing spaces and blank lines are ignored.
 * `step` is the first step (0-based) whose output no longer fits the prediction's first wrong line.
 */
export function checkPrediction(outputs: string[], guess: string): PredictionCheck {
  const want = lines(guess)
  const got = lines(outputs[outputs.length - 1] ?? '')
  let k = 0
  while (k < Math.max(want.length, got.length) && want[k] === got[k]) k++
  if (k === Math.max(want.length, got.length)) return { match: true }
  const w = want[k] ?? ''
  let step = outputs.length - 1
  for (let j = 0; j < outputs.length; j++) {
    const ls = outputs[j].replace(/\r/g, '').split('\n')
    if (ls.length <= k) continue
    const part = ls[k].trimEnd()
    const complete = ls.length > k + 1
    if (complete ? part !== w : !w.startsWith(part)) {
      step = j
      break
    }
  }
  return { match: false, line: k + 1, want: want[k] ?? '(nothing more)', got: got[k] ?? '(nothing more)', step: Math.max(0, step) }
}
