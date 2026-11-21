// Small number helpers. Addresses can exceed 2^31 (0xFFFF0000) or 2^32 (R12 p41), so never use JS bit operators on them.

/** Parse a user number: decimal, 0x hex or 0b binary. Underscores are ignored. Returns null when unreadable. */
export function parseNumber(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/_/g, '')
  let n: number
  if (/^0x[0-9a-f]+$/.test(t)) n = parseInt(t.slice(2), 16)
  else if (/^0b[01]+$/.test(t)) n = parseInt(t.slice(2), 2)
  else if (/^\d+$/.test(t)) n = parseInt(t, 10)
  else return null
  return Number.isSafeInteger(n) ? n : null
}

export const hex = (n: number, digits = 0): string => '0x' + n.toString(16).padStart(digits, '0')

export const bin = (n: number, width: number): string => (width <= 0 ? '' : n.toString(2).padStart(width, '0'))

export const isPow2 = (n: number): boolean => Number.isSafeInteger(n) && n > 0 && 2 ** Math.round(Math.log2(n)) === n

export const log2 = (n: number): number => Math.round(Math.log2(n))

/** "16 KB", "64 MB", "8 B". */
export function fmtBytes(n: number): string {
  for (const [unit, size] of [['GB', 2 ** 30], ['MB', 2 ** 20], ['KB', 2 ** 10]] as const) {
    if (n >= size && n % size === 0) return `${n / size} ${unit}`
  }
  return `${n} B`
}

/** Strip float noise such as 64.00000000000001. */
export const clean = (x: number): number => Math.round(x * 1e9) / 1e9

/** Shows a decimal address with its hex form when that helps: "32792 (0x8018)". */
export const addr = (n: number): string => (n < 10 ? `${n}` : `${n} (${hex(n)})`)

/** Fraction in lowest terms: fraction(40, 96) = "5/12". 0/0 stays "0/0". */
export function fraction(n: number, d: number): string {
  let a = n
  let b = d
  while (b) [a, b] = [b, a % b]
  return a > 1 ? `${n / a}/${d / a}` : `${n}/${d}`
}
