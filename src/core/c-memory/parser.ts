/** Recursive-descent parser for the supported C subset. Never throws: returns errors with line numbers. */
import type { CaseLabel, Expr, FuncDef, Param, Program, Stmt, VarDecl } from './ast'
import { normalise, SyntaxErr, tokenize, type Tok } from './lexer'
import { arr, LayoutError, ptr, sizeOf, type CType, type Layout, type StructDef } from './types'

export type CError = { line: number; message: string }
export type ParseResult = { ok: true; program: Program } | { ok: false; errors: CError[] }

const UNSUPPORTED: Record<string, string> = {
  case: 'case is only valid directly inside a switch block',
  default: 'default is only valid directly inside a switch block',
  goto: 'goto is not supported',
  unsigned: 'unsigned types are not supported; use int, char, float or double',
  signed: 'signed is not needed; int and char are already signed here',
  long: 'long is not supported; use int (4 bytes) or double (8 bytes)',
  short: 'short is not supported; use int',
  extern: 'extern is not supported by this tracer',
}

const BIN_PREC: Record<string, number> = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
}
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='])
const BASE_TYPES = new Set(['int', 'char', 'float', 'double', 'void', 'struct', 'union', 'enum', 'const', 'static'])

type Decl = { name: string; wrap: (t: CType) => CType; params?: Param[]; line: number }

export function parse(source: string, ptrSize: 4 | 8 = 4): ParseResult {
  const src = normalise(source)
  try {
    return { ok: true, program: new Parser(src, tokenize(src), ptrSize).program() }
  } catch (e) {
    if (e instanceof SyntaxErr) return { ok: false, errors: [{ line: e.line, message: `line ${e.line}: ${e.message}` }] }
    throw e
  }
}

class Parser {
  src: string
  toks: Tok[]
  p = 0
  L: Layout
  typedefs = new Map<string, CType>()
  /** Enum constants (R02 p35): each name stands for its int value. */
  enums = new Map<string, number>()
  anon = 0
  /** Set by typeSpec when the declaration starts with static. */
  sawStatic = false

  constructor(src: string, toks: Tok[], ptrSize: number) {
    this.src = src
    this.toks = toks
    this.L = { structs: {}, ptrSize }
  }

  /* ---------- token helpers ---------- */
  peek(o = 0): Tok {
    return this.toks[Math.min(this.p + o, this.toks.length - 1)]
  }
  get last(): Tok {
    return this.toks[Math.max(0, this.p - 1)]
  }
  next(): Tok {
    return this.toks[this.p++]
  }
  is(v: string, o = 0) {
    const t = this.peek(o)
    return (t.t === 'op' || t.t === 'kw') && t.v === v
  }
  eat(v: string) {
    if (this.is(v)) {
      this.p++
      return true
    }
    return false
  }
  fail(msg: string, tok: Tok = this.peek()): never {
    throw new SyntaxErr(tok.line, msg)
  }
  found(t: Tok) {
    return t.t === 'eof' ? 'the end of the program' : `'${t.t === 'str' ? `"${t.v}"` : t.v}'`
  }
  expect(v: string, what = `'${v}'`) {
    if (this.eat(v)) return
    const t = this.peek()
    // a missing ';' is reported on the line it belongs to, not the next one
    this.fail(`expected ${what} but found ${this.found(t)}`, v === ';' && this.p > 0 ? this.last : t)
  }
  ident(what: string): string {
    const t = this.peek()
    if (t.t !== 'id') this.fail(`expected ${what} but found ${this.found(t)}`)
    this.p++
    return t.v
  }
  layout<T>(fn: () => T, line: number): T {
    try {
      return fn()
    } catch (e) {
      if (e instanceof LayoutError) throw new SyntaxErr(line, e.message)
      throw e
    }
  }
  isTypeStart(o = 0): boolean {
    const t = this.peek(o)
    if (t.t === 'kw' && UNSUPPORTED[t.v] && !['case', 'default', 'goto'].includes(t.v)) this.fail(UNSUPPORTED[t.v], t)
    return (t.t === 'kw' && BASE_TYPES.has(t.v)) || (t.t === 'id' && this.typedefs.has(t.v))
  }
  mk(start: Tok, node: Record<string, unknown>): Expr {
    return { ...node, line: start.line, text: this.src.slice(start.pos, this.last.end) } as Expr
  }

