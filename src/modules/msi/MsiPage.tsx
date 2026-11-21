import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import AdderTab from './AdderTab'
import ComparatorTab from './ComparatorTab'
import DecoderTab from './DecoderTab'
import EncoderTab from './EncoderTab'
import MuxTab from './MuxTab'
import WorkbenchTab from './WorkbenchTab'
import './msi.css'

type Tab = 'adder' | 'cmp' | 'dec' | 'enc' | 'mux' | 'wb'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'adder', label: 'Adders', blurb: 'Step one gate delay at a time and watch the carry ripple to the top bit.' },
  { value: 'cmp', label: 'Comparator', blurb: 'Compare two numbers from the MSB down, or find the one comparator wiring that gives a function.' },
  { value: 'dec', label: 'Decoder lab', blurb: 'Build a function from a decoder and one gate, or read one back.' },
  { value: 'enc', label: 'Encoders', blurb: 'See which input wins and its code. Wire the inputs to variables to get each output bit as a function.' },
  { value: 'mux', label: 'MUX', blurb: 'Split the truth table by the selects to get each data input. Find a select order that needs no inverter.' },
  {
    value: 'wb',
    label: 'Block workbench',
    blurb: 'Chain blocks and gates, step through every input row, and check one output against a target.',
  },
]

/** Tabs whose diagrams mark unused parts (is-off); the toggle sits in each board (FocusToggle). The adder has its own "settled" toggle. */
const FOCUS_TABS: Tab[] = ['cmp', 'dec', 'enc', 'mux', 'wb']

export default function MsiPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'adder')
  const [focus] = useUrlState<boolean>('fo', false)
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const hasFocus = FOCUS_TABS.includes(current.value)
  const intro = (
    <div className="ms-intro">
      <p>{current.blurb} Click an underlined value for its working.</p>
      <Tabs label="Combinational and MSI tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className={`ms-root${hasFocus && focus === true ? ' ms-focus' : ''}`}>
      {current.value === 'adder' ? (
        <AdderTab intro={intro} />
      ) : current.value === 'cmp' ? (
        <ComparatorTab intro={intro} />
      ) : current.value === 'dec' ? (
        <DecoderTab intro={intro} />
      ) : current.value === 'enc' ? (
        <EncoderTab intro={intro} />
      ) : current.value === 'mux' ? (
        <MuxTab intro={intro} />
      ) : (
        <WorkbenchTab intro={intro} />
      )}
    </div>
  )
}
