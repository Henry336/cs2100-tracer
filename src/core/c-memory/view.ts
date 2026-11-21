/** Turns interpreter state into plain JSON frames the UI can draw without recomputing anything. */
import { arrayAddress } from './helpers'
import { decodeScalar, pathIn, showChar, showScalar, type Memory, type Region, type RegionKind } from './memory'
import { hex, sizeOf, sizeWhy, typeName, type CType, type CMemConfig, type Explain, type Layout } from './types'

export type CellKind = 'scalar' | 'pointer' | 'array' | 'struct'

export type CellView = {
  /** Stable id: region id plus path, e.g. "r3[2].x". Edges refer to these. */
  id: string
  /** Full C name of the cell, e.g. "a[2][1]" or "s.name". */
  name: string
  type: string
  kind: CellKind
  address: number
  addressHex: string
  size: number
  /** Byte offset from the start of the top-level variable (slice VarView.bytes with it). */
  offset: number
  /** Display value: "5", "?", "0xffbff7fc", "NULL", "'A' (65)", "{1, 2, 3}", "\"apple\"". */
  value: string
  initialised: boolean
  /** Pointer cells: the address held (null for NULL or no value yet). */
  pointsTo?: number | null
  children?: CellView[]
  addressWhy: Explain
  sizeWhy: Explain
  /** True when this step wrote the cell or its value differs from the previous frame. */
  changed: boolean
  /** Previous display value, when it changed this step. */
  prev?: string
}

export type VarView = CellView & {
  region: RegionKind
  declLine: number
  /** Raw bytes in address order (configured endianness); null = never set (garbage). */
  bytes: (number | null)[]
  /** Heap blocks only. */
  freed?: boolean
  /** A static local: the function it belongs to (it is listed with the globals, L04D p18). */
  staticIn?: string
}

export type StackFrameView = {
  id: number
  func: string
  /** "In main():", the way L04D p9-11 labels frames. */
  label: string
  callLine: number | null
  active: boolean
  /** True on the step where the function returns (its frame is about to be popped). */
  returning: boolean
  vars: VarView[]
}

export type PointerEdge = {
  from: string
  fromName: string
  to: number
  toHex: string
  /** Cell id of the pointee, when the address is inside a variable. */
  toId: string | null
  toName: string | null
  status: 'ok' | 'dangling' | 'outside'
}

export type AliasGroup = { toId: string; toName: string; from: string[] }

export type RunError = { line: number; message: string; kind: string; cite?: string }

export type StepKind = 'decl' | 'expr' | 'cond' | 'call' | 'return' | 'jump' | 'error'

export type TraceFrame = {
  index: number
  /** 1-based source line being executed. */
  line: number
  kind: StepKind
  description: string
  /** Rules behind numbers computed in this step (pointer scaling, integer division, copies). */
  whys: Explain[]
  stack: StackFrameView[]
  globals: VarView[]
  heap: VarView[]
  literals: VarView[]
  edges: PointerEdge[]
  aliases: AliasGroup[]
  output: string
  /** Text printed during this step. */
  newOutput: string
  error?: RunError
}

export type FrameSource = {
  mem: Memory
  L: Layout
  cfg: CMemConfig
  frames: { id: number; fn: { name: string }; scopes: Map<string, Region>[]; callLine: number | null; returning: boolean }[]
  out: string
}

/** What the builder remembers about a region between frames, so an untouched region is not rebuilt. */
type RegionCache = {
  bytes: Uint8Array
  init: Uint8Array
  alive: boolean
  type: CType
  view: VarView
  /** Cell values by id, for the changed / prev flags of the next frame. */
  values: Map<string, string>
  /** Pointer cells, so edges can be redrawn (their targets may die) without rebuilding the region. */
  ptrs: { id: string; name: string; to: number; want: number | undefined }[]
  /** True when the view has no changed flags, so it can be reused as it is. */
  clean: boolean
  /** Parts of each cell that depend only on the type and address. */
  fixed: Map<string, { type: string; addressHex: string; addressWhy: Explain; sizeWhy: Explain }>
  /** Scalar and pointer cells by id, reused while their bytes stay the same. */
  cells: Map<string, CellView>
}

