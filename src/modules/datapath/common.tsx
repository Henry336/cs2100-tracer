import { useEffect, type ReactNode } from 'react'
import {
  ALU_CODES, ALU_CODES_CITE, ALU_CONTROL_CITE, ALU_CONTROL_TABLE, ALUOP_CITE, ALUOP_TABLE, DERIVED_ROWS, MAIN_CONTROL, MAIN_CONTROL_CITE, PIPELINE_GROUP, PIPELINE_GROUP_CITE, PIPELINE_ORDER, SIGNAL_ORDER,
  type Bit, type ControlRow, type Explain,
} from '../../core/datapath'
import { bin } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { DataTable, Legend, Why, type Column } from '../../ui/kit'
import { useStepper } from '../../ui/stepper'

export type NumMode = 'hex' | 'dec'

/** <Why> straight from an engine Explain. */
export function W({ e, children }: { e: Explain; children: ReactNode }) {
  return (
    <Why rule={e.rule} working={e.working} cite={e.cite}>
      {children}
    </Why>
  )
}

/** Explain shown in full (for printing and for the selected-part panel). */
export function ExplainText({ e }: { e: Explain }) {
  return (
    <span className="dp-explain">
      <span>{e.rule}.</span>
      {e.working ? <span className="mono dp-working">{e.working}</span> : null}
      {e.cite ? <span className="dp-cite">{e.cite}</span> : null}
    </span>
  )
}

/** A stepper whose index lives in the URL, so a shared link opens at the same step. */
export function useUrlStepper(count: number, key: string, initial: number) {
  const [stepQ, setStepQ] = useUrlState(key, initial)
  const stepper = useStepper(count, { initial: stepQ, intervalMs: 2200 })
  const i = stepper.index
  useEffect(() => {
    if (i !== stepQ) setStepQ(i)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stepQ !== i) stepper.set(stepQ)
  }, [stepQ]) // eslint-disable-line react-hooks/exhaustive-deps
  return stepper
}

/** Accepts 12, -50, 0x1F, 0b101 and a bare 8-digit hex word. Returns an unsigned 32-bit value or null. */
export function parseNum(s: string): number | null {
  const t = s.trim()
  if (/^[0-9a-f]{8}$/i.test(t) && /[a-f]/i.test(t)) return parseInt(t, 16) >>> 0
  const m = /^([+-]?)(0x[0-9a-f]+|0b[01]+|\d+)$/i.exec(t)
  if (!m) return null
  const v = Number(m[2]) * (m[1] === '-' ? -1 : 1)
  return v >= -(2 ** 31) && v <= 0xffffffff ? v >>> 0 : null
}

export const bitCell = (b: Bit | undefined) => (b === undefined ? '' : String(b))

export function DatapathLegend({ extra = true }: { extra?: boolean }) {
  return (
    <div className="dp-legend">
      <Legend
        items={[
          { signal: 'path', label: 'used in this step' },
          { signal: 'data', label: 'value on a wire' },
          { signal: 'control', label: 'control signal or control logic' },
          { signal: 'dontcare', label: "X, don't care" },
        ]}
      />
      {extra ? (
        <ul className="legend dp-legend-extra" aria-label="Line styles">
          <li><span className="dp-sw dp-sw-past" aria-hidden="true" />used in an earlier step</li>
          <li><span className="dp-sw dp-sw-disc" aria-hidden="true" />computed but discarded</li>
          <li><span className="dp-sw dp-sw-future" aria-hidden="true" />not reached yet</li>
        </ul>
      ) : null}
    </div>
  )
}

/* ---------- Course tables (L12 p24, p26, p34; L11 p34) ---------- */

type MainRow = { name: string; opcode: string; row: ControlRow; note: string; derived: boolean }

const MAIN_ROWS: MainRow[] = [
  ...MAIN_CONTROL.map((m) => ({ name: m.name, opcode: m.opcodeBin, row: m.row, note: '', derived: false })),
  ...DERIVED_ROWS.map((d) => ({
    name: d.name,
    opcode: bin(d.opcode, 6),
    row: d.row,
    note: d.status === 'key' ? `AY25/26 key, BranchNE ${d.row.BranchNE}` : 'derived',
    derived: true,
  })),
]

/** Column order: the L12 p34 single-cycle table, or the same signals grouped by pipeline stage (L20 p27). */
export type TableOrder = 'L12' | 'L20'

/**
 * The main control table with the active row lit. `active` is the row name (R-type, lw, sw, beq, addi, bne).
 * With order L20 the columns follow L20 p27 and each header names its stage (EX, MEM, WB).
 */
