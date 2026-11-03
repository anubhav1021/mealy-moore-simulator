/**
 * converter.js — the two conversion algorithms.
 *
 * Both functions return { result, steps }:
 *   result — the converted machine
 *   steps  — a step log used by the step player. Each entry is
 *            { step, title, explanation, highlight: { source, result }, partial }
 *            where `highlight.source` / `highlight.result` list the states and
 *            edge keys ("q|a") to highlight in each graph, and `partial` is a
 *            snapshot of the result machine as built so far.
 */
import { MEALY, MOORE, cloneMachine, edgeKey, transitionTable } from './model.js';
import { validateMachine } from './validator.js';

/** Throws a readable error if the machine is invalid or of the wrong type. */
function assertValid(machine, expectedType) {
  const { valid, errors } = validateMachine(machine);
  if (!valid) throw new Error(`Invalid machine:\n${errors.join('\n')}`);
  if (machine.type !== expectedType) {
    throw new Error(`Expected a ${expectedType} machine but got a ${machine.type} machine.`);
  }
}

/** Appends one entry to the step log. */
function logStep(steps, title, explanation, highlight = {}, partial = null) {
  steps.push({
    step: steps.length + 1,
    title,
    explanation,
    highlight: {
      source: { states: [], edges: [], ...highlight.source },
      result: { states: [], edges: [], ...highlight.result },
    },
    partial: partial ? cloneMachine(partial) : null,
  });
}

const setText = (items) => `{${items.join(', ')}}`;

/**
 * Moore → Mealy.
 * States and transitions stay the same; every transition takes the output of
 * the state it ENTERS:  λ'(q, a) = λ(δ(q, a)).   Time: O(|Q|·|Σ|).
 */
export function mooreToMealy(moore) {
  assertValid(moore, MOORE);
  const steps = [];
  const delta = transitionTable(moore);
  const lambda = moore.stateOutputs;

  const mealy = {
    type: MEALY,
    states: [...moore.states],
    inputAlphabet: [...moore.inputAlphabet],
    outputAlphabet: [...moore.outputAlphabet],
    start: moore.start,
    transitions: [],
  };

  logStep(
    steps,
    'Copy the states',
    `Moore → Mealy keeps every state. The Mealy machine gets the same ${mealy.states.length} states ` +
      `${setText(mealy.states)} and the same start state ${mealy.start}.`,
    { source: { states: moore.states }, result: { states: mealy.states } },
    mealy,
  );

  for (const q of moore.states) {
    for (const a of moore.inputAlphabet) {
      const p = delta.get(edgeKey(q, a)).to;
      const o = lambda[p];
      mealy.transitions.push({ from: q, input: a, to: p, output: o });
      logStep(
        steps,
        `Label δ(${q}, ${a})`,
        `δ(${q}, ${a}) = ${p} and λ(${p}) = ${o}, so the Mealy edge ${q} → ${p} gets the label ${a}/${o}.`,
        {
          source: { states: [p], edges: [edgeKey(q, a)] },
          result: { states: [q, p], edges: [edgeKey(q, a)] },
        },
        mealy,
      );
    }
  }

  logStep(
    steps,
    'Done',
    `The Mealy machine has ${mealy.states.length} states, the same as the Moore machine. ` +
      `The Moore machine's initial output λ(${moore.start}) = ${lambda[moore.start]} has no Mealy ` +
      `counterpart, so equivalence compares outputs after the first symbol.`,
    {},
    mealy,
  );

  return { result: mealy, steps };
}

/** Returns `base`, or `base'`, `base''`… if the name is already taken. */
function uniqueName(base, taken) {
  let name = base;
  while (taken.has(name)) name += "'";
  taken.add(name);
  return name;
}

/**
 * Mealy → Moore (state splitting).
 * 1. In(q) = set of outputs on transitions that enter q.
 * 2. |In(q)| ≤ 1 → keep q;  |In(q)| = k ≥ 2 → split q into k copies q_o with λ(q_o) = o.
 * 3. Every copy of q behaves like q: if δ(q, a) = p with output o, it goes to the copy p_o.
 * 4. Start state = q0, or one of its copies (only the ignored first output changes).
 * Time: O(|Q|·|Σ|·|Δ|); at most |Q|·|Δ| states.
 *
 * @param {object} mealy
 * @param {{ defaultOutput?: string }} options  output for states that no transition enters
 */