type Build = {
  prev?: Map<string, string>
  next: Map<string, string>
  ptrs: RegionCache['ptrs']
  fixed: RegionCache['fixed']
  clean: boolean
  old?: { bytes: Uint8Array; init: Uint8Array; cells: Map<string, CellView> }
  cells: Map<string, CellView>
}

const sameBytes = (a: Uint8Array, b: Uint8Array, from = 0, to = Math.max(a.length, b.length)) => {
  if (a.length !== b.length) return false
  for (let i = from; i < to; i++) if (a[i] !== b[i]) return false
  return true
}

export class FrameBuilder {
  private outMark = 0
  private writes: [number, number][] = []
  private edges: PointerEdge[] = []
  private L!: Layout
  private mem!: Memory
  private cache = new Map<Region, RegionCache>()
  private edgeCache = new Map<string, { edge: PointerEdge; want: number | undefined; target?: Region; type?: CType }>()
  /** The region being built: its previous values, new values, pointer cells and fixed parts. */
  private cur!: Build

  build(src: FrameSource, info: { index: number; line: number; kind: StepKind; description: string; whys: Explain[]; error?: RunError }): TraceFrame {
    this.L = src.L
    this.mem = src.mem
    this.writes = src.mem.writes
    this.edges = []
    const top = src.frames[src.frames.length - 1]
    const stack: StackFrameView[] = src.frames.map((f) => ({
      id: f.id,
      func: f.fn.name,
      label: `In ${f.fn.name}():`,
      callLine: f.callLine,
      active: f === top,
      returning: f.returning,
      // a static local is named in the block but stored with the globals, so it is listed there
      vars: f.scopes.flatMap((s) => [...s.values()]).filter((r) => r.kind === 'stack').map((r) => this.varView(r)),
    }))
    const byKind = (k: RegionKind) => src.mem.regions.filter((r) => r.kind === k).map((r) => this.varView(r))
    const globals = byKind('global')
    const heap = byKind('heap')
    const literals = byKind('literal')
    const edges = this.edges
    const groups = new Map<string, AliasGroup>()
    for (const e of edges) {
      if (!e.toId || e.status !== 'ok') continue
      const g = groups.get(e.toId) ?? { toId: e.toId, toName: e.toName ?? '', from: [] }
      g.from.push(e.fromName)
      groups.set(e.toId, g)
    }
    const frame: TraceFrame = {
      ...info,
      stack,
      globals,
      heap,
      literals,
      edges,
      aliases: [...groups.values()].filter((g) => g.from.length > 1),
      output: src.out,
      newOutput: src.out.slice(this.outMark),
    }
    this.outMark = src.out.length
    // forget regions that are gone for good (popped frames)
    if (this.cache.size > src.mem.regions.length + 64) {
      const live = new Set(src.mem.regions)
      for (const r of this.cache.keys()) if (!live.has(r)) this.cache.delete(r)
    }
    return frame
  }

  private varView(r: Region): VarView {
    const c = this.cache.get(r)
    const written = this.writes.some(([a, s]) => a < r.addr + r.size && r.addr < a + s)
    if (c && c.clean && !written && c.type === r.type && c.alive === r.alive && sameBytes(c.bytes, r.bytes) && sameBytes(c.init, r.init)) {
      // nothing about this region changed: reuse the last view, redrawing only its arrows
      for (const q of c.ptrs) this.edges.push(this.edge(q.id, q.name, q.to, q.want))
      return c.view
    }
    const same = c !== undefined && c.type === r.type
    const fixed = same ? c.fixed : new Map()
    this.cur = { prev: c?.values, next: new Map(), ptrs: [], fixed, clean: true, cells: new Map(), ...(same ? { old: { bytes: c.bytes, init: c.init, cells: c.cells } } : {}) }
    const cell = this.cell(r, r.type, 0, r.name, r.id, r.addrWhy)
    const view: VarView = {
      ...cell,
      region: r.kind,
      declLine: r.line,
      bytes: Array.from(r.bytes, (b, i) => (r.init[i] ? b : null)),
      ...(r.kind === 'heap' ? { freed: !r.alive } : {}),
      ...(r.staticIn ? { staticIn: r.staticIn } : {}),
    }
    this.cache.set(r, {
      bytes: r.bytes.slice(), init: r.init.slice(), alive: r.alive, type: r.type, view,
      values: this.cur.next, ptrs: this.cur.ptrs, clean: this.cur.clean, fixed, cells: this.cur.cells,
    })
    return view
  }

