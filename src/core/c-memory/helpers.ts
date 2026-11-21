/** Pure calculators with working: row-major addresses, struct layout, endianness byte views. */
import { hex, type Endian, type Explain } from './types'

/* ---------- multidimensional array address (R02 p26) ---------- */

export type ArrayAddressInput = {
  /** Start address A0 of a[0]...[0]. Leave out to get a symbolic "A0 + offset" answer. */
  base?: number
  /** S: bytes per element (int 4, char 1, double 8, or a struct size). */
  elemSize: number
  dims: number[]
  index: number[]
  /** Row-major is what C uses (R02 p25-26). Column-major is offered for comparison only. */
  order?: 'row' | 'column'
}

export type ArrayAddressResult =
  | {
      ok: true
      /** Elements before the target, in storage order. */
      offsetElems: number
      offsetBytes: number
      address?: number
      addressHex?: string
      /** One term per index: index x weight, where weight is the elements one step of that index skips. */
      terms: { dim: number; index: number; weight: number; product: number }[]
      /** Horner form steps for row-major: ((i1 x D2 + i2) x D3 + i3)... */
      horner: string[]
      /** "A0 + 36" or "0x10010000 + 192 = 0x100100c0". */
      answer: string
      explain: Explain
    }
  | { ok: false; error: string }

export function arrayAddress(inp: ArrayAddressInput): ArrayAddressResult {
  const { dims, index, elemSize: S } = inp
  const order = inp.order ?? 'row'
  if (!dims.length) return { ok: false, error: 'give at least one dimension' }
  if (index.length !== dims.length) return { ok: false, error: `the array has ${dims.length} dimension(s) but ${index.length} index value(s) were given` }
  for (let j = 0; j < dims.length; j++) {
    if (!Number.isInteger(dims[j]) || dims[j] <= 0) return { ok: false, error: `dimension ${j + 1} must be a positive whole number` }
    if (!Number.isInteger(index[j]) || index[j] < 0 || index[j] >= dims[j])
      return { ok: false, error: `index ${index[j]} is out of range for dimension ${j + 1} (valid: 0 to ${dims[j] - 1})` }
  }
  if (!Number.isInteger(S) || S <= 0) return { ok: false, error: 'element size must be a positive whole number of bytes' }

  const n = dims.length
  // the dimensions one step of index j skips over: all later ones (row-major) or all earlier ones (column-major)
  const skipped = (j: number) => (order === 'row' ? dims.slice(j + 1) : dims.slice(0, j))
  const terms = dims.map((d, j) => {
    const weight = skipped(j).reduce((a, b) => a * b, 1)
    return { dim: d, index: index[j], weight, product: index[j] * weight }
  })
  const offsetElems = terms.reduce((a, t) => a + t.product, 0)
  const offsetBytes = offsetElems * S

  const horner: string[] = []
  if (order === 'row') {
    let acc = index[0]
    horner.push(`start with i1 = ${acc}`)
    for (let j = 1; j < n; j++) {
      const next = acc * dims[j] + index[j]
      horner.push(`${acc} x ${dims[j]} + ${index[j]} = ${next}`)
      acc = next
    }
  }
  const sum = terms.map((t, j) => [t.index, ...skipped(j)].join(' x ')).join(' + ')
  const baseText = inp.base === undefined ? 'A0' : hex(inp.base)
  const address = inp.base === undefined ? undefined : inp.base + offsetBytes
  const answer = address === undefined ? `A0 + ${offsetBytes}` : `${baseText} + ${offsetBytes} = ${hex(address)}`
  const working = `${baseText} + ${S} x (${sum}) = ${baseText} + ${S} x ${offsetElems} = ${answer}`
  return {
    ok: true,
    offsetElems,
    offsetBytes,
    address,
    addressHex: address === undefined ? undefined : hex(address),
    terms,
    horner,
    answer,
    explain: {
      rule:
        order === 'row'
          ? 'Row-major: the last index changes fastest, so each index is worth the product of all later dimensions. Address = A0 + S x (elements before it)'
          : 'Column-major: the first index changes fastest (not what C does; shown for comparison)',
      working,
      cite: order === 'row' ? 'R02 p26' : 'R02 p25',
    },
  }
}

