/**
 * model.js — data model for Mealy and Moore machines.
 *
 * A machine is a plain JavaScript object, so it can be saved and loaded as JSON:
 *
 *   {
 *     type: "mealy" | "moore",
 *     states: ["q0", "q1"],              // Q
 *     inputAlphabet: ["a", "b"],         // Σ
 *     outputAlphabet: ["0", "1"],        // Δ
 *     start: "q0",                       // q0
 *     transitions: [                     // δ (plus λ' for Mealy)
 *       { from: "q0", input: "a", to: "q1", output: "0" }   // "output" only for Mealy
 *     ],
 *     stateOutputs: { q0: "0", q1: "1" } // λ, only for Moore
 *   }
 */

export const MEALY = 'mealy';
export const MOORE = 'moore';

/** Key that identifies the transition δ(q, a), e.g. "q0|a". */
export const edgeKey = (from, input) => `${from}|${input}`;

/** Deep copy of a machine (machines are plain data, so a JSON round trip is safe). */
export function cloneMachine(machine) {
  return JSON.parse(JSON.stringify(machine));
}

/** Lookup table "q|a" → transition object, for O(1) access inside the algorithms. */
export function transitionTable(machine) {
  const table = new Map();
  for (const t of machine.transitions) table.set(edgeKey(t.from, t.input), t);
  return table;
}

/** Returns the transition δ(q, a), or undefined if it is not defined. */
export function getTransition(machine, from, input) {
  return machine.transitions.find((t) => t.from === from && t.input === input);
}

/**
 * Parses JSON text (or an already-parsed object) into a machine.
 * Every name is converted to a trimmed string, so {"output": 1} and {"output": "1"} are the same.
 */
export function fromJSON(source) {
  const raw = typeof source === 'string' ? JSON.parse(source) : source;
  const str = (v) => String(v ?? '').trim();
  const list = (v) => (Array.isArray(v) ? v.map(str) : []);

  const machine = {
    type: str(raw.type).toLowerCase(),
    states: list(raw.states),
    inputAlphabet: list(raw.inputAlphabet),
    outputAlphabet: list(raw.outputAlphabet),
    start: str(raw.start),
    transitions: (Array.isArray(raw.transitions) ? raw.transitions : []).map((t) => {
      const tr = { from: str(t.from), input: str(t.input), to: str(t.to) };
      if (t.output !== undefined) tr.output = str(t.output);
      return tr;
    }),
  };
  if (raw.stateOutputs && typeof raw.stateOutputs === 'object') {
    machine.stateOutputs = Object.fromEntries(
      Object.entries(raw.stateOutputs).map(([q, o]) => [str(q), str(o)]),
    );
  }
  return machine;
}

/** Pretty-printed JSON text for a machine. */
export function toJSON(machine) {
  return JSON.stringify(machine, null, 2);
}

/** States reachable from the start state (breadth-first search over δ). */
export function reachableStates(machine) {
  const table = transitionTable(machine);
  const seen = new Set([machine.start]);
  const queue = [machine.start];
  while (queue.length) {
    const q = queue.shift();
    for (const a of machine.inputAlphabet) {
      const t = table.get(edgeKey(q, a));
      if (t && !seen.has(t.to)) {
        seen.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return seen;
}
