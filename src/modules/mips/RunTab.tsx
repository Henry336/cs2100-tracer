import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_TEXT_BASE,
  OP_BY_NAME,
  assemble,
  hex,
  lineProfile,
  memoryAt,
  parseMemInit,
  parseRegInit,
  readWord,
  regName,
  run,
  uniqueBytesRead,
  type AsmError,
  type Endian,
  type ExecFrame,
  type Explain,
  type LineCount,
  type Program,
  type RunResult,
} from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, CodeEditor, DataTable, Legend, Presets, Segmented, Tabs, TextField, Workspace, type Column } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'
import { Transport } from '../../ui/Transport'
import { BoardPlay, Facts, Steps, W, parseAddress } from './common'
import { ProgramFlow } from './diagrams'
import { RUN_PRESETS } from './presets'

const MAX_STEPS = 2000
const MAX_MEM_ROWS = 96
const START = RUN_PRESETS[0].value

type Radix = 'hex' | 'dec'

type Detail = 'regs' | 'mem' | 'trace' | 'lines' | 'counts' | 'notes'

const DETAIL_TABS: { value: Detail; label: string }[] = [
  { value: 'regs', label: 'Registers' },
  { value: 'mem', label: 'Memory' },
  { value: 'trace', label: 'Trace' },
  { value: 'lines', label: 'Line counts' },
  { value: 'counts', label: 'Counts' },
  { value: 'notes', label: 'Course notes' },
]

const errorMap = (errors: AsmError[]) => {
  const out: Record<number, string> = {}
  for (const e of errors) if (e.line > 0) out[e.line - 1] = out[e.line - 1] ? `${out[e.line - 1]}; ${e.message}` : e.message
  return out
}

const fmt = (v: number, radix: Radix) => (radix === 'hex' ? hex(v) : String(v | 0))

function nextPcWhy(f: ExecFrame): Explain {
  const k = OP_BY_NAME[f.instr.mnemonic]?.kind
  const p4 = hex((f.pc + 4) >>> 0)
  if (k === 'branch' && f.taken) return { rule: 'Branch taken: next PC = (PC+4) + immediate x 4', working: `${p4} + ${f.instr.imm} x 4 = ${hex(f.nextPc)}`, cite: 'L08 p28' }
  if (k === 'branch') return { rule: 'Branch not taken: next PC = PC+4', working: `${hex(f.pc)} + 4 = ${p4}`, cite: 'L08 p28' }
  if (k === 'jump') return { rule: 'Jump: next PC = {PC+4[31:28], target field, 00}', working: `${p4} top 4 bits, field ${hex(f.instr.target, 7)} -> ${hex(f.nextPc)}`, cite: 'L08 p39' }
  if (k === 'jr') return { rule: 'jr: next PC = the address in rs', working: `${regName(f.instr.rs)} = ${hex(f.nextPc)}`, cite: 'L08 p8' }
  return { rule: 'Every instruction is 4 bytes, so the next one is at PC+4', working: `${hex(f.pc)} + 4 = ${p4}`, cite: 'L08 p28' }
}

function pcWhy(r: RunResult, i: number, hasMain: boolean): Explain {
  if (i === 0) return hasMain
    ? { rule: 'Execution starts at main: QtSpim calls it after its startup code', cite: 'Lab 3 SPIM-assembler p1' }
    : { rule: 'Execution starts at the first instruction' }
  const p = r.frames[i - 1]
  return { rule: 'The previous instruction set this PC', working: `${p.instr.text}: next PC = ${hex(p.nextPc)}` }
}

/** Word addresses worth showing: the .data section, initial memory and every word the run touches. */
function memoryRows(p: Program, r: RunResult): number[] {
  const set = new Set<number>()
  for (const d of p.data) for (let k = 0; k < d.bytes.length; k++) set.add(((d.address + k) & ~3) >>> 0)
  for (const a of Object.keys(r.initialMem)) set.add((+a & ~3) >>> 0)
  for (const f of r.frames) for (const m of [...f.memReads, ...f.memWrites]) set.add((m.address & ~3) >>> 0)
  return [...set].sort((a, b) => a - b)
}

