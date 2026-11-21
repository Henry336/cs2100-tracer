# Architecture and build contract

This file is the contract every module follows. Read it before touching code.

## Layout

```
src/
  core/<module>/        pure TypeScript simulation engine + Vitest tests (no React, no DOM)
  modules/<module>/     React UI for the module; <Module>Page.tsx is the default export used by the router
  modules/registry.ts   list of modules (integrator owns this file)
  ui/                   shared kit: Workspace, Panel, Transport, stepper, Why, Callout, Legend, DataTable, Tabs, fields (integrator owns)
  lib/                  router (hash) and url-state (shareable state in the URL)
  styles/               tokens.css (signal colours), base.css, ui.css, home.css (integrator owns)
docs/spec/              course rules and fixtures (source of truth, cite pages)
```

Module ids: `c-memory`, `mips`, `datapath`, `pipeline`, `cache`, `boolean`, `msi`, `sequential`, `reference`.

### File ownership
- A module agent edits only `src/core/<id>/**` and `src/modules/<id>/**`.
- Shared code (`src/ui`, `src/styles`, `src/lib`, `registry.ts`, `App.tsx`) is integrator-owned. If you need something shared, build it locally in your module first and list the request in your final report.
- `datapath` and `pipeline` may import from `src/core/mips` (assembler/encoder). Do not edit it from those modules.
- Module CSS goes in `src/modules/<id>/<id>.css`, imported by the page. Prefix classes with the module id (`.pl-grid`, `.dp-wire`) to avoid collisions.

## Engines (`src/core/<id>`)
- Pure functions over plain JSON-serialisable inputs, so state can live in the URL.
- A tracer returns a **trace**: an array of frames (one per step for the Transport bar) plus a summary. Each frame holds everything the UI draws for that step; the UI never re-simulates.
- Every number a student might question carries an explanation: `{ rule: string, working?: string, cite?: string }` (rendered with `<Why>`). `cite` uses course references like `L21 p22` or `R12 p44`.
- Parsers return structured errors with line numbers and plain messages ("line 3: unknown register $t10"), never throw on user input.
- Course ambiguities from `docs/spec` become explicit options with a default and a note naming which source uses which.

## Tests
- `src/core/<id>/*.test.ts` with Vitest. Every fixture from `docs/spec` for your module becomes a test case, named with its spec id (e.g. `P10`, `C4`, `FX1`).
- Mark each fixture `official` (from slides or an answer key) or `derived` (worked out, no key). Official fixtures must pass exactly.
- `npm test` and `npm run typecheck` must pass before you finish.

## UI rules
- Page structure: `<Workspace title lectures intro toolbar inspector transport>` from `src/ui/kit.tsx`.
- Stepping: `useStepper(trace.frames.length)` + `<Transport stepper label marks describe>`. Keyboard is handled by Transport.
- Shareable state: `useUrlState('key', default)` from `src/lib/url-state.ts` for user inputs (program text, config, toggles).
- Explanations: wrap computed values in `<Why rule working cite>`. Use `<Callout kind="trap">` for common mistakes, `kind="course"` for course-specific conventions, `kind="beyond"` for anything not taught (always labelled as beyond the course).
- Tables: `<DataTable>`; highlight the active row with `rowSignal`.
- Presets: `<Presets>` with every course example from the spec, each with its source (e.g. "AY24/25 Q19").
- Colours: only via tokens in `src/styles/tokens.css`. Signal meanings are fixed:
  - `--sig-path` what is happening now (active path, current step)
  - `--sig-data` data values
  - `--sig-control` control signals and control logic
  - `--sig-forward` forwarding / bypass
  - `--sig-stall` stalls, bubbles, idle units
  - `--sig-flush` flushed or squashed work
  - `--sig-hit` hit / true / valid / 1
  - `--sig-miss` miss / error
  - `--sig-dirty` dirty bit, pending write, write traffic
  - `--sig-dontcare` X / don't care
  Each has a matching `--tint-*` background. Show a `<Legend>` for the colours a view uses.
- Diagrams are hand-built SVG components scaled with `viewBox`; text in SVG uses the CSS font tokens. They must stay readable at 375 px wide (allow horizontal scroll inside a panel rather than shrinking text below 10 px).
- Responsive down to 375 px; visible keyboard focus; respect reduced motion; colour is never the only carrier of meaning (add a label, pattern or icon).

## Copy
- Plain, sentence case, active voice. No ALL CAPS labels, no emoji, no marketing words, no exclamation marks.
- **No em dashes anywhere** (code comments, copy, docs). Use a comma, full stop, colon or brackets.
- Name things the way the course does (RegDst, MemToReg, ALUop, isZero, IF/ID, PI, EPI, cold/conflict/capacity miss).
- Never paste slide or past-paper text. Short paraphrases with a page reference are fine; fixtures are numbers and short instruction sequences.

## TypeScript
- Strict mode, `erasableSyntaxOnly`: no `enum`, no `namespace`, no constructor parameter properties. Use union string types and plain objects.
- No new npm dependencies.
