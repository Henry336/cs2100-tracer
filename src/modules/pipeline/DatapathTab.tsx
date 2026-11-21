// Tab 2: the L20 pipelined datapath (L20 p29) with the 4 pipeline registers, one cycle at a time.
import { useMemo, type ReactNode } from 'react'
import { controlRow, PIPE_REGS, regLabel, STAGES, type ControlRow, type CycleFrame, type PipeReg, type PipelineTrace, type RegContents, type Stage } from '../../core/pipeline'
import type { Instr } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, Legend, Toggle, Workspace } from '../../ui/kit'
import { Transport } from '../../ui/Transport'
import { Board, Details, Flow, PlayBar, Stage as Layout } from '../../ui/board'
import { Notes, PresetPicker, Setup, describeFrame, frameMarks, lineMarks, type ProgramState } from './common'
import { CycleStory, useCycleStepper } from './DiagramTab'

type Ctl = ControlRow
type Need = (c: Ctl, ins: Instr) => boolean

const any: Need = () => true
const isI = (ins: Instr) => ins.format === 'I'
const readsRs: Need = (_c, ins) => ins.format !== 'J'
const readsRt: Need = (c, ins) => ins.format === 'R' || c.M.MemWrite === 1 || c.M.Branch === 1
const writes = (c: Ctl) => c.WB.RegWrite === 1

/** The write register number from MEM/WB to the register file; in bug mode it comes from IF/ID instead (L20 p22-23). */
const WB_WRITE_REG = 'M844 370H940V404H258V260H270'
const BUG_WRITE_REG = 'M214 345H250V260H270'

/** Wires of the pipelined datapath, each used by the instruction in its stage when `need` holds. */
const WIRES: { stage: Stage; d: string; need: Need; ctl?: boolean }[] = [
  // IF: PC, instruction memory, PC + 4
  { stage: 'IF', d: 'M24 225H34', need: any },
  { stage: 'IF', d: 'M64 225H92', need: any },
  { stage: 'IF', d: 'M78 225V96H92', need: any },
  { stage: 'IF', d: 'M76 118H92', need: any },
  { stage: 'IF', d: 'M142 105H200', need: any },
  { stage: 'IF', d: 'M152 105V40H8V212H12', need: any },
  { stage: 'IF', d: 'M172 225H200', need: any },
  // ID: register reads, sign extension, control, fields carried on
  { stage: 'ID', d: 'M214 190H270', need: readsRs },
  { stage: 'ID', d: 'M214 215H270', need: readsRt },
  { stage: 'ID', d: 'M214 330H300', need: (_c, i) => isI(i) },
  { stage: 'ID', d: 'M370 195H430', need: readsRs },
  { stage: 'ID', d: 'M370 240H430', need: readsRt },
  { stage: 'ID', d: 'M350 330H430', need: (_c, i) => isI(i) },
  { stage: 'ID', d: 'M214 105H430', need: any },
  { stage: 'ID', d: 'M232 330V360H430', need: writes },
  { stage: 'ID', d: 'M240 330V380H430', need: writes },
  { stage: 'ID', d: 'M214 82H262', need: any },
  { stage: 'ID', d: 'M330 82H430', need: any, ctl: true },
  // EX: ALU and its source mux, branch target adder, RegDst mux
  { stage: 'EX', d: 'M444 195H540', need: readsRs },
  { stage: 'EX', d: 'M444 240H505', need: (c) => c.EX.ALUSrc === 0 },
  { stage: 'EX', d: 'M444 330H488V270H505', need: (c) => c.EX.ALUSrc === 1 },
  { stage: 'EX', d: 'M519 255H540', need: (_c, i) => i.format !== 'J' },
  { stage: 'EX', d: 'M444 105H530', need: (c) => c.M.Branch === 1 },
  { stage: 'EX', d: 'M488 330V150H498', need: (c) => c.M.Branch === 1 },
  { stage: 'EX', d: 'M522 150H530V125', need: (c) => c.M.Branch === 1 },
  { stage: 'EX', d: 'M580 110H650', need: (c) => c.M.Branch === 1 },
  { stage: 'EX', d: 'M590 235H650', need: (_c, i) => i.format !== 'J' },
  { stage: 'EX', d: 'M590 212H650', need: (c) => c.M.Branch === 1 },
  { stage: 'EX', d: 'M470 240V300H650', need: (c) => c.M.MemWrite === 1 },
  { stage: 'EX', d: 'M444 360H510', need: (c) => writes(c) && c.EX.RegDst === 0 },
  { stage: 'EX', d: 'M444 380H510', need: (c) => writes(c) && c.EX.RegDst === 1 },
  { stage: 'EX', d: 'M524 370H650', need: writes },
  { stage: 'EX', d: 'M444 82H650', need: any, ctl: true },
  { stage: 'EX', d: 'M444 90H512V240', need: any, ctl: true },
  { stage: 'EX', d: 'M444 395H517V390', need: any, ctl: true },
  // MEM: data memory, branch decision (PCSrc = Branch AND isZero)
  { stage: 'MEM', d: 'M664 235H720', need: (c) => c.M.MemRead === 1 || c.M.MemWrite === 1 },
  { stage: 'MEM', d: 'M664 300H700V270H720', need: (c) => c.M.MemWrite === 1 },
  { stage: 'MEM', d: 'M810 235H830', need: (c) => c.M.MemRead === 1 },
  { stage: 'MEM', d: 'M680 235V330H830', need: (c) => writes(c) && c.WB.MemToReg === 0 },
  { stage: 'MEM', d: 'M664 370H830', need: writes },
  { stage: 'MEM', d: 'M664 82H830', need: any, ctl: true },
  { stage: 'MEM', d: 'M664 212H690V62H700', need: (c) => c.M.Branch === 1, ctl: true },
  { stage: 'MEM', d: 'M664 88H678V74H700', need: (c) => c.M.Branch === 1, ctl: true },
  { stage: 'MEM', d: 'M724 68H740V24H18V205', need: (c) => c.M.Branch === 1, ctl: true },
  { stage: 'MEM', d: 'M664 110H760V16H4V240H12', need: (c) => c.M.Branch === 1 },
  // WB: MemToReg mux, write back to the register file
  { stage: 'WB', d: 'M844 235H880', need: (c) => writes(c) && c.WB.MemToReg === 1 },
  { stage: 'WB', d: 'M844 330H868V262H880', need: (c) => writes(c) && c.WB.MemToReg === 0 },
  { stage: 'WB', d: 'M894 248H960V412H250V280H270', need: writes },
  { stage: 'WB', d: WB_WRITE_REG, need: writes },
  { stage: 'WB', d: 'M844 82H887V220', need: any, ctl: true },
]

