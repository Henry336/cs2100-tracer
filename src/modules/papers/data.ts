// The past-paper index: every final or midterm question that a tracer preset cites.
// Rows are built at import time from the modules' own preset arrays (their source or cite
// fields), so a new preset with a paper citation shows up here without editing this file.
// Hand-kept tables below cover only what the presets cannot give: presets that live inside
// a tab and are not exported, one plain line per question, and the errata notes.
import { PRESETS as C_PRESETS } from '../../core/c-memory'
import { linkWithState } from '../../lib/url-state'
import { ANSWER_PRESETS, FN_PRESETS, FORMS_PRESETS, GATE_PRESETS, SET_PRESETS } from '../boolean/presets'
import { DEFAULT_CFG, TRACE_PRESETS as CACHE_PRESETS } from '../cache/presets'
import { TRACE_PRESETS as DATAPATH_PRESETS } from '../datapath/presets'
import { ENCODE_PRESETS, OPCODE_PRESETS, RUN_PRESETS } from '../mips/presets'
import { CMP_PRESETS, DEC_PRESETS, ENC_PRESETS, MUX_PRESETS, WB_PRESETS } from '../msi/presets'
import { LOOP_PRESETS, PRESETS as PIPELINE_PRESETS, TIMING_PRESETS } from '../pipeline/presets'
import { ANALYSIS_PRESETS, CHECK_PRESETS, DESIGN_PRESETS } from '../sequential/presets'

export type Topic = 'MIPS' | 'datapath' | 'pipeline' | 'cache' | 'Boolean' | 'MSI' | 'sequential' | 'C'
export const TOPIC_LIST: Topic[] = ['C', 'MIPS', 'datapath', 'pipeline', 'cache', 'Boolean', 'MSI', 'sequential']

type ModuleId = 'c-memory' | 'mips' | 'datapath' | 'pipeline' | 'cache' | 'boolean' | 'msi' | 'sequential'

const MODULE: Record<ModuleId, { topic: Topic; where: string }> = {
  'c-memory': { topic: 'C', where: 'C memory' },
  mips: { topic: 'MIPS', where: 'MIPS' },
  datapath: { topic: 'datapath', where: 'Datapath' },
  pipeline: { topic: 'pipeline', where: 'Pipeline' },
  cache: { topic: 'cache', where: 'Cache' },
  boolean: { topic: 'Boolean', where: 'Boolean' },
  msi: { topic: 'MSI', where: 'MSI' },
  sequential: { topic: 'sequential', where: 'Sequential' },
}

export interface PaperLink {
  module: ModuleId
  /** The tab or tool inside the module. */
  tool: string
  path: string
  /** "Pipeline", "Cache": the tracer this opens. */
  where: string
  /** The preset's own name in that module. */
  preset: string
  href: string
  /** False when the URL only opens the right tool and the student picks the preset by name. */
  exact: boolean
}

export interface Erratum {
  kind: 'key slip' | 'sources disagree'
  note: string
  source: string
}

export interface Question {
  /** "AY24/25 S1 Q19" */
  id: string
  paper: string
  q: number
  /** id with the widest range a preset cites, e.g. "AY23/24 S1 Q1-4". */
  label: string
  topics: Topic[]
  task: string
  links: PaperLink[]
  key: boolean
  errata: Erratum[]
}

export interface Paper {
  id: string
  key: boolean
  questions: Question[]
}

/* ---------- Papers ---------- */

/** Papers in order. Only these four finals come with an answer file (Exam Prep/Past Finals). */
export const PAPERS: { id: string; key: boolean }[] = [
  { id: 'AY15/16 S1', key: false },
  { id: 'AY16/17 S2', key: false },
  { id: 'AY17/18 S2', key: false },
  { id: 'AY18/19 S2', key: false },
  { id: 'AY19/20 S2', key: false },
  { id: 'AY20/21 S2', key: false },
  { id: 'AY21/22 S1', key: false },
  { id: 'AY21/22 S2', key: false },
  { id: 'AY23/24 S1', key: true },
  { id: 'AY23/24 S2', key: true },
  { id: 'AY24/25 S1', key: true },
  { id: 'AY25/26 S1', key: true },
  // No answer file for the midterm; its presets are computed (docs/spec/features/mips-isa.md, c-memory.md).
  { id: 'AY25/26 midterm', key: false },
]

