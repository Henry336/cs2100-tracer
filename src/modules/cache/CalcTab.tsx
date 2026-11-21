import { useMemo, type ReactNode } from 'react'
import {
  addressBitsForMemory,
  averageAccessTime,
  fmtBytes,
  geometry,
  isPow2,
  parseNumber,
  pipelineCacheModel,
  solveFromTag,
  splitAddress,
  storageBits,
} from '../../core/cache'
import { useUrlState } from '../../lib/url-state'
import { Button, Callout, Chip, Legend, NumberField, Panel, Presets, Segmented, Select, Tabs, TextField, Toggle, Workspace } from '../../ui/kit'
import { AddressBar, BarSelect, Errors, W, plural, pow2Options } from './common'

const KB = 1024
const MB = KB * KB
const GB = KB * MB

const merge = <T extends object>(def: T, raw: unknown): T => (raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...def, ...(raw as Partial<T>) } : def)

function Facts({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="ca-facts">
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd className="mono">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------- Field widths ---------- */

interface Fw {
  addr: number
  /** Memory size in bytes; 0 means the address width is given directly. */
  mem: number
  cache: number
  block: number
  word: number
  ways: number | 'full'
  a: string
}

const FW: Fw = { addr: 32, mem: 0, cache: 16 * KB, block: 16, word: 4, ways: 1, a: '' }

const FW_PRESETS: { name: string; source: string; value: Partial<Fw> }[] = [
  { name: '16 KB direct mapped, 16 B blocks', source: 'L22 p29-30', value: { cache: 16 * KB, block: 16, ways: 1 } },
  { name: '32 B direct mapped, 8 B blocks', source: 'L22 p54', value: { cache: 32, block: 8, ways: 1 } },
  { name: '4 KB 4-way, 4 B blocks', source: 'L23 p12-13', value: { cache: 4 * KB, block: 4, ways: 4 } },
  { name: '32 B 2-way, 8 B blocks', source: 'L23 p17', value: { cache: 32, block: 8, ways: 2 } },
  { name: '4 KB fully associative, 16 B blocks', source: 'L23 p27', value: { cache: 4 * KB, block: 16, ways: 'full' } },
  { name: '4 GB memory, 32 KB DM, address 0x12345678', source: 'R12 p40', value: { mem: 4 * GB, cache: 32 * KB, block: 32, ways: 1, a: '0x12345678' } },
  { name: '256 MB memory, 16 KB FA, 256 B blocks', source: 'R12 p42', value: { mem: 256 * MB, cache: 16 * KB, block: 256, ways: 'full' } },
  { name: '32 KB 8-way, 8 B blocks', source: 'AY25/26 Q9, R12 p47', value: { cache: 32 * KB, block: 8, ways: 8 } },
  { name: '32 KB 4-way, 16 B blocks', source: 'AY24/25 Q14', value: { cache: 32 * KB, block: 16, ways: 4 } },
  { name: '2048 blocks of 4 words, 4-way', source: 'AY23/24 S1 Q15', value: { cache: 32 * KB, block: 16, ways: 4 } },
  { name: '16-bit words, 2-word blocks, 16 blocks', source: 'T11 Q1', value: { cache: 64, block: 4, word: 2, ways: 1 } },
  { name: '64 KB 4-way write-back, 8-word blocks', source: 'AY16/17 Q6, derived', value: { cache: 64 * KB, block: 32, ways: 4 } },
  { name: 'L1: 32 KB 4-way, 32 B blocks', source: 'L23 p39, exploration', value: { cache: 32 * KB, block: 32, ways: 4 } },
  { name: 'L2: 256 KB 8-way, 128 B blocks', source: 'L23 p39, exploration', value: { cache: 256 * KB, block: 128, ways: 8 } },
  { name: 'L3: 4 MB direct mapped, 256 B blocks', source: 'L23 p39, exploration', value: { cache: 4 * MB, block: 256, ways: 1 } },
]

const MEM_SIZES = [{ value: '0', label: 'Not given' }, ...pow2Options(16, 40)]

function waysSelect(blocks: number) {
  const out = [{ value: '1', label: 'Direct mapped' }]
  for (let w = 2; w < blocks && w <= 4096; w *= 2) out.push({ value: String(w), label: `${w}-way` })
  if (blocks > 1) out.push({ value: 'full', label: 'Fully associative' })
  return out
}

type FwTab = 'widths' | 'ways' | 'storage' | 'traps'

const FW_TABS: { value: FwTab; label: string }[] = [
  { value: 'widths', label: 'Field widths' },
  { value: 'ways', label: 'More ways' },
  { value: 'storage', label: 'Storage bits' },
  { value: 'traps', label: 'Traps' },
]

function FieldWidths() {
  const [raw, setRaw] = useUrlState<unknown>('fw', FW)
  const [dirty, setDirty] = useUrlState<boolean>('sd', true)
  const fw = useMemo(() => merge(FW, raw), [raw])
  const set = (p: Partial<Fw>) => setRaw({ ...fw, ...p })
  const mem = fw.mem ? addressBitsForMemory(fw.mem) : null
  const addressBits = mem ? (mem.ok ? mem.value.bits : NaN) : fw.addr
  const geo = useMemo(
    () => geometry({ cacheBytes: fw.cache, blockBytes: fw.block, wordBytes: fw.word, addressBits, ways: fw.ways }),
    [fw.cache, fw.block, fw.word, addressBits, fw.ways],
  )
  const g = geo.ok ? geo.value : null
  const blocks = isPow2(fw.cache) && isPow2(fw.block) ? Math.max(1, fw.cache / fw.block) : 1
  const text = typeof fw.a === 'string' ? fw.a : ''
  const address = text.trim() ? parseNumber(text) : null
  const addrError = text.trim() && g && (address === null || address >= 2 ** g.config.addressBits) ? `Cannot read "${text}" as a ${g.config.addressBits}-bit address.` : ''
  const split = g && address !== null && !addrError ? splitAddress(g, address) : undefined
  const st = g ? storageBits(g, dirty === true) : null
  const ladder = useMemo(() => {
    if (!g) return []
    const list: (number | 'full')[] = [1]
    for (let w = 2; w < g.blocks && w <= 256; w *= 2) list.push(w)
    if (g.blocks > 1) list.push('full')
    return list.flatMap((ways) => {
      const r = geometry({ ...g.config, ways })
      return r.ok ? [{ ways, sets: r.value.sets, index: r.value.indexBits, tag: r.value.tagBits }] : []
    })
  }, [g])

  const [rawFt, setFt] = useUrlState<FwTab>('ft', 'widths')
  const ft: FwTab = FW_TABS.some((t) => t.value === rawFt) ? rawFt : 'widths'
  const org = g ? (g.mapping === 'full' ? 'Fully associative' : g.mapping === 'direct' ? 'Direct mapped' : `${g.ways}-way`) : ''

  return (
    <>
      <div className="ca-command-wrap">
        <div className="ca-command-row">
          <div className="ca-command glow-input">
            <span className="ca-command-label">Cache</span>
            <BarSelect label="Size" name="Cache size" value={String(fw.cache)} options={pow2Options(2, 30)} onChange={(v) => set({ cache: Number(v) })} />
            <BarSelect label="Blocks of" name="Block size" value={String(fw.block)} options={pow2Options(0, 16)} onChange={(v) => set({ block: Number(v) })} />
            <BarSelect label="Ways" name="Associativity" value={String(fw.ways)} options={waysSelect(blocks)} onChange={(v) => set({ ways: v === 'full' ? 'full' : Number(v) })} />
          </div>
          <Presets presets={FW_PRESETS} onPick={(v) => setRaw({ ...FW, ...v })} />
        </div>
        <details className="ca-more">
          <summary>Address width and word size</summary>
          <div className="ca-config">
            <Select label="Memory size" value={String(fw.mem)} options={MEM_SIZES} onChange={(v) => set({ mem: Number(v) })} />
            {!fw.mem ? <NumberField label="Address" value={fw.addr} min={1} max={48} suffix="bits" width="4em" onChange={(v) => set({ addr: v })} /> : null}
            <Select label="Word size" value={String(fw.word)} options={pow2Options(0, 3)} onChange={(v) => set({ word: Number(v) })} />
          </div>
        </details>
      </div>
      {mem && !mem.ok ? <Errors list={mem.errors} /> : null}
      {!geo.ok ? <Errors list={geo.errors} /> : null}
      {g ? (
        <>
          <div className="ca-board canvas">
            <div className="ca-board-bar">
              <p className="ca-board-title">
                <span>{mem && mem.ok ? <W e={mem.value.why}>{mem.value.bits}-bit address</W> : `${g.config.addressBits}-bit address`}</span>
                <span className="ca-board-step">{org}</span>
              </p>
              <label className="ca-split glow-input">
                <span className="ca-bar-label">Split an address</span>
                <input className="mono" value={text} onChange={(e) => set({ a: e.target.value })} placeholder="0x12345678" spellCheck={false} autoComplete="off" />
              </label>
            </div>
            {addrError ? <Errors list={[addrError]} /> : null}
            <div className="ca-board-top">
              <div className="ca-board-addr">
                <AddressBar g={g} split={split} />
                {split ? (
                  <p className="ca-line">
                    Block <W e={split.why.block}>{split.block}</W>, word in block <W e={split.why.word}>Word{split.wordInBlock}</W>.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="ca-board-foot">
              <Legend
                items={[
                  { signal: 'path', label: 'index: picks the set' },
                  { signal: 'data', label: 'offset: picks the byte in the block' },
                ]}
              />
            </div>
          </div>
          <section className="ca-details" aria-label="Field width tables">
            <Tabs label="Tables" value={ft} onChange={setFt} tabs={FW_TABS} />
            <div className="ca-detail-body">
              {ft === 'widths' ? (
                <Facts
                  items={[
                    ...(mem && mem.ok ? [['Address width', <W e={mem.value.why}>{mem.value.bits} bits</W>] as [ReactNode, ReactNode]] : []),
                    ['Offset N', <W e={g.why.offset}>{g.offsetBits} bits</W>],
                    ['Block number', <W e={g.why.blockNumber}>{g.blockNumberBits} bits</W>],
                    ['Cache blocks', <W e={g.why.blocks}>{g.blocks}</W>],
                    ['Sets', <W e={g.why.sets}>{g.sets}</W>],
                    [g.mapping === 'direct' ? 'Index M' : 'Set index M', <W e={g.why.index}>{g.indexBits} bits</W>],
                    ['Tag', <W e={g.why.tag}>{g.tagBits} bits</W>],
                    ['Words per block', <W e={g.why.wordsPerBlock}>{g.wordsPerBlock}</W>],
                    ['Bit ranges', [g.ranges.tag, g.ranges.index, g.ranges.offset].map((r) => r?.text ?? '-').join(' | ')],
                  ]}
                />
              ) : null}
              {ft === 'ways' ? (
                <div className="table-wrap">
                  <table className="dtable dtable-compact">
                    <caption>Each doubling of the ways moves one bit from the index to the tag (L23 p11-12, p26).</caption>
                    <thead>
                      <tr>
                        <th>Organisation</th>
                        <th style={{ textAlign: 'right' }}>Sets</th>
                        <th style={{ textAlign: 'right' }}>Index bits</th>
                        <th style={{ textAlign: 'right' }}>Tag bits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladder.map((r) => (
                        <tr key={String(r.ways)} className={String(r.ways) === String(g.mapping === 'full' ? 'full' : g.ways) ? 'row-path' : undefined}>
                          <td>{r.ways === 1 ? 'Direct mapped' : r.ways === 'full' ? 'Fully associative' : `${r.ways}-way`}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>
                            {r.sets}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>
                            {r.index}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>
                            {r.tag}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {ft === 'storage' && st ? (
                <div className="ca-results">
                  <Toggle label="Dirty bit (write-back)" checked={dirty === true} onChange={setDirty} />
                  <Facts
                    items={[
                      ['Bits per line', <W e={st.why.perLine}>{st.perLine.total}</W>],
                      ['Lines', st.lines],
                      ['Total', <W e={st.why.total}>{st.totalBits.toLocaleString('en')} bits</W>],
                      ['Data only', `${st.dataBits.toLocaleString('en')} bits (${fmtBytes(g.config.cacheBytes)})`],
                      ['Tag, valid and dirty', `${st.overheadBits.toLocaleString('en')} bits`],
                      ['Tag bits per set', <W e={st.why.tagBitsPerSet}>{st.tagBitsPerSet}</W>],
                    ]}
                  />
                </div>
              ) : null}
              {ft === 'traps' ? (
                <div className="ca-callouts">
                  <Callout kind="trap" title="Sets, not blocks" cite="L23 p11-12">
                    In an N-way cache the set index is log2(number of sets). Using log2(number of blocks) gives too many index bits.
                  </Callout>
                  <Callout kind="trap" title="Fully associative has no index" cite="L23 p26-28; AY23/24 S1 Q13">
                    The tag is the whole block number. FA still has cold and capacity misses, but no conflict misses.
                  </Callout>
                  <Callout kind="course" title="Address width from memory size" cite="R12 p40-42">
                    Memory is byte addressed, so 2^k bytes need k address bits: 4 GB gives 32, 16 GB gives 34.
                  </Callout>
                  <Callout kind="trap" title="Check the word size" cite="T11 Q1">
                    T11 uses 2-byte words, so a 2-word block is 4 bytes and its words are M[4] and M[6].
                  </Callout>
                  <Callout kind="beyond" title="Multilevel caches" cite="L23 p38-41">
                    The L1, L2 and L3 presets come from an exploration slide. Only their field splits are worked here.
                  </Callout>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

/* ---------- Drill ---------- */

interface Dr {
  seed: number
  off: string
  idx: string
  tag: string
  show: boolean
}
const DR: Dr = { seed: 1, off: '', idx: '', tag: '', show: false }

/** A question from its seed, so a drill link reopens the same question. Small LCG; the seed is not an address. */
export function drillConfig(seed: number) {
  let x = Math.abs(Math.floor(seed)) % 2 ** 32 || 1
  const pick = <T,>(list: T[]): T => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return list[Math.floor((x / 2 ** 32) * list.length)]
  }
  const addressBits = pick([32, 32, 32, 16, 28, 34])
  const blockExp = pick([2, 3, 4, 5, 6])
  const cacheExp = pick(Array.from({ length: Math.min(20, addressBits - 4) - blockExp - 1 }, (_, i) => blockExp + 2 + i))
  const blocks = 2 ** (cacheExp - blockExp)
  const ways = pick(([1, 1, 2, 4, 8, 'full'] as (number | 'full')[]).filter((w) => w === 'full' || w < blocks))
  return { addressBits, blockBytes: 2 ** blockExp, cacheBytes: 2 ** cacheExp, ways }
}

function Drill() {
  const [raw, setRaw] = useUrlState<unknown>('dr', DR)
  const d = useMemo(() => merge(DR, raw), [raw])
  const set = (p: Partial<Dr>) => setRaw({ ...d, ...p })
  const q = useMemo(() => drillConfig(Number(d.seed)), [d.seed])
  const geo = useMemo(() => geometry(q), [q])
  if (!geo.ok) return null
  const g = geo.value
  const org = q.ways === 1 ? 'direct mapped' : q.ways === 'full' ? 'fully associative' : `${q.ways}-way set associative`
  const fields: { key: 'off' | 'idx' | 'tag'; label: string; want: number }[] = [
    { key: 'off', label: 'Offset bits', want: g.offsetBits },
    { key: 'idx', label: g.mapping === 'direct' ? 'Index bits' : 'Set index bits', want: g.indexBits },
    { key: 'tag', label: 'Tag bits', want: g.tagBits },
  ]
  const typed = fields.map((f) => {
    const t = typeof d[f.key] === 'string' ? d[f.key].trim() : ''
    return t === '' ? null : Number(t) === f.want
  })
  return (
    <Panel title="Drill: field widths" actions={<Button onClick={() => setRaw({ ...DR, seed: Math.floor(Math.random() * 2 ** 30) + 1 })}>New question</Button>}>
      <p>
        {q.addressBits}-bit byte addresses, a {fmtBytes(q.cacheBytes)} {org} cache with {fmtBytes(q.blockBytes)} blocks. How wide is each field?
      </p>
      <div className="ca-config">
        {fields.map((f, i) => (
          <span key={f.key} className="ca-drill">
            <TextField label={f.label} value={typeof d[f.key] === 'string' ? d[f.key] : ''} onChange={(v) => set({ [f.key]: v })} width="4em" />
            {typed[i] === null ? null : (
              <Chip signal={typed[i] ? 'hit' : 'miss'}>{typed[i] ? 'right' : 'wrong'}</Chip>
            )}
          </span>
        ))}
        <Toggle label="Show the working" checked={d.show === true} onChange={(v) => set({ show: v })} />
      </div>
      {typed.every((t) => t === true) ? <p className="ca-line">All three right.</p> : null}
      {d.show === true ? (
        <Facts
          items={[
            ['Offset', <W e={g.why.offset}>{g.offsetBits} bits</W>],
            ['Sets', <W e={g.why.sets}>{g.sets}</W>],
            [fields[1].label, <W e={g.why.index}>{g.indexBits}</W>],
            ['Tag', <W e={g.why.tag}>{g.tagBits} bits</W>],
          ]}
        />
      ) : null}
    </Panel>
  )
}

/* ---------- Solve from the tag ---------- */

interface Inv {
  mem: number
  block: number
  ways: number
  tag: number
}
const INV: Inv = { mem: 16 * GB, block: 4 * KB, ways: 4, tag: 10 }

function FromTag() {
  const [raw, setRaw] = useUrlState<unknown>('inv', INV)
  const v = useMemo(() => merge(INV, raw), [raw])
  const set = (p: Partial<Inv>) => setRaw({ ...v, ...p })
  const bits = addressBitsForMemory(v.mem)
  const r = bits.ok ? solveFromTag({ addressBits: bits.value.bits, blockBytes: v.block, ways: v.ways, tagBits: v.tag }) : bits
  return (
    <Panel title="Solve from the tag width" actions={<span className="ca-muted">R12 p41</span>}>
      <div className="ca-config">
        <Select label="Memory size" value={String(v.mem)} options={pow2Options(16, 40)} onChange={(x) => set({ mem: Number(x) })} />
        <Select label="Block size" value={String(v.block)} options={pow2Options(0, 16)} onChange={(x) => set({ block: Number(x) })} />
        <NumberField label="Ways" value={v.ways} min={1} width="4em" onChange={(x) => set({ ways: x })} />
        <NumberField label="Tag" value={v.tag} min={0} suffix="bits" width="4em" onChange={(x) => set({ tag: x })} />
      </div>
      {!r.ok ? (
        <Errors list={r.errors} />
      ) : (
        <Facts
          items={[
            ['Address width', bits.ok ? <W e={bits.value.why}>{bits.value.bits} bits</W> : '-'],
            ['Offset', <W e={r.value.why.offset}>{r.value.offsetBits} bits</W>],
            ['Set index', <W e={r.value.why.index}>{r.value.indexBits} bits</W>],
            ['Sets', <W e={r.value.why.sets}>{r.value.sets}</W>],
            ['Cache size', <W e={r.value.why.cache}>{fmtBytes(r.value.cacheBytes)}</W>],
          ]}
        />
      )}
    </Panel>
  )
}

/* ---------- Average access time ---------- */

interface Am {
  hit: number
  pm: 'memory' | 'penalty'
  mem: number
  pen: number
  solve: 'avg' | 'rate'
  h: number
  target: number
}
const AM: Am = { hit: 0.8, pm: 'memory', mem: 10, pen: 10.8, solve: 'rate', h: 0.98, target: 1 }
const AM_PRESETS: { name: string; source: string; value: Am }[] = [
  { name: 'Hit rate for a 1 ns average', source: 'L22 p21', value: AM },
  { name: '5 ns cache, 80 ns memory, 2.5% misses', source: 'AY16/17 Q6, derived', value: { hit: 5, pm: 'memory', mem: 80, pen: 85, solve: 'avg', h: 0.975, target: 7 } },
]

function Amat() {
  const [raw, setRaw] = useUrlState<unknown>('am', AM)
  const v = useMemo(() => merge(AM, raw), [raw])
  const set = (p: Partial<Am>) => setRaw({ ...v, ...p })
  const r = averageAccessTime({
    hitTime: v.hit,
    ...(v.pm === 'penalty' ? { missPenalty: v.pen } : { memoryTime: v.mem }),
    ...(v.solve === 'avg' ? { hitRate: v.h } : { target: v.target }),
  })
  return (
    <Panel title="Average access time" actions={<Presets presets={AM_PRESETS} onPick={(x) => setRaw(x)} />}>
      <div className="ca-config">
        <NumberField label="Hit time" value={v.hit} min={0} step={0.1} suffix="ns" onChange={(x) => set({ hit: x })} />
        <Segmented
          label="Miss penalty from"
          value={v.pm}
          options={[
            { value: 'memory', label: 'Memory time' },
            { value: 'penalty', label: 'Given' },
          ]}
          onChange={(x) => set({ pm: x })}
        />
        {v.pm === 'memory' ? (
          <NumberField label="Memory time" value={v.mem} min={0} step={1} suffix="ns" onChange={(x) => set({ mem: x })} />
        ) : (
          <NumberField label="Miss penalty" value={v.pen} min={0} step={0.1} suffix="ns" onChange={(x) => set({ pen: x })} />
        )}
        <Segmented
          label="Solve for"
          value={v.solve}
          options={[
            { value: 'avg', label: 'Average time' },
            { value: 'rate', label: 'Hit rate' },
          ]}
          onChange={(x) => set({ solve: x })}
        />
        {v.solve === 'avg' ? (
          <NumberField label="Hit rate" value={v.h} min={0} max={1} step={0.01} onChange={(x) => set({ h: x })} />
        ) : (
          <NumberField label="Target average" value={v.target} min={0} step={0.1} suffix="ns" onChange={(x) => set({ target: x })} />
        )}
      </div>
      {!r.ok ? (
        <Errors list={r.errors} />
      ) : (
        <Facts
          items={[
            ['Miss penalty', <W e={r.value.why.penalty}>{r.value.missPenalty} ns</W>],
            [v.solve === 'avg' ? 'Average access time' : 'Required hit rate', <W e={r.value.why.result}>{v.solve === 'avg' ? `${r.value.average} ns` : r.value.hitRate}</W>],
          ]}
        />
      )}
      <Callout kind="trap" title="The miss penalty includes the hit time" cite="L22 p20-21">
        With a 0.8 ns cache and 10 ns memory the penalty is 10.8 ns, not 10.
      </Callout>
    </Panel>
  )
}

/* ---------- Pipeline and cache ---------- */

interface Pc {
  block: number
  cpw: number
  restart: boolean
  h: number
  frac: number
  n: number
}
const PC: Pc = { block: 16, cpw: 10, restart: false, h: 0.95, frac: 0.32, n: 100 }
const PC_PRESETS: { name: string; source: string; value: Pc }[] = [
  { name: '10 cycles per word, 95% hits', source: 'AY24/25 Q20', value: PC },
  { name: 'Same, restart counted', source: 'AY24/25 Q20, accepted alternative', value: { ...PC, restart: true } },
  { name: '5 cycles per word, restart counted, 90% hits', source: 'AY25/26 Q20, R12 p48', value: { block: 16, cpw: 5, restart: true, h: 0.9, frac: 1, n: 1 } },
]

function PipelineCalc() {
  const [raw, setRaw] = useUrlState<unknown>('pc', PC)
  const v = useMemo(() => merge(PC, raw), [raw])
  const set = (p: Partial<Pc>) => setRaw({ ...v, ...p })
  const r = pipelineCacheModel({ blockBytes: v.block, cyclesPerWord: v.cpw, restart: v.restart === true, hitRate: v.h, dataFraction: v.frac, instructions: v.n })
  return (
    <Panel title="Pipeline with a word-at-a-time memory" actions={<Presets presets={PC_PRESETS} onPick={(x) => setRaw(x)} />}>
      <div className="ca-config">
        <Select label="Block size" value={String(v.block)} options={pow2Options(2, 8)} onChange={(x) => set({ block: Number(x) })} />
        <NumberField label="Cycles per word" value={v.cpw} min={0} width="4em" onChange={(x) => set({ cpw: x })} />
        <NumberField label="Hit rate" value={v.h} min={0} max={1} step={0.01} onChange={(x) => set({ h: x })} />
        <NumberField label="Data access fraction" value={v.frac} min={0} max={1} step={0.01} onChange={(x) => set({ frac: x })} />
        <NumberField label="Instructions" value={v.n} min={0} onChange={(x) => set({ n: x })} />
        <Toggle label="Count 1 cycle to restart" checked={v.restart === true} onChange={(x) => set({ restart: x })} />
      </div>
      {!r.ok ? (
        <Errors list={r.errors} />
      ) : (
        <>
          <Facts
            items={[
              ['Words per block', <W e={r.value.why.words}>{r.value.words}</W>],
              ['Miss penalty', <W e={r.value.why.missPenalty}>{plural(r.value.missPenalty, 'cycle')}</W>],
              ['lw, cache hit', <W e={r.value.why.lwHit}>{plural(r.value.lwHit, 'cycle')}</W>],
              ['lw, cache miss', <W e={r.value.why.lwMiss}>{plural(r.value.lwMiss, 'cycle')}</W>],
              ['beq', <W e={r.value.why.beq}>{plural(r.value.beq, 'cycle')}</W>],
              ['Cycles lost to misses', <W e={r.value.why.cyclesLost}>{r.value.cyclesLost}</W>],
              ['Data access cycles', <W e={r.value.why.dataAccessCycles}>{r.value.dataAccessCycles}</W>],
            ]}
          />
          <div className="ca-callouts">
            {r.value.notes.map((n, i) => (
              <Callout key={i} kind="course">
                {n}
              </Callout>
            ))}
            <Callout kind="trap" title="beq never waits for the data cache" cite="R12 p48; AY25/26 Q20(d)">
              Only lw and sw use data memory, so a data-cache miss cannot slow beq.
            </Callout>
          </div>
        </>
      )}
    </Panel>
  )
}

type Tool = 'fw' | 'drill' | 'tag' | 'amat' | 'pipe'

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'fw', label: 'Field widths' },
  { value: 'drill', label: 'Drill' },
  { value: 'tag', label: 'Solve from the tag' },
  { value: 'amat', label: 'Average access time' },
  { value: 'pipe', label: 'Pipeline and cache' },
]

export default function CalcTab({ intro }: { intro: ReactNode }) {
  const [raw, setTool] = useUrlState<Tool>('kt', 'fw')
  const tool: Tool = TOOLS.some((t) => t.value === raw) ? raw : 'fw'
  return (
    <Workspace title="Cache" lectures="L22 p20-30, L23 p11-27, R12 p40-48" intro={intro}>
      <Tabs label="Calculators" value={tool} onChange={setTool} tabs={TOOLS} />
      {tool === 'fw' ? <FieldWidths /> : null}
      {tool === 'drill' ? <Drill /> : null}
      {tool === 'tag' ? <FromTag /> : null}
      {tool === 'amat' ? <Amat /> : null}
      {tool === 'pipe' ? <PipelineCalc /> : null}
    </Workspace>
  )
}
