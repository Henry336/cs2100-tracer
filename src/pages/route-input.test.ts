import { describe, expect, it } from 'vitest'
import { __test } from '../lib/url-state'
import { routeInput } from './route-input'

const state = (href: string) => Object.fromEntries([...new URLSearchParams(href.split('?')[1] ?? '')].map(([k, v]) => [k, __test.decode(v)]))

describe('home input routing', () => {
  it('one instruction goes to the datapath first, with the instruction filled in', () => {
    const r = routeInput('lw $t0, 8($s1)')
    expect(r[0].where).toBe('Datapath')
    expect(r[0].href.startsWith('#/datapath?')).toBe(true)
    expect(state(r[0].href).src).toBe('lw $t0, 8($s1)')
  })
  it('several instructions go to the pipeline', () => {
    const r = routeInput('lw $2, 20($1)\nand $4, $2, $5')
    expect(r[0].where).toBe('Pipeline')
    expect(state(r[0].href).src).toBe('lw $2, 20($1)\nand $4, $2, $5')
  })
  it('a hex word can be decoded or traced', () => {
    const r = routeInput('0x8E280008')
    expect(r.map((s) => s.where)).toEqual(['MIPS', 'Datapath'])
  })
  it('an address list goes to the cache', () => {
    expect(routeInput('4, 0, 8, 12, 36')[0].where).toBe('Cache')
  })
  it('a Boolean function goes to the K-map', () => {
    expect(routeInput('F(A,B,C) = Σm(1,3,5)')[0].where).toBe('Boolean')
    expect(routeInput("A'B + AC")[0].where).toBe('Boolean')
  })
  it('C code goes to C memory', () => {
    expect(routeInput('int x = 3; int *p = &x;')[0].where).toBe('C memory')
  })
  it('plain words find modules', () => {
    expect(routeInput('hazard')[0].where).toBe('Pipeline')
    expect(routeInput('k-map')[0].where).toBe('Boolean')
    expect(routeInput('flip-flop')[0].where).toBe('Sequential')
    expect(routeInput('')).toEqual([])
  })
})