/** Years with a single final in the folder, so "AY24/25 Q19" can only mean that paper. */
const ONLY_SEM: Record<string, 'S1' | 'S2'> = {
  '15/16': 'S1', '16/17': 'S2', '17/18': 'S2', '18/19': 'S2', '19/20': 'S2', '20/21': 'S2', '24/25': 'S1', '25/26': 'S1',
}

const CITE = /(Midterm\s+)?AY(\d{2})[/-](\d{2})(?:\s+(S[12]))?(?:\s+(Final|midterm))?\s+Q(\d+)(?:\s*-\s*Q?(\d+)\b|\s+and\s+Q(\d+))?/g

export interface CiteRef {
  paper: string
  q: number
  /** Last question of a range ("Q1-4"), else q. */
  to: number
}

/** Every paper question named in a preset's source string. Mentions with no question number are skipped. */
export function parseCites(source: string, unresolved: string[] = []): CiteRef[] {
  const out: CiteRef[] = []
  for (const m of source.matchAll(CITE)) {
    const year = `${m[2]}/${m[3]}`
    const q = Number(m[6])
    const to = Number(m[7] ?? m[8] ?? q)
    if (m[1] || m[5] === 'midterm') {
      out.push({ paper: `AY${year} midterm`, q, to })
      continue
    }
    const sem = m[4] ?? ONLY_SEM[year]
    if (!sem) {
      unresolved.push(m[0])
      continue
    }
    out.push({ paper: `AY${year} ${sem}`, q, to: to > q ? to : q })
  }
  return out
}

/* ---------- Links: each module's real URL keys, mirroring what its preset picker sets ---------- */

interface Source {
  module: ModuleId
  /** The tab or tool inside the module, e.g. "Design wizard". */
  tool: string
  preset: string
  cite: string
  state: Record<string, unknown>
  exact?: boolean
}

const pathOf = (m: ModuleId) => `/${m}`

