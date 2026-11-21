import type { ReactNode } from 'react'
import { arrayAddress, endianBytes, structLayout, wordFromBytes, type Endian } from '../../core/c-memory'
import { useUrlState } from '../../lib/url-state'
import { Callout, CodeEditor, DataTable, Legend, NumberField, Panel, Presets, Segmented, Select, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { addressToIndex, paddedLayout, parseList, parseMembers, unionLayout } from './calc'
import { W, hexAddr, parseAddr } from './common'

type ElemType = 'char' | 'int' | 'float' | 'double' | 'ptr' | 'custom'
const ELEM_SIZE: Record<Exclude<ElemType, 'custom'>, number> = { char: 1, int: 4, float: 4, double: 8, ptr: 4 }
const ELEM_NAME: Record<ElemType, string> = { char: 'char', int: 'int', float: 'float', double: 'double', ptr: 'int *', custom: 'T' }

type CalcPreset =
  | { kind: 'array'; et: ElemType; es?: number; dims: string; idx: string; base: string; addr: string }
  | { kind: 'struct'; members: string; base: string; n: number; union?: boolean }
  | { kind: 'bytes'; value: string; base: string; bytes: string }

const PRESETS: { name: string; source: string; value: CalcPreset }[] = [
  { name: 'Array: int a[3][4], a[2][1]', source: 'R02 p26', value: { kind: 'array', et: 'int', dims: '3, 4', idx: '2, 1', base: '', addr: '36' } },
  { name: 'Array: int C[4][3][2], C[2][1][0]', source: 'Recitation and Tutorial Extras p7', value: { kind: 'array', et: 'int', dims: '4, 3, 2', idx: '2, 1, 0', base: '', addr: '56' } },
  { name: 'Array: int m[3][4][5] global, &m[2][1][3]', source: 'R02 p26 formula; tracer preset CM40', value: { kind: 'array', et: 'int', dims: '3, 4, 5', idx: '2, 1, 3', base: '0x10010000', addr: '0x100100c0' } },
  { name: 'Array: int a[3] at ffbff724, &a[1]', source: 'L05A p8', value: { kind: 'array', et: 'int', dims: '3', idx: '1', base: '0xffbff724', addr: '0xffbff728' } },
  { name: 'Struct: struct result (stuNum, score, grade)', source: 'L05C p3, p10', value: { kind: 'struct', members: 'int stuNum;\nfloat score;\nchar grade;', base: '', n: 0 } },
  { name: 'Struct: rec_t st[2], &st[1]', source: 'AY17/18 S2 Final Q1a', value: { kind: 'struct', members: 'int val;\nchar ch[2];', base: '0xffbff7f4', n: 1 } },
  { name: 'Struct: player_t', source: 'L05D p5', value: { kind: 'struct', members: 'char name[12];\nint age;\nchar gender;', base: '', n: 0 } },
  { name: 'Struct: data_t (array vs pointer member)', source: 'AY21/22 S2 Final Q3', value: { kind: 'struct', members: 'int x[1];\nint *y;', base: '', n: 0 } },
  { name: 'Struct: struct point { double *x, *y }', source: 'AY23/24 S2 Final Q1', value: { kind: 'struct', members: 'double *x;\ndouble *y;', base: '', n: 0 } },
  { name: 'Union: union IF { int i; float f; char c; }', source: 'R02 p32', value: { kind: 'struct', members: 'int i;\nfloat f;\nchar c;', base: '', n: 0, union: true } },
  { name: 'Struct: struct SF { int i; float f; char c; }', source: 'R02 p32', value: { kind: 'struct', members: 'int i;\nfloat f;\nchar c;', base: '', n: 0 } },
  { name: 'Bytes: 0xDEADBEEF at address 0', source: 'L10 p17', value: { kind: 'bytes', value: '0xDEADBEEF', base: '0', bytes: 'de ad be ef' } },
  { name: "Bytes: 43 61 74 73 at 0x3E8 ('Cats')", source: 'AY21/22 S1 Final Q7', value: { kind: 'bytes', value: '0x43617473', base: '0x3e8', bytes: '43 61 74 73' } },
]

export default function CalcTab({ intro }: { intro: ReactNode }) {
  const [et, setEt] = useUrlState<ElemType>('at', 'int')
  const [es, setEs] = useUrlState('as', 12)
  const [dimsText, setDims] = useUrlState('ad', '3, 4')
  const [idxText, setIdx] = useUrlState('ai', '2, 1')
  const [baseText, setBase] = useUrlState('ab', '')
  const [addrText, setAddr] = useUrlState('aa', '36')
  const [order, setOrder] = useUrlState<'row' | 'column'>('ao', 'row')
  const [members, setMembers] = useUrlState('sm', 'int val;\nchar ch[2];')
  const [sBase, setSBase] = useUrlState('sb', '0xffbff7f4')
  const [sPtr, setSPtr] = useUrlState<4 | 8>('sp', 4)
  const [sN, setSN] = useUrlState('sn', 1)
  const [pad, setPad] = useUrlState('spad', false)
  const [sKind, setSKind] = useUrlState<'struct' | 'union'>('sk', 'struct')
  const [bValue, setBValue] = useUrlState('bv', '0xDEADBEEF')
  const [bBase, setBBase] = useUrlState('ba', '0')
  const [bBytes, setBBytes] = useUrlState('bb', '43 61 74 73')

  const pick = (p: CalcPreset) => {
    if (p.kind === 'array') {
      setEt(p.et)
      if (p.es) setEs(p.es)
      setDims(p.dims)
      setIdx(p.idx)
      setBase(p.base)
      setAddr(p.addr)
      setOrder('row')
    } else if (p.kind === 'struct') {
      setMembers(p.members)
      setSBase(p.base)
      setSN(p.n)
      setSKind(p.union ? 'union' : 'struct')
    } else {
      setBValue(p.value)
      setBBase(p.base)
      setBBytes(p.bytes)
    }
  }

  return (
    <Workspace title="C memory and pointers" lectures="L05, R02, L10 p17" intro={intro} toolbar={<Presets presets={PRESETS} onPick={pick} />}>
      <ArrayPanel
        et={et}
        setEt={setEt}
        es={es}
        setEs={setEs}
        dimsText={dimsText}
        setDims={setDims}
        idxText={idxText}
        setIdx={setIdx}
        baseText={baseText}
        setBase={setBase}
        addrText={addrText}
        setAddr={setAddr}
        order={order === 'column' ? 'column' : 'row'}
        setOrder={setOrder}
      />
      <StructPanel members={members} setMembers={setMembers} base={sBase} setBase={setSBase} ptr={sPtr === 8 ? 8 : 4} setPtr={setSPtr} n={sN} setN={setSN} pad={pad === true} setPad={setPad} kind={sKind === 'union' ? 'union' : 'struct'} setKind={setSKind} />
      <BytesPanel value={bValue} setValue={setBValue} base={bBase} setBase={setBBase} bytes={bBytes} setBytes={setBBytes} />
    </Workspace>
  )
}

/* ---------- arrays ---------- */

function ArrayPanel(p: {
  et: ElemType
  setEt: (v: ElemType) => void
  es: number
  setEs: (v: number) => void
  dimsText: string
  setDims: (v: string) => void
  idxText: string
  setIdx: (v: string) => void
  baseText: string
  setBase: (v: string) => void
  addrText: string
  setAddr: (v: string) => void
  order: 'row' | 'column'
  setOrder: (v: 'row' | 'column') => void
}) {
  const S = p.et === 'custom' ? p.es : (ELEM_SIZE[p.et] ?? 4)
  const dims = parseList(p.dimsText)
  const index = parseList(p.idxText)
  const base = parseAddr(p.baseText)
  const baseBad = base !== undefined && !Number.isFinite(base)
  const fwd = arrayAddress({ elemSize: S, dims, index, order: p.order, ...(base !== undefined && Number.isFinite(base) ? { base } : {}) })
  const decl = `${ELEM_NAME[p.et]} a${dims.map((d) => `[${d}]`).join('')};`
  const elemName = `a${index.map((d) => `[${d}]`).join('')}`

  // backwards: with a base, the input is an address; without one, a byte offset from A0
  const addr = parseAddr(p.addrText)
  const symbolic = base === undefined
  const offset = addr === undefined || !Number.isFinite(addr) ? undefined : symbolic ? addr : addr - (base as number)
  const back = offset === undefined || baseBad ? undefined : addressToIndex(dims, S, offset, p.order, symbolic ? 'A0' : hexAddr(base as number))

  type Term = { j: number; index: number; weight: number; product: number }
  const termCols: Column<Term>[] = [
    { key: 'j', header: 'Index', cell: (t) => `i${t.j + 1}` },
    { key: 'i', header: 'Value', align: 'right', mono: true, cell: (t) => t.index },
    {
      key: 'w',
      header: 'One step skips',
      align: 'right',
      mono: true,
      cell: (t) => (
        <W
          e={{
            rule: p.order === 'row' ? 'One step of this index skips a whole block of all later dimensions' : 'One step of this index skips a block of all earlier dimensions (column-major)',
            working: `${(p.order === 'row' ? dims.slice(t.j + 1) : dims.slice(0, t.j)).join(' x ') || '1'} = ${t.weight} element${t.weight === 1 ? '' : 's'}`,
            cite: p.order === 'row' ? 'R02 p26' : 'R02 p25',
          }}
        >
          {t.weight}
        </W>
      ),
    },
    { key: 'p', header: 'Elements', align: 'right', mono: true, cell: (t) => t.product },
  ]

  return (
    <Panel title="Array element address">
      <div className="cm-row">
        <Select
          label="Element type"
          value={p.et}
          onChange={p.setEt}
          options={[
            { value: 'char', label: 'char (1 byte)' },
            { value: 'int', label: 'int (4 bytes)' },
            { value: 'float', label: 'float (4 bytes)' },
            { value: 'double', label: 'double (8 bytes)' },
            { value: 'ptr', label: 'pointer (4 bytes)' },
            { value: 'custom', label: 'other size (e.g. a struct)' },
          ]}
        />
        {p.et === 'custom' ? <NumberField label="Element size S" value={p.es} onChange={p.setEs} min={1} suffix="bytes" /> : null}
        <TextField label="Dimensions" value={p.dimsText} onChange={p.setDims} placeholder="3, 4" width="9em" />
        <TextField label="Start address A0 (blank: symbolic)" value={p.baseText} onChange={p.setBase} placeholder="0x10010000" width="11em" />
        <Segmented
          label="Storage order"
          value={p.order}
          onChange={p.setOrder}
          options={[
            { value: 'row', label: 'Row-major (C)' },
            { value: 'column', label: 'Column-major', title: 'For comparison only; C is row-major' },
          ]}
        />
      </div>
      {baseBad ? <p className="cm-err">{p.baseText} is not an address.</p> : null}
      <p className="cm-codeline mono">{decl}</p>

      <div className="cm-calc-grid">
        <section className="cm-sub" aria-label="Indices to address">
          <h3 className="cm-h3">Indices to address</h3>
          <TextField label="Indices" value={p.idxText} onChange={p.setIdx} placeholder="2, 1" width="9em" />
          {!fwd.ok ? (
            <p className="cm-err">{fwd.error}</p>
          ) : (
            <>
              <p className="cm-answer">
                &amp;{elemName} = <W e={fwd.explain}>{fwd.answer}</W>
              </p>
              <DataTable compact columns={termCols} rows={fwd.terms.map((t, j) => ({ ...t, j }))} />
              <ol className="cm-steps">
                {p.order === 'row' ? fwd.horner.map((h, k) => <li key={k} className="mono">{h}</li>) : null}
                <li className="mono">
                  {fwd.offsetElems} elements x {S} bytes = {fwd.offsetBytes} bytes
                </li>
                <li className="mono">{fwd.answer}</li>
              </ol>
            </>
          )}
        </section>
        <section className="cm-sub" aria-label="Address to indices">
          <h3 className="cm-h3">Address to indices</h3>
          <TextField label={symbolic ? 'Byte offset from A0' : 'Address'} value={p.addrText} onChange={p.setAddr} placeholder={symbolic ? '36' : '0x100100c0'} width="11em" />
          {addr !== undefined && !Number.isFinite(addr) ? <p className="cm-err">{p.addrText} is not a number.</p> : null}
          {back && !back.ok ? <p className="cm-err">{back.error}</p> : null}
          {back && back.ok ? (
            <>
              <p className="cm-answer">
                <W e={back.explain}>{`a${back.index.map((d) => `[${d}]`).join('')}`}</W>
                {back.byteIn ? <span className="cm-muted"> (byte {back.byteIn} inside it)</span> : null}
              </p>
              <ol className="cm-steps">
                {!symbolic ? (
                  <li className="mono">
                    {hexAddr(addr as number)} - {hexAddr(base as number)} = {back.offsetBytes}
                  </li>
                ) : null}
                {back.steps.map((s, k) => (
                  <li key={k} className="mono">
                    {s}
                  </li>
                ))}
              </ol>
              <button type="button" className="btn" onClick={() => p.setIdx(back.index.join(', '))}>
                Use these indices above
              </button>
            </>
          ) : null}
        </section>
      </div>
      {fwd.ok ? <ArrayStrip dims={dims} index={index} order={p.order} S={S} base={base !== undefined && Number.isFinite(base) ? base : undefined} /> : null}
      <div className="cm-callouts">
        <Callout kind="course" title="Row-major: the last index changes fastest" cite="R02 p25-26">
          A0 + S x (i1 x D2 x ... x Dn + i2 x D3 x ... x Dn + ... + in). a[r][c + 1] is the next element, while a[r + 1][c] is a whole row (D2 x S bytes) away.
        </Callout>
        <Callout kind="trap" title="The array name is not a variable" cite="L05A p8-9">
          a is the address of a[0]...[0], so a and &amp;a[0] print the same. It cannot be assigned, and a[i] is *(a + i), which moves i x S bytes.
        </Callout>
      </div>
    </Panel>
  )
}

const MAX_CELLS = 144

function ArrayStrip({ dims, index, order, S, base }: { dims: number[]; index: number[]; order: 'row' | 'column'; S: number; base?: number }) {
  const total = dims.reduce((a, b) => a * b, 1)
  if (total > MAX_CELLS) return <p className="cm-muted">The strip is drawn for arrays of up to {MAX_CELLS} elements.</p>
  // the index tuple of the k-th element in storage order
  const tuple = (k: number) => {
    const t = dims.map(() => 0)
    const js = dims.map((_, j) => j)
    if (order === 'row') js.reverse()
    for (const j of js) {
      t[j] = k % dims[j]
      k = Math.floor(k / dims[j])
    }
    return t
  }
  const fast = order === 'row' ? dims[dims.length - 1] : dims[0]
  const per = Math.min(16, fast)
  const target = arrayAddress({ elemSize: S, dims, index, order })
  const tk = target.ok ? target.offsetElems : -1
  const labelOf = (k: number) => tuple(k).join(',')
  const cw = Math.max(34, 12 + 6.6 * labelOf(total - 1).length)
  const lines = Math.ceil(total / per)
  const AX = 110
  const LH = 40
  const width = AX + per * (cw + 2) + 4
  const height = lines * LH + 6
  return (
    <div className="cm-diagram">
      <Legend
        items={[
          { signal: 'path', label: 'the element asked for' },
          { signal: 'data', label: 'elements stored before it (they make the offset)' },
        ]}
      />
      <svg className="cm-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Storage order of ${total} elements, element ${tk} highlighted`}>
        {Array.from({ length: lines }, (_, L) => {
          const k0 = L * per
          const y = L * LH + 4
          return (
            <g key={L}>
              <text className="cm-addr" x={AX - 8} y={y + 26} textAnchor="end">
                {base === undefined ? `A0 + ${k0 * S}` : hexAddr(base + k0 * S)}
              </text>
              {Array.from({ length: Math.min(per, total - k0) }, (_, j) => {
                const k = k0 + j
                const x = AX + j * (cw + 2)
                const cls = k === tk ? 'cm-box cm-changed' : k < tk ? 'cm-box cm-ptr' : 'cm-box'
                return (
                  <g key={k}>
                    <title>{`a${tuple(k).map((d) => `[${d}]`).join('')}: element ${k}, byte offset ${k * S}`}</title>
                    <text className="cm-idx" x={x + cw / 2} y={y + 9} textAnchor="middle">
                      {k}
                    </text>
                    <rect className={cls} x={x} y={y + 12} width={cw} height={22} rx={2} />
                    <text className={`cm-val${k === tk ? ' cm-val-strong' : ''}`} x={x + cw / 2} y={y + 27} textAnchor="middle">
                      {labelOf(k)}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <p className="cm-muted">Each box is one element, labelled with its indices; the number above is its position in memory. One line is one run of the fastest-changing index.</p>
    </div>
  )
}

/* ---------- structs ---------- */

function StructPanel(p: {
  members: string
  setMembers: (v: string) => void
  base: string
  setBase: (v: string) => void
  ptr: 4 | 8
  setPtr: (v: 4 | 8) => void
  n: number
  setN: (v: number) => void
  pad: boolean
  setPad: (v: boolean) => void
  kind: 'struct' | 'union'
  setKind: (v: 'struct' | 'union') => void
}) {
  const union = p.kind === 'union'
  const layout = (base?: number) => (union ? unionLayout(spec, base) : structLayout(spec, base))
  const parsed = parseMembers(p.members, p.ptr)
  const base = parseAddr(p.base)
  const b = base !== undefined && Number.isFinite(base) ? base : undefined
  const spec = parsed.members.map((m) => ({ name: m.name, type: m.type, size: m.size }))
  const lay = layout()
  const padded = paddedLayout(parsed.members)
  const elemAddr = b === undefined ? undefined : b + Math.max(0, Math.floor(p.n)) * lay.size
  const elemLay = elemAddr === undefined ? lay : layout(elemAddr)
  const errMap: Record<number, string> = {}
  for (const e of parsed.errors) errMap[e.line - 1] = e.message

  type Row = (typeof lay.members)[number] & { i: number }
  const cols: Column<Row>[] = [
    { key: 'n', header: 'Member', mono: true, cell: (r) => r.name },
    { key: 't', header: 'Type', mono: true, cell: (r) => r.type },
    { key: 's', header: 'Size', align: 'right', mono: true, cell: (r) => r.size },
    { key: 'o', header: 'Offset', align: 'right', mono: true, cell: (r) => <W e={r.explain}>{r.offset}</W> },
    ...(elemAddr !== undefined
      ? [{ key: 'a', header: `Address in element ${Math.floor(p.n)}`, mono: true, cell: (r: Row) => <W e={elemLay.members[r.i].explain}>{elemLay.members[r.i].addressHex}</W> } as Column<Row>]
      : []),
    ...(p.pad && !union ? [{ key: 'p', header: 'Padded offset', align: 'right', mono: true, cell: (r: Row) => `${padded.rows[r.i].offset}${padded.rows[r.i].gap ? ` (+${padded.rows[r.i].gap} gap)` : ''}` } as Column<Row>] : []),
  ]

  return (
    <Panel title={union ? 'Union layout' : 'Struct layout'}>
      <div className="cm-calc-grid">
        <div>
          <CodeEditor label="Members, one declaration per line" value={p.members} onChange={p.setMembers} rows={5} errors={Object.keys(errMap).length ? errMap : undefined} />
          <div className="cm-row">
            <TextField label="Start address (blank: offsets only)" value={p.base} onChange={p.setBase} placeholder="0xffbff7f4" width="11em" />
            <NumberField label="Element i of an array of them" value={p.n} onChange={(v) => p.setN(Math.max(0, Math.floor(v)))} min={0} />
            <Segmented label="Pointer size" value={p.ptr} onChange={p.setPtr} options={[{ value: 4, label: '4' }, { value: 8, label: '8' }]} />
            <Segmented
              label="Kind"
              value={p.kind}
              onChange={p.setKind}
              options={[
                { value: 'struct', label: 'struct', title: 'Members one after another (L05C p3)' },
                { value: 'union', label: 'union', title: 'Members share the same bytes (R02 p32)' },
              ]}
            />
          </div>
          {base !== undefined && !Number.isFinite(base) ? <p className="cm-err">{p.base} is not an address.</p> : null}
        </div>
        <div>
          {parsed.members.length ? (
            <>
              <p className="cm-answer">
                sizeof = <W e={lay.explain}>{`${lay.size} bytes`}</W>
                {p.pad && !union ? <span className="cm-muted"> ({padded.size} with padding)</span> : null}
              </p>
              {elemAddr !== undefined ? (
                <p className="cm-line">
                  Element {Math.floor(p.n)} starts at{' '}
                  <W
                    e={{
                      rule: `Elements of an array of ${p.kind}s sit back to back, each sizeof(${p.kind}) bytes long`,
                      working: `${hexAddr(b as number)} + ${Math.floor(p.n)} x ${lay.size} = ${hexAddr(elemAddr)}`,
                      cite: 'L05D p4; L05A p8',
                    }}
                  >
                    <span className="mono">{hexAddr(elemAddr)}</span>
                  </W>
                </p>
              ) : null}
              <DataTable compact columns={cols} rows={lay.members.map((m, i) => ({ ...m, i }))} />
            </>
          ) : (
            <p className="cm-muted">Add members such as int id; or char name[10];</p>
          )}
          {union ? null : (
            <div className="cm-row">
              <Toggle label="Show compiler padding (beyond the course)" checked={p.pad} onChange={p.setPad} />
            </div>
          )}
        </div>
      </div>
      <div className="cm-callouts">
        <Callout kind="course" title="No padding in this course" cite="L05C p3">
          Members are laid out in declaration order with no gaps, so sizeof is the sum of the member sizes. A struct type takes no memory until a variable of it is declared (L05C p5).
        </Callout>
        {union ? (
          <Callout kind="course" title="A union is one set of bytes" cite="R02 p32">
            All members start at offset 0, so writing one member overwrites the others. sizeof is the largest member, not the sum.
          </Callout>
        ) : null}
        {p.pad && !union ? (
          <Callout kind="beyond" title="Beyond the course: alignment padding">
            Real compilers usually start each member at a multiple of its own size and round the whole struct up to its largest member, which is why the slides' own printed addresses show gaps (L04B p5). Not examinable.
          </Callout>
        ) : null}
      </div>
    </Panel>
  )
}

/* ---------- byte order ---------- */

function BytesPanel(p: { value: string; setValue: (v: string) => void; base: string; setBase: (v: string) => void; bytes: string; setBytes: (v: string) => void }) {
  const v = parseAddr(p.value)
  const base = parseAddr(p.base)
  const b = base !== undefined && Number.isFinite(base) ? base : undefined
  const ok = v !== undefined && Number.isFinite(v) && v <= 0xffffffff
  const list = p.bytes
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => parseInt(t.replace(/^0x/i, ''), 16))
  const bytesOk = list.length >= 1 && list.length <= 4 && list.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)

  const table = (endian: Endian) => {
    const cells = endianBytes(v as number, endian, 4, b)
    return (
      <div>
        <h3 className="cm-h3">{endian === 'big' ? 'Big-endian' : 'Little-endian'}</h3>
        <div className="table-wrap"><table className="dtable dtable-compact">
          <thead>
            <tr>
              <th>Address</th>
              <th>Byte</th>
              <th>Bits</th>
              <th>Which byte</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c, k) => (
              <tr key={k}>
                <td className="mono">{c.addressHex ?? `+${k}`}</td>
                <td className="mono">{c.hex}</td>
                <td className="mono">{c.bits}</td>
                <td>{c.significance}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    )
  }

  return (
    <Panel title="Byte order (endianness)">
      <div className="cm-row">
        <TextField label="32-bit value" value={p.value} onChange={p.setValue} placeholder="0xDEADBEEF" width="10em" />
        <TextField label="Stored at address" value={p.base} onChange={p.setBase} placeholder="0" width="10em" />
      </div>
      {ok ? (
        <div className="cm-calc-grid">
          {table('big')}
          {table('little')}
        </div>
      ) : (
        <p className="cm-err">Give a value from 0 to 0xffffffff.</p>
      )}
      <div className="cm-row">
        <TextField label="Read bytes back (lowest address first)" value={p.bytes} onChange={p.setBytes} placeholder="43 61 74 73" width="12em" />
      </div>
      {bytesOk ? (
        <div className="table-wrap"><table className="dtable dtable-compact">
          <thead>
            <tr>
              <th>Read as</th>
              <th>Word in hex</th>
              <th>Unsigned</th>
              <th>Signed</th>
              <th>Chars in address order</th>
            </tr>
          </thead>
          <tbody>
            {(['big', 'little'] as const).map((e) => {
              const w = wordFromBytes(list, e)
              return (
                <tr key={e}>
                  <td>{e === 'big' ? 'Big-endian' : 'Little-endian'}</td>
                  <td className="mono">
                    <W e={w.explain}>{w.hex}</W>
                  </td>
                  <td className="mono">{w.unsigned}</td>
                  <td className="mono">{w.signed}</td>
                  <td className="mono">{w.chars}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      ) : (
        <p className="cm-err">Give 1 to 4 bytes in hex, separated by spaces.</p>
      )}
      <div className="cm-callouts">
        <Callout kind="trap" title="Chars read in address order never change" cite="L10 p17; AY21/22 S1 Final Q7">
          Byte order only matters when several bytes are read as one number. Read one by one as chars, the bytes spell the same text either way.
        </Callout>
      </div>
    </Panel>
  )
}
