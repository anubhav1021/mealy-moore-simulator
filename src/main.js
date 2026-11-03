/**
 * main.js — connects the page (index.html) to the core algorithms.
 *
 * Flow: pick direction → example machine (editable) → converter (step log)
 *       → tables + graphs + step player → test with an input string
 *       → optionally replay that test on the graphs.
 *
 * The step player shows one of two lists of steps:
 *   "conversion" — the converter's step log (how the new machine is built)
 *   "run"        — one step per input symbol (both machines reading the test string)
 */
import './style.css';
import { MEALY, MOORE, cloneMachine, edgeKey } from './core/model.js';
import { convert } from './core/converter.js';
import { runMealy, runMoore, tokenize, formatOutput } from './core/simulator.js';
import { proveEquivalence } from './core/equivalence.js';
import { MachineGraph } from './ui/graph.js';
import { transitionTable, editableTable, addState, removeLastState } from './ui/tables.js';
import lastTwoEqual from './samples/last-two-equal.mealy.json';
import mod3 from './samples/mod3.moore.json';

/** The default machine for each direction. */
const EXAMPLES = {
  [MEALY]: {
    machine: lastTwoEqual,
    description: 'Prints 1 when the symbol read equals the previous symbol, otherwise 0.',
    testString: 'abba',
  },
  [MOORE]: {
    machine: mod3,
    description: 'Reads a binary number left to right. Each state outputs the number read so far mod 3.',
    testString: '110',
  },
};

const $ = (id) => document.getElementById(id);
const typeName = (t) => (t === MEALY ? 'Mealy' : 'Moore');

/** Small DOM helper: el('p', { className: 'x' }, 'text', childNode…). Text is never parsed as HTML. */
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c instanceof Node ? c : String(c));
  return node;
}

const app = {
  type: MEALY, // type of the given machine
  machine: null, // the given machine (a copy, so it can be edited)
  edited: false,
  editing: false,
  result: null, // converted machine
  conversionSteps: [],
  steps: [], // the list the player is showing
  mode: 'conversion', // or 'run'
  stepIndex: 0,
  timer: null,
};
const sourceGraph = new MachineGraph($('source-graph'));
const resultGraph = new MachineGraph($('result-graph'));

// ---------------------------------------------------------------- direction + editing
function setDirection(type) {
  for (const b of document.querySelectorAll('.direction button')) b.classList.toggle('active', b.dataset.type === type);
  app.type = type;
  app.machine = cloneMachine(EXAMPLES[type].machine);
  app.edited = false;
  $('test-string').value = EXAMPLES[type].testString;
  setEditing(false);
  reconvert();
}

/** Converts the given machine again and redraws everything (after loading or editing). */
function reconvert() {
  stopPlay();
  const { result, steps } = convert(app.machine);
  app.result = result;
  app.conversionSteps = steps;

  const from = typeName(app.type);
  const to = typeName(result.type);
  $('input-heading').textContent = `1 · Given ${from} machine (${app.machine.states.length} states)`;
  $('input-description').textContent = app.edited ? 'Edited by hand. The conversion updates as you change the table.' : EXAMPLES[app.type].description;
  $('source-title').textContent = `Given · ${from}`;
  $('result-title').textContent = `Converted · ${to}`;
  sourceGraph.render(app.machine);
  resultGraph.render(result);

  showConversion();
  runTest();
}

function setEditing(on) {
  app.editing = on;
  $('edit-btn').textContent = on ? '✓ Done' : '✎ Edit';
  $('edit-btn').classList.toggle('accent', on);
  $('edit-tools').hidden = !on;
  drawInputTable();
}

function drawInputTable(highlight = []) {
  $('input-table').replaceChildren(
    app.editing
      ? editableTable(app.machine, () => {
          app.edited = true;
          reconvert();
        })
      : transitionTable(app.machine, { highlight }),
  );
}

function changeStructure(change) {
  change(app.machine);
  app.edited = true;
  drawInputTable();
  reconvert();
}

// ---------------------------------------------------------------- step player
function showConversion() {
  app.mode = 'conversion';
  app.steps = app.conversionSteps;
  $('mode-label').textContent = 'Showing: how the converted machine is built';
  $('back-to-conversion').hidden = true;
  goToStep(app.steps.length - 1); // start on the finished result; Play rebuilds it step by step
}

