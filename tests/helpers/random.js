/**
 * Random machine generator for property tests.
 * Uses a seeded generator so every test run checks the same machines.
 */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A complete, deterministic random Mealy or Moore machine. */
export function randomMachine(rand, type) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const nStates = 1 + Math.floor(rand() * 5); // 1–5 states
  const nIn = 1 + Math.floor(rand() * 3); // 1–3 input symbols
  const nOut = 1 + Math.floor(rand() * 3); // 1–3 output symbols
  const states = Array.from({ length: nStates }, (_, i) => `s${i}`);
  const inputAlphabet = ['a', 'b', 'c'].slice(0, nIn);
  const outputAlphabet = ['0', '1', '2'].slice(0, nOut);

  const transitions = [];
  for (const q of states) {
    for (const a of inputAlphabet) {
      const t = { from: q, input: a, to: pick(states) };
      if (type === 'mealy') t.output = pick(outputAlphabet);
      transitions.push(t);
    }
  }
  const machine = { type, states, inputAlphabet, outputAlphabet, start: pick(states), transitions };
  if (type === 'moore') machine.stateOutputs = Object.fromEntries(states.map((q) => [q, pick(outputAlphabet)]));
  return machine;
}