  /* ---------- program ---------- */
  program(): Program {
    const prog: Program = { structs: this.L.structs, globals: [], funcs: {}, protos: {} }
    while (this.peek().t !== 'eof') {
      const start = this.peek()
      if (this.eat('typedef')) {
        this.typedef()
        continue
      }
      if (!this.isTypeStart()) this.fail(`expected a declaration or function but found ${this.found(start)}`)
      const base = this.typeSpec()
      if (this.eat(';')) continue
      const d = this.declarator()
      if (d.params) {
        const ret = d.wrap(base)
        if (this.eat(';')) {
          prog.protos[d.name] ??= start.line
          continue
        }
        if (!this.is('{')) this.fail(`expected '{' to start the body of ${d.name}`)
        if (prog.funcs[d.name]) this.fail(`function ${d.name} is defined twice`, start)
        const fn: FuncDef = { name: d.name, ret, params: d.params, body: this.block(), line: start.line }
        prog.funcs[d.name] = fn
        continue
      }
      const decls = [this.finishDecl(d, base)]
      while (this.eat(',')) decls.push(this.finishDecl(this.declarator(), base))
      this.expect(';')
      prog.globals.push({ k: 'decl', decls, line: start.line })
    }
    if (!prog.funcs.main) throw new SyntaxErr(this.peek().line, 'the program needs a main function')
    checkImplicitDecls(prog)
    return prog
  }

  typedef() {
    const base = this.typeSpec()
    do {
      const d = this.declarator()
      if (!d.name) this.fail('typedef needs a name')
      const t = d.wrap(base)
      if (t.k === 'struct' && t.tag.startsWith('#')) this.L.structs[t.tag].display = d.name
      this.typedefs.set(d.name, t)
    } while (this.eat(','))
    this.expect(';', "';' after the typedef (it is required, L05C p4)")
  }

  /* ---------- types and declarators ---------- */
  typeSpec(): CType {
    this.sawStatic = false
    for (;;) {
      if (this.eat('static')) this.sawStatic = true
      else if (!this.eat('const')) break
    }
    const t = this.next()
    let base: CType
    if (t.t === 'kw' && ['int', 'char', 'float', 'double', 'void'].includes(t.v)) base = { k: t.v as 'int' }
    else if (t.t === 'kw' && (t.v === 'struct' || t.v === 'union')) base = this.structSpec(t)
    else if (t.t === 'kw' && t.v === 'enum') base = this.enumSpec(t)
    else if (t.t === 'id' && this.typedefs.has(t.v)) base = this.typedefs.get(t.v)!
    else if (t.t === 'kw' && UNSUPPORTED[t.v]) this.fail(UNSUPPORTED[t.v], t)
    else this.fail(`expected a type but found ${this.found(t)}`, t)
    while (this.eat('const'));
    return base
  }

  /** struct or union. Union tags are kept apart from struct tags (key "union IF"). */
  structSpec(kw: Tok): CType {
    const union = kw.v === 'union'
    const name = this.peek().t === 'id' ? this.next().v : undefined
    const tag = name === undefined ? `#anon${++this.anon}` : union ? `union ${name}` : name
    const S = this.L.structs
    const def: StructDef = (S[tag] ??= {
      tag, display: `${kw.v} ${name ?? ''}`.trim(), members: [], size: 0, complete: false, ...(union ? { union } : {}),
    })
    if (!this.eat('{')) {
      if (name === undefined) this.fail(`expected '{' after ${kw.v}`, kw)
      return { k: 'struct', tag }
    }
    if (def.complete) this.fail(`${def.display} is defined twice`, kw)
    let offset = 0
    while (!this.eat('}')) {
      const line = this.peek().line
      const base = this.typeSpec()
      do {
        const d = this.declarator()
        if (!d.name || d.params) this.fail('expected a member name', this.last)
        const type = d.wrap(base)
        if (type.k === 'array' && type.n < 0) this.fail(`member ${d.name} needs an array size`)
        if (def.members.some((m) => m.name === d.name)) this.fail(`member ${d.name} appears twice`)
        const size = this.layout(() => sizeOf(type, this.L), line)
        def.members.push({ name: d.name, type, offset: union ? 0 : offset })
        offset = union ? Math.max(offset, size) : offset + size
      } while (this.eat(','))
      this.expect(';', "';' after the member")
    }
    def.size = offset
    def.complete = true
    return { k: 'struct', tag }
  }

