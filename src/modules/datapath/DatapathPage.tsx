import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import ControlTab from './ControlTab'
import QuizTab from './QuizTab'
import TimingTab from './TimingTab'
import TraceTab, { useTraceInputs } from './TraceTab'
import './datapath.css'

type Tab = 'trace' | 'control' | 'quiz' | 'timing'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'trace', label: 'Datapath tracer', blurb: 'Follow one instruction through the L12 p30 datapath, one stage at a time.' },
  { value: 'control', label: 'Control unit', blurb: 'Toggle the opcode bits to see the row the PLA picks. Toggle ALUop and funct to see ALUcontrol.' },
  { value: 'quiz', label: 'Control quiz', blurb: 'Fill in the control row and ALUcontrol, then check each cell against L12 p34 and p26 (T05 Q1).' },
  { value: 'timing', label: 'Critical path', blurb: "Set the unit delays to find each instruction's critical path and the cycle time." },
]

export default function DatapathPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'trace')
  const x = useTraceInputs()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="dp-intro">
      <p>{current.blurb} Click an underlined value for its working.</p>
      <Tabs label="Datapath tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="dp-root">
      {current.value === 'trace' ? (
        <TraceTab intro={intro} x={x} />
      ) : current.value === 'control' ? (
        <ControlTab intro={intro} x={x} />
      ) : current.value === 'quiz' ? (
        <QuizTab intro={intro} />
      ) : (
        <TimingTab intro={intro} />
      )}
    </div>
  )
}