function renderStep() {
  const total = app.steps.length;
  const step = app.steps[app.stepIndex];
  $('step-counter').textContent = `Step ${app.stepIndex + 1} of ${total}`;
  $('step-title').textContent = step.title;
  $('step-explanation').textContent = step.explanation;
  $('prev-step').disabled = app.stepIndex === 0;
  $('next-step').disabled = $('last-step').disabled = app.stepIndex === total - 1;

  // In conversion mode the converted table and graph show only what is built so far.
  const partial = step.partial ?? app.result;
  const building = app.mode === 'conversion' && app.stepIndex < total - 1;
  $('result-heading').textContent = `Converted ${typeName(app.result.type)} machine ` +
    (building ? '(being built…)' : `(${app.result.states.length} states)`);
  $('result-table').replaceChildren(transitionTable(app.result, { partial, highlight: step.highlight.result.states }));
  if (!app.editing) drawInputTable(step.highlight.source.states);
  resultGraph.showPartial(step.partial);
  sourceGraph.highlight(step.highlight.source);
  resultGraph.highlight(step.highlight.result);
}

function goToStep(i) {
  app.stepIndex = Math.max(0, Math.min(i, app.steps.length - 1));
  renderStep();
}

function stopPlay() {
  clearInterval(app.timer);
  app.timer = null;
  $('play-step').textContent = '▶ Play';
}

function startPlay(fromStart) {
  stopPlay();
  if (fromStart || app.stepIndex === app.steps.length - 1) goToStep(0);
  $('play-step').textContent = '⏸ Pause';
  app.timer = setInterval(() => {
    if (app.stepIndex >= app.steps.length - 1) return stopPlay();
    goToStep(app.stepIndex + 1);
  }, 1600);
}

const togglePlay = () => (app.timer ? stopPlay() : startPlay(false));

// ---------------------------------------------------------------- test
/** Reads the test string; returns the symbols, or null after showing an error. */
function readTestString() {
  try {
    return tokenize($('test-string').value, app.machine.inputAlphabet);
  } catch {
    $('trace-output').replaceChildren(el('p', { className: 'msg error' }, `Use only the symbols ${app.machine.inputAlphabet.join(', ')}.`));
    return null;
  }
}

/** Runs the string through both machines. Returns which is which plus both traces. */
function runBoth(symbols) {
  const sourceIsMealy = app.machine.type === MEALY;
  const [mealyM, mooreM] = sourceIsMealy ? [app.machine, app.result] : [app.result, app.machine];
  return { sourceIsMealy, mealyM, mooreM, mealy: runMealy(mealyM, symbols), moore: runMoore(mooreM, symbols) };
}

/** Shows both machines side by side in one table: one row per symbol read. */
function runTest() {
  const symbols = readTestString();
  if (!symbols) return;
  const { mealyM, mooreM, mealy, moore } = runBoth(symbols);

  const row = (...cells) => el('tr', {}, ...cells.map((c) => el('td', {}, c)));
  const rows = [
    row('start', '–', mealyM.start, '–', mooreM.start, `${moore.outputs[0]}  (λ of start)`),
    ...symbols.map((a, i) =>
      row(
        i + 1,
        a,
        `${mealy.trace[i].from} → ${mealy.trace[i].to}`,
        mealy.trace[i].output,
        `${moore.trace[i].from} → ${moore.trace[i].to}`,
        moore.trace[i].output,
      ),
    ),
  ];
  const head = el('tr', {}, ...['Step', 'Read', 'Mealy move', 'Mealy prints', 'Moore move', 'Moore prints'].map((h) => el('th', {}, h)));

  const mealyOut = formatOutput(mealy.outputs);
  const dropped = formatOutput(moore.outputs.slice(1));
  const same = dropped === mealyOut;
  const proof = proveEquivalence(app.machine, app.result);

  $('trace-output').replaceChildren(
    el('div', { className: 'trace' }, el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows))),
    el(
      'div',
      { className: 'summary' },
      el('p', {}, el('strong', {}, 'Mealy output: '), mealyOut),
      el('p', {}, el('strong', {}, 'Moore output: '), `${formatOutput(moore.outputs)}  → remove the first symbol → ${dropped}`),
    ),
    el('p', { className: `msg ${same ? 'ok' : 'error'}` }, same ? '✓ Same output. The two machines are equivalent on this string.' : '✗ Outputs differ.'),
    el(
      'p',
      { className: `msg ${proof.equivalent ? 'ok' : 'error'}` },
      proof.equivalent ? '✓ Also checked automatically: they give the same output for every possible input string.' : '✗ Not equivalent for every string.',
    ),
  );
}

