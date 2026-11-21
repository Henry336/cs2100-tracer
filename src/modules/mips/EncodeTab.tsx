import { useMemo, type ReactNode } from 'react'
import {
  OP_BY_NAME,
  assemble,
  bin,
  branchOffsetExplain,
  checkAnswer,
  decode,
  explainEncoding,
  hex,
  instrText,
  jumpTargetExplain,
  likelyMistakes,
  parseWord,
  signExt16,
  type AsmError,
  type FieldCheck,
  type Instr,
} from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Board, Details, Options } from '../../ui/board'
import { Callout, Chip, CodeEditor, DataTable, Legend, Presets, Segmented, TextField, Workspace, type Column } from '../../ui/kit'
import { Facts, Steps, W, parseAddress } from './common'
import { BranchRuler, FieldGrid, JumpSplice } from './diagrams'
import { ENCODE_PRESETS } from './presets'

const START = ENCODE_PRESETS[0].value

/** Encode tab inputs live in the URL; the Run tab also writes them to open an instruction here. */
export function useEncodeState() {
  const [mode, setMode] = useUrlState<'asm' | 'hex'>('emode', START.mode)
  const [asmText, setAsm] = useUrlState('easm', START.text)
  const [hexText, setHex] = useUrlState('ehex', '0x8D8BFF1D')
  const [base, setBase] = useUrlState('ebase', START.base)
  const [sel, setSel] = useUrlState('esel', START.sel)
  const [jumpOp, setJumpOp] = useUrlState<'field' | 'address'>('ejump', 'field')
  return { mode, setMode, asmText, setAsm, hexText, setHex, base, setBase, sel, setSel, jumpOp, setJumpOp }
}

function decodeWords(text: string, base: number): { instrs: Instr[]; errors: AsmError[] } {
  const instrs: Instr[] = []
  const errors: AsmError[] = []
  let addr = base
  text.split(/\r?\n/).forEach((raw, li) => {
    for (const t of raw.split(/[\s,]+/).filter(Boolean)) {
      const v = parseWord(t)
      const d = v === undefined ? { error: `${t} is not a 32-bit word` } : decode(v, addr)
      if ('error' in d) errors.push({ line: li + 1, message: `${t}: ${d.error}` })
      else instrs.push({ ...d, line: li + 1 })
      addr = (addr + 4) >>> 0
    }
  })
  return { instrs, errors }
}

const errorMap = (errors: AsmError[]) => Object.fromEntries(errors.filter((e) => e.line > 0).map((e) => [e.line - 1, e.message]))

