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
  { value: 'run', label: 'Run', blurb: 'Step through a program and watch registers and memory change.' },
  { value: 'encode', label: 'Encode and decode', blurb: 'Split an instruction or 32-bit word into its fields.' },
  { value: 'const', label: '32-bit constants', blurb: 'Load a 32-bit value with lui and ori, and see why lui then addi can go wrong.' },
  { value: 'branch', label: 'Branch conditions', blurb: 'Build blt, bgt, ble and bge from slt with beq or bne.' },
  { value: 'opcode', label: 'Expanding opcode', blurb: 'Find the maximum or minimum number of instructions when types share an opcode space.' },
]

export default function MipsPage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'run')
  const enc = useEncodeState()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]

  const intro = (
    <div className="mp-intro">
      <p>{current.blurb} Click an underlined value to see its working.</p>
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
