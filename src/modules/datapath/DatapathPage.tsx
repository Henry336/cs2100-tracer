import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import ControlTab from './ControlTab'
import QuizTab from './QuizTab'
import TimingTab from './TimingTab'
import TraceTab, { useTraceInputs } from './TraceTab'
import './datapath.css'

type Tab = 'trace' | 'control' | 'quiz' | 'timing'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'trace', label: 'Datapath tracer', blurb: 'Run one instruction through the L12 p30 datapath, stage by stage, and see every value the units compute, including the ones control throws away.' },
  { value: 'control', label: 'Control unit', blurb: 'Set the opcode bits and watch the PLA pick a row of the control table; set ALUop and funct and watch the ALU control gates pick the ALU operation.' },
  { value: 'quiz', label: 'Control quiz', blurb: 'Fill in the control row and ALUcontrol for an instruction, then check each cell against L12 p34 and p26, as in T05 Q1.' },
  { value: 'timing', label: 'Critical path', blurb: 'Give each unit a delay and find the longest path for each instruction, drawn on the same datapath, and the cycle time it forces.' },
]

export default function DatapathPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'trace')
  const x = useTraceInputs()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="dp-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
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
