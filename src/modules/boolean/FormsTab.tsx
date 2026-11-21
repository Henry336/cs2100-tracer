import { Fragment, useMemo, type ReactNode } from 'react'
import {
  assignmentOf,
  canonical,
  checkEquivalence,
  classify,
  combine,
  complementOf,
  dualOf,
  functionFromExpr,
  negationOf,
  parseExpr,
  parseFunction,
  printExpr,
  truthTable,
  valuesOf,
  type BoolFunction,
  type CombineOp,
  type Expr,
} from '../../core/boolean'
import { useUrlState } from '../../lib/url-state'
import { Callout, Chip, DataTable, Legend, Panel, Presets, TextField, Toggle, Workspace, type Column } from '../../ui/kit'
import { IssueList, W } from './common'
import { FORMS_PRESETS } from './presets'

const MAX_TT_VARS = 8
type Row = { index: number; values: number[]; f: number | 'X'; g?: number | 'X' }
const HEAD = /^\s*[A-Za-z][A-Za-z0-9]*\s*(?:\([^()]*\))?\s*=/

const DEFAULT = FORMS_PRESETS.find((p) => p.source === 'L13 p14') ?? FORMS_PRESETS[0]
const LISTISH = /[Σ∑Π∏]|^\s*(sum|prod)/i
const OPS: { op: CombineOp; sym: string }[] = [
  { op: 'or', sym: ' + ' },
  { op: 'and', sym: '∙' },
  { op: 'xor', sym: ' ⊕ ' },
]
const listOf = (fn: BoolFunction) => canonical(fn).sigma

