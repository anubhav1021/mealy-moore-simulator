import { describe, expect, test } from 'vitest';
import { runMealy, runMoore, tokenize, formatOutput } from '../src/core/simulator.js';
import lastTwoEqual from '../src/samples/last-two-equal.mealy.json';
import mod3 from '../src/samples/mod3.moore.json';

describe('simulator', () => {
  test('Mealy trace for "abba"', () => {
    const r = runMealy(lastTwoEqual, [...'abba']);
    expect(r.trace.map((t) => t.to)).toEqual(['q1', 'q2', 'q2', 'q1']);
    expect(formatOutput(r.outputs)).toBe('0010');
  });

  test('T10: empty input — Moore outputs λ(q0), Mealy outputs ε', () => {
    expect(runMoore(mod3, []).outputs).toEqual(['0']);
    expect(formatOutput(runMealy(lastTwoEqual, []).outputs)).toBe('ε');
  });

  test('tokenize handles single characters, separators and multi-character symbols', () => {
    expect(tokenize('abba', ['a', 'b'])).toEqual(['a', 'b', 'b', 'a']);
    expect(tokenize('x1 x2,x1', ['x1', 'x2'])).toEqual(['x1', 'x2', 'x1']);
    expect(tokenize('x1x2', ['x1', 'x2'])).toEqual(['x1', 'x2']);
    expect(tokenize('', ['a'])).toEqual([]);
    expect(() => tokenize('abc', ['a', 'b'])).toThrow();
  });
});