  /** enum Tag { A = 3, B, C }: constants count up by 1 from the last given value (R02 p35). An enum variable is an int. */
  enumSpec(kw: Tok): CType {
    if (this.peek().t === 'id') this.next()
    else if (!this.is('{')) this.fail("expected a name or '{' after enum", kw)
    if (this.eat('{')) {
      let next = 0
      while (!this.eat('}')) {
        const name = this.ident('an enum constant name')
        if (this.eat('=')) next = this.constEval(this.cond())
        if (this.enums.has(name)) this.fail(`enum constant ${name} is defined twice`)
        this.enums.set(name, next++)
        if (!this.eat(',')) {
          this.expect('}', "',' or '}' in the enum list")
          break
        }
      }
    }
    return { k: 'int' }
  }

  /** Declarator: stars, a name (or (*name)), then [N] suffixes or a parameter list. Name may be empty (abstract). */
  declarator(): Decl {
    const line = this.peek().line
    let stars = 0
    while (this.eat('*')) {
      stars++
      while (this.eat('const'));
    }
    let inner: Decl | undefined
    let name = ''
    if (this.is('(') && this.is('*', 1)) {
      this.next()
      inner = this.declarator()
      this.expect(')')
    } else if (this.peek().t === 'id') name = this.next().v
    const dims: number[] = []
    let params: Param[] | undefined
    for (;;) {
      if (this.eat('[')) {
        if (this.is(']')) {
          if (dims.length) this.fail('only the first array size may be left out')
          dims.push(-1)
        } else dims.push(this.constInt())
        this.expect(']')
      } else if (this.is('(') && !params && !dims.length && !inner && name) params = this.params()
      else break
    }
    const wrap = (t: CType): CType => {
      let x = t
      for (let i = 0; i < stars; i++) x = ptr(x)
      for (let i = dims.length - 1; i >= 0; i--) x = arr(x, dims[i])
      return inner ? inner.wrap(x) : x
    }
    return { name: inner ? inner.name : name, wrap, params, line }
  }

  params(): Param[] {
    this.expect('(')
    const out: Param[] = []
    if (this.eat(')')) return out
    if (this.is('void') && this.is(')', 1)) {
      this.p += 2
      return out
    }
    do {
      const base = this.typeSpec()
      const d = this.declarator()
      let type = d.wrap(base)
      // int arr[] and int arr[8] in a parameter list both mean int *arr (L05A p12-13)
      if (type.k === 'array') type = ptr(type.of)
      out.push({ name: d.name, type })
    } while (this.eat(','))
    this.expect(')')
    return out
  }

  finishDecl(d: Decl, base: CType): VarDecl {
    if (!d.name) this.fail('expected a variable name')
    if (d.params) this.fail(`a function prototype for ${d.name} must be at the top level`)
    let type = d.wrap(base)
    if (type.k === 'void') this.fail(`${d.name} cannot be void (only functions and pointers use void)`)
    let init: Expr | undefined
    if (this.eat('=')) init = this.initializer()
    if (type.k === 'array' && type.n < 0) {
      if (init?.k === 'init') type = arr(type.of, init.items.length)
      else if (init?.k === 'str') type = arr(type.of, init.v.length + 1)
      else this.fail(`array ${d.name} needs a size or an initialiser`)
    }
    this.layout(() => sizeOf(type, this.L), d.line)
    return { name: d.name, type, init, line: d.line }
  }

