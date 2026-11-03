# Mealy ⇄ Moore Conversion Simulator

Interactive simulator that converts a user-defined **Mealy machine to an equivalent Moore machine** and a **Moore machine to an equivalent Mealy machine**, explains every step, and proves equivalence by running strings through both machines.

CSET302 · Automata Theory and Computability · Simulator Design · Problem statement 14

## Features

- A direction toggle: Mealy → Moore (with state splitting) or Moore → Mealy, each with a default example machine
- An ✎ Edit button: change any cell with drop-downs, add or remove states, reset; the conversion updates instantly
- The given and converted machines shown as transition tables; the converted table fills in step by step
- Side-by-side state diagrams with a step player (previous, next, play, show result, ← → keys)
- String test: one table showing both machines' moves and outputs for any input string
- "Show this run on the graphs": replays the test string on both diagrams, one symbol per step
- An exact equivalence check for every input string (both machines run side by side over all reachable state pairs)
- In the core and tests but not in the UI: input validation, merging equivalent states, more edge-case machines

## Tech stack

| Layer | Tool |
| --- | --- |
| Language | JavaScript (ES modules) |
| Dev server and build | [Vite](https://vite.dev) |
| Graph drawing | [Cytoscape.js](https://js.cytoscape.org) + cytoscape-dagre |
| Tests | [Vitest](https://vitest.dev) |
| Hosting | GitHub Pages (via GitHub Actions) |

## Run it

You need Node.js 20.19+ or 22.12+.

```bash
npm install        # once, after cloning
npm run dev        # start the dev server → open http://localhost:5173
npm test           # run all tests once
npm run test:watch # re-run tests on every save
npm run build      # production build into dist/
npm run preview    # serve the production build → http://localhost:4173
```

## Project structure

```
src/
  core/        pure algorithm code, no browser code
    model.js         machine format, JSON load/save, reachability
    validator.js     completeness, determinism and alphabet checks
    converter.js     mooreToMealy, mealyToMoore (+ step log)
    simulator.js     runMealy, runMoore, tokenize
    equivalence.js   proveEquivalence (exact) + checkEquivalence (brute force, for tests)
    minimizer.js     mergeEquivalent (partition refinement)
  ui/graph.js  Cytoscape drawing, highlighting, partial results
  ui/tables.js read-only transition tables
  samples/     sample machines (JSON)
  main.js      wires the page to the core
tests/         Vitest tests (T-numbers match the project test table)
docs/          M1 design documents, report, screenshots
```

## Machine JSON format

```json
{
  "type": "mealy",
  "states": ["q0", "q1"],
  "inputAlphabet": ["a", "b"],
  "outputAlphabet": ["0", "1"],
  "start": "q0",
  "transitions": [{ "from": "q0", "input": "a", "to": "q1", "output": "0" }]
}
```

A Moore machine uses `"type": "moore"`, leaves out `output` on transitions, and adds `"stateOutputs": { "q0": "0", "q1": "1" }`.

## Team

| Member | Role | Modules |
| --- | --- | --- |
| _name_ | Algorithms lead | converter.js, minimizer.js |
| _name_ | Core and validation | model.js, validator.js, samples |
| _name_ | Visualization | ui/graph.js |
| _name_ | Interface and step player | main.js, index.html, style.css |
| _name_ | Testing and documentation | simulator.js, equivalence.js, tests/, report |
