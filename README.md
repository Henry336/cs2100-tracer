# CS2100 Tracer

Interactive, step-through tracers for NUS **CS2100 Computer Organisation**: C memory, MIPS, the single-cycle datapath and control, pipelining, caches, and digital logic.

Live site: https://henry336.github.io/cs2100-tracer/

Unofficial study aid. Not affiliated with NUS. Do not use it on graded work (assignments, marked labs).

## Modules

| Module | Lectures | What you can do |
|---|---|---|
| C memory and pointers | L02 to L05 | Step through small C programs with boxes-and-arrows memory, predict output, address and struct/union calculators |
| MIPS | L06 to L10 | Assemble and run, encode and decode with field derivations, branch conditions, expanding opcodes, 32-bit constants |
| Datapath and control | L11 to L12 | Trace one instruction through the L12 datapath stage by stage, control and ALU-control tables, control quiz, critical path |
| Pipeline | L20 to L21 | Cycle grid with stalls, flushes and forwarding; every hazard option as a toggle; ideal vs actual compare; exam (a) to (e) runner; pipelined datapath |
| Cache | L22 to L23 | Access-by-access simulator with miss types, write policies, organisation compare, field widths and miss-penalty timing |
| Boolean algebra and K-maps | L13 to L16 | Forms, K-maps with PIs/EPIs and all minimal covers, algebra step checker, gate circuits with delays, universal gates |
| Combinational and MSI | L17 to L18 | Decoders, encoders, multiplexers, comparators, adders and a block workbench |
| Sequential circuits | L19 | Latches and flip-flops with timing, analysis, design wizard, self-correction check |
| Reference tables | all | The course tables on one page, with an optional cheat-sheet mode without sources |

Every view has step, play and a draggable timeline, keeps its inputs in the link, prints with Export PDF, and explains each number with the rule, the working and the slide. Where slides and answer keys disagree, the app offers both as an option; see [DECISIONS.md](DECISIONS.md).

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
