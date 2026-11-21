import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import BranchesTab from './BranchesTab'
import { useProgram } from './common'
import DatapathTab from './DatapathTab'
import DiagramTab from './DiagramTab'
import ExamTab from './ExamTab'
import HazardsTab from './HazardsTab'
import TimingTab from './TimingTab'
import './pipeline.css'

type Tab = 'diagram' | 'exam' | 'datapath' | 'hazards' | 'branches' | 'timing'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'diagram', label: 'Pipeline diagram', blurb: 'Step through the cycle grid: every stall, flush and forward, with the reason and the slide it comes from.' },
  { value: 'exam', label: 'Exam (a) to (e)', blurb: 'Answer the five parts the papers ask every year (stalls and cycles with and without forwarding, nops, one changed instruction), then check them against the trace.' },
  { value: 'datapath', label: 'Pipelined datapath', blurb: 'See which instruction sits in each stage of the L20 datapath and what each pipeline register holds, cycle by cycle.' },
  { value: 'hazards', label: 'Hazards', blurb: 'Classify every RAW, WAR and WAW pair and see from the read and write cycles why only RAW stalls.' },
  { value: 'branches', label: 'Branches', blurb: 'Run the same code with the branch decided in MEM or ID, with prediction, or with a delay slot, and compare the cycles.' },
  { value: 'timing', label: 'Timing', blurb: 'Compare single-cycle, multi-cycle and pipelined time for a workload, with the formulas filled in.' },
]

export default function PipelinePage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'diagram')
  const p = useProgram()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="pl-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
      <Tabs label="Pipeline tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )
  return (
    <div className="pl-root">
      {current.value === 'diagram' ? (
        <DiagramTab intro={intro} p={p} />
      ) : current.value === 'exam' ? (
        <ExamTab intro={intro} p={p} />
      ) : current.value === 'datapath' ? (
        <DatapathTab intro={intro} p={p} />
      ) : current.value === 'hazards' ? (
        <HazardsTab intro={intro} p={p} />
      ) : current.value === 'branches' ? (
        <BranchesTab intro={intro} p={p} />
      ) : (
        <TimingTab intro={intro} />
      )}
    </div>
  )
}
