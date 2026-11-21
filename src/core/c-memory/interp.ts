/** Tree-walking interpreter over real bytes. One recorded frame per statement, condition, call and return. */
import type { CaseLabel, Expr, FuncDef, Program, Stmt, VarDecl } from './ast'
import { Memory, RuntimeErr, showChar, showScalar, type Region } from './memory'
import type { CError } from './parser'
import { formatPrintf } from './printf'
import {
  alignOf, arr, hex, isArith, isFloating, LayoutError, ptr, sameType, sizeOf, typeName,
  T_CHAR, T_DOUBLE, T_FLOAT, T_INT, T_VOID, type CMemConfig, type CType, type Explain, type Layout,
} from './types'
import { FrameBuilder, type RunError, type StepKind, type TraceFrame } from './view'

export type Val = { t: CType; n: number; raw?: { bytes: Uint8Array; init: Uint8Array } }
type LV = { addr: number; t: CType }

class BreakSig {}
class ContinueSig {}
class ReturnSig {
  v?: Val
  line: number
  constructor(v: Val | undefined, line: number) {
    this.v = v
    this.line = line
  }
}

type CallFrame = {
  id: number
  fn: FuncDef
  scopes: Map<string, Region>[]
  marks: number[]
  callLine: number | null
  returning: boolean
  /** Lowest address of this function's activation record: room is kept for every local it declares (L04D p4). */
  limit: number
}

/** Deepest call stack the tracer allows (enough for a recursion over 100 elements). */
const MAX_DEPTH = 128
/** Largest variable or heap block (in cells / bytes): every cell is drawn in every frame, so this bounds memory. */
const MAX_CELLS = 1024
const cellCount = (t: CType, L: Layout): number =>
  t.k === 'array' ? t.n * cellCount(t.of, L) : t.k === 'struct' ? L.structs[t.tag].members.reduce((a, m) => a + cellCount(m.type, L), 0) : 1
/** Library functions the tracer knows, with their return types (stdio.h, string.h, stdlib.h, math.h). */
const BUILTIN_RET: Record<string, CType> = {
  printf: T_INT, scanf: T_INT, puts: T_INT, putchar: T_INT, getchar: T_INT, fgets: ptr(T_CHAR),
  strlen: T_INT, strcmp: T_INT, strncmp: T_INT, strcpy: ptr(T_CHAR), strncpy: ptr(T_CHAR), strcat: ptr(T_CHAR),
  malloc: ptr(T_VOID), free: T_VOID, abs: T_INT, sqrt: T_DOUBLE, pow: T_DOUBLE, fabs: T_DOUBLE,
  toupper: T_INT, tolower: T_INT, isupper: T_INT, islower: T_INT, isalpha: T_INT, isdigit: T_INT, isspace: T_INT,
}
const NOT_SUPPORTED: Record<string, string> = {
  gets: 'gets is not supported (and should never be used, L05B p5); use fgets(str, size, stdin)',
}

export class Interp {
  prog: Program
  cfg: CMemConfig
  L: Layout
  mem: Memory
  globals = new Map<string, Region>()
  frames: CallFrame[] = []
  out = ''
  trace: TraceFrame[] = []
  warnings: CError[] = []
  error?: RunError
  private builder = new FrameBuilder()
  private notes: string[] = []
  private whys: Explain[] = []
  private line = 0
  private sp: number
  private gp: number
  private hp: number
  private lp: number
  private frameNo = 0
  private heapNo = 0
  private literals = new Map<Expr, Region>()
  /** Static locals, created the first time their declaration runs and kept for the whole run. */
  private statics = new Map<VarDecl, Region>()
  /** Next unread character of cfg.stdin. */
  private inPos = 0
  private reserve = new Map<FuncDef, number>()
  /** The whole expression of the current statement: a postfix ++ there has its value thrown away. */
  private stmtExpr?: Expr

  constructor(prog: Program, cfg: CMemConfig) {
    this.prog = prog
    this.cfg = cfg
    this.L = { structs: prog.structs, ptrSize: cfg.pointerSize }
    this.mem = new Memory(cfg.endian, this.L)
    this.sp = cfg.stackTop
    this.gp = cfg.globalBase
    this.hp = cfg.heapBase
    this.lp = cfg.literalBase
  }

  run() {
    try {
      for (const g of this.prog.globals) this.exec(g)
      const main = this.prog.funcs.main
      if (main.params.length) this.warn(main.line, 'main takes no parameters here; they are ignored')
      // a stand-in 0 / NULL per parameter, so main(int argc, char *argv[]) still runs
      const fake = main.params.map(() => ({ k: 'num' as const, v: 0, float: false, line: main.line, text: '0' }))
      this.call(main, main.params.map((p) => ({ t: p.type, n: 0 })), { k: 'call', name: 'main', args: fake, line: main.line, text: 'main()' })
    } catch (e) {
      let err: RuntimeErr
      if (e instanceof RuntimeErr) err = e
      else if (e instanceof LayoutError) err = new RuntimeErr('type', e.message)
      else if (e instanceof BreakSig || e instanceof ContinueSig) err = new RuntimeErr('type', 'break or continue is used outside a loop')
      else throw e
      this.error = { line: this.line, message: `line ${this.line}: ${err.message}`, kind: err.kind, ...(err.cite ? { cite: err.cite } : {}) }
      this.record(this.line, 'error', err.message + (err.cite ? ` (${err.cite})` : ''), true)
    }
  }

  /* ---------- recording ---------- */

  private record(line: number, kind: StepKind, description?: string, force = false) {
    if (!force && this.trace.length >= this.cfg.maxSteps)
      throw new RuntimeErr('limit', `stopped after ${this.cfg.maxSteps} steps. The program may never finish (check the loop condition)`)
    const text = description ?? (this.notes.join('; ') || 'nothing in memory changes')
    this.trace.push(
      this.builder.build(this, {
        index: this.trace.length,
        line,
        kind,
        description: text,
        whys: this.whys,
        ...(kind === 'error' && this.error ? { error: this.error } : {}),
      }),
    )
    this.notes = []
    this.whys = []
    this.mem.writes = []
    this.mem.overruns = []
  }

  private note(s: string) {
    this.notes.push(s)
  }
  private why(w: Explain) {
    if (!this.whys.some((x) => x.rule === w.rule && x.working === w.working)) this.whys.push(w)
  }
  private warn(line: number, message: string) {
    this.warnings.push({ line, message: `line ${line}: ${message}` })
  }
  private tn(t: CType) {
    return typeName(t, this.L)
  }
  private size(t: CType) {
    return sizeOf(t, this.L)
  }
  private show(v: Val) {
    return v.raw ? '(a struct)' : showScalar(v.t, v.n, this.L.ptrSize)
  }

  /* ---------- scopes and allocation ---------- */

  private get top(): CallFrame | undefined {
    return this.frames[this.frames.length - 1]
  }

  private lookup(name: string): Region | undefined {
    const f = this.top
    if (f) for (let i = f.scopes.length - 1; i >= 0; i--) {
      const r = f.scopes[i].get(name)
      if (r) return r
    }
    return this.globals.get(name)
  }

  private pushScope() {
    const f = this.top!
    f.scopes.push(new Map())
    f.marks.push(this.sp)
  }

  private popScope() {
    const f = this.top!
    for (const r of f.scopes.pop()!.values()) if (r.kind === 'stack') this.mem.remove(r)
    this.sp = f.marks.pop()!
  }

  /** Bytes to keep for every local a function declares (block scopes may reuse them; this is an upper bound). */
  private localsSize(fn: FuncDef): number {
    let n = this.reserve.get(fn)
    if (n !== undefined) return n
    n = 0
    const walk = (s?: Stmt): void => {
      if (!s) return
      switch (s.k) {
        case 'decl':
          for (const d of s.decls)
            if (!d.isStatic)
              try {
                n! += this.size(d.type) + alignOf(d.type, this.L) - 1
              } catch {
                // a bad type is reported when the declaration runs
              }
          return
        case 'block':
        case 'switch':
          return s.body.forEach(walk)
        case 'if':
          walk(s.then)
          return walk(s.else)
        case 'while':
        case 'do':
          return walk(s.body)
        case 'for':
          walk(s.init)
          return walk(s.body)
      }
    }
    walk(fn.body)
    this.reserve.set(fn, n)
    return n
  }

