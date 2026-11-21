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
  { value: 'ff', label: 'Flip-flops', blurb: 'Draw a timing diagram tick by tick for a latch or an edge-triggered flip-flop, watch characteristic rows merge into the excitation table, match flip-flops to their state diagrams, settle a latch gate by gate, or convert one flip-flop into another.' },
  { value: 'analysis', label: 'Analysis', blurb: 'Turn flip-flop input equations into the state table and state diagram, then clock the circuit through an input sequence.' },
  { value: 'design', label: 'Design wizard', blurb: 'From a state table and flip-flop types: excitation table, K-maps, equations, where the unused states go, and whether the circuit is self-correcting.' },
  { value: 'check', label: 'Checker', blurb: 'Paste your flip-flop equations and the state table they should give, and see every entry that matches or differs.' },
]

export default function SequentialPage() {
  const [rawTab, setTab] = useUrlState<Tab>('tab', 'ff')
  const tab = pick(rawTab, TABS.map((t) => t.value), 'ff')
  const current = TABS.find((t) => t.value === tab)!
  const intro = (
    <div className="seq-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
      <Tabs label="Sequential circuit tools" value={tab} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="seq-root">
      {tab === 'ff' ? <FlipFlopTab intro={intro} /> : tab === 'analysis' ? <AnalysisTab intro={intro} /> : tab === 'design' ? <DesignTab intro={intro} /> : <CheckTab intro={intro} />}
    </div>
  )
}