function sources(): Source[] {
  const out: Source[] = []
  const at = (module: ModuleId, tool: string) => (preset: string, cite: string, state: Record<string, unknown>) => out.push({ module, tool, preset, cite, state })

  // c-memory TraceTab pick(): src, in, top; step back to 0.
  const cTrace = at('c-memory', 'Trace')
  for (const p of C_PRESETS) cTrace(p.title, p.source, { tab: 'trace', src: p.code, in: p.config?.stdin ?? '', top: p.config?.stackTop ?? 0, step: 0 })

  // mips RunTab, EncodeTab (useEncodeState keys), OpcodeTab.
  const run = at('mips', 'Run')
  const enc = at('mips', 'Encode and decode')
  const opc = at('mips', 'Expanding opcode')
  for (const p of RUN_PRESETS) run(p.name, p.source, { tab: 'run', src: p.value.src, regs: p.value.regs, mem: p.value.mem, base: p.value.base, step: 0 })
  for (const p of ENCODE_PRESETS) enc(p.name, p.source, { tab: 'encode', emode: p.value.mode, [p.value.mode === 'asm' ? 'easm' : 'ehex']: p.value.text, ebase: p.value.base, esel: p.value.sel })
  for (const p of OPCODE_PRESETS) opc(p.name, p.source, { tab: 'opcode', xo: p.value })

  // datapath useTraceInputs().load(): src, pc, regs, mem, fault; useUrlStepper key 'step'.
  const dp = at('datapath', 'Datapath tracer')
  for (const p of DATAPATH_PRESETS) dp(p.name, p.source, { tab: 'trace', src: p.src, pc: p.pc, regs: p.regs, mem: p.mem, fault: p.fault, step: 0 })

  // pipeline useProgram().load(): src, opt, run, pre, step. TimingTab: tm and loop.
  const pl = at('pipeline', 'Pipeline diagram')
  const plt = at('pipeline', 'Timing')
  for (const p of PIPELINE_PRESETS) pl(p.name, p.cite, { src: p.code, opt: p.options, run: p.run, pre: p.key, step: 0 })
  for (const p of TIMING_PRESETS) plt(p.name, p.source, { tab: 'timing', tm: p.value })
  for (const p of LOOP_PRESETS) plt(p.name, p.source, { tab: 'timing', loop: p.value })

  // cache useInput().load(): c and p, then lp with g = 'loop', or g = id, or g = '' with t.
  const sim = at('cache', 'Simulator')
  for (const p of CACHE_PRESETS) {
    const body = p.loop ? { lp: p.loop, g: 'loop' } : p.gen ? { g: p.id } : { g: '', t: p.text ?? '' }
    sim(p.name, p.source, { tab: 'sim', c: { ...DEFAULT_CFG, ...p.cfg }, p: p.id, ...body })
  }

  // boolean: FnPresets (f, or, ax), CheckTab (f, or, ans, af, fitb, epi), FormsTab (ex, eq),
  // GatesTab expression mode (gm, gx, gd, fi), UniversalPanel (gs) in the gt tab strip.
  const km = at('boolean', 'K-map studio')
  for (const p of FN_PRESETS) km(p.name, p.source, { tab: 'kmap', f: p.f, or: p.or ?? 'rows', ...(p.ax ? { ax: p.ax } : {}) })
  const chk = at('boolean', 'Answer checker')
  for (const p of ANSWER_PRESETS) chk(p.name, p.source, { tab: 'check', f: p.f, or: 'rows', ans: p.ans, af: p.af, fitb: p.fitb, epi: p.epi === true })
  const forms = at('boolean', 'Truth table and forms')
  for (const p of FORMS_PRESETS) forms(p.name, p.source, { tab: 'forms', ex: p.ex, eq: p.eq })
  const gates = at('boolean', 'Gates')
  for (const p of GATE_PRESETS) gates(p.name, p.source, { tab: 'gates', gm: 'expr', gx: p.gx, gd: p.gd ?? 1, fi: p.fi === true })
  for (const p of SET_PRESETS) gates(p.name, p.source, { tab: 'gates', gt: 'universal', gs: p.set })

  // msi: each tab's onPick, key for key.
  const cmp = at('msi', 'Comparator')
  for (const p of CMP_PRESETS)
    cmp(p.name, p.source, {
      tab: 'cmp', cmo: p.mode,
      ...(p.width ? { cw: p.width } : {}), ...(p.a !== undefined ? { ca: p.a } : {}), ...(p.b !== undefined ? { cb: p.b } : {}),
      ...(p.vars ? { cv: p.vars } : {}), ...(p.x ? { cx: p.x } : {}), ...(p.y ? { cy: p.y } : {}), ...(p.f ? { cf: p.f } : {}),
      cp: p.pairs === true, cg: p.gates?.length === 1 ? p.gates[0] : 'any',
    })
  const dec = at('msi', 'Decoder lab')
  for (const p of DEC_PRESETS)
    dec(p.name, p.source, {
      tab: 'dec', dmo: p.mode,
      ...(p.k ? { dk: p.k } : {}), ...(p.enable ? { de: p.enable } : {}), ...(p.outputs ? { dp: p.outputs } : {}),
      ...(p.vars ? { dv: p.vars } : {}), ...(p.selects ? { dsl: p.selects } : {}),
      ...(p.mode === 'circuit' ? { den: p.en ?? '', du: p.used ?? [0], dg: p.gate ?? 'none', dt: p.f ?? '' } : {}),
      ...(p.mode === 'find' && p.f ? { df: p.f } : {}),
      ...(p.n ? { dn: p.n } : {}), ...(p.block ? { db: p.block } : {}), ...(p.code !== undefined ? { dc: p.code } : {}),
    })
  const encd = at('msi', 'Encoders')
  for (const p of ENC_PRESETS)
    encd(p.name, p.source, {
      tab: 'enc', emo: p.mode, em: p.m, ep: p.priority,
      ...(p.valid !== undefined ? { ev: p.valid } : {}), ...(p.d !== undefined ? { ed: p.d } : {}),
      ...(p.vars ? { evr: p.vars } : {}), ...(p.pins ? { ew: p.pins } : {}), ...(p.order ? { eo: p.order } : {}),
    })
  const mux = at('msi', 'MUX')
  for (const p of MUX_PRESETS) mux(p.name, p.source, { tab: 'mux', xmo: 'impl', xf: p.f, xs: p.selects })
  const wb = at('msi', 'Block workbench')
  for (const p of WB_PRESETS) wb(p.name, p.source, { tab: 'wb', wv: p.vars, wb: p.blocks, wt: p.target ?? '', wc: p.check ?? '' })

  // sequential: AnalysisTab, DesignTab and CheckTab onPick.
  const an = at('sequential', 'Analysis')
  for (const p of ANALYSIS_PRESETS)
    an(p.name, p.source, {
      tab: 'analysis', amo: p.mode, aeq: p.text, ain: p.inputs ?? '', aou: p.outputs ?? '', abt: p.bits ?? 'A, B',
      aus: p.used ?? '', ast: p.start, asq: p.seq ?? '', ...(p.clocks ? { acl: p.clocks } : {}), asm: 'sim',
    })
  const des = at('sequential', 'Design wizard')
  for (const p of DESIGN_PRESETS) des(p.name, p.source, { tab: 'design', dbt: p.bits, din: p.inputs, dou: p.outputs, dty: p.types, drw: p.rows, dpr: p.prefer ?? 'sop', dov: p.overrides ?? '', dkf: '' })
  const sck = at('sequential', 'Checker')
  for (const p of CHECK_PRESETS) sck(p.name, p.source, { tab: 'check', ceq: p.eq, ctb: p.table, cin: '' })

  // Presets kept inside a tab and not exported: the link opens the right tool; the row names the preset to pick.
  for (const h of UNEXPORTED) out.push({ ...h, exact: false })
  return out
}

