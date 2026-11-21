import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import AnalysisTab from './AnalysisTab'
import CheckTab from './CheckTab'
import { pick } from './common'
import DesignTab from './DesignTab'
import FlipFlopTab from './FlipFlopTab'
import './sequential.css'

type Tab = 'ff' | 'analysis' | 'design' | 'check'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'ff', label: 'Flip-flops', blurb: 'Latches and flip-flops, tick by tick and gate by gate.' },
  { value: 'analysis', label: 'Analysis', blurb: 'Flip-flop equations become a state table and state diagram, then the circuit runs an input sequence.' },
  { value: 'design', label: 'Design wizard', blurb: 'A state table becomes flip-flop equations, then the unused states are checked.' },
  { value: 'check', label: 'Checker', blurb: 'Your flip-flop equations, checked against the state table they should give.' },
]

export default function SequentialPage() {
  const [rawTab, setTab] = useUrlState<Tab>('tab', 'ff')
  const tab = pick(rawTab, TABS.map((t) => t.value), 'ff')
  const current = TABS.find((t) => t.value === tab)!
  const intro = (
    <div className="seq-intro">
      <p>{current.blurb} Click an underlined value to see the working.</p>
      <Tabs label="Sequential circuit tools" value={tab} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="seq-root">
      {tab === 'ff' ? <FlipFlopTab intro={intro} /> : tab === 'analysis' ? <AnalysisTab intro={intro} /> : tab === 'design' ? <DesignTab intro={intro} /> : <CheckTab intro={intro} />}
    </div>
  )
}
