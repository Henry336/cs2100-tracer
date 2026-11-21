/** Pure helpers for the address calculator tab: backwards array lookup and struct member parsing. */
import { arrayAddress, type Explain, type StructLayoutResult } from '../../core/c-memory'

export const parseList = (text: string): number[] =>
  text
    .split(/[^0-9-]+/)
    .filter((t) => t !== '' && t !== '-')
    .map(Number)

export type Backwards =
  | { ok: true; index: number[]; offsetBytes: number; elems: number; byteIn: number; steps: string[]; explain: Explain }
  | { ok: false; error: string }

/** Address (or byte offset from A0) to the indices of the element that holds it. */
export function addressToIndex(dims: number[], elemSize: number, offsetBytes: number, order: 'row' | 'column' = 'row', baseText = 'A0'): Backwards {
  if (!dims.length || dims.some((d) => !Number.isInteger(d) || d <= 0)) return { ok: false, error: 'give the dimensions as positive whole numbers' }
  if (!Number.isInteger(elemSize) || elemSize <= 0) return { ok: false, error: 'element size must be a positive whole number of bytes' }
  const total = dims.reduce((a, b) => a * b, 1)
  if (!Number.isInteger(offsetBytes) || offsetBytes < 0 || offsetBytes >= total * elemSize)
    return { ok: false, error: `that is outside the array: it covers ${baseText} + 0 to ${baseText} + ${total * elemSize - 1}` }
  const elems = Math.floor(offsetBytes / elemSize)
  const byteIn = offsetBytes % elemSize
  const weight = (j: number) => (order === 'row' ? dims.slice(j + 1) : dims.slice(0, j)).reduce((a, b) => a * b, 1)
  const orderIdx = dims.map((_, j) => j).sort((a, b) => weight(b) - weight(a))
  const index = dims.map(() => 0)
  let rem = elems
  const steps = [`offset = ${offsetBytes} bytes, ${offsetBytes} / ${elemSize} = ${elems} element${elems === 1 ? '' : 's'}${byteIn ? `, ${byteIn} byte${byteIn === 1 ? '' : 's'} into it` : ''}`]
  for (const j of orderIdx) {
    const w = weight(j)
    index[j] = Math.floor(rem / w)
    steps.push(`i${j + 1} = ${rem} div ${w} = ${index[j]}, remainder ${rem % w}`)
    rem %= w
  }
  return {
    ok: true,
    index,
    offsetBytes,
    elems,
    byteIn,
    steps,
    explain: {
      rule: 'Undo the formula: divide the byte offset by S to count elements, then peel off each index by dividing by what one step of it is worth',
      working: steps.join('\n'),
      cite: order === 'row' ? 'R02 p26' : 'R02 p25',
    },
  }
}

/** Check that going backwards then forwards lands on the same element. */
export const roundTrip = (dims: number[], S: number, index: number[]) => {
  const r = arrayAddress({ elemSize: S, dims, index })
  return r.ok ? r.offsetBytes : undefined
}

export type MemberSpec = { name: string; type: string; size: number; align: number }
export type ParsedMembers = { members: MemberSpec[]; errors: { line: number; message: string }[] }

const BASE: Record<string, number> = { char: 1, int: 4, float: 4, double: 8 }

/** "int val;", "char ch[2];", "double *x, *y;" one declaration per line. */
export function parseMembers(text: string, ptrSize: number): ParsedMembers {
  const members: MemberSpec[] = []
  const errors: ParsedMembers['errors'] = []
  text.split('\n').forEach((raw, k) => {
    const line = raw.replace(/\/\/.*$/, '').trim().replace(/;$/, '').trim()
    if (!line) return
    const m = /^(char|int|float|double)\s+(.+)$/.exec(line)
    if (!m) {
      errors.push({ line: k + 1, message: 'start with char, int, float or double (nested structs are not supported here)' })
      return
    }
    for (const d of m[2].split(',')) {
      const dm = /^(\*?)\s*([A-Za-z_]\w*)\s*((?:\[\s*\d+\s*\])*)$/.exec(d.trim())
      if (!dm) {
        errors.push({ line: k + 1, message: `cannot read "${d.trim()}"; write a name, *name or name[N]` })
        continue
      }
      const isPtr = dm[1] === '*'
      const dims = parseList(dm[3])
      if (dims.some((n) => n <= 0)) {
        errors.push({ line: k + 1, message: 'array sizes must be at least 1' })
        continue
      }
      const one = isPtr ? ptrSize : BASE[m[1]]
      const count = dims.reduce((a, b) => a * b, 1)
      members.push({ name: dm[2], type: `${m[1]}${isPtr ? ' *' : ''}${dims.length ? ` ${dims.map((n) => `[${n}]`).join('')}` : ''}`, size: one * count, align: one })
    }
  })
  return { members, errors }
}

/** Natural alignment offsets, as gcc would pad. Beyond the course: shown only for comparison. */
export function paddedLayout(members: MemberSpec[]) {
  let off = 0
  const rows = members.map((m) => {
    const start = Math.ceil(off / m.align) * m.align
    const gap = start - off
    off = start + m.size
    return { name: m.name, offset: start, gap }
  })
  const maxAlign = Math.max(1, ...members.map((m) => m.align))
  const size = Math.ceil(off / maxAlign) * maxAlign
  return { rows, size, tail: size - off }
}

/** A union: every member starts at offset 0 and the size is the largest member (R02 p32). Same shape as structLayout. */
export function unionLayout(members: { name: string; type: string; size: number }[], base?: number): StructLayoutResult {
  const size = Math.max(0, ...members.map((m) => m.size))
  const at = base === undefined ? '' : `, address = ${hexOf(base)}`
  return {
    size,
    members: members.map((m) => ({
      ...m,
      offset: 0,
      ...(base === undefined ? {} : { address: base, addressHex: hexOf(base) }),
      explain: { rule: 'Every member of a union starts at the same address, so they share the bytes', working: `offset 0${at}`, cite: 'R02 p32' },
    })),
    explain: {
      rule: 'sizeof(union) is the size of its largest member, because only one member is stored at a time',
      working: `max(${members.map((m) => m.size).join(', ') || '0'}) = ${size} bytes`,
      cite: 'R02 p32',
    },
  }
}

const hexOf = (n: number) => `0x${(n >>> 0).toString(16).padStart(8, '0')}`
