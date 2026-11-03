/**
 * equivalence.js — checks that two machines produce the same responses.
 *
 * A Moore machine and a Mealy machine are equivalent when, for every input w,
 * the Moore output WITHOUT its first symbol equals the Mealy output.
 *
 * Two checks are provided:
 *   proveEquivalence  — exact proof for ALL strings (used by the app)
 *   checkEquivalence  — brute force on every string up to length n (used by the tests
 *                       to double-check the proof)
 */
import { MOORE, edgeKey, transitionTable } from './model.js';
import { run } from './simulator.js';

/** What a machine outputs when it reads symbol a in state q (Moore: λ of the state it enters). */
function stepOn(machine, table, q, a) {
  const t = table.get(edgeKey(q, a));
  return { to: t.to, out: machine.type === MOORE ? machine.stateOutputs[t.to] : t.output };
}

/**
 * Exact equivalence proof by running both machines side by side.
 *
 * Start with the pair (start1, start2). For every input symbol, both machines
 * move to their next states and must print the same output. Every new pair of
 * states reached is explored the same way (breadth-first search). There are at
 * most |Q1| × |Q2| pairs, so the search always ends.
 *   - If every step of every reachable pair gives equal outputs, then EVERY input
 *     string gives equal outputs (any string is just a walk through these pairs).
 *   - Otherwise the path to the first mismatch is the shortest counterexample.
 *
 * @returns {{ equivalent, pairs, counterexample?, reason? }}
 */
export function proveEquivalence(m1, m2) {
  const sameAlphabet =
    m1.inputAlphabet.length === m2.inputAlphabet.length && m1.inputAlphabet.every((a) => m2.inputAlphabet.includes(a));
  if (!sameAlphabet) return { equivalent: false, pairs: 0, reason: 'The input alphabets differ.' };

  const t1 = transitionTable(m1);
  const t2 = transitionTable(m2);
  const key = (p, q) => `${p}\u0000${q}`;
  const pathTo = new Map([[key(m1.start, m2.start), []]]); // pair → input string that reaches it
  const queue = [[m1.start, m2.start]];

  while (queue.length) {
    const [p, q] = queue.shift();
    const path = pathTo.get(key(p, q));
    for (const a of m1.inputAlphabet) {
      const s1 = stepOn(m1, t1, p, a);
      const s2 = stepOn(m2, t2, q, a);
      const input = [...path, a];
      if (s1.out !== s2.out) {
        return {
          equivalent: false,
          pairs: pathTo.size,
          counterexample: { input, response1: response(m1, input), response2: response(m2, input) },
        };
      }
      const k = key(s1.to, s2.to);
      if (!pathTo.has(k)) {
        pathTo.set(k, input);
        queue.push([s1.to, s2.to]);
      }
    }
  }
  return { equivalent: true, pairs: pathTo.size };
}

/** The machine's response to w: Mealy output, or Moore output minus λ(q0). */
export function response(machine, symbols) {
  const r = run(machine, symbols);
  if (!r.ok) throw new Error(r.error);
  return machine.type === MOORE ? r.outputs.slice(1) : r.outputs;
}

/** Generates every string over `alphabet` of length 0..maxLen, shortest first. */
export function* allStrings(alphabet, maxLen) {
  for (let len = 0; len <= maxLen; len += 1) {
    const idx = new Array(len).fill(0); // an "odometer" over alphabet positions
    while (true) {
      yield idx.map((i) => alphabet[i]);
      let pos = len - 1;
      while (pos >= 0 && idx[pos] === alphabet.length - 1) {
        idx[pos] = 0;
        pos -= 1;
      }
      if (pos < 0) break;
      idx[pos] += 1;
    }
  }
}

/** Number of strings of length 0..n over an alphabet of size k: 1 + k + … + k^n. */
export const countStrings = (k, n) => Array.from({ length: n + 1 }, (_, i) => k ** i).reduce((s, x) => s + x, 0);

/**
 * Compares two machines on all strings up to maxLen (stops after `limit` strings).
 * @returns {{ equivalent, tested, maxLen, counterexample?, reason? }}
 */
export function checkEquivalence(m1, m2, maxLen = 6, limit = 200000) {
  const sameAlphabet =
    m1.inputAlphabet.length === m2.inputAlphabet.length && m1.inputAlphabet.every((a) => m2.inputAlphabet.includes(a));
  if (!sameAlphabet) return { equivalent: false, tested: 0, maxLen, reason: 'The input alphabets differ.' };

  let tested = 0;
  for (const w of allStrings(m1.inputAlphabet, maxLen)) {
    if (tested >= limit) break;
    tested += 1;
    const r1 = response(m1, w);
    const r2 = response(m2, w);
    if (r1.length !== r2.length || r1.some((o, i) => o !== r2[i])) {
      return { equivalent: false, tested, maxLen, counterexample: { input: w, response1: r1, response2: r2 } };
    }
  }
  return { equivalent: true, tested, maxLen };
}
