import { afterEach, describe, expect, it, vi } from 'vitest'
import { STALE_FILE, reloadForNewVersion } from './reload'

describe('reload after a deploy', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('reloads once, then not again within 15 s', () => {
    const store = new Map<string, string>()
    const reload = vi.fn()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
    vi.stubGlobal('window', { location: { reload } })
    expect(reloadForNewVersion(100000)).toBe(true)
    expect(reloadForNewVersion(105000)).toBe(false)
    expect(reloadForNewVersion(120001)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
  it('recognises missing-file errors from each browser', () => {
    expect(STALE_FILE.test('TypeError: Failed to fetch dynamically imported module: https://x/assets/PapersPage-DVTPFGQm.js')).toBe(true)
    expect(STALE_FILE.test('TypeError: Importing a module script failed.')).toBe(true)
    expect(STALE_FILE.test('TypeError: error loading dynamically imported module')).toBe(true)
    expect(STALE_FILE.test('TypeError: x is undefined')).toBe(false)
  })
})