const STAGE_X: Record<Stage, [number, number]> = { IF: [0, 200], ID: [214, 430], EX: [444, 650], MEM: [664, 830], WB: [844, 1000] }
const REG_X: Record<PipeReg, number> = { 'IF/ID': 200, 'ID/EX': 430, 'EX/MEM': 650, 'MEM/WB': 830 }

interface Occupant {
  uid: string | null
  name: string
  text: string
  status: 'active' | 'bubble' | 'wrong' | 'idle'
  ins?: Instr
  ctl?: Ctl
}

function occupants(t: PipelineTrace, f: CycleFrame | undefined): Record<Stage, Occupant> {
  const out = {} as Record<Stage, Occupant>
  const byUid = new Map(t.rows.map((r) => [r.uid, r]))
  for (const s of STAGES) {
    const uid = f?.stages[s] ?? null
    const r = uid ? byUid.get(uid) : undefined
    const ins = r && r.index !== null ? t.stream.program.instructions[r.index] : undefined
    if (!r) {
      // A stage with no instruction after IF holds a bubble once the pipe has filled.
      const filled = f && STAGES.indexOf(s) > 0 && f.cycle > STAGES.indexOf(s)
      out[s] = { uid: null, name: filled ? 'bubble' : 'idle', text: '', status: filled ? 'bubble' : 'idle' }
    } else out[s] = { uid, name: r.name, text: r.text, status: r.wrongPath ? 'wrong' : 'active', ...(ins ? { ins, ctl: controlRow(ins) } : {}) }
  }
  return out
}

