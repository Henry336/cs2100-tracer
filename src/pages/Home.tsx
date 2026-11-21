import { href } from '../lib/router'
import { MODULES } from '../modules/registry'

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

export function Home() {
  return (
    <div className="home">
      <header className="home-head">
        <h1>Trace every part of a computer, the way CS2100 draws it.</h1>
        <p>
          Each block of this chip is a working tracer. Step through a program, a pipeline or a cache one cycle at a
          time, and click any number to see the rule that produced it. Presets come from the lectures, tutorials and
          past papers, so you can check your own answers.
        </p>
      </header>

      <div className="die" role="list" aria-label="Modules, laid out as a processor floorplan">
        {MODULES.map((m) => (
          <a key={m.id} role="listitem" className={`block block-${AREA[m.id]}`} style={{ gridArea: AREA[m.id] }} href={href(m.path)}>
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

      <section className="home-notes" aria-label="How to use">
        <div>
          <h2>Stepping</h2>
          <p>
            <kbd>←</kbd> and <kbd>→</kbd> move one step, <kbd>Home</kbd> and <kbd>End</kbd> jump to the ends,{' '}
            <kbd>Space</kbd> plays. The link in your address bar holds your code, options and
            toggles, so you can bookmark or share the trace. Most tracers reopen it at step 1; the datapath tracer also keeps the step.
          </p>
        </div>
        <div>
          <h2>Colours</h2>
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
          <h2>Where the rules come from</h2>
          <p>
            Every simulator follows the simplified model taught in CS2100 (AY26/27), and is tested against the worked
            examples in the slides and the answer keys. Where two course sources disagree, the tool lets you pick and
            says which source uses which.
          </p>
        </div>
      </section>
    </div>
  )
}
