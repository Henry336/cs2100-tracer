/**
 * How each expression on a line groups, read off the course precedence table (L02C p9).
 * The parser already applies precedence; this walks its tree and labels every operator
 * with its row in the table, so a student can see why *p++ is *(p++).
 */
import type { Expr, Stmt } from './ast'
import { parse } from './parser'

export type PrecRow = { level: number; group: string; assoc: 'left to right' | 'right to left' }

export type ExprNode = {
  /** Source text of this sub-expression. */
  text: string
  /** The operator, e.g. "*", "expr++", "[]", "->"; undefined for a name or a constant. */
  op?: string
  /** Row in the L02C p9 table, 1 = highest precedence; undefined when the course table does not list it. */
  row?: PrecRow
  /** What the operator does here, or an equivalent rewrite. */
  note?: string
  kids: ExprNode[]
}

const ROWS = {
  primary: { level: 1, group: 'Primary', assoc: 'left to right' },
  unary: { level: 2, group: 'Unary', assoc: 'right to left' },
  mul: { level: 3, group: 'Multiplicative', assoc: 'left to right' },
  add: { level: 4, group: 'Additive', assoc: 'left to right' },
  rel: { level: 5, group: 'Relational', assoc: 'left to right' },
  eq: { level: 6, group: 'Equality', assoc: 'left to right' },
  and: { level: 7, group: 'Logical and', assoc: 'left to right' },
  or: { level: 8, group: 'Logical or', assoc: 'left to right' },
  cond: { level: 9, group: 'Ternary', assoc: 'right to left' },
  assign: { level: 10, group: 'Assignment', assoc: 'right to left' },
} satisfies Record<string, PrecRow>

const BIN_ROW: Record<string, PrecRow> = {
  '*': ROWS.mul,
  '/': ROWS.mul,
  '%': ROWS.mul,
  '+': ROWS.add,
  '-': ROWS.add,
  '<': ROWS.rel,
  '>': ROWS.rel,
  '<=': ROWS.rel,
  '>=': ROWS.rel,
  '==': ROWS.eq,
  '!=': ROWS.eq,
  '&&': ROWS.and,
  '||': ROWS.or,
}

const UNARY_NOTE: Record<string, string> = {
  '*': 'follow the arrow: the variable this pointer holds the address of',
  '&': 'the address of this variable',
  '!': '1 if the operand is 0, else 0',
  '-': 'negate',
  '+': 'the value itself',
  '~': 'flip every bit',
}

function node(e: Expr): ExprNode {
  const n = (op: string | undefined, row: PrecRow | undefined, kids: Expr[], note?: string): ExprNode => ({
    text: e.text,
    ...(op ? { op } : {}),
    ...(row ? { row } : {}),
    ...(note ? { note } : {}),
    kids: kids.map(node),
  })
  switch (e.k) {
    case 'num':
    case 'chr':
    case 'str':
    case 'id':
      return { text: e.text, kids: [] }
    case 'unary':
      return n(e.op, ROWS.unary, [e.e], UNARY_NOTE[e.op])
    case 'incdec':
      return e.prefix
        ? n(`${e.op}expr`, ROWS.unary, [e.e], `changes ${e.e.text} first, then gives the new value`)
        : n(`expr${e.op}`, ROWS.primary, [e.e], `gives the old value of ${e.e.text}; the change happens as a side effect`)
    case 'bin': {
      const row = BIN_ROW[e.op]
      const intDiv = e.op === '/' ? 'if both sides are int, the result is truncated' : undefined
      return n(e.op, row, [e.l, e.r], row ? (e.op === '&&' || e.op === '||' ? 'short circuit: the right side may not be evaluated' : intDiv) : 'not in the course precedence table')
    }
    case 'assign':
      return n(e.op, ROWS.assign, [e.l, e.r], e.op === '=' ? 'store the right side into the left; the whole expression has that value' : `${e.l.text} = ${e.l.text} ${e.op.slice(0, -1)} (${e.r.text})`)
    case 'cond':
      return n('?:', ROWS.cond, [e.c, e.a, e.b], `if ${e.c.text} is nonzero then ${e.a.text}, else ${e.b.text}`)
    case 'call':
      return n('()', ROWS.primary, e.args, `call ${e.name}`)
    case 'index':
      return n('[]', ROWS.primary, [e.e, e.i], `${e.e.text}[${e.i.text}] is *(${e.e.text} + ${e.i.text})`)
    case 'member':
      return e.arrow
        ? n('->', ROWS.primary, [e.e], `${e.e.text}->${e.name} is (*${e.e.text}).${e.name}`)
        : n('.', ROWS.primary, [e.e], `member ${e.name}`)
    case 'cast':
      return n('(type)', ROWS.unary, [e.e], 'convert to the named type')
    case 'sizeof':
      return n('sizeof', ROWS.unary, e.e ? [e.e] : [], 'size in bytes, worked out by the compiler')
    case 'init':
      return n('{ }', undefined, e.items, 'initialiser list (only allowed in a declaration)')
    case 'comma':
      return n(',', undefined, [e.l, e.r], 'not in the course precedence table: evaluate the left, then give the right')
  }
}

function stmtExprs(s: Stmt, out: { line: number; e: Expr }[]) {
  const add = (e: Expr | undefined, line = s.line) => {
    if (e) out.push({ line: e.line || line, e })
  }
  switch (s.k) {
    case 'decl':
      for (const d of s.decls) add(d.init, d.line)
      return
    case 'expr':
      return add(s.e)
    case 'if':
      add(s.c)
      stmtExprs(s.then, out)
      if (s.else) stmtExprs(s.else, out)
      return
    case 'while':
      add(s.c)
      return stmtExprs(s.body, out)
    case 'do':
      stmtExprs(s.body, out)
      return add(s.c, s.condLine)
    case 'for':
      if (s.init) stmtExprs(s.init, out)
      add(s.c)
      add(s.step)
      return stmtExprs(s.body, out)
    case 'return':
      return add(s.e)
    case 'switch':
      add(s.e)
      for (const b of s.body) stmtExprs(b, out)
      return
    case 'block':
      for (const b of s.body) stmtExprs(b, out)
      return
    default:
      return
  }
}

/** Every expression with at least one operator, grouped by its 1-based source line. Empty when the program does not parse. */
export function exprTreesByLine(source: string, ptrSize: 4 | 8 = 4): Map<number, ExprNode[]> {
  const byLine = new Map<number, ExprNode[]>()
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(source, ptrSize)
  } catch {
    return byLine
  }
  if (!parsed.ok) return byLine
  const found: { line: number; e: Expr }[] = []
  for (const g of parsed.program.globals) stmtExprs(g, found)
  for (const f of Object.values(parsed.program.funcs)) stmtExprs(f.body, found)
  for (const { line, e } of found) {
    const t = node(e)
    if (t.kids.length === 0) continue
    const list = byLine.get(line) ?? []
    list.push(t)
    byLine.set(line, list)
  }
  return byLine
}