  /** staticIn: a static local of that function, stored with the globals but named only in its block. */
  private alloc(name: string, t: CType, line: number, staticIn?: string): Region {
    const f = this.top
    const scope = f ? f.scopes[f.scopes.length - 1] : this.globals
    if (scope.has(name)) throw new RuntimeErr('type', `${name} is already declared in this block`)
    const size = this.size(t)
    const cells = cellCount(t, this.L)
    if (cells > MAX_CELLS)
      throw new RuntimeErr('unsupported', `${name} has ${cells} cells; the tracer draws every cell at every step, so one variable can have at most ${MAX_CELLS}`)
    const align = alignOf(t, this.L)
    if (!f || staticIn) {
      const addr = Math.ceil(this.gp / align) * align
      const r = this.mem.add(
        {
          name, kind: 'global', addr, size, type: t, line,
          addrWhy: {
            rule: staticIn
              ? `A static local is stored with the globals (upward from ${hex(this.cfg.globalBase)}), not in the frame of ${staticIn}, so it lasts for the whole run; this layout is the tracer's assumption`
              : `Globals are placed one after another upward from ${hex(this.cfg.globalBase)} (the MIPS data segment); this layout is the tracer's assumption`,
            working: addr === this.gp ? `next free address ${hex(addr)}` : `${hex(this.gp)} rounded up to a multiple of ${align} = ${hex(addr)}`,
            ...(staticIn ? { cite: 'L04D p18' } : {}),
          },
          ...(staticIn ? { staticIn } : {}),
        },
        true,
      )
      this.gp = addr + size
      scope.set(name, r)
      return r
    }
    const prev = this.sp
    const addr = Math.floor((prev - size) / align) * align
    this.sp = addr
    const r = this.mem.add(
      {
        name, kind: 'stack', addr, size, type: t, line, frameId: f.id,
        addrWhy: {
          rule: 'Each new local sits just below the one declared before it (the stack grows down), rounded down to a multiple of its alignment',
          working: `${hex(prev)} - ${size} = ${hex(prev - size)}${addr !== prev - size ? `, rounded down to a multiple of ${align}: ${hex(addr)}` : ''}`,
          cite: 'L04D p15',
        },
      },
      false,
    )
    scope.set(name, r)
    return r
  }

  /* ---------- statements ---------- */

  private exec(s: Stmt): void {
    this.line = s.line
    switch (s.k) {
      case 'decl':
        for (const d of s.decls) this.declare(d)
        this.record(s.line, 'decl')
        return
      case 'expr':
        this.stmtExpr = s.e
        this.rv(s.e)
        this.record(
          s.line,
          'expr',
          this.notes.length ? undefined : s.e.k === 'call' ? `back in ${this.top?.fn.name}: the call ${s.e.text} has finished` : `${s.e.text} is worked out; nothing in memory changes`,
        )
        return
      case 'if': {
        const v = this.test(s.c)
        this.condStep(s.c, v, v ? 'the if branch runs' : s.else ? 'the else branch runs' : 'the if body is skipped')
        if (v) this.exec(s.then)
        else if (s.else) this.exec(s.else)
        return
      }
      case 'while':
        for (;;) {
          this.line = s.line
          const v = this.test(s.c)
          this.condStep(s.c, v, v ? 'the loop body runs' : 'the loop ends')
          if (!v || this.loopBody(s.body) === 'break') return
        }
      case 'do':
        for (;;) {
          if (this.loopBody(s.body) === 'break') return
          this.line = s.condLine
          const v = this.test(s.c)
          this.condStep(s.c, v, v ? 'the body runs again' : 'the loop ends', s.condLine)
          if (!v) return
        }
      case 'for':
        return this.scoped(() => {
          if (s.init) this.exec(s.init)
          for (;;) {
            this.line = s.line
            if (s.c) {
              const v = this.test(s.c)
              this.condStep(s.c, v, v ? 'the loop body runs' : 'the loop ends')
              if (!v) return
            }
            if (this.loopBody(s.body) === 'break') return
            if (s.step) {
              this.line = s.line
              this.stmtExpr = s.step
              this.rv(s.step)
              this.record(s.line, 'expr')
            }
          }
        })
      case 'return': {
        const v = s.e ? this.rv(s.e) : undefined
        throw new ReturnSig(v, s.line)
      }
      case 'switch':
        return this.switchStmt(s)
      case 'break':
        this.record(s.line, 'jump', 'break leaves the innermost loop or switch')
        throw new BreakSig()
      case 'continue':
        this.record(s.line, 'jump', 'continue skips the rest of this pass of the innermost loop')
        throw new ContinueSig()
      case 'block':
        return this.scoped(() => {
          for (const x of s.body) this.exec(x)
        })
      case 'empty':
        return
    }
  }

  /** L02C p4-5: jump to the matching case (or default), then run on until a break or the end of the block. */
  private switchStmt(s: Stmt & { k: 'switch' }) {
    const v = this.rv(s.e)
    if (v.raw || v.t.k === 'ptr' || isFloating(v.t))
      throw new RuntimeErr('type', `the switch value ${s.e.text} must be a whole number (an int or a char), not ${v.raw ? 'a struct' : this.tn(v.t)}`, 'L02C p4')
    const label = (l: CaseLabel) => (l.lo === undefined ? 'default' : l.hi !== l.lo ? `case ${l.lo} ... ${l.hi}` : `case ${l.lo}`)
    const hit = s.labels.find((l) => l.lo !== undefined && v.n >= l.lo && v.n <= l.hi!) ?? s.labels.find((l) => l.lo === undefined)
    this.note(
      hit
        ? `${s.e.text} is ${v.n}, so the switch jumps to ${label(hit)} (line ${hit.line})`
        : `${s.e.text} is ${v.n}; no case matches and there is no default, so the whole switch is skipped`,
    )
    this.record(s.line, 'cond')
    if (!hit) return
    try {
      this.scoped(() => {
        for (let i = hit.at; i < s.body.length; i++) {
          const passed = i > hit.at ? s.labels.filter((l) => l.at === i) : []
          if (passed.length)
            this.why({ rule: `There is no break before ${passed.map(label).join(' and ')}, so execution falls through into it`, cite: 'L02C p4-5' })
          this.exec(s.body[i])
        }
      })
    } catch (e) {
      if (!(e instanceof BreakSig)) throw e
    }
  }

  /** Run in a new block scope. On a runtime error the scope stays, so the error frame shows memory as it was. */
  private scoped(body: () => void) {
    this.pushScope()
    try {
      body()
    } catch (e) {
      if (e instanceof BreakSig || e instanceof ContinueSig || e instanceof ReturnSig) this.popScope()
      throw e
    }
    this.popScope()
  }

  private loopBody(body: Stmt): 'break' | 'next' {
    try {
      this.exec(body)
    } catch (e) {
      if (e instanceof BreakSig) return 'break'
      if (!(e instanceof ContinueSig)) throw e
    }
    return 'next'
  }

  private test(c: Expr): boolean {
    const v = this.rv(c)
    if (v.raw) throw new RuntimeErr('type', `${c.text} is a struct, which cannot be used as a condition`)
    return v.n !== 0
  }

  private condStep(c: Expr, v: boolean, then: string, line = this.line) {
    this.note(`${c.text} is ${v ? 'true (1)' : 'false (0)'}, so ${then}`)
    this.record(line, 'cond')
  }

  /* ---------- declarations and initialisers ---------- */

