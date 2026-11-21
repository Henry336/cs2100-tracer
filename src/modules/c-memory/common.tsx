import type { ReactNode } from 'react'
import { PRESETS, type Explain, type Preset } from '../../core/c-memory'
import { Why } from '../../ui/kit'

/** A computed value that opens its explanation on click. */
export function W({ e, children }: { e: Explain; children: ReactNode }) {
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

export const hexAddr = (n: number, digits = 8) => `0x${(n >>> 0).toString(16).padStart(digits, '0')}`

/** "0x10010000", "10010000" or "65536": hex with or without 0x when it has a-f or a 0x prefix, else decimal. */
export function parseAddr(text: string): number | undefined {
  const t = text.trim().toLowerCase()
  if (!t) return undefined
  if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t.slice(2), 16)
  if (/^[0-9]+$/.test(t)) return parseInt(t, 10)
  if (/^[0-9a-f]+$/.test(t)) return parseInt(t, 16)
  return NaN
}

/** Preset topics, in teaching order. Every course example from the engine is listed once. */
const TOPICS: { label: string; ids: string[] }[] = [
  { label: 'Pointers', ids: ['CM02', 'CM01', 'CM03', 'CM04', 'CM05', 'CM11', 'CM12', 'CM13', 'CM14', 'CM36'] },
  { label: 'Functions', ids: ['CM07', 'CM10', 'CM06', 'CM08', 'CM09', 'CM44', 'CM31', 'CM32', 'CM43', 'CM33'] },
  { label: 'Arrays', ids: ['CM15', 'CM53', 'CM40', 'CM16', 'CM17', 'CM18', 'CM35', 'CM49'] },
  { label: 'Structs', ids: ['CM21', 'CM22', 'CM20', 'CM23', 'CM51', 'CM52'] },
  { label: 'Strings', ids: ['CM19', 'CM46', 'CM47', 'CM48', 'CM50', 'CM37', 'CM38'] },
  { label: 'Heap', ids: ['CM39'] },
  { label: 'Expressions and control', ids: ['CM24', 'CM25', 'CM26', 'CM27', 'CM28', 'CM29', 'CM30', 'CM34', 'CM41', 'CM42', 'CM45'] },
]

export type PresetPick = { name: string; source: string; value: Preset }

export const PRESET_LIST: PresetPick[] = (() => {
  const seen = new Set<string>()
  const out: PresetPick[] = []
  for (const t of TOPICS)
    for (const id of t.ids) {
      const p = PRESETS.find((x) => x.id === id)
      if (!p || seen.has(id)) continue
      seen.add(id)
      out.push({ name: `${t.label}: ${p.title}`, source: p.source, value: p })
    }
  // anything added to the engine later still shows up
  for (const p of PRESETS) if (!seen.has(p.id)) out.push({ name: `More: ${p.title}`, source: p.source, value: p })
  return out
})()

export const DEFAULT_PRESET = PRESETS.find((p) => p.id === 'CM02') ?? PRESETS[0]

/* ---------- traps, shown when the program uses the feature ---------- */

export type Trap = { id: string; title: string; body: string; cite: string; test: (src: string) => boolean }

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/"(?:\\.|[^"\\])*"/g, '""')
/** Declarators of every int/char/float/double declaration, split at top-level commas. */
const decls = (src: string) =>
  [...code(src).matchAll(/\b(?:int|char|float|double)\b([^;()]*);/g)].map((m) => {
    const parts: string[] = []
    let depth = 0
    let cur = ''
    for (const ch of m[1]) {
      if (ch === '{') depth++
      if (ch === '}') depth--
      if (ch === ',' && depth === 0) {
        parts.push(cur.trim())
        cur = ''
      } else cur += ch
    }
    parts.push(cur.trim())
    return parts.filter(Boolean)
  })