  private cell(r: Region, t: CType, off: number, name: string, id: string, why: Explain | (() => Explain), arr?: { base: number; dims: number[]; idx: number[] }): CellView {
    const L = this.L
    const size = sizeOf(t, L)
    const address = r.addr + off
    const leaf = t.k !== 'array' && t.k !== 'struct'
    const again = leaf ? this.reuse(r, t, off, size, id) : undefined
    if (again) return again
    let fx = this.cur.fixed.get(id)
    if (!fx) {
      fx = { type: typeName(t, L), addressHex: hex(address), addressWhy: typeof why === 'function' ? why() : why, sizeWhy: sizeWhy(t, L) }
      this.cur.fixed.set(id, fx)
    }
    const written = this.writes.some(([a, s]) => a < address + size && address < a + s)
    const initialised = r.init.subarray(off, off + size).every((b) => b === 1)
    let kind: CellKind = 'scalar'
    let value: string
    let children: CellView[] | undefined
    let pointsTo: number | null | undefined
    if (t.k === 'array') {
      kind = 'array'
      const es = sizeOf(t.of, L)
      const chain = arr ?? { base: address, dims: dimsOf(t), idx: [] }
      const leafOf = t.of.k !== 'array' && t.of.k !== 'struct'
      children = Array.from({ length: t.n }, (_, i) => {
        const again = leafOf ? this.reuse(r, t.of, off + i * es, es, `${id}[${i}]`) : undefined
        if (again) return again
        const idx = [...chain.idx, i]
        const ca = address + i * es
        // a leaf of a multidimensional array gets the full R02 p26 formula, a row or 1D element the simple step
        const why = () => {
          const rm = t.of.k !== 'array' && chain.dims.length > 1 ? arrayAddress({ base: chain.base, elemSize: es, dims: chain.dims, index: idx }) : undefined
          return rm?.ok ? rm.explain : elemWhy(address, i, es, ca)
        }
        return this.cell(r, t.of, off + i * es, `${name}[${i}]`, `${id}[${i}]`, why, t.of.k === 'array' ? { ...chain, idx } : undefined)
      })
      value = t.of.k === 'char' ? charArrayValue(r, off, t.n) : `{${children.map((c) => short(c)).join(', ')}}`
    } else if (t.k === 'struct') {
      kind = 'struct'
      const def = L.structs[t.tag]
      children = (def?.members ?? []).map((m) =>
        this.cell(r, m.type, off + m.offset, `${name}.${m.name}`, `${id}.${m.name}`, () =>
          def.union
            ? { rule: 'Every member of a union starts at the same address: they share the same bytes', working: `${hex(address)} + 0 = ${hex(address)}`, cite: 'R02 p32' }
            : {
                rule: 'A member starts right after the members before it (no padding assumed)',
                working: `${hex(address)} + ${m.offset} = ${hex(address + m.offset)}`,
                cite: 'L05C p3',
              },
        ),
      )
      value = `{${children.map((c, i) => `${def.members[i].name} = ${short(c)}`).join(', ')}}`
    } else {
      const n = initialised ? decodeScalar(t, r.bytes.slice(off, off + size), this.mem.endian) : undefined
      if (t.k === 'ptr') {
        kind = 'pointer'
        pointsTo = n === undefined || n === 0 ? null : n
        if (pointsTo !== null) {
          const q = { id, name, to: pointsTo, want: t.to.k === 'void' ? undefined : sizeOf(t.to, L) }
          this.cur.ptrs.push(q)
          this.edges.push(this.edge(q.id, q.name, q.to, q.want))
        }
      }
      value = n === undefined ? '?' : showScalar(t, n, L.ptrSize)
    }
    const old = this.cur.prev?.get(id)
    this.cur.next.set(id, value)
    const changed = (old !== undefined && old !== value) || (written && kind !== 'array' && kind !== 'struct')
    if (changed) this.cur.clean = false
    const out: CellView = {
      id,
      name,
      type: fx.type,
      kind,
      address,
      addressHex: fx.addressHex,
      size,
      offset: off,
      value,
      initialised,
      ...(pointsTo !== undefined ? { pointsTo } : {}),
      ...(children ? { children } : {}),
      addressWhy: fx.addressWhy,
      sizeWhy: fx.sizeWhy,
      changed: changed || (children?.some((c) => c.changed) ?? false),
      ...(old !== undefined && old !== value ? { prev: old } : {}),
    }
    if (leaf) this.cur.cells.set(id, out)
    return out
  }