  private declare(d: VarDecl) {
    this.line = d.line
    const f = this.top
    if (d.isStatic && f) {
      const old = this.statics.get(d)
      if (old) {
        f.scopes[f.scopes.length - 1].set(d.name, old)
        const v = isArith(d.type) || d.type.k === 'ptr' ? `, ${this.show(this.load({ addr: old.addr, t: d.type }))},` : ''
        this.note(`${d.name} is static, so it still exists at ${hex(old.addr)} and keeps its value${v} from the last call; its initialiser does not run again`)
        this.why({ rule: 'A static local is created and initialised once, and keeps its value between calls', cite: 'L04D p18; R02 p43' })
        return
      }
    }
    const r = this.alloc(d.name, d.type, d.line, d.isStatic && f ? f.fn.name : undefined)
    if (d.isStatic && f) {
      this.statics.set(d, r)
      this.why({ rule: 'A static local is created and initialised once, and keeps its value between calls', cite: 'L04D p18; R02 p43' })
    }
    const where = `${d.name} (${this.tn(d.type)}, ${r.size} byte${r.size === 1 ? '' : 's'}) is created at ${hex(r.addr)}${r.staticIn ? ` with the globals (static, so it outlives each call of ${r.staticIn})` : ''}`
    if (!d.init) {
      this.note(r.kind === 'global' ? `${where}; ${r.staticIn ? 'statics' : 'globals'} start as 0` : `${where} with no value yet (garbage)`)
      return
    }
    if (d.type.k === 'struct' && d.init.k !== 'init') {
      this.store({ addr: r.addr, t: d.type }, this.coerce(this.rv(d.init), d.type, d.name))
      this.note(`${where} as a copy of ${d.init.text} (every member)`)
      this.why({ rule: 'Assigning a struct copies all its members, arrays inside it included', cite: 'L05C p12' })
      return
    }
    if (d.type.k === 'array' || d.type.k === 'struct') {
      // aggregates: missing values become 0 (L05A p7)
      r.init.fill(1)
      r.bytes.fill(0)
      this.initAggregate(r.addr, d.type, d.init, d.name)
      const short = d.init.k === 'init' && d.type.k === 'array' && d.init.items.length < d.type.n
      this.note(`${where} from ${d.init.text}${short ? '; the missing values become 0' : ''}`)
      return
    }
    const init = d.init.k === 'init' ? d.init.items[0] : d.init
    if (!init) throw new RuntimeErr('type', `the initialiser for ${d.name} is empty`)
    const v = this.coerce(this.rv(init), d.type, d.name)
    this.store({ addr: r.addr, t: d.type }, v)
    const to = d.type.k === 'ptr' && v.n ? this.mem.nameAt(v.n, d.type.to.k === 'void' ? undefined : this.size(d.type.to)) : undefined
    this.note(d.type.k === 'ptr' ? (v.n ? `${where}, pointing to ${to ?? hex(v.n)}` : `${where} as NULL`) : `${where} with value ${this.show(v)}`)
  }

  private initAggregate(addr: number, t: CType, e: Expr, name: string) {
    if (t.k === 'array' && t.of.k === 'char' && e.k === 'str') {
      const s = e.v
      if (s.length > t.n) this.warn(e.line, `"${s}" has ${s.length} characters, more than ${name} can hold (${t.n}); the extra ones are dropped`)
      else if (s.length === t.n) this.warn(e.line, `${name} has room for the ${t.n} characters of "${s}" but not the '\\0', so it is not a proper string (L05B p4)`)
      const bytes = Uint8Array.from([...s.slice(0, t.n)].map((c) => c.charCodeAt(0)))
      this.mem.writeBytes(addr, bytes)
      return
    }
    if (e.k !== 'init') {
      if (t.k === 'array') throw new RuntimeErr('type', `${name} is an array, so it needs a {...} list${t.of.k === 'char' ? ' or a string' : ''} to start with`)
      const v = this.rv(e)
      if (t.k === 'struct') this.assignInto({ addr, t }, v, name, name)
      else this.store({ addr, t }, this.coerce(v, t, name))
      return
    }
    if (t.k === 'array' || t.k === 'struct') {
      const used = this.initList(addr, t, e.items, 0, name)
      if (used < e.items.length)
        this.warn(
          e.line,
          t.k === 'array'
            ? `excess elements in the initialiser for ${name} (it holds ${t.n}); the extra ones are ignored (L05A p7)`
            : `excess values in the initialiser for ${name}; it has ${this.L.structs[t.tag].members.length} members`,
        )
      return
    }
    const first = e.items[0]
    if (first) this.store({ addr, t }, this.coerce(this.rv(first), t, name))
  }

  /**
   * Fill aggregate t from items[pos...] and return the next unused position. A plain value where a
   * row or struct is expected starts filling it without its own braces, so int m[2][2] = {1, 2, 3, 4} works.
   */
  private initList(addr: number, t: CType & { k: 'array' | 'struct' }, items: Expr[], pos: number, name: string): number {
    const subs =
      t.k === 'array'
        ? Array.from({ length: t.n }, (_, i) => ({ off: i * this.size(t.of), t: t.of, name: `${name}[${i}]` }))
        : this.L.structs[t.tag].members
            .slice(0, this.L.structs[t.tag].union ? 1 : undefined)
            .map((m) => ({ off: m.offset, t: m.type, name: `${name}.${m.name}` }))
    for (const s of subs) {
      const x = items[pos]
      if (!x) break
      const whole =
        x.k === 'init' ||
        (s.t.k === 'array' && s.t.of.k === 'char' && x.k === 'str') ||
        (s.t.k === 'struct' && this.typeOfSafe(x)?.k === 'struct')
      if ((s.t.k === 'array' || s.t.k === 'struct') && !whole) pos = this.initList(addr + s.off, s.t, items, pos, s.name)
      else {
        this.initAggregate(addr + s.off, s.t, x, s.name)
        pos++
      }
    }
    return pos
  }

  /* ---------- values ---------- */

  private load(l: LV): Val {
    const t = l.t
    if (t.k === 'array') return { t: ptr(t.of), n: l.addr }
    if (t.k === 'void') throw new RuntimeErr('type', 'a void * cannot be followed directly; cast it to the right pointer type first', 'R02 p18')
    if (t.k === 'struct') return { t, n: 0, raw: this.mem.readBytes(l.addr, this.size(t)) }
    return { t, n: this.mem.readScalar(l.addr, t) }
  }

  private store(l: LV, v: Val) {
    if (v.raw) this.mem.writeBytes(l.addr, v.raw.bytes, v.raw.init)
    else this.mem.writeScalar(l.addr, l.t, v.n)
    if (l.t.k === 'ptr') this.typeHeap(v.n, l.t)
  }

  /** A heap block takes the type of the first typed pointer that holds its start address. */
  private typeHeap(addr: number, t: CType) {
    if (t.k !== 'ptr' || t.to.k === 'void') return
    const r = this.mem.regions.find((x) => x.kind === 'heap' && x.alive && !x.typed && x.addr === addr)
    if (!r) return
    const es = this.size(t.to)
    if (r.size % es) return
    r.type = r.size === es ? t.to : arr(t.to, r.size / es)
    r.typed = true
  }

  private convNum(n: number, from: CType, to: CType): number {
    if (to.k === 'double') return n
    if (to.k === 'float') return Math.fround(n)
    const whole = isFloating(from) ? Math.trunc(n) : n
    if (isFloating(from) && whole !== n)
      this.why({ rule: `Storing a ${from.k} in an ${to.k} drops the fraction (truncation)`, working: `${n} becomes ${to.k === 'char' ? (whole << 24) >> 24 : whole | 0}`, cite: 'L02B p9' })
    return to.k === 'char' ? (whole << 24) >> 24 : whole | 0
  }

  /** Implicit conversion for assignment, initialisation, parameters and return values. */
  private coerce(v: Val, t: CType, what: string): Val {
    if (t.k === 'array') throw new RuntimeErr('type', `${what} is an array, and an array name cannot be assigned. Copy the elements one by one`, 'L05A p9')
    if (t.k === 'struct') {
      if (!v.raw || v.t.k !== 'struct' || v.t.tag !== t.tag) throw new RuntimeErr('type', `${what} is a ${this.tn(t)}, so it needs a ${this.tn(t)} value`)
      return v
    }
    if (v.raw) throw new RuntimeErr('type', `a struct cannot be stored in ${what} (${this.tn(t)})`)
    if (t.k === 'ptr') {
      if (v.t.k === 'ptr') {
        if (t.to.k !== 'void' && v.t.to.k !== 'void' && !sameType(t.to, v.t.to))
          this.warn(this.line, `${what} is ${this.tn(t)} but is given ${this.tn(v.t)} (incompatible pointer types)`)
        return { t, n: v.n }
      }
      if (v.t.k === 'int' && v.n === 0) return { t, n: 0 }
      throw new RuntimeErr('type', `${what} is a pointer (${this.tn(t)}), so it must hold an address, not the number ${this.show(v)}`)
    }
    if (t.k === 'void') return v
    if (v.t.k === 'ptr') throw new RuntimeErr('type', `${what} is a ${this.tn(t)}, so it cannot hold an address (${this.tn(v.t)})`, 'L04A p15')
    if (v.t.k === 'void') throw new RuntimeErr('type', `a void value cannot be stored in ${what}`)
    return { t, n: this.convNum(v.n, v.t, t) }
  }

  /** Store with a plain-English note of what changed. `text` is how the source names the target. */
  private assignInto(l: LV, v: Val, text: string, what: string) {
    const c = this.coerce(v, l.t, what)
    this.store(l, c)
    this.noteWrite(l, c, text)
    return c
  }

