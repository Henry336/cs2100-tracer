/** Initial register and memory values typed by the user, as short text the URL can carry. */

import { parseNumber } from './assembler'
import { hex, u32 } from './encoding'
import { readWord, wordsToMem } from './interpreter'
import { regName, regNumber } from './registers'
import type { AsmError, Endian } from './types'

// A bare 8-digit hex word, as Examplify writes it (AY23/24 S2 Q16e).
const num = (s: string) => (/^[0-9a-f]{8}$/i.test(s.trim()) ? parseInt(s.trim(), 16) : parseNumber(s))
const is32 = (v: number | undefined): v is number => v !== undefined && v >= -(2 ** 31) && v <= 0xffffffff

/** One "$t0 = 37" per line or separated by commas. */
export function parseRegInit(text: string): { regs: Record<number, number>; errors: AsmError[] } {
  const regs: Record<number, number> = {}
  const errors: AsmError[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    for (const item of raw.split(/[,;]/)) {
      const s = item.trim()
      if (!s) continue
      const m = /^(\S+)\s*=\s*(\S+)$/.exec(s)
      const r = m ? regNumber(m[1]) : undefined
      const v = m ? num(m[2]) : undefined
      if (!m) errors.push({ line: i + 1, message: `expected register = value, got ${s}` })
      else if (r === undefined) errors.push({ line: i + 1, message: `unknown register ${m[1]}` })
      else if (r === 0) errors.push({ line: i + 1, message: '$zero is always 0 and cannot be set (L06 p34)' })
      else if (!is32(v)) errors.push({ line: i + 1, message: `${m[2]} is not a 32-bit number` })
      else regs[r] = v | 0
    }
  })
  return { regs, errors }
}

/** One "address: word, word, ..." per line; words go to consecutive addresses 4 apart (L07 p15). */
export function parseMemInit(text: string, endian: Endian = 'big'): { mem: Record<number, number>; errors: AsmError[] } {
  let mem: Record<number, number> = {}
  const errors: AsmError[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const s = raw.trim()
    if (!s) return
    const m = /^([^:]+):(.*)$/.exec(s)
    const base = m ? num(m[1]) : undefined
    if (!m) return errors.push({ line: i + 1, message: `expected address: words, got ${s}` })
    if (base === undefined || base < 0 || base > 0xffffffff) return errors.push({ line: i + 1, message: `${m[1].trim()} is not an address` })
    if (base % 4) return errors.push({ line: i + 1, message: `${hex(base)} is not a multiple of 4, so it cannot start a word (L07 p15)` })
    const words: number[] = []
    for (const t of m[2].split(/[\s,]+/).filter(Boolean)) {
      const v = num(t)
      if (!is32(v)) return errors.push({ line: i + 1, message: `${t} is not a 32-bit number` })
      words.push(u32(v))
    }
    mem = { ...mem, ...wordsToMem(base, words, endian) }
  })
  return { mem, errors }
}

const show = (v: number) => (v >= 0x10000 ? hex(v) : String(v))

export function regInitText(regs: Partial<Record<number, number>> = {}): string {
  return Object.entries(regs)
    .filter(([, v]) => v !== undefined)
    .map(([r, v]) => `${regName(+r)} = ${show(v!)}`)
    .join('\n')
}

/** Byte map back to "address: words" lines, one line per run of consecutive words. */
export function memInitText(mem: Record<number, number> = {}, endian: Endian = 'big'): string {
  const words = [...new Set(Object.keys(mem).map((a) => u32(+a & ~3)))].sort((a, b) => a - b)
  const lines: string[] = []
  let start = -1
  let vals: number[] = []
  words.forEach((a, k) => {
    if (k === 0 || a !== words[k - 1] + 4) {
      if (vals.length) lines.push(`${hex(start)}: ${vals.join(', ')}`)
      start = a
      vals = []
    }
    vals.push(readWord(mem, a, endian))
  })
  if (vals.length) lines.push(`${hex(start)}: ${vals.join(', ')}`)
  return lines.join('\n')
}
