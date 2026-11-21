import { parseNumber } from './format'
import type { Access, AccessKind } from './types'

export interface ParseError {
  line: number
  message: string
}

const KINDS = new Map<string, AccessKind>([
  ['r', 'read'],
  ['lw', 'read'],
  ['read', 'read'],
  ['w', 'write'],
  ['sw', 'write'],
  ['write', 'write'],
])

/**
 * Parse a typed trace. Items are separated by commas, spaces or new lines; '#' or '//' starts a comment.
 * Each item is an address in decimal, 0x hex or 0b binary, with an optional R/W (or lw/sw) prefix and an
 * optional "=value" for writes: "4, 0, 8", "W0 W4 R32", "sw 0x18=X", "R 0x14".
 */
export function parseAccesses(text: string): { accesses: Access[]; errors: ParseError[] } {
  const accesses: Access[] = []
  const errors: ParseError[] = []
  // Trace text comes from URL state, which can hold any JSON value.
  if (typeof text !== 'string') return { accesses, errors: [{ line: 1, message: 'line 1: the trace must be text, such as "R 0x14, W 8"' }] }
  text.split(/\r?\n/).forEach((raw, li) => {
    const line = li + 1
    const body = raw.replace(/(#|\/\/).*$/, '')
    let pending: AccessKind | null = null
    for (const tok of body.split(/[\s,;]+/).filter(Boolean)) {
      const bare = KINDS.get(tok.toLowerCase().replace(/:$/, ''))
      if (bare) {
        pending = bare
        continue
      }
      const m = /^(read|write|lw|sw|r|w)?:?([^=]+)(?:=(.+))?$/i.exec(tok)
      const address = m ? parseNumber(m[2]) : null
      if (!m || address === null) {
        errors.push({ line, message: `line ${line}: cannot read "${tok}" as an address (use decimal, 0x hex or 0b binary)` })
        pending = null
        continue
      }
      const kind = (m[1] && KINDS.get(m[1].toLowerCase())) || pending || 'read'
      if (m[3] !== undefined && kind === 'read') errors.push({ line, message: `line ${line}: "${tok}" gives a value, but only writes store one` })
      accesses.push(m[3] !== undefined && kind === 'write' ? { address, kind, data: m[3] } : { address, kind })
      pending = null
    }
    if (pending) errors.push({ line, message: `line ${line}: ${pending === 'read' ? 'R' : 'W'} needs an address after it` })
  })
  return { accesses, errors }
}