  private noteWrite(l: LV, v: Val, text: string) {
    const target = this.mem.nameAt(l.addr, this.size(l.t)) ?? hex(l.addr)
    const lhs = target === text ? text : `${text} (that is, ${target})`
    if (v.raw) {
      this.note(`${lhs} gets a copy of every member`)
      this.why({ rule: 'Assigning a struct copies all its members, arrays inside it included', cite: 'L05C p12' })
    } else if (l.t.k === 'ptr') {
      if (v.n === 0) this.note(`${lhs} is now NULL`)
      else {
        const pointee = this.mem.nameAt(v.n, l.t.to.k === 'void' ? undefined : this.size(l.t.to))
        this.note(`${lhs} now points to ${pointee ?? hex(v.n)}${pointee ? '' : ' (not inside any variable)'}`)
      }
    } else this.note(`${lhs} becomes ${this.show(v)}`)
  }

  private literal(e: Expr & { k: 'str' }): Region {
    let r = this.literals.get(e)
    if (!r) {
      const size = e.v.length + 1
      r = this.mem.add(
        {
          name: JSON.stringify(e.v), kind: 'literal', addr: this.lp, size, type: arr(T_CHAR, size), line: e.line, readonly: true,
          addrWhy: { rule: 'String literals live in a read-only area, kept apart from the stack (tracer assumption for the address)' },
        },
        true,
      )
      r.bytes.set([...e.v].map((c) => c.charCodeAt(0)))
      this.lp += size
      this.literals.set(e, r)
    }
    return r
  }

  /* ---------- expressions ---------- */

  rv(e: Expr): Val {
    switch (e.k) {
      case 'num':
        return e.float ? { t: T_DOUBLE, n: e.v } : { t: T_INT, n: e.v | 0 }
      case 'chr':
        return { t: T_INT, n: e.v }
      case 'str':
        return { t: ptr(T_CHAR), n: this.literal(e).addr }
      case 'id':
        // NULL is the null pointer constant from stdio.h (R02 p12)
        if (e.name === 'NULL' && !this.lookup('NULL')) return { t: ptr(T_VOID), n: 0 }
        // EOF from stdio.h: what scanf and getchar return at the end of the input
        if (e.name === 'EOF' && !this.lookup('EOF')) return { t: T_INT, n: -1 }
        if (e.name === 'stdin' && !this.lookup('stdin'))
          throw new RuntimeErr('unsupported', 'stdin can only be used as the last argument of fgets(str, size, stdin) here')
        return this.load(this.lv(e))
      case 'index':
      case 'member':
        return this.load(this.lv(e))
      case 'unary':
        return this.unary(e)
      case 'incdec':
        return this.incdec(e)
      case 'bin':
        return this.binary(e)
      case 'assign':
        return this.assign(e)
      case 'cond':
        return this.test(e.c) ? this.rv(e.a) : this.rv(e.b)
      case 'call':
        return this.callExpr(e)
      case 'cast': {
        const v = this.rv(e.e)
        if (e.t.k === 'void') return { t: T_VOID, n: 0 }
        if (e.t.k === 'ptr') {
          if (v.t.k !== 'ptr' && !(isArith(v.t) && !isFloating(v.t))) throw new RuntimeErr('type', `${e.e.text} cannot be cast to ${this.tn(e.t)}`)
          this.typeHeap(v.n, e.t)
          return { t: e.t, n: v.n >>> 0 }
        }
        if (!isArith(e.t)) throw new RuntimeErr('unsupported', `casting to ${this.tn(e.t)} is not supported`)
        if (v.raw) throw new RuntimeErr('type', 'a struct cannot be cast to a number')
        return { t: e.t, n: v.t.k === 'ptr' ? v.n : this.convNum(v.n, v.t, e.t) }
      }
      case 'sizeof': {
        const t = e.t ?? this.typeOf(e.e!)
        const n = this.size(t)
        this.why({ rule: `sizeof(${this.tn(t)}) is ${n}`, working: e.t ? undefined : `${e.e!.text} has type ${this.tn(t)}`, cite: 'L02A p26' })
        return { t: T_INT, n }
      }
      case 'init':
        throw new RuntimeErr('type', 'a {...} list is only allowed when a variable is declared', 'L05A p7')
      case 'comma': {
        // the left value is thrown away, so a postfix ++ there is a whole statement of its own
        const whole = this.stmtExpr === e
        if (whole) this.stmtExpr = e.l
        this.rv(e.l)
        if (whole) this.stmtExpr = e.r
        const v = this.rv(e.r)
        if (whole) this.stmtExpr = e
        return v
      }
    }
  }

  lv(e: Expr): LV {
    switch (e.k) {
      case 'id': {
        const r = this.lookup(e.name)
        if (!r) {
          if (this.prog.funcs[e.name]) throw new RuntimeErr('unsupported', `${e.name} is a function; using it as a value is not supported`)
          throw new RuntimeErr('type', `${e.name} is not declared here. C looks up names in the enclosing blocks and the globals only`, 'L04D p5')
        }
        return { addr: r.addr, t: r.type }
      }
      case 'unary':
        if (e.op === '*') {
          const p = this.deref(e.e)
          return { addr: p.n, t: (p.t as { to: CType }).to }
        }
        break
      case 'index': {
        const b = this.rv(e.e)
        const i = this.rv(e.i)
        const [p, k] = b.t.k === 'ptr' ? [b, i] : [i, b]
        if (p.t.k !== 'ptr' || !isArith(k.t) || isFloating(k.t)) throw new RuntimeErr('type', `${e.e.text} is not an array or pointer, so it cannot be indexed`)
        if (p.n === 0) throw new RuntimeErr('segfault', `${e.e.text} is NULL, so ${e.text} is a segmentation fault`, 'L04B p6')
        const to = p.t.to
        const es = this.size(to)
        const addr = p.n + k.n * es
        this.why({ rule: `${e.text} is *(${e.e.text} + ${e.i.text}): the address moves by index x sizeof(${this.tn(to)})`, working: `${hex(p.n)} + ${k.n} x ${es} = ${hex(addr)}`, cite: 'L05A p8' })
        // &a[3] is legal, so only remember the overrun; reading or writing there stops the run
        const owner = this.mem.locate(p.n)
        if (owner && (addr < owner.addr || addr >= owner.addr + owner.size))
          this.mem.overruns.push({ addr, text: e.text, owner: owner.name, count: Math.floor(owner.size / es) })
        return { addr, t: to }
      }
      case 'member': {
        let base: LV
        if (e.arrow) {
          const p = this.deref(e.e)
          base = { addr: p.n, t: (p.t as { to: CType }).to }
        } else base = this.lv(e.e)
        if (base.t.k !== 'struct')
          throw new RuntimeErr(
            'type',
            e.arrow ? `${e.e.text} does not point to a struct, so -> cannot pick a member` : `${e.e.text} is not a struct${base.t.k === 'ptr' ? ' but a pointer: use -> (p->m is (*p).m, L05D p10)' : ''}`,
            e.arrow ? undefined : 'L05D p10',
          )
        const def = this.L.structs[base.t.tag]
        const m = def.members.find((x) => x.name === e.name)
        if (!m) throw new RuntimeErr('type', `${def.display} has no member called ${e.name}`)
        return { addr: base.addr + m.offset, t: m.type }
      }
    }
    throw new RuntimeErr('type', `${e.text} is a value, not a place in memory, so it cannot be assigned to or have its address taken (L02B p7)`)
  }

  /** Evaluate a pointer about to be followed, with the course's segfault explanations. */
  private deref(e: Expr): Val {
    let p: Val
    try {
      p = this.rv(e)
    } catch (err) {
      if (err instanceof RuntimeErr && err.kind === 'uninit' && e.k === 'id' && this.lookup(e.name)?.type.k === 'ptr')
        throw new RuntimeErr('segfault', `${e.name} has no value yet, so it points to an unknown place. Following it gives a segmentation fault`, 'L04B p6')
      throw err
    }
    if (p.t.k !== 'ptr') throw new RuntimeErr('type', `${e.text} is not a pointer, so * cannot follow it`)
    if (p.t.to.k === 'void') throw new RuntimeErr('type', `${e.text} is a void *; cast it to the right pointer type before following it`, 'R02 p18')
    if (p.n === 0) throw new RuntimeErr('segfault', `${e.text} is NULL, so following it gives a segmentation fault`, 'R02 p12')
    return p
  }

