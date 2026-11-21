import type { Explain } from './types'

/** One instruction class. Give opcodeBits directly, or the operands so the width can be derived. */
export interface OpcodeClass {
  name: string
  opcodeBits?: number
  /** Instruction length for this class if it differs from the input's length. */
  length?: number
  regs?: number
  addresses?: number
  /** Other operand bits (immediates, shift amounts). */
  otherBits?: number
  /** Exactly this many instructions. */
  fixed?: number
  /** At least this many (default 1). */
  min?: number
}

export interface ExpandingOpcodeInput {
  /** Instruction length in bits. */
  length: number
  /** Number of registers; a register field takes ceil(log2) bits. */
  registers?: number
  /** Byte-addressed memory size; an address takes ceil(log2) bits. */
  memoryBytes?: number
  classes: OpcodeClass[]
  objective: 'max' | 'min'
}

export interface ExpandingOpcodeResult {
  /** In input order. */
  classes: { name: string; operandBits: number; opcodeBits: number; count: number; why: Explain; countWhy: Explain }[]
  /** Prefix-tree view, shortest opcode first. */
  levels: { opcodeBits: number; available: number; taken: { name: string; count: number }[]; passedDown: number; why: Explain }[]
  total: number
  /** Patterns of the longest opcode width left unused (0 when the space is fully used). */
  unused: number
  steps: Explain[]
  error?: string
}

const log2ceil = (n: number) => Math.ceil(Math.log2(n))

interface Cls {
  name: string
  operandBits: number
  opcodeBits: number
  why: Explain
  fixed?: number
  count: number
}