/** Tab-local preset lists (cache CalcTab, c-memory CalcTab) that cite a paper. Names match the module's picker. */
const UNEXPORTED: Omit<Source, 'exact'>[] = [
  { module: 'cache', tool: 'Calculators, field widths', preset: '32 KB 8-way, 8 B blocks', cite: 'AY25/26 Q9, R12 p47', state: { tab: 'calc', kt: 'fw' } },
  { module: 'cache', tool: 'Calculators, field widths', preset: '32 KB 4-way, 16 B blocks', cite: 'AY24/25 Q14', state: { tab: 'calc', kt: 'fw' } },
  { module: 'cache', tool: 'Calculators, field widths', preset: '2048 blocks of 4 words, 4-way', cite: 'AY23/24 S1 Q15', state: { tab: 'calc', kt: 'fw' } },
  { module: 'cache', tool: 'Calculators, field widths', preset: '64 KB 4-way write-back, 8-word blocks', cite: 'AY16/17 Q6, derived', state: { tab: 'calc', kt: 'fw' } },
  { module: 'cache', tool: 'Calculators, average access time', preset: '5 ns cache, 80 ns memory, 2.5% misses', cite: 'AY16/17 Q6, derived', state: { tab: 'calc', kt: 'amat' } },
  { module: 'cache', tool: 'Calculators, pipeline and cache', preset: '10 cycles per word, 95% hits', cite: 'AY24/25 Q20', state: { tab: 'calc', kt: 'pipe' } },
  { module: 'cache', tool: 'Calculators, pipeline and cache', preset: 'Same, restart counted', cite: 'AY24/25 Q20, accepted alternative', state: { tab: 'calc', kt: 'pipe' } },
  { module: 'cache', tool: 'Calculators, pipeline and cache', preset: '5 cycles per word, restart counted, 90% hits', cite: 'AY25/26 Q20, R12 p48', state: { tab: 'calc', kt: 'pipe' } },
  { module: 'c-memory', tool: 'Calculators, struct layout', preset: 'Struct: rec_t st[2], &st[1]', cite: 'AY17/18 S2 Final Q1a', state: { tab: 'calc', ck: 'struct' } },
  { module: 'c-memory', tool: 'Calculators, struct layout', preset: 'Struct: data_t (array vs pointer member)', cite: 'AY21/22 S2 Final Q3', state: { tab: 'calc', ck: 'struct' } },
  { module: 'c-memory', tool: 'Calculators, struct layout', preset: 'Struct: struct point { double *x, *y }', cite: 'AY23/24 S2 Final Q1', state: { tab: 'calc', ck: 'struct' } },
  { module: 'c-memory', tool: 'Calculators, bytes', preset: "Bytes: 43 61 74 73 at 0x3E8 ('Cats')", cite: 'AY21/22 S1 Final Q7', state: { tab: 'calc', ck: 'bytes' } },
]

