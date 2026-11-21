# CS2100 Tracer

Interactive, step-through tracers for NUS **CS2100 Computer Organisation**: C memory, MIPS, the single-cycle datapath and control, pipelining, caches, and digital logic.

Live site: https://henry336.github.io/cs2100-tracer/

Unofficial study aid. Not affiliated with NUS. Do not use it on graded work (assignments, marked labs).

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (it ends in `/cs2100-tracer/`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Simulator tests (course worked examples as fixtures) |
| `npm run typecheck` | TypeScript, strict |
| `npm run build` | Production build into `dist/` |

Pushing to `main` runs the tests and deploys to GitHub Pages.
