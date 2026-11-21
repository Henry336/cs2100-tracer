/** Byte-addressed memory: every variable is a region of real bytes in the chosen endianness. */
import { hex, isFloating, sizeOf, type CType, type Endian, type Explain, type Layout } from './types'

export type RegionKind = 'global' | 'stack' | 'heap' | 'literal'

export type Region = {
  id: string
  name: string
  kind: RegionKind
  addr: number
  size: number
  type: CType
  bytes: Uint8Array
  /** 1 where the byte has been given a value; 0 means garbage (L02A p22). */
  init: Uint8Array
  alive: boolean
  line: number
  addrWhy: Explain
  frameId?: number
  readonly?: boolean
  /** Heap blocks: false until a typed pointer takes the block. */
  typed?: boolean
  /** A static local: the function it belongs to (it is stored with the globals). */
  staticIn?: string
}

export type ErrKind = 'segfault' | 'uninit' | 'dangling' | 'bounds' | 'readonly' | 'type' | 'div0' | 'limit' | 'unsupported'

export class RuntimeErr extends Error {
  kind: ErrKind
  cite?: string
  constructor(kind: ErrKind, message: string, cite?: string) {
    super(message)
    this.kind = kind
    this.cite = cite
  }
}

export function encodeScalar(t: CType, n: number, size: number, endian: Endian): Uint8Array {
  const dv = new DataView(new ArrayBuffer(size))
  const le = endian === 'little'
  if (t.k === 'int') dv.setInt32(0, n, le)
  else if (t.k === 'char') dv.setInt8(0, n)
  else if (t.k === 'float') dv.setFloat32(0, n, le)
  else if (t.k === 'double') dv.setFloat64(0, n, le)
  else if (size === 4) dv.setUint32(0, n >>> 0, le)
  else {
    const hi = Math.floor(n / 2 ** 32)
    dv.setUint32(le ? 4 : 0, hi, le)
    dv.setUint32(le ? 0 : 4, n >>> 0, le)
  }
  return new Uint8Array(dv.buffer)
}

export function decodeScalar(t: CType, bytes: Uint8Array, endian: Endian): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const le = endian === 'little'
  if (t.k === 'int') return dv.getInt32(0, le)
  if (t.k === 'char') return dv.getInt8(0)
  if (t.k === 'float') return dv.getFloat32(0, le)
  if (t.k === 'double') return dv.getFloat64(0, le)
  if (bytes.length === 4) return dv.getUint32(0, le)
  return dv.getUint32(le ? 4 : 0, le) * 2 ** 32 + dv.getUint32(le ? 0 : 4, le)
}

/** Path from the start of type t to the cell at byte offset off, e.g. "[2][1]" or ".name[0]". */
export function pathIn(t: CType, off: number, want: number | undefined, L: Layout): string {
  if (off === 0 && (want === undefined || sizeOf(t, L) <= want)) return ''
  if (t.k === 'array') {
    const es = sizeOf(t.of, L)
    const i = Math.floor(off / es)
    if (i >= t.n) return ` + ${off}`
    return `[${i}]${pathIn(t.of, off - i * es, want, L)}`
  }
  if (t.k === 'struct') {
    const d = L.structs[t.tag]
    const ms = d?.members ?? []
    // in a union every member starts at 0: name the first one big enough for the access
    const m = d?.union
      ? (ms.find((x) => want !== undefined && sizeOf(x.type, L) === want) ?? ms.find((x) => sizeOf(x.type, L) > off) ?? ms[0])
      : [...ms].reverse().find((x) => x.offset <= off)
    if (m) return `.${m.name}${pathIn(m.type, off - m.offset, want, L)}`
  }
  return off ? ` + ${off} bytes` : ''
}

/** Scalar type of the cell at offset off (the innermost element or member there). */
export function cellType(t: CType, off: number, L: Layout): CType | undefined {
  if (t.k === 'array') {
    const es = sizeOf(t.of, L)
    return cellType(t.of, off % es, L)
  }
  if (t.k === 'struct') {
    const m = [...(L.structs[t.tag]?.members ?? [])].reverse().find((x) => x.offset <= off)
    return m ? cellType(m.type, off - m.offset, L) : undefined
  }
  return off === 0 ? t : undefined
}

export class Memory {
  regions: Region[] = []
  /** Regions that no longer exist (popped frames), kept to explain dangling pointers. */
  dead: Region[] = []
  endian: Endian
  L: Layout
  private nextId = 0
  /** Byte ranges written during the current step. */
  writes: [number, number][] = []
  /** Addresses computed this step by indexing past the end (or before the start) of an array. */
  overruns: { addr: number; text: string; owner: string; count: number }[] = []

  constructor(endian: Endian, L: Layout) {
    this.endian = endian
    this.L = L
  }

  add(r: Omit<Region, 'id' | 'bytes' | 'init' | 'alive'>, zeroed: boolean): Region {
    const region: Region = {
      ...r,
      id: `r${++this.nextId}`,
      bytes: new Uint8Array(r.size),
      init: new Uint8Array(r.size).fill(zeroed ? 1 : 0),
      alive: true,
    }
    this.regions.push(region)
    return region
  }

