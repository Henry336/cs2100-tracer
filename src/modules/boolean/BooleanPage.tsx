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
  { value: 'kmap', label: 'K-map studio', blurb: 'Step through the K-map method: every PI, the EPIs and the cells that make them essential, then every minimal cover, for SOP and POS.' },
  { value: 'forms', label: 'Truth table and forms', blurb: 'Turn an expression into its truth table, Σm, ΠM and canonical forms, and test two expressions for equality row by row.' },
  { value: 'check', label: 'Answer checker', blurb: 'Type your answer to see whether it is equal, minimal, built from PIs, and written the way the exam wants it.' },
  { value: 'algebra', label: 'Algebra steps', blurb: 'Check a simplification line by line: each line must equal the one before, and the checker names the law that gets you there.' },
  { value: 'gates', label: 'Gates', blurb: 'Draw the minimal expression as AND-OR, NAND-NAND, OR-AND or NOR-NOR, with gate count, levels and when each output settles.' },
]

export default function BooleanPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'kmap')
  const input = useFnInput()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="bo-intro">
      <p>
        {current.blurb} Click any underlined value to see how it was worked out. The K-map, answer checker and gates tabs share one function.
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