/* ---------- Hand-kept: what each question asks, in our own words (never the paper's text) ---------- */

/** One plain line per question, at most 12 words, that names the work without giving the answer. */
export const TASKS: Record<string, string> = {
  'AY15/16 S1 Q5': 'Work out single-cycle and pipelined time, then the speedup.',
  'AY15/16 S1 Q6': 'Count the instructions an expanding opcode allows for three widths.',
  'AY15/16 S1 Q7': 'Analyse a J-K, T and D counter and its unused states.',
  'AY15/16 S1 Q8': 'Build a 4-variable function from 2-bit comparators.',
  'AY15/16 S1 Q9': 'Find the control signals for addi, then with one stuck.',
  'AY15/16 S1 Q12': 'Count cache hits for a loop over three arrays.',
  'AY16/17 S2 Q4': 'Fit six instruction types into a 32-bit expanding opcode.',
  'AY16/17 S2 Q6': 'Split addresses for a 4-way cache, then find the average access time.',
  'AY17/18 S2 Q1': 'Struct array addresses, and the delay of a 3-input NAND.',
  'AY17/18 S2 Q4': 'Trace lw through the datapath with ALUSrc stuck at 0.',
  'AY18/19 S2 Q3': 'Decode a j word and find the address it jumps to.',
  'AY18/19 S2 Q5': 'Implement a 4-variable function on a 4:1 multiplexer.',
  'AY20/21 S2 Q1': "Count the PIs and EPIs of a K-map with don't-cares.",
  'AY20/21 S2 Q3': 'Count instructions for 3, 5 and 7-bit expanding opcodes.',
  'AY20/21 S2 Q6': 'Simplify a six-variable Boolean expression.',
  'AY20/21 S2 Q11': 'Decide which functions one 4-bit comparator can give.',
  'AY20/21 S2 Q12': 'Analyse three J-K flip-flops, then redesign with D flip-flops.',
  'AY20/21 S2 Q13': 'Implement a 4-variable function on a 4:1 multiplexer.',
  'AY20/21 S2 Q15': 'Count cache hits for two arrays of n words.',
  'AY21/22 S1 Q2': 'Trace pointer increments and predict what the program prints.',
  'AY21/22 S1 Q5': 'Count the PIs and EPIs of a K-map.',
  'AY21/22 S1 Q7': 'Read four bytes in memory as characters and as an int.',
  'AY21/22 S2 Q3': 'Copy a struct with an array member and a pointer member.',
  'AY21/22 S2 Q5': 'Decide which listed implicant is not essential.',
  'AY21/22 S2 Q14': 'Simplify a function, then build it from comparators.',
  'AY23/24 S1 Q1': 'Time a loop on single-cycle, multi-cycle and pipelined designs.',
  'AY23/24 S1 Q7': 'Judge statements about PIs, EPIs and minimal covers.',
  'AY23/24 S1 Q9': 'Decide which functions one 2x4 decoder can produce.',
  'AY23/24 S1 Q10': 'Choose multiplexer selects so that no inverter is needed.',
  'AY23/24 S1 Q12': 'Pick an instruction that can fill the branch delay slot.',
  'AY23/24 S1 Q13': 'Name the miss type a fully associative cache cannot have.',
  'AY23/24 S1 Q14': 'Classify each hit in a short trace as spatial or temporal.',
  'AY23/24 S1 Q15': 'Split an address into tag, set index and offset.',
  'AY23/24 S1 Q16': 'Count cycles for a loop under three hazard settings.',
  'AY23/24 S1 Q17': 'Find PIs, EPIs and simplified forms of two K-maps.',
  'AY23/24 S1 Q18': 'Analyse a two flip-flop circuit, then redesign it with J-K.',
  'AY23/24 S1 Q20': 'Fill in the final cache contents after a matrix transpose.',
  'AY23/24 S2 Q1': 'Work out sizes and offsets in a struct of pointers.',
  'AY23/24 S2 Q2': 'Predict what a function that swaps pointers changes.',
  'AY23/24 S2 Q7': 'Find opcode widths and counts for three instruction classes.',
  'AY23/24 S2 Q12': 'Name what a four-NAND circuit computes, and its delay.',
  'AY23/24 S2 Q14': 'Trace the state sequence of four chained D flip-flops.',
  'AY23/24 S2 Q15': 'Write one output of a 16-to-4 encoder.',
  'AY23/24 S2 Q16': 'Trace and encode a MIPS loop over two arrays.',
  'AY23/24 S2 Q17': "Find each instruction's delay in one loop iteration.",
  'AY23/24 S2 Q18': 'Split addresses and count misses for instruction and data caches.',
  'AY23/24 S2 Q19': 'Find the PIs, EPIs and minimal SOP forms of a K-map.',
  'AY23/24 S2 Q20': 'Design a J-K circuit from a state table.',
  'AY23/24 S2 Q21': 'Build functions from a mux, a decoder and an encoder.',
  'AY24/25 S1 Q2': 'Decide which gate sets are functionally complete.',
  'AY24/25 S1 Q3': "Count the PIs and EPIs of a K-map with don't-cares.",
  'AY24/25 S1 Q6': 'Read the function a decoder circuit produces.',
  'AY24/25 S1 Q7': 'Decide which functions a single comparator can give.',
  'AY24/25 S1 Q8': 'Predict the output of C code with a ternary operator.',
  'AY24/25 S1 Q13': 'Count ideal pipeline cycles for a countdown loop.',
  'AY24/25 S1 Q14': 'Split an address into tag, set index and offset.',
  'AY24/25 S1 Q15': 'Decode a word and trace it through the datapath.',
  'AY24/25 S1 Q16': 'Analyse a mixed flip-flop circuit, then redesign with T flip-flops.',
  'AY24/25 S1 Q17': 'Simplify a K-map, then build functions with a mux and encoder.',
  'AY24/25 S1 Q18': 'Trace a MIPS loop over two arrays and encode a store.',
  'AY24/25 S1 Q19': 'Count stalls and cycles with and without forwarding.',
  'AY24/25 S1 Q20': 'Work out the miss penalty and cycles for a pipeline with caches.',
  'AY24/25 S1 Q28': 'Trace a branch word through the datapath and find the next PC.',
  'AY25/26 S1 Q1': 'Count the EPIs of a 4-variable K-map.',
  'AY25/26 S1 Q2': 'Count ideal pipeline cycles for a countdown loop.',
  'AY25/26 S1 Q4': 'Name the dependency in a short instruction sequence.',
  'AY25/26 S1 Q5': 'Judge statements about cold, conflict and capacity misses.',
  'AY25/26 S1 Q6': 'Work out the value lui leaves in a register.',
  'AY25/26 S1 Q7': 'Decode a 32-bit word into its instruction.',
  'AY25/26 S1 Q8': 'Decide which functions one comparator wiring can give.',
  'AY25/26 S1 Q9': 'Split an address into tag, set index and offset.',
  'AY25/26 S1 Q10': 'Trace two pointers over an array and predict the output.',
  'AY25/26 S1 Q11': 'Find the function a decoder and a NOR gate give.',
  'AY25/26 S1 Q12': 'Expand an expression into its canonical sum of minterms.',
  'AY25/26 S1 Q14': 'Work out the result of andi with a large immediate.',
  'AY25/26 S1 Q15': 'Decode a branch word and find its target.',
  'AY25/26 S1 Q16': 'Analyse a two-input sequential circuit and its output.',
  'AY25/26 S1 Q17': 'Combine two functions, then simplify the result.',
  'AY25/26 S1 Q18': 'Fill in the control signals for bne on an extended datapath.',
  'AY25/26 S1 Q19': 'Count stalls and cycles with and without forwarding.',
  'AY25/26 S1 Q20': 'Work out the miss penalty and cycles for a pipeline with caches.',
  'AY25/26 midterm Q9': 'Predict what a for loop that also increments i prints.',
  'AY25/26 midterm Q10': 'Predict what a do-while loop with two decrements prints.',
  'AY25/26 midterm Q11': 'Trace a pointer to pointer through a postfix increment.',
  'AY25/26 midterm Q13': 'Encode a load with a negative offset.',
  'AY25/26 midterm Q14': 'Decode a branch word and find its target.',
  'AY25/26 midterm Q16': 'Decode a jump word and find its target.',
  'AY25/26 midterm Q20': 'Read the wire values for one add on the datapath.',
  'AY25/26 midterm Q27': 'Count instructions for two lengths sharing one opcode space.',
}