export function mealyToMoore(mealy, options = {}) {
  assertValid(mealy, MEALY);
  const steps = [];
  const delta = transitionTable(mealy);
  const defaultOutput = options.defaultOutput ?? mealy.outputAlphabet[0];
  if (!mealy.outputAlphabet.includes(defaultOutput)) {
    throw new Error(`Default output "${defaultOutput}" is not in Δ.`);
  }

  const moore = {
    type: MOORE,
    states: [],
    inputAlphabet: [...mealy.inputAlphabet],
    outputAlphabet: [...mealy.outputAlphabet],
    start: '',
    transitions: [],
    stateOutputs: {},
  };

  // ---- Step 1: incoming outputs In(q) -------------------------------------
  const incoming = new Map(mealy.states.map((q) => [q, new Set()]));
  for (const t of mealy.transitions) incoming.get(t.to).add(t.output);
  // Keep outputs in Δ order so the result is the same on every run.
  const In = (q) => mealy.outputAlphabet.filter((o) => incoming.get(q).has(o));

  for (const q of mealy.states) {
    const entering = mealy.transitions.filter((t) => t.to === q);
    const list = entering.map((t) => `${t.from} –${t.input}/${t.output}→ ${q}`).join(', ');
    logStep(
      steps,
      `Incoming outputs of ${q}`,
      entering.length
        ? `Transitions entering ${q}: ${list}. So In(${q}) = ${setText(In(q))}.`
        : `No transition enters ${q}, so In(${q}) = ∅.`,
      { source: { states: [q], edges: entering.map((t) => edgeKey(t.from, t.input)) } },
      moore, // still empty: nothing has been built yet
    );
  }

  // ---- Step 2: create the Moore states (split where needed) ---------------
  const taken = new Set(mealy.states);
  const copyFor = new Map(); // "q|o" → Moore state that represents "q entered with output o"
  const origin = {}; // Moore state → original Mealy state

  for (const q of mealy.states) {
    const outs = In(q);
    if (outs.length <= 1) {
      const o = outs[0] ?? defaultOutput;
      moore.states.push(q);
      moore.stateOutputs[q] = o;
      origin[q] = q;
      for (const x of mealy.outputAlphabet) copyFor.set(`${q}|${x}`, q);
      const why = outs.length
        ? `In(${q}) = {${o}} has one output, so ${q} is kept as is with λ(${q}) = ${o}.`
        : `No transition enters ${q}, so there is no output to copy. ${q} is kept and simply given the first ` +
          `output symbol, λ(${q}) = ${o}. ` +
          (q === mealy.start
            ? `This is safe: λ(${q}) is only printed once, as the Moore machine's extra first symbol, which is ignored when comparing.`
            : `${q} is unreachable, so its output is never printed.`);
      logStep(steps, `Keep ${q}`, why, { source: { states: [q] }, result: { states: [q] } }, moore);
    } else {
      const copies = outs.map((o) => {
        const name = uniqueName(`${q}_${o}`, taken);
        moore.states.push(name);
        moore.stateOutputs[name] = o;
        origin[name] = q;
        copyFor.set(`${q}|${o}`, name);
        return name;
      });
      logStep(
        steps,
        `Split ${q}`,
        `In(${q}) = ${setText(outs)} has ${outs.length} outputs, but a Moore state can carry only one. ` +
          `So ${q} splits into ${copies.map((c) => `${c} (λ = ${moore.stateOutputs[c]})`).join(', ')}.`,
        { source: { states: [q] }, result: { states: copies } },
        moore,
      );
    }
  }

  // ---- Step 3: transitions — each copy behaves like its original ----------
  for (const s of moore.states) {
    const q = origin[s];
    const parts = [];
    const edges = [];
    for (const a of mealy.inputAlphabet) {
      const t = delta.get(edgeKey(q, a));
      const target = copyFor.get(`${t.to}|${t.output}`);
      moore.transitions.push({ from: s, input: a, to: target });
      parts.push(`on ${a}: δ(${q}, ${a}) = ${t.to} with output ${t.output}, so go to ${target}`);
      edges.push(edgeKey(s, a));
    }
    logStep(
      steps,
      `Transitions of ${s}`,
      `${s === q ? `${s}` : `${s} is a copy of ${q} and`} behaves like ${q}. ${parts.join('; ')}.`,
      {
        source: { states: [q], edges: mealy.inputAlphabet.map((a) => edgeKey(q, a)) },
        result: { states: [s], edges },
      },
      moore,
    );
  }

  // ---- Step 4: start state -------------------------------------------------
  const startCopies = moore.states.filter((s) => origin[s] === mealy.start);
  moore.start = startCopies[0];
  logStep(
    steps,
    'Choose the start state',
    startCopies.length === 1
      ? `${mealy.start} was not split, so ${moore.start} stays the start state.`
      : `${mealy.start} was split into ${startCopies.join(', ')}. Any copy works as the start, because the ` +
          `copies differ only in the first output symbol, which equivalence ignores. ${moore.start} is chosen.`,
    { source: { states: [mealy.start] }, result: { states: [moore.start] } },
    moore,
  );

  logStep(
    steps,
    'Done',
    `${mealy.states.length} Mealy states became ${moore.states.length} Moore states ` +
      `(upper bound |Q| × |Δ| = ${mealy.states.length} × ${mealy.outputAlphabet.length} = ` +
      `${mealy.states.length * mealy.outputAlphabet.length}).`,
    {},
    moore,
  );

  return { result: moore, steps, origin };
}

/** Converts in the natural direction for the machine's type. */
export function convert(machine, options = {}) {
  if (machine.type === MEALY) return mealyToMoore(machine, options);
  if (machine.type === MOORE) return mooreToMealy(machine);
  throw new Error(`Unknown machine type "${machine.type}".`);
}
