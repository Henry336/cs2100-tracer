import type { CType, StructDef } from './types'

type Node = { line: number; /** Source text of this node, for descriptions. */ text: string }

export type Expr = Node &
  (
    | { k: 'num'; v: number; float: boolean }
    | { k: 'chr'; v: number }
    | { k: 'str'; v: string }
    | { k: 'id'; name: string }
    | { k: 'unary'; op: '-' | '+' | '!' | '~' | '*' | '&'; e: Expr }
    | { k: 'incdec'; op: '++' | '--'; prefix: boolean; e: Expr }
    | { k: 'bin'; op: string; l: Expr; r: Expr }
    | { k: 'assign'; op: string; l: Expr; r: Expr }
    | { k: 'cond'; c: Expr; a: Expr; b: Expr }
    | { k: 'call'; name: string; args: Expr[] }
    | { k: 'index'; e: Expr; i: Expr }
    | { k: 'member'; e: Expr; name: string; arrow: boolean }
    | { k: 'cast'; t: CType; e: Expr }
    | { k: 'sizeof'; t?: CType; e?: Expr }
    /** Brace list, only valid as an initialiser. */
    | { k: 'init'; items: Expr[] }
    /** a, b: evaluates a, throws its value away, then gives b (L02C p25 uses it in a for header). */
    | { k: 'comma'; l: Expr; r: Expr }
  )

/** isStatic: a static local lives with the globals and keeps its value between calls (L04D p18). */
export type VarDecl = { name: string; type: CType; init?: Expr; line: number; isStatic?: boolean }

/** One case (lo..hi, a GCC range when they differ) or the default (no lo), starting at body[at]. */
export type CaseLabel = { lo?: number; hi?: number; at: number; line: number }

export type Stmt = { line: number } & (
  | { k: 'decl'; decls: VarDecl[] }
  | { k: 'expr'; e: Expr }
  | { k: 'if'; c: Expr; then: Stmt; else?: Stmt }
  | { k: 'while'; c: Expr; body: Stmt }
  | { k: 'do'; body: Stmt; c: Expr; condLine: number }
  | { k: 'for'; init?: Stmt; c?: Expr; step?: Expr; body: Stmt }
  | { k: 'return'; e?: Expr }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'block'; body: Stmt[]; endLine: number }
  | { k: 'switch'; e: Expr; body: Stmt[]; labels: CaseLabel[]; endLine: number }
  | { k: 'empty' }
)

export type Param = { name: string; type: CType }

export type FuncDef = { name: string; ret: CType; params: Param[]; body: Stmt & { k: 'block' }; line: number }

export type Program = {
  structs: Record<string, StructDef>
  globals: (Stmt & { k: 'decl' })[]
  funcs: Record<string, FuncDef>
  /** Prototypes seen (name to declaration line). */
  protos: Record<string, number>
}
