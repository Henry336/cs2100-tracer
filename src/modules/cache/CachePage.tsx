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
  { value: 'sim', label: 'Simulator', blurb: 'Step through a trace of loads and stores and watch each lookup, hit, miss and eviction.' },
  { value: 'write', label: 'Write policies', blurb: 'Run the same trace under write-through and write-back, with write allocate and write around, and count the memory traffic.' },
  { value: 'compare', label: 'Compare organisations', blurb: 'Run the same trace on direct mapped, set associative and fully associative caches of one size, and see which misses go away.' },
  { value: 'calc', label: 'Calculators', blurb: 'Field widths, storage bits, average access time and the pipeline miss penalty, as the exam questions ask them.' },
]

export default function CachePage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'sim')
  const input = useInput()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="ca-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out. The first three tabs share one trace and cache.</p>
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