const funcDefs = (src: string) => [...code(src).matchAll(/\b\w[\w\s*]*?\b(\w+)\s*\(([^()]*)\)\s*\{/g)].filter((m) => !['main', 'if', 'while', 'for', 'switch'].includes(m[1]))

export const TRAPS: Trap[] = [
  {
    id: 'ptr-param',
    title: 'Reassigning a pointer parameter does not reach the caller',
    body: "A pointer parameter is a copy of the address. p = q inside the function only moves the copy; the caller still sees the old address. Only writing through it, *p = ..., changes the caller's variable.",
    cite: 'L04D p9-11; AY23/24 S2 Final Q2',
    test: (s) => funcDefs(s).some((m) => m[2].includes('*')),
  },
  {
    id: 'by-value',
    title: 'Arguments are copies',
    body: 'Each call gets a new frame with its own copy of every argument. Changing a parameter changes the copy, which disappears when the function returns.',
    cite: 'L04D p6; R02 p16',
    test: (s) => funcDefs(s).some((m) => m[2].trim() !== '' && m[2].trim() !== 'void'),
  },
  {
    id: 'post-inc',
    title: '*p++ moves the pointer, not the value',
    body: 'Postfix ++ and -- bind tighter than unary *, so *p++ reads *p and then moves p to the next element. Write (*p)++ to add 1 to the value.',
    cite: 'L02C p9; Midterm AY25/26 Q11',
    test: (s) => /\*\s*\*?\s*\w+\s*(\+\+|--)/.test(code(s)),
  },
  {
    id: 'ptr-step',
    title: 'p + 1 moves by the size of what p points to',
    body: 'Pointer arithmetic counts elements, not bytes: an int * moves 4 bytes per step, a char * 1, a double * 8.',
    cite: 'L04B p5; R02 p14',
    test: (s) => /\*\s*\w+\s*(\+|-)\s*\d|\b\w+\s*(\+\+|--|\+=|-=)/.test(code(s)) && /\b(int|char|float|double)\s*\*/.test(code(s)),
  },
  {
    id: 'decl-star',
    title: 'The * belongs to one name',
    body: 'In int *a, b; only a is a pointer; b is a plain int. In a declaration * means "is a pointer"; in an expression it means "follow the arrow".',
    cite: 'L04A p9, p14-15',
    test: (s) => decls(s).some((d) => d.length > 1 && d.some((x) => x.startsWith('*'))),
  },
  {
    id: 'array-assign',
    title: 'Arrays are not assignable',
    body: 'An array name stands for the address of element 0 and cannot be given a new value, so a = b does not compile for arrays. Copy element by element, or use strcpy for strings.',
    cite: 'L05A p9; R02 p21',
    test: (s) => /\w+\s*\[\s*\d*\s*\]\s*(=|;|,)/.test(code(s)),
  },
  {
    id: 'sizeof',
    title: 'sizeof an array vs an array parameter',
    body: 'Where an array is declared, sizeof gives the whole array (elements x element size). Inside a function, an array parameter is really a pointer, so sizeof gives the pointer size.',
    cite: 'L05A p12-13; Lab 2 Q10',
    test: (s) => /\bsizeof\b/.test(s) && /\[/.test(s),
  },
  {
    id: 'nul',
    title: "A string needs a byte for '\\0'",
    body: "char s[6] holds at most a 5-letter word. Without the terminator, strlen and printf %s run on into whatever bytes follow.",
    cite: 'L05B p12-13; R02 p22',
    test: (s) => /\bchar\s+\w+\s*\[/.test(s) || /\bstr\w+\s*\(/.test(s),
  },
  {
    id: 'struct-copy',
    title: 'Struct copies are member by member',
    body: 'Assigning or passing a struct copies every member, arrays inside included. A pointer member copies only the address, so the copy and the original still share what it points to.',
    cite: 'L05C p12; L05D p5-6; AY21/22 S2 Final Q3',
    test: (s) => /\bstruct\b|\btypedef\b/.test(s),
  },
  {
    id: 'arrow',
    title: 'p->m is (*p).m',
    body: 'The dot binds tighter than *, so *p.m means *(p.m), which does not compile when p is a pointer. Use p->m or (*p).m.',
    cite: 'L05D p10',
    test: (s) => /->/.test(s),
  },
  {
    id: 'garbage',
    title: 'Locals start as garbage',
    body: 'A local variable with no initialiser holds whatever was in those bytes. Only globals and static locals start at 0. A pointer with no value points nowhere useful.',
    cite: 'L02A p22; L04B p6',
    test: (s) => decls(s).some((d) => d.some((x) => !x.includes('='))),
  },
]

export const relevantTraps = (src: string) => TRAPS.filter((t) => t.test(src))