export default function EncodeTab({ intro }: { intro: ReactNode }) {
  const s = useEncodeState()
  const [answer, setAnswer] = useUrlState('eans', '')
  const base = parseAddress(s.base)
  const { instrs, errors } = useMemo(() => {
    const b = base ?? 0
    if (s.mode === 'hex') return decodeWords(s.hexText, b)
    const p = assemble(s.asmText, { textBase: b, jumpOperand: s.jumpOp })
    return { instrs: p.instructions, errors: p.errors }
  }, [s.mode, s.asmText, s.hexText, base, s.jumpOp])

  const sel = Math.max(0, Math.min(instrs.length - 1, s.sel))
  const ins: Instr | undefined = instrs[sel]
  const ex = ins ? explainEncoding(ins) : undefined
  const op = ins ? OP_BY_NAME[ins.mnemonic] : undefined
  const kind = op?.kind
  const b = ins && kind === 'branch' ? branchOffsetExplain(ins.address, ins.targetAddress ?? 0) : undefined
  const jx = ins && kind === 'jump' ? jumpTargetExplain(ins.address, ins.targetAddress ?? 0, ins.mnemonic as 'j' | 'jal') : undefined
  const raw16 = ins ? ins.word & 0xffff : 0
  const negImm = ins?.format === 'I' && kind !== 'logicImm' && kind !== 'lui' && ins.imm < 0
  const check = ins ? checkAnswer(ins, answer) : undefined
  const mistakes = ins ? likelyMistakes(ins) : []
  const extUsed = kind === 'lui' ? 'lui' : kind === 'logicImm' ? 'zero' : 'sign'
  const usedChip = (k: typeof extUsed) => (extUsed === k && ins ? <> <Chip signal="path">used by {ins.mnemonic}</Chip></> : null)
  const diffCols: Column<FieldCheck>[] = [
    { key: 'f', header: 'Field', cell: (f) => f.name },
    { key: 'b', header: 'Bits', mono: true, cell: (f) => `${f.bits[0]}-${f.bits[1]}` },
    { key: 'e', header: 'Right', mono: true, cell: (f) => f.expected },
    { key: 'g', header: 'Yours', mono: true, cell: (f) => f.given },
    { key: 'ok', header: 'Match', cell: (f) => (f.ok ? 'same' : 'differs') },
  ]

  const optionErrors = errors.filter((e) => e.line === 0).map((e) => e.message)
  if (base === undefined) optionErrors.unshift(`${s.base} is not an address`)

  const pick = (v: (typeof ENCODE_PRESETS)[number]['value']) => {
    s.setMode(v.mode)
    if (v.mode === 'asm') s.setAsm(v.text)
    else s.setHex(v.text)
    s.setBase(v.base)
    s.setSel(v.sel)
  }

  const cols: Column<Instr>[] = [
    {
      key: 'pick',
      header: 'Show',
      cell: (_r, k) => (
        <button type="button" className="mp-link mono" aria-pressed={k === sel} onClick={() => s.setSel(k)}>
          {k + 1}
        </button>
      ),
    },
    { key: 'a', header: 'Address', mono: true, cell: (r) => hex(r.address) },
    { key: 'w', header: 'Word', mono: true, cell: (r) => hex(r.word) },
    { key: 't', header: 'Assembly', mono: true, cell: (r) => r.text },
    { key: 'n', header: 'With numbers', mono: true, cell: (r) => instrText(r, 'number') },
    { key: 'f', header: 'Format', align: 'center', cell: (r) => r.format },
  ]

  const facts: [ReactNode, ReactNode][] = ins && ex
    ? [
        ['Assembly', <>{ins.text}{ins.pseudoOf ? <span className="mp-muted"> from {ins.pseudoOf}</span> : null}</>],
        ['With register numbers', instrText(ins, 'number')],
        ['Format', <W e={ex.steps[0]}>{ex.format}-format</W>],
        ['Address', hex(ins.address)],
        ['Binary', <W e={ex.steps[2]}>{ex.fields.map((f) => f.binary).join(' ')}</W>],
        ['Hex', <W e={ex.steps[3]}>{ex.hex}</W>],
        ['Exam format', <W e={{ rule: 'Examplify blanks want 8 hex digits in capitals with no 0x', cite: 'AY23/24 S2 Q16e' }}>{ex.examplify}</W>],
      ]
    : []

  const traps = ins ? (
    <div className="mp-callouts">
      {kind === 'arith' ? (
        <Callout kind="trap" title="Destination first in assembly, third in the bits" cite="L08 p12">
          You write rd, rs, rt, but the bits go rs, rt, rd.
        </Callout>
      ) : null}
      {kind === 'shift' ? (
        <Callout kind="trap" title="Shifts read rt, not rs" cite="L08 p13, p15">
          The source register goes in rt and rs is 0. The amount goes in shamt, 0 to 31.
        </Callout>
      ) : null}
      {kind === 'branch' ? (
        <>
          <Callout kind="trap" title="The first register is rs" cite="L08 p34">
            In beq and bne the register written first goes in rs, the second in rt.
          </Callout>
          <Callout kind="trap" title="Count from PC+4, in words" cite="L08 p27-28">
            The immediate is (target - (PC+4)) / 4.{' '}
            {b && b.aligned && b.imm !== 0
              ? `Counting from the branch gives ${b.mistakes.fromPc}. Forgetting the / 4 gives ${b.mistakes.bytes}.`
              : 'Counting from the branch is one off. Forgetting the / 4 makes it 4 times too big.'}
          </Callout>
        </>
      ) : null}
      {kind === 'logicImm' ? (
        <Callout kind="trap" title="andi, ori and xori zero-extend" cite="L06 p46, L08 p19">
          Their immediate fills the top 16 bits with 0, so ori with 0xFFFF gives 0x0000FFFF, not -1.
        </Callout>
      ) : null}
      {kind === 'lui' ? (
        <Callout kind="trap" title="Fill the lower half with ori, not addi" cite="L06 p44, p46">
          addi sign-extends, so a lower half with bit 15 set would change the upper half that lui loaded.
        </Callout>
      ) : null}
      {kind === 'load' || kind === 'store' ? (
        <Callout kind="trap" title="The offset counts bytes" cite="L07 p10, L08 p22">
          A[3] is 12 bytes from A[0]. A branch immediate counts words instead.
        </Callout>
      ) : null}
      {kind === 'jump' ? (
        <Callout kind="trap" title="Only bits 27 to 2 are stored" cite="L08 p37-40">
          The top 4 bits come from PC+4 when the jump runs, not from PC. They never replace the opcode. A j in the last word of a 256 MB block lands in the next block.
        </Callout>
      ) : null}
      {jx?.blockEdge ? (
        <Callout kind="trap" title="This j sits at the end of a block" cite="L08 p39-40">
          PC+4 is already in the next 256 MB block, so the jump lands there.
        </Callout>
      ) : null}
      {negImm ? (
        <Callout kind="trap" title={`${hex(raw16, 4)} is negative`} cite="L08 p21">
          Bit 15 is 1, so in 16-bit 2s complement {hex(raw16, 4)} is {ins.imm}, not {raw16}. It is sign-extended before use.
        </Callout>
      ) : null}
      {kind === 'jump' && s.mode === 'asm' ? (
        <Callout kind="course" title="What a number after j means" cite="L08 p8, R04 p44">
          The lecture reads j 2500 as the target field, so it goes to 10000. QtSpim reads the number as a byte address. Choose under Start address and options.
        </Callout>
      ) : null}
      {op && !op.lecture ? (
        <Callout kind="beyond" title={`Beyond the lectures: ${op.mnemonic}`} cite={op.cite}>
          {op.mnemonic} is on the green card or in the labs, but the lectures do not teach it (T02 p1). Values come from the {op.source}.
        </Callout>
      ) : null}
    </div>
  ) : null

  const numbers = ins ? (
    <div className="mp-numbers">
      <Facts items={facts} />
      {ins.format === 'I' ? (
        <div>
          <p className="control-label mp-gap">Immediate, 16 bits to 32</p>
          <Facts
            items={[
              ['16-bit field', `${hex(raw16, 4)} = ${bin(raw16, 16)}`],
              [
                'Sign-extended',
                <>
                  <W e={{ rule: 'Copy bit 15 into bits 31 to 16, so the value stays the same', working: `bit 15 is ${raw16 >> 15}: ${hex(signExt16(raw16))} = ${signExt16(raw16)}`, cite: 'L06 p33, L08 p19' }}>{hex(signExt16(raw16))}</W>
                  {usedChip('sign')}
                </>,
              ],
              [
                'Zero-extended',
                <>
                  <W e={{ rule: 'Fill bits 31 to 16 with 0', working: `${hex(raw16)} = ${raw16}`, cite: 'L06 p46, L08 p19' }}>{hex(raw16)}</W>
                  {usedChip('zero')}
                </>,
              ],
              ...(kind === 'lui'
                ? [[
                    'lui result',
                    <>
                      <W e={{ rule: 'lui puts the 16 bits in the upper half and clears the lower half', working: `${hex(raw16, 4)} << 16 = ${hex(raw16 * 0x10000)}`, cite: 'L06 p44' }}>{hex(raw16 * 0x10000)}</W>
                      {usedChip('lui')}
                    </>,
                  ] as [ReactNode, ReactNode]]
                : []),
            ]}
          />
        </div>
      ) : null}
      {b ? (
        <div>
          <p className="control-label mp-gap">Branch offset</p>
          <Facts
            items={[
              ['PC (this branch)', hex(b.pc)],
              ['PC+4', <W e={b.steps[0]}>{hex(b.pcPlus4)}</W>],
              ['Target', hex(b.target)],
              ['Byte distance', <W e={b.steps[1]}>{b.byteOffset}</W>],
              ['Immediate', b.aligned ? <W e={b.steps[2]}>{b.imm}</W> : 'none: target not word-aligned'],
              ...(b.steps[3] ? [['16-bit field', <W e={b.steps[3]}>{b.imm16}</W>] as [ReactNode, ReactNode]] : []),
              ['Reachable', <W e={{ rule: 'A 16-bit immediate reaches -32768 to 32767 words from PC+4', cite: 'L08 p21, p42' }}>{hex(b.reach.min)} to {hex(b.reach.max)}</W>],
            ]}
          />
        </div>
      ) : null}
      {jx ? (
        <div>
          <p className="control-label mp-gap">Jump target</p>
          <Facts
            items={[
              ['PC+4', <W e={jx.steps[0]}>{hex(jx.pcPlus4)}</W>],
              ['Target field', <W e={jx.steps[2]}>{hex(jx.field, 7)}</W>],
              ['Target address', <W e={{ rule: 'New PC = {PC+4[31:28], target field, 00}', working: `${hex(jx.pcPlus4 >>> 28, 1)} | ${hex(jx.field, 7)} << 2 = ${hex(jx.target)}`, cite: 'L08 p39' }}>{hex(jx.target)}</W>],
              ['256 MB block', <W e={jx.steps[1]}>{hex(jx.block.start)} to {hex(jx.block.end)}</W>],
            ]}
          />
        </div>
      ) : null}
    </div>
  ) : null

  const checkPanel = ins ? (
    <div>
      <TextField label={`Your hex for ${ins.text}`} value={answer} onChange={setAnswer} placeholder="e.g. 012A4020" width="10em" />
      {check?.error ? <p className="mp-err">{check.error}</p> : null}
      {check?.given !== undefined ? (
        <>
          <p className="mp-status mp-check">
            {check.ok ? <Chip signal="hit">right</Chip> : <Chip signal="miss">wrong</Chip>}
            {check.ok ? `${hex(check.given)} matches.` : `${hex(check.given)} differs in ${check.fields.filter((f) => !f.ok).map((f) => f.name).join(', ')}.`}
          </p>
          <DataTable compact columns={diffCols} rows={check.fields} rowSignal={(f) => (f.ok ? undefined : 'miss')} />
          {check.mistake ? (
            <Callout kind="trap" title={`Known mistake: ${check.mistake.label}`} cite={check.mistake.why.cite}>
              {check.mistake.why.rule}.
            </Callout>
          ) : null}
        </>
      ) : null}
      {mistakes.length ? (
        <>
          <p className="control-label mp-gap">Common wrong answers</p>
          <Facts items={mistakes.map((m): [ReactNode, ReactNode] => [m.label, <W e={m.why}>{hex(m.word)}</W>])} />
        </>
      ) : null}
    </div>
  ) : null

  const lineCount = (s.mode === 'asm' ? s.asmText : s.hexText).split('\n').length

  return (
    <Workspace title="MIPS" lectures="L08, R04, T03 to T04" intro={intro} toolbar={<Presets presets={ENCODE_PRESETS} onPick={pick} />}>
      <div className="mp-command">
        <div className="mp-command-row">
          <Segmented label="Input" value={s.mode} onChange={s.setMode} options={[{ value: 'asm', label: 'Encode assembly' }, { value: 'hex', label: 'Decode hex words' }]} />
          <Options summary="Start address and options">
            <div className="mp-row">
              <TextField label="First instruction at" value={s.base} onChange={s.setBase} width="8.5em" />
              {s.mode === 'asm' ? (
                <Segmented
                  label="Number after j means"
                  value={s.jumpOp}
                  onChange={s.setJumpOp}
                  options={[{ value: 'field', label: 'Target field', title: 'L08 p8' }, { value: 'address', label: 'Byte address', title: 'QtSpim' }]}
                />
              ) : null}
            </div>
          </Options>
        </div>
        {optionErrors.length ? <p className="mp-err">{optionErrors.join('; ')}</p> : null}
        <div className="mp-editor">
          {s.mode === 'asm' ? (
            <CodeEditor label="Assembly, labels allowed (one instruction per line)" value={s.asmText} onChange={s.setAsm} rows={Math.min(5, Math.max(2, lineCount))} errors={errorMap(errors)} />
          ) : (
            <CodeEditor label="32-bit words, e.g. 0x012A4020 (one or more per line)" value={s.hexText} onChange={s.setHex} rows={Math.min(5, Math.max(2, lineCount))} errors={errorMap(errors)} />
          )}
        </div>
      </div>

      <Board
        title={ins && ex ? <span className="mono">{ins.text}</span> : 'Type an instruction or a word'}
        step={ins && ex ? <span className="mono"><W e={ex.steps[3]}>{ex.hex}</W></span> : undefined}
        tools={
          instrs.length > 1 ? (
            <div className="mp-picks" role="group" aria-label="Instruction to show">
              {instrs.map((x, k) => (
                <button key={k} type="button" className="mp-pick mono" aria-pressed={k === sel} onClick={() => s.setSel(k)}>
                  {x.text}
                </button>
              ))}
            </div>
          ) : null
        }
        foot={
          <div className="mp-foot">
            <Legend
              items={[
                { signal: 'control', label: 'opcode and funct' },
                { signal: 'data', label: 'immediate, shamt, target' },
                { signal: 'path', label: 'PC and where it goes next' },
                ...(check?.given !== undefined && !check.ok ? [{ signal: 'miss' as const, label: 'field that differs in your answer' }] : []),
              ]}
            />
            <span className="mp-muted">Dashed fields are fixed at 0.</span>
          </div>
        }
      >
        {ins && ex ? (
          <>
            <FieldGrid ex={ex} />
            {b ? <BranchRuler b={b} /> : null}
            {jx ? <JumpSplice jx={jx} instr={ins} /> : null}
          </>
        ) : null}
      </Board>

      {ins && ex ? (
        <Details
          urlKey="edt"
          label="Working and checks for this instruction"
          tabs={[
            { value: 'work', label: 'Working', body: <Steps steps={ex.steps} label="Encoding steps" /> },
            { value: 'check', label: 'Check your answer', body: s.mode === 'asm' ? checkPanel : null },
            { value: 'nums', label: 'All numbers', body: numbers },
            {
              value: 'list',
              label: 'Instructions',
              body: instrs.length > 1 ? <DataTable columns={cols} rows={instrs} rowSignal={(_, k) => (k === sel ? 'path' : undefined)} compact /> : null,
            },
            { value: 'traps', label: 'Watch out', body: traps },
          ]}
        />
      ) : null}
    </Workspace>
  )
}