  remove(r: Region) {
    this.regions = this.regions.filter((x) => x !== r)
    r.alive = false
    this.dead.push(r)
    if (this.dead.length > 200) this.dead.shift()
  }

  /** The live region holding addr, if any. */
  locate(addr: number): Region | undefined {
    return this.regions.find((r) => r.alive && addr >= r.addr && addr < r.addr + r.size)
  }

  /** Name of the cell at addr, e.g. "a[2]" or "s.name", sized to want bytes. */
  nameAt(addr: number, want?: number): string | undefined {
    const r = this.locate(addr)
    if (!r) return undefined
    if (r.kind === 'literal' && addr === r.addr) return `the string literal ${r.name}`
    return r.name + pathIn(r.type, addr - r.addr, want, this.L)
  }

  private check(addr: number, size: number, write: boolean): { r: Region; off: number } {
    if (addr === 0) throw new RuntimeErr('segfault', 'this follows a NULL pointer (address 0). Result: segmentation fault', 'L04B p6')
    const r = this.locate(addr)
    const over = this.overruns.find((o) => o.addr === addr)
    if (over) {
      const hit = r ? `${r.name}${pathIn(r.type, addr - r.addr, size, this.L)}` : 'memory that belongs to no variable'
      throw new RuntimeErr(
        'bounds',
        `${over.text} is outside ${over.owner} (valid indices 0 to ${over.count - 1}). C does not check array bounds: this ${write ? 'write' : 'read'} would land on ${hit}`,
        'L05A p5',
      )
    }
    if (!r) {
      const gone = [...this.regions, ...this.dead].find((x) => !x.alive && addr >= x.addr && addr < x.addr + x.size)
      if (gone)
        throw new RuntimeErr(
          'dangling',
          gone.kind === 'heap'
            ? `${hex(addr)} is inside ${gone.name}, which was freed. Using it is a dangling-pointer bug`
            : `${hex(addr)} belonged to ${gone.name}, which disappeared when its function returned (dangling pointer)`,
          'R02 p12',
        )
      throw new RuntimeErr('segfault', `${hex(addr)} is not inside any variable, so this access is invalid (segmentation fault)`, 'L04B p6')
    }
    const off = addr - r.addr
    if (off + size > r.size)
      throw new RuntimeErr(
        'bounds',
        `${write ? 'writing' : 'reading'} ${size} bytes at ${hex(addr)} runs past the end of ${r.name} (${r.size} bytes): out of bounds`,
        'L05A p5',
      )
    if (write && r.readonly) throw new RuntimeErr('readonly', `${r.name} is a string literal, which is read-only. Writing to it crashes (segmentation fault)`)
    return { r, off }
  }

  readBytes(addr: number, size: number): { bytes: Uint8Array; init: Uint8Array } {
    const { r, off } = this.check(addr, size, false)
    return { bytes: r.bytes.slice(off, off + size), init: r.init.slice(off, off + size) }
  }

  writeBytes(addr: number, bytes: Uint8Array, init?: Uint8Array) {
    const { r, off } = this.check(addr, bytes.length, true)
    r.bytes.set(bytes, off)
    if (init) r.init.set(init, off)
    else r.init.fill(1, off, off + bytes.length)
    this.writes.push([addr, bytes.length])
  }

  readScalar(addr: number, t: CType): number {
    const size = sizeOf(t, this.L)
    const { r, off } = this.check(addr, size, false)
    if (r.init.subarray(off, off + size).some((b) => b === 0)) {
      const name = r.name + pathIn(r.type, off, size, this.L)
      throw new RuntimeErr('uninit', `${name} is used before it has a value. An uninitialised variable holds garbage, not 0`, 'L02A p22')
    }
    return decodeScalar(t, r.bytes.slice(off, off + size), this.endian)
  }

  writeScalar(addr: number, t: CType, n: number) {
    this.writeBytes(addr, encodeScalar(t, n, sizeOf(t, this.L), this.endian))
  }
}

/** Display a scalar the way the course writes values. */
export function showScalar(t: CType, n: number, ptrSize = 4): string {
  if (t.k === 'ptr') return n === 0 ? 'NULL' : hex(n, ptrSize * 2 > 8 && n > 0xffffffff ? 16 : 8)
  if (t.k === 'char') return showChar(n)
  if (isFloating(t)) {
    const v = Number(n.toPrecision(t.k === 'float' ? 7 : 15))
    return Number.isInteger(v) && Math.abs(v) < 1e15 ? v.toFixed(1) : String(v)
  }
  return String(n)
}

const CHAR_ESC: Record<number, string> = { 0: '\\0', 9: '\\t', 10: '\\n', 13: '\\r', 39: "\\'", 92: '\\\\' }
export function showChar(n: number): string {
  if (CHAR_ESC[n]) return `'${CHAR_ESC[n]}' (${n})`
  if (n >= 32 && n < 127) return `'${String.fromCharCode(n)}' (${n})`
  return String(n)
}
