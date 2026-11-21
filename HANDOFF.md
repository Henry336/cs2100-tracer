# Handoff

## Current state (22 Nov 2026, 05:59)
- Calm redesign live: design brief docs/design.md, shared layer src/styles/shell.css, home input routing src/pages/route-input.ts. 1035 tests pass.
- Shared requests still open: promote the copied board/Play/story styles (dp-, pl-, ca-, cm-, mp-, bo-, seq- copies) into shell.css plus a BoardPlay component; Tabs with ReactNode labels; print all tab panels.
- Datapath Control unit, Control quiz and Critical path tabs were not moved onto boards.
- All 9 modules built and live: https://henry336.github.io/cs2100-tracer/ (GitHub Pages, deployed by `.github/workflows/deploy.yml` on push to `main`).
- 60 test files, 1035 tests pass; `npm run typecheck` and `npm run build` clean.
- Browser-checked at desktop and 375 px, light and dark: no console errors, no page-level horizontal scroll.
- Judgement calls and every course ambiguity: `DECISIONS.md`. Build contract: `docs/architecture.md`. Course rules and fixtures: `docs/spec/`.

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