  initializer(): Expr {
    const start = this.peek()
    if (!this.eat('{')) return this.assign()
    const items: Expr[] = []
    while (!this.eat('}')) {
      items.push(this.initializer())
      if (!this.eat(',')) {
        this.expect('}', "',' or '}' in the initialiser list")
        break
      }
    }
    return this.mk(start, { k: 'init', items })
  }

  constInt(): number {
    const e = this.cond()
    const v = this.constEval(e)
    if (!Number.isInteger(v) || v <= 0) this.fail(`array size must be a positive whole number, not ${e.text}`, this.last)
    return v
  }
  constEval(e: Expr): number {
    switch (e.k) {
      case 'num':
      case 'chr':
        return e.v
      case 'unary':
        if (e.op === '-') return -this.constEval(e.e)
        if (e.op === '+') return this.constEval(e.e)
        break
      case 'bin': {
        const a = this.constEval(e.l)
        const b = this.constEval(e.r)
        if (e.op === '+') return a + b
        if (e.op === '-') return a - b
        if (e.op === '*') return a * b
        if (e.op === '/' && b) return Math.trunc(a / b)
        if (e.op === '%' && b) return a % b
        break
      }
      case 'sizeof':
        if (e.t) return this.layout(() => sizeOf(e.t!, this.L), e.line)
        break
    }
    return this.fail(`array size must be a constant, not ${e.text}`, this.last)
  }

  /* ---------- statements ---------- */
  block(): Stmt & { k: 'block' } {
    const start = this.peek()
    this.expect('{')
    const body: Stmt[] = []
    while (!this.is('}')) {
      if (this.peek().t === 'eof') this.fail("missing '}' to close the block", start)
      body.push(this.stmt())
    }
    const end = this.next()
    return { k: 'block', body, line: start.line, endLine: end.line }
  }

  stmt(): Stmt {
    const t = this.peek()
    const line = t.line
    if (t.t === 'kw') {
      switch (t.v) {
        case 'if': {
          this.next()
          this.expect('(')
          const c = this.expr()
          this.expect(')')
          const then = this.stmt()
          const els = this.eat('else') ? this.stmt() : undefined
          return { k: 'if', c, then, else: els, line }
        }
        case 'while': {
          this.next()
          this.expect('(')
          const c = this.expr()
          this.expect(')')
          return { k: 'while', c, body: this.stmt(), line }
        }
        case 'do': {
          this.next()
          const body = this.stmt()
          const condLine = this.peek().line
          this.expect('while', "'while' after the do body")
          this.expect('(')
          const c = this.expr()
          this.expect(')')
          this.expect(';')
          return { k: 'do', body, c, condLine, line }
        }
        case 'for': {
          this.next()
          this.expect('(')
          let init: Stmt | undefined
          if (!this.eat(';')) init = this.isTypeStart() ? this.declStmt() : this.exprStmt()
          const c = this.is(';') ? undefined : this.expr()
          this.expect(';')
          const step = this.is(')') ? undefined : this.expr()
          this.expect(')')
          return { k: 'for', init, c, step, body: this.stmt(), line }
        }
        case 'return': {
          this.next()
          const e = this.is(';') ? undefined : this.expr()
          this.expect(';')
          return { k: 'return', e, line }
        }
        case 'break':
        case 'continue':
          this.next()
          this.expect(';')
          return t.v === 'break' ? { k: 'break', line } : { k: 'continue', line }
        case 'else':
          this.fail("else without a matching if (check the braces and the ';' before else)")
        case 'switch':
          return this.switchStmt()
      }
      if (UNSUPPORTED[t.v]) this.fail(UNSUPPORTED[t.v])
    }
    if (this.is('{')) return this.block()
    if (this.eat(';')) return { k: 'empty', line }
    if (this.isTypeStart()) return this.declStmt()
    return this.exprStmt()
  }