export function MainControlTable({ active, showDerived = true, caption, order = 'L12' }: { active: string | null; showDerived?: boolean; caption?: ReactNode; order?: TableOrder }) {
  const rows = MAIN_ROWS.filter((r) => showDerived || !r.derived)
  const signals = order === 'L20' ? PIPELINE_ORDER : SIGNAL_ORDER
  const cols: Column<MainRow>[] = [
    { key: 'name', header: 'Instr', cell: (r) => r.name },
    { key: 'op', header: 'Opcode', cell: (r) => r.opcode, mono: true },
    ...signals.map((s): Column<MainRow> => ({
      key: s,
      header: order === 'L20' ? <>{s}<br /><span className="dp-note">{PIPELINE_GROUP[s]}</span></> : s,
      cell: (r) => <span className={r.row[s] === 'X' ? 'dp-x' : undefined}>{bitCell(r.row[s])}</span>,
      align: 'center',
      mono: true,
    })),
    { key: 'note', header: 'Note', cell: (r) => (r.note ? <span className="dp-note">{r.note}</span> : null) },
  ]
  return (
    <DataTable
      compact
      columns={cols}
      rows={rows}
      rowSignal={(r) => (r.name === active ? 'path' : undefined)}
      caption={caption ?? `Main control (${order === 'L20' ? `${MAIN_CONTROL_CITE}, columns grouped by pipeline stage as on ${PIPELINE_GROUP_CITE}` : MAIN_CONTROL_CITE}); the addi and bne rows are not in L12`}
    />
  )
}

/** Name of the main-control row for an opcode and mnemonic, or null. */
export function mainRowName(opcode: number, mnemonic: string): string | null {
  const t = MAIN_CONTROL.find((m) => m.opcode === opcode)
  if (t) return t.name
  return DERIVED_ROWS.find((d) => d.opcode === opcode && d.name === mnemonic)?.name ?? null
}

export function AluopTable({ aluop }: { aluop: string | null }) {
  return (
    <DataTable
      compact
      columns={[
        { key: 'i', header: 'Instructions', cell: (r) => r.instrs },
        { key: 'o', header: 'ALUop', cell: (r) => r.aluop, mono: true, align: 'center' },
        { key: 'a', header: 'ALU action', cell: (r) => r.action },
      ]}
      rows={ALUOP_TABLE}
      rowSignal={(r) => (r.aluop === aluop ? 'path' : undefined)}
      caption={`First level: opcode to ALUop (${ALUOP_CITE})`}
    />
  )
}

export function AluControlTable({ aluop, funct, instr }: { aluop: string | null; funct: number | null; instr?: string }) {
  const f = funct === null ? null : bin(funct, 6)
  return (
    <DataTable
      compact
      columns={[
        { key: 'i', header: 'Instr', cell: (r) => r.instr },
        { key: 'o', header: 'ALUop', cell: (r) => r.aluop, mono: true, align: 'center' },
        { key: 'f', header: 'Funct', cell: (r) => r.funct, mono: true },
        { key: 'a', header: 'Action', cell: (r) => r.action },
        { key: 'c', header: 'ALUcontrol', cell: (r) => r.code, mono: true, align: 'center' },
      ]}
      rows={ALU_CONTROL_TABLE}
      // lw and sw share a row value; light only the one being traced.
      rowSignal={(r) => (r.aluop === aluop && (r.funct === 'xxxxxx' || r.funct === f) && (aluop !== '00' || !(instr === 'lw' || instr === 'sw') || r.instr === instr) ? 'path' : undefined)}
      caption={`Second level: ALUop and funct to ALUcontrol (${ALU_CONTROL_CITE})`}
    />
  )
}

export function AluCodeTable({ code }: { code: string | null }) {
  return (
    <DataTable
      compact
      columns={[
        { key: 'c', header: 'ALUcontrol', cell: (r) => r.code, mono: true },
        { key: 'o', header: 'Function', cell: (r) => r.op },
        { key: 'a', header: 'Ainvert', cell: (r) => r.ainvert, mono: true, align: 'center' },
        { key: 'b', header: 'Binvert', cell: (r) => r.binvert, mono: true, align: 'center' },
        { key: 'p', header: 'Operation', cell: (r) => r.operation, mono: true, align: 'center' },
      ]}
      rows={ALU_CODES}
      rowSignal={(r) => (r.code === code ? 'path' : undefined)}
      caption={`ALU codes (${ALU_CODES_CITE})`}
    />
  )
}
