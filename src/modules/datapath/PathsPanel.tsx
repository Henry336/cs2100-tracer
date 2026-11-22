// Every path one instruction takes through the datapath, longest first, with the critical path marked (R06 p41-42).
import { Fragment } from 'react'
import { type DatapathTrace, type NodeId, type TimingPath, type UnitId } from '../../core/datapath'
import { Panel } from '../../ui/kit'
import { RUN_DELAYS } from './model'

const NAME: Record<NodeId, string> = {
  IM: 'Instruction memory', ADD4: 'PC+4 adder', CTRL: 'Control', RFR: 'Register file (read)', REGDST: 'RegDst mux', SEXT: 'Sign extend',
  ALUSRC: 'ALUSrc mux', ALUCTL: 'ALU control', ALU: 'ALU', SHIFT: 'Left shift 2', BADD: 'Branch adder', AND: 'AND gate', PCSRC: 'PCSrc mux',
  DM: 'Data memory', MTR: 'MemToReg mux', RFW: 'Register file (write)',
}
const UNIT: Record<NodeId, UnitId> = {
  IM: 'im', ADD4: 'add4', CTRL: 'control', RFR: 'rf', REGDST: 'regdst', SEXT: 'sext', ALUSRC: 'alusrc', ALUCTL: 'aluctl', ALU: 'alu',
  SHIFT: 'shift', BADD: 'badd', AND: 'and', PCSRC: 'pcsrc', DM: 'dm', MTR: 'memtoreg', RFW: 'rf',
}
const KEY: Record<NodeId, keyof typeof RUN_DELAYS.values> = {
  IM: 'instMem', ADD4: 'adder', CTRL: 'control', RFR: 'regFile', REGDST: 'mux', SEXT: 'signExt', ALUSRC: 'mux', ALUCTL: 'aluControl',
  ALU: 'alu', SHIFT: 'shift', BADD: 'adder', AND: 'andGate', PCSRC: 'mux', DM: 'dataMem', MTR: 'mux', RFW: 'regFile',
}

/** The wires a path runs along, from the PC to its last unit. */
export function pathWires(t: DatapathTrace, nodes: NodeId[]): string[] {
  const between = (from: UnitId, to: UnitId) => {
    const all = t.wires.filter((w) => w.from === from && w.to === to)
    const used = all.filter((w) => w.status === 'used')
    return (used.length ? used : all).map((w) => w.id)
  }
  const units = ['pc' as UnitId, ...nodes.map((n) => UNIT[n])]
  return units.slice(1).flatMap((u, i) => between(units[i], u))
}

export function PathsPanel({ paths, on, onHover }: { paths: TimingPath[]; on: number | null; onHover: (i: number | null) => void }) {
  const unit = RUN_DELAYS.unit
  const crit = paths.filter((p) => p.critical).length
  return (
    <Panel title="Paths this instruction takes">
      <p className="dp-hint">
        From the PC to the end of the cycle, longest first, with unit delays from T05 Q2 in {unit}. The longest is the critical path: it sets how
        long this instruction needs{crit > 1 ? `; ${crit} paths tie for it` : ''}. Point at a path to see it on the diagram. <span className="dp-cite">R06 p41-42</span>
      </p>
      <ol className="dp-paths">
        {paths.map((p, i) => (
          <li
            key={p.nodes.join('>')}
            className={`dp-path${p.critical ? ' crit' : ''}${on === i ? ' is-on' : ''}`}
            tabIndex={0}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i)}
            onBlur={() => onHover(null)}
            title={`${p.nodes.map((n) => RUN_DELAYS.values[KEY[n]]).join(' + ')} = ${p.total} ${unit}`}
          >
            <span className="dp-path-chain">
              {p.nodes.map((n, k) => (
                <Fragment key={k}>
                  {k ? <span className="dp-path-sep" aria-hidden="true">›</span> : null}
                  <span>
                    {NAME[n]} <span className="dp-path-d mono">{RUN_DELAYS.values[KEY[n]]}</span>
                  </span>
                </Fragment>
              ))}
            </span>
            <span className="dp-path-total mono">
              {p.total} {unit}
              {p.critical ? <span className="dp-crit-tag">critical</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
