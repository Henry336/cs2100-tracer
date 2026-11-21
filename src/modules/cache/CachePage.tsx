import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import CalcTab from './CalcTab'
import CompareTab from './CompareTab'
import SimulatorTab from './SimulatorTab'
import WriteTab from './WriteTab'
import { useInput } from './common'
import './cache.css'

type Tab = 'sim' | 'write' | 'compare' | 'calc'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'sim', label: 'Simulator', blurb: 'Step through loads and stores one access at a time.' },
  { value: 'write', label: 'Write policies', blurb: 'One trace under all four write policy pairs, with the memory traffic counted.' },
  { value: 'compare', label: 'Compare organisations', blurb: 'One trace on every associativity. See which misses go away.' },
  { value: 'calc', label: 'Calculators', blurb: 'The cache sums exam questions ask for.' },
]

export default function CachePage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'sim')
  const input = useInput()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="ca-intro">
      <p>{current.blurb} Click an underlined value to see its working.</p>
      <Tabs label="Cache tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="ca-root">
      {current.value === 'sim' ? (
        <SimulatorTab intro={intro} input={input} />
      ) : current.value === 'write' ? (
        <WriteTab intro={intro} input={input} />
      ) : current.value === 'compare' ? (
        <CompareTab intro={intro} input={input} />
      ) : (
        <CalcTab intro={intro} />
      )}
    </div>
  )
}