  private unary(e: Expr & { k: 'unary' }): Val {
    if (e.op === '&') {
      // &a[n] (one past the end) is a legal address; only reading or writing there is an overrun
      const mark = this.mem.overruns.length
      const l = this.lv(e.e)
      this.mem.overruns.length = mark
      return { t: ptr(l.t), n: l.addr }
    }
    if (e.op === '*') return this.load(this.lv(e))
    const v = this.rv(e.e)
    if (v.raw) throw new RuntimeErr('type', `${e.op} cannot be used on a struct`)
    if (e.op === '!') return { t: T_INT, n: v.n === 0 ? 1 : 0 }
    if (v.t.k === 'ptr') throw new RuntimeErr('type', `${e.op} cannot be used on a pointer`)
    const t = isFloating(v.t) ? v.t : T_INT
    if (e.op === '~') {
      if (isFloating(t)) throw new RuntimeErr('type', '~ needs an int')
      return { t, n: ~v.n }
    }
    return { t, n: e.op === '-' ? (isFloating(t) ? -v.n : -v.n | 0) : v.n }
  }

  private movePtr(p: Val, k: number, text: string): Val {
    const to = (p.t as { to: CType }).to
    if (to.k === 'void') throw new RuntimeErr('type', 'pointer arithmetic on a void * is not allowed; cast it first', 'R02 p18')
    const es = this.size(to)
    const n = p.n + k * es
    this.why({
      rule: `Adding k to a ${this.tn(p.t)} moves it by k x sizeof(${this.tn(to)}) = k x ${es} bytes`,
      working: `${text}: ${hex(p.n)} ${k < 0 ? '-' : '+'} ${Math.abs(k)} x ${es} = ${hex(n)}`,
      cite: 'L04B p5',
    })
    return { t: p.t, n }
  }

  private incdec(e: Expr & { k: 'incdec' }): Val {
    const l = this.lv(e.e)
    const old = this.load(l)
    if (old.raw || l.t.k === 'array') throw new RuntimeErr('type', `${e.op} cannot be used on ${e.e.text}`, l.t.k === 'array' ? 'L05A p9' : undefined)
    const d = e.op === '++' ? 1 : -1
    const nv = old.t.k === 'ptr' ? this.movePtr(old, d, e.text) : { t: old.t, n: this.convNum(old.n + d, old.t, old.t) }
    this.store(l, nv)
    this.noteWrite(l, nv, e.e.text)
    if (!e.prefix && e !== this.stmtExpr) {
      const was = old.t.k === 'ptr' ? this.mem.nameAt(old.n, this.size((old.t as { to: CType }).to)) : undefined
      this.notes[this.notes.length - 1] += ` (${e.text} itself gives the old value ${this.show(old)}${was ? `, the address of ${was}` : ''})`
    }
    return e.prefix ? nv : old
  }

  private assign(e: Expr & { k: 'assign' }): Val {
    const l = this.lv(e.l)
    if (l.t.k === 'array') throw new RuntimeErr('type', `${e.l.text} is an array, and an array name cannot be assigned. Copy the elements one by one`, 'L05A p9')
    let v = this.rv(e.r)
    if (e.op !== '=') v = this.arith(e.op.slice(0, -1), this.load(l), v, e)
    return this.assignInto(l, v, e.l.text, e.l.text)
  }

  private binary(e: Expr & { k: 'bin' }): Val {
    if (e.op === '&&' || e.op === '||') {
      const a = this.test(e.l)
      if (a === (e.op === '||')) {
        this.why({ rule: `${e.op} stops early: ${e.l.text} already decides the result, so ${e.r.text} is not evaluated (short circuit)`, cite: 'L02C p18' })
        return { t: T_INT, n: a ? 1 : 0 }
      }
      return { t: T_INT, n: this.test(e.r) ? 1 : 0 }
    }
    return this.arith(e.op, this.rv(e.l), this.rv(e.r), e)
  }

