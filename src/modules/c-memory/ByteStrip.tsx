import { Fragment } from 'react'
import { wordFromBytes, type CellView, type Endian, type TraceFrame, type VarView } from '../../core/c-memory'
import { hexAddr, W } from './common'
import { leaves } from './layout'

type Leaf = { cell: CellView; top: VarView }
type Word = { addr: number; bytes: ({ b: number | null; leaf?: Leaf } | null)[]; holds: Leaf[] }
type Segment = { label: string; rows: (Word | { gap: number; from: number })[] }

/** Words of memory that hold the frame's variables, grouped by segment, lowest address first. */
export function memoryWords(f: TraceFrame): Segment[] {
  const segs: { label: string; vars: VarView[] }[] = [
    { label: 'Stack', vars: f.stack.flatMap((s) => s.vars) },
    { label: 'Globals and static locals', vars: f.globals },
    { label: 'Heap', vars: f.heap },
    { label: 'String literals', vars: f.literals },
  ]
  return segs
    .filter((s) => s.vars.length > 0)
    .map(({ label, vars }) => {
      const byAddr = new Map<number, { b: number | null; leaf?: Leaf }>()
      for (const v of vars) {
        const ls = leaves(v)
        v.bytes.forEach((b, i) => {
          const a = v.address + i
          const cell = ls.find((l) => a >= l.address && a < l.address + l.size)
          byAddr.set(a, { b, ...(cell ? { leaf: { cell, top: v } } : {}) })
        })
      }
      const lo = Math.min(...vars.map((v) => v.address)) & ~3
      const hi = Math.max(...vars.map((v) => v.address + v.size))
      const rows: Segment['rows'] = []
      for (let a = lo >>> 0; a < hi; a += 4) {
        const bytes = [0, 1, 2, 3].map((k) => byAddr.get(a + k) ?? null)
        const holds: Leaf[] = []
        for (const x of bytes) if (x?.leaf && !holds.some((h) => h.cell.id === x.leaf!.cell.id)) holds.push(x.leaf)
        if (bytes.every((x) => x === null)) {
          const last = rows[rows.length - 1]
          if (last && 'gap' in last) last.gap += 4
          else rows.push({ gap: 4, from: a })
        } else rows.push({ addr: a, bytes, holds })
      }
      return { label, rows }
    })
}

export function ByteStrip({ frame, endian, selected, onSelect }: { frame: TraceFrame; endian: Endian; selected: string | null; onSelect: (id: string) => void }) {
  const segs = memoryWords(frame)
  if (segs.length === 0) return <p className="cm-muted">No variables in memory at this step.</p>
  return (
    <div className="table-wrap cm-strip-wrap">
      <table className="dtable dtable-compact cm-strip">
        <thead>
          <tr>
            <th>Address</th>
            <th className="cm-c">+0</th>
            <th className="cm-c">+1</th>
            <th className="cm-c">+2</th>
            <th className="cm-c">+3</th>
            <th>Holds</th>
          </tr>
        </thead>
        <tbody>
          {segs.map((s) => (
            <Fragment key={s.label}>
              <tr className="cm-strip-seg">
                <td colSpan={6}>{s.label}</td>
              </tr>
              {s.rows.map((r) =>
                'gap' in r ? (
                  <tr key={`gap-${r.from}`} className="cm-strip-gap">
                    <td className="mono">{hexAddr(r.from)}</td>
                    <td colSpan={5}>{r.gap} bytes not used by any variable (alignment or a frame's unused room)</td>
                  </tr>
                ) : (
                  <tr key={r.addr}>
                    <td className="mono">{hexAddr(r.addr)}</td>
                    {r.bytes.map((x, k) => {
                      const sel = x?.leaf && selected !== null && (x.leaf.cell.id === selected || x.leaf.cell.id.startsWith(`${selected}[`) || x.leaf.cell.id.startsWith(`${selected}.`))
                      const cls = ['mono', 'cm-c', 'cm-byte', !x ? 'cm-byte-none' : '', x && x.b === null ? 'cm-byte-garbage' : '', x?.leaf?.cell.changed ? 'cm-byte-changed' : '', sel ? 'cm-byte-sel' : '']
                      return (
                        <td key={k} className={cls.join(' ')} title={x?.leaf ? `${x.leaf.cell.name}, byte at ${hexAddr(r.addr + k)}` : 'not part of a variable'}>
                          {!x ? '' : x.b === null ? '??' : x.b.toString(16).padStart(2, '0')}
                        </td>
                      )
                    })}
                    <td className="cm-holds">
                      {r.holds.map((h, i) => (
                        <Fragment key={h.cell.id}>
                          {i ? ', ' : ''}
                          <button type="button" className="cm-link mono" onClick={() => onSelect(h.cell.id)} aria-pressed={selected === h.cell.id}>
                            {h.cell.name}
                          </button>
                          <span className="cm-muted"> = {h.cell.value.length > 18 ? `${h.cell.value.slice(0, 17)}…` : h.cell.value}</span>
                        </Fragment>
                      ))}
                    </td>
                  </tr>
                ),
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="cm-muted cm-strip-note">
        Bytes in hex, {endian}-endian. ?? is a byte that was never written (garbage).
      </p>
    </div>
  )
}

/** How the selected scalar's bytes read back as a number. */
export function ByteReading({ cell, top, endian }: { cell: CellView; top: VarView; endian: Endian }) {
  if (cell.kind !== 'scalar' && cell.kind !== 'pointer') return null
  const raw = top.bytes.slice(cell.offset, cell.offset + cell.size)
  if (raw.some((b) => b === null)) return <p className="cm-muted">Its bytes were never written, so they hold garbage.</p>
  const bytes = raw as number[]
  const hexs = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
  if (cell.size > 4 || cell.type === 'float') return <p className="cm-line">Bytes in address order: <span className="mono">{hexs}</span></p>
  const w = wordFromBytes(bytes, endian)
  const other = wordFromBytes(bytes, endian === 'big' ? 'little' : 'big')
  return (
    <p className="cm-line">
      Bytes in address order <span className="mono">{hexs}</span> read as <W e={w.explain}><span className="mono">{w.hex}</span></W>
      {cell.size > 1 ? (
        <>
          . The same bytes read {endian === 'big' ? 'little' : 'big'}-endian would be <span className="mono">{other.hex}</span>.
        </>
      ) : (
        '. A single byte reads the same either way.'
      )}
    </p>
  )
}
