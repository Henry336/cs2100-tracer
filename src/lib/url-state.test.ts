import { describe, expect, it } from 'vitest'
import { __test } from './url-state'

describe('url-state encoding', () => {
  it('round-trips unicode JSON through base64url', () => {
    const v = { code: 'lw $t0, 0($s0) # ← load', n: [1, 2, 3], ok: true }
    const s = __test.encode(v)
    expect(s).not.toMatch(/[+/=]/)
    expect(__test.decode(s)).toEqual(v)
  })
  it('returns undefined for junk', () => {
    expect(__test.decode('%%%')).toBeUndefined()
  })
})
