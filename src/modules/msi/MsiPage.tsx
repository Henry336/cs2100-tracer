import { useUrlState } from '../../lib/url-state'
import { Tabs, Toggle } from '../../ui/kit'
import AdderTab from './AdderTab'
import ComparatorTab from './ComparatorTab'
import DecoderTab from './DecoderTab'
import EncoderTab from './EncoderTab'
import MuxTab from './MuxTab'
import WorkbenchTab from './WorkbenchTab'
import './msi.css'

type Tab = 'adder' | 'cmp' | 'dec' | 'enc' | 'mux' | 'wb'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'adder', label: 'Adders', blurb: 'Half adder, full adder and the ripple-carry adder. Step one gate delay at a time and watch the carry ripple to the top bit.' },
  { value: 'cmp', label: 'Comparator', blurb: 'Compare two numbers bit by bit from the MSB, wire the pins to variables, or find which single comparator gives a function.' },
  { value: 'dec', label: 'Decoder lab', blurb: 'Pick the size, enable and output polarity, toggle the inputs, then build or read back a function from a decoder and one gate.' },
  { value: 'enc', label: 'Encoders', blurb: 'Plain and priority encoders: which input wins, what the code is, and what each output bit becomes when the inputs are wired to variables.' },
  { value: 'mux', label: 'MUX', blurb: 'Put a function on a multiplexer: split the truth table by the selects, work out each data input, and find a select order that needs no inverter.' },
  {
    value: 'wb',
    label: 'Block workbench',
    blurb: 'Chain adders, comparators, decoders, muxes, encoders and gates, step through every input row, and check a named output against a target.',
  },
]

/** Tabs whose diagrams mark unused parts (is-off); the adder tab has its own "settled" toggle. */
const FOCUS_TABS: Tab[] = ['dec', 'enc', 'mux', 'wb']

export default function MsiPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'adder')
  const [focus, setFocus] = useUrlState<boolean>('fo', false)
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const hasFocus = FOCUS_TABS.includes(current.value)
  const intro = (
    <div className="ms-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
      <Tabs label="Combinational and MSI tools" value={current.value} onChange={setTab} tabs={TABS} />
      {hasFocus ? (
        <Toggle
          label="Show only what this step uses"
          checked={focus === true}
          onChange={setFocus}
          hint="Hides the outputs, inputs and blocks the current row or step does not use. Off draws them faint."
        />
      ) : null}
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
