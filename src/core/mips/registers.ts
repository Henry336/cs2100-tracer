/** Register numbers and names, L08 p7 (also L06 p25). */

const NAMES = [
  '$zero', '$at', '$v0', '$v1', '$a0', '$a1', '$a2', '$a3',
  '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
  '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$t8', '$t9', '$k0', '$k1', '$gp', '$sp', '$fp', '$ra',
]

export function regName(n: number): string {
  return NAMES[n] ?? `$${n}`
}

/** Accepts '$t0', '$8', 't0', 'zero'. A bare number such as '8' is not a register. */
export function regNumber(name: string): number | undefined {
  let s = name.trim().toLowerCase()
  if (s.startsWith('$')) s = s.slice(1)
  else if (/^\d/.test(s)) return undefined
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return n < 32 ? n : undefined
  }
  if (s === 's8') return 30
  const i = NAMES.indexOf(`$${s}`)
  return i >= 0 ? i : undefined
}
