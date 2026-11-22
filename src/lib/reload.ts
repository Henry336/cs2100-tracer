// After a deploy, a tab opened earlier still asks for the old page files, which are gone.

/** Browser messages for a missing page file (Chrome, Firefox, Safari). */
export const STALE_FILE = /dynamically imported module|importing a module script failed|error loading dynamically|failed to fetch/i

/** Reload once to fetch the new files; the time guard stops a loop if the files really are missing. */
export function reloadForNewVersion(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem('cs2100-reloaded') ?? 0)
    if (now - last < 15000) return false
    sessionStorage.setItem('cs2100-reloaded', String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
