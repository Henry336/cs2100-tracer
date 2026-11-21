import { useMemo } from 'react'
import { completeSet, inverterUses, type Gate2, type SetGate } from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Chip, DataTable, Panel, Presets, Toggle } from '../../ui/kit'
import { W } from './common'
import { SET_PRESETS } from './presets'

const ALL: SetGate[] = ['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']
const TWO: Gate2[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']

// L14 p11-12: NOT, AND and OR from one universal gate, with the laws the slide uses.
const BUILT = [
  { goal: 'NOT', nand: "(x∙x)' = x'", nandN: 1, nor: "(x+x)' = x'", norN: 1 },
  { goal: 'AND', nand: "((x∙y)'∙(x∙y)')' = x∙y", nandN: 2, nor: "((x+x)'+(y+y)')' = x∙y", norN: 3 },
  { goal: 'OR', nand: "((x∙x)'∙(y∙y)')' = x+y", nandN: 3, nor: "((x+y)'+(x+y)')' = x+y", norN: 2 },
]

/** Complete sets and gates that can act as inverters (L14 p10-12; AY24/25 Q1-Q2). */
export function UniversalPanel() {
  const [raw, setSet] = useUrlState<SetGate[]>('gs', ['NAND'])
  const [k01, setK01] = useUrlState<boolean>('k01', true)
  const set = useMemo<SetGate[]>(() => (Array.isArray(raw) ? ALL.filter((g) => raw.includes(g)) : ['NAND']), [raw])
  const res = useMemo(() => (set.length ? completeSet(set, { constants: k01 !== false }) : null), [set, k01])
  const inv = useMemo(() => TWO.map((g) => ({ g, ...inverterUses(g) })), [])
  const flip = (g: SetGate, on: boolean) => setSet(on ? [...set, g] : set.filter((x) => x !== g))

  return (
    <Panel title="Universal gates and complete sets" actions={<Presets label="Load a set" presets={SET_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p.set }))} onPick={setSet} />}>
      <div className="bo-row bo-toggles" role="group" aria-label="Gates in the set">
        {ALL.map((g) => (
          <Toggle key={g} label={g} checked={set.includes(g)} onChange={(on) => flip(g, on)} />
        ))}
        <Toggle label="Constants 0 and 1 available" checked={k01 !== false} onChange={setK01} hint="The course allows them unless a question says otherwise (T06 p2)" />
      </div>
      <p className="bo-verdict">
        {res ? (
          <>
            {res.complete ? <Chip signal="hit">complete</Chip> : <Chip signal="miss">not complete</Chip>}{' '}
            <W e={res.why}>
              <span className="mono">{`{${set.join(', ')}}`}</span>
              {res.complete ? ' can build every function' : ' cannot build every function'}
            </W>
          </>
        ) : (
          <span className="bo-muted">Pick at least one gate.</span>
        )}
      </p>
      {res && (res.not || res.and) ? (
        <p className="mono bo-wrap">
          {res.not ? <>a' = {res.not}</> : null}
          {res.not && res.and ? '; ' : null}
          {res.and ? <>a∙b = {res.and}</> : null}
        </p>
      ) : null}
      <div className="bo-row bo-split">
        <DataTable
          compact
          caption="NOT, AND and OR from one gate type (L14 p11-12)"
          columns={[
            { key: 'g', header: 'Build', cell: (r: (typeof BUILT)[number]) => r.goal },
            { key: 'a', header: 'NAND only', cell: (r) => `${r.nand}, ${r.nandN} gate${r.nandN > 1 ? 's' : ''}`, mono: true },
            { key: 'o', header: 'NOR only', cell: (r) => `${r.nor}, ${r.norN} gate${r.norN > 1 ? 's' : ''}`, mono: true },
          ]}
          rows={BUILT}
        />
        <DataTable
          compact
          caption="Which 2-input gate can act as an inverter (AY24/25 Q1)"
          columns={[
            { key: 'g', header: 'Gate', cell: (r: (typeof inv)[number]) => r.g },
            {
              key: 'w',
              header: "Gives a' by",
              cell: (r) => <W e={r.why}>{r.ways.length ? <span className="mono">{r.ways.join(', ')}</span> : <span className="bo-muted">never</span>}</W>,
            },
          ]}
          rows={inv}
        />
      </div>
    </Panel>
  )
}
