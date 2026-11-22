import { useMemo, useRef, useState } from 'react'
import { href, navigate } from '../lib/router'
import { MODULES } from '../modules/registry'
import { readRecent } from './recent'
import { TRY, routeInput } from './route-input'

/** Grid area for each module on the die floorplan. */
const AREA: Record<string, string> = {
  mips: 'mips',
  'c-memory': 'cmem',
  datapath: 'dp',
  pipeline: 'pipe',
  cache: 'cache',
  boolean: 'bool',
  msi: 'msi',
  sequential: 'seq',
  reference: 'ref',
}

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB']

/** A chip on a bench, drawn line by line; a packet runs from the core to memory and back. */
function HeroSketch() {
  const wire = 'M118 66 H150 V40 H188'
  return (
    <svg className="hero-sketch" viewBox="0 0 240 120" aria-hidden="true">
      <g className="sk-lines">
        <rect x="38" y="28" width="80" height="64" rx="6" pathLength={1} />
        <path d="M54 28v-9M70 28v-9M86 28v-9M102 28v-9M54 92v9M70 92v9M86 92v9M102 92v9M38 44h-9M38 60h-9M38 76h-9" pathLength={1} />
        <path className="sk-alu" d="M62 44 L88 52 V68 L62 76 V64 L68 60 L62 56 Z" pathLength={1} />
        <path d={wire} pathLength={1} />
        <rect x="188" y="22" width="34" height="36" rx="3" pathLength={1} />
        <path d="M194 32h22M194 40h22M194 48h14" pathLength={1} />
        <path className="sk-bench" d="M14 108 C70 104 160 112 230 106" pathLength={1} />
      </g>
      <circle className="sk-packet" r="3" style={{ offsetPath: `path('${wire}')` }} />
    </svg>
  )
}

function Ask() {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLTextAreaElement>(null)
  const results = useMemo(() => routeInput(text), [text])
  const go = (i: number) => {
    const r = results[i]
    if (r) navigate(r.href.slice(1))
  }
  return (
    <div className="ask">
      <div className="ask-box glow-input">
        <textarea
          ref={box}
          className="ask-input"
          rows={1}
          value={text}
          spellCheck={false}
          aria-label="Type an instruction, a program, addresses, a Boolean function or a topic"
          placeholder="Type an instruction, addresses, a Boolean function or a topic"
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              go(active)
            } else if (e.key === 'Tab' && !e.shiftKey && results[active]?.complete) {
              // Fill the picked row's word, then keep that row picked in the new results.
              e.preventDefault()
              const next = results[active].complete!
              setText(next)
              setActive(Math.max(0, routeInput(next).findIndex((r) => r.where === results[active].where)))
            } else if (e.key === 'ArrowDown' && results.length) {
              e.preventDefault()
              setActive((a) => (a + 1) % results.length)
            } else if (e.key === 'ArrowUp' && results.length) {
              e.preventDefault()
              setActive((a) => (a - 1 + results.length) % results.length)
            }
          }}
        />
        <button type="button" className="ask-go" onClick={() => go(active)} disabled={!results.length} aria-label="Open the first match">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>
        </button>
      </div>
      {text.trim() ? (
        results.length ? (
          <ul className="ask-results" role="listbox" aria-label="Where this can go">
            {results.map((r, i) => (
              <li key={r.href} role="option" aria-selected={i === active}>
                <a href={r.href} className={i === active ? 'is-active' : undefined} onMouseEnter={() => setActive(i)}>
                  <span>{r.label}</span>
                  <span className="ask-where">
                    {i === active && r.complete ? <kbd className="ask-tab">Tab</kbd> : null}
                    {r.where}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ask-empty">Nothing matches that yet. Try an instruction such as lw $t0, 4($s1), or a word like cache.</p>
        )
      ) : (
        <Starters />
      )}
    </div>
  )
}

function Starters() {
  const recent = readRecent()
    .map((id) => MODULES.find((m) => m.id === id))
    .filter((m) => m !== undefined)
    .slice(0, 3)
  return (
    <div className="starters">
      <div className="starter-row">
        <span className="starter-k">Try</span>
        {TRY.map((t) => (
          <a key={t.label} className="starter" href={t.href}>
            {t.label}
          </a>
        ))}
      </div>
      {recent.length ? (
        <div className="starter-row">
          <span className="starter-k">Pick up</span>
          {recent.map((m) => (
            <a key={m.id} className="starter" href={href(m.path)}>
              {m.title}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <HeroSketch />
        <h1>What do you want to trace?</h1>
        <Ask />
      </section>

      <section className="home-map" aria-labelledby="map-title">
        <h2 id="map-title">Or pick a part of the chip</h2>
        <div className="die" role="list" aria-label="Modules, laid out as a processor floorplan">
          {MODULES.map((m) => (
            <a key={m.id} role="listitem" className={`block block-${AREA[m.id]}`} style={{ gridArea: AREA[m.id] }} href={href(m.path)} title={m.blurb}>
              <span className="block-top">
                <span className="block-name">{m.title}</span>
                <span className="block-lec mono">{m.lectures}</span>
              </span>
              {m.id === 'pipeline' ? (
                <span className="block-stages" aria-hidden="true">
                  {STAGES.map((s) => (
                    <span key={s} className="mono">
                      {s}
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="block-blurb">{m.blurb}</span>
            </a>
          ))}
        </div>
        <details className="home-about">
          <summary>How it works</summary>
          <div className="home-notes">
            <div>
              <h3>Stepping</h3>
              <p>
                Press Play, or use <kbd>←</kbd> <kbd>→</kbd> to step and <kbd>Space</kbd> to play. The link in your address bar keeps your code and
                options, so you can bookmark or share a trace.
              </p>
            </div>
            <div>
              <h3>Colours</h3>
              <ul className="legend home-legend">
                <li><span className="swatch swatch-path" />what is happening now</li>
                <li><span className="swatch swatch-data" />data values</li>
                <li><span className="swatch swatch-control" />control signals</li>
                <li><span className="swatch swatch-forward" />forwarding</li>
                <li><span className="swatch swatch-stall" />stall or idle</li>
                <li><span className="swatch swatch-hit" />hit, true</li>
                <li><span className="swatch swatch-miss" />miss, flush</li>
                <li><span className="swatch swatch-dirty" />dirty, write traffic</li>
              </ul>
            </div>
            <div>
              <h3>Where the rules come from</h3>
              <p>
                Each simulator follows the simplified model from the CS2100 slides and is tested against the answer keys. Where two sources disagree,
                you choose, and the tool names the source for each option.
              </p>
            </div>
          </div>
        </details>
      </section>
    </div>
  )
}
