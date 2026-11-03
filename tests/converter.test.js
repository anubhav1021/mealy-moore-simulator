/**
 * Conversion tests. Test IDs (T1…) match the test table in the project guide.
 */
import { describe, expect, test } from 'vitest';
import { mealyToMoore, mooreToMealy } from '../src/core/converter.js';
import { mergeEquivalent } from '../src/core/minimizer.js';
import { checkEquivalence } from '../src/core/equivalence.js';
import { runMealy, runMoore, formatOutput } from '../src/core/simulator.js';
import lastTwoEqual from '../src/samples/last-two-equal.mealy.json';
import mod3 from '../src/samples/mod3.moore.json';
import startSplit from '../src/samples/start-split.mealy.json';
import worstCase from '../src/samples/worst-case.mealy.json';

const outputOf = (run) => formatOutput(run.outputs);
const target = (m, from, input) => m.transitions.find((t) => t.from === from && t.input === input).to;

describe('Mealy → Moore', () => {
  test('T1: worked example 1 gives 5 states and "abba" → 00010', () => {
    const { result } = mealyToMoore(lastTwoEqual);
    expect(result.states).toEqual(['q0', 'q1_0', 'q1_1', 'q2_0', 'q2_1']);
    expect(result.stateOutputs).toEqual({ q0: '0', q1_0: '0', q1_1: '1', q2_0: '0', q2_1: '1' });
    expect(result.start).toBe('q0');
    expect(target(result, 'q1_0', 'a')).toBe('q1_1');
    expect(target(result, 'q2_0', 'b')).toBe('q2_1');
    expect(outputOf(runMealy(lastTwoEqual, [...'abba']))).toBe('0010');
    expect(outputOf(runMoore(result, [...'abba']))).toBe('00010');
    expect(checkEquivalence(result, lastTwoEqual, 7).equivalent).toBe(true);
  });

  test('T4: no split when every state is entered with a single output', () => {
    const mealy = {
      type: 'mealy',
      states: ['p', 'q'],
      inputAlphabet: ['a'],
      outputAlphabet: ['0', '1'],
      start: 'p',
      transitions: [
        { from: 'p', input: 'a', to: 'q', output: '1' },
        { from: 'q', input: 'a', to: 'p', output: '0' },
      ],
    };
    const { result } = mealyToMoore(mealy);
    expect(result.states).toEqual(['p', 'q']);
    expect(result.stateOutputs).toEqual({ p: '0', q: '1' });
  });

  test('T5: start state with no incoming edges keeps the chosen default output', () => {
    const { result } = mealyToMoore(lastTwoEqual, { defaultOutput: '1' });
    expect(result.stateOutputs.q0).toBe('1');
    expect(checkEquivalence(result, lastTwoEqual, 6).equivalent).toBe(true);
  });

  test('T6: a start state that must split still gives an equivalent machine', () => {
    const { result } = mealyToMoore(startSplit);
    expect(result.states).toEqual(['q0_x', 'q0_y', 'q1']);
    expect(['q0_x', 'q0_y']).toContain(result.start);
    expect(checkEquivalence(result, startSplit, 8).equivalent).toBe(true);
  });

  test('T7: worst case reaches |Q| × |Δ| = 9 states', () => {
    const { result } = mealyToMoore(worstCase);
    expect(result.states).toHaveLength(9);
    expect(checkEquivalence(result, worstCase, 5).equivalent).toBe(true);
  });

  test('T8: self-loops with different outputs go to the right copy', () => {
    const mealy = {
      type: 'mealy',
      states: ['p', 'q'],
      inputAlphabet: ['a', 'b'],
      outputAlphabet: ['0', '1'],
      start: 'p',
      transitions: [
        { from: 'p', input: 'a', to: 'p', output: '0' },
        { from: 'p', input: 'b', to: 'q', output: '1' },
        { from: 'q', input: 'a', to: 'q', output: '0' },
        { from: 'q', input: 'b', to: 'q', output: '1' },
      ],
    };
    const { result } = mealyToMoore(mealy);
    expect(target(result, 'q_1', 'a')).toBe('q_0');
    expect(target(result, 'q_0', 'b')).toBe('q_1');
    expect(checkEquivalence(result, mealy, 8).equivalent).toBe(true);
  });

  test('T9: single-state machine', () => {
    const mealy = {
      type: 'mealy',
      states: ['s'],
      inputAlphabet: ['a'],
      outputAlphabet: ['x'],
      start: 's',
      transitions: [{ from: 's', input: 'a', to: 's', output: 'x' }],
    };
    const { result } = mealyToMoore(mealy);
    expect(result.states).toEqual(['s']);
    expect(checkEquivalence(result, mealy, 5).equivalent).toBe(true);
  });

  test('T16: multi-character names and name clashes get unique copy names', () => {
    const mealy = {
      type: 'mealy',
      states: ['even', 'even_1'],
      inputAlphabet: ['x1', 'x2'],
      outputAlphabet: ['0', '1'],
      start: 'even',
      transitions: [
        { from: 'even', input: 'x1', to: 'even', output: '0' },
        { from: 'even', input: 'x2', to: 'even', output: '1' },
        { from: 'even_1', input: 'x1', to: 'even', output: '0' },
        { from: 'even_1', input: 'x2', to: 'even_1', output: '1' },
      ],
    };
    const { result } = mealyToMoore(mealy);
    expect(new Set(result.states).size).toBe(result.states.length); // no duplicates
    expect(result.states).toContain("even_1'");
    expect(checkEquivalence(result, mealy, 6).equivalent).toBe(true);
  });

  test('throws on an invalid machine', () => {
    const broken = { ...lastTwoEqual, transitions: lastTwoEqual.transitions.slice(1) };
    expect(() => mealyToMoore(broken)).toThrow(/Missing transition/);
  });

  test('the step log ends with a "Done" step and every step has an explanation', () => {
    const { steps } = mealyToMoore(lastTwoEqual);
    expect(steps.at(-1).title).toBe('Done');
    for (const s of steps) expect(s.explanation.length).toBeGreaterThan(10);
  });
});

describe('Moore → Mealy', () => {
  test('T2 / T12: worked example 2 (mod 3), "110" → 100', () => {
    const { result } = mooreToMealy(mod3);
    expect(result.states).toEqual(['q0', 'q1', 'q2']);
    expect(result.transitions).toContainEqual({ from: 'q1', input: '0', to: 'q2', output: '2' });
    expect(outputOf(runMoore(mod3, [...'110']))).toBe('0100');
    expect(outputOf(runMealy(result, [...'110']))).toBe('100');
    expect(outputOf(runMealy(result, [...'1011']))).toBe('1222');
    expect(checkEquivalence(mod3, result, 8).equivalent).toBe(true);
  });
});

describe('Round trip', () => {
  test('T3: Mealy → Moore → Mealy, then merge, gives back 3 states', () => {
    const moore = mealyToMoore(lastTwoEqual).result;
    const back = mooreToMealy(moore).result;
    expect(back.states).toHaveLength(5);
    const { result, groups } = mergeEquivalent(back);
    expect(result.states).toHaveLength(3);
    expect(groups).toContainEqual(['q1_0', 'q1_1']);
    expect(checkEquivalence(result, lastTwoEqual, 7).equivalent).toBe(true);
  });
});
