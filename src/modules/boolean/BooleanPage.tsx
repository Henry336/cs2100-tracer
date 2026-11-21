import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import AlgebraTab from './AlgebraTab'
import CheckTab from './CheckTab'
import { useFnInput } from './common'
import FormsTab from './FormsTab'
import GatesTab from './GatesTab'
import KMapTab from './KMapTab'
import './boolean.css'

type Tab = 'kmap' | 'forms' | 'check' | 'algebra' | 'gates'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'kmap', label: 'K-map studio', blurb: 'Finds every PI and EPI, then each minimal cover, for SOP or POS.' },
  { value: 'forms', label: 'Truth table and forms', blurb: 'Builds the truth table, Σm, ΠM and canonical forms of an expression, and tests two expressions row by row.' },
  { value: 'check', label: 'Answer checker', blurb: 'Checks whether your answer is equal, minimal, built from PIs and in exam format.' },
  { value: 'algebra', label: 'Algebra steps', blurb: 'Each line must equal the one before. The checker names the law used.' },
  { value: 'gates', label: 'Gates', blurb: 'Draws a minimal cover or a typed expression as gates, with gate count, levels and delay.' },
]

export default function BooleanPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'kmap')
  const input = useFnInput()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="bo-intro">
      <p>
        {current.blurb} Click an underlined value to see the working. The K-map, checker and gates tabs share one function.
      </p>
      <Tabs label="Boolean tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="bo-root">
      {current.value === 'kmap' ? (
        <KMapTab intro={intro} input={input} />
      ) : current.value === 'forms' ? (
        <FormsTab intro={intro} />
      ) : current.value === 'check' ? (
        <CheckTab intro={intro} input={input} />
      ) : current.value === 'algebra' ? (
        <AlgebraTab intro={intro} />
      ) : (
        <GatesTab intro={intro} input={input} />
      )}
    </div>
  )
}
