// The last few tracers this browser opened, for "Pick up" on the home page.
// Per-viewer convenience only: if storage is blocked the row simply does not show.
const KEY = 'cs2100-recent'

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function rememberModule(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 5)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked */
  }
}