export function expandingOpcode(input: ExpandingOpcodeInput): ExpandingOpcodeResult {
  const out: ExpandingOpcodeResult = { classes: [], levels: [], total: 0, unused: 0, steps: [] }
  const bad = (error: string) => ({ ...out, error })
  if (!input.classes.length) return bad('add at least one instruction class')
  const whole = (x: number | undefined) => x === undefined || (Number.isInteger(x) && x >= 0)
  if (!(Number.isInteger(input.length) && input.length > 0)) return bad(`instruction length must be a whole number of bits, got ${input.length}`)
  if (!whole(input.registers) || !whole(input.memoryBytes)) return bad('the number of registers and the memory size must be whole numbers')
  for (const c of input.classes) {
    for (const k of ['opcodeBits', 'length', 'regs', 'addresses', 'otherBits', 'fixed', 'min'] as const) {
      if (!whole(c[k])) return bad(`class ${c.name}: ${k} must be a whole number 0 or more, got ${c[k]}`)
    }
  }
  const regBits = input.registers ? log2ceil(input.registers) : undefined
  const addrBits = input.memoryBytes ? log2ceil(input.memoryBytes) : undefined
  if (regBits !== undefined) out.steps.push({ rule: 'A register field needs ceil(log2(number of registers)) bits', working: `ceil(log2 ${input.registers}) = ${regBits}`, cite: 'AY23/24 S2 Q7' })
  if (addrBits !== undefined) out.steps.push({ rule: 'A full byte address needs log2(memory size in bytes) bits', working: `ceil(log2 ${input.memoryBytes}) = ${addrBits}`, cite: 'AY23/24 S2 Q7' })

  const cls: Cls[] = []
  for (const c of input.classes) {
    if ((c.regs ?? 0) > 0 && regBits === undefined) return bad(`class ${c.name} has register operands: give the number of registers`)
    if ((c.addresses ?? 0) > 0 && addrBits === undefined) return bad(`class ${c.name} has an address operand: give the memory size`)
    const operandBits = (c.regs ?? 0) * (regBits ?? 0) + (c.addresses ?? 0) * (addrBits ?? 0) + (c.otherBits ?? 0)
    const len = c.length ?? input.length
    const opcodeBits = c.opcodeBits ?? len - operandBits
    if (!Number.isInteger(opcodeBits) || opcodeBits < 1) return bad(`class ${c.name} leaves ${opcodeBits} bits for the opcode`)
    if (opcodeBits > 48) return bad(`class ${c.name}: opcodes over 48 bits are not supported`)
    if (opcodeBits + operandBits > len) return bad(`class ${c.name}: ${opcodeBits} opcode bits + ${operandBits} operand bits = ${opcodeBits + operandBits} bits, more than the ${len}-bit instruction`)
    const parts = [c.regs ? `${c.regs} x ${regBits}` : '', c.addresses ? `${c.addresses} x ${addrBits}` : '', c.otherBits ? String(c.otherBits) : ''].filter(Boolean)
    const why: Explain = c.opcodeBits !== undefined
      ? { rule: 'Opcode width given', working: `${opcodeBits} bits` }
      : { rule: 'Opcode bits = instruction length - operand bits', working: `${len} - (${parts.join(' + ') || '0'}) = ${opcodeBits}`, cite: 'AY23/24 S2 Q7' }
    cls.push({ name: c.name, operandBits, opcodeBits, why, fixed: c.fixed, count: c.fixed ?? c.min ?? 1 })
  }

  // Work in units of the longest opcode: a w-bit opcode uses 2^(wmax - w) of the 2^wmax patterns.
  const wmax = Math.max(...cls.map((c) => c.opcodeBits))
  const B = 2 ** wmax
  const cost = (c: Cls) => 2 ** (wmax - c.opcodeBits)
  const used = () => cls.reduce((s, c) => s + c.count * cost(c), 0)
  if (used() > B) return bad(`the required counts need ${used()} of the ${B} ${wmax}-bit patterns`)

  const free = [...cls].filter((c) => c.fixed === undefined).sort((a, b) => a.opcodeBits - b.opcodeBits)
  const absorber = free[free.length - 1]
  out.steps.push({ rule: 'Work with the most constrained class first: shortest opcode (most operand bits) first', cite: 'L10 p30' })
  if (input.objective === 'max') {
    out.steps.push({ rule: 'Maximum: give every shorter-opcode class its minimum and let the longest-opcode class take every pattern left', cite: 'R04 p45' })
  } else {
    out.steps.push({ rule: 'Minimum: give the shorter-opcode classes as many codes as possible, keeping just enough prefixes to expand for the later classes; the space is fully used', cite: 'R04 p45' })
    for (const c of free.slice(0, -1)) c.count += Math.floor((B - used()) / cost(c))
  }
  if (absorber) absorber.count += Math.floor((B - used()) / cost(absorber))

  const unused = B - used()
  const widths = [...new Set(cls.map((c) => c.opcodeBits))].sort((a, b) => a - b)
  let available = 2 ** widths[0]
  widths.forEach((w, k) => {
    const here = cls.filter((c) => c.opcodeBits === w)
    const takenN = here.reduce((s, c) => s + c.count, 0)
    const passedDown = available - takenN
    const next = widths[k + 1]
    const why: Explain = next === undefined
      ? { rule: `${w}-bit opcodes: ${available} codes, ${here.map((c) => `${c.name} takes ${c.count}`).join(', ')}`, working: passedDown ? `${passedDown} codes left unused` : 'every code is used' }
      : { rule: `${w}-bit opcodes: ${available} codes, ${here.map((c) => `${c.name} takes ${c.count}`).join(', ')}, ${passedDown} left as prefixes`, working: `each prefix expands by ${next - w} bits: ${passedDown} x 2^${next - w} = ${passedDown * 2 ** (next - w)} codes for the ${next}-bit level`, cite: 'R04 p45' }
    out.levels.push({ opcodeBits: w, available, taken: here.map((c) => ({ name: c.name, count: c.count })), passedDown, why })
    out.steps.push(why)
    if (next !== undefined) available = passedDown * 2 ** (next - w)
  })

  out.steps.push({
    rule: 'Check: each w-bit opcode uses 2^(wmax - w) patterns of the longest width, and the sum must not exceed 2^wmax',
    working: `${cls.map((c) => `${c.count} x 2^${wmax - c.opcodeBits}`).join(' + ')} = ${B - unused}${unused ? ` of ${B} (${unused} unused)` : ` = 2^${wmax}`}`,
  })
  out.total = cls.reduce((s, c) => s + c.count, 0)
  out.steps.push({ rule: `${input.objective === 'max' ? 'Maximum' : 'Minimum'} total`, working: `${cls.map((c) => c.count).join(' + ')} = ${out.total}` })
  out.unused = unused
  out.classes = cls.map((c) => ({
    name: c.name,
    operandBits: c.operandBits,
    opcodeBits: c.opcodeBits,
    count: c.count,
    why: c.why,
    countWhy: c.fixed !== undefined
      ? { rule: 'Fixed by the question', working: String(c.count) }
      : c === absorber
        ? { rule: input.objective === 'max' ? 'Longest opcode: takes every pattern left' : 'Longest opcode: fills what the shorter classes left', working: String(c.count), cite: 'R04 p45' }
        : { rule: input.objective === 'max' ? 'Shorter opcode: kept to its minimum' : 'Shorter opcode: takes all but the prefixes needed later', working: String(c.count), cite: 'R04 p45' },
  }))
  return out
}