/* ---------- struct layout (no padding) ---------- */

export type StructMemberInput = { name: string; type: string; size: number }

export type StructLayoutResult = {
  size: number
  members: { name: string; type: string; size: number; offset: number; address?: number; addressHex?: string; explain: Explain }[]
  explain: Explain
}

/** Members back to back in declaration order. Padding is never taught (L05C, R02), so none is added. */
export function structLayout(members: StructMemberInput[], base?: number): StructLayoutResult {
  let offset = 0
  const out = members.map((m) => {
    const o = offset
    const prev = members.slice(0, members.indexOf(m)).map((x) => String(x.size))
    offset += m.size
    return {
      name: m.name,
      type: m.type,
      size: m.size,
      offset: o,
      address: base === undefined ? undefined : base + o,
      addressHex: base === undefined ? undefined : hex(base + o),
      explain: {
        rule: 'A member starts right after the members before it',
        working: prev.length ? `offset = ${prev.join(' + ')} = ${o}${base === undefined ? '' : `, address = ${hex(base)} + ${o} = ${hex(base + o)}`}` : 'offset 0: the first member starts the struct',
        cite: 'L05C p3',
      },
    }
  })
  return {
    size: offset,
    members: out,
    explain: {
      rule: 'sizeof(struct) = sum of member sizes. Assumption: no padding, because the course never teaches it; a real compiler may insert gaps so members are aligned',
      working: `${members.map((m) => m.size).join(' + ') || '0'} = ${offset} bytes`,
      cite: 'L05C p3',
    },
  }
}

/* ---------- endianness ---------- */

export type ByteCell = { address?: number; addressHex?: string; byte: number; hex: string; bits: string; significance: string }

/** Lay a 1, 2 or 4 byte value out in memory, lowest address first (R02 p8, L10 p17). */
export function endianBytes(value: number, endian: Endian, size: 1 | 2 | 4 = 4, base?: number): ByteCell[] {
  const v = size === 4 ? value >>> 0 : value & (2 ** (size * 8) - 1)
  const msbFirst = Array.from({ length: size }, (_, k) => {
    const j = size - 1 - k // byte number, j = size-1 is the most significant
    return { byte: Math.floor(v / 2 ** (8 * j)) & 0xff, j }
  })
  const ordered = endian === 'big' ? msbFirst : [...msbFirst].reverse()
  return ordered.map(({ byte, j }, k) => ({
    address: base === undefined ? undefined : base + k,
    addressHex: base === undefined ? undefined : hex(base + k),
    byte,
    hex: byte.toString(16).padStart(2, '0'),
    bits: `${8 * j + 7}-${8 * j}`,
    significance: j === size - 1 ? 'most significant byte' : j === 0 ? 'least significant byte' : `byte ${j}`,
  }))
}

/** Read bytes (lowest address first) back as one integer. Chars read in address order never change. */
export function wordFromBytes(bytes: number[], endian: Endian): { unsigned: number; signed: number; hex: string; chars: string; explain: Explain } {
  const msbFirst = endian === 'big' ? bytes : [...bytes].reverse()
  const unsigned = msbFirst.reduce((a, b) => a * 256 + (b & 0xff), 0)
  const bitsTotal = bytes.length * 8
  const signed = unsigned >= 2 ** (bitsTotal - 1) ? unsigned - 2 ** bitsTotal : unsigned
  const hx = `0x${msbFirst.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('')}`
  return {
    unsigned,
    signed,
    hex: hx,
    chars: bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''),
    explain: {
      rule:
        endian === 'big'
          ? 'Big-endian: the byte at the lowest address is the most significant'
          : 'Little-endian: the byte at the lowest address is the least significant',
      working: `bytes in address order ${bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join(' ')} read as ${hx} = ${unsigned}`,
      cite: 'L10 p17',
    },
  }
}
