/**
 * minimizer.js — merges equivalent states (bonus feature).
 *
 * Partition refinement, as in DFA minimization:
 *   1. Remove states that cannot be reached from the start state.
 *   2. Start with groups of states that have the same outputs
 *      (Moore: same λ(q); Mealy: same output on every input symbol).
 *   3. Split a group whenever two of its states go to different groups on some symbol.
 *   4. Repeat until nothing changes; each final group becomes one state.
 */
import { MEALY, MOORE, edgeKey, reachableStates, transitionTable } from './model.js';

/**
 * @returns {{ result, groups: string[][], removedUnreachable: string[] }}
 */
export function mergeEquivalent(machine) {
  const table = transitionTable(machine);
  const reachable = reachableStates(machine);
  const states = machine.states.filter((q) => reachable.has(q));
  const removedUnreachable = machine.states.filter((q) => !reachable.has(q));
  const next = (q, a) => table.get(edgeKey(q, a));

  // Initial signature: what the state outputs.
  const outputSignature = (q) =>
    machine.type === MOORE
      ? machine.stateOutputs[q]
      : machine.inputAlphabet.map((a) => next(q, a).output).join('\u0001');

  let group = new Map(states.map((q) => [q, outputSignature(q)]));
  let groupCount = new Set(group.values()).size;

  while (true) {
    const refined = new Map(
      states.map((q) => [q, [group.get(q), ...machine.inputAlphabet.map((a) => group.get(next(q, a).to))].join('\u0002')]),
    );
    const refinedCount = new Set(refined.values()).size;
    group = refined;
    if (refinedCount === groupCount) break;
    groupCount = refinedCount;
  }

  // Collect groups in the original state order; the first state names the group.
  const members = new Map();
  for (const q of states) {
    if (!members.has(group.get(q))) members.set(group.get(q), []);
    members.get(group.get(q)).push(q);
  }
  const groups = [...members.values()];
  const rep = new Map();
  for (const g of groups) for (const q of g) rep.set(q, g[0]);

  const result = {
    type: machine.type,
    states: groups.map((g) => g[0]),
    inputAlphabet: [...machine.inputAlphabet],
    outputAlphabet: [...machine.outputAlphabet],
    start: rep.get(machine.start),
    transitions: [],
  };
  for (const g of groups) {
    for (const a of machine.inputAlphabet) {
      const t = next(g[0], a);
      const tr = { from: g[0], input: a, to: rep.get(t.to) };
      if (machine.type === MEALY) tr.output = t.output;
      result.transitions.push(tr);
    }
  }
  if (machine.type === MOORE) {
    result.stateOutputs = Object.fromEntries(groups.map((g) => [g[0], machine.stateOutputs[g[0]]]));
  }
  return { result, groups, removedUnreachable };
}