export default function FormsTab({ intro }: { intro: ReactNode }) {
  const [rawEx, setEx] = useUrlState<unknown>('ex', DEFAULT.ex)
  const [rawEq, setEq] = useUrlState<unknown>('eq', DEFAULT.eq)
  const [sub, setSub] = useUrlState<boolean>('sub', true)
  const ex = typeof rawEx === 'string' ? rawEx : ''
  const eq = typeof rawEq === 'string' ? rawEq : ''

  const left = useMemo(() => parseFunction(ex), [ex])
  const fn = left.ok ? left.fn : null
  const leftExpr: Expr | undefined = left.ok ? left.expr : undefined
  const gName = fn?.name === 'G' ? 'H' : 'G'
  const eqBody = eq.replace(HEAD, '')
  // The right side is a Σm/ΠM list over the same variables (T06 SE2), or an expression.
  const isList = LISTISH.test(eqBody)
  const rightList = useMemo(() => (fn && isList ? parseFunction(eqBody, { vars: fn.vars, name: gName }) : null), [fn, isList, eqBody, gName])
  const right = useMemo(() => (eqBody.trim() && !isList ? parseExpr(eqBody) : null), [eqBody, isList])
  const gList = rightList?.ok ? rightList.fn : null
  // An expression on the left can take extra variables from the right; a Σm/ΠM list fixes its variables.
  const extra = right?.ok && fn ? right.vars.filter((v) => !fn.vars.includes(v)) : []
  const listClash = !leftExpr && extra.length > 0
  const vk = fn ? [...fn.vars, ...(leftExpr ? extra : [])].join(',') : ''
  const vars = useMemo(() => (vk ? vk.split(',') : []), [vk])
  const tooMany = vars.length > MAX_TT_VARS

  const data = useMemo(() => {
    if (!fn || tooMany) return null
    const fFull = leftExpr ? functionFromExpr(leftExpr, vars, fn.name) : fn
    const gFn = gList ?? (right?.ok && !listClash ? functionFromExpr(right.expr, vars, gName) : null)
    const fv = valuesOf(fFull)
    const gv = gFn ? valuesOf(gFn) : null
    const table = leftExpr ? truthTable(leftExpr, vars) : null
    const whole = leftExpr ? printExpr(leftExpr) : ''
    const subs = table ? table.columns.map((c, i) => ({ ...c, i })).filter((c) => !c.input && c.label !== whole) : []
    const rows: Row[] = Array.from({ length: 1 << vars.length }, (_, index) => ({
      index,
      values: table ? table.rows[index].values : vars.map((_, i) => (index >> (vars.length - 1 - i)) & 1),
      f: fv[index],
      g: gv?.[index],
    }))
    const differing = gv ? rows.flatMap((r) => (r.f !== 'X' && r.g !== 'X' && r.f !== r.g ? [r.index] : [])) : []
    const equiv =
      gv && leftExpr && right?.ok
        ? checkEquivalence(leftExpr, right.expr, vars)
        : gv
          ? {
              equivalent: !differing.length,
              differing,
              why: differing.length
                ? { rule: 'One row where the two sides differ is enough to show they are not equal.', working: `first at row ${differing[0]}`, cite: 'L13 p7-8' }
                : { rule: "Both agree on every row that is not a don't-care.", cite: 'L13 p7-8; L15 p46' },
            }
          : null
    const sets = gFn ? OPS.map((o) => ({ ...o, res: combine(fFull, gFn, o.op, `${fn.name}${o.sym.trim()}${gName}`) })) : []
    return { rows, subs, hasRight: !!gv, equiv, sets, comp: listOf(complementOf(fFull)) }
  }, [fn, leftExpr, right, gList, gName, vars, tooMany, listClash])
  const equiv = data?.equiv ?? null
  const bad = new Set(equiv?.differing ?? [])
  const first = equiv?.differing[0]
  const rows = data?.rows ?? []
  const c = useMemo(() => (fn ? canonical(fn) : null), [fn])
  const forms = useMemo(
    () => (leftExpr && fn ? { cls: classify(leftExpr, fn.vars), neg: printExpr(negationOf(leftExpr)), dual: printExpr(dualOf(leftExpr)) } : null),
    [leftExpr, fn],
  )

  const cols: Column<Row>[] = []
  if (fn && !tooMany) {
    cols.push({ key: 'i', header: 'Row', cell: (r) => r.index, mono: true, align: 'right' })
    vars.forEach((v, i) => cols.push({ key: `v${i}`, header: v, cell: (r) => r.values[i], mono: true, align: 'center' }))
    if (sub !== false)
      data?.subs.forEach((c) =>
        cols.push({ key: `s${c.i}`, header: <span className="mono bo-sub">{c.label}</span>, cell: (r) => r.values[c.i], mono: true, align: 'center' }),
      )
    cols.push({ key: 'f', header: <span className="mono">{fn.name}</span>, cell: (r) => <Bitv v={r.f} />, mono: true, align: 'center' })
    if (data?.hasRight)
      cols.push({
        key: 'g',
        header: <span className="mono">{gName}</span>,
        cell: (r) => (
          <span>
            <Bitv v={r.g ?? 0} />
            {r.index === first ? <span className="bo-flag"> counterexample</span> : bad.has(r.index) ? <span className="bo-flag"> differs</span> : null}
          </span>
        ),
        mono: true,
        align: 'center',
      })
  }


  return (
    <Workspace
      title="Boolean algebra and K-maps"
      lectures="L13 to L14, T06, R07"
      intro={intro}
      toolbar={
        <Presets
          presets={FORMS_PRESETS.map((p) => ({ name: p.name, source: p.source, value: p }))}
          onPick={(p) => {
            setEx(p.ex)
            setEq(p.eq)
          }}
        />
      }
      inspector={
        fn && c ? (
          <>
            <Panel title="Canonical forms">
              <dl className="bo-facts">
                <dt>Σm</dt>
                <dd className="mono">
                  <W e={c.why.sigma}>{c.sigma}</W>
                </dd>
                <dt>ΠM</dt>
                <dd className="mono">
                  <W e={c.why.pi}>{c.pi}</W>
                </dd>
                <dt>Sum of minterms</dt>
                <dd className="mono bo-wrap">{c.sumOfMinterms}</dd>
                <dt>Product of maxterms</dt>
                <dd className="mono bo-wrap">{c.productOfMaxterms}</dd>
                <dt>Fill in the blank</dt>
                <dd className="mono">
                  Σm: {c.fitbMinterms || 'none'}
                  <br />
                  ΠM: {c.fitbMaxterms || 'none'}
                </dd>
              </dl>
            </Panel>
            {forms ? (
              <Panel title="Form of the expression">
                <dl className="bo-facts">
                  <dt>SOP</dt>
                  <dd>
                    <Verdict yes={forms.cls.sop.yes} e={forms.cls.sop.why} />
                  </dd>
                  <dt>POS</dt>
                  <dd>
                    <Verdict yes={forms.cls.pos.yes} e={forms.cls.pos.why} />
                  </dd>
                  <dt>Canonical SOP</dt>
                  <dd>
                    <Verdict yes={forms.cls.canonicalSop.yes} e={forms.cls.canonicalSop.why} />
                  </dd>
                  <dt>Canonical POS</dt>
                  <dd>
                    <Verdict yes={forms.cls.canonicalPos.yes} e={forms.cls.canonicalPos.why} />
                  </dd>
                  <dt>Literals</dt>
                  <dd>
                    <W e={forms.cls.literals.why}>{forms.cls.literals.value}</W>
                  </dd>
                  <dt>Complement</dt>
                  <dd className="mono bo-wrap">
                    <W e={{ rule: "DeMorgan: swap ∙ and +, swap 0 and 1, and complement every literal.", cite: 'L13 p15' }}>
                      {fn.name}' = {forms.neg}
                    </W>
                  </dd>
                  <dt>Dual</dt>
                  <dd className="mono bo-wrap">
                    <W e={{ rule: 'Swap ∙ and +, swap 0 and 1, keep the literals as they are.', cite: 'L13 p11' }}>{forms.dual}</W>
                  </dd>
                </dl>
              </Panel>
            ) : null}
          </>
        ) : undefined
      }
    >
      <Panel title="Expressions">
        <div className="bo-row">
          <div className="bo-grow">
            <TextField label="Function: an expression, or Σm(..) / ΠM(..)" value={ex} onChange={setEx} placeholder="F(x,y,z) = x∙y + x'∙z" />
          </div>
        </div>
        {!left.ok ? <IssueList text={ex} issues={left.errors} /> : null}
        <IssueList text={ex} issues={left.warnings} kind="warning" />
        <div className="bo-row">
          <div className="bo-grow">
            <TextField label={`Compare with ${gName} (optional): an expression or Σm(..) / ΠM(..)`} value={eq} onChange={setEq} placeholder="x∙y' + x'∙z" />
          </div>
        </div>
        {right && !right.ok ? <IssueList text={eqBody} issues={right.errors} /> : null}
        {right ? <IssueList text={eqBody} issues={right.warnings} kind="warning" /> : null}
        {rightList && !rightList.ok ? <IssueList text={eqBody} issues={rightList.errors} /> : null}
        {listClash ? <p className="bo-status bo-bad">The right side uses {extra.join(', ')}, which {fn?.name} does not have.</p> : null}
        <p className="bo-muted">
          Type ' for NOT, ∙ or . or * for AND, + for OR, ⊕ or ^ for XOR. NOT binds tightest, then AND, then OR (L13 p9).
        </p>
      </Panel>

      {equiv && fn ? (
        <Panel title="Equivalence">
          <p className="bo-verdict">
            {equiv.equivalent ? <Chip signal="hit">equal</Chip> : <Chip signal="miss">not equal</Chip>}{' '}
            <W e={equiv.why}>
              {equiv.equivalent
                ? `${fn.name} and ${gName} agree on all ${1 << vars.length} rows${fn.dc.length ? " that are not don't-cares" : ''}`
                : `they differ on ${equiv.differing.length} row${equiv.differing.length === 1 ? '' : 's'}`}
            </W>
          </p>
          {first !== undefined ? (
            <p className="mono">
              Counterexample: row {first},{' '}
              {Object.entries(assignmentOf(first, vars))
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </p>
          ) : null}
        </Panel>
      ) : null}

      {data?.sets.length && fn ? (
        <Panel title={`Set operations on ${fn.name} and ${gName}`}>
          <dl className="bo-facts">
            {data.sets.map((o) =>
              o.res ? (
                <Fragment key={o.op}>
                  <dt className="mono">
                    {fn.name}
                    {o.sym}
                    {gName}
                  </dt>
                  <dd className="mono bo-wrap">
                    <W e={o.res.why}>{listOf(o.res.fn)}</W>
                  </dd>
                </Fragment>
              ) : null,
            )}
            <dt className="mono">{fn.name}'</dt>
            <dd className="mono bo-wrap">
              <W e={{ rule: `${fn.name}' is 1 exactly where ${fn.name} is 0, so its minterms are the maxterm indices of ${fn.name}.`, cite: 'L13 p25' }}>{data.comp}</W>
            </dd>
          </dl>
        </Panel>
      ) : null}

      {fn && tooMany ? (
        <Callout kind="course" title="Truth table too large">
          {vars.length} variables give {2 ** vars.length} rows; this table shows up to {MAX_TT_VARS} variables.
        </Callout>
      ) : null}

      {fn && !tooMany ? (
        <Panel
          flush
          title={`Truth table, ${1 << vars.length} rows`}
          actions={data?.subs.length ? <Toggle label="Show sub-expressions" checked={sub !== false} onChange={setSub} /> : undefined}
        >
          <DataTable compact columns={cols} rows={rows} rowSignal={(r) => (bad.has(r.index) ? 'miss' : undefined)} />
          <div className="bo-pad">
            <Legend
              items={[
                { signal: 'hit', label: '1' },
                { signal: 'dontcare', label: "X, don't care" },
                ...(data?.hasRight ? [{ signal: 'miss' as const, label: 'row where the two sides differ' }] : []),
              ]}
            />
          </div>
        </Panel>
      ) : null}

      <div className="bo-callouts">
        <Callout kind="trap" title="A∙B + A'∙B' is not 1" cite="T06 SE1">
          X + X' = 1 needs the second term to be the complement of the first. The complement of A∙B is A' + B', not A'∙B'.
        </Callout>
        <Callout kind="trap" title="Duality is not the complement" cite="L13 p11, p15">
          The dual swaps ∙ with + and 0 with 1 but leaves the literals alone. The complement also flips every literal.
        </Callout>
        <Callout kind="trap" title="A ⊕ B is not an SOP expression" cite="L15 p8; R07 p30">
          ⊕ is its own operator. Write it out as A'∙B + A∙B' when a question asks for SOP.
        </Callout>
        <Callout kind="course" title="AND before OR" cite="L13 p9; R07 p4">
          CS2100 gives AND higher precedence than OR, so A + B∙C means A + (B∙C). Some other modules write it differently.
        </Callout>
      </div>
    </Workspace>
  )
}

function Bitv({ v }: { v: number | 'X' }) {
  return <span className={v === 1 ? 'bo-one' : v === 'X' ? 'bo-x' : 'bo-zero'}>{v}</span>
}

function Verdict({ yes, e }: { yes: boolean; e: { rule: string; working?: string; cite?: string } }) {
  return (
    <W e={e}>
      {yes ? <Chip signal="hit">yes</Chip> : <Chip signal="stall">no</Chip>}
    </W>
  )
}
