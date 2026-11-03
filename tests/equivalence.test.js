/**
 * Property tests: convert many random machines and check every result is equivalent.
 */
import { describe, expect, test } from 'vitest';
import { mealyToMoore, mooreToMealy } from '../src/core/converter.js';
import { mergeEquivalent } from '../src/core/minimizer.js';
import { allStrings, checkEquivalence, countStrings, proveEquivalence } from '../src/core/equivalence.js';
import { randomMachine, seededRandom } from './helpers/random.js';
import lastTwoEqual from '../src/samples/last-two-equal.mealy.json';

describe('equivalence checker', () => {
  test('enumerates every string up to length n', () => {
    const strings = [...allStrings(['a', 'b'], 3)].map((w) => w.join(''));
    expect(strings).toHaveLength(countStrings(2, 3)); // 1 + 2 + 4 + 8 = 15
    expect(strings.slice(0, 4)).toEqual(['', 'a', 'b', 'aa']);
  });

  test('finds a counterexample when a conversion is wrong', () => {
    const { result } = mealyToMoore(lastTwoEqual);
    result.stateOutputs.q1_1 = '0'; // break it on purpose
    const r = checkEquivalence(result, lastTwoEqual, 5);
    expect(r.equivalent).toBe(false);
    expect(r.counterexample.input.join('')).toBe('aa');
  });
});

describe('exact equivalence proof', () => {
  test('proves the worked examples equivalent', () => {
    const { result } = mealyToMoore(lastTwoEqual);
    const r = proveEquivalence(result, lastTwoEqual);
    expect(r.equivalent).toBe(true);
    expect(r.pairs).toBeGreaterThan(0);
  });

  test('finds the same shortest counterexample as brute force', () => {
    const { result } = mealyToMoore(lastTwoEqual);
    result.stateOutputs.q1_1 = '0';
    expect(proveEquivalence(result, lastTwoEqual).counterexample.input.join('')).toBe('aa');
  });

  test('agrees with brute force on 300 random machine pairs', () => {
    const rand = seededRandom(14);
    for (let i = 0; i < 300; i += 1) {
      const a = randomMachine(rand, 'mealy');
      const b = randomMachine(rand, 'moore');
      b.inputAlphabet = [...a.inputAlphabet];
      b.transitions = b.states.flatMap((q) =>
        a.inputAlphabet.map((s) => ({ from: q, input: s, to: b.states[Math.floor(rand() * b.states.length)] })),
      );
      const proof = proveEquivalence(a, b);
      if (proof.equivalent) {
        // A proof of equivalence must survive brute force.
        expect(checkEquivalence(a, b, 8).equivalent).toBe(true);
      } else {
        // The counterexample must be real, and brute force must find one of the same (shortest) length.
        const { input, response1, response2 } = proof.counterexample;
        expect(response1).not.toEqual(response2);
        const brute = checkEquivalence(a, b, input.length);
        expect(brute.equivalent).toBe(false);
        expect(brute.counterexample.input.length).toBe(input.length);
      }
    }
  });
});

describe('random machines (property test)', () => {
  const rand = seededRandom(302);

  test('100 random Mealy machines: Mealy → Moore is equivalent and within |Q|·|Δ| states', () => {
    for (let i = 0; i < 100; i += 1) {
      const mealy = randomMachine(rand, 'mealy');
      const { result } = mealyToMoore(mealy);
      expect(result.states.length).toBeLessThanOrEqual(mealy.states.length * mealy.outputAlphabet.length);
      expect(checkEquivalence(result, mealy, 6).equivalent).toBe(true);
    }
  });

  test('100 random Moore machines: Moore → Mealy is equivalent with the same states', () => {
    for (let i = 0; i < 100; i += 1) {
      const moore = randomMachine(rand, 'moore');
      const { result } = mooreToMealy(moore);
      expect(result.states).toEqual(moore.states);
      expect(checkEquivalence(moore, result, 6).equivalent).toBe(true);
    }
  });

  test('merging equivalent states never changes behaviour', () => {
    for (let i = 0; i < 50; i += 1) {
      const mealy = randomMachine(rand, 'mealy');
      const { result } = mergeEquivalent(mealy);
      expect(result.states.length).toBeLessThanOrEqual(mealy.states.length);
      expect(checkEquivalence(result, mealy, 6).equivalent).toBe(true);
    }
  });
});
