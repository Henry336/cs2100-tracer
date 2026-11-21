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
      'Run a small C program one statement at a time. Each variable is a box with its name, type, address and value; pointers are arrows to the box they hold the address of, and each function call gets its own frame.',
  },
  {
    value: 'calc',
    label: 'Address calculator',
    blurb: 'Work out where an element of a multidimensional array lives (and the reverse), how a struct is laid out, and how a value is stored byte by byte.',
  },
]

export default function CMemoryPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'trace')
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="cm-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
      <Tabs label="C memory tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return <div className="cm-root">{current.value === 'calc' ? <CalcTab intro={intro} /> : <TraceTab intro={intro} />}</div>
}
