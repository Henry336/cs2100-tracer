# Handoff

## Current state (22 Nov 2026, 16:29)
- Live: https://henry336.github.io/cs2100-tracer/ (GitHub Pages, `.github/workflows/deploy.yml` on push to `main`). 66 test files, 1080 tests pass; `npm run typecheck` and `npm run build` clean.
- 10 modules: C memory, MIPS, datapath (all four tabs on boards), pipeline, cache (with Check my answers mode, URL keys cm/ck), Boolean, MSI, sequential, reference, past papers (/papers: 89 questions from 14 papers, errata, exam mode).
- Calm design: brief docs/design.md; shared layout kit src/ui/board.tsx (Board, PlayBar, Story, Stage, Options, Details, CommandBar, Flow, PrimaryPill) with styles in src/styles/shell.css. Modules use the kit, no local copies.
- Home input routing: src/pages/route-input.ts (Tab completes the typed word from the picked row, 22 Nov 14:12).
- Stale tabs after a deploy (22 Nov 14:19): lazy page files are renamed on each build and Pages caches index.html 10 min, so an old tab asked for deleted files and went black. src/lib/reload.ts reloads once; PageBoundary in App.tsx shows a Reload message if a page still fails.
- Export PDF downloads a file directly (22 Nov 16:20, Henry asked): src/lib/export-pdf.ts fires beforeprint, turns on every @media print rule, inlines SVG paint, snapshots .app with html-to-image, slices A4 landscape pages at blank gaps, saves with jsPDF (both lazy-loaded). Falls back to window.print() on error or a page over ~15k px. PDF is images, so text is not selectable.
- Playback speed (22 Nov 16:30, Henry asked): one shared setting, 0.5x to 2x, - / + on the bottom player, kept in localStorage cs2100-speed (src/ui/stepper.tsx SPEEDS, stepSpeed). Datapath default slowed from 1.4 s to 2.2 s per stage.
- Datapath playback dots (22 Nov 16:29, Henry asked): while playing, dots run the orange wires of each step; a unit's ring draws for its delay (T05 Q2 ps x 2.5 ms) before its output dots leave, and the step waits for the last dot (model.ts runOf, stepper durationOf). Paused: the old decorative light. Paths box under the diagram (PathsPanel.tsx, core allPaths): every path longest first, ties all critical, new token --sig-crit (fuchsia); hover a row or open Whole cycle to see it on the diagram.
- Judgement calls and every course ambiguity: DECISIONS.md. Build contract: docs/architecture.md. Course rules and fixtures: docs/spec/.
- Laptop has 7.2 GB RAM: run one code agent at a time (two froze the desktop app on 22 Nov).

## Open (small)
- Preset menus still show "Choose" after a link lands in mips, boolean, msi, sequential and the calculators (Presets takes isCurrent; wired in pipeline, cache, c-memory trace, datapath trace).
- Calculator presets (cache CalcTab, c-memory CalcTab) are not exported, so the launcher only opens the tool for those 12 rows.
- Print shows only the open tab of a Details strip.
- Cache check: dirty bit not marked; "miss cold" written as words drops the type (M(cold) works).

## Not built yet (from the final review; see DECISIONS.md "Final review")
- MIPS: C to MIPS pattern translator, bit lab, run-to-line / breakpoints / C mirror, li expansion, EA and alignment visualizer.
- C memory: node-by-node expression evaluation, step into/over/out polish.
- Cache: table-diff check mode, four sub-steps per access, pipeline x cache MEM stretch.
- Cross-cutting: past-paper launcher with errata; fill-in-the-blank format linters beyond Boolean.

## Rules for changes
- Agents edit only `src/core/<id>` and `src/modules/<id>`; shared kit, styles, router, registry are integrator-owned.
- No em dashes, colours only via tokens, no new npm dependencies (exceptions: html-to-image, jspdf for Export PDF), no slide text (numbers and short sequences with a source only).
- Laptop has 7.2 GB RAM: at most 2 agents at once, vitest capped at 2 workers, no dev server while agents run.

## Commands
```bash
npm install
npm run dev        # http://localhost:5173/cs2100-tracer/ (or --port 5199 --strictPort)
npm test
npm run typecheck
npm run build
git push origin main   # deploys; check: gh run list --limit 1
```