/**
 * Turns the test run into player steps: both graphs highlight the current
 * state and the arrow just taken, one input symbol at a time.
 */
function showRunOnGraphs() {
  const symbols = readTestString();
  if (!symbols) return;
  runTest();
  const { sourceIsMealy, mealyM, mooreM, mealy, moore } = runBoth(symbols);
  const word = symbols.join('') || 'ε';

  // Put each machine's highlight on the graph that shows it.
  const place = (mealyHl, mooreHl) =>
    sourceIsMealy ? { source: mealyHl, result: mooreHl } : { source: mooreHl, result: mealyHl };
  const so = (outs) => formatOutput(outs);

  const steps = [
    {
      title: `Start: about to read "${word}"`,
      explanation:
        `Mealy starts in ${mealyM.start} and has printed nothing. ` +
        `Moore starts in ${mooreM.start} and immediately prints its output λ(${mooreM.start}) = ${moore.outputs[0]}.`,
      highlight: place({ states: [mealyM.start], edges: [] }, { states: [mooreM.start], edges: [] }),
      partial: null,
    },
    ...symbols.map((a, i) => {
      const m = mealy.trace[i];
      const o = moore.trace[i];
      return {
        title: `Read "${a}" (symbol ${i + 1} of ${symbols.length})`,
        explanation:
          `Mealy: ${m.from} → ${m.to}, the arrow prints ${m.output}. ` +
          `Moore: ${o.from} → ${o.to}, the state prints λ(${o.to}) = ${o.output}. ` +
          `So far: Mealy ${so(mealy.outputs.slice(0, i + 1))}, Moore ${so(moore.outputs.slice(0, i + 2))}.`,
        highlight: place(
          { states: [m.to], edges: [edgeKey(m.from, a)] },
          { states: [o.to], edges: [edgeKey(o.from, a)] },
        ),
        partial: null,
      };
    }),
  ];
  const mealyOut = so(mealy.outputs);
  const dropped = so(moore.outputs.slice(1));
  steps.push({
    title: 'Result',
    explanation:
      `Mealy printed ${mealyOut}. Moore printed ${so(moore.outputs)}; without its first symbol that is ${dropped}. ` +
      (dropped === mealyOut ? '✓ Same output.' : '✗ Outputs differ.'),
    highlight: place({ states: [mealy.finalState], edges: [] }, { states: [moore.finalState], edges: [] }),
    partial: null,
  });

  app.mode = 'run';
  app.steps = steps;
  $('mode-label').textContent = `Showing: both machines reading "${word}"`;
  $('back-to-conversion').hidden = false;
  document.querySelector('.graphs-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  startPlay(true);
}

// ---------------------------------------------------------------- wiring
for (const b of document.querySelectorAll('.direction button')) b.addEventListener('click', () => setDirection(b.dataset.type));
$('edit-btn').addEventListener('click', () => {
  setEditing(!app.editing);
  if (!app.editing) renderStep();
});
$('add-state').addEventListener('click', () => changeStructure(addState));
$('remove-state').addEventListener('click', () => changeStructure(removeLastState));
$('reset-machine').addEventListener('click', () => {
  app.machine = cloneMachine(EXAMPLES[app.type].machine);
  app.edited = false;
  drawInputTable();
  reconvert();
});
$('prev-step').addEventListener('click', () => goToStep(app.stepIndex - 1));
$('next-step').addEventListener('click', () => goToStep(app.stepIndex + 1));
$('last-step').addEventListener('click', () => goToStep(app.steps.length - 1));
$('play-step').addEventListener('click', togglePlay);
$('back-to-conversion').addEventListener('click', () => {
  stopPlay();
  showConversion();
});
$('run-btn').addEventListener('click', runTest);
$('show-run-btn').addEventListener('click', showRunOnGraphs);
$('test-string').addEventListener('keydown', (e) => e.key === 'Enter' && runTest());

// Left/right arrow keys move through the steps (unless the user is typing or choosing).
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight') goToStep(app.stepIndex + 1);
  if (e.key === 'ArrowLeft') goToStep(app.stepIndex - 1);
});
window.addEventListener('resize', () => {
  sourceGraph.fit();
  resultGraph.fit();
});

setDirection(MEALY);