  /** switch (e) { case v: ... } (L02C p4-5). Labels sit directly in the switch block; case lo ... hi is the GCC range (L02C p5). */
  switchStmt(): Stmt {
    const line = this.next().line
    this.expect('(')
    const e = this.expr()
    this.expect(')')
    const open = this.peek()
    this.expect('{', "'{' to start the switch block")
    const body: Stmt[] = []
    const labels: CaseLabel[] = []
    const seen = new Set<number>()
    while (!this.is('}')) {
      const t = this.peek()
      if (t.t === 'eof') this.fail("missing '}' to close the switch block", open)
      if (this.eat('case')) {
        const lo = this.constEval(this.cond())
        const hi = this.eat('...') ? this.constEval(this.cond()) : lo
        this.expect(':', "':' after the case value")
        for (let v = lo; v <= hi && v - lo < 1024; v++) {
          if (seen.has(v)) this.fail(`duplicate case value ${v}`, t)
          seen.add(v)
        }
        labels.push({ lo, hi, at: body.length, line: t.line })
      } else if (this.eat('default')) {
        this.expect(':', "':' after default")
        if (labels.some((l) => l.lo === undefined)) this.fail('a switch can have only one default', t)
        labels.push({ at: body.length, line: t.line })
      } else body.push(this.stmt())
    }
    const end = this.next()
    return { k: 'switch', e, body, labels, line, endLine: end.line }
  }

  declStmt(): Stmt {
    const line = this.peek().line
    const base = this.typeSpec()
    const isStatic = this.sawStatic
    if (this.eat(';')) return { k: 'empty', line }
    const decls = [this.finishDecl(this.declarator(), base)]
    while (this.eat(',')) decls.push(this.finishDecl(this.declarator(), base))
    this.expect(';')
    if (isStatic) for (const d of decls) d.isStatic = true
    return { k: 'decl', decls, line }
  }

  exprStmt(): Stmt {
    const line = this.peek().line
    const e = this.expr()
    this.expect(';')
    return { k: 'expr', e, line }
  }

  /* ---------- expressions ---------- */
  expr(): Expr {
    const start = this.peek()
    let e = this.assign()
    while (this.eat(',')) {
      const r = this.assign()
      e = this.mk(start, { k: 'comma', l: e, r })
    }
    return e
  }

  assign(): Expr {
    const start = this.peek()
    const l = this.cond()
    const t = this.peek()
    if (t.t === 'op' && ASSIGN_OPS.has(t.v)) {
      this.next()
      const r = this.assign()
      return this.mk(start, { k: 'assign', op: t.v, l, r })
    }
    return l
  }

  cond(): Expr {
    const start = this.peek()
    const c = this.bin(1)
    if (!this.eat('?')) return c
    const a = this.expr()
    this.expect(':', "':' in the ?: expression")
    const b = this.cond()
    return this.mk(start, { k: 'cond', c, a, b })
  }

  bin(min: number): Expr {
    const start = this.peek()
    let l = this.unary()
    for (;;) {
      const t = this.peek()
      const prec = t.t === 'op' ? BIN_PREC[t.v] : undefined
      if (prec === undefined || prec < min) return l
      this.next()
      const r = this.bin(prec + 1)
      l = this.mk(start, { k: 'bin', op: t.v, l, r })
    }
  }

  unary(): Expr {
    const start = this.peek()
    if (start.t === 'op') {
      if (start.v === '++' || start.v === '--') {
        this.next()
        return this.mk(start, { k: 'incdec', op: start.v, prefix: true, e: this.unary() })
      }
      if (['-', '+', '!', '~', '*', '&'].includes(start.v)) {
        this.next()
        return this.mk(start, { k: 'unary', op: start.v, e: this.unary() })
      }
      if (start.v === '(' && this.isTypeStart(1)) {
        this.next()
        const t = this.typeName()
        this.expect(')')
        return this.mk(start, { k: 'cast', t, e: this.unary() })
      }
    }
    if (this.eat('sizeof')) {
      if (this.is('(') && this.isTypeStart(1)) {
        this.next()
        const t = this.typeName()
        this.expect(')')
        return this.mk(start, { k: 'sizeof', t })
      }
      return this.mk(start, { k: 'sizeof', e: this.unary() })
    }
    return this.postfix()
  }