function Diagram({ t, f, bug, focus }: { t: PipelineTrace; f: CycleFrame | undefined; bug: boolean; focus: boolean }) {
  const occ = occupants(t, f)
  const early = t.options.branchStage === 'ID'
  const forwards = (f?.forwards ?? []).filter((x) => x.from !== 'register file')
  const rl = (r: number) => regLabel(r, t.stream.regStyle)
  const consumerIns = (seq: number) => t.stream.items[seq - 1]?.instr
  // Forwarding paths this cycle (L21 p18, p38-39), from the producer's pipeline register back to the ALU input or the ID comparator.
  const fwd = forwards.map((x) => {
    const srcX = x.from === 'EX/MEM' ? 672 : 900
    const srcY = x.from === 'EX/MEM' ? 235 : 248
    const lane = x.from === 'EX/MEM' ? 172 : 162
    if (x.to === 'ID') return { d: `M${srcX} ${srcY}V${lane}H414V151`, lx: (srcX + 414) / 2, ly: lane - 4, text: `${x.path}: ${rl(x.register)}` }
    const ins = consumerIns(x.consumer)
    const toB = x.input === 'ForwardB' || (!x.input && ins && ins.rt === x.register && ins.rs !== x.register)
    const tx = toB ? 534 : 528
    const ty = toB ? 255 : 200
    return { d: `M${srcX} ${srcY}V${lane}H${tx}V${ty}H540`, lx: (srcX + tx) / 2, ly: lane - 4, text: `${x.path}: ${rl(x.register)}${x.input ? ` (${x.input})` : ''}` }
  })
  const box =(x: number, y: number, w: number, h: number, label: ReactNode, s: Stage) => (
    <g className={`pl-unit${occ[s].status === 'active' || occ[s].status === 'wrong' ? ' pl-unit-on' : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={3} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  )
  return (
    <svg className={`pl-dp${focus ? ' pl-focus' : ''}`} viewBox="0 -64 1000 490" role="img" aria-label={`Pipelined datapath in cycle ${f?.cycle ?? 0}: ${STAGES.map((s) => `${s} ${occ[s].name}`).join(', ')}`}>
      {/* Stage bands and the instruction in each stage */}
      {STAGES.map((s) => {
        const [x0, x1] = STAGE_X[s]
        const o = occ[s]
        const cx = (x0 + x1) / 2
        return (
          <g key={s}>
            <rect x={x0} y={-12} width={x1 - x0} height={436} className={`pl-band pl-band-${o.status}`} />
            <text x={cx} y={-46} textAnchor="middle" className="pl-dp-stage">
              {s}
            </text>
            <text x={cx} y={-28} textAnchor="middle" className={`pl-dp-who pl-who-${o.status}`}>
              {o.status === 'wrong' ? `${o.name} (wrong path)` : o.name}
            </text>
            <text x={cx} y={-14} textAnchor="middle" className="pl-dp-text">
              {o.text.length > 26 ? `${o.text.slice(0, 25)}...` : o.text}
            </text>
          </g>
        )
      })}

      {/* Wires: lit when the instruction in that stage uses them */}
      {WIRES.map((w, i) => {
        const o = occ[w.stage]
        const on = !!(o.ctl && o.ins && w.need(o.ctl, o.ins))
        return <path key={i} d={bug && w.d === WB_WRITE_REG ? BUG_WRITE_REG : w.d} className={`pl-wire${w.ctl ? ' pl-wire-ctl' : ''}${on ? ' pl-on' : ''}${on && o.status === 'wrong' ? ' pl-on-wrong' : ''}`} />
      })}
      {/* Light along the data wires each stage uses this cycle: draws in, then packets flow (decorative). */}
      {(() => {
        const lit = WIRES.map((w, i) => ({ w, i, o: occ[w.stage] })).filter(({ w, o }) => !w.ctl && o.status !== 'wrong' && !!(o.ctl && o.ins && w.need(o.ctl, o.ins)))
        const d = (w: (typeof WIRES)[number]) => (bug && w.d === WB_WRITE_REG ? BUG_WRITE_REG : w.d)
        return <Flow id={f?.cycle ?? 0} paths={lit.map(({ w }) => d(w))} />
      })()}

      {/* Units */}
      <g className={`pl-part${occ.IF.ins ? ' pl-unit-on' : ''}`}>
        <polygon points="12,200 24,208 24,242 12,250" className={`pl-mux${occ.IF.ins ? ' pl-unit-on' : ''}`} />
        <text x={18} y={262} textAnchor="middle" className="pl-dp-small">PCSrc</text>
      </g>
      {box(34, 200, 30, 50, 'PC', 'IF')}
      {box(92, 180, 80, 90, 'Inst mem', 'IF')}
      {box(92, 80, 50, 50, 'Add', 'IF')}
      <g className={`pl-part${occ.IF.ins ? ' pl-unit-on' : ''}`}>
        <text x={72} y={122} textAnchor="end" className="pl-dp-small">4</text>
      </g>

      {box(270, 170, 100, 125, 'Registers', 'ID')}
      <g className={`pl-part${occ.ID.status === 'active' || occ.ID.status === 'wrong' ? ' pl-unit-on' : ''}`}>
        <text x={274} y={194} className="pl-dp-port">RR1</text>
        <text x={274} y={219} className="pl-dp-port">RR2</text>
        <text x={274} y={264} className="pl-dp-port">WR</text>
        <text x={274} y={284} className="pl-dp-port">WD</text>
        <text x={366} y={199} textAnchor="end" className="pl-dp-port">RD1</text>
        <text x={366} y={244} textAnchor="end" className="pl-dp-port">RD2</text>
      </g>
      <g className={`pl-unit${occ.ID.ins ? ' pl-unit-on' : ''}`}>
        <ellipse cx={325} cy={330} rx={25} ry={16} />
        <text x={325} y={334} textAnchor="middle" className="pl-dp-small">Sign ext</text>
        <ellipse cx={296} cy={82} rx={34} ry={16} className="pl-ctlunit" />
        <text x={296} y={86} textAnchor="middle" className="pl-dp-small">Control</text>
      </g>
      {early ? (
        <g className={`pl-unit${occ.ID.ctl?.M.Branch === 1 ? ' pl-unit-on' : ''}`}>
          <rect x={384} y={140} width={30} height={22} rx={3} />
          <text x={399} y={155} textAnchor="middle" className="pl-dp-small">=</text>
          <text x={399} y={134} textAnchor="middle" className="pl-dp-small">early branch</text>
        </g>
      ) : null}

      <g className={`pl-part${occ.EX.ins ? ' pl-unit-on' : ''}`}>
        <polygon points="505,236 519,244 519,276 505,284" className={`pl-mux${occ.EX.ins ? ' pl-unit-on' : ''}`} />
        <text x={512} y={296} textAnchor="middle" className="pl-dp-small">ALUSrc</text>
        <polygon points="540,185 590,205 590,265 540,285 540,250 550,235 540,220" className={`pl-alu${occ.EX.ins ? ' pl-unit-on' : ''}`} />
        <text x={570} y={239} textAnchor="middle" className="pl-dp-small">ALU</text>
        <text x={594} y={209} className="pl-dp-port">isZero</text>
      </g>
      <g className={`pl-unit${occ.EX.ctl?.M.Branch === 1 ? ' pl-unit-on' : ''}`}>
        <ellipse cx={510} cy={150} rx={12} ry={14} />
        <text x={510} y={154} textAnchor="middle" className="pl-dp-port">x4</text>
        <rect x={530} y={92} width={50} height={40} rx={3} />
        <text x={555} y={116} textAnchor="middle" className="pl-dp-small">Add</text>
      </g>
      <g className={`pl-part${occ.EX.ctl?.WB.RegWrite === 1 ? ' pl-unit-on' : ''}`}>
        <polygon points="510,352 524,358 524,388 510,394" className={`pl-mux${occ.EX.ctl?.WB.RegWrite === 1 ? ' pl-unit-on' : ''}`} />
        <text x={517} y={408} textAnchor="middle" className="pl-dp-small">RegDst</text>
      </g>

      {box(720, 190, 90, 100, 'Data mem', 'MEM')}
      <g className={`pl-part${occ.MEM.ctl?.M.Branch === 1 ? ' pl-unit-on' : ''}`}>
        <path d="M700 54H712A14 14 0 0 1 712 82H700Z" className={`pl-gate${occ.MEM.ctl?.M.Branch === 1 ? ' pl-unit-on' : ''}`} />
        <text x={712} y={48} textAnchor="middle" className="pl-dp-small">AND</text>
      </g>

      <g className={`pl-part${occ.WB.ctl?.WB.RegWrite === 1 ? ' pl-unit-on' : ''}`}>
        <polygon points="880,220 894,228 894,268 880,276" className={`pl-mux${occ.WB.ctl?.WB.RegWrite === 1 ? ' pl-unit-on' : ''}`} />
        <text x={880} y={216} textAnchor="end" className="pl-dp-port">1</text>
        <text x={880} y={288} textAnchor="end" className="pl-dp-port">0</text>
        <text x={887} y={300} textAnchor="middle" className="pl-dp-small">MemToReg</text>
      </g>

      {bug ? (
        <text x={274} y={308} className="pl-dp-port">
          bug: write register from IF/ID
        </text>
      ) : null}

      {/* Pipeline registers */}
      {PIPE_REGS.map((r) => {
        const c = f?.regs[r]
        return (
          <g key={r} className={`pl-preg${c?.uid ? ' pl-preg-on' : ''}`}>
            <rect x={REG_X[r]} y={0} width={14} height={410} />
            <text x={REG_X[r] + 7} y={424} textAnchor="middle" className="pl-dp-small">
              {r}
            </text>
          </g>
        )
      })}

      {/* Forwarding paths this cycle (L21 p18, p38-39) */}
      {fwd.map((w, i) => (
        <g key={i}>
          <path d={w.d} className="pl-wire pl-fwdwire" />
          <text x={w.lx} y={w.ly} textAnchor="middle" className="pl-dp-fwd">
            {w.text}
          </text>
        </g>
      ))}
      {/* The forwarded value travels back against the pipeline: draw it in, then let packets run along it. */}
      <Flow id={`f${f?.cycle ?? 0}`} paths={fwd.map((w) => w.d)} tone="fwd" />
    </svg>
  )
}

const BITS: { group: keyof Omit<ControlRow, 'note'>; keys: string[] }[] = [
  { group: 'EX', keys: ['RegDst', 'ALUSrc', 'ALUop'] },
  { group: 'M', keys: ['MemRead', 'MemWrite', 'Branch'] },
  { group: 'WB', keys: ['MemToReg', 'RegWrite'] },
]

/** Bug mode (L20 p22-23): the write register number is not carried past ID/EX. */
const dropped = (bug: boolean, name: PipeReg, label: string) => bug && label === 'Write register' && (name === 'EX/MEM' || name === 'MEM/WB')

function RegisterCard({ name, c, filling, bug }: { name: PipeReg; c: RegContents | undefined; filling: boolean; bug: boolean }) {
  if (!c) return null
  const empty = filling && !c.uid
  const groups = empty ? [] : BITS.filter((b) => c.control[b.group])
  return (
    <section className="pl-regcard">
      <header className="pl-regcard-head">
        <span className="mono pl-regname">{name}</span>
        <span className={c.uid ? (c.flushed ? 'pl-who-wrong' : 'pl-who-active') : 'pl-who-bubble'}>{c.uid ? c.name : empty ? 'empty' : 'bubble'}</span>
        {c.flushed ? <Chip signal="flush">wrong path</Chip> : null}
      </header>
      {c.fields.length ? (
        <dl className="pl-regfields">
          {c.fields.map((fl) => (
            <div key={fl.label}>
              <dt>{fl.label}</dt>
              {dropped(bug, name, fl.label) ? (
                <dd className="mono">
                  <s>{fl.text}</s>
                  <span className="pl-note">not carried in bug mode</span>
                </dd>
              ) : (
                <dd className="mono">
                  {fl.text}
                  {fl.note ? <span className="pl-note">{fl.note}</span> : null}
                </dd>
              )}
            </div>
          ))}
        </dl>
      ) : (
        <p className="pl-muted">{c.uid ? 'Nothing latched yet.' : empty ? 'The pipeline is still filling.' : 'Every control signal is 0, so it writes nothing (T10 Answers p16).'}</p>
      )}
      {groups.length ? (
        <div className="pl-ctlgroups" aria-label="Control signals carried">
          {groups.map((g) => {
            const vals = c.control[g.group] as Record<string, string | number>
            return (
              <div key={g.group} className="pl-ctlgroup">
                <span className="pl-ctlname">{g.group}</span>
                {g.keys.map((k) => (
                  <Chip key={k} signal={vals[k] === 'X' ? 'dontcare' : 'control'}>
                    {k} {vals[k]}
                  </Chip>
                ))}
              </div>
            )
          })}
        </div>
      ) : null}
      {c.uid && c.control.note ? <p className="pl-note">{c.control.note}</p> : null}
    </section>
  )
}

export default function DatapathTab({ intro, p }: { intro: ReactNode; p: ProgramState }) {
  const t = p.trace
  const stepper = useCycleStepper(t)
  const f = t.frames[stepper.index]
  const rl = (r: number) => regLabel(r, t.stream.regStyle)
  const [bug, setBug] = useUrlState('bug', false)
  const [focus, setFocus] = useUrlState('focus', false)
  const marks = useMemo(() => frameMarks(t.frames), [t.frames])
  const writer = f?.regWrite ? t.rows.find((r) => r.uid === f.regWrite!.by)?.name : undefined
  // With the bug, WB takes the write register from IF/ID, i.e. from the instruction now in ID (L20 p22-23).
  const idRow = f?.stages.ID ? t.rows.find((r) => r.uid === f.stages.ID) : undefined
  const idIns = idRow && idRow.index !== null ? t.stream.program.instructions[idRow.index] : undefined
  const wrongReg = idIns ? (controlRow(idIns).EX.RegDst === 1 ? idIns.rd : idIns.rt) : undefined
  return (
    <Workspace
      title="Pipeline"
      lectures="L20 to L21, T10, R11"
      intro={intro}
      toolbar={<PresetPicker p={p} />}
      transport={<Transport stepper={stepper} label="Cycle" marks={marks} describe={describeFrame(t, f)} />}
    >
      <Setup p={p} marks={lineMarks(t, f)} extra={<Toggle label="Bug mode: drop the write register (L20 p22)" checked={bug} onChange={setBug} />} />
      <Layout>
        <Board
          className="pl-board"
          title="Pipelined datapath"
          step={f ? `Cycle ${f.cycle}` : undefined}
          tools={<Toggle label="Show only what this instruction uses" checked={focus} onChange={setFocus} hint="Hides the units and wires that the instruction in each stage does not use" />}
          play={t.ok ? <PlayBar stepper={stepper} start="Step through the cycles" next={(i) => `cycle ${t.frames[i]?.cycle ?? i + 1}`} /> : null}
          foot={
            <Legend
              items={[
                { signal: 'path', label: 'wires the instruction in that stage uses' },
                { signal: 'control', label: 'control signals' },
                { signal: 'forward', label: 'forwarding' },
                { signal: 'stall', label: 'bubble' },
                { signal: 'flush', label: 'wrong-path instruction, to be flushed' },
              ]}
            />
          }
        >
          <div className="pl-dp-scroll">{t.ok ? <Diagram t={t} f={f} bug={bug} focus={focus} /> : <p className="pl-pad pl-err">Fix the code to see the datapath.</p>}</div>
        </Board>
        {t.ok ? (
          <CycleStory t={t} frame={f}>
            {f?.regWrite && !bug ? (
              <Callout kind="course" title="Register file this cycle" cite="L21 p10-11">
                {writer} writes {rl(f.regWrite.register)}
                {f.regWrite.value === undefined ? '' : ` = ${f.regWrite.value}`} in the first half of the cycle; ID reads in the second half.
              </Callout>
            ) : null}
            {f?.regWrite && bug ? (
              <Callout kind="trap" title="Bug mode: the wrong register is written" cite="L20 p22-23">
                {writer} should write {rl(f.regWrite.register)}
                {f.regWrite.value === undefined ? '' : ` = ${f.regWrite.value}`}. Without the write register in MEM/WB, the number comes from IF/ID, which holds {idRow ? `${idRow.name} (${idRow.text})` : 'no instruction now'}
                {wrongReg === undefined ? '.' : wrongReg === f.regWrite.register ? `, which also names ${rl(wrongReg)}, so the result lands in the right place by luck.` : `, so the value goes into ${rl(wrongReg)} instead.`}
              </Callout>
            ) : null}
          </CycleStory>
        ) : null}
      </Layout>
      <Details
        urlKey="pdd"
        label="Tables for this cycle"
        tabs={[
          {
            value: 'regs',
            label: 'Pipeline registers',
            body: (
              <>
                <p className="pl-muted pl-gap">What each stage reads this cycle, latched at the end of the cycle before (L20 p18-22). Control groups drop off as their stage uses them (L20 p27-28).</p>
                <div className="pl-regcards">
                  {PIPE_REGS.map((r) => (
                    <RegisterCard key={r} name={r} c={f?.regs[r]} filling={!!f && f.cycle <= PIPE_REGS.indexOf(r) + 1} bug={bug} />
                  ))}
                </div>
              </>
            ),
          },
          {
            value: 'notes',
            label: 'About this drawing',
            body: (
              <div className="pl-notes">
                <p className="pl-muted">
                  Simplified from L20 p29. Forwarding paths (L21 p18) and the early-branch comparator (L21 p34) are drawn only when they are used. The forwarding unit and hazard detection unit are left out; their rules are not tested (R11 p14).
                </p>
                <Callout kind="trap" title="The write register travels with the instruction" cite="L20 p22-24">
                  The destination number goes down ID/EX, EX/MEM and MEM/WB. Without it, WB would write into the register named by whatever is in ID now.
                </Callout>
                <Notes notes={t.notes} />
              </div>
            ),
          },
        ]}
      />
    </Workspace>
  )
}
