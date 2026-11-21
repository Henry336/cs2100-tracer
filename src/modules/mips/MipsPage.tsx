import { hex } from '../../core/mips'
import { useUrlState } from '../../lib/url-state'
import { Tabs } from '../../ui/kit'
import BranchCondTab from './BranchCondTab'
import ConstTab from './ConstTab'
import EncodeTab, { useEncodeState } from './EncodeTab'
import OpcodeTab from './OpcodeTab'
import RunTab from './RunTab'
import './mips.css'

type Tab = 'run' | 'encode' | 'const' | 'branch' | 'opcode'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'run', label: 'Run', blurb: 'Step through a program one instruction at a time and watch registers and memory change.' },
  { value: 'encode', label: 'Encode and decode', blurb: 'Split any instruction or 32-bit word into its fields, with the branch offset and jump target worked out.' },
  { value: 'const', label: '32-bit constants', blurb: 'Split a 32-bit value into lui and ori, see why lui then addi can go wrong, and check which immediate kinds hold it.' },
  { value: 'branch', label: 'Branch conditions', blurb: 'Build blt, bgt, ble and bge from slt with beq or bne, and see whether the branch is taken.' },
  { value: 'opcode', label: 'Expanding opcode', blurb: 'Share an opcode space between instruction types and find the maximum or minimum number of instructions.' },
]

export default function MipsPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'run')
  const enc = useEncodeState()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]

  const intro = (
    <div className="mp-intro">
      <p>{current.blurb} Click any underlined value to see how it was worked out.</p>
      <Tabs label="MIPS tools" value={current.value} onChange={setTab} tabs={TABS} />
    </div>
  )

  const openEncode = (word: number, address: number) => {
    enc.setMode('hex')
    enc.setHex(hex(word))
    enc.setBase(hex(address))
    enc.setSel(0)
    setTab('encode')
  }

  return (
    <div className="mp-root">
      {current.value === 'run' ? (
        <RunTab intro={intro} openEncode={openEncode} />
      ) : current.value === 'encode' ? (
        <EncodeTab intro={intro} />
      ) : current.value === 'const' ? (
        <ConstTab intro={intro} />
      ) : current.value === 'branch' ? (
        <BranchCondTab intro={intro} />
      ) : (
        <OpcodeTab intro={intro} />
      )}
    </div>
  )
}
