# Handoff

## Current state (22 Nov 2026, 08:00)
- Live: https://henry336.github.io/cs2100-tracer/ (GitHub Pages, `.github/workflows/deploy.yml` on push to `main`). 62 test files, 1060 tests pass; `npm run typecheck` and `npm run build` clean.
- 10 modules: C memory, MIPS, datapath (all four tabs on boards), pipeline, cache (with Check my answers mode, URL keys cm/ck), Boolean, MSI, sequential, reference, past papers (/papers: 89 questions from 14 papers, errata, exam mode).
- Calm design: brief docs/design.md; shared layout kit src/ui/board.tsx (Board, PlayBar, Story, Stage, Options, Details, CommandBar, Flow, PrimaryPill) with styles in src/styles/shell.css. Modules use the kit, no local copies.
- Home input routing: src/pages/route-input.ts.
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
- Not checked in a real print dialog: Export PDF output (print CSS only read and unit-tested).

## Rules for changes
- Agents edit only `src/core/<id>` and `src/modules/<id>`; shared kit, styles, router, registry are integrator-owned.
- No em dashes, colours only via tokens, no new npm dependencies, no slide text (numbers and short sequences with a source only).
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
