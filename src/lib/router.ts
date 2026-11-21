import { useSyncExternalStore } from 'react'

/**
 * Tiny hash router. Routes look like `#/pipeline?s=...`.
 * Hash routing works on GitHub Pages without a 404 fallback.
 */

export interface Location {
  path: string
  query: URLSearchParams
}

function parse(hash: string): Location {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path: path || '/', query: new URLSearchParams(search) }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useLocation(): Location {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return parse(hash)
}

export function navigate(path: string) {
  window.location.hash = path
}

/** Replace only the query string of the current route, without adding history entries. */
export function replaceQuery(query: URLSearchParams) {
  const { path } = parse(window.location.hash)
  const qs = query.toString()
  const next = `#${path}${qs ? `?${qs}` : ''}`
  if (next !== window.location.hash) {
    history.replaceState(null, '', next)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}

export function href(path: string) {
  return `#${path}`
}
