import { describe, expect, test } from 'vitest';
import { validateMachine } from '../src/core/validator.js';
import { fromJSON } from '../src/core/model.js';
import lastTwoEqual from '../src/samples/last-two-equal.mealy.json';
import mod3 from '../src/samples/mod3.moore.json';
import invalidMissing from '../src/samples/invalid-missing.mealy.json';

const copy = (m) => JSON.parse(JSON.stringify(m));

describe('validator', () => {
  test('valid samples pass', () => {
    expect(validateMachine(lastTwoEqual).valid).toBe(true);
    expect(validateMachine(mod3).valid).toBe(true);
  });

  test('T13: missing transition', () => {
    const { valid, errors } = validateMachine(invalidMissing);
    expect(valid).toBe(false);
    expect(errors).toContain('Missing transition: δ(q1, b) is not defined.');
  });

  test('T14: nondeterminism (two transitions on the same symbol)', () => {
    const m = copy(lastTwoEqual);
    m.transitions.push({ from: 'q0', input: 'a', to: 'q2', output: '1' });
    expect(validateMachine(m).errors.some((e) => e.startsWith('Nondeterminism'))).toBe(true);
  });

  test('T15: symbol not in the alphabet', () => {
    const m = copy(lastTwoEqual);
    m.transitions[0].input = 'c';
    expect(validateMachine(m).errors.join('\n')).toMatch(/"c" is not in Σ/);
  });

  test('output not in Δ, unknown start state, duplicate states', () => {
    const m = copy(lastTwoEqual);
    m.transitions[0].output = '7';
    m.start = 'qX';
    expect(validateMachine(m).errors.join('\n')).toMatch(/"7" is not in Δ/);
    expect(validateMachine(m).errors.join('\n')).toMatch(/Start state "qX"/);
    expect(validateMachine({ ...copy(lastTwoEqual), states: ['q0', 'q0'] }).errors.join('\n')).toMatch(/duplicates/);
  });

  test('Moore state without an output', () => {
    const m = copy(mod3);
    delete m.stateOutputs.q2;
    expect(validateMachine(m).errors).toContain('State "q2" has no output λ(q2).');
  });

  test('T11: unreachable state is a warning, not an error', () => {
    const m = copy(lastTwoEqual);
    m.states.push('q9');
    m.transitions.push(
      { from: 'q9', input: 'a', to: 'q0', output: '0' },
      { from: 'q9', input: 'b', to: 'q0', output: '0' },
    );
    const r = validateMachine(m);
    expect(r.valid).toBe(true);
    expect(r.warnings[0]).toMatch(/q9/);
  });

  test('fromJSON turns numbers into strings and trims names', () => {
    const m = fromJSON('{"type":"Mealy","states":[" q0 "],"inputAlphabet":[0],"outputAlphabet":[1],"start":"q0","transitions":[{"from":"q0","input":0,"to":"q0","output":1}]}');
    expect(m.type).toBe('mealy');
    expect(m.states).toEqual(['q0']);
    expect(validateMachine(m).valid).toBe(true);
  });
});
