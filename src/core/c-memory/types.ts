/** Shared types for the C memory tracer: C types, layout, explanations and config. */

/** Every derived number a student might question carries one of these (rendered with <Why>). */
export type Explain = { rule: string; working?: string; cite?: string }

export type CType =
  | { k: 'int' }
  | { k: 'char' }
  | { k: 'float' }
  | { k: 'double' }
  | { k: 'void' }
  | { k: 'ptr'; to: CType }
  | { k: 'array'; of: CType; n: number }
  | { k: 'struct'; tag: string }

export type StructMember = { name: string; type: CType; offset: number }
export type StructDef = {
  tag: string
  /** How the type prints: "struct point" or a typedef name for an anonymous struct. */
  display: string
  members: StructMember[]
  size: number
  complete: boolean
  /** A union: every member starts at offset 0 and the size is the largest member (R02 p32). */
  union?: boolean
}

/** Everything sizeof needs. */
export type Layout = { structs: Record<string, StructDef>; ptrSize: number }

export type Endian = 'big' | 'little'

export type CMemConfig = {
  /** 4 matches the slides (8-hex-digit addresses, L04A p7) and midterm AY25/26 Q12. */
  pointerSize: 4 | 8
  /** R02 p8 labels "our MIPS" big-endian; L10 p17 says MIPS endianness is implementation specific. */
  endian: Endian
  /** Locals are placed downward from here (the first int lands at stackTop - 4). */
  stackTop: number
  /** Globals are placed upward from here (MIPS .data segment start). */
  globalBase: number
  heapBase: number
  /** Read-only string literals used as values (char *s = "hi"). */
  literalBase: number
  /** Stop after this many steps (guards against infinite loops). */
  maxSteps: number
  /** Keyboard input for scanf, fgets and getchar, as typed (lines end with 
). Empty means end of input. */
  stdin: string
  /**
   * How printf %p writes an address. 'slides': plain hex digits, as every slide prints them
   * (L04A p7 ffbff7dc, L04B p5, L04D p15, L05A p8: the course's sunfire output). 'gcc': with a 0x
   * prefix, as gcc on Linux prints them.
   */
  pointerFormat: 'slides' | 'gcc'
}

export const DEFAULT_CONFIG: CMemConfig = {
  pointerSize: 4,
  endian: 'big',
  stackTop: 0xffbff800,
  globalBase: 0x10010000,
  heapBase: 0x10040000,
  literalBase: 0x10000000,
  maxSteps: 2000,
  stdin: '',
  pointerFormat: 'slides',
}

export const T_INT: CType = { k: 'int' }
export const T_CHAR: CType = { k: 'char' }
export const T_FLOAT: CType = { k: 'float' }
export const T_DOUBLE: CType = { k: 'double' }
export const T_VOID: CType = { k: 'void' }
export const ptr = (to: CType): CType => ({ k: 'ptr', to })
export const arr = (of: CType, n: number): CType => ({ k: 'array', of, n })

/** Course sizes: int 4, float 4, double 8, char 1 (L02A p26, recalled on L04B p5). */
export const SCALAR_SIZE = { int: 4, char: 1, float: 4, double: 8 } as const

export const isArith = (t: CType) => t.k === 'int' || t.k === 'char' || t.k === 'float' || t.k === 'double'
export const isFloating = (t: CType) => t.k === 'float' || t.k === 'double'
export const isScalar = (t: CType) => isArith(t) || t.k === 'ptr'

export class LayoutError extends Error {}

export function sizeOf(t: CType, L: Layout): number {
  switch (t.k) {
    case 'int':
    case 'char':
    case 'float':
    case 'double':
      return SCALAR_SIZE[t.k]
    case 'ptr':
      return L.ptrSize
    case 'array':
      return t.n * sizeOf(t.of, L)
    case 'struct': {
      const d = L.structs[t.tag]
      if (!d || !d.complete) throw new LayoutError(`${d?.display ?? `struct ${t.tag}`} is used before its members are defined`)
      return d.size
    }
    case 'void':
      throw new LayoutError('void has no size')
  }
}

/** Natural alignment, used only to place variables (not inside structs: the course shows no padding). */
export function alignOf(t: CType, L: Layout): number {
  switch (t.k) {
    case 'array':
      return alignOf(t.of, L)
    case 'struct': {
      const d = L.structs[t.tag]
      return Math.max(1, ...(d?.members.map((m) => alignOf(m.type, L)) ?? [1]))
    }
    default:
      return sizeOf(t, L)
  }
}

export function sameType(a: CType, b: CType): boolean {
  if (a.k !== b.k) return false
  if (a.k === 'ptr' && b.k === 'ptr') return sameType(a.to, b.to)
  if (a.k === 'array' && b.k === 'array') return a.n === b.n && sameType(a.of, b.of)
  if (a.k === 'struct' && b.k === 'struct') return a.tag === b.tag
  return true
}

/** C declarator-style name: "int *", "int *[2]", "int (*)[4]", "struct point". */
export function typeName(t: CType, L: Layout, inner = ''): string {
  const join = (base: string) => (inner ? `${base} ${inner}` : base)
  switch (t.k) {
    case 'ptr':
      return typeName(t.to, L, t.to.k === 'array' ? `(*${inner})` : `*${inner}`)
    case 'array':
      return typeName(t.of, L, `${inner}[${t.n}]`)
    case 'struct':
      return join(L.structs[t.tag]?.display ?? `struct ${t.tag}`)
    default:
      return join(t.k)
  }
}

export const hex = (n: number, digits = 8) => `0x${(n >>> 0).toString(16).padStart(digits, '0')}`

/** Plain explanation of a type's size, with the course reference. */
export function sizeWhy(t: CType, L: Layout): Explain {
  switch (t.k) {
    case 'int':
    case 'char':
    case 'float':
    case 'double':
      return { rule: `sizeof(${t.k}) is ${SCALAR_SIZE[t.k]} byte${t.k === 'char' ? '' : 's'} in the course`, cite: 'L02A p26' }
    case 'ptr':
      return {
        rule: `A pointer holds an address: ${L.ptrSize} bytes (${L.ptrSize * 8}-bit addresses${L.ptrSize === 4 ? ', as the slides print them' : ''})`,
        cite: 'L04A p7',
      }
    case 'array': {
      const es = sizeOf(t.of, L)
      return { rule: 'An array is its elements side by side, all the same type', working: `${t.n} x ${es} = ${t.n * es} bytes`, cite: 'L05A p8' }
    }
    case 'struct': {
      const d = L.structs[t.tag]
      const parts = d?.members.map((m) => String(sizeOf(m.type, L))) ?? []
      if (d?.union)
        return {
          rule: 'All members of a union share the same bytes, so its size is the size of its largest member',
          working: `largest of ${parts.join(', ') || '0'} = ${d.size} bytes`,
          cite: 'R02 p32',
        }
      return {
        rule: 'Members are laid out in declaration order with no gaps (assumption: the course never teaches padding; real compilers may add some)',
        working: `${parts.join(' + ') || '0'} = ${d?.size ?? 0} bytes`,
        cite: 'L05C p3',
      }
    }
    case 'void':
      return { rule: 'void has no size' }
  }
}
