/** Tokeniser for the supported C subset. Handles comments, #include (ignored) and simple #define. */

export type Tok = {
  t: 'id' | 'kw' | 'num' | 'chr' | 'str' | 'op' | 'eof'
  v: string
  /** Numeric value for num and chr tokens. */
  n?: number
  float?: boolean
  line: number
  pos: number
  end: number
}

export class SyntaxErr extends Error {
  line: number
  constructor(line: number, message: string) {
    super(message)
    this.line = line
  }
}

export const KEYWORDS = new Set([
  'int', 'char', 'float', 'double', 'void', 'struct', 'typedef', 'const', 'if', 'else', 'while', 'do', 'for',
  'return', 'break', 'continue', 'sizeof',
  // recognised only to give a clear "not supported" message
  'switch', 'case', 'default', 'goto', 'union', 'enum', 'unsigned', 'signed', 'long', 'short', 'static', 'extern',
])

const OPS = [
  '<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')',
  '[', ']', '{', '}',
]

const ESC: Record<string, number> = { n: 10, t: 9, '\\': 92, "'": 39, '"': 34, '?': 63, r: 13, a: 7, b: 8, f: 12, v: 11 }

/** Map typographic characters from copied slides (smart quotes, en and em dashes, minus) to ASCII. */
const charClass = (...codes: number[]) => new RegExp(`[${String.fromCharCode(...codes)}]`, 'g')
const SINGLE_QUOTES = charClass(0x2018, 0x2019)
const DOUBLE_QUOTES = charClass(0x201c, 0x201d)
const DASHES = charClass(0x2013, 0x2014, 0x2212)
export const normalise = (src: string) =>
  src.replace(SINGLE_QUOTES, "'").replace(DOUBLE_QUOTES, '"').replace(DASHES, '-').replace(/\r\n?/g, '\n')

export function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  const macros = new Map<string, Tok[]>()
  let i = 0
  let line = 1
  let lineStart = true
  const push = (tok: Tok) => {
    const m = tok.t === 'id' ? macros.get(tok.v) : undefined
    if (m) for (const x of m) out.push({ ...x, line: tok.line, pos: tok.pos, end: tok.end })
    else out.push(tok)
  }
  const conds: { on: boolean; taken: boolean; outer: boolean }[] = []
  const skipping = () => conds.length > 0 && !conds[conds.length - 1].on
  const readEscape = (): number => {
    const c = src[i + 1]
    // \101 (octal, 1 to 3 digits, so \0 too) and \x41 (hex) give a character by its code
    const num = /^(?:([0-7]{1,3})|x([0-9a-fA-F]+))/.exec(src.slice(i + 1, i + 12))
    if (num) {
      i += 1 + num[0].length
      return (num[1] !== undefined ? parseInt(num[1], 8) : parseInt(num[2], 16)) & 0xff
    }
    if (c === undefined || !(c in ESC)) throw new SyntaxErr(line, `unknown escape \\${c ?? ''}`)
    i += 2
    return ESC[c]
  }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') {
      line++
      i++
      lineStart = true
      continue
    }
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (src.startsWith('/*', i)) {
      const close = src.indexOf('*/', i + 2)
      if (close < 0) throw new SyntaxErr(line, 'comment /* is never closed with */')
      for (let j = i; j < close; j++) if (src[j] === '\n') line++
      i = close + 2
      continue
    }
    if (c === '#' && lineStart) {
      let e = src.indexOf('\n', i)
      if (e < 0) e = src.length
      const text = src.slice(i + 1, e).trim()
      const def = /^define\s+([A-Za-z_]\w*)(.*)$/.exec(text)
      const cond = /^(if|ifdef|ifndef|else|endif)\b\s*(.*)$/.exec(text)
      if (cond) {
        // R01 p18: "#if 0 ... #endif" switches code off. Only constant conditions and #ifdef / #ifndef are handled.
        const [, d, arg] = cond
        if (d === 'endif') {
          if (!conds.pop()) throw new SyntaxErr(line, '#endif without a matching #if')
        } else if (d === 'else') {
          const top = conds[conds.length - 1]
          if (!top) throw new SyntaxErr(line, '#else without a matching #if')
          top.on = !top.taken && top.outer
          top.taken = true
        } else {
          const outer = !skipping()
          let on: boolean
          if (d === 'if') {
            const n = Number(arg.replace(/\/\*.*?\*\/|\/\/.*$/g, '').trim())
            if (!Number.isFinite(n)) throw new SyntaxErr(line, '#if is only supported with a constant, such as #if 0 or #if 1')
            on = n !== 0
          } else on = macros.has(arg.split(/\s/)[0]) === (d === 'ifdef')
          conds.push({ on: on && outer, taken: on, outer })
        }
      } else if (skipping()) {
        // inside #if 0 every other directive is ignored
      } else if (def) {
        // only NAME( with no space takes parameters; NAME (3+2) is a plain value in brackets
        if (def[2].startsWith('(')) throw new SyntaxErr(line, '#define with parameters is not supported')
        macros.set(def[1], tokenize(def[2].trim()).slice(0, -1))
      } else if (!/^include\b/.test(text)) {
        throw new SyntaxErr(line, `#${text.split(/\s/)[0]} is not supported (only #include, #define and #if 0 / #endif)`)
      }
      i = e
      continue
    }
    if (skipping()) {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    lineStart = false
    const start = i
    if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /\w/.test(src[i])) i++
      const v = src.slice(start, i)
      push({ t: KEYWORDS.has(v) ? 'kw' : 'id', v, line, pos: start, end: i })
      continue
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)[uUlLfF]*/.exec(src.slice(i))!
      const text = m[1]
      const float = !/^0[xX]/.test(text) && /[.eE]/.test(text)
      // a leading 0 makes an int literal octal: 010 is 8, and 09 does not compile
      const octal = !float && /^0\d+$/.test(text)
      if (octal && /[89]/.test(text)) throw new SyntaxErr(line, `invalid digit in octal constant ${text} (a leading 0 means octal)`)
      i += m[0].length
      const n = float ? parseFloat(text) : octal ? parseInt(text, 8) : Number(text)
      push({ t: 'num', v: m[0], n, float, line, pos: start, end: i })
      continue
    }
    if (c === "'") {
      i++
      let n: number
      if (src[i] === '\\') n = readEscape()
      else {
        n = src.charCodeAt(i)
        i++
      }
      if (src[i] !== "'") throw new SyntaxErr(line, "character literal needs a closing '")
      i++
      push({ t: 'chr', v: src.slice(start, i), n, line, pos: start, end: i })
      continue
    }
    if (c === '"') {
      i++
      let s = ''
      while (src[i] !== '"') {
        if (i >= src.length || src[i] === '\n') throw new SyntaxErr(line, 'string literal needs a closing "')
        if (src[i] === '\\') s += String.fromCharCode(readEscape())
        else s += src[i++]
      }
      i++
      const prev = out[out.length - 1]
      // adjacent literals join: "ab" "cd" is "abcd"
      if (prev?.t === 'str') {
        prev.v += s
        prev.end = i
      } else push({ t: 'str', v: s, line, pos: start, end: i })
      continue
    }
    const op = OPS.find((o) => src.startsWith(o, i))
    if (!op) throw new SyntaxErr(line, `unexpected character '${c}'`)
    i += op.length
    push({ t: 'op', v: op, line, pos: start, end: i })
  }
  out.push({ t: 'eof', v: '', line, pos: src.length, end: src.length })
  return out
}