export default function RunTab({ intro, openEncode }: { intro: ReactNode; openEncode: (word: number, address: number) => void }) {
  const [src, setSrc] = useUrlState('src', START.src)
  const [regsText, setRegs] = useUrlState('regs', START.regs)
  const [memText, setMem] = useUrlState('mem', START.mem)
  const [baseText, setBase] = useUrlState('base', START.base)
  const [endian, setEndian] = useUrlState<Endian>('endian', 'big')
  const [jal, setJal] = useUrlState<'pc+4' | 'pc+8'>('jal', 'pc+4')
  const [radix, setRadix] = useUrlState<Radix>('radix', 'hex')
  const [stepQ, setStepQ] = useUrlState('step', 0)
  const [detail, setDetail] = useUrlState<Detail>('rdt', 'regs')

  const base = parseAddress(baseText)
  const sim = useMemo(() => {
    const program = assemble(src, { textBase: base ?? DEFAULT_TEXT_BASE, endian })
    const ri = parseRegInit(regsText)
    const mi = parseMemInit(memText, endian)
    const result = run(program, { regs: ri.regs, mem: mi.mem }, MAX_STEPS, { jalLink: jal })
    return { program, result, regErrors: ri.errors, memErrors: mi.errors, rows: memoryRows(program, result), profile: lineProfile(program, result), uniqueRead: uniqueBytesRead(result) }
  }, [src, base, endian, regsText, memText, jal])

  const { program, result } = sim
  // Open the editor on load only when the shared program does not assemble; after that the student decides.
  const [editOpen] = useState(program.errors.length > 0)
  const frames = result.frames
  const stepper = useStepper(frames.length, { initial: stepQ })
  const i = stepper.index
  useEffect(() => {
    if (i !== stepQ) setStepQ(i)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const f: ExecFrame | undefined = frames[i]
  const regs = f ? f.regs : result.initialRegs
  const prev = i > 0 ? frames[i - 1].regs : result.initialRegs
  const changed = new Set(f?.changedRegs ?? [])
  const mem = useMemo(() => memoryAt(result, f ? i : -1), [result, f, i])

  // Step that last wrote each register, up to the current one.
  const lastWrite = new Array<number>(32).fill(-1)
  if (f) for (let k = i; k >= 0; k--) for (const r of frames[k].changedRegs) if (lastWrite[r] < 0) lastWrite[r] = k

  const optionErrors = program.errors.filter((e) => e.line === 0).map((e) => e.message)
  if (base === undefined) optionErrors.unshift(`${baseText} is not an address`)

  const pick = (v: (typeof RUN_PRESETS)[number]['value']) => {
    setSrc(v.src)
    setRegs(v.regs)
    setMem(v.mem)
    setBase(v.base)
    stepper.first()
  }

  const touched = (a: number, list: { address: number; size: number }[]) => list.some((m) => a >= m.address && a < m.address + m.size)
  const labelAt: Record<number, string[]> = {}
  for (const [name, a] of Object.entries(program.labels)) (labelAt[a] ??= []).push(name)
  const usesLab = /\bsyscall\b|^\s*\.data|\bjal\b/m.test(src)
  const op = f ? OP_BY_NAME[f.instr.mnemonic] : undefined

  const status =
    program.errors.length ? <><Chip signal="miss">error</Chip> Fix the assembly errors to run.</>
    : result.halted === 'error' ? <><Chip signal="miss">error</Chip> {result.error}</>
    : result.halted === 'maxSteps' ? <><Chip signal="stall">stopped</Chip> Stopped after {MAX_STEPS} instructions: the loop may never end.</>
    : <><Chip signal="hit">ended</Chip> Ran to the end in {frames.length} instructions.</>

  const traceRows = frames.slice(Math.max(0, i - 39), i + 1).map((fr, k, a) => ({ fr, step: i - (a.length - 1 - k) })).reverse()
  const traceCols: Column<{ fr: ExecFrame; step: number }>[] = [
    { key: 'n', header: 'Step', align: 'right', cell: (r) => <button type="button" className="mp-link mono" aria-label={`Go to step ${r.step + 1}`} onClick={() => stepper.set(r.step)}>{r.step + 1}</button> },
    { key: 'pc', header: 'PC', mono: true, cell: (r) => hex(r.fr.pc) },
    { key: 'ins', header: 'Instruction', mono: true, cell: (r) => r.fr.instr.text },
    { key: 'fx', header: 'Effect', mono: true, cell: (r) => r.fr.note + (r.fr.taken === undefined ? '' : r.fr.taken ? ' (taken)' : ' (not taken)') },
  ]

  const srcLines = src.split(/\r?\n/)
  const lineCols: Column<LineCount>[] = [
    { key: 'l', header: 'Line', align: 'right', mono: true, cell: (r) => r.line },
    { key: 's', header: 'Source', mono: true, cell: (r) => srcLines[r.line - 1]?.replace(/#.*/, '').trim() },
    { key: 'n', header: 'Times run', align: 'right', mono: true, cell: (r) => r.runs },
    { key: 't', header: 'Branch taken', align: 'right', mono: true, cell: (r) => (r.branches ? `${r.taken} of ${r.branches}` : '') },
  ]

  const regPanel = (
    <div className="mp-regs">
      {regs.map((v, r) => {
        const on = changed.has(r)
        const k = lastWrite[r]
        const why: Explain = r === 0
          ? { rule: '$zero always holds 0; writes to it are discarded', cite: 'L06 p34' }
          : k >= 0
            ? { rule: `Written at step ${k + 1} by ${frames[k].instr.text}`, working: frames[k].note, cite: OP_BY_NAME[frames[k].instr.mnemonic]?.cite }
            : { rule: 'Initial value, not written yet', working: v ? `set in Initial registers: ${regName(r)} = ${v}` : 'registers start at 0' }
        return (
          <div key={on ? `${r}-${i}` : r} className={`mp-reg${on ? ' mp-reg-on' : ''}`}>
            <span className="mp-reg-num mono">{r}</span>
            <span className="mp-reg-name mono">{regName(r)}</span>
            <span className="mp-reg-val mono"><W e={why}>{fmt(v, radix)}</W></span>
            {on ? <span className="mp-reg-was mono">changed, was {fmt(prev[r], radix)}</span> : null}
          </div>
        )
      })}
    </div>
  )

  const memPanel = sim.rows.length === 0 ? (
    <p className="mp-muted">No memory used. Add words under Initial memory or a .data section.</p>
  ) : (
    <>
      <p className="mp-muted">{endian === 'big' ? 'Big' : 'Little'}-endian, word view</p>
      <table className="dtable dtable-compact mp-mem">
        <thead>
          <tr>
            <th>Label</th>
            <th>Address</th>
            <th className="mp-c">+0</th>
            <th className="mp-c">+1</th>
            <th className="mp-c">+2</th>
            <th className="mp-c">+3</th>
            <th className="mp-r">Word</th>
          </tr>
        </thead>
        <tbody>
          {sim.rows.slice(0, MAX_MEM_ROWS).map((a) => {
            const bytes = [0, 1, 2, 3].map((k) => mem[(a + k) >>> 0] ?? 0)
            const w = readWord(mem, a, endian)
            const overlaps = (list: { address: number; size: number }[]) => list.some((m) => m.address < a + 4 && m.address + m.size > a)
            const wrote = f ? overlaps(f.memWrites) : false
            const read = f ? overlaps(f.memReads) : false
            const order = endian === 'big' ? [0, 1, 2, 3] : [3, 2, 1, 0]
            return (
              <tr key={a} className={wrote ? 'row-dirty' : read ? 'row-data' : undefined}>
                <td className="mono">{[0, 1, 2, 3].flatMap((k) => labelAt[a + k] ?? []).join(', ')}</td>
                <td className="mono">{hex(a)}</td>
                {bytes.map((b, k) => {
                  const hit = f && (touched(a + k, f.memWrites) || touched(a + k, f.memReads))
                  return <td key={k} className={`mono mp-c${hit ? ' mp-byte-on' : ''}`}>{b.toString(16).toUpperCase().padStart(2, '0')}</td>
                })}
                <td className="mono mp-r">
                  <W
                    e={{
                      rule: endian === 'big' ? 'Big-endian: the byte at +0 is the most significant' : 'Little-endian: the byte at +0 is the least significant. The online MIPS interpreter uses it (L10 p18). QtSpim on a PC shows words this way too, a lab observation, not a slide fact',
                      working: `${order.map((k) => bytes[k].toString(16).toUpperCase().padStart(2, '0')).join(' ')} = ${hex(w)} = ${w}`,
                      cite: endian === 'big' ? 'R02 p8' : 'L10 p17-18',
                    }}
                  >
                    {fmt(w, radix)}
                  </W>
                  {wrote ? <span className="visually-hidden"> (written this step)</span> : read ? <span className="visually-hidden"> (read this step)</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sim.rows.length > MAX_MEM_ROWS ? <p className="mp-muted">Showing the first {MAX_MEM_ROWS} of {sim.rows.length} words.</p> : null}
    </>
  )

  const countsPanel = (
    <>
      <Facts
        items={[
          [
            'Real instructions run',
            <W e={{ rule: 'Performance counts real instructions: a pseudo-instruction such as bge counts as its 2-instruction expansion', working: `${frames.length} steps in the trace, one per real instruction`, cite: 'L06 p8, T04 Q2' }}>{frames.length}</W>,
          ],
          [
            'Source statements run',
            <W e={{ rule: 'Each source line counted once, as L07 p38 counts ulw as one', working: `${result.statements}`, cite: 'L07 p38' }}>{result.statements}</W>,
          ],
          [
            'Unique bytes read',
            <W e={{ rule: 'Each byte counted once, however many loads read it: a word load reads 4 bytes, lb reads 1', working: `${frames.reduce((n, fr) => n + fr.memReads.length, 0)} loads touch ${sim.uniqueRead} different bytes`, cite: 'L07 p37-38' }}>{sim.uniqueRead}</W>,
          ],
          ['Output', result.output ? <span className="mp-out">{result.output}</span> : <span className="mp-muted">none</span>],
        ]}
      />
      <Callout kind="trap" title="Pseudo-instructions are not free" cite="L06 p8">
        The assembler expands bge, blt, li, la and move, and only the real instructions count.
      </Callout>
    </>
  )

  const stepTraps = f ? (
    <div className="mp-callouts">
      {f.note.includes('discarded') ? (
        <Callout kind="trap" title="$zero ignores writes" cite="L06 p34">
          The result was computed, but $zero always reads 0, so nothing changed.
        </Callout>
      ) : null}
      {f.instr.mnemonic === 'lb' ? (
        <Callout kind="trap" title="lb sign-extends" cite="L07 p11, green card">
          A byte of 0x80 or more loads as a negative number. lbu (on the card, not in lectures) fills with zeros instead.
        </Callout>
      ) : null}
      {op?.kind === 'load' || op?.kind === 'store' ? (
        <Callout kind="trap" title="Addresses step by 4" cite="L07 p10, p15">
          A[i] sits at base + 4i, so walking a word array adds 4, not 1. lw and sw need an address that is a multiple of 4.
        </Callout>
      ) : null}
    </div>
  ) : null

  const stepBody = f ? (
    <div className="mp-step-body">
      <p className="mp-does mono">{f.note}</p>
      <Facts
        items={[
          ['PC', <W e={pcWhy(result, i, program.labels.main !== undefined)}>{hex(f.pc)}</W>],
          ...(f.instr.pseudoOf || (op && !op.lecture)
            ? [[
                'Instruction',
                <>
                  {f.instr.pseudoOf ? <span className="mp-muted">from {f.instr.pseudoOf}</span> : null}
                  {op && !op.lecture ? <> <Chip signal="dontcare" title={`Taught in ${op.cite}`}>not in lectures</Chip></> : null}
                </>,
              ] as [ReactNode, ReactNode]]
            : []),
          ['Machine word', <W e={{ rule: 'The 32-bit encoding of this instruction', cite: 'L08 p12' }}>{hex(f.instr.word)}</W>],
          ...(f.taken === undefined ? [] : [['Branch', f.taken ? <Chip signal="hit">taken</Chip> : <span>not taken</span>] as [ReactNode, ReactNode]]),
          ['Next PC', <W e={nextPcWhy(f)}>{hex(f.nextPc)}</W>],
          ...f.changedRegs.map((r) => [regName(r), `${fmt(prev[r], radix)} -> ${fmt(regs[r], radix)}`] as [ReactNode, ReactNode]),
          ...f.memReads.map((m) => [`Read ${m.size} byte${m.size > 1 ? 's' : ''}`, `${hex(m.address)} -> ${hex(m.value, m.size * 2)}`] as [ReactNode, ReactNode]),
          ...f.memWrites.map((m) => [`Wrote ${m.size} byte${m.size > 1 ? 's' : ''}`, `${hex(m.address)} <- ${hex(m.value, m.size * 2)}`] as [ReactNode, ReactNode]),
          ...(f.output ? [['Printed', f.output] as [ReactNode, ReactNode]] : []),
        ]}
      />
      <details className="mp-more">
        <summary>Working</summary>
        <Steps steps={f.why} label="Working for this step" />
      </details>
      <button type="button" className="mp-quiet" onClick={() => openEncode(f.instr.word, f.instr.address)}>
        Show the encoding
      </button>
      {stepTraps}
    </div>
  ) : null

  // Narrate only the current instruction; the one before and after stay one line each.
  const storyRows = f ? [i - 1, i, i + 1].filter((k) => k >= 0 && k < frames.length) : []

  return (
    <Workspace
      title="MIPS"
      lectures="L06 to L10, T02 to T04, Labs 3 to 5"
      intro={intro}
      toolbar={<Presets presets={RUN_PRESETS} onPick={pick} />}
      transport={
        <Transport
          stepper={stepper}
          label="Instruction"
          marks={frames.map((fr) => (fr.memWrites.length ? 'dirty' : fr.memReads.length ? 'data' : undefined))}
          describe={f ? f.instr.text : undefined}
        />
      }
    >
      <div className="mp-command">
        <p className="mp-status">{status}</p>
        <details className="mp-options" open={editOpen}>
          <summary>Edit the program, registers and memory</summary>
          <div className="mp-prog">
            <CodeEditor
              label="MIPS code"
              value={src}
              onChange={setSrc}
              rows={14}
              marks={f && f.instr.line > 0 ? { [f.instr.line - 1]: 'path' } : undefined}
              errors={errorMap(program.errors)}
            />
            <div className="mp-prog-side">
              <div className="mp-row">
                <TextField label="First instruction at" value={baseText} onChange={setBase} width="8.5em" />
                <Segmented
                  label="Byte order"
                  value={endian}
                  onChange={setEndian}
                  options={[{ value: 'big', label: 'Big', title: 'Course MIPS, R02 p8' }, { value: 'little', label: 'Little', title: 'QtSpim on a PC, L10 p18' }]}
                />
                <Segmented
                  label="jal saves in $ra"
                  value={jal}
                  onChange={setJal}
                  options={[{ value: 'pc+4', label: 'PC+4', title: 'L08 p8 and QtSpim' }, { value: 'pc+8', label: 'PC+8', title: 'Green card' }]}
                />
              </div>
              {optionErrors.length ? <p className="mp-err">{optionErrors.join('; ')}</p> : null}
              <CodeEditor label="Initial registers (one per line, e.g. $t0 = 37)" value={regsText} onChange={setRegs} rows={3} errors={errorMap(sim.regErrors)} />
              <CodeEditor label="Initial memory (address: words, 4 bytes each)" value={memText} onChange={setMem} rows={3} errors={errorMap(sim.memErrors)} />
            </div>
          </div>
        </details>
      </div>

      <div className="mp-stage">
        <div className="mp-board canvas">
          <div className="mp-board-bar">
            <p className="mp-board-title">
              {f ? (
                <>
                  <span className="mp-board-step">Step {i + 1}</span>
                  <span className="mp-muted">of {frames.length}</span>
                  <span className="mono">{f.instr.text}</span>
                </>
              ) : (
                'Nothing has run'
              )}
            </p>
            <div className="mp-board-actions">
              <Segmented label="Numbers" value={radix} onChange={setRadix} options={[{ value: 'hex', label: 'Hex' }, { value: 'dec', label: 'Decimal' }]} />
            </div>
          </div>
          {program.instructions.length ? (
            <ProgramFlow program={program} f={f} step={i} />
          ) : (
            <p className="mp-pad mp-muted">No instructions yet. Write or load a program.</p>
          )}
          {frames.length ? <BoardPlay stepper={stepper} start="Run this program" next="Next instruction" /> : null}
          <div className="mp-board-foot">
            <Legend
              items={[
                { signal: 'path', label: 'current instruction and where the PC goes next' },
                { signal: 'data', label: 'memory read this step' },
                { signal: 'dirty', label: 'memory written this step' },
              ]}
            />
          </div>
        </div>

        {f ? (
          <aside className="mp-story" aria-label="The current instruction">
            <ol className="mp-story-steps">
              {storyRows.map((k) => (
                <li key={k} className={k === i ? 'is-now' : k < i ? 'is-past' : 'is-next'}>
                  <button type="button" className="mp-story-btn" onClick={() => stepper.set(k)} aria-current={k === i ? 'step' : undefined}>
                    <span className="mp-story-dot" aria-hidden="true" />
                    <span className="mp-story-n">{k + 1}</span>
                    <span className="mono">{frames[k].instr.text}</span>
                  </button>
                  {k === i ? stepBody : null}
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
      </div>

      <section className="mp-details" aria-label="Registers, memory and tables">
        <Tabs label="Tables" value={detail} onChange={setDetail} tabs={DETAIL_TABS} />
        <div className="mp-detail-body">
          {detail === 'regs' ? regPanel : null}
          {detail === 'mem' ? memPanel : null}
          {detail === 'trace' ? (
            frames.length ? (
              <>
                <p className="mp-muted">Newest first, last 40 steps</p>
                <DataTable columns={traceCols} rows={traceRows} rowSignal={(r) => (r.step === i ? 'path' : undefined)} compact />
              </>
            ) : (
              <p className="mp-muted">No instructions executed.</p>
            )
          ) : null}
          {detail === 'lines' ? (
            sim.profile.length ? (
              <DataTable compact rows={sim.profile} rowSignal={(r) => (f && r.line === f.instr.line ? 'path' : undefined)} columns={lineCols} />
            ) : (
              <p className="mp-muted">No instructions executed.</p>
            )
          ) : null}
          {detail === 'counts' ? countsPanel : null}
          {detail === 'notes' ? (
            <div className="mp-callouts">
              <Callout kind="course" title="Byte order" cite="R02 p8, L10 p17-18">
                The course&apos;s MIPS is big-endian; QtSpim on a PC is little-endian. Only words and halfwords change: strings and byte arrays look the same in both.
              </Callout>
              <Callout kind="course" title="Return address of jal" cite="L08 p8, Lab 5 p3">
                The lecture summary and QtSpim save PC+4 in $ra. The green card says PC+8. Pick the one your question uses.
              </Callout>
              {usesLab ? (
                <Callout kind="beyond" title="Beyond the lectures: syscall, .data and jal">
                  These come from the labs (Lab 3 to 5), not the lecture slides. The tracer runs them as QtSpim does.
                </Callout>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </Workspace>
  )
}