/* ---------- Hand-kept: errata, from docs/spec, DECISIONS.md and the presets' notes ---------- */

const PC_SPEC = 'docs/spec/pipeline-cache.md, ambiguities'

/** Known problems with an official key, or places where course sources disagree. Paraphrased, with the source. */
export const ERRATA: Record<string, Erratum[]> = {
  'AY24/25 S1 Q19': [
    { kind: 'sources disagree', note: 'This key counts stall events of 2 cycles each; the AY25/26 key counts single stall cycles. The tracer reports stall cycles.', source: `AY24/25 Ans; AY25/26 Ans; R11 Addendum; ${PC_SPEC} 1` },
    { kind: 'key slip', note: 'The (c) answer text names the wrong pair as the one that forwards.', source: 'docs/spec/features/datapath-pipeline.md, gaps' },
  ],
  'AY25/26 S1 Q19': [{ kind: 'sources disagree', note: 'The R11 Addendum calls this question Q20; the paper numbers it Q19.', source: `R11 Addendum p5-8; ${PC_SPEC} 12` }],
  'AY25/26 S1 Q4': [{ kind: 'sources disagree', note: 'The key (marked Draft) treats a WAW pair as a hazard, but L21 p14 and R11 p9 say WAW causes none in this pipeline.', source: `AY25/26 Ans; L21 p14; R11 p9; ${PC_SPEC} 5` }],
  'AY23/24 S2 Q17': [{ kind: 'sources disagree', note: 'This paper resolves j in ID; T10 Additional resolves it in MEM. The pipeline toolbar has a switch for it.', source: `AY23/24 S2 Q17; T10 Additional; ${PC_SPEC} 3` }],
  'AY24/25 S1 Q13': [{ kind: 'sources disagree', note: 'The key counts bne with an immediate as one instruction, though the assembler would expand it.', source: 'docs/spec/features/datapath-pipeline.md, gaps' }],
  'AY25/26 S1 Q2': [{ kind: 'sources disagree', note: 'The key counts bne with an immediate as one instruction, though the assembler would expand it.', source: 'docs/spec/features/datapath-pipeline.md, gaps' }],
  'AY23/24 S2 Q18': [
    { kind: 'key slip', note: 'The (c) working slips on the offset width and the set number; its miss count is still right.', source: `AY23/24 S2 Ans; ${PC_SPEC} 12` },
    { kind: 'sources disagree', note: 'The question mixes the L22 write policy terms (allocate on a miss, write-back on a hit).', source: 'L22 p53; docs/spec/features/cache.md, gaps' },
  ],
  'AY23/24 S1 Q20': [{ kind: 'sources disagree', note: 'The paper never says whether sw uses the cache. The key assumes sw allocates and also accepts ignoring sw.', source: `AY23/24 S1 Ans p17-18; ${PC_SPEC} 11` }],
  'AY24/25 S1 Q20': [
    { kind: 'sources disagree', note: 'This key leaves the restart cycle out of the miss penalty and accepts either; AY25/26 counts it in.', source: `AY24/25 Ans; AY25/26 Ans; ${PC_SPEC} 9` },
    { kind: 'key slip', note: 'The (d) key also accepts a total that no working gives.', source: 'docs/spec/features/past-finals.md, gaps' },
  ],
  'AY25/26 S1 Q20': [{ kind: 'key slip', note: 'The (e) reason is about search time, which is hit time. The miss penalty does not depend on associativity (L22 p20).', source: 'AY25/26 Ans; L22 p20; docs/spec/features/cache.md, gaps' }],
  'AY23/24 S1 Q16': [{ kind: 'key slip', note: 'The worked answer and the summary page write the (a) register in different forms; the question asks for the number only.', source: 'AY23/24 S1 Ans; docs/spec/features/past-finals.md, gaps' }],
  'AY23/24 S1 Q17': [{ kind: 'key slip', note: 'The worked answers and the summary page disagree on (d). The course guides follow the worked answers.', source: 'AY23/24 S1 Ans; docs/spec/logic.md, section 7 item 4' }],
  'AY23/24 S1 Q18': [
    { kind: 'key slip', note: 'The worked answers and the summary page give different KB equations and gate counts. The guides follow the worked answers.', source: 'AY23/24 S1 Ans; docs/spec/logic.md, section 7 item 4' },
    { kind: 'sources disagree', note: 'The key calls the circuit self-correcting although one unused state can stay put for one input. R10 only asks that some path leaves it.', source: 'AY23/24 S1 Ans; R10 p40-43; docs/spec/features/comb-seq.md, gaps' },
  ],
  'AY23/24 S2 Q19': [{ kind: 'key slip', note: 'The (d) key strings leave out the AND dots that the question asks students to write.', source: 'AY23/24 S2 Ans p19; docs/spec/features/past-finals.md, gaps' }],
  'AY23/24 S2 Q20': [{ kind: 'sources disagree', note: 'The (e) key accepts two gate types for KB; one of them needs a complemented external input, which the course does not give for free.', source: 'AY23/24 S2 Ans p17; docs/spec/logic.md, section 7 item 5; DECISIONS.md' }],
  'AY24/25 S1 Q17': [{ kind: 'sources disagree', note: 'The priority encoder here has no V output; the L18 version has one.', source: 'L18 p32; T08 Q5; docs/spec/logic.md, section 7 item 7' }],
  'AY24/25 S1 Q18': [{ kind: 'sources disagree', note: 'The key addresses need code to start at 0x00400024 (Lab 3); Lab 5 starts at 0x00400000. The preset uses 0x00400024.', source: 'DECISIONS.md, MIPS text base' }],
  'AY24/25 S1 Q28': [{ kind: 'key slip', note: 'R06, which works this question, prints the word with nine hex digits, and the PC it uses is not word aligned.', source: 'R06 p43; docs/spec/datapath-control.md, ambiguity 8' }],
  'AY25/26 S1 Q12': [{ kind: 'key slip', note: 'The key reaches its answer but the working has typos.', source: 'AY25/26 Ans; docs/spec/features/past-finals.md, gaps' }],
}

