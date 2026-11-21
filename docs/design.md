# Design brief: calm tracer (22 Nov 2026)

The student opened the old site, saw a wall of text, could not find the Play button and gave up. Every page must now pass one test: **in the first two seconds, a student sees one picture and one obvious thing to press.**

The look was studied from a learning app the student liked (dark graphite, one serif question, one glowing input, explanations that arrive one sentence at a time, line drawings that draw themselves, light travelling along branches). We borrow ideas, never code or assets.

## The shared system (already built, integrator-owned)
- Tokens in `src/styles/tokens.css`: graphite dark / cool paper light. `--primary` (inverted ink) is the only button colour for the main action; it is never a signal colour. Signal colours keep their fixed meanings.
- Fonts: `--font-display` (Instrument Serif) for page titles and the one headline per view, `--font-sans` (IBM Plex Sans) for UI, `--font-mono` for values and code only.
- `src/styles/shell.css`:
  - `.canvas`: the dot-grid board a diagram sits on.
  - `.glow-input`: the turning signal-colour ring on a focused input.
  - `.flow-draw` and `.flow-packets`: give an `<svg><g>` of `<path pathLength={1}>` children and the paths draw in from their source, then bright packets travel along them. Key the `<g>` by step so the animation restarts each step. Use only on wires or arcs that carry a value in the current step.
  - `details.callout`: `<Callout kind="trap|course|beyond">` now folds to one line; `note` stays open.
  - The page intro is hidden behind "About this view"; only tabs show.
- `<Transport>`: a floating player with a labelled Play pill, progress, a first-visit hint. Keep using it.
- Datapath trace tab (`src/modules/datapath/TraceTab.tsx`) is the reference layout: command bar, board with Play inside it, a step story beside it, tables in one tab strip below.

## Rules for each module page
1. **Picture first.** The main diagram, grid, map or table that changes while stepping is the first thing under the tabs, inside a `.canvas` board, full width.
2. **One primary action, inside the board.** If the view steps, put a Play pill (same look as `.dp-play`) and a quiet Next button inside the board, in addition to the bottom player. Label it with what happens ("Run this trace", "Step through the cycles").
3. **Inputs are compact.** One line where possible (a command bar like `.dp-command-bar`). Secondary inputs and options go in a `<details>` "options" disclosure, closed by default.
4. **Secondary material goes in one tab strip.** Tables, reference rows, worked lists: one `<Tabs>` strip under the board, one table visible at a time. Do not stack five panels.
5. **Text budget.** Visible prose on first load: at most two short sentences outside the board. Move the rest into folded callouts, Why popovers, or the step story. Delete hints that repeat the legend or the tab name. Keep every cited rule; just fold it.
6. **Narrate the current step only.** If a view has per-step explanations, show the current one bright and the others as one-line titles (see `.dp-steps`).
7. **Motion explains.** Use `.flow-draw` / `.flow-packets` on what is active this step (wires, arcs, arrows, K-map loops, cache line fills). No decorative motion elsewhere. Everything respects reduced motion (shell.css handles the shared classes).
8. Keep: URL state for every input, Export PDF printability (folded details open when printing), focus-mode toggles, keyboard access, the copy rules in architecture.md (no em dashes, sentence case, no emoji).
