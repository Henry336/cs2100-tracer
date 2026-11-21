// Turns whatever a student types on the home page into the tracer(s) that can take it,
// with the input already filled in. Pure, so it is tested without a browser.
import { linkWithState } from '../lib/url-state'

export interface Suggestion {
  /** What will happen, in plain words. */
  label: string
  /** Which tool, shown quietly beside the label. */
  where: string
  href: string
}

const MNEMONICS =
  'add|addu|addi|addiu|sub|subu|and|andi|or|ori|nor|xor|xori|slt|slti|sltu|sll|srl|lw|sw|lb|sb|lbu|lui|beq|bne|j|jal|jr|li|la|move|nop|bgt|blt|bge|ble'
const MIPS_LINE = new RegExp(`^\\s*(?:[A-Za-z_][\\w.]*:\\s*)?(?:${MNEMONICS})\\b`, 'i')
const HEX_WORD = /^0x[0-9a-f]{1,8}$/i
const ADDRESS_LIST = /^(?:(?:[RW]\s+)?(?:0x[0-9a-f]+|\d+)(?:=\S+)?[\s,]*){2,}$/i
const BOOLEAN = /[Σ∑Π]|\b[mM]\s*\(|^[A-Z][A-Z0-9(), ]*=|[A-Za-z]'|[A-Za-z]\s*\+\s*[A-Za-z]/
const C_CODE = /;|\{|#include|\bint\b|\bchar\b|printf|scanf|malloc|->/

/** Module keywords for plain-word searches ("hazard", "k-map", "pointer"). */
const TOPICS: { path: string; where: string; words: string[] }[] = [
  { path: '/c-memory', where: 'C memory', words: ['c', 'pointer', 'pointers', 'array', 'struct', 'memory', 'stack', 'pass by value', 'malloc', 'address'] },
  { path: '/mips', where: 'MIPS', words: ['mips', 'assembly', 'encode', 'decode', 'opcode', 'instruction', 'register', 'branch', 'jump', 'expanding opcode', 'lui', 'ori'] },
  { path: '/datapath', where: 'Datapath', words: ['datapath', 'control', 'alu', 'alucontrol', 'aluop', 'regdst', 'memtoreg', 'critical path', 'single cycle', 'mux'] },
  { path: '/pipeline', where: 'Pipeline', words: ['pipeline', 'pipelining', 'hazard', 'hazards', 'stall', 'stalls', 'forwarding', 'raw', 'war', 'waw', 'flush', 'branch prediction', 'delayed branch', 'load-use'] },
  { path: '/cache', where: 'Cache', words: ['cache', 'hit', 'miss', 'direct mapped', 'set associative', 'fully associative', 'lru', 'write back', 'write through', 'tag', 'index', 'offset', 'amat'] },
  { path: '/boolean', where: 'Boolean', words: ['boolean', 'k-map', 'kmap', 'karnaugh', 'prime implicant', 'pi', 'epi', 'sop', 'pos', 'minterm', 'maxterm', 'nand', 'nor', 'gates', 'algebra'] },
  { path: '/msi', where: 'MSI', words: ['msi', 'decoder', 'encoder', 'mux', 'multiplexer', 'demux', 'comparator', 'adder', 'half adder', 'full adder', 'ripple'] },
  { path: '/sequential', where: 'Sequential', words: ['sequential', 'flip-flop', 'flip flop', 'latch', 'jk', 'd flip-flop', 't flip-flop', 'state table', 'state diagram', 'excitation', 'counter'] },
  { path: '/papers', where: 'Past papers', words: ['past paper', 'past papers', 'past year', 'pyp', 'exam', 'exams', 'final', 'finals', 'midterm', 'practice', 'question', 'questions', 'errata'] },
  { path: '/reference', where: 'Reference', words: ['reference', 'table', 'tables', 'registers', 'formula', 'formulas', 'cheat sheet'] },
]

function topicMatches(text: string): Suggestion[] {
  const t = text.toLowerCase().trim()
  if (!t) return []
  const scored = TOPICS.map((m) => {
    let score = 0
    for (const w of m.words) {
      if (t === w) score += 3
      else if (new RegExp(`(^|[^a-z])${w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z]|$)`).test(t)) score += 2
      else if (w.startsWith(t) && t.length >= 3) score += 1
    }
    return { m, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map(({ m }) => ({ label: `Open ${m.where}`, where: m.where, href: linkWithState(m.path) }))
}

export function routeInput(raw: string): Suggestion[] {
  const text = raw.trim()
  if (!text) return []
  const out: Suggestion[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^#/.test(l))
  const firstCode = lines.find((l) => !/^[A-Za-z_][\w.]*:\s*$/.test(l)) ?? ''

  if (HEX_WORD.test(text)) {
    out.push({ label: `Decode ${text} field by field`, where: 'MIPS', href: linkWithState('/mips', { tab: 'encode', ehex: text }) })
    out.push({ label: `Trace ${text} through the datapath`, where: 'Datapath', href: linkWithState('/datapath', { src: text, step: 5 }) })
  } else if (MIPS_LINE.test(firstCode)) {
    const instrLines = lines.filter((l) => !/^[A-Za-z_][\w.]*:\s*$/.test(l))
    if (instrLines.length === 1) {
      out.push({ label: `Trace ${firstCode} through the datapath`, where: 'Datapath', href: linkWithState('/datapath', { src: firstCode, step: 0 }) })
      out.push({ label: `Encode ${firstCode}`, where: 'MIPS', href: linkWithState('/mips', { tab: 'encode', easm: firstCode }) })
      out.push({ label: 'Run it in the pipeline', where: 'Pipeline', href: linkWithState('/pipeline', { src: text, pre: '' }) })
    } else {
      out.push({ label: `Pipeline these ${instrLines.length} instructions`, where: 'Pipeline', href: linkWithState('/pipeline', { src: text, pre: '' }) })
      out.push({ label: 'Run them step by step', where: 'MIPS', href: linkWithState('/mips', { src: text }) })
    }
  } else if (ADDRESS_LIST.test(text)) {
    out.push({ label: 'Feed these addresses through a cache', where: 'Cache', href: linkWithState('/cache', { t: text, p: '' }) })
  } else if (C_CODE.test(text)) {
    out.push({ label: 'Trace this C code in memory', where: 'C memory', href: linkWithState('/c-memory', { src: text }) })
  } else if (BOOLEAN.test(text)) {
    out.push({ label: 'Draw its K-map and simplify it', where: 'Boolean', href: linkWithState('/boolean', { tab: 'kmap', f: text }) })
  }

  for (const s of topicMatches(text)) if (!out.some((o) => o.where === s.where)) out.push(s)
  return out.slice(0, 4)
}

/** Starting points shown under the input before anything is typed. */
export const TRY: { label: string; href: string }[] = [
  { label: 'lw through the datapath', href: linkWithState('/datapath', { src: 'lw $t0, 4($s1)', regs: '$s1 = 0x10010000', mem: '0x10010004: 42', step: 0 }) },
  { label: 'A load-use stall', href: linkWithState('/pipeline', { src: 'lw $2, 20($1)\nand $4, $2, $5\nor $8, $2, $6', pre: '' }) },
  { label: 'A cache trace', href: linkWithState('/cache') },
  { label: 'A K-map with don’t cares', href: linkWithState('/boolean', { tab: 'kmap', f: 'F(A,B,C,D) = Σm(1,3,7,11,15) + d(0,2,5)' }) },
]
