import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import CalcTab from './CalcTab'
import TraceTab from './TraceTab'
import './c-memory.css'

type Tab = 'trace' | 'calc'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  {
    value: 'trace',
    label: 'Memory tracer',
    blurb:
      'Run a small C program one statement at a time.',
  },
  {
    value: 'calc',
    label: 'Address calculator',
    blurb: 'Work out an array address, a struct layout or a byte order by hand.',
  },
]

export default function CMemoryPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'trace')
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="cm-intro">
      <p>{current.blurb} Click an underlined value to see its working.</p>
      <Tabs label="C memory tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return <div className="cm-root">{current.value === 'calc' ? <CalcTab intro={intro} /> : <TraceTab intro={intro} />}</div>
}
