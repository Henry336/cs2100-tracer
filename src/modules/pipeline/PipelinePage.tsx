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
  { value: 'diagram', label: 'Pipeline diagram', blurb: 'Every stall, flush and forward, cycle by cycle, with its reason and slide.' },
  { value: 'exam', label: 'Exam (a) to (e)', blurb: 'The five parts the papers ask every year: stalls and cycles with and without forwarding, nops, and one changed instruction.' },
  { value: 'datapath', label: 'Pipelined datapath', blurb: 'Which instruction is in each stage of the L20 datapath, and what each pipeline register holds.' },
  { value: 'hazards', label: 'Hazards', blurb: 'Every RAW, WAR and WAW pair, with the read and write cycles that show why only RAW stalls.' },
  { value: 'branches', label: 'Branches', blurb: 'The same code with the branch decided in MEM or ID, with prediction, or with a delay slot.' },
  { value: 'timing', label: 'Timing', blurb: 'Single-cycle, multi-cycle and pipelined time for one workload, with the formulas filled in.' },
]

export default function PipelinePage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'diagram')
  const p = useProgram()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  const intro = (
    <div className="pl-intro">
      <p>{current.blurb} Click an underlined value for its working.</p>
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