  private arith(op: string, a: Val, b: Val, e: Expr): Val {
    if (a.raw || b.raw) throw new RuntimeErr('type', `${op} cannot be used on a struct`)
    const pa = a.t.k === 'ptr'
    const pb = b.t.k === 'ptr'
    const whole = (v: Val) => isArith(v.t) && !isFloating(v.t)
    if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      const x = a.n
      const y = b.n
      const r = op === '==' ? x === y : op === '!=' ? x !== y : op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y
      return { t: T_INT, n: r ? 1 : 0 }
    }
    if (pa || pb) {
      if (op === '+' && pa && whole(b)) return this.movePtr(a, b.n, e.text)
      if (op === '+' && pb && whole(a)) return this.movePtr(b, a.n, e.text)
      if (op === '-' && pa && whole(b)) return this.movePtr(a, -b.n, e.text)
      if (op === '-' && pa && pb) {
        const es = this.size((a.t as { to: CType }).to)
        const n = (a.n - b.n) / es
        this.why({ rule: 'Subtracting two pointers gives the number of elements between them', working: `(${hex(a.n)} - ${hex(b.n)}) / ${es} = ${n}`, cite: 'L04B p5' })
        return { t: T_INT, n }
      }
      throw new RuntimeErr('type', `${op} cannot be used with a pointer here (${e.text})`)
    }
    const float = isFloating(a.t) || isFloating(b.t)
    const t: CType = a.t.k === 'double' || b.t.k === 'double' ? T_DOUBLE : float ? T_FLOAT : T_INT
    const x = a.n
    const y = b.n
    if (float) {
      const r = op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : op === '/' ? x / y : NaN
      if (Number.isNaN(r) && !['+', '-', '*', '/'].includes(op)) throw new RuntimeErr('type', `${op} needs int operands, not ${t.k}`)
      return { t, n: t.k === 'float' ? Math.fround(r) : r }
    }
    if ((op === '/' || op === '%') && y === 0) throw new RuntimeErr('div0', `${e.text} divides by zero`)
    let n: number
    switch (op) {
      case '+': n = (x + y) | 0; break
      case '-': n = (x - y) | 0; break
      case '*': n = Math.imul(x, y); break
      case '/':
        n = Math.trunc(x / y) | 0
        if (x % y) this.why({ rule: 'int / int is integer division: the fraction is dropped', working: `${x} / ${y} = ${n}`, cite: 'L02B p9' })
        break
      case '%':
        n = x % y
        if (x < 0 && n) this.why({ rule: 'In C the remainder takes the sign of the dividend', working: `${x} % ${y} = ${n}`, cite: 'L02B p13' })
        break
      case '<<': n = x << y; break
      case '>>': n = x >> y; break
      case '&': n = x & y; break
      case '|': n = x | y; break
      case '^': n = x ^ y; break
      default: throw new RuntimeErr('unsupported', `operator ${op} is not supported`)
    }
    if ((op === '+' || op === '-' || op === '*') && n !== (op === '+' ? x + y : op === '-' ? x - y : x * y))
      this.why({ rule: "int is 32-bit two's complement: a result outside -2147483648 to 2147483647 wraps around", working: `${e.text} = ${n}`, cite: 'L03B p24' })
    return { t, n }
  }

  /** Static type of an expression, for sizeof (which does not evaluate its operand). */
  private typeOf(e: Expr): CType {
    const decay = (t: CType) => (t.k === 'array' ? ptr(t.of) : t)
    const pointee = (t: CType, text: string) => {
      const d = decay(t)
      if (d.k !== 'ptr') throw new RuntimeErr('type', `${text} is not a pointer`)
      return d.to
    }
    switch (e.k) {
      case 'num': return e.float ? T_DOUBLE : T_INT
      case 'chr': return T_INT
      case 'str': return arr(T_CHAR, e.v.length + 1)
      case 'id': {
        const r = this.lookup(e.name)
        if (!r && e.name === 'NULL') return ptr(T_VOID)
        if (!r && e.name === 'EOF') return T_INT
        if (!r) throw new RuntimeErr('type', `${e.name} is not declared here`, 'L04D p5')
        return r.type
      }
      case 'unary':
        if (e.op === '&') return ptr(this.typeOf(e.e))
        if (e.op === '*') return pointee(this.typeOf(e.e), e.e.text)
        if (e.op === '!') return T_INT
        return isFloating(this.typeOf(e.e)) ? this.typeOf(e.e) : T_INT
      case 'index': return pointee(this.typeOf(e.e), e.e.text)
      case 'member': {
        const b = e.arrow ? pointee(this.typeOf(e.e), e.e.text) : this.typeOf(e.e)
        const m = b.k === 'struct' ? this.L.structs[b.tag].members.find((x) => x.name === e.name) : undefined
        if (!m) throw new RuntimeErr('type', `${e.text} is not a struct member`)
        return m.type
      }
      case 'cast': return e.t
      case 'sizeof': return T_INT
      case 'call':
        return this.prog.funcs[e.name]?.ret ?? BUILTIN_RET[e.name] ?? T_INT
      case 'comma': return this.typeOf(e.r)
      case 'assign':
      case 'incdec': return this.typeOf(e.k === 'assign' ? e.l : e.e)
      case 'cond': return this.typeOf(e.a)
      case 'bin': {
        if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(e.op)) return T_INT
        const a = decay(this.typeOf(e.l))
        const b = decay(this.typeOf(e.r))
        if (a.k === 'ptr' && b.k === 'ptr') return T_INT
        if (a.k === 'ptr') return a
        if (b.k === 'ptr') return b
        return a.k === 'double' || b.k === 'double' ? T_DOUBLE : a.k === 'float' || b.k === 'float' ? T_FLOAT : T_INT
      }
      case 'init': return T_INT
    }
  }

  /* ---------- calls ---------- */

  private callExpr(e: Expr & { k: 'call' }): Val {
    const fn = this.prog.funcs[e.name]
    if (!fn) {
      if (NOT_SUPPORTED[e.name]) throw new RuntimeErr('unsupported', NOT_SUPPORTED[e.name])
      if (BUILTIN_RET[e.name]) return this.builtin(e)
      if (this.prog.protos[e.name]) throw new RuntimeErr('type', `${e.name} is declared (line ${this.prog.protos[e.name]}) but never defined`)
      throw new RuntimeErr(
        'unsupported',
        `${e.name} is not defined in this program (the library functions supported are ${Object.keys(BUILTIN_RET).join(', ')})`,
      )
    }
    if (fn.line > e.line && this.prog.protos[e.name] === undefined && !this.warnings.some((w) => w.message.includes(`${e.name} is called before`)))
      this.warn(e.line, `${e.name} is called before it is declared; add a prototype above main (L04C p10-11)`)
    if (e.args.length !== fn.params.length)
      throw new RuntimeErr('type', `${e.name} takes ${fn.params.length} value(s) but the call gives ${e.args.length}`)
    const args = e.args.map((a) => this.rv(a))
    return this.call(fn, args, e)
  }

  private call(fn: FuncDef, args: Val[], e: Expr & { k: 'call' }): Val {
    if (this.frames.length >= MAX_DEPTH) throw new RuntimeErr('limit', `more than ${MAX_DEPTH} calls are nested; the recursion may never stop`)
    const caller = this.top
    const values = fn.params.map((p, i) => this.coerce(args[i], p.type, p.name))
    const before = new Map(this.mem.regions.map((r) => [r, r.bytes.slice()] as const))
    // checked before the new frame exists, so names resolve in the caller's scope
    const arrayArg = e.args.some((a, i) => fn.params[i].type.k === 'ptr' && this.typeOfSafe(a)?.k === 'array')
    const frame: CallFrame = { id: ++this.frameNo, fn, scopes: [new Map()], marks: [this.sp], callLine: caller ? e.line : null, returning: false, limit: 0 }
    // the new frame starts below the caller's whole activation record, locals declared later included
    if (caller) this.sp = Math.min(this.sp, caller.limit)
    this.frames.push(frame)
    this.line = fn.line
    const copies: string[] = []
    fn.params.forEach((p, i) => {
      const r = this.alloc(p.name, p.type, fn.line)
      this.store({ addr: r.addr, t: p.type }, values[i])
      const a = e.args[i]
      if (p.type.k === 'ptr') {
        const to = values[i].n ? this.mem.nameAt(values[i].n, p.type.to.k === 'void' ? undefined : this.size(p.type.to)) : undefined
        const what = a.text.startsWith('&') ? `the address ${a.text}` : `${a.text} (the address ${this.show(values[i])})`
        copies.push(`${p.name} gets a copy of ${what}${to ? `, so ${p.name} points to ${to}` : ''}`)
      } else if (values[i].raw) {
        copies.push(`${p.name} gets a full copy of ${a.text} (every member)`)
        this.why({ rule: 'A struct argument is passed by value: the callee works on a copy', cite: 'L05D p6' })
      } else copies.push(`${p.name} gets a copy of ${a.text}${a.text === this.show(values[i]) ? '' : ` (${this.show(values[i])})`}`)
    })
    frame.limit = Math.floor((this.sp - this.localsSize(fn)) / 8) * 8
    if (caller) {
      this.why({ rule: 'C passes every argument by value: each parameter is a new local holding a copy', cite: 'L04D p3' })
      if (arrayArg)
        this.why({ rule: 'An array argument passes the address of its first element; the array itself is not copied', cite: 'L05A p11' })
    }
    this.record(
      fn.line,
      'call',
      caller
        ? `${e.text} is called: a new frame for ${fn.name} is created${copies.length ? `. ${copies.join('; ')}` : ''}`
        : 'main starts: its frame is created',
    )

    let ret: Val | undefined
    let retLine = fn.body.endLine
    try {
      this.exec(fn.body)
    } catch (sig) {
      if (!(sig instanceof ReturnSig)) throw sig
      ret = sig.v
      retLine = sig.line
    }
    this.line = retLine
    let out: Val = { t: T_VOID, n: 0 }
    if (fn.ret.k !== 'void') {
      if (!ret && fn.name !== 'main') throw new RuntimeErr('type', `${fn.name} reaches its end without returning a value`)
      out = ret ? this.coerce(ret, fn.ret, `the value ${fn.name} returns`) : { t: T_INT, n: 0 }
    }
    frame.returning = true
    const value = fn.ret.k === 'void' ? '' : ` ${this.show(out)}`
    let desc: string
    if (!caller) desc = `main returns${value}. The program ends`
    else {
      const changed = this.mem.regions
        .filter((r) => r.frameId !== frame.id && before.has(r) && r.bytes.some((b, i) => b !== before.get(r)![i]))
        .map((r) => r.name)
      desc =
        `${fn.name} returns${value} to ${caller.fn.name}; its frame and copies disappear. ` +
        (changed.length
          ? `Changed during the call: ${changed.join(', ')}`
          : `Nothing outside ${fn.name} changed: ${fn.params.length ? 'it only worked on its own copies' : 'it touched only its own locals'}`)
    }
    this.record(retLine, 'return', [...this.notes, desc].join('; '))
    for (const s of frame.scopes) for (const r of s.values()) if (r.kind === 'stack') this.mem.remove(r)
    this.sp = frame.marks[0]
    this.frames.pop()
    this.line = e.line
    return out
  }

  private typeOfSafe(e: Expr): CType | undefined {
    try {
      return this.typeOf(e)
    } catch {
      return undefined
    }
  }

  /** Read a NUL-terminated string, stopping with an error instead of running into other memory. */
  private cString(addr: number, who: string): string {
    if (addr === 0) throw new RuntimeErr('segfault', `${who} is given NULL instead of a string`, 'R02 p12')
    const r = this.mem.locate(addr)
    if (!r) this.mem.readBytes(addr, 1) // throws the right segfault or dangling error
    let s = ''
    for (let i = addr - r!.addr; i < r!.size; i++) {
      const at = r!.name + (r!.kind === 'literal' ? '' : `[${i}]`)
      if (!r!.init[i]) throw new RuntimeErr('uninit', `${at} has no value (garbage) before any '\\0', so ${who} reads garbage: the result is undefined`, 'L05B p13')
      if (r!.bytes[i] === 0) return s
      s += String.fromCharCode(r!.bytes[i])
    }
    throw new RuntimeErr('bounds', `there is no '\\0' inside ${r!.name}, so ${who} would run past its end into other memory: the result is undefined`, 'L05B p13')
  }

  /** scanf with %d %i %c %s %f %lf (and %e %g): reads cfg.stdin and writes through the addresses it is given. */
  private scanf(e: Expr & { k: 'call' }): Val {
    const f = e.args[0]
    if (!f || f.k !== 'str') throw new RuntimeErr('type', 'scanf needs a format string such as "%d"')
    const fmt = f.v
    const inp = this.cfg.stdin
    const isWs = (c: string | undefined) => c !== undefined && /\s/.test(c)
    const skipWs = () => {
      while (isWs(inp[this.inPos])) this.inPos++
    }
    let count = 0
    let ai = 1
    let eof = false
    const read: string[] = []
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i]
      if (isWs(c)) {
        skipWs()
        continue
      }
      if (c !== '%') {
        if (inp[this.inPos] !== c) break
        this.inPos++
        continue
      }
      const m = /^%(\*?)(\d*)(hh|h|ll|l|L)?([dicsfeg%])/.exec(fmt.slice(i))
      if (!m) throw new RuntimeErr('unsupported', `scanf conversion ${fmt.slice(i, i + 3)} is not supported (use %d %c %s %f or %lf)`)
      i += m[0].length - 1
      const [spec, star, width, len, conv] = m
      if (conv !== 'c') skipWs()
      if (conv === '%') {
        if (inp[this.inPos] !== '%') break
        this.inPos++
        continue
      }
      if (this.inPos >= inp.length) {
        eof = count === 0
        break
      }
      const rest = inp.slice(this.inPos, width ? this.inPos + Number(width) : undefined)
      const text =
        conv === 'c'
          ? rest.slice(0, width ? Number(width) : 1)
          : conv === 's'
            ? (/^\S+/.exec(rest)?.[0] ?? '')
            : conv === 'd' || conv === 'i'
              ? (/^[+-]?\d+/.exec(rest)?.[0] ?? '')
              : (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest)?.[0] ?? '')
      if (!text) break // the input does not fit the conversion: scanf stops here
      this.inPos += text.length
      if (star) continue
      const a = e.args[ai++]
      if (!a) throw new RuntimeErr('type', `scanf has more conversions than addresses: nothing is given for ${spec}`)
      const p = this.rv(a)
      // a literal 0 is the null pointer constant, so scanf("%d", 0) crashes like NULL does
      if (p.n === 0 && (p.t.k === 'ptr' || p.t.k === 'int'))
        throw new RuntimeErr('segfault', `${a.text} is NULL, so scanf writes through a NULL pointer (segmentation fault)`, 'R02 p12')
      if (p.t.k !== 'ptr') throw new RuntimeErr('type', `scanf needs the address of a variable, so write &${a.text}`)
      const to = p.t.to
      const wrote: CType = conv === 'd' || conv === 'i' ? T_INT : conv === 'c' || conv === 's' ? T_CHAR : len === 'l' || len === 'L' ? T_DOUBLE : T_FLOAT
      // warned before writing, since a wrong size can also run past the variable
      if (to.k !== 'void' && to.k !== wrote.k)
        this.warn(e.line, `${spec} writes a ${wrote.k} but ${a.text} points to ${this.tn(to)}${to.k === 'double' && wrote.k === 'float' ? '; use %lf for a double' : ''}`)
      if (conv === 'd' || conv === 'i') this.mem.writeScalar(p.n, T_INT, Number(text) | 0)
      else if (conv === 'c') this.mem.writeBytes(p.n, Uint8Array.from([...text].map((ch) => ch.charCodeAt(0) & 0xff)))
      else if (conv === 's') {
        const r = this.mem.locate(p.n)
        const room = r ? r.addr + r.size - p.n : 0
        if (r && text.length + 1 > room)
          throw new RuntimeErr('bounds', `scanf %s needs ${text.length + 1} bytes for "${text}" plus '\\0', but ${r.name} has only ${room}: buffer overflow`, 'L05B p9')
        this.mem.writeBytes(p.n, Uint8Array.from([...text, '\0'].map((ch) => ch.charCodeAt(0) & 0xff)))
      } else this.mem.writeScalar(p.n, wrote, Number(text))
      const at = this.mem.nameAt(p.n, conv === 's' ? 1 : this.size(wrote)) ?? hex(p.n)
      const dest = conv === 's' ? at.replace(/\[0\]$/, '') : at
      read.push(`${JSON.stringify(text)} into ${dest}`)
      count++
    }
    if (eof) this.note('the input is used up, so scanf returns -1 (EOF) and changes nothing')
    else this.note(read.length ? `scanf reads ${read.join(', ')} and returns ${count}` : 'scanf matches nothing and returns 0')
    if (count && fmt.includes('%s'))
      this.why({ rule: 'scanf %s skips leading spaces and stops at the next white space, so it reads one word', cite: 'L05B p5, p7' })
    return { t: T_INT, n: eof ? -1 : count }
  }

  private builtin(e: Expr & { k: 'call' }): Val {
    const need = (n: number) => {
      if (e.args.length !== n) throw new RuntimeErr('type', `${e.name} takes ${n} value(s) but is given ${e.args.length}`)
    }
    switch (e.name) {
      case 'printf': {
        if (!e.args.length) throw new RuntimeErr('type', 'printf needs a format string')
        const f = e.args[0]
        const fmt = f.k === 'str' ? f.v : this.cString(this.rv(f).n, 'printf')
        const args = e.args.slice(1).map((a) => {
          const v = this.rv(a)
          if (v.raw) throw new RuntimeErr('type', `printf cannot print a whole struct (${a.text}); print its members`)
          return v.t.k === 'float' ? { t: T_DOUBLE, n: v.n } : v.t.k === 'char' ? { t: T_INT, n: v.n } : v
        })
        const text = formatPrintf(fmt, args, (addr) => this.cString(addr, 'printf %s'), (m) => this.warn(e.line, m), this.cfg.pointerFormat)
        this.out += text
        this.note(`prints ${JSON.stringify(text)}`)
        return { t: T_INT, n: text.length }
      }
      case 'puts': {
        need(1)
        const text = this.cString(this.rv(e.args[0]).n, 'puts') + '\n'
        this.out += text
        this.note(`prints ${JSON.stringify(text)}`)
        this.why({ rule: 'puts prints the string and then a newline of its own', cite: 'L05B p5, p7' })
        return { t: T_INT, n: text.length }
      }
      case 'putchar': {
        need(1)
        const c = this.rv(e.args[0])
        if (!isArith(c.t) || isFloating(c.t)) throw new RuntimeErr('type', 'putchar needs a character (an int or a char)')
        const text = String.fromCharCode(c.n & 0xff)
        this.out += text
        this.note(`prints ${JSON.stringify(text)}`)
        return { t: T_INT, n: c.n & 0xff }
      }
      case 'getchar': {
        need(0)
        const inp = this.cfg.stdin
        if (this.inPos >= inp.length) {
          this.note('the input is used up, so getchar returns -1 (EOF)')
          return { t: T_INT, n: -1 }
        }
        const ch = inp.charCodeAt(this.inPos++)
        this.note(`getchar reads ${showChar(ch)} from the input`)
        return { t: T_INT, n: ch }
      }
      case 'scanf':
        return this.scanf(e)
      case 'fgets': {
        need(3)
        const src = e.args[2]
        if (src.k !== 'id' || src.name !== 'stdin') throw new RuntimeErr('unsupported', 'fgets can only read from stdin here: fgets(str, size, stdin)')
        const d = this.rv(e.args[0])
        const n = this.rv(e.args[1])
        if (d.t.k !== 'ptr') throw new RuntimeErr('type', 'fgets needs a char array (an address) to read into')
        if (n.t.k !== 'int' || n.n < 1) throw new RuntimeErr('type', 'the size given to fgets must be a positive int')
        const inp = this.cfg.stdin
        if (this.inPos >= inp.length) {
          this.note('the input is used up, so fgets returns NULL and leaves the array as it was')
          return { t: ptr(T_CHAR), n: 0 }
        }
        let s = ''
        while (s.length < n.n - 1 && this.inPos < inp.length) {
          const ch = inp[this.inPos++]
          s += ch
          if (ch === '\n') break
        }
        this.mem.writeBytes(d.n, Uint8Array.from([...s, '\0'].map((c) => c.charCodeAt(0) & 0xff)))
        const dest = this.mem.nameAt(d.n, 1)?.replace(/\[0\]$/, '') ?? e.args[0].text
        this.note(`fgets reads ${JSON.stringify(s)} from the input into ${dest}, then adds '\\0'`)
        this.why({
          rule: "fgets reads at most size - 1 characters and stops after a newline, which it keeps; then it adds '\\0'",
          working: `size ${n.n}: ${s.length} character${s.length === 1 ? '' : 's'} read${s.endsWith('\n') ? ", the '\\n' included" : ''}`,
          cite: 'L05B p5-6',
        })
        return d
      }
      case 'strcmp':
      case 'strncmp': {
        need(e.name === 'strcmp' ? 2 : 3)
        let a = this.cString(this.rv(e.args[0]).n, e.name)
        let b = this.cString(this.rv(e.args[1]).n, e.name)
        if (e.name === 'strncmp') {
          const n = this.rv(e.args[2]).n
          a = a.slice(0, n)
          b = b.slice(0, n)
        }
        let i = 0
        while (i < a.length && i < b.length && a[i] === b[i]) i++
        const ca = i < a.length ? a.charCodeAt(i) : 0
        const cb = i < b.length ? b.charCodeAt(i) : 0
        const n = ca - cb
        const show = (c: number) => (c ? `'${String.fromCharCode(c)}' (${c})` : "'\\0' (0)")
        this.why({
          rule: `${e.name} compares the strings character by character by ASCII code: the result is negative, 0 or positive (only its sign matters)`,
          working: n === 0 ? `${JSON.stringify(a)} and ${JSON.stringify(b)} match, so 0` : `first difference at index ${i}: ${show(ca)} - ${show(cb)} = ${n}`,
          cite: 'L05B p10',
        })
        return { t: T_INT, n }
      }
      case 'strncpy': {
        need(3)
        const d = this.rv(e.args[0])
        const s = this.cString(this.rv(e.args[1]).n, 'strncpy')
        const n = this.rv(e.args[2]).n
        const bytes = Array.from({ length: n }, (_, i) => (i < s.length ? s.charCodeAt(i) : 0))
        const r = this.mem.locate(d.n)
        const room = r ? r.addr + r.size - d.n : 0
        if (r && n > room) throw new RuntimeErr('bounds', `strncpy writes ${n} bytes but ${r.name} has only ${room} from there: buffer overflow`, 'L05B p11')
        this.mem.writeBytes(d.n, Uint8Array.from(bytes))
        const dest = this.mem.nameAt(d.n, 1)?.replace(/\[0\]$/, '') ?? e.args[0].text
        this.note(`strncpy copies ${Math.min(n, s.length)} character${Math.min(n, s.length) === 1 ? '' : 's'} of "${s}" into ${dest}${n > s.length ? `, then '\\0' up to ${n} bytes` : ''}`)
        if (n <= s.length)
          this.why({ rule: "strncpy copies at most n characters; when the source is that long or longer, no '\\0' is added", working: `n = ${n}, strlen = ${s.length}`, cite: 'L05B p10-11' })
        return d
      }
      case 'strcat': {
        need(2)
        const d = this.rv(e.args[0])
        const head = this.cString(d.n, 'strcat')
        const s = this.cString(this.rv(e.args[1]).n, 'strcat')
        const at = d.n + head.length
        const r = this.mem.locate(d.n)
        const room = r ? r.addr + r.size - at : 0
        if (r && s.length + 1 > room)
          throw new RuntimeErr('bounds', `strcat needs ${s.length + 1} more bytes after "${head}", but ${r.name} has only ${room} left: buffer overflow`, 'L05B p11')
        this.mem.writeBytes(at, Uint8Array.from([...s, '\0'].map((c) => c.charCodeAt(0) & 0xff)))
        const dest = this.mem.nameAt(d.n, 1)?.replace(/\[0\]$/, '') ?? e.args[0].text
        this.note(`strcat appends "${s}" to ${dest}, which now holds "${head + s}"`)
        return d
      }
      case 'sqrt':
      case 'fabs': {
        need(1)
        const x = this.coerce(this.rv(e.args[0]), T_DOUBLE, `the value given to ${e.name}`).n
        return { t: T_DOUBLE, n: e.name === 'sqrt' ? Math.sqrt(x) : Math.abs(x) }
      }
      case 'pow': {
        need(2)
        const x = this.coerce(this.rv(e.args[0]), T_DOUBLE, 'the base given to pow').n
        const y = this.coerce(this.rv(e.args[1]), T_DOUBLE, 'the power given to pow').n
        return { t: T_DOUBLE, n: Math.pow(x, y) }
      }
      case 'toupper':
      case 'tolower':
      case 'isupper':
      case 'islower':
      case 'isalpha':
      case 'isdigit':
      case 'isspace': {
        // ctype.h, used by RemoveVowels (L05B p9)
        need(1)
        const c = this.rv(e.args[0])
        if (!isArith(c.t) || isFloating(c.t)) throw new RuntimeErr('type', `${e.name} needs a character (an int or a char)`)
        const ch = String.fromCharCode(c.n & 0xff)
        const up = c.n >= 97 && c.n <= 122
        const low = c.n >= 65 && c.n <= 90
        const res: Record<string, number> = {
          toupper: up ? c.n - 32 : c.n,
          tolower: low ? c.n + 32 : c.n,
          isupper: low ? 1 : 0,
          islower: up ? 1 : 0,
          isalpha: up || low ? 1 : 0,
          isdigit: c.n >= 48 && c.n <= 57 ? 1 : 0,
          isspace: /^[ \t\n\r\f\v]$/.test(ch) ? 1 : 0,
        }
        if (e.name === 'toupper' || e.name === 'tolower')
          this.why({ rule: `${e.name} changes a ${e.name === 'toupper' ? 'lowercase' : 'uppercase'} letter by 32 in ASCII and leaves other characters alone`, working: `${e.text} = ${res[e.name]}`, cite: 'L03B p3-5' })
        return { t: T_INT, n: res[e.name] }
      }
      case 'abs': {
        need(1)
        const x = this.rv(e.args[0])
        if (!isArith(x.t) || isFloating(x.t)) throw new RuntimeErr('type', 'abs needs an int (use fabs for a double)')
        return { t: T_INT, n: Math.abs(x.n) | 0 }
      }
      case 'strlen': {
        need(1)
        const n = this.cString(this.rv(e.args[0]).n, 'strlen').length
        this.why({ rule: "strlen counts the characters before the first '\\0'", working: `${e.text} = ${n}`, cite: 'L05B p10' })
        return { t: T_INT, n }
      }
      case 'strcpy': {
        need(2)
        const d = this.rv(e.args[0])
        const s = this.cString(this.rv(e.args[1]).n, 'strcpy')
        const r = this.mem.locate(d.n)
        const room = r ? r.addr + r.size - d.n : 0
        if (r && s.length + 1 > room)
          throw new RuntimeErr('bounds', `strcpy needs ${s.length + 1} bytes for "${s}" plus '\\0', but ${r.name} has only ${room} from there: buffer overflow`, 'L05B p11')
        this.mem.writeBytes(d.n, Uint8Array.from([...s, '\0'].map((c) => c.charCodeAt(0))))
        const dest = this.mem.nameAt(d.n, 1)?.replace(/\[0\]$/, '')
        const lhs = !dest || dest === e.args[0].text ? e.args[0].text : `${e.args[0].text} (that is, ${dest})`
        this.note(`${lhs} now holds "${s}" (${s.length + 1} bytes copied, '\\0' included)`)
        return d
      }
      case 'malloc': {
        need(1)
        const n = this.rv(e.args[0])
        if (n.t.k !== 'int' || n.n <= 0) throw new RuntimeErr('type', 'malloc needs a positive number of bytes')
        if (n.n > MAX_CELLS) throw new RuntimeErr('unsupported', `malloc(${n.n}) is too big to draw; the tracer allows blocks of at most ${MAX_CELLS} bytes`)
        const addr = Math.ceil(this.hp / 8) * 8
        this.hp = addr + n.n
        const r = this.mem.add(
          {
            name: `heap block ${++this.heapNo}`, kind: 'heap', addr, size: n.n, type: arr(T_CHAR, n.n), line: e.line, typed: false,
            addrWhy: { rule: `malloc hands out the next free block of the heap (tracer assumption: the heap starts at ${hex(this.cfg.heapBase)}, blocks 8-byte aligned)`, cite: 'R02 p37' },
          },
          false,
        )
        this.note(`malloc(${n.n}) reserves ${r.name}: ${n.n} bytes at ${hex(addr)}, not yet given values`)
        return { t: ptr(T_VOID), n: addr }
      }
      case 'free': {
        need(1)
        const p = this.rv(e.args[0])
        if (p.t.k !== 'ptr') throw new RuntimeErr('type', 'free needs a pointer')
        if (p.n === 0) {
          this.note('free(NULL) does nothing')
          return { t: T_VOID, n: 0 }
        }
        const r = this.mem.regions.find((x) => x.kind === 'heap' && x.addr === p.n)
        if (!r) throw new RuntimeErr('type', `free needs an address that malloc returned, and ${hex(p.n)} is not one`, 'R02 p37')
        if (!r.alive) throw new RuntimeErr('dangling', `${r.name} was already freed; freeing it twice is a bug`, 'R02 p40')
        r.alive = false
        this.note(`${r.name} is freed. ${e.args[0].text} still holds ${hex(p.n)}, which now dangles`)
        this.why({ rule: 'free gives the block back but does not change the pointer; using it afterwards is a dangling-pointer bug', cite: 'R02 p40' })
        return { t: T_VOID, n: 0 }
      }
    }
    throw new RuntimeErr('unsupported', `${e.name} is not supported`)
  }
}
