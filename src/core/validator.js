/**
 * validator.js — checks a machine before it is converted.
 *
 * The conversion algorithms assume a DETERMINISTIC and COMPLETE machine:
 * every state has exactly one transition on every input symbol.
 * Errors block conversion; warnings (e.g. unreachable states) do not.
 */
import { MEALY, MOORE, edgeKey, reachableStates } from './model.js';

/** Adds an error if `list` is empty, has empty names or has duplicates. */
function checkNameList(label, list, errors) {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${label} must be a non-empty list.`);
    return;
  }
  if (list.some((x) => x === '')) errors.push(`${label} contains an empty name.`);
  const duplicates = [...new Set(list.filter((x, i) => list.indexOf(x) !== i))];
  if (duplicates.length) errors.push(`${label} has duplicates: ${duplicates.join(', ')}.`);
}

/**
 * Validates a machine.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateMachine(machine) {
  const errors = [];
  const warnings = [];

  if (!machine || typeof machine !== 'object') {
    return { valid: false, errors: ['Input is not a machine object.'], warnings };
  }
  if (machine.type !== MEALY && machine.type !== MOORE) {
    errors.push(`"type" must be "mealy" or "moore" (got "${machine.type}").`);
  }
  checkNameList('States (Q)', machine.states, errors);
  checkNameList('Input alphabet (Σ)', machine.inputAlphabet, errors);
  checkNameList('Output alphabet (Δ)', machine.outputAlphabet, errors);
  if (!Array.isArray(machine.transitions)) errors.push('"transitions" must be a list.');
  if (errors.length) return { valid: false, errors, warnings }; // structure is broken: stop here

  const Q = new Set(machine.states);
  const sigma = new Set(machine.inputAlphabet);
  const delta = new Set(machine.outputAlphabet);

  if (!Q.has(machine.start)) errors.push(`Start state "${machine.start}" is not in the state list.`);

  // Each transition must use known states/symbols, and (q, a) pairs must be unique.
  const defined = new Set();
  machine.transitions.forEach((t, i) => {
    const where = `Transition ${i + 1} (${t.from} --${t.input}--> ${t.to})`;
    if (!Q.has(t.from)) errors.push(`${where}: unknown source state "${t.from}".`);
    if (!Q.has(t.to)) errors.push(`${where}: unknown target state "${t.to}".`);
    if (!sigma.has(t.input)) errors.push(`${where}: input symbol "${t.input}" is not in Σ.`);
    if (machine.type === MEALY) {
      if (t.output === undefined || t.output === '') errors.push(`${where}: a Mealy transition needs an output.`);
      else if (!delta.has(t.output)) errors.push(`${where}: output "${t.output}" is not in Δ.`);
    }
    const key = edgeKey(t.from, t.input);
    if (defined.has(key)) {
      errors.push(`Nondeterminism: state "${t.from}" has more than one transition on "${t.input}".`);
    }
    defined.add(key);
  });

  // Completeness: δ(q, a) must exist for every state q and symbol a.
  for (const q of machine.states) {
    for (const a of machine.inputAlphabet) {
      if (!defined.has(edgeKey(q, a))) errors.push(`Missing transition: δ(${q}, ${a}) is not defined.`);
    }
  }

  // Moore machines need an output λ(q) for every state.
  if (machine.type === MOORE) {
    for (const q of machine.states) {
      const o = machine.stateOutputs?.[q];
      if (o === undefined || o === '') errors.push(`State "${q}" has no output λ(${q}).`);
      else if (!delta.has(o)) errors.push(`λ(${q}) = "${o}" is not in Δ.`);
    }
  }

  if (errors.length === 0) {
    const reachable = reachableStates(machine);
    const unreachable = machine.states.filter((q) => !reachable.has(q));
    if (unreachable.length) {
      warnings.push(`Unreachable from ${machine.start}: ${unreachable.join(', ')}. They are converted but never used.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