  typeName(): CType {
    const line = this.peek().line
    const base = this.typeSpec()
    const d = this.declarator()
    if (d.name) this.fail(`unexpected name ${d.name} inside a type`)
    const t = d.wrap(base)
    if (t.k === 'array' && t.n < 0) throw new SyntaxErr(line, 'a type in a cast or sizeof needs an array size')
    return t
  }

  postfix(): Expr {
    const start = this.peek()
    let e = this.primary()
    for (;;) {
      if (this.eat('[')) {
        const i = this.expr()
        this.expect(']')
        e = this.mk(start, { k: 'index', e, i })
      } else if (this.is('(')) {
        if (e.k !== 'id') this.fail('only named functions can be called (function pointers are not supported)')
        this.next()
        const args: Expr[] = []
        if (!this.eat(')')) {
          do args.push(this.assign())
          while (this.eat(','))
          this.expect(')', "')' to close the call")
        }
        e = this.mk(start, { k: 'call', name: e.name, args })
      } else if (this.is('.') || this.is('->')) {
        const arrow = this.next().v === '->'
        const name = this.ident('a member name')
        e = this.mk(start, { k: 'member', e, name, arrow })
      } else if (this.is('++') || this.is('--')) {
        const op = this.next().v
        e = this.mk(start, { k: 'incdec', op, prefix: false, e })
      } else return e
    }
  }

  primary(): Expr {
    const t = this.next()
    switch (t.t) {
      case 'num':
        return this.mk(t, { k: 'num', v: t.n, float: t.float })
      case 'chr':
        return this.mk(t, { k: 'chr', v: t.n })
      case 'str':
        return this.mk(t, { k: 'str', v: t.v })
      case 'id': {
        const ev = this.enums.get(t.v)
        if (ev !== undefined) return this.mk(t, { k: 'num', v: ev, float: false })
        return this.mk(t, { k: 'id', name: t.v })
      }
      case 'op':
        if (t.v === '(') {
          const e = this.expr()
          this.expect(')')
          // keep the parentheses in the text so descriptions read like the source
          return { ...e, text: this.src.slice(t.pos, this.last.end) }
        }
        if (t.v === '{') this.fail('a brace list {...} is only allowed when a variable is declared (L05A p7)', t)
    }
    return this.fail(`expected a value but found ${this.found(t)}`, t)
  }
}

/**
 * L04C p11: calling a function before any prototype or definition makes the compiler assume it
 * returns int. If the definition met later returns something else, the program does not compile
 * ("conflicting types"). An int function only gets the implicit-declaration warning (at run time).
 */
function checkImplicitDecls(prog: Program) {
  const calls: { name: string; line: number }[] = []
  const walk = (x: unknown): void => {
    if (!x || typeof x !== 'object') return
    if (Array.isArray(x)) return x.forEach(walk)
    const o = x as Record<string, unknown>
    if (o.k === 'call' && typeof o.name === 'string') calls.push({ name: o.name, line: o.line as number })
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
  }
  walk(prog.globals)
  for (const f of Object.values(prog.funcs)) walk(f.body)
  for (const c of calls.sort((a, b) => a.line - b.line)) {
    const fn = prog.funcs[c.name]
    const proto = prog.protos[c.name]
    if (!fn || fn.line <= c.line || (proto !== undefined && proto <= c.line) || fn.ret.k === 'int') continue
    throw new SyntaxErr(
      fn.line,
      `conflicting types for ${c.name}: line ${c.line} calls it before it is declared, so the compiler assumed it returns int, but here it is defined with another return type. Add a prototype above main (L04C p10-11)`,
    )
  }
}