  /** A scalar or pointer cell whose bytes are the same as last frame and that was not written: the same object. */
  private reuse(r: Region, t: CType, off: number, size: number, id: string): CellView | undefined {
    const o = this.cur.old
    const pc = o?.cells.get(id)
    if (!pc || pc.changed || !sameBytes(o!.bytes, r.bytes, off, off + size) || !sameBytes(o!.init, r.init, off, off + size)) return undefined
    const address = r.addr + off
    if (this.writes.some(([a, s]) => a < address + size && address < a + s)) return undefined
    this.cur.next.set(id, pc.value)
    this.cur.cells.set(id, pc)
    if (pc.pointsTo != null) {
      const q = { id, name: pc.name, to: pc.pointsTo, want: t.k === 'ptr' && t.to.k !== 'void' ? sizeOf(t.to, this.L) : undefined }
      this.cur.ptrs.push(q)
      this.edges.push(this.edge(q.id, q.name, q.to, q.want))
    }
    return pc
  }

  private edge(from: string, fromName: string, to: number, want: number | undefined): PointerEdge {
    // an arrow into a region that is still alive (and has not changed type) is drawn as before
    const k = this.edgeCache.get(from)
    if (k && k.edge.to === to && k.want === want && k.target?.alive && k.target.type === k.type) return k.edge
    const e = this.newEdge(from, fromName, to, want)
    const target = this.mem.locate(to)
    this.edgeCache.set(from, { edge: e, want, target, type: target?.type })
    return e
  }

  private newEdge(from: string, fromName: string, to: number, want: number | undefined): PointerEdge {
    const r = this.mem.locate(to)
    const gone = r ? undefined : [...this.mem.regions, ...this.mem.dead].find((x) => !x.alive && to >= x.addr && to < x.addr + x.size)
    const target = r ?? (gone?.kind === 'heap' ? gone : undefined)
    const path = target ? pathIn(target.type, to - target.addr, want, this.L) : ''
    return {
      from,
      fromName,
      to,
      toHex: hex(to),
      toId: target ? target.id + path : null,
      toName: target ? target.name + path : (gone?.name ?? null),
      status: r ? 'ok' : gone ? 'dangling' : 'outside',
    }
  }
}

const elemWhy = (base: number, i: number, es: number, addr: number): Explain => ({
  rule: 'Element i starts i x (element size) bytes after the start of the array',
  working: `${hex(base)} + ${i} x ${es} = ${hex(addr)}`,
  cite: 'L05A p8',
})

function dimsOf(t: CType): number[] {
  const d: number[] = []
  while (t.k === 'array') {
    d.push(t.n)
    t = t.of
  }
  return d
}

/** Values inside an aggregate: chars as 'a' without the code, to keep lists short. */
function short(c: CellView): string {
  return c.kind === 'scalar' && c.value.startsWith("'") ? c.value.replace(/ \(\d+\)$/, '') : c.value
}

function charArrayValue(r: Region, off: number, n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) {
    if (!r.init[off + i]) break
    const b = r.bytes[off + i]
    if (b === 0) return JSON.stringify(s)
    s += String.fromCharCode(b)
  }
  // no terminator (or garbage before it): show the cells one by one
  return `{${Array.from({ length: n }, (_, i) => (r.init[off + i] ? showChar((r.bytes[off + i] << 24) >> 24).replace(/ \(\d+\)$/, '') : '?')).join(', ')}}`
}
