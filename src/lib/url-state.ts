import { useCallback, useMemo } from 'react'
import { replaceQuery, useLocation } from './router'

/**
 * Keep a piece of JSON state in the URL query (`#/module?key=...`) so any trace is
 * shareable and survives reload. Values are base64url-encoded JSON.
 */

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode<T>(s: string): T | undefined {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return undefined
  }
}

export function useUrlState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const { query } = useLocation()
  const raw = query.get(key)
  const value = useMemo(() => (raw ? (decode<T>(raw) ?? initial) : initial), [raw]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
      const prevRaw = q.get(key)
      const prev = prevRaw ? (decode<T>(prevRaw) ?? initial) : initial
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      q.set(key, encode(resolved))
      replaceQuery(q)
    },
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return [value, set]
}

export const __test = { encode, decode }
