/** printf subset: %d %i %u %c %s %f %e %x %X %p %% with flags, width and precision. */
import { RuntimeErr } from './memory'
import { isFloating, type CType } from './types'

export type Arg = { t: CType; n: number }

const SPEC = /%([-+ 0#]*)(\d+)?(?:\.(\d+))?(hh|h|ll|l|L|z)?([a-zA-Z%])/g

/**
 * x.toFixed(p), except that an exact tie rounds to even as glibc printf does (0.125 -> "0.12", 2.5 -> "2").
 * toFixed already uses the exact binary value, so only exact ties (v = 2 x |x| x 10^p odd) differ.
 */
export function toFixedEven(x: number, p: number): string {
  const s = x.toFixed(p)
  const a = Math.abs(x)
  if (!Number.isFinite(a) || a >= 2 ** 53) return s
  // a = m x 2^e exactly, with m a whole number
  const dv = new DataView(new ArrayBuffer(8))
  dv.setFloat64(0, a)
  const hi = dv.getUint32(0)
  const ex = (hi >>> 20) & 0x7ff
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(dv.getUint32(4))
  if (ex) m |= 1n << 52n
  let e = (ex || 1) - 1075 + 1 // +1: work with 2a
  let v = m * 10n ** BigInt(p)
  if (e >= 0) v <<= BigInt(e)
  else {
    const d = 1n << BigInt(-e)
    if (v % d) return s
    v /= d
  }
  if (v % 2n === 0n) return s // not a tie
  const down = (v - 1n) / 2n
  if (down % 2n) return s // the tie goes up to an even digit, which toFixed already did
  const digits = down.toString().padStart(p + 1, '0')
  const body = p ? `${digits.slice(0, -p)}.${digits.slice(-p)}` : digits
  return x < 0 || Object.is(x, -0) ? `-${body}` : body
}

export function formatPrintf(
  fmt: string,
  args: Arg[],
  readString: (addr: number) => string,
  warn: (msg: string) => void,
  pointerFormat: 'slides' | 'gcc' = 'slides',
): string {
  let out = ''
  let last = 0
  let ai = 0
  for (const m of fmt.matchAll(SPEC)) {
    out += fmt.slice(last, m.index)
    last = m.index + m[0].length
    const [spec, flags, width, prec, , conv] = m
    if (conv === '%') {
      out += '%'
      continue
    }
    const a = args[ai++]
    if (!a) throw new RuntimeErr('type', `printf has more conversions than values: nothing is left for ${spec}`)
    const isPtr = a.t.k === 'ptr'
    const p = prec === undefined ? undefined : Number(prec)
    let s: string
    let numeric = true
    switch (conv) {
      case 'd':
      case 'i':
      case 'u':
        if (isFloating(a.t)) throw new RuntimeErr('type', `${spec} expects an int but gets a ${a.t.k}. Real C prints garbage here; use %f`, 'L04A p14')
        if (isPtr) warn(`${spec} is given a pointer; use %p to print addresses (L04D p14)`)
        s = String(conv === 'u' || isPtr ? a.n >>> 0 : a.n | 0)
        if (p !== undefined) s = s.replace(/\d+/, (d) => d.padStart(p, '0'))
        break
      case 'c':
        numeric = false
        s = String.fromCharCode(a.n & 0xff)
        break
      case 's':
        numeric = false
        if (!isPtr) throw new RuntimeErr('type', `${spec} expects a string (a char address) but gets a ${a.t.k}`)
        s = readString(a.n)
        if (p !== undefined) s = s.slice(0, p)
        break
      case 'f':
      case 'F':
      case 'e':
      case 'E':
        if (!isFloating(a.t))
          throw new RuntimeErr('type', `${spec} expects a double but gets ${isPtr ? 'a pointer' : 'an int'}. Real C prints garbage here`, 'L04A p14')
        if (!Number.isFinite(a.n)) s = Number.isNaN(a.n) ? 'nan' : a.n < 0 ? '-inf' : 'inf'
        else if (conv === 'f' || conv === 'F') s = Math.abs(a.n) < 1e21 ? toFixedEven(a.n, p ?? 6) : `${BigInt(a.n)}${p === 0 ? '' : '.' + '0'.repeat(p ?? 6)}`
        else s = a.n.toExponential(p ?? 6).replace(/e([+-])(\d)$/, 'e$10$2')
        if (conv === 'E') s = s.toUpperCase()
        break
      case 'x':
      case 'X':
        if (isFloating(a.t)) throw new RuntimeErr('type', `${spec} expects an int but gets a ${a.t.k}`)
        s = (a.n >>> 0).toString(16)
        if (conv === 'X') s = s.toUpperCase()
        if (flags.includes('#') && a.n) s = (conv === 'X' ? '0X' : '0x') + s
        break
      case 'p':
        if (!isPtr) warn(`${spec} is given a ${a.t.k}, not a pointer`)
        // the slides (sunfire) print ffbff7dc; gcc on Linux prints 0xffbff7dc and (nil) for NULL
        s = pointerFormat === 'gcc' ? (a.n === 0 ? '(nil)' : `0x${(a.n >>> 0).toString(16)}`) : (a.n >>> 0).toString(16)
        break
      default:
        throw new RuntimeErr('unsupported', `printf conversion ${spec} is not supported (use %d %c %s %f %p %x)`)
    }
    const signed = numeric && conv !== 'u' && conv !== 'x' && conv !== 'X' && conv !== 'p'
    if (signed && flags.includes('+') && /^\d/.test(s)) s = `+${s}`
    else if (signed && flags.includes(' ') && /^\d/.test(s)) s = ` ${s}`
    const w = Number(width ?? 0)
    if (s.length < w) {
      if (flags.includes('-')) s = s.padEnd(w)
      else if (numeric && flags.includes('0') && conv !== 'p') s = s.replace(/^([+ -]?)/, (sign) => sign + '0'.repeat(w - s.length))
      else s = s.padStart(w)
    }
    out += s
  }
  if (ai < args.length) warn(`printf is given ${args.length - ai} more value(s) than the format uses`)
  return out + fmt.slice(last)
}