/* ---------- Build ---------- */

export interface Index {
  papers: Paper[]
  questions: Question[]
  /** Paper mentions whose semester could not be worked out (should stay empty). */
  unresolved: string[]
}

export function buildIndex(): Index {
  const unresolved: string[] = []
  const byId = new Map<string, Question>()
  for (const s of sources()) {
    for (const ref of parseCites(s.cite, unresolved)) {
      const id = `${ref.paper} Q${ref.q}`
      let row = byId.get(id)
      if (!row) {
        const paper = PAPERS.find((p) => p.id === ref.paper)
        row = { id, paper: ref.paper, q: ref.q, label: id, topics: [], task: '', links: [], key: paper?.key ?? false, errata: ERRATA[id] ?? [] }
        byId.set(id, row)
      }
      if (ref.to > ref.q) {
        const prevTo = Number(/-(\d+)$/.exec(row.label)?.[1] ?? ref.q)
        if (ref.to > prevTo) row.label = `${id}-${ref.to}`
      }
      const { topic, where } = MODULE[s.module]
      if (!row.topics.includes(topic)) row.topics.push(topic)
      const href = linkWithState(pathOf(s.module), s.state)
      if (!row.links.some((l) => l.href === href)) row.links.push({ module: s.module, tool: s.tool, path: pathOf(s.module), where, preset: s.preset, href, exact: s.exact !== false })
    }
  }
  const questions = [...byId.values()]
  for (const q of questions) q.task = TASKS[q.id] ?? ''
  const order = (p: string) => PAPERS.findIndex((x) => x.id === p)
  questions.sort((a, b) => order(a.paper) - order(b.paper) || a.q - b.q)
  const papers = PAPERS.map((p) => ({ ...p, questions: questions.filter((q) => q.paper === p.id) })).filter((p) => p.questions.length)
  return { papers, questions, unresolved }
}

export const INDEX = buildIndex()
