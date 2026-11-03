/**
 * simulator.js — runs an input string through a machine and records the trace.
 */
import { MEALY, MOORE, edgeKey, transitionTable } from './model.js';

/**
 * Splits an input string into symbols of the alphabet.
 * - "abba"      → ["a","b","b","a"]   (single-character alphabets)
 * - "x1 x2 x1"  → ["x1","x2","x1"]    (spaces or commas separate multi-character symbols)
 * - "x1x2"      → ["x1","x2"]         (longest-match when no separators are used)
 * Throws if part of the string is not a symbol of the alphabet.
 */
export function tokenize(input, alphabet) {
  const text = String(input ?? '').trim();
  if (text === '' || text === 'ε') return [];
  if (/[\s,]/.test(text)) return text.split(/[\s,]+/).filter(Boolean);

  const symbols = [...alphabet].sort((x, y) => y.length - x.length); // longest first
  const result = [];
  let i = 0;
  while (i < text.length) {
    const match = symbols.find((s) => text.startsWith(s, i));
    if (!match) throw new Error(`"${text.slice(i)}" does not start with a symbol of Σ = {${alphabet.join(', ')}}.`);
    result.push(match);
    i += match.length;
  }
  return result;
}

/**
 * Runs a Mealy machine. Output length = input length.
 * @returns {{ ok, outputs, trace, finalState, error? }}
 */
export function runMealy(machine, symbols) {
  const table = transitionTable(machine);
  const trace = [];
  const outputs = [];
  let q = machine.start;
  for (const [i, a] of symbols.entries()) {
    const t = table.get(edgeKey(q, a));
    if (!t) return { ok: false, error: `No transition from ${q} on "${a}" (symbol ${i + 1}).`, outputs, trace };
    trace.push({ step: i + 1, from: q, input: a, to: t.to, output: t.output });
    outputs.push(t.output);
    q = t.to;
  }
  return { ok: true, outputs, trace, finalState: q };
}

/**
 * Runs a Moore machine. Output length = input length + 1, because λ(q0)
 * is emitted before any input is read.
 */
export function runMoore(machine, symbols) {
  const table = transitionTable(machine);
  const trace = [];
  const outputs = [machine.stateOutputs[machine.start]];
  let q = machine.start;
  for (const [i, a] of symbols.entries()) {
    const t = table.get(edgeKey(q, a));
    if (!t) return { ok: false, error: `No transition from ${q} on "${a}" (symbol ${i + 1}).`, outputs, trace };
    const o = machine.stateOutputs[t.to];
    trace.push({ step: i + 1, from: q, input: a, to: t.to, output: o });
    outputs.push(o);
    q = t.to;
  }
  return { ok: true, outputs, trace, finalState: q };
}

/** Runs either kind of machine. */
export function run(machine, symbols) {
  if (machine.type === MEALY) return runMealy(machine, symbols);
  if (machine.type === MOORE) return runMoore(machine, symbols);
  throw new Error(`Unknown machine type "${machine.type}".`);
}

/** Joins output symbols for display: "0010" for single characters, "x y z" otherwise. */
export function formatOutput(outputs) {
  if (outputs.length === 0) return 'ε';
  return outputs.every((o) => o.length === 1) ? outputs.join('') : outputs.join(' ');
}
